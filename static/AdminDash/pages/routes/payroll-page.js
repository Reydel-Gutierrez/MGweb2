/**
 * Payroll — submit pay runs and browse payroll records.
 */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function showAlert(message, type) {
    var el = $('mg-pay-alert');
    if (!el) return;
    el.className =
      'alert py-2 px-3 mb-3 alert-' +
      (type === 'danger' ? 'danger' : 'success');
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

  /** Calendar year of pay date (for reporting, e.g. total wages paid in 2025). */
  function getPayYear(record) {
    var pd = record.payDate || record.toDate || record.fromDate;
    if (!pd) return NaN;
    var x = new Date(pd);
    if (isNaN(x.getTime())) return NaN;
    return x.getFullYear();
  }

  function formatShortDate(d) {
    if (!d) return '—';
    var x = new Date(d);
    if (isNaN(x.getTime())) return '—';
    return x.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function sumAmounts(list) {
    return list.reduce(function (a, r) {
      return a + (Number(r.amount) || 0);
    }, 0);
  }

  function populateYearSelect() {
    var sel = $('mg-pay-year');
    if (!sel) return;
    var y = new Date().getFullYear();
    var minY = y - 8;
    var maxY = y + 2;
    var current = sel.value;
    sel.innerHTML = '<option value="">All years</option>';
    for (var yr = maxY; yr >= minY; yr--) {
      var opt = document.createElement('option');
      opt.value = String(yr);
      opt.textContent = String(yr);
      sel.appendChild(opt);
    }
    if (current && sel.querySelector('option[value="' + current + '"]')) {
      sel.value = current;
    }
  }

  async function loadRecords() {
    var tbody = $('payrollRecordsTable');
    var sk = $('mg-pay-skeleton');
    if (sk) sk.style.display = 'block';
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
      var res = await fetch('/fetchPayrollRecords');
      if (!res.ok) throw new Error('fetch failed');
      var payrollRecords = await res.json();
      if (!Array.isArray(payrollRecords)) return;

      var yearStr = ($('mg-pay-year') && $('mg-pay-year').value) || '';
      var yearNum = yearStr === '' ? null : parseInt(yearStr, 10);

      var byYear = payrollRecords.filter(function (r) {
        if (yearNum == null || isNaN(yearNum)) return true;
        var py = getPayYear(r);
        return py === yearNum;
      });

      var q = ($('mg-pay-search') && $('mg-pay-search').value.trim().toLowerCase()) || '';
      var rows = byYear.filter(function (r) {
        if (!q) return true;
        return r.fullName && r.fullName.toLowerCase().indexOf(q) >= 0;
      });

      var orgTotal = sumAmounts(byYear);
      var orgEl = $('mg-pay-org-total');
      var orgHint = $('mg-pay-org-total-hint');
      if (orgEl) orgEl.textContent = '$' + orgTotal.toFixed(2);
      if (orgHint) {
        if (yearNum != null && !isNaN(yearNum)) {
          orgHint.textContent =
            'Sum of all payroll rows with pay date in ' + yearNum + ' (every employee).';
        } else {
          orgHint.textContent = 'All records, all years — organization-wide total.';
        }
      }

      var summary = $('mg-pay-filter-summary');
      if (summary) {
        summary.textContent =
          rows.length +
          ' row' +
          (rows.length === 1 ? '' : 's') +
          ' shown · $' +
          sumAmounts(rows).toFixed(2) +
          ' in table';
      }

      var sumFiltered = sumAmounts(rows);
      var totalEl = $('mg-pay-total-amt');
      if (totalEl) totalEl.textContent = '$' + sumFiltered.toFixed(2);

      rows.sort(function (a, b) {
        var ta = new Date(a.payDate || a.toDate || a.fromDate || 0).getTime();
        var tb = new Date(b.payDate || b.toDate || b.fromDate || 0).getTime();
        if (tb !== ta) return tb - ta;
        var ida = a._id != null ? String(a._id) : '';
        var idb = b._id != null ? String(b._id) : '';
        if (ida && idb) return idb.localeCompare(ida);
        return 0;
      });

      if (!rows.length) {
        tbody.innerHTML =
          '<tr><td colspan="9" class="mg-empty-state">No payroll records match.</td></tr>';
        return;
      }

      rows.forEach(function (record) {
        var formattedFromDate = new Date(record.fromDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        var formattedToDate = new Date(record.toDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        var row = document.createElement('tr');
        var rid = record._id ? String(record._id) : '';
        row.innerHTML =
          '<td>' +
          (record.fullName || '') +
          '</td><td>' +
          record.payRate +
          '</td><td>' +
          record.hours +
          '</td><td>' +
          formattedFromDate +
          '</td><td>' +
          formattedToDate +
          '</td><td>' +
          formatShortDate(record.payDate) +
          '</td><td>$' +
          record.amount +
          '</td><td>' +
          (record.comments || '') +
          '</td><td class="text-end text-nowrap">' +
          '<button type="button" class="btn btn-link btn-sm mb-0 mg-pay-edit" data-id="' +
          rid +
          '">Edit</button> ' +
          '<button type="button" class="btn btn-link btn-sm text-danger mb-0 mg-pay-del" data-id="' +
          rid +
          '">Delete</button></td>';
        tbody.appendChild(row);
      });

      tbody.querySelectorAll('.mg-pay-edit').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          var rec = rows.find(function (r) {
            return r._id && String(r._id) === id;
          });
          if (!rec) return;
          $('mg-pay-edit-id').value = id;
          $('mg-pay-edit-fullName').value = rec.fullName || '';
          $('mg-pay-edit-payRate').value = rec.payRate != null ? String(rec.payRate) : '';
          $('mg-pay-edit-hours').value = rec.hours != null ? String(rec.hours) : '';
          $('mg-pay-edit-fromDate').value = toInputDate(rec.fromDate);
          $('mg-pay-edit-toDate').value = toInputDate(rec.toDate);
          $('mg-pay-edit-amount').value = rec.amount != null ? String(rec.amount) : '';
          $('mg-pay-edit-payDate').value = toInputDate(rec.payDate);
          $('mg-pay-edit-comments').value = rec.comments || '';
          var modal = document.getElementById('mg-pay-edit-modal');
          if (modal && window.bootstrap && bootstrap.Modal) {
            bootstrap.Modal.getOrCreateInstance(modal).show();
          }
        });
      });

      tbody.querySelectorAll('.mg-pay-del').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id = btn.getAttribute('data-id');
          if (!id || !confirm('Delete this payroll record permanently?')) return;
          try {
            var r = await fetch('/payroll/' + encodeURIComponent(id), { method: 'DELETE' });
            var data = await r.json().catch(function () {
              return {};
            });
            if (r.ok) {
              showAlert('Payroll record deleted.', 'success');
              await loadRecords();
            } else {
              showAlert(data.message || 'Delete failed.', 'danger');
            }
          } catch (e) {
            console.error(e);
            showAlert('Delete failed.', 'danger');
          }
        });
      });
    } catch (e) {
      console.error(e);
      var orgElErr = $('mg-pay-org-total');
      if (orgElErr) orgElErr.textContent = '—';
      var totalElErr = $('mg-pay-total-amt');
      if (totalElErr) totalElErr.textContent = '—';
      var sumErr = $('mg-pay-filter-summary');
      if (sumErr) sumErr.textContent = '';
    } finally {
      if (sk) sk.style.display = 'none';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    populateYearSelect();
    var search = $('mg-pay-search');
    if (search) search.addEventListener('input', loadRecords);
    var yearSel = $('mg-pay-year');
    if (yearSel) yearSel.addEventListener('change', loadRecords);

    var btn = $('submitPayroll');
    if (btn) {
      btn.addEventListener('click', async function (event) {
        event.preventDefault();
        var fullName = $('fullName').value;
        var payRate = $('payRate').value;
        var hours = $('hours').value;
        var fromDate = $('fromDate').value;
        var toDate = $('toDate').value;
        var amount = $('amount').value;
        var payDate = $('payDate').value;
        var comments = $('comments').value;
        if (!fullName || !payRate || !hours || !fromDate || !toDate || !amount || !payDate) {
          alert('Fill all required fields.');
          return;
        }
        try {
          var response = await fetch('/employeeRegisterPay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: fullName,
              payRate: Number(payRate),
              hours: Number(hours),
              fromDate: fromDate,
              toDate: toDate,
              amount: Number(amount),
              payDate: payDate,
              comments: comments
            })
          });
          if (response.ok) {
            showAlert('Payroll record saved.', 'success');
            await loadRecords();
          } else {
            var err = await response.json().catch(function () {
              return {};
            });
            showAlert(err.message || 'Could not save payroll.', 'danger');
          }
        } catch (e) {
          console.error(e);
          showAlert('Could not save payroll.', 'danger');
        }
      });
    }

    var saveEdit = $('mg-pay-save-btn');
    if (saveEdit) {
      saveEdit.addEventListener('click', async function () {
        var id = $('mg-pay-edit-id').value;
        if (!id) return;
        try {
          var r = await fetch('/payroll/' + encodeURIComponent(id), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: $('mg-pay-edit-fullName').value,
              payRate: Number($('mg-pay-edit-payRate').value),
              hours: Number($('mg-pay-edit-hours').value),
              fromDate: $('mg-pay-edit-fromDate').value,
              toDate: $('mg-pay-edit-toDate').value,
              amount: Number($('mg-pay-edit-amount').value),
              payDate: $('mg-pay-edit-payDate').value,
              comments: $('mg-pay-edit-comments').value
            })
          });
          var data = await r.json().catch(function () {
            return {};
          });
          if (r.ok) {
            showAlert('Payroll updated.', 'success');
            var modal = document.getElementById('mg-pay-edit-modal');
            if (modal && window.bootstrap && bootstrap.Modal) {
              bootstrap.Modal.getInstance(modal).hide();
            }
            await loadRecords();
          } else {
            showAlert(data.message || 'Update failed.', 'danger');
          }
        } catch (e) {
          console.error(e);
          showAlert('Update failed.', 'danger');
        }
      });
    }

    loadRecords();
  });
})();
