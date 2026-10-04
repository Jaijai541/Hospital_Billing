const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allPromissoryNotes = [];
let allPaymentMethods = [];
let currentPayingNote = null;

document.addEventListener("DOMContentLoaded", () => {
    initEvents();
    loadPlanTypes();
    loadPaymentMethods();
    loadPromissoryNotes();
});

const initEvents = () => {
    const btnRefresh = document.getElementById("btnRefreshAR");
    if (btnRefresh) {
        btnRefresh.addEventListener("click", loadPromissoryNotes);
    }

    const searchInput = document.getElementById("search_input");
    if (searchInput) {
        searchInput.addEventListener("input", filterAndRenderPromissoryNotes);
    }

    const filterStatus = document.getElementById("filter_status");
    if (filterStatus) {
        filterStatus.addEventListener("change", filterAndRenderPromissoryNotes);
    }

    const filterPlan = document.getElementById("filter_plan");
    if (filterPlan) {
        filterPlan.addEventListener("change", filterAndRenderPromissoryNotes);
    }

    const filterDue = document.getElementById("filter_due");
    if (filterDue) {
        filterDue.addEventListener("change", filterAndRenderPromissoryNotes);
    }

    const btnReset = document.getElementById("btnResetFilters");
    if (btnReset) {
        btnReset.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            if (filterStatus) filterStatus.value = "ALL";
            if (filterPlan) filterPlan.value = "0";
            if (filterDue) filterDue.value = "ALL";
            filterAndRenderPromissoryNotes();
        });
    }

    const btnClosePaymentModal = document.getElementById("btnClosePaymentModal");
    const btnCancelPayment = document.getElementById("btnCancelPayment");
    if (btnClosePaymentModal) btnClosePaymentModal.addEventListener("click", closePaymentModal);
    if (btnCancelPayment) btnCancelPayment.addEventListener("click", closePaymentModal);

    const btnPayFull = document.getElementById("btnPayFullBalance");
    if (btnPayFull) {
        btnPayFull.addEventListener("click", () => {
            if (!currentPayingNote) return;
            const bal = parseFloat(currentPayingNote.Remaining_Balance) || 0;
            const payInput = document.getElementById("pay_amount_input");
            if (payInput) {
                payInput.value = bal.toFixed(2);
                recalculatePayment();
            }
        });
    }

    const btnPayMonth = document.getElementById("btnPayMonthlyTarget");
    if (btnPayMonth) {
        btnPayMonth.addEventListener("click", () => {
            if (!currentPayingNote) return;
            const monthly = parseFloat(currentPayingNote.Monthly_Amount) || 0;
            const bal = parseFloat(currentPayingNote.Remaining_Balance) || 0;
            const payInput = document.getElementById("pay_amount_input");
            if (payInput) {
                const target = Math.min(monthly > 0 ? monthly : bal, bal);
                payInput.value = target.toFixed(2);
                recalculatePayment();
            }
        });
    }

    const payAmountInput = document.getElementById("pay_amount_input");
    if (payAmountInput) {
        payAmountInput.addEventListener("input", recalculatePayment);
    }

    const btnSubmitPayment = document.getElementById("btnSubmitPayment");
    if (btnSubmitPayment) {
        btnSubmitPayment.addEventListener("click", submitInstallmentPayment);
    }

    const btnCloseHistoryModal = document.getElementById("btnCloseHistoryModal");
    const btnDismissHistory = document.getElementById("btnDismissHistoryModal");
    if (btnCloseHistoryModal) btnCloseHistoryModal.addEventListener("click", closeHistoryModal);
    if (btnDismissHistory) btnDismissHistory.addEventListener("click", closeHistoryModal);

    const payMethodText = document.getElementById("pay_method_id_text");
    if (payMethodText) {
        payMethodText.addEventListener("click", openPaymentMethodPicker);
    }

    const btnBrowseMethod = document.getElementById("btnBrowse_pay_method_id");
    if (btnBrowseMethod) {
        btnBrowseMethod.addEventListener("click", openPaymentMethodPicker);
    }
};

