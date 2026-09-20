/**
 * Hospital Services Catalog Controller (Axios / Frontend)
 * Follows the Book example structure: dynamic table creation with border="1"
 * Handles Performer Roles, Search, Filter, Sort, and Console Logging
 */

const baseApiUrl = "http://localhost/Hospital_Billing/api";
let allServices = []; // In-memory cache for fast search, filter, and sort

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
    displayServices();

    // 3. Form Event Listeners
    document.getElementById("btnSubmit").addEventListener("click", saveService);
    document.getElementById("btnCancel").addEventListener("click", resetForm);

    // 4. Search, Filter, and Sort Listeners
    document.getElementById("search_input").addEventListener("input", filterAndSortServices);
    document.getElementById("filter_status").addEventListener("change", filterAndSortServices);
    document.getElementById("filter_station").addEventListener("change", filterAndSortServices);
    document.getElementById("sort_by").addEventListener("change", filterAndSortServices);
});

/**
 * Fetch all services from API into memory and apply initial filter/sort
 */
const displayServices = async () => {
    const tableDiv = document.getElementById("table-div");

    try {
        console.log("[API] Requesting: getAllServices");
        const response = await axios.get(`${baseApiUrl}/services.php`, {
            params: { operation: "getAllServices" }
        });

        if (response.status === 200) {
            allServices = response.data || [];
            console.log(`[API] Success: Loaded ${allServices.length} hospital services.`);
            filterAndSortServices();
        } else {
            console.error("[API] Error loading services:", response);
            alert("Error loading services catalog!");
        }
    } catch (error) {
        console.error("[API] Network error:", error);
        tableDiv.innerHTML = `<p style="color: red;">Failed to connect to API.</p>`;
    }
};

/**
 * Search, Filter, and Sort the services list dynamically
 */
const filterAndSortServices = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();
    const filterStatus = document.getElementById("filter_status").value;
    const filterStation = document.getElementById("filter_station").value;
    const sortBy = document.getElementById("sort_by").value;

    let filtered = allServices.filter(srv => {
        const itemCode = `${srv.Code_Prefix}-${srv.Service_ID}`.toLowerCase();
        const serviceName = srv.Service_Name.toLowerCase();
        const performerRole = srv.Performer_Role.toLowerCase();

        // Search filter (by Name, Role, or Code)
        const matchesSearch = serviceName.includes(searchTerm) || 
                              performerRole.includes(searchTerm) || 
                              itemCode.includes(searchTerm);

        // Status filter (All, Active, Soft-Deleted)
        let matchesStatus = true;
        if (filterStatus === "1") {
            matchesStatus = (srv.Is_Active == 1);
        } else if (filterStatus === "0") {
            matchesStatus = (srv.Is_Active == 0);
        }

        // Department filter
        let matchesStation = true;
        if (filterStation !== "all") {
            matchesStation = (srv.Station_ID == filterStation);
        }

        return matchesSearch && matchesStatus && matchesStation;
    });

    // Sorting logic
    filtered.sort((a, b) => {
        const codeA = `${a.Code_Prefix}-${a.Service_ID}`;
        const codeB = `${b.Code_Prefix}-${b.Service_ID}`;

        switch (sortBy) {
            case "code_asc":
                return codeA.localeCompare(codeB, undefined, { numeric: true });
            case "code_desc":
                return codeB.localeCompare(codeA, undefined, { numeric: true });
            case "name_asc":
                return a.Service_Name.localeCompare(b.Service_Name);
            case "name_desc":
                return b.Service_Name.localeCompare(a.Service_Name);
            case "fee_asc":
                return parseFloat(a.Service_Fee) - parseFloat(b.Service_Fee);
            case "fee_desc":
                return parseFloat(b.Service_Fee) - parseFloat(a.Service_Fee);
            case "id_desc":
                return parseInt(b.Service_ID) - parseInt(a.Service_ID);
            default:
                return 0;
        }
    });

    console.log(`[UI] Filtered & Sorted Services: Displaying ${filtered.length} of ${allServices.length} items`);
    displayServicesTable(filtered);
};

