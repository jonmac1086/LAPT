// Main.js — single modal loader implementation (no recursion) + app logic
// User management JS has been moved to UserMgt.js; Main.js delegates to that module where needed.

/* ==========================================================================
   App-level state & caches
   ========================================================================== */
const cachedElements = {};
let currentAppNumber = "";
let currentAppFolderId = "";
let lastAppCount = 0;
let notificationCheckInterval;
let refreshInterval;
let currentViewingAppData = null;

// Per-section state to avoid flicker & handle concurrent requests
const sectionStates = {}; // { [sectionId]: { requestId: number, loading: boolean } }

/* ==========================================================================
   Core helpers
   ========================================================================== */
function clearIntervals() {
  if (notificationCheckInterval) clearInterval(notificationCheckInterval);
  if (refreshInterval) clearInterval(refreshInterval);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/* ==========================================================================
   Loading UI (modal-local first, global fallback)
   ========================================================================== */
function showLoading(message = 'Processing...') {
  try {
    const viewModal = document.getElementById('viewApplicationModal');
    // Detect visible/open modal robustly: either has .active OR computed display not 'none'
    const isViewOpen = viewModal && (viewModal.classList.contains('active') || window.getComputedStyle(viewModal).display !== 'none');
    if (isViewOpen) {
      let local = document.getElementById('modal-local-loading');
      if (!local) {
        local = document.createElement('div');
        local.id = 'modal-local-loading';
        local.className = 'modal-local-loading';
        local.innerHTML = `
          <div class="modal-local-card" role="status" aria-live="polite" aria-label="Loading">
            <div class="spinner large" aria-hidden="true"></div>
            <div class="modal-local-message"></div>
          </div>
        `;
        const container = viewModal.querySelector('.modal-content') || viewModal;
        const computedPosition = window.getComputedStyle(container).position;
        if (!computedPosition || computedPosition === 'static') {
          container.style.position = 'relative';
        }
        container.appendChild(local);
      }
      const msgEl = local.querySelector('.modal-local-message');
      if (msgEl) msgEl.textContent = message;
      local.style.display = 'flex';
      return;
    }

    // Use global loader if available (ui-modals)
    if (typeof window.showGlobalLoader === 'function') {
      window.showGlobalLoader(message);
      return;
    }

    // Fallback legacy loader
    let globalModal = document.getElementById('global-loading-modal');
    if (!globalModal) {
      globalModal = document.createElement('div');
      globalModal.id = 'global-loading-modal';
      globalModal.className = 'global-loading-modal';
      globalModal.innerHTML = `
        <div class="global-loading-backdrop" role="status" aria-live="polite"></div>
        <div class="global-loading-card" role="dialog" aria-modal="true" aria-label="Loading">
          <div class="spinner large" aria-hidden="true"></div>
          <div class="global-loading-message"></div>
        </div>
      `;
      document.body.appendChild(globalModal);
    }
    const msgEl = globalModal.querySelector('.global-loading-message');
    if (msgEl) msgEl.textContent = message;
    globalModal.style.display = 'flex';
    try { document.body.style.overflow = 'hidden'; } catch (e) {}
  } catch (e) {
    console.warn('showLoading error', e);
  }
}

function hideLoading() {
  try {
    const local = document.getElementById('modal-local-loading');
    if (local && local.style.display !== 'none') {
      try {
        local.parentNode && local.parentNode.removeChild(local);
      } catch (e) {
        local.style.display = 'none';
      }
      return;
    }

    if (typeof window.hideGlobalLoader === 'function') {
      window.hideGlobalLoader();
      return;
    }

    const globalModal = document.getElementById('global-loading-modal');
    if (globalModal) globalModal.style.display = 'none';
    try { document.body.style.overflow = ''; } catch (e) {}
  } catch (e) {
    console.warn('hideLoading error', e);
  }
}

// Expose compatibility names if ui-modals also defines them
window.showLoading = window.showLoading || showLoading;
window.hideLoading = window.hideLoading || hideLoading;

/* ==========================================================================
   Utility helpers
   ========================================================================== */
function escapeHtml(s) {
  if (!s) return '';
  return s.toString().replace(/[&<>"']/g, function(m){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
}

/* ==========================================================================
   Table update helpers (diffing to reduce DOM churn)
   ========================================================================== */
function ensureSectionState(sectionId) {
  if (!sectionStates[sectionId]) sectionStates[sectionId] = { requestId: 0, loading: false };
  return sectionStates[sectionId];
}

function setSectionHeaderLoading(sectionId, isLoading) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const actions = section.querySelector('.section-actions');
  if (!actions) return;
  let spinner = actions.querySelector('.section-spinner');
  if (isLoading) {
    if (!spinner) {
      spinner = document.createElement('div');
      spinner.className = 'section-spinner';
      spinner.innerHTML = `<div class="spinner-inline" aria-hidden="true"></div><span class="section-spinner-text">Updating...</span>`;
      actions.appendChild(spinner);
    } else {
      spinner.style.display = 'inline-flex';
    }
  } else {
    if (spinner) spinner.style.display = 'none';
  }
}

function createRowForApplication(app) {
  const tr = document.createElement('tr');

  const tdApp = document.createElement('td'); tdApp.className='app-number';
  const a = document.createElement('a'); a.href='javascript:void(0)'; a.className='app-number-link';
  a.textContent = app.appNumber || '';
  a.addEventListener('click', (e) => {
    // pass the anchor element so handler can show inline spinner next to it
    handleAppNumberClick(app.appNumber, e.currentTarget);
  });
  tdApp.appendChild(a); tr.appendChild(tdApp);

  const tdName = document.createElement('td'); tdName.className='applicant-name'; tdName.textContent = app.applicantName || 'N/A'; tr.appendChild(tdName);
  const tdAmount = document.createElement('td'); tdAmount.className='amount'; tdAmount.textContent = (app.amount==null?'0.00':Number(app.amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})); tr.appendChild(tdAmount);
  const tdDate = document.createElement('td'); tdDate.className='date'; tdDate.textContent = app.date ? new Date(app.date).toLocaleDateString() : 'N/A'; tr.appendChild(tdDate);
  const tdActionBy = document.createElement('td'); tdActionBy.className='action-by'; tdActionBy.textContent = app.actionBy || 'N/A'; tr.appendChild(tdActionBy);

  return tr;
}

function diffUpdateTable(tableId, applications) {
  const tbody = document.querySelector(`#${tableId}`);
  if (!tbody) return;

  const existingRows = new Map();
  Array.from(tbody.children).forEach(row => {
    const anchor = row.querySelector('.app-number-link');
    const key = anchor ? anchor.textContent : null;
    if (key) existingRows.set(key, row);
  });

  const frag = document.createDocumentFragment();

  applications.forEach(app => {
    const key = app.appNumber || '';
    const existing = existingRows.get(key);
    if (existing) {
      const nameCell = existing.querySelector('.applicant-name');
      const amountCell = existing.querySelector('.amount');
      const dateCell = existing.querySelector('.date');
      const actionByCell = existing.querySelector('.action-by');

      let changed = false;
      if ((nameCell && nameCell.textContent) !== (app.applicantName || 'N/A')) { if (nameCell) nameCell.textContent = app.applicantName || 'N/A'; changed = true; }
      const formattedAmount = (app.amount==null?'0.00':Number(app.amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}));
      if ((amountCell && amountCell.textContent) !== formattedAmount) { if (amountCell) amountCell.textContent = formattedAmount; changed = true; }
      const formattedDate = app.date ? new Date(app.date).toLocaleDateString() : 'N/A';
      if ((dateCell && dateCell.textContent) !== formattedDate) { if (dateCell) dateCell.textContent = formattedDate; changed = true; }
      if ((actionByCell && actionByCell.textContent) !== (app.actionBy || 'N/A')) { if (actionByCell) actionByCell.textContent = app.actionBy || 'N/A'; changed = true; }

      frag.appendChild(existing);

      if (changed) {
        existing.classList.remove('row-updated');
        void existing.offsetWidth;
        existing.classList.add('row-updated');
        setTimeout(() => existing.classList.remove('row-updated'), 1400);
      }
    } else {
      const newRow = createRowForApplication(app);
      newRow.classList.add('row-updated');
      frag.appendChild(newRow);
      setTimeout(() => newRow.classList.remove('row-updated'), 1400);
    }
  });

  tbody.replaceChildren(frag);
}

