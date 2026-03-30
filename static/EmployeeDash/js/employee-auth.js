/**
 * Employee portal guard. Allows employee sessions and admin sessions (mgPortal admin)
 * so staff can open employee tools after signing in at the admin login.
 * Legacy sessions without mgPortal are treated as employee.
 */
(function () {
  var PORTAL_KEY = 'mgPortal';
  var p = localStorage.getItem(PORTAL_KEY);
  var ok =
    localStorage.getItem('isLoggedIn') &&
    (p === 'employee' || p === 'admin' || p === null || p === '');
  if (!ok) {
    window.location.href = '/EmployeeDash/signin.html';
  }
})();
