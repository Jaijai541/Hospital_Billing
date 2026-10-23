const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allAuditLogs = [];

document.addEventListener("DOMContentLoaded", () => {
    initRefreshBtn("btnRefreshAuditLog", loadAuditLogs);

    document.getElementById("search_input").addEventListener("input", filterAndRenderAuditLogs);
    setupPresetButtons();
    setupDateRangeListeners();
    setupFilterSortCollapse();
    document.getElementById("filter_module").addEventListener("change", filterAndRenderAuditLogs);
    document.getElementById("filter_action").addEventListener("change", filterAndRenderAuditLogs);
    document.getElementById("sort_order").addEventListener("change", filterAndRenderAuditLogs);

    const btnReset = document.getElementById("btnResetFilters");
    if (btnReset) {
        btnReset.addEventListener("click", resetAllFiltersAndSort);
    }

    loadAuditLogs();
});

const setupFilterSortCollapse = () => {
    const toggleBtn = document.getElementById("btnToggleFilterSort");
    const collapseEl = document.getElementById("auditFilterCollapse");
    if (toggleBtn && collapseEl) {
        toggleBtn.addEventListener("click", () => {
            const isOpen = collapseEl.classList.toggle("is-open");
            toggleBtn.classList.toggle("active", isOpen);
            toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
        });
    }
};

const updateFilterSortActiveBadge = () => {
    const badge = document.getElementById("filterSortActiveBadge");
    if (!badge) return;

    let activeCount = 0;
    const startInput = document.getElementById("filter_start_date");
    const endInput = document.getElementById("filter_end_date");
    const moduleSelect = document.getElementById("filter_module");
    const actionSelect = document.getElementById("filter_action");
    const sortOrderSelect = document.getElementById("sort_order");

    if (startInput && startInput.value) activeCount++;
    if (endInput && endInput.value) activeCount++;
    if (moduleSelect && moduleSelect.value !== "ALL") activeCount++;
    if (actionSelect && actionSelect.value !== "ALL") activeCount++;
    if (sortOrderSelect && sortOrderSelect.value !== "DESC") activeCount++;

    if (activeCount > 0) {
        badge.textContent = `${activeCount} active`;
        badge.classList.remove("is-hidden");
    } else {
        badge.classList.add("is-hidden");
    }
};

const resetAllFiltersAndSort = () => {
    const searchInput = document.getElementById("search_input");
    const startInput = document.getElementById("filter_start_date");
    const endInput = document.getElementById("filter_end_date");
    const clearDateBtn = document.getElementById("btnClearDateRange");
    const moduleSelect = document.getElementById("filter_module");
    const actionSelect = document.getElementById("filter_action");
    const sortOrderSelect = document.getElementById("sort_order");

    if (searchInput) searchInput.value = "";
    if (startInput) startInput.value = "";
    if (endInput) endInput.value = "";
    if (clearDateBtn) clearDateBtn.classList.add("is-hidden");
    if (moduleSelect) moduleSelect.value = "ALL";
    if (actionSelect) actionSelect.value = "ALL";
    if (sortOrderSelect) sortOrderSelect.value = "DESC";

    document.querySelectorAll(".date-preset-btn").forEach((b) => b.classList.remove("active"));
    const btnAll = document.querySelector('.date-preset-btn[data-preset="all"]');
    if (btnAll) btnAll.classList.add("active");

    updateFilterSortActiveBadge();
    filterAndRenderAuditLogs();
};

const formatDateYMD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const setupPresetButtons = () => {
    const presetButtons = document.querySelectorAll(".date-preset-btn");
    const startInput = document.getElementById("filter_start_date");
    const endInput = document.getElementById("filter_end_date");
    const clearBtn = document.getElementById("btnClearDateRange");

    presetButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            presetButtons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            const preset = btn.getAttribute("data-preset");
            const now = new Date();

            if (preset === "all") {
                if (startInput) startInput.value = "";
                if (endInput) endInput.value = "";
                if (clearBtn) clearBtn.classList.add("is-hidden");
            } else if (preset === "today") {
                const todayStr = formatDateYMD(now);
                if (startInput) startInput.value = todayStr;
                if (endInput) endInput.value = todayStr;
                if (clearBtn) clearBtn.classList.remove("is-hidden");
            } else if (preset === "week") {
                const day = now.getDay();
                const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(now.setDate(diffToMonday));
                if (startInput) startInput.value = formatDateYMD(monday);
                if (endInput) endInput.value = formatDateYMD(new Date());
                if (clearBtn) clearBtn.classList.remove("is-hidden");
            } else if (preset === "month") {
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                if (startInput) startInput.value = formatDateYMD(firstDay);
                if (endInput) endInput.value = formatDateYMD(new Date());
                if (clearBtn) clearBtn.classList.remove("is-hidden");
            }

            updateFilterSortActiveBadge();
            filterAndRenderAuditLogs();
        });
    });
};

