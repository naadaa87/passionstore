// 열정상회 관리자 API (/api/admin/*)
import { ensureSchema, all, first, run, now, today, uid, log } from './db.js';
import { json, readJson, checkSameOrigin, HttpError, clip, isDate } from './http.js';
import {
  currentAdmin, requireRole, createSession, destroySession, verifyPassword, hashPassword,
  checkPasswordRule, checkLoginRate, recordLoginFail, clearLoginFails, createAdmin, tempPassword,
} from './auth.js';
import { githubReady, readFile, writeFile, writeBinary, readDirTexts, deleteFile } from './github.js';

/* ---------- 값 목록 ---------- */
export const APPLY_STATUS = ['new', 'contacted', 'interview', 'approved', 'joined', 'hold', 'declined'];
export const JANGNAL_STATUS = ['new', 'confirmed', 'attended', 'no_show', 'canceled', 'notify'];
const MEMBER_STATUS = ['active', 'paused', 'left'];
const TIERS = ['member', 'sarangbang'];
const FEES = ['unpaid', 'paid', 'exempt'];
const SLOTS = ['평일 오전', '평일 저녁', '주말', ''];
const ROLE_WORDS = ['운영진', '부회장', '상단장', '학당장', '길잡이', '장날 MC', '감사', '단골'];
const SITE_SECTIONS_OWNER = ['contact', 'operator', 'fees', 'team', 'verification', 'url'];
const SITE_SECTIONS_STAFF = ['jangnal'];

const bool = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);
const oneOf = (v, list, label) => {
  if (!list.includes(v)) throw new HttpError(400, 'invalid', `${label} 값이 올바르지 않습니다.`);
  return v;
};
const optDate = (v, label) => {
  if (v == null || v === '') return null;
  if (!isDate(v)) throw new HttpError(400, 'invalid', `${label}는 YYYY-MM-DD 형식으로 적어 주세요.`);
  return v;
};
const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const parseData = (s) => { try { return JSON.parse(s || '{}'); } catch (e) { return {}; } };
const cleanRoles = (v) => String(v || '').split(/[,·]/).map((x) => x.trim()).filter((x) => ROLE_WORDS.includes(x)).join(',');

/* ---------- 진입점 ---------- */
export async function handle(context) {
  try {
    return await dispatch(context);
  } catch (e) {
    if (e instanceof HttpError) return json({ ok: false, error: e.code, message: e.message }, e.status);
    console.error(e);
    return json({ ok: false, error: 'server_error', message: '처리 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.' }, 500);
  }
}

async function dispatch({ request, env, params }) {
  const segs = Array.isArray(params.path) ? params.path : String(params.path || '').split('/').filter(Boolean);
  const method = request.method.toUpperCase();
  if (!env.DB) {
    if (segs[0] === 'status') return json({ db: false, github: githubReady(env) });
    throw new HttpError(503, 'db_not_configured', 'D1 데이터베이스가 연결되지 않았습니다. 관리자 안내서의 D1 연결 순서를 따라 주세요.');
  }
  const db = env.DB;
  await ensureSchema(db);
  checkSameOrigin(request);

  // 로그인 없이 쓰는 경로
  if (segs[0] === 'status' && method === 'GET') return status(db, env, request);
  if (segs[0] === 'setup' && method === 'POST') return setup(db, env, request);
  if (segs[0] === 'login' && method === 'POST') return login(db, request);
  if (segs[0] === 'logout' && method === 'POST') {
    const cookie = await destroySession(db, request);
    return json({ ok: true }, 200, { 'set-cookie': cookie });
  }

  const admin = await currentAdmin(db, request);
  requireRole(admin, 'staff');
  const ctx = { db, env, request, admin, segs, method };

  if (admin.mustChange && !(segs[0] === 'me')) {
    throw new HttpError(403, 'must_change', '처음 받은 임시 비밀번호를 먼저 바꿔 주세요.');
  }

  const route = `${method} ${segs[0] || ''}`;
  switch (route) {
    case 'GET me': return json({ me: admin });
    case 'POST me': return changePassword(ctx);
    case 'GET dashboard': return dashboard(ctx);
    case 'GET counts': return json({ items: await all(db, "SELECT type, COUNT(*) AS n FROM applications WHERE status = 'new' GROUP BY type") });
    case 'GET applications': return segs[1] ? getApplication(ctx) : listApplications(ctx);
    case 'PATCH applications': return updateApplication(ctx);
    case 'POST applications': return convertApplication(ctx);
    case 'DELETE applications': return deleteApplication(ctx);
    case 'GET members': return segs[1] ? getMember(ctx) : listMembers(ctx);
    case 'POST members': return createMember(ctx);
    case 'PATCH members': return updateMember(ctx);
    case 'DELETE members': return deleteMember(ctx);
    case 'GET sangdans': return segs[1] ? getSangdan(ctx) : listSangdans(ctx);
    case 'POST sangdans': return saveSangdan(ctx, true);
    case 'PATCH sangdans': return saveSangdan(ctx, false);
    case 'DELETE sangdans': return deleteSangdan(ctx);
    case 'GET meetings': return getMeeting(ctx);
    case 'POST meetings': return saveMeeting(ctx, true);
    case 'PATCH meetings': return saveMeeting(ctx, false);
    case 'DELETE meetings': return deleteMeeting(ctx);
    case 'GET site': return getSite(ctx);
    case 'PUT site': return putSite(ctx);
    case 'GET journal': return segs[1] ? getPost(ctx) : listPosts(ctx);
    case 'PUT journal': return putPost(ctx);
    case 'DELETE journal': return deletePost(ctx);
    case 'POST uploads': return uploadImage(ctx);
    case 'GET accounts': return listAccounts(ctx);
    case 'POST accounts': return createAccount(ctx);
    case 'PATCH accounts': return updateAccount(ctx);
    case 'GET logs': return listLogs(ctx);
    case 'GET export': return exportCsv(ctx);
    case 'POST purge': return purge(ctx);
    default: throw new HttpError(404, 'not_found', '없는 기능입니다.');
  }
}

/* ---------- 상태·처음 설정·로그인 ---------- */
// 회장 권한 계정이 하나도 없을 때만 첫 계정 만들기를 열어 둡니다.
// (회장 비밀번호를 잃어버렸을 때 D1 콘솔에서 회장 계정을 지우면 다시 만들 수 있습니다.)
const OWNER_COUNT = "SELECT COUNT(*) AS n FROM admins WHERE role = 'owner' AND active = 1";

async function status(db, env, request) {
  const n = await first(db, OWNER_COUNT);
  const me = await currentAdmin(db, request);
  return json({ db: true, github: githubReady(env), setupNeeded: !n || n.n === 0, setupKeySet: !!env.ADMIN_SETUP_KEY, me });
}

