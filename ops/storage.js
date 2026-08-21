const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const AWS = require('aws-sdk');

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

function retentionDays() {
  const n = Number(process.env.PHOTO_RETENTION_DAYS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}

function maxUploadBytes() {
  const n = Number(process.env.PHOTO_MAX_BYTES);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 12 * 1024 * 1024;
}

function maxDimension() {
  const n = Number(process.env.PHOTO_MAX_DIMENSION);
  return Number.isFinite(n) && n >= 400 ? Math.floor(n) : 1600;
}

function localRoot() {
  return path.join(__dirname, '..', 'uploads', 'ops');
}

function isMissingObjectError(err) {
  const code = String((err && (err.code || err.name)) || '');
  const status = Number(err && (err.statusCode || err.status)) || 0;
  return (
    status === 404 ||
    code === 'NoSuchKey' ||
    code === 'NotFound' ||
    code === 'NoSuchBucket' ||
    /key does not exist/i.test(String((err && err.message) || ''))
  );
}

function r2Enabled() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

function r2Client() {
  return new AWS.S3({
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
    region: 'us-east-1',
    s3ForcePathStyle: true,
  });
}

function expiresAtFromNow() {
  const at = new Date();
  at.setDate(at.getDate() + retentionDays());
  return at;
}

function isAllowedType(mime) {
  return ALLOWED_TYPES.has(String(mime || '').toLowerCase());
}

let sharpLib = null;
function getSharp() {
  if (sharpLib) return sharpLib;
  try {
    sharpLib = require('sharp');
    return sharpLib;
  } catch (err) {
    throw new Error('Image processing is not available on this server.');
  }
}

async function processImage(buffer) {
  const sharp = getSharp();
  const dim = maxDimension();
  const image = sharp(buffer, { failOnError: false }).rotate();
  const meta = await image.metadata();
  const fullBuf = await image
    .resize({
      width: dim,
      height: dim,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 72 })
    .toBuffer();
  const fullMeta = await sharp(fullBuf).metadata();
  const thumbBuf = await sharp(fullBuf)
    .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 65 })
    .toBuffer();
  return {
    full: fullBuf,
    thumb: thumbBuf,
    width: fullMeta.width || meta.width || 0,
    height: fullMeta.height || meta.height || 0,
    contentType: 'image/jpeg',
  };
}

function objectKey(kind) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const id = crypto.randomBytes(16).toString('hex');
  return `ops/${y}/${m}/${id}-${kind}.jpg`;
}

async function putObject(key, body, contentType) {
  if (r2Enabled()) {
    await r2Client()
      .putObject({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
      .promise();
    return;
  }
  const full = path.join(localRoot(), key);
  await fsp.mkdir(path.dirname(full), { recursive: true });
  await fsp.writeFile(full, body);
}

async function getObject(key) {
  if (!key) return null;
  if (r2Enabled()) {
    try {
      const obj = await r2Client()
        .getObject({
          Bucket: process.env.R2_BUCKET,
          Key: key,
        })
        .promise();
      return { body: obj.Body, contentType: obj.ContentType || 'image/jpeg' };
    } catch (err) {
      if (isMissingObjectError(err)) return null;
      throw err;
    }
  }
  const full = path.join(localRoot(), key);
  try {
    const body = await fsp.readFile(full);
    return { body, contentType: 'image/jpeg' };
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function deleteObject(key) {
  if (!key) return;
  if (r2Enabled()) {
    try {
      await r2Client()
        .deleteObject({
          Bucket: process.env.R2_BUCKET,
          Key: key,
        })
        .promise();
    } catch (err) {
      if (!isMissingObjectError(err)) {
        console.error('R2 delete failed:', key, err.message || err);
      }
    }
    return;
  }
  const full = path.join(localRoot(), key);
  try {
    await fsp.unlink(full);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Local photo delete failed:', key, err.message || err);
  }
}

async function saveProcessedPhoto(buffer) {
  const processed = await processImage(buffer);
  const storageKey = objectKey('full');
  const thumbKey = objectKey('thumb');
  await putObject(storageKey, processed.full, processed.contentType);
  await putObject(thumbKey, processed.thumb, processed.contentType);
  return {
    storageKey,
    thumbKey,
    contentType: processed.contentType,
    byteSize: processed.full.length,
    width: processed.width,
    height: processed.height,
    expiresAt: expiresAtFromNow(),
  };
}

function storageMode() {
  return r2Enabled() ? 'r2' : 'local';
}

module.exports = {
  ALLOWED_TYPES,
  retentionDays,
  maxUploadBytes,
  maxDimension,
  isAllowedType,
  processImage,
  saveProcessedPhoto,
  getObject,
  deleteObject,
  storageMode,
  expiresAtFromNow,
};
