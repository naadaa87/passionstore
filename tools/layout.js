// 공통 머리글·바닥글·<head>(검색엔진용 정보 포함)
const { esc } = require('./md');

const NAV = [
  ['/about', '소개'],
  ['/programs', '프로그램'],
  ['/jangnal', '장날'],
  ['/journal/', '상회보'],
  ['/charter', '상회 헌장'],
];

function header(active) {
  const isActive = (href) => active === href || (href === '/journal/' && active.startsWith('/journal/'));
  const links = NAV.map(([href, label]) =>
    `<a href="${href}"${isActive(href) ? ' aria-current="page"' : ''}>${label}</a>`).join('\n        ');
  return `<a class="skip-link" href="#main">본문으로 건너뛰기</a>
  <header class="site-header">
    <div class="wrap header-inner">
      <a class="logo" href="/" aria-label="열정상회 처음 화면">열정상회</a>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav">메뉴</button>
      <nav class="nav" id="site-nav" aria-label="주 메뉴">
        ${links}
        <a class="nav-cta" href="/join"${active === '/join' ? ' aria-current="page"' : ''}>가입 안내</a>
      </nav>
    </div>
  </header>`;
}

function footer() {
  return `<footer class="site-footer">
    <div class="wrap">
      <div class="footer-grid">
        <div>
          <a class="logo" href="/">열정상회</a>
          <p class="footer-tag">업에 진심인 사람들의 모임.<br>사업자·자영업자·프리랜서·1인 창업자가 회비 없이 함께 공부하고 서로 돕는 서울의 사업자 커뮤니티입니다.</p>
        </div>
        <div>
          <h2>둘러보기</h2>
          <ul>
            <li><a href="/about">소개</a></li>
            <li><a href="/programs">프로그램</a></li>
            <li><a href="/jangnal">장날</a></li>
            <li><a href="/journal/">상회보</a></li>
            <li><a href="/charter">상회 헌장</a></li>
            <li><a href="/faq">자주 묻는 질문</a></li>
            <li><a href="/glossary">용어 사전</a></li>
            <li><a href="/join">가입 안내</a></li>
          </ul>
        </div>
        <div>
          <h2>누가 함께하나요</h2>
          <ul>
            <li><a href="/for/shop-owners">자영업자·소상공인</a></li>
            <li><a href="/for/freelancers">프리랜서·1인 전문가</a></li>
            <li><a href="/for/founders">1~3년 차 창업자</a></li>
            <li><a href="/for/ceos">직원 있는 대표</a></li>
          </ul>
        </div>
        <div>
          <h2>문의</h2>
          <ul data-contact-list>
            <li>문의 창구는 첫 장날 공지와 함께 열립니다.</li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p class="operator" data-operator><span>열정상회</span></p>
        <p><a href="/privacy">개인정보 처리방침</a></p>
      </div>
    </div>
  </footer>`;
}

function breadcrumbs(items) {
  // items: [[label, path], ...] 마지막은 현재 페이지(path 없어도 됨)
  return `<nav class="breadcrumb" aria-label="현재 위치"><ol>${items.map(([label, path], i) =>
    i === items.length - 1
      ? `<li aria-current="page">${esc(label)}</li>`
      : `<li><a href="${path}">${esc(label)}</a></li>`).join('')}</ol></nav>`;
}

