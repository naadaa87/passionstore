// 상회보 글(마크다운)을 HTML로 바꾸는 작은 변환기. 외부 패키지 없이 동작합니다.
// 지원: 앞머리(---), ## ### 제목, 문단, - 목록, 1. 목록, > 인용, **굵게**, [링크](주소), ![설명](이미지 주소), --- 구분선, :::note 상자
// 이 파일은 관리자 화면의 미리보기에서도 그대로 씁니다(빌드할 때 public/admin/md.js로 복사).

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const safeSrc = (src) => /^(\/|https:\/\/)/.test(src) && !/["'<>]/.test(src);

function inline(s) {
  let out = esc(s);
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, src) => (safeSrc(src) ? `<img src="${src}" alt="${alt}" loading="lazy" decoding="async">` : alt));
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
    if (!/^(\/|#|https?:\/\/|mailto:|tel:)/.test(href)) return text;
    const ext = /^https?:\/\//.test(href);
    return `<a href="${href}"${ext ? ' rel="noopener"' : ''}>${text}</a>`;
  });
  return out;
}

function parseFrontMatter(src) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  m[1].split('\n').forEach((line) => {
    const i = line.indexOf(':');
    if (i < 0) return;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (/^".*"$/.test(v)) v = v.slice(1, -1);
    meta[k] = v;
  });
  return { meta, body: src.slice(m[0].length) };
}

function slugifyHeading(text, used) {
  let base = text.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-').toLowerCase() || 'section';
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

function toHtml(body) {
  const lines = body.replace(/\r/g, '').split('\n');
  const out = [];
  const toc = [];
  const used = new Set();
  let para = [];
  let list = null; // { type: 'ul'|'ol', items: [] }
  let quote = [];
  let note = null;

  const flushPara = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
  };
  const flushList = () => {
    if (list) {
      out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`);
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) { out.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`); quote = []; }
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (note !== null) {
      if (line.trim() === ':::') {
        out.push(`<aside class="note-box">${toHtml(note.join('\n')).html}</aside>`);
        note = null;
      } else note.push(raw);
      continue;
    }
    if (line.trim() === ':::note') { flushAll(); note = []; continue; }

    if (!line.trim()) { flushAll(); continue; }

    let m;
    if ((m = /^(#{2,3})\s+(.*)$/.exec(line))) {
      flushAll();
      const level = m[1].length;
      const id = slugifyHeading(m[2], used);
      if (level === 2) toc.push({ id, text: m[2] });
      out.push(`<h${level} id="${id}">${inline(m[2])}</h${level}>`);
      continue;
    }
    if (/^---+$/.test(line)) { flushAll(); out.push('<hr>'); continue; }
    if ((m = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line.trim()))) {
      flushAll();
      if (safeSrc(m[2])) {
        const alt = esc(m[1]);
        out.push(`<figure class="post-figure"><img src="${esc(m[2])}" alt="${alt}" loading="lazy" decoding="async">${alt ? `<figcaption>${alt}</figcaption>` : ''}</figure>`);
      }
      continue;
    }
    if ((m = /^>\s?(.*)$/.exec(line))) { flushPara(); flushList(); quote.push(m[1]); continue; }
    if ((m = /^[-*]\s+(.*)$/.exec(line))) {
      flushPara(); flushQuote();
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
      list.items.push(m[1]);
      continue;
    }
    if ((m = /^\d+\.\s+(.*)$/.exec(line))) {
      flushPara(); flushQuote();
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
      list.items.push(m[1]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(raw)) { list.items[list.items.length - 1] += ' ' + line.trim(); continue; }
    flushList(); flushQuote();
    para.push(line.trim());
  }
  flushAll();
  return { html: out.join('\n'), toc };
}

function plainText(body) {
  return body
    .replace(/^:::.*$/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[>\-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { parseFrontMatter, toHtml, plainText, esc, inline };
