// viewApplicationJS - View Application Modal JavaScript (UPDATED with modal-local loading)
// - Uses server permissions when available to show comment editors by role
// - Falls back to client-stored role if server permissions unavailable
// - Restores NET INCOME into table
// - UPDATED: Uses modal-local loading for all submissions (matches newApps.js pattern)

console.log('viewApplicationJS loaded (with modal-local loading)');

let currentAppData = null;
let currentUserPermissions = null; // cached permissions for the logged-in user

// ========== MODAL-LOCAL LOADING HELPERS ==========
/**
 * Show loading indicator inside the view modal (modal-local)
 * Creates a centered card with spinner inside the .modal-content
 */
function showViewModalLoading(message = 'Processing...') {
  try {
    const modal = document.getElementById('viewApplicationModal');
    if (!modal) return;

    const container = modal.querySelector('.modal-content');
    if (!container) return;

    // Ensure container has positioning context
    const computedPosition = window.getComputedStyle(container).position;
    if (!computedPosition || computedPosition === 'static') {
      container.style.position = 'relative';
    }

    // Create or show existing loader
    let loader = modal.querySelector('.modal-local-loading');
    if (!loader) {
      loader = document.createElement('div');
      loader.className = 'modal-local-loading';
      loader.innerHTML = `
        <div class="modal-local-card" role="status" aria-live="polite" aria-label="Loading">
          <div class="spinner large" aria-hidden="true"></div>
          <div class="modal-local-message"></div>
        </div>
      `;
      container.appendChild(loader);
    }

    const msgEl = loader.querySelector('.modal-local-message');
    if (msgEl) msgEl.textContent = message;
    loader.style.display = 'flex';

  } catch (e) {
    console.warn('showViewModalLoading error', e);
  }
}

/**
 * Hide loading indicator inside the view modal
 */
function hideViewModalLoading() {
  try {
    const modal = document.getElementById('viewApplicationModal');
    if (!modal) return;

    const loader = modal.querySelector('.modal-local-loading');
    if (loader) {
      // Remove element entirely so next call creates fresh instance
      loader.parentNode && loader.parentNode.removeChild(loader);
    }
  } catch (e) {
    console.warn('hideViewModalLoading error', e);
  }
}

// ========== HELPER FUNCTIONS ==========
function setStatusBadge(statusRaw, stageRaw) {
  const badge = document.getElementById('applicationStatusBadge');
  if (!badge) return;
  const status = (statusRaw || '').toString().trim().toUpperCase();
  const stage = stageRaw || '';
  let text = status || stage || 'NEW';
  let bg = '#eef6ff'; // default light
  let color = '#1f2937';

  switch (status) {
    case 'NEW':
    case '':
      bg = '#f3f4f6'; color = '#111827'; text = `NEW`;
      break;
    case 'PENDING':
      bg = '#fff7ed'; color = '#92400e'; text = `PENDING`;
      break;
    case 'PENDING APPROVAL':
      bg = '#e6f0ff'; color = '#0546a0'; text = `PENDING APPROVAL`;
      break;
    case 'APPROVED':
      bg = '#ecfdf5'; color = '#065f46'; text = `APPROVED`;
      break;
    case 'REVERTED':
    case 'REVERT':
      bg = '#ffebef'; color = '#9b1c1c'; text = `REVERTED`;
      break;
    default:
      bg = '#f3f4f6'; color = '#111827'; text = status || stage || 'N/A';
      break;
  }

  badge.textContent = text;
  badge.style.background = bg;
  badge.style.color = color;
  badge.style.border = `1px solid ${shadeColor(bg, -8)}`;
}

function shadeColor(hexColor, percent) {
  try {
    const h = hexColor.replace('#','');
    const num = parseInt(h,16);
    const r = (num >> 16) + percent;
    const g = ((num >> 8) & 0x00FF) + percent;
    const b = (num & 0x0000FF) + percent;
    const newR = Math.max(Math.min(255, r), 0);
    const newG = Math.max(Math.min(255, g), 0);
    const newB = Math.max(Math.min(255, b), 0);
    return `rgb(${newR}, ${newG}, ${newB})`;
  } catch (e) {
    return hexColor;
  }
}

