/**
 * Medical Doctors & Professional Fees Controller (Axios / Frontend)
 * Follows classroom pure HTML standard: dynamic table creation with border="1"
 * Supports Multi-Specialty selection (Doctor_Specialty) and Code display (DR-xxx)
 */

const baseApiUrl = "http://localhost/Hospital_Billing/api";
let allDoctors = [];
let allSpecialties = [];

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

    // Initial Data Load
    loadDoctorLookups();
    displayDoctors();

    // Form Events
    document.getElementById("btnSubmit").addEventListener("click", saveDoctor);
    document.getElementById("btnCancel").addEventListener("click", resetForm);

    // Search, Filter, and Sort Listeners
    document.getElementById("search_input").addEventListener("input", filterAndSortDoctors);
    document.getElementById("filter_status").addEventListener("change", filterAndSortDoctors);
    document.getElementById("filter_type").addEventListener("change", filterAndSortDoctors);
    document.getElementById("filter_specialty").addEventListener("change", filterAndSortDoctors);
    document.getElementById("sort_by").addEventListener("change", filterAndSortDoctors);
});

/**
 * Load Doctor Types and Specialties
 */
const loadDoctorLookups = async () => {
    try {
        console.log("[API] Loading doctor types and specialties...");
        const [typesRes, specRes] = await Promise.all([
            axios.get(`${baseApiUrl}/doctors.php`, { params: { operation: "getAllDoctorTypes" } }),
            axios.get(`${baseApiUrl}/doctors.php`, { params: { operation: "getAllSpecialties" } })
        ]);

        if (typesRes.status === 200 && typesRes.data) {
            const typeSelect = document.getElementById("doctor_type_id");
            const filterType = document.getElementById("filter_type");
            typeSelect.innerHTML = `<option value="">Select Classification...</option>`;

            typesRes.data.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t.Doctor_Type_ID;
                opt.textContent = t.Type_Name;
                typeSelect.appendChild(opt);

                const filterOpt = document.createElement("option");
                filterOpt.value = t.Doctor_Type_ID;
                filterOpt.textContent = t.Type_Name;
                filterType.appendChild(filterOpt);
            });
        }

        if (specRes.status === 200 && specRes.data) {
            allSpecialties = specRes.data;
            const container = document.getElementById("specialties-checkboxes");
            const filterSpec = document.getElementById("filter_specialty");
            container.innerHTML = "";

            allSpecialties.forEach(s => {
                // Checkbox for form
                const label = document.createElement("label");
                label.style.marginRight = "15px";
                label.style.display = "inline-block";
                label.innerHTML = `
                    <input type="checkbox" name="specialty_checkbox" value="${s.Specialty_ID}">
                    ${s.Specialty_Name}
                `;
                container.appendChild(label);

                // Filter option
                const filterOpt = document.createElement("option");
                filterOpt.value = s.Specialty_ID;
                filterOpt.textContent = s.Specialty_Name;
                filterSpec.appendChild(filterOpt);
            });
        }
    } catch (error) {
        console.error("[API] Error loading lookups:", error);
    }
};

/**
 * Fetch all doctors
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
            alert("Error loading doctor records!");
        }
    } catch (error) {
        console.error("[API] Network error:", error);
        tableDiv.innerHTML = `<p style="color: red;">Failed to connect to API.</p>`;
    }
};

/**
 * Filter & sort doctors
 */
