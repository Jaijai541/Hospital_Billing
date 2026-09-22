const baseApiUrl = "../api";

document.addEventListener("DOMContentLoaded", () => {
    const loggedInUser = sessionStorage.getItem("hospital_user");
    if (loggedInUser) {
        window.location.href = "index.html";
        return;
    }

    const form = document.getElementById("loginForm");
    const errorDiv = document.getElementById("error-message");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorDiv.textContent = "";

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;

        const jsonData = {
            username: username,
            password: password
        };

        const formData = new FormData();
        formData.append("operation", "login");
        formData.append("json", JSON.stringify(jsonData));

        try {
            const response = await axios.post(`${baseApiUrl}/auth.php`, formData);

            if (response.status === 200 && response.data.status === 1) {
                sessionStorage.setItem("hospital_user", JSON.stringify(response.data.user));
                window.location.href = "index.html";
            } else {
                errorDiv.textContent = response.data.message || "Invalid username or password.";
            }
        } catch (error) {
            console.error("Login error:", error);
            errorDiv.textContent = "Unable to connect to the authentication server.";
        }
    });
});
