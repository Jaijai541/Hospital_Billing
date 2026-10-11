const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allStaff = [];
let rolesList = [];
let stationsList = [];

const loadRoles = async () => {
    const formData = new FormData();
    formData.append("operation", "getUserRoles");

    try {
        const response = await axios.post(`${getApiUrl}/users.php`, formData);
        rolesList = response.data || [];
        const roleFilter = document.getElementById("role_filter");

        if (roleFilter) {
            roleFilter.innerHTML = '<option value="all">All Roles</option>';
            rolesList.forEach(r => {
                roleFilter.innerHTML += `<option value="${r.Role_ID}">${r.Role_Name}</option>`;
            });
        }
    } catch (e) {
        rolesList = [];
    }
};

const loadStations = async () => {
    const formData = new FormData();
    formData.append("operation", "getDepartmentStations");

    try {
        const response = await axios.post(`${getApiUrl}/users.php`, formData);
        stationsList = response.data || [];
    } catch (e) {
        stationsList = [];
    }
};

const openRolePicker = async () => {
    if (!rolesList || rolesList.length === 0) {
        await loadRoles();
    }
    openGenericLookupPicker({
        title: "Select System Role",
        items: rolesList.map(r => ({
            id: r.Role_ID,
            text: r.Role_Name,
            subtext: `Access Role #${r.Role_ID}`
        })),
        selectedId: document.getElementById("staff_role_id").value,
        onSelect: (item) => {
            document.getElementById("staff_role_id").value = item.id;
            document.getElementById("staff_role_id_text").value = item.text;
        }
    });
};

const openStationPicker = async () => {
    if (!stationsList || stationsList.length === 0) {
        await loadStations();
    }
    const items = [
        {
            id: "",
            text: "General Administration",
            subtext: "Unassigned / Hospital-wide"
        },
        ...stationsList.map(s => ({
            id: s.Station_ID,
            text: s.Station_Name,
            subtext: s.Code_Prefix ? `Code: ${s.Code_Prefix}` : ""
        }))
    ];
    openGenericLookupPicker({
        title: "Select Department / Station",
        items: items,
        selectedId: document.getElementById("staff_station_id").value,
        onSelect: (item) => {
            document.getElementById("staff_station_id").value = item.id;
            document.getElementById("staff_station_id_text").value = item.text;
        }
    });
};

const loadStaff = () => {
    const formData = new FormData();
    formData.append("operation", "getUsers");
    formData.append("json", JSON.stringify({ status: "all" }));

    axios.post(`${getApiUrl}/users.php`, formData)
        .then(response => {
            allStaff = response.data || [];
            filterAndRenderStaff();
        })
        .catch(() => {
            allStaff = [];
            filterAndRenderStaff();
        });
};

const getRoleBadge = (roleName) => {
    const r = (roleName || "").toLowerCase();
    if (r.includes("admin")) {
        return `<span class="badge staff-role-badge-admin">${roleName}</span>`;
    } else if (r.includes("finance")) {
        return `<span class="badge staff-role-badge-finance">${roleName}</span>`;
    } else if (r.includes("nurse")) {
        return `<span class="badge staff-role-badge-nurse">${roleName}</span>`;
    }
    return `<span class="badge badge-secondary">${roleName}</span>`;
};

const filterAndRenderStaff = () => {
    const searchEl = document.getElementById("search_input");
    const query = searchEl ? searchEl.value.toLowerCase().trim() : "";

    const roleEl = document.getElementById("role_filter");
    const roleVal = roleEl ? roleEl.value : "all";

    const statusEl = document.getElementById("status_filter");
    const statusVal = statusEl ? statusEl.value : "all";

    const filtered = allStaff.filter(u => {
        const matchesQuery = !query
            || (u.First_Name && u.First_Name.toLowerCase().includes(query))
            || (u.Last_Name && u.Last_Name.toLowerCase().includes(query))
            || (u.Username && u.Username.toLowerCase().includes(query))
            || (u.User_Code && u.User_Code.toLowerCase().includes(query))
            || (u.Role_Name && u.Role_Name.toLowerCase().includes(query))
            || (u.Station_Name && u.Station_Name.toLowerCase().includes(query));

        const matchesRole = roleVal === "all" || String(u.Role_ID) === String(roleVal);

        let matchesStatus = true;
        if (statusVal === "active") {
            matchesStatus = parseInt(u.Is_Active, 10) === 1;
        } else if (statusVal === "archived") {
            matchesStatus = parseInt(u.Is_Active, 10) === 0;
        }

        return matchesQuery && matchesRole && matchesStatus;
    });

    renderStaffTable(filtered);
};

