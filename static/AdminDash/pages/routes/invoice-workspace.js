/**
 * Invoice workspace hub — drafts list, new draft.
 */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function showAlert(message, type) {
    var el = $('mg-iw-alert');
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

  function toInputDate(d) {
    if (!d) return '';
    var x = new Date(d);
    if (isNaN(x.getTime())) return '';
    return x.toISOString().slice(0, 10);
  }

  async function deleteDraft(num) {
    if (!num) return;
    if (!confirm('Delete draft ' + num + '? This cannot be undone.')) return;
    try {
      var res = await fetch('/deleteInvoice/' + encodeURIComponent(num), {
        method: 'DELETE',
      });
      if (res.ok) {
        showAlert('Draft deleted.', 'success');
        await loadDrafts();
      } else {
        var data = await res.json().catch(function () {
          return {};
        });
        showAlert(data.error || 'Could not delete draft.', 'danger');
      }
    } catch (e) {
      console.error(e);
      showAlert('Could not delete draft.', 'danger');
    }
  }

  async function loadDrafts() {
    var tbody = document.querySelector('#mg-iw-drafts tbody');
    if (!tbody) return;
    tbody.innerHTML =
      '<tr><td colspan="7" class="mg-empty-state">Loading…</td></tr>';
    try {
      var res = await fetch('/fetchInvoiceDrafts');
      var list = await res.json();
      if (!Array.isArray(list)) list = [];
      tbody.innerHTML = '';
      if (!list.length) {
        tbody.innerHTML =
          '<tr><td colspan="7" class="mg-empty-state">No drafts yet. Create a new invoice or start from a template.</td></tr>';
        return;
      }
      list.forEach(function (d) {
        var tr = document.createElement('tr');
        var num = d.invoice_number != null ? String(d.invoice_number) : '';
        var upd = d.updatedAt ? new Date(d.updatedAt).toLocaleString() : toInputDate(d.date);
        var client = d.client_name || d.bill_to || '—';
        if (client.length > 40) client = client.slice(0, 38) + '…';
        tr.appendChild(document.createElement('td')).className = 'text-xs';
        tr.cells[0].textContent = upd;
        tr.appendChild(document.createElement('td')).textContent = d.invoice_title || '';
        tr.appendChild(document.createElement('td')).textContent = num;
        tr.appendChild(document.createElement('td')).className = 'text-xs';
        tr.cells[3].textContent = client;
        tr.appendChild(document.createElement('td')).textContent =
          '$' + (d.amount != null ? Number(d.amount).toFixed(2) : '0.00');
        tr.appendChild(document.createElement('td')).className = 'text-xs';
        tr.cells[5].textContent = d.template_type || '—';
        var tdAct = tr.appendChild(document.createElement('td'));
        tdAct.className = 'text-end text-nowrap';
        var a = document.createElement('a');
        a.className = 'btn btn-link btn-sm text-dark mb-0';
        a.href = 'invoice-edit.html?num=' + encodeURIComponent(num);
        a.textContent = 'Edit';
        tdAct.appendChild(a);
        var dupBtn = document.createElement('button');
        dupBtn.type = 'button';
        dupBtn.className = 'btn btn-link btn-sm text-dark mb-0';
        dupBtn.textContent = 'Duplicate';
        dupBtn.addEventListener('click', function () {
          window.location.href = 'invoice-edit.html?from=' + encodeURIComponent(num);
        });
        tdAct.appendChild(dupBtn);
        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn-link btn-sm text-danger mb-0 ms-1';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', function () {
          deleteDraft(num);
        });
        tdAct.appendChild(delBtn);
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
      tbody.innerHTML =
        '<tr><td colspan="7" class="mg-empty-state">Could not load drafts.</td></tr>';
    }
  }

  async function createNewDraft() {
    var btn = $('mg-iw-new');
    if (btn) btn.disabled = true;
    try {
      var res = await fetch('/invoice-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_title: 'New invoice',
          line_items: [{ description: 'Service', quantity: 1, unit_price: 0 }],
        }),
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (res.ok && data.data && data.data.invoice_number) {
        window.location.href =
          'invoice-edit.html?num=' + encodeURIComponent(data.data.invoice_number);
      } else {
        showAlert(data.error || 'Could not create draft.', 'danger');
      }
    } catch (e) {
      console.error(e);
      showAlert('Could not create draft.', 'danger');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var newBtn = $('mg-iw-new');
    if (newBtn) newBtn.addEventListener('click', createNewDraft);
    var ref = $('mg-iw-refresh');
    if (ref) ref.addEventListener('click', loadDrafts);
    loadDrafts();
  });
})();
