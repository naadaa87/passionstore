#!/usr/bin/env node
/*
  열정상회 홈페이지 빌드
  - site.json, content/journal/*.md, tools/*.js 를 읽어 public/ 에 HTML·사이트맵·RSS를 만듭니다.
  - 외부 패키지가 필요 없습니다. Cloudflare Pages 빌드 명령: node tools/build.js
*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseFrontMatter, toHtml, plainText, esc } = require('./md');
const { page, breadcrumbs, breadcrumbLd } = require('./layout');
const P = require('./pages');
const personas = require('./personas');
const faq = require('./faq');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public');

/* ---------- 설정 ---------- */
let site;
try {
  site = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.json'), 'utf8'));
} catch (e) {
  console.error('site.json을 읽지 못했습니다. 따옴표와 쉼표를 확인해 주세요.\n' + e.message);
  process.exit(1);
}
site.url = String(site.url || '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(site.url)) {
  console.error('site.json의 url은 https:// 로 시작해야 합니다.');
  process.exit(1);
}
site.verification = site.verification || {};
site.contact = site.contact || {};
site.operator = site.operator || {};
site.fees = site.fees || {};
site.jangnal = Array.isArray(site.jangnal) ? site.jangnal : [];
site.team = Array.isArray(site.team) ? site.team : [];

const hashOf = (files) => {
  const h = crypto.createHash('md5');
  files.forEach((f) => { try { h.update(fs.readFileSync(path.join(OUT, f))); } catch (e) { /* 없는 파일 건너뜀 */ } });
  h.update(JSON.stringify(site));
  return h.digest('hex').slice(0, 8);
};
site.assetVersion = hashOf(['assets/css/style.css', 'assets/js/main.js', 'assets/js/forms.js']);

const write = (rel, content) => {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};

/* ---------- 상회보 글 ---------- */
const JOURNAL = path.join(ROOT, 'content', 'journal');
const posts = fs.readdirSync(JOURNAL)
  .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
  .map((f) => {
    const src = fs.readFileSync(path.join(JOURNAL, f), 'utf8').replace(/\r/g, '');
    const { meta, body } = parseFrontMatter(src);
    const slug = (meta.slug || f.replace(/\.md$/, '')).toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`글 주소(slug)는 영문 소문자, 숫자, 하이픈만 쓸 수 있습니다: ${f}`);
    if (!meta.title || !meta.date) throw new Error(`글 앞머리에 title과 date가 필요합니다: ${f}`);
    if (meta.draft === 'true') return null;
    const { html, toc } = toHtml(body);
    const text = plainText(body);
    return {
      slug,
      path: `/journal/${slug}`,
      title: meta.title,
      description: meta.description || text.slice(0, 120),
      date: meta.date,
      updated: meta.updated || meta.date,
      category: meta.category || '상회보',
      keywords: meta.keywords || '',
      order: Number(meta.order || 0),
      html,
      toc,
      minutes: Math.max(2, Math.round(text.length / 500)),
    };
  })
  .filter(Boolean)
  .sort((a, b) => (b.date.localeCompare(a.date)) || (b.order - a.order));

/* ---------- 장날 일정(구조화 데이터) ---------- */
const today = new Date().toISOString().slice(0, 10);
const upcoming = site.jangnal.filter((s) => s && s.date && s.date >= today);
const eventsLd = upcoming.map((s) => ({
  '@type': 'Event',
  name: `열정상회 장날${s.topic ? ` — ${s.topic}` : ''}`,
  startDate: `${s.date}T${s.time || '19:00'}:00+09:00`,
  eventStatus: 'https://schema.org/EventScheduled',
  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  location: { '@type': 'Place', name: s.place || '서울', address: { '@type': 'PostalAddress', addressLocality: '서울', addressCountry: 'KR' } },
  description: '사업자, 자영업자, 프리랜서가 함께하는 열정상회의 월간 공개 모임. 회원이 아니어도 손님으로 참여할 수 있습니다.',
  organizer: { '@type': 'Organization', name: '열정상회', url: site.url + '/' },
  url: site.url + '/jangnal',
  image: site.url + '/assets/img/og-image.png',
}));

