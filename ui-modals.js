// ui-modals.js - Modernized modal & toast system
// - Promise-based showConfirmModal/showSuccessModal
// - showGlobalLoader / hideGlobalLoader (ref-counted)
// - showToast with stacked toasts
// - Modal stacking, focus trap, ESC to close, backdrop click
// - Backwards-compatible with previous API names

(function () {
  if (window.__ui_modals_installed) return;
  window.__ui_modals_installed = true;

  /* ---------- Helpers ---------- */
  function createElementFromHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstChild;
  }
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  /* ---------- DOM containers ---------- */
  // Modal overlay container (singleton)
  let modalRoot = document.getElementById('ui-modal-overlay');
  if (!modalRoot) {
    modalRoot = document.createElement('div');
    modalRoot.id = 'ui-modal-overlay';
    modalRoot.className = 'ui-modal-overlay';
    modalRoot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(modalRoot);
  }

  // Global loader
  let globalLoader = document.getElementById('ui-global-loader');
  if (!globalLoader) {
    globalLoader = document.createElement('div');
    globalLoader.id = 'ui-global-loader';
    globalLoader.className = 'ui-global-loader';
    globalLoader.innerHTML = `
      <div class="ui-loader-card" role="status" aria-live="polite" aria-label="Loading">
        <div class="ui-loader-spinner" aria-hidden="true"></div>
        <div class="ui-loader-message">Processing...</div>
      </div>`;
    document.body.appendChild(globalLoader);
  }

  // Toast container
  let toastContainer = document.getElementById('ui-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'ui-toast-container';
    toastContainer.className = 'ui-toast-container';
    document.body.appendChild(toastContainer);
  }

  /* ---------- Loader: reference counted ---------- */
  let loaderCount = 0;
  function showGlobalLoader(message = 'Processing...') {
    loaderCount++;
    try {
      const msg = globalLoader.querySelector('.ui-loader-message');
      if (msg) msg.textContent = message;
      globalLoader.classList.add('active');
      globalLoader.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    } catch (e) { console.warn(e); }
  }
  function hideGlobalLoader(force = false) {
    if (force) loaderCount = 0;
    else loaderCount = Math.max(0, loaderCount - 1);
    if (loaderCount === 0) {
      try {
        globalLoader.classList.remove('active');
        globalLoader.style.display = 'none';
        document.body.style.overflow = '';
      } catch (e) {}
    }
  }

  /* ---------- Focus trap ---------- */
  function trapFocus(modalEl) {
    if (!modalEl) return () => {};
    const selectors = 'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';
    const nodes = Array.from(modalEl.querySelectorAll(selectors)).filter(n => n.offsetWidth || n.offsetHeight || n === document.activeElement);
    const first = nodes[0] || modalEl;
    const last = nodes[nodes.length - 1] || modalEl;
    function handleKey(e) {
      if (e.key === 'Tab') {
        if (nodes.length === 0) { e.preventDefault(); return; }
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      } else if (e.key === 'Escape') {
        // do nothing here; modal listeners will handle ESC closing if allowed
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }

  /* ---------- Modal stack implementation ---------- */
  const modalStack = [];

  function renderModal({ title = '', body = '', actions = [], options = {} } = {}) {
    // options: { width, ariaLabel, closeOnBackdrop=true, escapeCloses=true }
    const id = 'ui-modal-' + Math.random().toString(36).slice(2,9);
    const modalWrapper = document.createElement('div');
    modalWrapper.className = 'ui-modal';
    modalWrapper.id = id;
    modalWrapper.tabIndex = -1;
    modalWrapper.setAttribute('role', 'dialog');
    modalWrapper.setAttribute('aria-modal', 'true');
    modalWrapper.setAttribute('aria-label', options.ariaLabel || title || 'Dialog');

    // header
    const header = document.createElement('div'); header.className = 'ui-modal-header';
    const titleNode = document.createElement('div'); titleNode.className = 'ui-modal-title'; titleNode.innerHTML = escapeHtml(title || '');
    header.appendChild(titleNode);
    const closeBtn = document.createElement('button'); closeBtn.className = 'ui-btn ghost'; closeBtn.type='button'; closeBtn.setAttribute('aria-label','Close'); closeBtn.innerHTML = 'Close';
    header.appendChild(closeBtn);

    // body
    const bodyNode = document.createElement('div'); bodyNode.className = 'ui-modal-body';
    if (typeof body === 'string') bodyNode.innerHTML = body;
    else bodyNode.appendChild(body);

    // actions
    const actionsNode = document.createElement('div'); actionsNode.className = 'ui-modal-actions';
    actions.forEach((a, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ui-btn ' + (a.className || '');
      btn.textContent = a.text || 'OK';
      if (a.autoFocus) setTimeout(() => btn.focus(), 30);
      btn.addEventListener('click', (ev) => {
        try { if (typeof a.onClick === 'function') a.onClick(ev); } catch (e) { console.error(e); }
        if (a.closeOnClick !== false) close();
      });
      actionsNode.appendChild(btn);
    });

    modalWrapper.appendChild(header);
    modalWrapper.appendChild(bodyNode);
    modalWrapper.appendChild(actionsNode);

    // overlay item that contains the modal (for stacking)
    const overlayItem = document.createElement('div');
    overlayItem.className = 'ui-modal-overlay-item';
    overlayItem.style.position = 'fixed';
    overlayItem.style.inset = 0;
    overlayItem.style.display = 'flex';
    overlayItem.style.alignItems = 'center';
    overlayItem.style.justifyContent = 'center';
    overlayItem.style.zIndex = String( (Number(getComputedStyle(modalRoot).zIndex) || 7000) + modalStack.length + 1 );
    overlayItem.style.background = 'linear-gradient(0deg, rgba(2,6,23,0.4), rgba(2,6,23,0.28))';
    overlayItem.appendChild(modalWrapper);

    // helpers to remove
    let releaseTrap = null;
    let resolved = false;

    function close(result) {
      if (resolved) return;
      resolved = true;
      try {
        modalRoot.removeChild(overlayItem);
        const idx = modalStack.indexOf(overlayItem);
        if (idx >= 0) modalStack.splice(idx, 1);
      } catch (e) {}
      try { if (releaseTrap) releaseTrap(); } catch (e) {}
      try { document.body.style.overflow = ''; } catch(e){}
      if (typeof options.onClose === 'function') options.onClose(result);
      if (promiseResolve) promiseResolve(result);
    }

    // close on backdrop
    overlayItem.addEventListener('click', (e) => {
      if (e.target === overlayItem && options.closeOnBackdrop !== false) close(null);
    });

    // close button
    closeBtn.addEventListener('click', () => close(null));

    // keyboard: escape
    function handleEsc(e) { if (e.key === 'Escape' && options.escapeCloses !== false) close(null); }
    document.addEventListener('keydown', handleEsc);

    // focus trap
    releaseTrap = trapFocus(modalWrapper);

    // When removed: cleanup listeners
    const cleanupOnRemove = () => {
      document.removeEventListener('keydown', handleEsc);
      if (releaseTrap) releaseTrap();
    };

    // push onto stack & display
    modalStack.push(overlayItem);
    modalRoot.appendChild(overlayItem);
    document.body.style.overflow = 'hidden';
    setTimeout(() => modalWrapper.focus(), 40);

    // Promise for caller
    let promiseResolve;
    const promise = new Promise((resolve) => { promiseResolve = resolve; });

    // return API
    return { close, modal: modalWrapper, overlay: overlayItem, promise, cleanup: cleanupOnRemove };
  }

  /* ---------- Simple convenience modals (promise-based) ---------- */
  async function showSuccessModal(message = 'Success', opts = {}) {
    const title = opts.title || 'Success';
    const primaryText = opts.primaryText || 'OK';
    const modal = renderModal({
      title,
      body: `<div style="white-space:pre-wrap;">${escapeHtml(message)}</div>`,
      actions: [
        { text: primaryText, className: 'primary', autoFocus: true, onClick: () => {} }
      ],
      options: { closeOnBackdrop: true, escapeCloses: true }
    });
    // Resolve when modal closes: since action buttons call close(), we just return modal.promise
    return modal.promise;
  }

  async function showConfirmModal(message = 'Are you sure?', opts = {}) {
    const title = opts.title || 'Please confirm';
    const confirmText = opts.confirmText || 'Yes';
    const cancelText = opts.cancelText || 'Cancel';
    const danger = !!opts.danger;
    // Build modal
    let resolveFn;
    const modal = renderModal({
      title,
      body: `<div style="white-space:pre-wrap;">${escapeHtml(message)}</div>`,
      actions: [
        {
          text: cancelText,
          className: 'ghost',
          onClick: () => { modal.close(false); }
        },
        {
          text: confirmText,
          className: danger ? 'danger' : 'primary',
          autoFocus: true,
          onClick: () => { modal.close(true); }
        }
      ],
      options: { closeOnBackdrop: false, escapeCloses: true }
    });
    return modal.promise;
  }

  /* ---------- Toasts ---------- */
  let toastId = 0;
  function showToast(message = '', type = 'info', { timeout = 4000, action } = {}) {
    const id = ++toastId;
    const toast = document.createElement('div');
    toast.className = 'ui-toast ' + (type || 'info');
    toast.setAttribute('role','status');
    toast.setAttribute('aria-live','polite');
    toast.dataset.toastId = String(id);

    const body = document.createElement('div'); body.className = 'toast-body'; body.textContent = message;
    const actions = document.createElement('div'); actions.className = 'toast-actions';

    if (action && action.text) {
      const actBtn = document.createElement('button');
      actBtn.className = 'ui-btn ghost';
      actBtn.textContent = action.text;
      actBtn.addEventListener('click', () => {
        try { action.onClick && action.onClick(); } catch (e) {}
        remove();
      });
      actions.appendChild(actBtn);
    }

    const close = document.createElement('button');
    close.className = 'toast-close';
    close.setAttribute('aria-label','Dismiss');
    close.innerHTML = '&#10005;';
    close.addEventListener('click', remove);

    toast.appendChild(body);
    toast.appendChild(actions);
    toast.appendChild(close);
    toastContainer.appendChild(toast);

    let hideTimeout = null;
    function startTimer() {
      if (timeout > 0) hideTimeout = setTimeout(remove, timeout);
    }
    function clearTimer() { if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; } }

    toast.addEventListener('mouseenter', clearTimer);
    toast.addEventListener('mouseleave', startTimer);
    startTimer();

    function remove() {
      clearTimer();
      try { toast.style.opacity = '0'; toast.style.transform = 'translateY(6px)'; } catch (e) {}
      setTimeout(() => { try { toast.remove(); } catch(e){} }, 220);
    }
    return toast;
  }

  /* ---------- Backwards compat & exports ---------- */
  window.showGlobalLoader = showGlobalLoader;
  window.hideGlobalLoader = hideGlobalLoader;
  window.showSuccessModal = showSuccessModal;
  window.showConfirmModal = showConfirmModal;
  window.showToast = showToast;

  // Also keep older names if expected
  if (!window.showLoading) window.showLoading = showGlobalLoader;
  if (!window.hideLoading) window.hideLoading = hideGlobalLoader;

  // Expose a tiny API for advanced usage
  window.__ui_modals = {
    renderModal,
    showGlobalLoader,
    hideGlobalLoader,
    showSuccessModal,
    showConfirmModal,
    showToast
  };

  console.log('ui-modals.js (modern) loaded');
})();
