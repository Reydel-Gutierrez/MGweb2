(function () {
  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var DOW_VAL = [1, 2, 3, 4, 5, 6, 0];

  function $(id) { return document.getElementById(id); }
  function showAlert(message, type) {
    var el = $('mg-ops-alert');
    el.className = 'alert py-2 px-3 mb-3 alert-' + (type === 'danger' ? 'danger' : type === 'warning' ? 'warning' : 'success');
    el.textContent = message;
    el.classList.remove('d-none');
    clearTimeout(showAlert._t);
    showAlert._t = setTimeout(function () { el.classList.add('d-none'); }, 7000);
  }
  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function ymd(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
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
    var diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return ymd(d);
  }
  function fmtTime(t) {
    if (!t) return '';
    var p = t.split(':');
    var d = new Date(2000, 0, 1, Number(p[0]), Number(p[1]));
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  function formatShift(o) {
    return fmtTime(o.startTime) + '–' + fmtTime(o.endTime) + (o.endsNextDay ? ' +1' : '');
  }
  async function api(url, opts) {
    var res = await fetch(url, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, opts || {}));
    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
    return data;
  }

  var weekStart = mondayOf(ymd(new Date()));
  var staff = [];
  var buildings = [];
  var occs = [];
  var modal;
  var exModal;

  function fillSelect(el, rows, labelKey, valueKey, extra) {
    var keep = el.value;
    el.innerHTML = extra || '';
    rows.forEach(function (row) {
      el.insertAdjacentHTML('beforeend', '<option value="' + (row[valueKey] || row.id) + '">' + escapeHtml(row[labelKey]) + '</option>');
    });
    if (keep) el.value = keep;
  }

  function syncKind() {
    var rec = $('mg-s-kind').value === 'recurring';
    $('mg-s-recurring-fields').classList.toggle('d-none', !rec);
    $('mg-s-onetime-fields').classList.toggle('d-none', rec);
  }

  function selectedDays() {
    return Array.prototype.map.call(document.querySelectorAll('#mg-s-days input:checked'), function (el) {
      return Number(el.value);
    });
  }

  async function loadLookups() {
    staff = await api('/api/ops/staff');
    buildings = await api('/api/ops/buildings?active=true');
    fillSelect($('mg-s-employee'), staff, 'fullName', 'id', '<option value="">All employees</option>');
    fillSelect($('mg-s-building'), buildings, 'name', 'id', '<option value="">All buildings</option>');
    fillSelect($('mg-s-emp'), staff, 'fullName', 'id', '');
    fillSelect($('mg-s-bldg'), buildings, 'name', 'id', '');
    fillSelect($('mg-ex-emp'), staff, 'fullName', 'id', '');
    var params = new URLSearchParams(window.location.search);
    if (params.get('buildingId')) $('mg-s-building').value = params.get('buildingId');
    if (params.get('employeeId')) $('mg-s-employee').value = params.get('employeeId');
  }

  async function loadWeek() {
    var to = addDays(weekStart, 6);
    $('mg-s-range').textContent = weekStart + ' to ' + to;
    var qs = ['from=' + weekStart, 'to=' + to];
    if ($('mg-s-employee').value) qs.push('employeeId=' + encodeURIComponent($('mg-s-employee').value));
    if ($('mg-s-building').value) qs.push('buildingId=' + encodeURIComponent($('mg-s-building').value));
    occs = await api('/api/ops/occurrences?' + qs.join('&'));
    renderWeek();
    renderTable();
  }

  function occsForDate(date) {
    return occs.filter(function (o) { return o.date === date; });
  }

  function renderWeek() {
    var today = ymd(new Date());
    var html = '';
    for (var i = 0; i < 7; i++) {
      var date = addDays(weekStart, i);
      var d = parseYmd(date);
      html += '<div class="mg-week-day' + (date === today ? ' is-today' : '') + '"><h6>' +
        d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + '</h6>';
      occsForDate(date).forEach(function (o) {
        html += '<button type="button" class="mg-shift-chip" data-sid="' + o.scheduleId + '" data-date="' + o.date + '" data-ex="' + (o.exceptionId || '') + '">' +
          '<strong>' + escapeHtml(formatShift(o)) + '</strong>' +
          escapeHtml(o.employeeName) + '<br>' + escapeHtml(o.buildingName) +
          (o.photoCount ? '<div class="mg-photo-badge mt-1"><i class="fas fa-camera"></i> ' + o.photoCount + '</div>' : '') +
          (o.exceptionType ? '<div class="text-xs">Exception</div>' : '') +
          '</button>';
      });
      html += '</div>';
    }
    $('mg-s-week').innerHTML = html;
    $('mg-s-week').querySelectorAll('.mg-shift-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openException(btn.getAttribute('data-sid'), btn.getAttribute('data-date'), btn.getAttribute('data-ex'));
      });
    });
  }

  function renderTable() {
    var tbody = $('mg-s-tbody');
    tbody.innerHTML = '';
    if (!occs.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No shifts this week for the current filters.</td></tr>';
      return;
    }
    occs.forEach(function (o) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + escapeHtml(o.date) + '</td>' +
        '<td>' + escapeHtml(formatShift(o).replace('–', ' – ')) + '</td>' +
        '<td>' + escapeHtml(o.employeeName) + '</td>' +
        '<td>' + escapeHtml(o.buildingName) + '</td>' +
        '<td class="text-end">' +
        '<button type="button" class="btn btn-sm btn-outline-secondary mb-0 me-1" data-ex="' + o.scheduleId + '" data-date="' + o.date + '">Exception</button>' +
        '<button type="button" class="btn btn-sm btn-outline-dark mb-0" data-edit="' + o.scheduleId + '">Edit series</button>' +
        '</td>';
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () { openSchedule(btn.getAttribute('data-edit')); });
    });
    tbody.querySelectorAll('[data-ex]').forEach(function (btn) {
      btn.addEventListener('click', function () { openException(btn.getAttribute('data-ex'), btn.getAttribute('data-date')); });
    });
  }

  function openSchedule(id) {
    api('/api/ops/schedules').then(function (rows) {
      var row = id ? rows.find(function (r) { return String(r.id || r._id) === String(id); }) : null;
      $('mg-s-id').value = row ? (row.id || row._id) : '';
      $('mg-s-modal-title').textContent = row ? 'Edit schedule' : 'Add schedule';
      $('mg-s-kind').value = row ? row.kind : 'recurring';
      $('mg-s-emp').value = row ? String(row.employeeId) : ($('mg-s-emp').options[0] ? $('mg-s-emp').options[0].value : '');
      $('mg-s-bldg').value = row ? String(row.buildingId) : ($('mg-s-building').value || ($('mg-s-bldg').options[0] && $('mg-s-bldg').options[0].value) || '');
      $('mg-s-start').value = row ? row.startTime : '18:00';
      $('mg-s-end').value = row ? row.endTime : '23:00';
      $('mg-s-eff-start').value = row ? row.effectiveStartDate : weekStart;
      $('mg-s-eff-end').value = row ? row.effectiveEndDate : '';
      $('mg-s-one-date').value = row ? row.oneTimeDate : weekStart;
      $('mg-s-note').value = row ? row.adminNote || '' : '';
      document.querySelectorAll('#mg-s-days input').forEach(function (el) {
        el.checked = row ? (row.daysOfWeek || []).indexOf(Number(el.value)) !== -1 : Number(el.value) >= 1 && Number(el.value) <= 5;
      });
      $('mg-s-delete').classList.toggle('d-none', !row);
      syncKind();
      modal.show();
    }).catch(function (err) { showAlert(err.message, 'danger'); });
  }

  function openException(scheduleId, date, exceptionId) {
    var occ = occs.find(function (o) { return String(o.scheduleId) === String(scheduleId) && o.date === date; });
    $('mg-ex-schedule-id').value = scheduleId;
    $('mg-ex-date').value = date;
    $('mg-ex-summary').textContent = occ
      ? occ.employeeName + ' at ' + occ.buildingName + ' · ' + formatShift(occ)
      : '';
    $('mg-ex-type').value = occ && occ.exceptionType === 'override' ? 'override' : 'skip';
    $('mg-ex-emp').value = occ ? String(occ.employeeId) : '';
    $('mg-ex-start').value = occ ? occ.startTime : '18:00';
    $('mg-ex-end').value = occ ? occ.endTime : '23:00';
    $('mg-ex-note').value = occ && occ.exceptionNote ? occ.exceptionNote : '';
    $('mg-ex-clear').classList.toggle('d-none', !(occ && occ.exceptionId));
    $('mg-ex-clear').setAttribute('data-exid', occ && occ.exceptionId ? occ.exceptionId : '');
    $('mg-ex-override-fields').classList.toggle('d-none', $('mg-ex-type').value !== 'override');
    exModal.show();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var daysWrap = $('mg-s-days');
    DOW.forEach(function (label, i) {
      daysWrap.insertAdjacentHTML('beforeend',
        '<label><input type="checkbox" value="' + DOW_VAL[i] + '"> ' + label + '</label>');
    });
    modal = bootstrap.Modal.getOrCreateInstance($('mg-s-modal'));
    exModal = bootstrap.Modal.getOrCreateInstance($('mg-s-ex-modal'));
    $('mg-s-kind').addEventListener('change', syncKind);
    $('mg-ex-type').addEventListener('change', function () {
      $('mg-ex-override-fields').classList.toggle('d-none', $('mg-ex-type').value !== 'override');
    });
    $('mg-s-prev').addEventListener('click', function () { weekStart = addDays(weekStart, -7); loadWeek(); });
    $('mg-s-next').addEventListener('click', function () { weekStart = addDays(weekStart, 7); loadWeek(); });
    $('mg-s-today').addEventListener('click', function () { weekStart = mondayOf(ymd(new Date())); loadWeek(); });
    $('mg-s-employee').addEventListener('change', loadWeek);
    $('mg-s-building').addEventListener('change', loadWeek);
    $('mg-s-new').addEventListener('click', function () { openSchedule(null); });
    $('mg-s-save').addEventListener('click', async function () {
      try {
        var id = $('mg-s-id').value;
        var body = {
          kind: $('mg-s-kind').value,
          employeeId: $('mg-s-emp').value,
          buildingId: $('mg-s-bldg').value,
          startTime: $('mg-s-start').value,
          endTime: $('mg-s-end').value,
          adminNote: $('mg-s-note').value,
          daysOfWeek: selectedDays(),
          effectiveStartDate: $('mg-s-eff-start').value,
          effectiveEndDate: $('mg-s-eff-end').value,
          oneTimeDate: $('mg-s-one-date').value
        };
        var saved = id
          ? await api('/api/ops/schedules/' + id, { method: 'PATCH', body: JSON.stringify(body) })
          : await api('/api/ops/schedules', { method: 'POST', body: JSON.stringify(body) });
        modal.hide();
        if (saved.warning) showAlert(saved.warning, 'warning');
        else showAlert(saved.message || 'Schedule saved.', 'success');
        await loadWeek();
      } catch (err) { showAlert(err.message, 'danger'); }
    });
    $('mg-s-delete').addEventListener('click', async function () {
      if (!confirm('Remove this entire schedule? One-day exceptions for it will also be removed.')) return;
      try {
        await api('/api/ops/schedules/' + $('mg-s-id').value, { method: 'DELETE' });
        modal.hide();
        showAlert('Schedule removed.', 'success');
        await loadWeek();
      } catch (err) { showAlert(err.message, 'danger'); }
    });
    $('mg-ex-save').addEventListener('click', async function () {
      try {
        var body = {
          date: $('mg-ex-date').value,
          type: $('mg-ex-type').value,
          note: $('mg-ex-note').value,
          employeeId: $('mg-ex-emp').value,
          startTime: $('mg-ex-start').value,
          endTime: $('mg-ex-end').value
        };
        await api('/api/ops/schedules/' + $('mg-ex-schedule-id').value + '/exceptions', {
          method: 'POST',
          body: JSON.stringify(body)
        });
        exModal.hide();
        showAlert('Exception saved. The recurring schedule is unchanged.', 'success');
        await loadWeek();
      } catch (err) { showAlert(err.message, 'danger'); }
    });
    $('mg-ex-clear').addEventListener('click', async function () {
      var id = $('mg-ex-clear').getAttribute('data-exid');
      if (!id) return;
      try {
        await api('/api/ops/exceptions/' + id, { method: 'DELETE' });
        exModal.hide();
        showAlert('Exception removed.', 'success');
        await loadWeek();
      } catch (err) { showAlert(err.message, 'danger'); }
    });
    loadLookups().then(loadWeek).catch(function (err) { showAlert(err.message, 'danger'); });
  });
})();