/**
 * Render pure HTML table matching Book/app.js pattern
 */
const displayServicesTable = (services) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!services || services.length === 0) {
        tableDiv.innerHTML = "<p>No matching services found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.border = "1";
    table.cellPadding = "5";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Code</th>
            <th>Service / Procedure Name</th>
            <th>Department</th>
            <th>Performer Role</th>
            <th>Service Fee</th>
            <th>Status</th>
            <th>Actions</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    services.forEach(srv => {
        const isActive = (srv.Is_Active == 1);
        const statusText = isActive ? "Active" : "Inactive (Soft Deleted)";
        const toggleAction = isActive ? "Soft Delete" : "Restore";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${srv.Code_Prefix}-${srv.Service_ID}</td>
            <td>${srv.Service_Name}</td>
            <td>${srv.Station_Name}</td>
            <td>${srv.Performer_Role}</td>
            <td>₱ ${parseFloat(srv.Service_Fee).toFixed(2)}</td>
            <td>${statusText}</td>
            <td>
                <button type="button" class="btn-action-edit" data-id="${srv.Service_ID}">Edit</button>
                <button type="button" class="btn-action-soft-delete" data-id="${srv.Service_ID}" data-status="${srv.Is_Active}" data-name="${srv.Service_Name}">${toggleAction}</button>
                <button type="button" class="btn-action-hard-delete" data-id="${srv.Service_ID}" data-name="${srv.Service_Name}">Hard Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);

    // Event delegation with semantic classes
    document.querySelectorAll(".btn-action-edit").forEach(btn => {
        btn.addEventListener("click", () => loadServiceForEdit(btn.dataset.id));
    });

    document.querySelectorAll(".btn-action-soft-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            toggleServiceStatus(btn.dataset.id, btn.dataset.status, btn.dataset.name);
        });
    });

    document.querySelectorAll(".btn-action-hard-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            hardDeleteService(btn.dataset.id, btn.dataset.name);
        });
    });
};

/**
 * Fetch and populate department select dropdowns (both for the form and the filter)
 */
const displayDepartments = async () => {
    const formSelect = document.getElementById("station_id");
    const filterSelect = document.getElementById("filter_station");

    try {
        console.log("[API] Requesting: getAllDepartments");
        const response = await axios.get(`${baseApiUrl}/departments.php`, {
            params: { operation: "getAllDepartments" }
        });

        if (response.status === 200) {
            const departments = response.data;
            formSelect.innerHTML = `<option value="">Select Department...</option>`;
            filterSelect.innerHTML = `<option value="all">All Departments</option>`;

            departments.forEach(dept => {
                // Form select option
                const opt1 = document.createElement("option");
                opt1.value = dept.Station_ID;
                opt1.textContent = dept.Station_Name;
                formSelect.appendChild(opt1);

                // Filter select option
                const opt2 = document.createElement("option");
                opt2.value = dept.Station_ID;
                opt2.textContent = dept.Station_Name;
                filterSelect.appendChild(opt2);
            });
            console.log(`[API] Loaded ${departments.length} departments for services.`);
        }
    } catch (error) {
        console.error("[API] Error loading departments:", error);
    }
};

/**
 * Load existing service data into form for editing
 */
const loadServiceForEdit = async (serviceId) => {
    try {
        console.log(`[API] Requesting service details for ID: ${serviceId}`);
        const response = await axios.get(`${baseApiUrl}/services.php`, {
            params: {
                operation: "getServiceById",
                json: JSON.stringify({ service_id: serviceId })
            }
        });

        if (response.status === 200 && response.data) {
            const srv = response.data;
            document.getElementById("service_id").value = srv.Service_ID;
            document.getElementById("service_name").value = srv.Service_Name;
            document.getElementById("station_id").value = srv.Station_ID;
            document.getElementById("performer_role").value = srv.Performer_Role;
            document.getElementById("service_fee").value = srv.Service_Fee;

            document.getElementById("form-title").textContent = `Edit Service (SRV-${srv.Service_ID})`;
            document.getElementById("btnSubmit").textContent = "Update Service";
            document.getElementById("btnCancel").style.display = "inline";
            window.scrollTo({ top: 0, behavior: "smooth" });
            console.log("[UI] Form populated for edit:", srv);
        }
    } catch (error) {
        console.error("[API] Error loading service details:", error);
        alert("Failed to load service details.");
    }
};

