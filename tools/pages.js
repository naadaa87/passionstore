// 고정 페이지 본문
const { esc } = require('./md');
const { breadcrumbs, breadcrumbLd } = require('./layout');
const { applyForm, jangnalForm } = require('./forms');

const fmtDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
};

function postList(posts, headingLevel = 3) {
  return `<ul class="post-list">${posts.map((p) => `
          <li>
            <p class="post-meta"><span>${esc(p.category)}</span><time datetime="${p.date}">${fmtDate(p.date)}</time></p>
            <h${headingLevel} class="post-title"><a href="${p.path}">${esc(p.title)}</a></h${headingLevel}>
            <p class="post-summary">${esc(p.description)}</p>
          </li>`).join('')}
        </ul>`;
}

function faqDetails(items) {
  return `<div class="faq">${items.map(([q, a]) => `
          <details><summary>${esc(q)}</summary><p>${a}</p></details>`).join('')}
        </div>`;
}

function faqLd(items) {
  const strip = (s) => s.replace(/<[^>]+>/g, '');
  return {
    '@type': 'FAQPage',
    mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: strip(a) } })),
  };
}

/* ---------------- 홈 ---------------- */
function home(site, ctx) {
  const latest = ctx.posts.slice(0, 3);
  const faqPick = [ctx.faq[0].items[1], ctx.faq[1].items[0], ctx.faq[2].items[1], ctx.faq[4].items[0]];
  return {
    path: '/',
    file: 'index.html',
    titleFull: '열정상회 | 사업자·자영업자·프리랜서 모임, 업에 진심인 사람들의 커뮤니티',
    desc: '사업자, 자영업자, 프리랜서, 1인 창업자가 모여 고민을 나누고 함께 공부하는 서울의 사업자 커뮤니티 열정상회. 6~8명 소그룹 상단과 매달 열리는 공개 모임 장날로 운영합니다.',
    keywords: '열정상회, 사업자 모임, 자영업자 모임, 프리랜서 모임, 사업자 커뮤니티, 창업자 모임, 소상공인 모임, 서울 사업자 모임',
    active: '/',
    body: `
    <section class="hero">
      <div class="wrap">
        <div class="sign" role="img" aria-label="열정상회 간판">
          <span class="sign-board"><span class="sign-text" aria-hidden="true"><span>열</span><span>정</span><span>상</span><span>회</span></span></span>
          <span class="sign-hanja" aria-hidden="true">熱情商會</span>
        </div>
        <h1 class="hero-title"><span class="hero-tagline">업에 진심인 사람들의 모임</span><span class="hero-sub">사업자·자영업자·프리랜서 커뮤니티, 열정상회</span></h1>
        <p class="hero-desc">사업자, 자영업자, 프리랜서, 1인 창업자가 모여 서로의 고민을 듣고, 같이 공부하고, 해 보기로 한 일을 끝까지 챙깁니다.</p>
        <div class="actions center">
          <a class="btn btn-primary" href="/jangnal">장날 일정 보기</a>
          <a class="btn btn-ghost" href="/join">가입 안내</a>
        </div>
      </div>
    </section>

    <section class="notice" aria-labelledby="notice-title">
      <div class="wrap notice-inner">
        <h2 class="notice-label" id="notice-title">다음 장날</h2>
        <p class="notice-body" data-jangnal-next>첫 장날 날짜를 정하고 있습니다. 알림을 신청하면 일정이 나오는 대로 알려 드립니다.</p>
        <a class="text-link" href="/jangnal#apply" data-jangnal-next-link>알림 신청</a>
      </div>
    </section>

    <section class="section">
      <div class="wrap split">
        <div>
          <h2>이런 고민, 혼자 붙잡고 있지 않나요</h2>
          <p>사업을 시작하면 가장 먼저 사라지는 것이 물어볼 사람입니다. 가격을 정하는 일부터 사람을 뽑는 일까지, 대부분을 혼자 판단하게 됩니다.</p>
          <p class="fact">고용원 없이 혼자 일하는 자영업자는 430만 명이 넘습니다. 최근 1년 안에 창업한 자영업자는 처음에 가장 힘들었던 점으로 자금보다 사업 정보와 경영 노하우(28.4%)를 먼저 꼽았습니다.<span class="src">통계청 비임금근로 부가조사, 2026년 8월</span></p>
          <a class="text-link" href="/journal/alone-in-business">혼자 일하는 사장님에 관한 글 읽기</a>
        </div>
        <ul class="ledger-list">
          <li>가격을 올려야 할지, 이대로 버텨야 할지 혼자 정하고 있다</li>
          <li>직원을 뽑을지 외주를 쓸지 물어볼 사람이 없다</li>
          <li>홍보를 해야 하는 건 아는데 무엇부터 할지 모르겠다</li>
          <li>지원사업과 정책자금은 늘 마감이 지나서야 알게 된다</li>
          <li>사업 이야기를 솔직하게 꺼낼 곳이 없다</li>
          <li>모임에 나가면 명함과 영업부터 받는다</li>
          <li>쉬는 날에도 머리가 일을 놓지 못한다</li>
        </ul>
      </div>
      <div class="wrap"><p class="closing">열정상회는 이런 이야기를 꺼내 놓고, 먼저 겪어 본 사람의 경험으로 함께 푸는 곳입니다.</p></div>
    </section>

    <section class="section alt" id="who">
      <div class="wrap">
        <h2>이런 분들이 함께합니다</h2>
        <p class="lead">업종과 규모는 달라도 자기 업을 책임진다는 점은 같습니다. 서로 다른 일을 하는 사람이 한 상단에 모이기 때문에 경쟁 걱정 없이 숫자와 속사정을 꺼낼 수 있습니다.</p>
        <ul class="who-list">${ctx.personas.map((p) => `
          <li><a href="/for/${p.slug}"><strong>${esc(p.card)}</strong><span>${esc(p.cardLine)}</span></a></li>`).join('')}
        </ul>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <h2>열정상회는 이렇게 돌아갑니다</h2>
        <p class="lead">입구는 가볍게, 안쪽은 깊게 만들었습니다. 기수 없이 연중 언제든 들어올 수 있고, 들어오면 바로 기존 회원과 섞입니다.</p>
        <ol class="path">
          <li><span class="path-no">처음</span><h3>장날</h3><p class="path-meta">한 달에 한 번 열리는 90분 공개 모임</p><p>누구나 손님으로 올 수 있습니다. 회원 두 명의 6분 발표와 테이블 대화로 열정상회의 분위기를 먼저 겪어 봅니다.</p></li>
          <li><span class="path-no">함께</span><h3>상단</h3><p class="path-meta">6~8명이 격주로 만나는 작은 모임</p><p>열정상회의 중심입니다. 서로의 고민을 깊게 다루고, 해 보기로 한 일을 장부에 적습니다.</p></li>
          <li><span class="path-no">매일</span><h3>사랑방</h3><p class="path-meta">사업자 확인을 거친 온라인 공간</p><p>모임이 없는 날에도 질문을 올리고, 품앗이판에서 도움을 주고받습니다.</p></li>
          <li><span class="path-no">오래</span><h3>단골</h3><p class="path-meta">1년 넘게 함께한 상회원</p><p>길잡이가 되어 새로 들어온 회원의 첫 3개월을 챙깁니다.</p></li>
        </ol>
      </div>
    </section>

    <section class="section alt">
      <div class="wrap split">
        <div>
          <h2>상단에서는 이렇게 이야기합니다</h2>
          <p>상단(商團)은 6~8명이 격주로 만나는 작은 모임입니다. 같은 상권의 같은 업종은 한 상단에 넣지 않고, 비슷한 단계의 사람과 한 걸음 앞선 사람을 함께 묶습니다.</p>
          <p>한 번 모일 때 두 사람이 자기 고민을 깊게 꺼냅니다. 이것을 핫시트라고 부릅니다. 질문을 먼저 충분히 하고, 조언 대신 “나는 이렇게 해 봤고 결과는 이랬다”로 경험을 나눕니다.</p>
          <a class="text-link" href="/journal/hot-seat">핫시트 진행법 읽기</a>
        </div>
        <ol class="timeline" aria-label="대면 상단 120분 진행 순서">
          <li><time>0:00</time><strong>체크인</strong><span>지난 모임에서 한 약속의 결과를 한 사람씩 짧게 말합니다.</span></li>
          <li><time>0:15</time><strong>첫 번째 핫시트</strong><span>상황 설명 10분, 질문 10분, 경험 나누기 15분, 정리 5분.</span></li>
          <li><time>1:00</time><strong>두 번째 핫시트</strong><span>같은 순서로 한 사람 더 이야기합니다.</span></li>
          <li><time>1:40</time><strong>약속 라운드</strong><span>다음 모임까지 할 일 하나를, 확인할 수 있게 정합니다.</span></li>
          <li><time>1:55</time><strong>장부 기록</strong><span>상단장이 실행 장부에 적고 다음 핫시트 순서를 정합니다.</span></li>
        </ol>
      </div>
    </section>

    <section class="section" id="ledger">
      <div class="wrap">
        <h2>말로 끝나지 않게, 실행 장부</h2>
        <p class="lead">상단에서 한 약속은 장부에 적고 다음 모임에서 결과를 말합니다. 못 한 약속도 그대로 적습니다. 1년이 지나면 이 장부가 그 사람의 한 해 기록이 됩니다.</p>
        <figure class="ledger">
          <figcaption>장부 예시: 동네 카페를 운영하는 상회원의 석 달</figcaption>
          <table>
            <thead><tr><th scope="col">모임</th><th scope="col">약속</th><th scope="col">결과</th><th scope="col">메모</th></tr></thead>
            <tbody>
              <tr><td>9월 둘째 주</td><td>세트 메뉴 가격을 2,000원 올려 2주 동안 팔아 본다</td><td><span class="stamp done">했다</span></td><td>주문 수는 거의 그대로</td></tr>
              <tr><td>9월 넷째 주</td><td>원두 거래처 두 곳에 결제 조건 조정을 요청한다</td><td><span class="stamp changed">바뀌었다</span></td><td>한 곳은 다음 달로 미룸</td></tr>
              <tr><td>10월 둘째 주</td><td>배달앱 메뉴 사진을 다시 찍는다</td><td><span class="stamp missed">못 했다</span></td><td>다음 모임까지 다시 약속</td></tr>
            </tbody>
          </table>
        </figure>
        <a class="text-link" href="/journal/action-ledger">실행 장부 쓰는 법 읽기</a>
      </div>
    </section>

    <section class="section alt">
      <div class="wrap">
        <h2>다른 사업자 모임과 다른 점</h2>
        <dl class="promises">
          <div><dt>먼저 팔지 않습니다</dt><dd>도움을 요청받았을 때만 제안합니다. 회장과 운영진도 예외가 아닙니다.</dd><dd class="ref">헌장 3조</dd></div>
          <div><dt>솔직하게 말할 수 있습니다</dt><dd>사업자 확인을 거친 사람끼리 만나고, 상단에서 들은 이야기는 밖으로 가져가지 않습니다. 녹음과 캡처도 하지 않습니다.</dd><dd class="ref">헌장 1조, 2조</dd></div>
          <div><dt>나와 맞는 사람과 만납니다</dt><dd>경쟁 관계는 다른 상단으로 나누고, 비슷한 단계의 사람과 한 걸음 앞선 사람을 섞습니다.</dd><dd class="ref">상단 배정 원칙</dd></div>
          <div><dt>말로 끝나지 않습니다</dt><dd>약속은 장부에 적고 다음 모임에서 결과를 말합니다. 지키지 못한 약속도 말합니다.</dd><dd class="ref">헌장 6조</dd></div>
          <div><dt>한 사람의 이름으로 돌아가지 않습니다</dt><dd>프로그램마다 맡은 운영진이 있고, 장날 진행과 발표는 회원이 돌아가며 맡습니다. 회비 결산은 분기마다 공개합니다.</dd><dd class="ref">운영 원칙</dd></div>
        </dl>
        <a class="text-link" href="/journal/choosing-business-group">사업자 모임 고르는 기준 읽기</a>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <h2>함께하는 다섯 가지 방법</h2>
        <div class="axes">
          <div><h3>만나기</h3><p class="axis-line">명함보다 대화가 먼저인 만남</p><p class="axis-items">장날, 한잔 매칭, 가게 탐방, 같이 일하는 날</p></div>
          <div><h3>돕기</h3><p class="axis-line">막힌 일을 같이 푸는 자리</p><p class="axis-items">상단, 사랑방, 품앗이판, 상담소</p></div>
          <div><h3>배우기</h3><p class="axis-line">회원이 회원에게 배우는 4주</p><p class="axis-items">학당, 상회보</p></div>
          <div><h3>도전하기</h3><p class="axis-line">공개하고 30일 동안 해 보기</p><p class="axis-items">도전장, 결산의 밤</p></div>
          <div><h3>쉬어 가기</h3><p class="axis-line">일을 내려놓는 시간도 필요하니까</p><p class="axis-items">쉼터 모임</p></div>
        </div>
        <a class="text-link" href="/programs">프로그램 전체 보기</a>
      </div>
    </section>

    <section class="section alt">
      <div class="wrap"><div class="story-inner">
        <h2>주인이 바뀌어도 간판은 그대로</h2>
        <p>동네마다 오래된 상회가 하나씩 있었습니다. 주인이 바뀌어도 간판은 그대로였고, 동네 사람들은 그 앞에서 소식을 나누고 서로의 안부를 물었습니다.</p>
        <p>열정상회도 그런 곳이 되려고 합니다. 회장이 중심을 잡고 운영진이 일을 나눠 맡지만, 모임의 얼굴은 회원입니다. 장날 무대에는 회원이 서고, 돈과 규칙은 모두에게 공개합니다.</p>
        <div class="roles-mini">
          <div><h3>회장</h3><p>모임의 방향을 잡고 밖에서 열정상회를 대표합니다.</p></div>
          <div><h3>운영진</h3><p>공개 모집으로 뽑혀 상단, 프로그램, 가입, 홍보, 회계를 나눠 맡습니다.</p></div>
          <div><h3>회원</h3><p>장날 진행과 발표, 상단장, 학당장, 길잡이를 돌아가며 맡습니다.</p></div>
        </div>
        <a class="text-link" href="/about#operation">운영 방식 보기</a>
      </div></div>
    </section>

    <section class="section">
      <div class="wrap">
        <h2>상회보</h2>
        <p class="lead">혼자 일하는 법, 가격 정하기, 소그룹 진행처럼 업을 하는 사람에게 필요한 이야기를 씁니다.</p>
        ${postList(latest)}
        <a class="text-link" href="/journal/">상회보 전체 보기</a>
      </div>
    </section>

    <section class="section alt">
      <div class="wrap">
        <h2>자주 묻는 질문</h2>
        ${faqDetails(faqPick)}
        <a class="text-link" href="/faq">질문 전체 보기</a>
      </div>
    </section>

    <section class="cta">
      <div class="wrap">
        <h2>처음이라면 장날에 손님으로 오세요</h2>
        <p>장날은 누구나 참여할 수 있는 한 달에 한 번의 공개 모임입니다. 분위기를 겪어 보고, 맞다고 느끼면 그때 가입하셔도 됩니다.</p>
        <div class="actions">
          <a class="btn btn-light" href="/jangnal#apply">장날 신청하기</a>
          <a class="btn btn-outline-light" href="/join">가입 안내 보기</a>
        </div>
      </div>
    </section>
`,
  };
}

