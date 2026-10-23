let currentTab = "collections";
let reportData = null;
let lookupData = { cashiers: [], doctors: [], payment_methods: [] };
let currentSort = { column: null, direction: "asc" };

const parseSortValue = (val) => {
    if (val === undefined || val === null) return "";
    let str = String(val).trim();
    if (str.startsWith("₱") || str.startsWith("$")) {
        str = str.substring(1).replace(/,/g, "");
    }
    const num = Number(str);
    if (!isNaN(num) && typeof val !== "boolean" && str !== "") {
        return num;
    }
    return val;
};

const getSortedRecords = (records) => {
    if (!currentSort.column || !records || records.length === 0) {
        return [...records];
    }

    const { column, direction } = currentSort;
    const factor = direction === "desc" ? -1 : 1;

    return [...records].sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        valA = parseSortValue(valA);
        valB = parseSortValue(valB);

        if (typeof valA === "number" && typeof valB === "number") {
            return (valA - valB) * factor;
        }

        const dateA = Date.parse(valA);
        const dateB = Date.parse(valB);
        if (!isNaN(dateA) && !isNaN(dateB) && String(valA).includes("-")) {
            return (dateA - dateB) * factor;
        }

        return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: "base" }) * factor;
    });
};

const renderSortableHeader = (label, sortKey, alignRight = false) => {
    const isSorted = currentSort.column === sortKey;
    const dir = isSorted ? currentSort.direction : "";
    const activeClass = isSorted ? ` sorted-${dir}` : "";
    const alignClass = alignRight ? " text-right" : "";

    let arrowSvg = `
        <span class="sort-icon-box" aria-hidden="true">
            <svg class="sort-icon-neutral" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>
        </span>
    `;
    if (dir === "asc") {
        arrowSvg = `
            <span class="sort-icon-box active" aria-hidden="true">
                <svg class="sort-icon-active" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"/></svg>
            </span>
        `;
    } else if (dir === "desc") {
        arrowSvg = `
            <span class="sort-icon-box active" aria-hidden="true">
                <svg class="sort-icon-active" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
        `;
    }

    return `
        <th class="sortable-th${alignClass}${activeClass}" data-sort="${sortKey}" role="button" tabindex="0" title="Click to sort by ${label}">
            <div class="th-sort-wrapper${alignRight ? ' th-sort-right' : ''}">
                <span class="th-label">${label}</span>
                ${arrowSvg}
            </div>
        </th>
    `;
};

const handleHeaderSort = (sortKey) => {
    if (!sortKey) return;
    if (currentSort.column === sortKey) {
        if (currentSort.direction === "asc") {
            currentSort.direction = "desc";
        } else {
            currentSort.column = null;
            currentSort.direction = "asc";
        }
    } else {
        currentSort.column = sortKey;
        currentSort.direction = "asc";
    }
    renderActiveReport();
};

const updateActiveFiltersBar = () => {
    const bar = document.getElementById("active-filters-bar");
    const chipsContainer = document.getElementById("active-filters-chips");
    if (!bar || !chipsContainer) return;

    const chips = [];

    const activePreset = document.querySelector(".date-preset-btn.active");
    const startInput = document.getElementById("filter_start_date");
    const endInput = document.getElementById("filter_end_date");
    const secondarySelect = document.getElementById("filter_secondary");
    const secondaryLabel = document.getElementById("filter_secondary_label");
    const searchInput = document.getElementById("filter_search_query");

    const presetName = activePreset ? activePreset.getAttribute("data-preset") : "";
    if (presetName && presetName !== "all") {
        chips.push({
            type: "Period",
            value: activePreset.textContent.trim(),
            clearType: "date"
        });
    } else if (startInput && endInput && (startInput.value || endInput.value)) {
        let dateVal = "";
        if (startInput.value && endInput.value) {
            dateVal = `${startInput.value} to ${endInput.value}`;
        } else if (startInput.value) {
            dateVal = `From ${startInput.value}`;
        } else {
            dateVal = `Up to ${endInput.value}`;
        }
        chips.push({
            type: "Period",
            value: dateVal,
            clearType: "date"
        });
    }

    if (secondarySelect && secondarySelect.value) {
        const selectedText = secondarySelect.options[secondarySelect.selectedIndex]?.textContent.trim() || secondarySelect.value;
        const typeLabel = secondaryLabel ? secondaryLabel.textContent.trim() : "Filter";
        chips.push({
            type: typeLabel,
            value: selectedText,
            clearType: "secondary"
        });
    }

    if (searchInput && searchInput.value.trim()) {
        chips.push({
            type: "Search",
            value: `"${searchInput.value.trim()}"`,
            clearType: "search"
        });
    }

    if (currentSort.column) {
        const sortTitles = {
            Payment_Date: "Payment Date",
            Patient_Name: "Patient Name",
            Payment_Method: "Payment Method",
            Amount_Paid: "Amount Paid",
            Notes: "Remarks",
            Station_Name: "Station Name",
            Total_Transactions: "Transactions",
            Gross_Charges: "Gross Charges",
            Net_Revenue: "Net Revenue",
            Revenue_Share_Pct: "Share %",
            Doctor_Name: "Physician Name",
            Department_Station: "Department",
            Total_Rounds: "Rounds",
            Unique_Patients_Attended: "Unique Patients",
            Total_PF_Generated: "PF Generated",
            Note_Code: "Note Code",
            Plan_Type_Name: "Payment Plan",
            Total_Balance_Owed: "Balance Owed",
            Status: "Status",
            Room_Name: "Room Name",
            Daily_Rate: "Daily Rate",
            Total_Beds: "Bed Capacity",
            Occupancy_Rate: "Occupancy Rate"
        };
        const title = sortTitles[currentSort.column] || currentSort.column;
        const dirLabel = currentSort.direction === "asc" ? "Ascending" : "Descending";
        chips.push({
            type: "Sorted",
            value: `${title} (${dirLabel})`,
            clearType: "sort",
            isSort: true
        });
    }

    if (chips.length > 0) {
        bar.classList.add("active");
        chipsContainer.innerHTML = chips.map((c) => `
            <div class="filter-chip${c.isSort ? ' filter-chip-sort' : ''}">
                <span class="filter-chip-type">${c.type}:</span>
                <span class="filter-chip-val">${c.value}</span>
                <button type="button" class="filter-chip-remove" data-clear="${c.clearType}" title="Remove this filter">&times;</button>
            </div>
        `).join("");
    } else {
        bar.classList.remove("active");
        chipsContainer.innerHTML = "";
    }
};

const clearIndividualFilter = (clearType) => {
    if (clearType === "date") {
        const startInput = document.getElementById("filter_start_date");
        const endInput = document.getElementById("filter_end_date");
        if (startInput) startInput.value = "";
        if (endInput) endInput.value = "";
        const presetAll = document.querySelector('.date-preset-btn[data-preset="all"]');
        if (presetAll) presetAll.click();
        else {
            updateReportDrawerBadge();
            fetchReportData();
        }
    } else if (clearType === "secondary") {
        const secondarySelect = document.getElementById("filter_secondary");
        if (secondarySelect) secondarySelect.value = "";
        fetchReportData();
    } else if (clearType === "search") {
        const searchInput = document.getElementById("filter_search_query");
        if (searchInput) searchInput.value = "";
        applyQuickTableSearch();
        updateActiveFiltersBar();
    } else if (clearType === "sort") {
        currentSort = { column: null, direction: "asc" };
        renderActiveReport();
    }
};

