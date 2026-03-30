(function () {
  var rows = [];

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('userInfo') || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function fmtMoney(n) {
    var x = Number(n);
    if (isNaN(x)) return String(n);
    return x.toFixed(2);
  }

  function inPayRange(pay, from, to) {
    if (!from && !to) return true;
    var t = new Date(pay.payDate).getTime();
    if (from && t < from.getTime()) return false;
    if (to) {
      var end = new Date(to);
      end.setHours(23, 59, 59, 999);
      if (t > end.getTime()) return false;
    }
    return true;
  }

  function render() {
    var fromVal = (document.getElementById('emp-pay-from') || {}).value;
    var toVal = (document.getElementById('emp-pay-to') || {}).value;
    var from = fromVal ? new Date(fromVal + 'T00:00:00') : null;
    var to = toVal ? new Date(toVal + 'T00:00:00') : null;

    var filtered = rows.filter(function (p) {
      return inPayRange(p, from, to);
    });

    var tbody = document.getElementById('emp-pay-tbody');
    var cards = document.getElementById('emp-pay-cards');
    var empty = document.getElementById('emp-pay-empty');
    if (tbody) tbody.innerHTML = '';
    if (cards) cards.innerHTML = '';

    if (filtered.length === 0) {
      if (empty) empty.classList.remove('d-none');
      return;
    }
    if (empty) empty.classList.add('d-none');

    filtered
      .slice()
      .sort(function (a, b) {
        return new Date(b.payDate) - new Date(a.payDate);
      })
      .forEach(function (pay) {
        var period =
          new Date(pay.fromDate).toLocaleDateString() +
          ' – ' +
          new Date(pay.toDate).toLocaleDateString();
        var pd = new Date(pay.payDate).toLocaleDateString();
        if (tbody) {
          var tr = document.createElement('tr');
          tr.innerHTML =
            '<td class="text-sm">' +
            period +
            '</td><td class="text-sm">' +
            pd +
            '</td><td class="text-sm">' +
            pay.hours +
            '</td><td class="text-sm">$' +
            fmtMoney(pay.payRate) +
            '</td><td class="text-sm font-weight-bold">$' +
            fmtMoney(pay.amount) +
            '</td><td class="text-sm text-muted">' +
            (pay.comments || '—') +
            '</td>';
          tbody.appendChild(tr);
        }
        if (cards) {
          var div = document.createElement('div');
          div.className = 'emp-pay-card';
          div.innerHTML =
            '<div class="d-flex justify-content-between align-items-start"><div><div class="text-sm font-weight-bold">Pay ' +
            pd +
            '</div><div class="text-xs text-muted">' +
            period +
            '</div></div><div class="text-end"><div class="h6 mb-0">$' +
            fmtMoney(pay.amount) +
            '</div><div class="text-xs text-muted">' +
            pay.hours +
            ' hrs @ $' +
            fmtMoney(pay.payRate) +
            '</div></div></div>' +
            (pay.comments
              ? '<p class="text-xs text-muted mb-0 mt-2">' + pay.comments + '</p>'
              : '');
          cards.appendChild(div);
        }
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var u = getUser();
    if (!u.store_name) return;

    fetch('/employeePayHistory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: u.store_name }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('x');
        return r.json();
      })
      .then(function (data) {
        rows = Array.isArray(data) ? data : [];
        render();
      })
      .catch(function () {
        rows = [];
        render();
      });

    ['emp-pay-from', 'emp-pay-to'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', render);
    });
    var clear = document.getElementById('emp-pay-clear');
    if (clear) {
      clear.addEventListener('click', function () {
        var a = document.getElementById('emp-pay-from');
        var b = document.getElementById('emp-pay-to');
        if (a) a.value = '';
        if (b) b.value = '';
        render();
      });
    }
  });
})();
