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
            subtext: `${r.Access_Domain || 'Clinical'} Domain • ${parseInt(r.Is_Higher_Up, 10) === 1 ? "Higher-Up / Supervisor Access" : `Standard Staff Role #${r.Role_ID}`}`
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

const getRoleBadge = (roleName, accessDomain, isHigherUp) => {
    const r = (roleName || "").toLowerCase();
    const d = (accessDomain || "").toLowerCase();
    const higher = parseInt(isHigherUp, 10) === 1;

    if (d === "admin" || r.includes("admin")) {
        return `<span class="badge staff-role-badge-admin">${roleName}</span>`;
    }
    if (d === "hybrid" || r.includes("hybrid") || r.includes("ward clerk")) {
        return higher
            ? `<span class="badge" style="background-color: #f3e8ff; color: #6b21a8; border: 1px solid #d8b4fe; font-weight: 700;">${roleName}</span>`
            : `<span class="badge" style="background-color: #ede9fe; color: #5b21b6; border: 1px solid #c4b5fd;">${roleName}</span>`;
    }
    if (d === "finance" || r.includes("finance") || r.includes("billing") || r.includes("cashier")) {
        return higher
            ? `<span class="badge" style="background-color: #fce7f3; color: #be185d; border: 1px solid #f472b6; font-weight: 700;">${roleName}</span>`
            : `<span class="badge staff-role-badge-finance">${roleName}</span>`;
    }
    if (d === "clinical" || r.includes("nurse") || r.includes("clinical")) {
        return higher
            ? `<span class="badge" style="background-color: #dcfce7; color: #15803d; border: 1px solid #86efac; font-weight: 700;">${roleName}</span>`
            : `<span class="badge staff-role-badge-nurse">${roleName}</span>`;
    }
    if (higher) {
        return `<span class="badge" style="background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-weight: 700;">${roleName}</span>`;
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
    html += renderSortableTh("Staff Member & Account", "Full_Name");
    html += renderSortableTh("System Role", "Role_Name");
    html += renderSortableTh("Assigned Station", "Station_Name");
    html += renderSortableTh("Account Status", "Is_Active");
    html += '</tr></thead><tbody>';

    staff.forEach(u => {
        const isActive = parseInt(u.Is_Active, 10) === 1;
        const statusBadge = isActive
            ? '<span class="badge badge-success">Active</span>'
            : '<span class="badge badge-danger">Archived</span>';

        const roleBadge = getRoleBadge(u.Role_Name, u.Access_Domain, u.Is_Higher_Up);

        html += `<tr class="clickable-row" onclick="openEditStaffModal(${u.User_ID})" title="Click to view / edit staff user account">`;
        html += `<td>
            <div class="table-primary-text">${u.Last_Name}, ${u.First_Name}</div>
            <div class="table-sub-text"><span class="staff-code-pill">${u.User_Code}</span> &bull; <code class="staff-username-pill">@${u.Username}</code></div>
        </td>`;
        html += `<td>${roleBadge}</td>`;
        html += `<td><div class="table-sub-text-dark">${u.Station_Name || 'General Administration'}</div></td>`;
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

    const btnBrowseRole = document.getElementById("btnBrowse_staff_role_id");
    if (btnBrowseRole) btnBrowseRole.disabled = false;
    const roleText = document.getElementById("staff_role_id_text");
    if (roleText) roleText.title = "";
    const protectedNote = document.getElementById("staff_role_protected_note");
    if (protectedNote) protectedNote.style.display = "none";

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

    const activeAdminsCount = allStaff.filter(u => parseInt(u.Role_ID, 10) === 1 && parseInt(u.Is_Active, 10) === 1).length;
    const isSoleAdmin = (parseInt(user.Role_ID, 10) === 1 && activeAdminsCount <= 1) || parseInt(user.User_ID, 10) === 1;

    const btnBrowseRole = document.getElementById("btnBrowse_staff_role_id");
    const roleText = document.getElementById("staff_role_id_text");
    const protectedNote = document.getElementById("staff_role_protected_note");

    if (isSoleAdmin) {
        if (btnBrowseRole) btnBrowseRole.disabled = true;
        if (roleText) roleText.title = "Primary / Sole Administrator account role is protected to prevent system lockout.";
        if (protectedNote) protectedNote.style.display = "block";
    } else {
        if (btnBrowseRole) btnBrowseRole.disabled = false;
        if (roleText) roleText.title = "";
        if (protectedNote) protectedNote.style.display = "none";
    }

    document.getElementById("staffModalTitle").textContent = `Edit Staff User: ${user.Full_Name}`;
    document.getElementById("staff_password_label").textContent = "Change Password (Optional)";
    document.getElementById("staff_password_help").textContent = "Leave blank to keep the current password unchanged.";
    document.getElementById("btnSaveStaff").textContent = "Save Changes";

    const btnArchive = document.getElementById("btnArchiveStaff");
    if (btnArchive) {
        if (parseInt(user.User_ID, 10) === 1 || (parseInt(user.Role_ID, 10) === 1 && activeAdminsCount <= 1)) {
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

    const validFirst = typeof validatePersonName === "function" ? validatePersonName(firstName, "First Name", true) : { valid: !/\d/.test(firstName) };
    if (!validFirst.valid) {
        showPopupAlert(validFirst.message || "First Name cannot contain numbers. Please use letters only.", "warning");
        const el = document.getElementById("staff_first_name");
        if (el) el.focus();
        return;
    }

    const validLast = typeof validatePersonName === "function" ? validatePersonName(lastName, "Last Name", true) : { valid: !/\d/.test(lastName) };
    if (!validLast.valid) {
        showPopupAlert(validLast.message || "Last Name cannot contain numbers. Please use letters only.", "warning");
        const el = document.getElementById("staff_last_name");
        if (el) el.focus();
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
    if (isEdit) {
        const existingUser = allStaff.find(u => String(u.User_ID) === String(userId));
        if (existingUser) {
            const wasAdmin = parseInt(existingUser.Role_ID, 10) === 1;
            const willBeAdmin = parseInt(roleId, 10) === 1;
            const activeAdminsCount = allStaff.filter(u => parseInt(u.Role_ID, 10) === 1 && parseInt(u.Is_Active, 10) === 1).length;
            if (parseInt(existingUser.User_ID, 10) === 1 && !willBeAdmin) {
                showPopupAlert("Action blocked: The primary System Administrator account (User ID 1) cannot be demoted.", "danger");
                return;
            }
            if (wasAdmin && !willBeAdmin && activeAdminsCount <= 1) {
                showPopupAlert("Action blocked: Cannot change role. The system must maintain at least one active Administrator to prevent lockout.", "danger");
                return;
            }
        }
    }
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

const rolePresets = {
    nurse: {
        higher_up: 0,
        domain: "Clinical",
        pages: ["patients.html", "doctors.html", "rooms.html", "catalogs.html", "admissions.html"],
        actions: ["can_add", "can_print"]
    },
    head_nurse: {
        higher_up: 1,
        domain: "Clinical",
        pages: ["patients.html", "doctors.html", "rooms.html", "catalogs.html", "admissions.html"],
        actions: ["can_add", "can_delete", "can_print"]
    },
    finance: {
        higher_up: 0,
        domain: "Finance",
        pages: ["patients.html", "doctors.html", "rooms.html", "catalogs.html", "discounts.html", "invoices.html", "promissory_notes.html", "reports.html"],
        actions: ["can_add", "can_print"]
    },
    head_finance: {
        higher_up: 1,
        domain: "Finance",
        pages: ["patients.html", "doctors.html", "rooms.html", "catalogs.html", "discounts.html", "invoices.html", "promissory_notes.html", "reports.html"],
        actions: ["can_add", "can_delete", "can_print"]
    },
    ward_clerk: {
        higher_up: 0,
        domain: "Hybrid",
        pages: ["patients.html", "doctors.html", "rooms.html", "catalogs.html", "discounts.html", "admissions.html", "invoices.html", "promissory_notes.html", "reports.html"],
        actions: ["can_add", "can_print"]
    },
    head_ward_clerk: {
        higher_up: 1,
        domain: "Hybrid",
        pages: ["patients.html", "doctors.html", "rooms.html", "catalogs.html", "discounts.html", "admissions.html", "invoices.html", "promissory_notes.html", "reports.html"],
        actions: ["can_add", "can_delete", "can_print"]
    },
    hybrid: {
        higher_up: 0,
        domain: "Hybrid",
        pages: ["patients.html", "doctors.html", "rooms.html", "catalogs.html", "discounts.html", "admissions.html", "invoices.html", "promissory_notes.html", "reports.html"],
        actions: ["can_add", "can_print"]
    },
    head_hybrid: {
        higher_up: 1,
        domain: "Hybrid",
        pages: ["patients.html", "doctors.html", "rooms.html", "catalogs.html", "discounts.html", "admissions.html", "invoices.html", "promissory_notes.html", "reports.html"],
        actions: ["can_add", "can_delete", "can_print"]
    },
    admin: {
        higher_up: 1,
        domain: "Admin",
        pages: [
            "patients.html", "doctors.html", "departments.html", "rooms.html", "catalogs.html", "discounts.html",
            "admissions.html",
            "invoices.html", "promissory_notes.html",
            "reports.html",
            "staff.html", "audit_log.html", "archive.html"
        ],
        actions: ["can_add", "can_delete", "can_print"]
    },
    clear: {
        higher_up: null,
        domain: "Clinical",
        pages: [],
        actions: []
    }
};

const switchRolePermTab = (tabName) => {
    if (!tabName) return;
    document.querySelectorAll(".role-perm-tab").forEach(tab => {
        const isActive = tab.dataset.tab === tabName;
        tab.classList.toggle("active", isActive);
    });
    document.querySelectorAll(".role-perm-pane").forEach(pane => {
        if (pane.id === `pane-${tabName}`) {
            pane.classList.remove("role-perm-pane-hidden");
        } else {
            pane.classList.add("role-perm-pane-hidden");
        }
    });
};

const updateRolePermissionsSummary = () => {
    const checkedBoxes = Array.from(document.querySelectorAll(".role-perm-check:checked"));
    const total = document.querySelectorAll(".role-perm-check").length;
    const badge = document.getElementById("role_permissions_count_badge");
    if (badge) {
        badge.textContent = `${checkedBoxes.length} of ${total} modules selected`;
    }

    const checkedActionBoxes = Array.from(document.querySelectorAll(".role-action-perm-check:checked"));
    const totalActions = document.querySelectorAll(".role-action-perm-check").length;
    const actionBadge = document.getElementById("role_action_caps_count_badge");
    if (actionBadge) {
        actionBadge.textContent = `${checkedActionBoxes.length} of ${totalActions} capabilities enabled`;
    }

    const panes = ["master_files", "clinical_care", "billing_settlement", "reports_management", "system_tools"];
    panes.forEach(tabId => {
        const pane = document.getElementById(`pane-${tabId}`);
        const countBadge = document.getElementById(`tab-count-${tabId}`);
        if (pane && countBadge) {
            const count = pane.querySelectorAll(".role-perm-check:checked").length;
            countBadge.textContent = count > 0 ? `(${count})` : "";
        }
    });

    const checkedPages = checkedBoxes.map(cb => cb.value);
    const hasAdmin = checkedPages.some(p => ["staff.html", "audit_log.html", "archive.html", "departments.html"].includes(p));
    const hasClinical = checkedPages.includes("admissions.html");
    const hasFinance = checkedPages.some(p => ["invoices.html", "promissory_notes.html", "discounts.html", "reports.html"].includes(p));

    let domain = "Clinical";
    if (hasAdmin) {
        domain = "Admin";
    } else if (hasClinical && hasFinance) {
        domain = "Hybrid";
    } else if (hasFinance) {
        domain = "Finance";
    } else {
        domain = "Clinical";
    }

    const domainInput = document.getElementById("new_role_domain");
    if (domainInput) domainInput.value = domain;

    const domainBadge = document.getElementById("new_role_domain_badge");
    if (domainBadge) {
        domainBadge.textContent = `${domain} Domain`;
        if (domain === "Admin") {
            domainBadge.style.backgroundColor = "#eff6ff";
            domainBadge.style.color = "#1e3a8a";
            domainBadge.style.borderColor = "#bfdbfe";
        } else if (domain === "Finance") {
            domainBadge.style.backgroundColor = "#ecfdf5";
            domainBadge.style.color = "#065f46";
            domainBadge.style.borderColor = "#a7f3d0";
        } else if (domain === "Hybrid") {
            domainBadge.style.backgroundColor = "#f5f3ff";
            domainBadge.style.color = "#5b21b6";
            domainBadge.style.borderColor = "#ddd6fe";
        } else {
            domainBadge.style.backgroundColor = "#ecfeff";
            domainBadge.style.color = "#0e7490";
            domainBadge.style.borderColor = "#a5f3fc";
        }
    }
};

const applyRolePreset = (presetKey) => {
    const preset = rolePresets[presetKey];
    if (!preset) return;

    document.querySelectorAll(".btn-role-preset").forEach(btn => {
        const isActive = btn.dataset.preset === presetKey && presetKey !== "clear";
        btn.classList.toggle("active-preset", isActive);
    });

    document.querySelectorAll(".role-perm-check").forEach(cb => {
        cb.checked = preset.pages.includes(cb.value);
    });

    document.querySelectorAll(".role-action-perm-check").forEach(cb => {
        cb.checked = Array.isArray(preset.actions) ? preset.actions.includes(cb.value) : false;
    });

    if (preset.higher_up !== null) {
        const higherUpCb = document.getElementById("new_role_is_higher_up");
        if (higherUpCb && !higherUpCb.disabled) {
            higherUpCb.checked = preset.higher_up === 1;
        }
    }

    updateRolePermissionsSummary();
};

window.applyRolePreset = applyRolePreset;
window.switchRolePermTab = switchRolePermTab;

const openManageRolesModal = async () => {
    cancelEditRole();
    if (!rolesList || rolesList.length === 0) {
        await loadRoles();
    }
    renderRolesManageList();
    openModal("manageRolesModal");
    const nameInput = document.getElementById("new_role_name");
    if (nameInput) {
        nameInput.focus();
    }
};
window.openManageRolesModal = openManageRolesModal;

const closeManageRolesModal = () => {
    closeModal("manageRolesModal");
    cancelEditRole();
};

const startEditRole = (r) => {
    const editIdInput = document.getElementById("edit_role_id");
    const nameInput = document.getElementById("new_role_name");
    const higherUpCb = document.getElementById("new_role_is_higher_up");
    const modeTitle = document.getElementById("role_form_mode_title");
    const btnSubmit = document.getElementById("btnSubmitRole");
    const btnCancel = document.getElementById("btnCancelEditRole");

    const isCoreAdmin = parseInt(r.Role_ID, 10) === 1;

    if (editIdInput) editIdInput.value = r.Role_ID;
    if (nameInput) nameInput.value = r.Role_Name;
    if (higherUpCb) {
        higherUpCb.checked = parseInt(r.Is_Higher_Up, 10) === 1;
        higherUpCb.disabled = isCoreAdmin;
    }
    if (modeTitle) {
        modeTitle.innerHTML = `Edit Role: <strong>${r.Role_Name}</strong>`;
    }
    if (btnSubmit) {
        btnSubmit.textContent = "Save Changes";
    }
    if (btnCancel) {
        btnCancel.style.display = "inline-block";
    }

    let perms = r.Permissions;
    if (typeof perms === "string") {
        try {
            perms = JSON.parse(perms);
        } catch (e) {
            perms = null;
        }
    }
    if (!Array.isArray(perms)) {
        const presetKey = isCoreAdmin ? "admin" : (r.Access_Domain ? r.Access_Domain.toLowerCase() : "clinical");
        perms = rolePresets[presetKey] ? rolePresets[presetKey].pages : [];
    }

    document.querySelectorAll(".role-perm-check").forEach(cb => {
        cb.checked = perms.includes(cb.value);
        cb.disabled = isCoreAdmin;
    });

    document.querySelectorAll(".role-action-perm-check").forEach(cb => {
        cb.checked = perms.includes(cb.value);
        cb.disabled = isCoreAdmin;
    });

    document.querySelectorAll(".btn-role-preset").forEach(btn => {
        btn.disabled = isCoreAdmin;
    });

    updateRolePermissionsSummary();
    switchRolePermTab("master_files");

    if (nameInput) {
        nameInput.focus();
    }
};

const cancelEditRole = () => {
    const editIdInput = document.getElementById("edit_role_id");
    const nameInput = document.getElementById("new_role_name");
    const higherUpCb = document.getElementById("new_role_is_higher_up");
    const modeTitle = document.getElementById("role_form_mode_title");
    const btnSubmit = document.getElementById("btnSubmitRole");
    const btnCancel = document.getElementById("btnCancelEditRole");

    if (editIdInput) editIdInput.value = "";
    if (nameInput) nameInput.value = "";
    if (higherUpCb) {
        higherUpCb.checked = false;
        higherUpCb.disabled = false;
    }
    if (modeTitle) {
        modeTitle.textContent = "Add New System Role";
    }
    if (btnSubmit) {
        btnSubmit.textContent = "+ Add Role";
    }
    if (btnCancel) {
        btnCancel.style.display = "none";
    }

    document.querySelectorAll(".role-perm-check").forEach(cb => {
        cb.checked = false;
        cb.disabled = false;
    });

    document.querySelectorAll(".role-action-perm-check").forEach(cb => {
        cb.checked = cb.value !== "can_delete";
        cb.disabled = false;
    });

    document.querySelectorAll(".btn-role-preset").forEach(btn => {
        btn.disabled = false;
    });

    switchRolePermTab("master_files");
    updateRolePermissionsSummary();
};

const renderRolesManageList = () => {
    const listContainer = document.getElementById("roles-manage-list");
    const countBadge = document.getElementById("roles_badge_count");
    if (countBadge) {
        countBadge.textContent = `${rolesList ? rolesList.length : 0} Active`;
    }
    if (!listContainer) return;
    listContainer.innerHTML = "";

    if (!rolesList || rolesList.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 25px 15px; color: var(--text-muted); background: #ffffff; border-radius: 6px; border: 1px dashed var(--border-color);">
                <div style="font-weight: 600; font-size: 13.5px; color: var(--text-main);">No system roles found</div>
                <div style="font-size: 12px; margin-top: 2px;">Add your first system role using the form above.</div>
            </div>
        `;
        return;
    }

    rolesList.forEach(r => {
        const item = document.createElement("div");
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        item.style.padding = "10px 12px";
        item.style.background = "#ffffff";
        item.style.border = "1px solid var(--border-color)";
        item.style.borderRadius = "6px";
        item.style.boxShadow = "0 1px 2px rgba(0,0,0,0.02)";
        item.style.transition = "all 0.15s ease";

        const isCoreAdmin = parseInt(r.Role_ID, 10) === 1;
        const isHigherUp = parseInt(r.Is_Higher_Up, 10) === 1;

        const domain = r.Access_Domain || "Clinical";
        let domainBadge = "";
        if (domain === "Admin") {
            domainBadge = `<span class="badge" style="background-color: #eff6ff; color: #1e3a8a; border: 1px solid #bfdbfe; font-size: 11px; padding: 2px 7px; font-weight: 600;">Admin Domain</span>`;
        } else if (domain === "Finance") {
            domainBadge = `<span class="badge" style="background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 11px; padding: 2px 7px; font-weight: 600;">Finance Domain</span>`;
        } else if (domain === "Hybrid") {
            domainBadge = `<span class="badge" style="background-color: #f5f3ff; color: #5b21b6; border: 1px solid #ddd6fe; font-size: 11px; padding: 2px 7px; font-weight: 600;">Hybrid Domain</span>`;
        } else {
            domainBadge = `<span class="badge" style="background-color: #ecfeff; color: #0e7490; border: 1px solid #a5f3fc; font-size: 11px; padding: 2px 7px; font-weight: 600;">Clinical Domain</span>`;
        }

        const higherUpBadge = isHigherUp
            ? `<span class="badge" style="background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-weight: 700; font-size: 11px; padding: 2px 7px;">Higher-Up / Supervisor</span>`
            : `<span class="badge" style="background-color: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; font-weight: 600; font-size: 11px; padding: 2px 7px;">Standard Role</span>`;

        let perms = r.Permissions;
        if (typeof perms === "string") {
            try {
                perms = JSON.parse(perms);
            } catch (e) {
                perms = null;
            }
        }
        const permArray = Array.isArray(perms) ? perms : [];
        const moduleCount = permArray.filter(p => typeof p === "string" && p.endsWith(".html")).length;
        const modulesBadge = `<span class="badge" style="background-color: #f8fafc; color: #475569; border: 1px solid #cbd5e1; font-size: 11px; padding: 2px 7px;">${moduleCount} Modules</span>`;

        const canAdd = permArray.includes("can_add") || isCoreAdmin;
        const canDel = permArray.includes("can_delete") || isHigherUp || isCoreAdmin;
        const canPrt = permArray.includes("can_print") || isCoreAdmin;

        const actionBadges = `
            <span class="badge" style="background-color: ${canAdd ? '#ecfdf5' : '#f8fafc'}; color: ${canAdd ? '#065f46' : '#94a3b8'}; border: 1px solid ${canAdd ? '#a7f3d0' : '#e2e8f0'}; font-size: 10.5px; padding: 1px 6px;" title="${canAdd ? 'Can Add/Admit Records' : 'Cannot Add/Admit Records'}">${canAdd ? '+ Add Data' : 'No Add'}</span>
            <span class="badge" style="background-color: ${canDel ? '#fef2f2' : '#f8fafc'}; color: ${canDel ? '#991b1b' : '#94a3b8'}; border: 1px solid ${canDel ? '#fecaca' : '#e2e8f0'}; font-size: 10.5px; padding: 1px 6px;" title="${canDel ? 'Can Archive/Delete' : 'Cannot Archive/Delete'}">${canDel ? 'Archive/Delete' : 'No Delete'}</span>
            <span class="badge" style="background-color: ${canPrt ? '#eff6ff' : '#f8fafc'}; color: ${canPrt ? '#1e3a8a' : '#94a3b8'}; border: 1px solid ${canPrt ? '#bfdbfe' : '#e2e8f0'}; font-size: 10.5px; padding: 1px 6px;" title="${canPrt ? 'Can Print Documents' : 'Cannot Print Documents'}">${canPrt ? 'Print Access' : 'No Print'}</span>
        `;

        const userCount = parseInt(r.User_Count || 0, 10);
        const userText = userCount === 1 ? "1 staff assigned" : `${userCount} staff assigned`;

        const deleteActionHtml = isCoreAdmin
            ? `<span class="badge" style="background: #f1f5f9; color: #94a3b8; font-size: 11px; padding: 4px 8px; border-radius: 4px;" title="Primary Administrator role is protected and cannot be deleted">Core Role</span>`
            : `<button type="button" class="btn btn-sm btn-outline btn-remove-role" style="width: 28px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--danger); border-color: #fecaca; border-radius: 5px;" title="Remove Role" aria-label="Remove">✕</button>`;

        item.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="font-size: 14px; font-weight: 700; color: var(--text-main);">${r.Role_Name}</span>
                    ${domainBadge}
                    ${higherUpBadge}
                    ${modulesBadge}
                    ${actionBadges}
                </div>
                <div style="font-size: 11.5px; color: var(--text-muted);">${userText}</div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
                <button type="button" class="btn btn-sm btn-outline btn-edit-role" style="width: 28px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; border-radius: 5px; color: var(--text-main);" title="Edit Role" aria-label="Edit">✎</button>
                ${deleteActionHtml}
            </div>
        `;

        const btnEdit = item.querySelector(".btn-edit-role");
        if (btnEdit) {
            btnEdit.addEventListener("click", () => startEditRole(r));
        }

        const btnRemove = item.querySelector(".btn-remove-role");
        if (btnRemove) {
            btnRemove.addEventListener("click", () => promptRemoveRole(r));
        }

        listContainer.appendChild(item);
    });
};
const promptRemoveRole = (r) => {
    const userCount = parseInt(r.User_Count || 0, 10);
    let confirmMsg = `Are you sure you want to remove the system role "${r.Role_Name}"?`;
    if (userCount > 0) {
        confirmMsg += `\n\nThere are currently ${userCount} staff member(s) assigned to this role. It will be safely deactivated from new selections while preserving their existing accounts.`;
    } else {
        confirmMsg += `\n\nThis role is not currently assigned to any staff users and will be deleted.`;
    }

    showPopupConfirm(confirmMsg, async () => {
        try {
            const formData = new FormData();
            formData.append("operation", "deleteRole");
            formData.append("json", JSON.stringify({ role_id: r.Role_ID }));

            const response = await axios.post(`${postApiUrl}/users.php`, formData);
            if (response.data && response.data.status === 1) {
                await loadRoles();
                cancelEditRole();
                renderRolesManageList();
                loadStaff();
                showPopupAlert(response.data.message || "Role removed successfully.", "success");
            } else {
                showPopupAlert((response.data && response.data.message) || "Failed to remove role.", "error");
            }
        } catch (error) {
            showPopupAlert("Server error while removing role.", "error");
        }
    }, null, {
        title: "Remove System Role",
        confirmText: "Remove Role",
        type: "warning"
    });
};

const submitRole = async () => {
    const editIdInput = document.getElementById("edit_role_id");
    const editId = editIdInput ? editIdInput.value.trim() : "";

    const nameInput = document.getElementById("new_role_name");
    const roleName = nameInput ? nameInput.value.trim() : "";
    const domainInput = document.getElementById("new_role_domain");
    const accessDomain = domainInput ? domainInput.value : "Clinical";
    const isHigherUp = document.getElementById("new_role_is_higher_up")?.checked ? 1 : 0;

    if (!roleName) {
        showPopupAlert("Please enter a role title/name.", "warning");
        if (nameInput) nameInput.focus();
        return;
    }

    const checkedBoxes = Array.from(document.querySelectorAll(".role-perm-check:checked"));
    const checkedActionBoxes = Array.from(document.querySelectorAll(".role-action-perm-check:checked"));
    const permissions = [
        ...checkedBoxes.map(cb => cb.value),
        ...checkedActionBoxes.map(cb => cb.value)
    ];

    if (checkedBoxes.length === 0) {
        showPopupAlert("Please select at least one module access permission for this role.", "warning");
        return;
    }

    const isEdit = Boolean(editId);
    const operation = isEdit ? "updateRole" : "addRole";
    const payload = {
        role_name: roleName,
        access_domain: accessDomain,
        is_higher_up: isHigherUp,
        permissions: permissions
    };
    if (isEdit) {
        payload.role_id = parseInt(editId, 10);
    }

    const formData = new FormData();
    formData.append("operation", operation);
    formData.append("json", JSON.stringify(payload));

    try {
        const response = await axios.post(`${postApiUrl}/users.php`, formData);
        if (response.data && response.data.status === 1) {
            showPopupAlert(response.data.message || "System role saved successfully.", "success");
            cancelEditRole();
            await loadRoles();
            renderRolesManageList();
            loadStaff();

            const staffRoleId = document.getElementById("staff_role_id");
            const staffRoleIdText = document.getElementById("staff_role_id_text");
            const staffModal = document.getElementById("staffModal");

            if (staffModal && staffModal.style.display !== "none" && staffRoleId && staffRoleIdText) {
                if (!isEdit || String(staffRoleId.value) === String(editId)) {
                    staffRoleId.value = response.data.role_id || editId;
                    staffRoleIdText.value = response.data.role_name || roleName;
                }
            }
        } else {
            showPopupAlert((response.data && response.data.message) || "Failed to save system role.", "error");
        }
    } catch (err) {
        showPopupAlert("Network error while saving system role.", "error");
    }
};

const initStaffEvents = () => {
    const btnOpenAdd = document.getElementById("btnOpenAddStaffModal");
    if (btnOpenAdd) {
        btnOpenAdd.addEventListener("click", openAddStaffModal);
    }

    const btnOpenManageRolesTopbar = document.getElementById("btnOpenManageRolesModalTopbar");
    if (btnOpenManageRolesTopbar) {
        btnOpenManageRolesTopbar.addEventListener("click", openManageRolesModal);
    }

    const btnOpenManageRolesInline = document.getElementById("btnOpenManageRolesModalInline");
    if (btnOpenManageRolesInline) {
        btnOpenManageRolesInline.addEventListener("click", openManageRolesModal);
    }

    const btnCloseManageRoles = document.getElementById("btnCloseManageRolesModal");
    if (btnCloseManageRoles) {
        btnCloseManageRoles.addEventListener("click", closeManageRolesModal);
    }

    const btnCancelManageRoles = document.getElementById("btnCancelManageRolesModal");
    if (btnCancelManageRoles) {
        btnCancelManageRoles.addEventListener("click", closeManageRolesModal);
    }

    const btnCancelEditRole = document.getElementById("btnCancelEditRole");
    if (btnCancelEditRole) {
        btnCancelEditRole.addEventListener("click", cancelEditRole);
    }

    const btnSubmitRole = document.getElementById("btnSubmitRole");
    if (btnSubmitRole) {
        btnSubmitRole.addEventListener("click", submitRole);
    }

    const presetButtons = document.querySelectorAll(".btn-role-preset");
    presetButtons.forEach(btn => {
        btn.addEventListener("click", () => applyRolePreset(btn.dataset.preset));
    });

    const permTabs = document.querySelectorAll(".role-perm-tab");
    permTabs.forEach(tab => {
        tab.addEventListener("click", () => switchRolePermTab(tab.dataset.tab));
    });

    const permChecks = document.querySelectorAll(".role-perm-check");
    permChecks.forEach(cb => {
        cb.addEventListener("change", updateRolePermissionsSummary);
    });

    document.querySelectorAll(".role-action-perm-check").forEach(cb => {
        cb.addEventListener("change", updateRolePermissionsSummary);
    });

    const higherUpCb = document.getElementById("new_role_is_higher_up");
    if (higherUpCb) {
        higherUpCb.addEventListener("change", updateRolePermissionsSummary);
    }

    const roleNameInput = document.getElementById("new_role_name");
    if (roleNameInput) {
        roleNameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                submitRole();
            }
        });
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

    initRefreshBtn("btnRefreshStaff", loadStaff);

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

document.addEventListener("click", (e) => {
    const presetBtn = e.target.closest(".btn-role-preset");
    if (presetBtn && presetBtn.dataset.preset) {
        e.preventDefault();
        applyRolePreset(presetBtn.dataset.preset);
        return;
    }

    const tabBtn = e.target.closest(".role-perm-tab");
    if (tabBtn && tabBtn.dataset.tab) {
        e.preventDefault();
        switchRolePermTab(tabBtn.dataset.tab);
        return;
    }
});

const initStaffApp = () => {
    initStaffEvents();
    loadRoles();
    loadStations();
    loadStaff();
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStaffApp);
} else {
    initStaffApp();
}
