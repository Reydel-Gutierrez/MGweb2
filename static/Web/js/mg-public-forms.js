/**
 * Quote / proposal / contact forms → POST /api/public/leads
 */
(function () {
  function collectForm(form) {
    var data = {};
    var fd = new FormData(form);
    fd.forEach(function (value, key) {
      data[key] = typeof value === 'string' ? value.trim() : value;
    });
    if (!data.requestType) data.requestType = 'quote';
    if (!data.source) data.source = 'website';
    return data;
  }

  function showMessage(form, text, isError) {
    var id = form.getAttribute('id');
    var el = id ? document.getElementById(id + '-feedback') : null;
    if (!el) return;
    el.className =
      'alert mg-alert-inline small ' + (isError ? 'alert-danger' : 'alert-success');
    el.textContent = text;
    el.classList.remove('d-none');
  }

  async function submitForm(form) {
    var fb = form.querySelector('[type="submit"]');
    if (fb) {
      fb.disabled = true;
      fb.dataset.mgLabel = fb.dataset.mgLabel || fb.textContent;
      fb.textContent = 'Sending…';
    }
    try {
      var payload = collectForm(form);
      var res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      var json = await res.json().catch(function () {
        return {};
      });
      if (res.ok) {
        showMessage(form, json.message || 'Thank you — your request was received.', false);
        form.reset();
      } else {
        showMessage(form, json.error || 'Something went wrong. Please try again.', true);
      }
    } catch (e) {
      console.error(e);
      showMessage(
        form,
        'Network error. Check your connection or try again shortly.',
        true
      );
    } finally {
      if (fb) {
        fb.disabled = false;
        fb.textContent = fb.dataset.mgLabel || 'Submit';
      }
    }
  }

  function applyIntentFromUrl(form) {
    var type = new URLSearchParams(window.location.search).get('intent');
    if (!type) return;
    var map = { quote: 'quote', proposal: 'proposal', contact: 'contact' };
    if (!map[type]) return;
    var sel = form.querySelector('select[name="requestType"]');
    if (sel) sel.value = map[type];
    var radios = form.querySelectorAll('input[name="requestType"]');
    radios.forEach(function (r) {
      if (r.value === map[type]) r.checked = true;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form.mg-lead-form').forEach(function (form) {
      applyIntentFromUrl(form);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submitForm(form);
      });
    });
  });
})();
