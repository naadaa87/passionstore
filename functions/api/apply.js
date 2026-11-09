/**
 * 열정상회 신청서 접수 (Cloudflare Pages Functions)
 * 주소: POST /api/apply
 *
 * 받은 신청서를 아래 두 곳 가운데 연결된 곳으로 보냅니다. 둘 다 연결해도 됩니다.
 *  1) 구글 시트: Cloudflare Pages 설정 > 변수(Variables and Secrets)에
 *     APPLY_WEBHOOK_URL = 구글 Apps Script 웹 앱 주소
 *     APPLY_WEBHOOK_SECRET = 아무 긴 문자열(Apps Script의 SECRET과 같게)
 *  2) Cloudflare KV: 설정 > 바인딩(Bindings)에 KV 네임스페이스를 APPLICATIONS 라는 이름으로 연결
 *
 * 아무것도 연결하지 않으면 503을 돌려주고, 화면에서는 신청 내용을 복사해 보내는 안내가 나옵니다.
 */

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

  let delivered = false;
  const errors = [];

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