// ========== FETCH USER PERMISSIONS ==========
async function fetchUserPermissions(userName) {
  try {
    if (!userName) return null;
    const resp = await window.apiService.request('get_user_permissions', { userName: userName }, { showLoading: false });
    if (resp && resp.success) return resp.data || null;
    console.warn('fetchUserPermissions: unexpected response', resp);
    return null;
  } catch (err) {
    console.error('fetchUserPermissions error', err);
    return null;
  }
}

// ========== MAIN VIEW FUNCTION ==========
async function viewApplication(appNumber) {
  if (!appNumber) {
    console.error('No application number provided');
    return;
  }

  // Use the improved showLoading (which uses modal-local if modal is open)
  if (typeof showLoading === 'function') {
    showLoading('Loading application details...');
  }

  try {
    const userName = localStorage.getItem('loggedInName') || '';
    const response = await window.apiService.getApplicationDetails(appNumber, userName, { showLoading: false });

    if (typeof hideLoading === 'function') hideLoading();

    if (response && response.success && response.data) {
      initViewApplicationModal(response.data);
    } else {
      console.error('Failed to fetch application details', response);
      if (typeof window.showToast === 'function') window.showToast('Failed to load application details: ' + (response?.message || 'Unknown error'), 'error');
      else alert('Failed to load application details: ' + (response?.message || 'Unknown error'));
    }
  } catch (err) {
    if (typeof hideLoading === 'function') hideLoading();
    console.error('Error fetching application:', err);
    if (typeof window.showToast === 'function') window.showToast('Failed to load application details.', 'error');
    else alert('Failed to load application details.');
  }
}

function initViewApplicationModal(appData) {
  // Allow being called with no argument (re-render existing)
  if (!appData) {
    if (!currentAppData) return;
    appData = currentAppData;
  }

  currentAppData = appData || {};

  const appNumber = appData.appNumber || 'N/A';
  const applicantName = appData.applicantName || appData.name || 'N/A';

  // Header
  safeSetText('applicationNumber', appNumber);
  safeSetText('applicationApplicantName', applicantName);

  // Status badge
  setStatusBadge(appData.status, appData.stage);

  // Print button visibility
  const printBtn = document.getElementById('btn-print');
  if (printBtn) {
    if ((appData.status || '').toString().trim().toUpperCase() === 'APPROVED') printBtn.style.display = 'inline-block';
    else printBtn.style.display = 'none';
  }

  // Populate fields
  safeSetText('view-name', applicantName);
  safeSetText('view-amount', formatCurrency(appData.amount));
  safeSetText('view-purpose', appData.purpose || 'N/A');
  safeSetText('view-duration', appData.duration ? `${appData.duration} months` : 'N/A');
  safeSetText('view-interestRate', appData.interestRate ? `${appData.interestRate}%` : 'N/A');

  safeSetText('view-characterComment', appData.characterComment || 'No character assessment provided.');

  populateLoanHistoryReview(appData.loanHistory || []);
  populatePersonalBudgetReview(appData.personalBudget || []);
  populateMonthlyTurnoverReview(appData.monthlyTurnover || {});

  safeSetText('view-marginComment', appData.marginComment || 'No comment');
  safeSetText('view-repaymentComment', appData.repaymentComment || 'No comment');
  safeSetText('view-securityComment', appData.securityComment || 'No comment');
  safeSetText('view-financialsComment', appData.financialsComment || 'No comment');
  safeSetText('view-risksComment', appData.risksComment || 'No comment');
  safeSetText('view-riskMitigationComment', appData.riskMitigationComment || 'No comment');
  safeSetText('view-creditOfficerComment', appData.creditOfficerComment || 'No recommendation');

  // Display recommendation blocks
  safeSetText('view-details-creditOfficerComment', appData.creditOfficerComment || 'No recommendation');
  safeSetText('view-details-amlroComments', appData.amlroComments || 'No comments');
  safeSetText('view-details-headOfCredit', appData.headOfCredit || 'No recommendation');
  safeSetText('view-details-branchManager', appData.branchManager || 'No recommendation');
  safeSetText('view-details-approver1Comments', appData.approver1Comments || 'No comments');

  // Textareas for editing
  safeSetValue('view-details-creditOfficerComment-textarea', appData.creditOfficerComment || '');
  safeSetValue('view-details-amlroComments-textarea', appData.amlroComments || '');
  safeSetValue('view-details-headOfCredit-textarea', appData.headOfCredit || '');
  safeSetValue('view-details-branchManager-textarea', appData.branchManager || '');
  safeSetValue('view-details-approver1Comments-textarea', appData.approver1Comments || '');

  // Signature names
  safeSetText('signature-creditOfficer-name', appData.creditOfficerName || appData.creditOfficer || '');
  safeSetText('signature-headOfCredit-name', appData.headOfCreditName || appData.headOfCredit || '');
  safeSetText('signature-branchManager-name', appData.branchManagerName || appData.branchManager || '');

  // Documents
  currentAppData.documents = appData.documents || {};
  updateDocumentButtonsForReview(currentAppData.documents);

  // Fetch server-side permissions; prefer server role when showing editors
  const userName = localStorage.getItem('loggedInName') || '';
  const localRole = localStorage.getItem('userRole') || '';

  fetchUserPermissions(userName).then(perms => {
    currentUserPermissions = perms || null;
    const effective = (currentUserPermissions && currentUserPermissions.role) ? currentUserPermissions : localRole;
    showRelevantCommentEditors(effective, appData.stage || 'New');
    updateModalUIForStage(appData, currentUserPermissions);
  }).catch(err => {
    console.warn('fetchUserPermissions failed, falling back to local role', err);
    currentUserPermissions = null;
    showRelevantCommentEditors(localRole, appData.stage || 'New');
    updateModalUIForStage(appData, null);
  });

  // Show modal
  const modal = document.getElementById('viewApplicationModal');
  if (modal) {
    modal.style.display = 'block';
    modal.classList.add('active');
    const container = modal.querySelector('.modal-content') || modal;
    const computedPosition = window.getComputedStyle(container).position;
    if (!computedPosition || computedPosition === 'static') container.style.position = 'relative';
  }
}

