
function fetchAndPopulatePunchHistory(username) {
    const punchTableBody = document.getElementById('punchTableBody');

    fetch('/employeePunchHistory', {
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
