/**
 * MG Admin — shared sidebar and shell (single source for navigation IA).
 * Call MgAdminShell.init({ page: 'dashboard' }) after DOM ready.
 */
(function (global) {
  var SECTIONS = [
    {
      title: 'Operations',
      items: [
        { id: 'dashboard', href: 'dashboard.html', label: 'Dashboard', icon: 'fa-chart-line' },
        { id: 'employees', href: 'employees.html', label: 'Employees', icon: 'fa-users' },
        { id: 'payroll', href: 'payroll.html', label: 'Payroll', icon: 'fa-file-invoice-dollar' },
        { id: 'invoice-workspace', href: 'invoice-workspace.html', label: 'Invoice workspace', icon: 'fa-pen-to-square' },
        { id: 'invoices', href: 'invoices.html', label: 'Invoice log', icon: 'fa-receipt' },
        { id: 'time-punches', href: 'time-punches.html', label: 'Time & punches', icon: 'fa-clock' },
        { id: 'requests', href: 'requests.html', label: 'Requests', icon: 'fa-clipboard-check' },
        { id: 'leads', href: 'leads.html', label: 'Leads & intake', icon: 'fa-address-book' },
        { id: 'tasks', href: 'tasks.html', label: 'Tasks & schedule', icon: 'fa-calendar-check' }
      ]
    },
    {
      title: 'Team',
      items: [
        { id: 'register', href: 'registerEmployee.html', label: 'Register employee', icon: 'fa-user-plus' }
      ]
    },
    {
      title: 'Account',
      items: [{ id: 'profile', href: 'profile.html', label: 'Profile & settings', icon: 'fa-user-cog' }]
    }
  ];

  function iconMarkup(iconClass) {
    return (
      '<div class="icon icon-shape icon-sm shadow border-radius-md bg-white text-center me-2 d-flex align-items-center justify-content-center">' +
      '<i class="fas ' + iconClass + ' text-dark text-sm"></i></div>'
    );
  }

  function renderSidebar(activeId) {
    var nav = '';
    for (var s = 0; s < SECTIONS.length; s++) {
      var sec = SECTIONS[s];
      nav +=
        '<li class="nav-item mt-3">' +
        '<h6 class="ps-4 ms-2 text-uppercase text-xs font-weight-bolder opacity-6">' +
        sec.title +
        '</h6></li>';
      for (var i = 0; i < sec.items.length; i++) {
        var it = sec.items[i];
        var isActive = it.id === activeId ? 'active' : '';
        nav +=
          '<li class="nav-item">' +
          '<a class="nav-link ' +
          isActive +
          '" href="' +
          it.href +
          '">' +
          iconMarkup(it.icon) +
          '<span class="nav-link-text ms-1">' +
          it.label +
          '</span></a></li>';
      }
    }

    return (
      '<aside class="sidenav navbar navbar-vertical navbar-expand-xs border-0 border-radius-xl my-3 fixed-start ms-3" id="sidenav-main">' +
      '<div class="sidenav-header">' +
      '<i class="fas fa-times p-3 cursor-pointer text-secondary opacity-5 position-absolute end-0 top-0 d-none" aria-hidden="true" role="button" tabindex="0" id="iconSidenav"></i>' +
      '<a class="navbar-brand m-0" href="dashboard.html">' +
      '<img src="../img/logo/MGnewlogo.png" class="navbar-brand-img mg-brand-logo" alt="MG Building Services">' +
      '<span class="ms-1 font-weight-bold">MG Operations</span>' +
      '<span class="mg-nav-brand-sub">Building Services</span>' +
      '</a></div>' +
      '<hr class="horizontal dark mt-0">' +
      '<div class="collapse navbar-collapse w-auto" id="sidenav-collapse-main">' +
      '<ul class="navbar-nav">' +
      nav +
      '</ul></div></aside>'
    );
  }

  function isMobileSidenavViewport() {
    return typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 1199.98px)').matches
      : window.innerWidth < 1200;
  }

  function injectNavToggle() {
    if (document.getElementById('iconNavbarSidenav')) {
      return;
    }
    var container = document.querySelector('main.main-content .navbar-main .container-fluid');
    if (!container) {
      return;
    }
    var kids = [];
    while (container.firstChild) {
      kids.push(container.removeChild(container.firstChild));
    }
    var toggle = document.createElement('a');
    toggle.href = 'javascript:;';
    toggle.id = 'iconNavbarSidenav';
    toggle.className =
      'nav-link text-body p-2 flex-shrink-0 align-self-start d-xl-none mg-sidenav-open-btn';
    toggle.setAttribute('aria-label', 'Open navigation menu');
    toggle.setAttribute('role', 'button');
    toggle.innerHTML =
      '<div class="sidenav-toggler-inner"><i class="sidenav-toggler-line"></i><i class="sidenav-toggler-line"></i><i class="sidenav-toggler-line"></i></div>';
    var inner = document.createElement('div');
    inner.className =
      'flex-grow-1 min-w-0 d-flex flex-wrap align-items-center justify-content-between gap-2';
    for (var i = 0; i < kids.length; i++) {
      inner.appendChild(kids[i]);
    }
    container.classList.add('d-flex', 'flex-wrap', 'align-items-start', 'align-items-md-center', 'gap-2', 'w-100');
    container.appendChild(toggle);
    container.appendChild(inner);
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

  function toggleSidenav() {
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

  function wireSidenavToggle() {
    var openBtn = document.getElementById('iconNavbarSidenav');
    var closeBtn = document.getElementById('iconSidenav');
    var backdrop = ensureBackdrop();
    if (openBtn && !openBtn.dataset.mgBound) {
      openBtn.dataset.mgBound = '1';
      openBtn.addEventListener('click', function (e) {
        e.preventDefault();
        toggleSidenav();
      });
    }
    if (closeBtn && !closeBtn.dataset.mgBound) {
      closeBtn.dataset.mgBound = '1';
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        toggleSidenav();
      });
      closeBtn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleSidenav();
        }
      });
    }
    if (backdrop && !backdrop.dataset.mgBound) {
      backdrop.dataset.mgBound = '1';
      backdrop.addEventListener('click', function () {
        if (document.body.classList.contains('g-sidenav-pinned')) {
          toggleSidenav();
        }
      });
    }
    if (!window.__mgSidenavResizeBound) {
      window.__mgSidenavResizeBound = true;
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

  function wireNavCloseOnMobile() {
    var sm = document.getElementById('sidenav-main');
    if (!sm || sm.dataset.mgNavCloseBound) {
      return;
    }
    sm.dataset.mgNavCloseBound = '1';
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

  global.MgAdminShell = {
    init: function (options) {
      var page = (options && options.page) || 'dashboard';
      var host = document.getElementById('mg-sidebar-root');
      if (host) {
        host.outerHTML = renderSidebar(page);
      }
      injectNavToggle();
      ensureBackdrop();
      wireSidenavToggle();
      wireNavCloseOnMobile();
    }
  };
})(window);
