(function () {
  function $(id) { return document.getElementById(id); }
  function ymd(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function parseYmd(s) {
    var p = s.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function addDays(s, n) {
    var d = parseYmd(s);
    d.setDate(d.getDate() + n);
    return ymd(d);
  }
  function mondayOf(s) {
    var d = parseYmd(s);
    var day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return ymd(d);
  }
  function monthStart(s) {
    var d = parseYmd(s);
    return ymd(new Date(d.getFullYear(), d.getMonth(), 1));
  }
  function fmtTime(t) {
    var p = String(t || '').split(':');
    return new Date(2000, 0, 1, Number(p[0] || 0), Number(p[1] || 0)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  function formatShift(o) {
    return fmtTime(o.startTime) + '–' + fmtTime(o.endTime) + (o.endsNextDay ? ' +1' : '');
  }
  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  async function api(url) {
    var res = await fetch(url, { credentials: 'same-origin' });
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) throw new Error(data.message || data.error || 'Could not load schedule');
    return data;
  }

  var view = 'week';
  var cursor = ymd(new Date());
  var occs = [];
  var modal;

  function range() {
    if (view === 'month') {
      var start = monthStart(cursor);
      var d = parseYmd(start);
      var end = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      return { from: start, to: end };
    }
    if (view === 'list') return { from: cursor, to: addDays(cursor, 13) };
    var from = mondayOf(cursor);
    return { from: from, to: addDays(from, 6) };
  }

  async function load() {
    var r = range();
    $('mg-range').textContent = r.from === r.to ? r.from : r.from + ' – ' + r.to;
    occs = await api('/api/ops/my/occurrences?from=' + r.from + '&to=' + r.to);
    render();
  }

  function occsOn(date) {
    return occs.filter(function (o) { return o.date === date; });
  }

  async function showOcc(o) {
    var body = $('mg-occ-body');
    body.innerHTML =
      '<p class="mb-1"><strong>' + escapeHtml(o.buildingName) + '</strong></p>' +
      '<p class="text-sm mb-1">' + escapeHtml(o.date) + ' · ' + escapeHtml(formatShift(o).replace('–', ' – ')) + '</p>' +
      (o.buildingAddress ? '<p class="text-sm mb-1">' + escapeHtml(o.buildingAddress) + '</p>' : '') +
      (o.adminNote ? '<p class="text-sm mb-2">' + escapeHtml(o.adminNote) + '</p>' : '') +
      '<h6 class="text-xs text-uppercase mt-3">Photos for this shift</h6>' +
      '<div id="mg-occ-photos"><p class="text-sm text-muted">Loading…</p></div>' +
      '<div class="mg-shift-upload mt-3 pt-3 border-top">' +
      '<label class="form-label text-sm">Add photos to this shift</label>' +
      '<input class="form-control mb-2" type="file" id="mg-occ-files" accept="image/*" multiple>' +
      '<textarea class="form-control mb-2" id="mg-occ-note" rows="2" placeholder="Optional note"></textarea>' +
      '<button type="button" class="btn bg-gradient-dark w-100 mb-0" id="mg-occ-upload">Upload</button>' +
      '<p class="text-xs text-muted mt-2 mb-0">Not on this shift? Use Add photos and pick the shift.</p>' +
      '</div>';
    modal.show();
    try {
      var data = await MgShiftPhotos.loadStaffShift(o.scheduleId, o.date);
      $('mg-occ-photos').innerHTML = MgShiftPhotos.galleryHtml(data.items || []);
      MgShiftPhotos.bindGallery($('mg-occ-photos'));
    } catch (err) {
      $('mg-occ-photos').innerHTML = '<p class="text-danger text-sm">' + escapeHtml(err.message) + '</p>';
    }
    $('mg-occ-upload').addEventListener('click', async function () {
      var files = $('mg-occ-files').files;
      if (!files || !files.length) {
        $('mg-ops-alert').className = 'alert py-2 px-3 mb-3 alert-danger';
        $('mg-ops-alert').textContent = 'Select at least one photo.';
        $('mg-ops-alert').classList.remove('d-none');
        return;
      }
      var btn = $('mg-occ-upload');
      btn.disabled = true;
      btn.textContent = 'Uploading…';
      try {
        var saved = await MgShiftPhotos.upload(o.scheduleId, o.date, files, $('mg-occ-note').value);
        $('mg-occ-files').value = '';
        $('mg-occ-note').value = '';
        var data = await MgShiftPhotos.loadStaffShift(o.scheduleId, o.date);
        $('mg-occ-photos').innerHTML = MgShiftPhotos.galleryHtml(data.items || []);
        MgShiftPhotos.bindGallery($('mg-occ-photos'));
        $('mg-ops-alert').className = 'alert py-2 px-3 mb-3 alert-success';
        $('mg-ops-alert').textContent = saved.message || 'Photos uploaded to this shift.';
        $('mg-ops-alert').classList.remove('d-none');
        load();
      } catch (err) {
        $('mg-ops-alert').className = 'alert py-2 px-3 mb-3 alert-danger';
        $('mg-ops-alert').textContent = err.message;
        $('mg-ops-alert').classList.remove('d-none');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Upload';
      }
    });
  }

  function render() {
    var el = $('mg-cal');
    var r = range();
    if (view === 'list') {
      if (!occs.length) {
        el.innerHTML = '<div class="card"><div class="card-body text-muted">No shifts in this period.</div></div>';
        return;
      }
      el.innerHTML = occs.map(function (o, i) {
        return '<button type="button" class="emp-ops-action mb-2 w-100" data-i="' + i + '"><span class="icon"><i class="fas fa-building"></i></span><span><strong class="d-block">' +
          escapeHtml(o.buildingName) + '</strong><span class="text-xs text-muted">' + escapeHtml(o.date) + ' · ' +
          escapeHtml(formatShift(o)) + (o.photoCount ? ' · ' + o.photoCount + ' photo' + (o.photoCount === 1 ? '' : 's') : '') + '</span></span></button>';
      }).join('');
      el.querySelectorAll('[data-i]').forEach(function (btn) {
        btn.addEventListener('click', function () { showOcc(occs[Number(btn.getAttribute('data-i'))]); });
      });
      return;
    }
    if (view === 'week') {
      var html = '<div class="mg-week-grid">';
      for (var i = 0; i < 7; i++) {
        var date = addDays(r.from, i);
        var d = parseYmd(date);
        html += '<div class="mg-week-day' + (date === ymd(new Date()) ? ' is-today' : '') + '"><h6>' +
          d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + '</h6>';
        occsOn(date).forEach(function (o, idx) {
          html += '<button type="button" class="mg-shift-chip" data-date="' + date + '" data-idx="' + idx + '"><strong>' +
            escapeHtml(formatShift(o)) + '</strong>' + escapeHtml(o.buildingName) +
            (window.MgShiftPhotos ? MgShiftPhotos.photoBadge(o.photoCount) : '') + '</button>';
        });
        html += '</div>';
      }
      html += '</div>';
      el.innerHTML = html;
      el.querySelectorAll('.mg-shift-chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var list = occsOn(btn.getAttribute('data-date'));
          showOcc(list[Number(btn.getAttribute('data-idx'))]);
        });
      });
      return;
    }
    var first = parseYmd(r.from);
    var startPad = (first.getDay() + 6) % 7;
    var htmlm = '<div class="mg-month-grid">';
    ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(function (d) {
      htmlm += '<div class="text-xs text-center text-muted">' + d + '</div>';
    });
    for (var p = 0; p < startPad; p++) htmlm += '<div></div>';
    var cur = r.from;
    while (cur <= r.to) {
      var n = occsOn(cur).length;
      htmlm += '<div class="mg-month-cell' + (cur === ymd(new Date()) ? ' is-today' : '') + '"><button type="button" data-date="' + cur + '">' +
        parseYmd(cur).getDate() + (n ? '<div class="count">' + n + '</div>' : '') + '</button></div>';
      cur = addDays(cur, 1);
    }
    htmlm += '</div><div id="mg-month-list" class="mt-3"></div>';
    el.innerHTML = htmlm;
    el.querySelectorAll('[data-date]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var date = btn.getAttribute('data-date');
        var list = occsOn(date);
        var box = $('mg-month-list');
        if (!list.length) {
          box.innerHTML = '<p class="text-muted text-sm">No shifts on ' + date + '.</p>';
          return;
        }
        box.innerHTML = list.map(function (o, i) {
          return '<button type="button" class="emp-ops-action mb-2 w-100" data-mi="' + i + '" data-md="' + date + '"><span class="icon"><i class="fas fa-building"></i></span><span><strong class="d-block">' +
            escapeHtml(o.buildingName) + '</strong><span class="text-xs text-muted">' + escapeHtml(formatShift(o)) + '</span></span></button>';
        }).join('');
        box.querySelectorAll('[data-mi]').forEach(function (b) {
          b.addEventListener('click', function () {
            showOcc(occsOn(b.getAttribute('data-md'))[Number(b.getAttribute('data-mi'))]);
          });
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    modal = bootstrap.Modal.getOrCreateInstance($('mg-occ-modal'));
    function setView(v) {
      view = v;
      ['week', 'month', 'list'].forEach(function (name) {
        $('mg-view-' + name).classList.toggle('btn-outline-secondary', name !== v);
        $('mg-view-' + name).classList.toggle('bg-gradient-dark', name === v);
        $('mg-view-' + name).classList.toggle('text-white', name === v);
      });
      load().catch(function (err) {
        $('mg-ops-alert').className = 'alert py-2 px-3 mb-3 alert-danger';
        $('mg-ops-alert').textContent = err.message;
        $('mg-ops-alert').classList.remove('d-none');
      });
    }
    $('mg-view-week').addEventListener('click', function () { setView('week'); });
    $('mg-view-month').addEventListener('click', function () { setView('month'); });
    $('mg-view-list').addEventListener('click', function () { setView('list'); });
    $('mg-prev').addEventListener('click', function () {
      cursor = view === 'month' ? addDays(monthStart(cursor), -1) : addDays(range().from, view === 'list' ? -14 : -7);
      load();
    });
    $('mg-next').addEventListener('click', function () {
      cursor = view === 'month' ? addDays(range().to, 1) : addDays(range().to, 1);
      load();
    });
    setView('week');
  });
})();
