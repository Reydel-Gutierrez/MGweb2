(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function showAlert(message, type) {
    var el = $('mg-ops-alert');
    if (!el) return;
    el.className = 'alert py-2 px-3 mb-3 alert-' + (type === 'danger' ? 'danger' : 'success');
    el.textContent = message;
    el.classList.remove('d-none');
    clearTimeout(showAlert._t);
    showAlert._t = setTimeout(function () {
      el.classList.add('d-none');
    }, 6000);
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  var clients = [];
  var modal;

  async function api(url, opts) {
    var res = await fetch(url, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, opts || {}));
    var data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
    return data;
  }

  function fillClientSelects() {
    var filter = $('mg-b-filter-client');
    var form = $('mg-b-client');
    var filterVal = filter.value;
    var formVal = form.value;
    filter.innerHTML = '<option value="">All clients</option>';
    form.innerHTML = '';
    clients.forEach(function (c) {
      var opt = '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>';
      filter.insertAdjacentHTML('beforeend', opt);
      form.insertAdjacentHTML('beforeend', opt);
    });
    filter.value = filterVal;
    if (formVal) form.value = formVal;
  }

  async function load() {
    clients = await api('/api/ops/clients');
    fillClientSelects();
    var qs = [];
    if ($('mg-b-filter-client').value) qs.push('clientOrgId=' + encodeURIComponent($('mg-b-filter-client').value));
    if ($('mg-b-filter-active').value) qs.push('active=' + encodeURIComponent($('mg-b-filter-active').value));
    var rows = await api('/api/ops/buildings' + (qs.length ? '?' + qs.join('&') : ''));
    var tbody = $('mg-b-tbody');
    tbody.innerHTML = '';
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No buildings yet.</td></tr>';
      return;
    }
    rows.forEach(function (b) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + escapeHtml(b.name) + '</td>' +
        '<td>' + escapeHtml(b.clientName || '') + '</td>' +
        '<td>' + escapeHtml(b.address || '') + '</td>' +
        '<td>' + (b.active === false ? '<span class="badge bg-secondary">Inactive</span>' : '<span class="badge bg-success">Active</span>') + '</td>' +
        '<td class="text-end">' +
        '<a class="btn btn-sm btn-outline-secondary mb-0 me-1" href="staffing.html?buildingId=' + encodeURIComponent(b.id || b._id) + '">Schedule</a>' +
        '<a class="btn btn-sm btn-outline-secondary mb-0 me-1" href="documentation.html?buildingId=' + encodeURIComponent(b.id || b._id) + '">Photos</a>' +
        '<button type="button" class="btn btn-sm btn-outline-dark mb-0 me-1" data-edit="' + (b.id || b._id) + '">Edit</button>' +
        '<button type="button" class="btn btn-sm btn-outline-danger mb-0" data-del="' + (b.id || b._id) + '">Delete</button>' +
        '</td>';
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-edit');
        var row = rows.find(function (r) { return String(r.id || r._id) === id; });
        openModal(row);
      });
    });
    tbody.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var id = btn.getAttribute('data-del');
        var row = rows.find(function (r) { return String(r.id || r._id) === id; });
        var name = row ? row.name : 'this building';
        if (!confirm('Delete building “' + name + '”? Schedules for this building will also be removed. Photos already uploaded stay in Photo docs.')) return;
        try {
          await api('/api/ops/buildings/' + id, { method: 'DELETE' });
          showAlert('Building deleted.', 'success');
          await load();
        } catch (err) {
          showAlert(err.message, 'danger');
        }
      });
    });
  }

  function openModal(row) {
    $('mg-b-id').value = row ? (row.id || row._id) : '';
    $('mg-b-modal-title').textContent = row ? 'Edit building' : 'Add building';
    $('mg-b-name').value = row ? row.name : '';
    $('mg-b-client').value = row ? String(row.clientOrgId) : ($('mg-b-client').options[0] ? $('mg-b-client').options[0].value : '');
    $('mg-b-address').value = row ? row.address || '' : '';
    $('mg-b-notes').value = row ? row.notes || '' : '';
    $('mg-b-active').checked = !row || row.active !== false;
    modal.show();
  }

  document.addEventListener('DOMContentLoaded', function () {
    modal = bootstrap.Modal.getOrCreateInstance($('mg-b-modal'));
    $('mg-b-new').addEventListener('click', function () {
      if (!clients.length) {
        showAlert('Create a client first, then add buildings for that client.', 'danger');
        return;
      }
      openModal(null);
    });
    $('mg-b-filter-client').addEventListener('change', load);
    $('mg-b-filter-active').addEventListener('change', load);
    $('mg-b-save').addEventListener('click', async function () {
      try {
        var id = $('mg-b-id').value;
        var body = {
          name: $('mg-b-name').value,
          clientOrgId: $('mg-b-client').value,
          address: $('mg-b-address').value,
          notes: $('mg-b-notes').value,
          active: $('mg-b-active').checked
        };
        if (id) await api('/api/ops/buildings/' + id, { method: 'PATCH', body: JSON.stringify(body) });
        else await api('/api/ops/buildings', { method: 'POST', body: JSON.stringify(body) });
        modal.hide();
        showAlert('Building saved.', 'success');
        await load();
      } catch (err) {
        showAlert(err.message, 'danger');
      }
    });
    load().catch(function (err) {
      showAlert(err.message, 'danger');
    });
    window.MgReloadBuildings = load;
  });
})();
