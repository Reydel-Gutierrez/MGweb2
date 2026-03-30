(function () {
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('userInfo') || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function statusClass(s) {
    if (s === 'approved') return 'bg-gradient-success';
    if (s === 'rejected') return 'bg-gradient-danger';
    return 'bg-gradient-warning';
  }

  function loadList(username) {
    var list = document.getElementById('emp-req-list');
    if (!list) return;

    fetch('/employeePunchRequests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('x');
        return r.json();
      })
      .then(function (items) {
        list.innerHTML = '';
        if (!items || !items.length) {
          list.innerHTML = '<p class="text-sm text-muted mb-0">No requests yet.</p>';
          return;
        }
        items.forEach(function (it) {
          var st = it.status || 'pending';
          var div = document.createElement('div');
          div.className = 'emp-pay-card';
          var nd = it.newDate ? new Date(it.newDate).toLocaleDateString() : '—';
          var nt = it.newTime ? new Date(it.newTime).toLocaleString() : '—';
          div.innerHTML =
            '<div class="d-flex justify-content-between align-items-start gap-2">' +
            '<div class="text-sm"><strong>' +
            nd +
            '</strong><br><span class="text-xs text-muted">' +
            nt +
            '</span></div>' +
            '<span class="badge ' +
            statusClass(st) +
            ' emp-request-badge">' +
            st +
            '</span></div>' +
            (it.newComments
              ? '<p class="text-xs text-muted mt-2 mb-0">' + it.newComments + '</p>'
              : '');
          list.appendChild(div);
        });
      })
      .catch(function () {
        list.innerHTML = '<p class="text-sm text-danger mb-0">Could not load requests.</p>';
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var u = getUser();
    if (u.store_username) loadList(u.store_username);

    var form = document.getElementById('emp-req-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('emp-req-msg');
      if (!u.store_name || !u.store_username) {
        if (msg) msg.textContent = 'Please sign in again.';
        return;
      }

      var dateVal = document.getElementById('emp-req-date').value;
      var timeVal = document.getElementById('emp-req-time').value;
      var act = document.getElementById('emp-req-action').value;
      var note = document.getElementById('emp-req-note').value.trim();

      var newAction = act === 'in' ? 1 : 0;
      var iso = dateVal + 'T' + timeVal + ':00';

      var payload = {
        fullName: u.store_name,
        originalDate: Date.now(),
        originalAction: 0,
        originalTime: new Date(0),
        newDate: new Date(dateVal + 'T12:00:00'),
        newAction: newAction,
        newTime: new Date(iso),
        newComments: note,
      };

      fetch('/changePunchRequest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json().then(function (body) {
            if (!r.ok) throw body;
            return body;
          });
        })
        .then(function () {
          if (msg) {
            msg.className = 'text-xs text-success mt-3 mb-0';
            msg.textContent = 'Request submitted. Thank you.';
          }
          form.reset();
          loadList(u.store_username);
        })
        .catch(function (err) {
          var m = (err && err.message) || 'Could not submit.';
          if (msg) {
            msg.className = 'text-xs text-danger mt-3 mb-0';
            msg.textContent = m;
          }
          alert(m);
        });
    });
  });
})();