async function setup(db, env, request) {
  const n = await first(db, OWNER_COUNT);
  if (n && n.n > 0) throw new HttpError(409, 'already_setup', '이미 첫 계정이 만들어져 있습니다. 로그인해 주세요.');
  if (!env.ADMIN_SETUP_KEY) throw new HttpError(503, 'no_setup_key', 'Cloudflare 변수에 ADMIN_SETUP_KEY를 먼저 넣어 주세요.');
  const b = await readJson(request);
  if (clip(b.key, 200) !== env.ADMIN_SETUP_KEY) throw new HttpError(403, 'wrong_key', '설정 키가 맞지 않습니다.');
  const email = clip(b.email, 120).toLowerCase();
  const name = clip(b.name, 40);
  if (!/^\S+@\S+\.\S+$/.test(email) || !name) throw new HttpError(400, 'invalid', '이름과 이메일을 확인해 주세요.');
  checkPasswordRule(b.password);
  if (await first(db, 'SELECT id FROM admins WHERE email = ?', email)) throw new HttpError(409, 'exists', '이미 다른 계정이 쓰는 이메일입니다.');
  const id = await createAdmin(db, { email, name, role: 'owner', duty: '회장', password: b.password, mustChange: false });
  const admin = { id, name };
  await log(db, admin, '첫 계정 만들기', email);
  const cookie = await createSession(db, id);
  return json({ ok: true }, 200, { 'set-cookie': cookie });
}

async function login(db, request) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  await checkLoginRate(db, ip);
  const b = await readJson(request);
  const email = clip(b.email, 120).toLowerCase();
  const row = await first(db, 'SELECT * FROM admins WHERE email = ?', email);
  const ok = row && row.active && await verifyPassword(String(b.password || ''), row.pw_hash, row.pw_salt);
  if (!ok) {
    await recordLoginFail(db, ip);
    throw new HttpError(401, 'wrong_login', '이메일 또는 비밀번호가 맞지 않습니다.');
  }
  await clearLoginFails(db, ip);
  await run(db, 'UPDATE admins SET last_login = ? WHERE id = ?', now(), row.id);
  await log(db, row, '로그인', '');
  const cookie = await createSession(db, row.id);
  return json({ ok: true }, 200, { 'set-cookie': cookie });
}

async function changePassword({ db, request, admin }) {
  const b = await readJson(request);
  const row = await first(db, 'SELECT * FROM admins WHERE id = ?', admin.id);
  if (!await verifyPassword(String(b.current || ''), row.pw_hash, row.pw_salt)) throw new HttpError(400, 'wrong_password', '지금 비밀번호가 맞지 않습니다.');
  checkPasswordRule(b.next);
  if (b.next === b.current) throw new HttpError(400, 'same_password', '지금과 다른 비밀번호로 정해 주세요.');
  const { hash, salt } = await hashPassword(b.next);
  await run(db, 'UPDATE admins SET pw_hash = ?, pw_salt = ?, must_change = 0 WHERE id = ?', hash, salt, admin.id);
  await run(db, 'DELETE FROM admin_sessions WHERE admin_id = ?', admin.id);
  await log(db, admin, '비밀번호 변경', '');
  const cookie = await createSession(db, admin.id);
  return json({ ok: true }, 200, { 'set-cookie': cookie });
}

/* ---------- 대시보드 ---------- */
async function dashboard({ db, admin }) {
  const t = today();
  const appCounts = await all(db, 'SELECT type, status, COUNT(*) AS n FROM applications GROUP BY type, status');
  const memberCounts = await all(db, 'SELECT tier, status, COUNT(*) AS n FROM members GROUP BY tier, status');
  const unassigned = await all(db,
    `SELECT id, name, times, joined_at FROM members
      WHERE status = 'active' AND tier = 'member' AND (sangdan_id IS NULL OR sangdan_id = '')
      ORDER BY joined_at`);
  const waitingBySlot = {};
  ['평일 오전', '평일 저녁', '주말'].forEach((s) => { waitingBySlot[s] = unassigned.filter((m) => String(m.times || '').includes(s)).length; });
  waitingBySlot['시간대 미정'] = unassigned.filter((m) => !m.times).length;

  const sangdans = await all(db,
    `SELECT s.id, s.name, s.slot, s.capacity, s.status, l.name AS leader_name,
            (SELECT COUNT(*) FROM members m WHERE m.sangdan_id = s.id AND m.status = 'active') AS member_count,
            (SELECT MAX(date) FROM meetings g WHERE g.sangdan_id = s.id) AS last_meeting
       FROM sangdans s LEFT JOIN members l ON l.id = s.leader_id
      WHERE s.status = 'open' ORDER BY s.slot, s.name`);

  const feeDue = await all(db,
    `SELECT id, name, fee_status, fee_paid_until FROM members
      WHERE status = 'active' AND fee_status != 'exempt'
        AND (fee_status = 'unpaid' OR fee_paid_until IS NULL OR fee_paid_until <= ?)
      ORDER BY fee_paid_until LIMIT 20`, addDays(t, 14));
  const pausedReturn = await all(db,
    `SELECT id, name, paused_until FROM members WHERE status = 'paused' AND paused_until IS NOT NULL AND paused_until <= ? ORDER BY paused_until`, addDays(t, 14));

  const since = addDays(t, -365);
  const sources = await all(db,
    `SELECT COALESCE(NULLIF(source, ''), '모름') AS source, COUNT(*) AS n FROM applications
      WHERE type = 'apply' AND created_at >= ? GROUP BY 1 ORDER BY n DESC`, since);

  const jangnal = await all(db,
    `SELECT session, status, COUNT(*) AS n FROM applications WHERE type = 'jangnal' AND (session >= ? OR session = 'notify') GROUP BY session, status`, t);

  const m90 = addDays(t, -90);
  const meetingStats = await first(db,
    `SELECT COUNT(*) AS total, SUM(chair_led) AS chair_led FROM meetings WHERE date >= ?`, m90);
  const att = await first(db,
    `SELECT SUM(a.present) AS present, COUNT(*) AS total FROM attendance a JOIN meetings g ON g.id = a.meeting_id WHERE g.date >= ?`, m90);

  const recentApps = await all(db,
    `SELECT id, type, status, name, session, created_at, data FROM applications WHERE status IN ('new','notify') ORDER BY created_at DESC LIMIT 8`);

  const logs = admin.role === 'owner' ? await all(db, 'SELECT admin_name, action, target, at FROM logs ORDER BY id DESC LIMIT 8') : [];

  return json({
    today: t,
    appCounts, memberCounts, unassigned, waitingBySlot, sangdans, feeDue, pausedReturn, sources, jangnal,
    meetings: { total: meetingStats ? meetingStats.total || 0 : 0, chairLed: meetingStats ? meetingStats.chair_led || 0 : 0 },
    attendance: { present: att ? att.present || 0 : 0, total: att ? att.total || 0 : 0 },
    recentApps: recentApps.map((a) => ({ ...a, work: parseData(a.data).work || '', data: undefined })),
    logs,
  });
}