function closeViewApplicationModal() {
  const modal = document.getElementById('viewApplicationModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
    hideViewModalLoading(); // Clean up any loader
  }
  try { document.body.style.overflow = ''; } catch (e) {}
  currentAppData = null;
  sessionStorage.removeItem('currentViewingApp');
}

// ========== EDIT SECTION ==========
function openEditSection(tabName) {
  try {
    if (!currentAppData || !currentAppData.appNumber) {
      if (typeof window.showToast === 'function') window.showToast('Application not loaded.', 'error');
      else alert('Application not loaded.');
      return;
    }
    closeViewApplicationModal();
    sessionStorage.setItem('editTab', tabName || 'tab1');
    if (typeof showNewApplicationModal === 'function') {
      showNewApplicationModal(currentAppData.appNumber);
    }
  } catch (e) {
    console.error('Error opening edit section:', e);
  }
}

// ========== ROLE-BASED COMMENT EDITORS ==========
function hideAllRoleEditors() {
  document.querySelectorAll('.comment-editor').forEach(el => {
    el.style.display = 'none';
  });
}

function showRelevantCommentEditors(roleOrPerms, stage) {
  let role = '';
  if (!roleOrPerms) {
    role = (localStorage.getItem('userRole') || '').toString().trim();
  } else if (typeof roleOrPerms === 'string') {
    role = roleOrPerms.trim();
  } else if (typeof roleOrPerms === 'object' && roleOrPerms.role) {
    role = roleOrPerms.role.toString().trim();
  } else {
    role = (localStorage.getItem('userRole') || '').toString().trim();
  }

  hideAllRoleEditors();

  if (!role) {
    console.warn('showRelevantCommentEditors: no role available');
    return;
  }

  const roleLower = role.toLowerCase();
  const stageLower = (stage || '').toString().trim().toLowerCase();

  const editors = Array.from(document.querySelectorAll('.comment-editor'));
  if (!editors.length) {
    console.warn('showRelevantCommentEditors: no .comment-editor elements in DOM');
    return;
  }

  let shown = 0;
  editors.forEach(el => {
    try {
      const rolesAttr = (el.dataset.role || '').toString();
      const stagesAttr = (el.dataset.stages || '').toString();

      const roles = rolesAttr.split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
      const stages = stagesAttr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

      const roleMatch = roles.length === 0 || roles.includes(roleLower) || roles.includes('all') || roles.includes('*');
      const stageMatch = stages.length === 0 || stages.includes(stageLower) || stages.includes('all') || stages.includes('*');

      if (roleMatch && stageMatch) {
        el.style.display = 'block';
        shown++;
      } else {
        el.style.display = 'none';
      }
    } catch (e) {
      console.warn('showRelevantCommentEditors: error evaluating element', el, e);
      el.style.display = 'none';
    }
  });

  if (shown === 0) {
    console.info(`No comment editors shown for role="${role}" stage="${stage}".`);
  }
}