const resetAllFiltersAndSort = () => {
    const startInput = document.getElementById("filter_start_date");
    const endInput = document.getElementById("filter_end_date");
    const secondarySelect = document.getElementById("filter_secondary");
    const searchInput = document.getElementById("filter_search_query");

    if (startInput) startInput.value = "";
    if (endInput) endInput.value = "";
    if (secondarySelect) secondarySelect.value = "";
    if (searchInput) searchInput.value = "";
    currentSort = { column: null, direction: "asc" };

    const presetAll = document.querySelector('.date-preset-btn[data-preset="all"]');
    if (presetAll) presetAll.click();
    else {
        updateReportDrawerBadge();
        fetchReportData();
    }
};

const formatPesos = (val) => {
    const num = parseFloat(val) || 0;
    return "₱" + num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDateYMD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const initReports = async () => {
    setupTabSwitching();
    setupPresetButtons();
    setupEventListeners();
    await loadFilterLookups();
    updateSecondaryFilterUI();
    await fetchReportData();
};

const setupTabSwitching = () => {
    const tabButtons = document.querySelectorAll(".report-tab-btn");
    tabButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            tabButtons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            currentTab = btn.getAttribute("data-tab");
            currentSort = { column: null, direction: "asc" };
            updateSecondaryFilterUI();
            fetchReportData();
        });
    });
};

const openReportDrawer = () => {
    const overlay = document.getElementById("reportDrawerOverlay");
    const drawer = document.getElementById("reportDrawer");
    if (overlay && drawer) {
        overlay.classList.add("active");
        drawer.classList.add("open");
        document.body.style.overflow = "hidden";
    }
};

const closeReportDrawer = () => {
    const overlay = document.getElementById("reportDrawerOverlay");
    const drawer = document.getElementById("reportDrawer");
    if (overlay && drawer) {
        overlay.classList.remove("active");
        drawer.classList.remove("open");
        document.body.style.overflow = "";
    }
};

const updateReportDrawerBadge = () => {
    const badge = document.getElementById("report-drawer-badge");
    if (!badge) return;
    const activePreset = document.querySelector(".date-preset-btn.active");
    if (activePreset) {
        badge.textContent = activePreset.textContent.trim();
        return;
    }
    const startInput = document.getElementById("filter_start_date");
    const endInput = document.getElementById("filter_end_date");
    if ((startInput && startInput.value) || (endInput && endInput.value)) {
        badge.textContent = "Custom Dates";
    } else {
        badge.textContent = "All Time";
    }
};

const setupPresetButtons = () => {
    const presetButtons = document.querySelectorAll(".date-preset-btn");
    const startInput = document.getElementById("filter_start_date");
    const endInput = document.getElementById("filter_end_date");

    presetButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            presetButtons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            const preset = btn.getAttribute("data-preset");
            const now = new Date();

            if (preset === "all") {
                startInput.value = "";
                endInput.value = "";
            } else if (preset === "today") {
                const todayStr = formatDateYMD(now);
                startInput.value = todayStr;
                endInput.value = todayStr;
            } else if (preset === "week") {
                const day = now.getDay();
                const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(now.setDate(diffToMonday));
                startInput.value = formatDateYMD(monday);
                endInput.value = formatDateYMD(new Date());
            } else if (preset === "month") {
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                startInput.value = formatDateYMD(firstDay);
                endInput.value = formatDateYMD(new Date());
            }

            updateReportDrawerBadge();
            fetchReportData();
        });
    });
};

const setupEventListeners = () => {
    const secondarySelect = document.getElementById("filter_secondary");
    if (secondarySelect) {
        secondarySelect.addEventListener("change", () => fetchReportData());
    }

    const startInput = document.getElementById("filter_start_date");
    const endInput = document.getElementById("filter_end_date");
    const handleDateChange = () => {
        document.querySelectorAll(".date-preset-btn").forEach((b) => b.classList.remove("active"));
        updateReportDrawerBadge();
        fetchReportData();
    };

    if (startInput) startInput.addEventListener("change", handleDateChange);
    if (endInput) endInput.addEventListener("change", handleDateChange);

    const searchInput = document.getElementById("filter_search_query");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            applyQuickTableSearch();
        });
    }

    const btnReset = document.getElementById("btnResetFilter");
    if (btnReset) {
        btnReset.addEventListener("click", () => {
            if (startInput) startInput.value = "";
            if (endInput) endInput.value = "";
            if (secondarySelect) secondarySelect.value = "";
            if (searchInput) searchInput.value = "";
            currentSort = { column: null, direction: "asc" };
            const presetAll = document.querySelector('.date-preset-btn[data-preset="all"]');
            if (presetAll) presetAll.click();
            else {
                updateReportDrawerBadge();
                fetchReportData();
            }
        });
    }

    const thead = document.getElementById("report-table-head");
    if (thead) {
        thead.addEventListener("click", (e) => {
            const th = e.target.closest("th.sortable-th");
            if (th) {
                const sortKey = th.getAttribute("data-sort");
                handleHeaderSort(sortKey);
            }
        });
        thead.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                const th = e.target.closest("th.sortable-th");
                if (th) {
                    e.preventDefault();
                    const sortKey = th.getAttribute("data-sort");
                    handleHeaderSort(sortKey);
                }
            }
        });
    }

    const activeFiltersBar = document.getElementById("active-filters-bar");
    if (activeFiltersBar) {
        activeFiltersBar.addEventListener("click", (e) => {
            const btnRemove = e.target.closest(".filter-chip-remove");
            if (btnRemove) {
                const clearType = btnRemove.getAttribute("data-clear");
                clearIndividualFilter(clearType);
                return;
            }

            const btnClearAll = e.target.closest("#btnClearActiveFilters");
            if (btnClearAll) {
                resetAllFiltersAndSort();
            }
        });
    }

    const btnExcel = document.getElementById("btnExportExcel");
    if (btnExcel) {
        btnExcel.addEventListener("click", exportToExcel);
    }

    const btnCsv = document.getElementById("btnExportCsv");
    if (btnCsv) {
        btnCsv.addEventListener("click", exportToCsv);
    }

    const btnPrint = document.getElementById("btnPrintReport");
    if (btnPrint) {
        btnPrint.addEventListener("click", printOfficialReport);
    }

    const btnToggleDrawer = document.getElementById("btnToggleReportDrawer");
    if (btnToggleDrawer) {
        btnToggleDrawer.addEventListener("click", openReportDrawer);
    }

    const btnCloseDrawer = document.getElementById("btnCloseReportDrawer");
    if (btnCloseDrawer) {
        btnCloseDrawer.addEventListener("click", closeReportDrawer);
    }

    const overlay = document.getElementById("reportDrawerOverlay");
    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeReportDrawer();
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeReportDrawer();
        }
    });

    initRefreshBtn("btnRefreshReports", async () => {
        await loadFilterLookups();
        await fetchReportData();
    });
};

const loadFilterLookups = async () => {
    try {
        const res = await axios.get("../api/GET/reports.php?action=lookups");
        if (res.data && res.data.status === "success") {
            lookupData = res.data;
        }
    } catch (err) {
        console.error("Failed to load filter lookups:", err);
    }
};

