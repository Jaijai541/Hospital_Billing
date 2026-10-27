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
    sessionStorage.removeItem("hospital_last_notif_count");
    sessionStorage.removeItem("hospital_shown_toast_ids");
    window.location.href = "login.html";
};

window.getCategoryPill = (catType) => {
    const cat = String(catType || '').trim();
    if (cat === 'Medicine') return `<span class="cat-pill cat-med">${cat}</span>`;
    if (cat === 'Equipment Scan' || cat === 'Scan') return `<span class="cat-pill cat-scan">${cat}</span>`;
    return `<span class="cat-pill cat-srv">${cat || 'Service'}</span>`;
};

const enforcePageRbacGuard = (user) => {
    if (!user) return false;
    const pathParts = window.location.pathname.split("/");
    const currentPage = (pathParts[pathParts.length - 1] || "").toLowerCase();
    if (!currentPage || currentPage === "login.html" || currentPage === "index.html") {
        return true;
    }

    const domain = (user.access_domain || "").toLowerCase();
    const roleId = parseInt(user.role_id, 10) || 0;
    const roleName = (user.role_name || "").toLowerCase();

    const isAdmin = domain === "admin" || roleId === 1 || roleName === "admin";
    const isFinance = domain === "finance" || roleId === 2 || roleId === 5 || roleName === "finance staff" || roleName === "head finance";
    const isNurse = domain === "clinical" || roleId === 3 || roleId === 4 || roleName === "nurse" || roleName === "head nurse";
    const isHybrid = domain === "hybrid" || roleId === 6 || roleId === 7 || roleName === "hybrid" || roleName === "head hybrid" || roleName === "ward clerk" || roleName === "head ward clerk";

    const hasClinicalAccess = isAdmin || isNurse || isHybrid;
    const hasFinanceAccess = isAdmin || isFinance || isHybrid;
    const hasAdminAccess = isAdmin;

    let perms = user.permissions;
    if (typeof perms === "string") {
        try {
            perms = JSON.parse(perms);
        } catch (e) {
            perms = null;
        }
    }

    if (isAdmin) {
        if (Array.isArray(perms) && !perms.includes(currentPage)) {
            perms.push(currentPage);
            user.permissions = perms;
            try {
                sessionStorage.setItem("hospital_user", JSON.stringify(user));
            } catch (e) {}
        }
        return true;
    }

    let mappedPage = currentPage;
    if (currentPage === "admission_details.html") {
        mappedPage = "admissions.html";
    } else if (["partial_bill.html", "payment_receipt.html", "invoice_print.html"].includes(currentPage)) {
        mappedPage = "invoices.html";
    }

    if (mappedPage === "department_orders.html") {
        const hasStation = Boolean(user.station_id) || (Array.isArray(user.assigned_stations) && user.assigned_stations.length > 0);
        if (hasStation || hasClinicalAccess || (Array.isArray(perms) && perms.includes("department_orders.html"))) {
            if (Array.isArray(perms) && !perms.includes("department_orders.html")) {
                perms.push("department_orders.html");
                user.permissions = perms;
                try {
                    sessionStorage.setItem("hospital_user", JSON.stringify(user));
                } catch (e) {}
            }
            return true;
        }
    }

    if (Array.isArray(perms)) {
        if (perms.includes(mappedPage)) {
            return true;
        }

        sessionStorage.setItem("rbac_denied_msg", "Access Denied: Your assigned role does not have permission to access this module.");
        let fallbackPage = "index.html";
        if (perms.includes("admissions.html")) {
            fallbackPage = "admissions.html";
        } else if (perms.includes("invoices.html")) {
            fallbackPage = "invoices.html";
        } else if (perms.includes("patients.html")) {
            fallbackPage = "patients.html";
        } else if (perms.length > 0) {
            fallbackPage = perms[0];
        }

        window.location.replace(fallbackPage);
        return false;
    }

    const adminOnlyPages = [
        "staff.html",
        "departments.html",
        "audit_log.html",
        "archive.html"
    ];

    const clinicalOnlyPages = [
        "admissions.html",
        "admission_details.html",
        "department_orders.html"
    ];

    const financeOnlyPages = [
        "discounts.html",
        "invoices.html",
        "invoice_print.html",
        "partial_bill.html",
        "payment_receipt.html",
        "promissory_notes.html",
        "reports.html"
    ];

    if (adminOnlyPages.includes(currentPage) && !hasAdminAccess) {
        sessionStorage.setItem("rbac_denied_msg", "Access Denied: System administration is reserved exclusively for the System Administrator.");
        window.location.replace(hasClinicalAccess ? "admissions.html" : "invoices.html");
        return false;
    }

    if (clinicalOnlyPages.includes(currentPage) && !hasClinicalAccess) {
        sessionStorage.setItem("rbac_denied_msg", "Access Denied: Clinical care and patient admissions are restricted to nursing and clinical operations staff.");
        window.location.replace("invoices.html");
        return false;
    }

    if (financeOnlyPages.includes(currentPage) && !hasFinanceAccess) {
        sessionStorage.setItem("rbac_denied_msg", "Access Denied: Invoicing, billing settlements, and financial ledgers are restricted under Separation of Duties.");
        window.location.replace("admissions.html");
        return false;
    }

    return true;
};

const canUserAddModule = (modulePage = null) => {
    const u = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    if (!u || !u.role_id) return false;
    if (parseInt(u.role_id, 10) === 1) return true;
    const perms = Array.isArray(u.permissions) ? u.permissions : [];
    if (perms.includes("can_add")) return true;

    const page = (modulePage || window.location.pathname || "").toLowerCase();
    if (page.includes("patient")) return perms.includes("can_add_patient");
    if (page.includes("doctor")) return perms.includes("can_add_doctor");
    if (page.includes("department")) return perms.includes("can_add_department");
    if (page.includes("room")) return perms.includes("can_add_room");
    if (page.includes("catalog")) return perms.includes("can_add_catalog");
    if (page.includes("discount")) return perms.includes("can_add_discount");
    if (page.includes("admission")) return perms.includes("can_add_admission");
    if (page.includes("invoice")) return perms.includes("can_add_payment");
    if (page.includes("promissory")) return perms.includes("can_add_promissory");
    if (page.includes("staff")) return perms.includes("can_add_staff");

    return false;
};

const canUserAddData = (specificAction = null) => {
    const u = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    if (!u || !u.role_id) return false;
    if (parseInt(u.role_id, 10) === 1) return true;
    const perms = Array.isArray(u.permissions) ? u.permissions : [];
    if (perms.includes("can_add")) return true;
    if (specificAction) {
        return perms.includes(specificAction);
    }
    return perms.some(p => typeof p === "string" && p.startsWith("can_add_"));
};

const canUserDelete = () => {
    const u = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    if (!u || !u.role_id) return false;
    if (parseInt(u.role_id, 10) === 1) return true;
    if (parseInt(u.is_higher_up, 10) === 1) return true;
    const perms = Array.isArray(u.permissions) ? u.permissions : [];
    return perms.includes("can_delete");
};

const canUserPrint = () => {
    const u = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    if (!u || !u.role_id) return false;
    if (parseInt(u.role_id, 10) === 1) return true;
    const perms = Array.isArray(u.permissions) ? u.permissions : [];
    return perms.includes("can_print");
};

const applyGlobalActionPermissions = () => {
    const userJson = sessionStorage.getItem("hospital_user");
    if (!userJson) return;

    const pathParts = window.location.pathname.split("/");
    const currentPage = (pathParts[pathParts.length - 1] || "").toLowerCase();

    const userCanAdd = canUserAddModule(currentPage);
    const userCanDelete = canUserDelete();
    const userCanPrint = canUserPrint();

    const addSelectors = [
        "#btnOpenAddModal",
        "#btnOpenAddPatientModal",
        "#btnOpenAddStaffModal",
        "#btnOpenAddSpecialtyModal",
        "#btnOpenAddRoomTypeModal",
        "#btnAddAdvVoucher",
        "#btnOpenOrderModal",
        "#btnOpenRoundModal",
        "#btnOpenTransferModal",
        "#btnOpenReturnModal",
        "#btnOpenReturnModalPharmacy",
        "#btnOpenAdvancePaymentModal",
        "#btnNewPatient",
        "#btnNewRecord",
        "#btnSubmitSpecialty",
        "#btnSubmitRoomType",
        "#btnOpenEditFromPatientView",
        "#btnOpenEditFromDoctorView",
        "#btnOpenEditFromView",
        "#btnOpenEditFromRoomView",
        "#btnHistPayBalance",
        ".btn-add-action",
        ".btn-register-action",
        ".btn-pay-action"
    ];

    if (!userCanAdd) {
        addSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                el.disabled = true;
                el.setAttribute("title", "Access Restricted: Your assigned user role does not have authorization to add records in this module.");
                el.classList.add("btn-permission-disabled");
                if (el.style.display === "none") {
                    el.style.display = "";
                }
            });
        });

        if (currentPage.includes("staff")) {
            const roleButtons = ["#btnOpenManageRolesModalTopbar", "#btnOpenManageRolesModalInline"];
            roleButtons.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                    el.disabled = true;
                    el.setAttribute("title", "Access Restricted: Role management requires administrator privileges.");
                    el.classList.add("btn-permission-disabled");
                    if (el.style.display === "none") {
                        el.style.display = "";
                    }
                });
            });
        }
    } else {
        addSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                el.disabled = false;
                el.removeAttribute("title");
                el.classList.remove("btn-permission-disabled");
                if (el.style.display === "none") {
                    el.style.display = "";
                }
            });
        });

        if (currentPage.includes("staff")) {
            const roleButtons = ["#btnOpenManageRolesModalTopbar", "#btnOpenManageRolesModalInline"];
            roleButtons.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                    el.disabled = false;
                    el.removeAttribute("title");
                    el.classList.remove("btn-permission-disabled");
                    if (el.style.display === "none") {
                        el.style.display = "";
                    }
                });
            });
        }
    }

    if (!userCanDelete) {
        const deleteSelectors = [
            "#btnArchive",
            "#btnArchiveStaff",
            "#btnBatchDelete",
            ".btn-archive",
            ".btn-delete",
            ".btn-remove-role",
            ".btn-action-hard-delete",
            ".btn-action-archive",
            ".btn-action-soft-delete"
        ];
        deleteSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                if (el.id === "btnArchive" || el.id === "btnArchiveStaff" || el.classList.contains("btn-archive")) {
                    if (el.textContent && el.textContent.toLowerCase().includes("restore")) {
                        return;
                    }
                }
                el.style.display = "none";
            });
        });
    }

    if (!userCanPrint) {
        const printSelectors = [
            "#btnPrintReport",
            "#btnExportExcel",
            "#btnExportPDF",
            "#btnTabLedgerPartialBill",
            "#btnHistViewGatePass",
            "#btnPrintGatePass",
            "#btnGatePass",
            "#btnPrintPdf",
            ".btn-print-action"
        ];
        printSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                el.style.display = "none";
            });
        });

        const printPages = ["invoice_print.html", "partial_bill.html", "payment_receipt.html", "discharge_clearance.html"];
        const pathParts = window.location.pathname.split("/");
        const currentPage = (pathParts[pathParts.length - 1] || "").toLowerCase();
        if (printPages.includes(currentPage)) {
            window.print = () => {
                if (typeof showPopupAlert === "function") {
                    showPopupAlert("Printing Access Restricted: Your assigned user role does not have authorization to print or export hospital billing documents.", "warning");
                } else {
                    alert("Printing Access Restricted: Your assigned user role does not have authorization to print or export hospital billing documents.");
                }
            };
            const toolbars = document.querySelectorAll(".print-toolbar, .clearance-toolbar, .receipt-toolbar");
            toolbars.forEach(tb => {
                tb.querySelectorAll("button").forEach(btn => {
                    if (btn.getAttribute("onclick") && btn.getAttribute("onclick").includes("print")) {
                        btn.disabled = true;
                        btn.style.opacity = "0.5";
                        btn.style.cursor = "not-allowed";
                        btn.title = "Printing access restricted for your role";
                    }
                });
            });
        }
    }
};

let permEnforceTimer = null;
const schedulePermissionsEnforcement = () => {
    if (permEnforceTimer) return;
    permEnforceTimer = setTimeout(() => {
        permEnforceTimer = null;
        applyGlobalActionPermissions();
    }, 60);
};

window.canUserAddData = canUserAddData;
window.canUserAddModule = canUserAddModule;
window.canUserDelete = canUserDelete;
window.canUserPrint = canUserPrint;
window.applyGlobalActionPermissions = applyGlobalActionPermissions;
window.schedulePermissionsEnforcement = schedulePermissionsEnforcement;

const initAppSession = () => {
    const userJson = sessionStorage.getItem("hospital_user");
    if (!userJson) {
        if (!window.location.pathname.endsWith("login.html")) {
            window.location.href = "login.html";
        }
        return;
    }

    let user = null;
    try {
        user = JSON.parse(userJson);
        const userDisplay = document.getElementById("user-display");
        if (userDisplay) {
            userDisplay.textContent = `${user.full_name} (${user.role_name})`;
        }
    } catch (e) {
        sessionStorage.removeItem("hospital_user");
        window.location.href = "login.html";
        return;
    }

    const deniedMsg = sessionStorage.getItem("rbac_denied_msg");
    if (deniedMsg) {
        sessionStorage.removeItem("rbac_denied_msg");
        setTimeout(() => {
            showToast(deniedMsg, "warning", "Access Restricted");
        }, 150);
    }

    if (!enforcePageRbacGuard(user)) {
        return;
    }

    const changePassBtn = document.getElementById("btn-self-change-pass");
    if (changePassBtn && !changePassBtn.dataset.wired) {
        changePassBtn.dataset.wired = "true";
        changePassBtn.addEventListener("click", () => {
            openSelfChangePasswordModal();
        });
    }

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

    schedulePermissionsEnforcement();
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
        schedulePermissionsEnforcement();
    }
};

const closeModal = (modalId = "formModal") => {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove("active");
        modal.style.display = "none";
    }
};

const closeSelfChangePasswordModal = () => {
    const modal = document.getElementById("selfChangePasswordModal");
    if (modal) {
        modal.classList.remove("active");
        modal.style.display = "none";
    }
};

