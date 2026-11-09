/**
 * 열정상회 신청서 → 구글 시트 저장용 Apps Script
 *
 * 쓰는 법
 * 1. 구글 드라이브에서 새 스프레드시트를 만듭니다. (이름 예: 열정상회 신청서)
 * 2. 메뉴 [확장 프로그램] > [Apps Script]를 엽니다.
 * 3. 기본으로 들어 있는 코드를 모두 지우고 이 파일 내용을 붙여 넣습니다.
 * 4. 아래 SECRET 값을 아무 긴 문자열로 바꿉니다. (Cloudflare의 APPLY_WEBHOOK_SECRET과 같은 값)
 * 5. 저장한 뒤 [배포] > [새 배포] > 유형 [웹 앱]을 고릅니다.
 *    - 다음 사용자 인증 정보로 실행: 나
 *    - 액세스 권한이 있는 사용자: 모든 사용자
 * 6. [배포]를 누르고 권한을 허용한 뒤, 나오는 "웹 앱 URL"을 복사합니다.
 * 7. 그 주소를 Cloudflare Pages의 APPLY_WEBHOOK_URL 변수에 넣습니다.
 *
 * 신청이 들어오면 "가입 신청", "장날 신청" 시트가 자동으로 만들어지고 한 줄씩 쌓입니다.
 */

const SECRET = '여기에-긴-문자열을-넣으세요';

const FIELDS = {
  apply: [
    ['receivedAt', '접수 시각'], ['name', '이름'], ['phone', '휴대전화'], ['email', '이메일'],
    ['region', '지역'], ['work', '하는 일'], ['bizType', '사업 형태'], ['years', '업력'], ['size', '규모'],
    ['times', '가능 시간대'], ['worry', '풀고 싶은 고민'], ['goal', '1년 뒤 바라는 변화'],
    ['canHelp', '도울 수 있는 것'], ['avoid', '불편한 업종'], ['source', '알게 된 경로'],
    ['roles', '관심 역할'], ['consentCharter', '헌장 동의'], ['consentPrivacy', '개인정보 동의'],
    ['status', '처리 상태'], ['memo', '운영진 메모'], ['id', '접수 번호'],
  ],
  jangnal: [
    ['receivedAt', '접수 시각'], ['session', '참가할 장날'], ['name', '이름'], ['phone', '휴대전화'],
    ['email', '이메일'], ['work', '하는 일'], ['question', '이야기하고 싶은 고민'], ['source', '알게 된 경로'],
    ['consentPrivacy', '개인정보 동의'], ['status', '처리 상태'], ['memo', '운영진 메모'], ['id', '접수 번호'],
  ],
};

// 수식으로 해석될 수 있는 값은 글자로 저장합니다.
function safe(v) {
  const s = v == null ? '' : String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents || '{}');
  if (SECRET && data.secret !== SECRET) {
    return ContentService.createTextOutput('forbidden');
  }
  const type = data.type === 'jangnal' ? 'jangnal' : 'apply';
  const sheetName = type === 'jangnal' ? '장날 신청' : '가입 신청';
  const fields = FIELDS[type];

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(fields.map((f) => f[1]));
      sheet.setFrozenRows(1);
    }
    if (data.receivedAt) {
      data.receivedAt = Utilities.formatDate(new Date(data.receivedAt), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
    }
    data.status = data.status || '접수';
    sheet.appendRow(fields.map((f) => safe(data[f[0]])));
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