const ctx = { posts, personas, faq, eventsLd };

/* ---------- 고정 페이지 ---------- */
const pages = [
  P.home(site, ctx),
  P.about(site, ctx),
  P.programs(site, ctx),
  P.jangnal(site, ctx),
  P.join(site, ctx),
  P.charter(site, ctx),
  P.faqPage(site, ctx),
  P.journalIndex(site, ctx),
  P.privacy(site, ctx),
  P.notFound(site, ctx),
  ...personas.map((p) => P.persona(site, ctx, p)),
];

/* ---------- 글 페이지 ---------- */
posts.forEach((post, i) => {
  const crumbs = [['홈', '/'], ['상회보', '/journal/'], [post.title, post.path]];
  const sameCat = posts.filter((x) => x !== post && x.category === post.category);
  const rest = posts.filter((x) => x !== post && x.category !== post.category);
  const related = [...sameCat, ...rest].slice(0, 3);
  const tocHtml = post.toc.length >= 3
    ? `<nav class="toc" aria-label="이 글의 차례"><p class="toc-title">이 글의 차례</p><ol>${post.toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></nav>`
    : '';
  pages.push({
    path: post.path,
    file: `journal/${post.slug}.html`,
    title: post.title,
    desc: post.description,
    keywords: post.keywords,
    active: '/journal/',
    ogType: 'article',
    ogExtra: `<meta property="article:published_time" content="${post.date}T09:00:00+09:00">
  <meta property="article:modified_time" content="${post.updated}T09:00:00+09:00">
  <meta property="article:section" content="${esc(post.category)}">`,
    graph: [
      breadcrumbLd(site, crumbs),
      {
        '@type': 'BlogPosting',
        '@id': site.url + post.path + '#article',
        headline: post.title,
        description: post.description,
        datePublished: `${post.date}T09:00:00+09:00`,
        dateModified: `${post.updated}T09:00:00+09:00`,
        inLanguage: 'ko-KR',
        articleSection: post.category,
        keywords: post.keywords,
        mainEntityOfPage: site.url + post.path,
        image: site.url + '/assets/img/og-image.png',
        author: { '@type': 'Organization', name: '열정상회 상회보', url: site.url + '/journal/' },
        publisher: { '@id': site.url + '/#organization' },
        isPartOf: { '@type': 'Blog', name: '열정상회 상회보', url: site.url + '/journal/' },
      },
    ],
    body: `
    <article class="article">
      <header class="article-head">
        <div class="wrap">
          ${breadcrumbs(crumbs)}
          <p class="post-meta"><span>${esc(post.category)}</span><time datetime="${post.date}">${P.fmtDate(post.date)}</time><span>${post.minutes}분 읽기</span></p>
          <h1>${esc(post.title)}</h1>
          <p class="lead">${esc(post.description)}</p>
        </div>
      </header>
      <div class="wrap article-layout">
        ${tocHtml}
        <div class="article-body">
${post.html}
        </div>
      </div>
    </article>

    <section class="section alt">
      <div class="wrap">
        <h2>다음에 읽을 글</h2>
        ${P.postList(related)}
        <a class="text-link" href="/journal/">상회보 전체 보기</a>
      </div>
    </section>

    <section class="cta">
      <div class="wrap">
        <h2>이런 이야기를 직접 나누고 싶다면</h2>
        <p>열정상회는 사업자, 자영업자, 프리랜서가 6~8명씩 모여 서로의 고민을 깊게 다루는 모임입니다. 한 달에 한 번 열리는 장날에 손님으로 먼저 와 보세요.</p>
        <div class="actions">
          <a class="btn btn-light" href="/jangnal#apply">장날 신청하기</a>
          <a class="btn btn-outline-light" href="/about">열정상회 소개</a>
        </div>
      </div>
    </section>
`,
  });
});

