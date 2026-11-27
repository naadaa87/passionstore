// IndexNow: 홈페이지의 주소 목록을 네이버와 빙 등에 바로 알립니다. (POST /api/admin/indexnow)
// 확인용 값은 site.json의 indexNowKey이고, 빌드할 때 public/<값>.txt 파일로도 만들어집니다.
import site from '../site.json';
import { json, HttpError } from './http.js';
import { log } from './db.js';

// 네이버는 따로 받고, api.indexnow.org는 빙을 비롯한 참여 검색엔진에 함께 전달합니다.
const ENDPOINTS = ['https://searchadvisor.naver.com/indexnow', 'https://api.indexnow.org/indexnow'];
const MEANING = { 200: '접수', 202: '접수(확인 중)', 400: '형식 오류', 403: '확인 파일을 찾지 못함', 422: '주소가 사이트와 맞지 않음', 429: '너무 자주 보냄' };

export async function indexNow({ env, request, admin, db }) {
  const key = String(site.indexNowKey || '');
  const base = String(site.url || '').replace(/\/+$/, '');
  if (!/^[a-f0-9]{32}$/.test(key) || !/^https:\/\//.test(base)) {
    throw new HttpError(400, 'not_ready', 'site.json에 indexNowKey와 url이 있어야 합니다.');
  }
  const mapUrl = new URL('/sitemap.xml', request.url);
  const res = env.ASSETS ? await env.ASSETS.fetch(new Request(mapUrl)) : await fetch(mapUrl);
  if (!res.ok) throw new HttpError(502, 'no_sitemap', '사이트맵을 읽지 못했습니다. 잠시 뒤 다시 눌러 주세요.');
  const xml = await res.text();
  const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith(base + '/')).slice(0, 10000);
  if (!urlList.length) throw new HttpError(502, 'no_urls', '사이트맵에서 주소를 찾지 못했습니다.');

  const body = JSON.stringify({ host: new URL(base).host, key, keyLocation: `${base}/${key}.txt`, urlList });
  const endpoints = env.INDEXNOW_ENDPOINTS ? String(env.INDEXNOW_ENDPOINTS).split(',').map((s) => s.trim()).filter(Boolean) : ENDPOINTS;
  const results = await Promise.all(endpoints.map(async (ep) => {
    const name = /naver/.test(ep) ? '네이버' : '빙 등(IndexNow)';
    try {
      const r = await fetch(ep, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body });
      return { name, status: r.status, ok: r.status === 200 || r.status === 202, note: MEANING[r.status] || `응답 ${r.status}` };
    } catch (e) {
      return { name, status: 0, ok: false, note: '연결하지 못함' };
    }
  }));
  await log(db, admin, '검색엔진에 알림(IndexNow)', `${urlList.length}개 주소`, results.map((r) => `${r.name}: ${r.note}`).join(', '));
  return json({ ok: results.some((r) => r.ok), count: urlList.length, results });
}
