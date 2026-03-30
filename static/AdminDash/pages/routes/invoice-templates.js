/**
 * Invoice templates — list and open in editor.
 */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function showAlert(message, type) {
    var el = $('mg-it-alert');
    if (!el) return;
    el.className =
      'alert py-2 px-3 mb-3 alert-' + (type === 'danger' ? 'danger' : 'success');
    el.textContent = message;
    el.classList.remove('d-none');
  }

  function render(list) {
    var grid = $('mg-it-grid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!list.length) {
      grid.innerHTML =
        '<div class="col-12"><p class="text-muted">No templates found.</p></div>';
      return;
    }
    list.forEach(function (t) {
      var col = document.createElement('div');
      col.className = 'col-lg-6 mb-4';
      var slug = t.slug || '';
      col.innerHTML =
        '<div class="card mg-section-card h-100">' +
        '<div class="card-body">' +
        '<span class="badge bg-light text-dark mb-2">' +
        (t.template_type || 'Template').replace(/</g, '') +
        '</span>' +
        '<h5 class="mb-2">' +
        (t.name || '').replace(/</g, '') +
        '</h5>' +
        '<p class="text-sm text-muted mb-3">' +
        (t.description || '').replace(/</g, '') +
        '</p>' +
        '<a class="btn btn-sm bg-gradient-dark me-2" href="invoice-edit.html?template=' +
        encodeURIComponent(slug) +
        '">Use template</a>' +
        '</div></div>';
      grid.appendChild(col);
    });
  }

  document.addEventListener('DOMContentLoaded', async function () {
    try {
      var res = await fetch('/invoiceTemplates');
      var list = await res.json();
      if (!Array.isArray(list)) list = [];
      render(list);
    } catch (e) {
      console.error(e);
      showAlert('Could not load templates.', 'danger');
    }
  });
})();
