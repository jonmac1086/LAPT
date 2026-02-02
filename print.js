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

// Extract modal content and convert to document format
function createDocumentFromModal() {
  const modal = document.getElementById('viewApplicationModal');
  if (!modal || (modal.style.display === 'none' && !modal.classList.contains('active'))) {
    throw new Error('Please open an application first.');
  }
  
  // Get application details for document header
  const appNumber = document.getElementById('applicationNumber')?.textContent?.trim() || 'N/A';
  const applicantName = document.getElementById('applicationApplicantName')?.textContent?.trim() || 'N/A';
  const statusBadge = document.getElementById('applicationStatusBadge')?.textContent?.trim() || '';
  
  // Clone modal body
  const modalBody = modal.querySelector('.modal-body');
  const bodyClone = modalBody ? modalBody.cloneNode(true) : modal.cloneNode(true);
  
  // Create document container
  const documentContainer = document.createElement('div');
  documentContainer.id = 'print-document';
  documentContainer.className = 'print-document';
  
  // Add document header
  const header = document.createElement('div');
  header.className = 'document-header';
  header.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px;">
      <h1 style="margin: 0 0 5px 0; font-size: 24px; color: #1a365d;">LOAN APPLICATION</h1>
      <div style="display: flex; justify-content: center; gap: 30px; margin: 10px 0; font-size: 14px;">
        <div><strong>Application #:</strong> ${escapeHtml(appNumber)}</div>
        <div><strong>Applicant:</strong> ${escapeHtml(applicantName)}</div>
        <div><strong>Status:</strong> ${escapeHtml(statusBadge)}</div>
      </div>
      <div style="font-size: 12px; color: #666;">
        Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
      </div>
    </div>
  `;
  documentContainer.appendChild(header);
  
  // Process and add modal content
  cleanupContentForDocument(bodyClone);
  documentContainer.appendChild(bodyClone);
  
  // Add document footer
  const footer = document.createElement('div');
  footer.className = 'document-footer';
  footer.innerHTML = `
    <div style="margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 11px; color: #666; text-align: center;">
      <p style="margin: 5px 0;"><strong>CONFIDENTIAL DOCUMENT</strong></p>
      <p style="margin: 5px 0;">Page 1 of 1 • ${escapeHtml(appNumber)} • ${escapeHtml(applicantName)}</p>
    </div>
  `;
  documentContainer.appendChild(footer);
  
  return documentContainer;
}

// Clean up content for document format
function cleanupContentForDocument(element) {
  if (!element) return;
  
  // Remove interactive elements
  const elementsToRemove = [
    'button',
    '.action-btn',
    '.close-button',
    '.compact-actions',
    '.modal-footer',
    '.header-actions',
    '.view-button',
    'input',
    'textarea',
    'select',
    '[onclick]',
    'script'
  ];
  
  elementsToRemove.forEach(selector => {
    element.querySelectorAll(selector).forEach(el => {
      el.parentNode && el.parentNode.removeChild(el);
    });
  });
  
  // Fix tables for document format
  element.querySelectorAll('table').forEach(table => {
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.margin = '10px 0';
    
    table.querySelectorAll('th').forEach(th => {
      th.style.backgroundColor = '#f8f9fa';
      th.style.fontWeight = 'bold';
      th.style.padding = '8px';
      th.style.border = '1px solid #dee2e6';
    });
    
    table.querySelectorAll('td').forEach(td => {
      td.style.padding = '6px 8px';
      td.style.border = '1px solid #dee2e6';
    });
  });
  
  // Remove scrolling containers
  element.querySelectorAll('.table-container-scroll').forEach(container => {
    container.style.overflow = 'visible';
    container.style.maxHeight = 'none';
    container.style.border = '1px solid #ddd';
    container.style.padding = '10px';
    container.style.margin = '10px 0';
  });
  
  // Style section headers
  element.querySelectorAll('.section-header h4, .section-header h5').forEach(header => {
    header.style.color = '#1a365d';
    header.style.margin = '15px 0 10px 0';
    header.style.paddingBottom = '5px';
    header.style.borderBottom = '2px solid #eaeaea';
  });
  
  // Style inline values
  element.querySelectorAll('.inline-value, .view-value').forEach(value => {
    value.style.background = '#f8f9fa';
    value.style.padding = '8px';
    value.style.borderRadius = '4px';
    value.style.border = '1px solid #e9ecef';
    value.style.margin = '4px 0';
  });
}

// Apply document print styles
function applyDocumentPrintStyles() {
  const styleId = 'document-print-styles-' + Date.now();
  const style = document.createElement('style');
  style.id = styleId;
  
  style.textContent = `
    @media print {
      /* Hide everything except print document */
      body * {
        visibility: hidden;
        margin: 0;
        padding: 0;
      }
      
      #print-document,
      #print-document * {
        visibility: visible !important;
      }
      
      /* Document styling */
      #print-document {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        min-height: 100vh !important;
        margin: 0 !important;
        padding: 20mm !important;
        background: white !important;
        box-shadow: none !important;
        border: none !important;
        font-family: 'Segoe UI', 'Roboto', sans-serif !important;
        color: #000 !important;
        line-height: 1.4 !important;
        font-size: 12pt !important;
      }
      
      /* Page setup for A4 */
      @page {
        size: A4 portrait;
        margin: 20mm;
      }
      
      /* Document sections */
      .section-block, .view-details-section, .compact-view {
        margin-bottom: 20px !important;
        page-break-inside: avoid !important;
      }
      
      /* Tables */
      table {
        width: 100% !important;
        border-collapse: collapse !important;
        page-break-inside: avoid !important;
        margin: 15px 0 !important;
      }
      
      th {
        background-color: #f8f9fa !important;
        font-weight: bold !important;
        border: 1px solid #dee2e6 !important;
        padding: 8px !important;
      }
      
      td {
        border: 1px solid #dee2e6 !important;
        padding: 6px 8px !important;
      }
      
      /* Headers */
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid !important;
        color: #1a365d !important;
      }
      
      /* Remove interactive elements */
      button, .btn, .action-btn, input, textarea, select {
        display: none !important;
      }
      
      /* Document header/footer */
      .document-header {
        margin-bottom: 25px !important;
        border-bottom: 2px solid #333 !important;
      }
      
      .document-footer {
        position: fixed;
        bottom: 20mm;
        width: calc(100% - 40mm);
        font-size: 10pt !important;
      }
      
      /* Page numbers */
      @page {
        @bottom-right {
          content: "Page " counter(page);
          font-size: 10pt;
          color: #666;
        }
      }
      
      /* Ensure no overflow */
      * {
        max-height: none !important;
        overflow: visible !important;
      }
      
      .table-container-scroll {
        overflow: visible !important;
        max-height: none !important;
        border: 1px solid #ddd !important;
      }
    }
    
    /* Screen preview */
    @media screen {
      #print-document {
        width: 210mm;
        min-height: 297mm;
        margin: 20px auto;
        padding: 25mm;
        background: white;
        box-shadow: 0 0 20px rgba(0,0,0,0.1);
        border: 1px solid #ddd;
        font-family: 'Segoe UI', 'Roboto', sans-serif;
      }
      
      .document-header {
        background: linear-gradient(to right, #1a365d, #2d5185);
        color: white;
        padding: 20px;
        margin: -25mm -25mm 25mm -25mm;
        border-radius: 0;
      }
      
      .document-header h1 {
        color: white;
      }
      
      .document-header div {
        color: rgba(255,255,255,0.9);
      }
    }
  `;
  
  return style;
}

// Main print function
async function printApplicationDetails(options = {}) {
  const force = !!options.force;
  const showWarning = options.showWarning !== false;
  
  try {
    // Check approval status
    if (!force && showWarning && !isApplicationApproved()) {
      const shouldPrint = await confirmNonApprovedPrint();
      if (!shouldPrint) return;
    }
    
    // Create document from modal
    const document = createDocumentFromModal();
    
    // Apply print styles
    const printStyles = applyDocumentPrintStyles();
    
    // Store original state
    const originalBodyHTML = document.body.innerHTML;
    const originalTitle = document.title;
    
    // Update title for print
    const appNumber = document.getElementById('applicationNumber')?.textContent?.trim() || 'Application';
    document.title = `Loan Application - ${appNumber}`;
    
    // Prepare body for printing
    document.body.innerHTML = '';
    document.body.appendChild(printStyles);
    document.body.appendChild(document);
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.background = 'white';
    
    // Trigger print
    setTimeout(() => {
      window.print();
      
      // Restore original content
      setTimeout(() => {
        document.body.innerHTML = originalBodyHTML;
        document.title = originalTitle;
        
        // Reinitialize
        if (typeof initPrint === 'function') initPrint();
      }, 100);
    }, 150);
    
  } catch (error) {
    console.error('Print error:', error);
    alert(`Print failed: ${error.message}`);
  }
}

// Quick print function
function quickPrint() {
  return printApplicationDetails({
    showWarning: false,
    force: true
  });
}

// Export as PDF
function exportApplicationDetails() {
  const confirmed = confirm('Export as PDF?\n\nClick OK, then select "Save as PDF" in the print dialog.');
  if (confirmed) {
    printApplicationDetails({
      showWarning: false,
      force: true
    });
  }
}

// HTML escaping
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
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

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPrint);
} else {
  initPrint();
}

// Global exports
window.printApplicationDetails = printApplicationDetails;
window.exportApplicationDetails = exportApplicationDetails;
window.quickPrint = quickPrint;

console.log('Document print module loaded');
