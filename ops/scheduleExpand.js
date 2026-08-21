function isYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function normalizeHm(value) {
  const match = String(value || '').match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  return match ? `${match[1]}:${match[2]}` : '';
}

function isHm(value) {
  return Boolean(normalizeHm(value));
}

function parseYmd(value) {
  const [y, m, d] = String(value).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayYmd() {
  return formatYmd(new Date());
}

function addDaysYmd(ymd, n) {
  const date = parseYmd(ymd);
  date.setDate(date.getDate() + n);
  return formatYmd(date);
}

function dayOfWeekYmd(ymd) {
  return parseYmd(ymd).getDay();
}

function eachYmd(from, to, fn) {
  let cur = from;
  while (cur <= to) {
    fn(cur);
    cur = addDaysYmd(cur, 1);
  }
}

function toMinutes(hm) {
  const [h, m] = String(hm).split(':').map(Number);
  return h * 60 + m;
}

function occurrenceRangeMinutes(startTime, endTime) {
  let start = toMinutes(startTime);
  let end = toMinutes(endTime);
  if (end <= start) end += 24 * 60;
  return [start, end];
}

function timesOverlap(aStart, aEnd, bStart, bEnd) {
  const [as, ae] = occurrenceRangeMinutes(aStart, aEnd);
  const [bs, be] = occurrenceRangeMinutes(bStart, bEnd);
  return as < be && bs < ae;
}

function idStr(value) {
  if (value == null) return '';
  return String(value);
}

/**
 * Expand stored schedules + one-day exceptions into concrete occurrences.
 * Dates and times are wall-clock strings (YYYY-MM-DD, HH:mm), not UTC instants.
 */
function expandOccurrences(schedules, exceptions, from, to, filters) {
  const filter = filters || {};
  const exByKey = new Map();
  (exceptions || []).forEach((ex) => {
    exByKey.set(`${idStr(ex.scheduleId)}|${ex.date}`, ex);
  });

  const out = [];
  (schedules || []).forEach((schedule) => {
    if (schedule.active === false) return;
    const scheduleId = idStr(schedule._id);
    const dates = [];

    if (schedule.kind === 'one_time') {
      const date = schedule.oneTimeDate;
      if (date && date >= from && date <= to) dates.push(date);
    } else {
      eachYmd(from, to, (date) => {
        if (schedule.effectiveStartDate && date < schedule.effectiveStartDate) return;
        if (schedule.effectiveEndDate && date > schedule.effectiveEndDate) return;
        const days = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : [];
        if (!days.includes(dayOfWeekYmd(date))) return;
        dates.push(date);
      });
    }

    dates.forEach((date) => {
      const exception = exByKey.get(`${scheduleId}|${date}`);
      if (exception && exception.type === 'skip') return;

      let employeeId = schedule.employeeId;
      let startTime = schedule.startTime;
      let endTime = schedule.endTime;
      let exceptionId = null;
      let exceptionType = null;
      let exceptionNote = '';

      if (exception && exception.type === 'override') {
        if (exception.employeeId) employeeId = exception.employeeId;
        if (exception.startTime) startTime = exception.startTime;
        if (exception.endTime) endTime = exception.endTime;
        exceptionId = exception._id || null;
        exceptionType = 'override';
        exceptionNote = exception.note || '';
      }

      if (filter.employeeId && idStr(employeeId) !== idStr(filter.employeeId)) return;
      if (filter.buildingId && idStr(schedule.buildingId) !== idStr(filter.buildingId)) return;

      out.push({
        scheduleId: schedule._id,
        exceptionId,
        exceptionType,
        exceptionNote,
        date,
        startTime,
        endTime,
        employeeId,
        buildingId: schedule.buildingId,
        adminNote: schedule.adminNote || '',
        kind: schedule.kind || 'recurring',
        endsNextDay: String(endTime) <= String(startTime),
      });
    });
  });

  out.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
    return idStr(a.employeeId).localeCompare(idStr(b.employeeId));
  });
  return out;
}

function findEmployeeConflicts(occurrences) {
  const segments = [];
  (occurrences || []).forEach((occ) => {
    const [start, end] = occurrenceRangeMinutes(occ.startTime, occ.endTime);
    if (end <= 24 * 60) {
      segments.push({ occ, date: occ.date, start, end });
      return;
    }
    segments.push({ occ, date: occ.date, start, end: 24 * 60 });
    segments.push({
      occ,
      date: addDaysYmd(occ.date, 1),
      start: 0,
      end: end - 24 * 60,
    });
  });
  const byKey = new Map();
  const conflicts = [];
  segments.forEach((seg) => {
    const key = `${idStr(seg.occ.employeeId)}|${seg.date}`;
    const list = byKey.get(key) || [];
    list.forEach((other) => {
      if (seg.occ === other.occ) return;
      if (seg.start < other.end && other.start < seg.end) {
        conflicts.push({ a: seg.occ, b: other.occ });
      }
    });
    list.push(seg);
    byKey.set(key, list);
  });
  return conflicts;
}

module.exports = {
  isYmd,
  isHm,
  parseYmd,
  formatYmd,
  todayYmd,
  addDaysYmd,
  dayOfWeekYmd,
  eachYmd,
  timesOverlap,
  expandOccurrences,
  findEmployeeConflicts,
  normalizeHm,
};
