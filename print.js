// Get the active view modal
function getActiveViewModal() {
  const modal = document.getElementById('viewApplicationModal');
  if (!modal) return null;
  
  // Check if modal is visible
  const style = window.getComputedStyle(modal);
  if (style.display === 'none' && !modal.classList.contains('active')) {
    return null;
  }
  
  return modal;
}

// Create print-ready clone of modal
function createPrintClone() {
  const modal = getActiveViewModal();
  if (!modal) {
    throw new Error('View modal is not open. Please open an application to print.');
  }
  
  // Deep clone the entire modal
  const clone = modal.cloneNode(true);
  
  // Store original inline styles to restore later
  const originalStyles = new Map();
  clone.querySelectorAll('[style]').forEach(el => {
    originalStyles.set(el, el.getAttribute('style'));
  });
  
  // Remove interactive elements
  const elementsToRemove = [
    'button',
    'input[type="button"]',
    'input[type="submit"]',
    'textarea',
    'select',
    '.close-button',
    '.action-btn',
    '.compact-actions',
    '.modal-footer',
    '.btn-icon',
    '.view-button',
    '.header-actions',
    '[onclick]',
    '[contenteditable]',
    'script'
  ];
  
  elementsToRemove.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => {
      el.parentNode && el.parentNode.removeChild(el);
    });
  });
  
  // Remove event handlers from remaining elements
  clone.querySelectorAll('*').forEach(el => {
    const attrs = el.attributes;
    for (let i = attrs.length - 1; i >= 0; i--) {
      const attrName = attrs[i].name;
      if (attrName.startsWith('on')) {
        el.removeAttribute(attrName);
      }
    }
  });
  
  // Apply print-specific styles to clone
  applyPrintStylesToClone(clone);
  
  return { clone, originalStyles };
}

// Apply print-only styles to clone
function applyPrintStylesToClone(clone) {
  // Make modal full width and visible for print
  clone.style.cssText = `
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    height: auto !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 20px !important;
    background: white !important;
    display: block !important;
    opacity: 1 !important;
    visibility: visible !important;
    z-index: 999999 !important;
    box-shadow: none !important;
    border: none !important;
    overflow: visible !important;
  `;
  
  // Make modal content full width
  const modalContent = clone.querySelector('.modal-content');
  if (modalContent) {
    modalContent.style.cssText = `
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border: none !important;
      background: transparent !important;
    `;
  }
  
  // Make loan-application-modal full width
  const loanAppModal = clone.querySelector('.loan-application-modal');
  if (loanAppModal) {
    loanAppModal.style.cssText = `
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
    `;
  }
  
  // Fix table containers to remove scrolling
  clone.querySelectorAll('.table-container-scroll').forEach(container => {
    container.style.cssText = `
      overflow: visible !important;
      max-height: none !important;
      height: auto !important;
      border: 1px solid #ddd !important;
    `;
  });
  
  // Ensure tables are fully visible
  clone.querySelectorAll('table').forEach(table => {
    table.style.cssText = `
      width: 100% !important;
      border-collapse: collapse !important;
      page-break-inside: avoid !important;
    `;
    
    // Ensure table headers and cells are visible
    table.querySelectorAll('th, td').forEach(cell => {
      cell.style.border = '1px solid #ddd !important';
      cell.style.padding = '6px 8px !important';
    });
  });
  
  // Ensure all content is visible
  clone.querySelectorAll('*').forEach(el => {
    // Remove any max-height constraints
    if (el.style.maxHeight) {
      el.style.maxHeight = 'none !important';
    }
    
    // Remove any overflow hidden
    if (el.style.overflow === 'hidden' || el.style.overflowY === 'hidden') {
      el.style.overflow = 'visible !important';
      el.style.overflowY = 'visible !important';
    }
    
    // Ensure elements are visible
    el.style.visibility = 'visible !important';
    el.style.opacity = '1 !important';
  });
}

// Create print stylesheet
function createPrintStylesheet() {
  const styleId = 'print-modal-styles-' + Date.now();
  const style = document.createElement('style');
  style.id = styleId;
  
  style.textContent = `
    @media print {
      /* Hide everything except our print modal */
      body * {
        visibility: hidden !important;
        position: relative !important;
      }
      
      /* Show only the print modal and its children */
      .print-modal-active,
      .print-modal-active * {
        visibility: visible !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
      }
      
      /* Ensure modal displays as block */
      #viewApplicationModal {
        display: block !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: auto !important;
        background: white !important;
        z-index: 999999 !important;
        padding: 20px !important;
        margin: 0 !important;
        border: none !important;
        box-shadow: none !important;
      }
      
      /* Modal content full width */
      .modal-content {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
      }
      
      /* Remove all interactive elements */
      button,
      .btn,
      .action-btn,
      .close-button,
      .compact-actions,
      .modal-footer,
      .header-actions,
      .tab-navigation,
      input,
      textarea,
      select {
        display: none !important;
      }
      
      /* Fix tables for printing */
      table {
        page-break-inside: avoid !important;
        width: 100% !important;
        border-collapse: collapse !important;
      }
      
      th, td {
        border: 1px solid #ddd !important;
        padding: 6px 8px !important;
      }
      
      /* Remove table scrolling */
      .table-container-scroll {
        overflow: visible !important;
        max-height: none !important;
        height: auto !important;
        border: 1px solid #ddd !important;
      }
      
      /* Ensure content doesn't break awkwardly */
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid !important;
      }
      
      /* Remove scrollbars */
      ::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
      
      /* Page setup */
      @page {
        size: auto;
        margin: 15mm;
      }
      
      /* Print header/footer */
      @page {
        @top-left {
          content: "Loan Application";
          font-size: 10pt;
          color: #666;
        }
        @bottom-right {
          content: "Page " counter(page);
          font-size: 10pt;
          color: #666;
        }
      }
    }
    
    /* Screen styles for print preview */
    @media screen {
      .print-modal-active {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: white !important;
        z-index: 999999 !important;
        overflow-y: auto !important;
        padding: 20px !important;
      }
    }
  `;
  
  return style;
}

