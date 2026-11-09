// 가입 신청서, 장날 신청서
const consentPrivacy = `<label class="check"><input type="checkbox" name="consentPrivacy" value="동의" required> <span>개인정보 수집·이용에 동의합니다. 이름·연락처·하는 일 등은 신청 확인과 안내에만 쓰고, 목적을 다하면 파기합니다. <a href="/privacy">처리방침 보기</a> <span class="req" aria-hidden="true">*</span></span></label>`;

const sourceOptions = `<option value="">선택해 주세요</option>
              <option>장날에 와 봤어요</option>
              <option>상회원 추천</option>
              <option>회장·운영진을 통해</option>
              <option>네이버 검색</option>
              <option>구글 검색</option>
              <option>상회보 글을 읽고</option>
              <option>인스타그램 등 SNS</option>
              <option>기관·행사 소개</option>
              <option>기타</option>`;

const applyForm = `
    <section class="section form-section" id="apply" aria-labelledby="apply-title">
      <div class="wrap">
        <h2 id="apply-title">상회원 가입 신청서</h2>
        <p class="lead">10분 정도 걸립니다. 상단을 배정할 때 쓰는 내용이라 구체적으로 적어 주실수록 잘 맞는 상단을 찾을 수 있습니다. 신청서를 받으면 웰컴 담당 운영진이 3일 안에 15분 화상 인터뷰 일정을 연락드립니다.</p>
        <div class="form-card">
          <form class="js-form" data-type="apply" novalidate>
            <div class="form-grid">
              <div class="field"><label for="a-name">이름<span class="req" aria-hidden="true">*</span></label><input id="a-name" name="name" type="text" autocomplete="name" required></div>
              <div class="field"><label for="a-phone">휴대전화<span class="req" aria-hidden="true">*</span></label><input id="a-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="010-0000-0000" required></div>
              <div class="field"><label for="a-email">이메일</label><input id="a-email" name="email" type="email" autocomplete="email"></div>
              <div class="field"><label for="a-region">주로 일하는 지역<span class="req" aria-hidden="true">*</span></label><input id="a-region" name="region" type="text" placeholder="예: 서울 마포구" required></div>
              <div class="field full"><label for="a-work">지금 하는 일<span class="req" aria-hidden="true">*</span><span class="hint">한두 문장이면 충분합니다. 예: 연남동에서 6년째 브런치 카페를 하고 있습니다.</span></label><textarea id="a-work" name="work" rows="3" required></textarea></div>
              <div class="field"><label for="a-biz">사업 형태<span class="req" aria-hidden="true">*</span></label>
                <select id="a-biz" name="bizType" required><option value="">선택해 주세요</option><option>개인사업자</option><option>법인 대표</option><option>프리랜서</option><option>기타</option></select></div>
              <div class="field"><label for="a-years">업력</label>
                <select id="a-years" name="years"><option value="">선택해 주세요</option><option>1년 미만</option><option>1~3년</option><option>3~7년</option><option>7년 이상</option></select></div>
              <div class="field"><label for="a-size">함께 일하는 사람</label>
                <select id="a-size" name="size"><option value="">선택해 주세요</option><option>혼자</option><option>직원 1~4명</option><option>직원 5~29명</option><option>직원 30명 이상</option></select></div>
              <fieldset class="field"><legend>참석하기 좋은 시간대</legend>
                <div class="checks">
                  <label class="check"><input type="checkbox" name="times" value="평일 오전"> 평일 오전</label>
                  <label class="check"><input type="checkbox" name="times" value="평일 저녁"> 평일 저녁</label>
                  <label class="check"><input type="checkbox" name="times" value="주말"> 주말</label>
                </div></fieldset>
              <div class="field full"><label for="a-worry">지금 꼭 풀고 싶은 고민 하나<span class="req" aria-hidden="true">*</span></label><textarea id="a-worry" name="worry" rows="3" required></textarea></div>
              <div class="field full"><label for="a-goal">1년 뒤 무엇이 달라져 있으면 좋겠나요?</label><textarea id="a-goal" name="goal" rows="2"></textarea></div>
              <div class="field full"><label for="a-help">다른 상회원을 도울 수 있는 것 하나<span class="req" aria-hidden="true">*</span><span class="hint">경험, 기술, 아는 사람 무엇이든 좋습니다. 예: 스마트스토어 상세페이지 피드백</span></label><textarea id="a-help" name="canHelp" rows="2" required></textarea></div>
              <div class="field full"><label for="a-avoid">같은 상단에 있으면 불편한 업종<span class="hint">경쟁 관계라 솔직하게 말하기 어려운 업종이 있다면 적어 주세요.</span></label><input id="a-avoid" name="avoid" type="text"></div>
              <div class="field"><label for="a-source">열정상회를 알게 된 경로</label><select id="a-source" name="source">
              ${sourceOptions}
              </select></div>
              <fieldset class="field"><legend>맡아 보고 싶은 역할</legend>
                <div class="checks">
                  <label class="check"><input type="checkbox" name="roles" value="운영진"> 운영진</label>
                  <label class="check"><input type="checkbox" name="roles" value="상단장"> 상단장</label>
                  <label class="check"><input type="checkbox" name="roles" value="학당장"> 학당장</label>
                </div></fieldset>
              <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
              <div class="full consents">
                <label class="check"><input type="checkbox" name="consentCharter" value="동의" required> <span>상회 헌장 7개 조항을 읽었고, 가입하면 지키겠습니다. <a href="/charter">헌장 보기</a> <span class="req" aria-hidden="true">*</span></span></label>
                ${consentPrivacy}
              </div>
            </div>
            <p class="form-error" role="alert"></p>
            <div class="form-submit">
              <button class="btn btn-primary" type="submit">가입 신청 보내기</button>
              <p class="note">회비는 인터뷰 뒤에 안내드립니다. 신청만으로 결제되지 않습니다.</p>
            </div>
          </form>
        </div>
      </div>
    </section>`;

