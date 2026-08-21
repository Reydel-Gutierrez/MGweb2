const mongoose = require('mongoose');

const incomingCallSchema = new mongoose.Schema(
  {
    twilioCallSid: { type: String, required: true, unique: true, trim: true },
    from: { type: String, trim: true, default: '' },
    to: { type: String, trim: true, default: '' },
    category: {
      type: String,
      enum: ['existing_customer', 'quote', 'other', 'unknown'],
      default: 'unknown',
    },
    digits: { type: String, trim: true, default: '' },
    language: {
      type: String,
      enum: ['en', 'es'],
      default: 'en',
    },
    callStatus: {
      type: String,
      enum: ['in_progress', 'completed', 'no_message', 'failed'],
      default: 'in_progress',
    },
    recordingSid: { type: String, trim: true, default: '' },
    recordingUrl: { type: String, trim: true, default: '' },
    recordingDuration: { type: Number, default: 0 },
    listened: { type: Boolean, default: false },
    listenedAt: { type: Date },
    listenedBy: { type: String, trim: true, default: '' },
    callbackStatus: {
      type: String,
      enum: ['new', 'called_back', 'completed', 'no_answer'],
      default: 'new',
    },
    adminNotes: { type: String, trim: true, default: '' },
    notificationProcessedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

incomingCallSchema.index({ listened: 1, createdAt: -1 });
incomingCallSchema.index({ category: 1, createdAt: -1 });

const IncomingCall = mongoose.model('IncomingCall', incomingCallSchema);

/** Future SMS inbox — registered now so the collection shape is stable. Unused in V1. */
const incomingMessageSchema = new mongoose.Schema(
  {
    twilioMessageSid: { type: String, unique: true, sparse: true, trim: true },
    from: { type: String, trim: true, default: '' },
    to: { type: String, trim: true, default: '' },
    body: { type: String, trim: true, default: '' },
    mediaUrls: { type: [String], default: [] },
    direction: { type: String, enum: ['inbound', 'outbound'], default: 'inbound' },
    status: { type: String, trim: true, default: 'received' },
  },
  { timestamps: true }
);

const IncomingMessage = mongoose.model('IncomingMessage', incomingMessageSchema);

module.exports = {
  IncomingCall,
  IncomingMessage,
};
