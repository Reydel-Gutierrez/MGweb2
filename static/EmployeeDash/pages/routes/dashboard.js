document.addEventListener('DOMContentLoaded', function() {
  const clockInButton = document.querySelector('a.btn-info');
  const clockOutButton = document.querySelector('a.btn-secondary');
  
  function handleClocking(event) {
    event.preventDefault();
    
    const storedUserInfo = JSON.parse(localStorage.getItem("userInfo")) || {};

    if (!storedUserInfo.store_username || !storedUserInfo.store_name) {
      console.error('Username or fullname is missing from stored user info.');
      return;
    }

    const dateTimeElement = document.getElementById('datetime');
    const date = dateTimeElement.querySelector('.card-title').textContent;
    const time = dateTimeElement.querySelector('.card-text').textContent;
    const action = event.target.textContent.includes('In') ? 'Clock In' : 'Clock Out';

    const payload = {
      username: storedUserInfo.store_username,
      fullname: storedUserInfo.store_name,
      date: date,
      time: time,
      action: action
    };
    
    fetch('/employeePunching', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    .then(response => {
      if (!response.ok) {
        // Since the response was not OK, throw an error with the response status to handle it in the catch block
        throw response;
      }
      return response.json();
    })
    .then(data => {
      // Assuming the server sends back updated punch data
      const latestPunch = data.data.punches[0];
      const punchInfoElement = document.getElementById('latestPunch');
      
      if (latestPunch) {
        punchInfoElement.textContent = `You ${latestPunch.action.toLowerCase()} on ${latestPunch.date} at ${latestPunch.time}`;
      } else {
        punchInfoElement.textContent = "No punches recorded yet.";
      }
    })
    .catch(errorResponse => {
      // Handle specific errors based on the action attempted
      errorResponse.json().then(error => {
        const punchInfoElement = document.getElementById('latestPunch');
        if (action === 'Clock In') {
          punchInfoElement.textContent = "It appears you are already clocked in, Please clock Out.";
        } else if (action === 'Clock Out') {
          punchInfoElement.textContent = "Please Clock In before attempting to Clock Out.";
        } else {
          punchInfoElement.textContent = "Failed to process punch action";
        }
      }).catch(() => {
        // Handle any other errors or if the error response couldn't be parsed
        document.getElementById('latestPunch').textContent = "Failed to process punch action. Make sure you Punch In or Out accordingly";
      });
    });
  }

  clockInButton.addEventListener('click', handleClocking);
  clockOutButton.addEventListener('click', handleClocking);
});
