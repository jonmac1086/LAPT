// Helper - Get modal content for printing
function getModalContentForPrint() {
  // Try multiple selectors to find the modal content
  const selectors = [
    '#viewApplicationModal .modal-content',
    '#viewApplicationModal',
    '.loan-application-modal',
    '.view-details-section'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.innerHTML.trim()) {
      return element;
    }
  }
  return null;
}

// Helper - Determine if application is approved
function isApplicationApproved() {
  const statusElements = [
    document.getElementById('applicationStatusBadge'),
    document.querySelector('.status-badge'),
    document.querySelector('[data-status]')
  ];
  
  for (const el of statusElements) {
    if (!el) continue;
    const text = (el.textContent || '').toUpperCase();
    if (text.includes('APPROVED')) return true;
  }
  return false;
}

// Sanitize content for printing
function sanitizeForPrint(element) {
  if (!element) return null;
  
  // Deep clone
  const clone = element.cloneNode(true);
  
  // Remove interactive elements
  const removeSelectors = [
    'button',
    'input',
    'textarea',
    'select',
    '.no-print',
    '.action-btn',
    '.compact-actions',
    '.close-button',
    '.tab-navigation',
    '.tab-button',
    '.btn-icon',
    '.header-actions',
    '.modal-footer',
    '[onclick]',
    '[onchange]',
    '[contenteditable="true"]'
  ];
  
  removeSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => {
      el.removeAttribute('onclick');
      el.removeAttribute('onchange');
      el.style.display = 'none';
    });
  });
  
  // Remove script tags
  clone.querySelectorAll('script').forEach(script => script.remove());
  
  // Remove hidden elements
  clone.querySelectorAll('[style*="display: none"], [style*="display:none"], [hidden]')
    .forEach(el => el.remove());
  
  // Add print-specific classes
  clone.classList.add('print-version');
  
  // Ensure tables have borders for print
  clone.querySelectorAll('table').forEach(table => {
    table.setAttribute('border', '1');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
  });
  
  // Add page break prevention
  clone.querySelectorAll('tr, .break-avoid').forEach(el => {
    el.style.pageBreakInside = 'avoid';
  });
  
  // Add print-only message
  const printInfo = document.createElement('div');
  printInfo.className = 'print-info';
  printInfo.style.cssText = `
    font-size: 10px;
    color: #666;
    text-align: center;
    margin-bottom: 10px;
    border-bottom: 1px dashed #ccc;
    padding-bottom: 5px;
  `;
  printInfo.textContent = `Printed from Loan Application System on ${new Date().toLocaleString()}`;
  
  clone.insertBefore(printInfo, clone.firstChild);
  
  return clone;
}

// Copy styles to print window
function copyStylesToPrintWindow(sourceWindow, targetWindow) {
  const styles = [];
  
  // Get all stylesheets
  Array.from(sourceWindow.document.styleSheets).forEach(sheet => {
    try {
      if (sheet.href) {
        // External stylesheet
        const link = targetWindow.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        targetWindow.document.head.appendChild(link);
      } else {
        // Inline stylesheet
        const rules = Array.from(sheet.cssRules || sheet.rules || []);
        const cssText = rules.map(rule => rule.cssText).join('\n');
        if (cssText) {
          const style = targetWindow.document.createElement('style');
          style.textContent = cssText;
          targetWindow.document.head.appendChild(style);
        }
      }
    } catch (e) {
      console.warn('Could not copy stylesheet:', e);
    }
  });
  
  // Add print-specific styles
  const printStyle = targetWindow.document.createElement('style');
  printStyle.textContent = `
    @media print {
      body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
      .print-version { width: 100% !important; max-width: 100% !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      .no-print, .action-btn, button { display: none !important; }
      a { color: #000 !important; text-decoration: none !important; }
    }
    @page { margin: 15mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-info { display: block; }
  `;
  targetWindow.document.head.appendChild(printStyle);
}

// Create optimized print window
function createPrintWindow(title = 'Application Print') {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups to print.');
  }
  
  printWindow.document.open();
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)}</title>
      <style>
        body { margin: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        .loading-print { text-align: center; padding: 40px; }
      </style>
    </head>
    <body>
      <div class="loading-print">
        <h3>Preparing document for printing...</h3>
        <p>Please wait while we prepare the application details.</p>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
  
  return printWindow;
}

