/**
 * Time & punches — lookup punch history for an employee by username.
 */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function calculateHours(timeIn, timeOut) {
    var partsIn = timeIn.split(':').map(parseFloat);
    var partsOut = timeOut.split(':').map(parseFloat);
    var dateIn = new Date(0, 0, 0, partsIn[0], partsIn[1] || 0);
    var dateOut = new Date(0, 0, 0, partsOut[0], partsOut[1] || 0);
    return (dateOut - dateIn) / 1000 / 60 / 60;
  }

  function addCell(row, text) {
    var cell = document.createElement('td');
    cell.textContent = text;
    row.appendChild(cell);
  }

  function populateTable(fullname, punches) {
    var punchTableBody = $('punchTableBody');
    var note = $('userPunchedIn');
    if (!punchTableBody) return;
    punchTableBody.innerHTML = '';
    if (note) {
      note.textContent = '';
      note.style.padding = '';
    }

    if (!punches || !punches.length) {
      punchTableBody.innerHTML =
        '<tr><td colspan="6" class="mg-empty-state">No punches on file for this user.</td></tr>';
      return;
    }

    var startingIndex = 0;
    if (punches[0].action === 'Clock In') {
      var row = document.createElement('tr');
      addCell(row, fullname || '');
      addCell(row, punches[0].date);
      addCell(row, punches[0].time);
      addCell(row, '—');
      addCell(row, '—');
      addCell(row, 'Open');
      punchTableBody.appendChild(row);
      if (note) {
        note.textContent = (fullname || 'Employee') + ' is still clocked in from this punch.';
        note.style.padding = '10px';
      }
      startingIndex = 1;
    }

    for (var i = startingIndex; i < punches.length; i += 2) {
      var punchIn = punches[i + 1];
      var punchOut = punches[i];
      if (
        punchIn &&
        punchOut &&
        punchIn.action === 'Clock In' &&
        punchOut.action === 'Clock Out'
      ) {
        var row2 = document.createElement('tr');
        addCell(row2, fullname || '');
        addCell(row2, punchIn.date);
        addCell(row2, punchIn.time);
        addCell(row2, punchOut.time);
        addCell(row2, calculateHours(punchIn.time, punchOut.time).toFixed(2) + ' h');
        addCell(row2, '');
        punchTableBody.appendChild(row2);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.querySelector('#mg-punch-search-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var usernameInput = $('usernameInput');
      var username = usernameInput && usernameInput.value.trim();
      if (!username) return;
      fetch('/employeePunchHistory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username })
      })
        .then(function (r) {
          if (r.status === 404) {
            populateTable('', []);
            return null;
          }
          return r.json().catch(function () {
            return null;
          });
        })
        .then(function (data) {
          if (!data) return;
          if (data.punches) {
            var lim = $('mg-punch-limit')
              ? parseInt($('mg-punch-limit').value, 10) || 40
              : 40;
            var slice = data.punches.slice(0, lim);
            populateTable(data.fullname, slice);
          } else {
            populateTable('', []);
          }
        })
        .catch(function (err) {
          console.error(err);
        });
    });
  });
})();
