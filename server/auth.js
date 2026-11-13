// 관리자 로그인, 세션, 권한
import { first, run, now, uid } from './db.js';
import { HttpError } from './http.js';

const COOKIE = 'ys_admin';
const SESSION_HOURS = 12;
const ITER = 100000; // Cloudflare Workers의 PBKDF2 상한

const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));

export async function hashPassword(password, saltHex) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256);
  return { hash: toHex(bits), salt: toHex(salt) };
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function verifyPassword(password, hash, salt) {
  const h = await hashPassword(password, salt);
  return safeEqual(h.hash, hash);
}

export function checkPasswordRule(pw) {
  if (typeof pw !== 'string' || pw.length < 10) throw new HttpError(400, 'weak_password', '비밀번호는 10자 이상으로 정해 주세요.');
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) throw new HttpError(400, 'weak_password', '비밀번호에 영문과 숫자를 함께 넣어 주세요.');
}

async function sha256(s) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

function readCookie(request, name) {
  const c = request.headers.get('cookie') || '';
  const m = c.split(/;\s*/).find((p) => p.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}

export async function createSession(db, adminId) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();
  await run(db, 'INSERT INTO admin_sessions (token_hash, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?)', await sha256(token), adminId, expires, now());
  await run(db, 'DELETE FROM admin_sessions WHERE expires_at < ?', now());
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
}

export async function destroySession(db, request) {
  const token = readCookie(request, COOKIE);
  if (token) await run(db, 'DELETE FROM admin_sessions WHERE token_hash = ?', await sha256(token));
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function currentAdmin(db, request) {
  const token = readCookie(request, COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await first(db,
    `SELECT a.id, a.email, a.name, a.role, a.duty, a.must_change, a.active, s.expires_at
       FROM admin_sessions s JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = ?`, await sha256(token));
  if (!row || !row.active || row.expires_at < now()) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, duty: row.duty, mustChange: !!row.must_change };
}

export function requireRole(admin, role) {
  if (!admin) throw new HttpError(401, 'unauthorized', '다시 로그인해 주세요.');
  if (role === 'owner' && admin.role !== 'owner') throw new HttpError(403, 'owner_only', '회장 계정만 할 수 있는 일입니다.');
}

// 로그인 시도 제한: 15분 동안 같은 주소에서 10번 실패하면 잠시 막습니다.
export async function checkLoginRate(db, ip) {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await run(db, 'DELETE FROM login_attempts WHERE at < ?', since);
  const r = await first(db, 'SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ?', ip);
  if (r && r.n >= 10) throw new HttpError(429, 'too_many', '로그인 시도가 너무 많습니다. 15분 뒤에 다시 시도해 주세요.');
}
export async function recordLoginFail(db, ip) {
  await run(db, 'INSERT INTO login_attempts (ip, at) VALUES (?, ?)', ip, now());
}
export async function clearLoginFails(db, ip) {
  await run(db, 'DELETE FROM login_attempts WHERE ip = ?', ip);
}

export async function createAdmin(db, { email, name, role, duty, password, mustChange }) {
  const { hash, salt } = await hashPassword(password);
  const id = uid('adm_');
  await run(db,
    'INSERT INTO admins (id, email, name, role, duty, pw_hash, pw_salt, active, must_change, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
    id, email.toLowerCase(), name, role, duty || '', hash, salt, mustChange ? 1 : 0, now());
  return id;
}

export function tempPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let s = [...bytes].map((b) => chars[b % chars.length]).join('');
  if (!/[0-9]/.test(s)) s = s.slice(0, 11) + '7';
  return s;
}
