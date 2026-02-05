console.log('viewApplicationJS loaded (net income moved into table)');

let currentAppData = null;
let currentUserPermissions = null;

// Fetch user permissions from server (via new API)
async function fetchUserPermissions(userName) {
  try {
    if (!userName) return null;
    // Use generic apiService.request action - ensure server has case 'get_user_permissions'
    const resp = await window.apiService.request('get_user_permissions', { userName: userName }, { showLoading: false });
    if (resp && resp.success) {
      return resp.data || null;
    } else {
      console.warn('get_user_permissions returned:', resp);
      return null;
    }
  } catch (err) {
    console.error('fetchUserPermissions error', err);
    return null;
  }
}

// Map status display -> style
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

// small helper to darken/lighten a hex color
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

// Main function to fetch and show application details using ApiService
async function viewApplication(appNumber) {
  if (!appNumber) {
    console.error('No application number provided');
    return;
  }

  if (typeof showLoading === 'function') showLoading('Loading application details...');

  try {
    const userName = localStorage.getItem('loggedInName') || '';
    const response = await window.apiService.getApplicationDetails(appNumber, userName, { showLoading: false });

    if (typeof hideLoading === 'function') hideLoading();

    if (response && response.success && response.data) {
      // store and initialize UI
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
  if (!appData) {
    if (!currentAppData) return;
    appData = currentAppData;
  }
  currentAppData = appData || {};

  const appNumber = appData.appNumber || 'N/A';
  const applicantName = appData.applicantName || appData.name || 'N/A';

  safeSetText('applicationNumber', appNumber);
  safeSetText('applicationApplicantName', applicantName);

  setStatusBadge(appData.status, appData.stage);

  safeSetText('view-name', applicantName);
  safeSetText('view-amount', formatCurrency(appData.amount));
  safeSetText('view-purpose', appData.purpose || 'N/A');
  safeSetText('view-duration', appData.duration ? `${appData.duration} months` : 'N/A');
  safeSetText('view-interestRate', appData.interestRate ? `${appData.interestRate}%` : 'N/A');

  safeSetText('view-characterComment', appData.characterComment || 'No character assessment provided.');

  populateLoanHistoryReview(appData.loanHistory || []);
  populatePersonalBudgetReview(appData.personalBudget || []);
  populateMonthlyTurnoverReview(appData.monthlyTurnover || {});
  safeSetText('view-netIncome', formatCurrency(appData.netIncome));
  safeSetText('view-repaymentAmount', formatCurrency(appData.repaymentAmount));
  safeSetText('view-debtServiceRatio', appData.debtServiceRatio || 'N/A');

  safeSetText('view-marginComment', appData.marginComment || 'No comment');
  safeSetText('view-repaymentComment', appData.repaymentComment || 'No comment');
  safeSetText('view-securityComment', appData.securityComment || 'No comment');
  safeSetText('view-financialsComment', appData.financialsComment || 'No comment');
  safeSetText('view-risksComment', appData.risksComment || 'No comment');
  safeSetText('view-riskMitigationComment', appData.riskMitigationComment || 'No comment');
  safeSetText('view-creditOfficerComment', appData.creditOfficerComment || 'No recommendation');

  safeSetText('view-details-creditOfficerComment', appData.creditOfficerComment || 'No recommendation');
  safeSetText('view-details-amlroComments', appData.amlroComments || 'No comments');
  safeSetText('view-details-headOfCredit', appData.headOfCredit || 'No recommendation');
  safeSetText('view-details-branchManager', appData.branchManager || 'No recommendation');
  safeSetText('view-details-approver1Comments', appData.approver1Comments || 'No comments');

  safeSetValue('view-details-creditOfficerComment-textarea', appData.creditOfficerComment || '');
  safeSetValue('view-details-amlroComments-textarea', appData.amlroComments || '');
  safeSetValue('view-details-headOfCredit-textarea', appData.headOfCredit || '');
  safeSetValue('view-details-branchManager-textarea', appData.branchManager || '');
  safeSetValue('view-details-approver1Comments-textarea', appData.approver1Comments || '');

  safeSetText('signature-creditOfficer-name', appData.creditOfficerName || appData.creditOfficer || '');
  safeSetText('signature-headOfCredit-name', appData.headOfCreditName || appData.headOfCredit || '');
  safeSetText('signature-branchManager-name', appData.branchManagerName || appData.branchManager || '');

  currentAppData.documents = appData.documents || {};
  updateDocumentButtonsForReview(currentAppData.documents);

  // Fetch current user's permissions and then update UI
  const userName = localStorage.getItem('loggedInName') || '';
  fetchUserPermissions(userName).then(perms => {
    currentUserPermissions = perms || null;
    showRelevantCommentEditors(perms ? perms.role : localStorage.getItem('userRole'), appData.stage);
    updateModalUIForStage(appData, perms);
  }).catch(err => {
    console.warn('Could not fetch user permissions', err);
    // fallback to previous role-based behavior
    updateModalUIForStage(appData, { role: localStorage.getItem('userRole'), level: Number(localStorage.getItem('userLevel') || 0), isAdmin: (localStorage.getItem('userRole')||'').toLowerCase()==='admin' });
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
  }
  try { document.body.style.overflow = ''; } catch (e) {}
}

// When "Edit" is clicked from view modal — close view and open new/edit modal
function openEditSection(tabName) {
  try {
    if (!currentAppData || !currentAppData.appNumber) {
      if (typeof window.showToast === 'function') window.showToast('Application not loaded.', 'error');
      else alert('Application not loaded.');
      return;
    }

    // Close view modal so the edit modal is the active UI
    closeViewApplicationModal();

    // store requested edit tab; newApplicationJS will read this and open the requested tab
    sessionStorage.setItem('editTab', tabName || 'tab1');

    // open the edit modal (load the existing application for edit)
    if (typeof showNewApplicationModal === 'function') {
      showNewApplicationModal(currentAppData.appNumber);
    } else {
      window.showNewApplicationModal && window.showNewApplicationModal(currentAppData.appNumber);
    }
  } catch (e) {
    console.error('Error opening edit section:', e);
  }
}

// Show/hide comment editors based on role/stage
function hideAllRoleEditors() {
  document.querySelectorAll('.comment-editor').forEach(el => {
    el.style.display = 'none';
  });
}

function showEditorForRole(roleName) {
  if (!roleName) return;
  const roleLower = roleName.toString().trim().toLowerCase();
  document.querySelectorAll('.comment-editor').forEach(el => {
    const roles = (el.dataset.role || '').split(',').map(r => r.trim().toLowerCase());
    if (roles.includes(roleLower)) {
      el.style.display = 'block';
    }
  });
}

showRelevantCommentEditors
async function saveStageComment(isRevert, explicitAction) {
  try {
    if (!currentAppData || !currentAppData.appNumber) {
      if (typeof showToast === 'function') showToast('Application data not available.', 'error');
      else alert('Application data not available.');
      return;
    }
    const appNumber = currentAppData.appNumber;
    const actor = localStorage.getItem('loggedInName') || '';
    const perms = currentUserPermissions || getUserPermissionsFallback();

    // Gather role-specific comments from visible textareas
    const commentsData = {
      creditOfficerComment: document.getElementById('view-details-creditOfficerComment-textarea')?.value || '',
      amlroComments: document.getElementById('view-details-amlroComments-textarea')?.value || '',
      headOfCredit: document.getElementById('view-details-headOfCredit-textarea')?.value || '',
      branchManager: document.getElementById('view-details-branchManager-textarea')?.value || '',
      approver1Comments: document.getElementById('view-details-approver1Comments-textarea')?.value || '',
      approver2Comments: document.getElementById('view-details-approver2Comments-textarea')?.value || ''
    };

    // Generic stage comment if present
    const genericComment = (document.getElementById('stageComment') || {}).value || '';

    // Decide action: explicitAction ('APPROVE'/'REVERT' from buttons) takes precedence
    let action = explicitAction ? explicitAction.toString().toUpperCase() : 'SUBMIT';
    if (isRevert) action = 'REVERT';

    // Authorization check client-side (server will enforce as well)
    const allowedStages = perms.allowedStages || [];
    const isAdmin = !!perms.isAdmin;
    if (!isAdmin && action === 'SUBMIT' && !allowedStages.includes(currentAppData.stage) && !allowedStages.includes('ALL')) {
      if (typeof showToast === 'function') showToast('You are not authorized to submit at this stage.', 'error');
      else alert('Not authorized to submit at this stage.');
      return;
    }

    // Build payload; include currentStage so server can detect conflicts
    const payload = {
      appNumber: appNumber,
      action: action,
      currentStage: currentAppData.stage,
      comments: commentsData,
      comment: genericComment,
      // optional: include role & userName (server will independently verify)
      role: perms.role || localStorage.getItem('userRole'),
      userName: actor
    };

    // Show loading and call API
    showLoading && showLoading(action === 'SUBMIT' ? 'Saving...' : (action === 'APPROVE' ? 'Approving...' : 'Processing...'));
    const response = await window.apiService.request('submit_application_comment', payload, { showLoading: false });

    hideLoading && hideLoading();

    if (!response) {
      if (typeof showToast === 'function') showToast('No response from server', 'error');
      else alert('No response from server');
      return;
    }

    if (!response.success) {
      // Handle conflict special case (stage changed)
      if (response.code === 'CONFLICT') {
        const ok = (typeof showConfirmModal === 'function')
          ? await showConfirmModal('This application changed since you opened it. Reload details and try again?', { title: 'Conflict', confirmText: 'Reload', cancelText: 'Cancel' })
          : confirm('This application changed since you opened it. Reload details and try again?');

        if (ok) {
          // reload fresh details
          if (typeof viewApplication === 'function') viewApplication(appNumber);
        }
        return;
      }

      if (typeof showToast === 'function') showToast('Error: ' + (response.message || 'Unknown error'), 'error');
      else alert('Error: ' + (response.message || 'Unknown error'));
      return;
    }

    // Success: server returns normalized updated app under response.data.app
    const updated = (response.data && response.data.app) ? response.data.app : null;
    if (updated) {
      // Refresh currentAppData and update UI
      currentAppData = updated;
      initViewApplicationModal(updated);
      if (typeof showSuccessModal === 'function') await showSuccessModal(response.message || 'Action completed');
      else alert(response.message || 'Action completed');
      // Refresh application lists and badges
      if (typeof refreshApplications === 'function') refreshApplications();
      if (typeof updateBadgeCounts === 'function') updateBadgeCounts();
    } else {
      if (typeof showSuccessModal === 'function') await showSuccessModal(response.message || 'Action completed');
      else alert(response.message || 'Action completed');
      if (typeof refreshApplications === 'function') refreshApplications();
      if (typeof updateBadgeCounts === 'function') updateBadgeCounts();
      // Close modal if needed
      closeViewApplicationModal();
    }

  } catch (err) {
    hideLoading && hideLoading();
    console.error('saveStageComment error', err);
    if (typeof showToast === 'function') showToast('Error: ' + (err.message || err), 'error');
    else alert('Error: ' + (err.message || err));
  }
}

/* -------------------------
   Existing helper functions
   (kept mostly unchanged)
   ------------------------- */

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
    // header row for group
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

  // Restore NET INCOME and DSR rows into the table (single summary rows)
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

  // Append summary rows to the table (single-row summary)
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

  // Accumulators
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

    // Build month row
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

function updateModalUIForStage(appData, userPermissions) {
  const stage = (appData.stage || 'New').toString().trim();
  const status = (appData.status || '').toString().trim().toUpperCase();
  const userName = localStorage.getItem('loggedInName') || '';
  const userRoleLocal = (localStorage.getItem('userRole') || '').toString();
  const perms = userPermissions || { role: userRoleLocal, level: Number(localStorage.getItem('userLevel')||0), isAdmin: (userRoleLocal||'').toLowerCase()==='admin', allowedStages: [], allowedStatuses: [] };

  const allowedStages = perms.allowedStages || [];
  const allowedStatuses = perms.allowedStatuses || [];
  const isAdmin = !!perms.isAdmin;
  const level = perms.level || Number(localStorage.getItem('userLevel') || 0);

  // Buttons
  const approveBtn = document.getElementById('btn-approve');
  const revertBtn = document.getElementById('btn-revert');
  const submitBtn = document.getElementById('btn-submit');

  // Hide all by default
  if (approveBtn) approveBtn.style.display = 'none';
  if (revertBtn) revertBtn.style.display = 'none';
  if (submitBtn) submitBtn.style.display = 'none';

  // Determine if user may submit at this stage
  const maySubmit = isAdmin || allowedStages.includes(stage) || allowedStages.includes('ALL');

  // Determine if user may approve
  const mayApprove = isAdmin || (level === 4 && status === 'PENDING APPROVAL') || (level === 3 && stage === '2nd Review' && status === 'PENDING');

  // Determine if user may revert (branch manager, approver, admin)
  const mayRevert = isAdmin || (level === 3) || (level === 4);

  if (maySubmit && submitBtn) submitBtn.style.display = 'inline-block';
  if (mayApprove && approveBtn) approveBtn.style.display = 'inline-block';
  if (mayRevert && revertBtn) revertBtn.style.display = 'inline-block';

  // Show/hide comment editors depending on permission mapping (existing logic retained)
  hideAllRoleEditors();
  showRelevantCommentEditors(perms.role || userRoleLocal);

  // Show signatures if approved
  const signatureSection = document.getElementById('signatures-section');
  if (signatureSection) signatureSection.style.display = (status === 'APPROVED' || stage === 'Approval') ? 'block' : 'none';

  // Show/hide generic commentSection based on editors visible
  const anyEditorVisible = Array.from(document.querySelectorAll('.comment-editor')).some(el => el.style.display !== 'none');
  const commentSection = document.getElementById('stage-comment-section');
  const commentLabel = document.getElementById('stage-comment-label');
  if (anyEditorVisible) {
    if (commentSection) commentSection.style.display = 'block';
    if (commentLabel) { commentLabel.style.display = 'block'; commentLabel.textContent = 'Comment'; }
  } else {
    if (commentSection) commentSection.style.display = 'none';
    if (commentLabel) commentLabel.style.display = 'none';
  }
}

function getUserPermissionsFallback() {
  const role = localStorage.getItem('userRole') || '';
  const level = Number(localStorage.getItem('userLevel') || 0);
  const isAdmin = (role && role.toLowerCase() === 'admin') || level === 5;
  // Minimal allowedStages inference (best-effort)
  const mapping = {
    'Admin': ['ALL'],
    'Head of Credit': ['Ist Review', 'Compliance', 'Assessment', 'New'],
    'Credit Officer': ['New', 'Assessment'],
    'AMLRO': ['Compliance'],
    'Branch Manager/Approver': ['2nd Review'],
    'Approver': ['Approval']
  };
  return {
    role: role,
    level: level,
    isAdmin: isAdmin,
    allowedStages: mapping[role] || [],
    allowedStatuses: [] // unknown here
  };
}

/* small helper / fallbacks (kept) */
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

// Expose functions
window.initViewApplicationModal = initViewApplicationModal;
window.closeViewApplicationModal = closeViewApplicationModal;
window.viewApplication = viewApplication;
window.openDocument = openDocument;
window.saveStageComment = saveStageComment;
window.populatePersonalBudgetReview = populatePersonalBudgetReview;
