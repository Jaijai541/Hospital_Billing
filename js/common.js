(() => {
    try {
        if (localStorage.getItem("hospital_sidebar_collapsed") === "true") {
            document.documentElement.classList.add("sidebar-collapsed-preload");
        }
    } catch (e) {}
})();

const handleUserLogout = async () => {
    try {
        const u = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
        if (u.user_id) {
            const fd = new FormData();
            fd.append("operation", "logout");
            fd.append("json", JSON.stringify({ user_id: u.user_id, full_name: u.full_name, username: u.username }));
            await axios.post("../api/POST/auth.php", fd);
        }
    } catch (e) {}
    sessionStorage.removeItem("hospital_user");
    window.location.href = "login.html";
};

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
                handleUserLogout();
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

const showToast = (message, type = null, title = null, callback = null, duration = null) => {
    if (callback === null && typeof type === "function") {
        callback = type;
        type = null;
    }

    const strMsg = String(message || "");

    if (!type) {
        if (/successfully|registered|updated|admitted|discharged|settled|restored|transferred|created|recorded|saved|generated/i.test(strMsg)) {
            type = "success";
        } else if (/error|failed|cannot|could not|permanently|invalid|server error/i.test(strMsg)) {
            type = "danger";
        } else if (/please|required|missing|fill in|specify|select|warning/i.test(strMsg)) {
            type = "warning";
        } else {
            type = "info";
        }
    }

    if (!title) {
        switch (type) {
            case "success": title = "Success"; break;
            case "danger":  title = "System Error"; break;
            case "warning": title = "Validation Notice"; break;
            default:        title = "Notification"; break;
        }
    }

    if (!duration) {
        if (type === "danger") duration = 5000;
        else if (type === "warning") duration = 4500;
        else if (callback) duration = 3200;
        else duration = 3800;
    }

    let container = document.getElementById("system-toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "system-toast-container";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    let iconText = "ℹ";
    if (type === "success") iconText = "✓";
    else if (type === "danger") iconText = "✕";
    else if (type === "warning") iconText = "!";

    const toast = document.createElement("div");
    toast.className = `toast-item toast-${type}`;
    toast.setAttribute("role", "alert");
    toast.innerHTML = `
        <div class="toast-stripe"></div>
        <div class="toast-content">
            <div class="toast-icon-wrap">
                <span class="toast-icon">${iconText}</span>
            </div>
            <div class="toast-text-wrap">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${strMsg}</div>
            </div>
            <button type="button" class="toast-close" aria-label="Close notification">&times;</button>
        </div>
        <div class="toast-progress">
            <div class="toast-progress-bar" style="animation-duration: ${duration}ms;"></div>
        </div>
    `;

    container.appendChild(toast);

    let isDismissed = false;
    let timerId = null;
    let remaining = duration;
    let startTime = Date.now();

    const dismissToast = () => {
        if (isDismissed) return;
        isDismissed = true;
        if (timerId) clearTimeout(timerId);

        toast.classList.add("toast-hiding");
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            if (typeof callback === "function") {
                callback();
            }
        }, 280);
    };

    const startTimer = () => {
        startTime = Date.now();
        timerId = setTimeout(dismissToast, remaining);
    };

    startTimer();

    toast.addEventListener("mouseenter", () => {
        if (timerId) {
            clearTimeout(timerId);
            timerId = null;
        }
        remaining -= Date.now() - startTime;
        if (remaining < 1000) remaining = 1000;
        toast.classList.add("toast-paused");
    });

    toast.addEventListener("mouseleave", () => {
        toast.classList.remove("toast-paused");
        startTimer();
    });

    const closeBtn = toast.querySelector(".toast-close");
    if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dismissToast();
        });
    }

    toast.addEventListener("click", (e) => {
        if (e.target !== closeBtn && !closeBtn?.contains(e.target)) {
            dismissToast();
        }
    });

    return toast;
};

