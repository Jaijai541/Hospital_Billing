let currentTab = "collections";
let reportData = null;
let lookupData = { cashiers: [], doctors: [], payment_methods: [] };

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
            const presetAll = document.querySelector('.date-preset-btn[data-preset="all"]');
            if (presetAll) presetAll.click();
            else {
                updateReportDrawerBadge();
                fetchReportData();
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
                <td colspan="12" style="text-align: center; padding: 40px; color: #dc2626;">
                    <div style="font-weight: 700; font-size: 14px;">Error Loading Report</div>
                    <div style="font-size: 12px; margin-top: 4px;">${msg}</div>
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

    updatePrintHeader();
    applyQuickTableSearch();
};

const applyQuickTableSearch = () => {
    const searchInput = document.getElementById("filter_search_query");
    const tbody = document.getElementById("report-table-body");
    if (!searchInput || !tbody) return;

    const query = searchInput.value.trim().toLowerCase();
    const rows = tbody.querySelectorAll("tr");
    rows.forEach((row) => {
        if (row.cells.length <= 1) return;
        const rowText = (row.textContent || "").toLowerCase();
        row.style.display = !query || rowText.includes(query) ? "" : "none";
    });
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
    const records = reportData.records || [];

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
            <th>Receipt & Timestamp</th>
            <th>Patient & Case</th>
            <th>Payment Method & Stage</th>
            <th class="text-right">Amount Paid & Balance</th>
            <th>Remarks / Notes</th>
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
    const stations = summary.by_station || [];
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
            <th>Station / Department</th>
            <th class="text-right">Transactions</th>
            <th class="text-right">Gross Charges & Returns</th>
            <th class="text-right">Net Revenue</th>
            <th class="text-right">Share of Total</th>
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
    const doctors = summary.by_doctor || [];

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
            <th>Physician & Designation</th>
            <th>Station & Standard Round Fee</th>
            <th class="text-right">Rounds Conducted</th>
            <th class="text-right">Unique Patients</th>
            <th class="text-right">Total PF Generated</th>
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
    const notes = reportData.records || [];

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
            <th>Note & Invoice</th>
            <th>Patient & Guarantor</th>
            <th>Payment Plan</th>
            <th class="text-right">Balance Owed & Aging</th>
            <th>Status</th>
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
    const rooms = summary.by_room || [];
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
            <th>Room / Ward & Classification</th>
            <th class="text-right">Daily Board Rate</th>
            <th class="text-right">Capacity & Occupancy</th>
            <th class="text-right">Occupancy Rate</th>
            <th>Status</th>
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

const exportToExcel = () => {
    if (typeof XLSX === "undefined") {
        alert("Excel export library is still loading. Please try again in a moment.");
        return;
    }

    const tableEl = document.getElementById("report-table");
    if (!tableEl) return;

    const sheetTitles = {
        collections: "Collections",
        department_revenue: "Dept_Revenue",
        doctor_fees: "Doctor_PF",
        ar_aging: "AR_Aging",
        bed_occupancy: "Bed_Capacity"
    };

    const sheetName = sheetTitles[currentTab] || "Report";
    const wb = XLSX.utils.table_to_book(tableEl, { sheet: sheetName, raw: true });

    const now = new Date();
    const dateStamp = formatDateYMD(now);
    const fileName = `Hospital_Billing_${sheetName}_${dateStamp}.xlsx`;

    XLSX.writeFile(wb, fileName);
};

const exportToCsv = () => {
    const tableEl = document.getElementById("report-table");
    if (!tableEl) return;

    const rows = [];
    const trEls = tableEl.querySelectorAll("tr");

    trEls.forEach((tr) => {
        const rowData = [];
        const cells = tr.querySelectorAll("th, td");
        cells.forEach((c) => {
            let text = c.innerText.trim();
            text = text.replace(/"/g, '""');
            rowData.push(`"${text}"`);
        });
        if (rowData.length > 0) {
            rows.push(rowData.join(","));
        }
    });

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
    updatePrintHeader();
    window.print();
};

document.addEventListener("DOMContentLoaded", initReports);