/* ---------- 신청 ---------- */
async function listApplications({ db, request }) {
  const u = new URL(request.url);
  const type = u.searchParams.get('type') === 'jangnal' ? 'jangnal' : 'apply';
  const st = u.searchParams.get('status') || '';
  const q = clip(u.searchParams.get('q'), 50);
  const session = clip(u.searchParams.get('session'), 30);
  const where = ['type = ?'];
  const args = [type];
  const sts = st.split(',').filter(Boolean).slice(0, 8);
  if (sts.length) { where.push(`status IN (${sts.map(() => '?').join(',')})`); args.push(...sts); }
  if (session) { where.push('session = ?'); args.push(session); }
  if (q) { where.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR data LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = await all(db, `SELECT * FROM applications WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 500`, ...args);
  const counts = await all(db, 'SELECT status, COUNT(*) AS n FROM applications WHERE type = ? GROUP BY status', type);
  const sessions = type === 'jangnal' ? await all(db, "SELECT session, COUNT(*) AS n FROM applications WHERE type = 'jangnal' GROUP BY session ORDER BY session DESC LIMIT 60") : [];
  return json({
    counts, sessions,
    items: rows.map((r) => {
      const d = parseData(r.data);
      return {
        id: r.id, type: r.type, status: r.status, name: r.name, phone: r.phone, email: r.email,
        session: r.session, sessionLabel: d.sessionLabel || '', source: r.source, memo: r.memo, member_id: r.member_id,
        created_at: r.created_at, updated_at: r.updated_at,
        work: d.work || '', times: d.times || '', bizType: d.bizType || '', region: d.region || '', roles: d.roles || '', question: d.question || '',
      };
    }),
  });
}

async function getApplication({ db, segs }) {
  const r = await first(db, 'SELECT * FROM applications WHERE id = ?', segs[1]);
  if (!r) throw new HttpError(404, 'not_found', '신청서를 찾을 수 없습니다.');
  return json({ item: { ...r, data: parseData(r.data) } });
}

async function updateApplication({ db, request, segs, admin }) {
  const r = await first(db, 'SELECT * FROM applications WHERE id = ?', segs[1]);
  if (!r) throw new HttpError(404, 'not_found', '신청서를 찾을 수 없습니다.');
  const b = await readJson(request);
  const statusVal = b.status != null ? oneOf(b.status, r.type === 'jangnal' ? JANGNAL_STATUS : APPLY_STATUS, '상태') : r.status;
  const memo = b.memo != null ? clip(b.memo, 3000) : r.memo;
  await run(db, 'UPDATE applications SET status = ?, memo = ?, updated_at = ? WHERE id = ?', statusVal, memo, now(), r.id);
  if (statusVal !== r.status) await log(db, admin, `${r.type === 'jangnal' ? '장날' : '가입'} 신청 상태 변경`, r.name, `${r.status} → ${statusVal}`);
  else if (memo !== r.memo) await log(db, admin, '신청 메모 수정', r.name);
  return json({ ok: true });
}

async function deleteApplication({ db, segs, admin }) {
  requireRole(admin, 'owner');
  const r = await first(db, 'SELECT id, name, type FROM applications WHERE id = ?', segs[1]);
  if (!r) throw new HttpError(404, 'not_found', '신청서를 찾을 수 없습니다.');
  await run(db, 'DELETE FROM applications WHERE id = ?', r.id);
  await log(db, admin, '신청서 삭제', r.name, r.type);
  return json({ ok: true });
}

async function checkCapacity(db, sangdanId, exceptMemberId) {
  if (!sangdanId) return null;
  const s = await first(db, 'SELECT * FROM sangdans WHERE id = ?', sangdanId);
  if (!s) throw new HttpError(400, 'invalid', '상단을 찾을 수 없습니다.');
  const c = await first(db, "SELECT COUNT(*) AS n FROM members WHERE sangdan_id = ? AND status = 'active' AND id != ?", sangdanId, exceptMemberId || '');
  if (c.n >= s.capacity) throw new HttpError(409, 'full', `${s.name} 상단은 정원(${s.capacity}명)이 찼습니다.`);
  return s;
}

async function convertApplication({ db, request, segs, admin }) {
  if (segs[2] !== 'convert') throw new HttpError(404, 'not_found', '없는 기능입니다.');
  const r = await first(db, 'SELECT * FROM applications WHERE id = ?', segs[1]);
  if (!r) throw new HttpError(404, 'not_found', '신청서를 찾을 수 없습니다.');
  if (r.type !== 'apply') throw new HttpError(400, 'invalid', '가입 신청서만 상회원으로 등록할 수 있습니다.');
  if (r.member_id) throw new HttpError(409, 'already', '이미 상회원으로 등록된 신청서입니다.');
  const b = await readJson(request);
  const d = parseData(r.data);
  const tier = oneOf(b.tier || 'member', TIERS, '회원 구분');
  const sangdanId = tier === 'member' ? (b.sangdan_id || null) : null;
  await checkCapacity(db, sangdanId);
  const id = uid('mem_');
  const t = now();
  await run(db,
    `INSERT INTO members (id, name, phone, email, work, biz_type, region, years, size, times, tier, status, sangdan_id, roles,
       joined_at, fee_status, fee_paid_until, verified, charter_signed, founding, source, application_id, memo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, '', ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
    id, r.name, r.phone, r.email, clip(d.work, 500), clip(d.bizType, 40), clip(d.region, 60), clip(d.years, 20), clip(d.size, 30), clip(d.times, 60),
    tier, sangdanId, optDate(b.joined_at, '가입일') || today(), oneOf(b.fee_status || 'unpaid', FEES, '회비 상태'), optDate(b.fee_paid_until, '회비 납부 기한'),
    bool(b.verified), bool(b.charter_signed), bool(b.founding), r.source || '', r.id, t, t);
  await run(db, "UPDATE applications SET status = 'joined', member_id = ?, updated_at = ? WHERE id = ?", id, t, r.id);
  await log(db, admin, '상회원 등록', r.name, sangdanId ? `상단 배정` : '상단 미배정');
  return json({ ok: true, id });
}

/* ---------- 회원 ---------- */
const MEMBER_FIELDS = 'm.id, m.name, m.phone, m.email, m.work, m.biz_type, m.region, m.years, m.size, m.times, m.tier, m.status, m.sangdan_id, m.roles, m.joined_at, m.paused_until, m.fee_status, m.fee_paid_until, m.verified, m.charter_signed, m.founding, m.source, m.application_id, m.memo, m.created_at, m.updated_at';

async function listMembers({ db, request }) {
  const u = new URL(request.url);
  const st = u.searchParams.get('status') || '';
  const sd = u.searchParams.get('sangdan') || '';
  const tier = u.searchParams.get('tier') || '';
  const fee = u.searchParams.get('fee') || '';
  const q = clip(u.searchParams.get('q'), 50);
  const where = ['1 = 1'];
  const args = [];
  if (fee === 'due') {
    where.push("m.status = 'active' AND m.fee_status != 'exempt' AND (m.fee_status = 'unpaid' OR m.fee_paid_until IS NULL OR m.fee_paid_until <= ?)");
    args.push(addDays(today(), 14));
  }
  if (st) { where.push('m.status = ?'); args.push(st); }
  if (tier) { where.push('m.tier = ?'); args.push(tier); }
  if (sd === 'none') where.push("(m.sangdan_id IS NULL OR m.sangdan_id = '')");
  else if (sd) { where.push('m.sangdan_id = ?'); args.push(sd); }
  if (q) { where.push('(m.name LIKE ? OR m.phone LIKE ? OR m.work LIKE ? OR m.memo LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = await all(db,
    `SELECT ${MEMBER_FIELDS}, s.name AS sangdan_name FROM members m LEFT JOIN sangdans s ON s.id = m.sangdan_id
      WHERE ${where.join(' AND ')} ORDER BY m.status, m.joined_at DESC LIMIT 1000`, ...args);
  return json({ items: rows });
}

async function getMember({ db, segs }) {
  const m = await first(db, `SELECT ${MEMBER_FIELDS}, s.name AS sangdan_name FROM members m LEFT JOIN sangdans s ON s.id = m.sangdan_id WHERE m.id = ?`, segs[1]);
  if (!m) throw new HttpError(404, 'not_found', '회원을 찾을 수 없습니다.');
  const att = await first(db,
    'SELECT SUM(present) AS present, COUNT(*) AS total FROM attendance WHERE member_id = ?', m.id);
  const recent = await all(db,
    `SELECT g.date, g.mode, a.present, s.name AS sangdan_name FROM attendance a JOIN meetings g ON g.id = a.meeting_id
       LEFT JOIN sangdans s ON s.id = g.sangdan_id WHERE a.member_id = ? ORDER BY g.date DESC LIMIT 12`, m.id);
  return json({ item: m, attendance: { present: att ? att.present || 0 : 0, total: att ? att.total || 0 : 0, recent } });
}

function memberValues(b, cur) {
  const v = (k, fn) => (b[k] !== undefined ? fn(b[k]) : cur[k]);
  return {
    name: v('name', (x) => clip(x, 40)),
    phone: v('phone', (x) => clip(x, 30)),
    email: v('email', (x) => clip(x, 120)),
    work: v('work', (x) => clip(x, 500)),
    biz_type: v('biz_type', (x) => clip(x, 40)),
    region: v('region', (x) => clip(x, 60)),
    years: v('years', (x) => clip(x, 20)),
    size: v('size', (x) => clip(x, 30)),
    times: v('times', (x) => clip(x, 60)),
    tier: v('tier', (x) => oneOf(x, TIERS, '회원 구분')),
    status: v('status', (x) => oneOf(x, MEMBER_STATUS, '상태')),
    sangdan_id: v('sangdan_id', (x) => (x ? clip(x, 40) : null)),
    roles: v('roles', cleanRoles),
    joined_at: v('joined_at', (x) => optDate(x, '가입일')),
    paused_until: v('paused_until', (x) => optDate(x, '휴회 종료일')),
    fee_status: v('fee_status', (x) => oneOf(x, FEES, '회비 상태')),
    fee_paid_until: v('fee_paid_until', (x) => optDate(x, '회비 납부 기한')),
    verified: v('verified', bool),
    charter_signed: v('charter_signed', bool),
    founding: v('founding', bool),
    memo: v('memo', (x) => clip(x, 3000)),
  };
}

async function createMember({ db, request, admin }) {
  const b = await readJson(request);
  const empty = { tier: 'member', status: 'active', fee_status: 'unpaid', roles: '', memo: '', verified: 0, charter_signed: 0, founding: 0 };
  const m = memberValues(b, empty);
  if (!m.name) throw new HttpError(400, 'invalid', '이름을 적어 주세요.');
  if (m.tier !== 'member') m.sangdan_id = null;
  await checkCapacity(db, m.sangdan_id);
  const id = uid('mem_');
  const t = now();
  await run(db,
    `INSERT INTO members (id, name, phone, email, work, biz_type, region, years, size, times, tier, status, sangdan_id, roles,
       joined_at, paused_until, fee_status, fee_paid_until, verified, charter_signed, founding, source, application_id, memo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '직접 등록', NULL, ?, ?, ?)`,
    id, m.name, m.phone || '', m.email || '', m.work || '', m.biz_type || '', m.region || '', m.years || '', m.size || '', m.times || '',
    m.tier, m.status, m.sangdan_id, m.roles, m.joined_at || today(), m.paused_until, m.fee_status, m.fee_paid_until,
    m.verified, m.charter_signed, m.founding, m.memo, t, t);
  await log(db, admin, '회원 직접 등록', m.name);
  return json({ ok: true, id });
}

async function updateMember({ db, request, segs, admin }) {
  const cur = await first(db, 'SELECT * FROM members WHERE id = ?', segs[1]);
  if (!cur) throw new HttpError(404, 'not_found', '회원을 찾을 수 없습니다.');
  const b = await readJson(request);
  const m = memberValues(b, cur);
  if (!m.name) throw new HttpError(400, 'invalid', '이름을 적어 주세요.');
  if (m.tier !== 'member') m.sangdan_id = null;
  if (m.sangdan_id && m.sangdan_id !== cur.sangdan_id && m.status === 'active') await checkCapacity(db, m.sangdan_id, cur.id);
  if (m.status === 'paused' && m.paused_until) {
    const limit = addDays(today(), 92);
    if (m.paused_until > limit) throw new HttpError(400, 'invalid', '휴회는 최대 3개월까지입니다.');
  }
  await run(db,
    `UPDATE members SET name = ?, phone = ?, email = ?, work = ?, biz_type = ?, region = ?, years = ?, size = ?, times = ?, tier = ?, status = ?,
       sangdan_id = ?, roles = ?, joined_at = ?, paused_until = ?, fee_status = ?, fee_paid_until = ?, verified = ?, charter_signed = ?, founding = ?,
       memo = ?, updated_at = ? WHERE id = ?`,
    m.name, m.phone, m.email, m.work, m.biz_type, m.region, m.years, m.size, m.times, m.tier, m.status,
    m.sangdan_id, m.roles, m.joined_at, m.paused_until, m.fee_status, m.fee_paid_until, m.verified, m.charter_signed, m.founding,
    m.memo, now(), cur.id);
  const changes = [];
  if (cur.status !== m.status) changes.push(`상태 ${cur.status} → ${m.status}`);
  if ((cur.sangdan_id || '') !== (m.sangdan_id || '')) changes.push('상단 변경');
  if (cur.fee_status !== m.fee_status || cur.fee_paid_until !== m.fee_paid_until) changes.push('회비 정보 변경');
  if (cur.roles !== m.roles) changes.push(`역할 ${m.roles || '없음'}`);
  await log(db, admin, '회원 정보 수정', m.name, changes.join(', '));
  if (m.status !== 'active' || (cur.sangdan_id || '') !== (m.sangdan_id || '')) {
    await run(db, 'UPDATE sangdans SET leader_id = NULL WHERE leader_id = ? AND id != ?', cur.id, m.status === 'active' ? (m.sangdan_id || '') : '');
  }
  return json({ ok: true });
}

async function deleteMember({ db, segs, admin }) {
  requireRole(admin, 'owner');
  const m = await first(db, 'SELECT id, name, application_id FROM members WHERE id = ?', segs[1]);
  if (!m) throw new HttpError(404, 'not_found', '회원을 찾을 수 없습니다.');
  await db.batch([
    db.prepare('DELETE FROM attendance WHERE member_id = ?').bind(m.id),
    db.prepare('UPDATE sangdans SET leader_id = NULL WHERE leader_id = ?').bind(m.id),
    db.prepare('DELETE FROM applications WHERE id = ? OR member_id = ?').bind(m.application_id || '', m.id),
    db.prepare('DELETE FROM members WHERE id = ?').bind(m.id),
  ]);
  await log(db, admin, '회원 정보 완전 삭제', m.name, '회원·신청서·출석 기록 삭제');
  return json({ ok: true });
}

/* ---------- 상단 ---------- */
async function listSangdans({ db }) {
  const rows = await all(db,
    `SELECT s.*, l.name AS leader_name,
            (SELECT COUNT(*) FROM members m WHERE m.sangdan_id = s.id AND m.status = 'active') AS member_count,
            (SELECT COUNT(*) FROM members m WHERE m.sangdan_id = s.id AND m.status = 'paused') AS paused_count,
            (SELECT MAX(date) FROM meetings g WHERE g.sangdan_id = s.id) AS last_meeting
       FROM sangdans s LEFT JOIN members l ON l.id = s.leader_id ORDER BY s.status DESC, s.slot, s.name`);
  return json({ items: rows });
}

async function getSangdan({ db, segs }) {
  const s = await first(db, 'SELECT s.*, l.name AS leader_name FROM sangdans s LEFT JOIN members l ON l.id = s.leader_id WHERE s.id = ?', segs[1]);
  if (!s) throw new HttpError(404, 'not_found', '상단을 찾을 수 없습니다.');
  const members = await all(db,
    `SELECT m.id, m.name, m.work, m.status, m.roles, m.joined_at,
            (SELECT SUM(a.present) FROM attendance a JOIN meetings g ON g.id = a.meeting_id WHERE a.member_id = m.id AND g.sangdan_id = ?) AS present,
            (SELECT COUNT(*) FROM attendance a JOIN meetings g ON g.id = a.meeting_id WHERE a.member_id = m.id AND g.sangdan_id = ?) AS total
       FROM members m WHERE m.sangdan_id = ? AND m.status != 'left' ORDER BY m.status, m.joined_at`, s.id, s.id, s.id);
  const meetings = await all(db,
    `SELECT g.*, (SELECT SUM(present) FROM attendance a WHERE a.meeting_id = g.id) AS present,
            (SELECT COUNT(*) FROM attendance a WHERE a.meeting_id = g.id) AS total
       FROM meetings g WHERE g.sangdan_id = ? ORDER BY g.date DESC LIMIT 30`, s.id);
  return json({ item: s, members, meetings });
}

async function saveSangdan({ db, request, segs, admin }, isNew) {
  const b = await readJson(request);
  const cur = isNew ? { name: '', slot: '', schedule: '', capacity: 8, status: 'open', memo: '', leader_id: null }
    : await first(db, 'SELECT * FROM sangdans WHERE id = ?', segs[1]);
  if (!cur) throw new HttpError(404, 'not_found', '상단을 찾을 수 없습니다.');
  const v = {
    name: b.name !== undefined ? clip(b.name, 30) : cur.name,
    slot: b.slot !== undefined ? oneOf(clip(b.slot, 10), SLOTS, '시간대') : cur.slot,
    schedule: b.schedule !== undefined ? clip(b.schedule, 60) : cur.schedule,
    capacity: b.capacity !== undefined ? Math.max(3, Math.min(12, parseInt(b.capacity, 10) || 8)) : cur.capacity,
    status: b.status !== undefined ? oneOf(b.status, ['open', 'closed'], '상태') : cur.status,
    memo: b.memo !== undefined ? clip(b.memo, 2000) : cur.memo,
    leader_id: b.leader_id !== undefined ? (b.leader_id || null) : cur.leader_id,
  };
  if (!v.name) throw new HttpError(400, 'invalid', '상단 이름을 적어 주세요.');
  if (v.leader_id) {
    const l = await first(db, "SELECT id, sangdan_id FROM members WHERE id = ? AND status = 'active'", v.leader_id);
    if (!l || (!isNew && l.sangdan_id !== cur.id)) throw new HttpError(400, 'invalid', '상단장은 이 상단에 속한 활동 중인 회원이어야 합니다.');
  }
  const t = now();
  if (isNew) {
    const id = uid('sd_');
    await run(db, 'INSERT INTO sangdans (id, name, slot, schedule, leader_id, capacity, status, memo, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)',
      id, v.name, v.slot, v.schedule, v.capacity, v.status, v.memo, t, t);
    await log(db, admin, '상단 만들기', v.name);
    return json({ ok: true, id });
  }
  await run(db, 'UPDATE sangdans SET name = ?, slot = ?, schedule = ?, leader_id = ?, capacity = ?, status = ?, memo = ?, updated_at = ? WHERE id = ?',
    v.name, v.slot, v.schedule, v.leader_id, v.capacity, v.status, v.memo, t, cur.id);
  if (v.leader_id && v.leader_id !== cur.leader_id) {
    await run(db, "UPDATE members SET roles = TRIM(roles || CASE WHEN roles = '' THEN '' ELSE ',' END || '상단장', ',') WHERE id = ? AND INSTR(roles, '상단장') = 0", v.leader_id);
  }
  await log(db, admin, '상단 수정', v.name);
  return json({ ok: true });
}

async function deleteSangdan({ db, segs, admin }) {
  const s = await first(db, 'SELECT id, name FROM sangdans WHERE id = ?', segs[1]);
  if (!s) throw new HttpError(404, 'not_found', '상단을 찾을 수 없습니다.');
  const c = await first(db, "SELECT COUNT(*) AS n FROM members WHERE sangdan_id = ? AND status != 'left'", s.id);
  if (c.n > 0) throw new HttpError(409, 'not_empty', '회원이 있는 상단은 지울 수 없습니다. 회원을 먼저 옮기거나, 상단을 "닫음"으로 바꿔 주세요.');
  const meetings = await all(db, 'SELECT id FROM meetings WHERE sangdan_id = ?', s.id);
  await db.batch([
    ...meetings.map((g) => db.prepare('DELETE FROM attendance WHERE meeting_id = ?').bind(g.id)),
    db.prepare('DELETE FROM meetings WHERE sangdan_id = ?').bind(s.id),
    db.prepare("UPDATE members SET sangdan_id = NULL WHERE sangdan_id = ?").bind(s.id),
    db.prepare('DELETE FROM sangdans WHERE id = ?').bind(s.id),
  ]);
  await log(db, admin, '상단 삭제', s.name);
  return json({ ok: true });
}

/* ---------- 상단 모임 기록 ---------- */
async function getMeeting({ db, segs }) {
  const g = await first(db, 'SELECT * FROM meetings WHERE id = ?', segs[1]);
  if (!g) throw new HttpError(404, 'not_found', '모임 기록을 찾을 수 없습니다.');
  const att = await all(db, 'SELECT member_id, present FROM attendance WHERE meeting_id = ?', g.id);
  return json({ item: g, attendance: att });
}

async function saveMeeting({ db, request, segs, admin }, isNew) {
  const b = await readJson(request);
  let g;
  if (!isNew) {
    g = await first(db, 'SELECT * FROM meetings WHERE id = ?', segs[1]);
    if (!g) throw new HttpError(404, 'not_found', '모임 기록을 찾을 수 없습니다.');
  }
  const sangdanId = isNew ? clip(b.sangdan_id, 40) : g.sangdan_id;
  const s = await first(db, 'SELECT id, name FROM sangdans WHERE id = ?', sangdanId);
  if (!s) throw new HttpError(400, 'invalid', '상단을 찾을 수 없습니다.');
  const date = optDate(b.date, '모임 날짜');
  if (!date) throw new HttpError(400, 'invalid', '모임 날짜를 적어 주세요.');
  const mode = oneOf(b.mode || 'offline', ['offline', 'online'], '진행 방식');
  const id = isNew ? uid('mt_') : g.id;
  const stmts = [];
  if (isNew) {
    stmts.push(db.prepare('INSERT INTO meetings (id, sangdan_id, date, mode, facilitator, chair_led, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, sangdanId, date, mode, clip(b.facilitator, 40), bool(b.chair_led), clip(b.note, 2000), now()));
  } else {
    stmts.push(db.prepare('UPDATE meetings SET date = ?, mode = ?, facilitator = ?, chair_led = ?, note = ? WHERE id = ?')
      .bind(date, mode, clip(b.facilitator, 40), bool(b.chair_led), clip(b.note, 2000), id));
    stmts.push(db.prepare('DELETE FROM attendance WHERE meeting_id = ?').bind(id));
  }
  const att = b.attendance && typeof b.attendance === 'object' ? b.attendance : {};
  const memberIds = Object.keys(att).slice(0, 20);
  if (memberIds.length) {
    const valid = await all(db, `SELECT id FROM members WHERE id IN (${memberIds.map(() => '?').join(',')})`, ...memberIds);
    valid.forEach((m) => stmts.push(db.prepare('INSERT INTO attendance (meeting_id, member_id, present) VALUES (?, ?, ?)').bind(id, m.id, bool(att[m.id]))));
  }
  await db.batch(stmts);
  await log(db, admin, isNew ? '상단 모임 기록' : '상단 모임 기록 수정', s.name, date);
  return json({ ok: true, id });
}

async function deleteMeeting({ db, segs, admin }) {
  const g = await first(db, 'SELECT id, date FROM meetings WHERE id = ?', segs[1]);
  if (!g) throw new HttpError(404, 'not_found', '모임 기록을 찾을 수 없습니다.');
  await db.batch([db.prepare('DELETE FROM attendance WHERE meeting_id = ?').bind(g.id), db.prepare('DELETE FROM meetings WHERE id = ?').bind(g.id)]);
  await log(db, admin, '상단 모임 기록 삭제', g.date);
  return json({ ok: true });
}

/* ---------- 사이트 설정(site.json) ---------- */
async function getSite({ env }) {
  const f = await readFile(env, 'site.json');
  if (!f) throw new HttpError(404, 'not_found', '저장소에서 site.json을 찾을 수 없습니다.');
  let data;
  try { data = JSON.parse(f.text); } catch (e) { throw new HttpError(500, 'bad_json', 'site.json 형식이 깨져 있습니다. GitHub에서 직접 확인해 주세요.'); }
  return json({ data, sha: f.sha });
}

const SITE_LABEL = { contact: '연락처', operator: '운영 정보', fees: '회비', team: '운영진 소개', verification: '검색엔진 소유확인', url: '사이트 주소', jangnal: '장날 일정' };

function validateSection(section, v) {
  const str = (x, n = 300) => clip(x, n);
  switch (section) {
    case 'contact': return { email: str(v.email, 120), kakaoChannel: str(v.kakaoChannel, 200), instagram: str(v.instagram, 200), naverBlog: str(v.naverBlog, 200) };
    case 'operator': return { name: str(v.name, 60) || '열정상회', representative: str(v.representative, 40), registrationNo: str(v.registrationNo, 40), address: str(v.address, 200), privacyOfficer: str(v.privacyOfficer, 40), privacyEmail: str(v.privacyEmail, 120) };
    case 'fees': return { guest: str(v.guest, 80), sarangbang: str(v.sarangbang, 80), member: str(v.member, 120), note: str(v.note, 300) };
    case 'verification': return { naver: str(v.naver, 120), google: str(v.google, 120), bing: str(v.bing, 120), daumRobotsLine: str(v.daumRobotsLine, 200) };
    case 'url': {
      const u = str(v, 200).replace(/\/+$/, '');
      if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(u)) throw new HttpError(400, 'invalid', '사이트 주소는 https://로 시작하는 도메인만 적어 주세요. 예: https://passionstore.pages.dev');
      return u;
    }
    case 'team': {
      if (!Array.isArray(v)) throw new HttpError(400, 'invalid', '운영진 목록 형식이 올바르지 않습니다.');
      return v.slice(0, 20).map((m) => ({ role: str(m.role, 30), name: str(m.name, 30) })).filter((m) => m.role || m.name);
    }
    case 'jangnal': {
      if (!Array.isArray(v)) throw new HttpError(400, 'invalid', '장날 일정 형식이 올바르지 않습니다.');
      return v.slice(0, 40).map((s) => {
        if (!isDate(s.date)) throw new HttpError(400, 'invalid', '장날 날짜는 YYYY-MM-DD 형식으로 적어 주세요.');
        if (s.time && !/^\d{1,2}:\d{2}$/.test(s.time)) throw new HttpError(400, 'invalid', '장날 시간은 19:30처럼 적어 주세요.');
        return { date: s.date, time: str(s.time, 5) || '19:30', place: str(s.place, 100), topic: str(s.topic, 60), status: oneOf(s.status || 'soon', ['open', 'full', 'soon'], '장날 상태') };
      }).sort((a, b) => a.date.localeCompare(b.date));
    }
    default: throw new HttpError(400, 'invalid', '알 수 없는 설정입니다.');
  }
}

async function putSite({ env, request, admin, db }) {
  const b = await readJson(request);
  const section = String(b.section || '');
  if (SITE_SECTIONS_OWNER.includes(section)) requireRole(admin, 'owner');
  else if (!SITE_SECTIONS_STAFF.includes(section)) throw new HttpError(400, 'invalid', '알 수 없는 설정입니다.');
  const value = validateSection(section, b.value);
  const f = await readFile(env, 'site.json');
  if (!f) throw new HttpError(404, 'not_found', '저장소에서 site.json을 찾을 수 없습니다.');
  if (b.sha && b.sha !== f.sha) throw new HttpError(409, 'conflict', '그사이 다른 곳에서 설정이 바뀌었습니다. 화면을 새로 고친 뒤 다시 저장해 주세요.');
  const data = JSON.parse(f.text);
  if (section === 'verification' || section === 'contact' || section === 'operator' || section === 'fees') {
    data[section] = { ...(data[section] && data[section]._설명 ? { _설명: data[section]._설명 } : {}), ...value };
  } else {
    data[section] = value;
  }
  data.updated = today();
  const r = await writeFile(env, 'site.json', JSON.stringify(data, null, 2) + '\n', f.sha, `관리자에서 ${SITE_LABEL[section]} 수정`, admin);
  await log(db, admin, `사이트 설정 저장: ${SITE_LABEL[section]}`, 'site.json');
  return json({ ok: true, sha: r.sha });
}

/* ---------- 상회보 글 ---------- */
function parseFront(src) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src.replace(/\r/g, ''));
  if (!m) return { meta: {}, body: src };
  const meta = {};
  m[1].split('\n').forEach((line) => {
    const i = line.indexOf(':');
    if (i < 0) return;
    let v = line.slice(i + 1).trim();
    if (/^".*"$/.test(v)) v = v.slice(1, -1);
    meta[line.slice(0, i).trim()] = v;
  });
  return { meta, body: src.replace(/\r/g, '').slice(m[0].length) };
}

function serializePost(meta, body) {
  const one = (v) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim();
  const lines = ['---', `title: ${one(meta.title)}`, `description: ${one(meta.description)}`, `date: ${meta.date}`];
  if (meta.updated) lines.push(`updated: ${meta.updated}`);
  if (meta.order) lines.push(`order: ${parseInt(meta.order, 10) || 0}`);
  lines.push(`category: ${one(meta.category) || '상회보'}`);
  if (meta.keywords) lines.push(`keywords: ${one(meta.keywords)}`);
  if (meta.draft) lines.push('draft: true');
  lines.push('---');
  return lines.join('\n') + '\n' + String(body || '').replace(/\r/g, '').trim() + '\n';
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,60}$/;

async function listPosts({ env }) {
  const files = (await readDirTexts(env, 'content/journal')).filter((f) => f.name.endsWith('.md') && !f.name.startsWith('_'));
  const items = files.map((f) => {
    const { meta, body } = parseFront(f.text);
    return {
      slug: f.name.replace(/\.md$/, ''), title: meta.title || f.name, date: meta.date || '', updated: meta.updated || '',
      category: meta.category || '', description: meta.description || '', keywords: meta.keywords || '',
      draft: meta.draft === 'true', order: Number(meta.order || 0), length: body.replace(/\s+/g, '').length,
    };
  });
  items.sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order);
  return json({ items });
}

async function getPost({ env, segs }) {
  const slug = segs[1];
  if (!SLUG_RE.test(slug)) throw new HttpError(400, 'invalid', '글 주소가 올바르지 않습니다.');
  const f = await readFile(env, `content/journal/${slug}.md`);
  if (!f) throw new HttpError(404, 'not_found', '글을 찾을 수 없습니다.');
  const { meta, body } = parseFront(f.text);
  return json({ slug, meta, body, sha: f.sha });
}

async function putPost({ env, request, segs, admin, db }) {
  const slug = segs[1];
  if (!SLUG_RE.test(slug || '')) throw new HttpError(400, 'invalid', '글 주소는 영문 소문자, 숫자, 하이픈(-)으로 2~60자로 적어 주세요.');
  const b = await readJson(request, 1_000_000);
  const meta = b.meta || {};
  if (!clip(meta.title, 120)) throw new HttpError(400, 'invalid', '제목을 적어 주세요.');
  if (!isDate(meta.date)) throw new HttpError(400, 'invalid', '날짜는 YYYY-MM-DD 형식으로 적어 주세요.');
  if (meta.updated && !isDate(meta.updated)) throw new HttpError(400, 'invalid', '수정일은 YYYY-MM-DD 형식으로 적어 주세요.');
  const body = String(b.body || '');
  if (body.trim().length < 20) throw new HttpError(400, 'invalid', '본문이 너무 짧습니다.');
  const path = `content/journal/${slug}.md`;
  const existing = await readFile(env, path);
  if (b.isNew && existing) throw new HttpError(409, 'exists', '같은 주소의 글이 이미 있습니다. 다른 주소를 정해 주세요.');
  if (!b.isNew && existing && b.sha && b.sha !== existing.sha) throw new HttpError(409, 'conflict', '그사이 다른 곳에서 이 글이 바뀌었습니다. 새로 고친 뒤 다시 저장해 주세요.');
  const text = serializePost({
    title: clip(meta.title, 120), description: clip(meta.description, 300), date: meta.date, updated: meta.updated || '',
    order: meta.order || '', category: clip(meta.category, 30), keywords: clip(meta.keywords, 300), draft: !!meta.draft,
  }, body);
  const r = await writeFile(env, path, text, existing ? existing.sha : undefined,
    `${existing ? '상회보 글 수정' : '상회보 글 추가'}: ${clip(meta.title, 60)}`, admin);
  await log(db, admin, existing ? '상회보 글 수정' : '상회보 글 추가', meta.title, meta.draft ? '임시 저장' : '공개');
  return json({ ok: true, sha: r.sha });
}

async function deletePost({ env, request, segs, admin, db }) {
  requireRole(admin, 'owner');
  const slug = segs[1];
  if (!SLUG_RE.test(slug || '')) throw new HttpError(400, 'invalid', '글 주소가 올바르지 않습니다.');
  const f = await readFile(env, `content/journal/${slug}.md`);
  if (!f) throw new HttpError(404, 'not_found', '글을 찾을 수 없습니다.');
  const { meta } = parseFront(f.text);
  await deleteFile(env, `content/journal/${slug}.md`, f.sha, `상회보 글 삭제: ${meta.title || slug}`, admin);
  await log(db, admin, '상회보 글 삭제', meta.title || slug);
  return json({ ok: true });
}

async function uploadImage({ env, request, admin, db }) {
  const b = await readJson(request, 3_000_000);
  const data = String(b.data || '').replace(/^data:[^,]+,/, '');
  let bytes;
  try { bytes = Uint8Array.from(atob(data.slice(0, 32)), (c) => c.charCodeAt(0)); } catch (e) { throw new HttpError(400, 'invalid', '이미지 파일을 읽지 못했습니다.'); }
  let ext = '';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) ext = 'jpg';
  else if (bytes[0] === 0x89 && bytes[1] === 0x50) ext = 'png';
  else if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) ext = 'webp';
  if (!ext) throw new HttpError(400, 'invalid', 'JPG, PNG, WEBP 이미지만 올릴 수 있습니다.');
  const size = Math.floor(data.length * 3 / 4);
  if (size > 1_600_000) throw new HttpError(413, 'too_large', '이미지가 너무 큽니다. 1.5MB 이하로 줄여 주세요.');
  const slug = SLUG_RE.test(b.slug || '') ? b.slug : 'journal';
  const stamp = new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const path = `public/assets/img/journal/${slug}-${stamp}.${ext}`;
  await writeBinary(env, path, data, `상회보 이미지 올리기: ${slug}`, admin);
  await log(db, admin, '상회보 이미지 올리기', path);
  return json({ ok: true, url: path.replace(/^public/, '') });
}

/* ---------- 관리자 계정 ---------- */
async function listAccounts({ db, admin }) {
  requireRole(admin, 'owner');
  const rows = await all(db, 'SELECT id, email, name, role, duty, active, must_change, created_at, last_login FROM admins ORDER BY role DESC, created_at');
  return json({ items: rows });
}

async function createAccount({ db, request, admin }) {
  requireRole(admin, 'owner');
  const b = await readJson(request);
  const email = clip(b.email, 120).toLowerCase();
  const name = clip(b.name, 40);
  if (!/^\S+@\S+\.\S+$/.test(email) || !name) throw new HttpError(400, 'invalid', '이름과 이메일을 확인해 주세요.');
  const role = oneOf(b.role || 'staff', ['owner', 'staff'], '권한');
  if (await first(db, 'SELECT id FROM admins WHERE email = ?', email)) throw new HttpError(409, 'exists', '이미 등록된 이메일입니다.');
  const pw = tempPassword();
  await createAdmin(db, { email, name, role, duty: clip(b.duty, 40), password: pw, mustChange: true });
  await log(db, admin, '관리자 계정 추가', name, `${role === 'owner' ? '회장 권한' : '운영진 권한'} ${clip(b.duty, 40)}`);
  return json({ ok: true, tempPassword: pw });
}

async function updateAccount({ db, request, segs, admin }) {
  requireRole(admin, 'owner');
  const cur = await first(db, 'SELECT * FROM admins WHERE id = ?', segs[1]);
  if (!cur) throw new HttpError(404, 'not_found', '계정을 찾을 수 없습니다.');
  const b = await readJson(request);
  const role = b.role !== undefined ? oneOf(b.role, ['owner', 'staff'], '권한') : cur.role;
  const active = b.active !== undefined ? bool(b.active) : cur.active;
  const duty = b.duty !== undefined ? clip(b.duty, 40) : cur.duty;
  if (cur.id === admin.id && (role !== 'owner' || !active)) throw new HttpError(400, 'self', '내 계정의 권한을 낮추거나 멈출 수 없습니다.');
  if (cur.role === 'owner' && (role !== 'owner' || !active)) {
    const owners = await first(db, "SELECT COUNT(*) AS n FROM admins WHERE role = 'owner' AND active = 1");
    if (owners.n <= 1) throw new HttpError(400, 'last_owner', '회장 권한 계정이 최소 하나는 있어야 합니다.');
  }
  let pw = null;
  if (b.resetPassword) {
    pw = tempPassword();
    const { hash, salt } = await hashPassword(pw);
    await run(db, 'UPDATE admins SET pw_hash = ?, pw_salt = ?, must_change = 1 WHERE id = ?', hash, salt, cur.id);
  }
  await run(db, 'UPDATE admins SET role = ?, active = ?, duty = ? WHERE id = ?', role, active, duty, cur.id);
  if (!active || pw) await run(db, 'DELETE FROM admin_sessions WHERE admin_id = ?', cur.id);
  await log(db, admin, '관리자 계정 수정', cur.name, [role !== cur.role && `권한 ${role}`, active !== cur.active && (active ? '다시 사용' : '사용 중지'), pw && '임시 비밀번호 발급'].filter(Boolean).join(', '));
  return json({ ok: true, tempPassword: pw });
}

/* ---------- 활동 기록·내보내기·정리 ---------- */
async function listLogs({ db, admin, request }) {
  requireRole(admin, 'owner');
  const limit = Math.min(500, parseInt(new URL(request.url).searchParams.get('limit'), 10) || 200);
  return json({ items: await all(db, 'SELECT * FROM logs ORDER BY id DESC LIMIT ?', limit) });
}

function csv(rows, cols) {
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cols.map((c) => c[1]).join(','), ...rows.map((r) => cols.map((c) => cell(r[c[0]])).join(','))].join('\r\n');
}

async function exportCsv({ db, admin, request }) {
  requireRole(admin, 'owner');
  const kind = new URL(request.url).searchParams.get('kind');
  let body;
  let name;
  if (kind === 'members') {
    const rows = await all(db, `SELECT ${MEMBER_FIELDS}, s.name AS sangdan_name FROM members m LEFT JOIN sangdans s ON s.id = m.sangdan_id ORDER BY m.joined_at`);
    body = csv(rows, [['name', '이름'], ['phone', '휴대전화'], ['email', '이메일'], ['work', '하는 일'], ['tier', '구분'], ['status', '상태'], ['sangdan_name', '상단'],
      ['roles', '역할'], ['joined_at', '가입일'], ['paused_until', '휴회 종료'], ['fee_status', '회비'], ['fee_paid_until', '납부 기한'], ['verified', '사업자 확인'],
      ['charter_signed', '헌장 서약'], ['founding', '창립 상회원'], ['source', '가입 경로'], ['memo', '메모']]);
    name = 'members';
  } else {
    const type = kind === 'jangnal' ? 'jangnal' : 'apply';
    const rows = (await all(db, 'SELECT * FROM applications WHERE type = ? ORDER BY created_at', type)).map((r) => ({ ...parseData(r.data), ...r }));
    body = csv(rows, type === 'jangnal'
      ? [['created_at', '접수'], ['status', '상태'], ['session', '장날 날짜'], ['sessionLabel', '장날'], ['name', '이름'], ['phone', '휴대전화'], ['email', '이메일'], ['work', '하는 일'], ['question', '고민'], ['source', '경로'], ['memo', '메모']]
      : [['created_at', '접수'], ['status', '상태'], ['name', '이름'], ['phone', '휴대전화'], ['email', '이메일'], ['region', '지역'], ['work', '하는 일'], ['bizType', '형태'],
        ['years', '업력'], ['size', '규모'], ['times', '시간대'], ['worry', '고민'], ['goal', '1년 뒤'], ['canHelp', '도울 수 있는 것'], ['avoid', '불편한 업종'],
        ['source', '경로'], ['roles', '관심 역할'], ['memo', '메모']]);
    name = type === 'jangnal' ? 'jangnal-applications' : 'applications';
  }
  await log(db, admin, '목록 내려받기', name);
  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}-${today()}.csv"`,
      'cache-control': 'no-store',
    },
  });
}

