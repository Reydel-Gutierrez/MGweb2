(function () {
  function $(id) { return document.getElementById(id); }
  function showAlert(message, type) {
    var el = $('mg-ops-alert');
    el.className = 'alert py-2 px-3 mb-3 alert-' + (type === 'danger' ? 'danger' : 'success');
    el.textContent = message;
    el.classList.remove('d-none');
    clearTimeout(showAlert._t);
    showAlert._t = setTimeout(function () { el.classList.add('d-none'); }, 8000);
  }
  function escapeHtml(s) {
    return MgShiftPhotos.escapeHtml(s);
  }
  function ymd(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  async function api(url) {
    var res = await fetch(url, { credentials: 'same-origin' });
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
    return data;
  }

  var shifts = [];

  function selectedShift() {
    var val = $('mg-p-shift').value;
    if (!val) return null;
    var parts = val.split('|');
    return { scheduleId: parts[0], date: parts[1] };
  }

  async function loadShifts() {
    var date = $('mg-p-date').value;
    var sel = $('mg-p-shift');
    if (!date) {
      sel.innerHTML = '<option value="">Pick a date first</option>';
      return;
    }
    shifts = await api('/api/ops/shifts?from=' + encodeURIComponent(date) + '&to=' + encodeURIComponent(date));
    if (!shifts.length) {
      sel.innerHTML = '<option value="">No shifts on this date</option>';
      $('mg-p-suggest').textContent = 'There is no scheduled shift on this date. Photos have to be attached to a shift.';
      return;
    }
    sel.innerHTML = shifts.map(function (o) {
      return '<option value="' + o.scheduleId + '|' + o.date + '">' + escapeHtml(MgShiftPhotos.shiftLabel(o)) + '</option>';
    }).join('');
    var params = new URLSearchParams(window.location.search);
    var want = params.get('scheduleId');
    if (want) {
      var match = shifts.find(function (o) { return String(o.scheduleId) === String(want); });
      if (match) sel.value = match.scheduleId + '|' + match.date;
    } else if (shifts.length === 1) {
      $('mg-p-suggest').textContent = 'Only one shift on this date.';
    } else {
      $('mg-p-suggest').textContent = 'Pick the shift these photos belong to.';
    }
  }

  async function loadRecent() {
    var data = await api('/api/ops/my/documentation?limit=10');
    var box = $('mg-p-recent');
    if (!data.items.length) {
      box.innerHTML = '<p class="text-muted text-sm">No uploads yet.</p>';
      return;
    }
    box.innerHTML = data.items.map(function (entry) {
      var photos = (entry.photos || []).map(function (p) {
        if (p.expired || !p.thumbUrl) return '';
        return '<div class="mg-photo-item"><img class="mg-photo-thumb" src="' + p.thumbUrl + '" alt="">' +
          (p.downloadUrl ? '<a class="btn btn-sm btn-outline-dark mb-0" href="' + p.downloadUrl + '">Download</a>' : '') +
          '</div>';
      }).join('');
      return '<div class="mg-doc-card"><div class="mg-doc-meta">' + escapeHtml(MgShiftPhotos.entryShiftLine(entry) || new Date(entry.createdAt).toLocaleString()) +
        '</div><div class="mb-2">' +
        (entry.note ? escapeHtml(entry.note) : '<span class="text-muted text-sm">No note</span>') +
        '</div>' + (photos ? '<div class="mg-photo-grid">' + photos + '</div>' : '') +
        (entry.photosExpired ? '<p class="text-xs text-muted mb-0 mt-2">' + escapeHtml(entry.expiredMessage || 'Photos expired') + '</p>' : '') +
        '</div>';
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', async function () {
    try {
      var params = new URLSearchParams(window.location.search);
      $('mg-p-date').value = params.get('date') || ymd(new Date());
      await loadShifts();
      await loadRecent();
    } catch (err) {
      showAlert(err.message, 'danger');
    }

    $('mg-p-date').addEventListener('change', function () {
      loadShifts().catch(function (err) { showAlert(err.message, 'danger'); });
    });

    $('mg-p-upload').addEventListener('click', async function () {
      var files = $('mg-p-files').files;
      var shift = selectedShift();
      if (!files || !files.length) {
        showAlert('Select at least one photo.', 'danger');
        return;
      }
      if (!shift) {
        showAlert('Select the shift these photos belong to.', 'danger');
        return;
      }
      var btn = $('mg-p-upload');
      btn.disabled = true;
      btn.textContent = 'Uploading…';
      try {
        var data = await MgShiftPhotos.upload(shift.scheduleId, shift.date, files, $('mg-p-note').value);
        showAlert(data.message || 'Uploaded.', 'success');
        $('mg-p-files').value = '';
        $('mg-p-note').value = '';
        await loadRecent();
        await loadShifts();
      } catch (err) {
        showAlert(err.message, 'danger');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-cloud-arrow-up me-2"></i>Upload';
      }
    });
  });
})();
