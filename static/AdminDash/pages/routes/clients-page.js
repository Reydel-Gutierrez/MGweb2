(function () {
  function $(id) { return document.getElementById(id); }
  function showAlert(message, type) {
    var el = $('mg-ops-alert');
    el.className = 'alert py-2 px-3 mb-3 alert-' + (type === 'danger' ? 'danger' : 'success');
    el.textContent = message;
    el.classList.remove('d-none');
    clearTimeout(showAlert._t);
    showAlert._t = setTimeout(function () { el.classList.add('d-none'); }, 6000);
  }
  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  async function api(url, opts) {
    var res = await fetch(url, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, opts || {}));
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
    return data;
  }

  var orgs = [];
  var buildings = [];
  var selectedOrgId = '';
  var orgModal;
  var userModal;

  async function loadOrgs() {
    orgs = await api('/api/ops/clients');
    buildings = await api('/api/ops/buildings');
    var list = $('mg-c-list');
    list.innerHTML = '';
    if (!orgs.length) {
      list.innerHTML = '<div class="p-3 text-muted text-sm">No clients yet.</div>';
      return;
    }
    orgs.forEach(function (org) {
      var a = document.createElement('div');
      a.className = 'list-group-item' + (String(org.id) === selectedOrgId ? ' active' : '');
      a.innerHTML =
        '<div class="d-flex justify-content-between align-items-start gap-2">' +
        '<button type="button" class="btn btn-link text-start text-decoration-none p-0 flex-grow-1 min-w-0 ' +
        (String(org.id) === selectedOrgId ? 'text-white' : 'text-dark') +
        '" data-select="' + org.id + '"><strong class="d-block">' + escapeHtml(org.name) +
        '</strong><span class="text-xs ' + (String(org.id) === selectedOrgId ? '' : 'text-muted') + '">' +
        (org.buildingCount || 0) + ' buildings · ' + (org.userCount || 0) + ' users</span></button>' +
        '<div class="d-flex flex-column gap-1 flex-shrink-0">' +
        '<button type="button" class="btn btn-sm btn-outline-dark mb-0" data-edit="' + org.id + '">Edit</button>' +
        '<button type="button" class="btn btn-sm btn-outline-danger mb-0" data-del="' + org.id + '">Delete</button>' +
        '</div></div>';
      list.appendChild(a);
    });
    list.querySelectorAll('[data-select]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedOrgId = String(btn.getAttribute('data-select'));
        loadOrgs().then(loadUsers);
      });
    });
    list.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var org = orgs.find(function (o) { return String(o.id) === btn.getAttribute('data-edit'); });
        openOrg(org);
      });
    });
    list.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteOrg(btn.getAttribute('data-del'));
      });
    });
    $('mg-c-new-user').disabled = !selectedOrgId;
  }

  async function loadUsers() {
    var tbody = $('mg-c-users');
    if (!selectedOrgId) {
      $('mg-c-users-title').textContent = 'Portal users';
      tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center py-4">Select a client.</td></tr>';
      return;
    }
    var org = orgs.find(function (o) { return String(o.id) === selectedOrgId; });
    $('mg-c-users-title').textContent = (org ? org.name : 'Client') + ' users';
    var users = await api('/api/ops/clients/' + selectedOrgId + '/users');
    tbody.innerHTML = '';
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center py-4">No portal users yet.</td></tr>';
      return;
    }
    users.forEach(function (u) {
      var names = (u.buildingIds || []).map(function (id) {
        var b = buildings.find(function (x) { return String(x.id || x._id) === String(id); });
        return b ? b.name : '';
      }).filter(Boolean).join(', ');
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + escapeHtml(u.fullName) + (u.active === false ? ' <span class="badge bg-secondary">Inactive</span>' : '') + '</td>' +
        '<td>' + escapeHtml(u.username) + '</td>' +
        '<td class="text-xs">' + escapeHtml(names || 'None') + '</td>' +
        '<td class="text-end"><button type="button" class="btn btn-sm btn-outline-dark mb-0" data-user="' + u.id + '">Edit</button></td>';
      tbody.appendChild(tr);
      tr.querySelector('button').addEventListener('click', function () { openUser(u); });
    });
  }

  function orgBuildings() {
    return buildings.filter(function (b) { return String(b.clientOrgId) === selectedOrgId; });
  }

  function renderBuildingChecks(selected) {
    var wrap = $('mg-c-user-buildings');
    var list = orgBuildings();
    if (!list.length) {
      wrap.innerHTML = '<p class="text-xs text-muted mb-0">No buildings for this client yet. Add them on the Buildings tab.</p>';
      return;
    }
    wrap.innerHTML = list.map(function (b) {
      var id = b.id || b._id;
      var checked = (selected || []).indexOf(String(id)) !== -1 ? 'checked' : '';
      return '<div class="form-check"><input class="form-check-input" type="checkbox" value="' + id + '" id="b-' + id + '" ' + checked + '>' +
        '<label class="form-check-label text-sm" for="b-' + id + '">' + escapeHtml(b.name) + '</label></div>';
    }).join('');
  }

  function selectedBuildingIds() {
    return Array.prototype.map.call($('mg-c-user-buildings').querySelectorAll('input:checked'), function (el) {
      return el.value;
    });
  }

  async function deleteOrg(id) {
    var org = orgs.find(function (o) { return String(o.id) === String(id); });
    if (!org) return;
    var extra = [];
    if (org.buildingCount) extra.push(org.buildingCount + ' building' + (org.buildingCount === 1 ? '' : 's'));
    if (org.userCount) extra.push(org.userCount + ' portal user' + (org.userCount === 1 ? '' : 's'));
    var msg = 'Delete client “' + org.name + '”?';
    if (extra.length) msg += ' This also removes ' + extra.join(' and ') + ', plus schedules for those buildings.';
    if (!confirm(msg)) return;
    try {
      await api('/api/ops/clients/' + id, { method: 'DELETE' });
      if (String(selectedOrgId) === String(id)) selectedOrgId = '';
      showAlert('Client deleted.', 'success');
      await loadOrgs();
      await loadUsers();
      if (typeof window.MgReloadBuildings === 'function') window.MgReloadBuildings();
    } catch (err) {
      showAlert(err.message, 'danger');
    }
  }

  function openOrg(org) {
    $('mg-c-org-id').value = org ? org.id : '';
    $('mg-c-org-name').value = org ? org.name : '';
    $('mg-c-org-notes').value = org ? org.notes || '' : '';
    $('mg-c-org-active').checked = !org || org.active !== false;
    orgModal.show();
  }

  function openUser(user) {
    $('mg-c-user-id').value = user ? user.id : '';
    $('mg-c-user-title').textContent = user ? 'Edit client user' : 'Add client user';
    $('mg-c-user-name').value = user ? user.fullName : '';
    $('mg-c-user-email').value = user ? user.email : '';
    $('mg-c-user-username').value = user ? user.username : '';
    $('mg-c-user-password').value = '';
    $('mg-c-user-pw-hint').textContent = user ? '(leave blank to keep)' : '';
    $('mg-c-user-active-wrap').style.display = user ? '' : 'none';
    $('mg-c-user-active').checked = !user || user.active !== false;
    renderBuildingChecks(user ? user.buildingIds : []);
    userModal.show();
  }

  document.addEventListener('DOMContentLoaded', function () {
    orgModal = bootstrap.Modal.getOrCreateInstance($('mg-c-org-modal'));
    userModal = bootstrap.Modal.getOrCreateInstance($('mg-c-user-modal'));

    function showTab(name) {
      var clients = name !== 'buildings';
      $('mg-tab-clients').classList.toggle('d-none', !clients);
      $('mg-tab-buildings').classList.toggle('d-none', clients);
      $('mg-tab-btn-clients').classList.toggle('bg-gradient-dark', clients);
      $('mg-tab-btn-clients').classList.toggle('text-white', clients);
      $('mg-tab-btn-clients').classList.toggle('btn-outline-secondary', !clients);
      $('mg-tab-btn-buildings').classList.toggle('bg-gradient-dark', !clients);
      $('mg-tab-btn-buildings').classList.toggle('text-white', !clients);
      $('mg-tab-btn-buildings').classList.toggle('btn-outline-secondary', clients);
      if (history.replaceState) {
        history.replaceState(null, '', clients ? 'clients.html' : 'clients.html#buildings');
      }
      if (!clients && typeof window.MgReloadBuildings === 'function') {
        window.MgReloadBuildings();
      }
    }

    $('mg-tab-btn-clients').addEventListener('click', function () { showTab('clients'); });
    $('mg-tab-btn-buildings').addEventListener('click', function () { showTab('buildings'); });
    if ((location.hash || '').replace('#', '') === 'buildings') showTab('buildings');

    $('mg-c-new').addEventListener('click', function () { openOrg(null); });
    $('mg-c-new-user').addEventListener('click', function () { openUser(null); });
    $('mg-c-org-save').addEventListener('click', async function () {
      try {
        var id = $('mg-c-org-id').value;
        var body = {
          name: $('mg-c-org-name').value,
          notes: $('mg-c-org-notes').value,
          active: $('mg-c-org-active').checked
        };
        var saved = id
          ? await api('/api/ops/clients/' + id, { method: 'PATCH', body: JSON.stringify(body) })
          : await api('/api/ops/clients', { method: 'POST', body: JSON.stringify(body) });
        selectedOrgId = String(saved.id);
        orgModal.hide();
        showAlert('Client saved.', 'success');
        await loadOrgs();
        await loadUsers();
      } catch (err) { showAlert(err.message, 'danger'); }
    });
    $('mg-c-user-save').addEventListener('click', async function () {
      try {
        var id = $('mg-c-user-id').value;
        var buildingIds = selectedBuildingIds();
        if (id) {
          await api('/api/ops/client-users/' + id, {
            method: 'PATCH',
            body: JSON.stringify({
              fullName: $('mg-c-user-name').value,
              email: $('mg-c-user-email').value,
              username: $('mg-c-user-username').value,
              password: $('mg-c-user-password').value,
              active: $('mg-c-user-active').checked
            })
          });
          await api('/api/ops/client-users/' + id + '/buildings', {
            method: 'PUT',
            body: JSON.stringify({ buildingIds: buildingIds })
          });
        } else {
          await api('/api/ops/clients/' + selectedOrgId + '/users', {
            method: 'POST',
            body: JSON.stringify({
              fullName: $('mg-c-user-name').value,
              email: $('mg-c-user-email').value,
              username: $('mg-c-user-username').value,
              password: $('mg-c-user-password').value,
              buildingIds: buildingIds
            })
          });
        }
        userModal.hide();
        showAlert('Client user saved.', 'success');
        await loadOrgs();
        await loadUsers();
      } catch (err) { showAlert(err.message, 'danger'); }
    });
    loadOrgs().then(loadUsers).catch(function (err) { showAlert(err.message, 'danger'); });
  });
})();