/* ---------------- 하위 페이지 머리 ---------------- */
function head(h1, lead, crumbs, nav) {
  return `
    <section class="page-head">
      <div class="wrap">
        ${breadcrumbs(crumbs)}
        <h1>${h1}</h1>
        <p class="lead">${lead}</p>${nav ? `
        <nav class="page-nav" aria-label="이 페이지 안에서">${nav.map(([id, t]) => `<a href="#${id}">${t}</a>`).join('')}</nav>` : ''}
      </div>
    </section>`;
}

/* ---------------- 소개 ---------------- */
function about(site) {
  const crumbs = [['홈', '/'], ['소개', '/about']];
  return {
    path: '/about',
    file: 'about.html',
    title: '열정상회 소개 — 이름의 뜻, 미션과 가치, 운영 방식',
    desc: '열정상회(熱情商會)는 자기 업에 열정을 가진 사업자·자영업자·프리랜서의 모임입니다. 이름에 담은 뜻, 미션과 가치, 회장과 운영진의 운영 방식, 회비를 쓰고 공개하는 원칙을 소개합니다.',
    keywords: '열정상회 소개, 사업자 커뮤니티, 사업자 모임 운영, 열정상회 운영진, 熱情商會',
    active: '/about',
    pageType: 'AboutPage',
    graph: [breadcrumbLd(site, crumbs)],
    body: `${head('열정상회를 소개합니다', '자기 업을 책임지는 사람들이 모여 서로 돕고, 같이 공부하고, 함께 도전하는 사업자 커뮤니티입니다.', crumbs,
      [['why', '만든 이유'], ['name', '이름의 뜻'], ['mission', '미션과 가치'], ['operation', '운영 방식'], ['money', '회비 쓰는 법'], ['words', '상회 용어']])}

    <section class="section" id="why">
      <div class="wrap split">
        <div>
          <h2>열정상회를 만든 이유</h2>
          <p>사업을 하는 사람은 많아졌는데, 사업 이야기를 솔직하게 나눌 곳은 오히려 줄었습니다. 모임에 나가면 명함과 영업이 먼저 오고, 큰 행사에서는 내 가게 매출이나 직원 문제를 꺼내기 어렵습니다.</p>
          <p>열정상회는 그 빈자리를 채우려고 만든 모임입니다. 사업자 확인을 거친 사람끼리, 경쟁 관계가 아닌 사람끼리, 6~8명이 꾸준히 만나 한 사람의 고민을 깊게 다룹니다. 해외 경영자 모임들이 오래 써 온 소그룹 방식을 국내 사장님과 프리랜서의 사정에 맞게 바꿨습니다.</p>
          <a class="text-link" href="/journal/mastermind-group">소그룹 방식에 관한 글 읽기</a>
        </div>
        <ul class="ledger-list">
          <li>고용원 없이 혼자 일하는 자영업자 430만 명 이상 (2026년 8월)</li>
          <li>2024년 한 해 폐업 신고 사업자 100만 명 돌파</li>
          <li>최근 1년 안에 창업한 자영업자가 처음에 가장 힘들었던 점: 사업 정보와 경영 노하우</li>
          <li>사업을 하며 고립감을 느끼는 소규모 사업체 대표, 영국 조사에서 절반 가까이</li>
        </ul>
      </div>
      <div class="wrap"><p class="note">출처: 통계청 비임금근로 부가조사(파이낸셜뉴스 2026.11.04 보도), 국세청 통계(세계일보 2025.07.06 보도), Start Up Loans·YouGov 조사(2025.12)</p></div>
    </section>

    <section class="section alt" id="name">
      <div class="wrap">
        <h2>이름에 담은 뜻</h2>
        <p class="measure">상회(商會)는 글자 그대로 장사하는 사람들의 모임입니다. 한국에서는 “○○상회”라는 동네 가게 간판으로 오래 쓰였습니다. 열정상회는 자기 업에 열정을 가진 사람들이 동네 가게처럼 편하게 드나드는 곳이라는 뜻입니다.</p>
        <div class="hanja">
          <div><div class="char" lang="zh-Hant">熱</div><p class="read">열 · 뜨겁다</p><p>자기 일에 진심인 태도</p></div>
          <div><div class="char" lang="zh-Hant">情</div><p class="read">정 · 마음, 정</p><p>서로의 장사를 내 일처럼 챙기는 관계</p></div>
          <div><div class="char" lang="zh-Hant">商</div><p class="read">상 · 장사</p><p>사업자도, 프리랜서도, 전문가도 모두 자기 업을 파는 사람</p></div>
          <div><div class="char" lang="zh-Hant">會</div><p class="read">회 · 모임</p><p>한 사람의 것이 아니라 함께 굴리는 모임</p></div>
        </div>
      </div>
    </section>

    <section class="section" id="mission">
      <div class="wrap">
        <h2>미션과 가치</h2>
        <div class="statement"><h3>미션</h3><p>업에 진심인 사람들이 혼자 결정하고 혼자 버티지 않도록, 서로의 동료가 되어 주는 상회를 만듭니다.</p></div>
        <div class="statement"><h3>비전</h3><p>어느 동네에서 장사를 하든, 가까운 곳에 열정상회가 있는 것.</p></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th scope="col">가치</th><th scope="col">뜻</th><th scope="col">지키는 방법</th></tr></thead>
            <tbody>
              <tr><th scope="row">솔직</th><td>확인된 사람끼리, 밖으로 나가지 않는 이야기</td><td>사업자 확인, 비밀유지 서약, 녹음·캡처 금지</td></tr>
              <tr><th scope="row">실행</th><td>듣고 끝내지 않고, 약속하고 다음 모임에서 확인합니다</td><td>실행 장부, 체크인, 도전장</td></tr>
              <tr><th scope="row">기여</th><td>먼저 돕고, 받은 만큼 돌려줍니다</td><td>가입할 때 “도울 수 있는 것” 적기, 품앗이판</td></tr>
              <tr><th scope="row">정</th><td>서로의 장사와 안부를 챙깁니다</td><td>상단장 안부 연락, 쉼터 모임, 길잡이</td></tr>
            </tbody>
          </table>
        </div>
        <div class="two-col prose">
          <div>
            <h3>열정상회가 하지 않는 것</h3>
            <ul>
              <li>영업·투자·다단계 권유가 오가는 자리</li>
              <li>강의나 컨설팅을 팔기 위한 모객</li>
              <li>친목만 남는 술자리</li>
              <li>성공담을 자랑하는 무대</li>
            </ul>
          </div>
          <div>
            <h3>말하는 방식</h3>
            <ul>
              <li>존댓말을 쓰고, 직함 대신 이름에 “님”을 붙입니다.</li>
              <li>“대박”, “무조건” 같은 말 대신 과정과 숫자로 이야기합니다.</li>
              <li>숫자는 본인이 허락한 만큼만 씁니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="section alt" id="operation">
      <div class="wrap">
        <h2>이렇게 운영합니다</h2>
        <p class="lead">회장이 중심을 잡고, 공개 모집으로 뽑은 운영진이 일을 나눠 맡습니다. 기수 없이 연중 상시로 운영합니다.</p>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th scope="col">자리</th><th scope="col">맡는 일</th><th scope="col">임기·선출</th></tr></thead>
            <tbody>
              <tr><th scope="row">회장</th><td>모임의 방향, 대외 대표, 운영위원회 의장</td><td>임기 2년, 정기총회 신임으로 연임</td></tr>
              <tr><th scope="row">부회장</th><td>회장이 자리를 비우면 대행, 회원 의견 창구</td><td>운영진 가운데 회장이 지명</td></tr>
              <tr><th scope="row">상단 담당</th><td>상단 배정과 충원, 상단장 교육, 반기 점검</td><td rowspan="5">공개 모집과 면담을 거쳐 임명, 임기 1년</td></tr>
              <tr><th scope="row">프로그램 담당</th><td>장날, 학당, 상담소, 도전장 기획</td></tr>
              <tr><th scope="row">웰컴 담당</th><td>가입 인터뷰, 개업식, 첫 30일 안내</td></tr>
              <tr><th scope="row">홍보 담당</th><td>상회보, SNS, 모집 안내</td></tr>
              <tr><th scope="row">총무</th><td>회비 관리, 지출, 분기 결산</td></tr>
              <tr><th scope="row">감사</th><td>회계 확인과 정기총회 보고</td><td>운영진이 아닌 상회원, 정기총회 선출</td></tr>
              <tr><th scope="row">상단장·장날 MC·학당장·길잡이</th><td>현장 진행과 새 회원 동행</td><td>회원이 돌아가며 맡음</td></tr>
            </tbody>
          </table>
        </div>
        <div class="two-col prose">
          <div>
            <h3>한 사람에게 기대지 않도록</h3>
            <ul>
              <li>홍보와 장날 안내의 주인공은 회원입니다.</li>
              <li>장날 진행과 발표는 회원이 돌아가며 맡습니다.</li>
              <li>프로그램마다 맡은 운영진이 있어, 회장이 빠져도 모임이 열립니다.</li>
              <li>운영위원회에서 회장도 한 표입니다. 회비와 회칙은 정기총회에서 정합니다.</li>
              <li>회장의 사업도 헌장 3조를 똑같이 따릅니다.</li>
            </ul>
          </div>
          <div>
            <h3>운영진은 이렇게 뽑습니다</h3>
            <ol class="steps steps-tight">
              <li><strong>공개 모집</strong><span>매년 4분기, 자리별 역할과 필요한 시간을 공지합니다.</span></li>
              <li><strong>면담</strong><span>회장과 현 운영진 한 명이 30분씩 이야기합니다.</span></li>
              <li><strong>임명과 공개</strong><span>담당자를 회원에게 알리고 1월에 새 운영진이 출범합니다.</span></li>
            </ol>
          </div>
        </div>
        <h3 class="sub-title">지금의 운영진</h3>
        <div data-team>
          <div class="empty"><p>첫 운영진을 모으고 있습니다. 관심이 있다면 가입 신청서의 “맡아 보고 싶은 역할”에 표시해 주세요.</p></div>
        </div>
      </div>
    </section>

    <section class="section" id="money">
      <div class="wrap">
        <h2>회비는 이렇게 씁니다</h2>
        <p class="lead">열정상회는 회원이 낸 회비로 운영하고, 남는 돈은 다시 모임에 씁니다. 특정인의 지원이나 다른 사업의 수익에 기대지 않습니다.</p>
        <div class="two-col prose">
          <div>
            <h3>들어오는 돈과 나가는 돈</h3>
            <ul>
              <li>들어오는 돈: 상회원 회비, 사랑방 회비, 장날 참가비, 학당 참가비</li>
              <li>나가는 돈: 모임 공간 대관, 다과, 상담소 전문가 비용, 진행비, 운영 도구</li>
              <li>남는 돈: 예비비와 다음 해 프로그램</li>
            </ul>
          </div>
          <div>
            <h3>공개 원칙</h3>
            <ul>
              <li>회비는 단체 명의 계좌로만 받습니다. 회장 개인 계좌로 받지 않습니다.</li>
              <li>분기마다 결산을 회원에게 공개합니다.</li>
              <li>운영진이 아닌 감사가 회계를 확인하고, 연말 결산의 밤에서 보고합니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="section alt" id="words">
      <div class="wrap">
        <h2>상회 용어</h2>
        <p class="lead">열정상회는 옛 상회의 말을 빌려 모임의 이름을 붙였습니다. 처음 오신 분이 자주 듣게 되는 말을 모았습니다.</p>
        <dl class="glossary">
          <div><dt>상회원</dt><dd>사업자 확인과 인터뷰를 거쳐 가입한 정회원</dd></div>
          <div><dt>손님</dt><dd>장날에 처음 오거나 가볍게 참여하는 사람. 예비 창업자도 손님으로 만납니다</dd></div>
          <div><dt>상단(商團)·상단장</dt><dd>6~8명이 격주로 만나는 비경쟁 소그룹과 그 진행자</dd></div>
          <div><dt>장날</dt><dd>한 달에 한 번 열리는 공개 모임</dd></div>
          <div><dt>사랑방</dt><dd>사업자 확인을 거친 사람만 들어오는 온라인 공간</dd></div>
          <div><dt>핫시트</dt><dd>상단에서 한 사람의 고민을 40분 동안 깊게 다루는 순서</dd></div>
          <div><dt>실행 장부</dt><dd>상단에서 한 약속과 결과를 적는 기록</dd></div>
          <div><dt>품앗이판</dt><dd>“도와줄 수 있는 것”과 “필요한 것”을 올리고 연결하는 게시판</dd></div>
          <div><dt>학당·학당장</dt><dd>회원이 이끄는 4주 공부 모임과 그 진행자</dd></div>
          <div><dt>상담소</dt><dd>자격 있는 전문가와의 그룹 상담</dd></div>
          <div><dt>도전장</dt><dd>목표 하나를 공개하고 30일 동안 점검하는 프로그램</dd></div>
          <div><dt>개업식</dt><dd>매달 새로 들어온 상회원을 맞는 자리</dd></div>
          <div><dt>결산의 밤</dt><dd>12월에 한 해를 정리하는 모임. 정기총회를 겸합니다</dd></div>
          <div><dt>단골·길잡이</dt><dd>1년 넘게 활동한 상회원, 그리고 새 회원의 첫 3개월을 챙기는 단골</dd></div>
          <div><dt>상회보</dt><dd>열정상회의 소식지이자 이 홈페이지의 글 모음</dd></div>
        </dl>
      </div>
    </section>
`,
  };
}