const openSelfChangePasswordModal = () => {
    let modal = document.getElementById("selfChangePasswordModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "selfChangePasswordModal";
        modal.className = "modal-overlay";
        modal.style.display = "none";
        modal.style.zIndex = "1350";
        modal.innerHTML = `
            <div class="modal-container" style="max-width: 440px;">
                <div class="modal-header">
                    <div>
                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 600;">Change Password</h3>
                        <p style="margin: 2px 0 0; font-size: 0.82rem; color: var(--text-muted, #64748b);">Update your active account password</p>
                    </div>
                    <button type="button" class="modal-close" id="btnCloseSelfChangePass" aria-label="Close modal">&times;</button>
                </div>
                <form id="formSelfChangePassword">
                    <div class="modal-body" style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px;">
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" for="self_current_password" style="font-size: 0.85rem; font-weight: 500; margin-bottom: 4px; display: block;">Current Password <span style="color: var(--danger, #ef4444);">*</span></label>
                            <input type="password" id="self_current_password" class="form-control" placeholder="Enter current password" required autocomplete="current-password" style="width: 100%; box-sizing: border-box;">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" for="self_new_password" style="font-size: 0.85rem; font-weight: 500; margin-bottom: 4px; display: block;">New Password <span style="color: var(--danger, #ef4444);">*</span></label>
                            <input type="password" id="self_new_password" class="form-control" placeholder="Minimum 4 characters" minlength="4" required autocomplete="new-password" style="width: 100%; box-sizing: border-box;">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" for="self_confirm_password" style="font-size: 0.85rem; font-weight: 500; margin-bottom: 4px; display: block;">Confirm New Password <span style="color: var(--danger, #ef4444);">*</span></label>
                            <input type="password" id="self_confirm_password" class="form-control" placeholder="Re-enter new password" minlength="4" required autocomplete="new-password" style="width: 100%; box-sizing: border-box;">
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--border, #e2e8f0);">
                        <button type="button" class="btn btn-secondary" id="btnCancelSelfChangePass">Cancel</button>
                        <button type="submit" class="btn btn-primary" id="btnSubmitSelfChangePass">Update Password</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById("btnCloseSelfChangePass").addEventListener("click", closeSelfChangePasswordModal);
        document.getElementById("btnCancelSelfChangePass").addEventListener("click", closeSelfChangePasswordModal);

        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                closeSelfChangePasswordModal();
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && (modal.classList.contains("active") || modal.style.display === "flex")) {
                closeSelfChangePasswordModal();
            }
        });

        const form = document.getElementById("formSelfChangePassword");
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const curr = document.getElementById("self_current_password").value;
            const next = document.getElementById("self_new_password").value.trim();
            const conf = document.getElementById("self_confirm_password").value.trim();

            if (!curr || !next || !conf) {
                showToast("All password fields are required.", "warning");
                return;
            }

            if (next.length < 4) {
                showToast("New password must be at least 4 characters long.", "warning");
                return;
            }

            if (next !== conf) {
                showToast("New password and confirmation do not match.", "warning");
                return;
            }

            if (curr === next) {
                showToast("New password cannot be identical to your current password.", "warning");
                return;
            }

            const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
            if (!user.user_id) {
                showToast("Active user session not found. Please log in again.", "danger");
                return;
            }

            const btnSubmit = document.getElementById("btnSubmitSelfChangePass");
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.textContent = "Updating...";
            }

            try {
                const fd = new FormData();
                fd.append("operation", "changePassword");
                fd.append("json", JSON.stringify({
                    user_id: user.user_id,
                    current_password: curr,
                    new_password: next
                }));

                const res = await axios.post("../api/POST/users.php", fd);
                if (res.data && res.data.status === 1) {
                    showToast(res.data.message || "Your password has been changed successfully.", "success");
                    form.reset();
                    closeSelfChangePasswordModal();
                } else {
                    showToast((res.data && res.data.message) || "Failed to update password.", "danger");
                }
            } catch (err) {
                showToast("Network error occurred while updating password.", "danger");
            } finally {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = "Update Password";
                }
            }
        });
    }

    const form = document.getElementById("formSelfChangePassword");
    if (form) form.reset();
    modal.classList.add("active");
    modal.style.display = "flex";
    setTimeout(() => {
        const firstInput = document.getElementById("self_current_password");
        if (firstInput) firstInput.focus();
    }, 50);
};

window.openSelfChangePasswordModal = openSelfChangePasswordModal;
window.closeSelfChangePasswordModal = closeSelfChangePasswordModal;

const closeUserRoleGuideModal = () => {
    const modal = document.getElementById("userRoleGuideModal");
    if (modal) {
        modal.classList.remove("active");
        modal.style.display = "none";
    }
};

const openUserRoleGuideModal = () => {
    let modal = document.getElementById("userRoleGuideModal");
    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    const roleId = parseInt(user.role_id, 10) || 0;
    const roleName = (user.role_name || "").toLowerCase();
    const fullName = user.full_name || user.username || "Staff Member";

    const domain = (user.access_domain || "").toLowerCase();
    const isHigherUp = parseInt(user.is_higher_up, 10) === 1;

    const isAdmin = domain === "admin" || roleId === 1 || roleName === "admin";
    const isHeadFinance = (domain === "finance" && isHigherUp) || roleId === 5 || roleName === "head finance";
    const isFinanceStaff = (domain === "finance" && !isHigherUp) || roleId === 2 || roleName === "finance staff";
    const isHeadNurse = (domain === "clinical" && isHigherUp) || roleId === 4 || roleName === "head nurse";
    const isNurseStaff = (domain === "clinical" && !isHigherUp) || roleId === 3 || roleName === "nurse";
    const isHeadHybrid = (domain === "hybrid" && isHigherUp) || roleId === 7 || roleName === "head hybrid" || roleName === "head ward clerk";
    const isHybridStaff = (domain === "hybrid" && !isHigherUp) || roleId === 6 || roleName === "hybrid" || roleName === "ward clerk";

    let roleBadgeBg = "#eff6ff";
    let roleBadgeBorder = "#bfdbfe";
    let roleBadgeColor = "#1e3a8a";
    let roleTagline = "";
    let allowedHtml = "";
    let restrictedHtml = "";

    if (isAdmin) {
        roleBadgeBg = "#eff6ff";
        roleBadgeBorder = "#bfdbfe";
        roleBadgeColor = "#1e3a8a";
        roleTagline = "Full governance over user accounts, master files, facility setup, security audits, and financial oversight.";
        allowedHtml = `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px;margin-bottom:12px;">
                <div style="font-weight:700;font-size:0.88rem;color:#1e3a8a;margin-bottom:8px;">Authorized Operations (Full Unrestricted Access):</div>
                <ul style="margin:0;padding-left:18px;font-size:0.83rem;color:#334155;line-height:1.6;">
                    <li><strong>Staff &amp; User Management:</strong> Create staff logins, assign operational roles, reset credentials, and deactivate accounts (<code>staff.html</code>).</li>
                    <li><strong>Facility &amp; Infrastructure:</strong> Configure hospital departments, nurse stations (<code>departments.html</code>), hospital floors (<code>Enum_Floor</code>), rooms, and physical beds (<code>rooms.html</code>).</li>
                    <li><strong>Medical &amp; Fee Catalogs:</strong> Full master CRUD for medicines, lab tests, imaging, room tariffs, and doctor consultation rates (<code>catalogs.html</code>, <code>doctors.html</code>).</li>
                    <li><strong>Security Audit &amp; Archive:</strong> Inspect the immutable event log (<code>audit_log.html</code>) and safely restore or purge soft-deleted records (<code>archive.html</code>).</li>
                    <li><strong>Clinical &amp; Financial Oversight:</strong> Full clearance to review admissions, resolve billing disputes, and override charge items.</li>
                </ul>
            </div>
        `;
        restrictedHtml = `
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px;">
                <div style="font-weight:700;font-size:0.86rem;color:#166534;margin-bottom:6px;">Governance &amp; Auditability Policy:</div>
                <p style="margin:0;font-size:0.82rem;color:#15803d;line-height:1.5;">
                    The Administrator has uninhibited system access. Every sensitive action (user provisioning, credential alteration, archive restorations) is permanently recorded in the <strong>Audit Log</strong> with your user identity and timestamp for regulatory compliance.
                </p>
            </div>
        `;
    } else if (isHeadFinance) {
        roleBadgeBg = "#fdf2f8";
        roleBadgeBorder = "#fbcfe8";
        roleBadgeColor = "#9d174d";
        roleTagline = "Supervisory financial leadership over billing settlement, large discount approvals, promissory note execution, and revenue audits.";
        allowedHtml = `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px;margin-bottom:12px;">
                <div style="font-weight:700;font-size:0.88rem;color:#9d174d;margin-bottom:8px;">Authorized Operations (Supervisory Finance):</div>
                <ul style="margin:0;padding-left:18px;font-size:0.83rem;color:#334155;line-height:1.6;">
                    <li><strong>Final Settlement &amp; Audit (<code>invoices.html</code>):</strong> Finalize invoices, approve balance corrections, and authorize discharge clearances.</li>
                    <li><strong>Discounts &amp; Subsidies (<code>discounts.html</code>):</strong> Validate and apply statutory PhilHealth claims, Senior Citizen, PWD, and executive courtesy discounts.</li>
                    <li><strong>Promissory Notes &amp; AR (<code>promissory_notes.html</code>):</strong> Authorize high-balance installment schedules, assign guarantors, and monitor aging receivables.</li>
                    <li><strong>Revenue &amp; Physician Reports (<code>reports.html</code>):</strong> Review cashier daily collection balance, doctor rounding disbursement, and audit reports.</li>
                </ul>
            </div>
        `;
        restrictedHtml = `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;">
                <div style="font-weight:700;font-size:0.86rem;color:#b91c1c;margin-bottom:6px;">Restricted Boundaries (Separation of Duties):</div>
                <p style="margin:0;font-size:0.82rem;color:#991b1b;line-height:1.5;">
                    Finance Supervisors are strictly barred from clinical care (administering medications, vital signs, clinical orders) and IT system administration (<code>staff.html</code>).
                </p>
            </div>
        `;
    } else if (isFinanceStaff) {
        roleBadgeBg = "#ecfdf5";
        roleBadgeBorder = "#a7f3d0";
        roleBadgeColor = "#065f46";
        roleTagline = "Patient accounts settlement, official receipts, statutory discounts, promissory notes, and revenue reconciliation.";
        allowedHtml = `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px;margin-bottom:12px;">
                <div style="font-weight:700;font-size:0.88rem;color:#047857;margin-bottom:8px;">Authorized Operations (What You Can Use):</div>
                <ul style="margin:0;padding-left:18px;font-size:0.83rem;color:#334155;line-height:1.6;">
                    <li><strong>Final Invoicing &amp; Settlement (<code>invoices.html</code>):</strong> Consolidate active ledger charges, verify totals, and process patient discharge settlements.</li>
                    <li><strong>Discounts &amp; Subsidies (<code>discounts.html</code>):</strong> Validate and apply statutory PhilHealth claims, Senior Citizen (20%), PWD (20%), and employee courtesy deductions.</li>
                    <li><strong>Official Receipts &amp; Payments:</strong> Process cash, card, and digital transactions with official serial numbers and printable receipts.</li>
                    <li><strong>Interim / Partial Billing (<code>partial_bill.html</code>):</strong> Generate interim Statements of Account for patient relatives during prolonged inpatient stays.</li>
                    <li><strong>Promissory Notes &amp; AR (<code>promissory_notes.html</code>):</strong> Encode installment repayment plans with authorized guarantors.</li>
                    <li><strong>Financial Reports (<code>reports.html</code>):</strong> Reconcile daily cashier collection logs and payment records.</li>
                </ul>
            </div>
        `;
        restrictedHtml = `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;">
                <div style="font-weight:700;font-size:0.86rem;color:#b91c1c;margin-bottom:6px;">Restricted Boundaries (Separation of Duties):</div>
                <p style="margin:0;font-size:0.82rem;color:#991b1b;line-height:1.5;">
                    Financial personnel are strictly blocked from administering patient medications, recording vital signs, or altering doctor treatment orders. Direct access to system user administration (<code>staff.html</code>) and security archives is reserved exclusively for the System Administrator.
                </p>
            </div>
        `;
    } else if (isHeadNurse) {
        roleBadgeBg = "#f0fdf4";
        roleBadgeBorder = "#bbf7d0";
        roleBadgeColor = "#166534";
        roleTagline = "Supervisory clinical oversight, floor-wide bed allocation, ward transfers, patient triage, and clinical discharge sign-off.";
        allowedHtml = `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px;margin-bottom:12px;">
                <div style="font-weight:700;font-size:0.88rem;color:#166534;margin-bottom:8px;">Authorized Operations (Supervisory Clinical):</div>
                <ul style="margin:0;padding-left:18px;font-size:0.83rem;color:#334155;line-height:1.6;">
                    <li><strong>Floor &amp; Bed Allocation (<code>rooms.html</code>):</strong> Manage bed capacity across hospital floors (<code>Enum_Floor</code>), resolve bottlenecks, and authorize ward transfers.</li>
                    <li><strong>Inpatient Admissions (<code>admissions.html</code>):</strong> Oversee patient triage, emergency admissions, and attending physician assignment.</li>
                    <li><strong>Clinical Hub &amp; Charting (<code>admission_details.html</code>):</strong> Oversee vitals charting, doctor order execution, physician rounds documentation, and clinical discharge clearance.</li>
                    <li><strong>Master Lookups:</strong> Access patient master directory, physician profiles, and medical catalogs.</li>
                </ul>
            </div>
        `;
        restrictedHtml = `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;">
                <div style="font-weight:700;font-size:0.86rem;color:#b91c1c;margin-bottom:6px;">Restricted Boundaries (Separation of Duties):</div>
                <p style="margin:0;font-size:0.82rem;color:#991b1b;line-height:1.5;">
                    Clinical supervisors are strictly barred from cashiering, invoicing, billing discounts, and promissory notes. Direct access to system user administration (<code>staff.html</code>) is reserved for the Admin.
                </p>
            </div>
        `;
    } else if (isNurseStaff) {
        roleBadgeBg = "#ecfeff";
        roleBadgeBorder = "#a5f3fc";
        roleBadgeColor = "#0e7490";
        roleTagline = "Bedside patient care, floor-based bed allocation, vital signs charting, doctor orders, medication tracking, and routine admissions.";
        allowedHtml = `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px;margin-bottom:12px;">
                <div style="font-weight:700;font-size:0.88rem;color:#0e7490;margin-bottom:8px;">Authorized Operations (What You Can Use):</div>
                <ul style="margin:0;padding-left:18px;font-size:0.83rem;color:#334155;line-height:1.6;">
                    <li><strong>Patient Admissions &amp; Triage (<code>admissions.html</code>):</strong> Admit incoming in-patients, record chief complaints, preliminary diagnoses, and emergency contacts.</li>
                    <li><strong>Floor &amp; Bed Management (<code>rooms.html</code>):</strong> View real-time bed inventory organized across hospital floors (<code>Enum_Floor</code>) and assign beds.</li>
                    <li><strong>Stay Details &amp; Charting (<code>admission_details.html</code>):</strong>
                        <ul style="margin:4px 0 0;padding-left:16px;">
                            <li>Record vital signs (blood pressure, temperature, pulse rate, oxygen saturation, respiratory rate).</li>
                            <li>Administer doctor orders: Dispense medications and schedule lab tests with timestamp tracking.</li>
                            <li>Log doctor rounds: Document physician visits and consultation rounds.</li>
                        </ul>
                    </li>
                    <li><strong>Master Directories:</strong> Lookup patients, attending physicians, room classifications, and catalog items.</li>
                </ul>
            </div>
        `;
        restrictedHtml = `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;">
                <div style="font-weight:700;font-size:0.86rem;color:#b91c1c;margin-bottom:6px;">Restricted Boundaries (Separation of Duties):</div>
                <p style="margin:0;font-size:0.82rem;color:#991b1b;line-height:1.5;">
                    Nursing personnel are strictly barred from invoicing, settlement, applying billing discounts, issuing official receipts, and modifying ledger balances.
                </p>
            </div>
        `;
    } else if (isHeadHybrid) {
        roleBadgeBg = "#faf5ff";
        roleBadgeBorder = "#e9d5ff";
        roleBadgeColor = "#6b21a8";
        roleTagline = "Supervisory cross-departmental operations manager over both clinical inpatient care and billing settlement workflows.";
        allowedHtml = `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px;margin-bottom:12px;">
                <div style="font-weight:700;font-size:0.88rem;color:#6b21a8;margin-bottom:8px;">Authorized Operations (Supervisory Cross-Departmental):</div>
                <ul style="margin:0;padding-left:18px;font-size:0.83rem;color:#334155;line-height:1.6;">
                    <li><strong>Clinical Care Domain:</strong> Supervise admissions, floor bed occupancy, transfers, vitals charting, doctor order execution, and clinical discharge clearance.</li>
                    <li><strong>Finance &amp; Billing Domain:</strong> Oversee final invoices, statutory discounts, cashier settlement, partial bills, and promissory notes.</li>
                    <li><strong>Cross-Departmental Coordination:</strong> Bridge nursing stations with the billing department for seamless hospital discharge clearance and operational efficiency.</li>
                </ul>
            </div>
        `;
        restrictedHtml = `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;">
                <div style="font-weight:700;font-size:0.86rem;color:#b91c1c;margin-bottom:6px;">Restricted Boundaries (System Infrastructure):</div>
                <p style="margin:0;font-size:0.82rem;color:#991b1b;line-height:1.5;">
                    The Head Ward Clerk is NOT the IT System Administrator. User provisioning (<code>staff.html</code>), department master station codes (<code>departments.html</code>), system audit logs (<code>audit_log.html</code>), and database recovery (<code>archive.html</code>) remain restricted to the Admin.
                </p>
            </div>
        `;
    } else {
        roleBadgeBg = "#f5f3ff";
        roleBadgeBorder = "#ddd6fe";
        roleBadgeColor = "#5b21b6";
        roleTagline = "Dual operational access (Ward Clerk / Admitting & Billing Coordinator) across clinical care and billing settlement without supervisor override authority.";
        allowedHtml = `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px;margin-bottom:12px;">
                <div style="font-weight:700;font-size:0.88rem;color:#5b21b6;margin-bottom:8px;">Authorized Operations (Dual Operational Access):</div>
                <ul style="margin:0;padding-left:18px;font-size:0.83rem;color:#334155;line-height:1.6;">
                    <li><strong>Admissions &amp; Ward Desk:</strong> Intake patient admissions, check floor bed availability (<code>rooms.html</code>), and review patient records.</li>
                    <li><strong>Billing &amp; Settlement:</strong> Process invoices, record cashier payments, calculate statutory discounts, and prepare interim partial bills.</li>
                    <li><strong>Master Directories:</strong> Access patient master profiles, physician directories, and charge catalogs.</li>
                </ul>
            </div>
        `;
        restrictedHtml = `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;">
                <div style="font-weight:700;font-size:0.86rem;color:#b91c1c;margin-bottom:6px;">Restricted Boundaries (Operational Scope):</div>
                <p style="margin:0;font-size:0.82rem;color:#991b1b;line-height:1.5;">
                    Ward Clerk staff are operational users and do not possess supervisory override authority or IT System Administration privileges (<code>staff.html</code>, <code>audit_log.html</code>, <code>archive.html</code>).
                </p>
            </div>
        `;
    }

    if (!modal) {
        modal = document.createElement("div");
        modal.id = "userRoleGuideModal";
        modal.className = "modal-overlay";
        modal.style.display = "none";
        modal.style.zIndex = "1350";
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-container" style="max-width: 620px; max-height: 88vh; display: flex; flex-direction: column;">
            <div class="modal-header" style="padding: 16px 20px; border-bottom: 1px solid var(--border, #e2e8f0); display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <h3 style="margin: 0; font-size: 1.12rem; font-weight: 700; color: #1e293b;">User &amp; Role Guide</h3>
                        <span style="background: ${roleBadgeBg}; border: 1px solid ${roleBadgeBorder}; color: ${roleBadgeColor}; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">${user.role_name || "Staff"}</span>
                    </div>
                    <p style="margin: 2px 0 0; font-size: 0.8rem; color: #64748b;">${fullName} &bull; Operational permissions and module scope</p>
                </div>
                <button type="button" class="modal-close" id="btnCloseUserRoleGuide" aria-label="Close guide">&times;</button>
            </div>
            <div class="modal-body" style="padding: 16px 20px; overflow-y: auto; flex: 1;">
                <div style="margin-bottom: 12px; font-size: 0.84rem; color: #475569; line-height: 1.45;">
                    ${roleTagline}
                </div>
                ${allowedHtml}
                ${restrictedHtml}
            </div>
            <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-top: 1px solid var(--border, #e2e8f0); background: #f8fafc;">
                <span style="font-size: 0.78rem; color: #64748b;">Role-Based Access Control (RBAC) &bull; Hospital Billing System</span>
                <button type="button" class="btn btn-secondary" id="btnDismissUserRoleGuide" style="padding: 6px 16px; font-size: 0.84rem;">Close Guide</button>
            </div>
        </div>
    `;

    document.getElementById("btnCloseUserRoleGuide").addEventListener("click", closeUserRoleGuideModal);
    document.getElementById("btnDismissUserRoleGuide").addEventListener("click", closeUserRoleGuideModal);

    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            closeUserRoleGuideModal();
        }
    });

    if (!modal.dataset.escBound) {
        modal.dataset.escBound = "true";
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && (modal.classList.contains("active") || modal.style.display === "flex")) {
                closeUserRoleGuideModal();
            }
        });
    }

    modal.classList.add("active");
    modal.style.display = "flex";
};

