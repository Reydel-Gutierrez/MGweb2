document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('.form-inline');
    const usernameInput = document.getElementById('usernameInput');
    const punchTableBody = document.getElementById('punchTableBody');

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = usernameInput.value.trim();

        if (username) {
            fetch('http://localhost:3000/employeePunchHistory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: username }),
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data && data.punches) {
                    populateTable(data.fullname, data.punches);
                } else {
                    console.error('Punch data is missing');
                }
            })
            .catch(error => console.error('There has been a problem with your fetch operation:', error));
        }
    });

    function populateTable(fullname, punches) {
        punchTableBody.innerHTML = ''; // Clear the table body first
    
        let tempPunchIn = null;
    
        punches.forEach((punch, index) => {
            if (punch.action === 'Clock In') {
                if (tempPunchIn) {
                    // Previous Clock In without Clock Out, add as unmatched
                    addUnmatchedRow(tempPunchIn, fullname, 'In');
                }
                tempPunchIn = punch; // Store the current Clock In
            } else if (punch.action === 'Clock Out') {
                if (tempPunchIn) {
                    // Calculate time difference for matched In and Out
                    addMatchedRow(tempPunchIn, punch, fullname);
                    tempPunchIn = null; // Reset after matching
                } else {
                    // Clock Out without a preceding Clock In, add as unmatched
                    addUnmatchedRow(punch, fullname, 'Out');
                }
            }
    
            // After the last punch, check for an unmatched Clock In
            if (index === punches.length - 1 && tempPunchIn) {
                addUnmatchedRow(tempPunchIn, fullname, 'In');
            }
        });
    }
    
    function addCell(row, text) {
        const cell = document.createElement('td');
        cell.textContent = text;
        row.appendChild(cell);
    }
    
    function addMatchedRow(punchIn, punchOut, fullname) {
        const row = document.createElement('tr');
        const diffHours = calculateHours(punchIn, punchOut);
        [fullname, punchIn.date, punchIn.time, punchOut.time, `${diffHours.toFixed(2)} hours`, ''].forEach(text => addCell(row, text));
        punchTableBody.appendChild(row);
    }
    
    function addUnmatchedRow(punch, fullname, type) {
        const row = document.createElement('tr');
        const cells = type === 'In' ? [fullname, punch.date, punch.time, '---', '---', ''] : [fullname, punch.date, '---', punch.time, '---', ''];
        cells.forEach(text => addCell(row, text));
        punchTableBody.appendChild(row);
    }
    
    function calculateHours(punchIn, punchOut) {
        const inTime = new Date(punchIn.date + ' ' + punchIn.time);
        const outTime = new Date(punchOut.date + ' ' + punchOut.time);
        return (outTime - inTime) / (1000 * 60 * 60); // Convert milliseconds to hours
    }
});




// Employee Payroll submit form route
document.addEventListener('DOMContentLoaded', () => {
    const submitPayrollBtn = document.getElementById('submitPayroll');

    submitPayrollBtn.addEventListener('click', async (event) => {
        event.preventDefault();

        // Collect payroll data from form
        const fullName = document.getElementById('fullName').value;
        const payRate = document.getElementById('payRate').value;
        const hours = document.getElementById('hours').value;
        const fromDate = document.getElementById('fromDate').value;
        const toDate = document.getElementById('toDate').value;
        const amount = document.getElementById('amount').value;
        const payDate = document.getElementById('payDate').value;
        const comments = document.getElementById('comments').value;

        // Validate form fields
        if (!fullName || !payRate || !hours || !fromDate || !toDate || !amount || !payDate) {
            alert('Please fill in all required fields.');
            return;
        }

        // Create an object to hold the form data
        const formData = {
            fullName,
            payRate,
            hours,
            fromDate,
            toDate,
            amount,
            payDate,
            comments, // Assuming comments are optional
        };

        console.log(formData);

        try {
            // Use fetch to send the data to the server
            const response = await fetch('http://localhost:3000/employeeRegisterPay', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                const data = await response.json();
                console.log(data);
                alert('Payroll submitted successfully!');
                // Optionally, reset the form or take other actions after successful submission
                // document.getElementById('payrollForm').reset();
            } else {
                console.error('Error submitting payroll:', response.statusText);
                alert('Error submitting payroll. Please try again.');
            }
        } catch (error) {
            console.error('Error submitting payroll:', error);
            alert('Error submitting payroll. Please try again.');
        }
    });
});



//  pupulate payroll records table
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Fetch payroll records from the server
        const response = await fetch('/fetchPayrollRecords');
        if (!response.ok) {
            throw new Error('Failed to fetch payroll records');
        }

        // Parse the response JSON
        const payrollRecords = await response.json();

        // Get the table body element where payroll records will be populated
        const tableBody = document.getElementById('payrollRecordsTable');

        // Iterate over payroll records and populate the table
        payrollRecords.forEach((record) => {
            // Format the From Date and To Date using toLocaleDateString
            const formattedFromDate = new Date(record.fromDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
            const formattedToDate = new Date(record.toDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });

            // Create a table row
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">${record.fullName}</td>
                <td class="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">${record.payRate}</td>
                <td class="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">${record.hours}</td>
                <td class="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">${formattedFromDate}</td>
                <td class="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">${formattedToDate}</td>
                <td class="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">${record.amount}</td>
                <td class="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">${record.comments || ''}</td>
            `;

            // Append the row to the table body
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error fetching payroll records:', error);
    }
});




// fetch employee punch change request
document.addEventListener('DOMContentLoaded', function () {
    fetch('/fetchPunchRequest')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        const tableBody = document.getElementById('punchRequestTableBody');
        const requestCountTitle = document.getElementById('requestCountTitle');
        
        // Update the title with the total number of requests
        requestCountTitle.textContent = `${data.length} Punch Requests to be Reviewed`;

        // Clear existing table rows
        tableBody.innerHTML = '';

        // Iterate over each punch request and add rows to the table body
        data.forEach((request, index) => {
            const row = `<tr>
                <th scope="row">${index + 1}</th>
                <td>${request.fullName}</td>
                <td>${request.originalDate}</td>
                <td>${request.originalAction}</td>
                <td>${request.originalTime}</td>
                <td>${request.newDate}</td>
                <td>${request.newAction}</td>
                <td>${request.newTime}</td>
                <td>${request.newComments}</td>
            </tr>`;
            tableBody.innerHTML += row;
        });
    })
    .catch(error => {
        console.error('Error fetching punch requests:', error);
        // Optionally, implement error handling, e.g., show an error message on the UI
    });
});


