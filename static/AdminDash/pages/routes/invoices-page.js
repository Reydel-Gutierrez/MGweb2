/**
 * Invoices — list, filters, pagination, add panel, edit/delete modal (matches employees pattern).
 */
(function () {
  var all = [];
  var filtered = [];
  var page = 1;
  var pageSize = 12;

  function $(id) {
    return document.getElementById(id);
  }

  function showAlert(message, type) {
    var el = $('mg-inv-alert');
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

  function normalizeStatus(s) {
    return s === 'Paid' ? 'Paid' : 'Unpaid';
  }

  function openInvoiceEditModal(inv) {
    if (!inv || inv.invoice_number == null || inv.invoice_number === '') {
      showAlert('Invalid invoice.', 'danger');
      return;
    }
    var num = String(inv.invoice_number);
    $('mg-inv-edit-number').value = num;
    $('mg-inv-edit-date').value = toInputDate(inv.date);
    $('mg-inv-edit-title').value = inv.invoice_title || '';
    $('mg-inv-edit-amount').value = inv.amount != null ? String(inv.amount) : '';
    $('mg-inv-edit-status').value = normalizeStatus(inv.status);
    var modal = document.getElementById('mg-inv-edit-modal');
    if (modal && window.bootstrap && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(modal).show();
    }
  }

  function setSaveLoading(loading) {
    var btn = $('mg-inv-edit-save');
    var sp = document.querySelector('.mg-inv-save-spinner');
    var lbl = document.querySelector('.mg-inv-save-label');
    if (btn) btn.disabled = !!loading;
    if (sp) sp.classList.toggle('d-none', !loading);
    if (lbl) lbl.classList.toggle('opacity-50', !!loading);
  }

  /** Newest invoice date first */
  function sortInvoicesByDateDesc(arr) {
    return arr.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });
  }

  function renderSummary() {
    var paid = 0;
    var unpaid = 0;
    var amtUnpaid = 0;
    all.forEach(function (inv) {
      if (inv.status === 'Paid') {
        paid++;
      } else {
        unpaid++;
        amtUnpaid += Number(inv.amount) || 0;
      }
    });
    var elU = $('mg-inv-kpi-unpaid');
    var elP = $('mg-inv-kpi-paid');
    var elA = $('mg-inv-kpi-outstanding');
    if (elU) elU.textContent = String(unpaid);
    if (elP) elP.textContent = String(paid);
    if (elA) elA.textContent = '$' + amtUnpaid.toFixed(2);

    var tl = $('mg-inv-total-label');
    if (tl) tl.textContent = all.length ? ' · ' + all.length + ' invoices' : '';
  }

  function renderTable() {
    var tbody = document.querySelector('#mg-invoices-table tbody');
    var meta = $('mg-inv-meta');
    if (!tbody) return;

    var start = (page - 1) * pageSize;
    var slice = filtered.slice(start, start + pageSize);
    tbody.innerHTML = '';

    if (!slice.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="mg-empty-state">No invoices match filters.</td></tr>';
    } else {
      slice.forEach(function (inv) {
        var tr = document.createElement('tr');
        var d = new Date(inv.date).toLocaleDateString();
        var pending = inv.status === 'Unpaid';
        var num = inv.invoice_number != null ? String(inv.invoice_number) : '';
        var client = inv.client_name || '';
        var typ = inv.template_type || '';
        tr.innerHTML =
          '<td>' +
          d +
          '</td><td>' +
          (inv.invoice_title || '') +
          '</td><td class="text-xs">' +
          client +
          '</td><td>' +
          num +
          '</td><td>$' +
          (inv.amount != null ? inv.amount : '') +
          '</td><td class="text-xs">' +
          typ +
          '</td><td><span class="badge badge-sm ' +
          (pending ? 'bg-gradient-secondary' : 'bg-gradient-success') +
          '">' +
          (inv.status || '') +
          '</span></td><td class="text-end text-nowrap">' +
          '<button type="button" class="btn btn-link btn-sm text-dark mb-0 mg-inv-edit">Edit</button></td>';
        var editBtn = tr.querySelector('.mg-inv-edit');
        if (editBtn) {
          editBtn.addEventListener('click', function () {
            openInvoiceEditModal(inv);
          });
        }
        tbody.appendChild(tr);
      });
    }

    if (meta) {
      meta.textContent =
        filtered.length === 0
          ? '0 rows'
          : 'Showing ' +
            (start + 1) +
            '–' +
            Math.min(start + slice.length, filtered.length) +
            ' of ' +
            filtered.length;
    }

    var pg = $('mg-inv-page');
    if (pg) {
      var tp = Math.max(1, Math.ceil(filtered.length / pageSize));
      pg.textContent = 'Page ' + page + ' / ' + tp;
    }
  }

  function applyFilters() {
    var q =
      ($('mg-inv-search') && $('mg-inv-search').value.trim().toLowerCase()) || '';
    var st = ($('mg-inv-status') && $('mg-inv-status').value) || '';
    filtered = all.filter(function (inv) {
      var okStatus = !st || inv.status === st;
      var okQ =
        !q ||
        (inv.invoice_title && inv.invoice_title.toLowerCase().indexOf(q) >= 0) ||
        (inv.invoice_number && String(inv.invoice_number).toLowerCase().indexOf(q) >= 0) ||
        (inv.client_name && inv.client_name.toLowerCase().indexOf(q) >= 0) ||
        (inv.template_type && inv.template_type.toLowerCase().indexOf(q) >= 0);
      return okStatus && okQ;
    });
    page = 1;
    renderTable();
  }

  async function reload() {
    var sk = $('mg-inv-skeleton');
    if (sk) sk.style.display = 'block';
    try {
      var res = await fetch('/fetchInvoices');
      all = await res.json();
      if (!Array.isArray(all)) all = [];
      all = sortInvoicesByDateDesc(all);
      renderSummary();
      applyFilters();
    } catch (e) {
      console.error(e);
    } finally {
      if (sk) sk.style.display = 'none';
    }
  }

  async function saveInvoiceEdit() {
    var num = $('mg-inv-edit-number').value;
    if (!num) {
      showAlert('No invoice selected.', 'danger');
      return;
    }
    setSaveLoading(true);
    try {
      var r = await fetch('/invoice/' + encodeURIComponent(num), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: $('mg-inv-edit-date').value,
          invoice_title: $('mg-inv-edit-title').value,
          amount: Number($('mg-inv-edit-amount').value),
          status: $('mg-inv-edit-status').value
        })
      });
      var data = await r.json().catch(function () {
        return {};
      });
      if (r.ok) {
        showAlert('Invoice updated.', 'success');
        var modal = document.getElementById('mg-inv-edit-modal');
        if (modal && window.bootstrap && bootstrap.Modal) {
          bootstrap.Modal.getInstance(modal).hide();
        }
        await reload();
      } else {
        showAlert(data.error || 'Update failed.', 'danger');
      }
    } catch (e) {
      console.error(e);
      showAlert('Update failed.', 'danger');
    } finally {
      setSaveLoading(false);
    }
  }

  async function deleteInvoiceByNumber() {
    var num = $('mg-inv-edit-number').value;
    if (!num) return;
    if (!confirm('Delete invoice ' + num + ' permanently? This cannot be undone.')) return;
    var delBtn = $('mg-inv-edit-delete');
    if (delBtn) delBtn.disabled = true;
    try {
      var response = await fetch('/deleteInvoice/' + encodeURIComponent(num), {
        method: 'DELETE'
      });
      if (response.ok) {
        showAlert('Invoice deleted.', 'success');
        var modal = document.getElementById('mg-inv-edit-modal');
        if (modal && window.bootstrap && bootstrap.Modal) {
          bootstrap.Modal.getInstance(modal).hide();
        }
        await reload();
      } else showAlert('Delete failed.', 'danger');
    } catch (e) {
      console.error(e);
      showAlert('Delete failed.', 'danger');
    } finally {
      if (delBtn) delBtn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    ['mg-inv-search', 'mg-inv-status'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', applyFilters);
      if (el) el.addEventListener('change', applyFilters);
    });
    if ($('mg-inv-prev')) {
      $('mg-inv-prev').addEventListener('click', function () {
        if (page > 1) {
          page--;
          renderTable();
        }
      });
    }
    if ($('mg-inv-next')) {
      $('mg-inv-next').addEventListener('click', function () {
        var tp = Math.ceil(filtered.length / pageSize);
        if (page < tp) {
          page++;
          renderTable();
        }
      });
    }

    var submitBtn = $('submitNewInvoice');
    if (submitBtn) {
      submitBtn.addEventListener('click', async function (event) {
        event.preventDefault();
        var date = $('invoiceDate').value;
        var invoiceTitle = $('invoiceTitle').value;
        var invoiceNumber = $('invoiceNumber').value;
        var invoiceAmount = $('invoiceAmount').value;
        var invoiceStatus = $('invoiceStatus').value;
        if (!date || !invoiceTitle || !invoiceNumber || !invoiceAmount || !invoiceStatus) {
          showAlert('Please fill all fields.', 'danger');
          return;
        }
        try {
          var response = await fetch('/submitInvoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: date,
              invoice_title: invoiceTitle,
              invoice_number: invoiceNumber,
              amount: invoiceAmount,
              status: invoiceStatus
            })
          });
          if (response.ok) {
            showAlert('Invoice saved.', 'success');
            await reload();
          } else showAlert('Could not save invoice.', 'danger');
        } catch (e) {
          console.error(e);
          showAlert('Could not save invoice.', 'danger');
        }
      });
    }

    var editSave = $('mg-inv-edit-save');
    if (editSave) editSave.addEventListener('click', saveInvoiceEdit);

    var editDel = $('mg-inv-edit-delete');
    if (editDel) editDel.addEventListener('click', deleteInvoiceByNumber);

    reload();
  });
})();
