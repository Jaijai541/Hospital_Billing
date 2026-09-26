/**
 * Hospital Billing & Patient Information System
 * Core Shared Frontend Utilities (js/common.js)
 * 
 * Centralized helpers for:
 * 1. Preload & Sidebar Slide-out Controls
 * 2. User Session Verification & Display
 * 3. Modal Dialog Open/Close/Cancel Helpers
 * 4. Standardized Table Status Badges
 * 5. Compact Action Icon Buttons (Edit ✏️ & Archive/Restore 🗑️/🔄)
 * 6. Generic Record Status Toggle API Handler
 */

const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

// ── 1. Immediate Preload State (Prevents layout shift) ─────────────
(function() {
    try {
        if (localStorage.getItem("hospital_sidebar_collapsed") === "true") {
            document.documentElement.classList.add("sidebar-collapsed-preload");
        }
    } catch (e) {
        console.warn("[Common] LocalStorage unavailable:", e);
    }
})();

// ── 2. Global Initialization on DOM Ready ──────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    if (typeof renderSidebar === "function") {
        renderSidebar();
    }
    initAppSession();
    initSidebarControls();
});

/**
 * Verifies active session from sessionStorage, populates #user-display,
 * and attaches logout listener to #btn-logout.
 */
function initAppSession() {
    const userJson = sessionStorage.getItem("hospital_user");
    if (!userJson) {
        // Only redirect if not already on login page
        if (!window.location.pathname.endsWith("login.html")) {
            window.location.href = "login.html";
        }
        return;
    }

    try {
        const user = JSON.parse(userJson);
        const userDisplay = document.getElementById("user-display");
        if (userDisplay) {
            userDisplay.textContent = `${user.full_name} (${user.role_name})`;
        }
    } catch (e) {
        console.error("[Session] Invalid user data:", e);
    }

    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn && !logoutBtn.dataset.wired) {
        logoutBtn.dataset.wired = "true";
        logoutBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to log out?")) {
                sessionStorage.removeItem("hospital_user");
                window.location.href = "login.html";
            }
        });
    }
}

/**
 * Handles sidebar collapse, reopening, and Alt + S keyboard shortcut.
 */
function initSidebarControls() {
    const appWrapper = document.querySelector(".app-wrapper");
    const btnClose = document.getElementById("btn-sidebar-close");
    const btnOpen = document.getElementById("btn-sidebar-open");

    const isCollapsed = localStorage.getItem("hospital_sidebar_collapsed") === "true";
    if (isCollapsed && appWrapper) {
        appWrapper.classList.add("sidebar-collapsed");
    }

    requestAnimationFrame(() => {
        document.documentElement.classList.remove("sidebar-collapsed-preload");
    });

    if (btnClose && appWrapper && !btnClose.dataset.wired) {
        btnClose.dataset.wired = "true";
        btnClose.addEventListener("click", () => {
            appWrapper.classList.add("sidebar-collapsed");
            try { localStorage.setItem("hospital_sidebar_collapsed", "true"); } catch (e) {}
        });
    }

    if (btnOpen && appWrapper && !btnOpen.dataset.wired) {
        btnOpen.dataset.wired = "true";
        btnOpen.addEventListener("click", () => {
            appWrapper.classList.remove("sidebar-collapsed");
            try { localStorage.setItem("hospital_sidebar_collapsed", "false"); } catch (e) {}
        });
    }

    // Keyboard shortcut: Alt + S
    document.addEventListener("keydown", (e) => {
        if (e.altKey && e.key.toLowerCase() === "s") {
            e.preventDefault();
            if (appWrapper) {
                const nowCollapsed = appWrapper.classList.toggle("sidebar-collapsed");
                try { localStorage.setItem("hospital_sidebar_collapsed", nowCollapsed ? "true" : "false"); } catch (err) {}
            }
        }
    });
}

// ── 3. Modal Dialog Helpers ─────────────────────────────────────────

/**
 * Open a pop-up modal and focus its first input
 */
