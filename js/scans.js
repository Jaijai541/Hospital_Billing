/**
 * Equipment & Diagnostic Scans Controller (Axios / Frontend)
 * Follows the Book example structure: dynamic table creation with border="1"
 * Handles Hospital Fee + Doctor Reader's Fee split, Search, Filter, Sort, and Console Logging
 */

const baseApiUrl = "http://localhost/Hospital_Billing/api";
let allScans = []; // In-memory cache for fast search, filter, and sort

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
    displayScans();

    // 3. Live Total Fee Calculation Listeners
    document.getElementById("hospital_fee").addEventListener("input", updateTotalFeeDisplay);
    document.getElementById("reader_fee").addEventListener("input", updateTotalFeeDisplay);

    // 4. Form Event Listeners
    document.getElementById("btnSubmit").addEventListener("click", saveScan);
    document.getElementById("btnCancel").addEventListener("click", resetForm);

    // 5. Search, Filter, and Sort Listeners
    document.getElementById("search_input").addEventListener("input", filterAndSortScans);
    document.getElementById("filter_status").addEventListener("change", filterAndSortScans);
    document.getElementById("filter_station").addEventListener("change", filterAndSortScans);
    document.getElementById("sort_by").addEventListener("change", filterAndSortScans);
});

/**
 * Live calculate and display the total fee (Hospital Fee + Doctor Reader's Fee)
 */
const updateTotalFeeDisplay = () => {
    const hospital = parseFloat(document.getElementById("hospital_fee").value) || 0;
    const reader = parseFloat(document.getElementById("reader_fee").value) || 0;
    const total = hospital + reader;
    document.getElementById("total_fee_display").textContent = `₱ ${total.toFixed(2)}`;
};

/**
 * Fetch all scans from API into memory and apply initial filter/sort
 */
const displayScans = async () => {
    const tableDiv = document.getElementById("table-div");

    try {
        console.log("[API] Requesting: getAllScans");
        const response = await axios.get(`${baseApiUrl}/scans.php`, {
            params: { operation: "getAllScans" }
        });

        if (response.status === 200) {
            allScans = response.data || [];
            console.log(`[API] Success: Loaded ${allScans.length} equipment scans.`);
            filterAndSortScans();
        } else {
            console.error("[API] Error loading scans:", response);
            alert("Error loading scans catalog!");
        }
    } catch (error) {
        console.error("[API] Network error:", error);
        tableDiv.innerHTML = `<p style="color: red;">Failed to connect to API.</p>`;
    }
};

/**
 * Search, Filter, and Sort the scans list dynamically
 */
const filterAndSortScans = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();
    const filterStatus = document.getElementById("filter_status").value;
    const filterStation = document.getElementById("filter_station").value;
    const sortBy = document.getElementById("sort_by").value;

    let filtered = allScans.filter(sc => {
        const itemCode = `${sc.Code_Prefix}-${sc.Scan_ID}`.toLowerCase();
        const scanName = sc.Scan_Name.toLowerCase();

        // Search filter (by Name OR Code)
        const matchesSearch = scanName.includes(searchTerm) || itemCode.includes(searchTerm);

        // Status filter (All, Active, Soft-Deleted)
        let matchesStatus = true;
        if (filterStatus === "1") {
            matchesStatus = (sc.Is_Active == 1);
        } else if (filterStatus === "0") {
            matchesStatus = (sc.Is_Active == 0);
        }

        // Department filter
        let matchesStation = true;
        if (filterStation !== "all") {
            matchesStation = (sc.Station_ID == filterStation);
        }

        return matchesSearch && matchesStatus && matchesStation;
    });

    // Sorting logic
    filtered.sort((a, b) => {
        const codeA = `${a.Code_Prefix}-${a.Scan_ID}`;
        const codeB = `${b.Code_Prefix}-${b.Scan_ID}`;

        switch (sortBy) {
            case "code_asc":
                return codeA.localeCompare(codeB, undefined, { numeric: true });
            case "code_desc":
                return codeB.localeCompare(codeA, undefined, { numeric: true });
            case "name_asc":
                return a.Scan_Name.localeCompare(b.Scan_Name);
            case "name_desc":
                return b.Scan_Name.localeCompare(a.Scan_Name);
            case "total_asc":
                return parseFloat(a.Total_Fee) - parseFloat(b.Total_Fee);
            case "total_desc":
                return parseFloat(b.Total_Fee) - parseFloat(a.Total_Fee);
            case "id_desc":
                return parseInt(b.Scan_ID) - parseInt(a.Scan_ID);
            default:
                return 0;
        }
    });

    console.log(`[UI] Filtered & Sorted Scans: Displaying ${filtered.length} of ${allScans.length} items`);
    displayScansTable(filtered);
};

