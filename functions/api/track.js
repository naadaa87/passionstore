/**
 * 홈페이지 방문 통계 받기 (POST /api/track)
 *
 * 쿠키를 쓰지 않고 IP 주소도 저장하지 않습니다.
 * - 방문자: 그날만 쓰는 무작위 값 + IP + 브라우저 정보를 섞은 해시. 무작위 값은 이틀 뒤 지우므로 되돌릴 수 없고, 날이 바뀌면 이어지지 않습니다.
 * - 세션: 브라우저 탭을 닫으면 사라지는 무작위 값(sessionStorage)
 * 브라우저에서 "추적 안 함"을 켠 방문자는 보내지 않습니다(assets/js/track.js).
 */
import { ensureSchema, today, now } from '../../server/db.js';

const BOT = /bot|crawl|spider|slurp|Yeti|Daumoa|headless|lighthouse|pagespeed|facebookexternalhit|kakaotalk-scrap|preview|python|curl|wget|java\//i;
const KINDS = ['pv', 'end', 'click', 'faq', 'form_start'];
const ID = /^[a-z0-9]{8,24}$/;

let saltCache = { day: '', salt: '' };

async function daySalt(db, day) {
  if (saltCache.day === day) return saltCache.salt;
  const fresh = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  const ins = await db.prepare('INSERT OR IGNORE INTO analytics_salt (day, salt) VALUES (?, ?)').bind(day, fresh).run();
  if (ins.meta && ins.meta.changes) {
    // 하루에 한 번, 13개월(400일)이 지난 방문 기록을 지웁니다.
    const cutoff = new Date(Date.parse(day + 'T00:00:00Z') - 400 * 86400000).toISOString().slice(0, 10);
    await db.batch([
      db.prepare('DELETE FROM pageviews WHERE day < ?').bind(cutoff),
      db.prepare('DELETE FROM events WHERE day < ?').bind(cutoff),
    ]);
  }
  const row = await db.prepare('SELECT salt FROM analytics_salt WHERE day = ?').bind(day).first();
  // 이틀 지난 무작위 값은 지워서 해시를 되돌릴 수 없게 합니다.
  const old = new Date(Date.parse(day + 'T00:00:00Z') - 2 * 86400000).toISOString().slice(0, 10);
  await db.prepare('DELETE FROM analytics_salt WHERE day < ?').bind(old).run();
  saltCache = { day, salt: row.salt };
  return row.salt;
}

async function hash(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

function cleanPath(p) {
  let s = String(p || '/').split(/[?#]/)[0].slice(0, 120);
  if (!s.startsWith('/')) s = '/' + s;
  s = s.replace(/\.html$/, '').replace(/\/index$/, '/');
  if (s === '/journal') s = '/journal/';
  return s;
}

// 들어온 경로 나누기
function source(refUrl, ua, host) {
  let refHost = '';
  try { refHost = refUrl ? new URL(refUrl).hostname.toLowerCase() : ''; } catch (e) { refHost = ''; }
  const base = host.replace(/^www\./, '');
  if (refHost && (refHost.replace(/^www\./, '') === base || /(^|\.)passionstore\.(kr|pages\.dev)$/.test(refHost))) return { kind: 'internal', host: '' };
  if (!refHost) {
    if (/KAKAOTALK/i.test(ua)) return { kind: 'kakao', host: '' };
    if (/Instagram/i.test(ua)) return { kind: 'instagram', host: '' };
    if (/NAVER\(inapp/i.test(ua)) return { kind: 'naver', host: '' };
    return { kind: 'direct', host: '' };
  }
  const h = refHost.replace(/^(www|m)\./, '');
  const rules = [
    [/(^|\.)(blog|cafe)\.naver\.com$/, 'naver_blog'],
    [/(^|\.)naver\.com$/, 'naver'],
    [/(^|\.)google\.[a-z.]+$/, 'google'],
    [/(^|\.)daum\.net$/, 'daum'],
    [/(^|\.)kakao\.com$|(^|\.)kakaocdn\.net$/, 'kakao'],
    [/(^|\.)bing\.com$/, 'bing'],
    [/(^|\.)instagram\.com$/, 'instagram'],
    [/(^|\.)(facebook|fb)\.com$/, 'facebook'],
    [/(^|\.)threads\.(net|com)$/, 'threads'],
    [/(^|\.)youtube\.com$|^youtu\.be$/, 'youtube'],
  ];
  for (const [re, kind] of rules) if (re.test(refHost)) return { kind, host: h };
  return { kind: 'other', host: h.slice(0, 80) };
}

const device = (ua) => (/iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop');
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const done = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) return done();
    const ua = request.headers.get('user-agent') || '';
    if (!ua || BOT.test(ua)) return done();
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== url.host) return done();
    if (request.headers.get('sec-fetch-site') === 'cross-site') return done();
    const text = await request.text();
    if (text.length > 4000) return done();
    let b;
    try { b = JSON.parse(text); } catch (e) { return done(); }
    if (!b || !KINDS.includes(b.t) || !ID.test(b.sid || '')) return done();
    const path = cleanPath(b.p);
    if (/^\/(admin|api)(\/|$)/.test(path)) return done();

    const db = env.DB;
    await ensureSchema(db);
    const day = today();
    const at = now();

    if (b.t === 'pv') {
      if (!ID.test(b.id || '')) return done();
      const ip = request.headers.get('cf-connecting-ip') || '';
      const salt = await daySalt(db, day);
      const visitor = await hash(`${salt}|${ip}|${ua}|${url.host}`);
      const src = source(str(b.r, 400), ua, url.hostname);
      await db.prepare(`INSERT OR IGNORE INTO pageviews (id, day, at, path, title, visitor, session, ref_kind, ref_host, utm_source, utm_medium, utm_campaign, device)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(b.id, day, at, path, str(b.title, 120).replace(/\s*\|\s*열정상회.*$/, ''), visitor, b.sid, src.kind, src.host,
          str(b.us, 60).toLowerCase(), str(b.um, 60).toLowerCase(), str(b.uc, 80), device(ua))
        .run();
      return done();
    }

    if (b.t === 'end') {
      if (!ID.test(b.id || '')) return done();
      const sec = Math.max(0, Math.min(1800, parseInt(b.s, 10) || 0));
      const sc = Math.max(0, Math.min(100, parseInt(b.sc, 10) || 0));
      const since = new Date(Date.now() + 9 * 3600000 - 86400000).toISOString().slice(0, 10);
      await db.prepare('UPDATE pageviews SET seconds = MAX(seconds, ?), scroll = MAX(scroll, ?) WHERE id = ? AND session = ? AND day >= ?')
        .bind(sec, sc, b.id, b.sid, since).run();
      return done();
    }

    // click / faq / form_start
    await db.prepare('INSERT INTO events (day, at, kind, path, label, target, session) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(day, at, b.t, path, str(b.label, 80), str(b.target, 120), b.sid).run();
    return done();
  } catch (e) {
    console.error(e);
    return done();
  }
}

export const onRequest = () => new Response(null, { status: 405, headers: { allow: 'POST' } });