window.openUserRoleGuideModal = openUserRoleGuideModal;
window.closeUserRoleGuideModal = closeUserRoleGuideModal;

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
            if (btnOpen.disabled || btnOpen.classList.contains("btn-permission-disabled")) return;
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
    const userCanDel = typeof canUserDelete === "function" ? canUserDelete() : true;
    const toggleIcon = isAct ? "✕" : "↻";
    const toggleCls = isAct ? "btn-action-archive" : "btn-action-restore";
    const toggleTitle = isAct ? "Send to Archive (Soft Delete)" : "Restore Record";

    const deleteBtn = (isAct && !userCanDel) ? "" : `
        <button type="button" class="btn btn-sm btn-icon btn-action-icon ${toggleCls} btn-action-soft-delete" data-id="${id}" data-status="${isAct ? 1 : 0}" data-name="${name}" title="${toggleTitle}" aria-label="${toggleTitle}">${toggleIcon}</button>
    `;

    return `
        <div class="table-actions">
            <button type="button" class="btn btn-sm btn-icon btn-action-icon btn-action-edit" data-id="${id}" title="${editTitle}" aria-label="${editTitle}">✎</button>
            ${deleteBtn}
        </div>
    `;
};

const toggleRecordStatus = (apiFile, idKey, idVal, currentStatus, recordName, onDone) => {
    const isArchiving = (currentStatus == 1);
    if (isArchiving && !canUserDelete()) {
        showPopupAlert("Permission Denied: You do not have permission to archive or delete records. Supervisory or Deletion authorization is required.", "danger", "Access Restricted");
        return;
    }
    const actionText = isArchiving ? "send to the System Archive" : "restore from the System Archive";
    const note = isArchiving ? "\n\n(Archived records are kept safe so existing clinical logs and invoices remain intact)" : "";

    showPopupConfirm(`Are you sure you want to ${actionText} "${recordName}"?${note}`, async () => {
        const formData = new FormData();
        formData.append("operation", "toggleStatus");
        formData.append("json", JSON.stringify({ [idKey]: idVal }));

        try {
            const postUrl = (typeof postApiUrl !== "undefined") ? postApiUrl : "../api/POST";
            const response = await axios.post(`${postUrl}/${apiFile}`, formData);
            let resData = response.data;
            if (typeof resData === "string") {
                try {
                    resData = JSON.parse(resData);
                } catch (e) {
                    resData = response.data;
                }
            }

            if (resData === 1 || resData == 1 || (resData && resData.status === 1)) {
                const pastAction = isArchiving ? "sent to the System Archive" : "restored from the System Archive";
                showPopupAlert(`"${recordName}" was successfully ${pastAction}.`, "success", "Status Updated", () => {
                    if (onDone) {
                        onDone();
                    }
                });
            } else if (resData && resData.message) {
                showPopupAlert(resData.message, "warning", "Archive Action Blocked");
            } else {
                showPopupAlert("Error updating record status.", "danger", "Status Update Failed");
            }
        } catch (err) {
            showPopupAlert("Server error during status update.", "danger", "Server Error");
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

let multiLookupPickerState = {
    title: "Select Items",
    items: [],
    selectedIds: [],
    onConfirm: null
};

const openMultiLookupPicker = (options) => {
    let modal = document.getElementById("system-generic-multi-lookup-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "system-generic-multi-lookup-modal";
        modal.className = "modal-overlay picker-modal-overlay";
        modal.innerHTML = `
            <div class="modal-container lookup-picker-modal-container">
                <div class="modal-header">
                    <h3 id="generic_multi_lookup_title">Select Items</h3>
                    <button type="button" class="modal-close" id="btnCloseGenericMultiLookup" aria-label="Close modal">&times;</button>
                </div>
                <div class="modal-body lookup-picker-modal-body">
                    <div class="lookup-picker-controls">
                        <input type="text" id="generic_multi_lookup_search" class="form-control lookup-picker-search-input" placeholder="Search..." autocomplete="off">
                        <select id="generic_multi_lookup_filter" class="form-select lookup-picker-select">
                            <option value="all">All</option>
                            <option value="selected">Selected</option>
                            <option value="unselected">Unselected</option>
                        </select>
                        <select id="generic_multi_lookup_sort" class="form-select lookup-picker-select">
                            <option value="name_asc">Name (A-Z)</option>
                            <option value="name_desc">Name (Z-A)</option>
                            <option value="selected_first">Selected First</option>
                        </select>
                    </div>
                    <div class="multi-picker-toolbar">
                        <label class="multi-picker-select-all">
                            <input type="checkbox" id="generic_multi_select_all" class="multi-picker-cb"> Select All
                        </label>
                        <span id="generic_multi_selected_count" class="multi-picker-count">0 Selected</span>
                    </div>
                    <div id="generic_multi_lookup_list" class="lookup-picker-list-container"></div>
                </div>
                <div class="modal-footer lookup-picker-modal-footer">
                    <button type="button" class="btn btn-secondary" id="btnCancelGenericMultiLookup">Cancel</button>
                    <button type="button" class="btn btn-primary" id="btnConfirmGenericMultiLookup">Done</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const closePicker = () => {
            modal.style.display = "none";
            modal.classList.remove("active");
        };

        document.getElementById("btnCloseGenericMultiLookup").addEventListener("click", closePicker);
        document.getElementById("btnCancelGenericMultiLookup").addEventListener("click", closePicker);

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

        document.getElementById("generic_multi_lookup_search").addEventListener("input", renderGenericMultiLookupList);
        document.getElementById("generic_multi_lookup_filter").addEventListener("change", renderGenericMultiLookupList);
        document.getElementById("generic_multi_lookup_sort").addEventListener("change", renderGenericMultiLookupList);

        document.getElementById("generic_multi_select_all").addEventListener("change", (e) => {
            const isChecked = e.target.checked;
            if (isChecked) {
                multiLookupPickerState.selectedIds = multiLookupPickerState.items.map(i => String(i.id));
            } else {
                multiLookupPickerState.selectedIds = [];
            }
            updateGenericMultiStatus();
            renderGenericMultiLookupList();
        });

        document.getElementById("btnConfirmGenericMultiLookup").addEventListener("click", () => {
            if (typeof multiLookupPickerState.onConfirm === "function") {
                const selectedItems = multiLookupPickerState.items.filter(item => multiLookupPickerState.selectedIds.includes(String(item.id)));
                multiLookupPickerState.onConfirm(multiLookupPickerState.selectedIds, selectedItems);
            }
            closePicker();
        });
    }

    multiLookupPickerState.title = options.title || "Select Items";
    multiLookupPickerState.items = options.items || [];
    multiLookupPickerState.selectedIds = Array.isArray(options.selectedIds) ? options.selectedIds.map(id => String(id)) : [];
    multiLookupPickerState.onConfirm = options.onConfirm || null;

    document.getElementById("generic_multi_lookup_title").textContent = multiLookupPickerState.title;
    document.getElementById("generic_multi_lookup_search").value = "";
    document.getElementById("generic_multi_lookup_filter").value = "all";
    document.getElementById("generic_multi_lookup_sort").value = "name_asc";

    updateGenericMultiStatus();
    renderGenericMultiLookupList();

    modal.classList.add("active");
    modal.style.display = "flex";
    modal.style.zIndex = "1300";
    setTimeout(() => {
        const searchInput = document.getElementById("generic_multi_lookup_search");
        if (searchInput) searchInput.focus();
    }, 50);
};

window.openMultiLookupPicker = openMultiLookupPicker;

const updateGenericMultiStatus = () => {
    const countEl = document.getElementById("generic_multi_selected_count");
    const selectAllCb = document.getElementById("generic_multi_select_all");
    const count = multiLookupPickerState.selectedIds.length;
    if (countEl) {
        countEl.textContent = `${count} Selected`;
    }
    if (selectAllCb && multiLookupPickerState.items.length > 0) {
        selectAllCb.checked = (count === multiLookupPickerState.items.length);
        selectAllCb.indeterminate = (count > 0 && count < multiLookupPickerState.items.length);
    }
};

const renderGenericMultiLookupList = () => {
    const listContainer = document.getElementById("generic_multi_lookup_list");
    if (!listContainer) return;

    const searchStr = (document.getElementById("generic_multi_lookup_search").value || "").toLowerCase().trim();
    const filterVal = document.getElementById("generic_multi_lookup_filter").value;
    const sortVal = document.getElementById("generic_multi_lookup_sort").value;

    let filtered = multiLookupPickerState.items.filter(item => {
        const matchesSearch = !searchStr || 
            (item.text && item.text.toLowerCase().includes(searchStr)) || 
            (item.subtext && item.subtext.toLowerCase().includes(searchStr));

        if (!matchesSearch) return false;

        const isSelected = multiLookupPickerState.selectedIds.includes(String(item.id));
        if (filterVal === "selected") return isSelected;
        if (filterVal === "unselected") return !isSelected;
        return true;
    });

    filtered.sort((a, b) => {
        const aSelected = multiLookupPickerState.selectedIds.includes(String(a.id));
        const bSelected = multiLookupPickerState.selectedIds.includes(String(b.id));

        if (sortVal === "selected_first") {
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
        }

        const nameA = (a.text || "").toLowerCase();
        const nameB = (b.text || "").toLowerCase();
        if (sortVal === "name_desc") {
            return nameB.localeCompare(nameA);
        }
        return nameA.localeCompare(nameB);
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '<div class="picker-empty-state">No matching items found.</div>';
        return;
    }

    listContainer.innerHTML = "";
    filtered.forEach(item => {
        const itemId = String(item.id);
        const isSelected = multiLookupPickerState.selectedIds.includes(itemId);

        const row = document.createElement("div");
        row.className = `picker-item-row${isSelected ? ' selected' : ''}`;

        const leftBox = document.createElement("div");
        leftBox.className = "multi-picker-item-left";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = isSelected;
        cb.className = "multi-picker-cb";

        const labelBox = document.createElement("div");
        labelBox.className = "picker-item-content";

        const titleEl = document.createElement("div");
        titleEl.textContent = item.text;
        titleEl.className = "picker-item-title";
        labelBox.appendChild(titleEl);

        if (item.subtext) {
            const subEl = document.createElement("div");
            subEl.textContent = item.subtext;
            subEl.className = "picker-item-sub";
            labelBox.appendChild(subEl);
        }

        leftBox.appendChild(cb);
        leftBox.appendChild(labelBox);

        const badgeBox = document.createElement("div");
        badgeBox.className = "picker-item-badge-wrap";
        if (isSelected) {
            badgeBox.innerHTML = '<span class="badge badge-primary">Selected</span>';
        }

        row.appendChild(leftBox);
        row.appendChild(badgeBox);

        const toggleItem = () => {
            const idx = multiLookupPickerState.selectedIds.indexOf(itemId);
            if (idx > -1) {
                multiLookupPickerState.selectedIds.splice(idx, 1);
            } else {
                multiLookupPickerState.selectedIds.push(itemId);
            }
            updateGenericMultiStatus();
            renderGenericMultiLookupList();
        };

        row.addEventListener("click", toggleItem);
        cb.addEventListener("click", (e) => e.stopPropagation());
        cb.addEventListener("change", toggleItem);

        listContainer.appendChild(row);
    });
};

document.addEventListener("DOMContentLoaded", () => {
    if (typeof renderSidebar !== "undefined") {
        renderSidebar();
    }
    initAppSession();
    initSidebarControls();
    initFilterBarCapsules();
    initSearchClearButtons();
    initInfoTooltips();
    initInputValidationGuards();
    schedulePermissionsEnforcement();
    initClinicalNotificationsSystem();
    try {
        const obs = new MutationObserver(() => schedulePermissionsEnforcement());
        obs.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
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

const initFilterBarCapsules = () => {
    const searchSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
    const filterSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`;
    const sortSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>`;
    const resetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;

    document.querySelectorAll(".filter-bar").forEach((bar) => {
        if (bar.dataset.capsulesWired) return;
        bar.dataset.capsulesWired = "true";

        const groups = Array.from(bar.querySelectorAll(":scope > .form-group"));
        groups.forEach((group) => {
            group.removeAttribute("style");
            const input = group.querySelector("input[type='text'], input[type='search']");
            const select = group.querySelector("select");
            const btn = group.querySelector("button");

            if (input) {
                group.classList.add("filter-capsule-search");
                if (!group.querySelector(".filter-capsule-icon")) {
                    const iconSpan = document.createElement("span");
                    iconSpan.className = "filter-capsule-icon";
                    iconSpan.innerHTML = searchSvg;
                    group.insertBefore(iconSpan, group.firstChild);
                }
            } else if (select) {
                group.classList.add("filter-capsule-select");
                if (!group.querySelector(".filter-capsule-icon")) {
                    const isSort = (select.id || "").toLowerCase().includes("sort");
                    const iconSpan = document.createElement("span");
                    iconSpan.className = "filter-capsule-icon";
                    iconSpan.innerHTML = isSort ? sortSvg : filterSvg;
                    group.insertBefore(iconSpan, group.firstChild);
                }
            } else if (btn) {
                group.classList.add("filter-capsule-action");
            }
        });

        let resetBtn = bar.querySelector("#btnResetFilters, .btn-filter-bar-reset");
        if (resetBtn) {
            resetBtn.className = "btn-filter-bar-reset";
            resetBtn.innerHTML = `${resetSvg}<span>Reset</span>`;
        } else {
            resetBtn = document.createElement("button");
            resetBtn.type = "button";
            resetBtn.className = "btn-filter-bar-reset";
            resetBtn.title = "Reset search and filters";
            resetBtn.innerHTML = `${resetSvg}<span>Reset</span>`;
            resetBtn.addEventListener("click", () => {
                bar.querySelectorAll("input[type='text'], input[type='search']").forEach((inp) => {
                    if (inp.value !== "") {
                        inp.value = "";
                        inp.dispatchEvent(new Event("input", { bubbles: true }));
                        inp.dispatchEvent(new Event("keyup", { bubbles: true }));
                    }
                });
                bar.querySelectorAll("select").forEach((sel) => {
                    const defaultOpt = Array.from(sel.options).find((o) => o.defaultSelected) || sel.options[0];
                    if (defaultOpt && sel.value !== defaultOpt.value) {
                        sel.value = defaultOpt.value;
                        sel.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                });
            });
            bar.appendChild(resetBtn);
        }
    });
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

const initInfoTooltips = () => {
    let tooltipEl = document.getElementById("global-info-tooltip");
    if (!tooltipEl) {
        tooltipEl = document.createElement("div");
        tooltipEl.id = "global-info-tooltip";
        tooltipEl.className = "global-tooltip-popover";
        tooltipEl.setAttribute("role", "tooltip");
        document.body.appendChild(tooltipEl);
    }

    const showTip = (target) => {
        const text = target.getAttribute("data-tooltip") || target.getAttribute("title");
        if (!text) return;
        if (target.hasAttribute("title")) {
            target.setAttribute("data-stored-title", target.getAttribute("title"));
            target.removeAttribute("title");
        }
        tooltipEl.textContent = text;
        tooltipEl.style.display = "block";

        const rect = target.getBoundingClientRect();
        const tipRect = tooltipEl.getBoundingClientRect();

        let top = rect.top - tipRect.height - 8;
        let left = rect.left + (rect.width / 2) - (tipRect.width / 2);

        if (top < 10) {
            top = rect.bottom + 8;
        }

        const margin = 10;
        if (left < margin) {
            left = margin;
        } else if (left + tipRect.width > window.innerWidth - margin) {
            left = window.innerWidth - tipRect.width - margin;
        }

        tooltipEl.style.top = `${Math.round(top)}px`;
        tooltipEl.style.left = `${Math.round(left)}px`;
        tooltipEl.style.opacity = "1";
    };

    const hideTip = (target) => {
        tooltipEl.style.opacity = "0";
        tooltipEl.style.display = "none";
        if (target && target.hasAttribute("data-stored-title")) {
            target.setAttribute("title", target.getAttribute("data-stored-title"));
            target.removeAttribute("data-stored-title");
        }
    };

    document.addEventListener("mouseover", (e) => {
        const target = e.target.closest(".info-tip, [data-tooltip]");
        if (target) {
            showTip(target);
        }
    });

    document.addEventListener("mouseout", (e) => {
        const target = e.target.closest(".info-tip, [data-tooltip]");
        if (target) {
            hideTip(target);
        }
    });

    document.addEventListener("focusin", (e) => {
        const target = e.target.closest(".info-tip, [data-tooltip]");
        if (target) {
            showTip(target);
        }
    });

    document.addEventListener("focusout", (e) => {
        const target = e.target.closest(".info-tip, [data-tooltip]");
        if (target) {
            hideTip(target);
        }
    });
};

const initRefreshBtn = (btnId, refreshFn) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener("click", async () => {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.classList.add("spinning");
        try {
            await refreshFn();
        } finally {
            btn.disabled = false;
            btn.classList.remove("spinning");
        }
    });
};

const validatePersonName = (val, fieldName = "Name", isRequired = true) => {
    const trimmed = (val || "").trim();
    if (!trimmed) {
        if (isRequired) {
            return { valid: false, message: `Please enter ${fieldName}.` };
        }
        return { valid: true };
    }
    if (/\d/.test(trimmed)) {
        return { valid: false, message: `${fieldName} cannot contain numbers. Please use letters only.` };
    }
    if (!/^[a-zA-Z\u00C0-\u024F\s\.\-\'\’]+$/.test(trimmed)) {
        return { valid: false, message: `${fieldName} contains invalid characters. Please use letters, spaces, hyphens, and periods only.` };
    }
    if (trimmed.replace(/[^a-zA-Z\u00C0-\u024F]/g, "").length < 2) {
        return { valid: false, message: `${fieldName} must be at least 2 letters long.` };
    }
    return { valid: true };
};

const validateContactNumber = (val, fieldName = "Contact Number", isRequired = false) => {
    const trimmed = (val || "").trim();
    if (!trimmed) {
        if (isRequired) {
            return { valid: false, message: `Please enter ${fieldName}.` };
        }
        return { valid: true };
    }
    if (/[a-zA-Z]/.test(trimmed)) {
        return { valid: false, message: `${fieldName} cannot contain letters. Please enter numbers only.` };
    }
    const digitsOnly = trimmed.replace(/\D/g, "");
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        return { valid: false, message: `${fieldName} must be a valid contact number with 7 to 15 digits (e.g., 09171234567).` };
    }
    return { valid: true };
};

const validateNumericField = (val, fieldName = "Amount", minVal = 0, allowZero = true) => {
    if (val === "" || val === null || val === undefined) {
        return { valid: false, message: `Please enter a valid numeric value for ${fieldName}.` };
    }
    const num = parseFloat(val);
    if (isNaN(num)) {
        return { valid: false, message: `${fieldName} must be a valid number without text or letters.` };
    }
    if (!allowZero && num <= minVal) {
        return { valid: false, message: `${fieldName} must be greater than ${minVal}.` };
    }
    if (allowZero && num < minVal) {
        return { valid: false, message: `${fieldName} cannot be less than ${minVal}.` };
    }
    return { valid: true, value: num };
};

const initInputValidationGuards = () => {
    const attachGuards = (root = document) => {
        const personNameRegex = /(first_name|last_name|middle_name|patient_name|doctor_name|staff_name|staff_first_name|staff_last_name|emergency_contact_name|emergency_name|guarantor_name)/i;
        const phoneRegex = /(contact_number|phone|mobile|emergency_contact_number|staff_contact_number|guarantor_contact)/i;
        const integerRegex = /(capacity|order_qty|return_qty|days|installments|months)/i;
        const amountRegex = /(amount|fee|price|rate|tender|tendered|deposit|balance|cost|voucher|val)/i;

        const inputs = root.querySelectorAll ? root.querySelectorAll("input") : [];
        inputs.forEach(input => {
            if (!input || input.type === "hidden" || input.type === "checkbox" || input.type === "radio" || input.type === "date" || input.type === "password" || input.readOnly) {
                return;
            }
            if (input.dataset.validationGuarded === "true") return;

            const inputId = input.id || "";
            const inputName = input.name || "";
            const isSearchOrFilter = /(search|filter)/i.test(inputId) || /(search|filter)/i.test(inputName);
            if (isSearchOrFilter) return;

            const isPersonName = personNameRegex.test(inputId) || personNameRegex.test(inputName);
            const isPhone = phoneRegex.test(inputId) || phoneRegex.test(inputName);
            const isInteger = integerRegex.test(inputId) || integerRegex.test(inputName);
            const isAmount = (input.type === "number" || amountRegex.test(inputId) || amountRegex.test(inputName)) && !isPhone && !isInteger;

            if (isPersonName) {
                input.dataset.validationGuarded = "true";
                input.addEventListener("keydown", (e) => {
                    if (e.key && e.key.length === 1 && /\d/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        e.preventDefault();
                    }
                });
                input.addEventListener("input", () => {
                    if (/\d/.test(input.value)) {
                        input.value = input.value.replace(/\d/g, "");
                    }
                });
                input.addEventListener("paste", (e) => {
                    const pasteData = (e.clipboardData || window.clipboardData)?.getData("text") || "";
                    if (/\d/.test(pasteData)) {
                        e.preventDefault();
                        const clean = pasteData.replace(/\d/g, "");
                        document.execCommand("insertText", false, clean);
                    }
                });
            } else if (isPhone) {
                input.dataset.validationGuarded = "true";
                input.addEventListener("keydown", (e) => {
                    if (e.key && e.key.length === 1 && /[a-zA-Z]/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        e.preventDefault();
                    }
                });
                input.addEventListener("input", () => {
                    input.value = input.value.replace(/[^0-9+\s\-()]/g, "");
                });
                input.addEventListener("paste", (e) => {
                    const pasteData = (e.clipboardData || window.clipboardData)?.getData("text") || "";
                    if (/[a-zA-Z]/.test(pasteData)) {
                        e.preventDefault();
                        const clean = pasteData.replace(/[^0-9+\s\-()]/g, "");
                        document.execCommand("insertText", false, clean);
                    }
                });
            } else if (isInteger) {
                input.dataset.validationGuarded = "true";
                input.addEventListener("keydown", (e) => {
                    if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-" || e.key === ".") {
                        e.preventDefault();
                    } else if (e.key && e.key.length === 1 && !/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        e.preventDefault();
                    }
                });
                input.addEventListener("input", () => {
                    input.value = input.value.replace(/\D/g, "");
                });
                input.addEventListener("paste", (e) => {
                    const pasteData = (e.clipboardData || window.clipboardData)?.getData("text") || "";
                    if (/\D/.test(pasteData)) {
                        e.preventDefault();
                        const clean = pasteData.replace(/\D/g, "");
                        document.execCommand("insertText", false, clean);
                    }
                });
            } else if (isAmount) {
                input.dataset.validationGuarded = "true";
                input.addEventListener("keydown", (e) => {
                    if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                        e.preventDefault();
                    } else if (e.key && e.key.length === 1 && /[a-zA-Z]/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        e.preventDefault();
                    }
                });
                input.addEventListener("input", () => {
                    if (input.type === "text") {
                        let clean = input.value.replace(/[^0-9.]/g, "");
                        const parts = clean.split(".");
                        if (parts.length > 2) {
                            clean = parts[0] + "." + parts.slice(1).join("");
                        }
                        input.value = clean;
                    }
                });
                input.addEventListener("paste", (e) => {
                    const pasteData = (e.clipboardData || window.clipboardData)?.getData("text") || "";
                    if (/[a-zA-Z]/.test(pasteData)) {
                        e.preventDefault();
                        let clean = pasteData.replace(/[^0-9.]/g, "");
                        const parts = clean.split(".");
                        if (parts.length > 2) {
                            clean = parts[0] + "." + parts.slice(1).join("");
                        }
                        document.execCommand("insertText", false, clean);
                    }
                });
            }
        });
    };

    attachGuards(document);

    if (window.MutationObserver) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(m => {
                if (m.addedNodes && m.addedNodes.length > 0) {
                    m.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            attachGuards(node);
                        }
                    });
                }
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
};
const renderSortableTh = (label, sortKey, alignRight = false, currentColumn = null, currentDir = "asc") => {
    const isSorted = currentColumn === sortKey;
    const dir = isSorted ? currentDir : "";
    const activeClass = isSorted ? ` sorted-${dir}` : "";

    let arrowSvg = `
        <span class="sort-icon-box" aria-hidden="true">
            <svg class="sort-icon-neutral" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.8"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>
        </span>
    `;
    if (dir === "asc") {
        arrowSvg = `
            <span class="sort-icon-box active" aria-hidden="true">
                <svg class="sort-icon-active" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="3.5"><polyline points="18 15 12 9 6 15"/></svg>
            </span>
        `;
    } else if (dir === "desc") {
        arrowSvg = `
            <span class="sort-icon-box active" aria-hidden="true">
                <svg class="sort-icon-active" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="3.5"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
        `;
    }

    return `
        <th class="sortable-th${activeClass}" data-sort="${sortKey}" role="button" tabindex="0" title="Click to sort by ${label}">
            <div class="th-sort-wrapper">
                <span class="th-label">${label}</span>
                ${arrowSvg}
            </div>
        </th>
    `;
};

window.renderSortableTh = renderSortableTh;

const defaultDomTableSort = (tableElem, th, sortKey) => {
    const thead = tableElem.querySelector("thead");
    const tbody = tableElem.querySelector("tbody");
    if (!thead || !tbody) return;

    const allThs = Array.from(thead.querySelectorAll("th"));
    const colIndex = allThs.indexOf(th);
    if (colIndex === -1) return;

    let newDir = "asc";
    if (th.classList.contains("sorted-asc")) {
        newDir = "desc";
    } else if (th.classList.contains("sorted-desc")) {
        newDir = "asc";
    }

    allThs.forEach((header) => {
        header.classList.remove("sorted-asc", "sorted-desc");
        const iconBox = header.querySelector(".sort-icon-box");
        if (iconBox) {
            iconBox.classList.remove("active");
            iconBox.innerHTML = `<svg class="sort-icon-neutral" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.8"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>`;
        }
    });

    th.classList.add(`sorted-${newDir}`);
    const activeIconBox = th.querySelector(".sort-icon-box");
    if (activeIconBox) {
        activeIconBox.classList.add("active");
        if (newDir === "asc") {
            activeIconBox.innerHTML = `<svg class="sort-icon-active" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="3.5"><polyline points="18 15 12 9 6 15"/></svg>`;
        } else {
            activeIconBox.innerHTML = `<svg class="sort-icon-active" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="3.5"><polyline points="6 9 12 15 18 9"/></svg>`;
        }
    }

    const rows = Array.from(tbody.querySelectorAll("tr"));
    if (rows.length <= 1) return;
    if (rows[0].querySelector("td[colspan]")) return;

    const parseValue = (td) => {
        if (!td) return "";
        if (td.hasAttribute("data-sort-value")) {
            return td.getAttribute("data-sort-value").trim();
        }
        const prim = td.querySelector(".table-primary-text");
        if (prim) {
            return prim.textContent.trim();
        }
        const badge = td.querySelector(".badge");
        if (badge && td.children.length === 1) {
            return badge.textContent.trim();
        }
        return td.textContent.trim();
    };

    const isNumeric = (str) => {
        const clean = str.replace(/[₱$,\s]/g, "");
        return clean !== "" && !isNaN(Number(clean));
    };

    const toNumeric = (str) => {
        return Number(str.replace(/[₱$,\s]/g, ""));
    };

    const isDate = (str) => {
        return /\d{4}-\d{2}-\d{2}|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(str);
    };

    rows.sort((rowA, rowB) => {
        const cellA = rowA.children[colIndex];
        const cellB = rowB.children[colIndex];
        const valA = parseValue(cellA);
        const valB = parseValue(cellB);

        if (isNumeric(valA) && isNumeric(valB)) {
            const numA = toNumeric(valA);
            const numB = toNumeric(valB);
            return newDir === "asc" ? numA - numB : numB - numA;
        }

        if (isDate(valA) && isDate(valB)) {
            const dateA = Date.parse(valA);
            const dateB = Date.parse(valB);
            if (!isNaN(dateA) && !isNaN(dateB)) {
                return newDir === "asc" ? dateA - dateB : dateB - dateA;
            }
        }

        const comp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
        return newDir === "asc" ? comp : -comp;
    });

    rows.forEach(r => tbody.appendChild(r));
};

window.defaultDomTableSort = defaultDomTableSort;

const bindSortableTable = (tableElement, onSort) => {
    if (!tableElement) return;
    const thead = tableElement.querySelector("thead");
    if (!thead || thead.__hasSortHandler) return;
    thead.__hasSortHandler = true;

    const triggerSort = (th) => {
        const sortKey = th.getAttribute("data-sort");
        if (!sortKey) return;
        if (typeof onSort === "function") {
            onSort(sortKey);
        } else {
            defaultDomTableSort(tableElement, th, sortKey);
        }
    };

    thead.addEventListener("click", (e) => {
        const th = e.target.closest("th.sortable-th");
        if (th) triggerSort(th);
    });

    thead.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            const th = e.target.closest("th.sortable-th");
            if (th) {
                e.preventDefault();
                triggerSort(th);
            }
        }
    });
};