// ========== SAVE & SUBMIT STAGE COMMENT (WITH MODAL-LOCAL LOADING) ==========
async function saveStageComment(isRevert, explicitAction) {
  if (!currentAppData || !currentAppData.appNumber) {
    if (typeof window.showToast === 'function') window.showToast('Application data not available.', 'error');
    else alert('Application data not available.');
    return;
  }

  const appNumber = currentAppData.appNumber;
  const userName = localStorage.getItem('loggedInName') || '';

  // Show modal-local loading
  showViewModalLoading('Processing...');

  try {
    if (isRevert || explicitAction === 'REVERT') {
      const targetStage = prompt('Enter stage to revert to (New, Assessment, Compliance, Ist Review, 2nd Review):');
      if (!targetStage) {
        hideViewModalLoading();
        return;
      }

      const payload = { appNumber, targetStage, userName };
      const resp = await window.apiService.request('revert_application_stage', payload, { showLoading: false });
      
      hideViewModalLoading();

      if (resp && resp.success) {
        if (typeof window.showSuccessModal === 'function') {
          await window.showSuccessModal(resp.message || 'Application reverted successfully');
        } else {
          alert(resp.message || 'Application reverted successfully');
        }
        closeViewApplicationModal();
        if (typeof refreshApplications === 'function') refreshApplications();
      } else {
        if (typeof window.showToast === 'function') window.showToast('Error: ' + (resp?.message || 'Unknown error'), 'error');
        else alert('Error: ' + (resp?.message || 'Unknown error'));
      }
      return;
    }

    const action = explicitAction === 'APPROVE' ? 'APPROVE' : 'SUBMIT';

    const commentsData = {
      creditOfficerComment: document.getElementById('view-details-creditOfficerComment-textarea')?.value || '',
      amlroComments: document.getElementById('view-details-amlroComments-textarea')?.value || '',
      headOfCredit: document.getElementById('view-details-headOfCredit-textarea')?.value || '',
      branchManager: document.getElementById('view-details-branchManager-textarea')?.value || '',
      approver1Comments: document.getElementById('view-details-approver1Comments-textarea')?.value || '',
      approver2Comments: document.getElementById('view-details-approver2Comments-textarea')?.value || ''
    };

    const payload = {
      appNumber,
      action,
      comments: commentsData,
      currentStage: currentAppData.stage || '',
      userName
    };

    const resp = await window.apiService.request('submit_application_comment', payload, { showLoading: false });

    hideViewModalLoading();

    if (!resp) {
      if (typeof window.showToast === 'function') window.showToast('No response from server', 'error');
      else alert('No response from server');
      return;
    }

    if (!resp.success) {
      if (resp.code === 'CONFLICT') {
        const ok = (typeof window.showConfirmModal === 'function')
          ? await window.showConfirmModal('This application changed since you opened it. Reload details and try again?', { title: 'Conflict', confirmText: 'Reload', cancelText: 'Cancel' })
          : confirm('This application changed since you opened it. Reload details and try again?');

        if (ok) viewApplication(appNumber);
        return;
      }

      if (typeof window.showToast === 'function') window.showToast('Error: ' + (resp?.message || 'Unknown error'), 'error');
      else alert('Error: ' + (resp?.message || 'Unknown error'));
      return;
    }

    // Success: use returned updated app if present
    const updated = resp.data && resp.data.app ? resp.data.app : null;
    if (updated) {
      currentAppData = updated;
      initViewApplicationModal(updated);
      if (typeof window.showSuccessModal === 'function') {
        await window.showSuccessModal(resp.message || 'Action completed successfully');
      } else {
        alert(resp.message || 'Action completed successfully');
      }
      if (typeof refreshApplications === 'function') refreshApplications();
    } else {
      if (typeof window.showSuccessModal === 'function') {
        await window.showSuccessModal(resp.message || 'Action completed successfully');
      } else {
        alert(resp.message || 'Action completed successfully');
      }
      closeViewApplicationModal();
      if (typeof refreshApplications === 'function') refreshApplications();
    }

  } catch (err) {
    hideViewModalLoading();
    console.error('Error saving stage comment:', err);
    if (typeof window.showToast === 'function') window.showToast('Error: ' + (err?.message || err), 'error');
    else alert('Error: ' + (err?.message || err));
  }
}

