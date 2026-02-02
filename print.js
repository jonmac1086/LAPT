// print.js - Full document PDF-style printing
// Converts modal to a complete printable document

// Get modal content for printing
function getModalContent() {
  // Try to get the main modal
  const modal = document.getElementById('viewApplicationModal');
  if (modal) return modal;
  
  // Fallback to any visible modal
  return document.querySelector('.modal[style*="display: block"], .modal.active');
}

// Create a printable document from modal
function createPrintableDocument(modal) {
  if (!modal) return null;
  
  // Clone the modal content
  const clone = modal.cloneNode(true);
  
  // Get application details for title
  const appNumber = document.getElementById('applicationNumber')?.textContent?.trim() || 'N/A';
  const applicantName = document.getElementById('applicationApplicantName')?.textContent?.trim() || 'N/A';
  const statusBadge = document.getElementById('applicationStatusBadge')?.textContent?.trim() || '';
  
  // Create document container
  const docContainer = document.createElement('div');
  docContainer.className = 'print-document';
  docContainer.style.cssText = `
    font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
    width: 210mm;
    max-width: 210mm;
    margin: 0 auto;
    background: white;
    color: #000;
    line-height: 1.4;
  `;
  
  // Create document header
  const header = document.createElement('header');
  header.className = 'document-header';
  header.style.cssText = `
    border-bottom: 3px double #333;
    padding-bottom: 15px;
    margin-bottom: 20px;
    text-align: center;
  `;
  
  header.innerHTML = `
    <h1 style="margin: 0 0 5px 0; font-size: 24px; color: #1a365d;">
      LOAN APPLICATION REPORT
    </h1>
    <div style="display: flex; justify-content: center; gap: 30px; margin-top: 10px;">
      <div>
        <strong>Application #:</strong> ${escapeHtml(appNumber)}
      </div>
      <div>
        <strong>Applicant:</strong> ${escapeHtml(applicantName)}
      </div>
      <div>
        <strong>Status:</strong> ${escapeHtml(statusBadge)}
      </div>
    </div>
    <div style="font-size: 12px; color: #666; margin-top: 8px;">
      Generated on ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}
    </div>
  `;
  
  docContainer.appendChild(header);
  
  // Extract and reorganize modal content for print
  const modalBody = clone.querySelector('.modal-body') || clone;
  
  // Process each section for print layout
  const sections = modalBody.querySelectorAll('.section-block, .view-details-section, .compact-view');
  
  sections.forEach(section => {
    const sectionClone = section.cloneNode(true);
    
    // Clean up section for print
    cleanupSectionForPrint(sectionClone);
    
    // Add page break before certain sections
    const sectionTitle = sectionClone.querySelector('h4, h5')?.textContent;
    if (sectionTitle && shouldPageBreakBefore(sectionTitle)) {
      sectionClone.style.pageBreakBefore = 'always';
      sectionClone.style.marginTop = '20px';
    }
    
    docContainer.appendChild(sectionClone);
  });
  
  // If no sections found, use the whole modal body
  if (sections.length === 0) {
    const bodyClone = modalBody.cloneNode(true);
    cleanupSectionForPrint(bodyClone);
    docContainer.appendChild(bodyClone);
  }
  
  // Add document footer
  const footer = document.createElement('footer');
  footer.className = 'document-footer';
  footer.style.cssText = `
    margin-top: 40px;
    padding-top: 15px;
    border-top: 1px solid #ddd;
    font-size: 11px;
    color: #666;
    text-align: center;
  `;
  
  footer.innerHTML = `
    <p style="margin: 5px 0;">
      <strong>CONFIDENTIAL DOCUMENT</strong> - For internal use only
    </p>
    <p style="margin: 5px 0;">
      Page <span class="page-number">1</span> of 1 • ${appNumber} • ${applicantName}
    </p>
    <p style="margin: 5px 0; font-style: italic;">
      This document was generated from the Loan Application System
    </p>
  `;
  
  docContainer.appendChild(footer);
  
  return docContainer;
}

