const mongoose = require('mongoose');

const databaseName = 'MG';

// Connect to MongoDB
mongoose.connect('mongodb+srv://reydeluser:rg012499@devcluster.erjhbu6.mongodb.net/MG', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected successfully');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

const db = mongoose.connection;

//user registration
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  idNumber: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  payRate: { type: String, maxlength: 32 },
  admin: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
});

const User = mongoose.model('User', userSchema);

const lineItemSchema = new mongoose.Schema({
  description: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  unit_price: { type: Number, default: 0 },
}, { _id: false });

// Invoice schema — extended for workspace drafts; legacy docs omit record_status (treated as sent)
const invoiceSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  invoice_title: { type: String, required: true },
  invoice_number: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['Paid', 'Unpaid'], required: true },
  record_status: { type: String, enum: ['draft', 'sent'], default: 'sent' },
  due_date: { type: Date },
  client_name: { type: String },
  bill_to: { type: String },
  service_address: { type: String },
  service_description: { type: String },
  line_items: { type: [lineItemSchema], default: undefined },
  subtotal: { type: Number },
  tax_rate_percent: { type: Number },
  tax_amount: { type: Number },
  notes: { type: String },
  template_type: { type: String },
  sent_at: { type: Date },
}, { timestamps: true });

const Invoice = mongoose.model('Invoice', invoiceSchema);

const invoiceTemplateSchema = new mongoose.Schema({
  slug: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  description: { type: String },
  invoice_title: { type: String },
  bill_to: { type: String },
  client_name: { type: String },
  service_address: { type: String },
  service_description: { type: String },
  line_items: { type: [lineItemSchema], default: [] },
  tax_rate_percent: { type: Number, default: 0 },
  notes: { type: String },
  template_type: { type: String },
  is_system: { type: Boolean, default: false },
});

const InvoiceTemplate = mongoose.model('InvoiceTemplate', invoiceTemplateSchema);

// Task schema
const taskSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  date: { type: Date, required: true },
});

const Task = mongoose.model('Task', taskSchema);

// Define a Schema for individual punches
const punchRecordSchema = new mongoose.Schema({
  date: String,
  time: String,
  action: String, // 'Clock In' or 'Clock Out'
}, { _id: false }); // Prevents Mongoose from creating an _id for each punch record

// Define the main Schema for user punches
const userPunchSchema = new mongoose.Schema({
  username: { type: String, unique: true }, // Ensures username is unique
  fullname: String,
  punches: [punchRecordSchema] // An array to store multiple punches
});

// Create a model from the schema
const UserPunch = mongoose.model('UserPunch', userPunchSchema);

// Create schema for Payroll record
const payrollSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  payRate: { type: Number, required: true },
  hours: { type: Number, required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  amount: { type: Number, required: true },
  payDate: { type: Date, required: true },
  comments: { type: String, required: false } // Assuming comments are optional
});

const Payroll = mongoose.model('Payroll', payrollSchema);

const punchRequestSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  originalDate: { type: Number, required: false },
  originalAction: { type: Number, required: false },
  originalTime: { type: Date, required: false },
  newDate: { type: Date, required: true },
  newAction: { type: Number, required: true },
  newTime: { type: Date, required: true },
  newComments: { type: String, required: false },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
});

const PunchRequest = mongoose.model('PunchRequest', punchRequestSchema);

/** Public website quote / proposal / contact intake (CRM pipeline) */
const leadSubmissionSchema = new mongoose.Schema(
  {
    requestType: {
      type: String,
      enum: ['quote', 'proposal', 'contact'],
      default: 'quote',
    },
    companyName: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true, default: '' },
    facilityName: { type: String, trim: true, default: '' },
    serviceLocation: { type: String, trim: true, default: '' },
    serviceTypeNeeded: { type: String, trim: true, default: '' },
    squareFootage: { type: String, trim: true, default: '' },
    needCategory: {
      type: String,
      enum: ['cleaning', 'staffing', 'both', 'unsure', 'other'],
      default: 'unsure',
    },
    message: { type: String, trim: true, default: '' },
    desiredTimeline: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'closed', 'lost'],
      default: 'new',
    },
    source: { type: String, trim: true, default: 'website' },
    /** Internal CRM notes (admin only; not collected from public forms) */
    adminNotes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

const Lead = mongoose.model('Lead', leadSubmissionSchema);

module.exports = {
    db,
  User,
  Invoice,
  InvoiceTemplate,
  Task,
  UserPunch,
  Payroll,
  PunchRequest,
  Lead,
};