const updateSecondaryFilterUI = () => {
    const container = document.getElementById("secondary-filter-container");
    const label = document.getElementById("filter_secondary_label");
    const select = document.getElementById("filter_secondary");
    if (!container || !label || !select) return;

    select.innerHTML = '<option value="">All Records</option>';

    if (currentTab === "collections") {
        container.style.display = "inline-flex";
        label.textContent = "Payment Method";
        lookupData.payment_methods.forEach((pm) => {
            const opt = document.createElement("option");
            opt.value = pm.Payment_Method_ID;
            opt.textContent = pm.Method_Name;
            select.appendChild(opt);
        });
    } else if (currentTab === "doctor_fees") {
        container.style.display = "inline-flex";
        label.textContent = "Physician";
        lookupData.doctors.forEach((d) => {
            const opt = document.createElement("option");
            opt.value = d.Doctor_ID;
            opt.textContent = d.Full_Name;
            select.appendChild(opt);
        });
    } else if (currentTab === "ar_aging") {
        container.style.display = "inline-flex";
        label.textContent = "Note Status";
        [
            { val: "Active", label: "Active Notes" },
            { val: "Overdue", label: "Overdue Notes" },
            { val: "Settled", label: "Settled Notes" }
        ].forEach((item) => {
            const opt = document.createElement("option");
            opt.value = item.val;
            opt.textContent = item.label;
            select.appendChild(opt);
        });
    } else {
        container.style.display = "none";
    }
};

const fetchReportData = async () => {
    const tableBody = document.getElementById("report-table-body");
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="12" class="report-loading-cell">
                    <div class="report-loading-title">Querying database records...</div>
                    <span class="report-loading-sub">Computing financial transactions and totals</span>
                </td>
            </tr>
        `;
    }

    const printTableBody = document.getElementById("print-report-table-body");
    if (printTableBody) {
        printTableBody.innerHTML = `
            <tr>
                <td colspan="12" class="report-loading-cell">
                    <div class="report-loading-title">Querying database records...</div>
                    <span class="report-loading-sub">Computing financial transactions and totals</span>
                </td>
            </tr>
        `;
    }

    const startDate = document.getElementById("filter_start_date").value;
    const endDate = document.getElementById("filter_end_date").value;
    const secondaryVal = document.getElementById("filter_secondary").value;

    const params = { action: currentTab };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    if (currentTab === "collections" && secondaryVal) {
        params.method_id = secondaryVal;
    } else if (currentTab === "doctor_fees" && secondaryVal) {
        params.doctor_id = secondaryVal;
    } else if (currentTab === "ar_aging" && secondaryVal) {
        params.status = secondaryVal;
    }

    try {
        const res = await axios.get("../api/GET/reports.php", { params });
        if (res.data && res.data.status === "success") {
            reportData = res.data;
            renderActiveReport();
        } else {
            showErrorState(res.data?.message || "Failed to fetch report data.");
        }
    } catch (err) {
        console.error("Report fetch error:", err);
        showErrorState("Network connection or server error while generating report.");
    }
};

const showErrorState = (msg) => {
    const tbody = document.getElementById("report-table-body");
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" class="report-error-cell">
                    <div class="report-error-title">Error Loading Report</div>
                    <div class="report-error-message">${msg}</div>
                </td>
            </tr>
        `;
    }

    const printTbody = document.getElementById("print-report-table-body");
    if (printTbody) {
        printTbody.innerHTML = `
            <tr>
                <td colspan="12" class="report-error-cell">
                    <div class="report-error-title">Error Loading Report</div>
                    <div class="report-error-message">${msg}</div>
                </td>
            </tr>
        `;
    }
};

const renderActiveReport = () => {
    if (!reportData) return;

    if (currentTab === "collections") {
        renderCollectionsReport();
    } else if (currentTab === "department_revenue") {
        renderDepartmentRevenueReport();
    } else if (currentTab === "doctor_fees") {
        renderDoctorFeesReport();
    } else if (currentTab === "ar_aging") {
        renderArAgingReport();
    } else if (currentTab === "bed_occupancy") {
        renderBedOccupancyReport();
    }

    renderPrintTable();
    updatePrintHeader();
    applyQuickTableSearch();
    updateActiveFiltersBar();
};

const applyQuickTableSearch = () => {
    const searchInput = document.getElementById("filter_search_query");
    const tbody = document.getElementById("report-table-body");
    const printTbody = document.getElementById("print-report-table-body");
    if (!searchInput) return;

    const query = searchInput.value.trim().toLowerCase();
    if (tbody) {
        const rows = tbody.querySelectorAll("tr");
        rows.forEach((row) => {
            if (row.cells.length <= 1) return;
            const rowText = (row.textContent || "").toLowerCase();
            row.style.display = !query || rowText.includes(query) ? "" : "none";
        });
    }
    if (printTbody) {
        const printRows = printTbody.querySelectorAll("tr");
        printRows.forEach((row) => {
            if (row.cells.length <= 1) return;
            const rowText = (row.textContent || "").toLowerCase();
            row.style.display = !query || rowText.includes(query) ? "" : "none";
        });
    }
    updateActiveFiltersBar();
};

const updatePrintHeader = () => {
    const printTitle = document.getElementById("print-report-title");
    const printDates = document.getElementById("print-date-range");
    const printGen = document.getElementById("print-generated-on");
    const printBy = document.getElementById("print-generated-by");
    const sigPrepared = document.getElementById("sig-prepared-name");

    const startDate = document.getElementById("filter_start_date").value;
    const endDate = document.getElementById("filter_end_date").value;

    let dateText = "All Recorded Transactions";
    if (startDate && endDate) {
        dateText = `Period: ${startDate} to ${endDate}`;
    } else if (startDate) {
        dateText = `Period: From ${startDate} onwards`;
    } else if (endDate) {
        dateText = `Period: Up to ${endDate}`;
    }

    if (printDates) printDates.textContent = dateText;
    if (printGen) printGen.textContent = "Generated: " + new Date().toLocaleString("en-PH");

    const sessionUser = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    const userName = sessionUser.Full_Name || sessionUser.Username || "System Administrator";

    if (printBy) printBy.textContent = `Prepared by: ${userName}`;
    if (sigPrepared) sigPrepared.textContent = `${userName} (Billing Staff)`;

    if (printTitle) {
        const titles = {
            collections: "Daily Cashier Collections & Remittance Report",
            department_revenue: "Departmental & Station Revenue Breakdown Report",
            doctor_fees: "Doctor Professional Fees (PF) & Rounds Summary",
            ar_aging: "Accounts Receivable (AR) & Promissory Note Aging Report",
            bed_occupancy: "In-Patient Bed Capacity & Ward Occupancy Report"
        };
        printTitle.textContent = titles[currentTab] || "Hospital Financial Audit Report";
    }
};