/* ---------------- 프로그램 ---------------- */
function programs(site) {
  const crumbs = [['홈', '/'], ['프로그램', '/programs']];
  const prog = (id, name, desc, cycle, who, tag) =>
    `<li id="${id}"><div class="p-name">${name}${tag ? `<span class="tag">${tag}</span>` : ''}</div><div class="p-desc">${desc}</div><div class="p-meta"><b>${cycle}</b>${who}</div></li>`;
  const LATER = '순차 오픈';
  return {
    path: '/programs',
    file: 'programs.html',
    title: '프로그램 — 사업자 소그룹 상단, 장날, 학당, 상담소',
    desc: '열정상회의 사업자 소그룹 상단, 공개 모임 장날, 온라인 사랑방, 회원이 이끄는 학당, 전문가 상담소, 30일 도전장까지. 프로그램 구성과 상단 운영 방식, 1년의 흐름을 안내합니다.',
    keywords: '사업자 소그룹, 사업자 스터디, 자영업자 스터디, 사업자 네트워킹 프로그램, 마스터마인드, 핫시트',
    active: '/programs',
    graph: [breadcrumbLd(site, crumbs)],
    body: `${head('프로그램', '처음에는 핵심 프로그램으로 시작하고, 맡을 회원이 생기는 대로 하나씩 늘려 갑니다. “순차 오픈” 표시가 있는 프로그램은 개업 뒤 몇 달 안에 차례로 엽니다.', crumbs,
      [['list', '전체 프로그램'], ['sangdan', '상단 자세히'], ['year', '1년의 흐름']])}

    <section class="section" id="list">
      <div class="wrap">
        <h2>전체 프로그램</h2>

        <div class="program-group">
          <h3>중심이 되는 세 가지</h3>
          <p>열정상회의 뼈대입니다. 이 셋만으로도 한 해가 돌아갑니다.</p>
          <ul class="programs">
            ${prog('p-sangdan', '상단', '6~8명 비경쟁 소그룹. 핫시트로 고민을 풀고 실행 장부를 점검합니다.', '격주, 대면 120분과 온라인 90분을 번갈아', '상단장 진행')}
            ${prog('p-jangnal', '장날', '회원 두 명의 6분 발표와 질의, 그달의 주제 이야기, 테이블 대화. 손님도 참여합니다.', '월 1회, 90분', '장날 MC(매달 다른 회원)')}
            ${prog('p-sarangbang', '사랑방', '사업자 확인을 거친 사람만 들어오는 온라인 공간. 질문 게시판, 업종·지역 채널, 자료실이 있습니다.', '상시', '운영진 관리')}
          </ul>
        </div>

        <div class="program-group">
          <h3>돕고 배우기</h3>
          <p>회원이 가진 경험이 가장 좋은 교재입니다.</p>
          <ul class="programs">
            ${prog('p-pumasi', '품앗이판', '“도와줄 수 있는 것”과 “필요한 것”을 올리고 연결합니다. 상세페이지 피드백, 견적서 검토, 거래처 소개 같은 일들입니다.', '상시, 월 1회 정리', '웰컴 담당')}
            ${prog('p-hakdang', '학당', '회원이 이끄는 4주 공부 모임. AI 업무 자동화, 세무 기초, 가격 정하기, 정책자금 신청서 같은 주제를 다룹니다.', '분기마다 2~4개 개강', '학당장')}
            ${prog('p-sangdamso', '상담소', '세무사, 노무사, 변호사, 마케터 등 자격 있는 전문가의 그룹 상담. 법률·세무 판단은 이 자리에서만 다룹니다.', '월 1회', '프로그램 담당', LATER)}
            ${prog('p-sanghoebo', '상회보', '상단에서 나온 고민과 해법을 당사자 동의를 받아 익명으로 정리한 소식지입니다. 홈페이지에도 글을 싣습니다.', '격주', '홍보 담당', LATER)}
          </ul>
        </div>

        <div class="program-group">
          <h3>도전하기</h3>
          <p>공개하면 끝까지 가게 됩니다.</p>
          <ul class="programs">
            ${prog('p-dojeonjang', '도전장', '목표 하나를 공개하고 30일 동안 매주 점검합니다. 신규 고객 10명, 가격 인상 실험 같은 목표입니다.', '분기 1회, 주 1회 체크인', '프로그램 담당', LATER)}
            ${prog('p-gyeolsan', '결산의 밤', '한 해의 실행 장부와 배운 점을 나누는 연말 모임. 결산을 보고하는 정기총회를 겸합니다.', '연 1회, 12월', '운영진')}
          </ul>
        </div>

        <div class="program-group">
          <h3>만나기</h3>
          <p>명함을 돌리는 대신 서로의 일을 들여다봅니다.</p>
          <ul class="programs">
            ${prog('p-gaeeop', '개업식', '그달 새로 들어온 상회원을 맞는 자리. 목표 하나와 도울 수 있는 것 하나를 말하고 상단장과 길잡이를 만납니다.', '월 1회, 장날 직전 60분', '웰컴 담당')}
            ${prog('p-hanjan', '한잔 매칭', '다른 상단 회원과 1:1 커피 대화를 짝지어 드립니다.', '월 1회', '운영진', LATER)}
            ${prog('p-tambang', '가게 탐방', '상회원의 사업장을 찾아가 현장과 운영 방식을 듣습니다.', '분기 1회', '희망 회원', LATER)}
            ${prog('p-together', '같이 일하는 날', '회원 공간이나 공유 오피스에서 하루 함께 일하고 점심을 같이 먹습니다.', '월 1회', '자원 회원', LATER)}
            ${prog('p-giljabi', '길잡이', '1년 넘게 활동한 단골이 새 상회원 한 명의 첫 3개월을 함께합니다.', '가입 후 3개월', '단골', LATER)}
          </ul>
        </div>

        <div class="program-group">
          <h3>쉬어 가기</h3>
          <p>오래 하려면 쉬는 법도 같이 챙겨야 합니다.</p>
          <ul class="programs">
            ${prog('p-shimteo', '쉼터 모임', '걷기, 운동, 조용한 저녁처럼 쉬기 위한 모임입니다. 전문 상담이 필요하면 외부 기관을 안내합니다.', '월 1회', '자원 회원', LATER)}
          </ul>
        </div>
      </div>
    </section>

    <section class="section alt" id="sangdan">
      <div class="wrap">
        <h2>상단 자세히</h2>
        <p class="lead">상단은 끝나는 날이 없는 상설 소그룹입니다. 격주로 만나 한 번에 두 사람씩 핫시트를 하면, 8명 상단 기준으로 두 달에 한 번 자기 차례가 돌아옵니다.</p>
        <div class="two-col prose">
          <div>
            <h3>상단을 꾸리는 원칙</h3>
            <ul>
              <li>같은 상권의 같은 업종은 한 상단에 넣지 않습니다.</li>
              <li>비슷한 단계의 사람 4~5명, 한 걸음 앞선 사람 1~2명, 한 걸음 뒤의 사람 1명을 섞습니다.</li>
              <li>처음에는 업종보다 참석할 수 있는 시간대를 먼저 맞춥니다.</li>
              <li>회장도 한 상단에 속한 회원이고, 상단장은 맡지 않습니다.</li>
            </ul>
          </div>
          <div>
            <h3>시간대별 반</h3>
            <ul>
              <li>평일 오전반(오전 10시 전후): 매장 문을 열기 전 시간을 쓰는 분</li>
              <li>평일 저녁반(저녁 7시 전후): 프리랜서, 겸업 사업자, 직원이 있는 대표</li>
              <li>주말반(토요일 오전): 평일 시간을 내기 어려운 분</li>
            </ul>
          </div>
        </div>
        <div class="two-col">
          <div>
            <h3>대면 120분</h3>
            <ol class="timeline timeline-in">
              <li><time>0:00</time><strong>체크인</strong><span>지난 약속 결과를 한 사람씩 1~2분. 했다, 못 했다, 바뀌었다.</span></li>
              <li><time>0:15</time><strong>핫시트 ①</strong><span>상황 설명 10분, 질문만 10분, 경험 나누기 15분, 정리 5분</span></li>
              <li><time>1:00</time><strong>핫시트 ②</strong><span>같은 순서</span></li>
              <li><time>1:40</time><strong>약속 라운드</strong><span>다음 모임까지 할 일 하나</span></li>
              <li><time>1:55</time><strong>장부 기록</strong><span>실행 장부 정리, 다음 순서 확인</span></li>
            </ol>
          </div>
          <div>
            <h3>온라인 90분</h3>
            <ol class="timeline timeline-in">
              <li><time>0:00</time><strong>체크인</strong><span>지난 약속 결과</span></li>
              <li><time>0:20</time><strong>핫시트</strong><span>한 사람, 대면과 같은 순서로 45분</span></li>
              <li><time>1:05</time><strong>약속 라운드</strong><span>다음 모임까지 할 일 하나</span></li>
              <li><time>1:25</time><strong>장부 기록</strong><span>실행 장부 입력</span></li>
            </ol>
          </div>
        </div>
        <div class="two-col prose">
          <div>
            <h3>새 회원이 들어오는 날</h3>
            <ul>
              <li>체크인 앞에 10분 합류 시간을 둡니다. 새 회원은 하는 일과 요즘 고민을 소개하고, 기존 회원은 상단의 규칙과 최근 장부 흐름을 알려 줍니다.</li>
              <li>새 회원의 첫 핫시트는 두 번째 모임부터입니다.</li>
            </ul>
          </div>
          <div>
            <h3>반기 점검과 휴회</h3>
            <ul>
              <li>6월과 12월에 계속, 다른 상단으로 이동, 잠시 쉼 가운데 하나를 고릅니다. 이동할 때 이유는 묻지 않습니다.</li>
              <li>상단장은 6개월씩 맡고, 한 번 연임할 수 있습니다.</li>
              <li>사정이 생기면 최대 3개월까지 회비 없이 쉴 수 있습니다. 상단 자리는 1개월까지 남겨 둡니다.</li>
            </ul>
          </div>
        </div>
        <p class="more-links">더 읽기: <a href="/journal/hot-seat">핫시트 진행법</a> · <a href="/journal/action-ledger">실행 장부 쓰는 법</a> · <a href="/journal/mastermind-group">마스터마인드 그룹이란</a></p>
      </div>
    </section>

    <section class="section" id="year">
      <div class="wrap">
        <h2>1년의 흐름</h2>
        <p class="lead">기수가 없는 대신 반복되는 리듬이 있습니다. 달력은 1월을 기준으로 맞춥니다.</p>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th scope="col">주기</th><th scope="col">열리는 것</th><th scope="col">운영진이 하는 일</th></tr></thead>
            <tbody>
              <tr><th scope="row">상시</th><td>사랑방, 품앗이판</td><td>질문 응답 확인, 도움 연결</td></tr>
              <tr><th scope="row">격주</th><td>상단</td><td>실행 장부 기록, 불참자 연락</td></tr>
              <tr><th scope="row">매월</th><td>장날, 개업식, 상담소, 한잔 매칭</td><td>신규 가입 처리, 상단 배정, 운영진 회의</td></tr>
              <tr><th scope="row">분기</th><td>학당 개강, 도전장, 가게 탐방</td><td>회원 수와 재정 점검, 분기 결산 공개</td></tr>
              <tr><th scope="row">6월·12월</th><td>상단 반기 점검</td><td>상단 이동과 휴식 신청, 상단장 교체</td></tr>
              <tr><th scope="row">12월</th><td>결산의 밤(정기총회)</td><td>연간 결산 보고, 다음 해 운영진 선발</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="cta">
      <div class="wrap">
        <h2>상단은 장날에서 시작됩니다</h2>
        <p>장날에 손님으로 와서 상회원들과 이야기를 나눠 보세요. 맞다고 느끼면 그달 개업식에서 상단장을 만나게 됩니다.</p>
        <div class="actions">
          <a class="btn btn-light" href="/jangnal#apply">장날 신청하기</a>
          <a class="btn btn-outline-light" href="/join">가입 안내 보기</a>
        </div>
      </div>
    </section>
`,
  };
}

