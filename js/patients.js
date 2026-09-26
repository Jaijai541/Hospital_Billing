const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allPatients = [];
let currentLoadedPatient = null;

document.addEventListener("DOMContentLoaded", () => {
    loadPatientEnums();
    displayPatients();

    initModalControls("formModal", "btnOpenAddModal", "btnCloseModal", "btnCancel", resetForm);
    document.getElementById("btnSubmit").addEventListener("click", savePatient);

    const btnReset = document.getElementById("btnReset");
    if (btnReset) {
        btnReset.addEventListener("click", () => {
            if (currentLoadedPatient) {
                populatePatientForm(currentLoadedPatient);
            } else {
                resetForm();
            }
        });
    }

    const genderSelect = document.getElementById("gender_id");
    if (genderSelect) {
        genderSelect.addEventListener("change", () => {
            const selectedText = genderSelect.options[genderSelect.selectedIndex] ? genderSelect.options[genderSelect.selectedIndex].text.toLowerCase() : "";
            const isOther = selectedText.includes("other") || genderSelect.value === "3";
            const otherGroup = document.getElementById("gender_other_group");
            if (otherGroup) {
                otherGroup.style.display = isOther ? "block" : "none";
                if (isOther) {
                    const specInput = document.getElementById("gender_specification");
                    if (specInput) specInput.focus();
                } else {
                    const specInput = document.getElementById("gender_specification");
                    if (specInput) specInput.value = "";
                }
            }
        });
    }

    document.getElementById("search_input").addEventListener("input", filterAndSortPatients);
    document.getElementById("filter_status").addEventListener("change", filterAndSortPatients);
    document.getElementById("filter_blood").addEventListener("change", filterAndSortPatients);
    document.getElementById("sort_by").addEventListener("change", filterAndSortPatients);
});

const loadPatientEnums = async () => {
    try {
        console.log("[API] Requesting: getPatientEnums");
        const response = await axios.get(`${getApiUrl}/patients.php`, {
            params: { operation: "getPatientEnums" }
        });

        if (response.status === 200 && response.data) {
            const data = response.data;
            const genderSelect = document.getElementById("gender_id");
            const bloodSelect = document.getElementById("blood_type_id");
            const bloodFilter = document.getElementById("filter_blood");

            genderSelect.innerHTML = `<option value="">Select Gender...</option>`;
            data.genders.forEach(g => {
                const opt = document.createElement("option");
                opt.value = g.Gender_ID;
                opt.textContent = g.Gender_Name;
                genderSelect.appendChild(opt);
            });

            bloodSelect.innerHTML = `<option value="">Select Blood Type...</option>`;
            data.blood_types.forEach(b => {
                const opt = document.createElement("option");
                opt.value = b.Blood_Type_ID;
                opt.textContent = b.Blood_Type_Name;
                bloodSelect.appendChild(opt);

                const filterOpt = document.createElement("option");
                filterOpt.value = b.Blood_Type_ID;
                filterOpt.textContent = b.Blood_Type_Name;
                bloodFilter.appendChild(filterOpt);
            });
            console.log("[API] Lookups loaded successfully.");
        }
    } catch (error) {
        console.error("[API] Error loading patient lookups:", error);
    }
};

const displayPatients = async () => {
    const tableDiv = document.getElementById("table-div");

    try {
        console.log("[API] Requesting: getAllPatients");
        const response = await axios.get(`${getApiUrl}/patients.php`, {
            params: { operation: "getAllPatients" }
        });

        if (response.status === 200) {
            allPatients = response.data || [];
            console.log(`[API] Success: Loaded ${allPatients.length} patients.`);
            filterAndSortPatients();
        } else {
            console.error("[API] Error loading patients:", response);
            alert("Error loading patient records!");
        }
    } catch (error) {
        console.error("[API] Network error:", error);
        tableDiv.innerHTML = `<p style="color: red;">Failed to connect to API.</p>`;
    }
};