const renderCollectionsReport = () => {
    const summary = reportData.summary || {};
    const rawRecords = reportData.records || [];
    const records = getSortedRecords(rawRecords);

    document.getElementById("spreadsheet-title").textContent = "Daily Cashier Collections & Remittance Spreadsheet";
    document.getElementById("spreadsheet-subtitle").textContent = "Itemized receipt audit, payment method classifications, and live cashier remittance.";
    document.getElementById("record-count-badge").textContent = `${records.length} Receipt Payments`;

    const kpiEl = document.getElementById("report-kpi-container");
    kpiEl.innerHTML = `
        <div class="report-kpi-card report-kpi-emerald">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Total Collections</h4>
                </div>
                <span class="report-kpi-status-pill pill-success">Remitted</span>
            </div>
            <div class="report-kpi-value report-kpi-value-accent">${formatPesos(summary.total_collections)}</div>
            <div class="report-kpi-sub">${summary.transaction_count} official payment transactions</div>
        </div>
        <div class="report-kpi-card report-kpi-sky">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Advance Bed Deposits</h4>
                </div>
                <span class="report-kpi-status-pill pill-info">Deposits</span>
            </div>
            <div class="report-kpi-value report-kpi-value-accent">${formatPesos(summary.advance_total)}</div>
            <div class="report-kpi-sub">Pre-discharge admission deposits</div>
        </div>
        <div class="report-kpi-card report-kpi-indigo">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Final Settlements</h4>
                </div>
                <span class="report-kpi-status-pill pill-neutral">Settled</span>
            </div>
            <div class="report-kpi-value report-kpi-value-accent">${formatPesos(summary.settlement_total)}</div>
            <div class="report-kpi-sub">Discharge invoice settlements</div>
        </div>
        <div class="report-kpi-card report-kpi-amber">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Payment Channels</h4>
                </div>
                <span class="report-kpi-status-pill pill-warning">${summary.by_method?.length || 0} Methods</span>
            </div>
            <div class="report-kpi-value">${summary.by_method?.length || 0} Methods</div>
            <div class="report-kpi-sub">${summary.by_method?.map((m) => m.Method_Name + ': ' + m.Transaction_Count).join(', ') || 'None'}</div>
        </div>
    `;

    const thead = document.getElementById("report-table-head");
    thead.innerHTML = `
        <tr>
            ${renderSortableHeader("Receipt & Timestamp", "Payment_Date")}
            ${renderSortableHeader("Patient & Case", "Patient_Name")}
            ${renderSortableHeader("Payment Method & Stage", "Payment_Method")}
            ${renderSortableHeader("Amount Paid & Balance", "Amount_Paid", true)}
            ${renderSortableHeader("Remarks / Notes", "Notes")}
        </tr>
    `;

    const tbody = document.getElementById("report-table-body");
    if (records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center p-4 text-muted">
                    No payment records found matching the selected date filters.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = records.map((r) => `
            <tr>
                <td>
                    <div class="table-primary-text font-bold text-info">${r.Receipt_Number}</div>
                    <div class="table-sub-text">${r.Payment_Date}</div>
                </td>
                <td>
                    <div class="table-primary-text font-bold">${r.Patient_Name}</div>
                    <div class="table-sub-text"><span class="badge badge-secondary">${r.Admission_Code}</span></div>
                </td>
                <td>
                    <div>
                        <span class="badge badge-info">${r.Payment_Method}</span>
                        <span class="badge ${r.Is_Advance == 1 ? 'badge-primary' : 'badge-success'}">${r.Payment_Type}</span>
                    </div>
                    <div class="table-sub-text">${r.Cashier_Name}</div>
                </td>
                <td class="text-right">
                    <div class="table-amount-prominent text-success font-bold">${formatPesos(r.Amount_Paid)}</div>
                    <div class="table-sub-text">Bal After: ${formatPesos(r.Balance_After)}</div>
                </td>
                <td><div class="table-sub-text-dark">${r.Notes || '—'}</div></td>
            </tr>
        `).join("");
    }

    const tfoot = document.getElementById("report-table-foot");
    tfoot.innerHTML = `
        <tr>
            <td colspan="3" class="text-right font-bold uppercase">Grand Total Collections:</td>
            <td class="text-right">
                <div class="table-amount-prominent text-success font-bold">${formatPesos(summary.total_collections)}</div>
            </td>
            <td></td>
        </tr>
    `;
};

const renderDepartmentRevenueReport = () => {
    const summary = reportData.summary || {};
    const rawStations = summary.by_station || [];
    const stations = getSortedRecords(rawStations);
    const details = reportData.records || [];

    document.getElementById("spreadsheet-title").textContent = "Departmental & Station Revenue Breakdown Spreadsheet";
    document.getElementById("spreadsheet-subtitle").textContent = "Station charge distribution, clinical return credits, net revenue, and percentage contribution.";
    document.getElementById("record-count-badge").textContent = `${stations.length} Active Stations`;

    const kpiEl = document.getElementById("report-kpi-container");
    kpiEl.innerHTML = `
        <div class="report-kpi-card report-kpi-sky">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Gross Charges</h4>
                </div>
                <span class="report-kpi-status-pill pill-info">Gross</span>
            </div>
            <div class="report-kpi-value report-kpi-value-accent">${formatPesos(summary.grand_gross)}</div>
            <div class="report-kpi-sub">${summary.grand_transactions} total ledger entries</div>
        </div>
        <div class="report-kpi-card report-kpi-amber">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Credits &amp; Returns</h4>
                </div>
                <span class="report-kpi-status-pill pill-warning">Adjusted</span>
            </div>
            <div class="report-kpi-value report-kpi-value-accent">${formatPesos(summary.grand_returns)}</div>
            <div class="report-kpi-sub">Returned medicines &amp; voided items</div>
        </div>
        <div class="report-kpi-card report-kpi-emerald">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Net Billed Revenue</h4>
                </div>
                <span class="report-kpi-status-pill pill-success">Net</span>
            </div>
            <div class="report-kpi-value report-kpi-value-accent">${formatPesos(summary.grand_net)}</div>
            <div class="report-kpi-sub">Net patient clinical fees</div>
        </div>
        <div class="report-kpi-card report-kpi-purple">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Top Station</h4>
                </div>
                <span class="report-kpi-status-pill pill-purple">${stations[0]?.Revenue_Share_Pct || 0}%</span>
            </div>
            <div class="report-kpi-value report-kpi-value-station">${stations[0]?.Station_Name || 'None'}</div>
            <div class="report-kpi-sub">${stations[0]?.Revenue_Share_Pct || 0}% share of revenue</div>
        </div>
    `;

    const thead = document.getElementById("report-table-head");
    thead.innerHTML = `
        <tr>
            ${renderSortableHeader("Station / Department", "Station_Name")}
            ${renderSortableHeader("Transactions", "Total_Transactions", true)}
            ${renderSortableHeader("Gross Charges & Returns", "Gross_Charges", true)}
            ${renderSortableHeader("Net Revenue", "Net_Revenue", true)}
            ${renderSortableHeader("Share of Total", "Revenue_Share_Pct", true)}
        </tr>
    `;

    const tbody = document.getElementById("report-table-body");
    tbody.innerHTML = stations.map((st) => `
        <tr>
            <td>
                <div class="table-primary-text font-bold">${st.Station_Name}</div>
                <div class="table-sub-text"><span class="badge badge-secondary">${st.Code_Prefix}</span></div>
            </td>
            <td class="text-right">
                <div class="table-primary-text font-bold">${st.Total_Transactions}</div>
                <div class="table-sub-text">txns</div>
            </td>
            <td class="text-right">
                <div class="table-sub-text-dark">${formatPesos(st.Gross_Charges)}</div>
                <div class="table-sub-text text-danger">-${formatPesos(st.Total_Returns)} ret</div>
            </td>
            <td class="text-right">
                <div class="table-amount-prominent text-success font-bold">${formatPesos(st.Net_Revenue)}</div>
            </td>
            <td class="text-right">
                <div class="table-primary-text font-bold text-info">${st.Revenue_Share_Pct}%</div>
            </td>
        </tr>
    `).join("");

    const tfoot = document.getElementById("report-table-foot");
    tfoot.innerHTML = `
        <tr>
            <td class="text-right font-bold uppercase">Hospital Grand Totals:</td>
            <td class="text-right font-bold">${summary.grand_transactions} txns</td>
            <td class="text-right">
                <div>${formatPesos(summary.grand_gross)}</div>
                <div class="text-danger">-${formatPesos(summary.grand_returns)}</div>
            </td>
            <td class="text-right">
                <div class="table-amount-prominent text-success font-bold">${formatPesos(summary.grand_net)}</div>
            </td>
            <td class="text-right font-bold text-info">100.00%</td>
        </tr>
    `;
};