const loadPlanTypes = async () => {
    try {
        const response = await axios.get(`${getApiUrl}/invoices.php`, {
            params: { operation: "getPromissoryPlanTypes" }
        });
        if (response.status === 200 && Array.isArray(response.data)) {
            const selectEl = document.getElementById("filter_plan");
            if (!selectEl) return;
            response.data.forEach(p => {
                const opt = document.createElement("option");
                opt.value = p.Plan_Type_ID;
                opt.textContent = p.Plan_Type_Name;
                selectEl.appendChild(opt);
            });
        }
    } catch (e) {}
};

const loadPaymentMethods = async () => {
    try {
        const response = await axios.get(`${getApiUrl}/invoices.php`, {
            params: { operation: "getPaymentMethods" }
        });
        if (response.status === 200 && Array.isArray(response.data)) {
            allPaymentMethods = response.data;
        }
    } catch (e) {}
};

const loadPromissoryNotes = async () => {
    const tableDiv = document.getElementById("table-div");
    if (tableDiv) {
        tableDiv.innerHTML = `<p style="padding: 20px;">Loading accounts receivable & promissory notes...</p>`;
    }

    try {
        const response = await axios.get(`${getApiUrl}/invoices.php`, {
            params: { operation: "getPromissoryNotes" }
        });

        if (response.status === 200 && Array.isArray(response.data)) {
            allPromissoryNotes = response.data;
            updateStats(allPromissoryNotes);
            filterAndRenderPromissoryNotes();
        } else {
            if (tableDiv) tableDiv.innerHTML = `<p style="padding: 20px; color: red;">Failed to load promissory notes data.</p>`;
        }
    } catch (error) {
        if (tableDiv) tableDiv.innerHTML = `<p style="padding: 20px; color: red;">Unable to connect to Invoices & Promissory Notes API.</p>`;
    }
};

