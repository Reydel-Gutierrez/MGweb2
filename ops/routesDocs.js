const express = require('express');
const multer = require('multer');
const { User } = require('../db/db');
const { Building, RecurringSchedule, DocumentationEntry, DocumentationPhoto } = require('./models');
const { requireOps } = require('./auth');
const { logAudit } = require('./audit');
const { isOid, fail } = require('./http');
const { isYmd } = require('./scheduleExpand');
const { clientAllowedBuildingIds, hasBuildingAccess } = require('./access');
const { findOccurrence } = require('./shiftLookup');
const storage = require('./storage');
const { isPhotoPastRetention, expirePhotoRecord, expiredMessage } = require('./expirePhotos');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: storage.maxUploadBytes(),
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    if (storage.isAllowedType(file.mimetype)) {
      cb(null, true);
      return;
    }
    const err = new Error('INVALID_TYPE');
    err.code = 'INVALID_TYPE';
    cb(err);
  },
});

function multerError(err, req, res, next) {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') {
    return fail(
      res,
      400,
      `That photo is too large. Maximum size is ${Math.round(storage.maxUploadBytes() / (1024 * 1024))} MB.`
    );
  }
  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    return fail(res, 400, 'You can upload up to 10 photos at once.');
  }
  if (err.code === 'INVALID_TYPE' || err.message === 'INVALID_TYPE') {
    return fail(res, 400, 'That file type is not supported. Use a phone photo (JPEG, PNG, WebP, or GIF).');
  }
  if (err instanceof multer.MulterError) {
    return fail(res, 400, 'The upload could not be processed. Try fewer or smaller photos.');
  }
  return next(err);
}

function serializeEntry(entry, photos, options) {
  const opts = options || {};
  const serializedPhotos = (photos || []).map((photo) => {
    const expired = isPhotoPastRetention(photo);
    return {
      id: photo._id,
      expired,
      width: photo.width,
      height: photo.height,
      thumbUrl: expired ? null : `/api/ops/photos/${photo._id}/file?variant=thumb`,
      fileUrl: expired ? null : `/api/ops/photos/${photo._id}/file?variant=full`,
      downloadUrl: expired ? null : `/api/ops/photos/${photo._id}/file?download=1`,
    };
  });
  const allExpired =
    !!entry.photosExpired ||
    (serializedPhotos.length > 0 && serializedPhotos.every((photo) => photo.expired));
  return {
    id: entry._id,
    buildingId: entry.buildingId,
    buildingName: entry.buildingName || '',
    scheduleId: entry.scheduleId || null,
    date: entry.date || '',
    shiftStartTime: entry.shiftStartTime || '',
    shiftEndTime: entry.shiftEndTime || '',
    shiftEmployeeName: entry.shiftEmployeeName || '',
    uploadedBy: opts.includeUploader ? entry.uploadedBy : undefined,
    uploaderName: opts.includeUploader ? entry.uploaderName || '' : undefined,
    note: entry.note || '',
    photoCount: entry.photoCount || 0,
    photosExpired: allExpired,
    expiredMessage: allExpired ? expiredMessage() : '',
    createdAt: entry.createdAt,
    photos: serializedPhotos,
  };
}

async function hydrateEntries(entries, opts) {
  const buildingIds = [...new Set(entries.map((e) => String(e.buildingId)))];
  const userIds = [...new Set(entries.map((e) => String(e.uploadedBy)))];
  const entryIds = entries.map((e) => e._id);
  const [buildings, users, photos] = await Promise.all([
    Building.find({ _id: { $in: buildingIds } }).select('name').lean(),
    opts.includeUploader
      ? User.find({ _id: { $in: userIds } }).select('fullName').lean()
      : Promise.resolve([]),
    DocumentationPhoto.find({ entryId: { $in: entryIds } }).sort({ createdAt: 1 }).lean(),
  ]);
  const bMap = new Map(buildings.map((b) => [String(b._id), b.name]));
  const uMap = new Map(users.map((u) => [String(u._id), u.fullName]));
  const photosByEntry = new Map();
  photos.forEach((photo) => {
    const key = String(photo.entryId);
    const list = photosByEntry.get(key) || [];
    list.push(photo);
    photosByEntry.set(key, list);
  });
  return entries.map((entry) =>
    serializeEntry(
      {
        ...entry,
        buildingName: bMap.get(String(entry.buildingId)) || '',
        uploaderName: uMap.get(String(entry.uploadedBy)) || '',
      },
      photosByEntry.get(String(entry._id)) || [],
      opts
    )
  );
}