const renderDoctorFeesReport = () => {
    const summary = reportData.summary || {};
    const rawDoctors = summary.by_doctor || [];
    const doctors = getSortedRecords(rawDoctors);

    document.getElementById("spreadsheet-title").textContent = "Doctor Professional Fees (PF) & Rounds Summary Spreadsheet";
    document.getElementById("spreadsheet-subtitle").textContent = "Attending physician visit counts, unique patients attended, base fees, and total PF billings.";
    document.getElementById("record-count-badge").textContent = `${doctors.length} Doctors`;

    const kpiEl = document.getElementById("report-kpi-container");
    kpiEl.innerHTML = `
        <div class="report-kpi-card report-kpi-sky">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Total Professional Fees</h4>
                </div>
                <span class="report-kpi-status-pill pill-info">Total Fees</span>
            </div>
            <div class="report-kpi-value report-kpi-value-accent">${formatPesos(summary.grand_pf_total)}</div>
            <div class="report-kpi-sub">Total doctor round billings</div>
        </div>
        <div class="report-kpi-card report-kpi-emerald">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Total Bedside Visits</h4>
                </div>
                <span class="report-kpi-status-pill pill-success">Visits</span>
            </div>
            <div class="report-kpi-value report-kpi-value-accent">${summary.grand_rounds_count} Visits</div>
            <div class="report-kpi-sub">Logged in patient charts</div>
        </div>
        <div class="report-kpi-card report-kpi-indigo">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Active Doctors</h4>
                </div>
                <span class="report-kpi-status-pill pill-neutral">${summary.doctors_count} MDs</span>
            </div>
            <div class="report-kpi-value">${summary.doctors_count} Physicians</div>
            <div class="report-kpi-sub">In hospital medical staff</div>
        </div>
        <div class="report-kpi-card report-kpi-amber">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Average Fee per Round</h4>
                </div>
                <span class="report-kpi-status-pill pill-warning">Avg Rate</span>
            </div>
            <div class="report-kpi-value report-kpi-value-accent">
                ${summary.grand_rounds_count > 0 ? formatPesos(summary.grand_pf_total / summary.grand_rounds_count) : '₱0.00'}
            </div>
            <div class="report-kpi-sub">Average round charge rate</div>
        </div>
    `;

    const thead = document.getElementById("report-table-head");
    thead.innerHTML = `
        <tr>
            ${renderSortableHeader("Physician & Designation", "Doctor_Name")}
            ${renderSortableHeader("Station & Standard Round Fee", "Department_Station")}
            ${renderSortableHeader("Rounds Conducted", "Total_Rounds", true)}
            ${renderSortableHeader("Unique Patients", "Unique_Patients_Attended", true)}
            ${renderSortableHeader("Total PF Generated", "Total_PF_Generated", true)}
        </tr>
    `;

    const tbody = document.getElementById("report-table-body");
    tbody.innerHTML = doctors.map((d) => `
        <tr>
            <td>
                <div class="table-primary-text font-bold">${d.Doctor_Name}</div>
                <div class="table-sub-text"><span class="badge badge-secondary">${d.Doctor_Code}</span> &bull; <span class="badge badge-info">${d.Doctor_Type}</span></div>
            </td>
            <td>
                <div class="table-primary-text">${d.Department_Station}</div>
                <div class="table-sub-text">Fee: ${formatPesos(d.Base_Round_Fee)} / round</div>
            </td>
            <td class="text-right">
                <div class="table-primary-text font-bold">${d.Total_Rounds}</div>
                <div class="table-sub-text">rounds</div>
            </td>
            <td class="text-right">
                <div class="table-primary-text font-bold">${d.Unique_Patients_Attended}</div>
                <div class="table-sub-text">patients</div>
            </td>
            <td class="text-right">
                <div class="table-amount-prominent text-info font-bold">${formatPesos(d.Total_PF_Generated)}</div>
            </td>
        </tr>
    `).join("");

    const tfoot = document.getElementById("report-table-foot");
    tfoot.innerHTML = `
        <tr>
            <td colspan="2" class="text-right font-bold uppercase">Total Professional Fees & Rounds:</td>
            <td class="text-right font-bold">${summary.grand_rounds_count} rounds</td>
            <td></td>
            <td class="text-right">
                <div class="table-amount-prominent text-info font-bold">${formatPesos(summary.grand_pf_total)}</div>
            </td>
        </tr>
    `;
};

const renderArAgingReport = () => {
    const summary = reportData.summary || {};
    const rawNotes = reportData.records || [];
    const notes = getSortedRecords(rawNotes);

    document.getElementById("spreadsheet-title").textContent = "Accounts Receivable (AR) & Promissory Note Aging Spreadsheet";
    document.getElementById("spreadsheet-subtitle").textContent = "Promissory note aging schedules (Current, 1-30d, 31-60d, 61-90d, 90+d overdue), installments, and guarantors.";
    document.getElementById("record-count-badge").textContent = `${notes.length} Promissory Notes`;

    const kpiEl = document.getElementById("report-kpi-container");
    kpiEl.innerHTML = `
        <div class="report-kpi-card report-kpi-indigo">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Total Outstanding AR</h4>
                </div>
                <span class="report-kpi-status-pill pill-warning">Receivables</span>
            </div>
            <div class="report-kpi-value report-kpi-value-accent">${formatPesos(summary.total_active_ar)}</div>
            <div class="report-kpi-sub">Unsettled promissory notes balance</div>
        </div>
        <div class="report-kpi-card report-kpi-emerald">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Current (Within Term)</h4>
                </div>
                <span class="report-kpi-status-pill pill-success">Current</span>
            </div>
            <div class="report-kpi-value report-kpi-value-accent">${formatPesos(summary.current_not_due)}</div>
            <div class="report-kpi-sub">Due date has not lapsed</div>
        </div>
        <div class="report-kpi-card report-kpi-amber">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </span>
                    <h4 class="report-kpi-label">1 - 30 Days Overdue</h4>
                </div>
                <span class="report-kpi-status-pill pill-warning">1-30d Overdue</span>
            </div>
            <div class="report-kpi-value report-kpi-value-accent">${formatPesos(summary.overdue_1_30)}</div>
            <div class="report-kpi-sub">Recent overdue balances</div>
        </div>
        <div class="report-kpi-card report-kpi-rose">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </span>
                    <h4 class="report-kpi-label">31+ Days Overdue</h4>
                </div>
                <span class="report-kpi-status-pill pill-danger">Extended</span>
            </div>
            <div class="report-kpi-value report-kpi-value-accent">
                ${formatPesos(summary.overdue_31_60 + summary.overdue_61_90 + summary.overdue_over_90)}
            </div>
            <div class="report-kpi-sub">Extended collection follow-up</div>
        </div>
    `;

    const thead = document.getElementById("report-table-head");
    thead.innerHTML = `
        <tr>
            ${renderSortableHeader("Note & Invoice", "Note_Code")}
            ${renderSortableHeader("Patient & Guarantor", "Patient_Name")}
            ${renderSortableHeader("Payment Plan", "Plan_Type_Name")}
            ${renderSortableHeader("Balance Owed & Aging", "Total_Balance_Owed", true)}
            ${renderSortableHeader("Status", "Status")}
        </tr>
    `;

    const tbody = document.getElementById("report-table-body");
    if (notes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center p-4 text-muted">
                    No promissory notes found matching the selected status filter.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = notes.map((n) => {
            let bracketBadge = "badge-success";
            if (n.Aging_Bracket.includes("1-30")) bracketBadge = "badge-warning";
            else if (n.Aging_Bracket.includes("31-60") || n.Aging_Bracket.includes("61-90") || n.Aging_Bracket.includes("90+")) bracketBadge = "badge-danger";

            let statusBadge = "badge-warning";
            if (n.Status === "Settled") statusBadge = "badge-success";
            else if (n.Status === "Overdue") statusBadge = "badge-danger";

            return `
                <tr>
                    <td>
                        <div class="table-primary-text font-mono font-bold text-primary">${n.Note_Code}</div>
                        <div class="table-sub-text"><span class="badge badge-secondary">${n.Invoice_Code}</span></div>
                    </td>
                    <td>
                        <div class="table-primary-text font-bold">${n.Patient_Name}</div>
                        <div class="table-sub-text">Guarantor: ${n.Guarantor_Name} &bull; ${n.Patient_Contact || '—'}</div>
                    </td>
                    <td>
                        <div class="table-primary-text">${n.Plan_Type_Name}</div>
                        <div class="table-sub-text">${formatPesos(n.Monthly_Amount)} / mo</div>
                    </td>
                    <td class="text-right">
                        <div class="table-amount-prominent text-danger font-bold">${formatPesos(n.Total_Balance_Owed)}</div>
                        <div class="table-sub-text">Due: ${n.Due_Date} &bull; <span class="badge ${bracketBadge}">${n.Aging_Bracket}</span></div>
                    </td>
                    <td><span class="badge ${statusBadge}">${n.Status}</span></td>
                </tr>
            `;
        }).join("");
    }

    const tfoot = document.getElementById("report-table-foot");
    tfoot.innerHTML = `
        <tr>
            <td colspan="3" class="text-right font-bold uppercase">Total Active Accounts Receivable:</td>
            <td class="text-right">
                <div class="table-amount-prominent text-danger font-bold">${formatPesos(summary.total_active_ar)}</div>
            </td>
            <td></td>
        </tr>
    `;
};

