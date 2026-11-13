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
