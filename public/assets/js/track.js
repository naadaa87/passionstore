/* 열정상회 방문 통계
   쿠키를 쓰지 않습니다. 브라우저에서 "추적 안 함(Do Not Track)"을 켜 두었거나,
   관리자 화면에서 '이 브라우저의 방문은 통계에서 빼기'를 고른 브라우저는 아무것도 보내지 않습니다.
   보내는 것: 본 페이지 주소와 제목, 들어온 경로, 화면을 보고 있던 시간, 스크롤한 정도, 누른 버튼·링크 이름 */
(function () {
  'use strict';
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1') return;
  if (/^\/(admin|api)(\/|$)/.test(location.pathname)) return;
  try { if (localStorage.getItem('ps_notrack') === '1') return; } catch (e) { /* 저장소를 못 쓰면 그대로 셉니다 */ }
  if (!/^https?:$/.test(location.protocol) || /^(localhost|127\.)/.test(location.hostname)) return;

  var URL_ = '/api/track';
  var rnd = function () { return (Math.random().toString(36) + Math.random().toString(36)).replace(/[^a-z0-9]/g, '').slice(0, 16); };
  var sid;
  try { sid = sessionStorage.getItem('ps_sid'); if (!sid) { sid = rnd(); sessionStorage.setItem('ps_sid', sid); } } catch (e) { sid = rnd(); }
  var pid = rnd();

  function send(o) {
    o.sid = sid;
    o.p = location.pathname;
    var body = JSON.stringify(o);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(URL_, new Blob([body], { type: 'application/json' }))) return;
    } catch (e) { /* 아래로 */ }
    try { fetch(URL_, { method: 'POST', body: body, keepalive: true, headers: { 'content-type': 'application/json' } }); } catch (e) { /* 무시 */ }
  }

  var q = new URLSearchParams(location.search);
  send({ t: 'pv', id: pid, title: document.title, r: document.referrer, us: q.get('utm_source'), um: q.get('utm_medium'), uc: q.get('utm_campaign') });

  // 화면을 보고 있던 시간: 탭이 보이고, 1분 안에 움직임이 있었던 시간만 5초 단위로 셉니다.
  var seconds = 0;
  var lastAct = Date.now();
  var maxScroll = 0;
  var mark = function () { lastAct = Date.now(); };
  ['scroll', 'keydown', 'pointerdown', 'pointermove', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, mark, { passive: true }); });
  var lastSent = '';
  function end() {
    var key = seconds + ':' + maxScroll;
    if (key === lastSent) return;
    lastSent = key;
    send({ t: 'end', id: pid, s: seconds, sc: maxScroll });
  }
  // 페이지를 떠날 때 못 보내는 경우가 있어, 보고 있는 동안에도 15초, 45초, 75초…마다 한 번씩 보냅니다.
  setInterval(function () {
    if (document.hidden || Date.now() - lastAct >= 60000) return;
    seconds += 5;
    if (seconds % 30 === 15) end();
  }, 5000);
  function measureScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var pct = h > 0 ? Math.round((window.scrollY / h) * 100) : 100;
    if (pct > maxScroll) maxScroll = Math.min(100, pct);
  }
  window.addEventListener('scroll', measureScroll, { passive: true });
  measureScroll();
  document.addEventListener('visibilitychange', function () { if (document.hidden) end(); });
  window.addEventListener('pagehide', end);

  // 누른 버튼과 링크
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('a[href], button, [data-track]') : null;
    if (!el || el.closest('form') && el.type !== 'submit') return;
    var label = (el.getAttribute('data-track') || el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    var target = '';
    if (el.tagName === 'A') {
      var href = el.getAttribute('href') || '';
      if (/^(tel|mailto):/i.test(href)) target = href.split(':')[0].toLowerCase();
      else {
        try {
          var u = new URL(href, location.href);
          target = u.host === location.host ? u.pathname + (u.hash || '') : u.host;
        } catch (err) { target = ''; }
      }
    } else if (el.form) {
      target = 'form:' + (el.form.getAttribute('data-type') || '');
    }
    if (!label && !target) return;
    send({ t: 'click', label: label, target: target });
    if (el.tagName === 'A') end();
  }, true);

  // 자주 묻는 질문을 연 경우
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (!d || d.tagName !== 'DETAILS' || !d.open) return;
    var s = d.querySelector('summary');
    send({ t: 'faq', label: s ? s.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : '' });
  }, true);

  // 신청서 작성 시작
  var started = {};
  document.addEventListener('focusin', function (e) {
    var f = e.target.closest ? e.target.closest('form[data-type]') : null;
    if (!f) return;
    var type = f.getAttribute('data-type');
    if (started[type]) return;
    started[type] = true;
    send({ t: 'form_start', label: type });
  });
})();
