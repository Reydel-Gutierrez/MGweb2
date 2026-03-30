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
      })
      .catch(function () {
        root.outerHTML =
          '<aside class="sidenav navbar navbar-vertical navbar-expand-xs border-0 fixed-start ms-0 bg-white mg-emp-sidenav" id="sidenav-main"><div class="p-3 text-sm text-danger">Could not load menu. Refresh the page.</div></aside>';
      });
  });
})();
