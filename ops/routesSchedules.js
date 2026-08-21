const express = require('express');
const { User } = require('../db/db');
const { RecurringSchedule, ScheduleException, Building } = require('./models');
const { requireOps } = require('./auth');
const { logAudit } = require('./audit');
const { isOid, fail } = require('./http');
const {
  isYmd,
  normalizeHm,
  expandOccurrences,
  findEmployeeConflicts,
  todayYmd,
  addDaysYmd,
} = require('./scheduleExpand');
const { clientAllowedBuildingIds, hasBuildingAccess, buildingsForEmployee } = require('./access');
const { loadWindow, photoCountMap } = require('./shiftLookup');

const router = express.Router();

function parseDays(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
}

function validateScheduleBody(body, partial) {
  const out = {};
  if (!partial || body.kind !== undefined) {
    out.kind = body.kind === 'one_time' ? 'one_time' : 'recurring';
  }
  if (!partial || body.employeeId !== undefined) {
    if (!isOid(body.employeeId)) return { error: 'An employee is required.' };
    out.employeeId = body.employeeId;
  }
  if (!partial || body.buildingId !== undefined) {
    if (!isOid(body.buildingId)) return { error: 'A building is required.' };
    out.buildingId = body.buildingId;
  }
  if (!partial || body.startTime !== undefined) {
    const start = normalizeHm(body.startTime);
    if (!start) return { error: 'Start time must be HH:mm.' };
    out.startTime = start;
  }
  if (!partial || body.endTime !== undefined) {
    const end = normalizeHm(body.endTime);
    if (!end) return { error: 'End time must be HH:mm.' };
    out.endTime = end;
  }
  if (!partial || body.adminNote !== undefined) {
    out.adminNote = String(body.adminNote || '').trim();
  }
  if (!partial || body.active !== undefined) {
    out.active = body.active === false ? false : true;
  }

  const kind = out.kind || (partial && partial.kind);
  if (kind === 'one_time') {
    if (!partial || body.oneTimeDate !== undefined || body.kind !== undefined) {
      const date = body.oneTimeDate || (partial && partial.oneTimeDate);
      if (!isYmd(date)) return { error: 'A date is required for a one-time schedule.' };
      out.oneTimeDate = date;
      out.daysOfWeek = [];
      out.effectiveStartDate = date;
      out.effectiveEndDate = date;
    }
  } else if (kind === 'recurring') {
    if (!partial || body.daysOfWeek !== undefined || body.kind !== undefined) {
      const days = parseDays(body.daysOfWeek != null ? body.daysOfWeek : partial && partial.daysOfWeek);
      if (!days.length) return { error: 'Select at least one weekday.' };
      out.daysOfWeek = days;
    }
    if (!partial || body.effectiveStartDate !== undefined || body.kind !== undefined) {
      const start = body.effectiveStartDate || (partial && partial.effectiveStartDate);
      if (!isYmd(start)) return { error: 'Effective start date is required.' };
      out.effectiveStartDate = start;
    }
    if (!partial || body.effectiveEndDate !== undefined) {
      const end = body.effectiveEndDate === '' || body.effectiveEndDate == null ? '' : body.effectiveEndDate;
      if (end && !isYmd(end)) return { error: 'Effective end date must be YYYY-MM-DD.' };
      out.effectiveEndDate = end;
    }
    if (out.effectiveStartDate && out.effectiveEndDate && out.effectiveEndDate < out.effectiveStartDate) {
      return { error: 'Effective end date cannot be before the start date.' };
    }
    out.oneTimeDate = '';
  }
  return { value: out };
}

