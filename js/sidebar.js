const getUserInitials = (fullName, username) => {
    const raw = (fullName || username || "U").trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return raw.substring(0, 2).toUpperCase();
};

const getRoleBadgeConfig = (roleName, domain) => {
    const r = (roleName || "").toLowerCase();
    const d = (domain || "").toLowerCase();
    if (r.includes("admin") || d === "admin") {
        return { label: roleName || "Admin", badgeClass: "sidebar-role-admin" };
    }
    if (r.includes("nurse") || d === "clinical") {
        return { label: roleName || "Clinical", badgeClass: "sidebar-role-clinical" };
    }
    if (r.includes("finance") || d === "finance") {
        return { label: roleName || "Finance", badgeClass: "sidebar-role-finance" };
    }
    if (r.includes("hybrid") || r.includes("clerk") || d === "hybrid") {
        return { label: roleName || "Ward Clerk", badgeClass: "sidebar-role-hybrid" };
    }
    return { label: roleName || "Staff Member", badgeClass: "sidebar-role-default" };
};

const initSidebarUserMenu = () => {
    const btnMenu = document.getElementById("btn-user-menu");
    const menu = document.getElementById("sidebar-user-menu");
    const cardToggle = document.getElementById("btn-user-card-toggle");
    if (!menu) return;

    const closeUserMenu = () => {
        menu.style.display = "none";
        if (btnMenu) {
            btnMenu.classList.remove("active");
            btnMenu.setAttribute("aria-expanded", "false");
        }
        if (cardToggle) {
            cardToggle.classList.remove("active");
            cardToggle.setAttribute("aria-expanded", "false");
        }
    };

    const toggleUserMenu = (e) => {
        e.stopPropagation();
        const isOpen = menu.style.display === "flex" || menu.style.display === "block";
        if (isOpen) {
            closeUserMenu();
        } else {
            menu.style.display = "flex";
            if (btnMenu) {
                btnMenu.classList.add("active");
                btnMenu.setAttribute("aria-expanded", "true");
            }
            if (cardToggle) {
                cardToggle.classList.add("active");
                cardToggle.setAttribute("aria-expanded", "true");
            }
        }
    };

    if (btnMenu && !btnMenu.dataset.wired) {
        btnMenu.dataset.wired = "true";
        btnMenu.addEventListener("click", toggleUserMenu);
    }

    if (cardToggle && !cardToggle.dataset.wired) {
        cardToggle.dataset.wired = "true";
        cardToggle.addEventListener("click", toggleUserMenu);
    }

    if (!document.body.dataset.userMenuGlobalWired) {
        document.body.dataset.userMenuGlobalWired = "true";
        document.addEventListener("click", (e) => {
            const openMenu = document.getElementById("sidebar-user-menu");
            const openBtn = document.getElementById("btn-user-menu");
            const openCard = document.getElementById("btn-user-card-toggle");
            if (openMenu && !e.target.closest(".sidebar-user")) {
                openMenu.style.display = "none";
                if (openBtn) {
                    openBtn.classList.remove("active");
                    openBtn.setAttribute("aria-expanded", "false");
                }
                if (openCard) {
                    openCard.classList.remove("active");
                    openCard.setAttribute("aria-expanded", "false");
                }
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                const openMenu = document.getElementById("sidebar-user-menu");
                const openBtn = document.getElementById("btn-user-menu");
                const openCard = document.getElementById("btn-user-card-toggle");
                if (openMenu && (openMenu.style.display === "flex" || openMenu.style.display === "block")) {
                    openMenu.style.display = "none";
                    if (openBtn) {
                        openBtn.classList.remove("active");
                        openBtn.setAttribute("aria-expanded", "false");
                    }
                    if (openCard) {
                        openCard.classList.remove("active");
                        openCard.setAttribute("aria-expanded", "false");
                    }
                }
            }
        });
    }

    if (!menu.dataset.closeWired) {
        menu.dataset.closeWired = "true";
        menu.addEventListener("click", () => {
            closeUserMenu();
        });
    }

    const btnRoleGuide = document.getElementById("btn-user-role-guide");
    if (btnRoleGuide && !btnRoleGuide.dataset.wired) {
        btnRoleGuide.dataset.wired = "true";
        btnRoleGuide.addEventListener("click", () => {
            closeUserMenu();
            if (typeof openUserRoleGuideModal === "function") {
                openUserRoleGuideModal();
            }
        });
    }

    const btnChangePass = document.getElementById("btn-self-change-pass");
    if (btnChangePass && !btnChangePass.dataset.wired) {
        btnChangePass.dataset.wired = "true";
        btnChangePass.addEventListener("click", () => {
            closeUserMenu();
            if (typeof openSelfChangePasswordModal === "function") {
                openSelfChangePasswordModal();
            }
        });
    }

    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout && !btnLogout.dataset.wired) {
        btnLogout.dataset.wired = "true";
        btnLogout.addEventListener("click", () => {
            closeUserMenu();
            if (typeof showPopupConfirm === "function") {
                showPopupConfirm("Are you sure you want to log out of your active session?", () => {
                    if (typeof handleUserLogout === "function") {
                        handleUserLogout();
                    } else {
                        sessionStorage.removeItem("hospital_user");
                        window.location.href = "login.html";
                    }
                }, null, {
                    title: "Confirm Logout",
                    confirmText: "Logout",
                    type: "warning"
                });
            }
        });
    }
};

