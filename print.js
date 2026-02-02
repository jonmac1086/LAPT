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

// Main print function - no loading indicators
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
    
    // Store original body content
    const originalBodyHTML = document.body.innerHTML;
    const originalBodyClass = document.body.className;
    
    // Create a clean clone of the modal
    const clone = modal.cloneNode(true);
    
    // Remove interactive elements from clone
    const elementsToRemove = [
      'button',
      '.action-btn',
      '.close-button',
      '.compact-actions',
      '.modal-footer',
      '.header-actions',
      'input',
      'textarea',
      'select',
      '[onclick]',
      'script'
    ];
    
    elementsToRemove.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => {
        el.parentNode && el.parentNode.removeChild(el);
      });
    });
    
    // Apply print styles to clone
    clone.style.cssText = `
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      height: auto !important;
      margin: 0 !important;
      padding: 20px !important;
      background: white !important;
      display: block !important;
      z-index: 999999 !important;
      overflow: visible !important;
    `;
    
    // Fix modal content
    const modalContent = clone.querySelector('.modal-content');
    if (modalContent) {
      modalContent.style.cssText = `
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        background: transparent !important;
      `;
    }
    
    // Remove scroll constraints
    clone.querySelectorAll('.table-container-scroll').forEach(el => {
      el.style.overflow = 'visible !important';
      el.style.maxHeight = 'none !important';
    });
    
    // Create print stylesheet
    const printStyle = document.createElement('style');
    printStyle.textContent = `
      @media print {
        /* Hide everything except our print content */
        body * {
          visibility: hidden;
        }
        
        #print-view,
        #print-view * {
          visibility: visible !important;
        }
        
        /* Position the print content */
        #print-view {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          background: white !important;
        }
        
        /* Remove interactive elements */
        button, .btn, .action-btn, .close-button,
        .compact-actions, .modal-footer {
          display: none !important;
        }
        
        /* Ensure tables print properly */
        table {
          page-break-inside: avoid;
          width: 100% !important;
        }
        
        /* Remove scrollbars */
        .table-container-scroll {
          overflow: visible !important;
          max-height: none !important;
        }
        
        /* Page setup */
        @page {
          margin: 15mm;
        }
      }
    `;
    
    // Set up print container
    clone.id = 'print-view';
    
    // Replace body with print content
    document.body.innerHTML = '';
    document.body.appendChild(printStyle);
    document.body.appendChild(clone);
    document.body.className = 'print-mode';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.background = 'white';
    
    // Trigger print immediately
    setTimeout(() => {
      window.print();
      
      // Restore original content
      setTimeout(() => {
        document.body.innerHTML = originalBodyHTML;
        document.body.className = originalBodyClass;
        
        // Reinitialize any event listeners
        if (typeof initPrint === 'function') {
          initPrint();
        }
      }, 50);
    }, 100);
    
  } catch (error) {
    console.error('Print error:', error);
    
    // Show simple error
    alert(`Print failed: ${error.message}`);
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
  if (confirm('Export as PDF?\n\nClick OK, then choose "Save as PDF" in the print dialog.')) {
    printApplicationDetails({
      showWarning: false,
      force: true
    });
  }
}

// Simple initialization
function initPrint() {
  const printBtn = document.getElementById('btn-print');
  if (printBtn) {
    printBtn.onclick = () => printApplicationDetails();
  }
  
  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) {
    exportBtn.onclick = exportApplicationDetails;
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

console.log('Direct print module loaded - no loading indicators');
