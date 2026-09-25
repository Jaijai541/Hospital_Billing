/**
 * Archive / Recycle Bin Controller (Axios / Frontend)
 * Follows classroom pure HTML standard: dynamic table creation with border="1"
 * Allows viewing, restoring, and hard deleting soft-deleted items across all entities
 */

const baseApiUrl = "../api";
let currentArchivedRecords = [];

document.addEventListener("DOMContentLoaded", () => {
    // Session Verification
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
            if (confirm("Are you sure you want to log out?")) {
                console.log("[Auth] User logged out:", user.username);
                sessionStorage.removeItem("hospital_user");
                window.location.href = "login.html";
            }
        });
    }

    // Category Change Listener
    document.getElementById("archive_category").addEventListener("change", loadArchivedRecords);
    document.getElementById("search_input").addEventListener("input", filterArchivedRecords);

    // Initial Load
    loadArchivedRecords();
});

/**
 * Load archived records for selected entity
 */
const loadArchivedRecords = async () => {
    const entity = document.getElementById("archive_category").value;
    const tableDiv = document.getElementById("table-div");

    try {
        console.log(`[API] Requesting archived records for entity: ${entity}`);
        const response = await axios.get("../api/GET/archive.php", {
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

/**
 * Filter archived records by search input
 */
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

/**
 * Render archive table
 */
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

    // Event delegation
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

/**
 * Restore an archived record (POST)
 */
const restoreRecord = async (entity, id, name) => {
    if (!confirm(`Are you sure you want to RESTORE "${name}" back to active use?`)) {
        return;
    }

    console.log(`[Action] Restoring ${entity} ID: ${id}`);

    const formData = new FormData();
    formData.append("operation", "restoreRecord");
    formData.append("json", JSON.stringify({ entity: entity, id: id }));

    try {
        const response = await axios({
            url: "../api/POST/archive.php",
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
};

/**
 * Hard delete an archived record (POST)
 */
const hardDeleteRecord = async (entity, id, name) => {
    if (!confirm(`WARNING: Are you sure you want to HARD DELETE (permanently erase) "${name}" from MySQL?\n\nThis action cannot be undone!`)) {
        return;
    }

    console.log(`[Action] Hard deleting ${entity} ID: ${id}`);

    const formData = new FormData();
    formData.append("operation", "hardDeleteRecord");
    formData.append("json", JSON.stringify({ entity: entity, id: id }));

    try {
        const response = await axios({
            url: "../api/POST/archive.php",
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
};
