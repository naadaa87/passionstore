/* 열정상회 관리자 화면
   외부 라이브러리 없이 동작합니다. 데이터는 /api/admin/* 로 주고받습니다.
   - 신청·회원·상단·모임 기록: Cloudflare D1
   - 장날 일정·상회보·사이트 정보: GitHub 저장소에 커밋 → Cloudflare가 다시 빌드 */
(function () {
  'use strict';

  /* ---------- 기본 도구 ---------- */
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var h = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var app = document.getElementById('app');
  var state = { me: null, info: null, dirty: false, token: 0, lastHash: '', started: false, localImages: {} };

  var KST = 9 * 3600 * 1000;
  var kstIso = function (iso) { return iso ? new Date(new Date(iso).getTime() + KST).toISOString() : ''; };
  var ymd = function (iso) { return kstIso(iso).slice(0, 10); };
  var todayStr = function () { return ymd(new Date().toISOString()); };
  var stamp = function (iso) {
    var s = kstIso(iso);
    if (!s) return '';
    var sameYear = s.slice(0, 4) === todayStr().slice(0, 4);
    return (sameYear ? '' : s.slice(0, 4) + '. ') + (+s.slice(5, 7)) + '. ' + (+s.slice(8, 10)) + '. ' + s.slice(11, 16);
  };
  var DAYS = '일월화수목금토';
  var dayLabel = function (d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
    if (!m) return d || '';
    var x = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    var y = m[1] !== todayStr().slice(0, 4) ? m[1] + '년 ' : '';
    return y + (+m[2]) + '월 ' + (+m[3]) + '일 (' + DAYS[x.getUTCDay()] + ')';
  };
  var daysAgo = function (d) { return Math.round((Date.parse(todayStr()) - Date.parse(d)) / 864e5); };
  var pct = function (a, b) { return b ? Math.round((a * 100) / b) : null; };
  var timeLabel = function (t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
    if (!m) return t || '';
    var H = +m[1];
    return (H < 12 ? '오전 ' : '오후 ') + (H % 12 || 12) + (m[2] === '00' ? '시' : ':' + m[2]);
  };
  var enc = encodeURIComponent;
  var qs = function (obj) {
    var p = [];
    Object.keys(obj).forEach(function (k) { if (obj[k] != null && obj[k] !== '') p.push(k + '=' + enc(obj[k])); });
    return p.length ? '?' + p.join('&') : '';
  };
  // 받침에 맞춰 '으로/로'를 고릅니다(ㄹ 받침은 '로').
  var ro = function (word) {
    var code = String(word).charCodeAt(String(word).length - 1) - 0xac00;
    if (code < 0 || code > 11171) return '로';
    var jong = code % 28;
    return jong && jong !== 8 ? '으로' : '로';
  };
  var sum = function (arr, f) { return arr.reduce(function (a, x) { return a + (f ? f(x) : x); }, 0); };

  /* ---------- 이름표 ---------- */
  var L = {
    apply: { new: '새 신청', contacted: '연락함', interview: '면담 예정', approved: '가입 승인', joined: '등록 완료', hold: '보류', declined: '거절' },
    jangnal: { new: '접수', confirmed: '참석 확정', attended: '참석', no_show: '불참', canceled: '취소', notify: '알림만' },
    member: { active: '활동', paused: '휴회', left: '탈퇴' },
    tier: { member: '상회원', sarangbang: '사랑방 회원' },
    fee: { unpaid: '미납', paid: '납부', exempt: '면제' },
    sangdan: { open: '운영 중', closed: '닫음' },
    jstatus: { open: '신청 받는 중', full: '마감', soon: '신청 준비 중' },
    role: { owner: '회장 권한', staff: '운영진 권한' },
    mode: { offline: '오프라인', online: '온라인' },
  };
  var chip = function (group, v) { return '<span class="chip st-' + h(v) + '">' + h((L[group] && L[group][v]) || v) + '</span>'; };
  var opts = function (group) { return Object.keys(L[group]).map(function (k) { return [k, L[group][k]]; }); };
  var ROLES = ['운영진', '부회장', '상단장', '학당장', '길잡이', '장날 MC', '감사', '단골'];
  var SLOTS = ['평일 오전', '평일 저녁', '주말'];
  var BIZ = ['개인사업자', '법인 대표', '프리랜서', '기타'];
  var YEARS = ['1년 미만', '1~3년', '3~7년', '7년 이상'];
  var SIZES = ['혼자', '직원 1~4명', '직원 5~29명', '직원 30명 이상'];
  var APPLY_FIELDS = [
    ['region', '주로 일하는 지역'], ['work', '하는 일'], ['bizType', '사업 형태'], ['years', '업력'], ['size', '함께 일하는 사람'],
    ['times', '참석하기 좋은 시간대'], ['worry', '풀고 싶은 고민'], ['goal', '1년 뒤 바라는 변화'], ['canHelp', '도울 수 있는 것'],
    ['avoid', '불편한 업종'], ['roles', '맡아 보고 싶은 역할'], ['consentCharter', '헌장 동의'], ['consentPrivacy', '개인정보 동의'],
  ];
  var JANGNAL_FIELDS = [['sessionLabel', '참가할 장날'], ['work', '하는 일'], ['question', '이야기하고 싶은 고민'], ['consentPrivacy', '개인정보 동의']];
  var sessionName = function (s, label) { return s === 'notify' ? '다음 장날 알림만' : (/^\d{4}-/.test(s || '') ? dayLabel(s) : (label || s || '')); };

  /* ---------- 서버와 주고받기 ---------- */
  function ApiError(message, code, status) { this.message = message; this.code = code; this.status = status; }
  ApiError.prototype = Object.create(Error.prototype);

  function api(path, o) {
    o = o || {};
    var opt = { method: o.method || 'GET', credentials: 'same-origin', headers: { 'x-admin-request': '1' } };
    if (o.body !== undefined) { opt.headers['content-type'] = 'application/json'; opt.body = JSON.stringify(o.body); }
    return fetch('/api/admin/' + path, opt).catch(function () {
      throw new ApiError('서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.', 'network', 0);
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || data.ok === false) {
          var err = new ApiError(data.message || ('요청을 처리하지 못했습니다. (' + res.status + ')'), data.error, res.status);
          if (res.status === 401 && ['login', 'setup', 'status'].indexOf(path) < 0) showLogin('로그인 시간이 지났습니다. 다시 로그인해 주세요.');
          if (data.error === 'must_change' && state.me) { state.me.mustChange = true; showMustChange(); }
          throw err;
        }
        return data;
      });
    });
  }

  /* ---------- 알림·대화상자 ---------- */
  var toastTimer;
  function toast(msg, isError) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, isError ? 6000 : 3800);
  }
  var fail = function (e) { if (e && e.status !== 401 && e.code !== 'must_change') toast(e.message || '처리하지 못했습니다.', true); };

  function dialog(html, onOpen, wide) {
    var d = $('#dlg');
    d.innerHTML = html;
    d.style.width = wide ? 'min(760px, calc(100% - 28px))' : '';
    d.returnValue = '';
    return new Promise(function (resolve) {
      var done = function () { d.removeEventListener('close', done); resolve(d.returnValue); };
      d.addEventListener('close', done);
      d.showModal();
      if (onOpen) onOpen(d);
    });
  }

  function ask(o) {
    var typed = o.typed || '';
    var html = '<form method="dialog" class="dlg"><h2 id="dlg-title">' + h(o.title) + '</h2><div class="dlg-body">' + (o.body || '') + '</div>' +
      (typed ? '<label class="field" style="margin-top:14px"><span class="lbl">확인을 위해 다음을 그대로 적어 주세요: ' + h(typed) + '</span><input name="typed" autocomplete="off"></label>' : '') +
      '<div class="dlg-actions"><button class="btn btn-line" value="cancel">취소</button><button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" value="ok"' + (typed ? ' disabled' : '') + '>' + h(o.ok || '확인') + '</button></div></form>';
    return dialog(html, function (d) {
      if (!typed) return;
      var i = $('[name=typed]', d);
      var b = $('button[value=ok]', d);
      i.addEventListener('input', function () { b.disabled = i.value.trim() !== typed; });
      i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (!b.disabled) d.close('ok'); } });
      i.focus();
    }).then(function (v) { return v === 'ok'; });
  }

  function formDialog(o) {
    var html = '<form class="dlg" novalidate><h2 id="dlg-title">' + h(o.title) + '</h2>' + (o.intro ? '<div class="dlg-body"><p>' + o.intro + '</p></div>' : '') + o.body +
      '<p class="err" data-err style="color:var(--brick-deep);margin:12px 0 0;min-height:1em"></p>' +
      '<div class="dlg-actions"><button type="button" class="btn btn-line" data-cancel>취소</button><button type="submit" class="btn btn-primary">' + h(o.ok || '저장') + '</button></div></form>';
    return dialog(html, function (d) {
      var f = $('form', d);
      $('[data-cancel]', d).addEventListener('click', function () { d.close('cancel'); });
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = $('button[type=submit]', f);
        btn.disabled = true;
        $('[data-err]', f).textContent = '';
        Promise.resolve().then(function () { return o.submit(readForm(f), f); }).then(function (r) {
          btn.disabled = false;
          if (r !== false) d.close('ok');
        }).catch(function (err) {
          btn.disabled = false;
          $('[data-err]', f).textContent = err.message || '처리하지 못했습니다.';
        });
      });
      if (o.onOpen) o.onOpen(f);
      var first = $('input:not([type=hidden]):not([type=checkbox]), select, textarea', f);
      if (first) first.focus();
    }, o.wide);
  }

  /* ---------- 입력 칸 ---------- */
  var attrs = function (a) { return a ? ' ' + a : ''; };
  function fld(label, control, o) {
    o = o || {};
    return '<label class="field' + (o.full ? ' full' : '') + '"><span class="lbl">' + h(label) + '</span>' + control +
      (o.hint ? '<small class="hint">' + o.hint + '</small>' : '') + '</label>';
  }
  function group(label, control, o) {
    o = o || {};
    return '<fieldset class="field' + (o.full ? ' full' : '') + '"><legend>' + h(label) + '</legend>' + control +
      (o.hint ? '<small class="hint">' + o.hint + '</small>' : '') + '</fieldset>';
  }
  var inp = function (name, value, a) { return '<input name="' + name + '" value="' + h(value == null ? '' : value) + '"' + attrs(a) + '>'; };
  var ta = function (name, value, a) { return '<textarea name="' + name + '"' + attrs(a) + '>' + h(value == null ? '' : value) + '</textarea>'; };
  function sel(name, value, list, a) {
    return '<select name="' + name + '"' + attrs(a) + '>' + list.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o;
      var t = Array.isArray(o) ? o[1] : o;
      return '<option value="' + h(v) + '"' + (String(v) === String(value == null ? '' : value) ? ' selected' : '') + '>' + h(t) + '</option>';
    }).join('') + '</select>';
  }
  var chk = function (name, on, label, a) { return '<label class="check"><input type="checkbox" name="' + name + '"' + (on ? ' checked' : '') + attrs(a) + '> <span>' + h(label) + '</span></label>'; };
  function multi(name, values, list) {
    return '<div class="checks">' + list.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o;
      var t = Array.isArray(o) ? o[1] : o;
      return '<label class="check"><input type="checkbox" name="' + name + '" value="' + h(v) + '" data-multi' + (values.indexOf(v) >= 0 ? ' checked' : '') + '> <span>' + h(t) + '</span></label>';
    }).join('') + '</div>';
  }
  function readForm(form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox') {
        if (el.hasAttribute('data-multi')) { out[el.name] = out[el.name] || []; if (el.checked) out[el.name].push(el.value); }
        else out[el.name] = el.checked;
      } else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else if (el.type !== 'submit' && el.type !== 'button' && el.type !== 'file') out[el.name] = el.value.trim();
    });
    return out;
  }
  var splitList = function (s, by) { return String(s || '').split(by || /,\s*/).map(function (x) { return x.trim(); }).filter(Boolean); };

  function busy(btn, label, fn) {
    var old = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = label;
    return Promise.resolve().then(fn).then(function (r) {
      btn.disabled = false; btn.innerHTML = old; return r;
    }, function (e) {
      btn.disabled = false; btn.innerHTML = old; throw e;
    });
  }

  function trackDirty(root) {
    root.addEventListener('input', function () { state.dirty = true; });
    root.addEventListener('change', function () { state.dirty = true; });
  }
  window.addEventListener('beforeunload', function (e) {
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- 공통 조각 ---------- */
  var brand = function () { return '<a class="brand" href="#/"><span class="sign">열정상회</span><span>관리</span></a>'; };
  function head(title, o) {
    o = o || {};
    return '<div class="page-head"><div>' + (o.crumb ? '<div class="crumb"><a href="' + o.crumb[0] + '">' + h(o.crumb[1]) + '</a></div>' : '') +
      '<h1>' + h(title) + '</h1>' + (o.desc ? '<p>' + o.desc + '</p>' : '') + '</div>' +
      (o.actions ? '<div class="actions">' + o.actions + '</div>' : '') + '</div>';
  }
  var empty = function (msg, extra) { return '<div class="empty"><p>' + msg + '</p>' + (extra ? '<p>' + extra + '</p>' : '') + '</div>'; };
  var isOwner = function () { return state.me && state.me.role === 'owner'; };
  function goRows(root) {
    $$('tr.go', root).forEach(function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.closest('a, button, select, input, label')) return;
        location.hash = tr.getAttribute('data-href');
      });
    });
  }
  function tabs(items, current, makeHref) {
    return '<nav class="tabs" aria-label="상태로 걸러보기">' + items.map(function (t) {
      return '<a href="' + makeHref(t[0]) + '"' + (t[0] === current ? ' aria-current="true"' : '') + '>' + h(t[1]) +
        (t[2] != null ? '<span class="c">' + t[2] + '</span>' : '') + '</a>';
    }).join('') + '</nav>';
  }
  var GH_GUIDE = '<div class="guide"><ol>' +
    '<li>GitHub 오른쪽 위 프로필 → <strong>Settings → Developer settings → Personal access tokens → Fine-grained tokens</strong>에서 <strong>Generate new token</strong>을 누릅니다.</li>' +
    '<li><strong>Repository access</strong>는 <strong>Only select repositories</strong>를 골라 passionstore 저장소 하나만 지정하고, <strong>Permissions → Contents</strong>를 <strong>Read and write</strong>로 바꿉니다. 만료일은 1년 안으로 정해 두고, 만료되기 전에 새로 만들어 바꿔 넣습니다.</li>' +
    '<li>Cloudflare 대시보드의 passionstore 프로젝트에서 <strong>설정(Settings) → 변수 및 비밀(Variables and Secrets)</strong>에 이름 <code>GITHUB_TOKEN</code>, 종류 <strong>비밀(Secret)</strong>로 토큰을 넣습니다.</li>' +
    '<li><strong>배포(Deployments)</strong> 탭에서 마지막 배포를 다시 실행한 뒤 이 화면을 새로 고칩니다.</li></ol></div>';
  function githubNeeded(title) {
    return head(title) + '<div class="note"><p>이 화면에서 고친 내용은 홈페이지 저장소(GitHub)에 바로 기록되고, 1~2분 뒤 홈페이지에 반영됩니다. 아직 GitHub 연결이 설정되지 않았습니다. 아래 순서대로 한 번만 연결해 주세요.</p></div>' + GH_GUIDE;
  }

  /* ---------- 처음 화면들 ---------- */
  function authScreen(inner) {
    state.started = false;
    app.innerHTML = '<div class="auth"><div class="auth-box">' + brand() + inner + '</div></div>';
    var f = $('form', app);
    if (f) { var first = $('input', f); if (first) first.focus(); }
    return f;
  }

  function showNoDb() {
    authScreen('<h1>데이터베이스를 연결해 주세요</h1><p>신청서와 회원 명부를 저장할 Cloudflare D1 데이터베이스가 아직 연결되지 않았습니다. 처음 한 번만 하면 됩니다.</p>' +
      '<div class="guide"><ol>' +
      '<li>Cloudflare 대시보드 왼쪽 메뉴에서 <strong>Storage & Databases → D1 SQL Database</strong>로 가서 <strong>Create</strong>를 누르고 이름을 <code>passionstore</code>로 만듭니다.</li>' +
      '<li><strong>Workers & Pages → passionstore → 설정(Settings) → 바인딩(Bindings)</strong>에서 <strong>추가(Add) → D1 데이터베이스</strong>를 고르고, 변수 이름에 <code>DB</code>, 데이터베이스에 방금 만든 것을 지정합니다.</li>' +
      '<li>같은 설정의 <strong>변수 및 비밀(Variables and Secrets)</strong>에 이름 <code>ADMIN_SETUP_KEY</code>, 종류 <strong>비밀(Secret)</strong>로 긴 문장 하나를 넣습니다. 첫 계정을 만들 때 한 번 쓰는 열쇠입니다.</li>' +
      '<li><strong>배포(Deployments)</strong> 탭에서 마지막 배포의 <strong>다시 시도(Retry deployment)</strong>를 누르고, 끝나면 이 화면을 새로 고칩니다.</li>' +
      '</ol></div><p class="auth-foot">자세한 설명은 저장소의 <code>docs/admin-guide.md</code>에 있습니다.</p>');
  }

  function showSetup() {
    if (!state.info.setupKeySet) {
      authScreen('<h1>첫 계정을 만들 준비가 필요합니다</h1><p>Cloudflare 변수에 <code>ADMIN_SETUP_KEY</code>가 없습니다. 이 값은 첫 회장 계정을 만들 때 한 번 쓰는 열쇠입니다.</p>' +
        '<div class="guide"><ol><li>Cloudflare 대시보드 <strong>Workers & Pages → passionstore → 설정 → 변수 및 비밀</strong>에서 이름 <code>ADMIN_SETUP_KEY</code>, 종류 <strong>비밀(Secret)</strong>로 긴 문장을 하나 넣습니다.</li>' +
        '<li><strong>배포</strong> 탭에서 마지막 배포를 다시 실행하고, 끝나면 이 화면을 새로 고칩니다.</li></ol></div>');
      return;
    }
    var f = authScreen('<h1>첫 관리자 계정 만들기</h1><p>회장 계정을 하나 만듭니다. 운영진 계정은 로그인한 뒤 관리자 계정 화면에서 추가합니다.</p>' +
      '<form novalidate>' +
      fld('설정 키', '<input name="key" type="password" autocomplete="off" required>', { hint: 'Cloudflare에 넣어 둔 ADMIN_SETUP_KEY 값' }) +
      fld('이름', '<input name="name" autocomplete="name" required>') +
      fld('이메일', '<input name="email" type="email" autocomplete="username" required>', { hint: '로그인할 때 아이디로 씁니다.' }) +
      fld('비밀번호', '<input name="password" type="password" autocomplete="new-password" required>', { hint: '10자 이상, 영문과 숫자를 함께 넣어 주세요.' }) +
      fld('비밀번호 확인', '<input name="password2" type="password" autocomplete="new-password" required>') +
      '<p class="err" data-err></p><button class="btn btn-primary">계정 만들고 시작하기</button></form>');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = readForm(f);
      var err = $('[data-err]', f);
      if (!v.key || !v.name || !v.email || !v.password) { err.textContent = '모든 칸을 채워 주세요.'; return; }
      if (v.password !== v.password2) { err.textContent = '비밀번호 확인이 맞지 않습니다.'; return; }
      busy($('button', f), '만드는 중…', function () {
        return api('setup', { method: 'POST', body: { key: v.key, name: v.name, email: v.email, password: v.password } });
      }).then(boot).catch(function (x) { err.textContent = x.message; });
    });
  }

  function showLogin(msg) {
    state.me = null;
    state.dirty = false;
    var f = authScreen('<h1>관리자 로그인</h1><p>열정상회 회장과 운영진이 쓰는 화면입니다.</p>' +
      '<form novalidate>' +
      fld('이메일', '<input name="email" type="email" autocomplete="username" required>') +
      fld('비밀번호', '<input name="password" type="password" autocomplete="current-password" required>') +
      '<p class="err" data-err>' + h(msg || '') + '</p><button class="btn btn-primary">로그인</button></form>' +
      '<p class="auth-foot">비밀번호를 잊었다면 회장 계정에서 임시 비밀번호를 다시 받을 수 있습니다. 회장 계정 비밀번호를 잊었을 때는 관리자 안내서(docs/admin-guide.md)를 보세요.</p>');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = readForm(f);
      var err = $('[data-err]', f);
      if (!v.email || !v.password) { err.textContent = '이메일과 비밀번호를 적어 주세요.'; return; }
      busy($('button', f), '확인하는 중…', function () {
        return api('login', { method: 'POST', body: v });
      }).then(boot).catch(function (x) { err.textContent = x.message; });
    });
  }

  function showMustChange() {
    var f = authScreen('<h1>새 비밀번호 정하기</h1><p>' + h(state.me.name) + '님, 처음 받은 임시 비밀번호를 본인만 아는 비밀번호로 바꿔 주세요.</p>' +
      '<form novalidate>' +
      fld('임시 비밀번호', '<input name="current" type="password" autocomplete="current-password" required>') +
      fld('새 비밀번호', '<input name="next" type="password" autocomplete="new-password" required>', { hint: '10자 이상, 영문과 숫자를 함께 넣어 주세요.' }) +
      fld('새 비밀번호 확인', '<input name="next2" type="password" autocomplete="new-password" required>') +
      '<p class="err" data-err></p><button class="btn btn-primary">바꾸고 시작하기</button></form>' +
      '<p class="auth-foot"><button type="button" class="link-btn" data-logout>로그아웃</button></p>');
    $('[data-logout]', app).addEventListener('click', logout);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = readForm(f);
      var err = $('[data-err]', f);
      if (v.next !== v.next2) { err.textContent = '새 비밀번호 확인이 맞지 않습니다.'; return; }
      busy($('button', f), '바꾸는 중…', function () {
        return api('me', { method: 'POST', body: { current: v.current, next: v.next } });
      }).then(function () { state.me.mustChange = false; startApp(); toast('비밀번호를 바꿨습니다.'); })
        .catch(function (x) { err.textContent = x.message; });
    });
  }

  function logout() {
    api('logout', { method: 'POST' }).catch(function () {}).then(function () {
      state.dirty = false;
      location.hash = '#/';
      showLogin('로그아웃했습니다.');
    });
  }

  function boot() {
    return api('status').then(function (info) {
      state.info = info;
      if (!info.db) return showNoDb();
      if (info.setupNeeded) return showSetup();
      if (!info.me) return showLogin();
      state.me = info.me;
      if (state.me.mustChange) return showMustChange();
      startApp();
    }).catch(function (e) {
      authScreen('<h1>관리자 화면을 열지 못했습니다</h1><p>' + h(e.message) + '</p><p><button type="button" class="btn btn-line" data-retry>다시 시도</button></p>');
      $('[data-retry]', app).addEventListener('click', function () { location.reload(); });
    });
  }

  /* ---------- 틀 ---------- */
  var NAV = [
    { title: '운영', items: [['', '오늘 할 일'], ['applications', '가입 신청', 'apply'], ['jangnal-apps', '장날 신청', 'jangnal'], ['members', '회원 명부'], ['sangdans', '상단']] },
    { title: '홈페이지', items: [['schedule', '장날 일정'], ['journal', '상회보'], ['settings', '사이트 정보']] },
    { title: '회장 전용', owner: true, items: [['accounts', '관리자 계정'], ['logs', '활동 기록'], ['data', '개인정보 관리']] },
  ];

  function startApp() {
    var me = state.me;
    app.innerHTML = '<div class="layout">' +
      '<aside class="side" id="side">' + brand() +
      '<nav aria-label="관리 메뉴">' + NAV.filter(function (g) { return !g.owner || me.role === 'owner'; }).map(function (g) {
        return '<div class="nav-group"><h2>' + h(g.title) + '</h2><ul>' + g.items.map(function (it) {
          return '<li><a href="#/' + it[0] + '" data-nav="' + it[0] + '"><span>' + h(it[1]) + '</span>' +
            (it[2] ? '<span class="badge-n" data-count="' + it[2] + '" hidden></span>' : '') + '</a></li>';
        }).join('') + '</ul></div>';
      }).join('') + '</nav>' +
      '<div class="side-foot"><div class="who">' + h(me.name) + '<small>' + h(me.duty && me.duty !== '회장' ? me.duty + ' · ' + L.role[me.role] : L.role[me.role]) + '</small></div>' +
      '<div class="links"><a href="#/me">내 계정</a><button type="button" data-logout>로그아웃</button></div>' +
      '<div class="links"><a href="/" target="_blank" rel="noopener">홈페이지 열기</a></div></div>' +
      '</aside><div class="main-col"><header class="topbar">' + brand() +
      '<button class="menu-btn" type="button" data-menu aria-controls="side" aria-expanded="false">메뉴</button></header>' +
      '<main id="view" tabindex="-1"></main></div></div>';
    $('[data-logout]', app).addEventListener('click', logout);
    $('[data-menu]', app).addEventListener('click', function () { toggleMenu(true); });
    state.started = true;
    route();
    refreshCounts();
  }

  function toggleMenu(open) {
    var side = $('#side');
    var btn = $('[data-menu]');
    if (!side) return;
    side.classList.toggle('open', open);
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var scrim = $('.scrim');
    if (open && !scrim) {
      scrim = document.createElement('div');
      scrim.className = 'scrim';
      scrim.addEventListener('click', function () { toggleMenu(false); });
      document.body.appendChild(scrim);
    } else if (!open && scrim) scrim.remove();
  }

  function refreshCounts() {
    api('counts').then(function (d) {
      var by = {};
      d.items.forEach(function (r) { by[r.type] = r.n; });
      $$('[data-count]').forEach(function (b) {
        var n = by[b.getAttribute('data-count')] || 0;
        b.textContent = n;
        b.hidden = !n;
        b.setAttribute('aria-label', '새로 들어온 신청 ' + n + '건');
      });
    }).catch(function () {});
  }

  var ROUTES = {};
  function route(opts) {
    if (!state.started) return;
    var keep = opts && opts.keepScroll;
    var hash = location.hash || '#/';
    if (state.dirty && hash !== state.lastHash) {
      if (!window.confirm('저장하지 않은 내용이 있습니다. 이 화면을 떠날까요?')) { history.replaceState(null, '', state.lastHash); return; }
      state.dirty = false;
    }
    state.lastHash = hash;
    var raw = hash.replace(/^#\/?/, '');
    var qi = raw.indexOf('?');
    var parts = (qi < 0 ? raw : raw.slice(0, qi)).split('/').filter(Boolean).map(function (p) { try { return decodeURIComponent(p); } catch (e) { return p; } });
    var query = new URLSearchParams(qi < 0 ? '' : raw.slice(qi + 1));
    var key = parts[0] || '';
    $$('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === key) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    toggleMenu(false);
    var view = $('#view');
    var token = ++state.token;
    var y = window.scrollY;
    var put = function (html, title) {
      if (token !== state.token) return null;
      view.innerHTML = html;
      document.title = (title ? title + ' · ' : '') + '열정상회 관리';
      if (keep) window.scrollTo(0, y);
      return view;
    };
    put.alive = function () { return token === state.token; };
    if (!keep) view.innerHTML = '<p class="loading">불러오는 중…</p>';
    var fn = ROUTES[key];
    var run = fn ? Promise.resolve().then(function () { return fn({ parts: parts.slice(1), query: query, put: put }); })
      : Promise.resolve(put(head('없는 화면입니다') + empty('주소를 다시 확인해 주세요.', '<a href="#/">오늘 할 일로 가기</a>')));
    return run.then(function () {
      if (token === state.token && !keep) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
    }).catch(function (e) {
      if (e && (e.status === 401 || e.code === 'must_change')) return;
      put(head('화면을 열지 못했습니다') + '<div class="note red"><p>' + h(e && e.message ? e.message : String(e)) + '</p></div>');
    });
  }
  var rerender = function () { return route({ keepScroll: true }); };
  window.addEventListener('hashchange', function () { route(); });

  /* ======================================================================
     오늘 할 일
     ====================================================================== */
  ROUTES[''] = function (c) {
    return api('dashboard').then(function (d) {
      var ac = function (type, sts) {
        var list = sts.split(',');
        return sum(d.appCounts.filter(function (r) { return r.type === type && list.indexOf(r.status) >= 0; }), function (r) { return r.n; });
      };
      var mc = function (st, tier) {
        return sum(d.memberCounts.filter(function (r) { return (!st || r.status === st) && (!tier || r.tier === tier); }), function (r) { return r.n; });
      };
      var stale = d.sangdans.filter(function (s) { return !s.last_meeting || daysAgo(s.last_meeting) > 21; });

      var todos = [
        { n: ac('apply', 'new'), t: '새 가입 신청에 연락하기', s: '접수한 순서대로 먼저 연락해 면담 날짜를 잡습니다.', href: '#/applications?status=new', base: true },
        { n: ac('apply', 'contacted,interview'), t: '면담을 앞두었거나 결과를 정리할 신청', href: '#/applications?status=contacted,interview', base: true },
        { n: ac('apply', 'approved'), t: '가입을 승인하고 명부 등록이 남은 신청', href: '#/applications?status=approved', base: true },
        { n: ac('jangnal', 'new'), t: '장날 신청 확인하기', s: '참석을 확정하면 장소와 준비할 것을 안내합니다.', href: '#/jangnal-apps?status=new', base: true },
        { n: d.unassigned.length, t: '상단 배정을 기다리는 상회원', s: '희망 시간대가 맞는 상단에 넣거나, 사람이 모이면 새 상단을 엽니다.', href: '#/members?status=active&tier=member&sangdan=none', base: true },
      ];
      SLOTS.forEach(function (slot) {
        var n = d.waitingBySlot[slot] || 0;
        if (n >= 5) todos.push({ n: n, t: slot + ' 시간대 대기자가 ' + n + '명입니다', s: '다섯 명 이상 모이면 새 상단을 열 수 있습니다.', href: '#/sangdans/new?slot=' + enc(slot), amber: true });
      });
      if (stale.length) todos.push({ n: stale.length, t: '3주 넘게 모임 기록이 없는 상단', s: stale.map(function (s) { return s.name; }).join(', '), href: '#/sangdans', amber: true });
      if (d.feeDue.length) todos.push({ n: d.feeDue.length, t: '회비 확인이 필요한 회원', s: '미납이거나 2주 안에 납부 기한이 끝납니다.', href: '#/members?fee=due&status=active', amber: true });
      if (d.pausedReturn.length) todos.push({ n: d.pausedReturn.length, t: '2주 안에 휴회가 끝나는 회원', s: '복귀 전에 상단장과 함께 연락해 둡니다.', href: '#/members?status=paused', amber: true });

      var activeTodos = todos.filter(function (t) { return t.n > 0; });
      var quiet = todos.filter(function (t) { return !t.n && t.base; });
      var ledger = '<ul class="ledger">' + activeTodos.concat(quiet).map(function (t) {
        return '<li class="' + (!t.n ? 'quiet' : t.amber ? 'amber' : '') + '"><a href="' + t.href + '"><span class="n">' + t.n + '</span>' +
          '<span class="t">' + h(t.t) + (t.s && t.n ? '<small>' + h(t.s) + '</small>' : '') + '</span><span class="go">보기</span></a></li>';
      }).join('') + '</ul>' + (activeTodos.length ? '' : '<p class="all-clear">지금 바로 처리할 일은 없습니다.</p>');

      // 운영 건강
      var chairRate = pct(d.meetings.chairLed, d.meetings.total);
      var attRate = pct(d.attendance.present, d.attendance.total);
      var srcTotal = sum(d.sources, function (r) { return r.n; });
      var via = sum(d.sources.filter(function (r) { return /회장|운영진/.test(r.source); }), function (r) { return r.n; });
      var viaRate = pct(via, srcTotal);
      var maxSrc = Math.max.apply(null, d.sources.map(function (r) { return r.n; }).concat([1]));
      var health = '<div class="health">' +
        '<div class="item"><h3>활동 중인 회원 <b>' + mc('active') + '</b></h3><p>상회원 ' + mc('active', 'member') + '명 · 사랑방 회원 ' + mc('active', 'sarangbang') + '명 · 휴회 ' + mc('paused') + '명</p></div>' +
        '<div class="item"><h3>회장이 직접 진행한 상단 모임 <b>' + (chairRate == null ? '–' : chairRate + '%') + '</b></h3>' +
        (d.meetings.total ? '<div class="meter' + (chairRate > 30 ? ' amber' : '') + '"><i style="width:' + chairRate + '%"></i></div><p>최근 90일 모임 ' + d.meetings.total + '번 가운데 ' + d.meetings.chairLed + '번. 상단장과 회원이 진행하는 모임이 많을수록 회장이 빠져도 모임이 돌아갑니다.</p>'
          : '<p>상단 모임을 기록하면 여기에 나타납니다.</p>') + '</div>' +
        '<div class="item"><h3>상단 모임 출석률 <b>' + (attRate == null ? '–' : attRate + '%') + '</b></h3>' +
        (d.attendance.total ? '<div class="meter"><i style="width:' + attRate + '%"></i></div><p>최근 90일 출석 기록 기준입니다.</p>' : '<p>모임 기록에 출석을 체크하면 계산됩니다.</p>') + '</div>' +
        '<div class="item"><h3>가입 신청 경로 <b>' + srcTotal + '</b></h3>' +
        (srcTotal ? '<ul class="bars">' + d.sources.slice(0, 7).map(function (r) {
          return '<li class="' + (/회장|운영진/.test(r.source) ? 'hi' : '') + '"><span>' + h(r.source) + '</span><span class="bar"><i style="width:' + Math.round((r.n * 100) / maxSrc) + '%"></i></span><span>' + r.n + '</span></li>';
        }).join('') + '</ul><p>' + (viaRate >= 50
          ? '최근 1년 신청의 ' + viaRate + '%가 회장·운영진을 통해 들어왔습니다. 장날, 상회보, 회원 추천으로 들어오는 길을 넓힐 때입니다.'
          : '회장·운영진을 통한 신청은 ' + (viaRate || 0) + '%입니다. 여러 경로로 고르게 들어오고 있습니다.') + '</p>'
          : '<p>가입 신청이 들어오면 경로별로 나타납니다.</p>') + '</div>' +
        '</div>';

      // 상단 현황
      var sangdanTable = d.sangdans.length ? '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>상단</th><th>시간대</th><th class="n">인원</th><th>상단장</th><th>마지막 모임</th></tr></thead><tbody>' +
        d.sangdans.map(function (s) {
          var old = !s.last_meeting || daysAgo(s.last_meeting) > 21;
          return '<tr class="go" data-href="#/sangdans/' + enc(s.id) + '"><td class="strong" data-label="상단"><a href="#/sangdans/' + enc(s.id) + '">' + h(s.name) + '</a></td>' +
            '<td data-label="시간대">' + h(s.slot || '-') + '</td><td class="n" data-label="인원">' + s.member_count + ' / ' + s.capacity + '</td>' +
            '<td data-label="상단장">' + (s.leader_name ? h(s.leader_name) : '<span class="flag">정하지 않음</span>') + '</td>' +
            '<td data-label="마지막 모임">' + (s.last_meeting ? '<span class="' + (old ? 'flag' : '') + '">' + h(dayLabel(s.last_meeting)) + '</span>' : '<span class="flag">기록 없음</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : empty('아직 만든 상단이 없습니다.', '<a href="#/sangdans/new">첫 상단 만들기</a>');

      // 장날 신청
      var bySession = {};
      d.jangnal.forEach(function (r) {
        var k = r.session || '';
        bySession[k] = bySession[k] || { total: 0, confirmed: 0, fresh: 0 };
        if (r.status !== 'canceled') bySession[k].total += r.n;
        if (r.status === 'confirmed' || r.status === 'attended') bySession[k].confirmed += r.n;
        if (r.status === 'new') bySession[k].fresh += r.n;
      });
      var sessKeys = Object.keys(bySession).filter(function (k) { return k !== 'notify'; }).sort();
      var jangnalBox = (sessKeys.length || bySession.notify) ? '<ul class="mini-list">' + sessKeys.map(function (k) {
        var s = bySession[k];
        return '<li><a href="#/jangnal-apps?session=' + enc(k) + '">' + h(sessionName(k)) + '</a><span class="muted">신청 ' + s.total + '명 · 확정 ' + s.confirmed + '명' + (s.fresh ? ' · <span class="flag">확인 전 ' + s.fresh + '명</span>' : '') + '</span></li>';
      }).join('') + (bySession.notify ? '<li><a href="#/jangnal-apps?session=notify">다음 장날 알림만 받기</a><span class="muted">' + bySession.notify.total + '명</span></li>' : '') + '</ul>'
        : '<p class="muted">다가오는 장날 신청이 아직 없습니다.</p>';

      var recent = d.recentApps.length ? '<ul class="mini-list">' + d.recentApps.map(function (a) {
        var href = a.type === 'apply' ? '#/applications/' + enc(a.id) : '#/jangnal-apps?session=' + enc(a.session || '');
        return '<li><span><a href="' + href + '">' + h(a.name) + '</a> <span class="muted">' + (a.type === 'apply' ? '가입' : '장날') + (a.work ? ' · ' + h(a.work.slice(0, 24)) : '') + '</span></span><span class="muted">' + h(stamp(a.created_at)) + '</span></li>';
      }).join('') + '</ul>' : '<p class="muted">새로 들어온 신청이 없습니다.</p>';

      var logs = isOwner() && d.logs.length ? '<section class="block"><h2 class="sec">최근 활동 <small><a href="#/logs">전체 기록</a></small></h2><ul class="mini-list">' + d.logs.map(function (l) {
        return '<li><span>' + h(l.admin_name) + ' · ' + h(l.action) + (l.target ? ' <span class="muted">' + h(l.target) + '</span>' : '') + '</span><span class="muted">' + h(stamp(l.at)) + '</span></li>';
      }).join('') + '</ul></section>' : '';

      var v = c.put(head('오늘 할 일', { desc: dayLabel(d.today) + ' 기준입니다. 숫자를 누르면 해당 목록으로 갑니다.' }) +
        '<div class="dash"><div>' +
        '<section class="block">' + ledger + '</section>' +
        '<section class="block"><h2 class="sec">상단 현황 <small><a href="#/sangdans">상단 관리</a></small></h2>' + sangdanTable + '</section>' +
        '<section class="block"><h2 class="sec">장날 신청 <small><a href="#/schedule">장날 일정</a></small></h2>' + jangnalBox + '</section>' +
        '</div><div>' +
        '<section class="block"><h2 class="sec">운영 건강</h2>' + health + '</section>' +
        '<section class="block"><h2 class="sec">새로 들어온 신청</h2>' + recent + '</section>' + logs +
        '</div></div>', '오늘 할 일');
      if (v) goRows(v);
      refreshCounts();
    });
  };

  /* ======================================================================
     가입 신청
     ====================================================================== */
  ROUTES.applications = function (c) {
    if (c.parts[0]) return viewApplication(c, c.parts[0]);
    var status = c.query.get('status') || '';
    var q = c.query.get('q') || '';
    return api('applications' + qs({ type: 'apply', status: status, q: q })).then(function (d) {
      var cnt = {};
      d.counts.forEach(function (r) { cnt[r.status] = r.n; });
      var n = function (k) { return k.split(',').reduce(function (a, s) { return a + (cnt[s] || 0); }, 0); };
      var total = sum(d.counts, function (r) { return r.n; });
      var t = [['', '전체', total], ['new', '새 신청', n('new')], ['contacted,interview', '연락·면담', n('contacted,interview')], ['approved', '가입 승인', n('approved')],
        ['joined', '등록 완료', n('joined')], ['hold', '보류', n('hold')], ['declined', '거절', n('declined')]];
      var rows = d.items.map(function (a) {
        var href = '#/applications/' + enc(a.id);
        return '<tr class="go" data-href="' + href + '"><td data-label="접수" class="tabular">' + h(stamp(a.created_at)) + '</td>' +
          '<td class="strong" data-label="이름"><a href="' + href + '">' + h(a.name) + '</a><span class="sub">' + h(a.region) + '</span></td>' +
          '<td class="clip" data-label="하는 일"><span>' + h(a.work) + '</span></td>' +
          '<td data-label="형태">' + h(a.bizType) + '</td>' +
          '<td data-label="시간대">' + h(a.times || '-') + '</td>' +
          '<td data-label="경로">' + h(a.source || '-') + '</td>' +
          '<td data-label="상태">' + chip('apply', a.status) + '</td></tr>';
      }).join('');
      var v = c.put(head('가입 신청', {
        desc: '홈페이지 가입 신청서로 들어온 내용입니다. 연락 → 면담 → 승인 → 회원 등록 순서로 상태를 바꿔 가며 처리합니다.',
        actions: isOwner() ? '<a class="btn btn-line" href="/api/admin/export?kind=applications">목록 내려받기(CSV)</a>' : '',
      }) + tabs(t, status, function (k) { return '#/applications' + qs({ status: k, q: q }); }) +
        '<div class="toolbar"><form class="search" data-search><input name="q" type="search" value="' + h(q) + '" placeholder="이름, 연락처, 하는 일" aria-label="신청 검색"><button class="btn btn-line">찾기</button></form>' +
        '<span class="spacer"></span><span class="result-count">' + d.items.length + '건</span></div>' +
        (d.items.length ? '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>접수</th><th>이름</th><th>하는 일</th><th>형태</th><th>시간대</th><th>경로</th><th>상태</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
          : empty(q ? '찾는 신청이 없습니다.' : status ? '이 상태의 신청이 없습니다.' : '아직 들어온 가입 신청이 없습니다.', total ? '' : '홈페이지 가입 신청서(/join)로 신청이 들어오면 여기에 쌓입니다.')), '가입 신청');
      if (!v) return;
      goRows(v);
      $('[data-search]', v).addEventListener('submit', function (e) {
        e.preventDefault();
        location.hash = '#/applications' + qs({ status: status, q: $('[name=q]', e.target).value.trim() });
      });
    });
  };

  function factsHtml(item, fields) {
    var d = item.data || {};
    var rows = [['이름', h(item.name)],
      ['휴대전화', item.phone ? '<a href="tel:' + h(item.phone.replace(/[^0-9+]/g, '')) + '">' + h(item.phone) + '</a>' : '-'],
      ['이메일', item.email ? '<a href="mailto:' + h(item.email) + '">' + h(item.email) + '</a>' : '-']];
    fields.forEach(function (f) { if (d[f[0]]) rows.push([f[1], h(d[f[0]])]); });
    rows.push(['알게 된 경로', h(item.source || '-')]);
    rows.push(['접수', h(stamp(item.created_at))]);
    return '<dl class="facts">' + rows.map(function (r) { return '<dt>' + h(r[0]) + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>';
  }

  function viewApplication(c, id) {
    return api('applications/' + enc(id)).then(function (r) {
      var a = r.item;
      var isApply = a.type === 'apply';
      var back = isApply ? ['#/applications', '가입 신청'] : ['#/jangnal-apps', '장날 신청'];
      var statusList = opts(isApply ? 'apply' : 'jangnal');
      var aside = '<div class="aside-box"><h2>처리 상태</h2><form data-status>' +
        fld('상태', sel('status', a.status, statusList)) +
        fld('운영진 메모', ta('memo', a.memo, 'rows="5" placeholder="연락한 날짜, 면담 내용, 다음에 할 일"')) +
        '<div class="form-actions"><button class="btn btn-primary">저장</button></div></form></div>';
      if (isApply && !a.member_id && a.status !== 'declined') {
        aside += '<div class="aside-box"><h2>회원으로 등록</h2><p class="muted" style="margin:0 0 12px">면담을 마치고 가입이 정해지면 회원 명부에 올립니다. 신청서 내용이 그대로 옮겨집니다.</p>' +
          '<button type="button" class="btn btn-primary" data-convert>회원 명부에 올리기</button></div>';
      }
      if (a.member_id) aside += '<div class="aside-box"><h2>회원 명부</h2><p style="margin:0">이미 등록된 신청입니다. <a href="#/members/' + enc(a.member_id) + '">회원 정보 보기</a></p></div>';
      if (isOwner()) aside += '<p style="margin-top:14px"><button type="button" class="btn btn-ghost-danger" data-del>이 신청서 삭제</button></p>';

      var v = c.put(head(a.name, { crumb: back, desc: chip(isApply ? 'apply' : 'jangnal', a.status) + ' ' + (isApply ? '가입 신청' : '장날 신청 · ' + h(sessionName(a.session, a.data.sessionLabel))) }) +
        '<div class="detail"><div>' + factsHtml(a, isApply ? APPLY_FIELDS : JANGNAL_FIELDS) + '</div><div>' + aside + '</div></div>', a.name);
      if (!v) return;
      var f = $('[data-status]', v);
      trackDirty(f);
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        busy($('button', f), '저장하는 중…', function () {
          return api('applications/' + enc(id), { method: 'PATCH', body: readForm(f) });
        }).then(function () { state.dirty = false; toast('저장했습니다.'); refreshCounts(); rerender(); }).catch(fail);
      });
      var cv = $('[data-convert]', v);
      if (cv) cv.addEventListener('click', function () { convertDialog(a); });
      var del = $('[data-del]', v);
      if (del) del.addEventListener('click', function () {
        ask({ title: '신청서를 삭제할까요?', body: '<p>' + h(a.name) + '님의 신청서와 메모가 모두 지워지고 되돌릴 수 없습니다.</p>', ok: '삭제', danger: true }).then(function (ok) {
          if (!ok) return;
          api('applications/' + enc(id), { method: 'DELETE' }).then(function () {
            state.dirty = false; toast('신청서를 삭제했습니다.'); refreshCounts(); location.hash = back[0];
          }).catch(fail);
        });
      });
    });
  }

  function sangdanOptions(list, current, wantTimes) {
    return [['', '나중에 배정']].concat(list.filter(function (s) { return s.status === 'open' || s.id === current; }).map(function (s) {
      var full = s.member_count >= s.capacity && s.id !== current;
      var match = wantTimes && s.slot && wantTimes.indexOf(s.slot) >= 0;
      return [s.id, s.name + ' · ' + (s.slot || '시간대 미정') + ' · ' + s.member_count + '/' + s.capacity + '명' + (full ? ' (정원 참)' : '') + (match ? ' · 희망 시간대' : '')];
    }));
  }

  function convertDialog(a) {
    api('sangdans').then(function (sd) {
      var times = a.data.times || '';
      formDialog({
        title: a.name + '님을 회원 명부에 올리기',
        body: '<div class="form-grid">' +
          fld('구분', sel('tier', 'member', opts('tier'))) +
          fld('상단', sel('sangdan_id', '', sangdanOptions(sd.items, '', times)), { hint: times ? '희망 시간대: ' + h(times) : '희망 시간대를 적지 않았습니다.' }) +
          fld('가입일', inp('joined_at', todayStr(), 'type="date"')) +
          fld('회비', sel('fee_status', 'unpaid', opts('fee'))) +
          fld('회비 납부 기한', inp('fee_paid_until', '', 'type="date"'), { hint: '이 날짜까지 낸 것으로 봅니다.' }) +
          '<div class="full checks">' + chk('verified', false, '사업자 확인을 마쳤습니다') + chk('charter_signed', !!a.data.consentCharter, '헌장 서약을 받았습니다') + chk('founding', false, '창립 상회원') + '</div>' +
          '</div>',
        ok: '명부에 올리기',
        onOpen: function (f) {
          var tier = $('[name=tier]', f);
          var sd2 = $('[name=sangdan_id]', f);
          tier.addEventListener('change', function () { sd2.disabled = tier.value !== 'member'; });
        },
        submit: function (v) {
          return api('applications/' + enc(a.id) + '/convert', { method: 'POST', body: v }).then(function (r) {
            state.dirty = false;
            toast('회원 명부에 올렸습니다.');
            refreshCounts();
            location.hash = '#/members/' + enc(r.id);
          });
        },
      });
    }).catch(fail);
  }

  /* ======================================================================
     장날 신청
     ====================================================================== */
  ROUTES['jangnal-apps'] = function (c) {
    if (c.parts[0]) return viewApplication(c, c.parts[0]);
    var status = c.query.get('status') || '';
    var session = c.query.get('session') || '';
    var q = c.query.get('q') || '';
    return api('applications' + qs({ type: 'jangnal', status: status, session: session, q: q })).then(function (d) {
      var cnt = {};
      d.counts.forEach(function (r) { cnt[r.status] = r.n; });
      var total = sum(d.counts, function (r) { return r.n; });
      var t = [['', '전체', total]].concat(opts('jangnal').map(function (o) { return [o[0], o[1], cnt[o[0]] || 0]; }));
      var sessionOpts = [['', '모든 장날']].concat(d.sessions.map(function (s) { return [s.session, sessionName(s.session) + ' (' + s.n + ')']; }));
      var rows = d.items.map(function (a) {
        return '<tr><td data-label="접수" class="tabular">' + h(stamp(a.created_at)) + '</td>' +
          '<td data-label="장날">' + h(sessionName(a.session, a.sessionLabel)) + '</td>' +
          '<td class="strong" data-label="이름"><a href="#/jangnal-apps/' + enc(a.id) + '">' + h(a.name) + '</a><span class="sub">' + h(a.phone) + (a.email ? ' · ' + h(a.email) : '') + '</span></td>' +
          '<td class="clip" data-label="하는 일"><span>' + h(a.work) + '</span></td>' +
          '<td class="clip" data-label="고민"><span>' + h(a.question || '-') + '</span></td>' +
          '<td data-label="경로">' + h(a.source || '-') + '</td>' +
          '<td data-label="상태">' + sel('st', a.status, opts('jangnal'), 'data-id="' + h(a.id) + '" aria-label="' + h(a.name) + ' 상태"') + '</td></tr>';
      }).join('');
      var v = c.put(head('장날 신청', {
        desc: '장날 참가 신청과 다음 장날 알림 신청입니다. 상태를 바꾸면 바로 저장됩니다.',
        actions: (isOwner() ? '<a class="btn btn-line" href="/api/admin/export?kind=jangnal">목록 내려받기(CSV)</a>' : '') + '<a class="btn btn-line" href="#/schedule">장날 일정 고치기</a>',
      }) + tabs(t, status, function (k) { return '#/jangnal-apps' + qs({ status: k, session: session, q: q }); }) +
        '<div class="toolbar">' + sel('session', session, sessionOpts, 'aria-label="장날 고르기" data-session') +
        '<form class="search" data-search><input name="q" type="search" value="' + h(q) + '" placeholder="이름, 연락처" aria-label="신청 검색"><button class="btn btn-line">찾기</button></form>' +
        '<span class="spacer"></span><span class="result-count">' + d.items.length + '명</span></div>' +
        (d.items.length ? '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>접수</th><th>장날</th><th>이름·연락처</th><th>하는 일</th><th>이야기하고 싶은 고민</th><th>경로</th><th>상태</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
          : empty(total ? '조건에 맞는 신청이 없습니다.' : '아직 들어온 장날 신청이 없습니다.', total ? '' : '장날 일정에서 상태를 “신청 받는 중”으로 두면 홈페이지 신청서에 날짜가 나타납니다.')), '장날 신청');
      if (!v) return;
      $('[data-session]', v).addEventListener('change', function (e) { location.hash = '#/jangnal-apps' + qs({ status: status, session: e.target.value, q: q }); });
      $('[data-search]', v).addEventListener('submit', function (e) {
        e.preventDefault();
        location.hash = '#/jangnal-apps' + qs({ status: status, session: session, q: $('[name=q]', e.target).value.trim() });
      });
      $$('select[data-id]', v).forEach(function (s) {
        var prev = s.value;
        s.addEventListener('change', function () {
          s.disabled = true;
          api('applications/' + enc(s.getAttribute('data-id')), { method: 'PATCH', body: { status: s.value } }).then(function () {
            prev = s.value; s.disabled = false; toast(s.closest('tr').querySelector('.strong a').textContent + '님을 “' + L.jangnal[s.value] + '”' + ro(L.jangnal[s.value]) + ' 바꿨습니다.');
            refreshCounts();
          }).catch(function (e) { s.value = prev; s.disabled = false; fail(e); });
        });
      });
    });
  };

  /* ======================================================================
     회원 명부
     ====================================================================== */
  ROUTES.members = function (c) {
    if (c.parts[0]) return viewMember(c, c.parts[0]);
    var status = c.query.has('status') ? c.query.get('status') : 'active';
    var tier = c.query.get('tier') || '';
    var sangdan = c.query.get('sangdan') || '';
    var fee = c.query.get('fee') || '';
    var q = c.query.get('q') || '';
    var params = { status: status, tier: tier, sangdan: sangdan, fee: fee, q: q };
    var link = function (over) { var p = Object.assign({}, params, over); return '#/members' + qs(p); };
    return Promise.all([api('members' + qs({ status: status === 'all' ? '' : status, tier: tier, sangdan: sangdan, fee: fee, q: q })), api('sangdans')]).then(function (r) {
      var d = r[0];
      var sds = r[1].items;
      var t = [['active', '활동'], ['paused', '휴회'], ['left', '탈퇴'], ['all', '전체']];
      var rows = d.items.map(function (m) {
        var href = '#/members/' + enc(m.id);
        var feeFlag = m.fee_status === 'unpaid' || (m.fee_status === 'paid' && (!m.fee_paid_until || m.fee_paid_until < todayStr()));
        return '<tr class="go" data-href="' + href + '"><td class="strong" data-label="이름"><a href="' + href + '">' + h(m.name) + '</a>' + (m.founding ? '<span class="sub">창립 상회원</span>' : '') + '</td>' +
          '<td class="clip" data-label="하는 일"><span>' + h(m.work || '-') + '</span></td>' +
          '<td data-label="구분">' + h(L.tier[m.tier]) + '</td>' +
          '<td data-label="상단">' + (m.sangdan_name ? h(m.sangdan_name) : m.tier === 'member' ? '<span class="flag">미배정</span>' : '-') + '</td>' +
          '<td data-label="역할">' + h(splitList(m.roles, ',').join(', ') || '-') + '</td>' +
          '<td data-label="가입일" class="tabular">' + h(m.joined_at || '-') + '</td>' +
          '<td data-label="회비">' + chip('fee', m.fee_status) + (m.fee_paid_until ? '<span class="sub' + (feeFlag ? ' flag' : '') + '">' + h(m.fee_paid_until) + '까지</span>' : '') + '</td>' +
          '<td data-label="상태">' + chip('member', m.status) + (m.status === 'paused' && m.paused_until ? '<span class="sub">' + h(m.paused_until) + ' 복귀</span>' : '') + '</td></tr>';
      }).join('');
      var sangdanOpts = [['', '모든 상단'], ['none', '상단 미배정']].concat(sds.map(function (s) { return [s.id, s.name]; }));
      var v = c.put(head('회원 명부', {
        desc: '상회원과 사랑방 회원의 명부입니다. 가입 신청에서 “회원 명부에 올리기”를 누르면 여기에 추가됩니다.',
        actions: (isOwner() ? '<a class="btn btn-line" href="/api/admin/export?kind=members">명부 내려받기(CSV)</a>' : '') + '<a class="btn btn-primary" href="#/members/new">회원 직접 등록</a>',
      }) + tabs(t, status, function (k) { return link({ status: k }); }) +
        '<div class="toolbar">' + sel('tier', tier, [['', '모든 구분']].concat(opts('tier')), 'aria-label="구분" data-f="tier"') +
        sel('sangdan', sangdan, sangdanOpts, 'aria-label="상단" data-f="sangdan"') +
        '<label class="check"><input type="checkbox" data-fee' + (fee === 'due' ? ' checked' : '') + '> <span>회비 확인 필요만</span></label>' +
        '<form class="search" data-search><input name="q" type="search" value="' + h(q) + '" placeholder="이름, 연락처, 하는 일, 메모" aria-label="회원 검색"><button class="btn btn-line">찾기</button></form>' +
        '<span class="spacer"></span><span class="result-count">' + d.items.length + '명</span></div>' +
        (fee === 'due' ? '<div class="note"><p>회비가 미납이거나 납부 기한이 2주 안에 끝나는 활동 회원입니다.</p></div>' : '') +
        (d.items.length ? '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>이름</th><th>하는 일</th><th>구분</th><th>상단</th><th>역할</th><th>가입일</th><th>회비</th><th>상태</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
          : empty(q || tier || sangdan || fee ? '조건에 맞는 회원이 없습니다.' : '명부에 회원이 없습니다.', '<a href="#/applications?status=approved">가입 승인한 신청 보기</a>')), '회원 명부');
      if (!v) return;
      goRows(v);
      $$('[data-f]', v).forEach(function (s) {
        s.addEventListener('change', function () { var o = {}; o[s.getAttribute('data-f')] = s.value; location.hash = link(o); });
      });
      $('[data-fee]', v).addEventListener('change', function (e) { location.hash = link({ fee: e.target.checked ? 'due' : '', status: e.target.checked ? 'active' : status }); });
      $('[data-search]', v).addEventListener('submit', function (e) { e.preventDefault(); location.hash = link({ q: $('[name=q]', e.target).value.trim() }); });
    });
  };

  function viewMember(c, id) {
    var isNew = id === 'new';
    return Promise.all([isNew ? null : api('members/' + enc(id)), api('sangdans')]).then(function (r) {
      var m = isNew ? { tier: 'member', status: 'active', fee_status: 'unpaid', roles: '', times: '', joined_at: todayStr() } : r[0].item;
      var att = isNew ? null : r[0].attendance;
      var sds = r[1].items;
      var times = splitList(m.times);
      var roles = splitList(m.roles, ',');
      var form = '<form data-member novalidate><div class="form-grid">' +
        fld('이름', inp('name', m.name, 'required autocomplete="off"')) +
        fld('휴대전화', inp('phone', m.phone, 'type="tel" autocomplete="off"')) +
        fld('이메일', inp('email', m.email, 'type="email" autocomplete="off"')) +
        fld('주로 일하는 지역', inp('region', m.region)) +
        fld('하는 일', ta('work', m.work, 'rows="2"'), { full: true }) +
        fld('사업 형태', sel('biz_type', m.biz_type || '', [['', '선택']].concat(BIZ))) +
        fld('업력', sel('years', m.years || '', [['', '선택']].concat(YEARS))) +
        fld('함께 일하는 사람', sel('size', m.size || '', [['', '선택']].concat(SIZES))) +
        group('참석하기 좋은 시간대', multi('times', times, SLOTS)) +
        '</div><h2 class="sec" style="margin-top:28px">상회 활동</h2><div class="form-grid">' +
        fld('구분', sel('tier', m.tier, opts('tier'))) +
        fld('상태', sel('status', m.status, opts('member'))) +
        fld('상단', sel('sangdan_id', m.sangdan_id || '', sangdanOptions(sds, m.sangdan_id, m.times)), { hint: '사랑방 회원은 상단에 들어가지 않습니다.' }) +
        fld('휴회 끝나는 날', inp('paused_until', m.paused_until, 'type="date"'), { hint: '휴회는 한 번에 3개월까지입니다.' }) +
        group('맡은 역할', multi('roles', roles, ROLES), { full: true }) +
        fld('가입일', inp('joined_at', m.joined_at, 'type="date"')) +
        fld('회비', sel('fee_status', m.fee_status, opts('fee'))) +
        fld('회비 납부 기한', inp('fee_paid_until', m.fee_paid_until, 'type="date"'), { hint: '이 날짜까지 낸 것으로 봅니다.' }) +
        '<div class="full checks">' + chk('verified', !!m.verified, '사업자 확인을 마쳤습니다') + chk('charter_signed', !!m.charter_signed, '헌장 서약을 받았습니다') + chk('founding', !!m.founding, '창립 상회원') + '</div>' +
        fld('운영진 메모', ta('memo', m.memo, 'rows="4" placeholder="면담 내용, 소개해 줄 만한 회원, 챙길 일"'), { full: true }) +
        '</div><div class="form-actions"><button class="btn btn-primary">' + (isNew ? '명부에 등록' : '저장') + '</button><a class="btn btn-line" href="#/members">목록으로</a></div></form>';

      var aside = '';
      if (!isNew) {
        var rate = pct(att.present, att.total);
        aside += '<div class="aside-box"><h2>상단 출석</h2><div class="stat-line"><div><b>' + (rate == null ? '–' : rate + '%') + '</b><span>출석률</span></div><div><b>' + att.present + '/' + att.total + '</b><span>참석 / 기록된 모임</span></div></div>' +
          (att.recent.length ? '<ul class="mini-list">' + att.recent.map(function (x) {
            return '<li><span>' + h(dayLabel(x.date)) + ' <span class="muted">' + h(x.sangdan_name || '') + '</span></span><span>' + (x.present ? '참석' : '<span class="flag">불참</span>') + '</span></li>';
          }).join('') + '</ul>' : '<p class="muted" style="margin:8px 0 0">아직 출석 기록이 없습니다.</p>') + '</div>';
        aside += '<div class="aside-box"><h2>가입 정보</h2><ul class="mini-list"><li><span class="muted">가입 경로</span><span>' + h(m.source || '-') + '</span></li>' +
          '<li><span class="muted">명부 등록</span><span>' + h(stamp(m.created_at)) + '</span></li>' +
          (m.application_id ? '<li><span class="muted">가입 신청서</span><a href="#/applications/' + enc(m.application_id) + '">보기</a></li>' : '') + '</ul></div>';
        if (m.status === 'left') aside += '<div class="note red" style="margin-top:16px"><p>탈퇴한 회원의 정보는 처리방침에 따라 지체 없이 파기합니다. ' + (isOwner() ? '아래에서 바로 삭제하거나, 개인정보 관리 화면에서 한꺼번에 정리할 수 있습니다.' : '회장 계정에서 삭제할 수 있습니다.') + '</p></div>';
        if (isOwner()) aside += '<p style="margin-top:14px"><button type="button" class="btn btn-ghost-danger" data-del>회원 정보 완전 삭제</button></p>';
      }

      var v = c.put(head(isNew ? '회원 직접 등록' : m.name, {
        crumb: ['#/members', '회원 명부'],
        desc: isNew ? '가입 신청서 없이 들어온 회원을 등록합니다. 처음 모인 창립 회원을 옮겨 적을 때 씁니다.' : chip('member', m.status) + ' ' + h(L.tier[m.tier]) + (m.sangdan_name ? ' · ' + h(m.sangdan_name) + ' 상단' : ''),
      }) + (isNew ? form : '<div class="detail"><div>' + form + '</div><div>' + aside + '</div></div>'), isNew ? '회원 등록' : m.name);
      if (!v) return;
      var f = $('[data-member]', v);
      trackDirty(f);
      var tierSel = $('[name=tier]', f);
      var sdSel = $('[name=sangdan_id]', f);
      var syncTier = function () { sdSel.disabled = tierSel.value !== 'member'; };
      tierSel.addEventListener('change', syncTier);
      syncTier();
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var b = readForm(f);
        if (!b.name) { toast('이름을 적어 주세요.', true); $('[name=name]', f).focus(); return; }
        b.times = (b.times || []).join(', ');
        b.roles = (b.roles || []).join(',');
        if (b.tier !== 'member') b.sangdan_id = '';
        if (b.status !== 'paused') b.paused_until = '';
        busy($('button.btn-primary', f), '저장하는 중…', function () {
          return api(isNew ? 'members' : 'members/' + enc(id), { method: isNew ? 'POST' : 'PATCH', body: b });
        }).then(function (res) {
          state.dirty = false;
          if (isNew) { toast('명부에 등록했습니다.'); location.hash = '#/members/' + enc(res.id); }
          else { toast('저장했습니다.'); rerender(); }
        }).catch(fail);
      });
      var del = $('[data-del]', v);
      if (del) del.addEventListener('click', function () {
        ask({ title: '회원 정보를 완전히 삭제할까요?', body: '<p>' + h(m.name) + '님의 명부 정보, 가입 신청서, 상단 출석 기록이 모두 지워지고 되돌릴 수 없습니다.</p>', ok: '완전 삭제', danger: true, typed: m.name }).then(function (ok) {
          if (!ok) return;
          api('members/' + enc(id), { method: 'DELETE' }).then(function () { state.dirty = false; toast('회원 정보를 삭제했습니다.'); location.hash = '#/members'; }).catch(fail);
        });
      });
    });
  }

  /* ======================================================================
     상단
     ====================================================================== */
  ROUTES.sangdans = function (c) {
    if (c.parts[0]) return viewSangdan(c, c.parts[0]);
    return Promise.all([api('sangdans'), api('members' + qs({ status: 'active', tier: 'member', sangdan: 'none' }))]).then(function (r) {
      var list = r[0].items;
      var waiting = r[1].items;
      var bySlot = {};
      SLOTS.concat(['시간대 미정']).forEach(function (s) { bySlot[s] = 0; });
      waiting.forEach(function (m) {
        var t = splitList(m.times);
        if (!t.length) bySlot['시간대 미정']++;
        t.forEach(function (s) { if (bySlot[s] != null) bySlot[s]++; });
      });
      var rows = list.map(function (s) {
        var href = '#/sangdans/' + enc(s.id);
        var old = s.status === 'open' && (!s.last_meeting || daysAgo(s.last_meeting) > 21);
        return '<tr class="go" data-href="' + href + '"><td class="strong" data-label="상단"><a href="' + href + '">' + h(s.name) + '</a></td>' +
          '<td data-label="시간대">' + h(s.slot || '-') + '</td><td data-label="모임 일정">' + h(s.schedule || '-') + '</td>' +
          '<td class="n" data-label="인원">' + s.member_count + ' / ' + s.capacity + (s.paused_count ? '<span class="sub">휴회 ' + s.paused_count + '</span>' : '') + '</td>' +
          '<td data-label="상단장">' + (s.leader_name ? h(s.leader_name) : '<span class="flag">정하지 않음</span>') + '</td>' +
          '<td data-label="마지막 모임">' + (s.last_meeting ? '<span class="' + (old ? 'flag' : '') + '">' + h(dayLabel(s.last_meeting)) + '</span>' : '<span class="' + (s.status === 'open' ? 'flag' : 'muted') + '">기록 없음</span>') + '</td>' +
          '<td data-label="상태">' + chip('sangdan', s.status) + '</td></tr>';
      }).join('');
      var waitBox = waiting.length ? '<div class="note plain"><p><strong>상단 배정을 기다리는 상회원 ' + waiting.length + '명</strong> (' +
        Object.keys(bySlot).filter(function (k) { return bySlot[k]; }).map(function (k) { return h(k) + ' ' + bySlot[k] + '명'; }).join(', ') +
        ') <a href="#/members?status=active&tier=member&sangdan=none">명단 보기</a></p><p class="muted">한 사람이 여러 시간대를 고를 수 있어 합계가 다를 수 있습니다.</p></div>' : '';
      var v = c.put(head('상단', {
        desc: '상회원이 고정된 소그룹으로 정기적으로 만나는 단위입니다. 상단마다 상단장을 정하고, 모임을 할 때마다 출석과 진행자를 기록합니다.',
        actions: '<a class="btn btn-primary" href="#/sangdans/new">새 상단 만들기</a>',
      }) + waitBox +
        (list.length ? '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>상단</th><th>시간대</th><th>모임 일정</th><th class="n">인원</th><th>상단장</th><th>마지막 모임</th><th>상태</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
          : empty('아직 만든 상단이 없습니다.', '<a href="#/sangdans/new">첫 상단 만들기</a>')), '상단');
      if (v) goRows(v);
    });
  };

  function viewSangdan(c, id) {
    var isNew = id === 'new';
    return Promise.all([
      isNew ? null : api('sangdans/' + enc(id)),
      isNew ? { items: [] } : api('members' + qs({ status: 'active', tier: 'member', sangdan: 'none' })),
    ]).then(function (r) {
      var d = isNew ? { item: { name: '', slot: c.query.get('slot') || '', schedule: '', capacity: 8, status: 'open', memo: '', leader_id: '' }, members: [], meetings: [] } : r[0];
      var s = d.item;
      var waiting = r[1].items;
      var activeMembers = d.members.filter(function (m) { return m.status === 'active'; });
      var infoForm = '<form data-info novalidate><div class="form-grid' + (isNew ? '' : '') + '">' +
        fld('상단 이름', inp('name', s.name, 'required placeholder="예: 화요 저녁 상단"'), { full: !isNew }) +
        fld('시간대', sel('slot', s.slot, [['', '정하지 않음']].concat(SLOTS))) +
        fld('정원', inp('capacity', s.capacity, 'type="number" min="3" max="12"')) +
        fld('모임 일정', inp('schedule', s.schedule, 'placeholder="예: 격주 화요일 저녁 7시 30분"'), { full: true }) +
        (isNew ? '' : fld('상단장', sel('leader_id', s.leader_id || '', [['', '정하지 않음']].concat(activeMembers.map(function (m) { return [m.id, m.name]; }))), { full: true, hint: '이 상단에 속한 활동 회원 가운데서 고릅니다.' })) +
        fld('상태', sel('status', s.status, opts('sangdan'))) +
        fld('운영진 메모', ta('memo', s.memo, 'rows="3"'), { full: true }) +
        '</div><div class="form-actions"><button class="btn btn-primary">' + (isNew ? '상단 만들기' : '저장') + '</button></div></form>';

      if (isNew) {
        var v0 = c.put(head('새 상단 만들기', { crumb: ['#/sangdans', '상단'], desc: '이름과 시간대를 정해 상단을 만든 뒤, 기다리는 상회원을 넣고 상단장을 정합니다.' }) + '<div style="max-width:640px">' + infoForm + '</div>', '새 상단');
        if (v0) bindInfo(v0);
        return;
      }

      var memberRows = d.members.map(function (m) {
        var rate = pct(m.present || 0, m.total || 0);
        return '<tr><td class="strong" data-label="이름"><a href="#/members/' + enc(m.id) + '">' + h(m.name) + '</a>' + (s.leader_id === m.id ? '<span class="sub">상단장</span>' : '') + '</td>' +
          '<td class="clip" data-label="하는 일"><span>' + h(m.work || '-') + '</span></td>' +
          '<td data-label="출석" class="tabular">' + (m.total ? (m.present || 0) + '/' + m.total + ' (' + rate + '%)' : '-') + '</td>' +
          '<td data-label="상태">' + chip('member', m.status) + '</td>' +
          '<td class="nolabel"><button type="button" class="btn btn-sm btn-line" data-out="' + h(m.id) + '" data-name="' + h(m.name) + '">상단에서 빼기</button></td></tr>';
      }).join('');
      var full = activeMembers.length >= s.capacity;
      var addBox = !full && waiting.length ? '<form class="toolbar" data-add style="margin-top:12px">' +
        sel('member', '', [['', '기다리는 상회원 고르기']].concat(waiting.map(function (m) {
          var match = s.slot && splitList(m.times).indexOf(s.slot) >= 0;
          return [m.id, m.name + (m.times ? ' · ' + m.times : '') + (match ? ' (시간대 맞음)' : '')];
        })), 'aria-label="넣을 회원"') + '<button class="btn btn-line">이 상단에 넣기</button></form>'
        : (full ? '<p class="muted">정원이 찼습니다.</p>' : '<p class="muted">배정을 기다리는 상회원이 없습니다.</p>');

      var meetingRows = d.meetings.map(function (g) {
        return '<tr><td data-label="날짜" class="strong">' + h(dayLabel(g.date)) + '</td><td data-label="방식">' + h(L.mode[g.mode] || g.mode) + '</td>' +
          '<td data-label="진행">' + h(g.facilitator || '-') + (g.chair_led ? '<span class="sub">회장 진행</span>' : '') + '</td>' +
          '<td data-label="출석" class="tabular">' + (g.total ? (g.present || 0) + '/' + g.total : '-') + '</td>' +
          '<td class="clip" data-label="메모"><span>' + h(g.note || '-') + '</span></td>' +
          '<td class="nolabel" style="white-space:nowrap"><button type="button" class="btn btn-sm btn-line" data-edit-meeting="' + h(g.id) + '">고치기</button></td></tr>';
      }).join('');

      var v = c.put(head(s.name, { crumb: ['#/sangdans', '상단'], desc: chip('sangdan', s.status) + ' ' + h(s.slot || '시간대 미정') + (s.schedule ? ' · ' + h(s.schedule) : '') + ' · ' + activeMembers.length + '/' + s.capacity + '명',
        actions: '<button type="button" class="btn btn-primary" data-new-meeting' + (activeMembers.length ? '' : ' disabled') + '>모임 기록하기</button>' }) +
        '<div class="detail"><div>' +
        '<section class="block"><h2 class="sec">회원 <small>' + d.members.length + '명</small></h2>' +
        (d.members.length ? '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>이름</th><th>하는 일</th><th>출석</th><th>상태</th><th><span class="sr">관리</span></th></tr></thead><tbody>' + memberRows + '</tbody></table></div>' : empty('아직 이 상단에 회원이 없습니다.')) + addBox + '</section>' +
        '<section class="block"><h2 class="sec">모임 기록 <small>최근 30번</small></h2>' +
        (d.meetings.length ? '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>날짜</th><th>방식</th><th>진행</th><th>출석</th><th>메모</th><th><span class="sr">관리</span></th></tr></thead><tbody>' + meetingRows + '</tbody></table></div>'
          : empty('아직 모임 기록이 없습니다.', '모임을 마칠 때마다 상단장이나 운영진이 출석과 진행자를 남깁니다.')) + '</section>' +
        '</div><div><div class="aside-box"><h2>상단 정보</h2>' + infoForm + '</div>' +
        '<p style="margin-top:14px"><button type="button" class="btn btn-ghost-danger" data-del>상단 지우기</button></p></div></div>', s.name);
      if (!v) return;
      bindInfo(v);
      var add = $('[data-add]', v);
      if (add) add.addEventListener('submit', function (e) {
        e.preventDefault();
        var mid = $('[name=member]', add).value;
        if (!mid) return;
        busy($('button', add), '넣는 중…', function () { return api('members/' + enc(mid), { method: 'PATCH', body: { sangdan_id: id } }); })
          .then(function () { toast('상단에 넣었습니다.'); rerender(); }).catch(fail);
      });
      $$('[data-out]', v).forEach(function (b) {
        b.addEventListener('click', function () {
          ask({ title: '상단에서 뺄까요?', body: '<p>' + h(b.getAttribute('data-name')) + '님을 이 상단에서 빼고 배정 대기로 돌립니다. 출석 기록은 남습니다.</p>', ok: '빼기' }).then(function (ok) {
            if (!ok) return;
            api('members/' + enc(b.getAttribute('data-out')), { method: 'PATCH', body: { sangdan_id: '' } }).then(function () { toast('상단에서 뺐습니다.'); rerender(); }).catch(fail);
          });
        });
      });
      $('[data-new-meeting]', v).addEventListener('click', function () { meetingDialog(s, d.members, null); });
      $$('[data-edit-meeting]', v).forEach(function (b) {
        b.addEventListener('click', function () {
          api('meetings/' + enc(b.getAttribute('data-edit-meeting'))).then(function (g) { meetingDialog(s, d.members, g); }).catch(fail);
        });
      });
      $('[data-del]', v).addEventListener('click', function () {
        ask({ title: '상단을 지울까요?', body: '<p>모임 기록도 함께 지워집니다. 회원이 남아 있으면 지울 수 없으니, 먼저 회원을 옮기거나 상태를 “닫음”으로 바꿔 주세요.</p>', ok: '지우기', danger: true }).then(function (ok) {
          if (!ok) return;
          api('sangdans/' + enc(id), { method: 'DELETE' }).then(function () { state.dirty = false; toast('상단을 지웠습니다.'); location.hash = '#/sangdans'; }).catch(fail);
        });
      });
    });

    function bindInfo(v) {
      var f = $('[data-info]', v);
      trackDirty(f);
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var b = readForm(f);
        if (!b.name) { toast('상단 이름을 적어 주세요.', true); return; }
        busy($('button.btn-primary', f), '저장하는 중…', function () {
          return api(isNew ? 'sangdans' : 'sangdans/' + enc(id), { method: isNew ? 'POST' : 'PATCH', body: b });
        }).then(function (res) {
          state.dirty = false;
          if (isNew) { toast('상단을 만들었습니다.'); location.hash = '#/sangdans/' + enc(res.id); }
          else { toast('저장했습니다.'); rerender(); }
        }).catch(fail);
      });
    }
  }

  function meetingDialog(s, members, g) {
    var item = g ? g.item : null;
    var present = {};
    if (g) g.attendance.forEach(function (a) { present[a.member_id] = !!a.present; });
    var people = members.filter(function (m) { return m.status === 'active' || (g && present[m.id] != null); });
    var names = people.map(function (m) { return m.name; });
    formDialog({
      title: s.name + ' 모임 ' + (g ? '기록 고치기' : '기록하기'),
      wide: true,
      body: '<div class="form-grid">' +
        fld('날짜', inp('date', item ? item.date : todayStr(), 'type="date" required')) +
        fld('방식', sel('mode', item ? item.mode : 'offline', opts('mode'))) +
        fld('진행한 사람', inp('facilitator', item ? item.facilitator : (s.leader_name || ''), 'list="facilitators" autocomplete="off"') + '<datalist id="facilitators">' + names.map(function (n) { return '<option value="' + h(n) + '">'; }).join('') + '</datalist>') +
        '<div class="field" style="justify-content:flex-end">' + chk('chair_led', item ? !!item.chair_led : false, '회장이 진행했습니다') + '</div>' +
        group('출석', multi('present', people.filter(function (m) { return g ? present[m.id] : true; }).map(function (m) { return m.id; }), people.map(function (m) { return [m.id, m.name]; })), { full: true, hint: '참석한 사람만 체크합니다.' }) +
        fld('메모', ta('note', item ? item.note : '', 'rows="3" placeholder="핫시트 주인공, 나눈 이야기, 다음 모임까지 할 일"'), { full: true, hint: '회원의 사업 정보는 헌장 2조에 따라 꼭 필요한 만큼만 적습니다.' }) +
        '</div>' + (g ? '<p style="margin:14px 0 0"><button type="button" class="btn btn-ghost-danger" data-del-meeting>이 기록 지우기</button></p>' : ''),
      ok: g ? '저장' : '기록하기',
      onOpen: function (f) {
        var del = $('[data-del-meeting]', f);
        if (del) del.addEventListener('click', function () {
          if (!window.confirm('이 모임 기록을 지울까요? 출석 기록도 함께 지워집니다.')) return;
          api('meetings/' + enc(item.id), { method: 'DELETE' }).then(function () { $('#dlg').close('ok'); toast('모임 기록을 지웠습니다.'); rerender(); }).catch(fail);
        });
      },
      submit: function (v) {
        if (!v.date) throw new Error('날짜를 적어 주세요.');
        var att = {};
        people.forEach(function (m) { att[m.id] = (v.present || []).indexOf(m.id) >= 0; });
        var body = { sangdan_id: s.id, date: v.date, mode: v.mode, facilitator: v.facilitator, chair_led: v.chair_led, note: v.note, attendance: att };
        return api(g ? 'meetings/' + enc(item.id) : 'meetings', { method: g ? 'PATCH' : 'POST', body: body }).then(function () {
          toast(g ? '모임 기록을 고쳤습니다.' : '모임을 기록했습니다.');
          rerender();
        });
      },
    });
  }

  /* ======================================================================
     장날 일정 (site.json → GitHub)
     ====================================================================== */
  ROUTES.schedule = function (c) {
    if (!state.info.github) return c.put(githubNeeded('장날 일정'), '장날 일정');
    return Promise.all([api('site'), api('applications' + qs({ type: 'jangnal' })).catch(function () { return { sessions: [] }; })]).then(function (r) {
      var sha = r[0].sha;
      var rows = (r[0].data.jangnal || []).map(function (x) { return Object.assign({ date: '', time: '19:30', place: '', topic: '', status: 'soon' }, x); });
      var apps = {};
      (r[1].sessions || []).forEach(function (s) { apps[s.session] = s.n; });
      var v = c.put(head('장날 일정', {
        desc: '홈페이지의 장날 일정과 신청서 날짜 목록이 이 표에서 만들어집니다. 저장하면 1~2분 뒤 홈페이지에 반영됩니다.',
      }) + '<div class="note plain"><p><strong>신청 받는 중</strong>이면 홈페이지 신청서에 날짜가 나타나고, <strong>신청 준비 중</strong>이면 일정만 보입니다. <strong>마감</strong>은 일정에 “마감”으로 표시됩니다. 지난 날짜는 홈페이지에 나오지 않습니다.</p></div>' +
        '<div data-table></div>' +
        '<div class="form-actions"><button type="button" class="btn btn-line" data-add>일정 추가</button><button type="button" class="btn btn-line" data-clean>지난 일정 정리</button><span class="spacer"></span><button type="button" class="btn btn-primary" data-save>저장하고 홈페이지에 반영</button></div>', '장날 일정');
      if (!v) return;
      var box = $('[data-table]', v);
      function draw() {
        var t = todayStr();
        box.innerHTML = rows.length ? '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>날짜</th><th>시간</th><th>장소</th><th>주제</th><th>상태</th><th class="n">신청</th><th><span class="sr">지우기</span></th></tr></thead><tbody>' +
          rows.map(function (s, i) {
            return '<tr class="' + (s.date && s.date < t ? 'past' : '') + '" data-i="' + i + '">' +
              '<td data-label="날짜">' + inp('date', s.date, 'type="date" required aria-label="날짜"') + '</td>' +
              '<td data-label="시간">' + inp('time', s.time, 'type="time" aria-label="시간"') + '</td>' +
              '<td data-label="장소">' + inp('place', s.place, 'placeholder="비워 두면 신청자에게 따로 안내" aria-label="장소"') + '</td>' +
              '<td data-label="주제">' + inp('topic', s.topic, 'placeholder="예: 가격 올리기" aria-label="주제"') + '</td>' +
              '<td data-label="상태">' + sel('status', s.status, opts('jstatus'), 'aria-label="상태"') + '</td>' +
              '<td class="n" data-label="신청">' + (apps[s.date] ? '<a href="#/jangnal-apps?session=' + enc(s.date) + '">' + apps[s.date] + '명</a>' : '-') + '</td>' +
              '<td class="nolabel"><button type="button" class="btn btn-sm btn-ghost-danger" data-remove="' + i + '">지우기</button></td></tr>';
          }).join('') + '</tbody></table></div>'
          : empty('등록한 장날 일정이 없습니다.', '“일정 추가”를 눌러 다음 장날을 넣어 주세요.');
      }
      draw();
      box.addEventListener('input', function (e) {
        var tr = e.target.closest('tr[data-i]');
        if (!tr || !e.target.name) return;
        rows[+tr.getAttribute('data-i')][e.target.name] = e.target.value;
        state.dirty = true;
      });
      box.addEventListener('change', function (e) {
        var tr = e.target.closest('tr[data-i]');
        if (!tr || !e.target.name) return;
        rows[+tr.getAttribute('data-i')][e.target.name] = e.target.value;
        state.dirty = true;
      });
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-remove]');
        if (!b) return;
        rows.splice(+b.getAttribute('data-remove'), 1);
        state.dirty = true;
        draw();
      });
      $('[data-add]', v).addEventListener('click', function () {
        rows.push({ date: '', time: '19:30', place: '', topic: '', status: 'soon' });
        state.dirty = true;
        draw();
        var last = $$('tr[data-i]', box).pop();
        if (last) $('input', last).focus();
      });
      $('[data-clean]', v).addEventListener('click', function () {
        var t = todayStr();
        var before = rows.length;
        rows = rows.filter(function (s) { return !s.date || s.date >= t; });
        if (rows.length !== before) { state.dirty = true; draw(); toast('지난 일정 ' + (before - rows.length) + '개를 뺐습니다. 저장해야 반영됩니다.'); }
        else toast('지난 일정이 없습니다.');
      });
      $('[data-save]', v).addEventListener('click', function (e) {
        var bad = rows.filter(function (s) { return !/^\d{4}-\d{2}-\d{2}$/.test(s.date); });
        if (bad.length) { toast('날짜가 비어 있는 일정이 있습니다.', true); return; }
        busy(e.currentTarget, '저장하는 중…', function () {
          return api('site', { method: 'PUT', body: { section: 'jangnal', value: rows, sha: sha } });
        }).then(function (res) {
          sha = res.sha;
          state.dirty = false;
          rows.sort(function (a, b) { return a.date.localeCompare(b.date); });
          draw();
          toast('저장했습니다. 1~2분 뒤 홈페이지에 반영됩니다.');
        }).catch(fail);
      });
    });
  };

  /* ======================================================================
     상회보
     ====================================================================== */
  ROUTES.journal = function (c) {
    if (!state.info.github) return c.put(githubNeeded('상회보'), '상회보');
    if (c.parts[0]) return viewPost(c, c.parts[0]);
    return api('journal').then(function (d) {
      var rows = d.items.map(function (p) {
        var href = '#/journal/' + enc(p.slug);
        return '<tr class="go" data-href="' + href + '"><td class="strong" data-label="제목"><a href="' + href + '">' + h(p.title) + '</a><span class="sub">/journal/' + h(p.slug) + '</span></td>' +
          '<td data-label="분류">' + h(p.category || '-') + '</td><td data-label="날짜" class="tabular">' + h(p.date) + (p.updated && p.updated !== p.date ? '<span class="sub">' + h(p.updated) + ' 수정</span>' : '') + '</td>' +
          '<td class="n" data-label="분량">' + (p.length || 0).toLocaleString() + '자</td>' +
          '<td data-label="상태">' + (p.draft ? '<span class="chip st-draft">임시 저장</span>' : '<span class="chip st-live">공개</span>') + '</td></tr>';
      }).join('');
      var v = c.put(head('상회보', {
        desc: '홈페이지 상회보에 올라가는 글입니다. 저장하면 GitHub 저장소에 기록되고 1~2분 뒤 상회보 목록, 홈, 사이트맵, RSS에 함께 반영됩니다.',
        actions: '<a class="btn btn-primary" href="#/journal/new">새 글 쓰기</a>',
      }) + '<div class="note plain"><p>새 글은 키워드 지도(docs/seo-guide.md)에서 다른 글과 겹치지 않는 말을 골라 씁니다. 격주에 한 편이 목표입니다.</p></div>' +
        (d.items.length ? '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>제목</th><th>분류</th><th>날짜</th><th class="n">분량</th><th>상태</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
          : empty('아직 글이 없습니다.', '<a href="#/journal/new">첫 글 쓰기</a>')), '상회보');
      if (v) goRows(v);
    });
  };

  var MD_HELP = '<ul class="mini-list">' +
    '<li><span><code>## 소제목</code></span><span class="muted">차례에 들어갑니다</span></li>' +
    '<li><span><code>**굵게**</code></span><span class="muted">강조</span></li>' +
    '<li><span><code>[글자](/programs)</code></span><span class="muted">링크</span></li>' +
    '<li><span><code>- 목록</code> · <code>1. 목록</code></span><span class="muted">목록</span></li>' +
    '<li><span><code>&gt; 인용</code></span><span class="muted">인용 상자</span></li>' +
    '<li><span><code>:::note</code> … <code>:::</code></span><span class="muted">글 끝 안내 상자</span></li>' +
    '<li><span><code>![설명](/assets/…)</code></span><span class="muted">사진</span></li></ul>';

  function slugOk(s) { return /^[a-z0-9][a-z0-9-]{1,60}$/.test(s); }

  function coverOptions(current) {
    var list = [['', '넣지 않음']];
    var scenes = window.SCENES || {};
    Object.keys(scenes).forEach(function (k) { list.push([k, '그림: ' + scenes[k]]); });
    if (current && !scenes[current]) list.push([current, '올린 사진 (' + String(current).split('/').pop() + ')']);
    return list;
  }

  function viewPost(c, slug) {
    var isNew = slug === 'new';
    return Promise.all([isNew ? null : api('journal/' + enc(slug)), api('journal').catch(function () { return { items: [] }; })]).then(function (r) {
      var post = r[0];
      var others = r[1].items.filter(function (p) { return p.slug !== slug; });
      var meta = isNew ? { title: '', description: '', date: todayStr(), updated: '', category: '', keywords: '', order: '', draft: '' } : post.meta;
      var sha = post ? post.sha : null;
      var body = isNew ? '' : post.body;
      var cats = others.map(function (p) { return p.category; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
      var metaForm = '<form data-meta class="editor-meta" novalidate><div class="form-grid">' +
        fld('제목', inp('title', meta.title, 'required maxlength="120" placeholder="사람들이 실제로 검색하는 말을 넣어 짓습니다"'), { full: true, hint: '<span class="counter" data-count-for="title"></span>' }) +
        (isNew ? fld('글 주소', inp('slug', '', 'required pattern="[a-z0-9-]+" placeholder="first-hire" autocapitalize="off" spellcheck="false"'), { hint: '영문 소문자, 숫자, 하이픈(-)만 씁니다. /journal/ 뒤에 붙고, 나중에 바꿀 수 없습니다.' })
          : fld('글 주소', '<input value="/journal/' + h(slug) + '" disabled>')) +
        fld('분류', inp('category', meta.category, 'list="cats" placeholder="예: 장사 이야기"') + '<datalist id="cats">' + cats.map(function (x) { return '<option value="' + h(x) + '">'; }).join('') + '</datalist>') +
        fld('검색 결과 설명', ta('description', meta.description, 'rows="2" maxlength="300" placeholder="핵심 키워드를 앞쪽에 넣고 80~110자로 씁니다"'), { full: true, hint: '<span class="counter" data-count-for="description"></span>' }) +
        fld('키워드', inp('keywords', meta.keywords, 'placeholder="첫 직원 채용, 자영업자 채용"'), { full: true, hint: '쉼표로 나눕니다. 첫 번째가 이 글이 노리는 말입니다.' }) +
        fld('쓴 날', inp('date', meta.date, 'type="date" required')) +
        fld('고친 날', inp('updated', meta.updated, 'type="date"'), { hint: '내용을 크게 고쳤을 때만 적습니다.' }) +
        fld('대표 그림', sel('image', meta.image || '', coverOptions(meta.image)), { hint: '글 머리, 상회보 목록, 공유 미리보기에 나옵니다. <button type="button" class="link-btn" data-cover-upload>사진을 올려서 쓰기</button><input type="file" accept="image/jpeg,image/png,image/webp" data-cover-file hidden>' }) +
        '<div class="field"><span class="lbl">대표 그림 미리보기</span><div class="cover-preview" data-cover></div></div>' +
        fld('대표 사진 설명', inp('imageAlt', meta.imageAlt, 'placeholder="직접 올린 사진일 때 적습니다. 예: 가게 앞에서 찍은 간판"'), { full: true, hint: '그림 목록에서 고른 경우에는 비워 두어도 됩니다.' }) +
        '</div></form>';
      var editor = '<div class="editor" data-pane="write"><div class="pane-tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-pane-btn="write">쓰기</button><button type="button" role="tab" aria-selected="false" data-pane-btn="preview">미리보기</button></div>' +
        '<div class="write-pane"><div class="md-tools" role="toolbar" aria-label="글쓰기 도구">' +
        '<button type="button" data-md="h2">소제목</button><button type="button" data-md="h3">작은 제목</button><span class="sep"></span>' +
        '<button type="button" data-md="bold">굵게</button><button type="button" data-md="link">링크</button><span class="sep"></span>' +
        '<button type="button" data-md="ul">목록</button><button type="button" data-md="ol">번호 목록</button><button type="button" data-md="quote">인용</button><button type="button" data-md="note">안내 상자</button><button type="button" data-md="hr">구분선</button><span class="sep"></span>' +
        '<button type="button" data-md="image">사진 넣기</button><input type="file" accept="image/jpeg,image/png,image/webp" data-file hidden></div>' +
        '<textarea data-body aria-label="본문" spellcheck="false" placeholder="첫 문단에서 이 글이 무엇을 알려 주는지 바로 말합니다.&#10;&#10;## 소제목&#10;&#10;문단을 씁니다.">' + h(body) + '</textarea></div>' +
        '<div class="preview-pane" aria-label="미리보기"><div class="p-title" data-p-title></div><p class="p-desc" data-p-desc></p><div class="article-body" data-preview></div></div></div>';
      var aside = '<div class="aside-box"><h2>검색 노출 점검</h2><ul class="seo-list" data-seo></ul></div>' +
        '<div class="aside-box"><h2>글쓰기 표시법</h2>' + MD_HELP + '</div>' +
        '<div class="aside-box"><h2>글 쓸 때 지킬 것</h2><ul class="mini-list"><li>상단에서 나온 이야기는 당사자 동의를 받고, 사람과 회사를 알아볼 수 없게 바꿉니다(헌장 2조).</li><li>통계나 제도는 출처를 글 끝에 적습니다.</li><li>글 끝 안내 상자에서 관련 페이지로 연결합니다.</li></ul></div>';
      var foot = '<div class="editor-foot">' + chk('draft', meta.draft === 'true', '임시 저장(홈페이지에 보이지 않음)', 'data-draft') + '<span class="spacer"></span>' +
        (!isNew && meta.draft !== 'true' ? '<a class="btn btn-line" href="/journal/' + enc(slug) + '" target="_blank" rel="noopener">홈페이지에서 보기</a>' : '') +
        (!isNew && isOwner() ? '<button type="button" class="btn btn-ghost-danger" data-del>글 삭제</button>' : '') +
        '<button type="button" class="btn btn-primary" data-save>저장</button></div>';

      var v = c.put(head(isNew ? '새 글 쓰기' : '글 고치기', { crumb: ['#/journal', '상회보'] }) +
        '<div class="editor-grid"><div>' + metaForm + editor + '</div><div>' + aside + '</div></div>' + foot, isNew ? '새 글' : meta.title);
      if (!v) return;

      var mf = $('[data-meta]', v);
      var tx = $('[data-body]', v);
      var draftBox = $('[data-draft]', v);
      var preview = $('[data-preview]', v);
      trackDirty(mf);
      trackDirty(tx);
      draftBox.addEventListener('change', function () { state.dirty = true; });

      var timer;
      function refresh() {
        var m = readForm(mf);
        var html = window.MD ? window.MD.toHtml(tx.value).html : h(tx.value);
        preview.innerHTML = html;
        $$('img', preview).forEach(function (img) {
          var src = img.getAttribute('src');
          if (state.localImages[src]) img.src = state.localImages[src];
        });
        $('[data-p-title]', v).textContent = m.title || '제목';
        $('[data-p-desc]', v).textContent = m.description || '';
        $$('[data-count-for]', v).forEach(function (el) {
          var k = el.getAttribute('data-count-for');
          var n = (m[k] || '').length;
          var warn = k === 'title' ? (n > 40 || (n > 0 && n < 8)) : (n > 0 && (n < 80 || n > 110));
          el.textContent = n + '자' + (k === 'title' ? ' · 40자 안쪽 권장' : ' · 80~110자 권장');
          el.className = 'counter' + (warn ? ' warn' : '');
        });
        $('[data-seo]', v).innerHTML = seoChecks(m, tx.value, others, isNew).map(function (x) {
          return '<li class="' + (x[0] ? 'ok' : 'warn') + '">' + x[1] + '</li>';
        }).join('');
      }
      var later = function () { clearTimeout(timer); timer = setTimeout(refresh, 180); };
      mf.addEventListener('input', later);
      tx.addEventListener('input', later);
      refresh();

      $$('[data-pane-btn]', v).forEach(function (b) {
        b.addEventListener('click', function () {
          var pane = b.getAttribute('data-pane-btn');
          $('.editor', v).setAttribute('data-pane', pane);
          $$('[data-pane-btn]', v).forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
          if (pane === 'preview') refresh();
        });
      });

      // 글쓰기 도구
      function wrap(before, after, placeholder) {
        var s = tx.selectionStart, e = tx.selectionEnd;
        var picked = tx.value.slice(s, e) || placeholder;
        tx.setRangeText(before + picked + after, s, e, 'end');
        tx.setSelectionRange(s + before.length, s + before.length + picked.length);
        tx.focus();
        state.dirty = true;
        later();
      }
      function linePrefix(prefix) {
        var s = tx.selectionStart, e = tx.selectionEnd;
        var start = tx.value.lastIndexOf('\n', s - 1) + 1;
        var block = tx.value.slice(start, e);
        var out = block.split('\n').map(function (l, i) {
          var p = typeof prefix === 'function' ? prefix(i) : prefix;
          return l.indexOf(p) === 0 ? l : p + l.replace(/^(#{2,3}\s+|[-*]\s+|\d+\.\s+|>\s?)/, '');
        }).join('\n');
        tx.setRangeText(out, start, e, 'end');
        tx.focus();
        state.dirty = true;
        later();
      }
      function insertBlock(text) {
        var s = tx.selectionStart;
        var pre = s > 0 && tx.value[s - 1] !== '\n' ? '\n\n' : (s > 1 && tx.value[s - 2] !== '\n' ? '\n' : '');
        tx.setRangeText(pre + text + '\n', s, tx.selectionEnd, 'end');
        tx.focus();
        state.dirty = true;
        later();
      }
      // 대표 그림
      var coverSel = $('[name=image]', mf);
      function drawCover() {
        var val = coverSel.value;
        var src = !val ? '' : (window.SCENES && window.SCENES[val]) ? '/assets/img/scenes/scene-' + val + '-640.webp' : (state.localImages[val] || val);
        $('[data-cover]', v).innerHTML = src ? '<img src="' + h(src) + '" alt="">' : '<span class="muted">넣지 않음</span>';
      }
      coverSel.addEventListener('change', drawCover);
      drawCover();
      var coverFile = $('[data-cover-file]', v);
      $('[data-cover-upload]', v).addEventListener('click', function () { coverFile.click(); });
      coverFile.addEventListener('change', function () {
        var file = coverFile.files && coverFile.files[0];
        coverFile.value = '';
        if (!file) return;
        var s0 = isNew ? (readForm(mf).slug || '') : slug;
        toast('사진을 줄이고 올리는 중입니다…');
        prepareImage(file).then(function (img) {
          return api('uploads', { method: 'POST', body: { data: img.base64, slug: slugOk(s0) ? s0 : 'journal' } }).then(function (res) {
            state.localImages[res.url] = img.objectUrl;
            var o = document.createElement('option');
            o.value = res.url;
            o.textContent = '올린 사진 (' + res.url.split('/').pop() + ')';
            coverSel.appendChild(o);
            coverSel.value = res.url;
            state.dirty = true;
            drawCover();
            toast('대표 사진을 올렸습니다. 아래 “대표 사진 설명”도 적어 주세요.');
          });
        }).catch(fail);
      });

      var fileInput = $('[data-file]', v);
      $$('[data-md]', v).forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-md');
          if (k === 'h2') linePrefix('## ');
          else if (k === 'h3') linePrefix('### ');
          else if (k === 'bold') wrap('**', '**', '강조할 말');
          else if (k === 'link') {
            var url = window.prompt('연결할 주소를 적어 주세요. 홈페이지 안의 페이지는 /programs 처럼 적습니다.', '/');
            if (url) wrap('[', '](' + url.trim() + ')', '링크 글자');
          } else if (k === 'ul') linePrefix('- ');
          else if (k === 'ol') linePrefix(function (i) { return (i + 1) + '. '; });
          else if (k === 'quote') linePrefix('> ');
          else if (k === 'note') insertBlock(':::note\n열정상회 장날에서 이 주제를 함께 이야기합니다. [장날 일정 보기](/jangnal)\n:::');
          else if (k === 'hr') insertBlock('---');
          else if (k === 'image') fileInput.click();
        });
      });
      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        var s = slugOk(isNew ? (readForm(mf).slug || '') : slug) ? (isNew ? readForm(mf).slug : slug) : 'journal';
        toast('사진을 줄이고 올리는 중입니다…');
        prepareImage(file).then(function (img) {
          return api('uploads', { method: 'POST', body: { data: img.base64, slug: s } }).then(function (res) {
            state.localImages[res.url] = img.objectUrl;
            insertBlock('![사진 설명을 적어 주세요](' + res.url + ')');
            toast('사진을 올렸습니다. 괄호 앞 [ ] 안에 사진 설명을 적어 주세요.');
          });
        }).catch(fail);
      });

      function save() {
        var m = readForm(mf);
        var target = isNew ? m.slug : slug;
        if (!m.title) { toast('제목을 적어 주세요.', true); $('[name=title]', mf).focus(); return; }
        if (isNew && !slugOk(target || '')) { toast('글 주소는 영문 소문자, 숫자, 하이픈으로 2자 이상 적어 주세요.', true); $('[name=slug]', mf).focus(); return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date)) { toast('쓴 날을 적어 주세요.', true); return; }
        if (tx.value.trim().length < 20) { toast('본문이 너무 짧습니다.', true); tx.focus(); return; }
        var draft = draftBox.checked;
        var btn = $('[data-save]', v);
        busy(btn, '저장하는 중…', function () {
          return api('journal/' + enc(target), { method: 'PUT', body: {
            meta: { title: m.title, description: m.description, date: m.date, updated: m.updated, category: m.category, keywords: m.keywords, order: meta.order || '', draft: draft, image: m.image, imageAlt: m.imageAlt },
            body: tx.value, sha: sha, isNew: isNew,
          } });
        }).then(function (res) {
          sha = res.sha;
          state.dirty = false;
          toast(draft ? '임시 저장했습니다. 홈페이지에는 보이지 않습니다.' : '저장했습니다. 1~2분 뒤 홈페이지에 반영됩니다.');
          if (isNew) location.hash = '#/journal/' + enc(target);
        }).catch(fail);
      }
      $('[data-save]', v).addEventListener('click', save);
      v.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
      });
      var del = $('[data-del]', v);
      if (del) del.addEventListener('click', function () {
        ask({ title: '이 글을 삭제할까요?', body: '<p>홈페이지에서 글이 사라지고, 이 주소로 들어오는 사람은 “찾을 수 없는 페이지”를 보게 됩니다. 잠시 내리려면 삭제 대신 “임시 저장”을 쓰세요.</p>', ok: '삭제', danger: true }).then(function (ok) {
          if (!ok) return;
          api('journal/' + enc(slug), { method: 'DELETE' }).then(function () { state.dirty = false; toast('글을 삭제했습니다.'); location.hash = '#/journal'; }).catch(fail);
        });
      });
    });
  }

  function seoChecks(m, body, others, isNew) {
    var out = [];
    var title = m.title || '';
    var desc = m.description || '';
    var kws = splitList(m.keywords);
    var first = kws[0] || '';
    var h2 = (body.match(/^##\s+\S/gm) || []).length;
    var text = body.replace(/^:::.*$/gm, '').replace(/[#>*\-[\]()!`]/g, '').replace(/\s+/g, '');
    var firstLine = body.split('\n').filter(function (l) { return l.trim(); })[0] || '';
    var internal = (body.match(/\]\(\/[^)]*\)/g) || []).length;
    out.push([title.length >= 8 && title.length <= 40, '제목 ' + title.length + '자 (8~40자)']);
    out.push([desc.length >= 80 && desc.length <= 110, '검색 결과 설명 ' + desc.length + '자 (80~110자)']);
    out.push([!!first, first ? '노리는 말: ' + h(first) : '키워드를 하나 이상 적습니다']);
    if (first) {
      var compact = function (s) { return s.replace(/\s+/g, ''); };
      out.push([compact(title).indexOf(compact(first)) >= 0 || compact(desc).indexOf(compact(first)) >= 0, '제목이나 설명에 “' + h(first) + '”가 들어 있습니다']);
    }
    out.push([h2 >= 3, '소제목(##) ' + h2 + '개 (3개 이상)']);
    out.push([firstLine && !/^#/.test(firstLine), '본문이 소제목이 아닌 문단으로 시작합니다']);
    out.push([text.length >= 1000, '본문 ' + text.length.toLocaleString() + '자 (1,000자 이상 권장)']);
    out.push([internal >= 1, '홈페이지 안 링크 ' + internal + '개']);
    out.push([/^:::note/m.test(body), '글 끝 안내 상자']);
    var clash = [];
    kws.forEach(function (k) {
      others.forEach(function (p) {
        if (splitList(p.keywords).some(function (x) { return x.replace(/\s+/g, '') === k.replace(/\s+/g, ''); })) clash.push('“' + h(k) + '” — ' + h(p.title));
      });
    });
    out.push([!clash.length, clash.length ? '다른 글과 겹치는 키워드: ' + clash.slice(0, 3).join(', ') : '다른 글과 키워드가 겹치지 않습니다']);
    if (isNew) out.push([slugOk(m.slug || ''), '글 주소는 영문 소문자와 하이픈으로']);
    return out;
  }

  function prepareImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return Promise.reject(new Error('JPG, PNG, WEBP 사진만 올릴 수 있습니다.'));
    if (file.size > 25 * 1024 * 1024) return Promise.reject(new Error('사진 파일이 너무 큽니다. 25MB 이하로 골라 주세요.'));
    var load = window.createImageBitmap ? createImageBitmap(file) : new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error('사진을 읽지 못했습니다.')); };
      img.src = URL.createObjectURL(file);
    });
    return load.then(function (img) {
      var max = 1600;
      var scale = Math.min(1, max / img.width);
      var w = Math.round(img.width * scale), hh = Math.round(img.height * scale);
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = hh;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, hh);
      ctx.drawImage(img, 0, 0, w, hh);
      var q = 0.86;
      function attempt() {
        return new Promise(function (res) { cv.toBlob(res, 'image/jpeg', q); }).then(function (blob) {
          if (blob.size > 1400000 && q > 0.5) { q -= 0.12; return attempt(); }
          return blob;
        });
      }
      return attempt();
    }).then(function (blob) {
      return new Promise(function (res, rej) {
        var r = new FileReader();
        r.onload = function () { res({ base64: String(r.result).split(',')[1], objectUrl: URL.createObjectURL(blob) }); };
        r.onerror = function () { rej(new Error('사진을 읽지 못했습니다.')); };
        r.readAsDataURL(blob);
      });
    });
  }

  /* ======================================================================
     사이트 정보 (site.json → GitHub)
     ====================================================================== */
  var SETTINGS = [
    { key: 'contact', title: '연락처', desc: '홈페이지 아래쪽 문의 칸에 나옵니다. 비워 둔 칸은 나오지 않습니다.', fields: [['email', '문의 이메일', 'email'], ['kakaoChannel', '카카오톡 채널 주소', 'url'], ['instagram', '인스타그램 주소', 'url'], ['naverBlog', '네이버 블로그 주소', 'url']] },
    { key: 'fees', title: '회비', desc: '가입 안내와 장날 페이지의 금액 칸에 그대로 나옵니다. “월 3만 원”처럼 적습니다.', fields: [['guest', '손님(장날 참가비)'], ['sarangbang', '사랑방 회원'], ['member', '상회원'], ['note', '회비 안내 문구', 'textarea']] },
    { key: 'team', title: '운영진 소개', desc: '소개 페이지의 “지금의 운영진”에 나옵니다. 맡은 일과 이름만 적습니다.' },
    { key: 'operator', title: '운영 정보', desc: '홈페이지 맨 아래와 개인정보 처리방침에 나옵니다.', fields: [['name', '운영 주체'], ['representative', '대표자'], ['registrationNo', '사업자등록번호'], ['address', '주소'], ['privacyOfficer', '개인정보 보호책임자'], ['privacyEmail', '개인정보 문의 이메일', 'email']] },
    { key: 'verification', title: '검색엔진 소유 확인', desc: '네이버 서치어드바이저, 구글 서치 콘솔, 빙 웹마스터 도구에서 받은 코드를 넣습니다. 네이버·구글·빙은 content 값만, 다음은 robots.txt에 넣으라는 한 줄 전체를 넣습니다.', fields: [['naver', '네이버'], ['google', '구글'], ['bing', '빙'], ['daumRobotsLine', '다음 robots.txt 한 줄']] },
    { key: 'url', title: '홈페이지 주소', desc: '대표 주소, 사이트맵, RSS가 이 주소로 만들어집니다. 도메인을 연결한 뒤에만 바꿉니다.' },
  ];

  ROUTES.settings = function (c) {
    if (!state.info.github) return c.put(githubNeeded('사이트 정보'), '사이트 정보');
    return api('site').then(function (s) {
      var sha = s.sha;
      var data = s.data;
      var owner = isOwner();
      var dis = owner ? '' : ' disabled';
      var html = '<div class="narrow">' + head('사이트 정보', { desc: '홈페이지 곳곳에 들어가는 연락처, 회비, 운영 정보입니다. 칸마다 따로 저장되고, 1~2분 뒤 홈페이지에 반영됩니다.' }) +
        (owner ? '' : '<div class="note"><p>사이트 정보는 회장 계정만 바꿀 수 있습니다. 고칠 내용이 있으면 회장에게 알려 주세요.</p></div>') +
        SETTINGS.map(function (sec) {
          var inner;
          if (sec.key === 'team') {
            var team = (data.team || []).filter(function (m) { return m && (m.role || m.name); });
            inner = '<div data-team>' + (team.length ? team.map(teamRow).join('') : '<p class="muted" data-team-empty>아직 적은 운영진이 없습니다. 운영진을 뽑은 뒤 맡은 일과 이름을 넣어 주세요.</p>') + '</div>' + (owner ? '<p><button type="button" class="btn btn-sm btn-line" data-team-add>한 줄 추가</button></p>' : '');
          } else if (sec.key === 'url') {
            inner = '<div class="form-grid">' + fld('주소', inp('url', data.url, 'type="url"' + dis), { full: true }) + '</div>';
          } else {
            var val = data[sec.key] || {};
            inner = '<div class="form-grid">' + sec.fields.map(function (f) {
              var control = f[2] === 'textarea' ? ta(f[0], val[f[0]], 'rows="2"' + dis) : inp(f[0], val[f[0]], (f[2] ? 'type="' + f[2] + '"' : '') + dis);
              return fld(f[1], control, { full: f[2] === 'textarea' || f[0] === 'daumRobotsLine' || f[0] === 'address' });
            }).join('') + '</div>';
          }
          return '<section class="block"><form data-section="' + sec.key + '" novalidate><h2 class="sec">' + h(sec.title) + '</h2><p class="muted" style="margin:-4px 0 14px">' + h(sec.desc) + '</p>' + inner +
            (owner ? '<div class="form-actions"><button class="btn btn-primary">' + h(sec.title) + ' 저장</button></div>' : '') + '</form></section>';
        }).join('') + '</div>';
      function teamRow(m) {
        return '<div class="form-grid" data-row style="margin-bottom:10px;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;align-items:end">' +
          fld('맡은 일', inp('role', m.role, 'placeholder="예: 가입 담당"' + dis)) + fld('이름', inp('name', m.name, dis)) +
          (owner ? '<button type="button" class="btn btn-sm btn-ghost-danger" data-team-remove>지우기</button>' : '<span></span>') + '</div>';
      }
      var v = c.put(html, '사이트 정보');
      if (!v || !owner) return;
      var addBtn = $('[data-team-add]', v);
      addBtn.addEventListener('click', function () {
        var emptyLine = $('[data-team-empty]', v);
        if (emptyLine) emptyLine.remove();
        $('[data-team]', v).insertAdjacentHTML('beforeend', teamRow({ role: '', name: '' }));
        state.dirty = true;
      });
      $('[data-team]', v).addEventListener('click', function (e) {
        var b = e.target.closest('[data-team-remove]');
        if (b) { b.closest('[data-row]').remove(); state.dirty = true; }
      });
      $$('form[data-section]', v).forEach(function (f) {
        trackDirty(f);
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          var key = f.getAttribute('data-section');
          var value;
          if (key === 'team') value = $$('[data-row]', f).map(function (row) { return { role: $('[name=role]', row).value.trim(), name: $('[name=name]', row).value.trim() }; }).filter(function (m) { return m.role || m.name; });
          else if (key === 'url') value = readForm(f).url;
          else value = readForm(f);
          busy($('button.btn-primary', f), '저장하는 중…', function () {
            return api('site', { method: 'PUT', body: { section: key, value: value, sha: sha } });
          }).then(function (res) {
            sha = res.sha;
            state.dirty = false;
            toast('저장했습니다. 1~2분 뒤 홈페이지에 반영됩니다.');
          }).catch(fail);
        });
      });
    });
  };

  /* ======================================================================
     관리자 계정 (회장 전용)
     ====================================================================== */
  function showSecret(title, pw, who) {
    return dialog('<div class="dlg"><h2 id="dlg-title">' + h(title) + '</h2><div class="dlg-body"><p>' + h(who) + '님에게 아래 임시 비밀번호를 직접 전해 주세요. 이 창을 닫으면 다시 볼 수 없습니다. 첫 로그인 때 새 비밀번호로 바꾸게 됩니다.</p></div>' +
      '<div class="secret"><code>' + h(pw) + '</code><button type="button" class="btn btn-line" data-copy>복사</button></div>' +
      '<div class="dlg-actions"><button type="button" class="btn btn-primary" data-close>확인했습니다</button></div></div>', function (d) {
      $('[data-copy]', d).addEventListener('click', function () {
        (navigator.clipboard ? navigator.clipboard.writeText(pw) : Promise.reject()).then(function () { toast('복사했습니다.'); }, function () { toast('복사하지 못했습니다. 직접 골라 복사해 주세요.', true); });
      });
      $('[data-close]', d).addEventListener('click', function () { d.close('ok'); });
    });
  }

  ROUTES.accounts = function (c) {
    if (!isOwner()) return c.put(head('관리자 계정') + empty('회장 계정만 볼 수 있는 화면입니다.'), '관리자 계정');
    return api('accounts').then(function (d) {
      var rows = d.items.map(function (a) {
        var self = a.id === state.me.id;
        return '<tr><td class="strong" data-label="이름">' + h(a.name) + (self ? '<span class="sub">나</span>' : '') + '<span class="sub">' + h(a.email) + '</span></td>' +
          '<td data-label="권한">' + (self ? h(L.role[a.role]) : sel('role', a.role, opts('role'), 'data-role="' + h(a.id) + '" aria-label="' + h(a.name) + ' 권한"')) + '</td>' +
          '<td data-label="맡은 일">' + h(a.duty || '-') + '</td>' +
          '<td data-label="마지막 로그인">' + h(a.last_login ? stamp(a.last_login) : '아직 없음') + (a.must_change ? '<span class="sub flag">임시 비밀번호 상태</span>' : '') + '</td>' +
          '<td data-label="상태">' + (a.active ? '<span class="chip st-active">사용 중</span>' : '<span class="chip st-left">사용 중지</span>') + '</td>' +
          '<td class="nolabel" style="white-space:nowrap">' + (self ? '' : '<button type="button" class="btn btn-sm btn-line" data-reset="' + h(a.id) + '" data-name="' + h(a.name) + '">임시 비밀번호</button> ' +
            '<button type="button" class="btn btn-sm btn-line" data-toggle="' + h(a.id) + '" data-active="' + a.active + '" data-name="' + h(a.name) + '">' + (a.active ? '사용 중지' : '다시 사용') + '</button>') + '</td></tr>';
      }).join('');
      var v = c.put(head('관리자 계정', {
        desc: '운영진이 이 화면에 들어올 계정입니다. 운영진 권한은 신청·회원·상단·장날 일정·상회보를 다룰 수 있고, 회장 권한은 여기에 더해 계정, 사이트 정보, 삭제, 내려받기를 다룹니다.',
        actions: '<button type="button" class="btn btn-primary" data-new>계정 추가</button>',
      }) + '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>이름</th><th>권한</th><th>맡은 일</th><th>마지막 로그인</th><th>상태</th><th><span class="sr">관리</span></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<div class="note plain" style="margin-top:22px"><p>운영진 임기가 끝나면 계정을 “사용 중지”로 바꿉니다. 활동 기록은 남고, 그 계정으로는 더 이상 들어올 수 없습니다.</p></div>', '관리자 계정');
      if (!v) return;
      $('[data-new]', v).addEventListener('click', function () {
        formDialog({
          title: '관리자 계정 추가',
          body: '<div class="form-grid">' + fld('이름', inp('name', '', 'required')) + fld('이메일', inp('email', '', 'type="email" required'), { hint: '로그인 아이디로 씁니다.' }) +
            fld('권한', sel('role', 'staff', opts('role'))) + fld('맡은 일', inp('duty', '', 'placeholder="예: 가입 담당, 상회보 담당"')) + '</div>',
          ok: '계정 만들기',
          submit: function (b) {
            if (!b.name || !b.email) throw new Error('이름과 이메일을 적어 주세요.');
            return api('accounts', { method: 'POST', body: b }).then(function (res) {
              setTimeout(function () { showSecret('계정을 만들었습니다', res.tempPassword, b.name).then(rerender); }, 50);
            });
          },
        });
      });
      $$('[data-role]', v).forEach(function (s) {
        var prev = s.value;
        s.addEventListener('change', function () {
          api('accounts/' + enc(s.getAttribute('data-role')), { method: 'PATCH', body: { role: s.value } }).then(function () { prev = s.value; toast('권한을 바꿨습니다.'); })
            .catch(function (e) { s.value = prev; fail(e); });
        });
      });
      $$('[data-reset]', v).forEach(function (b) {
        b.addEventListener('click', function () {
          var name = b.getAttribute('data-name');
          ask({ title: '임시 비밀번호를 새로 발급할까요?', body: '<p>' + h(name) + '님의 지금 비밀번호는 더 이상 쓸 수 없고, 로그인해 있던 기기에서도 로그아웃됩니다.</p>', ok: '발급' }).then(function (ok) {
            if (!ok) return;
            api('accounts/' + enc(b.getAttribute('data-reset')), { method: 'PATCH', body: { resetPassword: true } }).then(function (res) {
              showSecret('임시 비밀번호를 발급했습니다', res.tempPassword, name).then(rerender);
            }).catch(fail);
          });
        });
      });
      $$('[data-toggle]', v).forEach(function (b) {
        b.addEventListener('click', function () {
          var on = b.getAttribute('data-active') === '1';
          var name = b.getAttribute('data-name');
          ask({ title: on ? '계정 사용을 멈출까요?' : '계정을 다시 쓰게 할까요?', body: '<p>' + h(name) + (on ? '님은 더 이상 관리자 화면에 들어올 수 없습니다. 활동 기록은 남습니다.' : '님이 다시 로그인할 수 있게 됩니다.') + '</p>', ok: on ? '사용 중지' : '다시 사용', danger: on }).then(function (ok) {
            if (!ok) return;
            api('accounts/' + enc(b.getAttribute('data-toggle')), { method: 'PATCH', body: { active: !on } }).then(function () { toast('바꿨습니다.'); rerender(); }).catch(fail);
          });
        });
      });
    });
  };

  /* ======================================================================
     활동 기록 (회장 전용)
     ====================================================================== */
  ROUTES.logs = function (c) {
    if (!isOwner()) return c.put(head('활동 기록') + empty('회장 계정만 볼 수 있는 화면입니다.'), '활동 기록');
    return api('logs?limit=300').then(function (d) {
      var rows = d.items.map(function (l) {
        return '<tr><td data-label="언제" class="tabular">' + h(stamp(l.at)) + '</td><td data-label="누가" class="strong">' + h(l.admin_name || '-') + '</td>' +
          '<td data-label="무엇을">' + h(l.action) + '</td><td data-label="대상">' + h(l.target || '-') + '</td><td class="clip" data-label="내용"><span>' + h(l.detail || '') + '</span></td></tr>';
      }).join('');
      c.put(head('활동 기록', { desc: '누가 언제 무엇을 바꿨는지 남는 기록입니다. 최근 300건을 보여 주고, 2년이 지난 기록은 개인정보 정리 때 함께 지워집니다.' }) +
        (d.items.length ? '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>언제</th><th>누가</th><th>무엇을</th><th>대상</th><th>내용</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : empty('기록이 없습니다.')), '활동 기록');
    });
  };

  /* ======================================================================
     개인정보 관리 (회장 전용)
     ====================================================================== */
  ROUTES.data = function (c) {
    if (!isOwner()) return c.put(head('개인정보 관리') + empty('회장 계정만 볼 수 있는 화면입니다.'), '개인정보 관리');
    return api('purge', { method: 'POST', body: { dryRun: true } }).then(function (d) {
      var total = d.applications + d.leftMembers;
      var v = c.put(head('개인정보 관리', { desc: '처리방침에 적은 대로 신청자와 회원 정보를 보관하고 파기합니다.' }) +
        '<section class="block"><h2 class="sec">보관 기간이 지난 정보 정리</h2>' +
        '<dl class="facts"><dt>6개월이 지난 미가입 신청서</dt><dd>' + d.applications + '건</dd><dt>탈퇴한 회원 정보</dt><dd>' + d.leftMembers + '명</dd></dl>' +
        '<p class="muted">가입하지 않은 신청자의 정보는 신청일로부터 6개월 뒤, 탈퇴한 회원의 정보는 지체 없이 파기한다고 처리방침에 적혀 있습니다. 한 달에 한 번 이 화면에서 정리해 주세요. 탈퇴 회원의 출석 기록과 가입 신청서도 함께 지워집니다.</p>' +
        '<div class="form-actions"><button type="button" class="btn ' + (total ? 'btn-primary' : 'btn-line') + '" data-purge' + (total ? '' : ' disabled') + '>' + (total ? '지금 정리하기' : '정리할 정보가 없습니다') + '</button></div></section>' +
        '<section class="block"><h2 class="sec">목록 내려받기</h2><p class="muted">엑셀이나 구글 시트에서 열 수 있는 CSV 파일입니다. 내려받은 파일에는 연락처가 들어 있으니 쓰고 나면 지워 주세요. 내려받은 기록은 활동 기록에 남습니다.</p>' +
        '<div class="form-actions"><a class="btn btn-line" href="/api/admin/export?kind=applications">가입 신청</a><a class="btn btn-line" href="/api/admin/export?kind=jangnal">장날 신청</a><a class="btn btn-line" href="/api/admin/export?kind=members">회원 명부</a></div></section>', '개인정보 관리');
      if (!v) return;
      var b = $('[data-purge]', v);
      if (b && total) b.addEventListener('click', function () {
        ask({ title: '보관 기간이 지난 정보를 지울까요?', body: '<p>미가입 신청서 ' + d.applications + '건과 탈퇴 회원 ' + d.leftMembers + '명의 정보가 지워지고 되돌릴 수 없습니다.</p>', ok: '정리하기', danger: true }).then(function (ok) {
          if (!ok) return;
          api('purge', { method: 'POST', body: {} }).then(function (r) { toast('신청서 ' + r.applications + '건, 탈퇴 회원 ' + r.leftMembers + '명의 정보를 지웠습니다.'); rerender(); }).catch(fail);
        });
      });
    });
  };

  /* ======================================================================
     내 계정
     ====================================================================== */
  ROUTES.me = function (c) {
    var me = state.me;
    var v = c.put(head('내 계정') + '<div style="max-width:560px"><dl class="facts"><dt>이름</dt><dd>' + h(me.name) + '</dd><dt>이메일</dt><dd>' + h(me.email) + '</dd><dt>권한</dt><dd>' + h(L.role[me.role]) + (me.duty ? ' · ' + h(me.duty) : '') + '</dd></dl>' +
      '<section class="block"><h2 class="sec">비밀번호 바꾸기</h2><form data-pw novalidate><div class="form-grid">' +
      fld('지금 비밀번호', '<input name="current" type="password" autocomplete="current-password">', { full: true }) +
      fld('새 비밀번호', '<input name="next" type="password" autocomplete="new-password">', { hint: '10자 이상, 영문과 숫자를 함께' }) +
      fld('새 비밀번호 확인', '<input name="next2" type="password" autocomplete="new-password">') +
      '</div><div class="form-actions"><button class="btn btn-primary">비밀번호 바꾸기</button></div></form></section></div>', '내 계정');
    if (!v) return;
    var f = $('[data-pw]', v);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var b = readForm(f);
      if (b.next !== b.next2) { toast('새 비밀번호 확인이 맞지 않습니다.', true); return; }
      busy($('button', f), '바꾸는 중…', function () { return api('me', { method: 'POST', body: { current: b.current, next: b.next } }); })
        .then(function () { f.reset(); toast('비밀번호를 바꿨습니다. 다른 기기에서는 다시 로그인해야 합니다.'); }).catch(fail);
    });
  };

  boot();
})();
