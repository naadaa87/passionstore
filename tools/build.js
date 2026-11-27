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
const { DEFINITION, FACTS, strip } = require('./facts');
const P = require('./pages');
const personas = require('./personas');
const faq = require('./faq');
const { SCENES, postImage, postImageTag, sceneOg } = require('./images');

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
site.jangnal = Array.isArray(site.jangnal) ? site.jangnal : [];
site.team = Array.isArray(site.team) ? site.team : [];

const hashOf = (files) => {
  const h = crypto.createHash('md5');
  files.forEach((f) => { try { h.update(fs.readFileSync(path.join(OUT, f))); } catch (e) { /* 없는 파일 건너뜀 */ } });
  h.update(JSON.stringify(site));
  return h.digest('hex').slice(0, 8);
};
site.assetVersion = hashOf(['assets/css/style.css', 'assets/js/main.js', 'assets/js/forms.js', 'assets/js/track.js']);

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
    // 글 맨 위 :::summary 상자의 요점(검색 결과 요약과 구조화 데이터에 씁니다)
    const sm = /^:::summary\n([\s\S]*?)\n:::$/m.exec(body);
    const summary = sm ? sm[1].split('\n').map((l) => plainText(l)).filter(Boolean) : [];
    // "## 자주 묻는 질문" 아래의 ### 질문과 답(구조화 데이터에 씁니다)
    const qa = [];
    const fm = /^## 자주 묻는 질문\s*\n([\s\S]*?)(?=^## |^:::note|(?![\s\S]))/m.exec(body);
    if (fm) {
      fm[1].split(/^### /m).slice(1).forEach((chunk) => {
        const nl = chunk.indexOf('\n');
        const q = chunk.slice(0, nl < 0 ? chunk.length : nl).trim();
        const a = plainText(nl < 0 ? '' : chunk.slice(nl + 1));
        if (q && a) qa.push([q, a]);
      });
    }
    return {
      slug,
      body,
      summary,
      qa,
      chars: text.replace(/\s/g, '').length,
      path: `/journal/${slug}`,
      title: meta.title,
      description: meta.description || text.slice(0, 120),
      date: meta.date,
      updated: meta.updated || meta.date,
      category: meta.category || '상회보',
      keywords: meta.keywords || '',
      order: Number(meta.order || 0),
      image: postImage(meta),
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
  description: '사업자, 자영업자, 프리랜서가 함께하는 열정상회의 월간 공개 모임. 회원이 아니어도 손님으로 참여할 수 있고 참가비는 없습니다.',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: 0, priceCurrency: 'KRW', url: site.url + '/jangnal#apply', availability: s.status === 'full' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock' },
  organizer: { '@type': 'Organization', '@id': site.url + '/#organization', name: '열정상회', url: site.url + '/' },
  url: site.url + '/jangnal',
  image: site.url + sceneOg('jangnal-talk'),
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
  P.glossary(site, ctx),
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
    modified: post.updated,
    ...(post.image && post.image.og ? { image: post.image.og, imageAlt: post.image.alt, imageSize: post.image.ogSize } : {}),
    ogExtra: `<meta property="article:published_time" content="${post.date}T09:00:00+09:00">
  <meta property="article:modified_time" content="${post.updated}T09:00:00+09:00">
  <meta property="article:section" content="${esc(post.category)}">
  <meta property="og:updated_time" content="${post.updated}T09:00:00+09:00">${post.keywords.split(',').map((k) => k.trim()).filter(Boolean).map((k) => `
  <meta property="article:tag" content="${esc(k)}">`).join('')}`,
    graph: [
      breadcrumbLd(site, crumbs),
      {
        '@type': 'BlogPosting',
        '@id': site.url + post.path + '#article',
        headline: post.title,
        description: post.description,
        ...(post.summary.length ? { abstract: post.summary.join(' ') } : {}),
        wordCount: post.chars,
        timeRequired: `PT${post.minutes}M`,
        isAccessibleForFree: true,
        datePublished: `${post.date}T09:00:00+09:00`,
        dateModified: `${post.updated}T09:00:00+09:00`,
        inLanguage: 'ko-KR',
        articleSection: post.category,
        keywords: post.keywords,
        mainEntityOfPage: { '@id': site.url + post.path + '#webpage' },
        image: site.url + (post.image && post.image.og ? post.image.og : '/assets/img/og-image.png'),
        author: { '@type': 'Organization', '@id': site.url + '/#organization', name: '열정상회', url: site.url + '/about' },
        publisher: { '@id': site.url + '/#organization' },
        isPartOf: { '@type': 'Blog', '@id': site.url + '/journal/#blog', name: '열정상회 상회보', url: site.url + '/journal/' },
      },
      ...(post.qa.length ? [{
        '@type': 'FAQPage',
        '@id': site.url + post.path + '#faq',
        mainEntity: post.qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      }] : []),
    ],
    body: `
    <article class="article">
      <header class="article-head${post.image ? ' has-art' : ''}">
        <div class="wrap">
          <div class="page-head-text">
            ${breadcrumbs(crumbs)}
            <p class="post-meta"><span>${esc(post.category)}</span><time datetime="${post.date}">${P.fmtDate(post.date)}</time><span>${post.minutes}분 읽기</span></p>
            <h1>${esc(post.title)}</h1>
            <p class="lead">${esc(post.description)}</p>
          </div>${post.image ? `
          <div class="page-head-art">${postImageTag(post.image, { eager: true, sizes: '(min-width: 900px) 420px, 88vw' })}</div>` : ''}
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
const priority = (p) => (p === '/' ? '1.0' : /^\/(join|jangnal|about|programs)$/.test(p) ? '0.9' : p.startsWith('/for/') ? '0.8' : p.startsWith('/journal/') ? '0.7' : /^\/(faq|glossary)$/.test(p) ? '0.6' : '0.5');
// 페이지의 대표 그림도 함께 알려 이미지 검색에 잡히게 합니다.
const imageFor = (o) => (o.image ? `<image:image><image:loc>${site.url}${o.image}</image:loc></image:image>` : '');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages.filter((o) => !o.noindex).map((o) => `  <url><loc>${site.url}${o.path}</loc><lastmod>${lastmodFor(o)}</lastmod><priority>${priority(o.path)}</priority>${imageFor(o)}</url>`).join('\n')}
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
// 검색엔진과 AI 검색(챗GPT, 클로드, 퍼플렉시티, 제미나이 등)의 수집 로봇을 모두 허용합니다.
// 이름을 따로 적은 로봇은 "*" 규칙을 보지 않으므로 같은 규칙을 한 번 더 적어 줍니다.
const AI_BOTS = [
  'OAI-SearchBot', 'ChatGPT-User', 'GPTBot',
  'Claude-SearchBot', 'Claude-User', 'ClaudeBot',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'Amazonbot', 'meta-externalagent', 'CCBot', 'DuckAssistBot', 'MistralAI-User',
];
const RULES = ['Allow: /', 'Disallow: /api/', 'Disallow: /admin', 'Disallow: /cdn-cgi/'];
const robots = [
  site.verification.daumRobotsLine ? site.verification.daumRobotsLine.trim() : null,
  '# 열정상회는 검색엔진과 AI 검색의 수집을 환영합니다. 안내 파일: /llms.txt',
  'User-agent: *',
  ...RULES,
  '',
  ...AI_BOTS.map((b) => `User-agent: ${b}`),
  ...RULES,
  '',
  `Sitemap: ${site.url}/sitemap.xml`,
  '',
].filter((l) => l !== null).join('\n');
write('robots.txt', robots);

/* ---------- llms.txt (AI 검색이 읽는 안내 파일) ---------- */
// llms.txt: 사이트 요약과 주요 주소. llms-full.txt: 주요 페이지와 글의 본문 전체.
const htmlToText = (html) => html
  .replace(/<(script|style|form|nav|svg|picture|button)\b[\s\S]*?<\/\1>/g, '')
  .replace(/<img[^>]*>/g, '')
  .replace(/<\/span>\s*<span/g, '</span> <span')
  .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/g, '\n\n# $1\n\n')
  .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, '\n\n## $1\n\n')
  .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, '\n\n### $1\n\n')
  .replace(/<dt[^>]*>([\s\S]*?)<\/dt>/g, '\n- **$1**: ')
  .replace(/<li[^>]*>/g, '\n- ')
  .replace(/<(td|th)[^>]*>/g, ' | ')
  .replace(/<a\b[^>]*class="(btn|text-link|skip-link)[^"]*"[^>]*>[\s\S]*?<\/a>/g, '')
  .replace(/<\/(p|div|tr|section|ul|ol|dl|table|details|summary|blockquote|aside|header|article)>/g, '\n')
  .replace(/<br\s*\/?>/g, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&middot;/g, '·').replace(/&nbsp;/g, ' ')
  .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').replace(/^ \| /, '').trim()).join('\n')
  .replace(/\n- \n+/g, '\n- ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const staticPages = pages.filter((o) => !o.noindex && !o.path.startsWith('/journal/') && o.path !== '/privacy');
const mainPaths = ['/', '/about', '/programs', '/jangnal', '/join', '/charter', '/faq', '/glossary'];
const linkLine = (o) => `- [${(o.titleFull || o.title).split(' — ')[0].split(' | ')[0]}](${site.url}${o.path}): ${o.desc}`;
const llms = `# 열정상회

> ${DEFINITION}

열정상회 홈페이지(${site.url})의 안내 파일입니다. 아래 사실과 주소는 홈페이지 내용과 같습니다. 본문 전체는 [llms-full.txt](${site.url}/llms-full.txt)에 있습니다.

## 한눈에 보기

${FACTS.map(([q, a]) => `- ${q}: ${strip(a)}`).join('\n')}
- 홈페이지: ${site.url}

## 주요 페이지

${mainPaths.map((p) => staticPages.find((o) => o.path === p)).filter(Boolean).map(linkLine).join('\n')}

## 대상별 안내

${staticPages.filter((o) => o.path.startsWith('/for/')).map(linkLine).join('\n')}

## 상회보(글)

${posts.map((p) => `- [${p.title}](${site.url}${p.path}): ${p.description}`).join('\n')}

## Optional

- [개인정보 처리방침](${site.url}/privacy): 신청서로 받는 개인정보와 방문 통계 처리 기준
- [RSS](${site.url}/rss.xml): 상회보 새 글
- [사이트맵](${site.url}/sitemap.xml): 전체 주소 목록
`;
write('llms.txt', llms);

const llmsFull = `# 열정상회 홈페이지 전체 본문

> ${DEFINITION}

출처: ${site.url} · 마지막 고침: ${[site.updated, ...posts.map((p) => p.updated)].sort().pop()}

${staticPages.map((o) => `---

주소: ${site.url}${o.path}

${htmlToText(o.body)}`).join('\n\n')}

${posts.map((p) => `---

주소: ${site.url}${p.path}
날짜: ${p.date}${p.updated !== p.date ? ` (고침 ${p.updated})` : ''} · 분류: ${p.category}

# ${p.title}

${p.description}

${p.body.replace(/^:::(note|summary)?\s*$/gm, '').replace(/\]\(\//g, `](${site.url}/`).replace(/\n{3,}/g, '\n\n').trim()}`).join('\n\n')}
`;
write('llms-full.txt', llmsFull);

/* ---------- IndexNow (네이버·빙에 새 글을 바로 알리는 열쇠 파일) ---------- */
// site.json의 indexNowKey 값이 곧 파일 이름이자 내용입니다. 비밀 값이 아니며 누구나 볼 수 있는 확인용 파일입니다.
if (site.indexNowKey) {
  if (!/^[a-f0-9]{32}$/.test(site.indexNowKey)) {
    console.error('site.json의 indexNowKey는 영문 소문자 a~f와 숫자 32자여야 합니다.');
    process.exit(1);
  }
  fs.readdirSync(OUT).filter((f) => /^[a-f0-9]{32}\.txt$/.test(f) && f !== `${site.indexNowKey}.txt`).forEach((f) => fs.unlinkSync(path.join(OUT, f)));
  write(`${site.indexNowKey}.txt`, site.indexNowKey);
}

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
write('admin/scenes.js', `/* 자동 생성 파일입니다. 그림 목록은 tools/images.js에서 고치세요. 상회보 대표 그림 고르기에 씁니다. */\nwindow.SCENES = ${JSON.stringify(Object.fromEntries(Object.entries(SCENES).map(([k, v]) => [k, v.name])))};\n`);
write('admin/md.js', `/* 자동 생성 파일입니다. 고칠 때는 tools/md.js를 고치세요. 관리자 화면의 상회보 미리보기에 씁니다. */\n(function () {\nvar module = { exports: {} };\n${mdSrc}\nwindow.MD = module.exports;\n})();\n`);

console.log(`빌드 완료: 페이지 ${pages.length}개, 상회보 글 ${posts.length}편, 주소 ${site.url}`);
