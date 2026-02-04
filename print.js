
(function () {
  // ---- Helpers ----
  function isApplicationApproved() {
    const statusEl = document.getElementById('applicationStatusBadge');
    if (!statusEl) return false;
    const statusText = (statusEl.textContent || '').toUpperCase();
    return statusText.includes('APPROVED');
  }

  function confirmNonApprovedPrint() {
    if (typeof showConfirmModal === 'function') {
      return showConfirmModal(
        'This application is not marked as APPROVED. Print anyway?',
        { title: 'Confirm Print', confirmText: 'Print Anyway', cancelText: 'Cancel', danger: false }
      );
    }
    return confirm('This application is not marked as APPROVED. Print anyway?');
  }

  function convertInteractiveToStatic(container) {
    // inputs
    container.querySelectorAll('input').forEach(input => {
      try {
        const span = document.createElement('div');
        span.className = 'print-input-value';
        span.style.whiteSpace = 'pre-wrap';
        if (input.type === 'checkbox' || input.type === 'radio') {
          span.textContent = input.checked ? '✓' : '✕';
        } else if (input.type === 'file') {
          const siblingName = container.querySelector(`#${input.id}-name`);
          span.textContent = (siblingName && siblingName.textContent) ? siblingName.textContent : (input.value ? input.value.split('\\').pop() : 'Not uploaded');
        } else {
          span.textContent = input.value || input.placeholder || '';
        }
        input.parentNode && input.parentNode.replaceChild(span, input);
      } catch (e) {}
    });

    // textareas
    container.querySelectorAll('textarea').forEach(ta => {
      try {
        const div = document.createElement('div');
        div.className = 'print-textarea-value';
        div.style.whiteSpace = 'pre-wrap';
        div.textContent = ta.value || ta.placeholder || '';
        ta.parentNode && ta.parentNode.replaceChild(div, ta);
      } catch (e) {}
    });

    // selects
    container.querySelectorAll('select').forEach(sel => {
      try {
        const div = document.createElement('div');
        div.className = 'print-select-value';
        div.textContent = (sel.options && sel.selectedIndex >= 0) ? (sel.options[sel.selectedIndex].text || sel.value) : sel.value;
        sel.parentNode && sel.parentNode.replaceChild(div, sel);
      } catch (e) {}
    });

    // Turn buttons/links into non-clickable text (preserve label)
    container.querySelectorAll('a, button, [role="button"], input[type="button"], input[type="submit"]').forEach(el => {
      try {
        const span = document.createElement('span');
        span.className = 'print-button-placeholder';
        span.textContent = el.textContent || el.getAttribute('aria-label') || '';
        span.style.fontWeight = '600';
        span.style.color = '#000';
        el.parentNode && el.parentNode.replaceChild(span, el);
      } catch (e) {}
    });

    // Remove inline event handlers
    container.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes || []).forEach(attr => {
        if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      });
    });
  }

  // Expand any scrollable/height-constrained elements so full content is visible
  function expandScrollableContainers(root) {
    // Elements commonly scrollable: .modal-content, .table-container-scroll, .table-container, any with overflow:auto/scroll or fixed maxHeight
    const candidates = Array.from(root.querySelectorAll('*'));
    candidates.forEach(el => {
      try {
        const style = window.getComputedStyle(el);
        if (!style) return;
        // if element is explicitly scrollable, make it visible
        if (/(auto|scroll)/.test(style.overflow + style.overflowY + style.overflowX)) {
          el.style.overflow = 'visible';
          el.style.overflowY = 'visible';
          el.style.overflowX = 'visible';
        }
        // remove max-height/height constraints
        if (style.maxHeight && style.maxHeight !== 'none') {
          el.style.maxHeight = 'none';
        }
        if (style.height && style.height !== 'auto' && style.height !== '0px') {
          el.style.height = 'auto';
        }
      } catch (e) {}
    });

    // Specific common containers
    root.querySelectorAll('.modal-content, .table-container-scroll, .table-container, .documents-container, .upload-grid, .review-section, .view-details-section').forEach(el => {
      try {
        el.style.overflow = 'visible';
        el.style.maxHeight = 'none';
        el.style.height = 'auto';
      } catch (e) {}
    });

    // Force tables to expand (remove fixed widths inside scroll wrappers)
    root.querySelectorAll('table').forEach(tbl => {
      try {
        tbl.style.width = '100%';
        tbl.style.tableLayout = 'auto';
      } catch (e) {}
    });
  }

  // Wait for images to load (safely)
  function waitForImagesToLoad(node, timeout = 7000) {
    const imgs = Array.from(node.querySelectorAll('img'));
    if (!imgs.length) return Promise.resolve();
    return new Promise(resolve => {
      let remaining = imgs.length;
      let done = false;
      const checkFinish = () => {
        if (done) return;
        if (remaining <= 0) { done = true; resolve(); }
      };
      imgs.forEach(img => {
        if (img.complete && img.naturalWidth !== 0) {
          remaining--;
          checkFinish();
        } else {
          const ondone = () => { remaining--; cleanup(); checkFinish(); };
          const cleanup = () => { img.removeEventListener('load', ondone); img.removeEventListener('error', ondone); };
          img.addEventListener('load', ondone);
          img.addEventListener('error', ondone);
        }
      });
      setTimeout(() => { if (!done) { done = true; resolve(); } }, timeout);
    });
  }

  // Insert print-only stylesheet that hides other page content and sets page rules
  function insertPrintStyles() {
    const style = document.createElement('style');
    style.id = 'print-improved-style';
    style.type = 'text/css';
    style.textContent = `
      @media print {
        /* hide everything except our print wrapper */
        body * { visibility: hidden !important; }
        #print-wrapper, #print-wrapper * { visibility: visible !important; }
        #print-wrapper { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; box-sizing: border-box; padding: 10mm !important; }

        /* Remove scrollbars and ensure full content prints */
        .modal-content, .table-container-scroll, .table-container { overflow: visible !important; max-height: none !important; height: auto !important; }

        /* Tables - avoid breaking rows across pages where possible */
        table { page-break-inside: auto !important; border-collapse: collapse !important; }
        tr    { page-break-inside: avoid !important; page-break-after: auto !important; }
        thead { display: table-header-group !important; } 
        tfoot { display: table-footer-group !important; }

        /* Avoid breaks inside these major blocks */
        .review-section, .view-details-section, .section-block, .documents-container, .signatures-section, .upload-grid {
          page-break-inside: avoid !important;
        }

        /* Keep images constrained */
        img { max-width: 100% !important; height: auto !important; }

        /* Improve typography for print */
        body, #print-wrapper { font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif !important; color: #111 !important; background: #fff !important; }
      }

      /* Screen: ensure our print wrapper looks OK while modal displayed */
      #print-wrapper { background: #fff; color: #111; }
    `;
    document.head.appendChild(style);
    return style;
  }

  // Clean up print artifacts
  function cleanupPrintArtifacts(printWrapper, printStyle) {
    try { if (printWrapper && printWrapper.parentNode) printWrapper.parentNode.removeChild(printWrapper); } catch (e) {}
    try { if (printStyle && printStyle.parentNode) printStyle.parentNode.removeChild(printStyle); } catch (e) {}
    // remove temporary id on clone if left
    const tmp = document.getElementById('print-wrapper');
    if (!tmp) {
      // ok
    }
    // Rebind print buttons if needed
    try { if (typeof initPrint === 'function') initPrint(); } catch (e) {}
  }

  // ---- Main print function ----
  async function printApplicationDetails(options = {}) {
    const force = !!options.force;
    const showWarning = options.showWarning !== false;

    try {
      const modal = document.getElementById('viewApplicationModal');
      if (!modal || (modal.style.display === 'none' && !modal.classList.contains('active'))) {
        throw new Error('Please open an application first.');
      }

      if (!force && showWarning && !isApplicationApproved()) {
        const ok = await confirmNonApprovedPrint();
        if (!ok) return;
      }

      // Clone the modal (deep)
      const clone = modal.cloneNode(true);
      clone.id = 'print-modal-clone';

      // Remove scripts from clone
      clone.querySelectorAll('script').forEach(s => s.remove());

      // Convert interactive controls to static text
      convertInteractiveToStatic(clone);

      // Expand all scrollable/fixed-height containers inside the clone
      expandScrollableContainers(clone);

      // Ensure images in clone will attempt to load: copy data-src if used and remove lazy loading attr
      clone.querySelectorAll('img').forEach(img => {
        if (!img.src && img.getAttribute('data-src')) img.src = img.getAttribute('data-src');
        img.removeAttribute('loading');
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
      });

      // Remove elements not meant for print (explicit)
      clone.querySelectorAll('.no-print, .close-button, .action-btn, .tab-navigation, .add-button, .delete-button, .modal-footer, .compact-actions, .btn, .view-button').forEach(el => el.remove());

      // Build wrapper and attach clone
      const wrapper = document.createElement('div');
      wrapper.id = 'print-wrapper';
      // Make wrapper wide enough for A4 portrait content; padding used by print CSS will apply
      wrapper.style.background = '#fff';
      wrapper.style.color = '#111';
      wrapper.style.boxSizing = 'border-box';
      wrapper.appendChild(clone);

      // Add wrapper to body
      document.body.appendChild(wrapper);

      // Insert print styles (and keep reference for cleanup)
      const printStyle = insertPrintStyles();

      // Wait for images inside wrapper to load, then allow a short settle before printing
      await waitForImagesToLoad(wrapper, 7000);
      // small settle to ensure reflow
      await new Promise(res => setTimeout(res, 180));

      // Setup afterprint cleanup
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        cleanupPrintArtifacts(wrapper, printStyle);
      };
      window.addEventListener('afterprint', cleanup, { once: true });

      // Call print
      window.print();

      // fallback cleanup if afterprint didn't fire
      setTimeout(cleanup, 2500);

    } catch (err) {
      console.error('Print error:', err);
      if (typeof window.showToast === 'function') window.showToast('Print failed: ' + (err && err.message ? err.message : err), 'error');
      else alert('Print failed: ' + (err && err.message ? err.message : err));
    }
  }

  function quickPrint() {
    return printApplicationDetails({ showWarning: false, force: true });
  }

  function exportApplicationDetails() {
    if (typeof showConfirmModal === 'function') {
      return showConfirmModal('Export as PDF? Use the print dialog to "Save as PDF".', { title: 'Export', confirmText: 'Export', cancelText: 'Cancel' })
        .then(ok => { if (ok) printApplicationDetails({ force: true, showWarning: false }); });
    }
    if (confirm('Export as PDF?\n\nClick OK, then choose "Save as PDF" in the print dialog.')) {
      printApplicationDetails({ force: true, showWarning: false });
    }
  }

  function initPrint() {
    const printBtn = document.getElementById('btn-print');
    if (printBtn) printBtn.onclick = () => printApplicationDetails();
    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) exportBtn.onclick = () => exportApplicationDetails();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPrint);
  else initPrint();

  // Expose
  window.printApplicationDetails = printApplicationDetails;
  window.exportApplicationDetails = exportApplicationDetails;
  window.quickPrint = quickPrint;

  console.log('Improved print module loaded (expanded scroll containers, page-break rules)');
})();