const jangnalForm = `
    <section class="section form-section" id="apply" aria-labelledby="apply-title">
      <div class="wrap">
        <h2 id="apply-title">장날 참가 신청</h2>
        <p class="lead">회원이 아니어도 신청할 수 있습니다. 날짜가 정해지지 않았다면 알림만 받아 두셔도 됩니다.</p>
        <div class="form-card">
          <form class="js-form" data-type="jangnal" novalidate>
            <div class="form-grid">
              <div class="field"><label for="j-name">이름<span class="req" aria-hidden="true">*</span></label><input id="j-name" name="name" type="text" autocomplete="name" required></div>
              <div class="field"><label for="j-phone">휴대전화<span class="req" aria-hidden="true">*</span></label><input id="j-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="010-0000-0000" required></div>
              <div class="field"><label for="j-email">이메일</label><input id="j-email" name="email" type="email" autocomplete="email"></div>
              <div class="field"><label for="j-session">참가할 장날<span class="req" aria-hidden="true">*</span></label>
                <select id="j-session" name="session" required data-jangnal-select><option value="다음 장날 알림만 받기">다음 장날 알림만 받기</option></select></div>
              <div class="field full"><label for="j-work">하는 일<span class="req" aria-hidden="true">*</span><span class="hint">예: 프리랜서 영상 편집 3년 차, 창업 준비 중</span></label><input id="j-work" name="work" type="text" required></div>
              <div class="field full"><label for="j-question">장날에서 이야기해 보고 싶은 고민<span class="hint">테이블 대화 주제를 정할 때 참고합니다.</span></label><textarea id="j-question" name="question" rows="2"></textarea></div>
              <div class="field"><label for="j-source">열정상회를 알게 된 경로</label><select id="j-source" name="source">
              ${sourceOptions}
              </select></div>
              <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
              <div class="full consents">
                ${consentPrivacy}
              </div>
            </div>
            <p class="form-error" role="alert"></p>
            <div class="form-submit">
              <button class="btn btn-primary" type="submit">장날 신청 보내기</button>
              <p class="note">신청을 받으면 장소와 시간을 문자로 다시 안내드립니다.</p>
            </div>
          </form>
        </div>
      </div>
    </section>`;

module.exports = { applyForm, jangnalForm };