// Check if application is approved
function isApplicationApproved() {
  const statusEl = document.getElementById('applicationStatusBadge');
  if (!statusEl) return false;
  
  const statusText = (statusEl.textContent || '').toUpperCase();
  return statusText.includes('APPROVED');
}

// Confirm print for non-approved applications
async function confirmNonApprovedPrint() {
  if (typeof showConfirmModal === 'function') {
    return await showConfirmModal(
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

// Main print function
async function printApplicationDetails(options = {}) {
  const force = !!options.force;
  const showWarning = options.showWarning !== false;
  
  try {
    // Check if application is approved
    if (!force && showWarning && !isApplicationApproved()) {
      const shouldPrint = await confirmNonApprovedPrint();
      if (!shouldPrint) return;
    }
    
    // Show loading if function exists
    if (typeof showLoading === 'function') {
      showLoading('Preparing for print...');
    }
    
    // Create print clone
    const { clone } = createPrintClone();
    
    // Add print class
    clone.classList.add('print-modal-active');
    
    // Create print stylesheet
    const printStyles = createPrintStylesheet();
    
    // Store original body content
    const originalBodyHTML = document.body.innerHTML;
    const originalBodyClasses = document.body.className;
    
    // Create temporary container for printing
    const tempContainer = document.createElement('div');
    tempContainer.style.cssText = `
      position: fixed;
      left: -9999px;
      top: -9999px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    
    // Add styles and clone to temp container
    tempContainer.appendChild(printStyles);
    tempContainer.appendChild(clone);
    document.body.appendChild(tempContainer);
    
    // Store current scroll position
    const scrollPosition = window.scrollY;
    
    // Replace body with print content
    document.body.innerHTML = '';
    document.body.appendChild(clone);
    document.body.className = 'print-mode';
    document.body.style.cssText = 'margin: 0; padding: 0; background: white;';
    
    // Wait for layout to settle
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Trigger print
    window.print();
    
    // Restore original content
    setTimeout(() => {
      document.body.innerHTML = originalBodyHTML;
      document.body.className = originalBodyClasses;
      
      // Remove temporary container
      if (tempContainer.parentNode) {
        tempContainer.parentNode.removeChild(tempContainer);
      }
      
      // Restore scroll position
      window.scrollTo(0, scrollPosition);
      
      // Reinitialize any event listeners
      if (typeof initPrint === 'function') {
        initPrint();
      }
      
      // Hide loading
      if (typeof hideLoading === 'function') {
        hideLoading();
      }
      
      // Show success message
      if (typeof showToast === 'function') {
        showToast('Print completed successfully', 'success');
      }
      
    }, 100);
    
  } catch (error) {
    console.error('Print error:', error);
    
    // Hide loading
    if (typeof hideLoading === 'function') {
      hideLoading();
    }
    
    // Show error
    if (typeof showToast === 'function') {
      showToast(`Print failed: ${error.message}`, 'error');
    } else {
      alert(`Print failed: ${error.message}\n\nPlease try again or use your browser's print function (Ctrl+P).`);
    }
  }
}

// Quick print without warnings
function quickPrint() {
  return printApplicationDetails({
    showWarning: false,
    force: true
  });
}

// Export function
function exportApplicationDetails() {
  const shouldExport = confirm('Export this application as a printable document?\n\nThis will open the print dialog where you can choose "Save as PDF".');
  if (shouldExport) {
    printApplicationDetails({
      showWarning: false,
      force: true
    });
  }
}

// Initialize print functionality
function initPrint() {
  // Set up print button
  const printBtn = document.getElementById('btn-print');
  if (printBtn) {
    printBtn.onclick = () => printApplicationDetails();
  }
  
  // Set up export button
  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) {
    exportBtn.onclick = exportApplicationDetails;
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPrint);
} else {
  initPrint();
}

// Expose functions globally
window.printApplicationDetails = printApplicationDetails;
window.exportApplicationDetails = exportApplicationDetails;
window.quickPrint = quickPrint;

console.log('Print module loaded - preserves exact modal styling');
