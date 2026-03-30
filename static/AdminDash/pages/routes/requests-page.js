/**
 * Punch change requests — list, approve/reject, remove from queue.
 */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function showAlert(message, type) {
    var el = $('mg-req-alert');
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

  function formatDate(dateString) {
    if (!dateString) return '—';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(dateString));
  }

  function formatTime(dateString) {
    if (!dateString) return '—';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date(dateString));
  }

  function checkValue(v) {
    return v ? v : '—';
  }

  function statusLabel(s) {
    if (!s || s === 'pending') return 'Open';
    if (s === 'approved') return 'Approved';
    if (s === 'rejected') return 'Rejected';
    return String(s);
  }

  function statusBadgeClass(s) {
    if (!s || s === 'pending') return 'bg-gradient-warning';
    if (s === 'approved') return 'bg-gradient-success';
    if (s === 'rejected') return 'bg-gradient-secondary';
    return 'bg-gradient-secondary';
  }

  async function patchStatus(id, status) {
    try {
      var r = await fetch('/punchRequest/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status })
      });
      var data = await r.json().catch(function () {
        return {};
      });
      if (r.ok) {
        showAlert('Request marked as ' + status + '.', 'success');
        await load();
      } else {
        showAlert(data.error || 'Update failed.', 'danger');
      }
    } catch (e) {
      console.error(e);
      showAlert('Update failed.', 'danger');
    }
  }

  async function load() {
    var sk = $('mg-req-skeleton');
    if (sk) sk.style.display = 'block';
    try {
      var pendingOnly =
        !$('mg-req-filter') || $('mg-req-filter').value !== 'all';
      var url = '/fetchPunchRequest' + (pendingOnly ? '?pendingOnly=1' : '');
      var res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      var data = await res.json();
      var tableBody = $('punchRequestTableBody');
      var title = $('requestCountTitle');
      if (title) {
        title.textContent = data.length + ' request' + (data.length === 1 ? '' : 's');
      }
      if (!tableBody) return;
      tableBody.innerHTML = '';
      if (!data.length) {
        tableBody.innerHTML =
          '<tr><td colspan="11" class="mg-empty-state">No punch change requests.</td></tr>';
        return;
      }
      data = data.slice().sort(function (a, b) {
        var ida = a._id != null ? String(a._id) : '';
        var idb = b._id != null ? String(b._id) : '';
        if (ida && idb) return idb.localeCompare(ida);
        return new Date(b.newDate || 0) - new Date(a.newDate || 0);
      });
      data.forEach(function (request, index) {
        var tr = document.createElement('tr');
        var id = request._id || '';
        var st = request.status || 'pending';
        var isPending = !request.status || request.status === 'pending';
        tr.innerHTML =
          '<th scope="row">' +
          (index + 1) +
          '</th>' +
          '<td>' +
          checkValue(request.fullName) +
          '</td>' +
          '<td>' +
          formatDate(request.originalDate) +
          '</td>' +
          '<td>' +
          (request.originalAction === 1
            ? 'Punch in'
            : request.originalAction === 0
              ? 'Punch out'
              : '—') +
          '</td>' +
          '<td>' +
          formatTime(request.originalTime) +
          '</td>' +
          '<td>' +
          formatDate(request.newDate) +
          '</td>' +
          '<td>' +
          (request.newAction === 1
            ? 'Punch in'
            : request.newAction === 0
              ? 'Punch out'
              : '—') +
          '</td>' +
          '<td>' +
          formatTime(request.newTime) +
          '</td>' +
          '<td>' +
          checkValue(request.newComments) +
          '</td>' +
          '<td><span class="badge badge-sm ' +
          statusBadgeClass(st) +
          '">' +
          statusLabel(st) +
          '</span></td>' +
          '<td class="text-end"></td>';
        var tdAct = tr.querySelector('td:last-child');
        if (isPending && id) {
          var b1 = document.createElement('button');
          b1.type = 'button';
          b1.className = 'btn btn-sm btn-outline-success mb-0 me-1';
          b1.textContent = 'Approve';
          b1.addEventListener('click', function () {
            if (!confirm('Mark this request approved? (Apply time corrections in Time & punches if needed.)'))
              return;
            patchStatus(id, 'approved');
          });
          var b2 = document.createElement('button');
          b2.type = 'button';
          b2.className = 'btn btn-sm btn-outline-secondary mb-0 me-1';
          b2.textContent = 'Reject';
          b2.addEventListener('click', function () {
            if (!confirm('Reject this request?')) return;
            patchStatus(id, 'rejected');
          });
          var b3 = document.createElement('button');
          b3.type = 'button';
          b3.className = 'btn btn-sm btn-outline-danger mb-0';
          b3.textContent = 'Remove';
          b3.addEventListener('click', async function () {
            if (!confirm('Remove this request from the queue?')) return;
            try {
              var del = await fetch('/punchRequest/' + encodeURIComponent(id), {
                method: 'DELETE'
              });
              if (del.ok) {
                showAlert('Request removed.', 'success');
                await load();
              } else {
                showAlert('Could not remove request.', 'danger');
              }
            } catch (e) {
              console.error(e);
              showAlert('Could not remove request.', 'danger');
            }
          });
          tdAct.appendChild(b1);
          tdAct.appendChild(b2);
          tdAct.appendChild(b3);
        } else if (id) {
          var b4 = document.createElement('button');
          b4.type = 'button';
          b4.className = 'btn btn-sm btn-outline-danger mb-0';
          b4.textContent = 'Remove';
          b4.addEventListener('click', async function () {
            if (!confirm('Remove this record?')) return;
            try {
              var del = await fetch('/punchRequest/' + encodeURIComponent(id), {
                method: 'DELETE'
              });
              if (del.ok) {
                showAlert('Request removed.', 'success');
                await load();
              } else {
                showAlert('Could not remove request.', 'danger');
              }
            } catch (e) {
              console.error(e);
            }
          });
          tdAct.appendChild(b4);
        }
        tableBody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
      showAlert('Could not load requests.', 'danger');
    } finally {
      if (sk) sk.style.display = 'none';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var fl = $('mg-req-filter');
    if (fl) {
      fl.addEventListener('change', load);
    }
    load();
  });
})();
