// print.js - robust new-window printable document with explicit page-breaks
// - Validates/guards against empty content to avoid blank page
// - Inlines minimal print CSS so content is visible even if external CSS is not loaded
// - Inserts page-breaks after major sections (section-block / review-section / view-details-section)
// - Waits for images/styles to settle before calling print
// - Falls back with an error message if popup blocked or content missing

(function () {
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function convertInteractiveToStatic(container) {
    container.querySelectorAll('input').forEach(input => {
      try {
        const span = document.createElement('div');
        span.className = 'print-input-value';
        span.style.whiteSpace = 'pre-wrap';
        if (input.type === 'checkbox' || input.type === 'radio') {
          span.textContent = input.checked ? '✓' : '✕';
        } else if (input.type === 'file') {
          const s = container.querySelector(`#${input.id}-name`);
          span.textContent = (s && s.textContent) ? s.textContent : (input.value ? input.value.split('\\').pop() : 'Not uploaded');
        } else {
          span.textContent = input.value || input.placeholder || '';
        }
        input.parentNode && input.parentNode.replaceChild(span, input);
      } catch (e) {}
    });

    container.querySelectorAll('textarea').forEach(ta => {
      try {
        const div = document.createElement('div');
        div.className = 'print-textarea-value';
        div.style.whiteSpace = 'pre-wrap';
        div.textContent = ta.value || ta.placeholder || '';
        ta.parentNode && ta.parentNode.replaceChild(div, ta);
      } catch (e) {}
    });

    container.querySelectorAll('select').forEach(sel => {
      try {
        const div = document.createElement('div');
        div.className = 'print-select-value';
        div.textContent = (sel.options && sel.selectedIndex >= 0) ? (sel.options[sel.selectedIndex].text || sel.value) : sel.value;
        sel.parentNode && sel.parentNode.replaceChild(div, sel);
      } catch (e) {}
    });

    // Remove inline event handlers
    container.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes || []).forEach(attr => {
        if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      });
    });
  }

  function expandScrollableContainers(root) {
    try {
      root.querySelectorAll('*').forEach(el => {
        try {
          el.style.overflow = 'visible';
          el.style.overflowY = 'visible';
          el.style.overflowX = 'visible';
          el.style.maxHeight = 'none';
          if (el.style.height && el.style.height !== 'auto') el.style.height = 'auto';
        } catch (e) {}
      });
      ['.modal-content', '.table-container-scroll', '.table-container', '.documents-container', '.upload-grid', '.review-section', '.view-details-section'].forEach(sel => {
        root.querySelectorAll(sel).forEach(el => {
          try { el.style.overflow = 'visible'; el.style.maxHeight = 'none'; el.style.height = 'auto'; } catch(e) {}
        });
      });
      root.querySelectorAll('table').forEach(tbl => {
        try { tbl.style.tableLayout = 'auto'; tbl.style.width = '100%'; } catch(e) {}
      });
    } catch (e) {}
  }

  function insertPageBreaksAfterSections(root) {
    // Insert an explicit page-break DIV after each major section to encourage clean page splits.
    const selectors = ['.section-block', '.review-section', '.view-details-section', '.documents-container', '.signatures-section'];
    selectors.forEach(sel => {
      Array.from(root.querySelectorAll(sel)).forEach(el => {
        try {
          const br = document.createElement('div');
          br.className = 'page-break';
          br.style.display = 'block';
          br.style.pageBreakAfter = 'always';
          br.style.breakAfter = 'page';
          // Insert only if not already last child or next is a page-break
          if (el.nextSibling && !(el.nextSibling.className && el.nextSibling.className.indexOf('page-break') >= 0)) {
            el.parentNode && el.parentNode.insertBefore(br, el.nextSibling);
          } else if (!el.nextSibling) {
            el.parentNode && el.parentNode.appendChild(br);
          }
        } catch (e) {}
      });
    });
  }

  function serializeModalHtml(modalElement) {
    // target the loan-application-modal container inside the modal if present (keeps header/footer consistent)
    const target = (modalElement.querySelector && (modalElement.querySelector('.loan-application-modal') || modalElement.querySelector('.loan-application-modal'))) || modalElement;
    if (!target) return '';

    // clone node so we don't mutate UI
    const clone = target.cloneNode(true);

    // remove scripts from clone
    clone.querySelectorAll('script').forEach(s => s.remove());

    // convert interactive elements to static
    convertInteractiveToStatic(clone);

    // expand scrolls and heights
    expandScrollableContainers(clone);

    // insert explicit page-breaks
    insertPageBreaksAfterSections(clone);

    // ensure images will try loading (copy data-src)
    clone.querySelectorAll('img').forEach(img => {
      if (!img.src && img.getAttribute('data-src')) img.src = img.getAttribute('data-src');
      img.removeAttribute('loading');
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
    });

    // remove UI-only elements that might still remain
    clone.querySelectorAll('.close-button, .action-btn, .tab-navigation, .add-button, .delete-button, .modal-footer, .compact-actions, .btn, .view-button, .inline-loading').forEach(n => n.remove());

    return clone.innerHTML || '';
  }

  function waitForImages(doc, timeout = 8000) {
    return new Promise(resolve => {
      try {
        const imgs = Array.from(doc.images || []);
        if (!imgs.length) return resolve();
        let remaining = imgs.length;
        let done = false;
        const maybeDone = () => { if (done) return; if (remaining <= 0) { done = true; resolve(); } };
        imgs.forEach(img => {
          if (img.complete && img.naturalWidth !== 0) { remaining--; maybeDone(); }
          else {
            const handler = () => { remaining--; cleanup(); maybeDone(); };
            const cleanup = () => { img.removeEventListener('load', handler); img.removeEventListener('error', handler); };
            img.addEventListener('load', handler);
            img.addEventListener('error', handler);
          }
        });
        setTimeout(() => { if (!done) { done = true; resolve(); } }, timeout);
      } catch (e) { resolve(); }
    });
  }

  function buildPrintDocument(serializedHtml, titleText) {
    // Inline minimal print CSS to ensure the page shows even if external CSS doesn't load
    const minimalPrintCss = `
      <style>
        html,body { margin:0; padding:0; font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif; color:#111; background:#fff; }
        .print-page { width:210mm; margin:0 auto; padding:12mm 10mm; box-sizing:border-box; background:#fff; color:#111; }
        h2,h3,h4 { color:#111; margin:0 0 6px 0; }
        .section-block, .review-section, .view-details-section { margin-bottom:8px; }
        table { width:100%; border-collapse:collapse; margin-bottom:8px; font-size:12px; }
        th, td { padding:6px; border:1px solid #e6e6e6; text-align:left; vertical-align:top; }
        .inline-value, .print-input-value, .print-textarea-value { white-space: pre-wrap; }
        .page-break { display:block; page-break-after:always; break-after:page; height:1px; }
        .print-footer { font-size:10px; color:#666; margin-top:12px; border-top:1px dashed #e6e6e6; padding-top:8px; }
        @media print {
          .page-break { display:block; page-break-after:always; }
          .print-page { padding:10mm !important; }
          thead { display:table-header-group; }
          tfoot { display:table-footer-group; }
          tr { page-break-inside:avoid; page-break-after:auto; }
        }
      </style>
    `;

    const headerHtml = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><div style="font-size:11px;color:#444;">${new Date().toLocaleString()}</div><div style="font-weight:700;color:#0b66c2;">${escapeHtml(titleText || 'Loan Application')}</div></div>`;

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(titleText || 'Loan Application')}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${minimalPrintCss}
</head>
<body>
  <div class="print-page">
    ${headerHtml}
    <div id="print-content">${serializedHtml}</div>
    <div class="print-footer">Source: ${escapeHtml(location.href)}</div>
  </div>

  <script>
    (function(){
      function waitImages(timeout, cb) {
        try {
          var imgs = Array.from(document.images || []);
          if (!imgs.length) return cb();
          var remaining = imgs.length, done=false;
          function check(){ if (done) return; if (remaining<=0) { done=true; cb(); } }
          imgs.forEach(function(img){
            if (img.complete && img.naturalWidth!==0) { remaining--; check(); }
            else {
              var ondone = function(){ remaining--; cleanup(); check(); };
              var cleanup = function(){ img.removeEventListener('load', ondone); img.removeEventListener('error', ondone); };
              img.addEventListener('load', ondone);
              img.addEventListener('error', ondone);
            }
          });
          setTimeout(function(){ if (!done) { done=true; cb(); } }, timeout||8000);
        } catch(e){ cb(); }
      }

      document.addEventListener('DOMContentLoaded', function(){
        waitImages(8000, function(){
          setTimeout(function(){
            try { window.focus(); window.print(); } catch(e){ console.error(e); }
            // try to close after a short delay (some browsers block)
            setTimeout(function(){ try{ window.close(); }catch(e){} }, 1500);
          }, 160);
        });
      });
    })();
  </script>
</body>
</html>`;
  }

  async function printApplicationNewWindow(options = {}) {
    const force = !!options.force;
    const showWarning = options.showWarning !== false;

    try {
      const modal = document.getElementById('viewApplicationModal');
      if (!modal || (modal.style.display === 'none' && !modal.classList.contains('active'))) {
        throw new Error('Please open an application first.');
      }

      // confirm if not approved (retain original UX)
      if (!force && showWarning) {
        const statusEl = document.getElementById('applicationStatusBadge');
        const statusText = statusEl ? (statusEl.textContent || '').toUpperCase() : '';
        if (!statusText.includes('APPROVED')) {
          const ok = (typeof showConfirmModal === 'function')
            ? await showConfirmModal('This application is not marked as APPROVED. Print anyway?', { title:'Confirm Print', confirmText:'Print Anyway', cancelText:'Cancel' })
            : confirm('This application is not marked as APPROVED. Print anyway?');
          if (!ok) return;
        }
      }

      const serialized = serializeAndPrepare(modal);
      if (!serialized || !serialized.trim()) {
        if (typeof showToast === 'function') showToast('Nothing to print (modal appears empty).', 'error');
        else alert('Nothing to print (modal appears empty).');
        return;
      }

      // open blank popup
      const w = window.open('', '_blank', 'noopener,noreferrer');
      if (!w) {
        if (typeof showToast === 'function') showToast('Popup blocked. Allow popups for printing.', 'error');
        else alert('Popup blocked. Please allow popups for this site to print.');
        return;
      }

      // build html and write (title uses applicationNumber where possible)
      const titleText = (document.getElementById('applicationNumber')?.textContent || document.getElementById('applicationNumber')?.innerText || document.getElementById('application-number')?.textContent || 'Loan Application').trim();
      const docHtml = buildPrintDocument(serialized, titleText);
      w.document.open();
      w.document.write(docHtml);
      w.document.close();

      // focus new window
      try { w.focus(); } catch(e) {}

      // we rely on the new window's script to wait for images and call print
      // Optionally, additional monitoring could be added here

    } catch (err) {
      console.error('Print error:', err);
      if (typeof showToast === 'function') showToast('Print failed: ' + (err && err.message ? err.message : err), 'error');
      else alert('Print failed: ' + (err && err.message ? err.message : err));
    }
  }

  // Helper wrapper to serialize modal after processing
  function serializeAndPrepare(modalEl) {
    try {
      const html = serializeModalHtml(modalEl);
      return html;
    } catch (e) {
      console.error('serializeAndPrepare error', e);
      return '';
    }
  }

  // Expose functions
  window.printApplicationDetails = printApplicationNewWindow;
  window.exportApplicationDetails = function() { printApplicationNewWindow({ force: true, showWarning: false }); };
  window.quickPrint = function() { printApplicationNewWindow({ force: true, showWarning: false }); };

  // Bind buttons on load
  function initPrintBindings() {
    const printBtn = document.getElementById('btn-print');
    if (printBtn) printBtn.onclick = () => printApplicationNewWindow();
    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) exportBtn.onclick = () => window.exportApplicationDetails();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPrintBindings);
  else initPrintBindings();

  // expose minimal helpers for debug if needed
  window.__print_helpers = { convertInteractiveToStatic, expandScrollableContainers, insertPageBreaksAfterSections, serializeModalHtml };

  console.log('print.js (robust new-window) loaded');
})();