const showPopupAlert = (message, type = null, title = null, callback = null) => {
    return showToast(message, type, title, callback);
};

window.alert = (msg, callback) => {
    showToast(msg, null, null, callback);
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
    const toggleIcon = isAct ? "✕" : "↻";
    const toggleCls = isAct ? "btn-action-archive" : "btn-action-restore";
    const toggleTitle = isAct ? "Send to Archive (Soft Delete)" : "Restore Record";

    return `
        <div class="table-actions">
            <button type="button" class="btn btn-sm btn-icon btn-action-icon btn-action-edit" data-id="${id}" title="${editTitle}" aria-label="${editTitle}">✎</button>
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

let genericLookupPickerState = {
    items: [],
    selectedId: null,
    onSelect: null,
    title: "Select Item",
    customSort: null,
    customFilter: null
};

const openGenericLookupPicker = (options) => {
    let modal = document.getElementById("system-generic-lookup-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "system-generic-lookup-modal";
        modal.className = "modal-overlay picker-modal-overlay";
        modal.innerHTML = `
            <div class="modal-container" style="max-width: 580px;">
                <div class="modal-header">
                    <h3 id="generic_lookup_title">Select Item</h3>
                    <button type="button" class="modal-close" id="btnCloseGenericLookup" aria-label="Close modal">&times;</button>
                </div>
                <div class="modal-body" style="padding: 16px 20px;">
                    <div class="lookup-picker-controls" style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <input type="text" id="generic_lookup_search" class="form-control lookup-picker-search-input" placeholder="Search..." autocomplete="off" style="flex: 1 1 180px; padding: 8px 12px; font-size: 0.9rem;">
                        <select id="generic_lookup_filter" class="form-select lookup-picker-select" style="width: auto; min-width: 120px; font-size: 0.85rem; padding: 8px 10px;">
                            <option value="all">All</option>
                            <option value="selected">Selected</option>
                            <option value="unselected">Unselected</option>
                        </select>
                        <select id="generic_lookup_sort" class="form-select lookup-picker-select" style="width: auto; min-width: 130px; font-size: 0.85rem; padding: 8px 10px;">
                            <option value="name_asc">Name (A-Z)</option>
                            <option value="name_desc">Name (Z-A)</option>
                            <option value="selected_first">Selected First</option>
                        </select>
                    </div>
                    <div id="generic_lookup_list" style="max-height: 340px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 4px;"></div>
                </div>
                <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px;">
                    <span id="generic_lookup_status" style="font-size: 0.85rem; color: var(--text-muted);">Click an item to select</span>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" class="btn btn-secondary" id="btnCancelGenericLookup">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const closePicker = () => {
            modal.style.display = "none";
            modal.classList.remove("active");
        };

        document.getElementById("btnCloseGenericLookup").addEventListener("click", closePicker);
        document.getElementById("btnCancelGenericLookup").addEventListener("click", closePicker);

        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                closePicker();
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && (modal.classList.contains("active") || modal.style.display === "flex")) {
                e.stopImmediatePropagation();
                closePicker();
            }
        });

        document.getElementById("generic_lookup_search").addEventListener("input", renderGenericLookupList);
        document.getElementById("generic_lookup_filter").addEventListener("change", renderGenericLookupList);
        document.getElementById("generic_lookup_sort").addEventListener("change", renderGenericLookupList);
    }

    genericLookupPickerState.title = options.title || "Select Item";
    genericLookupPickerState.items = options.items || [];
    genericLookupPickerState.selectedId = (options.selectedId !== undefined && options.selectedId !== null) ? String(options.selectedId) : "";
    genericLookupPickerState.onSelect = options.onSelect;
    genericLookupPickerState.customFilter = options.customFilter || null;
    genericLookupPickerState.customSort = options.customSort || null;

    document.getElementById("generic_lookup_title").textContent = genericLookupPickerState.title;
    document.getElementById("generic_lookup_search").value = "";

    const filterSelect = document.getElementById("generic_lookup_filter");
    if (filterSelect) {
        if (options.filterOptions && Array.isArray(options.filterOptions)) {
            filterSelect.innerHTML = options.filterOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join("");
        } else {
            filterSelect.innerHTML = `
                <option value="all">All</option>
                <option value="selected">Selected</option>
                <option value="unselected">Unselected</option>
            `;
        }
        filterSelect.value = options.defaultFilter || (options.filterOptions && options.filterOptions.length > 0 ? options.filterOptions[0].value : "all");
    }

    const sortSelect = document.getElementById("generic_lookup_sort");
    if (sortSelect) {
        if (options.sortOptions && Array.isArray(options.sortOptions)) {
            sortSelect.innerHTML = options.sortOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join("");
        } else {
            sortSelect.innerHTML = `
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="selected_first">Selected First</option>
            `;
        }
        sortSelect.value = options.defaultSort || (options.sortOptions && options.sortOptions.length > 0 ? options.sortOptions[0].value : "name_asc");
    }

    const selectedItem = genericLookupPickerState.items.find(item => String(item.id) === genericLookupPickerState.selectedId);
    const statusEl = document.getElementById("generic_lookup_status");
    if (statusEl) {
        statusEl.textContent = selectedItem ? `Selected: ${selectedItem.text}` : "Click an item to select";
    }

    renderGenericLookupList();

    modal.classList.add("active");
    modal.style.display = "flex";
    modal.style.zIndex = "1300";
    setTimeout(() => {
        const searchInput = document.getElementById("generic_lookup_search");
        if (searchInput) searchInput.focus();
    }, 50);
};