async function purge({ db, request, admin }) {
  requireRole(admin, 'owner');
  const b = await readJson(request);
  const cutoff = new Date(Date.now() - 183 * 24 * 3600 * 1000).toISOString();
  const where = `created_at < ? AND member_id IS NULL AND (type = 'jangnal' OR status != 'joined')`;
  const apps = await first(db, `SELECT COUNT(*) AS n FROM applications WHERE ${where}`, cutoff);
  const left = await all(db, "SELECT id, application_id FROM members WHERE status = 'left'");
  if (b.dryRun) return json({ ok: true, applications: apps.n, leftMembers: left.length });
  const stmts = [db.prepare(`DELETE FROM applications WHERE ${where}`).bind(cutoff)];
  left.forEach((m) => {
    stmts.push(db.prepare('DELETE FROM attendance WHERE member_id = ?').bind(m.id));
    stmts.push(db.prepare('UPDATE sangdans SET leader_id = NULL WHERE leader_id = ?').bind(m.id));
    stmts.push(db.prepare('DELETE FROM applications WHERE id = ? OR member_id = ?').bind(m.application_id || '', m.id));
    stmts.push(db.prepare('DELETE FROM members WHERE id = ?').bind(m.id));
  });
  stmts.push(db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').bind(now()));
  stmts.push(db.prepare('DELETE FROM logs WHERE at < ?').bind(new Date(Date.now() - 2 * 365 * 24 * 3600 * 1000).toISOString()));
  await db.batch(stmts);
  await log(db, admin, '개인정보 정리', `신청서 ${apps.n}건, 탈퇴 회원 ${left.length}명`, '6개월 지난 미가입 신청서와 탈퇴 회원 정보 삭제');
  return json({ ok: true, applications: apps.n, leftMembers: left.length });
}