const filterAndSortPatients = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();
    const filterStatus = document.getElementById("filter_status").value;
    const filterBlood = document.getElementById("filter_blood").value;
    const sortBy = document.getElementById("sort_by").value;

    let filtered = allPatients.filter(pat => {
        const fullName = `${pat.First_Name} ${pat.Last_Name}`.toLowerCase();
        const code = (pat.Patient_Code || "").toLowerCase();

        const matchesSearch = fullName.includes(searchTerm) || code.includes(searchTerm);

        let matchesStatus = true;
        if (filterStatus === "active" || filterStatus === "1") {
            matchesStatus = (pat.Is_Active == 1 && (!pat.Latest_Admission_Status || pat.Latest_Admission_Status === ""));
        } else if (filterStatus === "admitted") {
            matchesStatus = (pat.Is_Active == 1 && pat.Latest_Admission_Status === "Admitted");
        } else if (filterStatus === "discharged") {
            matchesStatus = (pat.Is_Active == 1 && (pat.Latest_Admission_Status === "Discharged" || pat.Latest_Admission_Status === "Billed"));
        } else if (filterStatus === "archived" || filterStatus === "0") {
            matchesStatus = (pat.Is_Active == 0);
        }

        let matchesBlood = true;
        if (filterBlood !== "all") matchesBlood = (pat.Blood_Type_ID == filterBlood);

        return matchesSearch && matchesStatus && matchesBlood;
    });

    filtered.sort((a, b) => {
        switch (sortBy) {
            case "code_asc":
                return a.Patient_Code.localeCompare(b.Patient_Code, undefined, { numeric: true });
            case "code_desc":
                return b.Patient_Code.localeCompare(a.Patient_Code, undefined, { numeric: true });
            case "name_asc":
                return a.Last_Name.localeCompare(b.Last_Name);
            case "name_desc":
                return b.Last_Name.localeCompare(a.Last_Name);
            case "dob_desc":
                return new Date(b.Date_Of_Birth) - new Date(a.Date_Of_Birth);
            case "dob_asc":
                return new Date(a.Date_Of_Birth) - new Date(b.Date_Of_Birth);
            case "id_desc":
                return parseInt(b.Patient_ID) - parseInt(a.Patient_ID);
            default:
                return 0;
        }
    });

    console.log(`[UI] Displaying ${filtered.length} of ${allPatients.length} patients.`);
    displayPatientsTable(filtered);
};

