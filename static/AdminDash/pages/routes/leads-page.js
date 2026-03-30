/**
 * Website lead intake — full CRM fields, detail modal, status + admin notes.
 */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  var currentLeadId = null;
  var detailModal = null;

  function showAlert(message, type) {
    var el = $('mg-leads-alert');
    if (!el) return;
    el.className =
      'alert py-2 px-3 mb-3 alert-' + (type === 'danger' ? 'danger' : 'success');
    el.textContent = message;
    el.classList.remove('d-none');
    clearTimeout(showAlert._t);
    showAlert._t = setTimeout(function () {
      el.classList.add('d-none');
    }, 5000);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  }

  function shortText(s, n) {
    if (s == null || s === '') return '—';
    var t = String(s);
    if (t.length <= n) return t;
    return t.slice(0, n) + '…';
  }

  function escapeHtml(s) {
    if (s == null || s === '') return '—';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  var STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'closed', 'lost'];

  function typeLabel(t) {
    if (t === 'quote') return 'Quote';
    if (t === 'proposal') return 'Proposal';
    if (t === 'contact') return 'Contact';
    return String(t || '—');
  }

  function needLabel(n) {
    var map = {
      cleaning: 'Cleaning',
      staffing: 'Staffing',
      both: 'Both',
      unsure: 'Unsure',
      other: 'Other'
    };
    return map[n] || String(n || '—');
  }

  function buildStatusSelect(current, id) {
    var html = '<select class="form-select form-select-sm mg-lead-status" data-id="' + id + '" style="min-width:110px;">';
    STATUS_OPTIONS.forEach(function (s) {
      html +=
        '<option value="' +
        s +
        '"' +
        (s === current ? ' selected' : '') +
        '>' +
        s.charAt(0).toUpperCase() +
        s.slice(1) +
        '</option>';
    });
    html += '</select>';
    return html;
  }

  async function patchStatus(id, status) {
    try {
      var r = await fetch('/api/leads/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status })
      });
      var data = await r.json().catch(function () {
        return {};
      });
      if (r.ok) {
        showAlert('Status updated.', 'success');
        await load();
      } else {
        showAlert(data.error || 'Update failed.', 'danger');
      }
    } catch (e) {
      console.error(e);
      showAlert('Update failed.', 'danger');
    }
  }

  function renderDetailBody(row) {
    var dl =
      '<dl class="row small mb-0">' +
      '<dt class="col-sm-4 text-muted">Submitted</dt><dd class="col-sm-8">' +
      escapeHtml(formatDate(row.createdAt)) +
      '</dd>' +
      '<dt class="col-sm-4 text-muted">Updated</dt><dd class="col-sm-8">' +
      escapeHtml(formatDate(row.updatedAt)) +
      '</dd>' +
      '<dt class="col-sm-4 text-muted">Request type</dt><dd class="col-sm-8">' +
      escapeHtml(typeLabel(row.requestType)) +
      '</dd>' +
      '<dt class="col-sm-4 text-muted">Company</dt><dd class="col-sm-8">' +
      escapeHtml(row.companyName) +
      '</dd>' +
      '<dt class="col-sm-4 text-muted">Contact</dt><dd class="col-sm-8">' +
      escapeHtml(row.contactName) +
      '</dd>' +
      '<dt class="col-sm-4 text-muted">Email</dt><dd class="col-sm-8"><a href="mailto:' +
      String(row.email || '').replace(/"/g, '') +
      '">' +
      escapeHtml(row.email) +
      '</a></dd>' +
      '<dt class="col-sm-4 text-muted">Phone</dt><dd class="col-sm-8">' +
      escapeHtml(row.phone) +
      '</dd>' +
      '<dt class="col-sm-4 text-muted">Facility / property</dt><dd class="col-sm-8">' +
      escapeHtml(row.facilityName) +
      '</dd>' +
      '<dt class="col-sm-4 text-muted">Service location</dt><dd class="col-sm-8">' +
      escapeHtml(row.serviceLocation) +
      '</dd>' +
      '<dt class="col-sm-4 text-muted">Service needed</dt><dd class="col-sm-8">' +
      escapeHtml(row.serviceTypeNeeded) +
      '</dd>' +
      '<dt class="col-sm-4 text-muted">Square footage</dt><dd class="col-sm-8">' +
      escapeHtml(row.squareFootage) +
      '</dd>' +
      '<dt class="col-sm-4 text-muted">Need category</dt><dd class="col-sm-8">' +
      escapeHtml(needLabel(row.needCategory)) +
      '</dd>' +
      '<dt class="col-sm-4 text-muted">Desired timeline</dt><dd class="col-sm-8">' +
      escapeHtml(row.desiredTimeline) +
      '</dd>' +
      '<dt class="col-sm-4 text-muted">Source</dt><dd class="col-sm-8">' +
      escapeHtml(row.source || 'website') +
      '</dd>' +
      '<dt class="col-sm-4 text-muted">Pipeline status</dt><dd class="col-sm-8">' +
      escapeHtml(row.status || 'new') +
      '</dd>' +
      '</dl>' +
      '<div class="mt-3"><strong class="text-sm">Message / details</strong>' +
      '<pre class="bg-light p-3 rounded text-sm mt-1 mb-0" style="white-space:pre-wrap;word-break:break-word;">' +
      escapeHtml(row.message || '') +
      '</pre></div>';
    return dl;
  }

  async function openDetail(id) {
    currentLeadId = id;
    var bodyEl = $('mg-lead-detail-body');
    var notesEl = $('mg-lead-admin-notes');
    var titleEl = $('mg-lead-detail-title');
    if (bodyEl) {
      bodyEl.innerHTML = '<p class="text-muted text-sm mb-0">Loading…</p>';
    }
    if (notesEl) notesEl.value = '';
    try {
      var res = await fetch('/api/leads/' + encodeURIComponent(id));
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (bodyEl) bodyEl.innerHTML = '<p class="text-danger text-sm">' + (data.error || 'Could not load lead.') + '</p>';
        return;
      }
      if (titleEl) {
        titleEl.textContent = data.companyName ? String(data.companyName) : 'Lead details';
      }
      if (bodyEl) bodyEl.innerHTML = renderDetailBody(data);
      if (notesEl) notesEl.value = data.adminNotes || '';
      if (!detailModal) {
        var el = $('mg-lead-detail-modal');
        if (el && typeof bootstrap !== 'undefined') {
          detailModal = new bootstrap.Modal(el);
        }
      }
      if (detailModal) detailModal.show();
    } catch (e) {
      console.error(e);
      if (bodyEl) bodyEl.innerHTML = '<p class="text-danger text-sm">Network error.</p>';
    }
  }

  async function saveAdminNotes() {
    if (!currentLeadId) return;
    var notesEl = $('mg-lead-admin-notes');
    var val = notesEl ? notesEl.value : '';
    try {
      var r = await fetch('/api/leads/' + encodeURIComponent(currentLeadId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes: val })
      });
      var data = await r.json().catch(function () {
        return {};
      });
      if (r.ok) {
        showAlert('Notes saved.', 'success');
        await load();
      } else {
        showAlert(data.error || 'Save failed.', 'danger');
      }
    } catch (e) {
      console.error(e);
      showAlert('Save failed.', 'danger');
    }
  }

  async function load() {
    var filter = $('mg-leads-filter');
    var status = filter && filter.value ? '?status=' + encodeURIComponent(filter.value) : '';
    try {
      var res = await fetch('/api/leads' + status);
      if (!res.ok) throw new Error('fetch failed');
      var rows = await res.json();
      var tbody = $('mg-leads-body');
      var countEl = $('mg-leads-count');
      if (countEl) {
        countEl.textContent =
          rows.length + ' submission' + (rows.length === 1 ? '' : 's');
      }
      if (!tbody) return;
      tbody.innerHTML = '';
      if (!rows.length) {
        tbody.innerHTML =
          '<tr><td colspan="15" class="mg-empty-state">No leads match this filter.</td></tr>';
        return;
      }
      rows.forEach(function (row) {
        var tr = document.createElement('tr');
        var id = row._id ? String(row._id) : '';
        tr.innerHTML =
          '<td class="text-xs text-muted">' +
          formatDate(row.createdAt) +
          '</td>' +
          '<td class="text-xs">' +
          typeLabel(row.requestType) +
          '</td>' +
          '<td class="text-xs">' +
          shortText(row.companyName, 28) +
          '</td>' +
          '<td class="text-xs">' +
          shortText(row.contactName, 22) +
          '</td>' +
          '<td class="text-xs"><a href="mailto:' +
          String(row.email || '').replace(/"/g, '') +
          '">' +
          shortText(row.email, 28) +
          '</a></td>' +
          '<td class="text-xs">' +
          shortText(row.phone, 16) +
          '</td>' +
          '<td class="text-xs">' +
          shortText(row.facilityName, 24) +
          '</td>' +
          '<td class="text-xs">' +
          shortText(row.serviceLocation, 24) +
          '</td>' +
          '<td class="text-xs">' +
          shortText(row.serviceTypeNeeded, 28) +
          '</td>' +
          '<td class="text-xs">' +
          shortText(row.squareFootage, 14) +
          '</td>' +
          '<td class="text-xs">' +
          needLabel(row.needCategory) +
          '</td>' +
          '<td class="text-xs">' +
          shortText(row.desiredTimeline, 22) +
          '</td>' +
          '<td class="text-xs">' +
          shortText(row.source || 'website', 12) +
          '</td>' +
          '<td class="text-xs">' +
          buildStatusSelect(row.status || 'new', id) +
          '</td>' +
          '<td class="text-xs text-end">' +
          '<button type="button" class="btn btn-sm btn-outline-dark mb-0 mg-lead-detail-btn" data-id="' +
          id +
          '">Details</button>' +
          '</td>';
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('select.mg-lead-status').forEach(function (sel) {
        sel.addEventListener('change', function () {
          var lid = sel.getAttribute('data-id');
          patchStatus(lid, sel.value);
        });
      });

      tbody.querySelectorAll('.mg-lead-detail-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var lid = btn.getAttribute('data-id');
          if (lid) openDetail(lid);
        });
      });
    } catch (e) {
      console.error(e);
      showAlert('Could not load leads.', 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = $('mg-leads-filter');
    if (f) {
      f.addEventListener('change', load);
    }
    var r = $('mg-leads-refresh');
    if (r) {
      r.addEventListener('click', load);
    }
    var saveBtn = $('mg-lead-save-notes');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveAdminNotes);
    }
    load();
  });
})();
