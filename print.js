// print.js - in-page print approach (no popups)
// - Clones the viewApplicationModal into a print-only container in the same document
// - Expands scrollable elements, converts inputs/selects/textareas to static values
// - Injects print-only CSS to hide the rest of the page and enforce page-breaks
// - Waits for images to load and calls window.print()
// - Cleans up and restores original state after printing (afterprint + timeout fallback)

(function () {
  'use strict';

  // ---- Helpers ----
  function log(...args) { try { console.log('[print]', ...args); } catch(e) {} }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function convertInteractiveToStatic(root) {
    // inputs
    root.querySelectorAll('input').forEach(input => {
      try {
        const span = document.createElement('div');
        span.className = 'print-input-value';
        span.style.whiteSpace = 'pre-wrap';
        if (input.type === 'checkbox' || input.type === 'radio') {
          span.textContent = input.checked ? '✓' : '✕';
        } else if (input.type === 'file') {
          const siblingName = root.querySelector(`#${input.id}-name`);
          span.textContent = (siblingName && siblingName.textContent) ? siblingName.textContent : (input.value ? input.value.split('\\').pop() : 'Not uploaded');
        } else {
          span.textContent = input.value || input.placeholder || '';
        }
        input.parentNode && input.parentNode.replaceChild(span, input);
      } catch (e) { /* ignore */ }
    });

    // textareas
    root.querySelectorAll('textarea').forEach(ta => {
      try {
        const div = document.createElement('div');
        div.className = 'print-textarea-value';
        div.style.whiteSpace = 'pre-wrap';
        div.textContent = ta.value || ta.placeholder || '';
        ta.parentNode && ta.parentNode.replaceChild(div, ta);
      } catch (e) {}
    });

    // selects
    root.querySelectorAll('select').forEach(sel => {
      try {
        const div = document.createElement('div');
        div.className = 'print-select-value';
        const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text || sel.value : sel.value;
        div.textContent = opt || '';
        sel.parentNode && sel.parentNode.replaceChild(div, sel);
      } catch (e) {}
    });

    // Remove inline event handlers to be safe
    root.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes || []).forEach(attr => {
        if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      });
    });
  }

  function expandScrollables(root) {
    // Make overflow visible, remove max-height / height where possible
    Array.from(root.querySelectorAll('*')).forEach(el => {
      try {
        const cs = window.getComputedStyle(el);
        if (!cs) return;
        if (/(auto|scroll)/.test(cs.overflow + cs.overflowY + cs.overflowX)) {
          el.style.overflow = 'visible';
          el.style.overflowY = 'visible';
          el.style.overflowX = 'visible';
        }
        if (cs.maxHeight && cs.maxHeight !== 'none') el.style.maxHeight = 'none';
        if (cs.height && cs.height !== 'auto') el.style.height = 'auto';
      } catch (e) {}
    });

    // Common classes explicitly
    ['.modal-content', '.table-container-scroll', '.table-container', '.documents-container', '.upload-grid', '.review-section', '.view-details-section'].forEach(sel => {
      root.querySelectorAll(sel).forEach(el => {
        try { el.style.overflow = 'visible'; el.style.maxHeight = 'none'; el.style.height = 'auto'; } catch(e) {}
      });
    });

    // Tables: allow natural height
    root.querySelectorAll('table').forEach(t => {
      try { t.style.tableLayout = 'auto'; t.style.width = '100%'; } catch(e) {}
    });
  }

  function insertPageBreaks(root) {
    // Insert page break element after certain semantic blocks where appropriate
    const selectors = ['.section-block', '.review-section', '.view-details-section', '.documents-container', '.signatures-section'];
    selectors.forEach(sel => {
      Array.from(root.querySelectorAll(sel)).forEach(el => {
        try {
          // Avoid adding duplicate breaks
          const next = el.nextElementSibling;
          if (next && next.classList && next.classList.contains('print-page-break')) return;
          const br = document.createElement('div');
          br.className = 'print-page-break';
          br.style.pageBreakAfter = 'always';
          br.style.breakAfter = 'page';
          // insert after element
          el.parentNode && el.parentNode.insertBefore(br, el.nextSibling);
        } catch (e) {}
      });
    });
  }

  function waitForImages(root, timeout = 8000) {
    const imgs = Array.from(root.querySelectorAll('img'));
    if (!imgs.length) return Promise.resolve();
    return new Promise(resolve => {
      let remaining = imgs.length;
      let finished = false;
      const check = () => { if (finished) return; if (remaining <= 0) { finished = true; resolve(); } };
      imgs.forEach(img => {
        if (img.complete && img.naturalWidth !== 0) { remaining--; check(); }
        else {
          const ondone = () => { remaining--; cleanup(); check(); };
          const cleanup = () => { img.removeEventListener('load', ondone); img.removeEventListener('error', ondone); };
          img.addEventListener('load', ondone);
          img.addEventListener('error', ondone);
        }
      });
      setTimeout(() => { if (!finished) { finished = true; resolve(); } }, timeout);
    });
  }

  function createPrintStyle() {
    const style = document.createElement('style');
    style.id = 'print-temp-style';
    style.type = 'text/css';
    style.textContent = `
      /* Hide everything except the print wrapper during printing */
      @media print {
        body * { visibility: hidden !important; }
        #print-wrapper, #print-wrapper * { visibility: visible !important; }
        #print-wrapper { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; box-sizing: border-box; padding: 10mm !important; background: #fff; color: #111; }
        /* ensure scrollers don't stay hidden/truncated */
        .modal-content, .table-container-scroll, .table-container { overflow: visible !important; max-height: none !important; height: auto !important; }
        /* tables: keep headers on each page */
        table { page-break-inside: auto !important; width: 100% !important; border-collapse: collapse !important; }
        thead { display: table-header-group !important; }
        tfoot { display: table-footer-group !important; }
        tr { page-break-inside: avoid !important; page-break-after: auto !important; }
        /* page-break helper */
        .print-page-break { display:block; page-break-after:always; break-after:page; }
        img { max-width:100% !important; height:auto !important; display:block !important; }
      }
      /* On screen, keep it unobtrusive */
      #print-wrapper { background: #fff; color: #111; }
    `;
    document.head.appendChild(style);
    return style;
  }

  // ---- Core print flow (in-place clone) ----
  async function printApplicationDetailsInPlace(options = {}) {
    const force = !!options.force;
    const showWarning = options.showWarning !== false;

    try {
      const modal = document.getElementById('viewApplicationModal');
      if (!modal || (modal.style.display === 'none' && !modal.classList.contains('active'))) {
        throw new Error('Please open an application first.');
      }

      // Confirmation for non-approved still optional
      if (!force && showWarning) {
        const badge = document.getElementById('applicationStatusBadge');
        const text = badge ? (badge.textContent || '').toUpperCase() : '';
        if (!text.includes('APPROVED')) {
          const ok = (typeof showConfirmModal === 'function')
            ? await showConfirmModal('This application is not marked as APPROVED. Print anyway?', { title:'Confirm Print', confirmText:'Print Anyway', cancelText:'Cancel' })
            : confirm('This application is not marked as APPROVED. Print anyway?');
          if (!ok) return;
        }
      }

      // Build print clone (do not mutate original)
      const cloneRoot = modal.cloneNode(true);
      // find the inner loan-application-modal to keep layout consistent when available
      const clonedModal = cloneRoot.querySelector('.loan-application-modal') || cloneRoot;

      // remove script tags in clone
      cloneRoot.querySelectorAll('script').forEach(s => s.remove());

      // convert interactive controls to static in the clone
      convertInteractiveToStatic(cloneRoot);

      // expand scrollable areas in clone
      expandScrollables(cloneRoot);

      // add explicit page breaks (helps split long document)
      insertPageBreaks(cloneRoot);

      // ensure images load (copy data-src -> src if used)
      cloneRoot.querySelectorAll('img').forEach(img => {
        if (!img.src && img.getAttribute('data-src')) img.src = img.getAttribute('data-src');
        img.removeAttribute('loading');
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
      });

      // Create the print wrapper and append clone content
      const wrapper = document.createElement('div');
      wrapper.id = 'print-wrapper';
      wrapper.setAttribute('aria-hidden', 'false');
      // use cloned modal's inner HTML (keeps styles applied to loan-application-modal)
      // Prefer the loan-application-modal section only so header/footer of page not duplicated
      const contentNode = cloneRoot.querySelector('.loan-application-modal') || cloneRoot;
      wrapper.appendChild(contentNode);

      // Insert print style and wrapper into DOM
      const printStyle = createPrintStyle();
      document.body.appendChild(wrapper);

      // Wait for images inside wrapper to load
      await waitForImages(wrapper, 7000);

      // Small settle for layout reflow
      await new Promise(res => setTimeout(res, 160));

      // Preserve scroll position so we can restore after print
      const prevScroll = { x: window.scrollX || 0, y: window.scrollY || 0 };

      // Setup cleanup function to remove wrapper and style and restore state
      let cleaned = false;
      function cleanup() {
        if (cleaned) return;
        cleaned = true;
        try { const pw = document.getElementById('print-wrapper'); if (pw && pw.parentNode) pw.parentNode.removeChild(pw); } catch(e) {}
        try { const ps = document.getElementById('print-temp-style'); if (ps && ps.parentNode) ps.parentNode.removeChild(ps); } catch(e) {}
        try { if (printStyle && printStyle.parentNode) printStyle.parentNode.removeChild(printStyle); } catch(e) {}
        try { window.scrollTo(prevScroll.x, prevScroll.y); } catch(e) {}
        // reinitialize print bindings if necessary
        try { if (typeof initPrint === 'function') initPrint(); } catch(e) {}
      }

      // Ensure afterprint cleanup
      function onAfterPrint() {
        cleanup();
        try { window.removeEventListener('afterprint', onAfterPrint); } catch(e) {}
      }
      window.addEventListener('afterprint', onAfterPrint);

      // Call print
      try {
        window.print();
      } catch (e) {
        // If print() fails synchronously, still cleanup after a short delay
        log('window.print error', e);
        setTimeout(cleanup, 500);
        return;
      }

      // Fallback: if afterprint doesn't fire, cleanup after timeout
      setTimeout(cleanup, 3000);

    } catch (err) {
      log('print error', err);
      if (typeof showToast === 'function') showToast('Print failed: ' + (err && err.message ? err.message : err), 'error');
      else alert('Print failed: ' + (err && err.message ? err.message : err));
    }
  }

  // Public wrappers
  function printApplicationDetails(options = {}) {
    // prefer in-place printing (no popups)
    return printApplicationDetailsInPlace(options);
  }
  function quickPrint() {
    return printApplicationDetailsInPlace({ force: true, showWarning: false });
  }
  function exportApplicationDetails() {
    // same as print - user can choose Save as PDF in dialog
    return printApplicationDetailsInPlace({ force: true, showWarning: false });
  }

  // Rebind UI buttons
  function initPrintBindings() {
    const printBtn = document.getElementById('btn-print');
    if (printBtn) {
      printBtn.removeAttribute('onclick');
      printBtn.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); printApplicationDetails(); });
    }
    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) {
      exportBtn.removeAttribute('onclick');
      exportBtn.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); exportApplicationDetails(); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPrintBindings);
  else initPrintBindings();

  // Expose globals
  window.printApplicationDetails = printApplicationDetails;
  window.exportApplicationDetails = exportApplicationDetails;
  window.quickPrint = quickPrint;

  // Small debug export
  window.__print_debug = { convertInteractiveToStatic, expandScrollables, insertPageBreaks };

  log('print.js (in-place) loaded');
})();