/**
 * Render pure HTML table matching Book/app.js pattern
 */
const displayScansTable = (scans) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!scans || scans.length === 0) {
        tableDiv.innerHTML = "<p>No matching scans found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.border = "1";
    table.cellPadding = "5";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Code</th>
            <th>Procedure Name</th>
            <th>Department</th>
            <th>Hospital Fee</th>
            <th>Doctor Reader's Fee</th>
            <th>Total Fee</th>
            <th>Status</th>
            <th>Actions</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    scans.forEach(sc => {
        const isActive = (sc.Is_Active == 1);
        const statusText = isActive ? "Active" : "Inactive (Soft Deleted)";
        const toggleAction = isActive ? "Soft Delete" : "Restore";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${sc.Code_Prefix}-${sc.Scan_ID}</td>
            <td>${sc.Scan_Name}</td>
            <td>${sc.Station_Name}</td>
            <td>₱ ${parseFloat(sc.Hospital_Fee).toFixed(2)}</td>
            <td>₱ ${parseFloat(sc.Reader_Fee).toFixed(2)}</td>
            <td><strong>₱ ${parseFloat(sc.Total_Fee).toFixed(2)}</strong></td>
            <td>${statusText}</td>
            <td>
                <button type="button" class="btn-action-edit" data-id="${sc.Scan_ID}">Edit</button>
                <button type="button" class="btn-action-soft-delete" data-id="${sc.Scan_ID}" data-status="${sc.Is_Active}" data-name="${sc.Scan_Name}">${toggleAction}</button>
                <button type="button" class="btn-action-hard-delete" data-id="${sc.Scan_ID}" data-name="${sc.Scan_Name}">Hard Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);

    // Event delegation with semantic classes
    document.querySelectorAll(".btn-action-edit").forEach(btn => {
        btn.addEventListener("click", () => loadScanForEdit(btn.dataset.id));
    });

    document.querySelectorAll(".btn-action-soft-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            toggleScanStatus(btn.dataset.id, btn.dataset.status, btn.dataset.name);
        });
    });

    document.querySelectorAll(".btn-action-hard-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            hardDeleteScan(btn.dataset.id, btn.dataset.name);
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
            console.log(`[API] Loaded ${departments.length} departments for scans.`);
        }
    } catch (error) {
        console.error("[API] Error loading departments:", error);
    }
};

/**
 * Load existing scan data into form for editing
 */
const loadScanForEdit = async (scanId) => {
    try {
        console.log(`[API] Requesting scan details for ID: ${scanId}`);
        const response = await axios.get(`${baseApiUrl}/scans.php`, {
            params: {
                operation: "getScanById",
                json: JSON.stringify({ scan_id: scanId })
            }
        });

        if (response.status === 200 && response.data) {
            const sc = response.data;
            document.getElementById("scan_id").value = sc.Scan_ID;
            document.getElementById("scan_name").value = sc.Scan_Name;
            document.getElementById("station_id").value = sc.Station_ID;
            document.getElementById("hospital_fee").value = sc.Hospital_Fee;
            document.getElementById("reader_fee").value = sc.Reader_Fee;
            updateTotalFeeDisplay();

            document.getElementById("form-title").textContent = `Edit Scan (RAD-${sc.Scan_ID})`;
            document.getElementById("btnSubmit").textContent = "Update Scan";
            document.getElementById("btnCancel").style.display = "inline";
            window.scrollTo({ top: 0, behavior: "smooth" });
            console.log("[UI] Form populated for edit:", sc);
        }
    } catch (error) {
        console.error("[API] Error loading scan details:", error);
        alert("Failed to load scan details.");
    }
};

