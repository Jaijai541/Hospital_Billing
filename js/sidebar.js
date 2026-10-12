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
            <div style="display: flex; gap: 6px; margin-top: 8px;">
                <button type="button" id="btn-self-change-pass" class="btn btn-sm btn-outline" style="flex: 1; font-size: 11px; padding: 4px 6px;">Change Password</button>
                <button type="button" id="btn-logout" class="btn btn-sm btn-outline" style="font-size: 11px; padding: 4px 8px;">Logout</button>
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
};

renderSidebar();
document.addEventListener("DOMContentLoaded", renderSidebar);