/* ==========================================================================
   Page initialization & session handling
   ========================================================================== */
function cacheElements() {
  const elements = {
    'logged-in-user': 'logged-in-user',
    'current-date': 'current-date',
    'loading': 'loading',
    'success-modal': 'success-modal',
    'success-message': 'success-message',
    'app-number': 'app-number',
    'user-notification-badge': 'user-notification-badge',
    'viewApplicationModal': 'viewApplicationModal'
  };
  for (const [key, id] of Object.entries(elements)) {
    cachedElements[key] = document.getElementById(id);
  }
}

window.addEventListener('load', function() {
  clearIntervals();
});

document.addEventListener('DOMContentLoaded', function() {
  cacheElements();
  const cd = cachedElements['current-date'];
  if (cd) {
    cd.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  initializeBrowserNotifications();
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const loggedInName = localStorage.getItem('loggedInName');
  if (loggedInName) {
    verifyUserOnLoad(loggedInName);
  } else {
    showLoginPage();
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const name = (document.getElementById('login-name') || {}).value?.trim();
      if (!name) { if (typeof window.showToast === 'function') window.showToast('Name is required!', 'error'); else alert('Name is required!'); return; }
      await handleLoginFunction(name);
    });
  }

  const addAppBtn = document.querySelector('.add-app-btn');
  if (addAppBtn) {
    addAppBtn.removeAttribute('onclick');
    addAppBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      e.stopPropagation();
      const ok = await loadModalContent('new');
      if (!ok) {
        if (typeof window.showToast === 'function') window.showToast('Failed to load application form. Please refresh the page.', 'error');
        else alert('Failed to load application form. Please refresh the page.');
        return;
      }
      if (typeof showNewApplicationModal === 'function') {
        showNewApplicationModal();
      }
    });
  }
});

