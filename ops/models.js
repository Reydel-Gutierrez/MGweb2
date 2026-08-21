const mongoose = require('mongoose');

const clientOrgSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    notes: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

clientOrgSchema.index({ name: 1 });
clientOrgSchema.index({ active: 1 });

const buildingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    clientOrgId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    address: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

buildingSchema.index({ clientOrgId: 1, name: 1 });
buildingSchema.index({ active: 1, name: 1 });

const clientBuildingAccessSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    buildingId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  },
  { timestamps: true }
);

clientBuildingAccessSchema.index({ userId: 1, buildingId: 1 }, { unique: true });

const scheduleSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['recurring', 'one_time'], default: 'recurring' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    buildingId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    daysOfWeek: { type: [Number], default: [] },
    oneTimeDate: { type: String, trim: true, default: '' },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    effectiveStartDate: { type: String, trim: true, default: '' },
    effectiveEndDate: { type: String, trim: true, default: '' },
    adminNote: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
    createdBy: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

scheduleSchema.index({ employeeId: 1, effectiveStartDate: 1 });
scheduleSchema.index({ buildingId: 1, effectiveStartDate: 1 });
scheduleSchema.index({ active: 1, kind: 1 });

const scheduleExceptionSchema = new mongoose.Schema(
  {
    scheduleId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    date: { type: String, required: true, trim: true },
    type: { type: String, enum: ['skip', 'override'], required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, default: null },
    startTime: { type: String, trim: true, default: '' },
    endTime: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    createdBy: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

scheduleExceptionSchema.index({ scheduleId: 1, date: 1 }, { unique: true });
scheduleExceptionSchema.index({ date: 1 });
scheduleExceptionSchema.index({ employeeId: 1, date: 1 });

const documentationEntrySchema = new mongoose.Schema(
  {
    buildingId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    scheduleId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    date: { type: String, trim: true, default: '' },
    shiftStartTime: { type: String, trim: true, default: '' },
    shiftEndTime: { type: String, trim: true, default: '' },
    shiftEmployeeName: { type: String, trim: true, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    note: { type: String, trim: true, default: '' },
    photoCount: { type: Number, default: 0 },
    photosExpired: { type: Boolean, default: false },
  },
  { timestamps: true }
);

documentationEntrySchema.index({ buildingId: 1, createdAt: -1 });
documentationEntrySchema.index({ uploadedBy: 1, createdAt: -1 });
documentationEntrySchema.index({ scheduleId: 1, date: 1, createdAt: -1 });
documentationEntrySchema.index({ date: 1, buildingId: 1 });

const documentationPhotoSchema = new mongoose.Schema(
  {
    entryId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    storageKey: { type: String, trim: true, default: '' },
    thumbKey: { type: String, trim: true, default: '' },
    contentType: { type: String, trim: true, default: 'image/jpeg' },
    byteSize: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    expired: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true, index: true },
    expiredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

documentationPhotoSchema.index({ entryId: 1, expired: 1 });

const opsAuditSchema = new mongoose.Schema(
  {
    actorUsername: { type: String, trim: true, default: '' },
    actorRole: { type: String, trim: true, default: '' },
    action: { type: String, required: true, trim: true },
    entityType: { type: String, trim: true, default: '' },
    entityId: { type: String, trim: true, default: '' },
    summary: { type: String, trim: true, default: '' },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

opsAuditSchema.index({ createdAt: -1 });
opsAuditSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

const ClientOrg = mongoose.model('ClientOrg', clientOrgSchema);
const Building = mongoose.model('Building', buildingSchema);
const ClientBuildingAccess = mongoose.model('ClientBuildingAccess', clientBuildingAccessSchema);
const RecurringSchedule = mongoose.model('RecurringSchedule', scheduleSchema);
const ScheduleException = mongoose.model('ScheduleException', scheduleExceptionSchema);
const DocumentationEntry = mongoose.model('DocumentationEntry', documentationEntrySchema);
const DocumentationPhoto = mongoose.model('DocumentationPhoto', documentationPhotoSchema);
const OpsAudit = mongoose.model('OpsAudit', opsAuditSchema);

module.exports = {
  ClientOrg,
  Building,
  ClientBuildingAccess,
  RecurringSchedule,
  ScheduleException,
  DocumentationEntry,
  DocumentationPhoto,
  OpsAudit,
};
