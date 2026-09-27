const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allDepartments = [];
let currentLoadedDepartment = null;

document.addEventListener("DOMContentLoaded", () => {
    displayDepartments();

    initModalControls("formModal", "btnOpenAddModal", "btnCloseModal", "btnCancel", resetForm);
    document.getElementById("btnSubmit").addEventListener("click", saveDepartment);

    const btnReset = document.getElementById("btnReset");
    if (btnReset) {
        btnReset.addEventListener("click", () => {
            if (currentLoadedDepartment) {
                populateDepartmentForm(currentLoadedDepartment);
            } else {
                resetForm();
            }
        });
    }

    document.getElementById("search_input").addEventListener("input", filterAndSortDepartments);
    document.getElementById("filter_status").addEventListener("change", filterAndSortDepartments);
    document.getElementById("sort_by").addEventListener("change", filterAndSortDepartments);
});

const displayDepartments = async () => {
    const tableDiv = document.getElementById("table-div");

    try {
        console.log("[API] Requesting: getAllDepartments");
        const response = await axios.get(`${getApiUrl}/departments.php`, {
            params: { operation: "getAllDepartments" }
        });

        if (response.status === 200) {
            allDepartments = response.data || [];
            console.log(`[API] Success: Loaded ${allDepartments.length} departments.`);
            filterAndSortDepartments();
        } else {
            console.error("[API] Error loading departments:", response);
            alert("Error loading departments!");
        }
    } catch (error) {
        console.error("[API] Network error:", error);
        tableDiv.innerHTML = `<p style="color: red;">Failed to connect to API.</p>`;
    }
};

const filterAndSortDepartments = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();
    const filterStatus = document.getElementById("filter_status").value;
    const sortBy = document.getElementById("sort_by").value;

    let filtered = allDepartments.filter(dept => {
        const code = `${dept.Code_Prefix || 'DEPT'}-${dept.Station_ID}`.toLowerCase();
        const prefix = (dept.Code_Prefix || '').toLowerCase();
        const deptName = (dept.Station_Name || '').toLowerCase();

        const matchesSearch = deptName.includes(searchTerm) || prefix.includes(searchTerm) || code.includes(searchTerm);

        let matchesStatus = true;
        if (filterStatus === "1") {
            matchesStatus = (dept.Is_Active == 1);
        } else if (filterStatus === "0") {
            matchesStatus = (dept.Is_Active == 0);
        }

        return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
        const codeA = `${a.Code_Prefix || 'DEPT'}-${a.Station_ID}`;
        const codeB = `${b.Code_Prefix || 'DEPT'}-${b.Station_ID}`;

        switch (sortBy) {
            case "name_asc":
                return a.Station_Name.localeCompare(b.Station_Name);
            case "name_desc":
                return b.Station_Name.localeCompare(a.Station_Name);
            case "code_asc":
                return (a.Code_Prefix || '').localeCompare(b.Code_Prefix || '');
            case "code_desc":
                return (b.Code_Prefix || '').localeCompare(a.Code_Prefix || '');
            case "id_desc":
                return parseInt(b.Station_ID) - parseInt(a.Station_ID);
            case "id_asc":
                return parseInt(a.Station_ID) - parseInt(b.Station_ID);
            default:
                return 0;
        }
    });

    console.log(`[UI] Filtered & Sorted: Displaying ${filtered.length} of ${allDepartments.length} departments`);
    displayDepartmentsTable(filtered);
};

const displayDepartmentsTable = (departments) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!departments || departments.length === 0) {
        tableDiv.innerHTML = "<p>No matching departments or clinical stations found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Station ID</th>
            <th>Code Prefix</th>
            <th>Department / Station Name</th>
            <th>Status</th>
            <th style="text-align: center; width: 110px;">Actions</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    departments.forEach(dept => {
        const formattedCode = `${dept.Code_Prefix || 'DEPT'}-${String(dept.Station_ID).padStart(3, '0')}`;
        const row = document.createElement("tr");
        row.className = "clickable-row";
        row.title = "Click to view / edit department";
        row.innerHTML = `
            <td><strong>${formattedCode}</strong></td>
            <td><span class="dept-code-pill">${dept.Code_Prefix || 'N/A'}</span></td>
            <td><strong>${dept.Station_Name}</strong></td>
            <td>${getStatusBadge(dept.Is_Active)}</td>
            <td style="text-align: center;" onclick="event.stopPropagation();">
                ${getActionButtons(dept.Station_ID, dept.Is_Active, dept.Station_Name, "Edit Department")}
            </td>
        `;
        row.addEventListener("click", () => loadDepartmentForEdit(dept.Station_ID));

        const editBtn = row.querySelector(".btn-action-edit");
        if (editBtn) {
            editBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                loadDepartmentForEdit(dept.Station_ID);
            });
        }

        const softDeleteBtn = row.querySelector(".btn-action-soft-delete");
        if (softDeleteBtn) {
            softDeleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleRecordStatus("departments.php", "station_id", dept.Station_ID, dept.Is_Active, dept.Station_Name, displayDepartments);
            });
        }

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);
};