/* ---------------- 장날 ---------------- */
function jangnal(site, ctx) {
  const crumbs = [['홈', '/'], ['장날', '/jangnal']];
  return {
    path: '/jangnal',
    file: 'jangnal.html',
    title: '장날 — 서울 사업자 네트워킹 공개 모임',
    desc: '한 달에 한 번 열리는 열정상회의 공개 모임 장날. 회원이 아니어도 손님으로 참여할 수 있는 서울의 사업자·자영업자·프리랜서 네트워킹 모임입니다. 일정 확인과 참가 신청.',
    keywords: '사업자 네트워킹 모임, 서울 사업자 모임, 자영업자 오프라인 모임, 프리랜서 네트워킹, 창업자 네트워킹 행사',
    active: '/jangnal',
    forms: true,
    graph: [breadcrumbLd(site, crumbs), ...ctx.eventsLd],
    body: `${head('장날', '한 달에 한 번 열리는 열정상회의 공개 모임입니다. 회원이 아니어도 손님으로 올 수 있습니다. 명함 대신 요즘 하는 고민 하나를 가져오세요.', crumbs,
      [['schedule', '일정'], ['flow', '진행 순서'], ['guest', '손님 안내'], ['apply', '참가 신청']])}

    <section class="section" id="schedule">
      <div class="wrap">
        <h2>다가오는 장날</h2>
        <div data-jangnal-list>
          <div class="empty"><p>첫 장날 날짜를 정하고 있습니다. 아래 신청서에서 “다음 장날 알림만 받기”를 고르면 일정이 나오는 대로 문자로 알려 드립니다.</p></div>
        </div>
      </div>
    </section>

    <section class="section alt" id="flow">
      <div class="wrap split">
        <div>
          <h2>90분은 이렇게 흘러갑니다</h2>
          <p>장날에는 아무도 팔지 않습니다. 회원 두 명이 지금 하는 일과 최근의 고민, 그리고 해 본 것을 6분 동안 이야기하고, 나머지는 테이블에 둘러앉아 대화합니다.</p>
          <p>테이블마다 상회원이 한 명씩 앉아 처음 온 분이 어색하지 않게 돕습니다. 서울에서 열리며, 장소는 회원 공간과 제휴 공간을 돌아가며 씁니다.</p>
        </div>
        <ol class="timeline" aria-label="장날 90분 진행 순서">
          <li><time>0:00</time><strong>입장</strong><span>명찰을 받고 상회원이 있는 테이블에 앉습니다.</span></li>
          <li><time>0:10</time><strong>여는 말</strong><span>열정상회와 오늘의 약속 하나를 짧게 소개합니다.</span></li>
          <li><time>0:15</time><strong>회원 발표 두 편</strong><span>한 사람당 6분 발표와 10분 질의.</span></li>
          <li><time>0:47</time><strong>이달의 주제</strong><span>회원 한 명이 15분 동안 그달의 주제를 이야기합니다.</span></li>
          <li><time>1:05</time><strong>테이블 대화</strong><span>질문 카드를 가지고 20분 동안 이야기합니다.</span></li>
          <li><time>1:25</time><strong>닫는 말</strong><span>다음 장날을 안내합니다. 가입 안내는 1분을 넘기지 않습니다.</span></li>
        </ol>
      </div>
    </section>

    <section class="section" id="guest">
      <div class="wrap">
        <h2>손님에게 부탁드리는 것</h2>
        <div class="two-col prose">
          <div>
            <ul>
              <li>판매와 권유는 하지 않습니다. 투자 권유, 다단계, 리딩방, 코인 홍보는 바로 퇴장입니다.</li>
              <li>사진은 찍혀도 괜찮다고 한 사람만 찍습니다.</li>
              <li>다른 사람의 이야기를 허락 없이 SNS에 올리지 않습니다.</li>
            </ul>
          </div>
          <div>
            <ul>
              <li>참가비: <strong data-fee="guest">첫 장날 공지 때 안내</strong></li>
              <li>상회원이 초대한 손님은 참가비가 없습니다.</li>
              <li>준비물은 없습니다. 요즘 붙잡고 있는 고민 하나면 충분합니다.</li>
            </ul>
          </div>
        </div>
        <p class="more-links">장날에 오기 전에 읽어 보면 좋은 글: <a href="/journal/choosing-business-group">사업자 모임, 나가 보기 전에 확인할 다섯 가지</a></p>
      </div>
    </section>
${jangnalForm}
`,
  };
}