window.openGenericLookupPicker = openGenericLookupPicker;

const renderGenericLookupList = () => {
    const listContainer = document.getElementById("generic_lookup_list");
    const searchStr = (document.getElementById("generic_lookup_search").value || "").toLowerCase().trim();
    const filterVal = document.getElementById("generic_lookup_filter").value;
    const sortVal = document.getElementById("generic_lookup_sort").value;

    let filtered = genericLookupPickerState.items.filter(item => {
        const matchesSearch = !searchStr || 
            (item.text && item.text.toLowerCase().includes(searchStr)) || 
            (item.subtext && item.subtext.toLowerCase().includes(searchStr)) ||
            (item.classification && item.classification.toLowerCase().includes(searchStr));

        if (!matchesSearch) return false;

        if (genericLookupPickerState.customFilter) {
            return genericLookupPickerState.customFilter(item, filterVal, genericLookupPickerState.selectedId);
        }

        const isSelected = String(item.id) === String(genericLookupPickerState.selectedId);
        if (filterVal === "selected") return isSelected;
        if (filterVal === "unselected") return !isSelected;
        return true;
    });

    if (genericLookupPickerState.customSort) {
        const sorted = genericLookupPickerState.customSort(filtered, sortVal, genericLookupPickerState.selectedId);
        if (Array.isArray(sorted)) {
            filtered = sorted;
        }
    } else {
        if (sortVal === "name_asc") {
            filtered.sort((a, b) => (a.text || "").localeCompare(b.text || ""));
        } else if (sortVal === "name_desc") {
            filtered.sort((a, b) => (b.text || "").localeCompare(a.text || ""));
        } else if (sortVal === "selected_first") {
            filtered.sort((a, b) => {
                const aSel = String(a.id) === String(genericLookupPickerState.selectedId) ? 1 : 0;
                const bSel = String(b.id) === String(genericLookupPickerState.selectedId) ? 1 : 0;
                if (aSel !== bSel) return bSel - aSel;
                return (a.text || "").localeCompare(b.text || "");
            });
        }
    }

    listContainer.innerHTML = "";
    if (filtered.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.9rem;">No matching records found.</div>`;
        return;
    }

    filtered.forEach(item => {
        const isSelected = String(item.id) === String(genericLookupPickerState.selectedId);
        const isDisabled = !!item.disabled;

        const el = document.createElement("div");
        el.className = `picker-item-row${isSelected ? ' selected' : ''}${isDisabled ? ' disabled' : ''}`;

        const subtextHtml = item.subtext ? `<div class="picker-item-sub">${item.subtext}</div>` : "";
        let badgeHtml = "";
        if (isSelected) {
            badgeHtml = `<span class="badge badge-primary" style="font-size: 0.75rem;">Selected</span>`;
        } else if (item.badge) {
            badgeHtml = `<span class="badge ${item.badgeClass || 'badge-info'}" style="font-size: 0.75rem;">${item.badge}</span>`;
        }

        el.innerHTML = `
            <div style="flex: 1; min-width: 0; padding-right: 10px;">
                <div class="picker-item-title">${item.text}</div>
                ${subtextHtml}
            </div>
            <div style="flex-shrink: 0;">
                ${badgeHtml}
            </div>
        `;

        if (!isDisabled) {
            el.addEventListener("click", () => {
                if (genericLookupPickerState.onSelect) {
                    genericLookupPickerState.onSelect(item);
                }
                const modal = document.getElementById("system-generic-lookup-modal");
                if (modal) {
                    modal.style.display = "none";
                    modal.classList.remove("active");
                }
            });
        }

        listContainer.appendChild(el);
    });
};

