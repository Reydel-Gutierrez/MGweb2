/**
 * Tasks & schedule — task list CRUD; calendar visual from existing asset.
 */
(function () {
  var lastTasks = [];

  function $(id) {
    return document.getElementById(id);
  }

  function showAlert(message, type) {
    var el = $('mg-task-alert');
    if (!el) return;
    el.className =
      'alert py-2 px-3 mb-3 alert-' + (type === 'danger' ? 'danger' : 'success');
    el.textContent = message;
    el.classList.remove('d-none');
    clearTimeout(showAlert._t);
    showAlert._t = setTimeout(function () {
      el.classList.add('d-none');
    }, 5000);
  }

  function toInputDate(d) {
    if (!d) return '';
    var x = new Date(d);
    if (isNaN(x.getTime())) return '';
    return x.toISOString().slice(0, 10);
  }

  async function loadTasks() {
    try {
      var res = await fetch('/fetchTasks');
      var tasks = await res.json();
      if (!Array.isArray(tasks)) tasks = [];
      lastTasks = tasks;
      var tbody = document.querySelector('#mg-tasks-table tbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      var sorted = tasks.slice().sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
      });
      if (!sorted.length) {
        tbody.innerHTML =
          '<tr><td colspan="4" class="mg-empty-state">No tasks yet. Add one below.</td></tr>';
        return;
      }
      sorted.forEach(function (task) {
        var tr = document.createElement('tr');
        var d = new Date(task.date).toLocaleDateString();
        var tid = task.id != null ? String(task.id) : '';
        tr.innerHTML =
          '<td>' +
          tid +
          '</td><td>' +
          (task.title || '') +
          '</td><td>' +
          d +
          '</td><td class="text-end"><button type="button" class="btn btn-link btn-sm text-dark mb-0 mg-task-edit" data-id="' +
          tid +
          '">Edit</button> <button type="button" class="btn btn-link btn-sm text-danger mb-0 mg-task-del" data-id="' +
          tid +
          '">Remove</button></td>';
        tbody.appendChild(tr);
      });
      tbody.querySelectorAll('.mg-task-edit').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var taskId = btn.getAttribute('data-id');
          var task = lastTasks.find(function (t) {
            return String(t.id) === taskId;
          });
          if (!task) return;
          $('mg-task-edit-id').value = taskId;
          $('mg-task-edit-title').value = task.title || '';
          $('mg-task-edit-date').value = toInputDate(task.date);
          var modal = document.getElementById('mg-task-edit-modal');
          if (modal && window.bootstrap && bootstrap.Modal) {
            bootstrap.Modal.getOrCreateInstance(modal).show();
          }
        });
      });
      tbody.querySelectorAll('.mg-task-del').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var taskId = btn.getAttribute('data-id');
          if (!taskId || !confirm('Remove this task?')) return;
          try {
            var r = await fetch('/deleteTask', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ taskId: taskId })
            });
            if (r.ok) {
              showAlert('Task removed.', 'success');
              await loadTasks();
            } else {
              showAlert('Could not remove task.', 'danger');
            }
          } catch (e) {
            console.error(e);
            showAlert('Could not remove task.', 'danger');
          }
        });
      });
    } catch (e) {
      console.error(e);
      showAlert('Could not load tasks.', 'danger');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var addBtn = $('mg-task-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', async function () {
        var taskTitle = $('taskTitle') && $('taskTitle').value;
        var taskDate = $('taskDate') && $('taskDate').value;
        if (!taskTitle || !taskDate) {
          showAlert('Enter title and date.', 'danger');
          return;
        }
        try {
          var r = await fetch('/addTask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskTitle: taskTitle, taskDate: taskDate })
          });
          if (r.ok) {
            showAlert('Task added.', 'success');
            if ($('taskTitle')) $('taskTitle').value = '';
            await loadTasks();
          } else {
            showAlert('Could not add task.', 'danger');
          }
        } catch (e) {
          console.error(e);
          showAlert('Could not add task.', 'danger');
        }
      });
    }

    var saveBtn = $('mg-task-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async function () {
        var taskId = $('mg-task-edit-id').value;
        var taskTitle = $('mg-task-edit-title').value;
        var taskDate = $('mg-task-edit-date').value;
        if (!taskId || !taskTitle || !taskDate) {
          showAlert('Fill title and date.', 'danger');
          return;
        }
        try {
          var r = await fetch('/updateTask', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId: taskId,
              taskTitle: taskTitle,
              taskDate: taskDate
            })
          });
          var data = await r.json().catch(function () {
            return {};
          });
          if (r.ok) {
            showAlert('Task updated.', 'success');
            var modal = document.getElementById('mg-task-edit-modal');
            if (modal && window.bootstrap && bootstrap.Modal) {
              bootstrap.Modal.getInstance(modal).hide();
            }
            await loadTasks();
          } else {
            showAlert(data.error || 'Update failed.', 'danger');
          }
        } catch (e) {
          console.error(e);
          showAlert('Update failed.', 'danger');
        }
      });
    }

    loadTasks();
  });
})();
