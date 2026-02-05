// UserMgt.js — Full user management logic (moved entirely from Main.js)
// Responsibilities:
// - Load UserMgt.html into the add-user container when requested (loadUserMgtSection)
// - Initialize the user management UI (initUserMgt)
// - Add user (auto assign level from role), delete user (with confirmation)
// - Refresh users list and expose window.refreshUsersList / window.deleteUser
// - Expose window.loadUserMgtSection for Main.js to call

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
    { level: 1, access: 'NEW', stages: 'New, Assessment', submitEffect: 'PENDING' },
    { level: 2, access: 'NEW', stages: 'New, Assessment, Compliance, Ist Review', submitEffect: 'PENDING' },
    { level: 3, access: 'PENDING', stages: '2nd Review', submitEffect: 'PENDING APPROVAL' },
    { level: 4, access: 'PENDING APPROVAL', stages: 'Approver', submitEffect: 'APPROVED' },
    { level: 5, access: 'ALL', stages: 'All stages', submitEffect: 'All transitions allowed' }
  ];

  function $id(id) { return document.getElementById(id); }

  // Load the HTML fragment into #user-management-root (called by Main.js when section selected)
  async function loadUserMgtSection() {
    const container = document.getElementById('user-management-root');
    if (!container) {
      console.warn('User management container not found');
      return;
    }
    if (container.getAttribute('data-loaded') === '1') {
      // If already loaded, ensure init runs
      if (typeof initUserMgt === 'function') {
        try { initUserMgt(); } catch (e) { console.warn('initUserMgt error', e); }
      }
      return;
    }
    try {
      const resp = await fetch('UserMgt.html', { cache: 'no-store' });
      if (!resp.ok) throw new Error('Failed to fetch UserMgt.html: ' + resp.status);
      const html = await resp.text();
      container.innerHTML = html;
      container.setAttribute('data-loaded', '1');

      // If this script already loaded, call initializer
      if (typeof initUserMgt === 'function') {
        try { initUserMgt(); } catch (e) { console.warn('initUserMgt error after load', e); }
      }
    } catch (err) {
      console.error('loadUserMgtSection error', err);
      container.innerHTML = `<div class="error">Failed to load user management UI: ${escapeHtml(err.message || err)}</div>`;
    }
  }

  // Initialize the UI inside the loaded fragment
  async function initUserMgt() {
    const roleSelect = $id('new-user-role');
    const levelInput = $id('new-user-level');
    const addForm = $id('add-user-form');
    const refreshBtn = $id('refresh-users-btn');
    const cancelBtn = $id('cancel-add-user');

    if (!roleSelect || !levelInput || !addForm) {
      // fragment not present — nothing to do
      return;
    }

    setLevelFromRole(roleSelect.value, levelInput);

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
        setLevelFromRole(roleSelect.value, levelInput);
      });
    }

    renderAccessMatrix();
    await refreshUsersList();
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
      (window.showToast || window.alert)('Name is required', 'error');
      return;
    }
    if (!role) {
      (window.showToast || window.alert)('Role is required', 'error');
      return;
    }
    if (!level || isNaN(level)) {
      (window.showToast || window.alert)('Level not assigned. Select a role.', 'error');
      return;
    }

    try {
      if (typeof window.showLoading === 'function') showLoading('Adding user...');
      const payload = { name: name, level: level, role: role };

      // Ensure server enforces level by role; client supplies convenience mapping
      const resp = await window.apiService.addUser(payload, { showLoading: false });

      if (typeof window.hideLoading === 'function') hideLoading();

      if (resp && resp.success) {
        if (typeof window.showSuccessModal === 'function') {
          await showSuccessModal(resp.message || 'User added');
        } else {
          alert(resp.message || 'User added');
        }
        $id('add-user-form').reset();
        setLevelFromRole('', $id('new-user-level'));
        await refreshUsersList();
      } else {
        const msg = resp && resp.message ? resp.message : 'Failed to add user';
        (window.showToast || window.alert)(msg);
      }
    } catch (err) {
      if (typeof window.hideLoading === 'function') hideLoading();
      const errMsg = err && err.message ? err.message : String(err);
      (window.showToast || window.alert)('Error adding user: ' + errMsg);
      console.error('handleAddUser error', err);
    }
  }

  async function refreshUsersList() {
    const tbody = document.getElementById('users-list-body');
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

        tbody.querySelectorAll('.btn-delete').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const userName = btn.dataset.username;
            await confirmAndDeleteUser(userName);
          });
        });
      } else {
        tbody.innerHTML = `<tr><td colspan="4" class="error">Error loading users</td></tr>`;
        const msg = res && res.message ? res.message : 'Failed to get users';
        (window.showToast || window.alert)(msg);
      }
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4" class="error">Error loading users</td></tr>`;
      console.error('refreshUsersList error', err);
      (window.showToast || window.alert)('Error loading users: ' + (err && err.message ? err.message : err));
    }
  }

  async function confirmAndDeleteUser(userName) {
    if (!userName) return;
    const ok = (typeof window.showConfirmModal === 'function')
      ? await showConfirmModal(`Delete user: ${userName}?`, { title: 'Confirm Delete', confirmText: 'Delete', cancelText: 'Cancel', danger: true })
      : confirm('Delete user: ' + userName + '?');
    if (!ok) return;

    try {
      if (typeof window.showLoading === 'function') showLoading('Deleting user...');
      const resp = await window.apiService.deleteUser(userName, { showLoading: false });
      if (typeof window.hideLoading === 'function') hideLoading();
      if (resp && resp.success) {
        if (typeof window.showSuccessModal === 'function') await showSuccessModal(resp.message || 'Deleted');
        else alert(resp.message || 'Deleted');
        await refreshUsersList();
      } else {
        const msg = resp && resp.message ? resp.message : 'Delete failed';
        (window.showToast || window.alert)(msg);
      }
    } catch (err) {
      if (typeof window.hideLoading === 'function') hideLoading();
      console.error('deleteUser error', err);
      (window.showToast || window.alert)('Error deleting user: ' + (err && err.message ? err.message : err));
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

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Expose functions for Main.js and other modules
  window.initUserMgt = initUserMgt;
  window.refreshUsersList = refreshUsersList;
  window.deleteUser = async function(name) { return confirmAndDeleteUser(name); };
  window.confirmAndDeleteUser = confirmAndDeleteUser;
  window.loadUserMgtSection = loadUserMgtSection;

  // auto-init when fragment present at DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('user-management')) {
      try { initUserMgt(); } catch (e) { console.warn('initUserMgt auto-init failed', e); }
    }
  });

})();