const renderSectionChevron = () => `
    <svg class="nav-section-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
`;

const sectionIcons = {
    overview: `<svg class="nav-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
    master_files: `<svg class="nav-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    clinical_care: `<svg class="nav-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>`,
    billing_settlement: `<svg class="nav-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`,
    reports_management: `<svg class="nav-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
    system_tools: `<svg class="nav-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
};

const getSectionStateClass = (sectionId, childPages, activePage) => {
    const isChildActive = childPages.some(page => activePage === page);
    if (isChildActive) {
        return "nav-section expanded has-active";
    }
    let saved = null;
    try {
        saved = localStorage.getItem(`hospital_nav_${sectionId}`);
    } catch (e) {}
    if (saved === "collapsed") {
        return "nav-section collapsed";
    }
    return "nav-section expanded";
};

const renderNavSection = (id, title, iconSvg, childPages, itemsHtml, activePage) => {
    const stateClass = getSectionStateClass(id, childPages, activePage);
    const isExpanded = stateClass.includes("expanded");
    const count = childPages.length;

    return `
        <div class="${stateClass}" data-section="${id}">
            <button type="button" class="nav-section-header" aria-expanded="${isExpanded ? 'true' : 'false'}" title="Toggle ${title}">
                <div class="nav-section-title-wrap">
                    ${iconSvg}
                    <span class="nav-section-label">${title}</span>
                </div>
                <div class="nav-section-meta">
                    <span class="nav-section-count">${count}</span>
                    ${renderSectionChevron()}
                </div>
            </button>
            <div class="nav-section-collapse">
                <div class="nav-section-inner">
                    <ul class="sidebar-nav">
                        ${itemsHtml}
                    </ul>
                </div>
            </div>
        </div>
    `;
};

const initSidebarSectionDropdowns = () => {
    const headers = document.querySelectorAll(".nav-section-header");
    headers.forEach((header) => {
        if (header.dataset.wired) return;
        header.dataset.wired = "true";
        header.addEventListener("click", (e) => {
            e.preventDefault();
            const section = header.closest(".nav-section");
            if (!section) return;
            const sectionId = section.dataset.section;
            const isExpanded = section.classList.contains("expanded");
            const willExpand = !isExpanded;

            if (willExpand) {
                section.classList.remove("collapsed");
                section.classList.add("expanded");
                header.setAttribute("aria-expanded", "true");
            } else {
                section.classList.remove("expanded");
                section.classList.add("collapsed");
                header.setAttribute("aria-expanded", "false");
            }

            if (sectionId) {
                try {
                    localStorage.setItem(`hospital_nav_${sectionId}`, willExpand ? "expanded" : "collapsed");
                } catch (e) {}
            }
        });
    });
};