const populateDepartmentForm = (dept) => {
    document.getElementById("station_id").value = dept.Station_ID || "";
    document.getElementById("station_name").value = dept.Station_Name || "";
    document.getElementById("code_prefix").value = dept.Code_Prefix || "";
};

const loadDepartmentForEdit = async (stationId) => {
    try {
        console.log(`[API] Requesting department details for ID: ${stationId}`);
        const response = await axios.get(`${getApiUrl}/departments.php`, {
            params: {
                operation: "getDepartmentById",
                json: JSON.stringify({ station_id: stationId })
            }
        });

        if (response.status === 200 && response.data) {
            const dept = response.data;
            currentLoadedDepartment = dept;
            populateDepartmentForm(dept);

            document.getElementById("form-title").textContent = `Edit Department (${dept.Code_Prefix || 'DEPT'}-${dept.Station_ID})`;
            document.getElementById("btnSubmit").textContent = "Update Department";

            const btnArchive = document.getElementById("btnArchive");
            if (btnArchive) {
                btnArchive.style.display = "inline-flex";
                const isActive = (dept.Is_Active == 1);
                btnArchive.className = isActive ? "btn btn-warning btn-archive" : "btn btn-success btn-restore";
                btnArchive.textContent = isActive ? "Send to Archive" : "Restore Record";
                btnArchive.onclick = () => {
                    toggleRecordStatus("departments.php", "station_id", dept.Station_ID, isActive ? 1 : 0, dept.Station_Name, () => {
                        closeModal();
                        displayDepartments();
                    });
                };
            }

            openModal();
        } else {
            alert("Error loading department details.");
        }
    } catch (error) {
        console.error("[API] Error fetching department:", error);
        alert("Failed to connect to API to fetch department details.");
    }
};

const resetForm = () => {
    currentLoadedDepartment = null;
    document.getElementById("station_id").value = "";
    document.getElementById("station_name").value = "";
    document.getElementById("code_prefix").value = "";

    document.getElementById("form-title").textContent = "Add New Department / Station";
    document.getElementById("btnSubmit").textContent = "Submit Department";

    const btnArchive = document.getElementById("btnArchive");
    if (btnArchive) {
        btnArchive.style.display = "none";
        btnArchive.onclick = null;
    }
};

const saveDepartment = async () => {
    const stationId = document.getElementById("station_id").value;
    const stationName = document.getElementById("station_name").value.trim();
    const codePrefix = document.getElementById("code_prefix").value.trim().toUpperCase();

    if (!stationName) {
        alert("Please enter the department / station name.");
        return;
    }

    if (!codePrefix) {
        alert("Please enter a short code prefix (e.g. NEURO, ICU).");
        return;
    }

    const isEdit = (stationId !== "");
    const operation = isEdit ? "updateDepartment" : "insertDepartment";

    const payload = {
        station_name: stationName,
        code_prefix: codePrefix
    };

    if (isEdit) {
        payload.station_id = stationId;
    }

    try {
        console.log(`[API] Submitting department payload (${operation}):`, payload);
        const formData = new FormData();
        formData.append("operation", operation);
        formData.append("json", JSON.stringify(payload));

        const response = await axios.post(`${postApiUrl}/departments.php`, formData);

        if (response.data == 1 || (response.data && response.data.status == 1)) {
            const successMsg = isEdit ? "Department updated successfully!" : "Department added successfully!";
            alert(successMsg, () => {
                closeModal();
                resetForm();
                displayDepartments();
            });
        } else if (response.data && response.data.message) {
            alert(response.data.message);
        } else {
            alert("Failed to save department.");
        }
    } catch (error) {
        console.error("[API] Submission error:", error);
        alert("Server error while saving department.");
    }
};
