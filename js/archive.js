const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

const ARCHIVE_CATEGORIES = [
    { id: "patients", name: "Patients", icon: "👤", desc: "Archived patient profiles", badgeColor: "#0284c7", badgeBg: "#e0f2fe", badgeBorder: "#bae6fd" },
    { id: "doctors", name: "Doctors", icon: "🩺", desc: "Archived physician profiles", badgeColor: "#059669", badgeBg: "#d1fae5", badgeBorder: "#a7f3d0" },
    { id: "rooms", name: "Rooms", icon: "🚪", desc: "Archived hospital rooms", badgeColor: "#7c3aed", badgeBg: "#ede9fe", badgeBorder: "#ddd6fe" },
    { id: "beds", name: "Beds (Individual)", icon: "🛏️", desc: "Archived bed units", badgeColor: "#4f46e5", badgeBg: "#e0e7ff", badgeBorder: "#c7d2fe" },
    { id: "catalogs", name: "Charge Catalogs", icon: "📋", desc: "Archived services & items", badgeColor: "#d97706", badgeBg: "#fef3c7", badgeBorder: "#fde68a" },
    { id: "discounts", name: "Billing Discounts", icon: "🏷️", desc: "Archived discount policies", badgeColor: "#0891b2", badgeBg: "#cffafe", badgeBorder: "#a5f3fc" },
    { id: "departments", name: "Departments & Stations", icon: "🏢", desc: "Archived department stations", badgeColor: "#ea580c", badgeBg: "#ffedd5", badgeBorder: "#fed7aa" },
    { id: "staff", name: "Staff & System Users", icon: "👥", desc: "Archived staff accounts", badgeColor: "#0d9488", badgeBg: "#ccfbf1", badgeBorder: "#99f6e4" },
    { id: "specialties", name: "Medical Specialties", icon: "🎓", desc: "Archived clinical disciplines", badgeColor: "#db2777", badgeBg: "#fce7f3", badgeBorder: "#fbcfe8" },
    { id: "payment_methods", name: "Payment Methods", icon: "💳", desc: "Archived payment modes", badgeColor: "#475569", badgeBg: "#f1f5f9", badgeBorder: "#e2e8f0" },
    { id: "room_types", name: "Room Classifications", icon: "🏨", desc: "Archived room tiers", badgeColor: "#e11d48", badgeBg: "#ffe4e6", badgeBorder: "#fecdd3" },
    { id: "roles", name: "System Roles", icon: "🛡️", desc: "Archived access roles", badgeColor: "#b45309", badgeBg: "#fef3c7", badgeBorder: "#fde68a" }
];

let allArchivedRecords = [];
let currentArchivedRecords = [];
let selectedCategories = ["patients"];
let tempModalSelectedCategories = [];
let categoryCounts = {};
let selectedRowKeys = new Set();

const rowKey = (entity, id) => `${entity}::${id}`;

const getCategoryBadge = (entity, label) => {
    const cat = ARCHIVE_CATEGORIES.find(c => c.id === entity);
    if (!cat) {
        return `<span class="archive-category-badge" style="background-color: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">${label || entity}</span>`;
    }
    return `<span class="archive-category-badge" style="background-color: ${cat.badgeBg}; color: ${cat.badgeColor}; border: 1px solid ${cat.badgeBorder};">${cat.icon} ${cat.name}</span>`;
};

const loadArchiveCounts = async () => {
    try {
        const response = await axios.get(`${getApiUrl}/archive.php`, {
            params: { operation: "getArchiveCounts" }
        });
        categoryCounts = response.data || {};

        const totalBadge = document.getElementById("archive_total_badge");
        if (totalBadge) {
            const total = categoryCounts.total || 0;
            totalBadge.textContent = `${total} Total Archived Record${total === 1 ? "" : "s"}`;
        }

        const windowBadge = document.getElementById("window_total_records_badge");
        if (windowBadge) {
            const total = categoryCounts.total || 0;
            windowBadge.textContent = `${total} Total Record${total === 1 ? "" : "s"}`;
        }

        updateCategoryButtonDisplay();
    } catch (e) {
        categoryCounts = {};
    }
};