// ========== POPULATE REVIEW DATA ==========
function populateLoanHistoryReview(loanHistory) {
  const tbody = document.querySelector('#view-loanHistoryTable tbody');
  if (!tbody) return;
  if (!loanHistory.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">No loan history found</td></tr>';
    return;
  }
  const rows = loanHistory.map(loan => `
    <tr>
      <td>${formatDate(loan.disbursementDate)}</td>
      <td>${escapeHtml(loan.tenure || 'N/A')}</td>
      <td>${formatCurrency(loan.amount)}</td>
      <td>${formatDate(loan.endDate)}</td>
      <td>${escapeHtml(loan.comment || 'N/A')}</td>
    </tr>
  `).join('');
  tbody.innerHTML = rows;
}

function populatePersonalBudgetReview(personalBudget) {
  const tbody = document.querySelector('#view-personalBudgetTable tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  // group rows
  const groups = { Income: [], Expense: [], Repayment: [] };

  (personalBudget || []).forEach(item => {
    const type = (item.type || '').toString().trim();
    const desc = item.description || item.description === '' ? (item.description || '') : (item.desc || '');
    const amount = parseFloat(item.amount) || 0;
    if (type.toLowerCase() === 'income') groups.Income.push({ desc, amount });
    else if (type.toLowerCase() === 'repayment') groups.Repayment.push({ desc, amount });
    else groups.Expense.push({ desc, amount });
  });

  function appendGroup(title, items) {
    const header = document.createElement('tr');
    header.innerHTML = `<td colspan="2" style="font-weight:bold; padding-top:8px;">${escapeHtml(title)}</td>`;
    tbody.appendChild(header);

    if (!items.length) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `<td colspan="2" class="no-data">No ${escapeHtml(title.toLowerCase())} items</td>`;
      tbody.appendChild(emptyRow);
      return;
    }

    items.forEach(it => {
      const r = document.createElement('tr');
      r.innerHTML = `<td>${escapeHtml(it.desc)}</td><td>${formatCurrency(it.amount)}</td>`;
      tbody.appendChild(r);
    });
  }

  appendGroup('INCOME', groups.Income);
  appendGroup('EXPENDITURE', groups.Expense);
  appendGroup('REPAYMENT', groups.Repayment);

  // NET INCOME and DSR rows
  let netIncomeVal = null;
  if (currentAppData && currentAppData.netIncome !== undefined && currentAppData.netIncome !== null) {
    netIncomeVal = currentAppData.netIncome;
  } else {
    const totalIncome = groups.Income.reduce((s, i) => s + (i.amount || 0), 0);
    const totalExpense = groups.Expense.reduce((s, i) => s + (i.amount || 0), 0);
    netIncomeVal = totalIncome - totalExpense;
  }

  const totalRepayments = groups.Repayment.reduce((s, i) => s + (i.amount || 0), 0);
  let dsrVal = null;
  if (currentAppData && currentAppData.debtServiceRatio !== undefined && currentAppData.debtServiceRatio !== null) {
    dsrVal = currentAppData.debtServiceRatio;
  } else {
    if (netIncomeVal > 0) dsrVal = ((totalRepayments / netIncomeVal) * 100).toFixed(2) + '%';
    else if (totalRepayments > 0) dsrVal = 'N/A';
    else dsrVal = '0.00%';
  }

  const netRow = document.createElement('tr');
  netRow.innerHTML = `<td style="text-align:right; font-weight:bold;">NET INCOME</td><td style="font-weight:bold;">${formatCurrency(netIncomeVal)}</td>`;
  tbody.appendChild(netRow);

  const dsrRow = document.createElement('tr');
  dsrRow.innerHTML = `<td style="text-align:right; font-weight:bold;">Debt Service Ratio:</td><td style="font-weight:bold;">${escapeHtml(dsrVal.toString())}</td>`;
  tbody.appendChild(dsrRow);
}

