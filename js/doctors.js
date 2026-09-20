/**
 * Medical Doctors & Professional Fees Controller (Axios / Frontend)
 * Follows the Book example structure: dynamic table creation with border="1"
 * Handles Classifications, Departments, Round Fees, Search, Filter, Sort, and Console Logging
 */

const baseApiUrl = "http://localhost/Hospital_Billing/api";
let allDoctors = []; // In-memory cache for fast search, filter, and sort

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
    displayDoctorTypes();
    displayDepartments();
    displayDoctors();

    // 3. Form Event Listeners
    document.getElementById("btnSubmit").addEventListener("click", saveDoctor);
    document.getElementById("btnCancel").addEventListener("click", resetForm);

    // 4. Search, Filter, and Sort Listeners
    document.getElementById("search_input").addEventListener("input", filterAndSortDoctors);
    document.getElementById("filter_status").addEventListener("change", filterAndSortDoctors);
    document.getElementById("filter_type").addEventListener("change", filterAndSortDoctors);
    document.getElementById("filter_station").addEventListener("change", filterAndSortDoctors);
    document.getElementById("sort_by").addEventListener("change", filterAndSortDoctors);
});

/**
 * Fetch all doctors from API into memory and apply initial filter/sort
 */
const displayDoctors = async () => {
    const tableDiv = document.getElementById("table-div");

    try {
        console.log("[API] Requesting: getAllDoctors");
        const response = await axios.get(`${baseApiUrl}/doctors.php`, {
            params: { operation: "getAllDoctors" }
        });

        if (response.status === 200) {
            allDoctors = response.data || [];
            console.log(`[API] Success: Loaded ${allDoctors.length} doctors.`);
            filterAndSortDoctors();
        } else {
            console.error("[API] Error loading doctors:", response);
            alert("Error loading doctors directory!");
        }
    } catch (error) {
        console.error("[API] Network error:", error);
        tableDiv.innerHTML = `<p style="color: red;">Failed to connect to API.</p>`;
    }
};

/**
 * Search, Filter, and Sort the doctors list dynamically
 */
const filterAndSortDoctors = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();
    const filterStatus = document.getElementById("filter_status").value;
    const filterType = document.getElementById("filter_type").value;
    const filterStation = document.getElementById("filter_station").value;
    const sortBy = document.getElementById("sort_by").value;

    let filtered = allDoctors.filter(d => {
        const itemCode = `${d.Code_Prefix}-${d.Doctor_ID}`.toLowerCase();
        const fullName = `${d.First_Name} ${d.Last_Name}`.toLowerCase();
        const deptName = d.Station_Name.toLowerCase();

        // Search filter (by Name, Code, or Department)
        const matchesSearch = fullName.includes(searchTerm) || 
                              itemCode.includes(searchTerm) || 
                              deptName.includes(searchTerm);

        // Status filter (All, Active, Soft-Deleted)
        let matchesStatus = true;
        if (filterStatus === "1") {
            matchesStatus = (d.Is_Active == 1);
        } else if (filterStatus === "0") {
            matchesStatus = (d.Is_Active == 0);
        }

        // Classification filter
        let matchesType = true;
        if (filterType !== "all") {
            matchesType = (d.Doctor_Type_ID == filterType);
        }

        // Department filter
        let matchesStation = true;
        if (filterStation !== "all") {
            matchesStation = (d.Station_ID == filterStation);
        }

        return matchesSearch && matchesStatus && matchesType && matchesStation;
    });

    // Sorting logic
    filtered.sort((a, b) => {
        const codeA = `${a.Code_Prefix}-${a.Doctor_ID}`;
        const codeB = `${b.Code_Prefix}-${b.Doctor_ID}`;

        switch (sortBy) {
            case "code_asc":
                return codeA.localeCompare(codeB, undefined, { numeric: true });
            case "code_desc":
                return codeB.localeCompare(codeA, undefined, { numeric: true });
            case "name_asc":
                return a.Last_Name.localeCompare(b.Last_Name);
            case "name_desc":
                return b.Last_Name.localeCompare(a.Last_Name);
            case "fee_asc":
                return parseFloat(a.Base_Round_Fee) - parseFloat(b.Base_Round_Fee);
            case "fee_desc":
                return parseFloat(b.Base_Round_Fee) - parseFloat(a.Base_Round_Fee);
            case "id_desc":
                return parseInt(b.Doctor_ID) - parseInt(a.Doctor_ID);
            default:
                return 0;
        }
    });

    console.log(`[UI] Filtered & Sorted Doctors: Displaying ${filtered.length} of ${allDoctors.length} items`);
    displayDoctorsTable(filtered);
};

