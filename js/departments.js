const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allDepartments = [];
let currentLoadedDepartment = null;
let currentDeptDoctors = [];
let currentDeptUsers = [];
let currentDeptOrders = [];

const switchDepartmentModalTab = (tabKey) => {
    const viewModal = document.getElementById("viewDepartmentModal");
    if (!viewModal) return;

    viewModal.querySelectorAll(".dept-modal-tab-btn").forEach(btn => {
        const isActive = btn.getAttribute("data-dept-tab") === tabKey;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    const doctorsPane = document.getElementById("dept-tab-pane-doctors");
    const usersPane = document.getElementById("dept-tab-pane-users");
    const ordersPane = document.getElementById("dept-tab-pane-orders");

    if (doctorsPane) {
        const showDoctors = (tabKey === "doctors");
        doctorsPane.classList.toggle("active", showDoctors);
        doctorsPane.classList.toggle("dept-tab-pane-hidden", !showDoctors);
        doctorsPane.style.display = showDoctors ? "block" : "none";
    }
    if (usersPane) {
        const showUsers = (tabKey === "users");
        usersPane.classList.toggle("active", showUsers);
        usersPane.classList.toggle("dept-tab-pane-hidden", !showUsers);
        usersPane.style.display = showUsers ? "block" : "none";
    }
    if (ordersPane) {
        const showOrders = (tabKey === "orders");
        ordersPane.classList.toggle("active", showOrders);
        ordersPane.classList.toggle("dept-tab-pane-hidden", !showOrders);
        ordersPane.style.display = showOrders ? "block" : "none";
    }
};

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
    const sortByElem = document.getElementById("sort_by"); if (sortByElem) sortByElem.addEventListener("change", filterAndSortDepartments);

    initRefreshBtn("btnRefreshDepartments", displayDepartments);

    const btnCloseView = document.getElementById("btnCloseViewDeptModal");
    if (btnCloseView) btnCloseView.addEventListener("click", closeViewDepartmentModal);
    const btnCloseViewBtn = document.getElementById("btnCloseViewDeptBtn");
    if (btnCloseViewBtn) btnCloseViewBtn.addEventListener("click", closeViewDepartmentModal);
    const viewModal = document.getElementById("viewDepartmentModal");
    if (viewModal) {
        viewModal.addEventListener("click", (e) => {
            if (e.target === viewModal) closeViewDepartmentModal();
        });
    }

    document.querySelectorAll(".dept-modal-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const tabKey = btn.getAttribute("data-dept-tab") || "doctors";
            switchDepartmentModalTab(tabKey);
        });
    });

    const deptDoctorsSearch = document.getElementById("view_dept_doctors_search");
    if (deptDoctorsSearch) {
        deptDoctorsSearch.addEventListener("input", renderFilteredDeptDoctors);
    }

    const deptUsersSearch = document.getElementById("view_dept_users_search");
    if (deptUsersSearch) {
        deptUsersSearch.addEventListener("input", renderFilteredDeptUsers);
    }
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
    const sortBy = document.getElementById("sort_by")?.value || "name_asc";

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
    if (typeof updateFilterCount === "function") {
        updateFilterCount(filtered.length, allDepartments.length, "departments");
    }
    displayDepartmentsTable(filtered);
};