window.bindSortableTable = bindSortableTable;

document.addEventListener("click", (e) => {
    const th = e.target.closest("th.sortable-th");
    if (!th) return;
    const table = th.closest("table");
    if (!table) return;
    const thead = table.querySelector("thead");
    if (thead && thead.__hasSortHandler) return;
    defaultDomTableSort(table, th, th.getAttribute("data-sort") || "");
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
        const th = e.target.closest("th.sortable-th");
        if (!th) return;
        const table = th.closest("table");
        if (!table) return;
        const thead = table.querySelector("thead");
        if (thead && thead.__hasSortHandler) return;
        e.preventDefault();
        defaultDomTableSort(table, th, th.getAttribute("data-sort") || "");
    }
});

const ensureClinicalNotificationsModal = () => {
    let modal = document.getElementById("clinicalNotifModal");
    if (!document.getElementById("notif-queue-inline-styles")) {
        const style = document.createElement("style");
        style.id = "notif-queue-inline-styles";
        style.textContent = `
            .notif-modal-container {
                max-width: 820px;
                width: 95%;
                transition: max-width 0.22s ease-in-out;
            }
            .notif-modal-wide {
                max-width: 1160px !important;
                width: 96% !important;
            }
            .queue-station-filter-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 10px 14px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                margin-bottom: 12px;
                flex-wrap: wrap;
            }
            .queue-station-filter-left {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .queue-station-dropdown {
                min-width: 220px;
                max-width: 340px;
                font-size: 13px;
                font-weight: 600;
                padding: 6px 12px;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                background: #ffffff;
            }
            .queue-open-full-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-size: 12.5px;
                font-weight: 700;
                color: #0284c7;
                text-decoration: none;
                padding: 6px 14px;
                background: #eff6ff;
                border: 1px solid #bfdbfe;
                border-radius: 6px;
                transition: all 0.15s ease;
            }
            .queue-open-full-btn:hover {
                background: #0284c7;
                color: #ffffff;
                border-color: #0284c7;
            }
            .orders-filter-container {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 12px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 10px 14px;
            }
            .orders-filter-left {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 10px;
                flex: 1 1 340px;
            }
            .orders-search-box {
                position: relative;
                flex: 1 1 200px;
                min-width: 170px;
            }
            .orders-search-input {
                width: 100%;
                padding: 6px 12px 6px 32px;
                font-size: 12.5px;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                background: #ffffff;
                color: #0f172a;
                outline: none;
            }
            .orders-search-input:focus {
                border-color: #0284c7;
                box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.12);
            }
            .orders-search-icon {
                position: absolute;
                left: 10px;
                top: 50%;
                transform: translateY(-50%);
                color: #94a3b8;
                pointer-events: none;
                display: flex;
            }
            .orders-filter-pills {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 6px;
            }
            .process-filter-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 5px 11px;
                border-radius: 18px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                border: 1px solid #e2e8f0;
                background: #ffffff;
                color: #475569;
                transition: all 0.15s ease;
                user-select: none;
            }
            .process-filter-btn:hover {
                border-color: #cbd5e1;
                background: #f1f5f9;
            }
            .process-filter-btn.active {
                background: #0f172a;
                color: #ffffff;
                border-color: #0f172a;
            }
            .process-filter-btn.active .process-filter-count {
                background: rgba(255, 255, 255, 0.25);
                color: #ffffff;
            }
            .process-filter-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                display: inline-block;
                flex-shrink: 0;
            }
            .process-filter-count {
                font-size: 11px;
                font-weight: 700;
                padding: 1px 6px;
                border-radius: 10px;
                background: #f1f5f9;
                color: #475569;
            }
            .orders-filter-right {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            }
            .orders-sort-select {
                padding: 6px 10px;
                font-size: 12.5px;
                font-weight: 600;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                background: #ffffff;
                color: #334155;
                cursor: pointer;
            }
            .notif-queue-table-wrap {
                overflow-x: auto;
                overflow-y: visible;
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
            }
            .notif-queue-table-wrap table.data-table {
                width: 100%;
                border-collapse: collapse;
                margin: 0;
            }
            .notif-queue-table-wrap table.data-table th,
            .notif-queue-table-wrap table.data-table td {
                padding: 12px 14px;
                vertical-align: middle;
            }
            .order-tracking-cell {
                display: flex;
                flex-direction: column;
                gap: 6px;
                min-width: 280px;
            }
            .tracking-stepper {
                display: flex;
                align-items: center;
                width: 100%;
                margin-top: 4px;
            }
            .tracking-step {
                display: flex;
                flex-direction: column;
                align-items: center;
                position: relative;
                flex: 1;
            }
            .tracking-step:not(:last-child)::after {
                content: '';
                position: absolute;
                top: 8px;
                left: 50%;
                width: 100%;
                height: 2px;
                background-color: #e2e8f0;
                z-index: 1;
            }
            .tracking-step.is-complete:not(:last-child)::after {
                background-color: #059669;
            }
            .tracking-step.is-active:not(:last-child)::after {
                background-color: #cbd5e1;
            }
            .tracking-node {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background-color: #ffffff;
                border: 2px solid #cbd5e1;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 9px;
                font-weight: 700;
                color: #64748b;
                z-index: 2;
                transition: all 0.2s ease;
            }
            .tracking-step.is-complete .tracking-node {
                background-color: #059669;
                border-color: #059669;
                color: #ffffff;
            }
            .tracking-step.step-requested.is-active .tracking-node {
                border-color: #d97706;
                background-color: #d97706;
                color: #ffffff;
                box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.2);
            }
            .tracking-step.step-preparing.is-active .tracking-node {
                border-color: #0284c7;
                background-color: #0284c7;
                color: #ffffff;
                box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.2);
            }
            .tracking-step.step-prepared.is-active .tracking-node {
                border-color: #4f46e5;
                background-color: #4f46e5;
                color: #ffffff;
                box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
            }
            .tracking-step.step-delivering.is-active .tracking-node {
                border-color: #7c3aed;
                background-color: #7c3aed;
                color: #ffffff;
                box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2);
            }
            .tracking-step.step-administered.is-active .tracking-node {
                border-color: #059669;
                background-color: #059669;
                color: #ffffff;
                box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.2);
            }
            .tracking-label {
                font-size: 10px;
                font-weight: 600;
                color: #64748b;
                margin-top: 3px;
                text-align: center;
                white-space: nowrap;
            }
            .tracking-step.is-active .tracking-label {
                color: #0f172a;
                font-weight: 700;
            }
            .tracking-step.is-complete .tracking-label {
                color: #059669;
            }
            .tracking-meta-desc {
                font-size: 11px;
                color: #475569;
                line-height: 1.35;
                margin-top: 2px;
            }
            .badge-process {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                padding: 4px 9px;
                border-radius: 6px;
                font-size: 11.5px;
                font-weight: 700;
                line-height: 1.3;
                white-space: nowrap;
            }
            .badge-process-requested {
                background-color: #fef3c7;
                color: #92400e;
                border: 1px solid #fde68a;
            }
            .badge-process-preparing {
                background-color: #e0f2fe;
                color: #0369a1;
                border: 1px solid #bae6fd;
            }
            .badge-process-prepared {
                background-color: #e0e7ff;
                color: #3730a3;
                border: 1px solid #c7d2fe;
            }
            .badge-process-delivering {
                background-color: #ede9fe;
                color: #5b21b6;
                border: 1px solid #ddd6fe;
            }
            .badge-process-administered {
                background-color: #d1fae5;
                color: #065f46;
                border: 1px solid #a7f3d0;
            }
            .badge-process-cancelled {
                background-color: #f1f5f9;
                color: #475569;
                border: 1px solid #e2e8f0;
            }
        `;
        document.head.appendChild(style);
    }
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "clinicalNotifModal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
        <div class="modal-container notif-modal-container">
            <div class="modal-header">
                <div>
                    <h3>Clinical Orders &amp; Department Alerts</h3>
                    <div class="table-sub-text">Real-time clinical order tracking and department fulfillment</div>
                </div>
                <button type="button" class="modal-close" id="btnCloseClinicalNotifModal" aria-label="Close modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="notif-tabs" role="tablist">
                    <button type="button" class="notif-tab-btn active" id="btnTabNotifAlerts">Real-Time Alerts (<span id="notif-tab-badge">0</span>)</button>
                    <button type="button" class="notif-tab-btn" id="btnTabNotifQueue">Department Orders Queue</button>
                </div>
                <div id="notif-tab-content-alerts">
                    <div id="notif-alerts-list">
                        <p class="text-muted">Loading clinical alerts...</p>
                    </div>
                </div>
                <div id="notif-tab-content-queue" class="is-hidden">
                    <div class="queue-station-filter-bar">
                        <div class="queue-station-filter-left">
                            <label for="notif-queue-station-select" class="form-label font-bold" id="notif-queue-station-label">Department Station:</label>
                            <select id="notif-queue-station-select" class="form-control queue-station-dropdown">
                                <option value="0">Loading Stations...</option>
                            </select>
                        </div>
                        <a href="department_orders.html" class="queue-open-full-btn" id="btnNotifQueueOpenFullPage" title="Open full dedicated Department Orders page">
                            Open Full Workspace Page &raquo;
                        </a>
                    </div>
                    <div id="notif-queue-controls-container"></div>
                    <div class="notif-queue-table-wrap" id="notif-queue-table-div">
                        <p class="text-muted">Loading department orders...</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" id="btnToggleToastPopups" class="btn btn-secondary">Disable Toast Popups</button>
                <button type="button" id="btnMarkAllNotifsRead" class="btn btn-secondary">Mark All as Read</button>
                <button type="button" id="btnCloseNotifFooter" class="btn btn-primary">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = document.getElementById("btnCloseClinicalNotifModal");
    if (closeBtn) closeBtn.addEventListener("click", () => closeModal("clinicalNotifModal"));
    const closeFooter = document.getElementById("btnCloseNotifFooter");
    if (closeFooter) closeFooter.addEventListener("click", () => closeModal("clinicalNotifModal"));

    const tabAlerts = document.getElementById("btnTabNotifAlerts");
    const tabQueue = document.getElementById("btnTabNotifQueue");
    const contentAlerts = document.getElementById("notif-tab-content-alerts");
    const contentQueue = document.getElementById("notif-tab-content-queue");

    if (tabAlerts && tabQueue) {
        tabAlerts.addEventListener("click", () => {
            tabAlerts.classList.add("active");
            tabQueue.classList.remove("active");
            if (contentAlerts) contentAlerts.classList.remove("is-hidden");
            if (contentQueue) contentQueue.classList.add("is-hidden");
            const container = modal.querySelector(".modal-container");
            if (container) container.classList.remove("notif-modal-wide");
        });
        tabQueue.addEventListener("click", () => {
            tabQueue.classList.add("active");
            tabAlerts.classList.remove("active");
            if (contentAlerts) contentAlerts.classList.add("is-hidden");
            if (contentQueue) contentQueue.classList.remove("is-hidden");
            const container = modal.querySelector(".modal-container");
            if (container) container.classList.add("notif-modal-wide");
            fetchDepartmentOrdersQueue();
        });
    }

    const stationSelect = document.getElementById("notif-queue-station-select");
    if (stationSelect && !stationSelect.dataset.wired) {
        stationSelect.dataset.wired = "true";
        stationSelect.addEventListener("change", () => {
            stationSelect.dataset.userChanged = "true";
            fetchDepartmentOrdersQueue(parseInt(stationSelect.value, 10));
        });
    }

    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    setupQueueStationSelect(user);

    const toggleToastBtn = document.getElementById("btnToggleToastPopups");
    if (toggleToastBtn && !toggleToastBtn.dataset.wired) {
        toggleToastBtn.dataset.wired = "true";
        toggleToastBtn.addEventListener("click", () => {
            const isDisabled = localStorage.getItem("clinical_toasts_disabled") === "true";
            if (isDisabled) {
                localStorage.removeItem("clinical_toasts_disabled");
                updateToastToggleButton();
                alert("Notification toast popups (.clinical-toast-card) have been re-enabled.");
            } else {
                localStorage.setItem("clinical_toasts_disabled", "true");
                const allToasts = document.querySelectorAll(".clinical-toast-card");
                allToasts.forEach(t => t.remove());
                updateToastToggleButton();
                alert("Notification toast popups (.clinical-toast-card) have been disabled.");
            }
        });
    }
    updateToastToggleButton();

    const markAllBtn = document.getElementById("btnMarkAllNotifsRead");
    if (markAllBtn) {
        markAllBtn.addEventListener("click", () => {
            const curUser = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
            const fd = new FormData();
            fd.append("operation", "markNotificationRead");
            fd.append("json", JSON.stringify({ user_id: curUser.user_id, mark_all: 1 }));
            axios.post("../api/POST/clinical_orders.php", fd).then(() => {
                fetchRealtimeNotifications();
            });
        });
    }

    return modal;
};