const updateStats = (notes) => {
    const statBal = document.getElementById("stat-total-ar-balance");
    const statActive = document.getElementById("stat-active-notes");
    const statOverdue = document.getElementById("stat-overdue-notes");
    const statSettled = document.getElementById("stat-settled-notes");
    const recordBadge = document.getElementById("record-count-badge");

    let totalAR = 0;
    let activeCount = 0;
    let overdueCount = 0;
    let settledCount = 0;

    notes.forEach(n => {
        const bal = parseFloat(n.Remaining_Balance) || 0;
        const status = n.Computed_Status;

        if (bal > 0) {
            totalAR += bal;
        }

        if (status === "Settled") {
            settledCount++;
        } else if (status === "Overdue") {
            overdueCount++;
        } else {
            activeCount++;
        }
    });

    if (statBal) statBal.textContent = `₱${totalAR.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (statActive) statActive.textContent = activeCount;
    if (statOverdue) statOverdue.textContent = overdueCount;
    if (statSettled) statSettled.textContent = settledCount;
    if (recordBadge) recordBadge.textContent = `${notes.length} Note${notes.length === 1 ? "" : "s"} Total`;
};

const filterAndRenderPromissoryNotes = () => {
    const search = (document.getElementById("search_input")?.value || "").trim().toLowerCase();
    const statusFilter = document.getElementById("filter_status")?.value || "ALL";
    const planFilter = parseInt(document.getElementById("filter_plan")?.value) || 0;
    const dueFilter = document.getElementById("filter_due")?.value || "ALL";

    let filtered = allPromissoryNotes.filter(n => {
        if (statusFilter !== "ALL" && n.Computed_Status !== statusFilter) {
            return false;
        }

        if (planFilter > 0 && parseInt(n.Plan_Type_ID) !== planFilter) {
            return false;
        }

        const daysOverdue = parseInt(n.Days_Overdue) || 0;
        const isSettled = n.Computed_Status === "Settled";

        if (dueFilter === "OVERDUE" && (isSettled || daysOverdue <= 0)) {
            return false;
        }
        if (dueFilter === "DUE_7" && (isSettled || daysOverdue > 0 || daysOverdue < -7)) {
            return false;
        }
        if (dueFilter === "DUE_30" && (isSettled || daysOverdue > 0 || daysOverdue < -30)) {
            return false;
        }

        if (search) {
            const pName = (n.Patient_Name || "").toLowerCase();
            const pCode = (n.Patient_Code || "").toLowerCase();
            const gName = (n.Guarantor_Name || "").toLowerCase();
            const gPhone = (n.Guarantor_Contact || "").toLowerCase();
            const nCode = (n.Note_Code || "").toLowerCase();
            const invCode = (n.Invoice_Code || "").toLowerCase();
            const admCode = (n.Admission_Code || "").toLowerCase();

            return pName.includes(search) ||
                   pCode.includes(search) ||
                   gName.includes(search) ||
                   gPhone.includes(search) ||
                   nCode.includes(search) ||
                   invCode.includes(search) ||
                   admCode.includes(search);
        }

        return true;
    });

    renderTable(filtered);
};

const renderTable = (notes) => {
    const tableDiv = document.getElementById("table-div");
    if (!tableDiv) return;

    if (!notes || notes.length === 0) {
        tableDiv.innerHTML = `<p style="padding: 24px; text-align: center; color: var(--text-muted);">No promissory notes match the selected filters.</p>`;
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Note Code</th>
            <th>Patient / Case</th>
            <th>Guarantor & Contact</th>
            <th>Plan & Terms</th>
            <th style="min-width: 170px;">Balance & Progress</th>
            <th>Next Due Date</th>
            <th>Status</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    notes.forEach(note => {
        const row = document.createElement("tr");
        row.className = "clickable-row";
        row.title = "Click row to view promissory note ledger, installment history, SOA, or post payment";

        const netDue = parseFloat(note.Net_Amount_Due) || 0;
        const paidSoFar = parseFloat(note.Total_Paid_To_Date) || 0;
        const bal = parseFloat(note.Remaining_Balance) || 0;
        const monthly = parseFloat(note.Monthly_Amount) || 0;
        const daysOverdue = parseInt(note.Days_Overdue) || 0;
        const status = note.Computed_Status;

        let pctPaid = netDue > 0 ? Math.min(100, Math.round((paidSoFar / netDue) * 100)) : 100;
        if (bal <= 0) pctPaid = 100;

        let statusBadgeHtml = "";
        if (status === "Settled") {
            statusBadgeHtml = `<span class="badge badge-success">Settled</span>`;
        } else if (status === "Overdue") {
            statusBadgeHtml = `<span class="badge badge-danger">Overdue</span>`;
        } else {
            statusBadgeHtml = `<span class="badge badge-warning">Active AR</span>`;
        }

        let dueBadgeHtml = "";
        if (status === "Settled") {
            dueBadgeHtml = `<div style="font-weight: 600; color: #16a34a;">Fully Settled</div>`;
        } else if (daysOverdue > 0) {
            dueBadgeHtml = `
                <div style="font-weight: 700; color: #dc2626;">${note.Formatted_Next_Due_Date || note.Next_Due_Date}</div>
                <span class="badge badge-danger" style="font-size: 11px; margin-top: 2px;">Overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}</span>
            `;
        } else if (daysOverdue === 0) {
            dueBadgeHtml = `
                <div style="font-weight: 700; color: #b45309;">${note.Formatted_Next_Due_Date || note.Next_Due_Date}</div>
                <span class="badge badge-warning" style="font-size: 11px; margin-top: 2px;">Due Today</span>
            `;
        } else {
            const daysLeft = Math.abs(daysOverdue);
            const urgencyClass = daysLeft <= 7 ? "badge-warning" : "badge-secondary";
            dueBadgeHtml = `
                <div style="font-weight: 600;">${note.Formatted_Next_Due_Date || note.Next_Due_Date}</div>
                <span class="badge ${urgencyClass}" style="font-size: 11px; margin-top: 2px;">In ${daysLeft} day${daysLeft === 1 ? "" : "s"}</span>
            `;
        }

        row.innerHTML = `
            <td>
                <strong style="color: var(--primary); font-family: monospace; font-size: 14.5px;">${note.Note_Code}</strong>
                <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">${note.Formatted_Created_At || ""}</div>
            </td>
            <td>
                <strong style="font-size: 14.5px;">${note.Patient_Name}</strong>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                    <code>${note.Admission_Code}</code> &bull; <code>${note.Invoice_Code}</code>
                </div>
            </td>
            <td>
                <div style="font-weight: 600;">${note.Guarantor_Name || "-"}</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                    ${note.Guarantor_Contact ? `📞 ${note.Guarantor_Contact}` : "No contact recorded"}
                </div>
            </td>
            <td>
                <div style="font-weight: 600; color: #1e293b;">${note.Plan_Type_Name}</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                    ${note.Installment_Months > 1 ? `${note.Installment_Months} mos &bull; ₱${monthly.toLocaleString("en-PH", { minimumFractionDigits: 2 })}/mo` : "Lump sum settlement"}
                </div>
            </td>
            <td>
                <div style="display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 2px;">
                    <span style="color: var(--text-muted);">Paid: ₱${paidSoFar.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                    <strong style="color: ${bal > 0 ? '#dc2626' : '#16a34a'};">₱${bal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong>
                </div>
                <div style="background: #e2e8f0; border-radius: 999px; height: 6px; width: 100%; overflow: hidden;">
                    <div style="background: ${bal <= 0 ? '#16a34a' : (pctPaid >= 50 ? '#0284c7' : '#f59e0b')}; width: ${pctPaid}%; height: 100%;"></div>
                </div>
                <div style="font-size: 11px; color: var(--text-muted); text-align: right; margin-top: 2px;">${pctPaid}% settled (Net: ₱${netDue.toLocaleString("en-PH", { minimumFractionDigits: 2 })})</div>
            </td>
            <td>
                ${dueBadgeHtml}
            </td>
            <td>
                ${statusBadgeHtml}
            </td>
        `;

        row.addEventListener("click", () => openPaymentHistoryModal(note));

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.innerHTML = "";
    tableDiv.appendChild(table);
};

const openPaymentModal = (note) => {
    currentPayingNote = note;

    const modal = document.getElementById("recordPaymentModal");
    if (!modal) return;

    document.getElementById("pay_invoice_id").value = note.Invoice_ID;
    document.getElementById("pay_note_id").value = note.Note_ID;
    document.getElementById("pay_note_code").textContent = note.Note_Code;
    document.getElementById("pay_invoice_code").textContent = note.Invoice_Code;
    document.getElementById("pay_patient_name").textContent = note.Patient_Name;
    document.getElementById("pay_guarantor_name").textContent = `${note.Guarantor_Name || "Patient"} (${note.Guarantor_Contact || "No phone"})`;

    const netDue = parseFloat(note.Net_Amount_Due) || 0;
    const paidSoFar = parseFloat(note.Total_Paid_To_Date) || 0;
    const bal = parseFloat(note.Remaining_Balance) || 0;
    const monthly = parseFloat(note.Monthly_Amount) || 0;

    document.getElementById("pay_net_due").textContent = netDue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById("pay_amount_paid").textContent = paidSoFar.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById("pay_monthly_amount").textContent = monthly.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById("pay_next_due").textContent = note.Formatted_Next_Due_Date || note.Next_Due_Date;
    document.getElementById("pay_remaining_balance").textContent = bal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const payMethodId = document.getElementById("pay_method_id");
    const payMethodText = document.getElementById("pay_method_id_text");
    if (payMethodId) payMethodId.value = "1";
    if (payMethodText) payMethodText.value = "Cash";

    const payInput = document.getElementById("pay_amount_input");
    if (payInput) {
        const defaultTarget = Math.min(monthly > 0 ? monthly : bal, bal);
        payInput.value = defaultTarget.toFixed(2);
    }

    const notesInput = document.getElementById("pay_notes_input");
    if (notesInput) {
        notesInput.value = `Installment Payment for ${note.Note_Code}`;
    }

    recalculatePayment();
    modal.style.display = "flex";
};

const closePaymentModal = () => {
    const modal = document.getElementById("recordPaymentModal");
    if (modal) modal.style.display = "none";
    currentPayingNote = null;
};

const recalculatePayment = () => {
    if (!currentPayingNote) return;

    const remainingBal = parseFloat(currentPayingNote.Remaining_Balance) || 0;
    const tenderedVal = parseFloat(document.getElementById("pay_amount_input")?.value) || 0;

    const applied = Math.min(tenderedVal, remainingBal);
    const newBal = Math.max(0, remainingBal - applied);
    const change = Math.max(0, tenderedVal - remainingBal);

    const newBalEl = document.getElementById("pay_new_balance_display");
    const changeEl = document.getElementById("pay_change_display");

    if (newBalEl) newBalEl.textContent = `₱${newBal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (changeEl) changeEl.textContent = `₱${change.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const submitInstallmentPayment = async () => {
    if (!currentPayingNote) return;

    const invoiceId = parseInt(document.getElementById("pay_invoice_id")?.value) || 0;
    const paymentMethodId = parseInt(document.getElementById("pay_method_id")?.value) || 1;
    const paymentAmount = parseFloat(document.getElementById("pay_amount_input")?.value) || 0;
    const notes = (document.getElementById("pay_notes_input")?.value || "").trim();

    if (paymentAmount <= 0) {
        showToast("Please enter a valid payment amount greater than 0.00.", "warning");
        return;
    }

    let userId = 1;
    try {
        const u = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
        if (u.user_id) userId = u.user_id;
    } catch (e) {}

    const payload = {
        invoice_id: invoiceId,
        user_id: userId,
        payment_amount: paymentAmount,
        payment_method_id: paymentMethodId,
        notes: notes || `Installment payment for ${currentPayingNote.Note_Code}`
    };

    const btnSubmit = document.getElementById("btnSubmitPayment");
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Processing Installment...";
    }

    try {
        const formData = new FormData();
        formData.append("operation", "recordPayment");
        formData.append("json", JSON.stringify(payload));

        const response = await axios.post(`${postApiUrl}/invoices.php`, formData);
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Post Installment & Issue Receipt";
        }

        if (response.status === 200 && response.data.success) {
            const data = response.data;
            closePaymentModal();
            showToast(data.message || "Installment payment successfully posted!", "success");

            if (data.payment_id) {
                showPopupConfirm(`Payment successfully registered! Official Receipt ${data.receipt_number || ""} is ready. Would you like to view and print the Official Receipt now?`, () => {
                    window.location.href = `payment_receipt.html?payment_id=${data.payment_id}`;
                }, null, {
                    title: "Official Receipt Generated",
                    confirmText: "View Receipt",
                    cancelText: "Stay on Monitor",
                    type: "success"
                });
            }

            loadPromissoryNotes();
        } else {
            showToast(response.data.error || "Payment recording failed. Please try again.", "error");
        }
    } catch (error) {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Post Installment & Issue Receipt";
        }
        showToast("Error communicating with payment gateway server.", "error");
    }
};

const openPaymentHistoryModal = async (note) => {
    const modal = document.getElementById("paymentHistoryModal");
    if (!modal) return;

    document.getElementById("hist_note_code").textContent = note.Note_Code;
    document.getElementById("hist_invoice_code").textContent = note.Invoice_Code;
    document.getElementById("hist_patient_name").textContent = `${note.Patient_Name} (${note.Patient_Code})`;

    const netDue = parseFloat(note.Net_Amount_Due) || 0;
    const paidSoFar = parseFloat(note.Total_Paid_To_Date) || 0;
    const bal = parseFloat(note.Remaining_Balance) || 0;

    document.getElementById("hist_net_due").textContent = netDue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById("hist_amount_paid").textContent = paidSoFar.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById("hist_remaining_balance").textContent = bal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById("hist_plan_terms").textContent = `${note.Plan_Type_Name} (${note.Installment_Months} mos @ ₱${parseFloat(note.Monthly_Amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}/mo)`;

    const actionsDiv = document.getElementById("hist_modal_actions");
    if (actionsDiv) {
        actionsDiv.innerHTML = `
            <a href="invoice_print.html?id=${note.Invoice_ID}" class="btn btn-outline btn-sm">🖨 Print Statement & Agreement</a>
            ${bal > 0 ? `<button type="button" class="btn btn-primary btn-sm" id="btnHistPayNow">💵 Record Installment Payment</button>` : ""}
        `;
        const btnHistPay = document.getElementById("btnHistPayNow");
        if (btnHistPay) {
            btnHistPay.addEventListener("click", () => {
                closeHistoryModal();
                openPaymentModal(note);
            });
        }
    }

    const tableDiv = document.getElementById("history-modal-table-div");
    if (tableDiv) {
        tableDiv.innerHTML = `<p class="text-muted" style="padding: 16px;">Loading transactions...</p>`;
    }

    modal.style.display = "flex";

    try {
        const response = await axios.get(`${getApiUrl}/invoices.php`, {
            params: {
                operation: "getPaymentHistory",
                json: JSON.stringify({ invoice_id: note.Invoice_ID })
            }
        });

        if (response.status === 200 && Array.isArray(response.data)) {
            renderHistoryTable(response.data);
        } else {
            if (tableDiv) tableDiv.innerHTML = `<p style="padding: 16px; color: red;">Failed to load transaction history.</p>`;
        }
    } catch (e) {
        if (tableDiv) tableDiv.innerHTML = `<p style="padding: 16px; color: red;">Error connecting to payment history server.</p>`;
    }
};

const renderHistoryTable = (payments) => {
    const tableDiv = document.getElementById("history-modal-table-div");
    if (!tableDiv) return;

    if (!payments || payments.length === 0) {
        tableDiv.innerHTML = `<p style="padding: 16px; text-align: center; color: var(--text-muted);">No payment transactions recorded for this promissory note yet.</p>`;
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Receipt #</th>
            <th>Payment Date</th>
            <th>Type / Stage</th>
            <th>Method</th>
            <th style="text-align: right;">Amount Paid</th>
            <th style="text-align: right;">Balance After</th>
            <th>Cashier</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    payments.forEach((p, idx) => {
        const row = document.createElement("tr");
        row.className = "clickable-row";
        row.title = "Click row to view / print Official Receipt voucher";

        const amt = parseFloat(p.Amount_Paid) || 0;
        const balAfter = parseFloat(p.Balance_After) || 0;
        const isAdvance = p.Is_Advance == 1;

        row.innerHTML = `
            <td><strong style="color: var(--primary);">${p.Receipt_Number}</strong></td>
            <td style="white-space: nowrap;">${p.Payment_Date}</td>
            <td>
                ${isAdvance ? '<span class="badge badge-warning">Advance Deposit</span>' : (idx === 0 && payments.length > 1 ? '<span class="badge badge-secondary">Discharge Payment</span>' : '<span class="badge badge-success">Installment</span>')}
            </td>
            <td>${p.Payment_Method}</td>
            <td style="text-align: right; font-weight: 700; color: #16a34a;">₱${amt.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
            <td style="text-align: right; font-weight: 600;">₱${balAfter.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
            <td>${p.Cashier_Name || "Cashier"}</td>
        `;

        row.addEventListener("click", () => {
            window.open(`payment_receipt.html?payment_id=${p.Payment_ID}`, "_blank");
        });

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.innerHTML = "";
    tableDiv.appendChild(table);
};

const closeHistoryModal = () => {
    const modal = document.getElementById("paymentHistoryModal");
    if (modal) modal.style.display = "none";
};

const openPaymentMethodPicker = () => {
    openGenericLookupPicker({
        title: "Select Payment Method",
        items: allPaymentMethods.map(pm => ({
            id: pm.Payment_Method_ID,
            text: pm.Method_Name,
            subtext: `Category: ${pm.Category_Type}`,
            badge: pm.Category_Type,
            badgeClass: "badge-info"
        })),
        selectedId: document.getElementById("pay_method_id")?.value || "",
        onSelect: (item) => {
            const payMethodId = document.getElementById("pay_method_id");
            const payMethodText = document.getElementById("pay_method_id_text");
            if (payMethodId) payMethodId.value = item.id;
            if (payMethodText) payMethodText.value = item.text;
        }
    });
};