const updateCategoryButtonDisplay = () => {
    const labelEl = document.getElementById("category_button_label");
    const badgeEl = document.getElementById("category_button_badge");
    if (!labelEl || !badgeEl) return;

    if (selectedCategories.length === ARCHIVE_CATEGORIES.length) {
        labelEl.innerHTML = `<span>🌟 All Categories</span>`;
        badgeEl.textContent = `${ARCHIVE_CATEGORIES.length} Categories`;
        badgeEl.className = "badge badge-primary";
    } else if (selectedCategories.length === 1) {
        const cat = ARCHIVE_CATEGORIES.find(c => c.id === selectedCategories[0]);
        const catName = cat ? `${cat.icon} ${cat.name}` : selectedCategories[0];
        const count = categoryCounts[selectedCategories[0]] || 0;
        labelEl.innerHTML = `<span>${catName}</span>`;
        badgeEl.textContent = `${count} record${count === 1 ? "" : "s"}`;
        badgeEl.className = "badge badge-info";
    } else {
        labelEl.innerHTML = `<span>🗂️ Multiple Categories</span>`;
        badgeEl.textContent = `${selectedCategories.length} Selected`;
        badgeEl.className = "badge badge-info";
    }
};

const updateCategoryChips = () => {
    const container = document.getElementById("category_chips_container");
    const list = document.getElementById("category_chips_list");
    if (!container || !list) return;

    list.innerHTML = "";

    if (selectedCategories.length === ARCHIVE_CATEGORIES.length) {
        container.style.display = "flex";
        list.innerHTML = `<span class="category-chip" style="background-color: #eff6ff; border-color: #bfdbfe; color: #1d4ed8;">🌟 All ${ARCHIVE_CATEGORIES.length} Categories (${allArchivedRecords.length} records)</span>`;
        return;
    }

    if (selectedCategories.length > 1) {
        container.style.display = "flex";
        selectedCategories.forEach(catId => {
            const cat = ARCHIVE_CATEGORIES.find(c => c.id === catId);
            if (!cat) return;
            const count = categoryCounts[catId] || 0;

            const chip = document.createElement("span");
            chip.className = "category-chip";
            chip.innerHTML = `
                <span>${cat.icon} ${cat.name} <small style="color: #64748b;">(${count})</small></span>
                <span class="category-chip-remove" title="Remove ${cat.name} from view">&times;</span>
            `;

            const removeBtn = chip.querySelector(".category-chip-remove");
            if (removeBtn) {
                removeBtn.addEventListener("click", () => removeCategoryFromView(catId));
            }

            list.appendChild(chip);
        });
        return;
    }

    container.style.display = "none";
};

const removeCategoryFromView = (catId) => {
    if (selectedCategories.length <= 1) {
        if (typeof showPopupAlert === "function") {
            showPopupAlert("At least one category must remain visible.", "info");
        } else {
            alert("At least one category must remain visible.");
        }
        return;
    }

    selectedCategories = selectedCategories.filter(id => id !== catId);
    loadArchivedRecords();
};

const showAllArchive = () => {
    selectedCategories = ARCHIVE_CATEGORIES.map(c => c.id);
    loadArchivedRecords();
};

const restoreRecord = (entity, id, name) => {
    const cat = ARCHIVE_CATEGORIES.find(c => c.id === entity);
    const catLabel = cat ? cat.name : entity;

    showPopupConfirm(`Are you sure you want to RESTORE the ${catLabel.toLowerCase()} record "${name}" back to active use?`, async () => {
        const userJson = sessionStorage.getItem("hospital_user");
        const user = userJson ? JSON.parse(userJson) : null;
        const uid = user ? (user.user_id || user.User_ID || 1) : 1;
        const uName = user ? (user.full_name || user.Full_Name || user.Username || "System Admin") : "System Admin";

        const formData = new FormData();
        formData.append("operation", "restoreRecord");
        formData.append("json", JSON.stringify({ entity: entity, id: id, name: name, user_id: uid, performed_by: uName }));

        try {
            const response = await axios({
                url: `${postApiUrl}/archive.php`,
                method: "POST",
                data: formData
            });

            if (response.data == 1 || (response.data && (response.data.status === 1 || response.data.status === '1' || response.data.success))) {
                if (typeof showPopupAlert === "function") {
                    showPopupAlert(`"${name}" was restored to active records.`, "success");
                } else {
                    alert(`"${name}" was restored to active records.`);
                }
                await loadArchiveCounts();
                loadArchivedRecords();
            } else {
                if (typeof showPopupAlert === "function") {
                    showPopupAlert("Error restoring record.", "error");
                } else {
                    alert("Error restoring record.");
                }
            }
        } catch (error) {
            if (typeof showPopupAlert === "function") {
                showPopupAlert("Server error during restore.", "error");
            } else {
                alert("Server error during restore.");
            }
        }
    }, null, {
        title: "Restore Record",
        confirmText: "Restore Record",
        type: "info"
    });
};

