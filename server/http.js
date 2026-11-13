// 응답·요청 도구
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
      ...headers,
    },
  });
}

export async function readJson(request, maxBytes = 2_000_000) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > maxBytes) throw new HttpError(413, 'too_large', '보내는 내용이 너무 큽니다.');
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') throw new Error();
    return body;
  } catch (e) {
    throw new HttpError(400, 'bad_request', '요청 형식이 올바르지 않습니다.');
  }
}

// 다른 사이트에서 보낸 변경 요청을 막습니다.
export function checkSameOrigin(request) {
  const m = request.method;
  if (m === 'GET' || m === 'HEAD') return;
  const origin = request.headers.get('origin');
  const host = new URL(request.url).host;
  if (!origin) throw new HttpError(403, 'forbidden', '허용되지 않은 요청입니다.');
  try {
    if (new URL(origin).host !== host) throw new Error();
  } catch (e) {
    throw new HttpError(403, 'forbidden', '허용되지 않은 요청입니다.');
  }
  if (request.headers.get('x-admin-request') !== '1') throw new HttpError(403, 'forbidden', '허용되지 않은 요청입니다.');
}

export function clip(v, n = 2000) {
  return String(v == null ? '' : v).trim().slice(0, n);
}

export function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => { if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k]; });
  return out;
}

export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
