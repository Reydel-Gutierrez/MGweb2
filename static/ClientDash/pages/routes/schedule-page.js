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
  function fmtTime(t) {
    var p = String(t || '').split(':');
    return new Date(2000, 0, 1, Number(p[0] || 0), Number(p[1] || 0)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  function formatShift(o) {
    return fmtTime(o.startTime) + ' – ' + fmtTime(o.endTime) + (o.endsNextDay ? ' +1' : '');
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
    if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
    return data;
  }

  var view = 'week';
  var weekStart = mondayOf(ymd(new Date()));
  var occs = [];
  var buildings = [];
  var modal;

  function occsOn(date) {
    return occs.filter(function (o) { return o.date === date; });
  }

  async function showOcc(o) {
    $('mg-occ-body').innerHTML =
      '<p class="mb-1"><strong>' + escapeHtml(o.employeeName || 'MG staff') + '</strong></p>' +
      '<p class="text-sm mb-1">' + escapeHtml(o.buildingName) + '</p>' +
      '<p class="text-sm mb-1">' + escapeHtml(o.date) + ' · ' + escapeHtml(formatShift(o)) + '</p>' +
      (o.buildingAddress ? '<p class="text-sm mb-2 text-muted">' + escapeHtml(o.buildingAddress) + '</p>' : '') +
      '<h6 class="text-xs text-uppercase mt-3">Photos</h6>' +
      '<div id="mg-occ-photos"><p class="text-sm text-muted">Loading…</p></div>';
    modal.show();
    try {
      var data = await MgShiftPhotos.loadClientShift(o.scheduleId, o.date);
      $('mg-occ-photos').innerHTML = MgShiftPhotos.galleryHtml(data.items || []);
      MgShiftPhotos.bindGallery($('mg-occ-photos'));
    } catch (err) {
      $('mg-occ-photos').innerHTML = '<p class="text-danger text-sm">' + escapeHtml(err.message) + '</p>';
    }
  }

  function renderBuildings() {
    var box = $('mg-buildings');
    if (!buildings.length) {
      box.innerHTML = '<div class="alert alert-warning py-2 px-3 mb-0">No buildings are linked to this login yet. Ask MG office to assign your property on the Clients page.</div>';
      return;
    }
    box.innerHTML = buildings.map(function (b) {
      return '<div class="emp-ops-action mb-2"><span class="icon"><i class="fas fa-building"></i></span><span><strong class="d-block">' +
        escapeHtml(b.name) + '</strong><span class="text-xs text-muted">' + escapeHtml(b.address || 'Assigned building') + '</span></span></div>';
    }).join('');
  }

  function renderToday() {
    var today = ymd(new Date());
    var list = occsOn(today);
    var box = $('mg-today');
    if (!list.length) {
      box.innerHTML = '<div class="card"><div class="card-body py-3"><strong>Today</strong><p class="text-sm text-muted mb-0">No one is scheduled at your building today. Use the week view below for other days.</p></div></div>';
      return;
    }
    box.innerHTML = '<div class="card"><div class="card-body py-3"><strong>On site today</strong>' +
      list.map(function (o) {
        return '<div class="d-flex justify-content-between text-sm mt-2"><span><strong>' + escapeHtml(o.employeeName || 'MG staff') +
          '</strong> · ' + escapeHtml(o.buildingName) + '</span><span class="text-muted">' + escapeHtml(formatShift(o)) + '</span></div>';
      }).join('') + '</div></div>';
  }

  function render() {
    var el = $('mg-cal');
    var to = addDays(weekStart, 6);
    $('mg-range').textContent = weekStart + ' – ' + to;
    ['week', 'list'].forEach(function (name) {
      var btn = $('mg-view-' + name);
      if (!btn) return;
      btn.classList.toggle('btn-outline-secondary', name !== view);
      btn.classList.toggle('bg-gradient-dark', name === view);
      btn.classList.toggle('text-white', name === view);
    });
    if (view === 'list') {
      if (!occs.length) {
        el.innerHTML = '<div class="card"><div class="card-body text-muted">No staffing scheduled for this week. Try Prev / Next week, or confirm the schedule is assigned to your building.</div></div>';
        return;
      }
      el.innerHTML = occs.map(function (o, i) {
        return '<button type="button" class="emp-ops-action mb-2 w-100" data-i="' + i + '"><span class="icon"><i class="fas fa-user"></i></span><span><strong class="d-block">' +
          escapeHtml(o.employeeName || 'MG staff') + '</strong><span class="text-xs text-muted">' + escapeHtml(o.buildingName) + ' · ' +
          escapeHtml(o.date) + ' · ' + escapeHtml(formatShift(o)) +
          (o.photoCount ? ' · ' + o.photoCount + ' photo' + (o.photoCount === 1 ? '' : 's') : '') + '</span></span></button>';
      }).join('');
      el.querySelectorAll('[data-i]').forEach(function (btn) {
        btn.addEventListener('click', function () { showOcc(occs[Number(btn.getAttribute('data-i'))]); });
      });
      return;
    }
    var html = '<div class="mg-week-grid">';
    for (var i = 0; i < 7; i++) {
      var date = addDays(weekStart, i);
      var d = parseYmd(date);
      html += '<div class="mg-week-day' + (date === ymd(new Date()) ? ' is-today' : '') + '"><h6>' +
        d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + '</h6>';
      occsOn(date).forEach(function (o, idx) {
        html += '<button type="button" class="mg-shift-chip" data-date="' + date + '" data-idx="' + idx + '"><strong>' +
          escapeHtml(o.employeeName || 'MG staff') + '</strong>' + escapeHtml(formatShift(o)) +
          '<span class="d-block">' + escapeHtml(o.buildingName) + '</span>' +
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
  }

  async function load() {
    var to = addDays(weekStart, 6);
    var qs = ['from=' + weekStart, 'to=' + to];
    if ($('mg-building').value) qs.push('buildingId=' + encodeURIComponent($('mg-building').value));
    occs = await api('/api/ops/client/occurrences?' + qs.join('&'));
    renderToday();
    render();
  }

  document.addEventListener('DOMContentLoaded', async function () {
    try {
      modal = bootstrap.Modal.getOrCreateInstance($('mg-occ-modal'));
      buildings = await api('/api/ops/client/buildings');
      buildings.forEach(function (b) {
        $('mg-building').insertAdjacentHTML('beforeend', '<option value="' + b.id + '">' + escapeHtml(b.name) + '</option>');
      });
      renderBuildings();
      $('mg-building').addEventListener('change', load);
      $('mg-view-week').addEventListener('click', function () { view = 'week'; render(); });
      $('mg-view-list').addEventListener('click', function () { view = 'list'; render(); });
      $('mg-prev').addEventListener('click', function () { weekStart = addDays(weekStart, -7); load(); });
      $('mg-next').addEventListener('click', function () { weekStart = addDays(weekStart, 7); load(); });
      await load();
    } catch (err) {
      $('mg-ops-alert').className = 'alert alert-danger py-2 px-3 mb-3';
      $('mg-ops-alert').textContent = err.message;
      $('mg-ops-alert').classList.remove('d-none');
    }
  });
})();
