(function () {
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('userInfo') || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function todayKey() {
    var d = new Date();
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function updateClock() {
    var now = new Date();
    var dateLine = document.getElementById('emp-date-line');
    var timeLine = document.getElementById('emp-time-line');
    if (dateLine)
      dateLine.textContent = now.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    if (timeLine)
      timeLine.textContent = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
  }

  function setStatus(last) {
    var chip = document.getElementById('emp-status-chip');
    if (!chip) return;
    if (!last) {
      chip.textContent = 'No punches yet';
      chip.className = 'badge bg-secondary text-uppercase';
      return;
    }
    if (last.action === 'Clock In') {
      chip.textContent = 'Clocked in';
      chip.className = 'badge bg-success text-uppercase';
    } else {
      chip.textContent = 'Clocked out';
      chip.className = 'badge bg-secondary text-uppercase';
    }
  }

  function renderLists(punches) {
    var todayStr = (document.getElementById('emp-date-line') || {}).textContent || '';
    var todayPunches = [];
    punches.forEach(function (p) {
      if (p.date && todayStr && p.date === todayStr) todayPunches.push(p);
    });

    var sumEl = document.getElementById('emp-today-summary');
    if (sumEl)
      sumEl.textContent =
        'Punches recorded today: ' + todayPunches.length + (todayPunches.length === 1 ? ' event' : ' events');

    var todayTbody = document.getElementById('emp-today-tbody');
    if (todayTbody) {
      todayTbody.innerHTML = '';
      if (todayPunches.length === 0) {
        var tr0 = document.createElement('tr');
        tr0.innerHTML =
          '<td colspan="2" class="mg-empty-cell">No punches yet today.</td>';
        todayTbody.appendChild(tr0);
      } else {
        todayPunches
          .slice()
          .reverse()
          .forEach(function (p) {
            var tr = document.createElement('tr');
            var actLabel =
              p.action === 'Clock In'
                ? '<span class="badge bg-success">In</span>'
                : '<span class="badge bg-secondary">Out</span>';
            tr.innerHTML =
              '<td class="text-sm">' +
              (p.time || '') +
              '</td><td class="text-sm">' +
              actLabel +
              '</td>';
            todayTbody.appendChild(tr);
          });
      }
    }

    var recentBody = document.getElementById('emp-recent-tbody');
    if (recentBody) {
      recentBody.innerHTML = '';
      var slice = punches.slice(0, 6);
      if (slice.length === 0) {
        var r0 = document.createElement('tr');
        r0.innerHTML =
          '<td colspan="3" class="mg-empty-cell">No punch history yet.</td>';
        recentBody.appendChild(r0);
      } else {
        slice.forEach(function (p) {
          var tr = document.createElement('tr');
          tr.innerHTML =
            '<td class="text-sm">' +
            (p.date || '') +
            '</td><td class="text-sm">' +
            (p.time || '') +
            '</td><td class="text-sm">' +
            (p.action || '') +
            '</td>';
          recentBody.appendChild(tr);
        });
      }
    }

    var lastLine = document.getElementById('emp-last-punch-line');
    if (lastLine && punches[0]) {
      var lp = punches[0];
      lastLine.textContent =
        'Last punch: ' + lp.action + ' · ' + (lp.date || '') + ' at ' + (lp.time || '');
    } else if (lastLine) {
      lastLine.textContent = 'No punches recorded yet.';
    }

    setStatus(punches[0]);
  }

  function loadPunchData(u, cb) {
    fetch('/employeePunchHistory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u.store_username }),
    })
      .then(function (r) {
        if (r.status === 404) return { punches: [], fullname: u.store_name };
        if (!r.ok) throw new Error('punch');
        return r.json();
      })
      .then(function (data) {
        var punches = (data && data.punches) || [];
        cb(punches, data && data.fullname);
      })
      .catch(function () {
        cb([], u.store_name);
      });
  }

  function loadPaySnapshot(fullName) {
    var tbody = document.getElementById('emp-pay-tbody');
    var wrap = document.getElementById('emp-pay-wrap');
    var empty = document.getElementById('emp-pay-empty');
    if (!fullName) {
      if (tbody) tbody.innerHTML = '';
      if (wrap) wrap.classList.add('d-none');
      if (empty) {
        empty.textContent = 'Sign in to view payroll.';
        empty.classList.remove('d-none');
      }
      return;
    }
    fetch('/employeePayHistory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: fullName }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('pay');
        return r.json();
      })
      .then(function (rows) {
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!rows || !rows.length) {
          if (wrap) wrap.classList.add('d-none');
          if (empty) {
            empty.textContent =
              'No payroll records on file yet. When payroll is processed, it will appear here.';
            empty.classList.remove('d-none');
          }
          return;
        }
        if (wrap) wrap.classList.remove('d-none');
        if (empty) empty.classList.add('d-none');
        var latest = rows.reduce(function (a, b) {
          return new Date(a.payDate) > new Date(b.payDate) ? a : b;
        });
        var amt = typeof latest.amount === 'number' ? latest.amount.toFixed(2) : String(latest.amount);
        var rate =
          typeof latest.payRate === 'number' ? latest.payRate.toFixed(2) : String(latest.payRate);
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td class="text-sm">' +
          new Date(latest.fromDate).toLocaleDateString() +
          ' – ' +
          new Date(latest.toDate).toLocaleDateString() +
          '</td><td class="text-sm">' +
          new Date(latest.payDate).toLocaleDateString() +
          '</td><td class="text-sm">' +
          latest.hours +
          '</td><td class="text-sm">$' +
          rate +
          '</td><td class="text-sm text-end font-weight-bold">$' +
          amt +
          '</td>';
        tbody.appendChild(tr);
      })
      .catch(function () {
        if (tbody) tbody.innerHTML = '';
        if (wrap) wrap.classList.add('d-none');
        if (empty) {
          empty.textContent = 'Could not load payroll.';
          empty.classList.remove('d-none');
        }
      });
  }

  function doPunch(action) {
    var u = getUser();
    var msg = document.getElementById('emp-punch-msg');
    if (!u.store_username || !u.store_name) {
      if (msg) msg.textContent = 'Session incomplete. Please sign in again.';
      return;
    }
    var dateLine = document.getElementById('emp-date-line');
    var timeLine = document.getElementById('emp-time-line');
    var date = dateLine ? dateLine.textContent : todayKey();
    var time = timeLine ? timeLine.textContent : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    fetch('/employeePunching', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: u.store_username,
        fullname: u.store_name,
        date: date,
        time: time,
        action: action,
      }),
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw e; });
        return r.json();
      })
      .then(function (data) {
        if (msg) {
          msg.textContent = '';
          msg.className = 'text-xs text-success mt-3 mb-0';
          msg.textContent = 'Saved.';
        }
        var punches = (data.data && data.data.punches) || [];
        renderLists(punches);
      })
      .catch(function (err) {
        var m = (err && err.message) || 'Could not save punch.';
        alert(m);
        if (msg) {
          msg.className = 'text-xs text-warning mt-3 mb-0';
          msg.textContent = m;
        }
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var u = getUser();
    var params = new URLSearchParams(window.location.search);
    if (params.get('username')) {
      u.store_username = params.get('username') || u.store_username;
      u.store_name = params.get('name') || u.store_name;
      localStorage.setItem('userInfo', JSON.stringify(u));
    }

    var title = document.getElementById('emp-page-title');
    if (title && u.store_name) title.textContent = 'Hi, ' + u.store_name.split(' ')[0];

    updateClock();
    setInterval(updateClock, 1000);

    loadPunchData(u, function (punches) {
      updateClock();
      renderLists(punches);
    });
    loadPaySnapshot(u.store_name);

    var btnIn = document.getElementById('emp-btn-in');
    var btnOut = document.getElementById('emp-btn-out');
    if (btnIn) btnIn.addEventListener('click', function () { doPunch('Clock In'); });
    if (btnOut) btnOut.addEventListener('click', function () { doPunch('Clock Out'); });
  });
})();