function populateMonthlyTurnoverReview(turnover) {
  const tbody = document.querySelector('#view-monthlyTurnoverTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const months = ['month1','month2','month3'];
  let hasData = false;

  let totalCr = 0, totalDr = 0, totalMax = 0, totalMin = 0;
  let countedMonths = 0;

  months.forEach((m, i) => {
    const n = i + 1;
    const monthVal = turnover[m] || '';
    const cr = parseFloat(turnover[`crTO${n}`]) || 0;
    const dr = parseFloat(turnover[`drTO${n}`]) || 0;
    const maxB = parseFloat(turnover[`maxBal${n}`]) || 0;
    const minB = parseFloat(turnover[`minBal${n}`]) || 0;

    if (monthVal || cr || dr || maxB || minB) hasData = true;

    const row = document.createElement('tr');
    row.innerHTML = `<td>${escapeHtml(monthVal || ('Month ' + n))}</td>
                     <td>${formatCurrency(cr)}</td>
                     <td>${formatCurrency(dr)}</td>
                     <td>${formatCurrency(maxB)}</td>
                     <td>${formatCurrency(minB)}</td>`;
    tbody.appendChild(row);

    totalCr += cr;
    totalDr += dr;
    totalMax += maxB;
    totalMin += minB;
    countedMonths++;
  });

  if (!hasData) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">No turnover data found</td></tr>';
    return;
  }

  function appendCalcRow(label, crVal, drVal, maxVal, minVal) {
    const r = document.createElement('tr');
    r.className = 'calculation-row';
    r.innerHTML = `<td>${label}</td>
                   <td>${formatCurrency(crVal)}</td>
                   <td>${formatCurrency(drVal)}</td>
                   <td>${formatCurrency(maxVal)}</td>
                   <td>${formatCurrency(minVal)}</td>`;
    tbody.appendChild(r);
  }

  appendCalcRow('<strong>Total</strong>', totalCr, totalDr, totalMax, totalMin);

  const monthsForAvg = countedMonths > 0 ? countedMonths : 3;
  appendCalcRow('<strong>Monthly Average</strong>', totalCr / monthsForAvg, totalDr / monthsForAvg, totalMax / monthsForAvg, totalMin / monthsForAvg);
  appendCalcRow('<strong>Weekly Average</strong>', totalCr / (monthsForAvg * 4), totalDr / (monthsForAvg * 4), totalMax / (monthsForAvg * 4), totalMin / (monthsForAvg * 4));
  appendCalcRow('<strong>Daily Average</strong>', totalCr / (monthsForAvg * 30), totalDr / (monthsForAvg * 30), totalMax / (monthsForAvg * 30), totalMin / (monthsForAvg * 30));
}

function updateDocumentButtonsForReview(documents) {
  const docTypes = ['bankStatement','payslip','letterOfUndertaking','loanStatement'];
  docTypes.forEach(docType => {
    const button = document.getElementById(`view-button-${docType}`);
    const statusEl = document.getElementById(`view-doc-${docType}-status`);
    if (!button) return;
    const docUrl = documents[docType];

    if (docUrl && docUrl.trim() !== '') {
      button.disabled = false;
      button.textContent = 'View';
      button.style.cursor = 'pointer';
      button.style.opacity = '1';
      button.onclick = function() { window.open(docUrl, '_blank'); };
      if (statusEl) statusEl.textContent = 'Uploaded';
    } else {
      button.disabled = true;
      button.textContent = 'Not Uploaded';
      button.style.cursor = 'not-allowed';
      button.style.opacity = '0.6';
      button.onclick = null;
      if (statusEl) statusEl.textContent = 'Not Uploaded';
    }
  });
}

function openDocument(docType) {
  if (!currentAppData || !currentAppData.documents) {
    if (typeof window.showToast === 'function') window.showToast('Document data not available', 'error');
    else alert('Document data not available');
    return;
  }
  const docUrl = currentAppData.documents[docType];
  if (docUrl && docUrl.trim() !== '') {
    window.open(docUrl, '_blank');
  } else {
    if (typeof window.showToast === 'function') window.showToast('Document not found or URL not available', 'error');
    else alert('Document not found or URL not available');
  }
}

