document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('.form-inline');
    const usernameInput = document.getElementById('usernameInput');
    const punchTableBody = document.getElementById('punchTableBody');

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = usernameInput.value.trim();

        if (username) {
            fetch('/employeePunchHistory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: username }),
            })
            .then(response => response.json())
            .then(data => {
                if (data && data.punches) {
                    const first40Punches = data.punches.slice(0, 40);
                    populateTable(data.fullname, first40Punches);
                } else {
                    console.error('Punch data is missing');
                }
            })
            .catch(error => console.error('There has been a problem with your fetch operation:', error));
        }
    });

    function populateTable(fullname, punches) {
        punchTableBody.innerHTML = ''; // Clear the table body first
        let startingIndex = 0;
    
        if(punches[0].action == "Clock In"){
            const row = document.createElement('tr');
            addCell(row, fullname);
            addCell(row, punches[0].date);
            addCell(row, punches[0].time);
            addCell(row, 'N/A');
            addCell(row, 'N/A');
            addCell(row, '___');
            punchTableBody.appendChild(row);
            const userPunchedInField = document.getElementById('userPunchedIn');
            userPunchedInField.textContent = `${fullname} remains clocked in.`;
            userPunchedInField.style.padding = '10px';
    
            startingIndex++;
        }
    
        for (let i = startingIndex ; i < punches.length; i += 2) {
    
    
            const punchIn = punches[i + 1];
            const punchOut = punches[i];
            
            if (punchIn && punchOut && punchIn.action === "Clock In" && punchOut.action === "Clock Out") {
                const row = document.createElement('tr');
                addCell(row, fullname);
                addCell(row, punchIn.date);
                addCell(row, punchIn.time);
                addCell(row, punchOut.time);
                const hoursWorked = calculateHours(punchIn.time, punchOut.time);
                addCell(row, hoursWorked.toFixed(2) + ' hours');
                addCell(row, ''); // Placeholder for comments
                punchTableBody.appendChild(row);
            }
        }
    }

    function addCell(row, text) {
        const cell = document.createElement('td');
        cell.textContent = text;
        row.appendChild(cell);
    }

    function calculateHours(timeIn, timeOut) {
        const [hoursIn, minutesIn] = timeIn.split(':').map(parseFloat);
        const [hoursOut, minutesOut] = timeOut.split(':').map(parseFloat);
        const dateIn = new Date(0, 0, 0, hoursIn, minutesIn);
        const dateOut = new Date(0, 0, 0, hoursOut, minutesOut);
        const diff = dateOut - dateIn;
        const hours = diff / 1000 / 60 / 60; // Convert milliseconds to hours
        return hours;
    }
});


// fetch function but using cutom amount of rows
let currentPage = 0;
let rowsPerPage = 20;

function fetchAndPopulatePunchHistory(username, userRowsPerPage) {
    if(userRowsPerPage){
        rowsPerPage = userRowsPerPage;
    };

    fetch('/employeePunchHistory', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username }),
    })
    .then(response => response.json())
    .then(data => {
        if (data && data.punches) {
            // Calculate total pages
            const totalPages = Math.ceil(data.punches.length / (rowsPerPage * 2));
            populateTable(data.fullname, data.punches.slice(currentPage * rowsPerPage * 2, (currentPage + 1) * rowsPerPage * 2));

            // Update button visibility
        
        } else {
            console.error('Punch data is missing');
        }
    })
    .catch(error => console.error('There has been a problem with your fetch operation:', error));
}

function populateTable(fullname, punches) {
    punchTableBody.innerHTML = ''; // Clear the table body first

    for (let i = 0; i < punches.length; i += 2) {
        const punchIn = punches[i + 1];
        const punchOut = punches[i];
        if (punchIn && punchOut && punchIn.action === "Clock In" && punchOut.action === "Clock Out") {
            const row = document.createElement('tr');
            addCell(row, fullname);
            addCell(row, punchIn.date);
            addCell(row, punchIn.time);
            addCell(row, punchOut.time);
            const hoursWorked = calculateHours(punchIn.time, punchOut.time);
            addCell(row, hoursWorked.toFixed(2) + ' hours');
            addCell(row, ''); // Placeholder for comments
            punchTableBody.appendChild(row);
        }
    }
}

function addCell(row, text) {
    const cell = document.createElement('td');
    cell.textContent = text;
    row.appendChild(cell);
}

function calculateHours(timeIn, timeOut) {
    const [hoursIn, minutesIn] = timeIn.split(':').map(parseFloat);
    const [hoursOut, minutesOut] = timeOut.split(':').map(parseFloat);
    const dateIn = new Date(0, 0, 0, hoursIn, minutesIn);
    const dateOut = new Date(0, 0, 0, hoursOut, minutesOut);
    const diff = dateOut - dateIn;
    const hours = diff / 1000 / 60 / 60; // Convert milliseconds to hours
    return hours;
}
// end of fetch function but using cutom amount of rows




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
            const response = await fetch('/employeeRegisterPay', {
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

        // Helper function to format dates and times
        const formatDate = (dateString) => {
            if (!dateString) return 'N/A'; // Check for null or undefined
            const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
            return new Intl.DateTimeFormat('en-US', options).format(new Date(dateString));
        };

        const formatTime = (dateString) => {
            if (!dateString) return 'N/A'; // Check for null or undefined
            const options = { hour: 'numeric', minute: '2-digit', hour12: true };
            return new Intl.DateTimeFormat('en-US', options).format(new Date(dateString));
        };

        const checkValue = (value) => value ? value : 'N/A'; // Function to check value

        // Iterate over each punch request and add rows to the table body
        data.forEach((request, index) => {
            const row = `<tr>
                <th scope="row">${index + 1}</th>
                <td>${checkValue(request.fullName)}</td>
                <td>${formatDate(request.originalDate)}</td>
                <td>${request.originalAction === 1 ? 'Punch In' : request.originalAction === 0 ? 'Punch Out' : 'N/A'}</td>
                <td>${formatTime(request.originalTime)}</td>
                <td>${formatDate(request.newDate)}</td>
                <td>${request.newAction === 1 ? 'Punch In' : request.newAction === 0 ? 'Punch Out' : 'N/A'}</td>
                <td>${formatTime(request.newTime)}</td>
                <td>${checkValue(request.newComments)}</td>
            </tr>`;
            tableBody.innerHTML += row;
        });
    })
    .catch(error => {
        console.error('Error fetching punch requests:', error);
    });
});



