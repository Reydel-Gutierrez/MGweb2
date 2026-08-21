const mongoose = require('mongoose');
const { RecurringSchedule, ScheduleException, DocumentationEntry } = require('./models');
const { expandOccurrences, isYmd } = require('./scheduleExpand');

async function loadWindow(from, to) {
  const schedules = await RecurringSchedule.find({ active: { $ne: false } }).lean();
  const exceptions = await ScheduleException.find({ date: { $gte: from, $lte: to } }).lean();
  return { schedules, exceptions };
}

async function findOccurrence(scheduleId, date) {
  if (!scheduleId || !isYmd(date)) return null;
  const { schedules, exceptions } = await loadWindow(date, date);
  const occs = expandOccurrences(schedules, exceptions, date, date, {});
  return occs.find((occ) => String(occ.scheduleId) === String(scheduleId)) || null;
}

async function photoCountMap(occs) {
  const map = new Map();
  if (!occs || !occs.length) return map;
  const scheduleIds = [
    ...new Set(occs.map((occ) => String(occ.scheduleId || '')).filter((id) => mongoose.isValidObjectId(id))),
  ].map((id) => new mongoose.Types.ObjectId(id));
  const dates = [...new Set(occs.map((occ) => occ.date).filter(Boolean))];
  if (!scheduleIds.length || !dates.length) return map;
  const rows = await DocumentationEntry.aggregate([
    { $match: { scheduleId: { $in: scheduleIds }, date: { $in: dates } } },
    { $group: { _id: { s: '$scheduleId', d: '$date' }, photos: { $sum: '$photoCount' } } },
  ]);
  rows.forEach((row) => {
    map.set(`${String(row._id.s)}|${row._id.d}`, row.photos || 0);
  });
  return map;
}

module.exports = {
  loadWindow,
  findOccurrence,
  photoCountMap,
};