/**
 * Insert or Update Service (POST)
 */
const saveService = async () => {
    const serviceId = document.getElementById("service_id").value;
    const serviceName = document.getElementById("service_name").value.trim();
    const stationId = document.getElementById("station_id").value;
    const performerRole = document.getElementById("performer_role").value.trim();
    const serviceFee = document.getElementById("service_fee").value;

    if (!serviceName || !stationId || !performerRole || serviceFee === "") {
        alert("Please fill in all fields.");
        return;
    }

    const jsonData = {
        service_name: serviceName,
        station_id: stationId,
        performer_role: performerRole,
        service_fee: parseFloat(serviceFee)
    };

    const isEdit = (serviceId !== "");
    const operation = isEdit ? "updateService" : "insertService";

    if (isEdit) {
        jsonData.service_id = serviceId;
    }

    console.log(`[Action] Submitting ${operation} via POST:`, jsonData);

    const formData = new FormData();
    formData.append("operation", operation);
    formData.append("json", JSON.stringify(jsonData));

    try {
        const response = await axios({
            url: `${baseApiUrl}/services.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] ${operation} completed successfully.`);
            alert(isEdit ? "Service updated successfully!" : "Service added successfully!");
            resetForm();
            displayServices();
        } else {
            console.warn(`[Failed] ${operation} returned non-success:`, response.data);
            alert("Error saving service.");
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
    document.getElementById("service_id").value = "";
    document.getElementById("service_name").value = "";
    document.getElementById("station_id").value = "";
    document.getElementById("performer_role").value = "";
    document.getElementById("service_fee").value = "";

    document.getElementById("form-title").textContent = "Add New Hospital Service / Procedure";
    document.getElementById("btnSubmit").textContent = "Submit";
    document.getElementById("btnCancel").style.display = "none";
    console.log("[UI] Form reset to Add mode.");
};

/**
 * Soft Delete / Restore (POST)
 */
const toggleServiceStatus = async (serviceId, currentStatus, name) => {
    const actionText = (currentStatus == 1) ? "SOFT DELETE (mark as inactive)" : "RESTORE (reactivate)";
    if (!confirm(`Are you sure you want to ${actionText} "${name}"?\n\n(Soft Delete keeps the record in the database so past bills remain intact)`)) {
        return;
    }

    console.log(`[Action] Toggling status for Service ID: ${serviceId} (Current: ${currentStatus})`);

    const formData = new FormData();
    formData.append("operation", "toggleStatus");
    formData.append("json", JSON.stringify({ service_id: serviceId }));

    try {
        const response = await axios({
            url: `${baseApiUrl}/services.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] Status toggled successfully for Service ID: ${serviceId}`);
            displayServices();
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
const hardDeleteService = async (serviceId, name) => {
    if (!confirm(`WARNING: Are you sure you want to HARD DELETE (permanently remove) "${name}" from the database?\n\nThis action physically deletes the record from MySQL and cannot be undone!`)) {
        return;
    }

    console.log(`[Action] Attempting Hard Delete for Service ID: ${serviceId}`);

    const formData = new FormData();
    formData.append("operation", "hardDeleteService");
    formData.append("json", JSON.stringify({ service_id: serviceId }));

    try {
        const response = await axios({
            url: `${baseApiUrl}/services.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] Hard deleted Service ID: ${serviceId}`);
            alert(`"${name}" was permanently deleted from the database.`);
            displayServices();
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

