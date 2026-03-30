document.addEventListener('DOMContentLoaded', function () {
  var portalSelect = document.getElementById('portalSelect');
  var loginButton = document.getElementById('loginButton');
  var card = document.getElementById('mgSigninCard');
  var rightPanel = document.getElementById('rightPanel');
  var portalHelp = document.getElementById('portalHelp');
  var portalBadge = document.getElementById('portalBadge');
  var portalTitle = document.getElementById('portalTitle');
  var portalSubtitle = document.getElementById('portalSubtitle');
  var panelHeading = document.getElementById('panelHeading');
  var panelBody = document.getElementById('panelBody');

  var COPY = {
    employee: {
      help:
        'For most MG staff: keep <strong>Employee</strong> selected. Only use Administrator if your job explicitly includes the admin site.',
      badgeClass: 'mg-badge-employee',
      badgeText: 'Employee portal',
      title: 'Employee sign in',
      subtitle: 'Punch in/out, view pay, and requests.',
      btnClass: 'mg-btn-employee',
      btnLabel: 'Sign in to employee portal',
      panelHeading: 'Team member access',
      panelBody:
        'Use this login for time clock, pay history, and your profile. If you are not office staff, stay here — do not use Administrator.',
    },
    admin: {
      help:
        '<strong class="text-warning">Administrator</strong> is only for office and authorized supervisors. If you only need the time clock or your pay, switch back to <strong>Employee</strong> above.',
      badgeClass: 'mg-badge-admin',
      badgeText: 'Office & admin only',
      title: 'Administrator sign in',
      subtitle: 'Dashboard, payroll, invoices, and HR tools.',
      btnClass: 'mg-btn-admin',
      btnLabel: 'Sign in to admin dashboard',
      panelHeading: 'Not the regular employee login',
      panelBody:
        'This path goes to the management dashboard. Field and crew members should use Employee — time clock and pay are not on the admin site. If you opened this by mistake, choose Employee in the dropdown.',
    },
  };

  function applyPortal(mode) {
    var c = COPY[mode] || COPY.employee;
    card.classList.remove('mg-mode-employee', 'mg-mode-admin');
    card.classList.add(mode === 'admin' ? 'mg-mode-admin' : 'mg-mode-employee');

    rightPanel.classList.remove('mg-panel-employee', 'mg-panel-admin');
    rightPanel.classList.add(mode === 'admin' ? 'mg-panel-admin' : 'mg-panel-employee');

    portalBadge.className = c.badgeClass;
    portalBadge.textContent = c.badgeText;
    portalTitle.textContent = c.title;
    portalSubtitle.textContent = c.subtitle;
    panelHeading.textContent = c.panelHeading;
    panelBody.textContent = c.panelBody;
    portalHelp.innerHTML = c.help;

    loginButton.classList.remove('mg-btn-employee', 'mg-btn-admin');
    loginButton.classList.add(c.btnClass);
    loginButton.textContent = c.btnLabel;
  }

  function initialModeFromUrl() {
    var q = new URLSearchParams(window.location.search);
    var p = (q.get('portal') || '').toLowerCase();
    if (p === 'admin') return 'admin';
    if (p === 'employee') return 'employee';
    var h = (window.location.hash || '').replace(/^#/, '').toLowerCase();
    if (h === 'admin') return 'admin';
    return 'employee';
  }

  var mode = initialModeFromUrl();
  portalSelect.value = mode;
  applyPortal(mode);

  portalSelect.addEventListener('change', function () {
    applyPortal(portalSelect.value);
  });

  loginButton.addEventListener('click', async function () {
    var portal = portalSelect.value === 'admin' ? 'admin' : 'employee';
    var username = document.getElementById('usernameField').value;
    var password = document.getElementById('passwordField').value;

    var url = portal === 'admin' ? '/login' : '/loginEmployee';

    try {
      var response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password }),
      });

      var data = await response.json();

      if (!response.ok) {
        var isNotAdmin =
          portal === 'admin' &&
          (data.reason === 'NOT_ADMIN' ||
            (typeof data.message === 'string' &&
              data.message.indexOf('no an Admin') !== -1));
        if (isNotAdmin) {
          $('#mgModalNotAdmin').modal('show');
          return;
        }
        $('#mgModalLoginErrorTitle').text(
          portal === 'admin' ? 'Administrator sign in' : 'Employee sign in'
        );
        $('#mgModalLoginErrorBody').text(
          data.message || 'Invalid credentials. Please try again.'
        );
        $('#mgModalLoginError').modal('show');
        return;
      }

      if (portal === 'admin') {
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
        return;
      }

      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('mgPortal', 'employee');
      var info = {
        store_username: data.username,
        store_name: data.name,
        store_email: data.email || '',
        store_id: data.idNumber || '',
        store_payRate: data.payRate || '',
      };
      localStorage.setItem('userInfo', JSON.stringify(info));
      var q = new URLSearchParams({
        username: data.username,
        name: data.name,
      });
      if (data.email) q.set('email', data.email);
      if (data.idNumber) q.set('idNumber', data.idNumber);
      window.location.href = '/EmployeeDash/pages/dashboard.html?' + q.toString();
    } catch (error) {
      console.error('Error:', error);
      $('#mgModalLoginErrorTitle').text('Sign in');
      $('#mgModalLoginErrorBody').text(
        'Something went wrong. Check your connection and try again.'
      );
      $('#mgModalLoginError').modal('show');
    }
  });

  $('#mgSwitchToEmployeeBtn').on('click', function () {
    $('#mgModalNotAdmin').modal('hide');
    portalSelect.value = 'employee';
    applyPortal('employee');
    document.getElementById('usernameField').focus();
  });
});