// Clean up a section for printing
function cleanupSectionForPrint(section) {
  if (!section) return;
  
  // Remove interactive elements
  const removeSelectors = [
    'button',
    'input',
    'textarea',
    'select',
    '.action-btn',
    '.close-button',
    '.compact-actions',
    '.modal-footer',
    '.btn-icon',
    '.view-button',
    '.section-actions',
    '.header-actions',
    '[onclick]',
    '[contenteditable]'
  ];
  
  removeSelectors.forEach(selector => {
    section.querySelectorAll(selector).forEach(el => {
      el.remove();
    });
  });
  
  // Fix tables for print
  section.querySelectorAll('table').forEach(table => {
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.margin = '10px 0';
    
    // Ensure table headers are visible
    table.querySelectorAll('th').forEach(th => {
      th.style.backgroundColor = '#f5f5f5';
      th.style.fontWeight = 'bold';
      th.style.padding = '8px';
      th.style.border = '1px solid #ddd';
    });
    
    // Style table cells
    table.querySelectorAll('td').forEach(td => {
      td.style.padding = '6px 8px';
      td.style.border = '1px solid #eee';
      td.style.verticalAlign = 'top';
    });
  });
  
  // Style headings
  section.querySelectorAll('h4, h5, h6').forEach(heading => {
    heading.style.color = '#1a365d';
    heading.style.margin = '15px 0 8px 0';
    heading.style.paddingBottom = '4px';
    heading.style.borderBottom = '1px solid #eaeaea';
  });
  
  // Style values and text areas
  section.querySelectorAll('.view-value, .inline-value, .review-value').forEach(value => {
    value.style.background = '#f9f9f9';
    value.style.padding = '8px';
    value.style.borderRadius = '4px';
    value.style.border = '1px solid #eee';
    value.style.margin = '5px 0';
  });
  
  // Ensure proper spacing
  section.style.marginBottom = '20px';
  section.style.pageBreakInside = 'avoid';
}

// Determine if section should have page break before
function shouldPageBreakBefore(sectionTitle) {
  const breakSections = [
    'RISKS/RECOMMENDATIONS',
    'DOCUMENTS SUBMITTED',
    'SIGNATURES'
  ];
  
  return breakSections.some(breakSection => 
    sectionTitle.toUpperCase().includes(breakSection)
  );
}