const renderBedOccupancyReport = () => {
    const summary = reportData.summary || {};
    const rawRooms = summary.by_room || [];
    const rooms = getSortedRecords(rawRooms);
    const occupants = reportData.records || [];

    document.getElementById("spreadsheet-title").textContent = "In-Patient Bed Capacity & Ward Occupancy Spreadsheet";
    document.getElementById("spreadsheet-subtitle").textContent = "Live ward bed inventory, room category capacity, current patient occupancy, and accumulating stay rates.";
    document.getElementById("record-count-badge").textContent = `${summary.total_beds} Total Beds`;

    const kpiEl = document.getElementById("report-kpi-container");
    kpiEl.innerHTML = `
        <div class="report-kpi-card report-kpi-sky">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Total Hospital Beds</h4>
                </div>
                <span class="report-kpi-status-pill pill-info">Capacity</span>
            </div>
            <div class="report-kpi-value">${summary.total_beds} Beds</div>
            <div class="report-kpi-sub">Across ${summary.rooms_count} rooms &amp; wards</div>
        </div>
        <div class="report-kpi-card report-kpi-amber">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Occupied Beds</h4>
                </div>
                <span class="report-kpi-status-pill pill-warning">Occupied</span>
            </div>
            <div class="report-kpi-value report-kpi-value-accent">${summary.occupied_beds} Beds</div>
            <div class="report-kpi-sub">Active in-patient admissions</div>
        </div>
        <div class="report-kpi-card report-kpi-emerald">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Available Vacant Beds</h4>
                </div>
                <span class="report-kpi-status-pill pill-success">Vacant</span>
            </div>
            <div class="report-kpi-value report-kpi-value-accent">${summary.vacant_beds} Beds</div>
            <div class="report-kpi-sub">Ready for immediate admission</div>
        </div>
        <div class="report-kpi-card report-kpi-purple">
            <div class="report-kpi-top">
                <div class="report-kpi-title-group">
                    <span class="report-kpi-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    </span>
                    <h4 class="report-kpi-label">Occupancy Rate</h4>
                </div>
                <span class="report-kpi-status-pill pill-purple">Index</span>
            </div>
            <div class="report-kpi-value report-kpi-value-accent">${summary.occupancy_rate}%</div>
            <div class="report-kpi-sub">Hospital utilization index</div>
        </div>
    `;

    const thead = document.getElementById("report-table-head");
    thead.innerHTML = `
        <tr>
            ${renderSortableHeader("Room / Ward & Classification", "Room_Name")}
            ${renderSortableHeader("Daily Board Rate", "Daily_Rate", true)}
            ${renderSortableHeader("Capacity & Occupancy", "Total_Beds", true)}
            ${renderSortableHeader("Occupancy Rate", "Occupancy_Rate", true)}
            ${renderSortableHeader("Status", "Occupancy_Rate")}
        </tr>
    `;

    const tbody = document.getElementById("report-table-body");
    tbody.innerHTML = rooms.map((rm) => `
        <tr>
            <td>
                <div class="table-primary-text font-bold">${rm.Room_Name}</div>
                <div class="table-sub-text"><span class="badge badge-info">${rm.Room_Type}</span></div>
            </td>
            <td class="text-right">
                <div class="table-amount-prominent font-bold">${formatPesos(rm.Daily_Rate)}</div>
                <div class="table-sub-text">per day</div>
            </td>
            <td class="text-right">
                <div class="table-primary-text font-bold">${rm.Total_Beds} Beds</div>
                <div class="table-sub-text"><span class="text-warning">${rm.Occupied_Beds} occ</span> &bull; <span class="text-success">${rm.Vacant_Beds} vac</span></div>
            </td>
            <td class="text-right">
                <div class="table-primary-text font-bold text-info">${rm.Occupancy_Rate}%</div>
            </td>
            <td>
                <span class="badge ${rm.Occupancy_Rate >= 80 ? 'badge-danger' : (rm.Occupancy_Rate >= 50 ? 'badge-warning' : 'badge-success')}">${rm.Occupancy_Rate >= 80 ? 'High' : (rm.Occupancy_Rate >= 50 ? 'Moderate' : 'Available')}</span>
            </td>
        </tr>
    `).join("");

    const tfoot = document.getElementById("report-table-foot");
    tfoot.innerHTML = `
        <tr>
            <td colspan="2" class="text-right font-bold uppercase">Hospital Capacity Totals:</td>
            <td class="text-right font-bold">${summary.total_beds} beds (${summary.occupied_beds} occ / ${summary.vacant_beds} vac)</td>
            <td class="text-right font-bold text-info">${summary.occupancy_rate}%</td>
            <td></td>
        </tr>
    `;
};