let lastKnownNotifCount = parseInt(sessionStorage.getItem("hospital_last_notif_count") ?? "-1", 10);

const getShownToastIds = () => {
    try {
        return new Set(JSON.parse(sessionStorage.getItem("hospital_shown_toast_ids") || "[]"));
    } catch (e) {
        return new Set();
    }
};

const addShownToastId = (id) => {
    try {
        const notifId = parseInt(id, 10);
        if (!notifId) return;
        const set = getShownToastIds();
        set.add(notifId);
        sessionStorage.setItem("hospital_shown_toast_ids", JSON.stringify([...set]));
    } catch (e) {}
};

const updateToastToggleButton = () => {
    const btn = document.getElementById("btnToggleToastPopups");
    if (!btn) return;
    const isDisabled = localStorage.getItem("clinical_toasts_disabled") === "true";
    if (isDisabled) {
        btn.textContent = "Enable Toast Popups";
        btn.className = "btn btn-outline";
    } else {
        btn.textContent = "Disable Toast Popups";
        btn.className = "btn btn-secondary";
    }
};

const playClinicalChime = () => {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
};

const showClinicalToastAlert = (n) => {
    if (localStorage.getItem("clinical_toasts_disabled") === "true") return;
    const notifId = parseInt(n?.Notification_ID, 10);
    if (!n || !notifId || getShownToastIds().has(notifId)) return;
    addShownToastId(notifId);

    let container = document.getElementById("clinical-toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "clinical-toast-container";
        container.className = "clinical-toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "clinical-toast-card";
    toast.innerHTML = `
        <div class="clinical-toast-inner">
            <div class="clinical-toast-header">
                <span class="clinical-toast-badge">Clinical Alert</span>
                <button type="button" class="clinical-toast-close" aria-label="Close notification">&times;</button>
            </div>
            <div class="clinical-toast-title">${n.Title || "Clinical Order Alert"}</div>
            <div class="clinical-toast-body">${n.Message || ""}</div>
            <div class="clinical-toast-footer">
                <span class="clinical-toast-time">${n.Formatted_Time || "Just now"}</span>
                <div class="clinical-toast-footer-actions">
                    <button type="button" class="btn btn-secondary clinical-toast-btn btn-toast-disable">Disable Toasts</button>
                    <button type="button" class="btn btn-primary clinical-toast-btn btn-toast-open">View / Process</button>
                </div>
            </div>
        </div>
    `;

    toast.querySelector(".clinical-toast-close").addEventListener("click", () => toast.remove());
    toast.querySelector(".btn-toast-open").addEventListener("click", () => {
        toast.remove();
        const curUser = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
        const isDoc = (curUser.role_name && curUser.role_name.toLowerCase() === 'doctor') || Boolean(curUser.doctor_id);
        if (!isDoc && (n.Notification_Type === "Order_Requested" || curUser.station_id)) {
            window.location.href = `department_orders.html?station_id=${n.Target_Station_ID || curUser.station_id || ''}&request_id=${n.Request_ID || ''}`;
        } else {
            window.location.href = `admission_details.html?id=${n.Admission_ID}&sub=sub-orders`;
        }
    });

    const onDisableToasts = () => {
        showPopupConfirm("Disable notification toast popups for this device?\n\nReal-time alerts will continue to be recorded in your notifications center and Department Orders Queue.", () => {
            localStorage.setItem("clinical_toasts_disabled", "true");
            const allToasts = document.querySelectorAll(".clinical-toast-card");
            allToasts.forEach(t => t.remove());
            updateToastToggleButton();
        }, null, {
            title: "Disable Notification Toasts",
            confirmText: "Disable Toasts",
            cancelText: "Keep Enabled",
            type: "warning"
        });
    };

    const disableBtn = toast.querySelector(".btn-toast-disable");
    if (disableBtn) {
        disableBtn.addEventListener("click", onDisableToasts);
    }

    container.appendChild(toast);
    playClinicalChime();

    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add("toast-fade-out");
            setTimeout(() => toast.remove(), 400);
        }
    }, 10000);
};