async function listDocumentation(req, res, scope) {
  const q = {};
  if (scope.buildingId) q.buildingId = scope.buildingId;
  if (scope.uploadedBy) q.uploadedBy = scope.uploadedBy;
  if (scope.buildingIds) q.buildingId = { $in: scope.buildingIds };
  if (scope.scheduleId) q.scheduleId = scope.scheduleId;
  if (scope.shiftDate) q.date = scope.shiftDate;
  if (!scope.shiftDate && (scope.from || scope.to)) {
    q.date = {};
    if (scope.from) q.date.$gte = scope.from;
    if (scope.to) q.date.$lte = scope.to;
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 50);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const total = await DocumentationEntry.countDocuments(q);
  const entries = await DocumentationEntry.find(q)
    .sort({ date: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  const items = await hydrateEntries(entries, { includeUploader: !!scope.includeUploader });
  res.json({ items, total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) });
}

function applyShiftQuery(req, scope) {
  if (req.query.scheduleId) {
    if (!isOid(req.query.scheduleId)) return 'Invalid shift.';
    scope.scheduleId = req.query.scheduleId;
  }
  if (req.query.date && isYmd(req.query.date)) scope.shiftDate = req.query.date;
  if (isYmd(req.query.from)) scope.from = req.query.from;
  if (isYmd(req.query.to)) scope.to = req.query.to;
  return null;
}

router.get('/documentation', requireOps(['admin']), async (req, res) => {
  try {
    const scope = { includeUploader: true };
    if (req.query.buildingId) {
      if (!isOid(req.query.buildingId)) return fail(res, 400, 'Invalid building.');
      scope.buildingId = req.query.buildingId;
    }
    if (req.query.uploadedBy && isOid(req.query.uploadedBy)) scope.uploadedBy = req.query.uploadedBy;
    const shiftErr = applyShiftQuery(req, scope);
    if (shiftErr) return fail(res, 400, shiftErr);
    await listDocumentation(req, res, scope);
  } catch (err) {
    console.error('GET /api/ops/documentation', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.get('/my/documentation', requireOps(['employee', 'admin']), async (req, res) => {
  try {
    const scope = { uploadedBy: req.opsUser.id, includeUploader: false };
    const shiftErr = applyShiftQuery(req, scope);
    if (shiftErr) return fail(res, 400, shiftErr);
    await listDocumentation(req, res, scope);
  } catch (err) {
    console.error('GET /api/ops/my/documentation', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.get('/client/documentation', requireOps(['client']), async (req, res) => {
  try {
    const allowed = await clientAllowedBuildingIds(req.opsUser);
    const scope = { buildingIds: allowed, includeUploader: false };
    if (req.query.buildingId) {
      if (!isOid(req.query.buildingId) || !hasBuildingAccess(allowed, req.query.buildingId)) {
        return fail(res, 403, 'You do not have access to that building.');
      }
      scope.buildingId = req.query.buildingId;
      delete scope.buildingIds;
    }
    const shiftErr = applyShiftQuery(req, scope);
    if (shiftErr) return fail(res, 400, shiftErr);
    if (scope.scheduleId) {
      if (scope.shiftDate) {
        const occ = await findOccurrence(scope.scheduleId, scope.shiftDate);
        if (!occ || !hasBuildingAccess(allowed, occ.buildingId)) {
          return fail(res, 403, 'You do not have access to that shift.');
        }
      } else {
        const sched = await RecurringSchedule.findById(scope.scheduleId).lean();
        if (!sched || !hasBuildingAccess(allowed, sched.buildingId)) {
          return fail(res, 403, 'You do not have access to that shift.');
        }
      }
    }
    await listDocumentation(req, res, scope);
  } catch (err) {
    console.error('GET /api/ops/client/documentation', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.get('/shift-documentation', requireOps(['employee', 'admin']), async (req, res) => {
  try {
    if (!isOid(req.query.scheduleId) || !isYmd(req.query.date)) {
      return fail(res, 400, 'Select a shift.');
    }
    const occ = await findOccurrence(req.query.scheduleId, req.query.date);
    if (!occ) return fail(res, 404, 'That shift was not found.');
    await listDocumentation(req, res, {
      scheduleId: occ.scheduleId,
      shiftDate: occ.date,
      includeUploader: true,
    });
  } catch (err) {
    console.error('GET /api/ops/shift-documentation', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.post(
  '/documentation',
  requireOps(['employee', 'admin']),
  upload.array('photos', 10),
  multerError,
  async (req, res) => {
    try {
      const files = req.files || [];
      if (!files.length) return fail(res, 400, 'Select at least one photo.');
      const scheduleId = String(req.body.scheduleId || '');
      const date = String(req.body.date || '');
      if (!isOid(scheduleId) || !isYmd(date)) {
        return fail(res, 400, 'Select the shift these photos belong to.');
      }
      const occ = await findOccurrence(scheduleId, date);
      if (!occ) {
        return fail(res, 400, 'That shift is not on the schedule for the selected date.');
      }
      const note = String(req.body.note || '').trim();
      const emp = occ.employeeId ? await User.findById(occ.employeeId).select('fullName').lean() : null;
      const entry = await DocumentationEntry.create({
        buildingId: occ.buildingId,
        scheduleId: occ.scheduleId,
        date: occ.date,
        shiftStartTime: occ.startTime || '',
        shiftEndTime: occ.endTime || '',
        shiftEmployeeName: emp ? emp.fullName : '',
        uploadedBy: req.opsUser.id,
        note,
        photoCount: 0,
      });
      const saved = [];
      try {
        for (const file of files) {
          const processed = await storage.saveProcessedPhoto(file.buffer);
          const photo = await DocumentationPhoto.create({
            entryId: entry._id,
            storageKey: processed.storageKey,
            thumbKey: processed.thumbKey,
            contentType: processed.contentType,
            byteSize: processed.byteSize,
            width: processed.width,
            height: processed.height,
            expiresAt: processed.expiresAt,
          });
          saved.push(photo);
        }
      } catch (err) {
        for (const photo of saved) {
          await storage.deleteObject(photo.storageKey);
          await storage.deleteObject(photo.thumbKey);
          await DocumentationPhoto.deleteOne({ _id: photo._id });
        }
        await DocumentationEntry.deleteOne({ _id: entry._id });
        console.error('Photo processing/upload failed:', err);
        return fail(
          res,
          500,
          'The photos could not be saved. Check the image files and try again. Nothing was kept from this upload.'
        );
      }
      entry.photoCount = saved.length;
      await entry.save();
      const [out] = await hydrateEntries([entry.toObject()], { includeUploader: false });
      res.status(201).json({ message: saved.length === 1 ? 'Photo uploaded.' : `${saved.length} photos uploaded.`, entry: out });
    } catch (err) {
      console.error('POST /api/ops/documentation', err);
      res.status(500).json({
        error: 'The upload failed. Please try again.',
        message: 'The upload failed. Please try again.',
      });
    }
  }
);

router.get('/photos/:id/file', requireOps(['admin', 'employee', 'client']), async (req, res) => {
  try {
    if (!isOid(req.params.id)) return fail(res, 400, 'Invalid photo id.');
    const photo = await DocumentationPhoto.findById(req.params.id).lean();
    if (!photo) return fail(res, 404, 'Photo not found.');
    const entry = await DocumentationEntry.findById(photo.entryId).lean();
    if (!entry) return fail(res, 404, 'Photo not found.');
    if (req.opsUser.role === 'client') {
      const allowed = await clientAllowedBuildingIds(req.opsUser);
      if (!hasBuildingAccess(allowed, entry.buildingId)) {
        return fail(res, 403, 'You do not have access to that photo.');
      }
    }
    if (isPhotoPastRetention(photo)) {
      if (!photo.expired) await expirePhotoRecord(photo);
      return fail(res, 410, expiredMessage());
    }
    const download = req.query.download === '1' || req.query.download === 'true';
    const variant = !download && req.query.variant === 'thumb' ? 'thumb' : 'full';
    const key = variant === 'thumb' && photo.thumbKey ? photo.thumbKey : photo.storageKey;
    const obj = await storage.getObject(key);
    if (!obj) {
      await expirePhotoRecord(photo);
      return fail(res, 410, expiredMessage());
    }
    res.setHeader('Content-Type', obj.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader(
      'Content-Disposition',
      download ? 'attachment; filename="mg-photo.jpg"' : 'inline; filename="mg-photo.jpg"'
    );
    res.send(obj.body);
  } catch (err) {
    console.error('GET /api/ops/photos/:id/file', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.delete('/photos/:id', requireOps(['admin']), async (req, res) => {
  try {
    if (!isOid(req.params.id)) return fail(res, 400, 'Invalid photo id.');
    const photo = await DocumentationPhoto.findById(req.params.id);
    if (!photo) return fail(res, 404, 'Photo not found.');
    await storage.deleteObject(photo.storageKey);
    await storage.deleteObject(photo.thumbKey);
    await DocumentationPhoto.deleteOne({ _id: photo._id });
    const remaining = await DocumentationPhoto.countDocuments({ entryId: photo.entryId });
    await DocumentationEntry.updateOne(
      { _id: photo.entryId },
      { $set: { photoCount: remaining, photosExpired: remaining === 0 } }
    );
    await logAudit(req, {
      action: 'photo.delete',
      entityType: 'documentationPhoto',
      entityId: photo._id,
      summary: `Deleted photo from documentation ${photo.entryId}`,
    });
    res.json({ message: 'Photo deleted' });
  } catch (err) {
    console.error('DELETE /api/ops/photos/:id', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.delete('/documentation/:id', requireOps(['admin']), async (req, res) => {
  try {
    if (!isOid(req.params.id)) return fail(res, 400, 'Invalid entry id.');
    const entry = await DocumentationEntry.findById(req.params.id);
    if (!entry) return fail(res, 404, 'Documentation not found.');
    const photos = await DocumentationPhoto.find({ entryId: entry._id });
    for (const photo of photos) {
      await storage.deleteObject(photo.storageKey);
      await storage.deleteObject(photo.thumbKey);
    }
    await DocumentationPhoto.deleteMany({ entryId: entry._id });
    await DocumentationEntry.deleteOne({ _id: entry._id });
    await logAudit(req, {
      action: 'photo.delete',
      entityType: 'documentationEntry',
      entityId: entry._id,
      summary: `Deleted documentation entry with ${photos.length} photo(s)`,
    });
    res.json({ message: 'Documentation deleted' });
  } catch (err) {
    console.error('DELETE /api/ops/documentation/:id', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

module.exports = router;
