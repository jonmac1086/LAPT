 // print.js - in-place print approach (no popups) with consolidated/standard page-breaks
// - Minimal explicit page-breaks (only for documents & signatures)
// - Expands scrollable elements, converts inputs/selects/textareas to static values
// - Injects print-only CSS to hide the rest of the page and enforce sensible page-break rules
// - Waits for images to load and calls window.print()
// - Cleans up and restores original state after printing

(function () {
  'use strict';

  function log(...args) { try { console.log('[print]', ...args); } catch(e) {} }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function convertInteractiveToStatic(root) {
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
      } catch (e) {}
    });

    root.querySelectorAll('textarea').forEach(ta => {
      try {
        const div = document.createElement('div');
        div.className = 'print-textarea-value';
        div.style.whiteSpace = 'pre-wrap';
        div.textContent = ta.value || ta.placeholder || '';
        ta.parentNode && ta.parentNode.replaceChild(div, ta);
      } catch (e) {}
    });

    root.querySelectorAll('select').forEach(sel => {
      try {
        const div = document.createElement('div');
        div.className = 'print-select-value';
        const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text || sel.value : sel.value;
        div.textContent = opt || '';
        sel.parentNode && sel.parentNode.replaceChild(div, sel);
      } catch (e) {}
    });

    // Remove inline event handlers
    root.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes || []).forEach(attr => {
        if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      });
    });
  }

  function expandScrollables(root) {
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

    ['.modal-content', '.table-container-scroll', '.table-container', '.documents-container', '.upload-grid', '.review-section', '.view-details-section'].forEach(sel => {
      root.querySelectorAll(sel).forEach(el => {
        try { el.style.overflow = 'visible'; el.style.maxHeight = 'none'; el.style.height = 'auto'; } catch(e) {}
      });
    });

    root.querySelectorAll('table').forEach(t => {
      try { t.style.tableLayout = 'auto'; t.style.width = '100%'; } catch(e) {}
    });
  }

  // Reduced page-break insertion: only add breaks for large document-level sections
  function insertMinimalPageBreaks(root) {
    const targets = ['.documents-container', '.signatures-section'];
    targets.forEach(sel => {
      Array.from(root.querySelectorAll(sel)).forEach(el => {
        try {
          // If there is already a break immediately after, skip
          const next = el.nextElementSibling;
          if (next && next.classList && next.classList.contains('print-page-break')) return;
          const br = document.createElement('div');
          br.className = 'print-page-break';
          br.style.pageBreakAfter = 'always';
          br.style.breakAfter = 'page';
          if (el.nextSibling) el.parentNode.insertBefore(br, el.nextSibling);
          else el.parentNode.appendChild(br);
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
      const maybeDone = () => { if (finished) return; if (remaining <= 0) { finished = true; resolve(); } };
      imgs.forEach(img => {
        if (img.complete && img.naturalWidth !== 0) { remaining--; maybeDone(); }
        else {
          const ondone = () => { remaining--; cleanup(); maybeDone(); };
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
      @media print {
        body * { visibility: hidden !important; }
        #print-wrapper, #print-wrapper * { visibility: visible !important; }
        #print-wrapper { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; box-sizing: border-box; padding: 10mm !important; background: #fff; color: #111; }
        .modal-content, .table-container-scroll, .table-container { overflow: visible !important; max-height: none !important; height: auto !important; }
        table { page-break-inside: auto !important; width: 100% !important; border-collapse: collapse !important; }
        thead { display: table-header-group !important; }
        tfoot { display: table-footer-group !important; }
        tr { page-break-inside: avoid !important; page-break-after: auto !important; }
        .print-page-break { display:block; page-break-after:always; break-after:page; }
        img { max-width:100% !important; height:auto !important; display:block !important; }
      }
      #print-wrapper { background: #fff; color: #111; }
    `;
    document.head.appendChild(style);
    return style;
  }

  async function printApplicationDetailsInPlace(options = {}) {
    const force = !!options.force;
    const showWarning = options.showWarning !== false;

    try {
      const modal = document.getElementById('viewApplicationModal');
      if (!modal || (modal.style.display === 'none' && !modal.classList.contains('active'))) {
        throw new Error('Please open an application first.');
      }

      // Confirm for non-approved
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

      // Clone and prepare content
      const cloneRoot = modal.cloneNode(true);
      cloneRoot.querySelectorAll('script').forEach(s => s.remove());
      convertInteractiveToStatic(cloneRoot);
      expandScrollables(cloneRoot);
      insertMinimalPageBreaks(cloneRoot);

      // ensure images load
      cloneRoot.querySelectorAll('img').forEach(img => {
        if (!img.src && img.getAttribute('data-src')) img.src = img.getAttribute('data-src');
        img.removeAttribute('loading');
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
      });

      // Build wrapper and place cloned modal content inside
      const wrapper = document.createElement('div');
      wrapper.id = 'print-wrapper';
      wrapper.setAttribute('aria-hidden', 'false');

      const contentNode = cloneRoot.querySelector('.loan-application-modal') || cloneRoot;
      wrapper.appendChild(contentNode);

      const printStyle = createPrintStyle();
      document.body.appendChild(wrapper);

      await waitForImages(wrapper, 7000);
      await new Promise(res => setTimeout(res, 160));

      const prevScroll = { x: window.scrollX || 0, y: window.scrollY || 0 };

      let cleaned = false;
      function cleanup() {
        if (cleaned) return;
        cleaned = true;
        try { const pw = document.getElementById('print-wrapper'); if (pw && pw.parentNode) pw.parentNode.removeChild(pw); } catch(e) {}
        try { const ps = document.getElementById('print-temp-style'); if (ps && ps.parentNode) ps.parentNode.removeChild(ps); } catch(e) {}
        try { if (printStyle && printStyle.parentNode) printStyle.parentNode.removeChild(printStyle); } catch(e) {}
        try { window.scrollTo(prevScroll.x, prevScroll.y); } catch(e) {}
        try { if (typeof initPrint === 'function') initPrint(); } catch(e) {}
      }

      function onAfterPrint() {
        cleanup();
        try { window.removeEventListener('afterprint', onAfterPrint); } catch(e) {}
      }
      window.addEventListener('afterprint', onAfterPrint);

      try {
        window.print();
      } catch (e) {
        log('window.print error', e);
        setTimeout(cleanup, 500);
        return;
      }

      setTimeout(cleanup, 3000);

    } catch (err) {
      log('print error', err);
      if (typeof showToast === 'function') showToast('Print failed: ' + (err && err.message ? err.message : err), 'error');
      else alert('Print failed: ' + (err && err.message ? err.message : err));
    }
  }

  function printApplicationDetails(options = {}) {
    return printApplicationDetailsInPlace(options);
  }
  function quickPrint() { return printApplicationDetailsInPlace({ force: true, showWarning: false }); }
  function exportApplicationDetails() { return printApplicationDetailsInPlace({ force: true, showWarning: false }); }

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

  window.printApplicationDetails = printApplicationDetails;
  window.exportApplicationDetails = exportApplicationDetails;
  window.quickPrint = quickPrint;

  window.__print_debug = { convertInteractiveToStatic, expandScrollables, insertMinimalPageBreaks };

  log('print.js (in-place, consolidated page-breaks) loaded');
})();