/* ---------------- 가입 안내 ---------------- */
function join(site, ctx) {
  const crumbs = [['홈', '/'], ['가입 안내', '/join']];
  const faqPick = [ctx.faq[1].items[1], ctx.faq[1].items[2], ctx.faq[2].items[1], ctx.faq[4].items[0]];
  return {
    path: '/join',
    file: 'join.html',
    title: '가입 안내 — 상회원 자격, 회비, 가입 절차',
    desc: '열정상회 상회원 자격과 회원 구분, 회비, 가입 절차, 환불과 휴회 기준을 안내합니다. 사업자등록이 있거나 프리랜서 소득이 확인되면 업종과 규모에 상관없이 가입할 수 있습니다.',
    keywords: '사업자 모임 가입, 자영업자 모임 가입, 열정상회 회비, 사업자 커뮤니티 가입 방법',
    active: '/join',
    forms: true,
    graph: [breadcrumbLd(site, crumbs)],
    body: `${head('가입 안내', '열정상회는 이미 자기 업을 하고 있는 사람들의 모임입니다. 가입은 연중 언제든 받고, 들어오면 그달 개업식에서 상단장과 길잡이를 만납니다.', crumbs,
      [['who', '누가 함께하나요'], ['fees', '회원 구분과 회비'], ['steps', '가입 절차'], ['faq', '자주 묻는 질문'], ['apply', '신청서']])}

    <section class="section" id="who">
      <div class="wrap">
        <h2>누가 함께하나요</h2>
        <div class="two-col prose two-col-first">
          <div>
            <h3>상회원 자격</h3>
            <ul>
              <li>사업자등록이 있거나 프리랜서 소득이 확인되는 분</li>
              <li>신청서, 15분 화상 인터뷰, 상회 헌장 서약을 거친 분</li>
              <li>창업을 준비 중이라면 장날에 손님으로 먼저 함께해 주세요.</li>
            </ul>
          </div>
          <div>
            <h3>함께하기 어려운 경우</h3>
            <ul>
              <li>가입 목적이 영업인 경우</li>
              <li>다단계 판매, 리딩방, 코인 홍보 등 헌장 4조에 해당하는 활동을 하는 경우</li>
            </ul>
          </div>
        </div>
        <ul class="who-list who-list-compact">${ctx.personas.map((p) => `
          <li><a href="/for/${p.slug}"><strong>${esc(p.card)}</strong><span>${esc(p.cardLine)}</span></a></li>`).join('')}
        </ul>
      </div>
    </section>

    <section class="section alt" id="fees">
      <div class="wrap">
        <h2>회원 구분과 회비</h2>
        <p class="lead" data-fee="note">회비는 첫 모집 전에 확정해 이 페이지에 공지합니다.</p>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th scope="col">구분</th><th scope="col">함께하는 것</th><th scope="col">회비</th></tr></thead>
            <tbody>
              <tr><th scope="row">손님</th><td>장날 1회, 상회보 구독. 상회원이 초대하면 참가비가 없습니다.</td><td class="price" data-fee="guest">공지 예정</td></tr>
              <tr><th scope="row">사랑방 회원</th><td>사랑방, 품앗이판, 자료실. 장날과 학당 할인</td><td class="price" data-fee="sarangbang">공지 예정</td></tr>
              <tr><th scope="row">상회원</th><td>상단(격주), 사랑방, 장날, 개업식과 결산의 밤, 상담소, 학당 할인. 처음 3개월은 한 번에 결제하고, 그 뒤로는 매달 결제하거나 1년치를 할인받아 냅니다.</td><td class="price" data-fee="member">공지 예정</td></tr>
            </tbody>
          </table>
        </div>
        <p class="note">상단장과 학당장을 맡은 회원은 회비를 감면받습니다. 회원을 추천하면 추천한 분과 가입한 분 모두 1개월 회비를 감면받습니다. 현금 수당은 없습니다.</p>
      </div>
    </section>

    <section class="section" id="steps">
      <div class="wrap">
        <h2>가입 절차</h2>
        <ol class="steps">
          <li><strong>장날이나 상회보로 먼저 만나기</strong><span>필수는 아니지만, 분위기를 먼저 겪어 보시길 권합니다.</span></li>
          <li><strong>신청서 보내기</strong><span>하는 일, 지금의 고민, 도울 수 있는 것, 가능한 시간대를 적습니다.</span></li>
          <li><strong>15분 화상 인터뷰</strong><span>웰컴 담당 운영진이 3일 안에 연락드립니다. 가입 목적과 기대를 서로 확인합니다.</span></li>
          <li><strong>사업자 확인</strong><span>사업자 상태를 조회하거나 프리랜서 소득을 확인합니다. 확인 뒤 서류 사본은 보관하지 않습니다.</span></li>
          <li><strong>서약과 결제</strong><span>상회 헌장에 서약하고, 환불 기준을 확인한 뒤 결제합니다.</span></li>
          <li><strong>개업식</strong><span>그달 개업식에서 상단장과 길잡이를 만나고, 첫 상단 날짜를 안내받습니다.</span></li>
        </ol>
        <div class="two-col prose">
          <div>
            <h3>환불과 해지</h3>
            <ul>
              <li>첫 상단 모임 뒤 7일 안에는 전액 환불합니다.</li>
              <li>처음 3개월이 지나면 매달 그만둘 수 있습니다.</li>
            </ul>
          </div>
          <div>
            <h3>쉬어 가기</h3>
            <ul>
              <li>출산, 이사, 성수기처럼 사정이 생기면 최대 3개월까지 회비 없이 쉴 수 있습니다.</li>
              <li>상단 자리는 1개월까지 남겨 둡니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="section alt" id="faq">
      <div class="wrap">
        <h2>자주 묻는 질문</h2>
        ${faqDetails(faqPick)}
        <a class="text-link" href="/faq">질문 전체 보기</a>
      </div>
    </section>
${applyForm}
`,
  };
}