const fetchRealtimeNotifications = () => {
    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    if (!user || !user.role_id) return;

    const userStationId = user.station_id || user.Station_ID || user.doctor_station_id || 0;
    const assignedStationIds = user.assigned_station_ids || (userStationId ? [userStationId] : []);

    axios.get("../api/GET/clinical_orders.php", {
        params: {
            operation: "getNotifications",
            json: JSON.stringify({
                user_id: user.user_id || user.User_ID || 0,
                role_id: user.role_id || 0,
                station_id: userStationId,
                station_ids: assignedStationIds
            })
        }
    }).then(res => {
        const data = res.data || {};
        const unreadCount = parseInt(data.unread_count || 0, 10);
        const badge = document.getElementById("clinical-notif-badge");
        const tabBadge = document.getElementById("notif-tab-badge");
        const btnSidebarNotif = document.getElementById("btn-sidebar-notif");

        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? "inline-block" : "none";
        }
        if (tabBadge) {
            tabBadge.textContent = unreadCount;
        }
        if (btnSidebarNotif) {
            btnSidebarNotif.classList.toggle("sidebar-notif-pulse", unreadCount > 0);
        }

        if (data.notifications && data.notifications.length > 0) {
            if (lastKnownNotifCount === -1) {
                lastKnownNotifCount = unreadCount;
                sessionStorage.setItem("hospital_last_notif_count", unreadCount.toString());
                data.notifications.forEach(n => {
                    if (parseInt(n.Is_Read, 10) === 0) {
                        addShownToastId(parseInt(n.Notification_ID, 10));
                    }
                });
            } else if (unreadCount > lastKnownNotifCount) {
                const newUnread = data.notifications.filter(n => parseInt(n.Is_Read, 10) === 0 && !getShownToastIds().has(parseInt(n.Notification_ID, 10)));
                if (newUnread.length > 0) {
                    showClinicalToastAlert(newUnread[0]);
                }
                lastKnownNotifCount = unreadCount;
                sessionStorage.setItem("hospital_last_notif_count", unreadCount.toString());
            } else {
                lastKnownNotifCount = unreadCount;
                sessionStorage.setItem("hospital_last_notif_count", unreadCount.toString());
            }
        } else {
            lastKnownNotifCount = unreadCount;
            sessionStorage.setItem("hospital_last_notif_count", unreadCount.toString());
        }

        const listContainer = document.getElementById("notif-alerts-list");
        if (listContainer && data.notifications) {
            if (data.notifications.length === 0) {
                listContainer.innerHTML = '<p class="text-muted">No clinical alerts recorded yet.</p>';
                return;
            }
            let html = "";
            data.notifications.forEach(n => {
                const unreadClass = (parseInt(n.Is_Read, 10) === 0) ? "unread" : "";
                let typeBadge = '<span class="badge badge-info">Alert</span>';
                if (n.Notification_Type === "Order_Requested") typeBadge = '<span class="badge-process badge-process-requested">Order Requested</span>';
                else if (n.Notification_Type === "Order_Preparing") typeBadge = '<span class="badge-process badge-process-preparing">Preparing</span>';
                else if (n.Notification_Type === "Order_Prepared") typeBadge = '<span class="badge-process badge-process-prepared">Prepared (Ready)</span>';
                else if (n.Notification_Type === "Order_Delivering") typeBadge = '<span class="badge-process badge-process-delivering">Out for Delivery</span>';
                else if (n.Notification_Type === "Order_Administered") typeBadge = '<span class="badge-process badge-process-administered">Administered</span>';

                const notifUser = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
                const notifIsDoc = (notifUser.role_name && notifUser.role_name.toLowerCase() === 'doctor') || Boolean(notifUser.doctor_id);
                let notifLink = `admission_details.html?id=${n.Admission_ID}&sub=sub-orders`;
                let notifBtnLabel = "View in Chart";
                if (!notifIsDoc && (n.Notification_Type === "Order_Requested" || notifUser.station_id)) {
                    notifLink = `department_orders.html?station_id=${n.Target_Station_ID || notifUser.station_id || ''}&request_id=${n.Request_ID || ''}`;
                    notifBtnLabel = "Open Dept Queue";
                }

                html += `
                    <div class="notif-item-card ${unreadClass}" data-notif-id="${n.Notification_ID}">
                        <div class="notif-item-header">
                            <div class="notif-item-title">${n.Title}</div>
                            <div class="notif-item-time">${n.Formatted_Date} ${n.Formatted_Time}</div>
                        </div>
                        <div class="notif-item-msg">${n.Message}</div>
                        <div class="notif-item-footer">
                            <div>${typeBadge} • <span class="table-sub-text">Patient: <strong>${n.Patient_Name} (${n.Patient_Code})</strong></span></div>
                            <a href="${notifLink}" class="btn btn-sm btn-outline">${notifBtnLabel}</a>
                        </div>
                    </div>
                `;
            });
            listContainer.innerHTML = html;
        }
    }).catch(() => {});
};