const hardDeleteRecord = (entity, id, name) => {
    if (typeof canUserDelete === "function" && !canUserDelete()) {
        showPopupAlert("Permission Denied: You do not have permission to permanently delete or purge records.", "danger", "Access Restricted");
        return;
    }
    const cat = ARCHIVE_CATEGORIES.find(c => c.id === entity);
    const catLabel = cat ? cat.name : entity;

    showPopupConfirm(`WARNING: Are you sure you want to HARD DELETE (permanently erase) the ${catLabel.toLowerCase()} record "${name}" from the system?\n\nThis action cannot be undone!`, async () => {
        const userJson = sessionStorage.getItem("hospital_user");
        const user = userJson ? JSON.parse(userJson) : null;
        const uid = user ? (user.user_id || user.User_ID || 1) : 1;
        const uName = user ? (user.full_name || user.Full_Name || user.Username || "System Admin") : "System Admin";

        const formData = new FormData();
        formData.append("operation", "hardDeleteRecord");
        formData.append("json", JSON.stringify({ entity: entity, id: id, name: name, user_id: uid, performed_by: uName }));

        try {
            const response = await axios({
                url: `${postApiUrl}/archive.php`,
                method: "POST",
                data: formData
            });

            if (response.data == 1 || (response.data && (response.data.status === 1 || response.data.status === '1' || response.data.success))) {
                if (typeof showPopupAlert === "function") {
                    showPopupAlert(`"${name}" was permanently removed.`, "success");
                } else {
                    alert(`"${name}" was permanently removed.`);
                }
                await loadArchiveCounts();
                loadArchivedRecords();
            } else if (response.data && response.data.message) {
                if (typeof showPopupAlert === "function") {
                    showPopupAlert(response.data.message, "error");
                } else {
                    alert(response.data.message);
                }
            } else {
                if (typeof showPopupAlert === "function") {
                    showPopupAlert("Could not permanently delete record.", "error");
                } else {
                    alert("Could not permanently delete record.");
                }
            }
        } catch (error) {
            if (typeof showPopupAlert === "function") {
                showPopupAlert("Server error during deletion.", "error");
            } else {
                alert("Server error during deletion.");
            }
        }
    }, null, {
        title: "Permanent Delete Warning",
        confirmText: "Permanently Delete",
        type: "danger"
    });
};

const updateBatchBar = () => {
    const bar = document.getElementById("batch_action_bar");
    if (!bar) return;

    const count = selectedRowKeys.size;
    if (count === 0) {
        bar.classList.remove("visible");
        return;
    }

    bar.classList.add("visible");

    const label = bar.querySelector(".batch-count-label");
    if (label) label.textContent = `${count} record${count === 1 ? "" : "s"} selected`;

    const userCanDel = typeof canUserDelete === "function" ? canUserDelete() : true;
    const btnBatchDel = document.getElementById("btnBatchDelete");
    if (btnBatchDel) {
        btnBatchDel.style.display = userCanDel ? "inline-flex" : "none";
    }
};

const clearAllSelections = () => {
    selectedRowKeys.clear();
    document.querySelectorAll(".archive-row-cb").forEach(cb => {
        cb.checked = false;
        const row = cb.closest("tr");
        if (row) row.classList.remove("archive-row-selected");
    });
    const selectAllCb = document.getElementById("archive_select_all_cb");
    if (selectAllCb) selectAllCb.checked = false;
    updateBatchBar();
};