// ========== UI STATE FOR STAGE ==========
function updateModalUIForStage(appData) {
  const stage = (appData.stage || 'New').toString().trim();
  const status = (appData.status || '').toString().trim().toUpperCase();
  const userRoleRaw = (localStorage.getItem('userRole') || '').toString().trim();
  const role = userRoleRaw.toLowerCase();

  // Elements
  const signatureSection = document.getElementById('signatures-section');
  const commentSection = document.getElementById('stage-comment-section');
  const commentLabel = document.getElementById('stage-comment-label');
  const approveBtn = document.getElementById('btn-approve');
  const revertBtn = document.getElementById('btn-revert');
  const submitBtn = document.getElementById('btn-submit');

  // Signatures visible only when approved
  if (signatureSection) {
    if (status === 'APPROVED' || stage === 'Approval') {
      signatureSection.style.display = 'block';
    } else {
      signatureSection.style.display = 'none';
    }
  }

  // Hide generic comment area initially
  if (commentSection) commentSection.style.display = 'none';
  if (commentLabel) commentLabel.style.display = 'none';

  // Hide all action buttons by default
  if (approveBtn) approveBtn.style.display = 'none';
  if (revertBtn) revertBtn.style.display = 'none';
  if (submitBtn) submitBtn.style.display = 'none';

  // Hide all role-specific editors initially
  hideAllRoleEditors();

  // Role helpers
  const isAdmin = role === 'admin';
  const isCreditOfficer = role.includes('credit officer') || role.includes('credit sales officer') || role.includes('credit analyst');
  const isAMLRO = role === 'amlro' || role.includes('amlro');
  const isHeadOfCredit = role.includes('head of credit');
  const isBranchManager = role.includes('branch manager') || role.includes('branch manager/approver');
  const isApprover = role === 'approver' || role.includes('approver');

  // Apply tables per status
  switch (status) {
    case 'NEW':
    case '':
      if (isCreditOfficer || isAdmin) {
        showRelevantCommentEditors('Credit Officer', stage);
        if (submitBtn) submitBtn.style.display = 'inline-block';
      }
      break;

    case 'PENDING':
      if (isAMLRO || isAdmin) {
        showRelevantCommentEditors('AMLRO', stage);
        if (submitBtn) submitBtn.style.display = 'inline-block';
      }
      if (isHeadOfCredit || isAdmin) {
        showRelevantCommentEditors('Head of Credit', stage);
        if (submitBtn) submitBtn.style.display = 'inline-block';
      }
      if (isBranchManager || isAdmin) {
        showRelevantCommentEditors('Branch Manager/Approver', stage);
        if (submitBtn) submitBtn.style.display = 'inline-block';
        if (approveBtn) approveBtn.style.display = 'inline-block';
        if (revertBtn) revertBtn.style.display = 'inline-block';
      }
      break;

    case 'PENDING APPROVAL':
      if (isApprover || isAdmin) {
        showRelevantCommentEditors('Approver', stage);
        if (approveBtn) approveBtn.style.display = 'inline-block';
        if (revertBtn) revertBtn.style.display = 'inline-block';
      }
      break;

    case 'APPROVED':
      // no action buttons
      break;

    default:
      break;
  }

  const anyEditorVisible = Array.from(document.querySelectorAll('.comment-editor')).some(el => el.style.display !== 'none');
  if (anyEditorVisible) {
    if (commentSection) commentSection.style.display = 'block';
    if (commentLabel) {
      commentLabel.style.display = 'block';
      commentLabel.textContent = 'Comment';
    }
  }
}

// ========== HELPER UTILITIES ==========
function safeSetText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (value === null || value === undefined) {
    el.textContent = '';
    return;
  }
  const normalized = value.toString().replace(/\r\n/g, '\n');
  el.textContent = normalized;
}

function safeSetValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '0.00';
  const num = parseFloat(value);
  return isNaN(num) ? '0.00' : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  if (isNaN(d)) return dateString;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(s) {
  if (!s) return '';
  return s.toString().replace(/[&<>"']/g, function(m) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
  });
}

// ========== EXPORTS ==========
window.initViewApplicationModal = initViewApplicationModal;
window.closeViewApplicationModal = closeViewApplicationModal;
window.viewApplication = viewApplication;
window.openDocument = openDocument;
window.saveStageComment = saveStageComment;
window.populatePersonalBudgetReview = populatePersonalBudgetReview;