/* ---------------- 상회 헌장 ---------------- */
function charter(site) {
  const crumbs = [['홈', '/'], ['상회 헌장', '/charter']];
  return {
    path: '/charter',
    file: 'charter.html',
    title: '상회 헌장 — 영업 없는 사업자 모임의 일곱 가지 약속',
    desc: '열정상회 상회원이 가입할 때 서약하는 일곱 개 조항과 이해상충 규칙입니다. 먼저 팔지 않고, 상단에서 들은 이야기는 상단 안에 두며, 회장과 운영진도 같은 규칙을 따릅니다.',
    keywords: '영업 없는 사업자 모임, 사업자 모임 규칙, 커뮤니티 헌장, 비밀유지, 이해상충 규칙',
    active: '/charter',
    graph: [breadcrumbLd(site, crumbs)],
    body: `${head('상회 헌장', '가입할 때 서약하고, 상단 첫 모임마다 상단장이 제2조를 읽고 시작합니다. 헌장은 정기총회에서만 고칩니다. 회장과 운영진도 똑같이 따릅니다.', crumbs)}

    <section class="section">
      <div class="wrap">
        <ol class="charter">
          <li><p>우리는 업을 하고 있는 사람이다.<small>가입할 때 사업자등록이나 프리랜서 소득을 확인합니다.</small></p></li>
          <li><p>상단에서 들은 이야기는 상단 안에 둔다.<small>녹음, 캡처, 외부 공유를 하지 않습니다.</small></p></li>
          <li><p>먼저 팔지 않는다.<small>도움을 요청받았을 때만 제안합니다. 회장과 운영진도 예외가 아닙니다.</small></p></li>
          <li><p>투자 권유, 다단계, 리딩방, 코인 홍보는 경고 없이 퇴출한다.</p></li>
          <li><p>직함 대신 이름에 “님”을 붙인다.<small>매출 규모로 자리를 나누지 않습니다.</small></p></li>
          <li><p>약속은 장부에 적고, 다음 모임에서 결과를 말한다.<small>지키지 못한 약속도 말합니다.</small></p></li>
          <li><p>상단 모임의 4분의 3 이상 참석한다.<small>빠질 때는 미리 알립니다.</small></p></li>
        </ol>
        <div class="pledge">
          <p>나는 열정상회의 상회원으로서 이 일곱 가지를 지키고, 지키지 못했을 때는 솔직하게 말하겠습니다.</p>
          <div class="seal" aria-hidden="true"><span>열</span><span>정</span><span>상</span><span>회</span></div>
        </div>
        <p class="more-links">조항마다 왜 이런 약속을 넣었는지는 <a href="/journal/charter-explained">영업 없는 사업자 모임을 만드는 일곱 가지 약속</a>에 풀어 썼습니다.</p>
      </div>
    </section>

    <section class="section alt">
      <div class="wrap">
        <h2>이해상충 규칙</h2>
        <p class="lead">회원 모두가 업을 하기 때문에 이해가 겹치는 일은 피할 수 없습니다. 그래서 미리 규칙으로 정해 둡니다.</p>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th scope="col">이럴 때</th><th scope="col">이렇게 합니다</th></tr></thead>
            <tbody>
              <tr><th scope="row">내 서비스를 소개하고 싶을 때</th><td>요청을 받았을 때만 제안하고, 조건은 품앗이판이나 협력상점 게시판에 공개합니다.</td></tr>
              <tr><th scope="row">회장·운영진의 사업과 얽힐 때</th><td>장소 선정, 협력상점 선정, 외주 발주처럼 자기 사업과 관련된 결정에서 빠집니다.</td></tr>
              <tr><th scope="row">회원 공간을 모임에 쓸 때</th><td>단가를 공개하고 운영위원회 승인을 받습니다. 한 사람의 공간에 몰리지 않게 돌아가며 씁니다.</td></tr>
              <tr><th scope="row">회원끼리 돈이 오갈 때</th><td>열정상회는 회원 간 투자나 대여를 모집하거나 중개하거나 보증하지 않습니다.</td></tr>
              <tr><th scope="row">회원을 추천할 때</th><td>추천한 사람과 가입한 사람 모두 1개월 회비 감면만 받습니다. 현금 수당은 없습니다.</td></tr>
              <tr><th scope="row">전문적인 질문이 나올 때</th><td>법률·세무·노무 판단은 자격 있는 전문가가 상담소에서 다룹니다. 회원끼리는 경험만 나눕니다.</td></tr>
              <tr><th scope="row">상단 이야기를 쓰고 싶을 때</th><td>당사자 동의를 받고, 사람과 회사를 알 수 없게 정리합니다.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="cta">
      <div class="wrap">
        <h2>이 일곱 가지가 마음에 든다면</h2>
        <p>열정상회는 이 약속을 지키는 사람들이 모여 만드는 모임입니다.</p>
        <div class="actions">
          <a class="btn btn-light" href="/join#apply">가입 신청하기</a>
          <a class="btn btn-outline-light" href="/jangnal">장날 먼저 가 보기</a>
        </div>
      </div>
    </section>
`,
  };
}

