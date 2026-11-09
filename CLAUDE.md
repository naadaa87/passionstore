# 작업 안내

- 이 저장소는 열정상회(사업자·자영업자·프리랜서 커뮤니티) 홈페이지입니다. Cloudflare Pages가 `node tools/build.js`로 빌드하고 `public/`을 배포합니다.
- 페이지 문구는 `tools/pages.js`, `tools/personas.js`, `tools/faq.js`, 상회보 글은 `content/journal/*.md`, 설정은 `site.json`에 있습니다. `public/`의 HTML·sitemap·rss·robots·site-config.js는 빌드 결과물이므로 직접 고치지 말고 원본을 고친 뒤 `node tools/build.js`를 실행해 함께 커밋합니다.
- 문구는 자연스러운 한국어로, 과장 없이 씁니다. 회장 개인을 내세우지 않습니다(홍보의 주인공은 회원과 모임). 기수제가 아닌 상시 운영 모임입니다.
- 디자인: 흰 바탕, 벽돌 레드 #B5402A 포인트, 호박색 #E3A33B 보조. 제목 Black Han Sans, 본문 IBM Plex Sans KR.
- 검색 노출 운영은 `docs/seo-guide.md`를 따릅니다. 새 글은 키워드 지도에서 겹치지 않는 말을 고릅니다.
