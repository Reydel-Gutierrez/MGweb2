document.addEventListener('DOMContentLoaded', function () {
    // Function to fetch data from the server
    function fetchDataFromServer() {
      return fetch('/users') // Update the API endpoint
        .then(response => response.json())
        .then(data => data);
    }
  
    // Function to update the Employee table with fetched data
    function updateTable(data) {
      const tableBody = document.querySelector('.user-table tbody');
      const totalEmployeesCount = document.getElementById('totalEmployeesCount');
  
      // Clear existing rows
      tableBody.innerHTML = '';
  
      // Iterate through the data and create rows
      data.forEach(user => {
        const row = document.createElement('tr');
            
            // Create cells for each column in the table
            const fullNameCell = document.createElement('td');
            const idCell = document.createElement('td');
            const emailCell = document.createElement('td');
            const usernameCell = document.createElement('td');
            const passwordCell = document.createElement('td');
            const rateCell = document.createElement('td');
            const userTypeCell = document.createElement('td');

            // Set content for each cell
            fullNameCell.innerHTML = `<div class="d-flex px-2 py-1">
                                          <div><i alt="${user.fullName}"> </i></div>
                                          <div class="d-flex flex-column justify-content-center me-3">
                                              <h6 class="mb-0 text-sm">${user.fullName}</h6>
                                              <p class="text-xs text-secondary mb-0">${user.email}</p>
                                          </div>
                                      </div>`;

            idCell.textContent = user.idNumber;
            emailCell.textContent = user.email;
            usernameCell.textContent = user.username;
            passwordCell.textContent = user.password;
            rateCell.textContent = user.payRate;
            userTypeCell.textContent = user.admin ? 'Admin' : 'Employee';

            // Append cells to the row
            row.appendChild(fullNameCell);
            row.appendChild(idCell);
            row.appendChild(emailCell);
            row.appendChild(usernameCell);
            row.appendChild(passwordCell);
            row.appendChild(rateCell);
            row.appendChild(userTypeCell);

            // Append the row to the table body
            tableBody.appendChild(row);
        });

        totalEmployeesCount.textContent = data.length;
    }

    // Fetch data and update the table when the page loads
    fetchDataFromServer()
        .then(data => {
            updateTable(data);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
});

// delete employee
async function deleteEmployee() {
    const employeeID = document.getElementById('employeeIDToDelete').value;

    try {
      // Use fetch to send the data to the server
      const response = await fetch('/deleteEmployee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employeeID }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(data);
        alert('Employee deleted successfully!');
        // Optionally, you can reset the form or close it after successful deletion
        // document.getElementById('deleteEmployeeForm').reset();
        handleDeleteEmployee(); // Close the form
      } else {
        console.error('Error deleting employee:', response.statusText);
        alert('Error deleting employee. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Error deleting employee. Please try again.');
    }
  }



// Submit new Invoice
document.addEventListener('DOMContentLoaded', () => {
    const submitNewInvoiceBtn = document.getElementById('submitNewInvoice');
  
    submitNewInvoiceBtn.addEventListener('click', async (event) => {
      event.preventDefault();
  
      const date = document.getElementById('invoiceDate').value;
      const invoiceTitle = document.getElementById('invoiceTitle').value;
      const invoiceNumber = document.getElementById('invoiceNumber').value;
      const invoiceAmount = document.getElementById('invoiceAmount').value;
      const invoiceStatus = document.getElementById('invoiceStatus').value;
  
      // Validate form fields
      if (!date || !invoiceTitle || !invoiceNumber || !invoiceAmount || !invoiceStatus) {
        alert('Please fill in all required fields.');
        return;
      }
  
      // Create an object to hold the form data
      const formData = {
        date,
        invoice_title: invoiceTitle, // Use invoice_title here
        invoice_number: invoiceNumber, // Add other keys if needed
        amount: invoiceAmount,
        status: invoiceStatus,
      };
  
      console.log(formData);
  
      try {
        // Use fetch to send the data to the server
        const response = await fetch('/submitInvoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
  
        if (response.ok) {
          const data = await response.json();
          console.log(data);
          alert('Invoice submitted successfully!');
          // Optionally, you can reset the form or close it after successful submission
          // document.getElementById('addNewInvoiceForm').reset();
        } else {
          console.error('Error submitting invoice:', response.statusText);
          alert('Error submitting invoice. Please try again.');
        }
      } catch (error) {
        console.error('Error submitting invoice:', error);
        alert('Error submitting invoice. Please try again.');
      }
    });
  });


  //load table Invoices

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      // Fetch data from the server
      const response = await fetch('/fetchInvoices');
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }
  
      // Parse the response JSON
      const invoices = await response.json();
  
      // Get the table body element
      const tableBody = document.querySelector('#invoicesTable tbody');
  
      // Format date and count pending invoices
      let pendingCount = 0;
  
      invoices.forEach((invoice) => {
        // Format the date using toLocaleDateString
        const formattedDate = new Date(invoice.date).toLocaleDateString('en-US', {
          month: 'numeric',
          day: 'numeric',
          year: 'numeric',
        });
  
        // Check if the invoice is pending
        const isPending = invoice.status === 'Unpaid';
  
        // Increment pending count if the invoice is pending
        if (isPending) {
          pendingCount++;
        }
  
        // Iterate over invoices and populate the table
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${formattedDate}</td>
          <td>${invoice.invoice_title}</td>
          <td>${invoice.invoice_number}</td>
          <td>$${invoice.amount}</td>
          <td>
            <span class="badge badge-sm bg-gradient-${isPending ? 'secondary' : 'success'}">${invoice.status}</span>
          </td>
        `;
        tableBody.appendChild(row);
      });
  
      // Display total pending count
      const totalPendingElement = document.getElementById('totalPending');
      totalPendingElement.textContent = `${pendingCount}`;
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  });
  


//delete invoice

async function deleteInvoice() {
    const invoiceNumberToRemove = document.getElementById('invoiceNumberToRemove').value;

    // Validate invoice number
    if (!invoiceNumberToRemove) {
      alert('Please enter the invoice number.');
      return;
    }

    try {
      // Use fetch to send the data to the server
      const response = await fetch(`/deleteInvoice/${invoiceNumberToRemove}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Invoice deleted successfully!');
        // Optionally, you can update the table or perform other actions after deletion
      } else {
        console.error('Error deleting invoice:', response.statusText);
        alert('Error deleting invoice. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Error deleting invoice. Please try again.');
    }
  }


  //update invoice
  async function updateInvoiceStatus() {
    try {
      const invoiceNumber = document.getElementById('invoiceNumberToUpdate').value;
      const invoiceStatus = document.getElementById('invoiceStatusToUpdate').value;

      // Validate form fields
      if (!invoiceNumber) {
        alert('Please enter the Invoice Number.');
        return;
      }

      // Use fetch to send the data to the server
      const response = await fetch(`/updateInvoiceStatus/${invoiceNumber}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoiceStatus }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(data);
        alert('Invoice status updated successfully!');
        // Optionally, you can update the table or perform other actions after successful status update
      } else {
        console.error('Error updating invoice status:', response.statusText);
        alert('Error updating invoice status. Please try again.');
      }
    } catch (error) {
      console.error('Error updating invoice status:', error);
      alert('Error updating invoice status. Please try again.');
    }
  }



  // add task
  async function addTask() {
    const taskTitle = document.getElementById('taskTitle').value;
    const taskDate = document.getElementById('taskDate').value;

    // Validate input
    if (!taskTitle || !taskDate) {
      alert('Please fill in all required fields.');
      return;
    }

    const formData = {
      taskTitle,
      taskDate,
    };

    try {
      // Use fetch to send the data to the server
      const response = await fetch('/addTask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        alert('Task added successfully');
        console.log(data);  // Log the response from the server (if needed)

        // Optionally, you can update the table or perform other actions on successful response
        // For example, you can fetch updated tasks and refresh the table

      } else {
        console.error('Error adding task:', response.statusText);
        alert('Error adding task. Please try again.');
      }
    } catch (error) {
      console.error('Error adding task:', error);
      alert('Error adding task. Please try again.');
    }
  }


  //pupulate task table
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      // Fetch tasks from the server
      const response = await fetch('/fetchTasks');
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
  
      // Parse the response JSON
      const tasks = await response.json();
  
      // Get the table body element
      const tableBody = document.querySelector('#tasksTable tbody');
      const taskCountElement = document.querySelector('#taskCount');

      // Display the task count
      taskCountElement.textContent = `${tasks.length}`;
  
      // Iterate over tasks and populate the table
      tasks.forEach((task) => {
        // Format the date using toLocaleDateString
        const formattedDate = new Date(task.date).toLocaleDateString('en-US', {
          month: 'numeric',
          day: 'numeric',
          year: 'numeric',
        });
  
        // Create a table row
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${task.id}</td>
          <td>${task.title}</td>
          <td>${formattedDate}</td>
        `;
  
        // Append the row to the table body
        tableBody.appendChild(row);
      });
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  });


  //delete task
  async function deleteTask() {
    const taskId = document.getElementById('taskIdToDelete').value;

    try {
      const response = await fetch('/deleteTask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(data);
        alert('Task deleted successfully!');
        // You might want to update the UI or reload the task list after deletion
      } else {
        console.error('Error deleting task:', response.statusText);
        alert('Error deleting task. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Error deleting task. Please try again.');
    }
  }