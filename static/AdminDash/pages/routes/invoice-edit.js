/**
 * Invoice editor — draft save, preview modal, send (finalizes into invoice log).
 */
(function () {
  var currentNumber = null;
  var isDraft = true;

  function $(id) {
    return document.getElementById(id);
  }

  function showAlert(message, type) {
    var el = $('mg-ie-alert');
    if (!el) return;
    el.className =
      'alert py-2 px-3 mb-3 alert-' + (type === 'danger' ? 'danger' : 'success');
    el.textContent = message;
    el.classList.remove('d-none');
    clearTimeout(showAlert._t);
    showAlert._t = setTimeout(function () {
      el.classList.add('d-none');
    }, 8000);
  }

  function toInputDate(d) {
    if (!d) return '';
    var x = new Date(d);
    if (isNaN(x.getTime())) return '';
    return x.toISOString().slice(0, 10);
  }

  function money(n) {
    var v = Number(n);
    if (isNaN(v)) v = 0;
    return v.toFixed(2);
  }

  function escapeHtml(s) {
    if (s == null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDisplayDate(isoOrEmpty) {
    if (!isoOrEmpty) return '—';
    var d = new Date(isoOrEmpty);
    if (isNaN(d.getTime())) return escapeHtml(String(isoOrEmpty));
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  var MG_INVOICE_COMPANY = {
    legalName: 'MG Building Services INC.',
    address: '233 Florida Blvd · Miami, FL 33144',
    phone: '(813) 357-4626',
    email: 'emailus@mgbuildingservice.com',
    footer: 'MG Building Services INC.',
  };

  function getLineRows() {
    var tbody = document.querySelector('#mg-ie-lines tbody');
    if (!tbody) return [];
    var rows = tbody.querySelectorAll('tr');
    var out = [];
    rows.forEach(function (tr) {
      var desc = tr.querySelector('.mg-ie-line-desc');
      var qty = tr.querySelector('.mg-ie-line-qty');
      var up = tr.querySelector('.mg-ie-line-up');
      out.push({
        description: desc ? desc.value.trim() : '',
        quantity: qty ? Number(qty.value) || 0 : 0,
        unit_price: up ? Number(up.value) || 0 : 0,
      });
    });
    return out;
  }

  function recalcTotals() {
    var lines = getLineRows();
    var sub = 0;
    lines.forEach(function (row) {
      sub += (Number(row.quantity) || 0) * (Number(row.unit_price) || 0);
    });
    sub = Math.round(sub * 100) / 100;
    var taxPct = Number($('mg-ie-taxpct').value) || 0;
    var tax = Math.round(sub * (taxPct / 100) * 100) / 100;
    var total = Math.round((sub + tax) * 100) / 100;
    $('mg-ie-sub').textContent = '$' + money(sub);
    $('mg-ie-taxamt').value = money(tax);
    $('mg-ie-total').textContent = '$' + money(total);
  }

  function addLineRow(data) {
    data = data || {};
    var tbody = document.querySelector('#mg-ie-lines tbody');
    if (!tbody) return;
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><input type="text" class="form-control form-control-sm mg-ie-line-desc" value=""></td>' +
      '<td><input type="number" step="0.01" min="0" class="form-control form-control-sm mg-ie-line-qty" value="1"></td>' +
      '<td><input type="number" step="0.01" min="0" class="form-control form-control-sm mg-ie-line-up" value="0"></td>' +
      '<td class="text-sm align-middle mg-ie-line-amt">$0.00</td>' +
      '<td class="text-end"><button type="button" class="btn btn-link text-danger btn-sm p-0 mg-ie-rm" title="Remove">&times;</button></td>';
    tr.querySelector('.mg-ie-line-desc').value = data.description || '';
    tr.querySelector('.mg-ie-line-qty').value = data.quantity != null ? data.quantity : 1;
    tr.querySelector('.mg-ie-line-up').value = data.unit_price != null ? data.unit_price : 0;
    function rowRecalc() {
      var q = Number(tr.querySelector('.mg-ie-line-qty').value) || 0;
      var u = Number(tr.querySelector('.mg-ie-line-up').value) || 0;
      tr.querySelector('.mg-ie-line-amt').textContent = '$' + money(q * u);
      recalcTotals();
    }
    ['input', 'change'].forEach(function (ev) {
      tr.querySelector('.mg-ie-line-qty').addEventListener(ev, rowRecalc);
      tr.querySelector('.mg-ie-line-up').addEventListener(ev, rowRecalc);
    });
    tr.querySelector('.mg-ie-line-desc').addEventListener('input', rowRecalc);
    tr.querySelector('.mg-ie-rm').addEventListener('click', function () {
      tr.remove();
      recalcTotals();
    });
    tbody.appendChild(tr);
    rowRecalc();
  }

  function collectPayload() {
    return {
      invoice_number: ($('mg-ie-number').value || '').trim(),
      date: $('mg-ie-date').value,
      due_date: $('mg-ie-due').value || undefined,
      invoice_title: ($('mg-ie-title').value || '').trim(),
      template_type: ($('mg-ie-type').value || '').trim() || undefined,
      client_name: ($('mg-ie-client').value || '').trim() || undefined,
      bill_to: ($('mg-ie-billto').value || '').trim() || undefined,
      service_address: ($('mg-ie-service-addr').value || '').trim() || undefined,
      service_description: ($('mg-ie-svc-desc').value || '').trim() || undefined,
      line_items: getLineRows(),
      tax_rate_percent: Number($('mg-ie-taxpct').value) || 0,
      notes: ($('mg-ie-notes').value || '').trim() || undefined,
    };
  }

  function fillForm(inv) {
    $('mg-ie-number').value = inv.invoice_number != null ? String(inv.invoice_number) : '';
    $('mg-ie-date').value = toInputDate(inv.date);
    $('mg-ie-due').value = toInputDate(inv.due_date);
    $('mg-ie-title').value = inv.invoice_title || '';
    $('mg-ie-type').value = inv.template_type || '';
    $('mg-ie-client').value = inv.client_name || '';
    $('mg-ie-service-addr').value = inv.service_address || '';
    $('mg-ie-billto').value = inv.bill_to || '';
    $('mg-ie-svc-desc').value = inv.service_description || '';
    $('mg-ie-notes').value = inv.notes || '';
    $('mg-ie-taxpct').value =
      inv.tax_rate_percent != null ? String(inv.tax_rate_percent) : '0';
    var tbody = document.querySelector('#mg-ie-lines tbody');
    if (tbody) tbody.innerHTML = '';
    var lines = (inv.line_items && inv.line_items.length) ? inv.line_items : [{ description: 'Service', quantity: 1, unit_price: 0 }];
    lines.forEach(function (L) {
      addLineRow(L);
    });
    recalcTotals();
  }

  function setUiForSent() {
    isDraft = false;
    var badge = $('mg-ie-status-badge');
    if (badge) {
      badge.textContent = 'Sent';
      badge.className = 'badge bg-gradient-success';
    }
    ['mg-ie-save', 'mg-ie-send', 'mg-ie-preview-send'].forEach(function (id) {
      var b = $(id);
      if (b) b.disabled = true;
    });
    $('mg-ie-preview').disabled = false;
    showAlert('This invoice is finalized. Payment status is edited on the invoice log.', 'success');
  }

  async function loadInvoice(num) {
    try {
      var res = await fetch('/invoice/' + encodeURIComponent(num));
      if (!res.ok) {
        showAlert('Invoice not found.', 'danger');
        return;
      }
      var inv = await res.json();
      currentNumber = inv.invoice_number;
      if (inv.record_status === 'sent' || inv.record_status === undefined) {
        fillForm(inv);
        setUiForSent();
        return;
      }
      fillForm(inv);
      isDraft = true;
    } catch (e) {
      console.error(e);
      showAlert('Could not load invoice.', 'danger');
    }
  }

  async function createFromTemplate(slug) {
    try {
      var res = await fetch('/invoiceTemplates');
      var list = await res.json();
      if (!Array.isArray(list)) list = [];
      var t = list.find(function (x) {
        return x.slug === slug;
      });
      if (!t) {
        showAlert('Template not found.', 'danger');
        window.location.href = 'invoice-workspace.html';
        return;
      }
      var body = {
        invoice_title: t.invoice_title || 'New invoice',
        template_type: t.template_type,
        bill_to: t.bill_to,
        client_name: t.client_name,
        service_address: t.service_address,
        service_description: t.service_description,
        line_items: t.line_items && t.line_items.length
          ? t.line_items
          : [{ description: 'Service', quantity: 1, unit_price: 0 }],
        tax_rate_percent: t.tax_rate_percent ?? 0,
        notes: t.notes,
      };
      var r = await fetch('/invoice-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      var data = await r.json().catch(function () {
        return {};
      });
      if (r.ok && data.data && data.data.invoice_number) {
        window.location.replace(
          'invoice-edit.html?num=' + encodeURIComponent(data.data.invoice_number)
        );
      } else {
        showAlert(data.error || 'Could not create from template.', 'danger');
        window.location.href = 'invoice-templates.html';
      }
    } catch (e) {
      console.error(e);
      window.location.href = 'invoice-workspace.html';
    }
  }

  async function duplicateFrom(num) {
    try {
      var res = await fetch('/invoice/' + encodeURIComponent(num));
      if (!res.ok) {
        showAlert('Source invoice not found.', 'danger');
        window.location.href = 'invoice-workspace.html';
        return;
      }
      var inv = await res.json();
      var body = {
        invoice_title: (inv.invoice_title || 'Invoice') + ' (copy)',
        template_type: inv.template_type,
        bill_to: inv.bill_to,
        client_name: inv.client_name,
        service_address: inv.service_address,
        service_description: inv.service_description,
        line_items: inv.line_items && inv.line_items.length
          ? inv.line_items.map(function (L) {
              return {
                description: L.description,
                quantity: L.quantity,
                unit_price: L.unit_price,
              };
            })
          : [{ description: 'Service', quantity: 1, unit_price: 0 }],
        tax_rate_percent: inv.tax_rate_percent != null ? inv.tax_rate_percent : 0,
        notes: inv.notes,
      };
      var r = await fetch('/invoice-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      var data = await r.json().catch(function () {
        return {};
      });
      if (r.ok && data.data && data.data.invoice_number) {
        window.location.replace(
          'invoice-edit.html?num=' + encodeURIComponent(data.data.invoice_number)
        );
      } else {
        showAlert(data.error || 'Could not duplicate.', 'danger');
        window.location.href = 'invoice-workspace.html';
      }
    } catch (e) {
      console.error(e);
      window.location.href = 'invoice-workspace.html';
    }
  }

  function buildInvoiceHtml() {
    var p = collectPayload();
    var lines = p.line_items || [];
    var sub = 0;
    lines.forEach(function (row) {
      sub += (Number(row.quantity) || 0) * (Number(row.unit_price) || 0);
    });
    sub = Math.round(sub * 100) / 100;
    var taxPct = Number(p.tax_rate_percent) || 0;
    var tax = Math.round(sub * (taxPct / 100) * 100) / 100;
    var total = Math.round((sub + tax) * 100) / 100;

    var logoSrc = new URL('../img/logo/MGnewlogo.png', window.location.href).href;

    var invNum = (p.invoice_number || '').trim() || '—';
    var billBlock = '';
    if (p.bill_to && String(p.bill_to).trim()) {
      billBlock = escapeHtml(p.bill_to);
    } else if (p.client_name && String(p.client_name).trim()) {
      billBlock = escapeHtml(p.client_name);
    } else {
      billBlock = '—';
    }

    var detailsParts = [];
    if (p.invoice_title && String(p.invoice_title).trim()) {
      detailsParts.push(
        '<div class="mg-invoice-doc__details-title">' + escapeHtml(p.invoice_title) + '</div>'
      );
    }
    if (p.service_address && String(p.service_address).trim()) {
      detailsParts.push('<div>' + escapeHtml(p.service_address) + '</div>');
    }
    if (p.service_description && String(p.service_description).trim()) {
      var firstLine = String(p.service_description).split('\n')[0].trim();
      if (firstLine) {
        detailsParts.push('<div class="mt-1">' + escapeHtml(firstLine) + '</div>');
      }
    }
    var detailsHtml =
      detailsParts.length > 0
        ? detailsParts.join('')
        : '<div class="text-muted">—</div>';

    var bulletLines = [];
    if (p.service_description && String(p.service_description).trim()) {
      bulletLines = String(p.service_description)
        .split(/\n/)
        .map(function (x) {
          return x.trim();
        })
        .filter(Boolean);
    }
    if (!bulletLines.length) {
      lines.forEach(function (row) {
        if (row.description && String(row.description).trim()) {
          bulletLines.push(String(row.description).trim());
        }
      });
    }
    if (!bulletLines.length) {
      bulletLines.push('Services as detailed in the line items below.');
    }
    var bulletsHtml = bulletLines
      .map(function (line) {
        return '<li>' + escapeHtml(line) + '</li>';
      })
      .join('');

    var rowsHtml = lines
      .map(function (row) {
        var lineAmt = (Number(row.quantity) || 0) * (Number(row.unit_price) || 0);
        return (
          '<tr><td>' +
          escapeHtml(row.description || '') +
          '</td><td class="mg-inv-num">' +
          escapeHtml(money(row.quantity)) +
          '</td><td class="mg-inv-num">$' +
          money(row.unit_price) +
          '</td><td class="mg-inv-num">$' +
          money(lineAmt) +
          '</td></tr>'
        );
      })
      .join('');

    if (!rowsHtml) {
      rowsHtml =
        '<tr><td colspan="4" class="text-muted">No line items</td></tr>';
    }

    var dueLine =
      'Total due' +
      (p.due_date ? ' by ' + formatDisplayDate(p.due_date) : '') +
      ':';

    return (
      '<div class="mg-invoice-doc">' +
      '<div class="mg-invoice-doc__header">' +
      '<div>' +
      '<p class="mg-invoice-doc__company-name">' +
      escapeHtml(MG_INVOICE_COMPANY.legalName) +
      '</p>' +
      '<p class="mg-invoice-doc__company-lines">' +
      escapeHtml(MG_INVOICE_COMPANY.address) +
      '\nPhone: ' +
      escapeHtml(MG_INVOICE_COMPANY.phone) +
      ' · ' +
      escapeHtml(MG_INVOICE_COMPANY.email) +
      '</p>' +
      '</div>' +
      '<img class="mg-invoice-doc__logo" src="' +
      escapeHtml(logoSrc) +
      '" alt="" width="140" height="56" />' +
      '</div>' +
      '<div class="mg-invoice-doc__stripe">' +
      '<span>INVOICE# <strong>' +
      escapeHtml(invNum) +
      '</strong></span>' +
      '<span class="mg-invoice-doc__stripe-date">' +
      formatDisplayDate(p.date) +
      '</span>' +
      '</div>' +
      '<div class="mg-invoice-doc__grid">' +
      '<div>' +
      '<p class="mg-invoice-doc__col-title">Bill to</p>' +
      '<pre class="mg-invoice-doc__billto">' +
      billBlock +
      '</pre>' +
      '</div>' +
      '<div>' +
      '<p class="mg-invoice-doc__col-title">Details</p>' +
      '<div class="mg-invoice-doc__details">' +
      detailsHtml +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="mg-invoice-doc__stripe mg-invoice-doc__stripe--section">Description of services</div>' +
      '<ul class="mg-invoice-doc__bullets">' +
      bulletsHtml +
      '</ul>' +
      '<div class="mg-invoice-doc__table-wrap">' +
      '<table class="mg-invoice-doc__table">' +
      '<thead><tr>' +
      '<th>Description</th>' +
      '<th class="mg-inv-num">Qty</th>' +
      '<th class="mg-inv-num">Unit price</th>' +
      '<th class="mg-inv-num">Amount</th>' +
      '</tr></thead><tbody>' +
      rowsHtml +
      '</tbody></table>' +
      '</div>' +
      '<div class="mg-invoice-doc__totals">' +
      '<div class="mg-invoice-doc__totals-row">' +
      '<span>Subtotal</span><span>$' +
      money(sub) +
      '</span></div>' +
      '<div class="mg-invoice-doc__totals-row">' +
      '<span>Sales tax (' +
      money(taxPct) +
      '%)</span><span>$' +
      money(tax) +
      '</span></div>' +
      '<div class="mg-invoice-doc__totals-row mg-invoice-doc__totals-row--grand">' +
      '<span>' +
      escapeHtml(dueLine) +
      '</span><span>$' +
      money(total) +
      '</span></div>' +
      '</div>' +
      (p.notes && String(p.notes).trim()
        ? '<div class="mg-invoice-doc__notes"><strong>Notes / terms</strong><br>' +
          escapeHtml(p.notes) +
          '</div>'
        : '') +
      '<div class="mg-invoice-doc__footer">' +
      escapeHtml(MG_INVOICE_COMPANY.footer) +
      '</div>' +
      '</div>'
    );
  }

  function openPreview() {
    var host = $('mg-ie-preview-body');
    if (host) host.innerHTML = buildInvoiceHtml();
    var modal = document.getElementById('mg-ie-preview-modal');
    if (modal && window.bootstrap && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(modal).show();
    }
  }

  function sanitizeFilename(s) {
    return String(s || 'invoice')
      .replace(/[^\w.\-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'invoice';
  }

  function waitForImages(root) {
    var imgs = root.querySelectorAll('img');
    var promises = [];
    imgs.forEach(function (img) {
      if (img.complete) return;
      promises.push(
        new Promise(function (resolve) {
          img.onload = resolve;
          img.onerror = resolve;
        })
      );
    });
    return Promise.all(promises);
  }

  async function downloadInvoicePdf() {
    if (!window.html2pdf) {
      showAlert('PDF library failed to load. Check your network and refresh.', 'danger');
      return;
    }
    var exportHost = $('mg-ie-pdf-export');
    if (!exportHost) return;
    var btnPdf = $('mg-ie-pdf');
    var btnPrevPdf = $('mg-ie-preview-pdf');
    [btnPdf, btnPrevPdf].forEach(function (b) {
      if (b) b.disabled = true;
    });
    try {
      exportHost.innerHTML = buildInvoiceHtml();
      var docEl = exportHost.querySelector('.mg-invoice-doc');
      if (!docEl) {
        showAlert('Could not build invoice for PDF.', 'danger');
        return;
      }
      await waitForImages(docEl);
      var p = collectPayload();
      var fname = 'invoice-' + sanitizeFilename(p.invoice_number || 'draft') + '.pdf';
      var opt = {
        margin: [10, 10, 14, 10],
        filename: fname,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };
      await window.html2pdf().set(opt).from(docEl).save();
    } catch (e) {
      console.error(e);
      showAlert('Could not generate PDF. Try again or use a different browser.', 'danger');
    } finally {
      exportHost.innerHTML = '';
      [btnPdf, btnPrevPdf].forEach(function (b) {
        if (b) b.disabled = false;
      });
    }
  }

  async function saveDraft() {
    if (!isDraft || !currentNumber) return false;
    var p = collectPayload();
    try {
      var r = await fetch('/invoice/' + encodeURIComponent(currentNumber), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      var data = await r.json().catch(function () {
        return {};
      });
      if (r.ok) {
        if (data.data && data.data.invoice_number && data.data.invoice_number !== currentNumber) {
          currentNumber = data.data.invoice_number;
          window.history.replaceState(
            {},
            '',
            'invoice-edit.html?num=' + encodeURIComponent(currentNumber)
          );
          $('mg-ie-number').value = currentNumber;
        }
        showAlert('Draft saved.', 'success');
        return true;
      }
      showAlert(data.error || 'Save failed.', 'danger');
      return false;
    } catch (e) {
      console.error(e);
      showAlert('Save failed.', 'danger');
      return false;
    }
  }

  async function sendInvoice() {
    if (!isDraft || !currentNumber) return;
    var saved = await saveDraft();
    if (!saved) return;
    var p = collectPayload();
    var num = (p.invoice_number || '').trim();
    if (num.indexOf('DRAFT-') === 0) {
      showAlert('Set a final invoice number before sending (replace the draft placeholder).', 'danger');
      return;
    }
    if (!p.invoice_title || !p.date) {
      showAlert('Title and issue date are required before sending.', 'danger');
      return;
    }
    try {
      var r = await fetch('/invoice/' + encodeURIComponent(currentNumber) + '/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      var data = await r.json().catch(function () {
        return {};
      });
      if (r.ok) {
        showAlert('Invoice sent. It is now on the invoice log.', 'success');
        setTimeout(function () {
          window.location.href = 'invoices.html';
        }, 1200);
      } else {
        showAlert(data.error || 'Send failed.', 'danger');
      }
    } catch (e) {
      console.error(e);
      showAlert('Send failed.', 'danger');
    }
  }

  function bootstrap() {
    var params = new URLSearchParams(window.location.search);
    var num = params.get('num');
    var template = params.get('template');
    var from = params.get('from');
    $('mg-ie-date').value = new Date().toISOString().slice(0, 10);

    if (num) {
      loadInvoice(num);
      return;
    }
    if (template) {
      createFromTemplate(template);
      return;
    }
    if (from) {
      duplicateFrom(from);
      return;
    }
    window.location.href = 'invoice-workspace.html';
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('mg-ie-add-line').addEventListener('click', function () {
      addLineRow({ description: '', quantity: 1, unit_price: 0 });
    });
    $('mg-ie-taxpct').addEventListener('input', recalcTotals);
    $('mg-ie-save').addEventListener('click', saveDraft);
    $('mg-ie-preview').addEventListener('click', openPreview);
    var pdfBtn = $('mg-ie-pdf');
    if (pdfBtn) pdfBtn.addEventListener('click', downloadInvoicePdf);
    var pdfPrev = $('mg-ie-preview-pdf');
    if (pdfPrev) pdfPrev.addEventListener('click', downloadInvoicePdf);
    $('mg-ie-send').addEventListener('click', sendInvoice);
    var ps = $('mg-ie-preview-send');
    if (ps) ps.addEventListener('click', function () {
      var modal = document.getElementById('mg-ie-preview-modal');
      if (modal && window.bootstrap && bootstrap.Modal) {
        bootstrap.Modal.getInstance(modal).hide();
      }
      sendInvoice();
    });
    bootstrap();
  });
})();
