(() => {
    try {
        if (localStorage.getItem("hospital_sidebar_collapsed") === "true") {
            document.documentElement.classList.add("sidebar-collapsed-preload");
        }
    } catch (e) {}
})();

const initAppSession = () => {
    const userJson = sessionStorage.getItem("hospital_user");
    if (!userJson) {
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
    } catch (e) {}

    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn && !logoutBtn.dataset.wired) {
        logoutBtn.dataset.wired = "true";
        logoutBtn.addEventListener("click", () => {
            showPopupConfirm("Are you sure you want to log out of your active session?", () => {
                sessionStorage.removeItem("hospital_user");
                window.location.href = "login.html";
            }, null, {
                title: "Confirm Logout",
                confirmText: "Logout",
                type: "warning"
            });
        });
    }
};

const initSidebarControls = () => {
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

    document.addEventListener("keydown", (e) => {
        if (e.altKey && e.key.toLowerCase() === "s") {
            e.preventDefault();
            if (appWrapper) {
                const nowCollapsed = appWrapper.classList.toggle("sidebar-collapsed");
                try { localStorage.setItem("hospital_sidebar_collapsed", nowCollapsed ? "true" : "false"); } catch (err) {}
            }
        }
    });
};

const openModal = (modalId = "formModal") => {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add("active");
        modal.style.display = "flex";
        const firstInput = modal.querySelector("input:not([type=hidden]):not([readonly]), select, textarea");
        if (firstInput) firstInput.focus();
    }
};

const closeModal = (modalId = "formModal") => {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove("active");
        modal.style.display = "none";
    }
};

const showPopupAlert = (message, type = null, title = null, callback = null) => {
    if (callback === null && type instanceof Function) {
        callback = type;
        type = null;
    }

    const strMsg = String(message || "");

    if (!type) {
        if (/successfully|registered|updated|admitted|discharged|settled|restored|transferred|created|recorded/i.test(strMsg)) {
            type = "success";
        } else if (/error|failed|cannot|could not|permanently|invalid|server error/i.test(strMsg)) {
            type = "danger";
        } else if (/please|required|missing|fill in|specify|select/i.test(strMsg)) {
            type = "warning";
        } else {
            type = "info";
        }
    }

    if (!title) {
        switch (type) {
            case "success": title = "Success"; break;
            case "danger":  title = "System Notice"; break;
            case "warning": title = "Validation Notice"; break;
            default:        title = "Notification"; break;
        }
    }

    let modal = document.getElementById("system-custom-alert-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "system-custom-alert-modal";
        modal.className = "custom-alert-overlay";
        modal.innerHTML = `
            <div class="custom-alert-box">
                <div class="custom-alert-stripe"></div>
                <div class="custom-alert-header">
                    <div class="custom-alert-title-group">
                        <span class="custom-alert-icon"></span>
                        <h3 class="custom-alert-title"></h3>
                    </div>
                    <button type="button" class="custom-alert-close" aria-label="Close dialog">&times;</button>
                </div>
                <div class="custom-alert-body">
                    <p class="custom-alert-message"></p>
                </div>
                <div class="custom-alert-footer">
                    <button type="button" class="btn btn-primary custom-alert-btn">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const box = modal.querySelector(".custom-alert-box");
    const titleEl = modal.querySelector(".custom-alert-title");
    const msgEl = modal.querySelector(".custom-alert-message");
    const iconEl = modal.querySelector(".custom-alert-icon");
    const closeBtn = modal.querySelector(".custom-alert-close");
    const okBtn = modal.querySelector(".custom-alert-btn");

    box.className = `custom-alert-box alert-type-${type}`;
    titleEl.textContent = title;
    msgEl.textContent = strMsg;

    let iconText = "ℹ";
    if (type === "success") iconText = "✓";
    else if (type === "danger") iconText = "✕";
    else if (type === "warning") iconText = "!";
    iconEl.textContent = iconText;

    const closeModalHandler = () => {
        modal.style.display = "none";
        document.removeEventListener("keydown", keyHandler);
        if (callback) {
            callback();
        }
    };

    const keyHandler = (e) => {
        if (e.key === "Escape" || e.key === "Enter") {
            e.preventDefault();
            closeModalHandler();
        }
    };

    closeBtn.onclick = closeModalHandler;
    okBtn.onclick = closeModalHandler;
    modal.onclick = (e) => {
        if (e.target === modal) closeModalHandler();
    };

    document.addEventListener("keydown", keyHandler);

    modal.style.display = "flex";
    okBtn.focus();
};

window.alert = (msg, callback) => {
    showPopupAlert(msg, null, null, callback);
};

const showPopupConfirm = (message, onConfirm = null, onCancel = null, options = {}) => {
    if (typeof onConfirm === "object" && onConfirm !== null) {
        options = onConfirm;
        onConfirm = null;
    }

    return new Promise((resolve) => {
        let type = options.type || "warning";
        let title = options.title || "Confirmation";
        let confirmText = options.confirmText || "Confirm";
        let cancelText = options.cancelText || "Cancel";

        let modal = document.getElementById("system-custom-confirm-modal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "system-custom-confirm-modal";
            modal.className = "custom-alert-overlay";
            modal.innerHTML = `
                <div class="custom-alert-box">
                    <div class="custom-alert-stripe"></div>
                    <div class="custom-alert-header">
                        <div class="custom-alert-title-group">
                            <span class="custom-alert-icon"></span>
                            <h3 class="custom-alert-title"></h3>
                        </div>
                        <button type="button" class="custom-alert-close" aria-label="Close dialog">&times;</button>
                    </div>
                    <div class="custom-alert-body">
                        <p class="custom-alert-message"></p>
                    </div>
                    <div class="custom-alert-footer">
                        <button type="button" class="btn btn-secondary custom-confirm-btn btn-confirm-cancel"></button>
                        <button type="button" class="btn btn-primary custom-confirm-btn btn-confirm-ok"></button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const box = modal.querySelector(".custom-alert-box");
        const titleEl = modal.querySelector(".custom-alert-title");
        const msgEl = modal.querySelector(".custom-alert-message");
        const iconEl = modal.querySelector(".custom-alert-icon");
        const closeBtn = modal.querySelector(".custom-alert-close");
        const okBtn = modal.querySelector(".btn-confirm-ok");
        const cancelBtn = modal.querySelector(".btn-confirm-cancel");

        box.className = `custom-alert-box alert-type-${type}`;
        titleEl.textContent = title;
        msgEl.textContent = String(message || "");
        okBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;

        if (type === "danger") {
            okBtn.className = "btn btn-danger custom-confirm-btn btn-confirm-ok";
        } else if (type === "warning") {
            okBtn.className = "btn btn-warning custom-confirm-btn btn-confirm-ok";
        } else if (type === "success") {
            okBtn.className = "btn btn-success custom-confirm-btn btn-confirm-ok";
        } else {
            okBtn.className = "btn btn-primary custom-confirm-btn btn-confirm-ok";
        }

        let iconText = "?";
        if (type === "danger") iconText = "✕";
        else if (type === "warning") iconText = "!";
        else if (type === "success") iconText = "✓";
        else if (type === "info") iconText = "ℹ";
        iconEl.textContent = iconText;

        const closeConfirmHandler = (confirmed) => {
            modal.style.display = "none";
            document.removeEventListener("keydown", keyHandler);
            if (confirmed) {
                if (onConfirm) onConfirm();
                resolve(true);
            } else {
                if (onCancel) onCancel();
                resolve(false);
            }
        };

        const keyHandler = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                closeConfirmHandler(false);
            }
        };

        closeBtn.onclick = () => closeConfirmHandler(false);
        cancelBtn.onclick = () => closeConfirmHandler(false);
        okBtn.onclick = () => closeConfirmHandler(true);
        modal.onclick = (e) => {
            if (e.target === modal) closeConfirmHandler(false);
        };

        document.addEventListener("keydown", keyHandler);
        modal.style.display = "flex";
        okBtn.focus();
    });
};

