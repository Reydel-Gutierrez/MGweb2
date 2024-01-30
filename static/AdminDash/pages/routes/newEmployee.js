// newEmployee.js

// Function to display admin privileges alert
function showAdminPrivileges() {
    alert("Admin Privileges are system-level permissions that allow users to access and manage users as well as different product areas.");
 }
 
 // Attach the function to the link click event
 
 function submitForm() {
    const formData = {
        fullName: document.getElementById('fullName').value,
        idNumber: document.getElementById('idNumber').value,
        email: document.getElementById('email').value,
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        payRate: document.getElementById('payRate').value,
        admin: document.getElementById('adminCheckbox').checked
    };

    console.log('Form Data:', formData);

    
    fetch('http://localhost:3000/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
    })
    .then(response => response.json())
    .then(data => {
        console.log('Response:', data);
        alert("User created!")
    })
    .catch(error => {
        console.error('Error:', error);
    });
    
}


 