const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const { User } = require('./db/db.js'); // Import User model from db.js

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'static')));

// Assuming you have a route to handle user registration
app.post('/register', async (req, res) => {
  const { fullName, idNumber, email, username, password, payRate, admin } = req.body;

  try {
    // Check if the idNumber is already taken
    const existingUser = await User.findOne({ idNumber });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this ID number already exists' });
    }

    // Create a new user
    const newUser = new User({ fullName, idNumber, email, username, password, payRate, admin });
    await newUser.save();

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Login route Admin
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
  
    try {
      // Find user by username
      const user = await User.findOne({ username });
  
      // Check if user exists and verify password
      if (!user || user.password !== password) {
        res.status(401).json({ message: 'Invalid credentials' });
      } else if (user.active === false) {
        res.status(403).json({ message: 'This account is deactivated' });
      } else if (user.admin) {
        res.json({ message: 'Login successful', username: user.username, name: user.fullName });
      } else {
        res.status(403).json({
          message:
            'This account is not enabled for the administrator portal. Use the employee sign-in for time clock and pay.',
          reason: 'NOT_ADMIN',
        });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // Only employee login
  app.post('/loginEmployee', async (req, res) => {
    const { username, password } = req.body;
  
    try {
      // Find user by username
      const user = await User.findOne({ username });
  
      // Check if user exists and verify password
      if (!user || user.password !== password) {
        res.status(401).json({ message: 'Invalid credentials' });
      } else if (user.active === false) {
        res.status(403).json({ message: 'This account is deactivated' });
      } else {
        res.json({
          message: 'Login successful',
          username: user.username,
          name: user.fullName,
          email: user.email,
          idNumber: user.idNumber,
          payRate: user.payRate || '',
        });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

/** Employee portal: profile (no password) */
app.post('/employeeProfile', async (req, res) => {
  try {
    const { username } = req.body || {};
    if (!username) {
      return res.status(400).json({ message: 'username required' });
    }
    const user = await User.findOne({ username }).lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      idNumber: user.idNumber,
      payRate: user.payRate || '',
      active: user.active !== false,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// New route to fetch user data for the table
app.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, { password: 0, __v: 0 }).lean();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Update employee (admin)
app.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    const {
      fullName,
      email,
      username,
      payRate,
      admin,
      idNumber,
      password,
      active,
    } = req.body;

    const current = await User.findById(id);
    if (!current) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updates = {};
    if (fullName !== undefined) updates.fullName = String(fullName).trim();
    if (email !== undefined) updates.email = String(email).trim();
    if (username !== undefined) updates.username = String(username).trim();
    if (payRate !== undefined) updates.payRate = String(payRate).trim();
    if (admin !== undefined) updates.admin = Boolean(admin);
    if (idNumber !== undefined) updates.idNumber = String(idNumber).trim();
    if (active !== undefined) updates.active = Boolean(active);
    if (password !== undefined && String(password).length > 0) {
      updates.password = String(password);
    }

    if (updates.email) {
      const taken = await User.findOne({
        email: updates.email,
        _id: { $ne: id },
      });
      if (taken) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }
    if (updates.username) {
      const taken = await User.findOne({
        username: updates.username,
        _id: { $ne: id },
      });
      if (taken) {
        return res.status(400).json({ message: 'Username already in use' });
      }
    }
    if (updates.idNumber) {
      const taken = await User.findOne({
        idNumber: updates.idNumber,
        _id: { $ne: id },
      });
      if (taken) {
        return res.status(400).json({ message: 'Employee ID already in use' });
      }
    }

    const updated = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .select('-password')
      .lean();

    res.json({ message: 'User updated', data: updated });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Duplicate email or username' });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST route to delete an employee
app.post('/deleteEmployee', async (req, res) => {
  try {
    const { employeeID } = req.body;

    // Find and delete the employee by ID
    const deletedEmployee = await User.findOneAndDelete({ idNumber: employeeID });

    if (!deletedEmployee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.status(200).json({ message: 'Employee deleted successfully', data: deletedEmployee });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const { Invoice, InvoiceTemplate } = require('./db/db.js');

const sentInvoiceFilter = {
  $or: [{ record_status: { $ne: 'draft' } }, { record_status: { $exists: false } }],
};

function computeInvoiceTotals(lineItems, taxRatePercent) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  let subtotal = 0;
  items.forEach((row) => {
    const q = Number(row.quantity) || 0;
    const u = Number(row.unit_price) || 0;
    subtotal += q * u;
  });
  const rate = Number(taxRatePercent) || 0;
  const tax = subtotal * (rate / 100);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax_amount: Math.round(tax * 100) / 100,
    amount: Math.round((subtotal + tax) * 100) / 100,
  };
}

// POST — legacy + workspace: record_status defaults to sent for old clients
app.post('/submitInvoice', async (req, res) => {
  try {
    const {
      date,
      invoice_title,
      invoice_number,
      amount,
      status,
      record_status,
      due_date,
      client_name,
      bill_to,
      service_address,
      service_description,
      line_items,
      subtotal,
      tax_rate_percent,
      tax_amount,
      notes,
      template_type,
    } = req.body;

    const rs = record_status === 'draft' ? 'draft' : 'sent';
    let amt = Number(amount);
    let sub = subtotal != null ? Number(subtotal) : undefined;
    let taxAmt = tax_amount != null ? Number(tax_amount) : undefined;
    if (line_items && Array.isArray(line_items) && line_items.length) {
      const t = computeInvoiceTotals(line_items, tax_rate_percent);
      sub = t.subtotal;
      taxAmt = t.tax_amount;
      amt = t.amount;
    }
    if (Number.isNaN(amt)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const newInvoice = new Invoice({
      date,
      invoice_title,
      invoice_number,
      amount: amt,
      status: status || 'Unpaid',
      record_status: rs,
      due_date: due_date ? new Date(due_date) : undefined,
      client_name,
      bill_to,
      service_address,
      service_description,
      line_items,
      subtotal: sub,
      tax_rate_percent: tax_rate_percent != null ? Number(tax_rate_percent) : undefined,
      tax_amount: taxAmt,
      notes,
      template_type,
      sent_at: rs === 'sent' ? new Date() : undefined,
    });

    await newInvoice.save();

    res.status(201).json({ message: 'Invoice created successfully', data: newInvoice });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/** Create draft from workspace (auto invoice # if omitted) */
app.post('/invoice-workspace', async (req, res) => {
  try {
    const body = req.body || {};
    let invoice_number = body.invoice_number && String(body.invoice_number).trim();
    if (!invoice_number) {
      invoice_number = `DRAFT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    }
    const taken = await Invoice.findOne({ invoice_number });
    if (taken) {
      return res.status(400).json({ error: 'Invoice number already in use' });
    }
    const date = body.date ? new Date(body.date) : new Date();
    const line_items = Array.isArray(body.line_items) ? body.line_items : [];
    const tax_rate_percent = body.tax_rate_percent != null ? Number(body.tax_rate_percent) : 0;
    const t = computeInvoiceTotals(line_items, tax_rate_percent);
    const doc = new Invoice({
      date,
      invoice_title: String(body.invoice_title || 'Untitled invoice').trim(),
      invoice_number,
      amount: t.amount,
      status: 'Unpaid',
      record_status: 'draft',
      due_date: body.due_date ? new Date(body.due_date) : undefined,
      client_name: body.client_name,
      bill_to: body.bill_to,
      service_address: body.service_address,
      service_description: body.service_description,
      line_items,
      subtotal: t.subtotal,
      tax_rate_percent,
      tax_amount: t.tax_amount,
      notes: body.notes,
      template_type: body.template_type,
    });
    await doc.save();
    res.status(201).json({ message: 'Draft created', data: doc });
  } catch (error) {
    console.error('Error creating workspace draft:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Sent invoices only — invoice log / history
app.get('/fetchInvoices', async (req, res) => {
  try {
    const invoices = await Invoice.find(sentInvoiceFilter, { _id: 0, __v: 0 }).lean();
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/fetchInvoiceDrafts', async (req, res) => {
  try {
    const drafts = await Invoice.find({ record_status: 'draft' }, { _id: 0, __v: 0 })
      .sort({ updatedAt: -1 })
      .lean();
    res.json(drafts);
  } catch (error) {
    console.error('Error fetching invoice drafts:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/invoice/:invoiceNumber', async (req, res) => {
  try {
    const inv = await Invoice.findOne(
      { invoice_number: req.params.invoiceNumber },
      { _id: 0, __v: 0 }
    ).lean();
    if (!inv) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(inv);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/invoiceTemplates', async (req, res) => {
  try {
    const list = await InvoiceTemplate.find({}, { _id: 0, __v: 0 }).sort({ name: 1 }).lean();
    res.json(list);
  } catch (error) {
    console.error('Error fetching invoice templates:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/invoice/:invoiceNumber/send', async (req, res) => {
  try {
    const { invoiceNumber } = req.params;
    const existing = await Invoice.findOne({ invoice_number: invoiceNumber });
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (existing.record_status !== 'draft') {
      return res.status(400).json({ error: 'Only drafts can be sent' });
    }
    const num = String(existing.invoice_number || '');
    if (num.startsWith('DRAFT-')) {
      return res.status(400).json({
        error: 'Set a final invoice number before sending (replace the draft placeholder).',
      });
    }
    const line_items = existing.line_items && existing.line_items.length
      ? existing.line_items
      : req.body.line_items;
    const tax_rate_percent = existing.tax_rate_percent != null
      ? existing.tax_rate_percent
      : req.body.tax_rate_percent;
    const t = computeInvoiceTotals(line_items, tax_rate_percent);
    const updated = await Invoice.findOneAndUpdate(
      { invoice_number: invoiceNumber },
      {
        $set: {
          record_status: 'sent',
          sent_at: new Date(),
          status: 'Unpaid',
          amount: t.amount,
          subtotal: t.subtotal,
          tax_amount: t.tax_amount,
          line_items,
          tax_rate_percent: tax_rate_percent != null ? Number(tax_rate_percent) : undefined,
        },
      },
      { new: true, runValidators: true }
    ).lean();
    res.json({ message: 'Invoice sent', data: updated });
  } catch (error) {
    console.error('Error sending invoice:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


  // DELETE route to delete an invoice by invoice number
app.delete('/deleteInvoice/:invoiceNumber', async (req, res) => {
  try {
    const { invoiceNumber } = req.params;

    // Find the invoice in the database by invoice number
    const deletedInvoice = await Invoice.findOneAndDelete({ invoice_number: invoiceNumber });

    if (!deletedInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.status(200).json({ message: 'Invoice deleted successfully', data: deletedInvoice });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update invoice
app.patch('/updateInvoiceStatus/:invoiceNumber', async (req, res) => {
  try {
    const { invoiceNumber } = req.params;
    const { invoiceStatus } = req.body;

    // Find the invoice by invoice number and update its status
    const updatedInvoice = await Invoice.findOneAndUpdate(
      { invoice_number: invoiceNumber },
      { status: invoiceStatus },
      { new: true } // Return the updated document
    );

    if (!updatedInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ message: 'Invoice status updated successfully', data: updatedInvoice });
  } catch (error) {
    console.error('Error updating invoice status:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Full invoice update — sent: limited fields; draft: full workspace payload
app.patch('/invoice/:invoiceNumber', async (req, res) => {
  try {
    const { invoiceNumber } = req.params;
    const existing = await Invoice.findOne({ invoice_number: invoiceNumber });
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const isDraft = existing.record_status === 'draft';

    if (!isDraft) {
      const { date, invoice_title, amount, status } = req.body;
      const set = {};
      if (date !== undefined) set.date = new Date(date);
      if (invoice_title !== undefined) set.invoice_title = String(invoice_title).trim();
      if (amount !== undefined) set.amount = Number(amount);
      if (status !== undefined) {
        if (!['Paid', 'Unpaid'].includes(status)) {
          return res.status(400).json({ error: 'Status must be Paid or Unpaid' });
        }
        set.status = status;
      }
      if (Object.keys(set).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      const updated = await Invoice.findOneAndUpdate(
        { invoice_number: invoiceNumber },
        { $set: set },
        { new: true, runValidators: true }
      ).lean();
      return res.json({ message: 'Invoice updated', data: updated });
    }

    const body = req.body || {};
    const newNum =
      body.invoice_number !== undefined ? String(body.invoice_number).trim() : invoiceNumber;
    if (newNum !== invoiceNumber) {
      const taken = await Invoice.findOne({ invoice_number: newNum });
      if (taken) {
        return res.status(400).json({ error: 'Invoice number already in use' });
      }
    }

    const line_items = body.line_items !== undefined ? body.line_items : existing.line_items;
    const tax_rate_percent =
      body.tax_rate_percent !== undefined ? Number(body.tax_rate_percent) : existing.tax_rate_percent;
    const t = computeInvoiceTotals(line_items, tax_rate_percent);

    const set = {
      invoice_number: newNum,
      date: body.date !== undefined ? new Date(body.date) : existing.date,
      invoice_title:
        body.invoice_title !== undefined
          ? String(body.invoice_title).trim()
          : existing.invoice_title,
      due_date:
        body.due_date !== undefined
          ? body.due_date
            ? new Date(body.due_date)
            : null
          : existing.due_date,
      client_name: body.client_name !== undefined ? body.client_name : existing.client_name,
      bill_to: body.bill_to !== undefined ? body.bill_to : existing.bill_to,
      service_address:
        body.service_address !== undefined ? body.service_address : existing.service_address,
      service_description:
        body.service_description !== undefined
          ? body.service_description
          : existing.service_description,
      line_items,
      subtotal: t.subtotal,
      tax_rate_percent: tax_rate_percent != null ? tax_rate_percent : undefined,
      tax_amount: t.tax_amount,
      amount: t.amount,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      template_type: body.template_type !== undefined ? body.template_type : existing.template_type,
    };

    const updated = await Invoice.findOneAndUpdate(
      { invoice_number: invoiceNumber },
      { $set: set },
      { new: true, runValidators: true }
    ).lean();
    return res.json({ message: 'Draft updated', data: updated });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


const { Task } = require('./db/db.js');

// Define your route to add a new task
app.post('/addTask', async (req, res) => {
  try {
    // Handle form fields
    const { taskTitle, taskDate } = req.body;

    const taskCount = await Task.countDocuments();

    // Create a new task instance
    const newTask = new Task({
      id: String(taskCount + 1),
      title: taskTitle,
      date: taskDate,
    });

    // Save the new task to the database
    await newTask.save();

    res.status(201).json({ message: 'Task added successfully', data: newTask });
  } catch (error) {
    console.error('Error adding task:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Define endpoint to fetch tasks
app.get('/fetchTasks', async (req, res) => {
  try {
    const tasks = await Task.find();
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update task
app.patch('/updateTask', async (req, res) => {
  try {
    const { taskId, taskTitle, taskDate } = req.body;
    if (!taskId || taskTitle === undefined || !taskDate) {
      return res.status(400).json({ error: 'taskId, taskTitle, and taskDate are required' });
    }
    const sid = String(taskId);
    const numId = Number(taskId);
    const idQuery =
      !Number.isNaN(numId) && String(numId) === sid
        ? { $or: [{ id: sid }, { id: numId }] }
        : { id: sid };
    const updated = await Task.findOneAndUpdate(
      idQuery,
      { title: String(taskTitle).trim(), date: new Date(taskDate) },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task updated', data: updated });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete task endpoint
app.post('/deleteTask', async (req, res) => {
  try {
    const { taskId } = req.body;

    // Find and delete the task by custom ID
    const sid = String(taskId);
    const numId = Number(taskId);
    const idQuery =
      !Number.isNaN(numId) && String(numId) === sid
        ? { $or: [{ id: sid }, { id: numId }] }
        : { id: sid };
    const deletedTask = await Task.findOneAndDelete(idQuery);
    
    if (!deletedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(200).json({ message: 'Task deleted successfully', data: deletedTask });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


//employee punching

const { UserPunch } = require('./db/db.js');

// POST endpoint for /employeePunching
app.post('/employeePunching', async (req, res) => {
  const { username, fullname, date, time, action } = req.body;

  try {
    // Attempt to find a document for the user
    let userPunch = await UserPunch.findOne({ username: username });

    // Check the last punch action if user exists
    if (userPunch) {
      const lastPunch = userPunch.punches[0]; // Get the most recent punch
      if (lastPunch) {
        // Prevent punching in if the last punch was also a punch in
        if (action === 'Clock In' && lastPunch.action === 'Clock In') {
          return res.status(400).json({ message: 'User is punched in already.' });
        }
        // Prevent punching out if the last punch was a punch out or if there are no punches
        if (action === 'Clock Out' && (lastPunch.action === 'Clock Out' || userPunch.punches.length === 0)) {
          return res.status(400).json({ message: 'User needs to punch in first.' });
        }
      }

      // Add a new punch to the beginning of the punches array
      userPunch.punches.unshift({ date, time, action });
    } else {
      // If the first action is trying to punch out, inform the user to punch in first
      if (action === 'Clock Out') {
        return res.status(400).json({ message: 'User needs to punch in first.' });
      }
      // No document for the user, create a new one with the punch in
      userPunch = new UserPunch({
        username,
        fullname,
        punches: [{ date, time, action }]
      });
    }

    // Save changes to the database
    await userPunch.save();

    res.json({ message: 'Punch data processed successfully', data: userPunch });
  } catch (error) {
    console.error('Error processing punch data:', error);
    res.status(500).json({ message: 'Error processing punch data', error: error });
  }
});



// Finding employee punch
app.post('/employeePunchHistory', async (req, res) => {
  const { username } = req.body;

  try {
    const userPunches = await UserPunch.findOne({ username: username });

    if (!userPunches) {
      return res.status(404).send('User not found');
    }

    // Send back the full document or a part of it as needed
    res.json({
      fullname: userPunches.fullname, // Include the fullname
      punches: userPunches.punches    // Include the punches array
      // You can include other fields here as necessary
    });
  } catch (error) {
    console.error('Error fetching user punches:', error);
    res.status(500).send('Server error');
  }
});


//Payroll schema
const { Payroll } = require('./db/db.js');

//employe Payroll record
app.post('/employeeRegisterPay', async (req, res) => {
  try {
    const payrollData = new Payroll(req.body);
    const savedData = await payrollData.save();
    res.status(201).json(savedData);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// fetch payroll records
app.get('/fetchPayrollRecords', async (req, res) => {
  try {
    const payrollRecords = await Payroll.find({});
    res.json(payrollRecords);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/payroll/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid payroll id' });
    }
    const {
      fullName,
      payRate,
      hours,
      fromDate,
      toDate,
      amount,
      payDate,
      comments,
    } = req.body;
    const set = {};
    if (fullName !== undefined) set.fullName = String(fullName).trim();
    if (payRate !== undefined) set.payRate = Number(payRate);
    if (hours !== undefined) set.hours = Number(hours);
    if (fromDate !== undefined) set.fromDate = new Date(fromDate);
    if (toDate !== undefined) set.toDate = new Date(toDate);
    if (amount !== undefined) set.amount = Number(amount);
    if (payDate !== undefined) set.payDate = new Date(payDate);
    if (comments !== undefined) set.comments = comments;
    const updated = await Payroll.findByIdAndUpdate(
      id,
      { $set: set },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }
    res.json({ message: 'Payroll updated', data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

app.delete('/payroll/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid payroll id' });
    }
    const deleted = await Payroll.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }
    res.json({ message: 'Payroll record deleted', data: deleted });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// fetch employee pay record as employee request
app.post('/employeePayHistory', async (req, res) => {
  const { fullName } = req.body;

  try {
    // Find all pay records matching the employee's full name
    const userPays = await Payroll.find({ fullName: fullName });

    if (!userPays || userPays.length === 0) {
      return res.json([]);
    }

    res.json(userPays);
  } catch (error) {
    console.error('Error fetching user pay records:', error);
    res.status(500).send('Server error');
  }
});


// Punch request submission + public lead intake
const { PunchRequest, Lead } = require('./db/db.js');

// Route to handle change requests
app.post('/changePunchRequest', async (req, res) => {
  try {
    // Create a new punch request using the data from the request body
    const newPunchRequest = new PunchRequest(req.body);

    // Save the new punch request to the database
    await newPunchRequest.save();

    // Respond back to the frontend with a success message
    res.status(201).send({ message: 'Punch change request submitted successfully.' });
  } catch (error) {
    // Handle any errors that occur during the save operation
    res.status(400).send({ message: 'Error submitting punch change request.', error: error.message });
  }
});

/** Employee: punch correction requests for this user only (by username) */
app.post('/employeePunchRequests', async (req, res) => {
  try {
    const { username } = req.body || {};
    if (!username) {
      return res.status(400).json({ message: 'username required' });
    }
    const user = await User.findOne({ username }).lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const punchRequests = await PunchRequest.find({ fullName: user.fullName })
      .sort({ _id: -1 })
      .lean();
    res.json(punchRequests);
  } catch (error) {
    console.error('Error fetching employee punch requests:', error);
    res.status(500).json({ message: 'Error fetching punch requests' });
  }
});

// Route to fetch punch requests (?pendingOnly=1 shows only open queue)
app.get('/fetchPunchRequest', async (req, res) => {
  try {
    const pendingOnly = req.query.pendingOnly === '1' || req.query.pendingOnly === 'true';
    const query = pendingOnly
      ? {
          $or: [
            { status: 'pending' },
            { status: { $exists: false } },
          ],
        }
      : {};
    const punchRequests = await PunchRequest.find(query).sort({ _id: -1 });
    res.status(200).json(punchRequests);
  } catch (error) {
    console.error('Error fetching punch requests:', error);
    res.status(500).send('Error fetching punch requests');
  }
});

app.patch('/punchRequest/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid request id' });
    }
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved, rejected, or pending' });
    }
    const updated = await PunchRequest.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Request not found' });
    }
    res.json({ message: 'Request updated', data: updated });
  } catch (error) {
    console.error('Error updating punch request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Remove a punch change request from the queue (admin workflow)
app.delete('/punchRequest/:id', async (req, res) => {
  try {
    const deleted = await PunchRequest.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Request not found' });
    }
    res.json({ message: 'Request removed' });
  } catch (error) {
    console.error('Error deleting punch request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

function trimField(v, maxLen) {
  if (v == null) return '';
  return String(v).trim().slice(0, maxLen);
}

const LEAD_STATUS = ['new', 'contacted', 'qualified', 'closed', 'lost'];
const LEAD_TYPES = ['quote', 'proposal', 'contact'];
const NEED_CAT = ['cleaning', 'staffing', 'both', 'unsure', 'other'];

// Public: quote / proposal / contact — no auth (same host as marketing site)
app.post('/api/public/leads', async (req, res) => {
  try {
    const b = req.body || {};
    const companyName = trimField(b.companyName, 300);
    const contactName = trimField(b.contactName, 200);
    const email = trimField(b.email, 320).toLowerCase();
    if (!companyName || !contactName || !email) {
      return res.status(400).json({ error: 'Company name, contact name, and email are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    let requestType = trimField(b.requestType, 32);
    if (!LEAD_TYPES.includes(requestType)) {
      requestType = 'quote';
    }
    let needCategory = trimField(b.needCategory, 32);
    if (!NEED_CAT.includes(needCategory)) {
      needCategory = 'unsure';
    }
    const doc = new Lead({
      requestType,
      companyName,
      contactName,
      email,
      phone: trimField(b.phone, 64),
      facilityName: trimField(b.facilityName, 300),
      serviceLocation: trimField(b.serviceLocation, 500),
      serviceTypeNeeded: trimField(b.serviceTypeNeeded, 500),
      squareFootage: trimField(b.squareFootage, 120),
      needCategory,
      message: trimField(b.message, 8000),
      desiredTimeline: trimField(b.desiredTimeline, 500),
      status: 'new',
      source: trimField(b.source, 64) || 'website',
    });
    await doc.save();
    res.status(201).json({
      message: 'Thank you — your request was received.',
      id: doc._id,
    });
  } catch (error) {
    console.error('Lead submission error:', error);
    res.status(500).json({ error: 'Could not save your request. Please try again later.' });
  }
});

// Admin CRM: list lead intake (newest first)
app.get('/api/leads', async (req, res) => {
  try {
    const status = trimField(req.query.status, 32);
    const q = {};
    if (status && LEAD_STATUS.includes(status)) {
      q.status = status;
    }
    const leads = await Lead.find(q).sort({ createdAt: -1 }).lean();
    res.json(leads);
  } catch (error) {
    console.error('Fetch leads error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid lead id' });
    }
    const lead = await Lead.findById(id).lean();
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.patch('/api/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid lead id' });
    }
    const body = req.body || {};
    const updates = {};
    if (body.status !== undefined) {
      if (!LEAD_STATUS.includes(body.status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updates.status = body.status;
    }
    if (body.adminNotes !== undefined) {
      updates.adminNotes = trimField(body.adminNotes, 8000);
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update (status or adminNotes).' });
    }
    const updated = await Lead.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    ).lean();
    if (!updated) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json({ message: 'Updated', data: updated });
  } catch (error) {
    console.error('Patch lead error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Rendering home page (alternate URL)
app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'Web', 'home.html'));
});

async function seedInvoiceTemplates() {
  const n = await InvoiceTemplate.countDocuments();
  if (n > 0) return;
  await InvoiceTemplate.insertMany([
    {
      slug: 'recurring-monthly-cleaning',
      name: 'Recurring monthly cleaning',
      description: 'Contract-style monthly janitorial billing.',
      invoice_title: 'Monthly janitorial services',
      template_type: 'Recurring monthly',
      bill_to: 'Client / company name\nBilling address line 1\nCity, ST ZIP',
      service_address: 'Service site address',
      service_description:
        'Monthly janitorial and sanitation services per agreed scope of work and schedule.',
      line_items: [
        { description: 'Monthly janitorial — standard schedule', quantity: 1, unit_price: 0 },
        { description: 'Consumables & supplies allocation', quantity: 1, unit_price: 0 },
      ],
      tax_rate_percent: 0,
      notes: 'Payment due within 30 days of invoice date. Thank you for your business.',
      is_system: true,
    },
    {
      slug: 'one-time-service',
      name: 'One-time service',
      description: 'Single visit or project invoice.',
      invoice_title: 'Building services — one-time',
      template_type: 'One-time',
      bill_to: 'Client / company name\nBilling address',
      service_address: 'Job site address',
      service_description: 'Labor and materials for the service described below.',
      line_items: [
        { description: 'Labor — standard rate', quantity: 1, unit_price: 0 },
        { description: 'Materials / supplies', quantity: 1, unit_price: 0 },
      ],
      tax_rate_percent: 0,
      notes: 'Payment due on receipt unless otherwise agreed.',
      is_system: true,
    },
    {
      slug: 'emergency-service',
      name: 'Emergency / after-hours',
      description: 'Urgent response or after-hours call.',
      invoice_title: 'Emergency service call',
      template_type: 'Emergency',
      bill_to: 'Client / company name\nBilling address',
      service_address: 'Service location',
      service_description:
        'Emergency response and remediation services as performed on the date(s) listed.',
      line_items: [
        { description: 'Emergency dispatch / after-hours labor', quantity: 1, unit_price: 0 },
        { description: 'Materials used on site', quantity: 1, unit_price: 0 },
      ],
      tax_rate_percent: 0,
      notes: 'Premium rates may apply for after-hours and emergency response.',
      is_system: true,
    },
    {
      slug: 'client-site-specific',
      name: 'Client / site-specific',
      description: 'Structured for a named client and property.',
      invoice_title: 'Services — [Client name] — [Site]',
      template_type: 'Client / site',
      bill_to: '[Client legal name]\nAccounts payable\nAddress',
      service_address: '[Building or suite — full service address]',
      service_description:
        'Services performed for the above location in accordance with MG Building Services standards and any written addenda.',
      line_items: [
        { description: 'Scheduled services — this period', quantity: 1, unit_price: 0 },
      ],
      tax_rate_percent: 0,
      notes: 'Reference PO # or property ID on remittance if applicable.',
      is_system: true,
    },
  ]);
}

app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  try {
    await seedInvoiceTemplates();
  } catch (err) {
    console.error('Invoice template seed:', err);
  }
});