/* ==========================================================================
   Authentication & session helpers
   ========================================================================== */
function showLoginPage() {
  document.body.classList.remove('logged-in');
  localStorage.removeItem('loggedInName');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userLevel');
  clearIntervals();
}

function showDashboard() {
  document.body.classList.add('logged-in');
  const loggedInName = localStorage.getItem('loggedInName');
  const userRole = localStorage.getItem('userRole');
  if (loggedInName) setLoggedInUser(loggedInName, userRole);
}

function setLoggedInUser(name, role = '') {
  const el = cachedElements['logged-in-user'];
  if (el) el.textContent = role ? `${name} (${role})` : name;
  if (name) updateUserNotificationBadge();
}

async function logout() {
  try {
    const ok = (typeof window.showConfirmModal === 'function')
      ? await window.showConfirmModal('Are you sure you want to logout?', { title: 'Confirm Logout', confirmText: 'Logout', cancelText: 'Cancel' })
      : confirm('Are you sure you want to logout?');

    if (!ok) return;

    localStorage.removeItem('loggedInName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userLevel');
    clearIntervals();
    showLoginPage();

    if (typeof window.showToast === 'function') window.showToast('Logged out', 'info');
  } catch (e) {
    console.error('logout error', e);
  }
}

function restrictIfNotLoggedIn() {
  const loggedInName = localStorage.getItem('loggedInName');
  if (!loggedInName) { showLoginPage(); return true; }
  return false;
}

async function verifyUserOnLoad(name) {
  try {
    showLoading('Verifying user...');
    const result = await window.apiService.login(name);
    hideLoading();
    if (result.success) {
      localStorage.setItem('userRole', result.user?.role || '');
      localStorage.setItem('userLevel', result.user?.level || '');
      setLoggedInUser(name, result.user?.role || '');
      showDashboard();
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      const newSection = document.getElementById('new');
      if (newSection) newSection.classList.add('active');
      initializeAppCount();
      initializeAndRefreshTables();
    } else {
      showLoginPage();
    }
  } catch (err) {
    hideLoading();
    console.error('verifyUserOnLoad error', err);
    showLoginPage();
  }
}

async function handleLoginFunction(name) {
  try {
    showLoading('Signing in...');
    const response = await window.apiService.login(name);
    hideLoading();
    if (response.success) {
      localStorage.setItem('loggedInName', name);
      localStorage.setItem('userRole', response.user?.role || '');
      localStorage.setItem('userLevel', response.user?.level || '');
      setLoggedInUser(name, response.user?.role || '');
      showDashboard();
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      const newSection = document.getElementById('new');
      if (newSection) newSection.classList.add('active');
      initializeAppCount();
      initializeAndRefreshTables();
    } else {
      if (typeof window.showToast === 'function') window.showToast(response.message || 'Authentication failed', 'error');
      else alert(response.message || 'Authentication failed');
    }
  } catch (err) {
    hideLoading();
    console.error('Login error', err);
    if (typeof window.showToast === 'function') window.showToast('Login error: ' + (err && err.message ? err.message : err), 'error');
    else alert('Login error: ' + (err && err.message ? err.message : err));
  }
}