const displayDepartmentsTable = (departments) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!departments || departments.length === 0) {
        tableDiv.innerHTML = typeof getEmptyStateHtml === "function"
            ? getEmptyStateHtml("🏥", "No departments or stations found", "Try searching for a different clinical department name or code.")
            : "<p>No matching departments or clinical stations found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            ${renderSortableTh("Department / Station", "Station_Name")}
            ${renderSortableTh("Assigned Personnel", "Staff_Count")}
            ${renderSortableTh("Active Orders & Alerts", "Pending_Orders_Count")}
            ${renderSortableTh("Status", "Status")}
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    departments.forEach(dept => {
        const formattedCode = `${dept.Code_Prefix || 'DEPT'}-${String(dept.Station_ID).padStart(3, '0')}`;
        const docCount = parseInt(dept.Active_Doctors_Count || 0, 10);
        const staffCount = parseInt(dept.Active_Staff_Count || 0, 10);
        const pendingCount = parseInt(dept.Pending_Orders_Count || 0, 10);

        let orderBadge = `<span class="badge badge-outline">0 Pending</span>`;
        if (pendingCount > 0) {
            orderBadge = `<span class="badge badge-warning font-bold">${pendingCount} Pending Order${pendingCount === 1 ? '' : 's'}</span>`;
        }

        const row = document.createElement("tr");
        row.className = "clickable-row";
        row.title = "Click to view department details & assigned personnel";
        row.innerHTML = `
            <td>
                <div class="table-primary-text font-bold">${dept.Station_Name}</div>
                <div class="table-sub-text"><code>${formattedCode}</code> &bull; <span class="dept-code-pill">${dept.Code_Prefix || 'N/A'}</span></div>
            </td>
            <td>
                <div class="table-sub-text-dark font-bold">${docCount} Active Doctor${docCount === 1 ? '' : 's'}</div>
                <div class="table-sub-text">${staffCount} Active Staff Member${staffCount === 1 ? '' : 's'}</div>
            </td>
            <td>${orderBadge}</td>
            <td>${getStatusBadge(dept.Is_Active)}</td>
        `;
        row.addEventListener("click", () => openViewDepartmentModal(dept.Station_ID));
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);
};

const renderFilteredDeptDoctors = () => {
    const docsCount = document.getElementById("view_dept_doctors_count");
    const docsEmpty = document.getElementById("view_dept_doctors_empty");
    const docsTbody = document.getElementById("view_dept_doctors_tbody");
    const searchInput = document.getElementById("view_dept_doctors_search");
    const searchTerm = (searchInput ? searchInput.value : "").trim().toLowerCase();

    const filtered = currentDeptDoctors.filter(d => {
        if (!searchTerm) return true;
        const code = (d.Formatted_Code || "").toLowerCase();
        const fullName = `dr. ${d.First_Name || ""} ${d.Last_Name || ""}`.toLowerCase();
        const typeName = (d.Doctor_Type_Name || "").toLowerCase();
        const statusStr = (d.Is_Active == 1 ? "active" : "archived");
        return code.includes(searchTerm) || fullName.includes(searchTerm) || typeName.includes(searchTerm) || statusStr.includes(searchTerm);
    });

    if (docsCount) {
        const total = currentDeptDoctors.length;
        docsCount.textContent = searchTerm
            ? `${filtered.length} of ${total} Doctors`
            : `${total} Doctor${total === 1 ? "" : "s"}`;
    }

    if (!docsTbody) return;
    docsTbody.innerHTML = "";

    if (filtered.length === 0) {
        if (docsEmpty) {
            docsEmpty.textContent = searchTerm
                ? "No assigned doctors match your search."
                : "No doctors assigned to this station.";
            docsEmpty.style.display = "block";
        }
    } else {
        if (docsEmpty) docsEmpty.style.display = "none";
        filtered.forEach(d => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <div class="table-primary-text font-bold">Dr. ${d.First_Name} ${d.Last_Name}</div>
                    <div class="table-sub-text"><code>${d.Formatted_Code}</code></div>
                </td>
                <td><span class="badge badge-primary">${d.Doctor_Type_Name}</span></td>
                <td>${getStatusBadge(d.Is_Active)}</td>
            `;
            docsTbody.appendChild(tr);
        });
    }
};

const renderFilteredDeptUsers = () => {
    const usersCount = document.getElementById("view_dept_users_count");
    const usersEmpty = document.getElementById("view_dept_users_empty");
    const usersTbody = document.getElementById("view_dept_users_tbody");
    const searchInput = document.getElementById("view_dept_users_search");
    const searchTerm = (searchInput ? searchInput.value : "").trim().toLowerCase();

    const filtered = currentDeptUsers.filter(u => {
        if (!searchTerm) return true;
        const code = (u.Formatted_Code || "").toLowerCase();
        const fullName = `${u.First_Name || ""} ${u.Last_Name || ""}`.toLowerCase();
        const username = (u.Username || "").toLowerCase();
        const roleName = (u.Role_Name || "").toLowerCase();
        const statusStr = (u.Is_Active == 1 ? "active" : "archived");
        return code.includes(searchTerm) || fullName.includes(searchTerm) || username.includes(searchTerm) || roleName.includes(searchTerm) || statusStr.includes(searchTerm);
    });

    if (usersCount) {
        const total = currentDeptUsers.length;
        usersCount.textContent = searchTerm
            ? `${filtered.length} of ${total} Staff`
            : `${total} Staff`;
    }

    if (!usersTbody) return;
    usersTbody.innerHTML = "";

    if (filtered.length === 0) {
        if (usersEmpty) {
            usersEmpty.textContent = searchTerm
                ? "No assigned staff or users match your search."
                : "No system users assigned to this station.";
            usersEmpty.style.display = "block";
        }
    } else {
        if (usersEmpty) usersEmpty.style.display = "none";
        filtered.forEach(u => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <div class="table-primary-text font-bold">${u.First_Name} ${u.Last_Name}</div>
                    <div class="table-sub-text"><code>${u.Formatted_Code}</code> &bull; <code class="staff-username-pill">@${u.Username}</code></div>
                </td>
                <td><span class="badge badge-secondary">${u.Role_Name}</span></td>
                <td>${getStatusBadge(u.Is_Active)}</td>
            `;
            usersTbody.appendChild(tr);
        });
    }
};

