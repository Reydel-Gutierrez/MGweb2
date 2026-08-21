const { User } = require('../db/db');
const {
  ClientOrg,
  Building,
  ClientBuildingAccess,
  RecurringSchedule,
  ScheduleException,
} = require('./models');

async function removeBuildingRecords(buildingId) {
  const schedules = await RecurringSchedule.find({ buildingId }).select('_id').lean();
  const scheduleIds = schedules.map((row) => row._id);
  if (scheduleIds.length) {
    await ScheduleException.deleteMany({ scheduleId: { $in: scheduleIds } });
    await RecurringSchedule.deleteMany({ _id: { $in: scheduleIds } });
  }
  await ClientBuildingAccess.deleteMany({ buildingId });
  await Building.deleteOne({ _id: buildingId });
  return { scheduleCount: scheduleIds.length };
}

async function removeClientOrg(orgId) {
  const buildings = await Building.find({ clientOrgId: orgId }).select('_id').lean();
  for (const building of buildings) {
    await removeBuildingRecords(building._id);
  }
  const users = await User.find({ role: 'client', clientOrgId: orgId }).select('_id').lean();
  const userIds = users.map((row) => row._id);
  if (userIds.length) {
    await ClientBuildingAccess.deleteMany({ userId: { $in: userIds } });
    await User.deleteMany({ _id: { $in: userIds } });
  }
  await ClientOrg.deleteOne({ _id: orgId });
  return { buildingCount: buildings.length, userCount: users.length };
}

module.exports = {
  removeBuildingRecords,
  removeClientOrg,
};
