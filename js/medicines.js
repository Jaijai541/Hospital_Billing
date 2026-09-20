/**
 * Medicines Catalog Controller (Axios / Frontend)
 * Follows the Book example structure: dynamic table creation with border="1"
 * Includes Search, Filter, Sort, and Console Logging
 */

const baseApiUrl = "http://localhost/Hospital_Billing/api";
let allMedicines = []; // In-memory cache for fast search, filter, and sort

document.addEventListener("DOMContentLoaded", () => {
    // 1. Session Verification
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

    // 2. Initial Data Load
    displayDepartments();
    displayMedicines();

    // 3. Form Event Listeners
    document.getElementById("btnSubmit").addEventListener("click", saveMedicine);
    document.getElementById("btnCancel").addEventListener("click", resetForm);

    // 4. Search, Filter, and Sort Listeners
    document.getElementById("search_input").addEventListener("input", filterAndSortMedicines);
    document.getElementById("filter_status").addEventListener("change", filterAndSortMedicines);
    document.getElementById("sort_by").addEventListener("change", filterAndSortMedicines);
});

/**
 * Fetch all medicines from API into memory and apply initial filter/sort
 */
const displayMedicines = async () => {
    const tableDiv = document.getElementById("table-div");

    try {
        console.log("[API] Requesting: getAllMedicines");
        const response = await axios.get(`${baseApiUrl}/medicines.php`, {
            params: { operation: "getAllMedicines" }
        });

        if (response.status === 200) {
            allMedicines = response.data || [];
            console.log(`[API] Success: Loaded ${allMedicines.length} medicines.`);
            filterAndSortMedicines();
        } else {
            console.error("[API] Error loading medicines:", response);
            alert("Error loading medicines!");
        }
    } catch (error) {
        console.error("[API] Network error:", error);
        tableDiv.innerHTML = `<p style="color: red;">Failed to connect to API.</p>`;
    }
};

/**
 * Search, Filter, and Sort the medicines list dynamically
 */
const filterAndSortMedicines = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();
    const filterStatus = document.getElementById("filter_status").value;
    const sortBy = document.getElementById("sort_by").value;

    let filtered = allMedicines.filter(med => {
        const itemCode = `${med.Code_Prefix}-${med.Medicine_ID}`.toLowerCase();
        const genericName = med.Generic_Name.toLowerCase();

        // Search filter (by Generic Name OR Code Prefix e.g. "MED-1")
        const matchesSearch = genericName.includes(searchTerm) || itemCode.includes(searchTerm);

        // Status filter (All, Active, Soft-Deleted)
        let matchesStatus = true;
        if (filterStatus === "1") {
            matchesStatus = (med.Is_Active == 1);
        } else if (filterStatus === "0") {
            matchesStatus = (med.Is_Active == 0);
        }

        return matchesSearch && matchesStatus;
    });

    // Sorting logic
    filtered.sort((a, b) => {
        const codeA = `${a.Code_Prefix}-${a.Medicine_ID}`;
        const codeB = `${b.Code_Prefix}-${b.Medicine_ID}`;

        switch (sortBy) {
            case "code_asc":
                return codeA.localeCompare(codeB, undefined, { numeric: true });
            case "code_desc":
                return codeB.localeCompare(codeA, undefined, { numeric: true });
            case "name_asc":
                return a.Generic_Name.localeCompare(b.Generic_Name);
            case "name_desc":
                return b.Generic_Name.localeCompare(a.Generic_Name);
            case "price_asc":
                return parseFloat(a.Unit_Price) - parseFloat(b.Unit_Price);
            case "price_desc":
                return parseFloat(b.Unit_Price) - parseFloat(a.Unit_Price);
            case "id_desc":
                return parseInt(b.Medicine_ID) - parseInt(a.Medicine_ID);
            default:
                return 0;
        }
    });

    console.log(`[UI] Filtered & Sorted: Displaying ${filtered.length} of ${allMedicines.length} items (Search: "${searchTerm}", Status: ${filterStatus}, Sort: ${sortBy})`);
    displayMedicinesTable(filtered);
};

