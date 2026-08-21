const { Building, ClientBuildingAccess, RecurringSchedule, ScheduleException } = require('./models');
const { expandOccurrences, todayYmd, addDaysYmd } = require('./scheduleExpand');

function uniqueIds(values) {
  const out = [];
  const seen = new Set();
  (values || []).forEach((value) => {
    const id = String(value || '');
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
}

function opsUserId(user) {
  if (!user) return null;
  if (typeof user === 'object') return user.id || user._id || null;
  return user;
}

/**
 * Buildings a client portal user can see.
 * Explicit ClientBuildingAccess rows restrict to that subset.
 * If none are stored, they see every active building on their client organization
 * (so assigning the org + building is enough without extra checkboxes).
 */
async function clientAllowedBuildingIds(opsUser) {
  const userId = opsUserId(opsUser);
  const clientOrgId = opsUser && typeof opsUser === 'object' ? opsUser.clientOrgId : null;
  if (!userId) return [];
  const rows = await ClientBuildingAccess.find({ userId }).select('buildingId').lean();
  const explicit = uniqueIds(rows.map((row) => row.buildingId));
  if (explicit.length) return explicit;
  if (!clientOrgId) return [];
  const buildings = await Building.find({ clientOrgId, active: { $ne: false } })
    .select('_id')
    .lean();
  return uniqueIds(buildings.map((row) => row._id));
}

function hasBuildingAccess(allowedIds, buildingId) {
  return uniqueIds(allowedIds).includes(String(buildingId || ''));
}

async function buildingsForEmployee(userId) {
  const from = addDaysYmd(todayYmd(), -14);
  const to = addDaysYmd(todayYmd(), 60);
  const schedules = await RecurringSchedule.find({ active: { $ne: false } }).lean();
  const exceptions = await ScheduleException.find({
    date: { $gte: from, $lte: to },
  }).lean();
  const occs = expandOccurrences(schedules, exceptions, from, to, { employeeId: userId });
  const fromOccs = occs.map((occ) => occ.buildingId);
  const assigned = schedules
    .filter((schedule) => String(schedule.employeeId) === String(userId))
    .map((schedule) => schedule.buildingId);
  return uniqueIds(fromOccs.concat(assigned));
}

async function suggestedBuildingForEmployee(userId) {
  const today = todayYmd();
  const schedules = await RecurringSchedule.find({ active: { $ne: false } }).lean();
  const exceptions = await ScheduleException.find({ date: today }).lean();
  const occs = expandOccurrences(schedules, exceptions, today, today, { employeeId: userId });
  const ids = uniqueIds(occs.map((occ) => occ.buildingId));
  if (ids.length === 1) return ids[0];
  return null;
}

module.exports = {
  uniqueIds,
  clientAllowedBuildingIds,
  hasBuildingAccess,
  buildingsForEmployee,
  suggestedBuildingForEmployee,
};
