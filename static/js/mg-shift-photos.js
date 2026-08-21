(function (global) {
  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function fmtTime(t) {
    var p = String(t || '').split(':');
    if (p.length < 2) return '';
    return new Date(2000, 0, 1, Number(p[0] || 0), Number(p[1] || 0)).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function shiftLabel(o) {
    if (!o) return '';
    var parts = [];
    if (o.buildingName) parts.push(o.buildingName);
    if (o.startTime) parts.push(fmtTime(o.startTime) + '–' + fmtTime(o.endTime) + (o.endsNextDay ? ' +1' : ''));
    if (o.employeeName || o.shiftEmployeeName) parts.push(o.employeeName || o.shiftEmployeeName);
    return parts.join(' · ');
  }

  function entryShiftLine(entry) {
    var parts = [];
    if (entry.date) parts.push(entry.date);
    if (entry.buildingName) parts.push(entry.buildingName);
    if (entry.shiftStartTime) parts.push(fmtTime(entry.shiftStartTime) + '–' + fmtTime(entry.shiftEndTime));
    if (entry.shiftEmployeeName) parts.push(entry.shiftEmployeeName);
    return parts.join(' · ');
  }

  function galleryHtml(entries) {
    var items = [];
    (entries || []).forEach(function (entry) {
      (entry.photos || []).forEach(function (p) {
        if (p.expired || !p.thumbUrl) return;
        items.push(
          '<div class="mg-photo-item">' +
            '<button type="button" class="mg-photo-open" data-full="' +
            escapeHtml(p.fileUrl || '') +
            '" data-download="' +
            escapeHtml(p.downloadUrl || '') +
            '" aria-label="View photo full screen">' +
            '<img class="mg-photo-thumb" src="' + p.thumbUrl + '" alt="">' +
            '</button>' +
            (p.downloadUrl ? '<a class="btn btn-sm btn-outline-dark mb-0" href="' + p.downloadUrl + '">Download</a>' : '') +
            '</div>'
        );
      });
      if (entry.note) {
        items.push('<p class="text-sm mb-2 w-100">' + escapeHtml(entry.note) + '</p>');
      }
      if (entry.photosExpired) {
        items.push(
          '<p class="text-xs text-muted mb-0 w-100">' +
            escapeHtml(entry.expiredMessage || 'Photos expired') +
            '</p>'
        );
      }
    });
    if (!items.length) {
      return '<p class="text-sm text-muted mb-0">No photos on this shift yet.</p>';
    }
    return '<div class="mg-photo-grid">' + items.join('') + '</div>';
  }

  function ensureLightbox() {
    var el = document.getElementById('mg-photo-lightbox');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'mg-photo-lightbox';
    el.className = 'mg-photo-lightbox';
    el.setAttribute('hidden', '');
    el.innerHTML =
      '<button type="button" class="mg-photo-lightbox-close" aria-label="Close full screen photo">&times;</button>' +
      '<img class="mg-photo-lightbox-img" alt="Shift photo">' +
      '<a class="btn btn-sm bg-gradient-dark mb-0 mg-photo-lightbox-download" href="#" download>Download</a>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      if (e.target === el || e.target.classList.contains('mg-photo-lightbox-close')) {
        closeLightbox();
      }
    });
    document.addEventListener(
      'keydown',
      function (e) {
        if (e.key !== 'Escape' || el.hasAttribute('hidden')) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        closeLightbox();
      },
      true
    );
    return el;
  }

  function closeLightbox() {
    var el = document.getElementById('mg-photo-lightbox');
    if (!el) return;
    el.setAttribute('hidden', '');
    document.body.classList.remove('mg-photo-lightbox-open');
    var img = el.querySelector('.mg-photo-lightbox-img');
    if (img) img.removeAttribute('src');
  }

  function openLightbox(fileUrl, downloadUrl) {
    if (!fileUrl) return;
    var el = ensureLightbox();
    var img = el.querySelector('.mg-photo-lightbox-img');
    var dl = el.querySelector('.mg-photo-lightbox-download');
    img.src = fileUrl;
    if (downloadUrl) {
      dl.href = downloadUrl;
      dl.classList.remove('d-none');
    } else {
      dl.removeAttribute('href');
      dl.classList.add('d-none');
    }
    el.removeAttribute('hidden');
    document.body.classList.add('mg-photo-lightbox-open');
  }

  function bindGallery(root) {
    if (!root) return;
    root.querySelectorAll('.mg-photo-open').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openLightbox(btn.getAttribute('data-full'), btn.getAttribute('data-download'));
      });
    });
  }

  async function api(url, opts) {
    var res = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {}));
    var data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
    return data;
  }

  async function loadStaffShift(scheduleId, date) {
    return api(
      '/api/ops/shift-documentation?scheduleId=' +
        encodeURIComponent(scheduleId) +
        '&date=' +
        encodeURIComponent(date) +
        '&limit=50'
    );
  }

  async function loadClientShift(scheduleId, date) {
    return api(
      '/api/ops/client/documentation?scheduleId=' +
        encodeURIComponent(scheduleId) +
        '&date=' +
        encodeURIComponent(date) +
        '&limit=50'
    );
  }

  async function upload(scheduleId, date, files, note) {
    var fd = new FormData();
    fd.append('scheduleId', scheduleId);
    fd.append('date', date);
    fd.append('note', note || '');
    Array.prototype.forEach.call(files, function (f) {
      fd.append('photos', f);
    });
    var res = await fetch('/api/ops/documentation', { method: 'POST', credentials: 'same-origin', body: fd });
    var data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    if (!res.ok) throw new Error(data.message || data.error || 'Upload failed');
    return data;
  }

  function photoBadge(count) {
    if (!count) return '';
    return '<span class="mg-photo-badge"><i class="fas fa-camera"></i> ' + count + '</span>';
  }

  global.MgShiftPhotos = {
    escapeHtml: escapeHtml,
    fmtTime: fmtTime,
    shiftLabel: shiftLabel,
    entryShiftLine: entryShiftLine,
    galleryHtml: galleryHtml,
    bindGallery: bindGallery,
    openLightbox: openLightbox,
    closeLightbox: closeLightbox,
    loadStaffShift: loadStaffShift,
    loadClientShift: loadClientShift,
    upload: upload,
    photoBadge: photoBadge
  };
})(window);
