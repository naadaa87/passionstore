# 열정상회 홈페이지

업에 진심인 사람들의 모임, 열정상회(熱情商會)의 공식 홈페이지입니다.
사업자·자영업자·프리랜서·1인 창업자 커뮤니티를 소개하고, 장날 참가와 상회원 가입 신청을 받습니다.

- 정적 사이트 + Cloudflare Pages Functions(신청서 접수, 관리자 화면)
- 외부 패키지 없이 `node tools/build.js` 하나로 빌드합니다.
- 관리자 화면은 `/admin`입니다. 설정과 사용법은 [docs/admin-guide.md](docs/admin-guide.md)에 있습니다.

## Cloudflare Pages 설정

| 항목 | 값 |
| --- | --- |
| Framework preset | None |
| Build command | `node tools/build.js` |
| Build output directory | `public` |

GitHub에 커밋하면 자동으로 빌드·배포됩니다. 빌드에 실패하면(예: `site.json` 문법 오류) 이전 배포가 그대로 유지되니, Cloudflare의 Deployments 화면에서 오류 메시지를 확인하세요.

## 관리자 화면 (/admin)

회장과 운영진이 각자 계정으로 들어와 아래 일을 합니다.

- 가입 신청 처리(연락 → 면담 → 승인 → 회원 명부 등록), 장날 신청 확인
- 회원 명부, 상단 배정, 상단장 지정, 상단 모임 기록(진행자·출석)
- 장날 일정, 상회보 글, 사이트 정보 고치기(저장하면 GitHub에 기록되고 홈페이지가 다시 만들어짐)
- 관리자 계정과 권한, 활동 기록, 보관 기간이 지난 개인정보 정리(회장 전용)

처음 한 번 Cloudflare에서 D1 데이터베이스(`DB`), `ADMIN_SETUP_KEY`, `GITHUB_TOKEN`을 연결해야 합니다. 순서는 [docs/admin-guide.md](docs/admin-guide.md)의 "처음 한 번만 하는 설정"을 따르세요.

## 자주 고치는 것

관리자 화면을 연결했다면 아래 내용은 모두 `/admin`에서 고칠 수 있습니다. 관리자 화면 없이 GitHub에서 직접 고치는 방법은 다음과 같습니다.

### 장날 일정·회비·운영진·연락처 → `site.json`

GitHub에서 `site.json`을 열고 연필 아이콘으로 고친 뒤 Commit changes를 누르면 됩니다.

```json
"jangnal": [
  { "date": "2026-12-10", "time": "19:30", "place": "서울 마포구 ○○ 공간", "topic": "올해 장부 덮기", "status": "open" }
],
"team": [
  { "role": "회장", "name": "" },
  { "role": "부회장", "name": "" }
]
```

- `status`: `open`(신청 받는 중) · `full`(마감) · `soon`(신청 준비 중)
- 지난 날짜는 화면에서 자동으로 빠집니다.
- 큰따옴표와 쉼표를 지우지 않도록 조심하세요. 마지막 항목 뒤에는 쉼표를 붙이지 않습니다.

### 검색엔진 소유확인 코드 → `site.json`의 `verification`

네이버·구글·빙은 HTML 태그의 `content` 값만, 다음은 robots.txt 한 줄 전체를 넣습니다. 자세한 순서는 [docs/seo-guide.md](docs/seo-guide.md)에 있습니다.

### 정식 도메인 → `site.json`의 `url`

도메인을 연결하면 `"url": "https://새도메인"`으로 바꿉니다. 대표 주소, 사이트맵, RSS, 공유 이미지 주소가 모두 따라 바뀝니다.

### 상회보 글 → `content/journal/*.md`

GitHub에서 `content/journal` 폴더에 새 `.md` 파일을 만들면 글이 올라갑니다. 형식은 [docs/seo-guide.md](docs/seo-guide.md)의 "글 올리는 법"을 보세요.

## 폴더 구조

