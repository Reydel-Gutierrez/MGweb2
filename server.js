const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
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
      if (user && user.password === password && user.admin) {
        res.json({ message: 'Login successful', username: user.username, name: user.fullName });

      } else if (user && user.password === password){
        res.status(401).json({ message: 'This user is no an Admin' });
      } else {
        res.status(401).json({ message: 'Invalid credentials' });
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
      if (user && user.password === password) {
        res.json({ message: 'Login successful', username: user.username, name: user.fullName });
      }  else {
        res.status(401).json({ message: 'Invalid credentials' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

// New route to fetch user data for the table
app.get('/users', async (req, res) => {
  try {
    // Fetch all users from the database, excluding sensitive fields
    const users = await User.find({}, { __v: 0 });

    res.json(users);
  } catch (error) {
    console.error(error);
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

const { Invoice } = require('./db/db.js');

// POST route to create a new invoice

// POST route to create a new invoice
app.post('/submitInvoice', async (req, res) => {
  try {
    // Handle form fields
    const { date, invoice_title, invoice_number, amount, status } = req.body;

    // Create a new invoice instance
    const newInvoice = new Invoice({
      date,
      invoice_title,
      invoice_number,
      amount,
      status,
    });

    // Save the new invoice to the database
    await newInvoice.save();

    res.status(201).json({ message: 'Invoice created successfully', data: newInvoice });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


//load invoices table
app.get('/fetchInvoices', async (req, res) => {
  try {
    // Fetch all invoices from the database
    const invoices = await Invoice.find({}, { _id: 0, __v: 0 }).lean();

    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ message: 'Internal Server Error' });
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


const { Task } = require('./db/db.js');

// Define your route to add a new task
app.post('/addTask', async (req, res) => {
  try {
    // Handle form fields
    const { taskTitle, taskDate } = req.body;

    const taskCount = await Task.countDocuments();

    // Create a new task instance
    const newTask = new Task({
      id: taskCount + 1,
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

// Delete task endpoint
app.post('/deleteTask', async (req, res) => {
  try {
    const { taskId } = req.body;

    // Find and delete the task by custom ID
    const deletedTask = await Task.findOneAndDelete({ id: taskId });
    
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

// fetch employee pay record as employee request
app.post('/employeePayHistory', async (req, res) => {
  const { fullName } = req.body;

  try {
    // Find all pay records matching the employee's full name
    const userPays = await Payroll.find({ fullName: fullName });

    if (!userPays || userPays.length === 0) {
      return res.status(404).send('User not found');
    }

    // Send back all matching pay records
    res.json(userPays);
  } catch (error) {
    console.error('Error fetching user pay records:', error);
    res.status(500).send('Server error');
  }
});


//Punch request submission route
const { PunchRequest } = require('./db/db.js');

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

// Route to fetch punch requests
app.get('/fetchPunchRequest', async (req, res) => {
  try {
    const punchRequests = await PunchRequest.find(); // Fetch all punch requests
    res.status(200).json(punchRequests); // Send punch requests as JSON
  } catch (error) {
    console.error('Error fetching punch requests:', error);
    res.status(500).send('Error fetching punch requests');
  }
});

  //rendering home page
  app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'Web', 'home.html'));
  });

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});


