// print.js - alternate approach: render a dedicated printable document in a new window/tab
// - Opens a new window and writes a clean, print-optimized HTML document containing the
//   fully-expanded modal content.
// - Converts inputs/textareas/selects to static content, removes interactive controls,
//   expands scrollable containers so no inner scrollbars remain.
// - Waits for images to load, gives a short settle delay, then triggers print in the new window.
// - Falls back with a helpful message if popups are blocked.

(function () {
  // ---- Utilities ----
  function serializeModalContent(modal) {
    // Clone so we don't mutate real UI
    const clone = modal.cloneNode(true);

    // Remove scripts
    clone.querySelectorAll('script').forEach(s => s.remove());

    // Convert form controls to static text
    convertInteractiveToStatic(clone);

    // Expand scrollable/fixed containers
    expandScrollableContainers(clone);

    // Remove interactive/button elements
    clone.querySelectorAll('button, a, input[type="file"], .close-button, .tab-navigation, .add-button, .delete-button, .modal-footer, .compact-actions, .view-button, .action-btn').forEach(el => {
      try { el.parentNode && el.parentNode.removeChild(el); } catch (e) {}
    });

    // Ensure images use src (copy data-src if present) and remove lazy loading
    clone.querySelectorAll('img').forEach(img => {
      if (!img.src && img.getAttribute('data-src')) img.src = img.getAttribute('data-src');
      img.removeAttribute('loading');
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
    });

    return clone.innerHTML;
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

    // remove inline event handlers
    container.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes || []).forEach(attr => {
        if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      });
    });
  }

  function expandScrollableContainers(root) {
    // Make overflow visible and remove height/max-height constraints
    root.querySelectorAll('*').forEach(el => {
      try {
        el.style.overflow = 'visible';
        el.style.overflowY = 'visible';
        el.style.overflowX = 'visible';
        el.style.maxHeight = 'none';
        if (el.style.height && el.style.height !== 'auto') el.style.height = 'auto';
      } catch (e) {}
    });
    // specific common classes to be sure
    root.querySelectorAll('.modal-content, .table-container-scroll, .table-container, .documents-container, .upload-grid, .review-section, .view-details-section').forEach(el => {
      try {
        el.style.overflow = 'visible';
        el.style.maxHeight = 'none';
        el.style.height = 'auto';
      } catch (e) {}
    });
    // allow tables to expand naturally
    root.querySelectorAll('table').forEach(t => {
      try { t.style.tableLayout = 'auto'; t.style.width = '100%'; } catch (e) {}
    });
  }

  // Wait for images in a document/window to load (with timeout)
  function waitForImagesInDocument(winDoc, timeout = 8000) {
    return new Promise(resolve => {
      try {
        const imgs = Array.from(winDoc.images || []);
        if (!imgs.length) return resolve();
        let remaining = imgs.length;
        let done = false;
        const check = () => { if (done) return; if (remaining <= 0) { done = true; resolve(); } };
        imgs.forEach(img => {
          if (img.complete && img.naturalWidth !== 0) {
            remaining--; check();
          } else {
            const ondone = () => { remaining--; cleanup(); check(); };
            const cleanup = () => { img.removeEventListener('load', ondone); img.removeEventListener('error', ondone); };
            img.addEventListener('load', ondone);
            img.addEventListener('error', ondone);
          }
        });
        setTimeout(() => { if (!done) { done = true; resolve(); } }, timeout);
      } catch (e) { resolve(); }
    });
  }

  // Build full HTML for new window - includes local CSS links and a focused print stylesheet
  function buildPrintHtml(serializedBodyHtml, titleText = 'Application Document') {
    const baseHref = location.origin + location.pathname.replace(/\/[^/]*$/, '/');
    // try to include current app CSS files used by the app; adjust paths if needed
    // If your app serves CSS from same folder, these links will resolve
    const cssLinks = [
      '<link rel="stylesheet" href="Main.css">',
      '<link rel="stylesheet" href="viewApps.css">',
      '<link rel="stylesheet" href="print.css">'
    ].join('\n');

    const printEnhancements = `
      <style>
        /* Ensure page friendly layout */
        html,body { margin:0; padding:0; background:#fff; color:#111; font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif; }
        .print-page { width:210mm; margin:0 auto; box-sizing:border-box; padding:12mm 10mm; background:#fff; }
        /* Avoid breaking inside key blocks */
        .review-section, .view-details-section, .section-block, .documents-container, .signatures-section { page-break-inside: avoid; }
        table { page-break-inside: auto; border-collapse: collapse; }
        tr { page-break-inside: avoid; page-break-after: auto; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        img { max-width:100%; height:auto; display:block; }
        /* Make printed text readable */
        .print-input-value, .print-textarea-value, .print-select-value { white-space: pre-wrap; color:#111; }
        /* Footer info */
        .print-footer { font-size: 10px; color:#666; margin-top:12px; border-top:1px dashed #e6e6e6; padding-top:8px; }
      </style>
    `;

    // Header with date/time + title
    const headerHtml = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><div style="font-size:11px;color:#444;">${new Date().toLocaleString()}</div><div style="font-weight:700;color:#0b66c2;">${escapeHtml(titleText)}</div></div>`;

    // Full document
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <base href="${baseHref}">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(titleText)}</title>
  ${cssLinks}
  ${printEnhancements}
</head>
<body>
  <div class="print-page" id="print-root">
    ${headerHtml}
    <div id="print-content">
      ${serializedBodyHtml}
    </div>
    <div class="print-footer">Source: ${escapeHtml(location.href)}</div>
  </div>

  <script>
    // Wait for images, then print. Use a short settle delay.
    (function(){
      function waitImages(timeout, cb) {
        try {
          var imgs = Array.from(document.images || []);
          if (!imgs.length) return cb();
          var remaining = imgs.length, done = false;
          function check() { if (done) return; if (remaining <= 0) { done = true; cb(); } }
          imgs.forEach(function(img){
            if (img.complete && img.naturalWidth !== 0) { remaining--; check(); }
            else {
              var ondone = function(){ remaining--; cleanup(); check(); };
              var cleanup = function(){ img.removeEventListener('load', ondone); img.removeEventListener('error', ondone); };
              img.addEventListener('load', ondone);
              img.addEventListener('error', ondone);
            }
          });
          setTimeout(function(){ if (!done) { done = true; cb(); } }, timeout || 7000);
        } catch (e) { cb(); }
      }

      document.addEventListener('DOMContentLoaded', function(){
        // Small settle even if no images
        waitImages(7000, function(){
          setTimeout(function(){
            try {
              window.focus();
              window.print();
            } catch (e) {
              console.error('Print failed', e);
            }
            // don't auto-close: browsers vary; user may want to inspect print preview
            // but try to close after a delay (some browsers block)
            setTimeout(function(){ try { window.close(); } catch(e){} }, 2000);
          }, 150);
        });
      });
    })();
  </script>
</body>
</html>`;
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  // ---- Public print function (new-window approach) ----
  async function printApplicationDetailsNewWindow(options = {}) {
    const force = !!options.force;
    const showWarning = options.showWarning !== false;

    try {
      const modal = document.getElementById('viewApplicationModal');
      if (!modal || (modal.style.display === 'none' && !modal.classList.contains('active'))) {
        throw new Error('Please open an application first.');
      }

      if (!force && showWarning) {
        const statusEl = document.getElementById('applicationStatusBadge');
        const statusText = statusEl ? (statusEl.textContent || '').toUpperCase() : '';
        if (!statusText.includes('APPROVED')) {
          const ok = (typeof showConfirmModal === 'function')
            ? await showConfirmModal('This application is not marked as APPROVED. Print anyway?', { title: 'Confirm Print', confirmText: 'Print Anyway', cancelText: 'Cancel' })
            : confirm('This application is not marked as APPROVED. Print anyway?');
          if (!ok) return;
        }
      }

      // Serialize modal (clone + process)
      const printableHtml = serializeModalContent(modal.querySelector('.loan-application-modal') || modal);

      // Open new window
      const w = window.open('', '_blank', 'noopener,noreferrer');
      if (!w) {
        // Popup blocked - inform the user and fallback to in-place clone approach
        if (typeof showToast === 'function') {
          showToast('Popup blocked. Allow popups for this site or try "Export" which opens print dialog.', 'error');
        } else {
          alert('Popup blocked. Please enable popups for this site to print, or try Export.');
        }
        return;
      }

      // Build full HTML and write into new window
      const titleText = (document.getElementById('applicationNumber')?.textContent || document.getElementById('applicationNumber')?.innerText || 'Loan Application').trim();
      const docHtml = buildPrintHtml(printableHtml, titleText);
      w.document.open();
      w.document.write(docHtml);
      w.document.close();

      // Let the document's own script wait for images and call print.
      // As a courtesy, also wait here and focus the new window.
      try { w.focus(); } catch (e) {}

      // Optionally, wait for the new window to finish printing and close it here:
      // Not enforced because many browsers block programmatic close of windows created by scripts
    } catch (err) {
      console.error('Print (new window) error:', err);
      if (typeof showToast === 'function') showToast('Print failed: ' + (err && err.message ? err.message : err), 'error');
      else alert('Print failed: ' + (err && err.message ? err.message : err));
    }
  }

  // Quick export wrapper
  function exportApplicationDetails() {
    if (typeof showConfirmModal === 'function') {
      showConfirmModal('Export as PDF? Use the print dialog to "Save as PDF".', { title: 'Export', confirmText: 'Export', cancelText: 'Cancel' })
        .then(ok => { if (ok) printApplicationDetailsNewWindow({ force: true, showWarning: false }); });
    } else {
      if (confirm('Export as PDF?\n\nClick OK, then choose "Save as PDF" in the print dialog.')) {
        printApplicationDetailsNewWindow({ force: true, showWarning: false });
      }
    }
  }

  // Init binds
  function initPrintBindings() {
    const printBtn = document.getElementById('btn-print');
    if (printBtn) printBtn.onclick = () => printApplicationDetailsNewWindow();
    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) exportBtn.onclick = () => exportApplicationDetails();
  }

  // Expose
  window.printApplicationDetails = printApplicationDetailsNewWindow;
  window.exportApplicationDetails = exportApplicationDetails;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPrintBindings);
  else initPrintBindings();

  console.log('print.js (new-window approach) loaded');
})();
