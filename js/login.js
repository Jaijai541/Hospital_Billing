const postApiUrl = "../api/POST";

document.addEventListener("DOMContentLoaded", () => {
    const loggedInUser = sessionStorage.getItem("hospital_user");
    if (loggedInUser) {
        window.location.href = "index.html";
        return;
    }

    const form = document.getElementById("loginForm");
    const errorDiv = document.getElementById("error-message");
    const passwordInput = document.getElementById("password");
    const togglePasswordBtn = document.getElementById("btnTogglePassword");
    const btnLogin = document.getElementById("btn-login");

    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener("click", () => {
            const isPassword = passwordInput.getAttribute("type") === "password";
            passwordInput.setAttribute("type", isPassword ? "text" : "password");
            togglePasswordBtn.classList.toggle("revealed", isPassword);
            togglePasswordBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
        });
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorDiv.textContent = "";
        errorDiv.classList.remove("visible");

        const username = document.getElementById("username").value.trim();
        const password = passwordInput.value;

        if (btnLogin) {
            btnLogin.disabled = true;
            btnLogin.textContent = "Signing In...";
        }

        const jsonData = {
            username: username,
            password: password
        };

        const formData = new FormData();
        formData.append("operation", "login");
        formData.append("json", JSON.stringify(jsonData));

        try {
            const response = await axios.post(`${postApiUrl}/auth.php`, formData);

            if (response.status === 200 && response.data.status === 1) {
                sessionStorage.setItem("hospital_user", JSON.stringify(response.data.user));
                window.location.href = "index.html";
            } else {
                errorDiv.textContent = response.data.message || "Invalid username or password.";
                errorDiv.classList.add("visible");
            }
        } catch (error) {
            console.error("Login error:", error);
            errorDiv.textContent = "Unable to connect to the authentication server.";
            errorDiv.classList.add("visible");
        } finally {
            if (btnLogin) {
                btnLogin.disabled = false;
                btnLogin.textContent = "Sign In";
            }
        }
    });
});
