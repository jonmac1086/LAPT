// UserMgt.js — User Management logic (extracted)
// - Auto-assign levels on role selection
// - Add user, delete user, refresh list
// - Render access matrix (Level → Stages / Status transitions)
// - Uses window.apiService for server calls and ui-modals / showToast for UX

(function () {
  'use strict';

  const ROLE_LEVEL_MAP = {
    'Admin': 5,
    'Head of Credit': 2,
    'Credit Officer': 1,
    'AMLRO': 2,
    'Branch Manager/Approver': 3,
    'Approver': 4
  };

  const ACCESS_MATRIX = [
    {
      level: 1,
      access: 'NEW',
      stages: 'New, Assessment',
      submitEffect: 'PENDING'
    },
    {
      level: 2,
      access: 'NEW',
      stages: 'New, Assessment, Compliance, Ist Review',
      submitEffect: 'PENDING'
    },
    {
      level: 3,
      access: 'PENDING',
      stages: '2nd Review',
      submitEffect: 'PENDING APPROVAL'
    },
    {
      level: 4,
      access: 'PENDING APPROVAL',
      stages: 'Approver',
      submitEffect: 'APPROVED'
    },
    {
      level: 5,
      access: 'ALL',
      stages: 'All stages',
      submitEffect: 'All transitions allowed'
    }
  ];

  // DOM shortcuts
  function $id(id) { return document.getElementById(id); }

  async function initUserMgt() {
    // Elements
    const roleSelect = $id('new-user-role');
    const levelInput = $id('new-user-level');
    const addForm = $id('add-user-form');
    const refreshBtn = $id('refresh-users-btn');
    const cancelBtn = $id('cancel-add-user');

    if (!roleSelect || !levelInput || !addForm) {
      // Not present on the page (maybe this fragment not included) - nothing to initialize
      return;
    }

    // Populate initial level from default selection (if any)
    setLevelFromRole(roleSelect.value, levelInput);

    // Event listeners
    roleSelect.addEventListener('change', (e) => {
      setLevelFromRole(e.target.value, levelInput);
    });

    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleAddUser();
    });

    if (refreshBtn) {
      refreshBtn.addEventListener('click', (e) => {
        e.preventDefault();
        refreshUsersList();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        addForm.reset();
        // reset level
        setLevelFromRole(roleSelect.value, levelInput);
      });
    }

    // render matrix
    renderAccessMatrix();

    // initial load
    refreshUsersList();
  }

  function setLevelFromRole(roleValue, levelInputEl) {
    const assigned = ROLE_LEVEL_MAP[roleValue] || '';
    if (levelInputEl) {
      levelInputEl.value = assigned !== '' ? assigned : '';
    }
  }

  async function handleAddUser() {
    const nameEl = $id('new-user-name');
    const roleEl = $id('new-user-role');
    const levelEl = $id('new-user-level');

    const name = nameEl ? nameEl.value.trim() : '';
    const role = roleEl ? roleEl.value : '';
    const level = levelEl ? parseInt(levelEl.value, 10) : null;

    if (!name) {
      if (typeof showToast === 'function') showToast('Name is required', 'error');
      else alert('Name is required');
      return;
    }
    if (!role) {
      if (typeof showToast === 'function') showToast('Role is required', 'error');
      else alert('Role is required');
      return;
    }
    if (!level || isNaN(level)) {
      if (typeof showToast === 'function') showToast('Level not assigned. Select a role.', 'error');
      else alert('Level not assigned. Select a role.');
      return;
    }

    try {
      // show loader
      if (typeof showLoading === 'function') showLoading('Adding user...');
      else if (typeof showGlobalLoader === 'function') showGlobalLoader('Adding user...');

      const payload = { name: name, level: level, role: role };
      const resp = await window.apiService.addUser(payload, { showLoading: false });

      if (typeof hideLoading === 'function') hideLoading();
      else if (typeof hideGlobalLoader === 'function') hideGlobalLoader();

      if (resp && resp.success) {
        if (typeof showSuccessModal === 'function') {
          await showSuccessModal(resp.message || 'User added');
        } else {
          alert(resp.message || 'User added');
        }
        // reset form
        $id('add-user-form').reset();
        setLevelFromRole('', $id('new-user-level'));
        refreshUsersList();
      } else {
        const msg = resp && resp.message ? resp.message : 'Failed to add user';
        if (typeof showToast === 'function') showToast(msg, 'error');
        else alert(msg);
      }
    } catch (err) {
      if (typeof hideLoading === 'function') hideLoading();
      const errMsg = err && err.message ? err.message : String(err);
      if (typeof showToast === 'function') showToast('Error adding user: ' + errMsg, 'error');
      else alert('Error adding user: ' + errMsg);
      console.error('handleAddUser error', err);
    }
  }

  async function refreshUsersList() {
    const tbody = $id('users-list-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4" class="loading">Loading users...</td></tr>`;
    try {
      const res = await window.apiService.getAllUsers({ showLoading: false });
      if (res && res.success) {
        const users = res.data || [];
        if (!users.length) {
          tbody.innerHTML = `<tr><td colspan="4" class="no-data">No users found</td></tr>`;
          return;
        }
        const rows = users.map(u => {
          const safeName = escapeHtml(u.name || '');
          const safeRole = escapeHtml(u.role || '');
          const safeLevel = escapeHtml(String(u.level || ''));
          const deleteBtn = `<button class="btn-icon btn-delete" data-username="${safeName}" title="Delete user"><i class="fas fa-trash"></i></button>`;
          return `<tr>
            <td>${safeName}</td>
            <td>${safeLevel}</td>
            <td>${safeRole}</td>
            <td class="actions">${deleteBtn}</td>
          </tr>`;
        }).join('');
        tbody.innerHTML = rows;

        // attach delete handlers
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const userName = btn.dataset.username;
            await confirmAndDeleteUser(userName);
          });
        });
      } else {
        tbody.innerHTML = `<tr><td colspan="4" class="error">Error loading users</td></tr>`;
        const msg = res && res.message ? res.message : 'Failed to get users';
        if (typeof showToast === 'function') showToast(msg, 'error');
      }
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4" class="error">Error loading users</td></tr>`;
      console.error('refreshUsersList error', err);
      if (typeof showToast === 'function') showToast('Error loading users: ' + (err && err.message ? err.message : err), 'error');
    }
  }

  async function confirmAndDeleteUser(userName) {
    if (!userName) return;
    const ok = (typeof showConfirmModal === 'function')
      ? await showConfirmModal(`Delete user: ${userName}?`, { title: 'Confirm Delete', confirmText: 'Delete', cancelText: 'Cancel', danger: true })
      : confirm('Delete user: ' + userName + '?');
    if (!ok) return;

    try {
      if (typeof showLoading === 'function') showLoading('Deleting user...');
      const resp = await window.apiService.deleteUser(userName, { showLoading: false });
      if (typeof hideLoading === 'function') hideLoading();
      if (resp && resp.success) {
        if (typeof showSuccessModal === 'function') await showSuccessModal(resp.message || 'Deleted');
        else alert(resp.message || 'Deleted');
        refreshUsersList();
      } else {
        const msg = resp && resp.message ? resp.message : 'Delete failed';
        if (typeof showToast === 'function') showToast(msg, 'error');
        else alert(msg);
      }
    } catch (err) {
      if (typeof hideLoading === 'function') hideLoading();
      console.error('deleteUser error', err);
      if (typeof showToast === 'function') showToast('Error deleting user: ' + (err && err.message ? err.message : err), 'error');
      else alert('Error deleting user: ' + (err && err.message ? err.message : err));
    }
  }

  function renderAccessMatrix() {
    const tbody = document.querySelector('#access-matrix tbody');
    if (!tbody) return;
    tbody.innerHTML = ACCESS_MATRIX.map(row => {
      return `<tr>
        <td style="font-weight:700;">${escapeHtml(String(row.level))}</td>
        <td>${escapeHtml(row.access)}</td>
        <td>${escapeHtml(row.stages)}</td>
        <td>${escapeHtml(row.submitEffect)}</td>
      </tr>`;
    }).join('');
  }

  // small helper
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // initialize when fragment is present
  document.addEventListener('DOMContentLoaded', () => {
    // If the user management fragment exists, initialize
    if (document.getElementById('user-management')) {
      initUserMgt().catch(err => console.error('initUserMgt error', err));
    }
  });

  // Expose for manual init
  window.initUserMgt = initUserMgt;
  window.refreshUsersListMgt = refreshUsersList;

})();