window.showPopupConfirm = showPopupConfirm;

const initModalControls = (modalId = "formModal", openBtnId = "btnOpenAddModal", closeBtnId = "btnCloseModal", cancelBtnId = "btnCancel", onReset = null) => {
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
};

const getStatusBadge = (isActive) => {
    return (isActive == 1 || isActive === true)
        ? '<span class="badge badge-success">Active</span>'
        : '<span class="badge badge-danger">Archived</span>';
};

const getActionButtons = (id, isActive, name, editTitle = "Edit Record") => {
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
};

const toggleRecordStatus = (apiFile, idKey, idVal, currentStatus, recordName, onDone) => {
    const isArchiving = (currentStatus == 1);
    const actionText = isArchiving ? "send to the System Archive" : "restore from the System Archive";
    const note = isArchiving ? "\n\n(Archived records are kept safe so existing clinical logs and invoices remain intact)" : "";

    showPopupConfirm(`Are you sure you want to ${actionText} "${recordName}"?${note}`, async () => {
        const formData = new FormData();
        formData.append("operation", "toggleStatus");
        formData.append("json", JSON.stringify({ [idKey]: idVal }));

        try {
            const postUrl = (typeof postApiUrl !== "undefined") ? postApiUrl : "../api/POST";
            const response = await axios.post(`${postUrl}/${apiFile}`, formData);
            if (response.data == 1) {
                const pastAction = isArchiving ? "sent to the System Archive" : "restored from the System Archive";
                alert(`"${recordName}" was successfully ${pastAction}.`, () => {
                    if (onDone) {
                        onDone();
                    }
                });
            } else {
                alert("Error updating record status.");
            }
        } catch (err) {
            alert("Server error during status update.");
        }
    }, null, {
        title: isArchiving ? "Archive Record" : "Restore Record",
        type: isArchiving ? "warning" : "info",
        confirmText: isArchiving ? "Send to Archive" : "Restore"
    });
};

document.addEventListener("DOMContentLoaded", () => {
    if (typeof renderSidebar !== "undefined") {
        renderSidebar();
    }
    initAppSession();
    initSidebarControls();
});
