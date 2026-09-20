/**
 * Dashboard Controller (Axios / Frontend)
 * Manages admin session verification and logout
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Session Verification: Ensure user is logged in
    const userJson = sessionStorage.getItem("hospital_user");
    if (!userJson) {
        window.location.href = "login.html";
        return;
    }

    const user = JSON.parse(userJson);
    const userDisplay = document.getElementById("user-display");
    if (userDisplay) {
        userDisplay.textContent = `${user.full_name} (${user.role_name})`;
    }

    // 2. Logout Handler
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to log out?")) {
                sessionStorage.removeItem("hospital_user");
                window.location.href = "login.html";
            }
        });
    }
});

