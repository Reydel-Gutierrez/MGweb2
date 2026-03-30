(function () {
  var allPunches = [];

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('userInfo') || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function parseUsDate(dateStr) {
    if (!dateStr) return null;
    var t = Date.parse(dateStr);
    if (!isNaN(t)) return new Date(t);
    return null;
  }

  function inRange(p, from, to) {
    if (!from && !to) return true;
    var d = parseUsDate(p.date);
    if (!d) return true;
    var t = d.getTime();
    if (from && t < from.getTime()) return false;
    if (to) {
      var end = new Date(to);
      end.setHours(23, 59, 59, 999);
      if (t > end.getTime()) return false;
    }
    return true;
  }

  function matchesQ(p, q) {
    if (!q) return true;
    var s = (p.date + ' ' + p.time + ' ' + p.action).toLowerCase();
    return s.indexOf(q.toLowerCase()) !== -1;
  }

  function render() {
    var q = (document.getElementById('emp-ph-filter-q') || {}).value || '';
    var fromVal = (document.getElementById('emp-ph-from') || {}).value;
    var toVal = (document.getElementById('emp-ph-to') || {}).value;
    var from = fromVal ? new Date(fromVal + 'T00:00:00') : null;
    var to = toVal ? new Date(toVal + 'T00:00:00') : null;

    var filtered = allPunches.filter(function (p) {
      return matchesQ(p, q) && inRange(p, from, to);
    });

    var tbody = document.getElementById('emp-ph-tbody');
    var cards = document.getElementById('emp-ph-cards');
    var empty = document.getElementById('emp-ph-empty');
    if (tbody) tbody.innerHTML = '';
    if (cards) cards.innerHTML = '';

    if (filtered.length === 0) {
      if (empty) empty.classList.remove('d-none');
      return;
    }
    if (empty) empty.classList.add('d-none');

    filtered.forEach(function (p) {
      if (tbody) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td class="text-sm">' +
          (p.date || '') +
          '</td><td class="text-sm">' +
          (p.time || '') +
          '</td><td class="text-sm">' +
          '<span class="badge ' +
          (p.action === 'Clock In' ? 'bg-success' : 'bg-secondary') +
          '">' +
          (p.action || '') +
          '</span></td>';
        tbody.appendChild(tr);
      }
      if (cards) {
        var div = document.createElement('div');
        div.className = 'emp-pay-card';
        div.innerHTML =
          '<div class="d-flex justify-content-between align-items-start gap-2">' +
          '<div><div class="text-sm font-weight-bold">' +
          (p.date || '') +
          '</div><div class="text-xs text-muted">' +
          (p.time || '') +
          '</div></div>' +
          '<span class="badge ' +
          (p.action === 'Clock In' ? 'bg-success' : 'bg-secondary') +
          '">' +
          (p.action || '') +
          '</span></div>';
        cards.appendChild(div);
      }
    });
  }

  function setAlert(last) {
    var el = document.getElementById('emp-punch-alert');
    if (!el) return;
    if (last && last.action === 'Clock In') {
      el.textContent =
        'You appear to be clocked in with no matching clock out yet. If that is wrong, submit a correction from Requests.';
      el.classList.remove('d-none');
    } else {
      el.classList.add('d-none');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var u = getUser();
    if (!u.store_username) return;

    fetch('/employeePunchHistory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u.store_username }),
    })
      .then(function (r) {
        if (r.status === 404) return { punches: [] };
        if (!r.ok) throw new Error('x');
        return r.json();
      })
      .then(function (data) {
        allPunches = (data && data.punches) || [];
        setAlert(allPunches[0]);
        render();
      })
      .catch(function () {
        allPunches = [];
        render();
      });

    ['emp-ph-filter-q', 'emp-ph-from', 'emp-ph-to'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', render);
    });
    var clear = document.getElementById('emp-ph-clear');
    if (clear) {
      clear.addEventListener('click', function () {
        var a = document.getElementById('emp-ph-filter-q');
        var b = document.getElementById('emp-ph-from');
        var c = document.getElementById('emp-ph-to');
        if (a) a.value = '';
        if (b) b.value = '';
        if (c) c.value = '';
        render();
      });
    }
  });
})();
