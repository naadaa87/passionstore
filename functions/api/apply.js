/**
 * 열정상회 신청서 접수 (Cloudflare Pages Functions)
 * 주소: POST /api/apply
 *
 * 받은 신청서를 아래 가운데 연결된 곳에 모두 저장합니다.
 *  1) D1 데이터베이스(권장): 설정 > 바인딩에 D1을 DB 라는 이름으로 연결하면
 *     관리자 화면(/admin)의 신청 관리에 바로 나타납니다.
 *  2) 구글 시트: 변수에 APPLY_WEBHOOK_URL(Apps Script 웹 앱 주소)과
 *     APPLY_WEBHOOK_SECRET(Apps Script의 SECRET과 같은 값)을 넣으면 시트에도 한 줄씩 쌓입니다.
 *  3) Cloudflare KV: 바인딩에 KV 네임스페이스를 APPLICATIONS 라는 이름으로 연결
 *
 * 아무것도 연결하지 않으면 503을 돌려주고, 화면에서는 신청 내용을 복사해 보내는 안내가 나옵니다.
 */
import { ensureSchema, run } from '../../server/db.js';

const MAX_LEN = 2000;
const REQUIRED = {
  apply: ['name', 'phone', 'region', 'work', 'bizType', 'worry', 'canHelp', 'consentCharter', 'consentPrivacy'],
  jangnal: ['name', 'phone', 'session', 'work', 'consentPrivacy'],
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function onRequestPost({ request, env }) {
  // 다른 사이트에서 보낸 요청은 받지 않습니다.
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return json({ ok: false, error: 'forbidden' }, 403);
    } catch (e) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }
  }

  const len = Number(request.headers.get('content-length') || 0);
  if (len > 20000) return json({ ok: false, error: 'too_large' }, 413);

  let data;
  try {
    data = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'bad_request' }, 400);
  }
  if (!data || typeof data !== 'object') return json({ ok: false, error: 'bad_request' }, 400);

  // 자동 등록 방지용 숨은 칸에 값이 있으면 받은 척만 합니다.
  if (data.website) return json({ ok: true });

  const type = data.type === 'jangnal' ? 'jangnal' : 'apply';
  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === 'website' || key === 'type') continue;
    if (!/^[a-zA-Z]{1,30}$/.test(key)) continue;
    clean[key] = Array.isArray(value)
      ? value.slice(0, 10).map((v) => String(v).slice(0, 100)).join(', ')
      : String(value ?? '').trim().slice(0, MAX_LEN);
  }

  const missing = REQUIRED[type].filter((k) => !clean[k]);
  if (missing.length) return json({ ok: false, error: 'missing', fields: missing }, 422);

  const record = {
    ...clean,
    id: crypto.randomUUID(),
    type,
    receivedAt: new Date().toISOString(),
  };

  // 장날 신청: session에는 날짜(YYYY-MM-DD) 또는 notify(다음 장날 알림만)가 들어옵니다.
  if (type === 'jangnal') {
    const raw = clean.session || '';
    clean.session = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : (raw === 'notify' || /알림/.test(raw) ? 'notify' : raw.slice(0, 40));
    if (!clean.sessionLabel) clean.sessionLabel = clean.session === 'notify' ? '다음 장날 알림만 받기' : raw;
    record.session = clean.session;
    record.sessionLabel = clean.sessionLabel;
  }

  let delivered = false;
  const errors = [];

  if (env.DB) {
    try {
      await ensureSchema(env.DB);
      const data = { ...clean };
      ['name', 'phone', 'email', 'session', 'source'].forEach((k) => delete data[k]);
      await run(env.DB,
        'INSERT INTO applications (id, type, status, name, phone, email, session, source, data, memo, member_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, \'\', NULL, ?, ?)',
        record.id, type, type === 'jangnal' && clean.session === 'notify' ? 'notify' : 'new',
        clean.name || '', clean.phone || '', clean.email || '', clean.session || '', clean.source || '',
        JSON.stringify(data), record.receivedAt, record.receivedAt);
      delivered = true;
    } catch (e) {
      console.error(e);
      errors.push('db');
    }
  }

  if (env.APPLY_WEBHOOK_URL) {
    try {
      const res = await fetch(env.APPLY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret: env.APPLY_WEBHOOK_SECRET || '', ...record }),
      });
      const text = await res.text();
      if (res.ok && !/forbidden/i.test(text)) delivered = true;
      else errors.push('webhook');
    } catch (e) {
      errors.push('webhook');
    }
  }

  if (env.APPLICATIONS) {
    try {
      await env.APPLICATIONS.put(`${type}:${record.receivedAt}:${record.id}`, JSON.stringify(record));
      delivered = true;
    } catch (e) {
      errors.push('kv');
    }
  }

  if (!delivered) {
    return json({ ok: false, error: errors.length ? 'delivery_failed' : 'not_configured' }, 503);
  }
  return json({ ok: true, id: record.id });
}

export function onRequest() {
  return json({ ok: false, error: 'method_not_allowed' }, 405);
}
