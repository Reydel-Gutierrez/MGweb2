(function () {
  function $(id) { return document.getElementById(id); }
  function showAlert(message, type) {
    var el = $('mg-ops-alert');
    el.className = 'alert py-2 px-3 mb-3 alert-' + (type === 'danger' ? 'danger' : 'success');
    el.textContent = message;
    el.classList.remove('d-none');
    clearTimeout(showAlert._t);
    showAlert._t = setTimeout(function () { el.classList.add('d-none'); }, 6000);
  }
  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  async function api(url, opts) {
    var res = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {}));
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
    return data;
  }

  var page = 1;
  var lightbox;

  function fmtWhen(iso) {
    if (!iso) return '';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(iso));
  }

  async function load() {
    var qs = ['page=' + page, 'limit=20'];
    if ($('mg-d-building').value) qs.push('buildingId=' + encodeURIComponent($('mg-d-building').value));
    if ($('mg-d-from').value) qs.push('from=' + encodeURIComponent($('mg-d-from').value));
    if ($('mg-d-to').value) qs.push('to=' + encodeURIComponent($('mg-d-to').value));
    var data = await api('/api/ops/documentation?' + qs.join('&'));
    $('mg-d-meta').textContent = data.total + ' entries';
    var list = $('mg-d-list');
    list.innerHTML = '';
    if (!data.items.length) {
      list.innerHTML = '<div class="mg-empty-state">No photo documentation for these filters.</div>';
      return;
    }
    data.items.forEach(function (entry) {
      var photos = (entry.photos || []).map(function (p) {
        if (p.expired || !p.thumbUrl) return '';
        return '<div class="mg-photo-item">' +
          '<img class="mg-photo-thumb" src="' + p.thumbUrl + '" alt="" data-full="' + p.fileUrl + '" data-download="' + p.downloadUrl + '" style="cursor:pointer">' +
          '<a class="btn btn-sm btn-outline-dark mb-0" href="' + p.downloadUrl + '">Download</a>' +
          '</div>';
      }).join('');
      var expiredNote = entry.photosExpired
        ? '<p class="text-xs text-muted mb-0 mt-2">' + escapeHtml(entry.expiredMessage || 'Photos expired — 30-day retention period') + '</p>'
        : '';
      var card = document.createElement('div');
      card.className = 'mg-doc-card';
      card.innerHTML =
        '<div class="d-flex justify-content-between flex-wrap gap-2">' +
        '<div><div class="mg-doc-meta">' + escapeHtml(entry.date ? (entry.date + ' · ' + (entry.buildingName || '') + (entry.shiftStartTime ? ' · ' + entry.shiftStartTime + '–' + entry.shiftEndTime : '') + (entry.shiftEmployeeName ? ' · ' + entry.shiftEmployeeName : '')) : (fmtWhen(entry.createdAt) + ' · ' + (entry.buildingName || ''))) +
        ' · uploaded by ' + escapeHtml(entry.uploaderName || '') + '</div>' +
        '<div>' + (entry.note ? escapeHtml(entry.note) : '<span class="text-muted text-sm">No note</span>') + '</div></div>' +
        '<button type="button" class="btn btn-sm btn-outline-danger mb-0" data-del="' + entry.id + '">Delete entry</button></div>' +
        (photos ? '<div class="mg-photo-grid mt-2">' + photos + '</div>' : '') +
        expiredNote;
      list.appendChild(card);
    });
    list.querySelectorAll('[data-full]').forEach(function (img) {
      img.addEventListener('click', function () {
        $('mg-d-full').src = img.getAttribute('data-full');
        var dl = $('mg-d-download');
        if (dl) {
          dl.href = img.getAttribute('data-download') || img.getAttribute('data-full');
          dl.classList.remove('d-none');
        }
        lightbox.show();
      });
    });
    list.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Delete this documentation entry and its photos?')) return;
        try {
          await api('/api/ops/documentation/' + btn.getAttribute('data-del'), {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
          });
          showAlert('Documentation deleted.', 'success');
          await load();
        } catch (err) { showAlert(err.message, 'danger'); }
      });
    });
    $('mg-d-prev').disabled = page <= 1;
    $('mg-d-next').disabled = page >= data.pages;
  }

  document.addEventListener('DOMContentLoaded', async function () {
    lightbox = bootstrap.Modal.getOrCreateInstance($('mg-d-lightbox'));
    var buildings = await api('/api/ops/buildings');
    var sel = $('mg-d-building');
    buildings.forEach(function (b) {
      sel.insertAdjacentHTML('beforeend', '<option value="' + (b.id || b._id) + '">' + escapeHtml(b.name) + '</option>');
    });
    var params = new URLSearchParams(window.location.search);
    if (params.get('buildingId')) sel.value = params.get('buildingId');
    $('mg-d-apply').addEventListener('click', function () { page = 1; load(); });
    $('mg-d-prev').addEventListener('click', function () { if (page > 1) { page -= 1; load(); } });
    $('mg-d-next').addEventListener('click', function () { page += 1; load(); });
    load().catch(function (err) { showAlert(err.message, 'danger'); });
  });
})();