function openModal(modalId = "formModal") {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add("active");
        modal.style.display = "flex";
        const firstInput = modal.querySelector("input:not([type=hidden]):not([readonly]), select, textarea");
        if (firstInput) firstInput.focus();
    }
}

/**
 * Close a pop-up modal
 */
function closeModal(modalId = "formModal") {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove("active");
        modal.style.display = "none";
    }
}

/**
 * Automatically wires modal open button, close button, cancel button,
 * backdrop click, and Escape key listeners.
 */
function initModalControls(modalId = "formModal", openBtnId = "btnOpenAddModal", closeBtnId = "btnCloseModal", cancelBtnId = "btnCancel", onReset) {
    const btnOpen = document.getElementById(openBtnId);
    if (btnOpen) {
        btnOpen.addEventListener("click", () => {
            if (onReset) onReset();
            openModal(modalId);
        });
    }

    const btnClose = document.getElementById(closeBtnId);
    if (btnClose) {
        btnClose.addEventListener("click", () => closeModal(modalId));
    }

    const btnCancel = document.getElementById(cancelBtnId);
    if (btnCancel) {
        btnCancel.addEventListener("click", () => {
            if (onReset) onReset();
            closeModal(modalId);
        });
    }

    const modal = document.getElementById(modalId);
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                closeModal(modalId);
            }
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeModal(modalId);
        }
    });
}

// ── 4. Standardized Table UI Generators ─────────────────────────────

/**
 * Generates an active or archived status badge HTML
 */
function getStatusBadge(isActive) {
    return (isActive == 1 || isActive === true)
        ? '<span class="badge badge-success">Active</span>'
        : '<span class="badge badge-danger">Archived</span>';
}

/**
 * Generates standardized action icon buttons:
 * - ✏️ Edit (.btn-secondary)
 * - 🗑️ Send to Archive (.btn-warning) or 🔄 Restore (.btn-success)
 */
function getActionButtons(id, isActive, name, editTitle = "Edit Record") {
    const isAct = (isActive == 1 || isActive === true);
    const toggleIcon = isAct ? "🗑️" : "🔄";
    const toggleCls = isAct ? "btn-action-archive" : "btn-action-restore";
    const toggleTitle = isAct ? "Send to Archive (Soft Delete)" : "Restore Record";

    return `
        <div class="table-actions">
            <button type="button" class="btn btn-sm btn-icon btn-action-icon btn-action-edit" data-id="${id}" title="${editTitle}" aria-label="${editTitle}">✏️</button>
            <button type="button" class="btn btn-sm btn-icon btn-action-icon ${toggleCls} btn-action-soft-delete" data-id="${id}" data-status="${isAct ? 1 : 0}" data-name="${name}" title="${toggleTitle}" aria-label="${toggleTitle}">${toggleIcon}</button>
        </div>
    `;
}

// ── 5. Standardized Record Status Toggle (Archive / Restore) ────────

/**
 * Generic API handler for soft-deleting (archiving) or restoring records
 */
async function toggleRecordStatus(apiFile, idKey, idVal, currentStatus, recordName, onDone) {
    const isArchiving = (currentStatus == 1);
    const actionText = isArchiving ? "send to the System Archive" : "restore from the System Archive";
    const note = isArchiving ? "\n\n(Archived records are kept safe so existing clinical logs and invoices remain intact)" : "";

    if (!confirm(`Are you sure you want to ${actionText} "${recordName}"?${note}`)) {
        return;
    }

    const formData = new FormData();
    formData.append("operation", "toggleStatus");
    formData.append("json", JSON.stringify({ [idKey]: idVal }));

    try {
        const response = await axios.post(`${postApiUrl}/${apiFile}`, formData);
        if (response.data == 1) {
            console.log(`[API] Status toggled successfully for ${idKey}: ${idVal}`);
            if (typeof onDone === "function") {
                onDone();
            }
        } else {
            console.warn("[API] Status toggle returned non-success:", response.data);
            alert("Error updating record status.");
        }
    } catch (err) {
        console.error("[API] Status toggle failed:", err);
        alert("Server error during status update.");
    }
}
