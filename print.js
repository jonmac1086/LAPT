// Improved print.js - clean print clone of viewApplicationModal suitable for PDF export
// - Converts inputs/textareas/selects to static text preserving values
// - Removes interactive elements and inline handlers
// - Waits for images to load before calling print
// - Cleans up after printing using beforeprint/afterprint handlers

// Check if application is approved
function isApplicationApproved() {
  const statusEl = document.getElementById('applicationStatusBadge');
  if (!statusEl) return false;
  const statusText = (statusEl.textContent || '').toUpperCase();
  return statusText.includes('APPROVED');
}

// Simple confirmation for non-approved applications
function confirmNonApprovedPrint() {
  if (typeof showConfirmModal === 'function') {
    return showConfirmModal(
      'This application is not marked as APPROVED. Print anyway?',
      {
        title: 'Confirm Print',
        confirmText: 'Print Anyway',
        cancelText: 'Cancel',
        danger: false
      }
    );
  }
  return confirm('This application is not marked as APPROVED. Print anyway?');
}

// Utility: replace form controls with static read-only equivalents
function convertInteractiveToStatic(container) {
  // Inputs
  container.querySelectorAll('input').forEach(input => {
    try {
      const span = document.createElement('div');
      span.className = 'print-input-value';
      span.style.whiteSpace = 'pre-wrap';
      if (input.type === 'checkbox' || input.type === 'radio') {
        span.textContent = input.checked ? '✓' : '✕';
      } else if (input.type === 'file') {
        // try to pick up adjacent file-name spans, fallback to input.value
        const siblingName = container.querySelector(`#${input.id}-name`);
        span.textContent = (siblingName && siblingName.textContent) ? siblingName.textContent : (input.value ? input.value.split('\\').pop() : 'Not uploaded');
      } else {
        span.textContent = input.value || input.placeholder || '';
      }
      input.parentNode && input.parentNode.replaceChild(span, input);
    } catch (e) {
      // ignore and continue
    }
  });

  // Textareas
  container.querySelectorAll('textarea').forEach(ta => {
    try {
      const div = document.createElement('div');
      div.className = 'print-textarea-value';
      div.style.whiteSpace = 'pre-wrap';
      div.textContent = ta.value || ta.placeholder || '';
      ta.parentNode && ta.parentNode.replaceChild(div, ta);
    } catch (e) {}
  });

  // Selects
  container.querySelectorAll('select').forEach(sel => {
    try {
      const div = document.createElement('div');
      div.className = 'print-select-value';
      div.textContent = (sel.options && sel.selectedIndex >= 0) ? (sel.options[sel.selectedIndex].text || sel.value) : sel.value;
      sel.parentNode && sel.parentNode.replaceChild(div, sel);
    } catch (e) {}
  });

  // Remove or neutralize clickable elements & inline handlers
  container.querySelectorAll('a, button, [role="button"], input[type="button"], input[type="submit"]').forEach(el => {
    try {
      // convert to non-clickable span preserving text
      const span = document.createElement('span');
      span.className = 'print-button-placeholder';
      span.textContent = el.textContent || el.getAttribute('aria-label') || '';
      // copy basic style hints for print aesthetics
      span.style.fontWeight = '600';
      span.style.color = '#000';
      el.parentNode && el.parentNode.replaceChild(span, el);
    } catch (e) {}
  });

  // Remove onclick and on* attributes to avoid accidental behavior
  container.querySelectorAll('*').forEach(el => {
    // Remove inline event handlers
    Array.from(el.attributes || []).forEach(attr => {
      if (/^on/i.test(attr.name)) {
        el.removeAttribute(attr.name);
      }
    });
    // Remove style that hides content in print if necessary (we rely on print.css)
  });

  // For document view buttons that show "Not Uploaded", ensure text remains visible
  container.querySelectorAll('input[type="file"]').forEach(f => {
    const span = document.createElement('div');
    span.className = 'print-file-value';
    span.textContent = 'Not uploaded';
    f.parentNode && f.parentNode.replaceChild(span, f);
  });
}

// Wait for all images inside the node to either load or error (with timeout)
function waitForImagesToLoad(node, timeout = 5000) {
  const imgs = Array.from(node.querySelectorAll('img'));
  if (!imgs.length) return Promise.resolve();
  return new Promise((resolve) => {
    let remaining = imgs.length;
    let called = false;
    const finish = () => {
      if (called) return;
      called = true;
      resolve();
    };
    imgs.forEach(img => {
      if (img.complete) {
        remaining--;
        if (remaining === 0) finish();
      } else {
        const onload = () => { remaining--; cleanup(); if (remaining === 0) finish(); };
        const onerror = () => { remaining--; cleanup(); if (remaining === 0) finish(); };
        const cleanup = () => {
          img.removeEventListener('load', onload);
          img.removeEventListener('error', onerror);
        };
        img.addEventListener('load', onload);
        img.addEventListener('error', onerror);
      }
    });
    // safety timeout
    setTimeout(() => finish(), timeout);
  });
}

