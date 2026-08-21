/**
 * Loads client sidebar, marks active nav, wires logout and mobile sidenav.
 */
(function () {
  var SIGNIN = '/EmployeeDash/signin.html?portal=client';

  function isMobileSidenavViewport() {
    return typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 1199.98px)').matches
      : window.innerWidth < 1200;
  }

  function ensureBackdrop() {
    var el = document.getElementById('mg-sidenav-backdrop');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'mg-sidenav-backdrop';
    el.className = 'mg-sidenav-backdrop';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    return el;
  }

  function setBackdropVisible(show) {
    var el = document.getElementById('mg-sidenav-backdrop');
    if (!el) return;
    if (show && isMobileSidenavViewport()) el.classList.add('mg-sidenav-backdrop--visible');
    else el.classList.remove('mg-sidenav-backdrop--visible');
  }

  function toggleSidenav() {
    var body = document.body;
    var sidenav = document.getElementById('sidenav-main');
    var iconSidenav = document.getElementById('iconSidenav');
    if (!sidenav) return;
    if (body.classList.contains('g-sidenav-pinned')) {
      body.classList.remove('g-sidenav-pinned');
      setBackdropVisible(false);
      if (iconSidenav) iconSidenav.classList.add('d-none');
    } else {
      body.classList.add('g-sidenav-pinned');
      if (iconSidenav) iconSidenav.classList.remove('d-none');
      setBackdropVisible(true);
    }
  }

  function wireSidenav() {
    ensureBackdrop();
    var openBtn = document.getElementById('iconNavbarSidenav');
    var closeBtn = document.getElementById('iconSidenav');
    var backdrop = document.getElementById('mg-sidenav-backdrop');
    if (openBtn && !openBtn.dataset.mgClientBound) {
      openBtn.dataset.mgClientBound = '1';
      openBtn.addEventListener('click', function (e) {
        e.preventDefault();
        toggleSidenav();
      });
    }
    if (closeBtn && !closeBtn.dataset.mgClientBound) {
      closeBtn.dataset.mgClientBound = '1';
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        toggleSidenav();
      });
    }
    if (backdrop && !backdrop.dataset.mgClientBound) {
      backdrop.dataset.mgClientBound = '1';
      backdrop.addEventListener('click', function () {
        if (document.body.classList.contains('g-sidenav-pinned')) toggleSidenav();
      });
    }
  }

  function wireLogout() {
    var btn = document.getElementById('client-logout');
    if (!btn) return;
    btn.addEventListener('click', function () {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userInfo');
      localStorage.removeItem('mgPortal');
      fetch('/clientLogout', { method: 'POST', credentials: 'same-origin' }).finally(function () {
        window.location.href = SIGNIN;
      });
    });
  }

  function setPageTitle(name) {
    var title = document.getElementById('client-page-title');
    if (title && name) title.textContent = name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var info = {};
    try { info = JSON.parse(localStorage.getItem('userInfo') || '{}') || {}; } catch (e) { info = {}; }
    setPageTitle(info.store_name);
    wireLogout();

    fetch('/api/ops/me', { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('auth');
        return res.json();
      })
      .then(function (me) {
        if (!me || me.role !== 'client') throw new Error('auth');
        if (me.fullName) {
          info.store_name = me.fullName;
          info.store_username = me.username || info.store_username;
          localStorage.setItem('userInfo', JSON.stringify(info));
          setPageTitle(me.fullName);
        }
        if (me.clientOrgName) {
          var org = document.getElementById('client-org-name');
          if (org) org.textContent = me.clientOrgName;
        }
      })
      .catch(function () {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('mgPortal');
        window.location.href = SIGNIN;
      });

    var root = document.getElementById('client-sidebar-root');
    if (!root) return;
    fetch('../partials/client-sidebar.html', { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        root.outerHTML = html.trim();
        var page = document.body.getAttribute('data-client-page') || '';
        document.querySelectorAll('#sidenav-main [data-client-nav]').forEach(function (a) {
          if (a.getAttribute('data-client-nav') === page) a.classList.add('active');
        });
        wireSidenav();
      })
      .catch(function () {
        root.outerHTML = '<aside class="sidenav bg-white p-3" id="sidenav-main">Menu could not load.</aside>';
      });
  });
})();
