alert('JavaScript file is loaded!');

document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('.form-inline');
    const usernameInput = document.getElementById('usernameInput');
    const punchTableBody = document.getElementById('punchTableBody');

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = usernameInput.value.trim();
        console.log('Username:', username); // Debugging line to ensure we capture the username

        if (username) {
            fetch('http://mgbuildingservice:3000/employeePunchHistory', {
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
                console.log(data); // For debugging
                populateTable(data.punches);
            })
            .catch(error => console.error('There has been a problem with your fetch operation:', error));
        }
    });

    function populateTable(punches) {
        punchTableBody.innerHTML = ''; // Clear the table body first

        punches.forEach(punch => {
            const row = document.createElement('tr');
            const fullNameCell = document.createElement('td');
            fullNameCell.textContent = punch.fullname; // Assuming fullname is part of the punch object
            row.appendChild(fullNameCell);

            const dateCell = document.createElement('td');
            dateCell.textContent = punch.date; // Assuming date is part of the punch object
            row.appendChild(dateCell);

            const punchInCell = document.createElement('td');
            punchInCell.textContent = punch.action === 'Clock In' ? punch.time : '';
            row.appendChild(punchInCell);

            const punchOutCell = document.createElement('td');
            punchOutCell.textContent = punch.action === 'Clock Out' ? punch.time : '';
            row.appendChild(punchOutCell);

            const commentsCell = document.createElement('td');
            commentsCell.textContent = punch.comments || ''; // Assuming comments are part of the punch object
            row.appendChild(commentsCell);

            punchTableBody.appendChild(row);
        });
    }
});