const setupQueueStationSelect = (user) => {
    const select = document.getElementById("notif-queue-station-select");
    const label = document.getElementById("notif-queue-station-label");
    if (!select) return;

    const isHigherUp = parseInt(user.is_higher_up, 10) === 1 || parseInt(user.role_id, 10) === 1;

    if (isHigherUp) {
        if (label) label.textContent = "Filter Department Queue:";
        select.disabled = false;
        if (!select.dataset.loadedHigherUp) {
            axios.get("../api/GET/departments.php", {
                params: { operation: "getActiveDepartments" }
            }).then(res => {
                const depts = res.data || [];
                let html = '<option value="0">All Hospital Stations</option>';
                depts.forEach(d => {
                    const prefix = d.Code_Prefix ? ` (${d.Code_Prefix})` : '';
                    html += `<option value="${d.Station_ID}">${d.Station_Name}${prefix}</option>`;
                });
                select.innerHTML = html;
                select.dataset.loadedHigherUp = "true";
                if (select.dataset.pendingValue) {
                    select.value = select.dataset.pendingValue;
                    delete select.dataset.pendingValue;
                }
            }).catch(() => {
                select.innerHTML = `
                    <option value="0">All Hospital Stations</option>
                    <option value="1">Central Pharmacy (PHARM)</option>
                    <option value="2">Radiology &amp; Imaging (RAD)</option>
                    <option value="3">Cardiology Station (CARD)</option>
                    <option value="4">Laboratory (LAB)</option>
                    <option value="5">Nurse Station (NRS)</option>
                    <option value="9">Emergency Department (ER)</option>
                `;
            });
        }
        return;
    }

    const assigned = Array.isArray(user.assigned_stations) ? user.assigned_stations : [];
    if (assigned.length === 0 && user.station_id) {
        assigned.push({
            Station_ID: parseInt(user.station_id, 10),
            Station_Name: user.station_name || "Assigned Station",
            Code_Prefix: ""
        });
    }

    if (assigned.length === 0) {
        if (label) label.textContent = "Department Queue:";
        select.innerHTML = '<option value="0">No Department Assigned</option>';
        select.disabled = true;
        return;
    }

    if (assigned.length === 1) {
        const st = assigned[0];
        const prefix = st.Code_Prefix ? ` (${st.Code_Prefix})` : '';
        if (label) label.textContent = "Assigned Department Queue:";
        select.innerHTML = `<option value="${st.Station_ID}">${st.Station_Name}${prefix}</option>`;
        select.disabled = true;
        select.value = String(st.Station_ID);
        return;
    }

    if (label) label.textContent = "My Department Queues:";
    select.disabled = false;
    let html = '<option value="0">All My Assigned Departments</option>';
    assigned.forEach(st => {
        const prefix = st.Code_Prefix ? ` (${st.Code_Prefix})` : '';
        html += `<option value="${st.Station_ID}">${st.Station_Name}${prefix}</option>`;
    });
    select.innerHTML = html;
};

let deptCachedOrders = [];
let deptOrderSearchQuery = '';
let deptOrderProcessFilter = 'all';
let deptOrderSortBy = 'stage';

const getDeptOrderProcessStage = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'requested' || s === 'pending') return 'requested';
    if (s === 'preparing') return 'preparing';
    if (s === 'prepared') return 'prepared';
    if (s === 'delivering' || s === 'in transit') return 'delivering';
    if (s === 'administered') return 'administered';
    if (s === 'cancelled') return 'cancelled';
    return 'requested';
};

const handleDeptOrderSearch = (val) => {
    deptOrderSearchQuery = (val || '').toLowerCase().trim();
    renderFilteredDeptOrders();
};

const handleDeptOrderProcessFilter = (stage) => {
    deptOrderProcessFilter = stage;
    const filterBtns = document.querySelectorAll('.dept-process-filter-btn');
    filterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.process === stage);
    });
    renderFilteredDeptOrders();
};

const handleDeptOrderSort = (val) => {
    deptOrderSortBy = val;
    renderFilteredDeptOrders();
};

const renderDeptTrackingStepper = (o) => {
    const isScan = (o.Category_Type === 'Equipment Scan' || o.Category_Type === 'Service');
    const stage = getDeptOrderProcessStage(o.Status);

    const step1Title = 'Requested';
    const step2Title = isScan ? 'Preparing Equipment' : 'Preparing';
    const step3Title = isScan ? 'Equipment Ready' : 'Prepared';
    const step4Title = isScan ? 'Escorting Patient' : 'Delivering';
    const step5Title = isScan ? 'Scan Completed' : 'Administered';

    let s1State = 'is-complete';
    let s2State = '';
    let s3State = '';
    let s4State = '';
    let s5State = '';

    if (stage === 'requested') {
        s1State = 'is-active step-requested';
    } else if (stage === 'preparing') {
        s1State = 'is-complete';
        s2State = 'is-active step-preparing';
    } else if (stage === 'prepared') {
        s1State = 'is-complete';
        s2State = 'is-complete';
        s3State = 'is-active step-prepared';
    } else if (stage === 'delivering') {
        s1State = 'is-complete';
        s2State = 'is-complete';
        s3State = 'is-complete';
        s4State = 'is-active step-delivering';
    } else if (stage === 'administered') {
        s1State = 'is-complete';
        s2State = 'is-complete';
        s3State = 'is-complete';
        s4State = 'is-complete';
        s5State = 'is-complete step-administered is-active';
    } else if (stage === 'cancelled') {
        return '<span class="badge badge-process badge-process-cancelled">Order Cancelled</span>';
    }

    let badgeClass = 'badge-process-requested';
    let badgeText = isScan ? 'Scan Requested' : 'Requested';
    if (stage === 'preparing') {
        badgeClass = 'badge-process-preparing';
        badgeText = isScan ? 'Preparing Equipment' : 'Department Preparing';
    } else if (stage === 'prepared') {
        badgeClass = 'badge-process-prepared';
        badgeText = isScan ? 'Equipment Ready (Nurse Dispatched)' : 'Prepared (Ready for Pickup)';
    } else if (stage === 'delivering') {
        badgeClass = 'badge-process-delivering';
        badgeText = isScan ? 'Escorting Patient to Scan' : 'Out for Delivery';
    } else if (stage === 'administered') {
        badgeClass = 'badge-process-administered';
        badgeText = isScan ? 'Scan Completed & Recorded' : 'Delivered & Administered';
    }

    let trackerMeta = '';
    if (stage === 'requested') {
        trackerMeta = `Awaiting ${o.Target_Station_Name || 'Department'} to begin prep`;
    } else if (stage === 'preparing') {
        trackerMeta = `${o.Prepared_By_Name ? o.Prepared_By_Name : 'Staff'} prepping in ${o.Target_Station_Name || 'Dept'}`;
    } else if (stage === 'prepared') {
        trackerMeta = o.Assigned_Nurse_Name ? `Assigned to Nurse: <strong>${o.Assigned_Nurse_Name}</strong>` : 'Ready for nurse pickup';
    } else if (stage === 'delivering') {
        trackerMeta = isScan ? `Nurse ${o.Assigned_Nurse_Name || ''} escorting patient to ${o.Target_Station_Name || 'Station'}` : `Nurse ${o.Assigned_Nurse_Name || ''} in transit to patient`;
    } else if (stage === 'administered') {
        trackerMeta = `Administered by: <strong>${o.Administered_By_Name || 'Nurse'}</strong>`;
    }

    return `
        <div class="order-tracking-cell">
            <div><span class="badge-process ${badgeClass}">${badgeText}</span></div>
            <div class="tracking-stepper">
                <div class="tracking-step ${s1State}">
                    <div class="tracking-node" title="Doctor Order Placed">1</div>
                    <div class="tracking-label">${step1Title}</div>
                </div>
                <div class="tracking-step ${s2State}">
                    <div class="tracking-node" title="Department Prepares Item / Scan Room">2</div>
                    <div class="tracking-label">${step2Title}</div>
                </div>
                <div class="tracking-step ${s3State}">
                    <div class="tracking-node" title="Ready / Active Nurse Assigned">3</div>
                    <div class="tracking-label">${step3Title}</div>
                </div>
                <div class="tracking-step ${s4State}">
                    <div class="tracking-node" title="Nurse Picked Up / Patient In Transit">4</div>
                    <div class="tracking-label">${step4Title}</div>
                </div>
                <div class="tracking-step ${s5State}">
                    <div class="tracking-node" title="Delivered & Administered">5</div>
                    <div class="tracking-label">${step5Title}</div>
                </div>
            </div>
            <div class="tracking-meta-desc">${trackerMeta}</div>
        </div>
    `;
};