// Add print styles to document
function addPrintStyles() {
  const styleId = 'print-styles-' + Date.now();
  let styleEl = document.getElementById(styleId);
  
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      @media print {
        /* Reset body for printing */
        body, html {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: auto !important;
          background: white !important;
          color: black !important;
          font-size: 12pt !important;
          line-height: 1.4 !important;
        }
        
        /* Hide everything except print document */
        body * {
          visibility: hidden;
        }
        
        .print-document,
        .print-document * {
          visibility: visible !important;
        }
        
        /* Print document styling */
        .print-document {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 15mm !important;
          box-shadow: none !important;
          background: white !important;
          z-index: 999999 !important;
        }
        
        /* Ensure proper page breaks */
        .print-document {
          page-break-before: always;
        }
        
        h1, h2, h3, h4, h5, h6 {
          page-break-after: avoid;
        }
        
        table, figure {
          page-break-inside: avoid;
        }
        
        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        
        /* Remove all scrolling and overflow */
        .print-document,
        .print-document * {
          overflow: visible !important;
          max-height: none !important;
          height: auto !important;
        }
        
        /* Remove table container scroll */
        .table-container-scroll,
        .table-container-scroll * {
          overflow: visible !important;
          max-height: none !important;
        }
        
        /* Hide scrollbars */
        ::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        
        /* Page setup */
        @page {
          size: A4 portrait;
          margin: 15mm;
          marks: crop cross;
        }
        
        @page :first {
          margin-top: 25mm;
        }
        
        /* Document header/footer */
        .document-header {
          position: running(header);
        }
        
        .document-footer {
          position: running(footer);
        }
        
        /* Page numbers */
        @page {
          @bottom-right {
            content: counter(page);
            font-size: 10pt;
            color: #666;
          }
        }
        
        /* Remove all interactive elements from print */
        button, .btn, .action-btn, .close-button, 
        .tab-navigation, .modal-footer, .compact-actions {
          display: none !important;
        }
      }
      
      @media screen {
        .print-document {
          display: block;
          margin: 20px auto;
          padding: 20px;
          background: white;
          box-shadow: 0 0 20px rgba(0,0,0,0.1);
          border-radius: 4px;
          max-width: 210mm;
        }
        
        .print-document .document-header {
          background: linear-gradient(to right, #1a365d, #2c5282);
          color: white;
          padding: 20px;
          border-radius: 4px 4px 0 0;
          margin: -20px -20px 20px -20px;
        }
        
        .print-document .document-header h1 {
          color: white;
        }
        
        .print-document .document-header div {
          color: rgba(255,255,255,0.9);
        }
      }
    `;
    
    document.head.appendChild(styleEl);
  }
  
  return styleEl;
}

// Main print function
async function printApplicationDetails(options = {}) {
  try {
    // Check if application is approved (optional)
    if (!options.force && options.showWarning !== false) {
      const isApproved = document.getElementById('applicationStatusBadge')?.textContent
        ?.toUpperCase().includes('APPROVED');
      
      if (!isApproved) {
        const confirmPrint = await confirmNonApprovedPrint();
        if (!confirmPrint) return;
      }
    }
    
    // Show loading
    if (typeof showLoading === 'function') {
      showLoading('Creating printable document...');
    }
    
    // Get modal and create printable document
    const modal = getModalContent();
    if (!modal) {
      throw new Error('No application data available. Please open an application first.');
    }
    
    const printableDoc = createPrintableDocument(modal);
    if (!printableDoc) {
      throw new Error('Failed to create printable document.');
    }
    
    // Add to body temporarily
    const tempContainer = document.createElement('div');
    tempContainer.style.cssText = `
      position: fixed;
      left: -9999px;
      top: -9999px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    tempContainer.appendChild(printableDoc);
    document.body.appendChild(tempContainer);
    
    // Add print styles
    const printStyles = addPrintStyles();
    
    // Store original body content and styles
    const originalBodyHTML = document.body.innerHTML;
    const originalBodyStyle = document.body.getAttribute('style') || '';
    
    // Replace body with printable document for printing
    document.body.innerHTML = '';
    document.body.appendChild(printableDoc);
    document.body.style.cssText = 'margin: 0; padding: 0; background: white;';
    
    // Trigger print
    setTimeout(() => {
      window.print();
      
      // Restore original content
      setTimeout(() => {
        document.body.innerHTML = originalBodyHTML;
        document.body.setAttribute('style', originalBodyStyle);
        
        // Remove temporary elements and styles
        if (printStyles && printStyles.parentNode) {
          printStyles.parentNode.removeChild(printStyles);
        }
        if (tempContainer.parentNode) {
          tempContainer.parentNode.removeChild(tempContainer);
        }
        
        // Reinitialize event listeners
        if (typeof initPrintButtons === 'function') {
          initPrintButtons();
        }
        
        // Hide loading
        if (typeof hideLoading === 'function') {
          hideLoading();
        }
      }, 100);
    }, 500);
    
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
      alert(`Print failed: ${error.message}`);
    }
  }
}

// Export as PDF/document
function exportApplicationDetails() {
  const confirmExport = confirm('Export application as a printable document (PDF)?\n\nUse the print dialog and select "Save as PDF" as the destination.');
  if (confirmExport) {
    printApplicationDetails({ 
      showWarning: false, 
      force: true 
    });
  }
}

// Confirmation for non-approved applications
async function confirmNonApprovedPrint() {
  return new Promise((resolve) => {
    if (typeof showConfirmModal === 'function') {
      showConfirmModal(
        'This application is not marked as APPROVED. Print anyway?',
        {
          title: 'Confirm Print',
          confirmText: 'Print Anyway',
          cancelText: 'Cancel',
          danger: false
        }
      ).then(resolve);
    } else {
      resolve(confirm('This application is not marked as APPROVED. Print anyway?'));
    }
  });
}

// Escape HTML for safety
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPrint);
} else {
  initPrint();
}

// Expose functions globally
window.printApplicationDetails = printApplicationDetails;
window.exportApplicationDetails = exportApplicationDetails;
window.initPrint = initPrint;

console.log('PDF-style print module loaded');
