document.addEventListener('DOMContentLoaded', function () {
    const loginButton = document.querySelector('#loginButton');
  
    loginButton.addEventListener('click', async function () {
      const username = document.querySelector('#usernameField').value;
      const password = document.querySelector('#passwordField').value;
  
      try {
        const response = await fetch('/login', {
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
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('mgPortal', 'admin');
          localStorage.setItem(
            'userInfo',
            JSON.stringify({
              store_username: data.username,
              store_name: data.name || '',
            })
          );
          window.location.href =
            '/AdminDash/pages/dashboard.html?username=' +
            encodeURIComponent(data.username) +
            '&name=' +
            encodeURIComponent(data.name);
        } else {
          // Login failed
          
          console.error(data.message);
          alert(data.message);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    });
  });