const setupDateRangeListeners = () => {
    const startInput = document.getElementById("filter_start_date");
    const endInput = document.getElementById("filter_end_date");
    const clearBtn = document.getElementById("btnClearDateRange");

    const handleDateChange = () => {
        const startVal = startInput ? startInput.value : "";
        const endVal = endInput ? endInput.value : "";
        const presetButtons = document.querySelectorAll(".date-preset-btn");
        presetButtons.forEach((b) => b.classList.remove("active"));

        const now = new Date();
        const todayStr = formatDateYMD(now);

        if (!startVal && !endVal) {
            const btnAll = document.querySelector('.date-preset-btn[data-preset="all"]');
            if (btnAll) btnAll.classList.add("active");
            if (clearBtn) clearBtn.classList.add("is-hidden");
        } else {
            if (clearBtn) clearBtn.classList.remove("is-hidden");
            if (startVal === todayStr && endVal === todayStr) {
                const btnToday = document.querySelector('.date-preset-btn[data-preset="today"]');
                if (btnToday) btnToday.classList.add("active");
            }
        }

        updateFilterSortActiveBadge();
        filterAndRenderAuditLogs();
    };

    if (startInput) {
        startInput.addEventListener("input", handleDateChange);
        startInput.addEventListener("change", handleDateChange);
    }
    if (endInput) {
        endInput.addEventListener("input", handleDateChange);
        endInput.addEventListener("change", handleDateChange);
    }
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (startInput) startInput.value = "";
            if (endInput) endInput.value = "";
            clearBtn.classList.add("is-hidden");

            document.querySelectorAll(".date-preset-btn").forEach((b) => b.classList.remove("active"));
            const btnAll = document.querySelector('.date-preset-btn[data-preset="all"]');
            if (btnAll) btnAll.classList.add("active");

            updateFilterSortActiveBadge();
            filterAndRenderAuditLogs();
        });
    }
};

