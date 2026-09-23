/**
 * Hospital Billing & Patient Information System
 * Sidebar Slide-Out Controller
 * Handles toggling, smooth slide-out collapse, re-expanding, and persistence
 */

// Immediate execution to set preload class if user preferred sidebar collapsed
(function() {
    try {
        if (localStorage.getItem("hospital_sidebar_collapsed") === "true") {
            document.documentElement.classList.add("sidebar-collapsed-preload");
        }
    } catch (e) {
        console.warn("[Sidebar] LocalStorage unavailable:", e);
    }
})();

document.addEventListener("DOMContentLoaded", () => {
    const appWrapper = document.querySelector(".app-wrapper");
    const btnClose = document.getElementById("btn-sidebar-close");
    const btnOpen = document.getElementById("btn-sidebar-open");

    // Sync state on load
    const isCollapsed = localStorage.getItem("hospital_sidebar_collapsed") === "true";
    if (isCollapsed && appWrapper) {
        appWrapper.classList.add("sidebar-collapsed");
    }

    // Remove preload class after initial paint so subsequent toggles animate smoothly
    requestAnimationFrame(() => {
        document.documentElement.classList.remove("sidebar-collapsed-preload");
    });

    // Close button handler (slide out)
    if (btnClose && appWrapper) {
        btnClose.addEventListener("click", () => {
            appWrapper.classList.add("sidebar-collapsed");
            try {
                localStorage.setItem("hospital_sidebar_collapsed", "true");
            } catch (e) {}
            console.log("[Sidebar] Collapsed (UI expanded)");
        });
    }

    // Open button handler (slide in)
    if (btnOpen && appWrapper) {
        btnOpen.addEventListener("click", () => {
            appWrapper.classList.remove("sidebar-collapsed");
            try {
                localStorage.setItem("hospital_sidebar_collapsed", "false");
            } catch (e) {}
            console.log("[Sidebar] Expanded (UI standard)");
        });
    }

    // Keyboard shortcut: Alt + S to toggle sidebar
    document.addEventListener("keydown", (e) => {
        if (e.altKey && e.key.toLowerCase() === "s") {
            e.preventDefault();
            if (appWrapper) {
                const nowCollapsed = appWrapper.classList.toggle("sidebar-collapsed");
                try {
                    localStorage.setItem("hospital_sidebar_collapsed", nowCollapsed ? "true" : "false");
                } catch (err) {}
            }
        }
    });
});
