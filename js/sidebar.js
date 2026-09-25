/**
 * Reusable Sidebar Navigation Component (js/sidebar.js)
 * Centralizes the <aside class="sidebar"> markup across all pages.
 */

function renderSidebar() {
    const sidebarEl = document.getElementById("sidebar-container") || document.querySelector("aside.sidebar");
    if (!sidebarEl) return;

    // Ensure the floating re-open button exists inside .app-wrapper before the sidebar
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

    // Determine current active page from URL
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const activePage = (currentPath === "admission_details.html") ? "admissions.html" : currentPath;

    const isActive = (href) => (activePage === href ? ' class="active"' : "");

    sidebarEl.className = "sidebar";
    sidebarEl.innerHTML = `
        <div class="sidebar-brand">
            <div class="sidebar-brand-text">
                <h2>St. Jude Hospital</h2>
                <span class="subtitle">Billing & Patient System</span>
            </div>
            <button type="button" id="btn-sidebar-close" class="sidebar-close-btn" title="Collapse Sidebar (Alt + S)" aria-label="Collapse Sidebar">&times;</button>
        </div>

        <div class="sidebar-user">
            <div class="sidebar-user-info">
                <strong id="user-display">Loading...</strong>
                <span>Active Session</span>
            </div>
            <button id="btn-logout" class="btn btn-sm btn-outline">Logout</button>
        </div>

        <div class="sidebar-nav-container">
            <div class="nav-section-title">Overview</div>
            <ul class="sidebar-nav">
                <li><a href="index.html"${isActive("index.html")}>Dashboard</a></li>
            </ul>

            <div class="nav-section-title">Master Files (M1)</div>
            <ul class="sidebar-nav">
                <li><a href="patients.html"${isActive("patients.html")}>Patients Directory</a></li>
                <li><a href="doctors.html"${isActive("doctors.html")}>Doctors & Fees</a></li>
                <li><a href="rooms.html"${isActive("rooms.html")}>Rooms & Beds</a></li>
                <li><a href="catalogs.html"${isActive("catalogs.html")}>Charge Catalogs</a></li>
                <li><a href="discounts.html"${isActive("discounts.html")}>Billing Discounts</a></li>
            </ul>

            <div class="nav-section-title">Clinical Care (M2)</div>
            <ul class="sidebar-nav">
                <li><a href="admissions.html"${isActive("admissions.html")}>Admissions & Beds</a></li>
            </ul>

            <div class="nav-section-title">Billing & Settlement (M3)</div>
            <ul class="sidebar-nav">
                <li><a href="invoices.html"${isActive("invoices.html")}>Settled Invoices</a></li>
            </ul>

            <div class="nav-section-title">System & Tools</div>
            <ul class="sidebar-nav">
                <li><a href="archive.html"${isActive("archive.html")}>System Archive</a></li>
            </ul>
        </div>
    `;
}

// Render immediately if DOM element is already present, otherwise on DOMContentLoaded
renderSidebar();
document.addEventListener("DOMContentLoaded", renderSidebar);
