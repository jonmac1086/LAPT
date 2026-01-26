

(function () {
  // Ensure single instance
  if (window.__ui_modals_installed) return;
  window.__ui_modals_installed = true;

  // Helper to create element from HTML
  function createElementFromHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstChild;
  }

  /* -----------------------------
     CSS container & Toast container
     ----------------------------- */
  const STYLE_ID = 'ui-modals-styles-loaded';
  // Consumer should include ui-modals.css; if not present we create minimal fallback styles inline
  if (!document.getElementById(STYLE_ID)) {
    // We do not inject the full css here to keep separation; prefer using ui-modals.css.
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
/* Minimal inline fallback styles (ui-modals.css recommended) */
.ui-global-loader, .ui-modal-overlay { font-family: Inter, system-ui, sans-serif; }
.ui-global-loader { display:none; position:fixed; inset:0; z-index:6000; align-items:center; justify-content:center; background:rgba(0,0,0,0.45); }
.ui-global-loader .ui-loader-card { background:#fff;padding:16px;border-radius:10px; display:flex; flex-direction:column; gap:10px; align-items:center; box-shadow:0 6px 20px rgba(0,0,0,0.12); min-width:220px; }
.ui-loader-spinner { border:4px solid rgba(0,0,0,0.08); border-top:4px solid #2563eb; width:40px; height:40px; border-radius:50%; animation:ui-spin 1s linear infinite; }
@keyframes ui-spin { to { transform: rotate(360deg); } }
.ui-modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:7000; align-items:center; justify-content:center; padding:20px; }
.ui-modal { background:#fff; border-radius:10px; min-width:300px; max-width:720px; width:100%; box-shadow:0 10px 30px rgba(2,6,23,0.2); padding:18px; }
.ui-modal .ui-modal-title { font-weight:700; margin-bottom:8px; color:#111827; }
.ui-modal .ui-modal-body { color:#374151; margin-bottom:12px; }
.ui-modal .ui-modal-actions { display:flex; gap:10px; justify-content:flex-end; }
.ui-btn { border-radius:8px; padding:8px 12px; border:1px solid transparent; cursor:pointer; font-weight:600; }
.ui-btn.primary { background:#2563eb; color:#fff; }
.ui-btn.ghost { background:transparent; color:#374151; border:1px solid #e5e7eb; }
.ui-toast-container { position:fixed; right:16px; bottom:16px; z-index:8000; display:flex; flex-direction:column; gap:8px; align-items:flex-end; }
.ui-toast { background:#111827; color:#fff; padding:10px 14px; border-radius:8px; box-shadow:0 6px 18px rgba(2,6,23,0.16); font-weight:600; opacity:0.98; }
.ui-toast.success { background:#059669; } .ui-toast.error { background:#dc2626; } .ui-toast.info { background:#2563eb; }
`;
    document.head.appendChild(style);
  }

  // Create and cache DOM nodes
  function ensureGlobalLoader() {
    let el = document.getElementById('ui-global-loader');
    if (el) return el;
    const html = `
      <div id="ui-global-loader" class="ui-global-loader" role="status" aria-live="polite" aria-hidden="true">
        <div class="ui-loader-card" role="dialog" aria-modal="true" aria-label="Loading">
          <div class="ui-loader-spinner" aria-hidden="true"></div>
          <div class="ui-loader-message">Processing...</div>
        </div>
      </div>
    `;
    const node = createElementFromHTML(html);
    document.body.appendChild(node);
    return node;
  }

  function ensureModalOverlay() {
    let el = document.getElementById('ui-modal-overlay');
    if (el) return el;
    const html = `
      <div id="ui-modal-overlay" class="ui-modal-overlay" role="presentation" aria-hidden="true">
        <!-- content injected dynamically -->
      </div>
    `;
    const node = createElementFromHTML(html);
    document.body.appendChild(node);
    return node;
  }

  function ensureToastContainer() {
    let el = document.getElementById('ui-toast-container');
    if (el) return el;
    const div = document.createElement('div');
    div.id = 'ui-toast-container';
    div.className = 'ui-toast-container';
    document.body.appendChild(div);
    return div;
  }

  // Loader reference counter so multiple show/hide don't conflict
  let loaderCount = 0;
  const loaderEl = ensureGlobalLoader();

  function showGlobalLoader(message = 'Processing...') {
    loaderCount++;
    try {
      const msg = loaderEl.querySelector('.ui-loader-message');
      if (msg) msg.textContent = message;
      loaderEl.style.display = 'flex';
      loaderEl.setAttribute('aria-hidden', 'false');
      // prevent body scroll while loader visible
      try { document.body.style.overflow = 'hidden'; } catch (e) {}
    } catch (e) {
      console.warn('showGlobalLoader error', e);
    }
  }

  function hideGlobalLoader(force = false) {
    if (force) loaderCount = 0;
    else loaderCount = Math.max(0, loaderCount - 1);
    if (loaderCount === 0) {
      try {
        loaderEl.style.display = 'none';
        loaderEl.setAttribute('aria-hidden', 'true');
        try { document.body.style.overflow = ''; } catch (e) {}
      } catch (e) {
        console.warn('hideGlobalLoader error', e);
      }
    }
  }

  /* -----------------------------
     Focus trap utilities
     ----------------------------- */
  function trapFocus(modalRoot) {
    if (!modalRoot) return function noop() {};
    const focusableSelectors = [
      'a[href]', 'area[href]', 'input:not([disabled])', 'select:not([disabled])',
      'textarea:not([disabled])', 'button:not([disabled])', 'iframe', '[tabindex]:not([tabindex="-1"])'
    ];
    const nodes = Array.from(modalRoot.querySelectorAll(focusableSelectors.join(','))).filter(n => n.offsetWidth || n.offsetHeight || n === document.activeElement);
    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    function handleKey(e) {
      if (e.key === 'Tab') {
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      } else if (e.key === 'Escape') {
        // Allow caller to handle escape by listening on overlay
      }
    }
    document.addEventListener('keydown', handleKey);
    return function release() { document.removeEventListener('keydown', handleKey); };
  }

  /* -----------------------------
     Generic modal builder & promise helpers
     ----------------------------- */
  const modalOverlay = ensureModalOverlay();

  function renderModal({ title = '', body = '', actions = [] }) {
    // actions: [{ text, className, closeOnClick = true, onClick }]
    const modal = document.createElement('div');
    modal.className = 'ui-modal';
    modal.tabIndex = -1;
    modal.innerHTML = `
      <div class="ui-modal-title">${title}</div>
      <div class="ui-modal-body">${body}</div>
      <div class="ui-modal-actions"></div>
    `;
    const actionsContainer = modal.querySelector('.ui-modal-actions');
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ui-btn ${a.className || ''}`.trim();
      btn.textContent = a.text || 'OK';
      btn.addEventListener('click', (ev) => {
        try {
          if (typeof a.onClick === 'function') a.onClick(ev);
        } catch (e) { console.error('action onClick error', e); }
        if (a.closeOnClick !== false) {
          closeModal();
        }
      });
      actionsContainer.appendChild(btn);
      if (a.autoFocus) {
        setTimeout(() => btn.focus(), 30);
      }
    });

    function closeModal() {
      releaseTrap && releaseTrap();
      modalOverlay.innerHTML = '';
      modalOverlay.style.display = 'none';
      modalOverlay.setAttribute('aria-hidden', 'true');
      try { document.body.style.overflow = ''; } catch (e) {}
      removeListeners();
    }

    // Setup accessible overlay
    modalOverlay.innerHTML = '';
    modalOverlay.appendChild(modal);
    modalOverlay.style.display = 'flex';
    modalOverlay.setAttribute('aria-hidden', 'false');

    // prevent background scroll
    try { document.body.style.overflow = 'hidden'; } catch (e) {}

    // click outside to close if overlay not modal-forced
    function overlayClick(e) {
      if (e.target === modalOverlay) {
        // simulate cancel if defined
        const cancelBtn = actions.find(a => a.role === 'cancel');
        if (cancelBtn) {
          if (typeof cancelBtn.onClick === 'function') cancelBtn.onClick();
        }
        // else close
        closeModal();
      }
    }
    modalOverlay.addEventListener('click', overlayClick);

    // focus trap
    const releaseTrap = trapFocus(modal);

    // cleanup listeners
    function removeListeners() {
      modalOverlay.removeEventListener('click', overlayClick);
    }

    // return close fn and modal node
    return { closeModal, modal };
  }

  // Promise-based success modal
  function showSuccessModal(message = 'Success', opts = {}) {
    const title = opts.title || 'Success';
    const primaryText = opts.primaryText || 'OK';
    const bodyHtml = `<div style="white-space:pre-wrap;">${escapeHtml(message)}</div>`;
    return new Promise((resolve) => {
      const actions = [
        {
          text: primaryText,
          className: 'primary',
          autoFocus: true,
          onClick: () => { resolve(true); }
        }
      ];
      const { closeModal } = renderModal({ title, body: bodyHtml, actions });
      // ensure resolved when modal closed via click outside or escape - add key listener
      function onKey(e) {
        if (e.key === 'Escape') {
          resolve(true);
          closeModal();
        }
      }
      document.addEventListener('keydown', onKey, { once: true });
    });
  }

  // Promise-based confirm modal
  function showConfirmModal(message = 'Are you sure?', opts = {}) {
    const title = opts.title || 'Please confirm';
    const confirmText = opts.confirmText || 'Yes';
    const cancelText = opts.cancelText || 'Cancel';
    const danger = !!opts.danger;
    const bodyHtml = `<div style="white-space:pre-wrap;">${escapeHtml(message)}</div>`;
    return new Promise((resolve) => {
      let resolved = false;
      const actions = [
        {
          text: cancelText,
          className: 'ghost',
          role: 'cancel',
          onClick: () => { if (!resolved) { resolved = true; resolve(false); } }
        },
        {
          text: confirmText,
          className: danger ? 'primary' : 'primary',
          autoFocus: true,
          onClick: () => { if (!resolved) { resolved = true; resolve(true); } }
        }
      ];
      const { closeModal } = renderModal({ title, body: bodyHtml, actions });
      // handle escape -> cancel
      function onKey(e) {
        if (e.key === 'Escape') {
          if (!resolved) { resolved = true; resolve(false); }
          closeModal();
        }
      }
      document.addEventListener('keydown', onKey, { once: true });
    });
  }

  // Toasts
  const toastContainer = ensureToastContainer();
  function showToast(message = '', type = 'info', { timeout = 4000 } = {}) {
    const toast = document.createElement('div');
    toast.className = `ui-toast ${type || 'info'}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    if (timeout > 0) {
      setTimeout(() => {
        toast.style.transition = 'opacity .3s ease, transform .3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(6px)';
        setTimeout(() => { try { toast.remove(); } catch (e) {} }, 300);
      }, timeout);
    }
    return toast;
  }

  // small helper to escape HTML
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* -----------------------------
     Expose API globally
     ----------------------------- */
  window.showGlobalLoader = showGlobalLoader;
  window.hideGlobalLoader = hideGlobalLoader;
  window.showSuccessModal = showSuccessModal;
  window.showConfirmModal = showConfirmModal;
  window.showToast = showToast;

  // Backwards-compatible names used in existing app
  if (!window.showLoading) window.showLoading = showGlobalLoader;
  else {
    // keep original but also expose new behavior under showGlobalLoader
    // Optionally you can replace existing: window.showLoading = showGlobalLoader;
  }
  if (!window.hideLoading) window.hideLoading = hideGlobalLoader;

})();
