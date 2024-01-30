document.addEventListener('DOMContentLoaded', function () {
    const loginButton = document.querySelector('#loginButton');
  
    loginButton.addEventListener('click', async function () {
      const username = document.querySelector('#usernameField').value;
      const password = document.querySelector('#passwordField').value;
  
      try {
        const response = await fetch('http://localhost:3000/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: username,
            password: password,
          }),
        });
  
        const data = await response.json();
  
        if (response.ok) {
          // Login successful
          
          localStorage.setItem('isLoggedIn', 'true');
        //   window.location.href = 'http://localhost:3000/AdminDash/pages/dashboard.html';
          window.location.href = `http://localhost:3000/AdminDash/pages/dashboard.html?username=${data.username}&name=${data.name}`;
        } else {
          // Login failed
          alert("Invalid Credentials");
          console.error(data.message);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    });
  });