const batchRestoreRecords = () => {
    if (selectedRowKeys.size === 0) return;

    const keys = [...selectedRowKeys];
    const count = keys.length;

    showPopupConfirm(
        `Are you sure you want to RESTORE ${count} selected record${count === 1 ? "" : "s"} back to active use?`,
        async () => {
            const userJson = sessionStorage.getItem("hospital_user");
            const user = userJson ? JSON.parse(userJson) : null;
            const uid = user ? (user.user_id || user.User_ID || 1) : 1;
            const uName = user ? (user.full_name || user.Full_Name || user.Username || "System Admin") : "System Admin";

            let successCount = 0;
            let failCount = 0;

            for (const key of keys) {
                const [entity, id] = key.split("::");
                const rec = allArchivedRecords.find(r => r.Entity === entity && String(r.ID) === String(id));
                const name = rec ? rec.Name : id;

                const formData = new FormData();
                formData.append("operation", "restoreRecord");
                formData.append("json", JSON.stringify({ entity, id, name, user_id: uid, performed_by: uName }));

                try {
                    const response = await axios({ url: `${postApiUrl}/archive.php`, method: "POST", data: formData });
                    if (response.data == 1 || (response.data && (response.data.status === 1 || response.data.status === '1' || response.data.success))) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch {
                    failCount++;
                }
            }

            selectedRowKeys.clear();
            await loadArchiveCounts();
            loadArchivedRecords();

            if (failCount === 0) {
                showPopupAlert(`${successCount} record${successCount === 1 ? "" : "s"} restored successfully.`, "success");
            } else {
                showPopupAlert(`${successCount} restored, ${failCount} failed. Check records manually.`, "warning");
            }
        },
        null,
        { title: "Batch Restore", confirmText: `Restore ${count} Records`, type: "info" }
    );
};

const batchHardDeleteRecords = () => {
    if (selectedRowKeys.size === 0) return;
    if (typeof canUserDelete === "function" && !canUserDelete()) {
        showPopupAlert("Permission Denied: You do not have permission to permanently delete or purge records.", "danger", "Access Restricted");
        return;
    }

    const keys = [...selectedRowKeys];
    const count = keys.length;

    showPopupConfirm(
        `WARNING: Permanently delete ${count} selected record${count === 1 ? "" : "s"}?\n\nThis cannot be undone!`,
        async () => {
            const userJson = sessionStorage.getItem("hospital_user");
            const user = userJson ? JSON.parse(userJson) : null;
            const uid = user ? (user.user_id || user.User_ID || 1) : 1;
            const uName = user ? (user.full_name || user.Full_Name || user.Username || "System Admin") : "System Admin";

            let successCount = 0;
            let failCount = 0;
            const failMessages = [];

            for (const key of keys) {
                const [entity, id] = key.split("::");
                const rec = allArchivedRecords.find(r => r.Entity === entity && String(r.ID) === String(id));
                const name = rec ? rec.Name : id;

                const formData = new FormData();
                formData.append("operation", "hardDeleteRecord");
                formData.append("json", JSON.stringify({ entity, id, name, user_id: uid, performed_by: uName }));

                try {
                    const response = await axios({ url: `${postApiUrl}/archive.php`, method: "POST", data: formData });
                    if (response.data == 1 || (response.data && (response.data.status === 1 || response.data.status === '1' || response.data.success))) {
                        successCount++;
                    } else {
                        failCount++;
                        if (response.data && response.data.message) failMessages.push(`${name}: ${response.data.message}`);
                    }
                } catch {
                    failCount++;
                }
            }

            selectedRowKeys.clear();
            await loadArchiveCounts();
            loadArchivedRecords();

            if (failCount === 0) {
                showPopupAlert(`${successCount} record${successCount === 1 ? "" : "s"} permanently deleted.`, "success");
            } else {
                const detail = failMessages.length > 0 ? `\n\n${failMessages.slice(0, 3).join("\n")}` : "";
                showPopupAlert(`${successCount} deleted, ${failCount} failed.${detail}`, "warning");
            }
        },
        null,
        { title: "Batch Permanent Delete", confirmText: `Delete ${count} Records`, type: "danger" }
    );
};

const filterArchivedRecords = () => {
    const searchEl = document.getElementById("search_input");
    const searchTerm = searchEl ? searchEl.value.trim().toLowerCase() : "";

    const filtered = allArchivedRecords.filter(item => {
        const code = (item.Code || "").toLowerCase();
        const name = (item.Name || "").toLowerCase();
        const details = (item.Details || "").toLowerCase();
        const entityLabel = (item.Entity_Label || "").toLowerCase();
        const entity = (item.Entity || "").toLowerCase();

        return code.includes(searchTerm)
            || name.includes(searchTerm)
            || details.includes(searchTerm)
            || entityLabel.includes(searchTerm)
            || entity.includes(searchTerm);
    });

    displayArchiveTable(filtered);
};

const displayArchiveTable = (records) => {
    const tableDiv = document.getElementById("table-div");
    if (!tableDiv) return;
    tableDiv.innerHTML = "";

    if (typeof updateFilterCount === "function") {
        updateFilterCount(records ? records.length : 0, allArchivedRecords ? allArchivedRecords.length : 0, "archived records");
    }

    if (!records || records.length === 0) {
        tableDiv.innerHTML = typeof getEmptyStateHtml === "function"
            ? getEmptyStateHtml("📁", "No archived records found", "The archive is clear for the selected category view. No soft-deleted records currently match.")
            : `<p>No archived records found for the selected categories.</p>`;
        updateBatchBar();
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th class="archive-cb-col"><input type="checkbox" id="archive_select_all_cb" class="archive-select-all-cb" title="Select / Deselect All"></th>
            ${renderSortableTh("Record & Category", "Category")}
            ${renderSortableTh("Name & Details", "Record_Name")}
            ${renderSortableTh("Status", "Status")}
            <th class="text-center">Actions</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    records.forEach(rec => {
        const key = rowKey(rec.Entity, rec.ID);
        const isChecked = selectedRowKeys.has(key);
        const categoryBadge = getCategoryBadge(rec.Entity, rec.Entity_Label);

        const row = document.createElement("tr");
        if (isChecked) row.classList.add("archive-row-selected");

        row.innerHTML = `
            <td class="archive-cb-col"><input type="checkbox" class="archive-row-cb" data-key="${key}" ${isChecked ? "checked" : ""}></td>
            <td>
                <div class="table-primary-text font-bold">${rec.Code}</div>
                <div class="table-sub-text">${categoryBadge}</div>
            </td>
            <td>
                <div class="table-primary-text font-bold">${rec.Name}</div>
                <div class="table-sub-text">${rec.Details}</div>
            </td>
            <td class="text-center"><span class="badge badge-danger">Archived</span></td>
            <td class="text-center">
                <div class="table-actions-cluster">
                    <button type="button" class="btn btn-sm btn-success btn-action-restore" data-entity="${rec.Entity}" data-id="${rec.ID}" data-name="${rec.Name}">Restore</button>
                    ${(typeof canUserDelete === "function" ? canUserDelete() : true) ? `<button type="button" class="btn btn-sm btn-danger btn-delete btn-action-hard-delete" data-entity="${rec.Entity}" data-id="${rec.ID}" data-name="${rec.Name}">Permanently Delete</button>` : ""}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);

    const selectAllCb = document.getElementById("archive_select_all_cb");
    if (selectAllCb) {
        const allKeys = records.map(r => rowKey(r.Entity, r.ID));
        selectAllCb.checked = allKeys.length > 0 && allKeys.every(k => selectedRowKeys.has(k));
        selectAllCb.indeterminate = !selectAllCb.checked && allKeys.some(k => selectedRowKeys.has(k));

        selectAllCb.addEventListener("change", () => {
            if (selectAllCb.checked) {
                allKeys.forEach(k => selectedRowKeys.add(k));
            } else {
                allKeys.forEach(k => selectedRowKeys.delete(k));
            }
            tableDiv.querySelectorAll(".archive-row-cb").forEach(cb => {
                cb.checked = selectedRowKeys.has(cb.dataset.key);
                const row = cb.closest("tr");
                if (row) row.classList.toggle("archive-row-selected", cb.checked);
            });
            updateBatchBar();
        });
    }

    tableDiv.querySelectorAll(".archive-row-cb").forEach(cb => {
        cb.addEventListener("change", () => {
            if (cb.checked) {
                selectedRowKeys.add(cb.dataset.key);
            } else {
                selectedRowKeys.delete(cb.dataset.key);
            }
            const row = cb.closest("tr");
            if (row) row.classList.toggle("archive-row-selected", cb.checked);

            const allKeys = records.map(r => rowKey(r.Entity, r.ID));
            const selectAll = document.getElementById("archive_select_all_cb");
            if (selectAll) {
                selectAll.checked = allKeys.every(k => selectedRowKeys.has(k));
                selectAll.indeterminate = !selectAll.checked && allKeys.some(k => selectedRowKeys.has(k));
            }
            updateBatchBar();
        });
    });

    tableDiv.querySelectorAll(".btn-action-restore").forEach(btn => {
        btn.addEventListener("click", () => {
            restoreRecord(btn.dataset.entity, btn.dataset.id, btn.dataset.name);
        });
    });

    tableDiv.querySelectorAll(".btn-action-hard-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            hardDeleteRecord(btn.dataset.entity, btn.dataset.id, btn.dataset.name);
        });
    });

    updateBatchBar();
};

const loadArchivedRecords = async () => {
    const tableDiv = document.getElementById("table-div");
    if (!tableDiv) return;

    tableDiv.innerHTML = `<p style="padding: 24px; text-align: center; color: var(--text-muted);">Loading archived records...</p>`;

    let payload = {};
    if (selectedCategories.length === ARCHIVE_CATEGORIES.length || selectedCategories.includes("all")) {
        payload = { entity: "all" };
    } else {
        payload = { entities: selectedCategories };
    }

    try {
        const response = await axios.get(`${getApiUrl}/archive.php`, {
            params: {
                operation: "getArchivedRecords",
                json: JSON.stringify(payload)
            }
        });

        allArchivedRecords = response.data || [];
        updateCategoryButtonDisplay();
        updateCategoryChips();
        filterArchivedRecords();
    } catch (error) {
        tableDiv.innerHTML = `<p style="color: red; padding: 20px;">Failed to load archived records from server.</p>`;
    }
};

const openCategoryWindow = () => {
    if (selectedCategories.length === ARCHIVE_CATEGORIES.length || selectedCategories.includes("all")) {
        tempModalSelectedCategories = ARCHIVE_CATEGORIES.map(c => c.id);
    } else {
        tempModalSelectedCategories = [...selectedCategories];
    }

    const searchInput = document.getElementById("category_filter_search");
    if (searchInput) searchInput.value = "";

    renderCategoryCardsGrid();
    updateCategoryModalSummary();
    openModal("categoryWindowModal");
};

const closeCategoryWindow = () => {
    closeModal("categoryWindowModal");
};

const renderCategoryCardsGrid = () => {
    const grid = document.getElementById("category_cards_grid");
    if (!grid) return;

    const searchInput = document.getElementById("category_filter_search");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    grid.innerHTML = "";

    const visibleCategories = ARCHIVE_CATEGORIES.filter(cat => {
        return !query || cat.name.toLowerCase().includes(query) || cat.desc.toLowerCase().includes(query);
    });

    if (visibleCategories.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: var(--text-muted);">No matching categories found.</div>`;
        return;
    }

    visibleCategories.forEach(cat => {
        const isSelected = tempModalSelectedCategories.includes(cat.id);
        const count = categoryCounts[cat.id] || 0;

        const card = document.createElement("div");
        card.className = `category-card ${isSelected ? "selected" : ""}`;
        card.setAttribute("data-id", cat.id);

        const countBadge = count > 0
            ? `<span class="badge badge-primary" style="font-size: 11px; padding: 2px 7px;">${count}</span>`
            : `<span class="badge badge-secondary" style="font-size: 11px; padding: 2px 7px; opacity: 0.6;">0</span>`;

        card.innerHTML = `
            <div class="category-card-left">
                <input type="checkbox" class="category-card-cb" value="${cat.id}" ${isSelected ? "checked" : ""} style="cursor: pointer; pointer-events: none;">
                <span class="category-card-icon">${cat.icon}</span>
                <div>
                    <div class="category-card-title">${cat.name}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${cat.desc}</div>
                </div>
            </div>
            <div>${countBadge}</div>
        `;

        card.addEventListener("click", () => {
            toggleModalCategory(cat.id);
        });

        grid.appendChild(card);
    });
};

const toggleModalCategory = (catId) => {
    const idx = tempModalSelectedCategories.indexOf(catId);
    if (idx > -1) {
        tempModalSelectedCategories.splice(idx, 1);
    } else {
        tempModalSelectedCategories.push(catId);
    }

    const card = document.querySelector(`.category-card[data-id="${catId}"]`);
    if (card) {
        const isSelected = tempModalSelectedCategories.includes(catId);
        card.classList.toggle("selected", isSelected);
        const cb = card.querySelector(".category-card-cb");
        if (cb) cb.checked = isSelected;
    }

    updateCategoryModalSummary();
};

const updateCategoryModalSummary = () => {
    const summaryEl = document.getElementById("category_modal_selection_summary");
    if (!summaryEl) return;

    const count = tempModalSelectedCategories.length;
    let recordsCount = 0;
    tempModalSelectedCategories.forEach(id => {
        recordsCount += (categoryCounts[id] || 0);
    });

    if (count === ARCHIVE_CATEGORIES.length) {
        summaryEl.textContent = `All ${count} categories selected (${recordsCount} total records)`;
    } else {
        summaryEl.textContent = `${count} categor${count === 1 ? "y" : "ies"} selected (${recordsCount} total records)`;
    }
};

const selectAllModalCategories = () => {
    tempModalSelectedCategories = ARCHIVE_CATEGORIES.map(c => c.id);
    renderCategoryCardsGrid();
    updateCategoryModalSummary();
};

const clearAllModalCategories = () => {
    tempModalSelectedCategories = [];
    renderCategoryCardsGrid();
    updateCategoryModalSummary();
};

const applyCategoryWindowSelection = () => {
    if (tempModalSelectedCategories.length === 0) {
        if (typeof showPopupAlert === "function") {
            showPopupAlert("Please select at least one category to display.", "warning");
        } else {
            alert("Please select at least one category to display.");
        }
        return;
    }

    selectedCategories = [...tempModalSelectedCategories];
    closeCategoryWindow();
    loadArchivedRecords();
};

const initArchiveEvents = () => {
    const btnOpenWindowFilter = document.getElementById("btnOpenCategoryWindowFilter");
    if (btnOpenWindowFilter) {
        btnOpenWindowFilter.addEventListener("click", openCategoryWindow);
    }

    const searchInput = document.getElementById("search_input");
    if (searchInput) {
        searchInput.addEventListener("input", filterArchivedRecords);
    }

    initRefreshBtn("btnRefreshArchive", async () => {
        await loadArchiveCounts();
        await loadArchivedRecords();
    });

    const btnCloseModal = document.getElementById("btnCloseCategoryWindowModal");
    if (btnCloseModal) {
        btnCloseModal.addEventListener("click", closeCategoryWindow);
    }

    const btnCancelModal = document.getElementById("btnCancelCategoryWindow");
    if (btnCancelModal) {
        btnCancelModal.addEventListener("click", closeCategoryWindow);
    }

    const btnApplyModal = document.getElementById("btnApplyCategoryWindow");
    if (btnApplyModal) {
        btnApplyModal.addEventListener("click", applyCategoryWindowSelection);
    }

    const btnSelectAll = document.getElementById("btnModalSelectAll");
    if (btnSelectAll) {
        btnSelectAll.addEventListener("click", selectAllModalCategories);
    }

    const btnClearAll = document.getElementById("btnModalClearAll");
    if (btnClearAll) {
        btnClearAll.addEventListener("click", clearAllModalCategories);
    }

    const categorySearch = document.getElementById("category_filter_search");
    if (categorySearch) {
        categorySearch.addEventListener("input", renderCategoryCardsGrid);
    }

    const btnResetAll = document.getElementById("btnResetToAllCategories");
    if (btnResetAll) {
        btnResetAll.addEventListener("click", showAllArchive);
    }

    const btnBatchRestore = document.getElementById("btnBatchRestore");
    if (btnBatchRestore) {
        btnBatchRestore.addEventListener("click", batchRestoreRecords);
    }

    const btnBatchDelete = document.getElementById("btnBatchDelete");
    if (btnBatchDelete) {
        btnBatchDelete.addEventListener("click", batchHardDeleteRecords);
    }

    const btnBatchDeselect = document.getElementById("btnBatchDeselect");
    if (btnBatchDeselect) {
        btnBatchDeselect.addEventListener("click", clearAllSelections);
    }
};

document.addEventListener("DOMContentLoaded", () => {
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
    if (logoutBtn && !logoutBtn.dataset.wired) {
        logoutBtn.dataset.wired = "true";
        logoutBtn.addEventListener("click", () => {
            showPopupConfirm("Are you sure you want to log out of your active session?", () => {
                if (typeof handleUserLogout === "function") {
                    handleUserLogout();
                } else {
                    sessionStorage.removeItem("hospital_user");
                    window.location.href = "login.html";
                }
            }, null, {
                title: "Confirm Logout",
                confirmText: "Logout",
                type: "warning"
            });
        });
    }

    initArchiveEvents();
    loadArchiveCounts();
    loadArchivedRecords();
});
