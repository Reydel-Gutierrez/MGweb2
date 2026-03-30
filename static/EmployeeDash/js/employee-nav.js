/**
 * Loads shared sidebar, marks active nav from body[data-emp-page], wires logout.
 * Pages must include: <div id="emp-sidebar-root"></div>
 * The host is replaced with outerHTML (like Admin) so <aside> is a direct sibling of <main>
 * and the fixed sidebar + main-content layout spacing stays correct.
 */
(function () {
  function ensureUserInfo() {
    var params = new URLSearchParams(window.location.search);
    var stored = {};
    try {
      stored = JSON.parse(localStorage.getItem('userInfo') || '{}') || {};
    } catch (e) {
      stored = {};
    }
    var merged = {
      store_username: params.get('username') || stored.store_username,
      store_name: params.get('name') || stored.store_name,
      store_email: params.get('email') || stored.store_email,
      store_id: params.get('idNumber') || stored.store_id,
      store_payRate: stored.store_payRate,
    };
    if (merged.store_username) {
      localStorage.setItem('userInfo', JSON.stringify(merged));
    }
    return merged;
  }

  function setPageTitle(name) {
    var el = document.getElementById('emp-page-title');
    if (el && name) el.textContent = name;
  }

  function wireLogout() {
    var btn = document.getElementById('emp-logout');
    if (!btn) return;
    btn.addEventListener('click', function () {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userInfo');
      localStorage.removeItem('mgPortal');
      window.location.href = '/EmployeeDash/signin.html';
    });
  }

  /**
   * Soft UI loads before the sidebar exists (sidebar is fetched async), so its
   * sidenav toggle closes over a null #sidenav-main and throws on tap.
   * Re-bind open/close/backdrop after injection — same behavior as Admin MgAdminShell.
   */
  function isMobileSidenavViewport() {
    return typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 1199.98px)').matches
      : window.innerWidth < 1200;
  }

  function ensureBackdrop() {
    var el = document.getElementById('mg-sidenav-backdrop');
    if (el) {
      return el;
    }
    el = document.createElement('div');
    el.id = 'mg-sidenav-backdrop';
    el.className = 'mg-sidenav-backdrop';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    return el;
  }

  function setBackdropVisible(show) {
    var el = document.getElementById('mg-sidenav-backdrop');
    if (!el) {
      return;
    }
    if (show && isMobileSidenavViewport()) {
      el.classList.add('mg-sidenav-backdrop--visible');
    } else {
      el.classList.remove('mg-sidenav-backdrop--visible');
    }
  }

  function toggleEmpSidenav() {
    var body = document.body;
    var sidenav = document.getElementById('sidenav-main');
    var iconSidenav = document.getElementById('iconSidenav');
    var pinned = 'g-sidenav-pinned';
    if (!sidenav) {
      return;
    }
    if (body.classList.contains(pinned)) {
      body.classList.remove(pinned);
      setBackdropVisible(false);
      setTimeout(function () {
        sidenav.classList.remove('bg-white');
      }, 100);
      sidenav.classList.remove('bg-transparent');
      if (iconSidenav) {
        iconSidenav.classList.add('d-none');
      }
    } else {
      body.classList.add(pinned);
      sidenav.classList.add('bg-white');
      sidenav.classList.remove('bg-transparent');
      if (iconSidenav) {
        iconSidenav.classList.remove('d-none');
      }
      setBackdropVisible(true);
    }
  }

  function stripStaleSidenavListeners() {
    var openBtn = document.getElementById('iconNavbarSidenav');
    if (openBtn && openBtn.parentNode) {
      var o = openBtn.cloneNode(true);
      o.classList.add('mg-sidenav-open-btn');
      openBtn.parentNode.replaceChild(o, openBtn);
    }
    var closeBtn = document.getElementById('iconSidenav');
    if (closeBtn && closeBtn.parentNode) {
      var c = closeBtn.cloneNode(true);
      closeBtn.parentNode.replaceChild(c, closeBtn);
    }
  }

  function wireEmpSidenavToggle() {
    stripStaleSidenavListeners();
    var openBtn = document.getElementById('iconNavbarSidenav');
    var closeBtn = document.getElementById('iconSidenav');
    var backdrop = ensureBackdrop();
    if (openBtn && !openBtn.dataset.mgEmpBound) {
      openBtn.dataset.mgEmpBound = '1';
      openBtn.addEventListener('click', function (e) {
        e.preventDefault();
        toggleEmpSidenav();
      });
    }
    if (closeBtn && !closeBtn.dataset.mgEmpBound) {
      closeBtn.dataset.mgEmpBound = '1';
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        toggleEmpSidenav();
      });
      closeBtn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleEmpSidenav();
        }
      });
    }
    if (backdrop && !backdrop.dataset.mgEmpBound) {
      backdrop.dataset.mgEmpBound = '1';
      backdrop.addEventListener('click', function () {
        if (document.body.classList.contains('g-sidenav-pinned')) {
          toggleEmpSidenav();
        }
      });
    }
    if (!window.__mgEmpSidenavResizeBound) {
      window.__mgEmpSidenavResizeBound = true;
      window.addEventListener('resize', function () {
        if (!isMobileSidenavViewport()) {
          document.body.classList.remove('g-sidenav-pinned');
          setBackdropVisible(false);
          var sn = document.getElementById('sidenav-main');
          var ic = document.getElementById('iconSidenav');
          if (ic) {
            ic.classList.add('d-none');
          }
          if (sn) {
            sn.classList.remove('bg-transparent');
          }
        }
      });
    }
  }

  function wireEmpNavCloseOnMobile() {
    var sm = document.getElementById('sidenav-main');
    if (!sm || sm.dataset.mgEmpNavCloseBound) {
      return;
    }
    sm.dataset.mgEmpNavCloseBound = '1';
    sm.addEventListener('click', function (e) {
      var a = e.target.closest('a.nav-link[href]');
      var href = a ? a.getAttribute('href') : '';
      if (!a || !href || href.indexOf('javascript:') === 0) {
        return;
      }
      if (!isMobileSidenavViewport() || !document.body.classList.contains('g-sidenav-pinned')) {
        return;
      }
      document.body.classList.remove('g-sidenav-pinned');
      setBackdropVisible(false);
      var ic = document.getElementById('iconSidenav');
      if (ic) {
        ic.classList.add('d-none');
      }
    });
  }

  function initEmpMobileSidenav() {
    ensureBackdrop();
    wireEmpSidenavToggle();
    wireEmpNavCloseOnMobile();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var info = ensureUserInfo();
    setPageTitle(info.store_name || '');
    wireLogout();

    var root = document.getElementById('emp-sidebar-root');
    if (!root) return;

    fetch('../partials/employee-sidebar.html', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('nav');
        return r.text();
      })
      .then(function (html) {
        root.outerHTML = html.trim();
        var page = document.body.getAttribute('data-emp-page') || '';
        document.querySelectorAll('#sidenav-main [data-emp-nav]').forEach(function (a) {
          if (a.getAttribute('data-emp-nav') === page) {
            a.classList.add('active');
          }
        });
        initEmpMobileSidenav();
      })
      .catch(function () {
        root.outerHTML =
          '<aside class="sidenav navbar navbar-vertical navbar-expand-xs border-0 fixed-start ms-0 bg-white mg-emp-sidenav" id="sidenav-main"><div class="p-3 text-sm text-danger">Could not load menu. Refresh the page.</div></aside>';
      });
  });
})();