const renderStaffTable = (staff) => {
    const tableDiv = document.getElementById("table-div");
    if (!tableDiv) return;

    if (typeof updateFilterCount === "function") {
        updateFilterCount(staff.length, allStaff.length, "staff members");
    }

    if (!staff || staff.length === 0) {
        tableDiv.innerHTML = typeof getEmptyStateHtml === "function"
            ? getEmptyStateHtml("👥", "No staff accounts found", "No staff accounts match your search filter criteria.")
            : '<p><em>No staff accounts found.</em></p>';
        return;
    }

    let html = '<table class="data-table">';
    html += '<thead><tr>';
    html += '<th>Staff ID</th>';
    html += '<th>Full Name</th>';
    html += '<th>Username</th>';
    html += '<th>System Role</th>';
    html += '<th>Assigned Station</th>';
    html += '<th>Account Status</th>';
    html += '</tr></thead><tbody>';

    staff.forEach(u => {
        const isActive = parseInt(u.Is_Active, 10) === 1;
        const statusBadge = isActive
            ? '<span class="badge badge-success">Active</span>'
            : '<span class="badge badge-danger">Archived</span>';

        const roleBadge = getRoleBadge(u.Role_Name);

        html += `<tr class="clickable-row" onclick="openEditStaffModal(${u.User_ID})" title="Click to view / edit staff user account">`;
        html += `<td><span class="staff-code-pill">${u.User_Code}</span></td>`;
        html += `<td><strong>${u.Last_Name}, ${u.First_Name}</strong></td>`;
        html += `<td><code style="color: #0369a1; font-weight: 600; font-size: 13.5px;">@${u.Username}</code></td>`;
        html += `<td>${roleBadge}</td>`;
        html += `<td>${u.Station_Name || '<span class="text-muted">General Administration</span>'}</td>`;
        html += `<td>${statusBadge}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    tableDiv.innerHTML = html;
};

const escapeSingleQuotes = (str) => {
    return (str || "").replace(/'/g, "\\'");
};

const openAddStaffModal = () => {
    document.getElementById("staff_user_id").value = "";
    document.getElementById("staff_first_name").value = "";
    document.getElementById("staff_last_name").value = "";
    document.getElementById("staff_username").value = "";
    document.getElementById("staff_role_id").value = "";
    document.getElementById("staff_role_id_text").value = "";
    document.getElementById("staff_station_id").value = "";
    document.getElementById("staff_station_id_text").value = "";
    document.getElementById("staff_password").value = "";
    document.getElementById("staff_password").required = true;

    document.getElementById("staffModalTitle").textContent = "Add New Staff User";
    document.getElementById("staff_password_label").textContent = "Account Password *";
    document.getElementById("staff_password_help").textContent = "Initial password for account sign-in (min 4 characters).";
    document.getElementById("btnSaveStaff").textContent = "Create Staff Account";

    const btnArchive = document.getElementById("btnArchiveStaff");
    if (btnArchive) {
        btnArchive.style.display = "none";
        btnArchive.onclick = null;
    }

    const btnReset = document.getElementById("btnOpenResetFromEdit");
    if (btnReset) {
        btnReset.style.display = "none";
        btnReset.onclick = null;
    }

    openModal("staffModal");
};

const openEditStaffModal = (userId) => {
    const user = allStaff.find(u => String(u.User_ID) === String(userId));
    if (!user) return;

    document.getElementById("staff_user_id").value = user.User_ID;
    document.getElementById("staff_first_name").value = user.First_Name || "";
    document.getElementById("staff_last_name").value = user.Last_Name || "";
    document.getElementById("staff_username").value = user.Username || "";
    document.getElementById("staff_role_id").value = user.Role_ID || "";
    document.getElementById("staff_role_id_text").value = user.Role_Name || "";
    document.getElementById("staff_station_id").value = user.Station_ID || "";
    document.getElementById("staff_station_id_text").value = user.Station_Name || "General Administration";
    document.getElementById("staff_password").value = "";
    document.getElementById("staff_password").required = false;

    document.getElementById("staffModalTitle").textContent = `Edit Staff User: ${user.Full_Name}`;
    document.getElementById("staff_password_label").textContent = "Change Password (Optional)";
    document.getElementById("staff_password_help").textContent = "Leave blank to keep the current password unchanged.";
    document.getElementById("btnSaveStaff").textContent = "Save Changes";

    const btnArchive = document.getElementById("btnArchiveStaff");
    if (btnArchive) {
        if (parseInt(user.User_ID, 10) === 1) {
            btnArchive.style.display = "none";
            btnArchive.onclick = null;
        } else {
            const isActive = parseInt(user.Is_Active, 10) === 1;
            btnArchive.style.display = "inline-flex";
            btnArchive.className = isActive ? "btn btn-warning btn-archive" : "btn btn-success btn-restore";
            btnArchive.textContent = isActive ? "Send to Archive" : "Restore Account";
            btnArchive.onclick = () => {
                closeModal("staffModal");
                if (isActive) {
                    archiveStaff(user.User_ID, user.Full_Name);
                } else {
                    restoreStaff(user.User_ID, user.Full_Name);
                }
            };
        }
    }

    const btnReset = document.getElementById("btnOpenResetFromEdit");
    if (btnReset) {
        btnReset.style.display = "inline-flex";
        btnReset.onclick = () => {
            closeModal("staffModal");
            openResetPasswordModal(user.User_ID, user.Full_Name, user.Username);
        };
    }

    openModal("staffModal");
};

const saveStaffForm = (e) => {
    e.preventDefault();

    const userId = document.getElementById("staff_user_id").value;
    const firstName = document.getElementById("staff_first_name").value.trim();
    const lastName = document.getElementById("staff_last_name").value.trim();
    const username = document.getElementById("staff_username").value.trim();
    const roleId = document.getElementById("staff_role_id").value;
    const stationId = document.getElementById("staff_station_id").value;
    const password = document.getElementById("staff_password").value.trim();

    if (!firstName || !lastName || !username || !roleId) {
        showPopupAlert("Please fill in First Name, Last Name, Username, and System Role.", "warning");
        return;
    }

    if (!userId && !password) {
        showPopupAlert("Please enter a password for the new staff account.", "warning");
        return;
    }

    if (password && password.length < 4) {
        showPopupAlert("Password must be at least 4 characters long.", "warning");
        return;
    }

    const isEdit = !!userId;
    const operation = isEdit ? "updateUser" : "addUser";

    const payload = {
        first_name: firstName,
        last_name: lastName,
        username: username,
        role_id: roleId,
        station_id: stationId || null
    };

    if (isEdit) {
        payload.user_id = userId;
        if (password) payload.password = password;
    } else {
        payload.password = password;
    }

    const formData = new FormData();
    formData.append("operation", operation);
    formData.append("json", JSON.stringify(payload));

    axios.post(`${postApiUrl}/users.php`, formData)
        .then(response => {
            if (response.data && response.data.status === 1) {
                closeModal("staffModal");
                showPopupAlert(response.data.message || "Staff account saved successfully.", "success");
                loadStaff();
            } else {
                showPopupAlert((response.data && response.data.message) || "Failed to save staff account.", "error");
            }
        })
        .catch(() => {
            showPopupAlert("Network error while communicating with server.", "error");
        });
};

const archiveStaff = (userId, name) => {
    const user = allStaff.find(u => String(u.User_ID) === String(userId));
    const targetName = name || (user ? user.Full_Name : `Staff #${userId}`);

    showPopupConfirm(`Are you sure you want to ARCHIVE staff member "${targetName}"?\n\nThe user will no longer be able to log in, but their historical audit records and signatures will be preserved.`, () => {
        const formData = new FormData();
        formData.append("operation", "archiveUser");
        formData.append("json", JSON.stringify({ user_id: userId }));

        axios.post(`${postApiUrl}/users.php`, formData)
            .then(response => {
                if (response.data && response.data.status === 1) {
                    showPopupAlert(response.data.message || "Staff account archived.", "success");
                    loadStaff();
                } else {
                    showPopupAlert((response.data && response.data.message) || "Failed to archive staff account.", "error");
                }
            })
            .catch(() => {
                showPopupAlert("Network error while communicating with server.", "error");
            });
    }, null, {
        title: "Archive Staff Account",
        confirmText: "Archive Account",
        type: "warning"
    });
};

const restoreStaff = (userId, name) => {
    const user = allStaff.find(u => String(u.User_ID) === String(userId));
    const targetName = name || (user ? user.Full_Name : `Staff #${userId}`);

    showPopupConfirm(`Are you sure you want to RESTORE staff member "${targetName}" back to active status?`, () => {
        const formData = new FormData();
        formData.append("operation", "restoreUser");
        formData.append("json", JSON.stringify({ user_id: userId }));

        axios.post(`${postApiUrl}/users.php`, formData)
            .then(response => {
                if (response.data && response.data.status === 1) {
                    showPopupAlert(response.data.message || "Staff account restored.", "success");
                    loadStaff();
                } else {
                    showPopupAlert((response.data && response.data.message) || "Failed to restore staff account.", "error");
                }
            })
            .catch(() => {
                showPopupAlert("Network error while communicating with server.", "error");
            });
    }, null, {
        title: "Restore Staff Account",
        confirmText: "Restore Account",
        type: "info"
    });
};

const openResetPasswordModal = (userId, name, username) => {
    const user = allStaff.find(u => String(u.User_ID) === String(userId));
    const targetName = name || (user ? user.Full_Name : `Staff #${userId}`);
    const targetUsername = username || (user ? user.Username : "");

    document.getElementById("reset_user_id").value = userId;
    document.getElementById("reset_staff_name").textContent = targetName;
    document.getElementById("reset_staff_username").textContent = `@${targetUsername}`;
    document.getElementById("reset_new_password").value = "";
    document.getElementById("reset_confirm_password").value = "";

    openModal("resetPasswordModal");
};

const saveResetPassword = (e) => {
    e.preventDefault();

    const userId = document.getElementById("reset_user_id").value;
    const newPass = document.getElementById("reset_new_password").value.trim();
    const confPass = document.getElementById("reset_confirm_password").value.trim();

    if (!newPass) {
        showPopupAlert("Please enter a new password.", "warning");
        return;
    }

    if (newPass.length < 4) {
        showPopupAlert("Password must be at least 4 characters long.", "warning");
        return;
    }

    if (newPass !== confPass) {
        showPopupAlert("Passwords do not match. Please re-enter carefully.", "warning");
        return;
    }

    const formData = new FormData();
    formData.append("operation", "resetPassword");
    formData.append("json", JSON.stringify({
        user_id: userId,
        password: newPass
    }));

    axios.post(`${postApiUrl}/users.php`, formData)
        .then(response => {
            if (response.data && response.data.status === 1) {
                closeModal("resetPasswordModal");
                showPopupAlert(response.data.message || "Password updated successfully.", "success");
            } else {
                showPopupAlert((response.data && response.data.message) || "Failed to reset password.", "error");
            }
        })
        .catch(() => {
            showPopupAlert("Network error while communicating with server.", "error");
        });
};

const initStaffEvents = () => {
    const btnOpenAdd = document.getElementById("btnOpenAddStaffModal");
    if (btnOpenAdd) {
        btnOpenAdd.addEventListener("click", openAddStaffModal);
    }

    const btnCloseModal = document.getElementById("btnCloseStaffModal");
    if (btnCloseModal) {
        btnCloseModal.addEventListener("click", () => closeModal("staffModal"));
    }

    const btnCancelModal = document.getElementById("btnCancelStaffModal");
    if (btnCancelModal) {
        btnCancelModal.addEventListener("click", () => closeModal("staffModal"));
    }

    const staffForm = document.getElementById("staffForm");
    if (staffForm) {
        staffForm.addEventListener("submit", saveStaffForm);
    }

    const btnCloseReset = document.getElementById("btnCloseResetModal");
    if (btnCloseReset) {
        btnCloseReset.addEventListener("click", () => closeModal("resetPasswordModal"));
    }

    const btnCancelReset = document.getElementById("btnCancelResetModal");
    if (btnCancelReset) {
        btnCancelReset.addEventListener("click", () => closeModal("resetPasswordModal"));
    }

    const resetForm = document.getElementById("resetPasswordForm");
    if (resetForm) {
        resetForm.addEventListener("submit", saveResetPassword);
    }

    const searchInput = document.getElementById("search_input");
    if (searchInput) {
        searchInput.addEventListener("input", filterAndRenderStaff);
    }

    const roleFilter = document.getElementById("role_filter");
    if (roleFilter) {
        roleFilter.addEventListener("change", filterAndRenderStaff);
    }

    const statusFilter = document.getElementById("status_filter");
    if (statusFilter) {
        statusFilter.addEventListener("change", filterAndRenderStaff);
    }

    const btnRefresh = document.getElementById("btnRefresh");
    if (btnRefresh) {
        btnRefresh.addEventListener("click", loadStaff);
    }

    const roleInput = document.getElementById("staff_role_id_text");
    if (roleInput) {
        roleInput.addEventListener("click", openRolePicker);
    }
    const btnBrowseRole = document.getElementById("btnBrowse_staff_role_id");
    if (btnBrowseRole) {
        btnBrowseRole.addEventListener("click", openRolePicker);
    }

    const stationInput = document.getElementById("staff_station_id_text");
    if (stationInput) {
        stationInput.addEventListener("click", openStationPicker);
    }
    const btnBrowseStation = document.getElementById("btnBrowse_staff_station_id");
    if (btnBrowseStation) {
        btnBrowseStation.addEventListener("click", openStationPicker);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    initStaffEvents();
    loadRoles();
    loadStations();
    loadStaff();
});
