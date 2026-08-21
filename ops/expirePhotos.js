const { DocumentationPhoto, DocumentationEntry } = require('./models');
const storage = require('./storage');

const BATCH = 40;

function isPhotoPastRetention(photo) {
  if (!photo) return true;
  if (photo.expired) return true;
  if (!photo.storageKey) return true;
  if (photo.expiresAt && new Date(photo.expiresAt).getTime() <= Date.now()) return true;
  return false;
}

async function markEntryIfFullyExpired(entryId) {
  const remaining = await DocumentationPhoto.countDocuments({
    entryId,
    expired: { $ne: true },
    storageKey: { $ne: '' },
  });
  if (remaining === 0) {
    await DocumentationEntry.updateOne({ _id: entryId }, { $set: { photosExpired: true } });
  }
}

async function expirePhotoRecord(photo) {
  if (!photo || !photo._id) return;
  await storage.deleteObject(photo.storageKey);
  await storage.deleteObject(photo.thumbKey);
  await DocumentationPhoto.updateOne(
    { _id: photo._id },
    {
      $set: {
        expired: true,
        expiredAt: photo.expiredAt || new Date(),
        storageKey: '',
        thumbKey: '',
      },
    }
  );
  await markEntryIfFullyExpired(photo.entryId);
}

async function expireDuePhotosBatch() {
  const due = await DocumentationPhoto.find({
    expired: { $ne: true },
    expiresAt: { $lte: new Date() },
  })
    .limit(BATCH)
    .lean();

  if (!due.length) return 0;

  for (const photo of due) {
    await expirePhotoRecord(photo);
  }
  return due.length;
}

async function expireDuePhotos() {
  let total = 0;
  for (let i = 0; i < 25; i += 1) {
    const n = await expireDuePhotosBatch();
    total += n;
    if (n < BATCH) break;
  }
  return total;
}

function startPhotoExpirySweep() {
  const run = () => {
    expireDuePhotos().catch((err) => {
      console.error('Photo expiry sweep failed:', err);
    });
  };
  setTimeout(run, 45 * 1000);
  setInterval(run, 6 * 60 * 60 * 1000);
}

function expiredMessage() {
  return `Photos expired — ${storage.retentionDays()}-day retention period`;
}

module.exports = {
  isPhotoPastRetention,
  expirePhotoRecord,
  expireDuePhotos,
  startPhotoExpirySweep,
  expiredMessage,
};
