const initSidebarUserMenu = () => {
    const btnMenu = document.getElementById("btn-user-menu");
    const menu = document.getElementById("sidebar-user-menu");
    if (!btnMenu || !menu) return;

    const closeUserMenu = () => {
        menu.style.display = "none";
        btnMenu.classList.remove("active");
        btnMenu.setAttribute("aria-expanded", "false");
    };

    if (!btnMenu.dataset.wired) {
        btnMenu.dataset.wired = "true";
        btnMenu.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = menu.style.display === "flex" || menu.style.display === "block";
            if (isOpen) {
                closeUserMenu();
            } else {
                menu.style.display = "flex";
                btnMenu.classList.add("active");
                btnMenu.setAttribute("aria-expanded", "true");
            }
        });
    }

    if (!document.body.dataset.userMenuGlobalWired) {
        document.body.dataset.userMenuGlobalWired = "true";
        document.addEventListener("click", (e) => {
            const openMenu = document.getElementById("sidebar-user-menu");
            const openBtn = document.getElementById("btn-user-menu");
            if (openMenu && !e.target.closest(".sidebar-user-dropdown")) {
                openMenu.style.display = "none";
                if (openBtn) {
                    openBtn.classList.remove("active");
                    openBtn.setAttribute("aria-expanded", "false");
                }
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                const openMenu = document.getElementById("sidebar-user-menu");
                const openBtn = document.getElementById("btn-user-menu");
                if (openMenu && (openMenu.style.display === "flex" || openMenu.style.display === "block")) {
                    openMenu.style.display = "none";
                    if (openBtn) {
                        openBtn.classList.remove("active");
                        openBtn.setAttribute("aria-expanded", "false");
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
    const roleId = parseInt(user.role_id, 10) || 0;
    const roleName = user.role_name || "";
    const isAdmin = roleId === 1 || roleName.toLowerCase() === "admin";
    const isFinance = roleId === 2 || roleName.toLowerCase() === "finance staff";
    const isNurse = roleId === 3 || roleName.toLowerCase() === "nurse";

    sidebarEl.className = "sidebar";
    sidebarEl.innerHTML = `
        <div class="sidebar-brand">
            <div class="sidebar-brand-text">
                <h2>In-Patient Hospital</h2>
                <span class="subtitle">Billing & Patient System</span>
            </div>
            <button type="button" id="btn-sidebar-close" class="sidebar-close-btn" title="Collapse Sidebar (Alt + S)" aria-label="Collapse Sidebar">&times;</button>
        </div>

        <div class="sidebar-user">
            <div class="sidebar-user-info">
                <strong id="user-display">${user.full_name || "Loading..."} (${user.role_name || "Active Session"})</strong>
                <span>Active Session</span>
            </div>
            <div class="sidebar-user-dropdown">
                <button type="button" id="btn-user-menu" class="sidebar-user-menu-btn" title="Account Options" aria-label="Account Options" aria-expanded="false">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2.2"/>
                        <circle cx="12" cy="12" r="2.2"/>
                        <circle cx="12" cy="19" r="2.2"/>
                    </svg>
                </button>
                <div id="sidebar-user-menu" class="sidebar-user-dropdown-menu" style="display: none;">
                    <button type="button" id="btn-self-change-pass" class="sidebar-user-dropdown-item">Change Password</button>
                    <div class="sidebar-user-dropdown-divider"></div>
                    <button type="button" id="btn-logout" class="sidebar-user-dropdown-item text-danger">Logout</button>
                </div>
            </div>
        </div>

        <div class="sidebar-nav-container">
            <div class="nav-section-title">Overview</div>
            <ul class="sidebar-nav">
                <li><a href="index.html"${isActive("index.html")}>Dashboard</a></li>
            </ul>

            <div class="nav-section-title">Master Files</div>
            <ul class="sidebar-nav">
                <li><a href="patients.html"${isActive("patients.html")}>Patients Directory</a></li>
                <li><a href="doctors.html"${isActive("doctors.html")}>Doctors & Fees</a></li>
                ${isAdmin ? `<li><a href="departments.html"${isActive("departments.html")}>Departments & Stations</a></li>` : ""}
                <li><a href="rooms.html"${isActive("rooms.html")}>Rooms & Beds</a></li>
                <li><a href="catalogs.html"${isActive("catalogs.html")}>Charge Catalogs</a></li>
                ${isAdmin || isFinance ? `<li><a href="discounts.html"${isActive("discounts.html")}>Billing Discounts</a></li>` : ""}
            </ul>

            <div class="nav-section-title">Clinical Care</div>
            <ul class="sidebar-nav">
                <li><a href="admissions.html"${isActive("admissions.html")}>Admissions & Beds</a></li>
            </ul>

            ${isAdmin || isFinance ? `
            <div class="nav-section-title">Billing & Settlement</div>
            <ul class="sidebar-nav">
                <li><a href="invoices.html"${isActive("invoices.html")}>Invoices & Settlement</a></li>
                <li><a href="promissory_notes.html"${isActive("promissory_notes.html")}>Promissory Notes & AR</a></li>
            </ul>

            <div class="nav-section-title">Reports & Management</div>
            <ul class="sidebar-nav">
                <li><a href="reports.html"${isActive("reports.html")}>Reports & Analytics</a></li>
            </ul>
            ` : ""}

            ${isAdmin ? `
            <div class="nav-section-title">System & Tools</div>
            <ul class="sidebar-nav">
                <li><a href="staff.html"${isActive("staff.html")}>Staff & Users</a></li>
                <li><a href="audit_log.html"${isActive("audit_log.html")}>Audit Log</a></li>
                <li><a href="archive.html"${isActive("archive.html")}>System Archive</a></li>
            </ul>
            ` : ""}
        </div>
    `;

    initSidebarUserMenu();
};

renderSidebar();
document.addEventListener("DOMContentLoaded", renderSidebar);