const renderSidebar = () => {
    const sidebarEl = document.getElementById("sidebar-container") || document.querySelector("aside.sidebar");
    if (!sidebarEl) return;

    const appWrapper = sidebarEl.closest(".app-wrapper");
    if (appWrapper && !document.getElementById("btn-sidebar-open")) {
        const openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.id = "btn-sidebar-open";
        openBtn.className = "sidebar-open-btn";
        openBtn.title = "Expand Sidebar (Alt + S)";
        openBtn.setAttribute("aria-label", "Expand Sidebar");
        openBtn.textContent = "☰";
        appWrapper.insertBefore(openBtn, sidebarEl);
    }

    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const activePage = (currentPath === "admission_details.html") ? "admissions.html" : currentPath;

    const isActive = (href) => (activePage === href ? ' class="active"' : "");

    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
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

    let userPerms = user.permissions;
    if (typeof userPerms === "string") {
        try {
            userPerms = JSON.parse(userPerms);
        } catch (e) {
            userPerms = null;
        }
    }
    const hasGranularPerms = Array.isArray(userPerms);

    const canAccess = (page) => {
        if (page === "index.html") return true;
        if (hasGranularPerms) {
            return userPerms.includes(page);
        }
        if (["departments.html", "staff.html", "audit_log.html", "archive.html"].includes(page)) {
            return hasAdminAccess;
        }
        if (["admissions.html", "admission_details.html"].includes(page)) {
            return hasClinicalAccess;
        }
        if (["discounts.html", "invoices.html", "promissory_notes.html", "reports.html"].includes(page)) {
            return hasFinanceAccess;
        }
        return true;
    };

    const overviewPages = ["index.html"];
    const overviewHtml = `
        <li><a href="index.html"${isActive("index.html")}>Dashboard</a></li>
    `;

    const allMasterItems = [
        { page: "patients.html", label: "Patients Directory" },
        { page: "doctors.html", label: "Doctors & Fees" },
        { page: "departments.html", label: "Departments & Stations" },
        { page: "rooms.html", label: "Rooms & Beds" },
        { page: "catalogs.html", label: "Charge Catalogs" },
        { page: "discounts.html", label: "Billing Discounts" }
    ];
    const allowedMasterItems = allMasterItems.filter(item => canAccess(item.page));
    const masterPages = allowedMasterItems.map(item => item.page);
    const masterHtml = allowedMasterItems.map(item => `<li><a href="${item.page}"${isActive(item.page)}>${item.label}</a></li>`).join("");

    const allClinicalItems = [
        { page: "admissions.html", label: "Admissions & Beds" }
    ];
    const allowedClinicalItems = allClinicalItems.filter(item => canAccess(item.page));
    const clinicalPages = allowedClinicalItems.map(item => item.page);
    const clinicalHtml = allowedClinicalItems.map(item => `<li><a href="${item.page}"${isActive(item.page)}>${item.label}</a></li>`).join("");

    const allBillingItems = [
        { page: "invoices.html", label: "Invoices & Settlement" },
        { page: "promissory_notes.html", label: "Promissory Notes & AR" }
    ];
    const allowedBillingItems = allBillingItems.filter(item => canAccess(item.page));
    const billingPages = allowedBillingItems.map(item => item.page);
    const billingHtml = allowedBillingItems.map(item => `<li><a href="${item.page}"${isActive(item.page)}>${item.label}</a></li>`).join("");

    const allReportsItems = [
        { page: "reports.html", label: "Reports & Analytics" }
    ];
    const allowedReportsItems = allReportsItems.filter(item => canAccess(item.page));
    const reportsPages = allowedReportsItems.map(item => item.page);
    const reportsHtml = allowedReportsItems.map(item => `<li><a href="${item.page}"${isActive(item.page)}>${item.label}</a></li>`).join("");

    const allSystemItems = [
        { page: "staff.html", label: "Staff & Users" },
        { page: "audit_log.html", label: "Audit Log" },
        { page: "archive.html", label: "System Archive" }
    ];
    const allowedSystemItems = allSystemItems.filter(item => canAccess(item.page));
    const systemPages = allowedSystemItems.map(item => item.page);
    const systemHtml = allowedSystemItems.map(item => `<li><a href="${item.page}"${isActive(item.page)}>${item.label}</a></li>`).join("");

    const userFullName = user.full_name || user.username || "Staff Member";
    const userInitials = getUserInitials(user.full_name, user.username);
    const badgeInfo = getRoleBadgeConfig(user.role_name, user.access_domain);

    sidebarEl.className = "sidebar";
    sidebarEl.innerHTML = `
        <div class="sidebar-brand">
            <a href="index.html" class="sidebar-brand-link" title="InPatient - Hospital Billing & Care System">
                <div class="sidebar-brand-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2v20M2 12h20"/>
                    </svg>
                </div>
                <div class="sidebar-brand-text">
                    <h2>InPatient</h2>
                    <span class="subtitle">Billing &amp; Care</span>
                </div>
            </a>
            <button type="button" id="btn-sidebar-close" class="sidebar-close-btn" title="Collapse Sidebar (Alt + S)" aria-label="Collapse Sidebar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            </button>
        </div>

        <div class="sidebar-nav-container">
            ${renderNavSection("overview", "Overview", sectionIcons.overview, overviewPages, overviewHtml, activePage)}
            ${masterPages.length > 0 ? renderNavSection("master_files", "Master Files", sectionIcons.master_files, masterPages, masterHtml, activePage) : ""}
            ${clinicalPages.length > 0 ? renderNavSection("clinical_care", "Clinical Care", sectionIcons.clinical_care, clinicalPages, clinicalHtml, activePage) : ""}
            ${billingPages.length > 0 ? renderNavSection("billing_settlement", "Billing & Settlement", sectionIcons.billing_settlement, billingPages, billingHtml, activePage) : ""}
            ${reportsPages.length > 0 ? renderNavSection("reports_management", "Reports & Management", sectionIcons.reports_management, reportsPages, reportsHtml, activePage) : ""}
            ${systemPages.length > 0 ? renderNavSection("system_tools", "System & Tools", sectionIcons.system_tools, systemPages, systemHtml, activePage) : ""}
        </div>

        <div class="sidebar-user">
            <div class="sidebar-user-card" id="btn-user-card-toggle" title="Click to view account options">
                <div class="sidebar-user-avatar-wrap">
                    <div class="sidebar-user-avatar">${userInitials}</div>
                    <span class="sidebar-user-status-dot" title="Active Session"></span>
                </div>
                <div class="sidebar-user-details">
                    <span id="user-display" class="sidebar-user-name" title="${userFullName}">${userFullName}</span>
                    <span class="sidebar-user-role-badge ${badgeInfo.badgeClass}">${badgeInfo.label}</span>
                </div>
                <div class="sidebar-user-action">
                    <button type="button" id="btn-user-menu" class="sidebar-user-menu-btn" title="Account Options" aria-label="Account Options" aria-expanded="false">
                        <svg class="sidebar-user-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="18 15 12 9 6 15"></polyline>
                        </svg>
                    </button>
                </div>
            </div>
            <div id="sidebar-user-menu" class="sidebar-user-dropdown-menu" style="display: none;">
                <div class="sidebar-user-menu-header">
                    <strong>${userFullName}</strong>
                    <span class="sidebar-user-menu-sub">${user.username ? '@' + user.username : badgeInfo.label}</span>
                </div>
                <div class="sidebar-user-dropdown-divider"></div>
                <button type="button" id="btn-user-role-guide" class="sidebar-user-dropdown-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Role &amp; Access Guide
                </button>
                <button type="button" id="btn-self-change-pass" class="sidebar-user-dropdown-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Change Password
                </button>
                <div class="sidebar-user-dropdown-divider"></div>
                <button type="button" id="btn-logout" class="sidebar-user-dropdown-item text-danger">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Logout
                </button>
            </div>
        </div>
    `;

    initSidebarUserMenu();
    initSidebarSectionDropdowns();
};

renderSidebar();
document.addEventListener("DOMContentLoaded", renderSidebar);
