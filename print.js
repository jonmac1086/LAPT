

(function () {
  'use strict';

  // Helper - find modal content element
  function getModalContentElement() {
    const modal = document.getElementById('viewApplicationModal');
    if (!modal) return null;
    // prefer inner .modal-content, otherwise use modal itself
    return modal.querySelector('.modal-content') || modal;
  }

  // Helper - determine approved status (returns boolean)
  function modalIsApproved() {
    const badge = document.getElementById('applicationStatusBadge');
    if (!badge) return false;
    const text = (badge.textContent || '').toString().trim().toUpperCase();
    return text === 'APPROVED' || text.includes('APPROVED');
  }

  // Remove UI elements not desired in print (close buttons, action buttons etc.)
  function sanitizeClone(clone) {
    try {
      // Remove elements that are purely UI controls for the modal
      const selectors = [
        '.close-button',
        '.action-btn',
        '.header-actions',
        '.compact-actions',
        '.modal-footer',
        '.tab-navigation',
        '.tab-button',
        '.btn-icon',
        '.btn-outline',
        '.btn-primary',
        '.btn-secondary',
        '#btn-print' // explicit print button
      ];
      selectors.forEach(sel => {
        clone.querySelectorAll(sel).forEach(el => el.parentNode && el.parentNode.removeChild(el));
      });

      // Remove any script tags from the clone
      clone.querySelectorAll('script').forEach(s => s.parentNode && s.parentNode.removeChild(s));

      // Remove interactive attributes
      clone.querySelectorAll('[onclick]').forEach(el => el.removeAttribute('onclick'));
      clone.querySelectorAll('button').forEach(btn => btn.setAttribute('disabled', 'disabled'));
    } catch (e) {
      // Non-fatal; continue
      console.warn('sanitizeClone error', e);
    }
    return clone;
  }

  // Copy styles (link rel="stylesheet" and inline <style>) to the new document head
  function copyStylesToDoc(sourceDoc, targetDoc) {
    // Copy <link rel="stylesheet"> nodes
    const links = Array.from(sourceDoc.querySelectorAll('link[rel="stylesheet"]'));
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      const newLink = targetDoc.createElement('link');
      newLink.rel = 'stylesheet';
      newLink.href = href;
      // Preserve media attribute if present
      if (link.media) newLink.media = link.media;
      targetDoc.head.appendChild(newLink);
    });

    // Copy inline <style> blocks
    const styles = Array.from(sourceDoc.querySelectorAll('style'));
    styles.forEach(style => {
      const s = targetDoc.createElement('style');
      s.type = 'text/css';
      s.appendChild(targetDoc.createTextNode(style.textContent || ''));
      targetDoc.head.appendChild(s);
    });

    // Add some print-specific CSS to ensure clean page
    const printCss = `
      @media print {
        body { -webkit-print-color-adjust: exact; }
        /* ensure modal content is full width on paper */
        .modal-content, .loan-application-modal { max-width: 100% !important; width: 100% !important; box-shadow: none !important; border: none !important; }
      }
      /* small page reset for print window */
      body { margin: 12px; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; color: #111; background: #fff; }
    `;
    const ps = targetDoc.createElement('style');
    ps.type = 'text/css';
    ps.appendChild(targetDoc.createTextNode(printCss));
    targetDoc.head.appendChild(ps);
  }

  // Build a new window and print it
  function printInPopup(clonedContent, title = 'Application Print') {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return null; // popup blocked
    const doc = printWindow.document;
    doc.open();
    // Basic HTML shell
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body></body></html>`);
    doc.close();

    // Copy styles (links and inline) from parent document
    copyStylesToDoc(document, doc);

    // Append the cloned content into body
    doc.body.appendChild(clonedContent);

    // Wait for fonts and styles to load, then print
    // Use a small timeout; you could also use load events for each stylesheet but that's more complex.
    setTimeout(() => {
      try {
        printWindow.focus();
        // Trigger print, then close popup after short delay
        if (printWindow.print) {
          printWindow.print();
          // Close after printing; some browsers may not allow closing windows not opened by script, but we opened it.
          setTimeout(() => {
            try { printWindow.close(); } catch (e) { /* ignore */ }
          }, 700);
        } else {
          // Fallback: show instructions
          alert('Print dialog not available. Please use your browser\'s print command.');
        }
      } catch (e) {
        console.error('Print failed', e);
      }
    }, 250);
    return printWindow;
  }

  // Fallback printing in-place: hide non-modal content using a print-only stylesheet, call window.print(), then restore.
  function printInPlace(cloneHtml) {
    const hideStyleId = 'print-temp-hide-style';
    // create style to hide everything except our content wrapper
    const css = `
      @media print {
        body * { visibility: hidden !important; }
        .__print_only_wrapper, .__print_only_wrapper * { visibility: visible !important; }
        .__print_only_wrapper { position: relative; left: 0; top: 0; }
      }
    `;
    let styleEl = document.getElementById(hideStyleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = hideStyleId;
      styleEl.type = 'text/css';
      styleEl.appendChild(document.createTextNode(css));
      document.head.appendChild(styleEl);
    }

    const wrapper = document.createElement('div');
    wrapper.className = '__print_only_wrapper';
    wrapper.style.background = '#fff';
    wrapper.appendChild(cloneHtml);

    document.body.appendChild(wrapper);

    // Delay slightly to allow layout, then print and cleanup
    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        console.error('In-place print failed', e);
      } finally {
        // cleanup
        setTimeout(() => {
          try {
            document.head.removeChild(styleEl);
            document.body.removeChild(wrapper);
          } catch (e) { /* ignore */ }
        }, 200);
      }
    }, 200);
  }

  // Escape HTML for title
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
  }

  // Public function: prints the view modal only
  // options: { force: boolean } - when true, prints regardless of status
  async function printApplicationDetails(options = {}) {
    try {
      const force = !!options.force;
      const modalContent = getModalContentElement();
      if (!modalContent) {
        alert('Print error: view modal not loaded.');
        return;
      }

      if (!force && !modalIsApproved()) {
        const proceed = confirm('This application is not marked APPROVED. Do you still want to print?');
        if (!proceed) return;
      }

      // Clone modal content to avoid modifying original DOM
      const clone = modalContent.cloneNode(true);
      sanitizeClone(clone);

      // If the application number or title exists, use it in print title
      const appNumEl = clone.querySelector('.application-number') || document.getElementById('applicationNumber') || clone.querySelector('#app-number');
      const title = appNumEl ? (`Application - ${appNumEl.textContent.trim()}`) : 'Application Print';

      // Try to open popup and print there
      const printedWindow = printInPopup(clone, title);
      if (!printedWindow) {
        // Popup blocked, fallback to in-place print
        printInPlace(clone);
      }
    } catch (err) {
      console.error('printApplicationDetails error', err);
      alert('Printing failed: ' + (err && err.message ? err.message : err));
    }
  }

  // Expose globally (overrides default window.printApplicationDetails if present)
  window.printApplicationDetails = printApplicationDetails;

  // Also expose a convenience function that ensures the modal is loaded (useful if you want to call before init)
  window.printViewModal = function (opts) { return window.printApplicationDetails(opts || {}); };
})();
