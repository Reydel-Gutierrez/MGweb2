/**
 * Admin session guard and header user display.
 * Requires mgPortal === 'admin' so employee-only sessions cannot open admin pages.
 */
(function () {
  var PORTAL_KEY = 'mgPortal';

  function redirectSignin() {
    window.location.href = '/EmployeeDash/signin.html?portal=admin';
  }

  if (
    !localStorage.getItem('isLoggedIn') ||
    localStorage.getItem(PORTAL_KEY) !== 'admin'
  ) {
    redirectSignin();
    return;
  }

  function applyUserInfo() {
    var raw = localStorage.getItem('userInfo');
    var info = {};
    try {
      info = raw ? JSON.parse(raw) : {};
    } catch (e) {
      info = {};
    }
    var name = info.store_name || '';
    var els = document.querySelectorAll('[data-mg-user-name]');
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = name || 'Admin';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyUserInfo);
  } else {
    applyUserInfo();
  }

  window.MgAdminAuth = {
    signOut: function () {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userInfo');
      localStorage.removeItem(PORTAL_KEY);
      fetch('/adminLogout', { method: 'POST', credentials: 'same-origin' }).finally(
        function () {
          redirectSignin();
        }
      );
    }
  };
})();