/**
 * Render pure HTML table matching Book/app.js pattern
 */
const displayDoctorsTable = (doctors) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!doctors || doctors.length === 0) {
        tableDiv.innerHTML = "<p>No matching doctors found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.border = "1";
    table.cellPadding = "5";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Code</th>
            <th>Doctor Name</th>
            <th>Classification</th>
            <th>Department / Specialty</th>
            <th>Base Bedside Round Fee</th>
            <th>Status</th>
            <th>Actions</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    doctors.forEach(d => {
        const isActive = (d.Is_Active == 1);
        const statusText = isActive ? "Active" : "Inactive (Soft Deleted)";
        const toggleAction = isActive ? "Soft Delete" : "Restore";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${d.Code_Prefix}-${d.Doctor_ID}</td>
            <td><strong>Dr. ${d.First_Name} ${d.Last_Name}</strong></td>
            <td>${d.Type_Name}</td>
            <td>${d.Station_Name}</td>
            <td>₱ ${parseFloat(d.Base_Round_Fee).toFixed(2)} / round</td>
            <td>${statusText}</td>
            <td>
                <button type="button" class="btn-action-edit" data-id="${d.Doctor_ID}">Edit</button>
                <button type="button" class="btn-action-soft-delete" data-id="${d.Doctor_ID}" data-status="${d.Is_Active}" data-name="Dr. ${d.Last_Name}">${toggleAction}</button>
                <button type="button" class="btn-action-hard-delete" data-id="${d.Doctor_ID}" data-name="Dr. ${d.Last_Name}">Hard Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);

    // Event delegation with semantic classes
    document.querySelectorAll(".btn-action-edit").forEach(btn => {
        btn.addEventListener("click", () => loadDoctorForEdit(btn.dataset.id));
    });

    document.querySelectorAll(".btn-action-soft-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            toggleDoctorStatus(btn.dataset.id, btn.dataset.status, btn.dataset.name);
        });
    });

    document.querySelectorAll(".btn-action-hard-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            hardDeleteDoctor(btn.dataset.id, btn.dataset.name);
        });
    });
};

/**
 * Fetch and populate doctor classifications (Resident, Attending)
 */
const displayDoctorTypes = async () => {
    const formSelect = document.getElementById("doctor_type_id");
    const filterSelect = document.getElementById("filter_type");

    try {
        console.log("[API] Requesting: getAllDoctorTypes");
        const response = await axios.get(`${baseApiUrl}/doctors.php`, {
            params: { operation: "getAllDoctorTypes" }
        });

        if (response.status === 200) {
            const types = response.data;
            formSelect.innerHTML = `<option value="">Select Classification...</option>`;
            filterSelect.innerHTML = `<option value="all">All Classifications</option>`;

            types.forEach(t => {
                const opt1 = document.createElement("option");
                opt1.value = t.Doctor_Type_ID;
                opt1.textContent = t.Type_Name;
                formSelect.appendChild(opt1);

                const opt2 = document.createElement("option");
                opt2.value = t.Doctor_Type_ID;
                opt2.textContent = t.Type_Name;
                filterSelect.appendChild(opt2);
            });
            console.log(`[API] Loaded ${types.length} doctor classifications.`);
        }
    } catch (error) {
        console.error("[API] Error loading doctor types:", error);
    }
};

/**
 * Fetch and populate clinical departments
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
                const opt1 = document.createElement("option");
                opt1.value = dept.Station_ID;
                opt1.textContent = dept.Station_Name;
                formSelect.appendChild(opt1);

                const opt2 = document.createElement("option");
                opt2.value = dept.Station_ID;
                opt2.textContent = dept.Station_Name;
                filterSelect.appendChild(opt2);
            });
            console.log(`[API] Loaded ${departments.length} departments for doctors.`);
        }
    } catch (error) {
        console.error("[API] Error loading departments:", error);
    }
};

/**
 * Load existing doctor data into form for editing
 */
const loadDoctorForEdit = async (doctorId) => {
    try {
        console.log(`[API] Requesting doctor details for ID: ${doctorId}`);
        const response = await axios.get(`${baseApiUrl}/doctors.php`, {
            params: {
                operation: "getDoctorById",
                json: JSON.stringify({ doctor_id: doctorId })
            }
        });

        if (response.status === 200 && response.data) {
            const d = response.data;
            document.getElementById("doctor_id").value = d.Doctor_ID;
            document.getElementById("first_name").value = d.First_Name;
            document.getElementById("last_name").value = d.Last_Name;
            document.getElementById("doctor_type_id").value = d.Doctor_Type_ID;
            document.getElementById("station_id").value = d.Station_ID;
            document.getElementById("base_round_fee").value = d.Base_Round_Fee;

            document.getElementById("form-title").textContent = `Edit Doctor (DR-${d.Doctor_ID}: Dr. ${d.Last_Name})`;
            document.getElementById("btnSubmit").textContent = "Update Doctor";
            document.getElementById("btnCancel").style.display = "inline";
            window.scrollTo({ top: 0, behavior: "smooth" });
            console.log("[UI] Form populated for edit:", d);
        }
    } catch (error) {
        console.error("[API] Error loading doctor details:", error);
        alert("Failed to load doctor details.");
    }
};