/* ==========================================================================
   Modal loader (single) — loads newApps.html or viewApps.html into modal containers
   ========================================================================== */
async function loadModalContent(modalName = 'new') {
  const cfg = modalName === 'view' ? {
    url: 'viewApps.html',
    containerSelector: '#viewApplicationModal .modal-content',
    loadedAttr: 'data-view-loaded'
  } : {
    url: 'newApps.html',
    containerSelector: '#newApplicationModalContent',
    loadedAttr: 'data-new-loaded'
  };

  const container = document.querySelector(cfg.containerSelector);
  if (!container) {
    console.error('Modal container not found for', modalName, cfg.containerSelector);
    return false;
  }

  if (container.getAttribute(cfg.loadedAttr) === '1') {
    return true;
  }

  try {
    const resp = await fetch(cfg.url, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`Failed to fetch ${cfg.url}: ${resp.status}`);
    const html = await resp.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    if (modalName === 'view') {
      const fetchedModal = doc.getElementById('viewApplicationModal');
      if (fetchedModal) {
        const innerContent = fetchedModal.querySelector('.modal-content');
        if (innerContent) {
          const scripts = Array.from(innerContent.querySelectorAll('script'));
          scripts.forEach(s => s.parentNode && s.parentNode.removeChild(s));
          container.innerHTML = innerContent.innerHTML.trim();

          const inlineScripts = Array.from(doc.querySelectorAll('script'));
          inlineScripts.forEach(scriptEl => {
            try {
              const s = document.createElement('script');
              if (scriptEl.src) {
                s.src = scriptEl.src;
                s.async = false;
                document.body.appendChild(s);
              } else {
                s.type = 'text/javascript';
                s.text = scriptEl.textContent;
                document.body.appendChild(s);
              }
            } catch (e) {
              console.warn('Error executing fetched script', e);
            }
          });

          container.setAttribute(cfg.loadedAttr, '1');
          if (typeof window.viewApplicationModalInit === 'function') {
            try { window.viewApplicationModalInit(); } catch (e) { console.warn('viewApplicationModalInit error', e); }
          }
          return true;
        }
      }
    }

    const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts = [];
    const htmlWithoutScripts = html.replace(scriptRe, function(_, scriptContent) {
      scripts.push(scriptContent);
      return '';
    });

    container.innerHTML = htmlWithoutScripts.trim();

    scripts.forEach(scriptContent => {
      try {
        const s = document.createElement('script');
        s.type = 'text/javascript';
        s.text = scriptContent;
        document.body.appendChild(s);
      } catch (e) {
        console.error('Error executing modal inline script', e);
      }
    });

    container.setAttribute(cfg.loadedAttr, '1');

    if (modalName === 'new') {
      if (typeof window.initNewApplicationScripts === 'function') {
        try { window.initNewApplicationScripts(); } catch (e) { console.warn('initNewApplicationScripts error', e); }
      }
    } else {
      if (typeof window.viewApplicationModalInit === 'function') {
        try { window.viewApplicationModalInit(); } catch (e) { console.warn('viewApplicationModalInit error', e); }
      }
      if (typeof window.initViewApplicationModal === 'function') {
        try { window.initViewApplicationModal(); } catch (e) { /* ignore */ }
      }
    }

    return true;
  } catch (err) {
    console.error('loadModalContent failed', err);
    return false;
  }
}
async function loadModalContentIfNeeded(modalName = 'new') { return await loadModalContent(modalName); }
window.loadModalContent = loadModalContent;
window.loadModalContentIfNeeded = loadModalContentIfNeeded;

/* ==========================================================================
   Robust lazy-loader for User Management (loads HTML + JS on demand)
   ========================================================================== */