const openViewDepartmentModal = async (stationId) => {
    try {
        console.log(`[API] Fetching department details for ID: ${stationId}`);
        const response = await axios.get(`${getApiUrl}/departments.php`, {
            params: {
                operation: "getDepartmentById",
                json: JSON.stringify({ station_id: stationId })
            }
        });

        if (response.status === 200 && response.data) {
            const dept = response.data;
            currentLoadedDepartment = dept;

            const codeFormatted = `${dept.Code_Prefix || 'DEPT'}-${String(dept.Station_ID).padStart(3, '0')}`;
            document.getElementById("view-dept-title").textContent = `Department Details (${codeFormatted})`;
            document.getElementById("view_dept_name").textContent = dept.Station_Name || "";
            document.getElementById("view_dept_code").textContent = `Station Code: ${codeFormatted}`;

            const badge = document.getElementById("view_dept_status_badge");
            if (badge) {
                const isActive = (dept.Is_Active == 1);
                badge.className = isActive ? "badge badge-success" : "badge badge-danger";
                badge.textContent = isActive ? "Active" : "Archived";
            }

            currentDeptDoctors = dept.assigned_doctors || [];
            currentDeptUsers = dept.assigned_users || [];
            currentDeptOrders = dept.assigned_orders || [];

            const deptDoctorsSearch = document.getElementById("view_dept_doctors_search");
            if (deptDoctorsSearch) deptDoctorsSearch.value = "";
            const deptUsersSearch = document.getElementById("view_dept_users_search");
            if (deptUsersSearch) deptUsersSearch.value = "";

            renderFilteredDeptDoctors();
            renderFilteredDeptUsers();
            renderDeptOrders();

            const hasPending = currentDeptOrders.some(o => o.Status === "Requested" || o.Status === "Pending");
            switchDepartmentModalTab(hasPending ? "orders" : "doctors");

            const btnEdit = document.getElementById("btnOpenEditFromView");
            if (btnEdit) {
                btnEdit.onclick = () => {
                    closeViewDepartmentModal();
                    loadDepartmentForEdit(stationId);
                };
            }

            openModal("viewDepartmentModal");
        }
    } catch (error) {
        console.error("[API] Error fetching department details:", error);
        alert("Failed to load department details.");
    }
};

const closeViewDepartmentModal = () => {
    closeModal("viewDepartmentModal");
};