/**
 * Render pure HTML table matching Book/app.js pattern
 */
const displayMedicinesTable = (medicines) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!medicines || medicines.length === 0) {
        tableDiv.innerHTML = "<p>No matching medicines found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.border = "1";
    table.cellPadding = "5";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Code</th>
            <th>Generic Name</th>
            <th>Department</th>
            <th>Unit Price</th>
            <th>Status</th>
            <th>Actions</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    medicines.forEach(med => {
        const isActive = (med.Is_Active == 1);
        const statusText = isActive ? "Active" : "Inactive (Soft Deleted)";
        const toggleAction = isActive ? "Soft Delete" : "Restore";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${med.Code_Prefix}-${med.Medicine_ID}</td>
            <td>${med.Generic_Name}</td>
            <td>${med.Station_Name}</td>
            <td>₱ ${parseFloat(med.Unit_Price).toFixed(2)}</td>
            <td>${statusText}</td>
            <td>
                <button type="button" class="btn-action-edit" data-id="${med.Medicine_ID}">Edit</button>
                <button type="button" class="btn-action-soft-delete" data-id="${med.Medicine_ID}" data-status="${med.Is_Active}" data-name="${med.Generic_Name}">${toggleAction}</button>
                <button type="button" class="btn-action-hard-delete" data-id="${med.Medicine_ID}" data-name="${med.Generic_Name}">Hard Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);

    // Event delegation with semantic classes
    document.querySelectorAll(".btn-action-edit").forEach(btn => {
        btn.addEventListener("click", () => loadMedicineForEdit(btn.dataset.id));
    });

    document.querySelectorAll(".btn-action-soft-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            toggleMedicineStatus(btn.dataset.id, btn.dataset.status, btn.dataset.name);
        });
    });

    document.querySelectorAll(".btn-action-hard-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            hardDeleteMedicine(btn.dataset.id, btn.dataset.name);
        });
    });
};

/**
 * Fetch and populate department select dropdown
 */
const displayDepartments = async () => {
    const select = document.getElementById("station_id");

    try {
        console.log("[API] Requesting: getAllDepartments");
        const response = await axios.get(`${baseApiUrl}/departments.php`, {
            params: { operation: "getAllDepartments" }
        });

        if (response.status === 200) {
            const departments = response.data;
            select.innerHTML = `<option value="">Select Department...</option>`;

            departments.forEach(dept => {
                const option = document.createElement("option");
                option.value = dept.Station_ID;
                option.textContent = dept.Station_Name;
                select.appendChild(option);
            });
            console.log(`[API] Loaded ${departments.length} departments.`);
        }
    } catch (error) {
        console.error("[API] Error loading departments:", error);
    }
};

/**
 * Load existing medicine data into form for editing
 */
const loadMedicineForEdit = async (medicineId) => {
    try {
        console.log(`[API] Requesting medicine details for ID: ${medicineId}`);
        const response = await axios.get(`${baseApiUrl}/medicines.php`, {
            params: {
                operation: "getMedicineById",
                json: JSON.stringify({ medicine_id: medicineId })
            }
        });

        if (response.status === 200 && response.data) {
            const med = response.data;
            document.getElementById("medicine_id").value = med.Medicine_ID;
            document.getElementById("generic_name").value = med.Generic_Name;
            document.getElementById("station_id").value = med.Station_ID;
            document.getElementById("unit_price").value = med.Unit_Price;

            document.getElementById("form-title").textContent = `Edit Medicine (MED-${med.Medicine_ID})`;
            document.getElementById("btnSubmit").textContent = "Update Medicine";
            document.getElementById("btnCancel").style.display = "inline";
            window.scrollTo({ top: 0, behavior: "smooth" });
            console.log("[UI] Form populated for edit:", med);
        }
    } catch (error) {
        console.error("[API] Error loading medicine details:", error);
        alert("Failed to load medicine details.");
    }
};

/**
 * Insert or Update Medicine (POST)
 */
