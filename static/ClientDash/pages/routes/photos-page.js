(function () {
  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  async function api(url) {
    var res = await fetch(url, { credentials: 'same-origin' });
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
    return data;
  }

  var page = 1;

  async function load() {
    var qs = ['page=' + page, 'limit=20'];
    if ($('mg-building').value) qs.push('buildingId=' + encodeURIComponent($('mg-building').value));
    if ($('mg-from').value) qs.push('from=' + encodeURIComponent($('mg-from').value));
    if ($('mg-to').value) qs.push('to=' + encodeURIComponent($('mg-to').value));
    var data = await api('/api/ops/client/documentation?' + qs.join('&'));
    var box = $('mg-list');
    if (!data.items.length) {
      box.innerHTML = '<div class="card"><div class="card-body text-muted">No photos for these filters. Click a shift on the schedule to review pictures for that visit.</div></div>';
      return;
    }
    box.innerHTML = data.items.map(function (entry) {
      var photos = (entry.photos || []).map(function (p) {
        if (p.expired || !p.thumbUrl) return '';
        return '<div class="mg-photo-item"><a href="' + p.fileUrl + '" target="_blank" rel="noopener"><img class="mg-photo-thumb" src="' + p.thumbUrl + '" alt=""></a>' +
          (p.downloadUrl ? '<a class="btn btn-sm btn-outline-dark mb-0" href="' + p.downloadUrl + '">Download</a>' : '') +
          '</div>';
      }).join('');
      return '<div class="mg-doc-card"><div class="mg-doc-meta">' + escapeHtml(MgShiftPhotos.entryShiftLine(entry) || new Date(entry.createdAt).toLocaleString()) +
        '</div><div class="mb-2">' +
        (entry.note ? escapeHtml(entry.note) : '<span class="text-muted text-sm">No note</span>') +
        '</div>' + (photos ? '<div class="mg-photo-grid">' + photos + '</div>' : '') +
        (entry.photosExpired ? '<p class="text-xs text-muted mb-0 mt-2">' + escapeHtml(entry.expiredMessage || 'Photos expired — 30-day retention period') + '</p>' : '') +
        '</div>';
    }).join('');
    $('mg-prev').disabled = page <= 1;
    $('mg-next').disabled = page >= data.pages;
  }

  document.addEventListener('DOMContentLoaded', async function () {
    try {
      var buildings = await api('/api/ops/client/buildings');
      buildings.forEach(function (b) {
        $('mg-building').insertAdjacentHTML('beforeend', '<option value="' + b.id + '">' + escapeHtml(b.name) + '</option>');
      });
      if (!buildings.length) {
        $('mg-ops-alert').className = 'alert alert-warning py-2 px-3 mb-3';
        $('mg-ops-alert').textContent = 'No buildings are linked to this login yet. Ask MG office to assign your property.';
        $('mg-ops-alert').classList.remove('d-none');
      }
      $('mg-apply').addEventListener('click', function () { page = 1; load(); });
      $('mg-prev').addEventListener('click', function () { if (page > 1) { page -= 1; load(); } });
      $('mg-next').addEventListener('click', function () { page += 1; load(); });
      await load();
    } catch (err) {
      $('mg-ops-alert').className = 'alert alert-danger py-2 px-3 mb-3';
      $('mg-ops-alert').textContent = err.message;
      $('mg-ops-alert').classList.remove('d-none');
    }
  });
})();