const renderDeptOrders = () => {
    const ordersCount = document.getElementById("view_dept_orders_count");
    const ordersEmpty = document.getElementById("view_dept_orders_empty");
    const ordersTbody = document.getElementById("view_dept_orders_tbody");

    const total = currentDeptOrders.length;
    const pendingCount = currentDeptOrders.filter(o => o.Status === "Requested" || o.Status === "Pending").length;

    if (ordersCount) {
        ordersCount.textContent = `${total} Order${total === 1 ? "" : "s"}${pendingCount > 0 ? ` (${pendingCount} Pending)` : ""}`;
        ordersCount.className = pendingCount > 0 ? "badge badge-warning dept-modal-tab-badge" : "badge badge-info dept-modal-tab-badge";
    }

    if (!ordersTbody) return;
    ordersTbody.innerHTML = "";

    if (total === 0) {
        if (ordersEmpty) {
            ordersEmpty.textContent = "No orders assigned to this station.";
            ordersEmpty.style.display = "block";
        }
    } else {
        if (ordersEmpty) ordersEmpty.style.display = "none";
        currentDeptOrders.forEach(o => {
            const tr = document.createElement("tr");
            const isScan = (o.Category_Type === "Equipment Scan" || o.Category_Type === "Service");
            let statusBadge = `<span class="badge-process badge-process-requested">${o.Status}</span>`;
            let actionBtn = `<span class="text-muted font-sm">Complete</span>`;

            if (o.Status === "Requested" || o.Status === "Pending") {
                statusBadge = `<span class="badge-process badge-process-requested">${isScan ? "Scan Requested" : "Requested"}</span>`;
                actionBtn = `<button type="button" class="btn btn-sm btn-primary" onclick="startPreparingDeptOrder(${o.Request_ID})">Start Preparing</button>`;
            } else if (o.Status === "Preparing") {
                statusBadge = `<span class="badge-process badge-process-preparing">${isScan ? "Preparing Equipment" : "Preparing"}</span>`;
                const prepText = isScan ? "Equipment Ready &amp; Alert Nurse" : "Mark Prepared &amp; Alert Nurse";
                actionBtn = `<button type="button" class="btn btn-sm btn-info" onclick="openSelectNurseModalGlobal(${o.Request_ID})">${prepText}</button>`;
            } else if (o.Status === "Prepared") {
                statusBadge = `<span class="badge-process badge-process-prepared">${isScan ? "Equipment Ready" : "Prepared (Ready)"}</span>`;
                actionBtn = `<span class="table-sub-text font-bold">${o.Assigned_Nurse_Name ? `Nurse: ${o.Assigned_Nurse_Name}` : "Nurse Alerted"}</span>`;
            } else if (o.Status === "Delivering" || o.Status === "In Transit") {
                statusBadge = `<span class="badge-process badge-process-delivering">${isScan ? "Escorting Patient" : "Out for Delivery"}</span>`;
                actionBtn = `<span class="table-sub-text font-bold">${o.Assigned_Nurse_Name ? `Nurse ${o.Assigned_Nurse_Name}` : "In Transit"}</span>`;
            } else if (o.Status === "Administered") {
                statusBadge = `<span class="badge-process badge-process-administered">Administered</span>`;
                actionBtn = '<span class="badge badge-success">Completed</span>';
            }

            const dosage = o.Dosage_Instructions ? `<div class="table-sub-text">Note: <em>${o.Dosage_Instructions}</em></div>` : '';

            tr.innerHTML = `
                <td>
                    <div class="table-primary-text font-bold text-primary">ORD-${String(o.Request_ID).padStart(3, '0')}</div>
                    <div class="table-sub-text"><strong>${o.Patient_Name}</strong> (${o.Room_Name || "Ward"} - ${o.Bed_Code || "Bed"})</div>
                </td>
                <td>
                    <div class="table-primary-text"><strong>${o.Item_Code || ""}</strong>: ${o.Item_Name} (${parseFloat(o.Quantity)} unit)</div>
                    ${dosage}
                    <div class="table-sub-text">${o.Doctor_Name} &bull; ${o.Request_Timestamp}</div>
                </td>
                <td>${statusBadge}</td>
                <td class="text-center">${actionBtn}</td>
            `;
            ordersTbody.appendChild(tr);
        });
    }
};

const startPreparingDeptOrder = (requestId) => {
    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    showPopupConfirm("Start preparing this requested item / procedure in department?\n\nThe ordering doctor will receive an alert that preparation is underway.", () => {
        const fd = new FormData();
        fd.append("operation", "startPreparingOrder");
        fd.append("json", JSON.stringify({
            request_id: requestId,
            user_id: user.user_id || user.User_ID
        }));
        axios.post(`${postApiUrl}/clinical_orders.php`, fd).then(res => {
            if (res.data.success) {
                alert(res.data.message);
                if (currentLoadedDepartment && currentLoadedDepartment.Station_ID) {
                    openViewDepartmentModal(currentLoadedDepartment.Station_ID);
                }
                displayDepartments();
                if (typeof fetchRealtimeNotifications === "function") fetchRealtimeNotifications();
            } else {
                alert(res.data.error || "Failed to start preparing order.");
            }
        });
    }, null, {
        title: "Start Preparation",
        confirmText: "Start Preparing",
        type: "info"
    });
};

const prepareDeptOrderInModal = (requestId) => {
    if (typeof openSelectNurseModalGlobal === "function") {
        openSelectNurseModalGlobal(requestId);
    }
};

window.startPreparingDeptOrder = startPreparingDeptOrder;
window.prepareDeptOrderInModal = prepareDeptOrderInModal;

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

            const formattedCode = `${dept.Code_Prefix || 'DEPT'}-${String(dept.Station_ID).padStart(3, '0')}`;
            document.getElementById("form-title").textContent = `Edit Department (${formattedCode})`;
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
