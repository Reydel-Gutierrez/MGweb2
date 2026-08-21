document.addEventListener('DOMContentLoaded', function () {
  var portalSelect = document.getElementById('portalSelect');
  var loginButton = document.getElementById('loginButton');
  var loginForm = document.getElementById('loginForm');
  var card = document.getElementById('mgSigninCard');
  var rightPanel = document.getElementById('rightPanel');
  var portalHelp = document.getElementById('portalHelp');
  var portalBadge = document.getElementById('portalBadge');
  var portalTitle = document.getElementById('portalTitle');
  var portalSubtitle = document.getElementById('portalSubtitle');
  var panelHeading = document.getElementById('panelHeading');
  var panelBody = document.getElementById('panelBody');
  var switchPortalTarget = 'client';

  var COPY = {
    employee: {
      help:
        'For most MG staff: keep <strong>Employee</strong> selected. Property contacts choose <strong>Client</strong>. Only use Administrator if your job explicitly includes the admin site.',
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
    client: {
      help:
        'Property and operations contacts: keep <strong>Client</strong> selected to see who is scheduled at your building and photo documentation from the MG team.',
      badgeClass: 'mg-badge-client',
      badgeText: 'Client portal',
      title: 'Client sign in',
      subtitle: 'Staffing schedule, on-site employees, and photos.',
      btnClass: 'mg-btn-client',
      btnLabel: 'Sign in to client portal',
      panelHeading: 'Your building, at a glance',
      panelBody:
        'See which MG employees are scheduled at your property and review photo documentation while it is still within the retention window.',
    },
  };

  function applyPortal(mode) {
    var key = COPY[mode] ? mode : 'employee';
    var c = COPY[key];
    card.classList.remove('mg-mode-employee', 'mg-mode-admin', 'mg-mode-client');
    card.classList.add('mg-mode-' + key);

    rightPanel.classList.remove('mg-panel-employee', 'mg-panel-admin', 'mg-panel-client');
    rightPanel.classList.add('mg-panel-' + key);

    portalBadge.className = c.badgeClass;
    portalBadge.textContent = c.badgeText;
    portalTitle.textContent = c.title;
    portalSubtitle.textContent = c.subtitle;
    panelHeading.textContent = c.panelHeading;
    panelBody.textContent = c.panelBody;
    portalHelp.innerHTML = c.help;

    loginButton.classList.remove('mg-btn-employee', 'mg-btn-admin', 'mg-btn-client');
    loginButton.classList.add(c.btnClass);
    loginButton.textContent = c.btnLabel;
  }

  function initialModeFromUrl() {
    var q = new URLSearchParams(window.location.search);
    var p = (q.get('portal') || '').toLowerCase();
    if (p === 'admin' || p === 'employee' || p === 'client') return p;
    var h = (window.location.hash || '').replace(/^#/, '').toLowerCase();
    if (h === 'admin' || h === 'client') return h;
    return 'employee';
  }

  function loginUrl(portal) {
    if (portal === 'admin') return '/login';
    if (portal === 'client') return '/loginClient';
    return '/loginEmployee';
  }

  function showLoginError(title, message) {
    $('#mgModalLoginErrorTitle').text(title);
    $('#mgModalLoginErrorBody').text(message);
    $('#mgModalLoginError').modal('show');
  }

  function showWrongPortal(title, body, nextPortal, btnLabel, btnClass) {
    switchPortalTarget = nextPortal;
    $('#mgModalWrongPortalTitle').text(title);
    $('#mgModalWrongPortalBody').text(body);
    var btn = document.getElementById('mgSwitchPortalBtn');
    btn.textContent = btnLabel;
    btn.className = 'btn ' + btnClass;
    $('#mgModalWrongPortal').modal('show');
  }

  var mode = initialModeFromUrl();
  portalSelect.value = mode;
  applyPortal(mode);

  portalSelect.addEventListener('change', function () {
    applyPortal(portalSelect.value);
  });

  async function submitLogin() {
    var portal = portalSelect.value;
    if (portal !== 'admin' && portal !== 'client') portal = 'employee';
    var username = document.getElementById('usernameField').value;
    var password = document.getElementById('passwordField').value;

    try {
      var response = await fetch(loginUrl(portal), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password }),
        credentials: 'same-origin',
      });

      var data = await response.json();

      if (!response.ok) {
        var isNotAdmin =
          portal === 'admin' &&
          (data.reason === 'NOT_ADMIN' ||
            (typeof data.message === 'string' && data.message.indexOf('no an Admin') !== -1));
        if (isNotAdmin) {
          $('#mgModalNotAdmin').modal('show');
          return;
        }
        if (data.reason === 'CLIENT_ACCOUNT') {
          showWrongPortal(
            'Use the client portal',
            'This username belongs to a client account. Choose Client in “Where are you signing in?” to see staffing and photos for your building.',
            'client',
            'Client sign in',
            'mg-btn-client'
          );
          return;
        }
        if (data.reason === 'NOT_CLIENT') {
          showWrongPortal(
            'Not a client login',
            'This username is for MG staff. Choose Employee for time clock and pay, or Administrator if you use the office dashboard.',
            'employee',
            'Employee sign in',
            'mg-btn-employee'
          );
          return;
        }
        var titles = {
          admin: 'Administrator sign in',
          client: 'Client sign in',
          employee: 'Employee sign in',
        };
        showLoginError(titles[portal] || 'Sign in', data.message || 'Invalid credentials. Please try again.');
        return;
      }

      localStorage.setItem('isLoggedIn', 'true');
      if (portal === 'admin') {
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

      if (portal === 'client') {
        localStorage.setItem('mgPortal', 'client');
        localStorage.setItem(
          'userInfo',
          JSON.stringify({
            store_username: data.username,
            store_name: data.name || '',
          })
        );
        window.location.href = '/ClientDash/pages/schedule.html';
        return;
      }

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
      showLoginError('Sign in', 'Something went wrong. Check your connection and try again.');
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      submitLogin();
    });
  } else {
    loginButton.addEventListener('click', submitLogin);
  }

  $('#mgSwitchToEmployeeBtn').on('click', function () {
    $('#mgModalNotAdmin').modal('hide');
    portalSelect.value = 'employee';
    applyPortal('employee');
    document.getElementById('usernameField').focus();
  });

  $('#mgSwitchPortalBtn').on('click', function () {
    $('#mgModalWrongPortal').modal('hide');
    portalSelect.value = switchPortalTarget;
    applyPortal(switchPortalTarget);
    document.getElementById('usernameField').focus();
  });
});
