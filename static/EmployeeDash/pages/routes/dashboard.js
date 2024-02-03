// Event listeners for Clock In and Clock Out buttons
document.addEventListener('DOMContentLoaded', function() {
  const clockInButton = document.querySelector('a.btn-info');
  const clockOutButton = document.querySelector('a.btn-secondary');
  
  // Function to handle clocking in or out
  function handleClocking(event) {
    event.preventDefault();
    
    // Retrieve stored user information
    const storedUserInfo = JSON.parse(localStorage.getItem("userInfo")) || {};

    // Check if store_username and store_name exist in the storedUserInfo
    if (!storedUserInfo.store_username || !storedUserInfo.store_name) {
      console.error('Username or fullname is missing from stored user info.');
      return; // Exit the function if we don't have necessary user info
    }

    // Get current date and time from the DOM
    const dateTimeElement = document.getElementById('datetime');
    const date = dateTimeElement.querySelector('.card-title').textContent;
    const time = dateTimeElement.querySelector('.card-text').textContent;

    // Prepare the data payload
    const payload = {
      username: storedUserInfo.store_username,
      fullname: storedUserInfo.store_name,
      date: date,
      time: time,
      action: event.target.textContent.includes('In') ? 'Clock In' : 'Clock Out'
    };
    
    // Log payload for verification
    console.log(payload);

        // Send the payload to the backend
        fetch('/employeePunching', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        .then(response => response.json())
        .then(data => {
          console.log('Success:', data);
          
          // Assuming the server response includes the latest punch in the format:
          // { message: 'Punch data processed successfully', data: { ...userPunchData } }
          // And assuming the punches array in the userPunchData is sorted chronologically
          
          const latestPunch = data.data.punches[data.data.punches.length - 1]; // Get the last punch
          const punchInfoElement = document.getElementById('latestPunch');
          
          if (latestPunch) {
            punchInfoElement.textContent = `You ${latestPunch.action.toLowerCase()} at ${latestPunch.time}`;
          }
        })
        .catch((error) => {
          console.error('Error:', error);
          // Optionally handle errors, e.g., by displaying a message to the user
        });
    
    // TODO: Send 'payload' to the backend using AJAX/Fetch API
  }

  // Attach event listeners
  clockInButton.addEventListener('click', handleClocking);
  clockOutButton.addEventListener('click', handleClocking);
});




