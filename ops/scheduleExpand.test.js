const assert = require('assert');
const {
  expandOccurrences,
  findEmployeeConflicts,
  timesOverlap,
  isYmd,
  isHm,
} = require('./scheduleExpand');

function sid(n) {
  return { toString: () => String(n) };
}

const employeeA = sid('empA');
const employeeB = sid('empB');
const building = sid('b1');

const weekly = {
  _id: sid('sched1'),
  kind: 'recurring',
  employeeId: employeeA,
  buildingId: building,
  daysOfWeek: [1, 2, 3, 4, 5],
  startTime: '18:00',
  endTime: '23:00',
  effectiveStartDate: '2026-08-17',
  effectiveEndDate: '',
  adminNote: 'Night crew',
  active: true,
};

const week = expandOccurrences(
  [weekly],
  [],
  '2026-08-17',
  '2026-08-23',
  {}
);

assert.strictEqual(week.length, 5, 'Mon-Fri in that week');
assert.strictEqual(week[0].date, '2026-08-17');
assert.strictEqual(week[4].date, '2026-08-21');
assert.ok(!week.some((o) => o.date === '2026-08-22'), 'Saturday excluded');

const skipped = expandOccurrences(
  [weekly],
  [{ scheduleId: weekly._id, date: '2026-08-19', type: 'skip' }],
  '2026-08-17',
  '2026-08-21',
  {}
);
assert.strictEqual(skipped.length, 4);
assert.ok(!skipped.some((o) => o.date === '2026-08-19'));

const covered = expandOccurrences(
  [weekly],
  [
    {
      _id: sid('ex1'),
      scheduleId: weekly._id,
      date: '2026-08-19',
      type: 'override',
      employeeId: employeeB,
      startTime: '17:00',
      endTime: '21:00',
      note: 'Coverage',
    },
  ],
  '2026-08-19',
  '2026-08-19',
  {}
);
assert.strictEqual(covered.length, 1);
assert.strictEqual(String(covered[0].employeeId), 'empB');
assert.strictEqual(covered[0].startTime, '17:00');

const onlyA = expandOccurrences(
  [weekly],
  [
    {
      scheduleId: weekly._id,
      date: '2026-08-19',
      type: 'override',
      employeeId: employeeB,
    },
  ],
  '2026-08-17',
  '2026-08-21',
  { employeeId: employeeA }
);
assert.ok(!onlyA.some((o) => o.date === '2026-08-19'));
assert.strictEqual(onlyA.length, 4);

const oneTime = {
  _id: sid('sched2'),
  kind: 'one_time',
  employeeId: employeeA,
  buildingId: building,
  oneTimeDate: '2026-08-22',
  startTime: '09:00',
  endTime: '12:00',
  active: true,
};
const weekend = expandOccurrences([weekly, oneTime], [], '2026-08-22', '2026-08-22', {});
assert.strictEqual(weekend.length, 1);
assert.strictEqual(weekend[0].kind, 'one_time');

assert.strictEqual(timesOverlap('18:00', '23:00', '19:00', '21:00'), true);
assert.strictEqual(timesOverlap('18:00', '23:00', '06:00', '11:00'), false);

const overlap = findEmployeeConflicts([
  { employeeId: employeeA, date: '2026-08-17', startTime: '18:00', endTime: '23:00' },
  { employeeId: employeeA, date: '2026-08-17', startTime: '20:00', endTime: '22:00' },
]);
assert.strictEqual(overlap.length, 1);

assert.strictEqual(isYmd('2026-08-20'), true);
assert.strictEqual(isYmd('08/20/2026'), false);
assert.strictEqual(isHm('18:00'), true);
assert.strictEqual(isHm('9:00'), false);

const ended = {
  ...weekly,
  _id: sid('sched3'),
  effectiveEndDate: '2026-08-18',
};
const afterEnd = expandOccurrences([ended], [], '2026-08-19', '2026-08-21', {});
assert.strictEqual(afterEnd.length, 0);

const weekendShift = {
  ...weekly,
  _id: sid('sched4'),
  daysOfWeek: [6, 0],
  startTime: '08:00',
  endTime: '14:00',
};
const weekendDays = expandOccurrences([weekendShift], [], '2026-08-21', '2026-08-24', {});
assert.strictEqual(weekendDays.length, 2);
assert.strictEqual(weekendDays[0].date, '2026-08-22');
assert.strictEqual(weekendDays[1].date, '2026-08-23');

const overnight = {
  ...weekly,
  _id: sid('sched5'),
  daysOfWeek: [1],
  startTime: '22:00',
  endTime: '06:00',
};
const night = expandOccurrences([overnight], [], '2026-08-17', '2026-08-17', {});
assert.strictEqual(night.length, 1);
assert.strictEqual(night[0].endsNextDay, true);
assert.strictEqual(night[0].startTime, '22:00');
assert.strictEqual(night[0].endTime, '06:00');

assert.strictEqual(timesOverlap('22:00', '06:00', '23:00', '01:00'), true);
assert.strictEqual(timesOverlap('22:00', '06:00', '07:00', '09:00'), false);

const overnightConflict = findEmployeeConflicts([
  { employeeId: employeeA, date: '2026-08-17', startTime: '22:00', endTime: '06:00' },
  { employeeId: employeeA, date: '2026-08-18', startTime: '05:00', endTime: '08:00' },
]);
assert.ok(overnightConflict.length >= 1, 'overnight shift should conflict with early next-day shift');

const overnightSafe = findEmployeeConflicts([
  { employeeId: employeeA, date: '2026-08-17', startTime: '22:00', endTime: '06:00' },
  { employeeId: employeeA, date: '2026-08-17', startTime: '18:00', endTime: '21:00' },
]);
assert.strictEqual(overnightSafe.length, 0);

console.log('ops/scheduleExpand.test.js passed');
