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
    
    // calc current time
    // Create a new Date object to get the current time
    const currentTime = new Date();
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();

    // Format the hours and minutes to ensure they are in 24-hour format and two digits
    const formattedHours = hours < 10 ? `0${hours}` : hours;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;

    // Construct the time string in 24-hour format
    const time = `${formattedHours}:${formattedMinutes}`;


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
        punchInfoElement.style.color = "green"; // Green text on success
      } else {
        punchInfoElement.textContent = "No punches recorded yet.";
      }
    })
    .catch(errorResponse => {
      // Handle specific errors based on the action attempted
      errorResponse.json().then(error => {
        const punchInfoElement = document.getElementById('latestPunch');
        if (action === 'Clock In') {
          alert("Ops, Please Clock Out first.");
          punchInfoElement.style.color = "#ff5b00";
          punchInfoElement.textContent = "It appears you are already Clocked in, Please Clock Out.";
          
          
        } else if (action === 'Clock Out') {
          alert("Ops, Please Clock In before Clock Out.");
          punchInfoElement.textContent = "Please Clock In before attempting to Clock Out.";
          punchInfoElement.style.color = "#ff5b00";
        } else {
          punchInfoElement.textContent = "Failed to process punch action";
          punchInfoElement.style.color = "red";
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
