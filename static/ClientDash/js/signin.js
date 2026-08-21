document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('loginButton').addEventListener('click', async function () {
    var err = document.getElementById('mg-error');
    err.textContent = '';
    try {
      var res = await fetch('/loginClient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          username: document.getElementById('usernameField').value,
          password: document.getElementById('passwordField').value
        })
      });
      var data = await res.json();
      if (!res.ok) {
        err.textContent = data.message || 'Sign in failed.';
        return;
      }
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('mgPortal', 'client');
      localStorage.setItem('userInfo', JSON.stringify({
        store_username: data.username,
        store_name: data.name || ''
      }));
      window.location.href = '/ClientDash/pages/schedule.html';
    } catch (e) {
      err.textContent = 'Something went wrong. Check your connection and try again.';
    }
  });
});