```
site.json                    ← 사이트 설정 (주소, 검증 코드, 연락처, 회비, 장날, 운영진)
content/journal/             ← 상회보 글 (마크다운)
tools/                       ← 빌드 스크립트와 페이지 문구
  build.js                   ← 빌드 진입점
  pages.js                   ← 고정 페이지 문구 (홈, 소개, 프로그램, 장날, 가입, 헌장, FAQ …)
  personas.js                ← 대상별 페이지 문구 (/for/…)
  faq.js                     ← 자주 묻는 질문
  layout.js                  ← 공통 머리글·바닥글·검색엔진 태그
  md.js                      ← 상회보 마크다운 변환 (관리자 미리보기에도 씀)
admin/                       ← 관리자 화면 원본 (빌드 때 public/admin/으로 복사)
server/                      ← 관리자 API 공통 코드 (D1, 로그인, GitHub 저장)
public/                      ← 배포되는 파일 (빌드 결과 + 이미지·CSS·JS)
functions/api/apply.js       ← 신청서 접수 (POST /api/apply)
functions/api/admin/         ← 관리자 API (/api/admin/*)
docs/admin-guide.md          ← 관리자 화면 설정과 사용법
docs/seo-guide.md            ← 검색 노출 운영 가이드
docs/google-sheet-apps-script.gs ← 신청서를 구글 시트에 쌓는 스크립트
```

`public/`의 HTML, `sitemap.xml`, `rss.xml`, `robots.txt`, `assets/js/site-config.js`, `admin/`은 빌드가 만드는 파일입니다. 직접 고치지 말고 원본(`site.json`, `content/`, `tools/`)을 고치세요.

## 페이지

| 주소 | 내용 |
| --- | --- |
| `/` | 홈 |
| `/about` | 소개 — 만든 이유, 이름의 뜻, 미션과 가치, 운영 방식, 회비 원칙, 상회 용어 |
| `/programs` | 프로그램 — 전체 프로그램, 상단 자세히, 1년의 흐름 |
| `/jangnal` | 장날 — 일정, 진행 순서, 손님 안내, 참가 신청서 |
| `/join` | 가입 안내 — 자격, 회비, 절차, 가입 신청서 |
| `/charter` | 상회 헌장 7조, 이해상충 규칙 |
| `/faq` | 자주 묻는 질문 |
| `/for/shop-owners` | 자영업자·소상공인 |
| `/for/freelancers` | 프리랜서·1인 전문가 |
| `/for/founders` | 1~3년 차 창업자 |
| `/for/ceos` | 직원 있는 대표 |
| `/journal/` | 상회보 글 목록과 각 글 |
| `/privacy` | 개인정보 처리방침 |

## 검색엔진 대응

- 페이지마다 다른 제목·설명·키워드, 대표 주소(canonical), Open Graph·트위터 카드
- 구조화 데이터(JSON-LD): Organization, WebSite, BreadcrumbList, FAQPage, BlogPosting, Event(장날 일정이 있을 때)
- `sitemap.xml`(수정일 포함), `rss.xml`(상회보 전문), `robots.txt`
- 네이버·구글·빙·다음 소유확인 코드를 `site.json`에서 관리

## 신청서 접수

D1 데이터베이스를 `DB`로 연결하면 신청서가 관리자 화면에 바로 쌓입니다. 구글 시트나 KV를 함께 연결하면 그곳에도 같이 저장됩니다. 아무것도 연결하지 않으면 신청서를 보낼 때 신청 내용을 복사하는 안내가 나옵니다.

### 구글 시트로도 받기 (선택)

1. 구글 스프레드시트 → 확장 프로그램 → Apps Script에 `docs/google-sheet-apps-script.gs`를 붙여 넣고 `SECRET` 값을 바꿉니다.
2. 배포 → 새 배포 → 웹 앱(실행: 나, 액세스: 모든 사용자) → 웹 앱 URL을 복사합니다.
3. Cloudflare → Settings → Variables and Secrets에 `APPLY_WEBHOOK_URL`(웹 앱 URL), `APPLY_WEBHOOK_SECRET`(SECRET 값)을 넣고 다시 배포합니다.

Cloudflare KV를 쓰려면 Bindings에 `APPLICATIONS`라는 이름으로 KV 네임스페이스를 연결하세요.

## 공개 전 확인

- [ ] Cloudflare 빌드 명령 `node tools/build.js`, 출력 폴더 `public`
- [ ] 회비 확정 후 `site.json`의 `fees` 채우기
- [ ] 문의 창구(이메일·카카오톡 채널)와 운영 주체 정보 채우기
- [ ] D1·`ADMIN_SETUP_KEY`·`GITHUB_TOKEN` 연결 후 `/admin`에서 첫 회장 계정 만들기
- [ ] 실제로 가입·장날 신청을 한 번씩 보내 관리자 화면에 들어오는지 확인
- [ ] 네이버 서치어드바이저·구글 서치 콘솔 등록, 사이트맵·RSS 제출
- [ ] "열정상회" 상표 검색(KIPRIS 41류·35류)
