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
        fetchReportData();
    };

    if (startInput) startInput.addEventListener("change", handleDateChange);
    if (endInput) endInput.addEventListener("change", handleDateChange);

    const btnReset = document.getElementById("btnResetFilter");
    if (btnReset) {
        btnReset.addEventListener("click", () => {
            if (startInput) startInput.value = "";
            if (endInput) endInput.value = "";
            if (secondarySelect) secondarySelect.value = "";
            const presetAll = document.querySelector('.date-preset-btn[data-preset="all"]');
            if (presetAll) presetAll.click();
            else fetchReportData();
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
        container.style.display = "flex";
        label.textContent = "Method:";
        lookupData.payment_methods.forEach((pm) => {
            const opt = document.createElement("option");
            opt.value = pm.Payment_Method_ID;
            opt.textContent = pm.Method_Name;
            select.appendChild(opt);
        });
    } else if (currentTab === "doctor_fees") {
        container.style.display = "flex";
        label.textContent = "Doctor:";
        lookupData.doctors.forEach((d) => {
            const opt = document.createElement("option");
            opt.value = d.Doctor_ID;
            opt.textContent = d.Full_Name;
            select.appendChild(opt);
        });
    } else if (currentTab === "ar_aging") {
        container.style.display = "flex";
        label.textContent = "Status:";
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
        <div class="report-kpi-card" style="border-left-color: #107c41;">
            <div class="report-kpi-label">Total Collections</div>
            <div class="report-kpi-value" style="color: #107c41;">${formatPesos(summary.total_collections)}</div>
            <div class="report-kpi-sub">${summary.transaction_count} official payment transactions</div>
        </div>
        <div class="report-kpi-card" style="border-left-color: #0284c7;">
            <div class="report-kpi-label">Advance Bed Deposits</div>
            <div class="report-kpi-value" style="color: #0284c7;">${formatPesos(summary.advance_total)}</div>
            <div class="report-kpi-sub">Pre-discharge admission deposits</div>
        </div>
        <div class="report-kpi-card" style="border-left-color: #6366f1;">
            <div class="report-kpi-label">Final Settlements</div>
            <div class="report-kpi-value" style="color: #6366f1;">${formatPesos(summary.settlement_total)}</div>
            <div class="report-kpi-sub">Discharge invoice settlements</div>
        </div>
        <div class="report-kpi-card" style="border-left-color: #f59e0b;">
            <div class="report-kpi-label">Payment Methods Count</div>
            <div class="report-kpi-value">${summary.by_method?.length || 0} Methods</div>
            <div class="report-kpi-sub">${summary.by_method?.map((m) => m.Method_Name + ': ' + m.Transaction_Count).join(', ') || 'None'}</div>
        </div>
    `;

    const thead = document.getElementById("report-table-head");
    thead.innerHTML = `
        <tr>
            <th class="col-seq">#</th>
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

    const tbody = document.getElementById("report-table-body");
    if (records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 30px; color: #64748b;">
                    No payment records found matching the selected date filters.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = records.map((r, i) => `
            <tr>
                <td class="col-seq">${i + 1}</td>
                <td style="font-weight: 700; color: #0284c7;">${r.Receipt_Number}</td>
                <td>${r.Payment_Date}</td>
                <td><span class="badge badge-secondary">${r.Admission_Code}</span></td>
                <td style="font-weight: 600;">${r.Patient_Name}</td>
                <td><span class="badge badge-info">${r.Payment_Method}</span></td>
                <td>
                    <span class="badge ${r.Is_Advance == 1 ? 'badge-primary' : 'badge-success'}">
                        ${r.Payment_Type}
                    </span>
                </td>
                <td class="currency-cell" style="color: #107c41;">${formatPesos(r.Amount_Paid)}</td>
                <td class="currency-cell">${formatPesos(r.Balance_After)}</td>
                <td>${r.Cashier_Name}</td>
                <td style="color: #64748b; font-style: italic;">${r.Notes || '—'}</td>
            </tr>
        `).join("");
    }

    const tfoot = document.getElementById("report-table-foot");
    tfoot.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: right; text-transform: uppercase;">Grand Total Collections:</td>
            <td class="currency-cell" style="color: #107c41; font-size: 14px;">${formatPesos(summary.total_collections)}</td>
            <td colspan="3"></td>
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
        <div class="report-kpi-card" style="border-left-color: #0284c7;">
            <div class="report-kpi-label">Gross Charges</div>
            <div class="report-kpi-value" style="color: #0284c7;">${formatPesos(summary.grand_gross)}</div>
            <div class="report-kpi-sub">${summary.grand_transactions} total ledger entries</div>
        </div>
        <div class="report-kpi-card" style="border-left-color: #ef4444;">
            <div class="report-kpi-label">Credits & Returns</div>
            <div class="report-kpi-value" style="color: #ef4444;">${formatPesos(summary.grand_returns)}</div>
            <div class="report-kpi-sub">Returned medicines & voided items</div>
        </div>
        <div class="report-kpi-card" style="border-left-color: #107c41;">
            <div class="report-kpi-label">Net Billed Revenue</div>
            <div class="report-kpi-value" style="color: #107c41;">${formatPesos(summary.grand_net)}</div>
            <div class="report-kpi-sub">Net patient clinical fees</div>
        </div>
        <div class="report-kpi-card" style="border-left-color: #8b5cf6;">
            <div class="report-kpi-label">Top Contributing Station</div>
            <div class="report-kpi-value" style="font-size: 17px; font-weight: 700; color: #8b5cf6;">
                ${stations[0]?.Station_Name || 'None'}
            </div>
            <div class="report-kpi-sub">${stations[0]?.Revenue_Share_Pct || 0}% share of revenue</div>
        </div>
    `;

    const thead = document.getElementById("report-table-head");
    thead.innerHTML = `
        <tr>
            <th class="col-seq">#</th>
            <th>Station / Department</th>
            <th>Code</th>
            <th class="text-right">Transaction Count</th>
            <th class="text-right">Gross Charges</th>
            <th class="text-right">Returns / Deductions</th>
            <th class="text-right">Net Revenue</th>
            <th class="text-right">Share of Total</th>
        </tr>
    `;

    const tbody = document.getElementById("report-table-body");
    tbody.innerHTML = stations.map((st, i) => `
        <tr>
            <td class="col-seq">${i + 1}</td>
            <td style="font-weight: 700; color: #0f172a;">${st.Station_Name}</td>
            <td><span class="badge badge-secondary">${st.Code_Prefix}</span></td>
            <td class="number-cell">${st.Total_Transactions}</td>
            <td class="currency-cell">${formatPesos(st.Gross_Charges)}</td>
            <td class="currency-cell" style="color: #ef4444;">${formatPesos(st.Total_Returns)}</td>
            <td class="currency-cell" style="color: #107c41; font-weight: 700;">${formatPesos(st.Net_Revenue)}</td>
            <td class="number-cell" style="font-weight: 700; color: #0284c7;">${st.Revenue_Share_Pct}%</td>
        </tr>
    `).join("");

    const tfoot = document.getElementById("report-table-foot");
    tfoot.innerHTML = `
        <tr>
            <td colspan="3" style="text-align: right; text-transform: uppercase;">Hospital Grand Totals:</td>
            <td class="number-cell">${summary.grand_transactions}</td>
            <td class="currency-cell">${formatPesos(summary.grand_gross)}</td>
            <td class="currency-cell" style="color: #ef4444;">${formatPesos(summary.grand_returns)}</td>
            <td class="currency-cell" style="color: #107c41; font-size: 14px;">${formatPesos(summary.grand_net)}</td>
            <td class="number-cell" style="color: #0284c7; font-size: 14px;">100.00%</td>
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
        <div class="report-kpi-card" style="border-left-color: #0284c7;">
            <div class="report-kpi-label">Total Professional Fees</div>
            <div class="report-kpi-value" style="color: #0284c7;">${formatPesos(summary.grand_pf_total)}</div>
            <div class="report-kpi-sub">Total doctor round billings</div>
        </div>
        <div class="report-kpi-card" style="border-left-color: #107c41;">
            <div class="report-kpi-label">Total Bedside Visits</div>
            <div class="report-kpi-value" style="color: #107c41;">${summary.grand_rounds_count} Rounds</div>
            <div class="report-kpi-sub">Logged in patient charts</div>
        </div>
        <div class="report-kpi-card" style="border-left-color: #6366f1;">
            <div class="report-kpi-label">Active Doctors</div>
            <div class="report-kpi-value">${summary.doctors_count} Physicians</div>
            <div class="report-kpi-sub">In hospital medical staff</div>
        </div>
        <div class="report-kpi-card" style="border-left-color: #f59e0b;">
            <div class="report-kpi-label">Average Fee per Round</div>
            <div class="report-kpi-value" style="color: #f59e0b;">
                ${summary.grand_rounds_count > 0 ? formatPesos(summary.grand_pf_total / summary.grand_rounds_count) : '₱0.00'}
            </div>
            <div class="report-kpi-sub">Average round charge rate</div>
        </div>
    `;

    const thead = document.getElementById("report-table-head");
    thead.innerHTML = `
        <tr>
            <th class="col-seq">#</th>
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

    const tbody = document.getElementById("report-table-body");
    tbody.innerHTML = doctors.map((d, i) => `
        <tr>
            <td class="col-seq">${i + 1}</td>
            <td><span class="badge badge-secondary">${d.Doctor_Code}</span></td>
            <td style="font-weight: 700; color: #0f172a;">${d.Doctor_Name}</td>
            <td><span class="badge badge-info">${d.Doctor_Type}</span></td>
            <td>${d.Department_Station}</td>
            <td class="currency-cell">${formatPesos(d.Base_Round_Fee)}</td>
            <td class="number-cell" style="font-weight: 700;">${d.Total_Rounds}</td>
            <td class="number-cell">${d.Unique_Patients_Attended}</td>
            <td class="currency-cell" style="color: #0284c7; font-weight: 700;">${formatPesos(d.Total_PF_Generated)}</td>
        </tr>
    `).join("");

    const tfoot = document.getElementById("report-table-foot");
    tfoot.innerHTML = `
        <tr>
            <td colspan="6" style="text-align: right; text-transform: uppercase;">Total Professional Fees & Rounds:</td>
            <td class="number-cell" style="font-size: 14px;">${summary.grand_rounds_count}</td>
            <td></td>
            <td class="currency-cell" style="color: #0284c7; font-size: 14px;">${formatPesos(summary.grand_pf_total)}</td>
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
        <div class="report-kpi-card" style="border-left-color: #ef4444;">
            <div class="report-kpi-label">Total Outstanding AR</div>
            <div class="report-kpi-value" style="color: #ef4444;">${formatPesos(summary.total_active_ar)}</div>
            <div class="report-kpi-sub">Unsettled promissory notes balance</div>
        </div>
        <div class="report-kpi-card" style="border-left-color: #107c41;">
            <div class="report-kpi-label">Current (Within Term)</div>
            <div class="report-kpi-value" style="color: #107c41;">${formatPesos(summary.current_not_due)}</div>
            <div class="report-kpi-sub">Due date has not lapsed</div>
        </div>
        <div class="report-kpi-card" style="border-left-color: #f59e0b;">
            <div class="report-kpi-label">1 - 30 Days Overdue</div>
            <div class="report-kpi-value" style="color: #f59e0b;">${formatPesos(summary.overdue_1_30)}</div>
            <div class="report-kpi-sub">Recent overdue balances</div>
        </div>
        <div class="report-kpi-card" style="border-left-color: #991b1b;">
            <div class="report-kpi-label">31+ Days Overdue</div>
            <div class="report-kpi-value" style="color: #991b1b;">
                ${formatPesos(summary.overdue_31_60 + summary.overdue_61_90 + summary.overdue_over_90)}
            </div>
            <div class="report-kpi-sub">Critical collection attention required</div>
        </div>
    `;

    const thead = document.getElementById("report-table-head");
    thead.innerHTML = `
        <tr>
            <th class="col-seq">#</th>
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

    const tbody = document.getElementById("report-table-body");
    if (notes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" style="text-align: center; padding: 30px; color: #64748b;">
                    No promissory notes found matching the selected status filter.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = notes.map((n, i) => {
            let bracketBadge = "badge-success";
            if (n.Aging_Bracket.includes("1-30")) bracketBadge = "badge-warning";
            else if (n.Aging_Bracket.includes("31-60") || n.Aging_Bracket.includes("61-90") || n.Aging_Bracket.includes("90+")) bracketBadge = "badge-danger";

            let statusBadge = "badge-warning";
            if (n.Status === "Settled") statusBadge = "badge-success";
            else if (n.Status === "Overdue") statusBadge = "badge-danger";

            return `
                <tr>
                    <td class="col-seq">${i + 1}</td>
                    <td style="font-weight: 700; color: #6366f1;">${n.Note_Code}</td>
                    <td><span class="badge badge-secondary">${n.Invoice_Code}</span></td>
                    <td style="font-weight: 600;">${n.Patient_Name}</td>
                    <td>${n.Patient_Contact || '—'}</td>
                    <td>${n.Plan_Type_Name}</td>
                    <td class="currency-cell">${formatPesos(n.Monthly_Amount)}</td>
                    <td class="currency-cell" style="color: #ef4444; font-weight: 700;">${formatPesos(n.Total_Balance_Owed)}</td>
                    <td style="font-weight: 600;">${n.Due_Date}</td>
                    <td><span class="badge ${bracketBadge}">${n.Aging_Bracket}</span></td>
                    <td>${n.Guarantor_Name}</td>
                    <td><span class="badge ${statusBadge}">${n.Status}</span></td>
                </tr>
            `;
        }).join("");
    }

    const tfoot = document.getElementById("report-table-foot");
    tfoot.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: right; text-transform: uppercase;">Total Active Accounts Receivable:</td>
            <td class="currency-cell" style="color: #ef4444; font-size: 14px;">${formatPesos(summary.total_active_ar)}</td>
            <td colspan="4"></td>
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
        <div class="report-kpi-card" style="border-left-color: #0284c7;">
            <div class="report-kpi-label">Total Hospital Beds</div>
            <div class="report-kpi-value">${summary.total_beds} Beds</div>
            <div class="report-kpi-sub">Across ${summary.rooms_count} rooms & wards</div>
        </div>
        <div class="report-kpi-card" style="border-left-color: #f59e0b;">
            <div class="report-kpi-label">Occupied Beds</div>
            <div class="report-kpi-value" style="color: #f59e0b;">${summary.occupied_beds} Beds</div>
            <div class="report-kpi-sub">Active in-patient admissions</div>
        </div>
        <div class="report-kpi-card" style="border-left-color: #107c41;">
            <div class="report-kpi-label">Available Vacant Beds</div>
            <div class="report-kpi-value" style="color: #107c41;">${summary.vacant_beds} Beds</div>
            <div class="report-kpi-sub">Ready for immediate admission</div>
        </div>
        <div class="report-kpi-card" style="border-left-color: #8b5cf6;">
            <div class="report-kpi-label">Occupancy Rate</div>
            <div class="report-kpi-value" style="color: #8b5cf6;">${summary.occupancy_rate}%</div>
            <div class="report-kpi-sub">Hospital utilization index</div>
        </div>
    `;

    const thead = document.getElementById("report-table-head");
    thead.innerHTML = `
        <tr>
            <th class="col-seq">#</th>
            <th>Room / Ward Name</th>
            <th>Classification</th>
            <th class="text-right">Daily Board Rate</th>
            <th class="text-right">Bed Capacity</th>
            <th class="text-right">Occupied Beds</th>
            <th class="text-right">Available Beds</th>
            <th class="text-right">Occupancy %</th>
        </tr>
    `;

    const tbody = document.getElementById("report-table-body");
    tbody.innerHTML = rooms.map((rm, i) => `
        <tr>
            <td class="col-seq">${i + 1}</td>
            <td style="font-weight: 700; color: #0f172a;">${rm.Room_Name}</td>
            <td><span class="badge badge-info">${rm.Room_Type}</span></td>
            <td class="currency-cell">${formatPesos(rm.Daily_Rate)}</td>
            <td class="number-cell">${rm.Total_Beds}</td>
            <td class="number-cell" style="color: #f59e0b; font-weight: 700;">${rm.Occupied_Beds}</td>
            <td class="number-cell" style="color: #107c41; font-weight: 700;">${rm.Vacant_Beds}</td>
            <td class="number-cell" style="font-weight: 700; color: #0284c7;">${rm.Occupancy_Rate}%</td>
        </tr>
    `).join("");

    const tfoot = document.getElementById("report-table-foot");
    tfoot.innerHTML = `
        <tr>
            <td colspan="4" style="text-align: right; text-transform: uppercase;">Hospital Capacity Totals:</td>
            <td class="number-cell" style="font-size: 14px;">${summary.total_beds}</td>
            <td class="number-cell" style="color: #f59e0b; font-size: 14px;">${summary.occupied_beds}</td>
            <td class="number-cell" style="color: #107c41; font-size: 14px;">${summary.vacant_beds}</td>
            <td class="number-cell" style="color: #0284c7; font-size: 14px;">${summary.occupancy_rate}%</td>
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
