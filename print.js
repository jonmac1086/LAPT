// Helper - Get modal for printing
function getModalForPrint() {
  // Try to get the view modal first
  const modal = document.getElementById('viewApplicationModal');
  if (modal && modal.innerHTML.trim()) {
    return modal;
  }
  
  // Fallback to any visible modal with content
  const modals = document.querySelectorAll('.modal');
  for (const modal of modals) {
    const style = window.getComputedStyle(modal);
    if (style.display !== 'none' && modal.innerHTML.trim()) {
      return modal;
    }
  }
  
  return null;
}

// Check if application is approved
function isApplicationApproved() {
  const statusBadge = document.getElementById('applicationStatusBadge');
  if (!statusBadge) return false;
  
  const statusText = (statusBadge.textContent || '').toUpperCase();
  return statusText.includes('APPROVED');
}

// Main print function
async function printApplicationDetails(options = {}) {
  const force = !!options.force;
  const showWarning = options.showWarning !== false;
  
  try {
    // Check if application is approved (optional warning)
    if (!force && showWarning && !isApplicationApproved()) {
      const shouldPrint = await confirmPrint();
      if (!shouldPrint) return;
    }
    
    // Get the modal
    const modal = getModalForPrint();
    if (!modal) {
      throw new Error('No application modal found to print. Please open an application first.');
    }
    
    // Create a clone of the modal
    const clone = modal.cloneNode(true);
    
    // Remove interactive elements from clone (keeps styling)
    const elementsToRemove = [
      '.close-button',
      '.action-btn',
      '.compact-actions',
      '.modal-footer',
      '.tab-navigation',
      '.tab-button',
      'button',
      'input',
      'textarea',
      'select',
      '[onclick]',
      '[contenteditable]'
    ];
    
    elementsToRemove.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => {
        // Remove event handlers
        el.removeAttribute('onclick');
        el.removeAttribute('onchange');
        el.removeAttribute('oninput');
        
        // Hide buttons and inputs
        if (selector === 'button' || selector === 'input' || selector === 'textarea' || selector === 'select') {
          el.style.display = 'none';
        }
      });
    });
    
    // Remove script tags
    clone.querySelectorAll('script').forEach(script => script.remove());
    
    // Get page title
    const appNumber = document.getElementById('applicationNumber')?.textContent || 'Application';
    const applicantName = document.getElementById('applicationApplicantName')?.textContent || '';
    const title = `${appNumber}${applicantName ? ` - ${applicantName}` : ''}`;
    
    // Create a temporary print container
    const printContainer = document.createElement('div');
    printContainer.className = 'print-container';
    printContainer.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      z-index: 99999;
      background: white;
      overflow: auto;
      padding: 20px;
      box-sizing: border-box;
    `;
    
    // Add print header
    const printHeader = document.createElement('div');
    printHeader.className = 'print-header';
    printHeader.style.cssText = `
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #333;
    `;
    printHeader.innerHTML = `
      <h2 style="margin: 0 0 5px 0;">Loan Application</h2>
      <p style="margin: 0; color: #666;">Printed on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
    `;
    
    printContainer.appendChild(printHeader);
    printContainer.appendChild(clone);
    
    // Add print footer
    const printFooter = document.createElement('div');
    printFooter.className = 'print-footer';
    printFooter.style.cssText = `
      text-align: center;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
    `;
    printFooter.innerHTML = `
      <p>Page 1 of 1 • Confidential • ${title}</p>
    `;
    
    printContainer.appendChild(printFooter);
    
    // Add to document
    document.body.appendChild(printContainer);
    
    // Apply print-specific styles
    const printStyles = document.createElement('style');
    printStyles.textContent = `
      @media print {
        body * {
          visibility: hidden;
        }
        
        .print-container,
        .print-container * {
          visibility: visible;
        }
        
        .print-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: auto;
          padding: 0;
          margin: 0;
        }
        
        .print-header,
        .print-footer {
          display: block !important;
        }
        
        .modal {
          display: block !important;
          position: relative !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
        
        .modal-content {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 10px !important;
          box-shadow: none !important;
          border: none !important;
        }
        
        .loan-application-modal {
          width: 100% !important;
          max-width: 100% !important;
        }
        
        /* Hide interactive elements in print */
        button,
        .action-btn,
        .compact-actions,
        .close-button,
        .tab-navigation,
        .modal-footer,
        .header-actions {
          display: none !important;
        }
        
        /* Ensure tables print nicely */
        table {
          page-break-inside: avoid;
          width: 100% !important;
        }
        
        th, td {
          border: 1px solid #ddd !important;
          padding: 6px !important;
        }
        
        /* Page breaks */
        h1, h2, h3, h4, h5, h6 {
          page-break-after: avoid;
        }
        
        tr {
          page-break-inside: avoid;
        }
        
        @page {
          margin: 15mm;
        }
      }
      
      @media screen {
        .print-container {
          display: none;
        }
      }
    `;
    
    document.head.appendChild(printStyles);
    
    // Trigger print
    window.print();
    
    // Clean up after printing
    setTimeout(() => {
      document.body.removeChild(printContainer);
      document.head.removeChild(printStyles);
    }, 100);
    
  } catch (error) {
    console.error('Print error:', error);
    
    // Show error
    if (typeof showToast === 'function') {
      showToast(`Print failed: ${error.message}`, 'error');
    } else {
      alert(`Print failed: ${error.message}`);
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
  const exportConfirmed = confirm('Export this application as a printable document?');
  if (exportConfirmed) {
    printApplicationDetails({ 
      showWarning: false, 
      force: true 
    });
  }
}

// Confirmation dialog
async function confirmPrint() {
  return new Promise((resolve) => {
    if (typeof showConfirmModal === 'function') {
      showConfirmModal(
        'This application is not marked as APPROVED. Print anyway?',
        {
          title: 'Confirm Print',
          confirmText: 'Print',
          cancelText: 'Cancel'
        }
      ).then(resolve);
    } else {
      resolve(confirm('This application is not marked as APPROVED. Print anyway?'));
    }
  });
}

// Initialize print buttons
function initPrintButtons() {
  // Add print button handler
  const printBtn = document.getElementById('btn-print');
  if (printBtn) {
    printBtn.onclick = () => printApplicationDetails();
  }
  
  // Add export button handler
  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) {
    exportBtn.onclick = exportApplicationDetails;
  }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', initPrintButtons);

// Expose to global scope
window.printApplicationDetails = printApplicationDetails;
window.quickPrint = quickPrint;
window.exportApplicationDetails = exportApplicationDetails;

console.log('Print module loaded - prints modal directly as styled');