/* ---------------- 자주 묻는 질문 ---------------- */
function faqPage(site, ctx) {
  const crumbs = [['홈', '/'], ['자주 묻는 질문', '/faq']];
  const all = ctx.faq.flatMap((g) => g.items);
  return {
    path: '/faq',
    file: 'faq.html',
    title: '자주 묻는 질문 — 사업자 모임 가입, 회비, 상단, 장날',
    desc: '열정상회에 관해 자주 묻는 질문. 누가 가입할 수 있는지, 회비와 환불, 상단 배정 방식, 장날 참여, 영업 금지 규칙과 회비 공개 원칙까지 한곳에 모았습니다.',
    keywords: '사업자 모임 가입 조건, 자영업자 모임 회비, 프리랜서 모임 가입, 사업자 커뮤니티 질문',
    active: '/faq',
    graph: [breadcrumbLd(site, crumbs), faqLd(all)],
    body: `${head('자주 묻는 질문', '가입 전에 많이 묻는 내용을 모았습니다. 여기 없는 질문은 장날에 직접 물어보셔도 좋습니다.', crumbs,
      ctx.faq.map((g, i) => [`faq-${i + 1}`, g.group]))}
${ctx.faq.map((g, i) => `
    <section class="section${i % 2 ? ' alt' : ''}" id="faq-${i + 1}">
      <div class="wrap">
        <h2>${esc(g.group)}</h2>
        ${faqDetails(g.items)}
      </div>
    </section>`).join('')}

    <section class="cta">
      <div class="wrap">
        <h2>궁금한 것이 남았다면</h2>
        <p>장날에 손님으로 와서 상회원에게 직접 물어보세요. 가입 인터뷰에서도 무엇이든 물어보실 수 있습니다.</p>
        <div class="actions">
          <a class="btn btn-light" href="/jangnal">장날 일정 보기</a>
          <a class="btn btn-outline-light" href="/join">가입 안내 보기</a>
        </div>
      </div>
    </section>
`,
  };
}

