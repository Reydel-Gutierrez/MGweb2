(function () {
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('userInfo') || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var u = getUser();
    var set = function (id, v) {
      var el = document.getElementById(id);
      if (el) el.textContent = v || '—';
    };

    set('prof-name', u.store_name);
    set('prof-user', u.store_username);
    set('prof-email', u.store_email);
    set('prof-id', u.store_id);
    set('prof-rate', u.store_payRate);

    if (!u.store_username) return;

    fetch('/employeeProfile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u.store_username }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('x');
        return r.json();
      })
      .then(function (p) {
        set('prof-name', p.fullName);
        set('prof-user', p.username);
        set('prof-email', p.email);
        set('prof-id', p.idNumber);
        set('prof-rate', p.payRate || '—');
        var merged = {
          store_username: p.username,
          store_name: p.fullName,
          store_email: p.email || '',
          store_id: p.idNumber || '',
          store_payRate: p.payRate || '',
        };
        localStorage.setItem('userInfo', JSON.stringify(merged));
      })
      .catch(function () {
        var err = document.getElementById('prof-err');
        if (err) err.textContent = 'Could not refresh profile from the server. Showing saved session data.';
      });
  });
})();
