// 열정상회 공통 스크립트: 메뉴 열기, 설정 값(장날·회비·운영진·연락처) 반영
(function () {
  'use strict';
  var C = window.SITE_CONFIG || {};

  /* 모바일 메뉴 */
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('site-nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? '닫기' : '메뉴';
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = '메뉴';
      }
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  /* 장날 일정 */
  var DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  function parseDate(s) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function timeLabel(t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''));
    if (!m) return '';
    var h = +m[1];
    var ap = h < 12 ? '오전' : '오후';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return ap + ' ' + h12 + (m[2] === '00' ? '시' : ':' + m[2]);
  }
  function dateLabel(d) { return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + DAYS[d.getDay()] + ')'; }
  var STATUS = { open: '신청 받는 중', full: '마감', soon: '신청 준비 중', closed: '마감' };

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var sessions = (C.jangnal || [])
    .map(function (s) { var d = parseDate(s.date); return d ? Object.assign({}, s, { d: d }) : null; })
    .filter(function (s) { return s && s.d >= today; })
    .sort(function (a, b) { return a.d - b.d; });

  if (sessions.length) {
    var next = sessions[0];
    each('[data-jangnal-next]', function (el) {
      el.innerHTML = '<strong>' + esc(dateLabel(next.d)) + ' ' + esc(timeLabel(next.time)) + '</strong>' +
        (next.topic ? ' ' + esc(next.topic) : '') +
        (next.place ? '<br><span class="muted">' + esc(next.place) + '</span>' : '');
    });
    each('[data-jangnal-next-link]', function (el) {
      el.textContent = next.status === 'open' ? '참가 신청' : '일정 보기';
      el.setAttribute('href', next.status === 'open' ? '/jangnal#apply' : '/jangnal#schedule');
    });
    each('[data-jangnal-list]', function (el) {
      el.innerHTML = '<ul class="sessions">' + sessions.map(function (s) {
        var st = s.status || 'soon';
        return '<li><div class="s-date">' + esc(dateLabel(s.d)) + '<small>' + esc(timeLabel(s.time)) + '</small></div>' +
          '<div><div class="s-topic">' + esc(s.topic || '이달의 장날') + '</div><div class="s-place">' + esc(s.place || '장소는 신청자에게 따로 안내합니다') + '</div></div>' +
          '<span class="badge ' + esc(st) + '">' + esc(STATUS[st] || '') + '</span></li>';
      }).join('') + '</ul>';
    });
    each('[data-jangnal-select]', function (sel) {
      sessions.filter(function (s) { return s.status === 'open'; }).forEach(function (s, i) {
        var label = dateLabel(s.d) + ' ' + timeLabel(s.time) + (s.topic ? ', ' + s.topic : '');
        var opt = document.createElement('option');
        opt.value = label; opt.textContent = label;
        sel.insertBefore(opt, sel.firstChild);
        if (i === 0) opt.selected = true;
      });
    });
  }

  /* 회비 */
  var fees = C.fees || {};
  each('[data-fee]', function (el) {
    var v = fees[el.getAttribute('data-fee')];
    if (v) el.textContent = v;
  });

  /* 운영진 */
  var team = (C.team || []).filter(function (m) { return m && m.name; });
  if (team.length) {
    each('[data-team]', function (el) {
      el.innerHTML = '<ul class="team">' + team.map(function (m) {
        return '<li><div class="role">' + esc(m.role) + '</div><div class="name">' + esc(m.name) + '</div></li>';
      }).join('') + '</ul>';
    });
  }

  /* 연락처 */
  var ct = C.contact || {};
  var items = [];
  if (ct.email) items.push('<li>이메일 <a href="mailto:' + esc(ct.email) + '">' + esc(ct.email) + '</a></li>');
  if (ct.kakaoChannel) items.push('<li><a href="' + esc(ct.kakaoChannel) + '" rel="noopener">카카오톡 채널</a></li>');
  if (ct.instagram) items.push('<li><a href="' + esc(ct.instagram) + '" rel="noopener">인스타그램</a></li>');
  if (ct.naverBlog) items.push('<li><a href="' + esc(ct.naverBlog) + '" rel="noopener">네이버 블로그</a></li>');
  if (items.length) each('[data-contact-list]', function (el) { el.innerHTML = items.join(''); });

  /* 운영 정보 */
  var op = C.operator || {};
  var parts = [op.name || '열정상회'];
  if (op.representative) parts.push('대표 ' + op.representative);
  if (op.registrationNo) parts.push('고유번호 ' + op.registrationNo);
  if (op.address) parts.push(op.address);
  each('[data-operator]', function (el) {
    el.innerHTML = parts.map(function (p) { return '<span>' + esc(p) + '</span>'; }).join('');
  });
  each('[data-operator-name]', function (el) { el.textContent = op.name || '열정상회'; });
  if (op.privacyOfficer || op.privacyEmail) {
    each('[data-privacy-contact]', function (el) {
      el.textContent = '담당: ' + [op.privacyOfficer, op.privacyEmail].filter(Boolean).join(', ');
    });
  }
})();
