(function() {
  const ROLE_LEVEL_MAP = {
    "Admin": 5,
    "Head of Credit": 2,
    "Credit Officer": 1,
    "AMLRO": 2,
    "Branch Manager/Approver": 3,
    "Approver": 4
  };

  function setLevelForRole(role) {
    const levelInput = document.getElementById('new-user-level');
    if (!levelInput) return;
    const lvl = ROLE_LEVEL_MAP[role] || '';
    levelInput.value = lvl;
    if (lvl !== '') {
      levelInput.setAttribute('readonly', 'readonly');
      levelInput.style.background = '#f3f4f6';
      levelInput.style.cursor = 'not-allowed';
    } else {
      levelInput.removeAttribute('readonly');
      levelInput.style.background = '';
      levelInput.style.cursor = '';
    }
  }

  function initUserFormAutoLevel() {
    const roleSelect = document.getElementById('new-user-role');
    const levelInput = document.getElementById('new-user-level');
    const form = document.getElementById('add-user-form');

    if (!roleSelect || !levelInput) return;

    // Update when role changes
    roleSelect.addEventListener('change', (e) => {
      setLevelForRole(e.target.value);
    });

    // Ensure level is correctly set on submit (covers keyboard/JS submissions)
    if (form) {
      form.addEventListener('submit', (ev) => {
        const selectedRole = roleSelect.value;
        const mapped = ROLE_LEVEL_MAP[selectedRole];
        if (mapped) {
          levelInput.value = mapped;
        }
        // If no role mapping, keep whatever the user set in the level field.
        // Allow form to continue submitting; do not prevent default.
      });
    }

    // initialize (in case the role field has a preselected value)
    setLevelForRole(roleSelect.value);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUserFormAutoLevel);
  } else {
    initUserFormAutoLevel();
  }

  // Expose helper for debugging or manual set (optional)
  window.__userClient = window.__userClient || {};
  window.__userClient.setLevelForRole = setLevelForRole;
})();
