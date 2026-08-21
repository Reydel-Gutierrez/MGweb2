/**
 * Admin — inbound calls & voicemail inbox.
 * Requires admin sign-in cookie (set by POST /login).
 */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  var currentCallId = null;
  var detailModal = null;

  function showAlert(message, type) {
    var el = $('mg-calls-alert');
    if (!el) return;
    el.className =
      'alert py-2 px-3 mb-3 alert-' + (type === 'danger' ? 'danger' : 'success');
    el.textContent = message;
    el.classList.remove('d-none');
    clearTimeout(showAlert._t);
    showAlert._t = setTimeout(function () {
      el.classList.add('d-none');
    }, 6000);
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

  function escapeHtml(s) {
    if (s == null || s === '') return '—';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function categoryLabel(c) {
    var map = {
      existing_customer: 'Existing customer',
      quote: 'Quote / services',
      other: 'Other',
      unknown: 'Unknown'
    };
    return map[c] || String(c || '—');
  }

  function languageLabel(lang) {
    if (lang === 'es') return 'Spanish';
    return 'English';
  }

  function callbackLabel(s) {
    var map = {
      new: 'New',
      called_back: 'Called back',
      completed: 'Completed',
      no_answer: 'No answer'
    };
    return map[s] || String(s || '—');
  }

  function telHref(num) {
    var n = String(num || '').replace(/[^\d+]/g, '');
    return n ? 'tel:' + n : '';
  }

  function queryString() {
    var params = [];
    var listened = $('mg-calls-listened');
    var category = $('mg-calls-category');
    var cb = $('mg-calls-callback');
    if (listened && listened.value) params.push('listened=' + encodeURIComponent(listened.value));
    if (category && category.value) params.push('category=' + encodeURIComponent(category.value));
    if (cb && cb.value) params.push('callbackStatus=' + encodeURIComponent(cb.value));
    return params.length ? '?' + params.join('&') : '';
  }

  async function patchCall(id, body) {
    var r = await fetch('/api/calls/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    });
    var data = await r.json().catch(function () {
      return {};
    });
    if (!r.ok) {
      throw new Error(data.error || 'Update failed');
    }
    return data;
  }

  function buildCallbackSelect(current, id) {
    var opts = ['new', 'called_back', 'completed', 'no_answer'];
    var html =
      '<select class="form-select form-select-sm mg-call-callback" data-id="' +
      id +
      '" style="min-width:120px;">';
    opts.forEach(function (s) {
      html +=
        '<option value="' +
        s +
        '"' +
        (s === current ? ' selected' : '') +
        '>' +
        callbackLabel(s) +
        '</option>';
    });
    html += '</select>';
    return html;
  }

  async function openDetail(id) {
    currentCallId = id;
    var bodyEl = $('mg-call-detail-body');
    var notesEl = $('mg-call-admin-notes');
    var titleEl = $('mg-call-detail-title');
    if (bodyEl) bodyEl.innerHTML = '<p class="text-muted text-sm mb-0">Loading…</p>';
    if (notesEl) notesEl.value = '';
    try {
      var res = await fetch('/api/calls/' + encodeURIComponent(id), {
        credentials: 'same-origin'
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (bodyEl) {
          bodyEl.innerHTML =
            '<p class="text-danger text-sm">' + escapeHtml(data.error || 'Could not load call.') + '</p>';
        }
        return;
      }
      if (titleEl) titleEl.textContent = data.from || 'Call details';
      var href = telHref(data.from);
      var rec = '';
      if (data.recordingSid || data.recordingUrl) {
        rec =
          '<audio controls preload="none" class="w-100 mt-1" src="/api/calls/' +
          encodeURIComponent(id) +
          '/recording"></audio>' +
          '<p class="text-xs text-muted mb-0 mt-1">Duration: ' +
          escapeHtml(data.recordingDuration ? data.recordingDuration + 's' : '—') +
          '</p>';
      } else {
        rec = '<p class="text-sm text-muted mb-0">No recording yet.</p>';
      }
      if (bodyEl) {
        bodyEl.innerHTML =
          '<dl class="row small mb-3">' +
          '<dt class="col-sm-4 text-muted">When</dt><dd class="col-sm-8">' +
          escapeHtml(formatDate(data.createdAt)) +
          '</dd>' +
          '<dt class="col-sm-4 text-muted">Caller</dt><dd class="col-sm-8">' +
          (href
            ? '<a href="' + href + '">' + escapeHtml(data.from) + '</a>'
            : escapeHtml(data.from)) +
          '</dd>' +
          '<dt class="col-sm-4 text-muted">MG number</dt><dd class="col-sm-8">' +
          escapeHtml(data.to) +
          '</dd>' +
          '<dt class="col-sm-4 text-muted">Category</dt><dd class="col-sm-8">' +
          escapeHtml(categoryLabel(data.category)) +
          '</dd>' +
          '<dt class="col-sm-4 text-muted">Language</dt><dd class="col-sm-8">' +
          escapeHtml(languageLabel(data.language)) +
          '</dd>' +
          '<dt class="col-sm-4 text-muted">Keypad</dt><dd class="col-sm-8">' +
          escapeHtml(data.digits || '—') +
          '</dd>' +
          '<dt class="col-sm-4 text-muted">Call status</dt><dd class="col-sm-8">' +
          escapeHtml(data.callStatus) +
          '</dd>' +
          '<dt class="col-sm-4 text-muted">Listened</dt><dd class="col-sm-8">' +
          escapeHtml(data.listened ? 'Yes' : 'No') +
          (data.listenedBy ? ' (' + escapeHtml(data.listenedBy) + ')' : '') +
          '</dd>' +
          '<dt class="col-sm-4 text-muted">Callback</dt><dd class="col-sm-8">' +
          escapeHtml(callbackLabel(data.callbackStatus)) +
          '</dd>' +
          '</dl>' +
          '<div><strong class="text-sm">Voicemail</strong>' +
          rec +
          '</div>';
      }
      if (notesEl) notesEl.value = data.adminNotes || '';
      if (!detailModal) {
        var el = $('mg-call-detail-modal');
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

  async function saveNotes() {
    if (!currentCallId) return;
    var notesEl = $('mg-call-admin-notes');
    try {
      await patchCall(currentCallId, { adminNotes: notesEl ? notesEl.value : '' });
      showAlert('Notes saved.', 'success');
      await load();
    } catch (e) {
      showAlert(e.message || 'Save failed.', 'danger');
    }
  }

  async function load() {
    try {
      var res = await fetch('/api/calls' + queryString(), { credentials: 'same-origin' });
      var payload = await res.json().catch(function () {
        return [];
      });
      if (!res.ok) {
        showAlert(payload.error || 'Could not load calls. Sign in as administrator and try again.', 'danger');
        var tbodyErr = $('mg-calls-body');
        if (tbodyErr) {
          tbodyErr.innerHTML =
            '<tr><td colspan="9" class="mg-empty-state">Unable to load calls.</td></tr>';
        }
        var countErr = $('mg-calls-count');
        if (countErr) countErr.textContent = 'Not signed in for call records';
        return;
      }
      var rows = Array.isArray(payload) ? payload : [];
      var tbody = $('mg-calls-body');
      var countEl = $('mg-calls-count');
      if (countEl) {
        countEl.textContent = rows.length + ' call' + (rows.length === 1 ? '' : 's');
      }
      if (!tbody) return;
      tbody.innerHTML = '';
      if (!rows.length) {
        tbody.innerHTML =
          '<tr><td colspan="9" class="mg-empty-state">No calls match this filter.</td></tr>';
        return;
      }
      rows.forEach(function (row) {
        var id = row._id ? String(row._id) : '';
        var href = telHref(row.from);
        var tr = document.createElement('tr');
        if (!row.listened) tr.className = 'table-warning';
        var audio =
          row.recordingSid || row.recordingUrl
            ? '<audio controls preload="none" style="max-width:220px;height:32px;" src="/api/calls/' +
              encodeURIComponent(id) +
              '/recording"></audio>'
            : '<span class="text-muted text-xs">None</span>';
        tr.innerHTML =
          '<td class="text-xs">' +
          (row.listened
            ? ''
            : '<span class="badge badge-sm bg-gradient-warning">New</span>') +
          '</td>' +
          '<td class="text-xs text-muted">' +
          formatDate(row.createdAt) +
          '</td>' +
          '<td class="text-xs">' +
          (href
            ? '<a href="' + href + '">' + escapeHtml(row.from) + '</a>'
            : escapeHtml(row.from)) +
          '</td>' +
          '<td class="text-xs">' +
          escapeHtml(categoryLabel(row.category)) +
          '</td>' +
          '<td class="text-xs">' +
          escapeHtml(languageLabel(row.language)) +
          '</td>' +
          '<td>' +
          audio +
          '</td>' +
          '<td class="text-xs">' +
          '<button type="button" class="btn btn-sm mb-0 ' +
          (row.listened ? 'btn-outline-secondary' : 'bg-gradient-dark') +
          ' mg-call-listened" data-id="' +
          id +
          '" data-listened="' +
          (row.listened ? '1' : '0') +
          '">' +
          (row.listened ? 'Listened' : 'Mark listened') +
          '</button>' +
          '</td>' +
          '<td class="text-xs">' +
          buildCallbackSelect(row.callbackStatus || 'new', id) +
          '</td>' +
          '<td class="text-xs text-end">' +
          '<button type="button" class="btn btn-sm btn-outline-dark mb-0 mg-call-detail-btn" data-id="' +
          id +
          '">Details</button>' +
          '</td>';
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('select.mg-call-callback').forEach(function (sel) {
        sel.addEventListener('change', function () {
          patchCall(sel.getAttribute('data-id'), { callbackStatus: sel.value })
            .then(function () {
              showAlert('Callback status updated.', 'success');
            })
            .catch(function (e) {
              showAlert(e.message, 'danger');
            });
        });
      });

      tbody.querySelectorAll('.mg-call-listened').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var was = btn.getAttribute('data-listened') === '1';
          patchCall(btn.getAttribute('data-id'), { listened: !was })
            .then(function () {
              return load();
            })
            .catch(function (e) {
              showAlert(e.message, 'danger');
            });
        });
      });

      tbody.querySelectorAll('.mg-call-detail-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          openDetail(btn.getAttribute('data-id'));
        });
      });
    } catch (e) {
      console.error(e);
      showAlert('Could not load calls.', 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    ['mg-calls-listened', 'mg-calls-category', 'mg-calls-callback'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', load);
    });
    var r = $('mg-calls-refresh');
    if (r) r.addEventListener('click', load);
    var saveBtn = $('mg-call-save-notes');
    if (saveBtn) saveBtn.addEventListener('click', saveNotes);
    load();
  });
})();