const saveMedicine = async () => {
    const medicineId = document.getElementById("medicine_id").value;
    const genericName = document.getElementById("generic_name").value.trim();
    const stationId = document.getElementById("station_id").value;
    const unitPrice = document.getElementById("unit_price").value;

    if (!genericName || !stationId || unitPrice === "") {
        alert("Please fill in all fields.");
        return;
    }

    const jsonData = {
        generic_name: genericName,
        station_id: stationId,
        unit_price: parseFloat(unitPrice)
    };

    const isEdit = (medicineId !== "");
    const operation = isEdit ? "updateMedicine" : "insertMedicine";

    if (isEdit) {
        jsonData.medicine_id = medicineId;
    }

    console.log(`[Action] Submitting ${operation} via POST:`, jsonData);

    const formData = new FormData();
    formData.append("operation", operation);
    formData.append("json", JSON.stringify(jsonData));

    try {
        const response = await axios({
            url: `${baseApiUrl}/medicines.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] ${operation} completed successfully.`);
            alert(isEdit ? "Medicine updated successfully!" : "Medicine added successfully!");
            resetForm();
            displayMedicines();
        } else {
            console.warn(`[Failed] ${operation} returned non-success:`, response.data);
            alert("Error saving medicine.");
        }
    } catch (error) {
        console.error("[Error] Save request failed:", error);
        alert("Server error occurred.");
    }
};

/**
 * Reset form back to Add mode
 */
const resetForm = () => {
    document.getElementById("medicine_id").value = "";
    document.getElementById("generic_name").value = "";
    document.getElementById("station_id").value = "";
    document.getElementById("unit_price").value = "";

    document.getElementById("form-title").textContent = "Add New Medicine";
    document.getElementById("btnSubmit").textContent = "Submit";
    document.getElementById("btnCancel").style.display = "none";
    console.log("[UI] Form reset to Add mode.");
};

/**
 * Soft Delete / Restore (POST)
 */
const toggleMedicineStatus = async (medicineId, currentStatus, name) => {
    const actionText = (currentStatus == 1) ? "SOFT DELETE (mark as inactive)" : "RESTORE (reactivate)";
    if (!confirm(`Are you sure you want to ${actionText} "${name}"?\n\n(Soft Delete keeps the record in the database so past bills remain intact)`)) {
        return;
    }

    console.log(`[Action] Toggling status for Medicine ID: ${medicineId} (Current: ${currentStatus})`);

    const formData = new FormData();
    formData.append("operation", "toggleStatus");
    formData.append("json", JSON.stringify({ medicine_id: medicineId }));

    try {
        const response = await axios({
            url: `${baseApiUrl}/medicines.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] Status toggled successfully for Medicine ID: ${medicineId}`);
            displayMedicines();
        } else {
            console.warn("[Failed] Status toggle returned non-success:", response.data);
            alert("Error updating status.");
        }
    } catch (error) {
        console.error("[Error] Toggle request failed:", error);
        alert("Error occurred.");
    }
};

/**
 * Hard Delete: Permanently remove the record from MySQL (POST)
 */
const hardDeleteMedicine = async (medicineId, name) => {
    if (!confirm(`WARNING: Are you sure you want to HARD DELETE (permanently remove) "${name}" from the database?\n\nThis action physically deletes the record from MySQL and cannot be undone!`)) {
        return;
    }

    console.log(`[Action] Attempting Hard Delete for Medicine ID: ${medicineId}`);

    const formData = new FormData();
    formData.append("operation", "hardDeleteMedicine");
    formData.append("json", JSON.stringify({ medicine_id: medicineId }));

    try {
        const response = await axios({
            url: `${baseApiUrl}/medicines.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] Hard deleted Medicine ID: ${medicineId}`);
            alert(`"${name}" was permanently deleted from the database.`);
            displayMedicines();
        } else if (response.data && response.data.message) {
            console.warn("[Protected] Hard delete blocked:", response.data.message);
            alert(response.data.message);
        } else {
            console.error("[Failed] Hard delete failed:", response.data);
            alert("Error: Could not permanently delete record.");
        }
    } catch (error) {
        console.error("[Error] Hard delete request failed:", error);
        alert("Server error during hard delete.");
    }
};