// Main print function - improved clone approach
async function printApplicationDetails(options = {}) {
  const force = !!options.force;
  const showWarning = options.showWarning !== false;

  try {
    // Check if view modal is open
    const modal = document.getElementById('viewApplicationModal');
    if (!modal || (modal.style.display === 'none' && !modal.classList.contains('active'))) {
      throw new Error('Please open an application first.');
    }

    // Check approval status
    if (!force && showWarning && !isApplicationApproved()) {
      const shouldPrint = await confirmNonApprovedPrint();
      if (!shouldPrint) return;
    }

    // Clone modal for printing
    const clone = modal.cloneNode(true);
    clone.id = 'print-view';
    clone.style.position = 'relative';
    clone.style.display = 'block';
    clone.style.visibility = 'visible';
    clone.style.maxWidth = '100%';
    clone.style.boxSizing = 'border-box';
    clone.style.background = 'white';
    clone.style.padding = '0';
    clone.style.margin = '0';
    clone.style.zIndex = '2147483647';

    // Remove all <script> elements in the clone
    clone.querySelectorAll('script').forEach(s => s.remove());

    // Remove interactive elements & convert inputs to static text
    convertInteractiveToStatic(clone);

    // Remove elements explicitly not for print (by class)
    clone.querySelectorAll('.no-print, .close-button, .action-btn, .tab-navigation, .add-button, .delete-button, .modal-footer, .compact-actions, .btn, .view-button').forEach(el => el.remove());

    // Remove attributes that may cause issues (onclick etc); already attempted in convertInteractiveToStatic
    clone.querySelectorAll('[onclick]').forEach(el => el.removeAttribute('onclick'));

    // Ensure images have absolute URLs and will be loaded
    const imgs = clone.querySelectorAll('img');
    imgs.forEach(img => {
      // ensure src is present; if data-src style used, copy it
      if (!img.src && img.getAttribute('data-src')) img.src = img.getAttribute('data-src');
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.removeAttribute('loading'); // ensure immediate load
    });

    // Prepare print wrapper that isolates the printed content visually
    const wrapper = document.createElement('div');
    wrapper.id = 'print-wrapper';
    wrapper.style.background = '#fff';
    wrapper.style.color = '#111';
    wrapper.style.padding = '18px';
    wrapper.style.boxSizing = 'border-box';
    wrapper.appendChild(clone);

    // Insert wrapper into document but hide the rest via print-only CSS using beforeprint/afterprint handlers
    // We'll add an overlay container for print which will be visible only for printing
    document.body.appendChild(wrapper);

    // Hide everything else by adding a temporary style that makes body children hidden except our #print-wrapper when printing
    const printStyle = document.createElement('style');
    printStyle.id = 'print-temp-style';
    printStyle.type = 'text/css';
    printStyle.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        #print-wrapper, #print-wrapper * { visibility: visible !important; }
        #print-wrapper { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; }
        /* avoid print of unwanted scrollbars */
        ::-webkit-scrollbar { display:none; }
      }
      /* Ensure print-wrapper looks good on screen briefly while printing */
      #print-wrapper { background: #fff; color: #111; }
    `;
    document.head.appendChild(printStyle);

    // Wait for images to load in clone before printing
    await waitForImagesToLoad(clone, 7000);

    // Setup cleanup handlers
    let cleaned = false;
    function cleanupPrintArtifacts() {
      if (cleaned) return;
      cleaned = true;
      try {
        const el = document.getElementById('print-wrapper');
        if (el && el.parentNode) el.parentNode.removeChild(el);
      } catch (e) {}
      try {
        const st = document.getElementById('print-temp-style');
        if (st && st.parentNode) st.parentNode.removeChild(st);
      } catch (e) {}
      // restore any lost state (re-run initPrint to rebind print/export buttons)
      try { if (typeof initPrint === 'function') initPrint(); } catch (e) {}
    }

    // Use beforeprint/afterprint where supported to ensure cleanup
    const onAfterPrint = () => {
      cleanupPrintArtifacts();
      try { window.removeEventListener('afterprint', onAfterPrint); } catch (e) {}
    };
    window.addEventListener('afterprint', onAfterPrint);

    // Trigger print dialog
    // Some browsers fire beforeprint/afterprint; print() is synchronous-ish but we use afterprint to cleanup
    window.print();

    // Fallback cleanup in 2 seconds (in case afterprint doesn't fire)
    setTimeout(() => cleanupPrintArtifacts(), 2500);

  } catch (error) {
    console.error('Print error:', error);
    if (typeof window.showToast === 'function') window.showToast(`Print failed: ${error.message}`, 'error');
    else alert(`Print failed: ${error.message}`);
  }
}

// Quick print without warnings
function quickPrint() {
  return printApplicationDetails({
    showWarning: false,
    force: true
  });
}

// Export function (opens print dialog and user selects "Save as PDF")
function exportApplicationDetails() {
  if (typeof showConfirmModal === 'function') {
    return showConfirmModal('Export as PDF? Use the print dialog to "Save as PDF".', { title: 'Export', confirmText: 'Export', cancelText: 'Cancel' })
      .then(ok => { if (ok) printApplicationDetails({ force: true, showWarning: false }); });
  }
  if (confirm('Export as PDF?\n\nClick OK, then choose "Save as PDF" in the print dialog.')) {
    printApplicationDetails({ force: true, showWarning: false });
  }
}

// Simple initialization - rebinds buttons in the view modal
function initPrint() {
  const printBtn = document.getElementById('btn-print');
  if (printBtn) {
    printBtn.onclick = () => printApplicationDetails();
  }

  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) {
    exportBtn.onclick = () => exportApplicationDetails();
  }
}

// Initialize when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPrint);
} else {
  initPrint();
}

// Global exports
window.printApplicationDetails = printApplicationDetails;
window.exportApplicationDetails = exportApplicationDetails;
window.quickPrint = quickPrint;

console.log('Improved print module loaded - prints a clean, static clone of the view modal');