async function hydrateOccurrences(occs, options) {
  const opts = options || {};
  const empIds = [...new Set(occs.map((o) => String(o.employeeId)))];
  const bIds = [...new Set(occs.map((o) => String(o.buildingId)))];
  const [employees, buildings, counts] = await Promise.all([
    User.find({ _id: { $in: empIds } }).select('fullName username').lean(),
    Building.find({ _id: { $in: bIds } }).select('name address clientOrgId').lean(),
    photoCountMap(occs),
  ]);
  const empMap = new Map(employees.map((u) => [String(u._id), u]));
  const bMap = new Map(buildings.map((b) => [String(b._id), b]));
  return occs.map((occ) => {
    const emp = empMap.get(String(occ.employeeId));
    const building = bMap.get(String(occ.buildingId));
    const row = {
      scheduleId: occ.scheduleId,
      exceptionId: occ.exceptionId,
      exceptionType: occ.exceptionType,
      date: occ.date,
      startTime: occ.startTime,
      endTime: occ.endTime,
      endsNextDay: !!occ.endsNextDay,
      employeeId: occ.employeeId,
      employeeName: emp ? emp.fullName : '',
      buildingId: occ.buildingId,
      buildingName: building ? building.name : '',
      buildingAddress: building ? building.address : '',
      kind: occ.kind,
      photoCount: counts.get(`${String(occ.scheduleId)}|${occ.date}`) || 0,
    };
    if (opts.includeAdminNote) {
      row.adminNote = occ.adminNote || '';
      row.exceptionNote = occ.exceptionNote || '';
    }
    return row;
  });
}

function daysEqual(a, b) {
  const norm = (arr) =>
    (arr || [])
      .map(Number)
      .slice()
      .sort((x, y) => x - y)
      .join(',');
  return norm(a) === norm(b);
}

function occurrenceDefiningChanged(current, updates) {
  if (updates.kind && updates.kind !== current.kind) return true;
  if (updates.employeeId && String(updates.employeeId) !== String(current.employeeId)) return true;
  if (updates.buildingId && String(updates.buildingId) !== String(current.buildingId)) return true;
  if (updates.startTime && updates.startTime !== current.startTime) return true;
  if (updates.endTime && updates.endTime !== current.endTime) return true;
  if (updates.daysOfWeek && !daysEqual(updates.daysOfWeek, current.daysOfWeek)) return true;
  return false;
}

