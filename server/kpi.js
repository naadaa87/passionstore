// 운영 지표(KPI) 계산: GET /api/admin/kpi?days=7|30|90|365
// 지금 기간과 바로 앞 같은 길이의 기간을 함께 계산해 변화를 보여 줍니다.
import { all, first, today } from './db.js';
import { json } from './http.js';

const addDays = (d, n) => {
  const x = new Date(d + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
// 한국 날짜 범위를 저장된 UTC 시각과 비교하기 위한 경계
const startIso = (day) => new Date(Date.parse(day + 'T00:00:00+09:00')).toISOString();
const endIso = (day) => new Date(Date.parse(day + 'T00:00:00+09:00') + 86400000).toISOString();
const num = (v) => (v == null ? 0 : Number(v));
const digits = (s) => String(s || '').replace(/\D/g, '');

async function traffic(db, a, b) {
  const t = await first(db,
    `SELECT COUNT(*) AS pageviews, COUNT(DISTINCT visitor) AS visitors, COUNT(DISTINCT session) AS sessions,
            AVG(CASE WHEN seconds > 0 THEN seconds END) AS page_sec,
            AVG(CASE WHEN seconds > 0 OR scroll > 0 THEN (CASE WHEN scroll >= 75 THEN 1.0 ELSE 0 END) END) AS read_rate
       FROM pageviews WHERE day BETWEEN ? AND ?`, a, b);
  const s = await first(db,
    `SELECT COUNT(*) AS n, SUM(CASE WHEN c = 1 THEN 1 ELSE 0 END) AS single, AVG(CASE WHEN tot > 0 THEN tot END) AS sec
       FROM (SELECT session, COUNT(*) AS c, SUM(seconds) AS tot FROM pageviews WHERE day BETWEEN ? AND ? GROUP BY session)`, a, b);
  const c = await first(db,
    `SELECT COUNT(*) AS clicks, COUNT(DISTINCT session) AS sessions FROM events WHERE kind = 'click' AND day BETWEEN ? AND ?`, a, b);
  const sessions = num(t.sessions);
  return {
    visitors: num(t.visitors),
    pageviews: num(t.pageviews),
    sessions,
    pagesPerSession: sessions ? num(t.pageviews) / sessions : 0,
    sessionSec: num(s.sec),
    pageSec: num(t.page_sec),
    bounceRate: sessions ? num(s.single) / sessions : null,
    readRate: t.read_rate == null ? null : num(t.read_rate),
    clicks: num(c.clicks),
    clickRate: sessions ? num(c.sessions) / sessions : null,
  };
}

async function memberCore(db, a, b) {
  const ev = await all(db, 'SELECT kind, COUNT(*) AS n FROM member_events WHERE day BETWEEN ? AND ? GROUP BY kind', a, b);
  const by = Object.fromEntries(ev.map((r) => [r.kind, num(r.n)]));
  const base = await first(db,
    `SELECT SUM(CASE WHEN kind = 'join' THEN 1 ELSE 0 END) - SUM(CASE WHEN kind = 'left' THEN 1 ELSE 0 END) AS n
       FROM member_events WHERE day < ?`, a);
  const atStart = Math.max(0, num(base && base.n));
  return { joins: by.join || 0, lefts: by.left || 0, pauses: by.pause || 0, atStart, churn: atStart ? (by.left || 0) / atStart : null };
}

async function meetingCore(db, a, b) {
  const g = await first(db,
    `SELECT COUNT(*) AS n, SUM(chair_led) AS chair, SUM(CASE WHEN mode = 'online' THEN 1 ELSE 0 END) AS online
       FROM meetings WHERE date BETWEEN ? AND ?`, a, b);
  const at = await first(db,
    `SELECT COUNT(*) AS total, SUM(a.present) AS present FROM attendance a JOIN meetings g ON g.id = a.meeting_id WHERE g.date BETWEEN ? AND ?`, a, b);
  const n = num(g.n);
  return {
    meetings: n,
    chairLed: num(g.chair),
    online: num(g.online),
    present: num(at.present),
    records: num(at.total),
    attendRate: num(at.total) ? num(at.present) / num(at.total) : null,
    avgPresent: n ? num(at.present) / n : null,
  };
}

async function applyCore(db, a, b) {
  const r = await first(db,
    `SELECT COUNT(*) AS n,
            SUM(CASE WHEN status IN ('interview', 'approved', 'joined') THEN 1 ELSE 0 END) AS interviewed,
            SUM(CASE WHEN status = 'joined' THEN 1 ELSE 0 END) AS joined
       FROM applications WHERE type = 'apply' AND created_at >= ? AND created_at < ?`, startIso(a), endIso(b));
  return { applications: num(r.n), interviewed: num(r.interviewed), joined: num(r.joined) };
}

// 회원 변동 기록이 생기기 전에 등록된 회원을 한 번만 옮겨 적습니다.
async function backfill(db) {
  const has = await first(db, 'SELECT COUNT(*) AS n FROM member_events');
  if (num(has.n) > 0) return;
  const rows = await all(db, 'SELECT id, tier, status, joined_at, created_at, updated_at FROM members');
  if (!rows.length) return;
  const stmts = [];
  rows.forEach((m) => {
    const joined = m.joined_at || String(m.created_at || '').slice(0, 10) || today();
    stmts.push(db.prepare('INSERT INTO member_events (member_id, kind, tier, day) VALUES (?, ?, ?, ?)').bind(m.id, 'join', m.tier, joined));
    if (m.status === 'left') {
      stmts.push(db.prepare('INSERT INTO member_events (member_id, kind, tier, day) VALUES (?, ?, ?, ?)')
        .bind(m.id, 'left', m.tier, new Date(Date.parse(m.updated_at) + 9 * 3600000).toISOString().slice(0, 10)));
    }
  });
  await db.batch(stmts);
}

export async function kpi({ db, request }) {
  const u = new URL(request.url);
  const asked = parseInt(u.searchParams.get('days'), 10);
  const days = [7, 30, 90, 365].includes(asked) ? asked : 30;
  const end = today();
  const start = addDays(end, -(days - 1));
  const pEnd = addDays(start, -1);
  const pStart = addDays(pEnd, -(days - 1));
  await backfill(db);

  /* ---------- 홈페이지 ---------- */
  const [cur, prev] = await Promise.all([traffic(db, start, end), traffic(db, pStart, pEnd)]);
  const monthly = days > 90;
  const seriesRows = await all(db,
    `SELECT ${monthly ? 'substr(day, 1, 7)' : 'day'} AS k, COUNT(*) AS pageviews, COUNT(DISTINCT visitor) AS visitors
       FROM pageviews WHERE day BETWEEN ? AND ? GROUP BY k ORDER BY k`, start, end);
  const byKey = Object.fromEntries(seriesRows.map((r) => [r.k, r]));
  const series = [];
  if (monthly) {
    for (let d = start.slice(0, 7) + '-01'; d.slice(0, 7) <= end.slice(0, 7); d = addDays(d, 32).slice(0, 7) + '-01') {
      const k = d.slice(0, 7);
      series.push({ k, visitors: num(byKey[k] && byKey[k].visitors), pageviews: num(byKey[k] && byKey[k].pageviews) });
    }
  } else {
    for (let d = start; d <= end; d = addDays(d, 1)) series.push({ k: d, visitors: num(byKey[d] && byKey[d].visitors), pageviews: num(byKey[d] && byKey[d].pageviews) });
  }

  const pages = await all(db,
    `SELECT path, MAX(title) AS title, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors,
            AVG(CASE WHEN seconds > 0 THEN seconds END) AS sec,
            AVG(CASE WHEN seconds > 0 OR scroll > 0 THEN (CASE WHEN scroll >= 75 THEN 1.0 ELSE 0 END) END) AS read_rate
       FROM pageviews WHERE day BETWEEN ? AND ? GROUP BY path ORDER BY views DESC LIMIT 25`, start, end);
  const journal = await all(db,
    `SELECT path, MAX(title) AS title, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors,
            AVG(CASE WHEN seconds > 0 THEN seconds END) AS sec,
            AVG(CASE WHEN seconds > 0 OR scroll > 0 THEN (CASE WHEN scroll >= 75 THEN 1.0 ELSE 0 END) END) AS read_rate
       FROM pageviews WHERE day BETWEEN ? AND ? AND path LIKE '/journal/_%' GROUP BY path ORDER BY views DESC LIMIT 10`, start, end);
  const sources = await all(db,
    `SELECT ref_kind AS kind, COUNT(DISTINCT session) AS n FROM pageviews
      WHERE day BETWEEN ? AND ? AND ref_kind != 'internal' GROUP BY ref_kind ORDER BY n DESC`, start, end);
  const refHosts = await all(db,
    `SELECT ref_host AS host, COUNT(DISTINCT session) AS n FROM pageviews
      WHERE day BETWEEN ? AND ? AND ref_kind = 'other' AND ref_host != '' GROUP BY ref_host ORDER BY n DESC LIMIT 8`, start, end);
  const campaigns = await all(db,
    `SELECT utm_source AS source, utm_medium AS medium, utm_campaign AS campaign, COUNT(DISTINCT session) AS n FROM pageviews
      WHERE day BETWEEN ? AND ? AND utm_source != '' GROUP BY utm_source, utm_medium, utm_campaign ORDER BY n DESC LIMIT 8`, start, end);
  const devices = await all(db,
    `SELECT device, COUNT(DISTINCT session) AS n FROM pageviews WHERE day BETWEEN ? AND ? GROUP BY device ORDER BY n DESC`, start, end);
  const clicks = await all(db,
    `SELECT label, target, COUNT(*) AS n, COUNT(DISTINCT session) AS sessions FROM events
      WHERE kind = 'click' AND day BETWEEN ? AND ? GROUP BY label, target ORDER BY n DESC LIMIT 15`, start, end);
  const faq = await all(db,
    `SELECT label, COUNT(*) AS n FROM events WHERE kind = 'faq' AND day BETWEEN ? AND ? AND label != '' GROUP BY label ORDER BY n DESC LIMIT 10`, start, end);
  const formStarts = await all(db,
    `SELECT label, COUNT(DISTINCT session) AS n FROM events WHERE kind = 'form_start' AND day BETWEEN ? AND ? GROUP BY label`, start, end);
  const pageSessions = await all(db,
    `SELECT path, COUNT(DISTINCT session) AS n FROM pageviews WHERE day BETWEEN ? AND ? AND path IN ('/join', '/jangnal') GROUP BY path`, start, end);
  const ps = Object.fromEntries(pageSessions.map((r) => [r.path, num(r.n)]));
  const fs = Object.fromEntries(formStarts.map((r) => [r.label, num(r.n)]));

  /* ---------- 가입 흐름 ---------- */
  const [applyCur, applyPrev] = await Promise.all([applyCore(db, start, end), applyCore(db, pStart, pEnd)]);
  const appSources = await all(db,
    `SELECT COALESCE(NULLIF(source, ''), '모름') AS source, COUNT(*) AS n FROM applications
      WHERE type = 'apply' AND created_at >= ? AND created_at < ? GROUP BY 1 ORDER BY n DESC`, startIso(start), endIso(end));
  const lead = await first(db,
    `SELECT AVG(julianday(m.created_at) - julianday(a.created_at)) AS days, COUNT(*) AS n
       FROM applications a JOIN members m ON m.application_id = a.id
      WHERE a.type = 'apply' AND m.created_at >= ? AND m.created_at < ?`, startIso(start), endIso(end));
  const jApps = await first(db,
    `SELECT COUNT(*) AS n,
            SUM(CASE WHEN status IN ('confirmed', 'attended', 'no_show') THEN 1 ELSE 0 END) AS confirmed,
            SUM(CASE WHEN status = 'attended' THEN 1 ELSE 0 END) AS attended
       FROM applications WHERE type = 'jangnal' AND session != 'notify' AND status != 'canceled' AND created_at >= ? AND created_at < ?`,
    startIso(start), endIso(end));

  /* ---------- 회원 ---------- */
  const [memCur, memPrev] = await Promise.all([memberCore(db, start, end), memberCore(db, pStart, pEnd)]);
  const counts = await all(db, 'SELECT tier, status, COUNT(*) AS n FROM members GROUP BY tier, status');
  const cnt = (tier, status) => counts.filter((r) => (!tier || r.tier === tier) && (!status || r.status === status)).reduce((s, r) => s + num(r.n), 0);
  // 이번 달을 포함한 최근 12개월
  const monthStart = new Date(Date.UTC(+end.slice(0, 4), +end.slice(5, 7) - 12, 1)).toISOString().slice(0, 7);
  const monthRows = await all(db,
    `SELECT substr(day, 1, 7) AS m, kind, COUNT(*) AS n FROM member_events
      WHERE substr(day, 1, 7) >= ? AND kind IN ('join', 'left') GROUP BY m, kind`, monthStart);
  const months = [];
  for (let d = monthStart + '-01'; d.slice(0, 7) <= end.slice(0, 7); d = addDays(d, 32).slice(0, 7) + '-01') {
    const m = d.slice(0, 7);
    months.push({ m, joins: num((monthRows.find((r) => r.m === m && r.kind === 'join') || {}).n), lefts: num((monthRows.find((r) => r.m === m && r.kind === 'left') || {}).n) });
  }
  const retention = await first(db,
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN EXISTS (SELECT 1 FROM member_events l WHERE l.member_id = j.member_id AND l.kind = 'left'
                                    AND l.day >= j.day AND l.day <= date(j.day, '+90 days')) THEN 0 ELSE 1 END) AS kept
       FROM member_events j WHERE j.kind = 'join' AND j.day <= ?`, addDays(end, -90));
  const fee = await first(db,
    `SELECT COUNT(*) AS total, SUM(CASE WHEN fee_status = 'paid' AND fee_paid_until >= ? THEN 1 ELSE 0 END) AS paid
       FROM members WHERE status = 'active' AND fee_status != 'exempt'`, end);
  const checks = await first(db,
    `SELECT COUNT(*) AS total, SUM(verified) AS verified, SUM(charter_signed) AS charter FROM members WHERE status = 'active'`);
  const memberSources = await all(db,
    `SELECT COALESCE(NULLIF(source, ''), '모름') AS source, COUNT(*) AS n FROM members WHERE status != 'left' GROUP BY 1 ORDER BY n DESC`);
  const recentMembers = await all(db,
    `SELECT m.id, m.name, m.work, m.tier, m.joined_at, s.name AS sangdan_name FROM members m
       LEFT JOIN sangdans s ON s.id = m.sangdan_id WHERE m.status != 'left' ORDER BY m.joined_at DESC, m.created_at DESC LIMIT 8`);
  const unassigned = await first(db,
    `SELECT COUNT(*) AS n FROM members WHERE status = 'active' AND tier = 'member' AND (sangdan_id IS NULL OR sangdan_id = '')`);

  /* ---------- 모임 ---------- */
  const [meetCur, meetPrev] = await Promise.all([meetingCore(db, start, end), meetingCore(db, pStart, pEnd)]);
  const sd = await first(db,
    `SELECT COUNT(*) AS open, SUM(capacity) AS capacity,
            (SELECT COUNT(*) FROM members m JOIN sangdans s2 ON s2.id = m.sangdan_id WHERE s2.status = 'open' AND m.status = 'active') AS seated
       FROM sangdans WHERE status = 'open'`);
  const sdNew = await first(db, 'SELECT COUNT(*) AS n FROM sangdans WHERE created_at >= ? AND created_at < ?', startIso(start), endIso(end));
  const sangdans = await all(db,
    `SELECT s.id, s.name, s.slot, s.capacity, s.status,
            (SELECT COUNT(*) FROM members m WHERE m.sangdan_id = s.id AND m.status = 'active') AS members,
            (SELECT COUNT(*) FROM meetings g WHERE g.sangdan_id = s.id AND g.date BETWEEN ?1 AND ?2) AS meetings,
            (SELECT COUNT(*) FROM attendance a JOIN meetings g ON g.id = a.meeting_id WHERE g.sangdan_id = s.id AND g.date BETWEEN ?1 AND ?2) AS records,
            (SELECT SUM(a.present) FROM attendance a JOIN meetings g ON g.id = a.meeting_id WHERE g.sangdan_id = s.id AND g.date BETWEEN ?1 AND ?2) AS present,
            (SELECT SUM(g.chair_led) FROM meetings g WHERE g.sangdan_id = s.id AND g.date BETWEEN ?1 AND ?2) AS chair,
            (SELECT MAX(date) FROM meetings g WHERE g.sangdan_id = s.id) AS last_meeting
       FROM sangdans s
      WHERE s.status = 'open' OR EXISTS (SELECT 1 FROM meetings g WHERE g.sangdan_id = s.id AND g.date BETWEEN ?1 AND ?2)
      ORDER BY s.name`, start, end);
  const jangnal = await all(db,
    `SELECT session, COUNT(*) AS total,
            SUM(CASE WHEN status IN ('confirmed', 'attended', 'no_show') THEN 1 ELSE 0 END) AS confirmed,
            SUM(CASE WHEN status = 'attended' THEN 1 ELSE 0 END) AS attended,
            SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS no_show,
            SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) AS canceled
       FROM applications WHERE type = 'jangnal' AND session BETWEEN ? AND ? GROUP BY session ORDER BY session DESC LIMIT 12`,
    start, addDays(end, 90));
  const notify = await first(db, "SELECT COUNT(*) AS n FROM applications WHERE type = 'jangnal' AND session = 'notify'");
  // 장날 손님 가운데 회원이 된 사람(휴대전화 번호로 맞춰 보고 숫자만 셉니다)
  const guestPhones = await all(db,
    `SELECT DISTINCT phone FROM applications WHERE type = 'jangnal' AND status = 'attended' AND created_at >= ? AND created_at < ?`, startIso(start), endIso(end));
  const memberPhones = new Set((await all(db, "SELECT phone FROM members WHERE status != 'left'")).map((r) => digits(r.phone)).filter(Boolean));
  const guests = guestPhones.map((r) => digits(r.phone)).filter(Boolean);
  const guestsJoined = guests.filter((p) => memberPhones.has(p)).length;

  return json({
    range: { days, start, end, prevStart: pStart, prevEnd: pEnd, monthly },
    site: {
      cur, prev, series, pages, journal, sources, refHosts, campaigns, devices, clicks, faq,
    },
    funnel: {
      apply: [
        { key: 'sessions', n: cur.sessions },
        { key: 'join', n: ps['/join'] || 0 },
        { key: 'form', n: fs.apply || 0 },
        { key: 'applied', n: applyCur.applications },
        { key: 'interviewed', n: applyCur.interviewed },
        { key: 'joined', n: applyCur.joined },
      ],
      jangnal: [
        { key: 'jangnal', n: ps['/jangnal'] || 0 },
        { key: 'form', n: fs.jangnal || 0 },
        { key: 'applied', n: num(jApps.n) },
        { key: 'confirmed', n: num(jApps.confirmed) },
        { key: 'attended', n: num(jApps.attended) },
      ],
      applyCur, applyPrev, appSources,
      leadDays: lead && lead.n ? num(lead.days) : null,
    },
    members: {
      active: cnt(null, 'active'), activeMember: cnt('member', 'active'), activeSarangbang: cnt('sarangbang', 'active'),
      paused: cnt(null, 'paused'), left: cnt(null, 'left'),
      cur: memCur, prev: memPrev, months,
      retention: { total: num(retention.total), kept: num(retention.kept) },
      fee: { total: num(fee.total), paid: num(fee.paid) },
      checks: { total: num(checks.total), verified: num(checks.verified), charter: num(checks.charter) },
      sources: memberSources, recent: recentMembers, unassigned: num(unassigned.n),
    },
    meetings: {
      cur: meetCur, prev: meetPrev,
      open: num(sd.open), capacity: num(sd.capacity), seated: num(sd.seated), newSangdans: num(sdNew.n),
      sangdans, jangnal, notify: num(notify.n), guests: guests.length, guestsJoined,
    },
  });
}