const displayPatientsTable = (patients) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!patients || patients.length === 0) {
        tableDiv.innerHTML = "<p>No matching patient records found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Code</th>
            <th>Full Name</th>
            <th>Date of Birth</th>
            <th>Gender</th>
            <th>Blood Type</th>
            <th>Contact</th>
            <th>Emergency Contact</th>
            <th>Status</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    patients.forEach(pat => {
        const isActive = (pat.Is_Active == 1);
        const fullName = `${pat.Last_Name}, ${pat.First_Name}`;
        const emContact = pat.Emergency_Contact_Name ? `${pat.Emergency_Contact_Name} (${pat.Emergency_Contact_Number || 'N/A'})` : 'None';

        let statusBadge = "";
        if (!isActive) {
            statusBadge = '<span class="badge badge-danger">Archived</span>';
        } else if (pat.Latest_Admission_Status === "Admitted") {
            statusBadge = '<span class="badge badge-info">Admitted</span>';
        } else if (pat.Latest_Admission_Status === "Discharged" || pat.Latest_Admission_Status === "Billed") {
            statusBadge = '<span class="badge badge-warning">Discharged</span>';
        } else {
            statusBadge = '<span class="badge badge-success">Active</span>';
        }

        let genderDisplay = pat.Gender_Name;
        if (pat.Gender_Specification) {
            genderDisplay += `<br><small class="text-muted">(${pat.Gender_Specification})</small>`;
        }

        const row = document.createElement("tr");
        row.className = "clickable-row";
        row.title = "Click to view / edit patient details";
        row.innerHTML = `
            <td><strong>${pat.Patient_Code}</strong></td>
            <td><strong>${fullName}</strong></td>
            <td>${pat.Date_Of_Birth}</td>
            <td>${genderDisplay}</td>
            <td><span class="badge badge-info">${pat.Blood_Type_Name}</span></td>
            <td>${pat.Contact_Number || '<span class="text-muted">N/A</span>'}</td>
            <td><small>${emContact}</small></td>
            <td>${statusBadge}</td>
        `;
        row.addEventListener("click", () => loadPatientForEdit(pat.Patient_ID));
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);
};

const populatePatientForm = (p) => {
    document.getElementById("patient_id").value = p.Patient_ID || "";
    document.getElementById("first_name").value = p.First_Name || "";
    document.getElementById("last_name").value = p.Last_Name || "";
    document.getElementById("date_of_birth").value = p.Date_Of_Birth || "";
    document.getElementById("gender_id").value = p.Gender_ID || "";
    document.getElementById("blood_type_id").value = p.Blood_Type_ID || "";
    document.getElementById("contact_number").value = p.Contact_Number || "";
    document.getElementById("address").value = p.Address || "";
    document.getElementById("emergency_contact_name").value = p.Emergency_Contact_Name || "";
    document.getElementById("emergency_contact_number").value = p.Emergency_Contact_Number || "";

    const isOther = (p.Gender_ID == 3);
    const otherGroup = document.getElementById("gender_other_group");
    const specInput = document.getElementById("gender_specification");
    if (otherGroup) otherGroup.style.display = isOther ? "block" : "none";
    if (specInput) specInput.value = p.Gender_Specification || "";
};

const loadPatientForEdit = async (patientId) => {
    try {
        console.log(`[API] Requesting patient details for ID: ${patientId}`);
        const response = await axios.get(`${getApiUrl}/patients.php`, {
            params: {
                operation: "getPatientById",
                json: JSON.stringify({ patient_id: patientId })
            }
        });

        if (response.status === 200 && response.data) {
            const p = response.data;
            currentLoadedPatient = p;
            populatePatientForm(p);

            document.getElementById("form-title").textContent = `Edit Patient (${p.Patient_Code})`;
            document.getElementById("btnSubmit").textContent = "Update Patient";

            const btnArchive = document.getElementById("btnArchive");
            if (btnArchive) {
                btnArchive.style.display = "inline-flex";
                const isActive = (p.Is_Active == 1);
                btnArchive.className = isActive ? "btn btn-warning btn-archive" : "btn btn-success btn-restore";
                btnArchive.textContent = isActive ? "Send to Archive" : "Restore Record";
                btnArchive.onclick = () => {
                    const fullName = `${p.Last_Name}, ${p.First_Name}`;
                    toggleRecordStatus("patients.php", "patient_id", p.Patient_ID, isActive ? 1 : 0, fullName, () => {
                        closeModal();
                        displayPatients();
                    });
                };
            }

            openModal();
        }
    } catch (error) {
        console.error("[API] Error loading patient details:", error);
        alert("Failed to load patient record.");
    }
};

const savePatient = async () => {
    const patientId = document.getElementById("patient_id").value;
    const firstName = document.getElementById("first_name").value.trim();
    const lastName = document.getElementById("last_name").value.trim();
    const dob = document.getElementById("date_of_birth").value;
    const genderId = document.getElementById("gender_id").value;
    const bloodTypeId = document.getElementById("blood_type_id").value;
    const contact = document.getElementById("contact_number").value.trim();
    const address = document.getElementById("address").value.trim();
    const emName = document.getElementById("emergency_contact_name").value.trim();
    const emContact = document.getElementById("emergency_contact_number").value.trim();
    const genderSpec = document.getElementById("gender_specification") ? document.getElementById("gender_specification").value.trim() : "";

    if (!firstName || !lastName || !dob || !genderId || !bloodTypeId) {
        alert("Please fill in all required fields (First Name, Last Name, DOB, Gender, Blood Type).");
        return;
    }

    if (genderId == "3" && !genderSpec) {
        alert("Please specify the patient's gender preference.");
        const specInput = document.getElementById("gender_specification");
        if (specInput) specInput.focus();
        return;
    }

    const jsonData = {
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dob,
        gender_id: genderId,
        gender_specification: genderSpec,
        blood_type_id: bloodTypeId,
        contact_number: contact,
        address: address,
        emergency_contact_name: emName,
        emergency_contact_number: emContact
    };

    const isEdit = (patientId !== "");
    const operation = isEdit ? "updatePatient" : "insertPatient";

    if (isEdit) {
        jsonData.patient_id = patientId;
    }

    console.log(`[Action] Submitting ${operation} via POST:`, jsonData);

    const formData = new FormData();
    formData.append("operation", operation);
    formData.append("json", JSON.stringify(jsonData));

    try {
        const response = await axios({
            url: `${postApiUrl}/patients.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] ${operation} completed successfully.`);
            alert(isEdit ? "Patient updated successfully!" : "Patient registered successfully!");
            resetForm();
            closeModal();
            displayPatients();
        } else {
            console.warn(`[Failed] ${operation} returned:`, response.data);
            alert("Error saving patient record.");
        }
    } catch (error) {
        console.error("[Error] Save request failed:", error);
        alert("Server error occurred.");
    }
};

const resetForm = () => {
    currentLoadedPatient = null;

    document.getElementById("patient_id").value = "";
    document.getElementById("first_name").value = "";
    document.getElementById("last_name").value = "";
    document.getElementById("date_of_birth").value = "";
    document.getElementById("gender_id").value = "";
    document.getElementById("blood_type_id").value = "";
    document.getElementById("contact_number").value = "";
    document.getElementById("address").value = "";
    document.getElementById("emergency_contact_name").value = "";
    document.getElementById("emergency_contact_number").value = "";

    const specInput = document.getElementById("gender_specification");
    if (specInput) specInput.value = "";
    const otherGroup = document.getElementById("gender_other_group");
    if (otherGroup) otherGroup.style.display = "none";

    const btnArchive = document.getElementById("btnArchive");
    if (btnArchive) btnArchive.style.display = "none";

    document.getElementById("form-title").textContent = "Register New Patient";
    document.getElementById("btnSubmit").textContent = "Submit Patient";
};