/**
 * Insert or Update Scan (POST)
 */
const saveScan = async () => {
    const scanId = document.getElementById("scan_id").value;
    const scanName = document.getElementById("scan_name").value.trim();
    const stationId = document.getElementById("station_id").value;
    const hospitalFee = document.getElementById("hospital_fee").value;
    const readerFee = document.getElementById("reader_fee").value;

    if (!scanName || !stationId || hospitalFee === "" || readerFee === "") {
        alert("Please fill in all fields (including both fees).");
        return;
    }

    const jsonData = {
        scan_name: scanName,
        station_id: stationId,
        hospital_fee: parseFloat(hospitalFee),
        reader_fee: parseFloat(readerFee)
    };

    const isEdit = (scanId !== "");
    const operation = isEdit ? "updateScan" : "insertScan";

    if (isEdit) {
        jsonData.scan_id = scanId;
    }

    console.log(`[Action] Submitting ${operation} via POST:`, jsonData);

    const formData = new FormData();
    formData.append("operation", operation);
    formData.append("json", JSON.stringify(jsonData));

    try {
        const response = await axios({
            url: `${baseApiUrl}/scans.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] ${operation} completed successfully.`);
            alert(isEdit ? "Scan updated successfully!" : "Scan added successfully!");
            resetForm();
            displayScans();
        } else {
            console.warn(`[Failed] ${operation} returned non-success:`, response.data);
            alert("Error saving scan.");
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
    document.getElementById("scan_id").value = "";
    document.getElementById("scan_name").value = "";
    document.getElementById("station_id").value = "";
    document.getElementById("hospital_fee").value = "";
    document.getElementById("reader_fee").value = "";
    document.getElementById("total_fee_display").textContent = "₱ 0.00";

    document.getElementById("form-title").textContent = "Add New Scan / Diagnostic Procedure";
    document.getElementById("btnSubmit").textContent = "Submit";
    document.getElementById("btnCancel").style.display = "none";
    console.log("[UI] Form reset to Add mode.");
};

/**
 * Soft Delete / Restore (POST)
 */
const toggleScanStatus = async (scanId, currentStatus, name) => {
    const actionText = (currentStatus == 1) ? "SOFT DELETE (mark as inactive)" : "RESTORE (reactivate)";
    if (!confirm(`Are you sure you want to ${actionText} "${name}"?\n\n(Soft Delete keeps the record in the database so past bills remain intact)`)) {
        return;
    }

    console.log(`[Action] Toggling status for Scan ID: ${scanId} (Current: ${currentStatus})`);

    const formData = new FormData();
    formData.append("operation", "toggleStatus");
    formData.append("json", JSON.stringify({ scan_id: scanId }));

    try {
        const response = await axios({
            url: `${baseApiUrl}/scans.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] Status toggled successfully for Scan ID: ${scanId}`);
            displayScans();
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
const hardDeleteScan = async (scanId, name) => {
    if (!confirm(`WARNING: Are you sure you want to HARD DELETE (permanently remove) "${name}" from the database?\n\nThis action physically deletes the record from MySQL and cannot be undone!`)) {
        return;
    }

    console.log(`[Action] Attempting Hard Delete for Scan ID: ${scanId}`);

    const formData = new FormData();
    formData.append("operation", "hardDeleteScan");
    formData.append("json", JSON.stringify({ scan_id: scanId }));

    try {
        const response = await axios({
            url: `${baseApiUrl}/scans.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] Hard deleted Scan ID: ${scanId}`);
            alert(`"${name}" was permanently deleted from the database.`);
            displayScans();
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

