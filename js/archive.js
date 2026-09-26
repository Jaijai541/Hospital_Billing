const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let currentArchivedRecords = [];

const restoreRecord = (entity, id, name) => {
    showPopupConfirm(`Are you sure you want to RESTORE "${name}" back to active use?`, async () => {
        const formData = new FormData();
        formData.append("operation", "restoreRecord");
        formData.append("json", JSON.stringify({ entity: entity, id: id }));

        try {
            const response = await axios({
                url: `${postApiUrl}/archive.php`,
                method: "POST",
                data: formData
            });

            if (response.data == 1) {
                alert(`"${name}" was restored to active records.`);
                loadArchivedRecords();
            } else {
                alert("Error restoring record.");
            }
        } catch (error) {
            console.error("[Error] Restore failed:", error);
            alert("Server error during restore.");
        }
    }, null, {
        title: "Restore Record",
        confirmText: "Restore",
        type: "info"
    });
};

const hardDeleteRecord = (entity, id, name) => {
    showPopupConfirm(`WARNING: Are you sure you want to HARD DELETE (permanently erase) "${name}" from MySQL?\n\nThis action cannot be undone!`, async () => {
        const formData = new FormData();
        formData.append("operation", "hardDeleteRecord");
        formData.append("json", JSON.stringify({ entity: entity, id: id }));

        try {
            const response = await axios({
                url: `${postApiUrl}/archive.php`,
                method: "POST",
                data: formData
            });

            if (response.data == 1) {
                alert(`"${name}" was permanently removed.`);
                loadArchivedRecords();
            } else if (response.data && response.data.message) {
                alert(response.data.message);
            } else {
                alert("Could not permanently delete record.");
            }
        } catch (error) {
            console.error("[Error] Hard delete failed:", error);
            alert("Server error during deletion.");
        }
    }, null, {
        title: "Permanent Delete Warning",
        confirmText: "Permanently Delete",
        type: "danger"
    });
};

const filterArchivedRecords = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();

    const filtered = currentArchivedRecords.filter(item => {
        const code = (item.Code || "").toLowerCase();
        const name = (item.Name || "").toLowerCase();
        const details = (item.Details || "").toLowerCase();

        return code.includes(searchTerm) || name.includes(searchTerm) || details.includes(searchTerm);
    });

    displayArchiveTable(filtered);
};

const displayArchiveTable = (records) => {
    const tableDiv = document.getElementById("table-div");
    const entity = document.getElementById("archive_category").value;
    tableDiv.innerHTML = "";

    if (!records || records.length === 0) {
        tableDiv.innerHTML = `<p>No archived (soft-deleted) records found for this category.</p>`;
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Code</th>
            <th>Name / Description</th>
            <th>Details / Info</th>
            <th>Status</th>
            <th>Actions</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    records.forEach(rec => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${rec.Code}</strong></td>
            <td><strong>${rec.Name}</strong></td>
            <td>${rec.Details}</td>
            <td><span class="badge badge-danger">Archived</span></td>
            <td>
                <button type="button" class="btn btn-sm btn-success btn-action-restore" data-id="${rec.ID}" data-name="${rec.Name}">Restore</button>
                <button type="button" class="btn btn-sm btn-danger btn-delete btn-action-hard-delete" data-id="${rec.ID}" data-name="${rec.Name}">Permanently Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);

    document.querySelectorAll(".btn-action-restore").forEach(btn => {
        btn.addEventListener("click", () => {
            restoreRecord(entity, btn.dataset.id, btn.dataset.name);
        });
    });

    document.querySelectorAll(".btn-action-hard-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            hardDeleteRecord(entity, btn.dataset.id, btn.dataset.name);
        });
    });
};

const loadArchivedRecords = async () => {
    const entity = document.getElementById("archive_category").value;
    const tableDiv = document.getElementById("table-div");

    try {
        console.log(`[API] Requesting archived records for entity: ${entity}`);
        const response = await axios.get(`${getApiUrl}/archive.php`, {
            params: {
                operation: "getArchivedRecords",
                json: JSON.stringify({ entity: entity })
            }
        });

        if (response.status === 200) {
            currentArchivedRecords = response.data || [];
            console.log(`[API] Loaded ${currentArchivedRecords.length} archived records.`);
            filterArchivedRecords();
        } else {
            alert("Error loading archived records!");
        }
    } catch (error) {
        console.error("[API] Network error:", error);
        tableDiv.innerHTML = `<p style="color: red;">Failed to connect to API.</p>`;
    }
};

document.addEventListener("DOMContentLoaded", () => {
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

    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            showPopupConfirm("Are you sure you want to log out of your active session?", () => {
                sessionStorage.removeItem("hospital_user");
                window.location.href = "login.html";
            }, null, {
                title: "Confirm Logout",
                confirmText: "Logout",
                type: "warning"
            });
        });
    }

    document.getElementById("archive_category").addEventListener("change", loadArchivedRecords);
    document.getElementById("search_input").addEventListener("input", filterArchivedRecords);

    loadArchivedRecords();
});