// in Main.js (modern approach)
async function loadUserMgtSection() {
  const container = document.getElementById('user-management-root');
  if (!container) return;

  if (container.dataset.loaded === '1') {
    // already loaded, call module init again if needed
    if (window.UserMgtModule && typeof window.UserMgtModule.initUserMgt === 'function') {
      await window.UserMgtModule.initUserMgt();
    }
    // ensure visible
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('add-user').classList.add('active');
    return;
  }

  // show placeholder while loading
  container.innerHTML = '<div style="padding:16px">Loading user management…</div>';

  try {
    // load module + html in parallel
    const [module, htmlResp] = await Promise.all([
      import('./UserMgt.js'),                 // must be served as module
      fetch('UserMgt.html', { cache: 'no-store' })
    ]);
    const html = await htmlResp.text();

    // inject HTML, mark loaded
    container.innerHTML = html;
    container.dataset.loaded = '1';

    // keep a ref to the imported module for later calls
    window.UserMgtModule = module;

    // init
    if (typeof module.initUserMgt === 'function') {
      await module.initUserMgt();
    }

    // reveal section and focus
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('add-user').classList.add('active');
    const nameInput = document.getElementById('new-user-name');
    if (nameInput) nameInput.focus();
  } catch (err) {
    console.error('Failed to load UserMgt:', err);
    container.innerHTML = `<div class="error">Failed to load user management: ${err.message}</div>`;
  }
}
/* ==========================================================================
   View modal flow
   ========================================================================== */
async function openViewApplicationModal(appData) {
  const ok = await loadModalContent('view');
  if (!ok) {
    if (typeof window.showToast === 'function') window.showToast('Failed to load view modal. Please refresh the page.', 'error');
    else alert('Failed to load view modal. Please refresh the page.');
    return;
  }

  const modal = document.getElementById('viewApplicationModal');
  if (!modal) {
    console.error('viewApplicationModal element not found');
    return;
  }

  modal.style.display = 'block';
  modal.classList.add('active');

  setTimeout(() => {
    try {
      modal.scrollIntoView({ behavior: 'auto', block: 'center' });
    } catch (e) {
      try { window.scrollTo(0, 0); } catch (e2) {}
    }
  }, 40);

  if (typeof window.initViewApplicationModal === 'function') {
    try {
      window.initViewApplicationModal(appData);
      return;
    } catch (e) {
      console.warn('initViewApplicationModal threw:', e);
    }
  }

  if (typeof window.viewApplication === 'function' && appData && appData.appNumber) {
    try {
      window.viewApplication(appData.appNumber);
    } catch (e) {
      console.error('viewApplication fallback failed', e);
    }
  }
}

