// D1 데이터베이스: 표 만들기와 기본 도구
// Cloudflare Pages 설정 > 바인딩에서 D1 데이터베이스를 DB 라는 이름으로 연결하면 동작합니다.
// 표는 처음 요청 때 자동으로 만들어집니다.

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    name TEXT, phone TEXT, email TEXT,
    session TEXT, source TEXT,
    data TEXT NOT NULL DEFAULT '{}',
    memo TEXT NOT NULL DEFAULT '',
    member_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_app_type_status ON applications(type, status)`,
  `CREATE INDEX IF NOT EXISTS idx_app_created ON applications(created_at)`,
  `CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL, phone TEXT, email TEXT,
    work TEXT, biz_type TEXT, region TEXT, years TEXT, size TEXT, times TEXT,
    tier TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'active',
    sangdan_id TEXT,
    roles TEXT NOT NULL DEFAULT '',
    joined_at TEXT, paused_until TEXT,
    fee_status TEXT NOT NULL DEFAULT 'unpaid',
    fee_paid_until TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    charter_signed INTEGER NOT NULL DEFAULT 0,
    founding INTEGER NOT NULL DEFAULT 0,
    source TEXT, application_id TEXT,
    memo TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_member_status ON members(status)`,
  `CREATE INDEX IF NOT EXISTS idx_member_sangdan ON members(sangdan_id)`,
  `CREATE TABLE IF NOT EXISTS sangdans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slot TEXT NOT NULL DEFAULT '',
    schedule TEXT NOT NULL DEFAULT '',
    leader_id TEXT,
    capacity INTEGER NOT NULL DEFAULT 8,
    status TEXT NOT NULL DEFAULT 'open',
    memo TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    sangdan_id TEXT NOT NULL,
    date TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'offline',
    facilitator TEXT NOT NULL DEFAULT '',
    chair_led INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_meeting_sangdan ON meetings(sangdan_id, date)`,
  `CREATE TABLE IF NOT EXISTS attendance (
    meeting_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    present INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (meeting_id, member_id)
  )`,
  `CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    duty TEXT NOT NULL DEFAULT '',
    pw_hash TEXT NOT NULL,
    pw_salt TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    must_change INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_login TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    ip TEXT NOT NULL,
    at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id TEXT, admin_name TEXT,
    action TEXT NOT NULL, target TEXT, detail TEXT,
    at TEXT NOT NULL
  )`,
  // 회원 변동 기록(가입·탈퇴·휴회·복귀). 회원 정보를 지운 뒤에도 유지율·이탈률을 계산할 수 있게 남깁니다.
  // 이름·연락처 없이 무작위 회원 번호와 날짜만 둡니다.
  `CREATE TABLE IF NOT EXISTS member_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'member',
    day TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mevent_day ON member_events(kind, day)`,
  `CREATE INDEX IF NOT EXISTS idx_mevent_member ON member_events(member_id)`,
  // 홈페이지 방문 통계. 쿠키를 쓰지 않고 IP 주소도 저장하지 않습니다.
  // visitor: 그날의 무작위 값 + IP + 브라우저 정보로 만든 해시(다음 날에는 이어지지 않음)
  // session: 브라우저 탭을 닫으면 사라지는 무작위 값
  `CREATE TABLE IF NOT EXISTS pageviews (
    id TEXT PRIMARY KEY,
    day TEXT NOT NULL,
    at TEXT NOT NULL,
    path TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    visitor TEXT NOT NULL,
    session TEXT NOT NULL,
    ref_kind TEXT NOT NULL DEFAULT 'direct',
    ref_host TEXT NOT NULL DEFAULT '',
    utm_source TEXT NOT NULL DEFAULT '',
    utm_medium TEXT NOT NULL DEFAULT '',
    utm_campaign TEXT NOT NULL DEFAULT '',
    device TEXT NOT NULL DEFAULT 'desktop',
    seconds INTEGER NOT NULL DEFAULT 0,
    scroll INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pv_day ON pageviews(day)`,
  `CREATE INDEX IF NOT EXISTS idx_pv_path ON pageviews(path, day)`,
  `CREATE INDEX IF NOT EXISTS idx_pv_session ON pageviews(session)`,
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    at TEXT NOT NULL,
    kind TEXT NOT NULL,
    path TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL DEFAULT '',
    target TEXT NOT NULL DEFAULT '',
    session TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_event_day ON events(kind, day)`,
  `CREATE TABLE IF NOT EXISTS analytics_salt (
    day TEXT PRIMARY KEY,
    salt TEXT NOT NULL
  )`,
];

let ready = false;

export async function ensureSchema(db) {
  if (ready) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  ready = true;
}

export const now = () => new Date().toISOString();
export const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // 한국 날짜
export const uid = (prefix = '') => prefix + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

export async function all(db, sql, ...args) {
  const r = await db.prepare(sql).bind(...args).all();
  return r.results || [];
}
export async function first(db, sql, ...args) {
  return (await db.prepare(sql).bind(...args).first()) || null;
}
export async function run(db, sql, ...args) {
  return db.prepare(sql).bind(...args).run();
}

export async function log(db, admin, action, target = '', detail = '') {
  try {
    await run(db, 'INSERT INTO logs (admin_id, admin_name, action, target, detail, at) VALUES (?, ?, ?, ?, ?, ?)',
      admin ? admin.id : null, admin ? admin.name : '시스템', action, String(target).slice(0, 200), String(detail).slice(0, 1000), now());
  } catch (e) { /* 기록 실패는 무시 */ }
}

// 회원 변동 기록. kind: join(가입·재가입), left(탈퇴), pause(휴회), resume(복귀)
export function memberEvent(db, memberId, kind, tier, day) {
  return db.prepare('INSERT INTO member_events (member_id, kind, tier, day) VALUES (?, ?, ?, ?)').bind(memberId, kind, tier || 'member', day || today());
}
