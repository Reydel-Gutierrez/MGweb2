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


