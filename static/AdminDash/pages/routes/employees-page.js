/**
 * Employees directory — search, pagination, edit, deactivate, remove.
 */
(function () {
  var allUsers = [];
  var filtered = [];
  var page = 1;
  var pageSize = 15;

  function $(id) {
    return document.getElementById(id);
  }

  function showAlert(message, type) {
    var el = $('mg-emp-alert');
    if (!el) return;
    el.className =
      'alert py-2 px-3 mb-3 alert-' +
      (type === 'danger' ? 'danger' : type === 'warning' ? 'warning' : 'success');
    el.textContent = message;
    el.classList.remove('d-none');
    clearTimeout(showAlert._t);
    showAlert._t = setTimeout(function () {
      el.classList.add('d-none');
    }, 6000);
  }

  /** Newest Mongo documents first when _id is present */
  function sortUsersNewestFirst(arr) {
    return arr.slice().sort(function (a, b) {
      var ida = a._id != null ? String(a._id) : '';
      var idb = b._id != null ? String(b._id) : '';
      if (ida && idb) return idb.localeCompare(ida);
      return 0;
    });
  }

  function isActive(u) {
    return u.active !== false;
  }

  function openEditModal(user) {
    $('mg-emp-edit-mongo-id').value = user._id || '';
    $('mg-emp-edit-fullName').value = user.fullName || '';
    $('mg-emp-edit-idNumber').value = user.idNumber || '';
    $('mg-emp-edit-email').value = user.email || '';
    $('mg-emp-edit-username').value = user.username || '';
    $('mg-emp-edit-payRate').value = user.payRate != null ? user.payRate : '';
    $('mg-emp-edit-admin').checked = !!user.admin;
    $('mg-emp-edit-active').checked = isActive(user);
    $('mg-emp-edit-password').value = '';
    var modal = document.getElementById('mg-emp-edit-modal');
    if (modal && window.bootstrap && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(modal).show();
    }
  }

  function setSaveLoading(loading) {
    var btn = $('mg-emp-save-btn');
    var sp = document.querySelector('.mg-emp-save-spinner');
    var lbl = document.querySelector('.mg-emp-save-label');
    if (btn) btn.disabled = !!loading;
    if (sp) sp.classList.toggle('d-none', !loading);
    if (lbl) lbl.classList.toggle('opacity-50', !!loading);
  }

  async function saveEmployeeEdit() {
    var id = $('mg-emp-edit-mongo-id').value;
    if (!id) return;
    setSaveLoading(true);
    try {
      var body = {
        fullName: $('mg-emp-edit-fullName').value,
        idNumber: $('mg-emp-edit-idNumber').value,
        email: $('mg-emp-edit-email').value,
        username: $('mg-emp-edit-username').value,
        payRate: $('mg-emp-edit-payRate').value,
        admin: $('mg-emp-edit-admin').checked,
        active: $('mg-emp-edit-active').checked
      };
      var pw = $('mg-emp-edit-password').value;
      if (pw && pw.length) body.password = pw;

      var res = await fetch('/users/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (res.ok) {
        showAlert(data.message || 'Employee updated.', 'success');
        var modal = document.getElementById('mg-emp-edit-modal');
        if (modal && window.bootstrap && bootstrap.Modal) {
          bootstrap.Modal.getInstance(modal).hide();
        }
        await load();
      } else {
        showAlert(data.message || 'Could not save changes.', 'danger');
      }
    } catch (e) {
      console.error(e);
      showAlert('Network error while saving.', 'danger');
    } finally {
      setSaveLoading(false);
    }
  }

  async function patchActive(userId, active) {
    try {
      var res = await fetch('/users/' + encodeURIComponent(userId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: active })
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (res.ok) {
        showAlert(active ? 'Employee reactivated.' : 'Employee deactivated.', 'success');
        await load();
      } else {
        showAlert(data.message || 'Update failed.', 'danger');
      }
    } catch (e) {
      console.error(e);
      showAlert('Request failed.', 'danger');
    }
  }

  function renderTable() {
    var tbody = document.querySelector('#mg-employees-table tbody');
    var meta = $('mg-emp-meta');
    if (!tbody) return;

    var start = (page - 1) * pageSize;
    var slice = filtered.slice(start, start + pageSize);
    tbody.innerHTML = '';

    if (!slice.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="mg-empty-state">No employees match your search.</td></tr>';
    } else {
      slice.forEach(function (user) {
        var tr = document.createElement('tr');
        var inactive = !isActive(user);
        if (inactive) tr.classList.add('opacity-75');
        var nameHtml =
          '<strong>' +
          (user.fullName || '') +
          '</strong>' +
          (inactive
            ? ' <span class="badge badge-sm bg-gradient-warning">Inactive</span>'
            : '') +
          '<div class="text-xs text-muted">' +
          (user.email || '') +
          '</div>';
        var uid = user._id ? String(user._id) : '';
        tr.innerHTML =
          '<td>' +
          nameHtml +
          '</td>' +
          '<td>' +
          (user.idNumber || '') +
          '</td>' +
          '<td>' +
          (user.username || '') +
          '</td>' +
          '<td>' +
          (user.payRate != null ? user.payRate : '') +
          '</td>' +
          '<td><span class="badge badge-sm ' +
          (user.admin ? 'bg-gradient-info' : 'bg-gradient-secondary') +
          '">' +
          (user.admin ? 'Admin' : 'Employee') +
          '</span></td>' +
          '<td class="text-end text-nowrap">' +
          '<button type="button" class="btn btn-link btn-sm text-dark mb-0 mg-emp-edit" data-id="' +
          uid +
          '">Edit</button> ' +
          (inactive
            ? '<button type="button" class="btn btn-link btn-sm text-success mb-0 mg-emp-activate" data-id="' +
              uid +
              '">Activate</button> '
            : '<button type="button" class="btn btn-link btn-sm text-warning mb-0 mg-emp-deactivate" data-id="' +
              uid +
              '">Deactivate</button> ') +
          '<button type="button" class="btn btn-link btn-sm text-danger mb-0 mg-emp-remove" data-id="' +
          (user.idNumber || '') +
          '">Remove</button></td>';
        tbody.appendChild(tr);
      });
    }

    if (meta) {
      meta.textContent =
        filtered.length === 0
          ? '0 employees'
          : 'Showing ' +
            (start + 1) +
            '–' +
            Math.min(start + slice.length, filtered.length) +
            ' of ' +
            filtered.length;
    }

    var pg = $('mg-emp-page-indicator');
    if (pg) {
      var totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      pg.textContent = 'Page ' + page + ' / ' + totalPages;
    }

    tbody.querySelectorAll('.mg-emp-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var user = allUsers.find(function (u) {
          return u._id && String(u._id) === id;
        });
        if (user) openEditModal(user);
      });
    });

    tbody.querySelectorAll('.mg-emp-deactivate').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        if (!id || !confirm('Deactivate this account? They will not be able to sign in.')) return;
        patchActive(id, false);
      });
    });

    tbody.querySelectorAll('.mg-emp-activate').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        if (!id) return;
        patchActive(id, true);
      });
    });

    tbody.querySelectorAll('.mg-emp-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        if (!id || !confirm('Permanently delete this employee? This cannot be undone.')) return;
        $('employeeIDToDelete').value = id;
        deleteEmployee();
      });
    });
  }

  function applyFilter() {
    var q = ($('mg-emp-search') && $('mg-emp-search').value.trim().toLowerCase()) || '';
    if (!q) {
      filtered = allUsers.slice();
    } else {
      filtered = allUsers.filter(function (u) {
        return (
          (u.fullName && u.fullName.toLowerCase().indexOf(q) >= 0) ||
          (u.username && u.username.toLowerCase().indexOf(q) >= 0) ||
          (u.email && u.email.toLowerCase().indexOf(q) >= 0) ||
          (u.idNumber && String(u.idNumber).toLowerCase().indexOf(q) >= 0)
        );
      });
    }
    page = 1;
    renderTable();
  }

  async function load() {
    var sk = $('mg-emp-skeleton');
    if (sk) sk.style.display = 'block';
    try {
      var res = await fetch('/users');
      allUsers = await res.json();
      if (!Array.isArray(allUsers)) allUsers = [];
      allUsers = sortUsersNewestFirst(allUsers);
      filtered = allUsers.slice();
      var totalEl = $('mg-emp-total');
      if (totalEl) totalEl.textContent = String(allUsers.length);
      renderTable();
    } catch (e) {
      console.error(e);
      showAlert('Could not load employees.', 'danger');
    } finally {
      if (sk) sk.style.display = 'none';
    }
  }

  async function deleteEmployee() {
    var employeeID = $('employeeIDToDelete').value;
    try {
      var response = await fetch('/deleteEmployee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeID: employeeID })
      });
      var data = await response.json().catch(function () {
        return {};
      });
      if (response.ok) {
        showAlert('Employee removed from the system.', 'success');
        await load();
      } else {
        showAlert(data.error || 'Could not remove employee.', 'danger');
      }
    } catch (e) {
      console.error(e);
      showAlert('Error removing employee.', 'danger');
    }
  }

  window.deleteEmployee = deleteEmployee;

  document.addEventListener('DOMContentLoaded', function () {
    var search = $('mg-emp-search');
    if (search) {
      search.addEventListener('input', applyFilter);
    }
    if ($('mg-emp-prev')) {
      $('mg-emp-prev').addEventListener('click', function () {
        if (page > 1) {
          page--;
          renderTable();
        }
      });
    }
    if ($('mg-emp-next')) {
      $('mg-emp-next').addEventListener('click', function () {
        var totalPages = Math.ceil(filtered.length / pageSize);
        if (page < totalPages) {
          page++;
          renderTable();
        }
      });
    }
    var saveBtn = $('mg-emp-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveEmployeeEdit);
    }
    load();
  });
})();
