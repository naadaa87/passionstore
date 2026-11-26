// 열정상회 신청서: 확인 → /api/apply 로 보내기 → 결과 표시
(function () {
  'use strict';
  var LABELS = {
    name: '이름', phone: '휴대전화', email: '이메일', region: '주로 일하는 지역', work: '하는 일',
    bizType: '사업 형태', years: '업력', times: '참석하기 좋은 시간대',
    source: '알게 된 경로', message: '하고 싶은 말', session: '참가할 장날', question: '이야기하고 싶은 고민',
    consentPrivacy: '개인정보 동의'
  };
  var TITLES = { apply: '상회원 가입 신청', jangnal: '장날 참가 신청' };

  function collect(form) {
    var data = { type: form.getAttribute('data-type') };
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox') {
        if (!el.checked) return;
        if (data[el.name]) data[el.name] = [].concat(data[el.name], el.value);
        else data[el.name] = el.name === 'times' ? [el.value] : el.value;
      } else {
        data[el.name] = el.value.trim();
        if (el.hasAttribute('data-jangnal-select') && el.selectedIndex >= 0) data.sessionLabel = el.options[el.selectedIndex].text;
      }
    });
    return data;
  }

  function validate(form) {
    var first = null;
    var missing = [];
    Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (el) {
      var bad = el.type === 'checkbox' ? !el.checked : !el.value.trim();
      if (el.type === 'tel' && !bad) bad = el.value.replace(/\D/g, '').length < 9;
      if (el.type === 'email' && el.value && !/^\S+@\S+\.\S+$/.test(el.value)) bad = true;
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (bad) { missing.push(LABELS[el.name] || el.name); if (!first) first = el; }
    });
    return { ok: !first, first: first, missing: missing };
  }

  function summary(data) {
    var lines = ['[' + (TITLES[data.type] || '신청') + ']'];
    Object.keys(LABELS).forEach(function (k) {
      if (data[k] == null || data[k] === '') return;
      var v = Array.isArray(data[k]) ? data[k].join(', ') : data[k];
      if (k === 'session' && data.sessionLabel) v = data.sessionLabel;
      lines.push(LABELS[k] + ': ' + v);
    });
    return lines.join('\n');
  }

  function showResult(form, html) {
    var box = document.createElement('div');
    box.className = 'form-result';
    box.setAttribute('tabindex', '-1');
    box.innerHTML = html;
    form.replaceWith(box);
    box.focus();
    return box;
  }

  function success(form, type, data) {
    var notifyOnly = type === 'jangnal' && data && data.session === 'notify';
    var msg = notifyOnly
      ? '<h3>알림 신청을 받았습니다</h3><p>다음 장날 일정이 정해지면 문자로 알려 드립니다.</p>'
      : type === 'jangnal'
      ? '<h3>장날 신청을 받았습니다</h3><p>장소와 시간을 문자로 다시 안내드립니다. 장날에서 뵙겠습니다.</p>'
      : '<h3>가입 신청서를 받았습니다</h3><p>웰컴 담당 운영진이 3일 안에 15분 화상 인터뷰 일정을 연락드립니다. 그 전에 <a href="/charter">상회 헌장</a>을 한 번 더 읽어 봐 주세요.</p>';
    showResult(form, msg);
  }

  function fallback(form, data) {
    var C = window.SITE_CONFIG || {};
    var email = C.contact && C.contact.email;
    var text = summary(data);
    var how = email
      ? '<p>아래 내용을 복사해 이메일(<strong>' + email.replace(/</g, '&lt;') + '</strong>)로 보내 주시면 같은 신청으로 처리합니다.</p>'
      : '<p>아래 내용을 복사해 두셨다가 잠시 뒤 다시 보내 주세요. 문의 창구가 열리면 바닥글에 안내합니다.</p>';
    var box = showResult(form,
      '<h3>온라인 접수가 아직 연결되지 않았습니다</h3>' + how +
      '<textarea readonly aria-label="신청 내용"></textarea>' +
      '<div class="actions"><button type="button" class="btn btn-primary js-copy">신청 내용 복사</button>' +
      (email ? '<a class="btn btn-ghost" href="mailto:' + encodeURIComponent(email) + '?subject=' +
        encodeURIComponent('[열정상회] ' + (TITLES[data.type] || '신청')) + '&body=' + encodeURIComponent(text) + '">메일 앱으로 보내기</a>' : '') +
      '</div><p class="note js-copy-msg" role="status"></p>');
    var ta = box.querySelector('textarea');
    ta.value = text;
    box.querySelector('.js-copy').addEventListener('click', function () {
      var msg = box.querySelector('.js-copy-msg');
      function done() { msg.textContent = '복사했습니다.'; }
      function manual() { ta.focus(); ta.select(); msg.textContent = '내용을 선택해 두었습니다. 길게 눌러 복사해 주세요.'; }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, manual);
        else manual();
      } catch (e) { manual(); }
    });
  }

  /* 개인정보 처리방침: 신청서를 쓰던 화면을 떠나지 않도록 창 위에 띄워 보여 줍니다. */
  var privacyDialog = null;
  function openPrivacy(link) {
    if (!privacyDialog) {
      privacyDialog = document.createElement('dialog');
      privacyDialog.className = 'policy-dialog';
      privacyDialog.setAttribute('aria-labelledby', 'policy-dialog-title');
      privacyDialog.innerHTML = '<div class="policy-dialog-head"><h2 id="policy-dialog-title">개인정보 처리방침</h2>' +
        '<button type="button" class="policy-close" aria-label="닫기">닫기</button></div>' +
        '<div class="policy-dialog-body prose"><p>불러오는 중입니다…</p></div>' +
        '<div class="policy-dialog-foot"><button type="button" class="btn btn-primary policy-close">확인했습니다</button></div>';
      document.body.appendChild(privacyDialog);
      Array.prototype.forEach.call(privacyDialog.querySelectorAll('.policy-close'), function (b) {
        b.addEventListener('click', function () { privacyDialog.close(); });
      });
      privacyDialog.addEventListener('click', function (e) { if (e.target === privacyDialog) privacyDialog.close(); });
      privacyDialog.addEventListener('close', function () { if (privacyDialog.opener) privacyDialog.opener.focus(); });
      var body = privacyDialog.querySelector('.policy-dialog-body');
      fetch(link.getAttribute('href'), { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error('load');
        return r.text();
      }).then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var src = doc.querySelector('[data-policy]') || doc.querySelector('main .prose') || doc.querySelector('main');
        if (!src) throw new Error('empty');
        Array.prototype.forEach.call(src.querySelectorAll('script, form, img, picture'), function (n) { n.remove(); });
        body.innerHTML = '';
        Array.prototype.forEach.call(src.childNodes, function (n) { body.appendChild(document.importNode(n, true)); });
        Array.prototype.forEach.call(body.querySelectorAll('a[href]'), function (a) { a.target = '_blank'; a.rel = 'noopener'; });
        var op = (window.SITE_CONFIG || {}).operator || {};
        Array.prototype.forEach.call(body.querySelectorAll('[data-operator-name]'), function (el) { el.textContent = op.name || '열정상회'; });
        if (op.privacyOfficer || op.privacyEmail) {
          Array.prototype.forEach.call(body.querySelectorAll('[data-privacy-contact]'), function (el) {
            el.textContent = '담당: ' + [op.privacyOfficer, op.privacyEmail].filter(Boolean).join(', ');
          });
        }
      }).catch(function () {
        body.innerHTML = '<p>처리방침을 불러오지 못했습니다. <a href="/privacy" target="_blank" rel="noopener">새 창에서 보기</a>를 눌러 주세요. 쓰던 신청서는 그대로 남아 있습니다.</p>';
      });
    }
    privacyDialog.opener = link;
    if (typeof privacyDialog.showModal === 'function') {
      privacyDialog.showModal();
      privacyDialog.querySelector('.policy-dialog-body').scrollTop = 0;
      return true;
    }
    return false;
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-privacy-popup]'), function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (openPrivacy(a)) e.preventDefault();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.js-form'), function (form) {
    var err = form.querySelector('.form-error');
    var submit = form.querySelector('[type="submit"]');
    var label = submit.textContent;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.textContent = '';
      var v = validate(form);
      if (!v.ok) {
        err.textContent = v.missing.join(', ') + ' 항목을 확인해 주세요.';
        v.first.focus();
        return;
      }
      var data = collect(form);
      submit.disabled = true;
      submit.textContent = '보내는 중…';

      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);

      fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) { return { res: res, body: body }; });
      }).then(function (r) {
        clearTimeout(timer);
        if (r.res.ok && r.body.ok) return success(form, data.type, data);
        if (r.res.status === 422) {
          submit.disabled = false; submit.textContent = label;
          err.textContent = '필수 항목이 비어 있습니다. 다시 확인해 주세요.';
          return;
        }
        fallback(form, data);
      }).catch(function () {
        clearTimeout(timer);
        fallback(form, data);
      });
    });

    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true') e.target.setAttribute('aria-invalid', 'false');
    });
  });
})();