// Main print function
async function printApplicationDetails(options = {}) {
  const force = !!options.force;
  const showWarning = options.showWarning !== false;
  
  try {
    // Check if application is approved
    if (!force && showWarning && !isApplicationApproved()) {
      const shouldPrint = await showPrintWarning();
      if (!shouldPrint) return;
    }
    
    // Get modal content
    const modalContent = getModalContentForPrint();
    if (!modalContent) {
      throw new Error('Could not find application content to print. Please make sure the application is open.');
    }
    
    // Show loading
    if (typeof showLoading === 'function') {
      showLoading('Preparing print...');
    }
    
    // Sanitize content
    const printContent = sanitizeForPrint(modalContent);
    if (!printContent) {
      throw new Error('Failed to prepare content for printing.');
    }
    
    // Get application info for title
    const appNumber = document.getElementById('applicationNumber')?.textContent ||
                     document.querySelector('.application-number')?.textContent ||
                     'Unknown';
    const applicantName = document.getElementById('applicationApplicantName')?.textContent ||
                         document.querySelector('.applicant-name')?.textContent ||
                         'Unknown Applicant';
    const title = `Application ${appNumber} - ${applicantName}`;
    
    // Create print window
    const printWindow = createPrintWindow(title);
    
    // Copy styles
    copyStylesToPrintWindow(window, printWindow);
    
    // Add content
    setTimeout(() => {
      try {
        printWindow.document.body.innerHTML = '';
        printWindow.document.body.appendChild(printContent);
        
        // Trigger print
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          
          // Clean up
          setTimeout(() => {
            try {
              printWindow.close();
            } catch (e) {
              // Ignore close errors
            }
          }, 500);
        }, 500);
      } catch (e) {
        printWindow.document.body.innerHTML = `
          <div style="color: red; padding: 40px; text-align: center;">
            <h3>Print Error</h3>
            <p>${escapeHtml(e.message)}</p>
            <button onclick="window.close()">Close</button>
          </div>
        `;
        throw e;
      }
    }, 100);
    
  } catch (error) {
    console.error('Print error:', error);
    
    // Show error to user
    if (typeof showToast === 'function') {
      showToast(`Print failed: ${error.message}`, 'error');
    } else {
      alert(`Print failed: ${error.message}`);
    }
    
    // Fallback to browser print
    if (options.fallback !== false) {
      console.log('Attempting fallback print...');
      window.print();
    }
  } finally {
    // Hide loading
    if (typeof hideLoading === 'function') {
      hideLoading();
    }
  }
}

// Show warning for non-approved applications
async function showPrintWarning() {
  return new Promise((resolve) => {
    if (typeof showConfirmModal === 'function') {
      showConfirmModal(
        'This application is not marked as APPROVED. Do you still want to print?',
        {
          title: 'Confirm Print',
          confirmText: 'Print Anyway',
          cancelText: 'Cancel',
          danger: false
        }
      ).then(resolve);
    } else {
      resolve(confirm('This application is not marked as APPROVED. Do you still want to print?'));
    }
  });
}

// Quick print function (no warnings)
function quickPrint() {
  return printApplicationDetails({ showWarning: false, force: true });
}

// Export function for non-approved applications
function exportApplicationDetails() {
  if (typeof showConfirmModal === 'function') {
    showConfirmModal(
      'Export application details as a printable document?',
      {
        title: 'Export Document',
        confirmText: 'Export',
        cancelText: 'Cancel'
      }
    ).then((confirmed) => {
      if (confirmed) {
        printApplicationDetails({ force: true, fallback: false });
      }
    });
  } else {
    if (confirm('Export application details as a printable document?')) {
      printApplicationDetails({ force: true, fallback: false });
    }
  }
}

// Helper function to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize print functionality
function initPrint() {
  // Add print button if not exists
  if (!document.getElementById('btn-print')) {
    const printBtn = document.createElement('button');
    printBtn.id = 'btn-print';
    printBtn.className = 'action-btn';
    printBtn.innerHTML = '<i class="fas fa-print"></i> Print';
    printBtn.onclick = () => printApplicationDetails();
    
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
      headerActions.insertBefore(printBtn, headerActions.firstChild);
    }
  }
  
  // Add export button if not exists
  if (!document.getElementById('btn-export')) {
    const exportBtn = document.createElement('button');
    exportBtn.id = 'btn-export';
    exportBtn.className = 'action-btn primary';
    exportBtn.innerHTML = '<i class="fas fa-download"></i> Export';
    exportBtn.onclick = exportApplicationDetails;
    
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
      const printBtn = document.getElementById('btn-print');
      if (printBtn) {
        headerActions.insertBefore(exportBtn, printBtn.nextSibling);
      } else {
        headerActions.appendChild(exportBtn);
      }
    }
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPrint);
} else {
  initPrint();
}

// Expose to global scope
window.printApplicationDetails = printApplicationDetails;
window.quickPrint = quickPrint;
window.exportApplicationDetails = exportApplicationDetails;
window.initPrint = initPrint;

console.log('Print module loaded successfully');