/* ---------------- 대상별 페이지 ---------------- */
function persona(site, ctx, p) {
  const crumbs = [['홈', '/'], ['누가 함께하나요', '/join#who'], [p.card, `/for/${p.slug}`]];
  const related = p.articles.map((s) => ctx.posts.find((x) => x.slug === s)).filter(Boolean);
  const others = ctx.personas.filter((x) => x.slug !== p.slug);
  return {
    path: `/for/${p.slug}`,
    file: `for/${p.slug}.html`,
    titleFull: p.titleFull,
    desc: p.desc,
    keywords: p.keywords,
    active: '',
    graph: [breadcrumbLd(site, crumbs), faqLd(p.faq)],
    body: `${head(esc(p.h1), esc(p.lead), crumbs)}

    <section class="section">
      <div class="wrap split">
        <div class="prose-block">
          ${p.intro.map((t) => `<p>${esc(t)}</p>`).join('\n          ')}
        </div>
        <div>
          <h2 class="h-small">이런 고민을 함께 나눕니다</h2>
          <ul class="ledger-list">
            ${p.worries.map((w) => `<li>${esc(w)}</li>`).join('\n            ')}
          </ul>
        </div>
      </div>
    </section>

    <section class="section alt">
      <div class="wrap">
        <h2>열정상회에서는 이렇게 함께합니다</h2>
        <dl class="promises promises-2">
          ${p.how.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('\n          ')}
        </dl>
      </div>
    </section>

    <section class="section">
      <div class="wrap two-col two-col-first">
        <div>
          <h2 class="h-small">상단은 이렇게 꾸립니다</h2>
          <p>${esc(p.matching)}</p>
          <a class="text-link" href="/programs#sangdan">상단 운영 방식 보기</a>
        </div>
        <div class="prose">
          <h2 class="h-small">이런 경우에는 맞지 않을 수 있습니다</h2>
          <ul>
            ${p.notFit.map((n) => `<li>${esc(n)}</li>`).join('\n            ')}
          </ul>
        </div>
      </div>
    </section>

    <section class="section alt">
      <div class="wrap">
        <h2>자주 묻는 질문</h2>
        ${faqDetails(p.faq)}
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <h2>함께 읽으면 좋은 글</h2>
        ${postList(related)}
        <p class="more-links">다른 분들의 이야기: ${others.map((o) => `<a href="/for/${o.slug}">${esc(o.card)}</a>`).join(' · ')}</p>
      </div>
    </section>

    <section class="cta">
      <div class="wrap">
        <h2>장날에 손님으로 먼저 오세요</h2>
        <p>한 달에 한 번 열리는 공개 모임에서 상회원들과 이야기를 나눠 보세요. 맞다고 느끼면 그때 가입하셔도 됩니다.</p>
        <div class="actions">
          <a class="btn btn-light" href="/jangnal#apply">장날 신청하기</a>
          <a class="btn btn-outline-light" href="/join#apply">가입 신청하기</a>
        </div>
      </div>
    </section>
`,
  };
}

/* ---------------- 상회보 목록 ---------------- */
function journalIndex(site, ctx) {
  const crumbs = [['홈', '/'], ['상회보', '/journal/']];
  return {
    path: '/journal/',
    file: 'journal/index.html',
    title: '상회보 — 사업자·자영업자·프리랜서를 위한 글',
    desc: '열정상회 상회보. 사업자 모임 고르는 법, 혼자 일하는 사장님의 고민, 가격 실험, 프리랜서 단가, 소그룹 진행법, 소상공인 지원사업 찾는 법처럼 업을 하는 사람에게 필요한 이야기를 씁니다.',
    keywords: '상회보, 자영업자 칼럼, 사업자 글, 프리랜서 팁, 소상공인 정보, 사업 운영 노하우',
    active: '/journal/',
    pageType: 'CollectionPage',
    graph: [
      breadcrumbLd(site, crumbs),
      { '@type': 'ItemList', itemListElement: ctx.posts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: site.url + p.path, name: p.title })) },
    ],
    body: `${head('상회보', '업을 하는 사람에게 필요한 이야기를 씁니다. 상단에서 자주 나오는 고민과, 혼자서는 찾기 어려운 정보를 정리합니다.', crumbs)}

    <section class="section">
      <div class="wrap">
        ${postList(ctx.posts, 2)}
        <p class="note">새 글은 <a href="/rss.xml">RSS</a>로도 받아 볼 수 있습니다.</p>
      </div>
    </section>
`,
  };
}

/* ---------------- 개인정보 처리방침 ---------------- */
function privacy(site) {
  const crumbs = [['홈', '/'], ['개인정보 처리방침', '/privacy']];
  return {
    path: '/privacy',
    file: 'privacy.html',
    title: '개인정보 처리방침',
    desc: '열정상회 홈페이지 신청서로 받는 개인정보의 항목, 이용 목적, 보관 기간, 파기 방법을 안내합니다.',
    active: '',
    graph: [breadcrumbLd(site, crumbs)],
    body: `${head('개인정보 처리방침', '<span data-operator-name>열정상회</span>는 신청서로 받은 개인정보를 아래 기준에 따라 처리합니다.', crumbs)}
    <section class="section policy">
      <div class="wrap">
        <h2>1. 받는 항목</h2>
        <ul>
          <li>가입 신청: 이름, 휴대전화, 이메일(선택), 활동 지역, 하는 일, 사업 형태, 업력, 규모, 참석 가능 시간대, 고민과 목표, 도울 수 있는 것, 피하고 싶은 업종, 알게 된 경로, 관심 역할</li>
          <li>장날 신청: 이름, 휴대전화, 이메일(선택), 하는 일, 참가 회차, 이야기하고 싶은 고민(선택), 알게 된 경로</li>
          <li>매출 같은 민감한 숫자와 주민등록번호는 받지 않습니다.</li>
        </ul>
        <h2>2. 쓰는 목적</h2>
        <ul>
          <li>가입 인터뷰 연락, 사업자 확인, 상단 배정, 모임 안내</li>
          <li>장날 참가 확인과 일정 안내</li>
        </ul>
        <h2>3. 보관 기간과 파기</h2>
        <ul>
          <li>가입하지 않은 신청자의 정보는 신청일로부터 6개월 뒤 파기합니다.</li>
          <li>상회원의 정보는 탈퇴하면 지체 없이 파기합니다. 결제 기록처럼 법으로 보관해야 하는 정보만 정해진 기간 동안 보관합니다.</li>
          <li>사업자 확인에 쓴 서류 사본은 확인 뒤 바로 지웁니다.</li>
          <li>신청서와 회원 명부는 회장과 맡은 운영진만 각자의 계정으로 봅니다. 정보를 고치거나 내려받으면 누가 언제 했는지 기록이 남습니다.</li>
        </ul>
        <h2>4. 제3자 제공과 처리 위탁</h2>
        <ul>
          <li>받은 정보를 다른 곳에 제공하지 않습니다.</li>
          <li>홈페이지 운영과 신청서 보관을 위해 Cloudflare(웹 호스팅, 신청서와 회원 명부 보관)의 서비스를 씁니다. 신청서를 구글 시트로도 받는 경우에는 Google의 서비스도 함께 씁니다.</li>
        </ul>
        <h2>5. 정보 주체의 권리</h2>
        <p>언제든 내 정보를 열람, 정정, 삭제해 달라고 요청할 수 있습니다. 아래 담당자에게 연락하시면 지체 없이 처리합니다.</p>
        <h2>6. 개인정보 보호 담당</h2>
        <p data-privacy-contact>담당자와 연락처는 운영 주체가 정해지는 대로 이곳에 공개합니다.</p>
        <p class="note">시행일: 2026년 11월 14일</p>
      </div>
    </section>
`,
  };
}

/* ---------------- 404 ---------------- */
function notFound() {
  return {
    path: '/404',
    file: '404.html',
    title: '페이지를 찾을 수 없습니다',
    desc: '요청하신 페이지를 찾을 수 없습니다.',
    active: '',
    noindex: true,
    body: `
    <section class="notfound">
      <div class="wrap">
        <span class="sign-text" aria-hidden="true">휴업중</span>
        <h1 class="hero-tagline">찾으시는 페이지가 없습니다</h1>
        <p class="hero-desc">주소가 바뀌었거나 없어진 페이지입니다. 아래에서 다시 찾아 주세요.</p>
        <div class="actions center"><a class="btn btn-primary" href="/">처음으로 가기</a><a class="btn btn-ghost" href="/journal/">상회보 보기</a></div>
      </div>
    </section>
`,
  };
}

module.exports = { home, about, programs, jangnal, join, charter, faqPage, persona, journalIndex, privacy, notFound, fmtDate, postList };