function closeViewApplicationModal() {
  const modal = document.getElementById('viewApplicationModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
  try { document.body.style.overflow = ''; } catch (e) {}
  currentViewingAppData = null;
  sessionStorage.removeItem('currentViewingApp');
}
window.closeViewApplicationModal = closeViewApplicationModal;

/* ==========================================================================
   Load applications per section (NEW, PENDING, PENDING_APPROVAL, APPROVED)
   ========================================================================== */
async function loadApplications(sectionId, options = {}) {
  const map = { 'new': 'NEW','pending':'PENDING','pending-approvals':'PENDING APPROVAL','approved':'APPROVED' };
  const status = map[sectionId];
  if (!status) return;

  ensureSectionState(sectionId);
  const state = sectionStates[sectionId];
  state.requestId++;
  const requestId = state.requestId;

  const tbody = document.getElementById(`${sectionId}-list`);
  if (!tbody) return;

  const isAuto = options.isAutoRefresh || false;
  if (options.showLoading !== false && !isAuto) {
    setSectionHeaderLoading(sectionId, true);
    tbody.innerHTML = `<tr><td colspan="5" class="loading">Loading applications...</td></tr>`;
  } else {
    if (isAuto) {
      tbody.setAttribute('aria-busy','true');
    } else {
      tbody.setAttribute('aria-busy','true'); tbody.style.opacity='0.7';
    }
  }

  try {
    const response = await window.apiService.getApplications(status, { showLoading: false });
    if (state.requestId !== requestId) return;

    tbody.removeAttribute('aria-busy'); tbody.style.opacity='1';
    setSectionHeaderLoading(sectionId, false);

    if (response.success) {
      diffUpdateTable(`${sectionId}-list`, response.data || []);
    } else {
      if (!isAuto) tbody.innerHTML = `<tr><td colspan="5" class="error">Error: ${response.message}</td></tr>`;
      else console.warn('Auto-refresh error for', sectionId, response.message);
    }
  } catch (err) {
    if (state.requestId !== requestId) return;

    if (!isAuto) { tbody.removeAttribute('aria-busy'); tbody.style.opacity='1'; tbody.innerHTML = `<tr><td colspan="5" class="error">Error: ${err.message}</td></tr>`; setSectionHeaderLoading(sectionId, false); }
    else console.error('Auto-refresh network error for', sectionId, err);
  }
}

/* ==========================================================================
   Handle clicking application numbers (load details then open view modal)
   ========================================================================== */
async function handleAppNumberClick(appNumber, anchorEl = null) {
  if (!appNumber) { if (typeof window.showToast === 'function') window.showToast('Invalid application number', 'error'); else alert('Invalid application number'); return; }
  const userName = localStorage.getItem('loggedInName') || '';

  // Add inline spinner next to the clicked anchor (or find one)
  let spinner = null;
  try {
    if (!anchorEl) {
      const anchors = Array.from(document.querySelectorAll('.app-number-link'));
      anchorEl = anchors.find(a => a.textContent === appNumber) || null;
    }
    if (anchorEl) {
      spinner = document.createElement('span');
      spinner.className = 'inline-loading';
      spinner.innerHTML = `<span class="spinner-inline" aria-hidden="true" style="margin-left:8px;"></span>`;
      anchorEl.parentNode && anchorEl.parentNode.appendChild(spinner);
    }
  } catch (e) {
    console.warn('Could not show inline spinner', e);
  }

  try {
    const response = await window.apiService.getApplicationDetails(appNumber, userName, { showLoading: false });

    if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);

    if (response && response.success && response.data) {
      const appData = response.data;

      // If this application is a NEW draft, open the New Application modal (edit)
      if (appData.status === 'NEW' && (appData.completionStatus === 'DRAFT' || appData.completionStatus === 'Draft' || appData.completionStatus === 'draft')) {
        const ok = await loadModalContent('new');
        if (!ok) { if (typeof window.showToast === 'function') window.showToast('Failed to load form.', 'error'); else alert('Failed to load form.'); return; }
        if (typeof showNewApplicationModal === 'function') {
          showNewApplicationModal(appNumber);
        } else {
          const nm = document.getElementById('newApplicationModal');
          if (nm) nm.style.display = 'block';
        }
        return;
      }

      // Otherwise open view modal
      const okView = await loadModalContent('view');
      if (!okView) {
        if (typeof window.showToast === 'function') window.showToast('Failed to load view modal. Please refresh the page.', 'error');
        else alert('Failed to load view modal. Please refresh the page.');
        return;
      }

      const modal = document.getElementById('viewApplicationModal');
      if (modal) {
        modal.style.display = 'block';
        modal.classList.add('active');
      }

      if (typeof initViewApplicationModal === 'function') {
        try { initViewApplicationModal(appData); } catch (e) { console.warn('initViewApplicationModal error', e); }
      } else {
        await openViewApplicationModal(appData);
      }
    } else {
      if (typeof window.showToast === 'function') window.showToast('Failed to load application: ' + (response?.message || 'Not found'), 'error');
      else alert('Failed to load application: ' + (response?.message || 'Not found'));
    }
  } catch (err) {
    if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
    console.error('Error loading application details', err);
    if (typeof window.showToast === 'function') window.showToast('Error loading application details: ' + (err && err.message ? err.message : err), 'error');
    else alert('Error loading application details: ' + (err && err.message ? err.message : err));
  }
}

/* ==========================================================================
   Badges, notifications & periodic refresh
   ========================================================================== */
async function updateBadgeCounts() {
  try {
    const resp = await window.apiService.getApplicationCounts();
    if (resp.success && resp.data) {
      updateCount('new', resp.data.new || 0);
      updateCount('pending', resp.data.pending || 0);
      updateCount('pending-approvals', resp.data.pendingApprovals || 0);
      updateCount('approved', resp.data.approved || 0);
    }
  } catch (e) { console.error('updateBadgeCounts error', e); }
}
function updateCount(id, n) {
  const el = document.getElementById(id + '-count');
  if (!el) return;
  el.textContent = n; el.style.display = n > 0 ? 'inline-block' : 'none';
}

async function updateUserNotificationBadge() {
  const userName = localStorage.getItem('loggedInName'); if (!userName) return;
  try {
    const res = await window.apiService.getApplicationCountsForUser(userName);
    const count = res.count || 0;
    const badge = document.getElementById('user-notification-badge');
    if (badge) { if (count>0) { badge.textContent = count>99?'99+':count; badge.style.display='flex'; } else badge.style.display='none'; }
  } catch (e) { console.error('updateUserNotificationBadge', e); }
}