const renderPrintTable = () => {
    const thead = document.getElementById("print-report-table-head");
    const tbody = document.getElementById("print-report-table-body");
    const tfoot = document.getElementById("print-report-table-foot");
    if (!thead || !tbody || !tfoot || !reportData) return;

    const summary = reportData.summary || {};

    if (currentTab === "collections") {
        const records = getSortedRecords(reportData.records || []);
        thead.innerHTML = `
            <tr>
                <th>Receipt #</th>
                <th>Payment Date & Time</th>
                <th>Admission #</th>
                <th>Patient Name</th>
                <th>Payment Method</th>
                <th>Classification</th>
                <th class="text-right">Amount Paid</th>
                <th class="text-right">Balance After</th>
                <th>Cashier User</th>
                <th>Remarks / Notes</th>
            </tr>
        `;

        if (records.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center p-4 text-muted">
                        No payment records found matching the selected date filters.
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = records.map((r) => `
                <tr>
                    <td class="font-bold text-info">${r.Receipt_Number}</td>
                    <td>${r.Payment_Date}</td>
                    <td><span class="badge badge-secondary">${r.Admission_Code}</span></td>
                    <td class="font-bold">${r.Patient_Name}</td>
                    <td><span class="badge badge-info">${r.Payment_Method}</span></td>
                    <td><span class="badge ${r.Is_Advance == 1 ? 'badge-primary' : 'badge-success'}">${r.Payment_Type}</span></td>
                    <td class="currency-cell text-right font-bold text-success">${formatPesos(r.Amount_Paid)}</td>
                    <td class="currency-cell text-right">${formatPesos(r.Balance_After)}</td>
                    <td>${r.Cashier_Name}</td>
                    <td>${r.Notes || '—'}</td>
                </tr>
            `).join("");
        }

        tfoot.innerHTML = `
            <tr>
                <td colspan="6" class="text-right font-bold uppercase">Grand Total Collections:</td>
                <td class="currency-cell text-right font-bold text-success">${formatPesos(summary.total_collections)}</td>
                <td colspan="3"></td>
            </tr>
        `;
    } else if (currentTab === "department_revenue") {
        const stations = getSortedRecords(summary.by_station || []);
        thead.innerHTML = `
            <tr>
                <th>Station / Department</th>
                <th>Code</th>
                <th class="text-right">Transaction Count</th>
                <th class="text-right">Gross Charges</th>
                <th class="text-right">Returns / Deductions</th>
                <th class="text-right">Net Revenue</th>
                <th class="text-right">Share of Total</th>
            </tr>
        `;

        if (stations.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center p-4 text-muted">
                        No department revenue records found.
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = stations.map((st) => `
                <tr>
                    <td class="font-bold">${st.Station_Name}</td>
                    <td><span class="badge badge-secondary">${st.Code_Prefix}</span></td>
                    <td class="number-cell text-right">${st.Total_Transactions}</td>
                    <td class="currency-cell text-right">${formatPesos(st.Gross_Charges)}</td>
                    <td class="currency-cell text-right text-danger">-${formatPesos(st.Total_Returns)}</td>
                    <td class="currency-cell text-right font-bold text-success">${formatPesos(st.Net_Revenue)}</td>
                    <td class="number-cell text-right font-bold text-info">${st.Revenue_Share_Pct}%</td>
                </tr>
            `).join("");
        }

        tfoot.innerHTML = `
            <tr>
                <td colspan="2" class="text-right font-bold uppercase">Hospital Grand Totals:</td>
                <td class="number-cell text-right font-bold">${summary.grand_transactions}</td>
                <td class="currency-cell text-right font-bold">${formatPesos(summary.grand_gross)}</td>
                <td class="currency-cell text-right font-bold text-danger">-${formatPesos(summary.grand_returns)}</td>
                <td class="currency-cell text-right font-bold text-success">${formatPesos(summary.grand_net)}</td>
                <td class="number-cell text-right font-bold text-info">100.00%</td>
            </tr>
        `;
    } else if (currentTab === "doctor_fees") {
        const doctors = getSortedRecords(summary.by_doctor || []);
        thead.innerHTML = `
            <tr>
                <th>Doctor ID</th>
                <th>Physician Full Name</th>
                <th>Designation</th>
                <th>Department / Station</th>
                <th class="text-right">Standard Round Fee</th>
                <th class="text-right">Total Rounds Conducted</th>
                <th class="text-right">Unique Patients</th>
                <th class="text-right">Total PF Generated</th>
            </tr>
        `;

        if (doctors.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center p-4 text-muted">
                        No doctor professional fee records found.
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = doctors.map((d) => `
                <tr>
                    <td><span class="badge badge-secondary">${d.Doctor_Code}</span></td>
                    <td class="font-bold">${d.Doctor_Name}</td>
                    <td><span class="badge badge-info">${d.Doctor_Type}</span></td>
                    <td>${d.Department_Station}</td>
                    <td class="currency-cell text-right">${formatPesos(d.Base_Round_Fee)}</td>
                    <td class="number-cell text-right font-bold">${d.Total_Rounds}</td>
                    <td class="number-cell text-right">${d.Unique_Patients_Attended}</td>
                    <td class="currency-cell text-right font-bold text-info">${formatPesos(d.Total_PF_Generated)}</td>
                </tr>
            `).join("");
        }

        tfoot.innerHTML = `
            <tr>
                <td colspan="5" class="text-right font-bold uppercase">Total Professional Fees & Rounds:</td>
                <td class="number-cell text-right font-bold">${summary.grand_rounds_count}</td>
                <td></td>
                <td class="currency-cell text-right font-bold text-info">${formatPesos(summary.grand_pf_total)}</td>
            </tr>
        `;
    } else if (currentTab === "ar_aging") {
        const notes = getSortedRecords(reportData.records || []);
        thead.innerHTML = `
            <tr>
                <th>Note #</th>
                <th>Invoice #</th>
                <th>Patient Name</th>
                <th>Contact</th>
                <th>Payment Plan</th>
                <th class="text-right">Monthly Installment</th>
                <th class="text-right">Balance Owed</th>
                <th>Next Due Date</th>
                <th>Aging Schedule</th>
                <th>Guarantor</th>
                <th>Status</th>
            </tr>
        `;

        if (notes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center p-4 text-muted">
                        No promissory notes found matching the selected status filter.
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = notes.map((n) => {
                let bracketBadge = "badge-success";
                if (n.Aging_Bracket.includes("1-30")) bracketBadge = "badge-warning";
                else if (n.Aging_Bracket.includes("31-60") || n.Aging_Bracket.includes("61-90") || n.Aging_Bracket.includes("90+")) bracketBadge = "badge-danger";

                let statusBadge = "badge-warning";
                if (n.Status === "Settled") statusBadge = "badge-success";
                else if (n.Status === "Overdue") statusBadge = "badge-danger";

                return `
                    <tr>
                        <td class="font-bold text-primary">${n.Note_Code}</td>
                        <td><span class="badge badge-secondary">${n.Invoice_Code}</span></td>
                        <td class="font-bold">${n.Patient_Name}</td>
                        <td>${n.Patient_Contact || '—'}</td>
                        <td>${n.Plan_Type_Name}</td>
                        <td class="currency-cell text-right">${formatPesos(n.Monthly_Amount)}</td>
                        <td class="currency-cell text-right font-bold text-danger">${formatPesos(n.Total_Balance_Owed)}</td>
                        <td>${n.Due_Date}</td>
                        <td><span class="badge ${bracketBadge}">${n.Aging_Bracket}</span></td>
                        <td>${n.Guarantor_Name}</td>
                        <td><span class="badge ${statusBadge}">${n.Status}</span></td>
                    </tr>
                `;
            }).join("");
        }

        tfoot.innerHTML = `
            <tr>
                <td colspan="6" class="text-right font-bold uppercase">Total Active Accounts Receivable:</td>
                <td class="currency-cell text-right font-bold text-danger">${formatPesos(summary.total_active_ar)}</td>
                <td colspan="4"></td>
            </tr>
        `;
    } else if (currentTab === "bed_occupancy") {
        const rooms = getSortedRecords(summary.by_room || []);
        thead.innerHTML = `
            <tr>
                <th>Room / Ward Name</th>
                <th>Classification</th>
                <th class="text-right">Daily Board Rate</th>
                <th class="text-right">Bed Capacity</th>
                <th class="text-right">Occupied Beds</th>
                <th class="text-right">Available Beds</th>
                <th class="text-right">Occupancy Rate</th>
                <th>Status</th>
            </tr>
        `;

        if (rooms.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center p-4 text-muted">
                        No rooms or bed records found.
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = rooms.map((rm) => `
                <tr>
                    <td class="font-bold">${rm.Room_Name}</td>
                    <td><span class="badge badge-info">${rm.Room_Type}</span></td>
                    <td class="currency-cell text-right">${formatPesos(rm.Daily_Rate)}</td>
                    <td class="number-cell text-right">${rm.Total_Beds}</td>
                    <td class="number-cell text-right text-warning font-bold">${rm.Occupied_Beds}</td>
                    <td class="number-cell text-right text-success font-bold">${rm.Vacant_Beds}</td>
                    <td class="number-cell text-right font-bold text-info">${rm.Occupancy_Rate}%</td>
                    <td><span class="badge ${rm.Occupancy_Rate >= 80 ? 'badge-danger' : (rm.Occupancy_Rate >= 50 ? 'badge-warning' : 'badge-success')}">${rm.Occupancy_Rate >= 80 ? 'High' : (rm.Occupancy_Rate >= 50 ? 'Moderate' : 'Available')}</span></td>
                </tr>
            `).join("");
        }

        tfoot.innerHTML = `
            <tr>
                <td colspan="3" class="text-right font-bold uppercase">Hospital Capacity Totals:</td>
                <td class="number-cell text-right font-bold">${summary.total_beds}</td>
                <td class="number-cell text-right font-bold text-warning">${summary.occupied_beds}</td>
                <td class="number-cell text-right font-bold text-success">${summary.vacant_beds}</td>
                <td class="number-cell text-right font-bold text-info">${summary.occupancy_rate}%</td>
                <td></td>
            </tr>
        `;
    }
};

