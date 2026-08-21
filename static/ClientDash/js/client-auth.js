(function () {
  var SIGNIN = '/EmployeeDash/signin.html?portal=client';
  var portal = localStorage.getItem('mgPortal');
  if (!localStorage.getItem('isLoggedIn') || portal !== 'client') {
    window.location.href = SIGNIN;
  }
})();
