// UserMgt.js — Robust user management module (improved, idempotent, retry-safe)
// - Idempotent initUserMgt: safe to call multiple times
// - Defensive element lookup with short retries to avoid race conditions
// - Safe event binding (no duplicate handlers)
// - Exposes window.initUserMgt, window.refreshUsersList, window.loadUserMgtSection, window.confirmAndDeleteUser

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

  // Internal state
  let _initialized = false;
  let _bindings = {
    addForm: false,
    roleSelect: false,
    refreshBtn: false,
    cancelBtn: false
  };

  // Utility: short wait
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility: find element by id with retries
  async function waitForElement(id, timeout = 1500, interval = 50) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = document.getElementById(id);
      if (el) return el;
      // element might be inside injected HTML under user-management-root, so try again
      await wait(interval);
    }
    return null;
  }

  function $id(id) { return document.getElementById(id); }

  // Safely escape text for insertion into HTML
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Map role -> level (UI convenience). Server must still enforce mapping.
  function setLevelFromRole(roleValue, levelInputEl) {
    const assigned = ROLE_LEVEL_MAP[roleValue] || '';
    if (levelInputEl) {
      levelInputEl.value = assigned !== '' ? assigned : '';
    }
  }

  // Add user handler
  async function handleAddUser(ev) {
    try {
      if (ev && ev.preventDefault) ev.preventDefault();

      const nameEl = await waitForElement('new-user-name', 200);
      const roleEl = await waitForElement('new-user-role', 200);
      const levelEl = await waitForElement('new-user-level', 200);
      if (!nameEl || !roleEl || !levelEl) {
        (window.showToast || window.alert)('Form not available. Please try again.');
        return;
      }

      const name = nameEl.value.trim();
      const role = roleEl.value;
      const level = parseInt(levelEl.value, 10);

      if (!name) {
        (window.showToast || window.alert)('Name is required');
        nameEl.focus();
        return;
      }
      if (!role) {
        (window.showToast || window.alert)('Role is required');
        roleEl.focus();
        return;
      }

      // Ensure level assigned from role (defensive)
      const expectedLevel = ROLE_LEVEL_MAP[role];
      if (!expectedLevel) {
        (window.showToast || window.alert)('Unknown role selected');
        return;
      }

      // Disable submit to prevent double-submission
      const submitBtn = document.getElementById('submit-add-user');
      if (submitBtn) submitBtn.disabled = true;

      if (typeof window.showLoading === 'function') showLoading('Adding user...');

      // Payload: server should enforce role->level mapping regardless of what client sends
      const payload = { name: name, role: role, level: expectedLevel };

      let resp;
      try {
        resp = await window.apiService.addUser(payload, { showLoading: false });
      } catch (apiErr) {
        console.error('addUser API failed', apiErr);
        resp = { success: false, message: apiErr && apiErr.message ? apiErr.message : 'API error' };
      }

      if (typeof window.hideLoading === 'function') hideLoading();
      if (submitBtn) submitBtn.disabled = false;

      if (resp && resp.success) {
        if (typeof window.showSuccessModal === 'function') {
          await showSuccessModal(resp.message || 'User added');
        } else {
          alert(resp.message || 'User added');
        }
        // reset form
        const form = document.getElementById('add-user-form');
        if (form) form.reset();
        setLevelFromRole('', document.getElementById('new-user-level'));
        await refreshUsersList();
      } else {
        const msg = resp && resp.message ? resp.message : 'Failed to add user';
        (window.showToast || window.alert)(msg);
      }
    } catch (err) {
      if (typeof window.hideLoading === 'function') hideLoading();
      console.error('handleAddUser error', err);
      (window.showToast || window.alert)('Error adding user: ' + (err && err.message ? err.message : err));
      const submitBtn = document.getElementById('submit-add-user');
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  // Refresh users list and render into table
  async function refreshUsersList() {
    try {
      const tbody = await waitForElement('users-list-body', 1200);
      if (!tbody) {
        console.warn('users-list-body not present yet; aborting refresh');
        return;
      }

      // Show loading row
      tbody.innerHTML = `<tr><td colspan="4" class="loading">Loading users...</td></tr>`;

      let res;
      try {
        res = await window.apiService.getAllUsers({ showLoading: false });
      } catch (apiErr) {
        console.error('getAllUsers API failed', apiErr);
        res = { success: false, message: apiErr && apiErr.message ? apiErr.message : 'API error' };
      }

      if (!res || !res.success) {
        tbody.innerHTML = `<tr><td colspan="4" class="error">Error loading users: ${escapeHtml(res && res.message ? res.message : 'Unknown')}</td></tr>`;
        return;
      }

      const users = res.data || [];
      if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="no-data">No users found</td></tr>`;
        return;
      }

      const rowsHtml = users.map(u => {
        const safeName = escapeHtml(u.name || '');
        const safeRole = escapeHtml(u.role || '');
        const safeLevel = escapeHtml(String(u.level || ''));
        const btnAttr = `data-username="${safeName.replace(/"/g,'&quot;')}"`;
        return `<tr>
          <td>${safeName}</td>
          <td>${safeLevel}</td>
          <td>${safeRole}</td>
          <td class="actions"><button class="btn-icon btn-delete" ${btnAttr} title="Delete user"><i class="fas fa-trash"></i></button></td>
        </tr>`;
      }).join('');

      tbody.innerHTML = rowsHtml;

      // attach delete handlers (idempotent: remove existing first)
      tbody.querySelectorAll('.btn-delete').forEach(btn => {
        // ensure not double-binding by checking a dataset flag
        if (btn.dataset._bound === '1') return;
        btn.dataset._bound = '1';
        btn.addEventListener('click', async (e) => {
          const username = btn.getAttribute('data-username');
          await confirmAndDeleteUser(username);
        });
      });

    } catch (err) {
      console.error('refreshUsersList error', err);
    }
  }

  // Confirm & delete user
  async function confirmAndDeleteUser(userName) {
    if (!userName) return;
    const ok = (typeof window.showConfirmModal === 'function')
      ? await showConfirmModal(`Delete user: ${userName}?`, { title: 'Confirm Delete', confirmText: 'Delete', cancelText: 'Cancel', danger: true })
      : confirm('Delete user: ' + userName + '?');
    if (!ok) return;

    try {
      if (typeof window.showLoading === 'function') showLoading('Deleting user...');
      let resp;
      try {
        resp = await window.apiService.deleteUser(userName, { showLoading: false });
      } catch (apiErr) {
        console.error('deleteUser API failed', apiErr);
        resp = { success: false, message: apiErr && apiErr.message ? apiErr.message : 'API error' };
      }
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
      console.error('confirmAndDeleteUser error', err);
      (window.showToast || window.alert)('Error deleting user: ' + (err && err.message ? err.message : err));
    }
  }

  // Render the access matrix
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

  // Idempotent initializer — safe to call multiple times.
  async function initUserMgt() {
    // If module not yet injected into DOM, nothing to do
    const container = document.getElementById('user-management-root') || document.getElementById('user-management');
    if (!container) {
      // Not the loaded fragment; maybe HTML isn't injected yet.
      return;
    }

    // Wait for key elements to be present (they should be after injection)
    const nameEl = await waitForElement('new-user-name', 1200);
    const roleEl = await waitForElement('new-user-role', 1200);
    const levelEl = await waitForElement('new-user-level', 1200);
    const addForm = await waitForElement('add-user-form', 1200);
    const refreshBtn = document.getElementById('refresh-users-btn'); // optional
    const cancelBtn = document.getElementById('cancel-add-user'); // optional

    // If essential elements missing, bail (loader will retry when called again)
    if (!addForm || !roleEl || !levelEl || !nameEl) {
      console.warn('UserMgt.init: required DOM elements not present yet');
      return;
    }

    // Attach handlers once (idempotent)
    if (!_bindings.roleSelect) {
      roleEl.addEventListener('change', (e) => setLevelFromRole(e.target.value, levelEl));
      _bindings.roleSelect = true;
    }

    if (!_bindings.addForm) {
      addForm.addEventListener('submit', handleAddUser);
      _bindings.addForm = true;
    }

    if (refreshBtn && !_bindings.refreshBtn) {
      refreshBtn.addEventListener('click', (e) => { e.preventDefault(); refreshUsersList(); });
      _bindings.refreshBtn = true;
    }

    if (cancelBtn && !_bindings.cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        addForm.reset();
        setLevelFromRole(roleEl.value, levelEl);
      });
      _bindings.cancelBtn = true;
    }

    // Ensure level field is readonly and shows correct value for current role
    try { levelEl.setAttribute('readonly', 'readonly'); } catch (e) {}

    // render static access matrix
    renderAccessMatrix();

    // Refresh users list (populate table). Use short delay to ensure UI visible.
    await refreshUsersList();

    // Give visual focus to name field so user sees form
    try { nameEl.focus(); } catch (e) {}

    _initialized = true;
  }

  // Loader: inject HTML and ensure init runs (used if someone wants to load fragment via script)
  async function loadUserMgtSection() {
    const root = document.getElementById('user-management-root');
    if (!root) {
      console.warn('user-management-root container not found');
      return;
    }
    if (root.getAttribute('data-loaded') === '1') {
      // already injected; ensure init runs and section visible
      try { await initUserMgt(); } catch (e) { console.warn('initUserMgt error', e); }
      const addUserSection = document.getElementById('add-user');
      if (addUserSection) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        addUserSection.classList.add('active');
      }
      return;
    }

    // Show lightweight placeholder
    root.innerHTML = '<div class="um-loading-placeholder" style="padding:16px">Loading user management…</div>';

    try {
      const resp = await fetch('UserMgt.html', { cache: 'no-store' });
      if (!resp.ok) throw new Error('Failed to fetch UserMgt.html: ' + resp.status);
      const html = await resp.text();
      root.innerHTML = html;
      root.setAttribute('data-loaded', '1');

      // Load script if not already present (avoid duplication)
      if (!window.__userMgt_script_loaded) {
        // If this very file is being executed, mark as loaded.
        // This branch is for cases where loadUserMgtSection is called before this script is appended.
        window.__userMgt_script_loaded = true;
      }

      // Call init (it will wait for elements)
      await initUserMgt();

      // Make sure section active & visible
      const addUserSection = document.getElementById('add-user');
      if (addUserSection) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        addUserSection.classList.add('active');
      }

    } catch (err) {
      console.error('loadUserMgtSection error', err);
      root.innerHTML = `<div class="error" style="padding:16px;color:#b91c1c;">Failed to load user management UI: ${escapeHtml(err.message || err)}</div>`;
    }
  }

  // Expose safe API on window
  window.initUserMgt = initUserMgt;
  window.refreshUsersList = refreshUsersList;
  window.confirmAndDeleteUser = confirmAndDeleteUser;
  window.loadUserMgtSection = loadUserMgtSection;

  // Auto-init if fragment already present in DOM (eager case)
  document.addEventListener('DOMContentLoaded', () => {
    // If the fragment was inlined in the page (not fetched), initialize.
    if (document.getElementById('user-management')) {
      // call init asynchronously
      setTimeout(() => {
        try { initUserMgt().catch(e => console.warn('initUserMgt error', e)); } catch (e) {}
      }, 40);
    }
  });

})();