const getUncombinedReportData = () => {
    if (!reportData) return null;

    const summary = reportData.summary || {};
    const searchInput = document.getElementById("filter_search_query");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    let headers = [];
    let rows = [];
    let footerRow = [];

    if (currentTab === "collections") {
        const records = getSortedRecords(reportData.records || []);
        headers = [
            "Receipt #",
            "Payment Date & Time",
            "Admission #",
            "Patient Name",
            "Payment Method",
            "Classification",
            "Amount Paid",
            "Balance After",
            "Cashier User",
            "Remarks / Notes"
        ];
        rows = records.map((r) => [
            r.Receipt_Number,
            r.Payment_Date,
            r.Admission_Code,
            r.Patient_Name,
            r.Payment_Method,
            r.Payment_Type,
            formatPesos(r.Amount_Paid),
            formatPesos(r.Balance_After),
            r.Cashier_Name,
            r.Notes || ""
        ]);
        if (query) {
            rows = rows.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(query)));
        }
        footerRow = [
            "Grand Total Collections:",
            "",
            "",
            "",
            "",
            "",
            formatPesos(summary.total_collections),
            "",
            "",
            ""
        ];
    } else if (currentTab === "department_revenue") {
        const stations = getSortedRecords(summary.by_station || []);
        headers = [
            "Station / Department",
            "Code",
            "Transaction Count",
            "Gross Charges",
            "Returns / Deductions",
            "Net Revenue",
            "Share of Total"
        ];
        rows = stations.map((st) => [
            st.Station_Name,
            st.Code_Prefix,
            st.Total_Transactions,
            formatPesos(st.Gross_Charges),
            formatPesos(st.Total_Returns),
            formatPesos(st.Net_Revenue),
            `${st.Revenue_Share_Pct}%`
        ]);
        if (query) {
            rows = rows.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(query)));
        }
        footerRow = [
            "Hospital Grand Totals:",
            "",
            `${summary.grand_transactions} txns`,
            formatPesos(summary.grand_gross),
            `-${formatPesos(summary.grand_returns)}`,
            formatPesos(summary.grand_net),
            "100.00%"
        ];
    } else if (currentTab === "doctor_fees") {
        const doctors = getSortedRecords(summary.by_doctor || []);
        headers = [
            "Doctor ID",
            "Physician Full Name",
            "Designation",
            "Department / Station",
            "Standard Round Fee",
            "Total Rounds Conducted",
            "Unique Patients",
            "Total PF Generated"
        ];
        rows = doctors.map((d) => [
            d.Doctor_Code,
            d.Doctor_Name,
            d.Doctor_Type,
            d.Department_Station,
            formatPesos(d.Base_Round_Fee),
            d.Total_Rounds,
            d.Unique_Patients_Attended,
            formatPesos(d.Total_PF_Generated)
        ]);
        if (query) {
            rows = rows.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(query)));
        }
        footerRow = [
            "Total Professional Fees & Rounds:",
            "",
            "",
            "",
            "",
            `${summary.grand_rounds_count} rounds`,
            "",
            formatPesos(summary.grand_pf_total)
        ];
    } else if (currentTab === "ar_aging") {
        const notes = getSortedRecords(reportData.records || []);
        headers = [
            "Note #",
            "Invoice #",
            "Patient Name",
            "Contact",
            "Payment Plan",
            "Monthly Installment",
            "Balance Owed",
            "Next Due Date",
            "Aging Schedule",
            "Guarantor",
            "Status"
        ];
        rows = notes.map((n) => [
            n.Note_Code,
            n.Invoice_Code,
            n.Patient_Name,
            n.Patient_Contact || "",
            n.Plan_Type_Name,
            formatPesos(n.Monthly_Amount),
            formatPesos(n.Total_Balance_Owed),
            n.Due_Date,
            n.Aging_Bracket,
            n.Guarantor_Name,
            n.Status
        ]);
        if (query) {
            rows = rows.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(query)));
        }
        footerRow = [
            "Total Active Accounts Receivable:",
            "",
            "",
            "",
            "",
            "",
            formatPesos(summary.total_active_ar),
            "",
            "",
            "",
            ""
        ];
    } else if (currentTab === "bed_occupancy") {
        const rooms = getSortedRecords(summary.by_room || []);
        headers = [
            "Room / Ward Name",
            "Classification",
            "Daily Board Rate",
            "Bed Capacity",
            "Occupied Beds",
            "Available Beds",
            "Occupancy Rate",
            "Status"
        ];
        rows = rooms.map((rm) => [
            rm.Room_Name,
            rm.Room_Type,
            formatPesos(rm.Daily_Rate),
            rm.Total_Beds,
            rm.Occupied_Beds,
            rm.Vacant_Beds,
            `${rm.Occupancy_Rate}%`,
            rm.Occupancy_Rate >= 80 ? "High" : (rm.Occupancy_Rate >= 50 ? "Moderate" : "Available")
        ]);
        if (query) {
            rows = rows.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(query)));
        }
        footerRow = [
            "Hospital Capacity Totals:",
            "",
            "",
            `${summary.total_beds} beds`,
            `${summary.occupied_beds} occ`,
            `${summary.vacant_beds} vac`,
            `${summary.occupancy_rate}%`,
            ""
        ];
    }

    return { headers, rows, footerRow };
};

const exportToExcel = () => {
    if (typeof XLSX === "undefined") {
        alert("Excel export library is still loading. Please try again in a moment.");
        return;
    }

    const data = getUncombinedReportData();
    if (!data) return;

    const sheetTitles = {
        collections: "Collections",
        department_revenue: "Dept_Revenue",
        doctor_fees: "Doctor_PF",
        ar_aging: "AR_Aging",
        bed_occupancy: "Bed_Capacity"
    };

    const sheetName = sheetTitles[currentTab] || "Report";
    const aoa = [data.headers, ...data.rows];
    if (data.footerRow && data.footerRow.length > 0) {
        aoa.push(data.footerRow);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const now = new Date();
    const dateStamp = formatDateYMD(now);
    const fileName = `Hospital_Billing_${sheetName}_${dateStamp}.xlsx`;

    XLSX.writeFile(wb, fileName);
};

const exportToCsv = () => {
    const data = getUncombinedReportData();
    if (!data) return;

    const aoa = [data.headers, ...data.rows];
    if (data.footerRow && data.footerRow.length > 0) {
        aoa.push(data.footerRow);
    }

    const rows = aoa.map((row) =>
        row.map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`).join(",")
    );

    const csvContent = "\uFEFF" + rows.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    const now = new Date();
    const dateStamp = formatDateYMD(now);
    a.href = url;
    a.download = `Hospital_Billing_${currentTab}_${dateStamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const printOfficialReport = () => {
    renderPrintTable();
    updatePrintHeader();
    window.print();
};

document.addEventListener("DOMContentLoaded", initReports);
