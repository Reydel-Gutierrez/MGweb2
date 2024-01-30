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
  payRate: { type: String, maxlength: 2 }, // Adjust the type as needed
  admin: { type: Boolean, default: false }, // Default to false, change as needed
});

const User = mongoose.model('User', userSchema);

// Invoice schema
const invoiceSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  invoice_title: { type: String, required: true },
  invoice_number: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['Paid', 'Unpaid'], required: true },
});

const Invoice = mongoose.model('Invoice', invoiceSchema);

// Task schema
const taskSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  date: { type: Date, required: true },
});

const Task = mongoose.model('Task', taskSchema);

module.exports = {
    db,
  User,
  Invoice,
  Task,
};