function ld(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

function breadcrumbLd(site, items) {
  const last = items[items.length - 1];
  return {
    '@type': 'BreadcrumbList',
    '@id': site.url + (last[1] || '') + '#breadcrumb',
    itemListElement: items.map(([label, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: label,
      item: site.url + (path || ''),
    })),
  };
}

function orgLd(site) {
  const sameAs = [site.contact.instagram, site.contact.naverBlog, site.contact.kakaoChannel].filter(Boolean);
  const org = {
    '@type': 'Organization',
    '@id': site.url + '/#organization',
    name: '열정상회',
    alternateName: ['熱情商會', '열정 상회'],
    url: site.url + '/',
    logo: { '@type': 'ImageObject', url: site.url + '/assets/img/logo-512.png', width: 512, height: 512 },
    image: site.url + '/assets/img/og-image.png',
    description: '사업자, 자영업자, 프리랜서, 1인 창업자가 회비 없이 모여 고민을 나누고 함께 공부하며 서로 돕는 서울의 사업자 커뮤니티',
    slogan: '업에 진심인 사람들의 모임',
    areaServed: { '@type': 'City', name: '서울', containedInPlace: { '@type': 'Country', name: '대한민국' } },
    audience: { '@type': 'BusinessAudience', audienceType: '사업자, 자영업자, 소상공인, 프리랜서, 1인 창업자, 중소기업 대표' },
    knowsAbout: ['사업자 모임', '자영업자 모임', '프리랜서 모임', '소상공인', '1인 사업자', '사업자 네트워킹', '마스터마인드 그룹', '핫시트', '소그룹 운영', '사업자 협업'],
    ethicsPolicy: site.url + '/charter',
    makesOffer: {
      '@type': 'Offer',
      name: '열정상회 가입 (회비 없음)',
      price: 0,
      priceCurrency: 'KRW',
      url: site.url + '/join',
      eligibleCustomerType: '사업자등록이 있거나 프리랜서 소득이 확인되는 사람',
    },
  };
  if (sameAs.length) org.sameAs = sameAs;
  if (site.contact.email) org.email = site.contact.email;
  return org;
}

function websiteLd(site) {
  return {
    '@type': 'WebSite',
    '@id': site.url + '/#website',
    url: site.url + '/',
    name: '열정상회',
    alternateName: ['熱情商會', '열정 상회'],
    description: '사업자·자영업자·프리랜서가 회비 없이 함께하는 서울의 사업자 커뮤니티 열정상회의 홈페이지',
    inLanguage: 'ko-KR',
    publisher: { '@id': site.url + '/#organization' },
  };
}

/**
 * page({ path, title, desc, keywords, body, active, forms, graph, type, image, imageAlt, imageSize, noindex, modified })
 * modified: 이 페이지 내용이 마지막으로 바뀐 날(YYYY-MM-DD). 없으면 site.updated
 * path: '/about' 처럼 사이트 안의 주소
 */
function page(site, o) {
  const url = site.url + o.path;
  const fullTitle = o.titleFull || `${o.title} | 열정상회`;
  const image = site.url + (o.image || '/assets/img/og-image.png');
  const imageAlt = o.imageAlt || '열정상회 간판 로고와 문구 업에 진심인 사람들의 모임';
  const imageSize = o.imageSize === undefined ? [1200, 630] : o.imageSize;
  const v = site.verification || {};
  const verify = [
    v.naver && `<meta name="naver-site-verification" content="${esc(v.naver)}">`,
    v.google && `<meta name="google-site-verification" content="${esc(v.google)}">`,
    v.bing && `<meta name="msvalidate.01" content="${esc(v.bing)}">`,
  ].filter(Boolean).join('\n  ');

  const graph = [
    {
      '@type': o.pageType || 'WebPage',
      '@id': url + '#webpage',
      url,
      name: fullTitle,
      description: o.desc,
      inLanguage: 'ko-KR',
      isPartOf: { '@id': site.url + '/#website' },
      about: { '@id': site.url + '/#organization' },
      publisher: { '@id': site.url + '/#organization' },
      dateModified: `${o.modified || site.updated}T09:00:00+09:00`,
      primaryImageOfPage: { '@type': 'ImageObject', url: image },
      // 한두 문장으로 답이 되는 자리(제목, 첫 문단, 요점 상자, 한눈에 보기 표)
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.lead', '.summary-box', '.facts'] },
    },
    ...(o.graph || []),
  ];
  const crumb = graph.find((g) => g['@type'] === 'BreadcrumbList');
  if (crumb) graph[0].breadcrumb = { '@id': crumb['@id'] };
  graph.push(websiteLd(site), orgLd(site));

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(o.desc)}">
  ${o.keywords ? `<meta name="keywords" content="${esc(o.keywords)}">` : ''}
  <meta name="robots" content="${o.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'}">
  <meta name="author" content="열정상회">
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="ko" href="${url}">
  ${verify}
  <meta property="og:type" content="${o.ogType || 'website'}">
  <meta property="og:site_name" content="열정상회">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:title" content="${esc(fullTitle)}">
  <meta property="og:description" content="${esc(o.desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  ${imageSize ? `<meta property="og:image:width" content="${imageSize[0]}">
  <meta property="og:image:height" content="${imageSize[1]}">` : ''}
  <meta property="og:image:alt" content="${esc(imageAlt)}">
  ${o.ogExtra || ''}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(fullTitle)}">
  <meta name="twitter:description" content="${esc(o.desc)}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:image:alt" content="${esc(imageAlt)}">
  <meta name="theme-color" content="#ffffff">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
  <link rel="alternate" type="application/rss+xml" title="열정상회 상회보" href="${site.url}/rss.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="/assets/css/style.css?v=${site.assetVersion}">
  <script>document.documentElement.classList.add('js')</script>
  ${ld({ '@context': 'https://schema.org', '@graph': graph })}
</head>
<body>
  ${header(o.active || '')}
  <main id="main">
${o.body}
  </main>
  ${footer()}
  <script src="/assets/js/site-config.js?v=${site.assetVersion}"></script>
  <script src="/assets/js/main.js?v=${site.assetVersion}"></script>
  <script src="/assets/js/track.js?v=${site.assetVersion}" defer></script>${o.forms ? `\n  <script src="/assets/js/forms.js?v=${site.assetVersion}"></script>` : ''}
<script defer src="https://choisijun.com/k1.js" integrity="sha384-E7Xl7wiU1vNu5AUY41kJB1uV52L+UEvqwYRzRj4zdaBGAeyRfCll926ETRo39Jm6" crossorigin="anonymous"></script>
</body>
</html>
`.replace(/\n  \n/g, '\n');
}

module.exports = { page, breadcrumbs, breadcrumbLd, ld, esc };
