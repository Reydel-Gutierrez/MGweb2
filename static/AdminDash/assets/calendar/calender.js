document.addEventListener('DOMContentLoaded', function() {
    loadCalendar();
});


function loadCalendar() {
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

let currentDate = new Date();

function loadCalendar() {
    const monthAndYear = document.getElementById('monthAndYear');
    const calendarBody = document.getElementById('calendar-body');
    const weekdayHeader = document.getElementById('weekday-header');

    calendarBody.innerHTML = '';
    weekdayHeader.innerHTML = '';

    let firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    let lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    monthAndYear.innerText = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

    weekday.forEach(day => {
        const dayCell = document.createElement('div');
        dayCell.classList.add('col');
        dayCell.innerText = day.substring(0, 3);
        weekdayHeader.appendChild(dayCell);
    });

    let date = 1;
    for (let i = 0; i < 6; i++) {
        const row = document.createElement('div');
        row.classList.add('row', 'border-bottom');
        for (let j = 0; j < 7; j++) {
            if (i === 0 && j < firstDay.getDay() || date > lastDay.getDate()) {
                const cell = document.createElement('div');
                cell.classList.add('col');
                row.appendChild(cell);
            } else {
                const cell = document.createElement('div');
                cell.classList.add('col');
                cell.innerText = date;
                if (date === currentDate.getDate() && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear()) {
                    cell.classList.add('bg-primary', 'text-white');
                }
                row.appendChild(cell);
                date++;
            }
        }
        calendarBody.appendChild(row);
        if (date > lastDay.getDate()) {
            break;
        }
    }
}

document.getElementById('previous').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    loadCalendar();
});

document.getElementById('next').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    loadCalendar();
});

window.onload = () => {
    loadCalendar();
};

let date = 1;
for (let i = 0; i < 6; i++) {
    const row = document.createElement('div');
    row.classList.add('row', 'border-bottom');
    for (let j = 0; j < 7; j++) {
        if (i === 0 && j < firstDay.getDay() || date > lastDay.getDate()) {
            const cell = document.createElement('div');
            cell.classList.add('col');
            row.appendChild(cell);
        } else {
            const cell = document.createElement('div');
            cell.classList.add('col');
            cell.innerText = date;

            // Custom logic for setting background colors
            if (date >= 9 && date <= 23) {
                cell.classList.add('bg-green');
            } else if (date >= 24 || date <= 8) {
                cell.classList.add('bg-red');
            }

            if (date === currentDate.getDate() && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear()) {
                cell.classList.add('bg-primary', 'text-white');
            } else {
                cell.classList.remove('bg-primary', 'text-white');
            }

            row.appendChild(cell);
            date++;
        }
    }
    calendarBody.appendChild(row);
    if (date > lastDay.getDate()) {
        break;
    }
}
}
