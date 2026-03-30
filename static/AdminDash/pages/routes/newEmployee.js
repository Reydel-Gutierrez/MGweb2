// newEmployee.js — register employee (admin)

function showAdminPrivileges() {
  alert(
    'Admin Privileges are system-level permissions that allow users to access and manage users as well as different product areas.'
  );
}

function showRegAlert(message, type) {
  var el = document.getElementById('mg-reg-alert');
  if (!el) {
    alert(message);
    return;
  }
  el.className =
    'alert py-2 px-3 mb-3 alert-' + (type === 'danger' ? 'danger' : 'success');
  el.textContent = message;
  el.classList.remove('d-none');
}

function setRegisterLoading(loading) {
  var btn = document.getElementById('registerButton');
  if (btn) {
    btn.disabled = !!loading;
    btn.textContent = loading ? 'Saving…' : 'Register employee';
  }
}

function submitForm() {
  var formData = {
    fullName: document.getElementById('fullName').value,
    idNumber: document.getElementById('idNumber').value,
    email: document.getElementById('email').value,
    username: document.getElementById('username').value,
    password: document.getElementById('password').value,
    payRate: document.getElementById('payRate').value,
    admin: document.getElementById('adminCheckbox').checked
  };

  setRegisterLoading(true);
  fetch('/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(formData)
  })
    .then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, status: response.status, data: data };
      });
    })
    .then(function (result) {
      if (result.ok) {
        showRegAlert(result.data.message || 'User created successfully.', 'success');
        var form = document.getElementById('registrationForm');
        if (form) form.reset();
        document.getElementById('adminCheckbox').checked = false;
      } else {
        showRegAlert(
          result.data.message || 'Could not create user (check duplicate email or ID).',
          'danger'
        );
      }
    })
    .catch(function (error) {
      console.error('Error:', error);
      showRegAlert('Network error. Try again.', 'danger');
    })
    .finally(function () {
      setRegisterLoading(false);
    });
}
