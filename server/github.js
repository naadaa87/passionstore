// GitHub 저장소 파일 읽기·쓰기 (사이트 설정, 장날 일정, 상회보 글, 이미지)
// Cloudflare 변수: GITHUB_TOKEN(필수, Secret), GITHUB_REPO(기본 naadaa87/passionstore), GITHUB_BRANCH(기본 main)
import { HttpError } from './http.js';

const dec = new TextDecoder();
const enc = new TextEncoder();

function b64ToText(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return dec.decode(bytes);
}
function textToB64(text) {
  const bytes = enc.encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function githubConfig(env) {
  return {
    token: env.GITHUB_TOKEN || '',
    repo: env.GITHUB_REPO || 'naadaa87/passionstore',
    branch: env.GITHUB_BRANCH || 'main',
    api: (env.GITHUB_API || 'https://api.github.com').replace(/\/$/, ''),
  };
}

export const githubReady = (env) => !!env.GITHUB_TOKEN;

async function gh(env, method, path, body) {
  const c = githubConfig(env);
  if (!c.token) throw new HttpError(503, 'github_not_configured', 'GitHub 연결이 아직 설정되지 않았습니다. 관리자 안내서의 GitHub 연결 순서를 따라 주세요.');
  const res = await fetch(`${c.api}/repos/${c.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}${method === 'GET' ? `?ref=${encodeURIComponent(c.branch)}` : ''}`, {
    method,
    headers: {
      authorization: `Bearer ${c.token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'yeoljeongsanghoe-admin',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 && method === 'GET') return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 409 || (res.status === 422 && /sha/i.test(data.message || ''))) {
    throw new HttpError(409, 'conflict', '그사이 다른 곳에서 같은 파일이 바뀌었습니다. 화면을 새로 고친 뒤 다시 저장해 주세요.');
  }
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(502, 'github_auth', 'GitHub 토큰이 만료되었거나 권한이 부족합니다. 토큰을 다시 확인해 주세요.');
  }
  if (!res.ok) throw new HttpError(502, 'github_error', `GitHub 요청이 실패했습니다. (${res.status})`);
  return data;
}

export async function readFile(env, path) {
  const d = await gh(env, 'GET', path);
  if (!d) return null;
  if (Array.isArray(d)) throw new HttpError(400, 'is_dir', '폴더입니다.');
  return { text: b64ToText(d.content || ''), sha: d.sha };
}

export async function listDir(env, path) {
  const d = await gh(env, 'GET', path);
  if (!d) return [];
  return Array.isArray(d) ? d.map((f) => ({ name: f.name, path: f.path, sha: f.sha, type: f.type })) : [];
}

function message(text, admin) {
  return `${text}${admin ? ` (관리자: ${admin.name})` : ''}`;
}

export async function writeFile(env, path, text, sha, msg, admin) {
  const c = githubConfig(env);
  const d = await gh(env, 'PUT', path, { message: message(msg, admin), content: textToB64(text), branch: c.branch, ...(sha ? { sha } : {}) });
  return { sha: d.content && d.content.sha };
}

export async function writeBinary(env, path, base64, msg, admin) {
  const c = githubConfig(env);
  const existing = await gh(env, 'GET', path);
  const d = await gh(env, 'PUT', path, { message: message(msg, admin), content: base64, branch: c.branch, ...(existing && existing.sha ? { sha: existing.sha } : {}) });
  return { sha: d.content && d.content.sha };
}

export async function deleteFile(env, path, sha, msg, admin) {
  const c = githubConfig(env);
  await gh(env, 'DELETE', path, { message: message(msg, admin), sha, branch: c.branch });
}

// 폴더 안 글 파일 내용을 한 번에 읽습니다(GraphQL). 실패하면 파일을 하나씩 읽습니다.
export async function readDirTexts(env, path) {
  const c = githubConfig(env);
  if (!c.token) throw new HttpError(503, 'github_not_configured', 'GitHub 연결이 아직 설정되지 않았습니다. 관리자 안내서의 GitHub 연결 순서를 따라 주세요.');
  const [owner, name] = c.repo.split('/');
  try {
    const res = await fetch(`${c.api}/graphql`, {
      method: 'POST',
      headers: { authorization: `Bearer ${c.token}`, 'content-type': 'application/json', 'user-agent': 'yeoljeongsanghoe-admin' },
      body: JSON.stringify({
        query: 'query($owner:String!,$name:String!,$expr:String!){repository(owner:$owner,name:$name){object(expression:$expr){... on Tree{entries{name path type object{... on Blob{oid text}}}}}}}',
        variables: { owner, name, expr: `${c.branch}:${path}` },
      }),
    });
    if (res.ok) {
      const d = await res.json();
      const tree = d && d.data && d.data.repository && d.data.repository.object;
      if (tree && Array.isArray(tree.entries)) {
        return tree.entries.filter((e) => e.type === 'blob' && e.object).map((e) => ({ name: e.name, path: e.path, sha: e.object.oid, text: e.object.text || '' }));
      }
    }
  } catch (e) { /* 아래 방식으로 다시 읽습니다 */ }
  const files = (await listDir(env, path)).filter((f) => f.type === 'file').slice(0, 40);
  const out = [];
  for (const f of files) {
    const r = await readFile(env, f.path);
    out.push({ name: f.name, path: f.path, sha: r ? r.sha : f.sha, text: r ? r.text : '' });
  }
  return out;
}