const filterAndSortDoctors = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();
    const filterStatus = document.getElementById("filter_status").value;
    const filterType = document.getElementById("filter_type").value;
    const filterSpec = document.getElementById("filter_specialty").value;
    const sortBy = document.getElementById("sort_by").value;

    let filtered = allDoctors.filter(doc => {
        const name = `${doc.First_Name} ${doc.Last_Name}`.toLowerCase();
        const code = (doc.Doctor_Code || "").toLowerCase();

        const matchesSearch = name.includes(searchTerm) || code.includes(searchTerm);

        let matchesStatus = true;
        if (filterStatus === "1") matchesStatus = (doc.Is_Active == 1);
        else if (filterStatus === "0") matchesStatus = (doc.Is_Active == 0);

        let matchesType = true;
        if (filterType !== "all") matchesType = (doc.Doctor_Type_ID == filterType);

        let matchesSpec = true;
        if (filterSpec !== "all") {
            const specIds = (doc.Specialty_IDs || "").split(",");
            matchesSpec = specIds.includes(filterSpec);
        }

        return matchesSearch && matchesStatus && matchesType && matchesSpec;
    });

    // Sort
    filtered.sort((a, b) => {
        switch (sortBy) {
            case "code_asc":
                return a.Doctor_Code.localeCompare(b.Doctor_Code, undefined, { numeric: true });
            case "code_desc":
                return b.Doctor_Code.localeCompare(a.Doctor_Code, undefined, { numeric: true });
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

    console.log(`[UI] Displaying ${filtered.length} of ${allDoctors.length} doctors.`);
    displayDoctorsTable(filtered);
};

/**
 * Render pure HTML table
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
            <th>Doctor Full Name</th>
            <th>Classification</th>
            <th>Medical Specialties</th>
            <th>Base Round Fee</th>
            <th>Status</th>
            <th>Actions</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    doctors.forEach(doc => {
        const isActive = (doc.Is_Active == 1);
        const statusText = isActive ? "Active" : "Inactive (Soft Deleted)";
        const toggleAction = isActive ? "Soft Delete" : "Restore";
        const fullName = `Dr. ${doc.First_Name} ${doc.Last_Name}`;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${doc.Doctor_Code}</strong></td>
            <td>${fullName}</td>
            <td>${doc.Type_Name}</td>
            <td>${doc.Specialties || 'General Practice'}</td>
            <td>₱ ${parseFloat(doc.Base_Round_Fee).toFixed(2)}</td>
            <td>${statusText}</td>
            <td>
                <button type="button" class="btn-action-edit" data-id="${doc.Doctor_ID}">Edit</button>
                <button type="button" class="btn-action-soft-delete" data-id="${doc.Doctor_ID}" data-status="${doc.Is_Active}" data-name="${fullName}">${toggleAction}</button>
                <button type="button" class="btn-action-hard-delete" data-id="${doc.Doctor_ID}" data-name="${fullName}">Hard Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);

    // Event delegation
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
 * Load doctor for edit
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
            const doc = response.data;
            document.getElementById("doctor_id").value = doc.Doctor_ID;
            document.getElementById("first_name").value = doc.First_Name;
            document.getElementById("last_name").value = doc.Last_Name;
            document.getElementById("doctor_type_id").value = doc.Doctor_Type_ID;
            document.getElementById("base_round_fee").value = doc.Base_Round_Fee;

            // Check checkboxes for specialties
            const assignedSpecs = doc.specialty_ids_array || [];
            document.querySelectorAll('input[name="specialty_checkbox"]').forEach(cb => {
                cb.checked = assignedSpecs.includes(cb.value);
            });

            document.getElementById("form-title").textContent = `Edit Doctor (${doc.Doctor_Code})`;
            document.getElementById("btnSubmit").textContent = "Update Doctor";
            document.getElementById("btnCancel").style.display = "inline";
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    } catch (error) {
        console.error("[API] Error loading doctor details:", error);
        alert("Failed to load doctor record.");
    }
};

/**
 * Save Doctor (Insert or Update via POST)
 */
const saveDoctor = async () => {
    const doctorId = document.getElementById("doctor_id").value;
    const firstName = document.getElementById("first_name").value.trim();
    const lastName = document.getElementById("last_name").value.trim();
    const typeId = document.getElementById("doctor_type_id").value;
    const fee = document.getElementById("base_round_fee").value;

    if (!firstName || !lastName || !typeId || fee === "") {
        alert("Please fill in First Name, Last Name, Classification, and Base Round Fee.");
        return;
    }

    // Collect selected specialties
    const selectedSpecialties = [];
    document.querySelectorAll('input[name="specialty_checkbox"]:checked').forEach(cb => {
        selectedSpecialties.push(cb.value);
    });

    const jsonData = {
        first_name: firstName,
        last_name: lastName,
        doctor_type_id: typeId,
        base_round_fee: parseFloat(fee),
        specialty_ids: selectedSpecialties
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
            alert(isEdit ? "Doctor updated successfully!" : "Doctor registered successfully!");
            resetForm();
            displayDoctors();
        } else {
            alert("Error saving doctor record.");
        }
    } catch (error) {
        console.error("[Error] Save failed:", error);
        alert("Server error occurred.");
    }
};

/**
 * Reset form
 */
const resetForm = () => {
    document.getElementById("doctor_id").value = "";
    document.getElementById("first_name").value = "";
    document.getElementById("last_name").value = "";
    document.getElementById("doctor_type_id").value = "";
    document.getElementById("base_round_fee").value = "";

    document.querySelectorAll('input[name="specialty_checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    document.getElementById("form-title").textContent = "Add New Doctor";
    document.getElementById("btnSubmit").textContent = "Submit Doctor";
    document.getElementById("btnCancel").style.display = "none";
};

/**
 * Soft Delete / Restore (POST)
 */
const toggleDoctorStatus = async (doctorId, currentStatus, name) => {
    const actionText = (currentStatus == 1) ? "SOFT DELETE (deactivate)" : "RESTORE (reactivate)";
    if (!confirm(`Are you sure you want to ${actionText} "${name}"?\n\n(Soft Delete preserves historical rounds and billing records)`)) {
        return;
    }

    console.log(`[Action] Toggling status for Doctor ID: ${doctorId}`);

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
            displayDoctors();
        } else {
            alert("Error updating doctor status.");
        }
    } catch (error) {
        console.error("[Error] Toggle failed:", error);
        alert("Error occurred.");
    }
};

/**
 * Hard Delete (POST)
 */
const hardDeleteDoctor = async (doctorId, name) => {
    if (!confirm(`WARNING: Are you sure you want to HARD DELETE "${name}" from MySQL?\n\nThis permanently removes the doctor and cannot be undone!`)) {
        return;
    }

    console.log(`[Action] Hard deleting Doctor ID: ${doctorId}`);

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
            alert(`"${name}" was permanently deleted.`);
            displayDoctors();
        } else if (response.data && response.data.message) {
            alert(response.data.message);
        } else {
            alert("Could not permanently delete doctor record.");
        }
    } catch (error) {
        console.error("[Error] Hard delete failed:", error);
        alert("Server error during deletion.");
    }
};