const renderFilteredDeptOrders = () => {
    const container = document.getElementById("notif-queue-table-div");
    if (!container) return;

    const totalCount = deptCachedOrders.length;
    const reqCount = deptCachedOrders.filter(o => getDeptOrderProcessStage(o.Status) === 'requested').length;
    const prepCount = deptCachedOrders.filter(o => getDeptOrderProcessStage(o.Status) === 'preparing').length;
    const readyCount = deptCachedOrders.filter(o => getDeptOrderProcessStage(o.Status) === 'prepared').length;
    const delivCount = deptCachedOrders.filter(o => getDeptOrderProcessStage(o.Status) === 'delivering').length;
    const admCount = deptCachedOrders.filter(o => getDeptOrderProcessStage(o.Status) === 'administered').length;

    let filtered = [...deptCachedOrders];

    if (deptOrderProcessFilter !== 'all') {
        filtered = filtered.filter(o => getDeptOrderProcessStage(o.Status) === deptOrderProcessFilter);
    }

    if (deptOrderSearchQuery) {
        filtered = filtered.filter(o => {
            const pat = (o.Patient_Name || '').toLowerCase();
            const patCode = (o.Patient_Code || '').toLowerCase();
            const admCode = (o.Admission_Code || '').toLowerCase();
            const bed = (o.Bed_Code || '').toLowerCase();
            const room = (o.Room_Name || '').toLowerCase();
            const item = (o.Item_Name || '').toLowerCase();
            const code = (o.Item_Code || '').toLowerCase();
            const doc = (o.Doctor_Name || '').toLowerCase();
            const nurse = (o.Assigned_Nurse_Name || '').toLowerCase();
            const prep = (o.Prepared_By_Name || '').toLowerCase();
            const idStr = `ord-${o.Request_ID}`.toLowerCase();
            return pat.includes(deptOrderSearchQuery) ||
                   patCode.includes(deptOrderSearchQuery) ||
                   admCode.includes(deptOrderSearchQuery) ||
                   bed.includes(deptOrderSearchQuery) ||
                   room.includes(deptOrderSearchQuery) ||
                   item.includes(deptOrderSearchQuery) ||
                   code.includes(deptOrderSearchQuery) ||
                   doc.includes(deptOrderSearchQuery) ||
                   nurse.includes(deptOrderSearchQuery) ||
                   prep.includes(deptOrderSearchQuery) ||
                   idStr.includes(deptOrderSearchQuery);
        });
    }

    const stageWeights = {
        'requested': 1,
        'preparing': 2,
        'prepared': 3,
        'delivering': 4,
        'administered': 5,
        'cancelled': 6
    };

    filtered.sort((a, b) => {
        if (deptOrderSortBy === 'stage') {
            const wa = stageWeights[getDeptOrderProcessStage(a.Status)] || 9;
            const wb = stageWeights[getDeptOrderProcessStage(b.Status)] || 9;
            if (wa !== wb) return wa - wb;
            return b.Request_ID - a.Request_ID;
        } else if (deptOrderSortBy === 'newest') {
            return b.Request_ID - a.Request_ID;
        } else if (deptOrderSortBy === 'oldest') {
            return a.Request_ID - b.Request_ID;
        } else if (deptOrderSortBy === 'patient_asc') {
            return (a.Patient_Name || '').localeCompare(b.Patient_Name || '');
        }
        return b.Request_ID - a.Request_ID;
    });

    let controlsHtml = `
        <div class="orders-filter-container">
            <div class="orders-filter-left">
                <div class="orders-search-box">
                    <span class="orders-search-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </span>
                    <input type="text" class="orders-search-input" placeholder="Search patient name, PAT-###, bed, item, doctor..." value="${deptOrderSearchQuery}" oninput="handleDeptOrderSearch(this.value)" autocomplete="off">
                </div>
                <div class="orders-filter-pills">
                    <button type="button" class="process-filter-btn dept-process-filter-btn ${deptOrderProcessFilter === 'all' ? 'active' : ''}" data-process="all" onclick="handleDeptOrderProcessFilter('all')">
                        <span class="process-filter-dot dot-all"></span>All <span class="process-filter-count">${totalCount}</span>
                    </button>
                    <button type="button" class="process-filter-btn dept-process-filter-btn ${deptOrderProcessFilter === 'requested' ? 'active' : ''}" data-process="requested" onclick="handleDeptOrderProcessFilter('requested')">
                        <span class="process-filter-dot dot-requested"></span>Requesting <span class="process-filter-count">${reqCount}</span>
                    </button>
                    <button type="button" class="process-filter-btn dept-process-filter-btn ${deptOrderProcessFilter === 'preparing' ? 'active' : ''}" data-process="preparing" onclick="handleDeptOrderProcessFilter('preparing')">
                        <span class="process-filter-dot dot-preparing"></span>Preparing <span class="process-filter-count">${prepCount}</span>
                    </button>
                    <button type="button" class="process-filter-btn dept-process-filter-btn ${deptOrderProcessFilter === 'prepared' ? 'active' : ''}" data-process="prepared" onclick="handleDeptOrderProcessFilter('prepared')">
                        <span class="process-filter-dot dot-prepared"></span>Prepared <span class="process-filter-count">${readyCount}</span>
                    </button>
                    <button type="button" class="process-filter-btn dept-process-filter-btn ${deptOrderProcessFilter === 'delivering' ? 'active' : ''}" data-process="delivering" onclick="handleDeptOrderProcessFilter('delivering')">
                        <span class="process-filter-dot dot-delivering"></span>Delivering <span class="process-filter-count">${delivCount}</span>
                    </button>
                    <button type="button" class="process-filter-btn dept-process-filter-btn ${deptOrderProcessFilter === 'administered' ? 'active' : ''}" data-process="administered" onclick="handleDeptOrderProcessFilter('administered')">
                        <span class="process-filter-dot dot-administered"></span>Administered <span class="process-filter-count">${admCount}</span>
                    </button>
                </div>
            </div>
            <div class="orders-filter-right">
                <label for="dept_orders_sort_select" class="form-label font-bold" style="font-size: 11.5px; margin: 0; display: inline-block;">Sort:</label>
                <select id="dept_orders_sort_select" class="orders-sort-select" onchange="handleDeptOrderSort(this.value)">
                    <option value="stage" ${deptOrderSortBy === 'stage' ? 'selected' : ''}>Active Stages First</option>
                    <option value="newest" ${deptOrderSortBy === 'newest' ? 'selected' : ''}>Newest First</option>
                    <option value="oldest" ${deptOrderSortBy === 'oldest' ? 'selected' : ''}>Oldest First</option>
                    <option value="patient_asc" ${deptOrderSortBy === 'patient_asc' ? 'selected' : ''}>Patient Name (A-Z)</option>
                </select>
            </div>
        </div>
    `;

    const controlsContainer = document.getElementById("notif-queue-controls-container");
    if (controlsContainer) {
        controlsContainer.innerHTML = controlsHtml;
    }

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-center text-muted" style="padding: 28px;"><em>No department orders match the selected search or filter criteria.</em></p>';
        return;
    }

    let html = '<table class="data-table"><thead><tr>';
    html += '<th>Order &amp; Patient</th>';
    html += '<th>Prescribed Item &amp; Doctor</th>';
    html += '<th>Fulfillment &amp; Delivery Tracking</th>';
    html += '<th class="text-center">Lifecycle Action</th>';
    html += '</tr></thead><tbody>';

    filtered.forEach(o => {
        const isScan = (o.Category_Type === 'Equipment Scan' || o.Category_Type === 'Service');
        const stage = getDeptOrderProcessStage(o.Status);

        let actionBtn = `<a href="admission_details.html?id=${o.Admission_ID}&sub=sub-orders" class="btn btn-sm btn-outline">Open Chart</a>`;

        if (stage === 'requested') {
            actionBtn = `<button type="button" class="btn btn-sm btn-primary" onclick="startPreparingOrderGlobal(${o.Request_ID})">Start Preparing</button>`;
        } else if (stage === 'preparing') {
            const btnPrepText = isScan ? 'Scan Room Ready &amp; Assign Nurse' : 'Mark Prepared &amp; Assign Nurse';
            actionBtn = `<button type="button" class="btn btn-sm btn-info" onclick="openSelectNurseModalGlobal(${o.Request_ID})">${btnPrepText}</button>`;
        } else if (stage === 'prepared') {
            const btnDeliverText = isScan ? 'Transport Patient' : 'Pick Up &amp; Deliver';
            actionBtn = `<button type="button" class="btn btn-sm btn-primary" onclick="receiveOrderForDeliveryGlobal(${o.Request_ID})">${btnDeliverText}</button>`;
        } else if (stage === 'delivering') {
            const btnAdminText = isScan ? 'Complete Scan' : 'Administer Order';
            actionBtn = `<a href="admission_details.html?id=${o.Admission_ID}&sub=sub-orders" class="btn btn-sm btn-success">${btnAdminText}</a>`;
        } else if (stage === 'administered') {
            actionBtn = '<span class="badge badge-success">Completed</span>';
        }

        const dosageText = o.Dosage_Instructions ? `<div class="table-sub-text-dark">Instructions: <em>${o.Dosage_Instructions}</em></div>` : '';

        html += `<tr>`;
        html += `<td>
                    <span class="table-primary-text font-bold text-primary">ORD-${String(o.Request_ID).padStart(3, '0')}</span>
                    <div class="table-sub-text"><strong>${o.Patient_Name}</strong> (${o.Patient_Code})</div>
                    <div class="table-sub-text">${o.Room_Name || 'Ward'} - ${o.Bed_Code || 'Bed'} • ${o.Admission_Code}</div>
                 </td>`;
        html += `<td>
                    <div class="table-primary-text"><strong>${o.Item_Code}</strong>: ${o.Item_Name}</div>
                    <div class="table-sub-text">${parseFloat(o.Quantity)} unit • Prescribed by: ${o.Doctor_Name}</div>
                    ${dosageText}
                 </td>`;
        html += `<td>${renderDeptTrackingStepper(o)}</td>`;
        html += `<td class="text-center">${actionBtn}</td>`;
        html += `</tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
};

const fetchDepartmentOrdersQueue = (customStationId = null) => {
    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    const container = document.getElementById("notif-queue-table-div");
    if (!container) return;

    setupQueueStationSelect(user);

    const isHigherUp = parseInt(user.is_higher_up, 10) === 1 || parseInt(user.role_id, 10) === 1;
    const assigned = Array.isArray(user.assigned_stations) ? user.assigned_stations : [];
    const assignedStationIds = (user.assigned_station_ids || (user.station_id ? [user.station_id] : (assigned.map(a => a.Station_ID)))).map(id => parseInt(id, 10)).filter(id => id > 0);

    if (!isHigherUp && assignedStationIds.length === 0) {
        container.innerHTML = '<p class="text-muted">You are not currently assigned to any clinical station. Please contact your administrator for department assignment.</p>';
        return;
    }

    const stationSelect = document.getElementById("notif-queue-station-select");
    let targetStation = 0;
    if (customStationId !== null) {
        targetStation = customStationId;
    } else if (stationSelect && stationSelect.value !== "" && stationSelect.dataset.userChanged === "true") {
        targetStation = parseInt(stationSelect.value, 10);
    } else if (!isHigherUp && assignedStationIds.length === 1) {
        targetStation = parseInt(assignedStationIds[0], 10);
    } else {
        targetStation = 0;
    }

    if (stationSelect && customStationId === null && targetStation > 0 && stationSelect.dataset.userChanged !== "true") {
        if (stationSelect.dataset.loadedHigherUp || !isHigherUp) {
            stationSelect.value = String(targetStation);
        } else {
            stationSelect.dataset.pendingValue = String(targetStation);
        }
    }

    axios.get("../api/GET/clinical_orders.php", {
        params: {
            operation: "getDepartmentOrders",
            json: JSON.stringify({
                station_id: targetStation,
                station_ids: assignedStationIds,
                user_id: user.user_id || user.User_ID || 0,
                role_id: user.role_id || 0
            })
        }
    }).then(res => {
        deptCachedOrders = res.data || [];
        renderFilteredDeptOrders();
    }).catch(() => {
        container.innerHTML = '<p class="text-danger">Failed to load department orders queue.</p>';
    });
};

const startPreparingOrderGlobal = (requestId) => {
    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    showPopupConfirm("Start preparing this requested item in department?\n\nThe ordering physician will receive a real-time notification that item preparation is underway.", () => {
        const fd = new FormData();
        fd.append("operation", "startPreparingOrder");
        fd.append("json", JSON.stringify({
            request_id: requestId,
            user_id: user.user_id || user.User_ID
        }));
        axios.post("../api/POST/clinical_orders.php", fd).then(res => {
            if (res.data.success) {
                alert(res.data.message);
                fetchDepartmentOrdersQueue();
                fetchRealtimeNotifications();
            } else {
                alert(res.data.error || "Failed to start preparing order.");
            }
        });
    }, null, {
        title: "Confirm Preparation",
        confirmText: "Start Preparing",
        type: "info"
    });
};

const openSelectNurseModalGlobal = (requestId) => {
    const order = (deptCachedOrders || []).find(x => String(x.Request_ID) === String(requestId));
    const isScan = order && (order.Category_Type === 'Equipment Scan' || order.Category_Type === 'Service');

    let modal = document.getElementById("selectNurseModalGlobal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "selectNurseModalGlobal";
        modal.className = "modal-overlay";
        modal.innerHTML = `
            <div class="modal-container nurse-modal-container">
                <div class="modal-header">
                    <div>
                        <h3 id="select_nurse_global_title">Assign Active Nurse &amp; Dispatch Alert</h3>
                        <div class="table-sub-text" id="select_nurse_global_subtitle">Select an active nurse to alert for collection and delivery</div>
                    </div>
                    <button type="button" class="modal-close" id="btnCloseNurseGlobal" aria-label="Close modal">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="select_nurse_global_request_id">
                    <div class="nurse-assign-summary-box mb-3" id="nurse_assign_global_summary">
                        <div class="summary-item-title font-bold" id="nurse_global_item_name">Item Name</div>
                        <div class="summary-item-meta text-muted" id="nurse_global_patient_info">Patient &amp; Location</div>
                    </div>
                    <div class="form-group mb-3">
                        <label class="form-label font-bold" for="select_nurse_global_dropdown">Choose Active Nurse *</label>
                        <select id="select_nurse_global_dropdown" class="form-control" required>
                            <option value="">Loading active nurses...</option>
                        </select>
                        <div class="table-sub-text mt-1" id="select_nurse_global_help">The chosen nurse will receive an instant real-time alert to pick up this item at the department.</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="btnCancelNurseGlobal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="btnConfirmNurseGlobal">Alert Selected Nurse &amp; Mark Prepared</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById("btnCloseNurseGlobal").addEventListener("click", () => closeModal("selectNurseModalGlobal"));
        document.getElementById("btnCancelNurseGlobal").addEventListener("click", () => closeModal("selectNurseModalGlobal"));
    }

    document.getElementById("select_nurse_global_request_id").value = requestId;
    const titleEl = document.getElementById("select_nurse_global_title");
    const subtitleEl = document.getElementById("select_nurse_global_subtitle");
    const helpEl = document.getElementById("select_nurse_global_help");
    const confirmBtn = document.getElementById("btnConfirmNurseGlobal");
    const itemNameEl = document.getElementById("nurse_global_item_name");
    const patInfoEl = document.getElementById("nurse_global_patient_info");
    const dropdown = document.getElementById("select_nurse_global_dropdown");

    if (itemNameEl) itemNameEl.textContent = order ? `[${o.Item_Code || 'ORD'}] ${order.Item_Name} (${parseFloat(order.Quantity)} unit)` : '-';
    if (patInfoEl) patInfoEl.textContent = order ? `Patient: ${order.Patient_Name} (${order.Patient_Code}) • ${order.Room_Name} - ${order.Bed_Code}` : '-';

    if (isScan) {
        if (titleEl) titleEl.textContent = "Scan Room Ready — Assign Nurse for Transport";
        if (subtitleEl) subtitleEl.textContent = "Select an active nurse to alert for escorting the patient to the scan room";
        if (helpEl) helpEl.textContent = "The selected nurse will receive an instant real-time alert to escort the patient to the scan room.";
        if (confirmBtn) confirmBtn.textContent = "Alert Nurse & Mark Room Ready";
    } else {
        if (titleEl) titleEl.textContent = "Assign Active Nurse & Dispatch Alert";
        if (subtitleEl) subtitleEl.textContent = "Select an active nurse to alert for medication collection and bedside delivery";
        if (helpEl) helpEl.textContent = "The chosen nurse will receive an instant real-time alert to pick up this item at the department.";
        if (confirmBtn) confirmBtn.textContent = "Alert Selected Nurse & Mark Prepared";
    }

    dropdown.innerHTML = '<option value="">Loading active nurses...</option>';
    axios.get("../api/GET/clinical_orders.php?operation=getActiveNurses").then(res => {
        const nurses = res.data || [];
        if (nurses.length === 0) {
            dropdown.innerHTML = '<option value="">No active nurses found</option>';
            return;
        }
        let optHtml = '<option value="">-- Select Active Nurse --</option>';
        nurses.forEach(n => {
            optHtml += `<option value="${n.id}">Nurse ${n.name} (${n.role_title} • ${n.station_name})</option>`;
        });
        dropdown.innerHTML = optHtml;
    });

    confirmBtn.onclick = () => {
        const nurseId = dropdown.value;
        if (!nurseId) {
            alert("Please select an active nurse from the dropdown.");
            return;
        }
        const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
        const fd = new FormData();
        fd.append("operation", "markOrderPrepared");
        fd.append("json", JSON.stringify({
            request_id: requestId,
            user_id: user.user_id || user.User_ID,
            nurse_user_id: parseInt(nurseId, 10)
        }));

        axios.post("../api/POST/clinical_orders.php", fd).then(r => {
            if (r.data.success) {
                closeModal("selectNurseModalGlobal");
                alert(r.data.message);
                fetchDepartmentOrdersQueue();
                fetchRealtimeNotifications();
            } else {
                alert(r.data.error || "Failed to mark order prepared.");
            }
        });
    };

    openModal("selectNurseModalGlobal");
};

const receiveOrderForDeliveryGlobal = (requestId) => {
    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    const order = (deptCachedOrders || []).find(x => String(x.Request_ID) === String(requestId));
    const isScan = order && (order.Category_Type === 'Equipment Scan' || order.Category_Type === 'Service');

    const promptText = isScan
        ? "Confirm patient escort/transport to scan room?\n\nThe ordering doctor will receive an alert that the patient is in transit to the scan room."
        : "Confirm receiving prepared medication from department?\n\nThe ordering doctor will receive an alert that the item was received and is now being delivered to the patient.";

    showPopupConfirm(promptText, () => {
        const formData = new FormData();
        formData.append("operation", "receiveOrderForDelivery");
        formData.append("json", JSON.stringify({
            request_id: requestId,
            user_id: user.user_id || user.User_ID
        }));

        axios.post("../api/POST/clinical_orders.php", formData).then(res => {
            if (res.data.success) {
                alert(res.data.message);
                fetchDepartmentOrdersQueue();
                fetchRealtimeNotifications();
            } else {
                alert(res.data.error || "Failed to update delivery status.");
            }
        });
    }, null, {
        title: isScan ? "Confirm Patient Transport" : "Confirm Item Pickup",
        confirmText: isScan ? "Start Transport" : "Pick Up & Deliver",
        type: "info"
    });
};

window.prepareDepartmentOrderDirect = startPreparingOrderGlobal;
window.startPreparingOrderGlobal = startPreparingOrderGlobal;
window.openSelectNurseModalGlobal = openSelectNurseModalGlobal;
window.receiveOrderForDeliveryGlobal = receiveOrderForDeliveryGlobal;
window.handleDeptOrderSearch = handleDeptOrderSearch;
window.handleDeptOrderProcessFilter = handleDeptOrderProcessFilter;
window.handleDeptOrderSort = handleDeptOrderSort;
window.fetchRealtimeNotifications = fetchRealtimeNotifications;
window.fetchDepartmentOrdersQueue = fetchDepartmentOrdersQueue;
window.setupQueueStationSelect = setupQueueStationSelect;
window.updateToastToggleButton = updateToastToggleButton;

const initClinicalNotificationsSystem = () => {
    ensureClinicalNotificationsModal();
    const btnSidebarNotif = document.getElementById("btn-sidebar-notif");
    if (btnSidebarNotif && !btnSidebarNotif.dataset.wired) {
        btnSidebarNotif.dataset.wired = "true";
        btnSidebarNotif.addEventListener("click", () => {
            openModal("clinicalNotifModal");
            updateToastToggleButton();
            fetchRealtimeNotifications();
        });
    }
    fetchRealtimeNotifications();
    setInterval(fetchRealtimeNotifications, 15000);
};

window.initClinicalNotificationsSystem = initClinicalNotificationsSystem;
