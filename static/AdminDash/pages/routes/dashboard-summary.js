/**
 * Admin Dashboard — summary only (KPIs, short lists, quick links).
 */
(function () {
  function syncUserFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var stored = {};
    try {
      stored = JSON.parse(localStorage.getItem('userInfo') || '{}');
    } catch (e) {
      stored = {};
    }
    var merged = {
      store_username: params.get('username') || stored.store_username,
      store_name: params.get('name') || stored.store_name
    };
    localStorage.setItem('userInfo', JSON.stringify(merged));
    var el = document.getElementById('mg-dashboard-welcome');
    if (el) {
      el.textContent = merged.store_name ? 'Welcome back, ' + merged.store_name : 'Operations overview';
    }
  }

  function updateClock() {
    var el = document.getElementById('datetime');
    if (!el) return;
    var now = new Date();
    el.innerHTML =
      '<span>' +
      now.toLocaleDateString() +
      '</span> <span class="text-sm">' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
      '</span>';
  }

  function safeJson(r) {
    return r.ok ? r.json() : [];
  }

  async function loadSummary() {
    var loading = document.getElementById('mg-summary-loading');
    if (loading) loading.style.display = 'block';

    try {
      var results = await Promise.all([
        fetch('/users').then(safeJson),
        fetch('/fetchInvoices').then(safeJson),
        fetch('/fetchPunchRequest?pendingOnly=1').then(safeJson),
        fetch('/api/leads?status=new').then(safeJson),
        fetch('/api/calls?listened=false').then(function (r) {
          return r.ok ? r.json() : [];
        })
      ]);

      var users = Array.isArray(results[0]) ? results[0] : [];
      var invoices = Array.isArray(results[1]) ? results[1] : [];
      var requests = Array.isArray(results[2]) ? results[2] : [];
      var newLeads = Array.isArray(results[3]) ? results[3] : [];
      var unlistenedCalls = Array.isArray(results[4]) ? results[4] : [];

      var pendingInv = invoices.filter(function (inv) {
        return inv.status === 'Unpaid';
      }).length;

      var activeUsers = users.filter(function (u) {
        return u.active !== false;
      });

      var elEmp = document.getElementById('totalEmployeesCount');
      if (elEmp) elEmp.textContent = String(activeUsers.length);

      var elPend = document.getElementById('totalPending');
      if (elPend) elPend.textContent = String(pendingInv);

      var elReq = document.getElementById('mg-pending-requests-count');
      if (elReq) elReq.textContent = String(requests.length);

      var elLeads = document.getElementById('mg-new-leads-kpi');
      if (elLeads) elLeads.textContent = String(newLeads.length);

      var elOpen = document.getElementById('mg-open-requests-kpi');
      if (elOpen) elOpen.textContent = String(requests.length);

      renderRecentInvoices(invoices);
      renderRecentEmployees(activeUsers);
      renderAlerts(requests, pendingInv, newLeads.length, unlistenedCalls.length);
    } catch (e) {
      console.error(e);
    } finally {
      if (loading) loading.style.display = 'none';
    }
  }

  function renderRecentInvoices(invoices) {
    var tbody = document.querySelector('#mg-recent-invoices tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    var sorted = invoices
      .slice()
      .sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
      })
      .slice(0, 5);
    if (!sorted.length) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="mg-empty-state py-3">No invoices yet</td></tr>';
      return;
    }
    sorted.forEach(function (inv) {
      var tr = document.createElement('tr');
      var d = new Date(inv.date).toLocaleDateString();
      var badge =
        inv.status === 'Unpaid'
          ? 'bg-gradient-secondary'
          : 'bg-gradient-success';
      tr.innerHTML =
        '<td>' +
        d +
        '</td><td>' +
        (inv.invoice_title || '') +
        '</td><td>$' +
        (inv.amount != null ? inv.amount : '') +
        '</td><td><span class="badge badge-sm ' +
        badge +
        '">' +
        (inv.status || '') +
        '</span></td>';
      tbody.appendChild(tr);
    });
  }

  function renderRecentEmployees(users) {
    var tbody = document.querySelector('#mg-recent-employees tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    var sorted = users.slice().sort(function (a, b) {
      var ida = a._id != null ? String(a._id) : '';
      var idb = b._id != null ? String(b._id) : '';
      if (ida && idb) return idb.localeCompare(ida);
      return 0;
    });
    var slice = sorted.slice(0, 5);
    if (!slice.length) {
      tbody.innerHTML =
        '<tr><td colspan="3" class="mg-empty-state py-3">No employees yet</td></tr>';
      return;
    }
    slice.forEach(function (u) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><strong>' +
        (u.fullName || '') +
        '</strong></td><td>' +
        (u.username || '') +
        '</td><td>' +
        (u.admin ? 'Admin' : 'Employee') +
        '</td>';
      tbody.appendChild(tr);
    });
  }

  function renderAlerts(requests, pendingInv, newLeadsCount, unlistenedCallCount) {
    var host = document.getElementById('mg-alert-list');
    if (!host) return;
    host.innerHTML = '';
    if (unlistenedCallCount > 0) {
      var callDiv = document.createElement('div');
      callDiv.className = 'mb-2';
      callDiv.innerHTML =
        '<strong>' +
        unlistenedCallCount +
        '</strong> unlistened ' +
        (unlistenedCallCount === 1 ? 'voicemail' : 'voicemails') +
        ' — <a href="calls.html">Calls &amp; voicemail</a>';
      host.appendChild(callDiv);
    }
    if (newLeadsCount > 0) {
      var leadDiv = document.createElement('div');
      leadDiv.className = 'mb-2';
      leadDiv.innerHTML =
        '<strong>' +
        newLeadsCount +
        '</strong> new website ' +
        (newLeadsCount === 1 ? 'lead' : 'leads') +
        ' — <a href="leads.html">Review intake</a>';
      host.appendChild(leadDiv);
    }
    if (requests.length) {
      var li = document.createElement('div');
      li.className = 'mb-2';
      li.innerHTML =
        '<strong>' +
        requests.length +
        '</strong> punch change ' +
        (requests.length === 1 ? 'request' : 'requests') +
        ' waiting — <a href="requests.html">Review</a>';
      host.appendChild(li);
    }
    if (pendingInv > 0) {
      var li2 = document.createElement('div');
      li2.className = 'mb-2';
      li2.innerHTML =
        '<strong>' +
        pendingInv +
        '</strong> unpaid ' +
        (pendingInv === 1 ? 'invoice' : 'invoices') +
        ' — <a href="invoices.html">Invoice log</a> · <a href="invoice-workspace.html">Workspace</a>';
      host.appendChild(li2);
    }
    if (!host.children.length) {
      host.innerHTML = '<div class="text-muted">No outstanding alerts.</div>';
    }
  }


  document.addEventListener('DOMContentLoaded', function () {
    syncUserFromUrl();
    updateClock();
    setInterval(updateClock, 60000);
    loadSummary();
  });
})();