router.get('/schedules', requireOps(['admin']), async (req, res) => {
  try {
    const q = {};
    if (req.query.employeeId && isOid(req.query.employeeId)) q.employeeId = req.query.employeeId;
    if (req.query.buildingId && isOid(req.query.buildingId)) q.buildingId = req.query.buildingId;
    if (req.query.active !== 'false') q.active = { $ne: false };
    const rows = await RecurringSchedule.find(q).sort({ createdAt: -1 }).lean();
    res.json(rows.map((row) => ({ ...row, id: row._id })));
  } catch (err) {
    console.error('GET /api/ops/schedules', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.post('/schedules', requireOps(['admin']), async (req, res) => {
  try {
    const parsed = validateScheduleBody(req.body || {}, null);
    if (parsed.error) return fail(res, 400, parsed.error);
    const employee = await User.findById(parsed.value.employeeId);
    if (!employee || employee.role === 'client') return fail(res, 400, 'Employee not found.');
    const building = await Building.findById(parsed.value.buildingId);
    if (!building) return fail(res, 400, 'Building not found.');
    const doc = await RecurringSchedule.create({
      ...parsed.value,
      createdBy: req.opsUser.username,
    });
    const from = parsed.value.effectiveStartDate || todayYmd();
    const to = parsed.value.effectiveEndDate || addDaysYmd(from, 14);
    const { schedules, exceptions } = await loadWindow(from, to);
    const occs = expandOccurrences(schedules, exceptions, from, to, { employeeId: doc.employeeId });
    const conflicts = findEmployeeConflicts(occs).filter(
      (c) => String(c.a.scheduleId) === String(doc._id) || String(c.b.scheduleId) === String(doc._id)
    );
    await logAudit(req, {
      action: 'schedule.create',
      entityType: 'schedule',
      entityId: doc._id,
      summary: `Created ${doc.kind} schedule for ${employee.fullName} at ${building.name}`,
      after: parsed.value,
    });
    res.status(201).json({
      ...doc.toObject(),
      id: doc._id,
      conflictCount: conflicts.length,
      warning:
        conflicts.length > 0
          ? 'This employee already has another overlapping shift on at least one of these days.'
          : '',
    });
  } catch (err) {
    console.error('POST /api/ops/schedules', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.patch('/schedules/:id', requireOps(['admin']), async (req, res) => {
  try {
    if (!isOid(req.params.id)) return fail(res, 400, 'Invalid schedule id.');
    const current = await RecurringSchedule.findById(req.params.id);
    if (!current) return fail(res, 404, 'Schedule not found.');
    const parsed = validateScheduleBody(req.body || {}, current.toObject());
    if (parsed.error) return fail(res, 400, parsed.error);
    if (parsed.value.employeeId) {
      const employee = await User.findById(parsed.value.employeeId);
      if (!employee || employee.role === 'client') return fail(res, 400, 'Employee not found.');
    }
    if (parsed.value.buildingId) {
      const building = await Building.findById(parsed.value.buildingId);
      if (!building) return fail(res, 400, 'Building not found.');
    }

    const today = todayYmd();
    const keepHistory =
      current.kind === 'recurring' &&
      (parsed.value.kind === undefined || parsed.value.kind === 'recurring') &&
      occurrenceDefiningChanged(current, parsed.value) &&
      current.effectiveStartDate &&
      current.effectiveStartDate < today &&
      addDaysYmd(today, -1) >= current.effectiveStartDate;

    if (keepHistory) {
      const yesterday = addDaysYmd(today, -1);
      await RecurringSchedule.updateOne(
        { _id: current._id },
        { $set: { effectiveEndDate: yesterday } }
      );
      const created = await RecurringSchedule.create({
        kind: 'recurring',
        employeeId: parsed.value.employeeId || current.employeeId,
        buildingId: parsed.value.buildingId || current.buildingId,
        daysOfWeek: parsed.value.daysOfWeek || current.daysOfWeek,
        startTime: parsed.value.startTime || current.startTime,
        endTime: parsed.value.endTime || current.endTime,
        effectiveStartDate:
          parsed.value.effectiveStartDate && parsed.value.effectiveStartDate > today
            ? parsed.value.effectiveStartDate
            : today,
        effectiveEndDate:
          parsed.value.effectiveEndDate !== undefined
            ? parsed.value.effectiveEndDate
            : current.effectiveEndDate || '',
        adminNote: parsed.value.adminNote !== undefined ? parsed.value.adminNote : current.adminNote,
        active: parsed.value.active !== undefined ? parsed.value.active : current.active !== false,
        createdBy: req.opsUser.username,
      });
      await ScheduleException.updateMany(
        { scheduleId: current._id, date: { $gte: today } },
        { $set: { scheduleId: created._id } }
      );
      await logAudit(req, {
        action: 'schedule.update',
        entityType: 'schedule',
        entityId: created._id,
        summary: `Updated recurring schedule from today; previous series closed on ${yesterday}`,
        before: {
          employeeId: String(current.employeeId),
          buildingId: String(current.buildingId),
          startTime: current.startTime,
          endTime: current.endTime,
          daysOfWeek: current.daysOfWeek,
        },
        after: parsed.value,
      });
      return res.json({
        ...created.toObject(),
        id: created._id,
        splitFrom: current._id,
        message: 'Past dates were kept. A new schedule starts today.',
      });
    }

    const updated = await RecurringSchedule.findByIdAndUpdate(
      current._id,
      { $set: parsed.value },
      { new: true }
    ).lean();
    await logAudit(req, {
      action: 'schedule.update',
      entityType: 'schedule',
      entityId: updated._id,
      summary: `Updated schedule ${updated._id}`,
      before: {
        employeeId: String(current.employeeId),
        buildingId: String(current.buildingId),
        startTime: current.startTime,
        endTime: current.endTime,
        daysOfWeek: current.daysOfWeek,
      },
      after: parsed.value,
    });
    res.json({ ...updated, id: updated._id });
  } catch (err) {
    console.error('PATCH /api/ops/schedules/:id', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.delete('/schedules/:id', requireOps(['admin']), async (req, res) => {
  try {
    if (!isOid(req.params.id)) return fail(res, 400, 'Invalid schedule id.');
    const current = await RecurringSchedule.findById(req.params.id);
    if (!current) return fail(res, 404, 'Schedule not found.');
    await ScheduleException.deleteMany({ scheduleId: current._id });
    await RecurringSchedule.deleteOne({ _id: current._id });
    await logAudit(req, {
      action: 'schedule.delete',
      entityType: 'schedule',
      entityId: current._id,
      summary: `Deleted schedule for employee ${current.employeeId} at building ${current.buildingId}`,
      before: {
        kind: current.kind,
        employeeId: String(current.employeeId),
        buildingId: String(current.buildingId),
        startTime: current.startTime,
        endTime: current.endTime,
      },
    });
    res.json({ message: 'Schedule removed' });
  } catch (err) {
    console.error('DELETE /api/ops/schedules/:id', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.post('/schedules/:id/exceptions', requireOps(['admin']), async (req, res) => {
  try {
    if (!isOid(req.params.id)) return fail(res, 400, 'Invalid schedule id.');
    const schedule = await RecurringSchedule.findById(req.params.id);
    if (!schedule) return fail(res, 404, 'Schedule not found.');
    const date = String((req.body && req.body.date) || '');
    if (!isYmd(date)) return fail(res, 400, 'Exception date must be YYYY-MM-DD.');
    const type = req.body.type === 'override' ? 'override' : 'skip';
    const payload = {
      scheduleId: schedule._id,
      date,
      type,
      note: String((req.body && req.body.note) || '').trim(),
      createdBy: req.opsUser.username,
      employeeId: null,
      startTime: '',
      endTime: '',
    };
    if (type === 'override') {
      if (req.body.employeeId) {
        if (!isOid(req.body.employeeId)) return fail(res, 400, 'Invalid employee.');
        payload.employeeId = req.body.employeeId;
      }
      if (req.body.startTime) {
        const start = normalizeHm(req.body.startTime);
        if (!start) return fail(res, 400, 'Start time must be HH:mm.');
        payload.startTime = start;
      }
      if (req.body.endTime) {
        const end = normalizeHm(req.body.endTime);
        if (!end) return fail(res, 400, 'End time must be HH:mm.');
        payload.endTime = end;
      }
    }
    const existing = await ScheduleException.findOne({ scheduleId: schedule._id, date });
    let doc;
    if (existing) {
      Object.assign(existing, payload);
      await existing.save();
      doc = existing;
    } else {
      doc = await ScheduleException.create(payload);
    }
    await logAudit(req, {
      action: 'schedule.exception',
      entityType: 'scheduleException',
      entityId: doc._id,
      summary: `${type} exception on ${date} for schedule ${schedule._id}`,
      after: payload,
    });
    res.status(201).json({ ...doc.toObject(), id: doc._id });
  } catch (err) {
    console.error('POST /api/ops/schedules/:id/exceptions', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.delete('/exceptions/:id', requireOps(['admin']), async (req, res) => {
  try {
    if (!isOid(req.params.id)) return fail(res, 400, 'Invalid exception id.');
    const current = await ScheduleException.findById(req.params.id);
    if (!current) return fail(res, 404, 'Exception not found.');
    await ScheduleException.deleteOne({ _id: current._id });
    await logAudit(req, {
      action: 'schedule.exceptionDelete',
      entityType: 'scheduleException',
      entityId: current._id,
      summary: `Removed exception on ${current.date}`,
      before: { type: current.type, date: current.date, scheduleId: String(current.scheduleId) },
    });
    res.json({ message: 'Exception removed' });
  } catch (err) {
    console.error('DELETE /api/ops/exceptions/:id', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

async function occurrencesHandler(req, res, scope) {
  const from = isYmd(req.query.from) ? req.query.from : todayYmd();
  const to = isYmd(req.query.to) ? req.query.to : addDaysYmd(from, 6);
  if (to < from) return fail(res, 400, 'End date cannot be before start date.');
  const span =
    (new Date(to.replace(/-/g, '/') + ' 00:00:00') - new Date(from.replace(/-/g, '/') + ' 00:00:00')) /
    (24 * 60 * 60 * 1000);
  if (span > 62) return fail(res, 400, 'Choose a date range of 62 days or less.');

  const { schedules, exceptions } = await loadWindow(from, to);
  const filters = {};
  if (scope.employeeId) filters.employeeId = scope.employeeId;
  if (scope.buildingId) filters.buildingId = scope.buildingId;
  let occs = expandOccurrences(schedules, exceptions, from, to, filters);
  if (scope.buildingIds) {
    const allowed = new Set(scope.buildingIds.map(String));
    occs = occs.filter((occ) => allowed.has(String(occ.buildingId)));
  }
  const hydrated = await hydrateOccurrences(occs, { includeAdminNote: scope.includeAdminNote });
  res.json(hydrated);
}

router.get('/occurrences', requireOps(['admin']), async (req, res) => {
  try {
    const scope = { includeAdminNote: true };
    if (req.query.employeeId && isOid(req.query.employeeId)) scope.employeeId = req.query.employeeId;
    if (req.query.buildingId && isOid(req.query.buildingId)) scope.buildingId = req.query.buildingId;
    await occurrencesHandler(req, res, scope);
  } catch (err) {
    console.error('GET /api/ops/occurrences', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.get('/my/occurrences', requireOps(['employee', 'admin']), async (req, res) => {
  try {
    await occurrencesHandler(req, res, {
      employeeId: req.opsUser.id,
      includeAdminNote: true,
    });
  } catch (err) {
    console.error('GET /api/ops/my/occurrences', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.get('/shifts', requireOps(['employee', 'admin']), async (req, res) => {
  try {
    const scope = { includeAdminNote: req.opsUser.role === 'admin' };
    if (req.query.buildingId && isOid(req.query.buildingId)) scope.buildingId = req.query.buildingId;
    await occurrencesHandler(req, res, scope);
  } catch (err) {
    console.error('GET /api/ops/shifts', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.get('/my/buildings', requireOps(['employee', 'admin']), async (req, res) => {
  try {
    const ids = await buildingsForEmployee(req.opsUser.id);
    const buildings = await Building.find({ _id: { $in: ids }, active: { $ne: false } })
      .select('name address')
      .sort({ name: 1 })
      .lean();
    res.json(buildings.map((b) => ({ id: b._id, name: b.name, address: b.address })));
  } catch (err) {
    console.error('GET /api/ops/my/buildings', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.get('/client/buildings', requireOps(['client']), async (req, res) => {
  try {
    const ids = await clientAllowedBuildingIds(req.opsUser);
    const buildings = await Building.find({ _id: { $in: ids }, active: { $ne: false } })
      .select('name address')
      .sort({ name: 1 })
      .lean();
    res.json(buildings.map((b) => ({ id: b._id, name: b.name, address: b.address })));
  } catch (err) {
    console.error('GET /api/ops/client/buildings', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.get('/client/occurrences', requireOps(['client']), async (req, res) => {
  try {
    const allowed = await clientAllowedBuildingIds(req.opsUser);
    if (req.query.buildingId) {
      if (!isOid(req.query.buildingId) || !hasBuildingAccess(allowed, req.query.buildingId)) {
        return fail(res, 403, 'You do not have access to that building.');
      }
    }
    await occurrencesHandler(req, res, {
      buildingId: req.query.buildingId && isOid(req.query.buildingId) ? req.query.buildingId : undefined,
      buildingIds: allowed,
      includeAdminNote: false,
    });
  } catch (err) {
    console.error('GET /api/ops/client/occurrences', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

module.exports = router;