const debouncedRefreshApplications = debounce(async (isAuto=false) => {
  const activeSection = document.querySelector('.content-section.active')?.id;
  if (activeSection) {
    await loadApplications(activeSection, { showLoading: !isAuto, isAutoRefresh: isAuto });
    await updateBadgeCounts();
    await updateUserNotificationBadge();
  }
}, 300);

function refreshApplications() { debouncedRefreshApplications(false); }

async function initializeAndRefreshTables() {
  await loadApplications('new', { showLoading: true });
  await updateBadgeCounts();
  await updateUserNotificationBadge();
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(async () => {
    const active = document.querySelector('.content-section.active')?.id;
    if (active) {
      await loadApplications(active, { showLoading: false, isAutoRefresh: true });
      await updateBadgeCounts();
      await updateUserNotificationBadge();
    }
  }, 60000);
}

/* ==========================================================================
   Notifications (browser) & visibility handling
   ========================================================================== */
function initializeBrowserNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') setupNotificationListener();
  else if (Notification.permission === 'default') Notification.requestPermission().then(p => { if (p==='granted') setupNotificationListener(); });
}
function setupNotificationListener() {
  if (notificationCheckInterval) clearInterval(notificationCheckInterval);
  notificationCheckInterval = setInterval(() => { checkForNewApplications(); }, 30000);
}
async function checkForNewApplications() {
  const user = localStorage.getItem('loggedInName'); if (!user || document.visibilityState === 'visible') return;
  try {
    const r = await window.apiService.getApplicationCountsForUser(user);
    const current = r.count || 0; const previous = lastAppCount; lastAppCount = current;
    if (current > previous && previous > 0) {
      const newCount = current - previous; const role = localStorage.getItem('userRole') || '';
      if (Notification.permission === 'granted') {
        const n = new Notification('New Application Assignment', { body: `${user} have ${newCount} application(s) for your action${role?` as ${role}`:''}`, icon: 'https://img.icons8.com/color/192/000000/loan.png' });
        n.onclick = () => { window.focus(); n.close(); refreshApplications(); };
        setTimeout(()=>n.close(), 10000);
      }
    }
  } catch (e) { console.error('checkForNewApplications', e); }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') { refreshApplications(); updateUserNotificationBadge(); }
  else { const u = localStorage.getItem('loggedInName'); if (u) window.apiService.getApplicationCountsForUser(u).then(r => lastAppCount = r.count || 0).catch(() => {}); }
}
async function initializeAppCount() {
  const u = localStorage.getItem('loggedInName'); if (!u) return;
  try { const r = await window.apiService.getApplicationCountsForUser(u); lastAppCount = r.count || 0; } catch (e) { console.error('initializeAppCount', e); }
}

/* ==========================================================================
   Small UX helpers (success modal wrapper)
   ========================================================================== */
async function showSuccessModal(message, options = {}) {
  if (typeof window.showSuccessModal === 'function') {
    return window.showSuccessModal(message, options);
  }
  alert(message);
}
function closeSuccessModal() { if (typeof window.hideSuccessModal === 'function') return window.hideSuccessModal(); }

/* ==========================================================================
   Section navigation — delegates to loadUserMgtSection for user management
   ========================================================================== */
window.showSection = async function(sectionId) {
  if (restrictIfNotLoggedIn()) return;
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(sectionId); if (el) el.classList.add('active');

  // If user management section requested, call the loader in UserMgt.js
  if (sectionId === 'add-user') {
    if (typeof window.loadUserMgtSection === 'function') {
      try { await window.loadUserMgtSection(); } catch (e) { console.warn('loadUserMgtSection not available', e); }
    }
  }

  // Refresh table for the selected section if applicable
  await loadApplications(sectionId, { showLoading: true });
};
window.refreshApplications = refreshApplications;

/* ==========================================================================
   Exports for other scripts
   ========================================================================== */
window.closeViewApplicationModal = closeViewApplicationModal;
window.loadModalContent = loadModalContent;
window.loadModalContentIfNeeded = loadModalContentIfNeeded;
window.setLoggedInUser = setLoggedInUser;
window.refreshApplications = refreshApplications;

/* ==========================================================================
   End of Main.js
   ========================================================================== */