pages.forEach((o) => write(o.file, page(site, o)));

/* ---------- 사이트맵 ---------- */
const lastmodFor = (o) => {
  const post = posts.find((p) => p.path === o.path);
  if (post) return post.updated;
  if (o.path === '/' || o.path === '/journal/') return [site.updated, ...posts.map((p) => p.updated)].sort().pop();
  return site.updated;
};
const priority = (p) => (p === '/' ? '1.0' : /^\/(join|jangnal|about|programs)$/.test(p) ? '0.9' : p.startsWith('/for/') ? '0.8' : p.startsWith('/journal/') ? '0.7' : '0.5');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.filter((o) => !o.noindex).map((o) => `  <url><loc>${site.url}${o.path}</loc><lastmod>${lastmodFor(o)}</lastmod><priority>${priority(o.path)}</priority></url>`).join('\n')}
</urlset>
`;
write('sitemap.xml', sitemap);

/* ---------- RSS ---------- */
const rfc822 = (d) => new Date(`${d}T09:00:00+09:00`).toUTCString();
const cdata = (s) => `<![CDATA[${String(s).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
const absolutize = (html) => html.replace(/(href|src)="\//g, `$1="${site.url}/`);
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>열정상회 상회보</title>
    <link>${site.url}/journal/</link>
    <atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml"/>
    <description>사업자, 자영업자, 프리랜서를 위한 열정상회의 글</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${posts.map((p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${site.url}${p.path}</link>
      <guid isPermaLink="true">${site.url}${p.path}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <category>${esc(p.category)}</category>
      <description>${cdata(`<p>${esc(p.description)}</p>${absolutize(p.html)}`)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`;
write('rss.xml', rss);

/* ---------- robots.txt ---------- */
const robots = [
  site.verification.daumRobotsLine ? site.verification.daumRobotsLine.trim() : null,
  'User-agent: *',
  'Allow: /',
  'Disallow: /api/',
  'Disallow: /admin',
  '',
  `Sitemap: ${site.url}/sitemap.xml`,
  '',
].filter((l) => l !== null).join('\n');
write('robots.txt', robots);

/* ---------- 화면용 설정(site-config.js) ---------- */
const runtime = {
  contact: site.contact,
  operator: site.operator,
  fees: site.fees,
  jangnal: site.jangnal,
  team: site.team,
};
write('assets/js/site-config.js', `/* 자동 생성 파일입니다. 고칠 때는 저장소 맨 위의 site.json을 고치세요. */\nwindow.SITE_CONFIG = ${JSON.stringify(runtime, null, 2)};\n`);

/* ---------- 관리자 화면(admin/ → public/admin/) ---------- */
const ADMIN = path.join(ROOT, 'admin');
const mdSrc = fs.readFileSync(path.join(__dirname, 'md.js'), 'utf8');
const adminFiles = fs.readdirSync(ADMIN).filter((f) => /\.(html|css|js)$/.test(f));
const adminHash = crypto.createHash('md5');
adminFiles.forEach((f) => adminHash.update(fs.readFileSync(path.join(ADMIN, f))));
adminHash.update(mdSrc);
const adminVersion = adminHash.digest('hex').slice(0, 8);
adminFiles.forEach((f) => {
  let text = fs.readFileSync(path.join(ADMIN, f), 'utf8');
  if (f.endsWith('.html')) text = text.replace(/\{\{v\}\}/g, adminVersion);
  write(path.join('admin', f), text);
});
write('admin/md.js', `/* 자동 생성 파일입니다. 고칠 때는 tools/md.js를 고치세요. 관리자 화면의 상회보 미리보기에 씁니다. */\n(function () {\nvar module = { exports: {} };\n${mdSrc}\nwindow.MD = module.exports;\n})();\n`);

console.log(`빌드 완료: 페이지 ${pages.length}개, 상회보 글 ${posts.length}편, 주소 ${site.url}`);