const buildDateSearchTokens = (createdStr, formattedStr) => {
    const tokens = [(createdStr || "").toLowerCase(), (formattedStr || "").toLowerCase()];
    if (!createdStr) return tokens;
    const parts = createdStr.split(" ")[0].split("-");
    if (parts.length === 3) {
        const [year, month, day] = parts;
        const monthNum = parseInt(month, 10);
        const dayNum = parseInt(day, 10);
        const monthsShort = ["", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const monthsLong = ["", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
        if (monthNum >= 1 && monthNum <= 12) {
            const mShort = monthsShort[monthNum];
            const mLong = monthsLong[monthNum];
            tokens.push(`${mShort} ${dayNum}`);
            tokens.push(`${mShort} ${day}`);
            tokens.push(`${mLong} ${dayNum}`);
            tokens.push(`${mLong} ${day}`);
            tokens.push(`${mShort} ${dayNum}, ${year}`);
            tokens.push(`${mLong} ${dayNum}, ${year}`);
            tokens.push(`${mShort} ${year}`);
            tokens.push(`${mLong} ${year}`);
            tokens.push(`${month}/${day}/${year}`);
            tokens.push(`${monthNum}/${dayNum}/${year}`);
            tokens.push(`${month}-${day}`);
            tokens.push(`${monthNum}-${dayNum}`);
            tokens.push(year);
        }
    }
    return tokens;
};

const loadAuditLogs = async () => {
    const tableDiv = document.getElementById("table-div");

    try {
        const response = await axios.get(`${getApiUrl}/audit_log.php`, {
            params: { operation: "getAllAuditLogs" }
        });

        if (response.status === 200 && Array.isArray(response.data)) {
            allAuditLogs = response.data;
            updateAuditStats(allAuditLogs);
            filterAndRenderAuditLogs();
        } else {
            tableDiv.innerHTML = `<p style="color: red;">Error loading audit logs.</p>`;
        }
    } catch (error) {
        console.error("[AuditLog] Failed to load logs:", error);
        tableDiv.innerHTML = `<p style="color: red;">Failed to connect to Audit Log API.</p>`;
    }
};

const updateAuditStats = (logs) => {
    const totalEl = document.getElementById("stat-total-logs");
    const clinicalEl = document.getElementById("stat-clinical-logs");
    const billingEl = document.getElementById("stat-billing-logs");
    const systemEl = document.getElementById("stat-system-logs");

    const clinicalActions = ["ADMIT", "TRANSFER", "DISCHARGE", "ORDER", "ROUND"];
    const billingActions = ["BILLING", "RETURN", "Billing Settled", "Payment Received", "Advance Payment Recorded", "Promissory Note Executed"];

    const clinicalCount = logs.filter(l => clinicalActions.includes(l.Action_Type)).length;
    const billingCount = logs.filter(l => billingActions.includes(l.Action_Type) || l.Module_Name === "Billing" || l.Module_Name === "Billing & Settlement").length;
    const systemCount = logs.length - clinicalCount - billingCount;

    if (totalEl) totalEl.textContent = logs.length;
    if (clinicalEl) clinicalEl.textContent = clinicalCount;
    if (billingEl) billingEl.textContent = billingCount;
    if (systemEl) systemEl.textContent = Math.max(0, systemCount);
};

const getActionBadgeClass = (actionType, badgeClassFromDb) => {
    if (badgeClassFromDb) {
        return `badge ${badgeClassFromDb}`;
    }
    switch (actionType) {
        case "ADMIT":
        case "CREATE":
        case "RESTORE":
        case "Billing Settled":
        case "Payment Received":
        case "Advance Payment Recorded":
            return "badge badge-success";
        case "BILLING":
        case "ORDER":
        case "ROUND":
        case "AUTH":
            return "badge badge-primary";
        case "DISCHARGE":
        case "TRANSFER":
        case "UPDATE":
        case "ARCHIVE":
        case "Promissory Note Executed":
            return "badge badge-warning";
        case "DELETE":
        case "RETURN":
            return "badge badge-danger";
        default:
            return "badge badge-secondary";
    }
};

const filterAndRenderAuditLogs = () => {
    const searchInput = document.getElementById("search_input");
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const moduleSelect = document.getElementById("filter_module");
    const moduleFilter = moduleSelect ? moduleSelect.value : "ALL";
    const actionSelect = document.getElementById("filter_action");
    const actionFilter = actionSelect ? actionSelect.value : "ALL";
    const sortOrderSelect = document.getElementById("sort_order");
    const sortOrder = sortOrderSelect ? sortOrderSelect.value : "DESC";

    const startInput = document.getElementById("filter_start_date");
    const endInput = document.getElementById("filter_end_date");
    const startDate = startInput ? startInput.value : "";
    const endDate = endInput ? endInput.value : "";

    updateFilterSortActiveBadge();

    let filtered = allAuditLogs.filter(item => {
        if (moduleFilter !== "ALL" && item.Module_Name !== moduleFilter) return false;
        if (actionFilter !== "ALL" && item.Action_Type !== actionFilter) return false;

        const rawDate = (item.Created_At || "").substring(0, 10);

        if (startDate && rawDate < startDate) return false;
        if (endDate && rawDate > endDate) return false;

        if (searchTerm) {
            const ref = (item.Record_Reference || "").toLowerCase();
            const desc = (item.Description || "").toLowerCase();
            const mod = (item.Module_Name || "").toLowerCase();
            const user = (item.Performed_By || "").toLowerCase();
            const act = (item.Action_Type || "").toLowerCase();
            const dateTokens = buildDateSearchTokens(item.Created_At, item.Formatted_Date);
            const matchesDate = dateTokens.some(tok => tok.includes(searchTerm));

            return ref.includes(searchTerm) ||
                   desc.includes(searchTerm) ||
                   mod.includes(searchTerm) ||
                   user.includes(searchTerm) ||
                   act.includes(searchTerm) ||
                   matchesDate;
        }
        return true;
    });

    filtered.sort((a, b) => {
        const timeA = new Date((a.Created_At || "").replace(" ", "T")).getTime() || (parseInt(a.Audit_ID) || 0);
        const timeB = new Date((b.Created_At || "").replace(" ", "T")).getTime() || (parseInt(b.Audit_ID) || 0);
        if (timeA !== timeB) {
            return sortOrder === "ASC" ? timeA - timeB : timeB - timeA;
        }
        const idA = parseInt(a.Audit_ID) || 0;
        const idB = parseInt(b.Audit_ID) || 0;
        return sortOrder === "ASC" ? idA - idB : idB - idA;
    });

    renderAuditTable(filtered);
};

const renderAuditTable = (logs) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (typeof updateFilterCount === "function") {
        const total = (typeof allAuditLogs !== "undefined" && Array.isArray(allAuditLogs)) ? allAuditLogs.length : (logs ? logs.length : 0);
        updateFilterCount(logs ? logs.length : 0, total, "log entries");
    }

    if (!logs || logs.length === 0) {
        tableDiv.innerHTML = typeof getEmptyStateHtml === "function"
            ? getEmptyStateHtml("📜", "No audit log entries match the selected filters", "Try expanding your date range, module, or action filters.")
            : `<p style="padding: 15px;">No audit log entries match the selected filters.</p>`;
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            ${renderSortableTh("Timestamp & Log ID", "Timestamp")}
            ${renderSortableTh("Action & Module", "Action")}
            ${renderSortableTh("Activity Description", "Details")}
            ${renderSortableTh("Performed By", "User_Name")}
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    logs.forEach(log => {
        const row = document.createElement("tr");
        const badgeClass = getActionBadgeClass(log.Action_Type, log.Badge_Class);
        const formattedId = `AUD-${String(log.Audit_ID).padStart(4, "0")}`;

        row.innerHTML = `
            <td>
                <div class="table-primary-text">${log.Formatted_Date || log.Created_At}</div>
                <div class="table-sub-text"><code>${formattedId}</code></div>
            </td>
            <td>
                <div class="table-primary-text"><span class="${badgeClass}">${log.Action_Type}</span></div>
                <div class="table-sub-text"><strong>${log.Module_Name}</strong> &bull; <code>${log.Record_Reference || "-"}</code></div>
            </td>
            <td><div class="table-sub-text-dark">${log.Description}</div></td>
            <td><div class="table-primary-text">${log.Performed_By || "System Admin"}</div></td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);
};