/**
 * Insert or Update Doctor (POST)
 */
const saveDoctor = async () => {
    const doctorId = document.getElementById("doctor_id").value;
    const firstName = document.getElementById("first_name").value.trim();
    const lastName = document.getElementById("last_name").value.trim();
    const doctorTypeId = document.getElementById("doctor_type_id").value;
    const stationId = document.getElementById("station_id").value;
    const baseRoundFee = document.getElementById("base_round_fee").value;

    if (!firstName || !lastName || !doctorTypeId || !stationId || baseRoundFee === "") {
        alert("Please fill in all required fields.");
        return;
    }

    const jsonData = {
        first_name: firstName,
        last_name: lastName,
        doctor_type_id: doctorTypeId,
        station_id: stationId,
        base_round_fee: parseFloat(baseRoundFee)
    };

    const isEdit = (doctorId !== "");
    const operation = isEdit ? "updateDoctor" : "insertDoctor";

    if (isEdit) {
        jsonData.doctor_id = doctorId;
    }

    console.log(`[Action] Submitting ${operation} via POST:`, jsonData);

    const formData = new FormData();
    formData.append("operation", operation);
    formData.append("json", JSON.stringify(jsonData));

    try {
        const response = await axios({
            url: `${baseApiUrl}/doctors.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] ${operation} completed successfully.`);
            alert(isEdit ? "Doctor updated successfully!" : "Doctor added successfully!");
            resetForm();
            displayDoctors();
        } else {
            console.warn(`[Failed] ${operation} returned non-success:`, response.data);
            alert("Error saving doctor.");
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
    document.getElementById("doctor_id").value = "";
    document.getElementById("first_name").value = "";
    document.getElementById("last_name").value = "";
    document.getElementById("doctor_type_id").value = "";
    document.getElementById("station_id").value = "";
    document.getElementById("base_round_fee").value = "";

    document.getElementById("form-title").textContent = "Add New Doctor";
    document.getElementById("btnSubmit").textContent = "Submit";
    document.getElementById("btnCancel").style.display = "none";
    console.log("[UI] Form reset to Add mode.");
};

/**
 * Soft Delete / Restore (POST)
 */
const toggleDoctorStatus = async (doctorId, currentStatus, name) => {
    const actionText = (currentStatus == 1) ? "SOFT DELETE (mark as inactive)" : "RESTORE (reactivate)";
    if (!confirm(`Are you sure you want to ${actionText} "${name}"?\n\n(Soft Delete keeps the doctor record in the database so past patient round charges remain intact)`)) {
        return;
    }

    console.log(`[Action] Toggling status for Doctor ID: ${doctorId} (Current: ${currentStatus})`);

    const formData = new FormData();
    formData.append("operation", "toggleStatus");
    formData.append("json", JSON.stringify({ doctor_id: doctorId }));

    try {
        const response = await axios({
            url: `${baseApiUrl}/doctors.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] Status toggled successfully for Doctor ID: ${doctorId}`);
            displayDoctors();
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
const hardDeleteDoctor = async (doctorId, name) => {
    if (!confirm(`WARNING: Are you sure you want to HARD DELETE (permanently remove) "${name}" from the database?\n\nThis action physically deletes the record from MySQL and cannot be undone!`)) {
        return;
    }

    console.log(`[Action] Attempting Hard Delete for Doctor ID: ${doctorId}`);

    const formData = new FormData();
    formData.append("operation", "hardDeleteDoctor");
    formData.append("json", JSON.stringify({ doctor_id: doctorId }));

    try {
        const response = await axios({
            url: `${baseApiUrl}/doctors.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] Hard deleted Doctor ID: ${doctorId}`);
            alert(`"${name}" was permanently deleted from the database.`);
            displayDoctors();
        } else if (response.data && response.data.message) {
            console.warn("[Protected] Hard delete blocked:", response.data.message);
            alert(response.data.message);
        } else {
            console.error("[Failed] Hard delete failed:", response.data);
            alert("Error: Could not permanently delete doctor.");
        }
    } catch (error) {
        console.error("[Error] Hard delete request failed:", error);
        alert("Server error during hard delete.");
    }
};