document.addEventListener("DOMContentLoaded", () => {
    if (typeof renderSidebar !== "undefined") {
        renderSidebar();
    }
    initAppSession();
    initSidebarControls();
    initSearchClearButtons();
});

const getEmptyStateHtml = (icon = "🔍", title = "No matching records found", subtitle = "Try adjusting your search keywords or filter criteria.") => {
    return `
        <div class="empty-state-card">
            <div class="empty-state-icon">${icon}</div>
            <div class="empty-state-title">${title}</div>
            <div class="empty-state-subtitle">${subtitle}</div>
        </div>
    `;
};

const updateFilterCount = (currentCount, totalCount, label = "records") => {
    let countEl = document.getElementById("filter_results_count");
    if (!countEl) {
        const filterBar = document.querySelector(".filter-bar, .filter-toolbar");
        if (filterBar) {
            countEl = document.createElement("div");
            countEl.id = "filter_results_count";
            countEl.className = "filter-results-count";
            filterBar.appendChild(countEl);
        }
    }
    if (countEl) {
        if (totalCount !== undefined && totalCount !== null && totalCount !== currentCount) {
            countEl.innerHTML = `<span class="badge badge-info">Showing ${currentCount} of ${totalCount} ${label}</span>`;
        } else {
            countEl.innerHTML = `<span class="badge badge-info">${currentCount} ${label}</span>`;
        }
    }
};

const initSearchClearButtons = () => {
    document.querySelectorAll("input[type='text'][id*='search'], input[type='text'][placeholder*='Search'], input[type='search']").forEach(input => {
        if (input.dataset.hasClearBtn) return;
        input.dataset.hasClearBtn = "true";

        const parent = input.parentElement;
        if (!parent) return;

        const wrapper = document.createElement("div");
        wrapper.className = "search-wrapper";
        parent.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.className = "search-clear-btn";
        clearBtn.setAttribute("aria-label", "Clear search input");
        clearBtn.setAttribute("title", "Clear search");
        clearBtn.textContent = "✕";
        wrapper.appendChild(clearBtn);

        const updateVisibility = () => {
            if (input.value && input.value.trim().length > 0) {
                clearBtn.classList.add("active");
            } else {
                clearBtn.classList.remove("active");
            }
        };

        input.addEventListener("input", updateVisibility);
        input.addEventListener("keyup", updateVisibility);
        clearBtn.addEventListener("click", () => {
            input.value = "";
            updateVisibility();
            input.focus();
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("keyup", { bubbles: true }));
        });

        updateVisibility();
    });
};
