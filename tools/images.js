// 홈페이지에 쓰는 그림 목록과 <img> 태그 도우미
// 원본(PNG)은 구글 드라이브 '열정상회 이미지' 폴더에 두고, 저장소에는 줄인 WebP와 공유용 JPG만 둡니다.
//   public/assets/img/scenes/scene-<이름>-<폭>.webp   장면 그림(640, 1024, 원본 폭)
//   public/assets/img/og/scene-<이름>.jpg             공유 미리보기(1200×630)
//   public/assets/img/icons/<이름>.webp               아이콘(192px, 투명 배경)
const { esc } = require('./md');

const WIDE = { w: 1536, h: 1024 };
const SQUARE = { w: 1254, h: 1254 };

const SCENES = {
  'shop-front': { name: '상회 앞 대화', ...WIDE, alt: '동네 상회 앞에서 두 사람이 공책을 함께 보며 이야기하는 그림' },
  'street-bench': { name: '상회 앞 벤치', ...WIDE, alt: '상회 앞 벤치에 앉은 사람들과 지나가던 이웃, 가게 주인이 인사를 나누는 그림' },
  'sangdan-hotseat': { name: '상단 핫시트', ...WIDE, alt: '여러 사람이 둥근 탁자에 둘러앉아 한 사람의 이야기를 듣는 상단 모임 그림' },
  'sangdan-online': { name: '온라인 상단', ...WIDE, alt: '노트북 화상 모임 화면에 상단 회원들이 모여 있고 한 사람이 이야기를 듣는 그림' },
  'ledger-hand': { name: '실행 장부', ...WIDE, alt: '펼친 장부에 손으로 약속을 적고 옆에 도장이 놓인 그림' },
  'jangnal-talk': { name: '장날 발표', ...WIDE, alt: '장날에서 한 회원이 앞에 서서 이야기하고 손님들이 앉아 듣는 그림' },
  'jangnal-table': { name: '장날 테이블 대화', ...WIDE, alt: '장날에 여러 테이블로 나눠 앉아 이야기를 나누는 사람들 그림' },
  sarangbang: { name: '사랑방', ...WIDE, alt: '가게 계산대에서 휴대전화로 다른 회원들과 대화를 나누는 그림' },
  pumasi: { name: '품앗이', ...WIDE, alt: '한 사람이 노트북 화면을 보여 주며 다른 사람의 일을 거들어 주는 그림' },
  hakdang: { name: '학당', ...WIDE, alt: '화이트보드 앞에서 한 회원이 설명하고 다른 회원들이 노트북을 펴고 듣는 그림' },
  gyeolsan: { name: '결산의 밤', ...WIDE, alt: '긴 탁자에 모인 회원들이 한 해를 돌아보며 박수를 치는 그림' },
  gaeeop: { name: '개업식', ...WIDE, alt: '가게 문 앞에서 새로 온 사람을 반갑게 맞이하는 그림' },
  giljabi: { name: '길잡이', ...WIDE, alt: '골목길에서 먼저 온 사람이 새로 온 사람에게 길을 알려 주며 함께 걷는 그림' },
  tambang: { name: '가게 탐방', ...WIDE, alt: '공방을 찾아간 사람들이 주인의 설명을 들으며 작업대를 둘러보는 그림' },
  together: { name: '같이 일하는 날', ...WIDE, alt: '큰 탁자에서 여러 사람이 각자 노트북을 펴고 함께 일하는 그림' },
  shimteo: { name: '쉼터 산책', ...WIDE, alt: '강가 산책로를 여러 사람이 함께 걷는 그림' },
  'photo-workshop': { name: '상품 사진 찍기', ...WIDE, alt: '작업실에서 세 사람이 조명과 휴대전화로 상품 사진을 함께 찍는 그림' },
  packing: { name: '함께 포장하기', ...WIDE, alt: '작업실에서 세 사람이 함께 상품을 포장하는 그림' },
  stall: { name: '가판대', ...WIDE, alt: '천막 아래 가판대에서 상품을 사이에 두고 이야기를 나누는 사람들 그림' },
  hanjan: { name: '커피 두 잔', ...SQUARE, alt: '커피 두 잔과 공책, 휴대전화가 놓인 탁자를 위에서 내려다본 그림' },
  interview: { name: '마주 앉은 대화', ...SQUARE, alt: '마이크를 사이에 두고 두 사람이 마주 앉아 이야기하는 그림' },
  'tea-tray': { name: '찻쟁반', ...SQUARE, alt: '찻주전자와 찻잔, 과자, 이름표가 놓인 쟁반 그림' },
  toolbox: { name: '공구함', ...SQUARE, alt: '줄자와 연필, 드라이버가 담긴 열린 공구함 그림' },
  growing: { name: '화분에 물 주기', ...SQUARE, alt: '한 사람이 든 화분에 다른 사람이 물을 주는 그림' },
};

const ICON_ALT = '';

function sceneSizes(key) {
  const s = SCENES[key];
  return [640, 1024, s.w];
}

/**
 * 장면 그림 <img>
 * o.sizes: 화면 폭에 따라 보일 크기(기본: 큰 화면 520px, 작은 화면 전체 폭)
 * o.eager: 첫 화면에 보이는 그림이면 true
 * o.alt: 기본 설명 대신 쓸 설명. 장식용이면 ''
 */
function scene(key, o = {}) {
  const s = SCENES[key];
  if (!s) throw new Error(`없는 그림입니다: ${key}`);
  const src = (w) => `/assets/img/scenes/scene-${key}-${w}.webp`;
  const srcset = sceneSizes(key).map((w) => `${src(w)} ${w}w`).join(', ');
  const alt = o.alt != null ? o.alt : s.alt;
  return `<img class="${o.cls || 'illust'}" src="${src(1024)}" srcset="${srcset}" sizes="${o.sizes || '(min-width: 900px) 520px, 100vw'}" width="${s.w}" height="${s.h}" alt="${esc(alt)}"${o.eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
}

const sceneOg = (key) => `/assets/img/og/scene-${key}.jpg`;
const sceneAlt = (key) => (SCENES[key] ? SCENES[key].alt : '');

function icon(name, size = 48, alt = ICON_ALT) {
  return `<img class="icon" src="/assets/img/icons/${name}.webp" width="${size}" height="${size}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
}

/**
 * 상회보 글 앞머리의 image 값 풀이
 *  - 'hanjan'처럼 그림 이름이면 장면 그림
 *  - '/assets/img/journal/…jpg'처럼 주소면 관리자 화면에서 올린 사진
 */
function postImage(meta) {
  const v = String(meta.image || '').trim();
  if (!v) return null;
  if (SCENES[v]) return { key: v, alt: meta.imageAlt || SCENES[v].alt, og: sceneOg(v), ogSize: [1200, 630] };
  if (/^\/assets\/img\/[\w./-]+\.(jpe?g|png|webp)$/i.test(v)) return { src: v, alt: meta.imageAlt || '', og: /\.webp$/i.test(v) ? null : v, ogSize: null };
  return null;
}

function postImageTag(img, o = {}) {
  if (!img) return '';
  const alt = o.alt != null ? o.alt : img.alt;
  if (img.key) return scene(img.key, { ...o, alt });
  return `<img class="${o.cls || 'illust'}" src="${esc(img.src)}" alt="${esc(alt)}"${o.eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
}

module.exports = { SCENES, scene, sceneOg, sceneAlt, icon, postImage, postImageTag };
