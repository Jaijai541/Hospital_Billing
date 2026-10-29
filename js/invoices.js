const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allInvoices = [];
let pendingClearances = [];
let currentPaymentInvoice = null;
let paymentMethods = [];
let activeInvoicesTab = 'pending-clearance';

const switchInvoicesTab = (tabKey, focusTab = false) => {
    const normalized = tabKey === 'settled-invoices' ? 'settled-invoices' : 'pending-clearance';
    activeInvoicesTab = normalized;

    const tabBtns = document.querySelectorAll('.invoices-tab-btn');
    const clearancePane = document.getElementById('pane-pending-clearance');
    const invoicesPane = document.getElementById('pane-settled-invoices');
    const showClearance = normalized === 'pending-clearance';
    const showInvoices = normalized === 'settled-invoices';

    tabBtns.forEach(btn => {
        const isTarget = btn.getAttribute('data-inv-tab') === normalized;
        btn.classList.toggle('active', isTarget);
        btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
        btn.setAttribute('tabindex', isTarget ? '0' : '-1');
        if (focusTab && isTarget) {
            btn.focus();
        }
    });

    if (clearancePane) {
        clearancePane.classList.toggle('invoices-pane-hidden', !showClearance);
        clearancePane.hidden = !showClearance;
    }

    if (invoicesPane) {
        invoicesPane.classList.toggle('invoices-pane-hidden', !showInvoices);
        invoicesPane.hidden = !showInvoices;
    }

    if (window.history && typeof window.history.replaceState === 'function') {
        const nextUrl = showInvoices
            ? `${window.location.pathname}${window.location.search}#settled-invoices`
            : `${window.location.pathname}${window.location.search}`;
        window.history.replaceState(null, '', nextUrl);
    }
};

window.switchInvoicesTab = switchInvoicesTab;

const initInvoicesTabs = () => {
    const tabBtns = Array.from(document.querySelectorAll('.invoices-tab-btn'));
    const tabBar = document.querySelector('.invoices-tab-bar');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-inv-tab');
            switchInvoicesTab(targetTab, false);
        });
    });

    if (tabBar && tabBtns.length > 0) {
        tabBar.addEventListener('keydown', (e) => {
            const currentIndex = tabBtns.findIndex(b => b.getAttribute('data-inv-tab') === activeInvoicesTab);
            if (currentIndex === -1) return;

            let nextIndex = -1;
            if (e.key === 'ArrowRight') {
                nextIndex = (currentIndex + 1) % tabBtns.length;
            } else if (e.key === 'ArrowLeft') {
                nextIndex = (currentIndex - 1 + tabBtns.length) % tabBtns.length;
            } else if (e.key === 'Home') {
                nextIndex = 0;
            } else if (e.key === 'End') {
                nextIndex = tabBtns.length - 1;
            }

            if (nextIndex !== -1) {
                e.preventDefault();
                const nextKey = tabBtns[nextIndex].getAttribute('data-inv-tab');
                switchInvoicesTab(nextKey, true);
            }
        });
    }

    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    const hash = (window.location.hash || '').replace('#', '');
    if (urlTab === 'settled-invoices' || hash === 'settled-invoices') {
        switchInvoicesTab('settled-invoices', false);
    } else {
        switchInvoicesTab('pending-clearance', false);
    }
};

const renderPendingClearances = (items) => {
    const container = document.getElementById('pending-clearance-div');
    const card = document.getElementById('pendingClearanceCard');
    const badge = document.getElementById('pendingClearanceCountBadge');
    const tabBadge = document.getElementById('tabBadgePendingClearance');
    if (!container) return;

    const totalPending = Array.isArray(pendingClearances) ? pendingClearances.length : 0;
    const shownCount = Array.isArray(items) ? items.length : 0;

    if (card) {
        card.classList.toggle('has-pending', totalPending > 0);
    }
    if (badge) {
        badge.textContent = totalPending > 0 ? `${totalPending} Awaiting Action` : '0 Pending';
        badge.className = totalPending > 0 ? 'badge badge-success' : 'badge badge-secondary';
    }
    if (tabBadge) {
        tabBadge.textContent = `${totalPending} Pending`;
        tabBadge.className = totalPending > 0
            ? 'badge badge-success invoices-tab-badge'
            : 'badge badge-secondary invoices-tab-badge';
    }

    const clrFilterBar = document.getElementById('clearance-filter-bar');
    let clrCountEl = document.getElementById('clearance_results_count');
    if (!clrCountEl && clrFilterBar) {
        clrCountEl = document.createElement('div');
        clrCountEl.id = 'clearance_results_count';
        clrCountEl.className = 'filter-results-count';
        clrFilterBar.appendChild(clrCountEl);
    }
    if (clrCountEl) {
        const unitLabel = shownCount === 1 ? 'case' : 'cases';
        clrCountEl.innerHTML = totalPending !== shownCount
            ? `<span class="badge badge-info">Showing ${shownCount} of ${totalPending} cases</span>`
            : `<span class="badge badge-info">${shownCount} ${unitLabel}</span>`;
    }

    if (!items || items.length === 0) {
        const msg = totalPending === 0
            ? 'No patients are currently awaiting Final Billing Clearance or Statement of Account generation. When an Attending Physician issues a May Go Home order, the patient appears here immediately.'
            : 'No pending discharge clearances match your current search or stage filter.';
        container.innerHTML = `<div class="clearance-empty-banner"><span>${msg}</span></div>`;
        return;
    }

    let html = '<table class="data-table"><thead><tr>';
    html += renderSortableTh("Case & Patient", "Admission_ID");
    html += renderSortableTh("Medical Clearance & Diagnosis", "Medical_Discharge_Date");
    html += renderSortableTh("Running Charges & Deposits", "Running_Net_Charges");
    html += renderSortableTh("Discharge Stage", "Status");
    html += '<th class="text-right">Billing Action</th>';
    html += '</tr></thead><tbody>';

    items.forEach(c => {
        const isStillAdmitted = c.Status === 'Admitted';
        const runningCharges = parseFloat(c.Running_Net_Charges || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
        const advPaid = parseFloat(c.Advance_Paid || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
        const estBalVal = parseFloat(c.Estimated_Balance || 0);
        const estBal = estBalVal.toLocaleString('en-PH', { minimumFractionDigits: 2 });

        const roomMeta = c.Bed_Code
            ? `${c.Room_Name || 'Room'} (${c.Room_Type || 'Ward'}) • Bed <strong>${c.Bed_Code}</strong>`
            : 'Bed Released';

        const docText = c.Medical_Discharge_Date
            ? `<span class="clearance-doc-note">✔ Cleared by <strong>${c.Medical_Discharge_Doctor_Name || 'Attending Doctor'}</strong> • ${c.Formatted_Medical_Discharge_Date || ''}</span>`
            : `<span class="table-sub-text">Attending: ${c.Assigned_Doctors || 'Hospital Physician'}</span>`;

        const dxText = c.Diagnosis
            ? `<span class="table-sub-text">Dx: <strong>${c.Diagnosis}</strong></span>`
            : '<span class="table-sub-text text-muted">Dx: Pending</span>';

        const instText = c.Discharge_Instructions
            ? `<span class="table-sub-text">Instructions: ${c.Discharge_Instructions}</span>`
            : '';

        const stageHtml = isStillAdmitted
            ? '<span class="badge badge-success table-status-pill">✔ MEDICALLY CLEARED</span><span class="table-sub-text">Step 2: Needs Bed Release &amp; Billing Clearance</span>'
            : `<span class="badge badge-warning table-status-pill">BED RELEASED — READY FOR SOA</span><span class="table-sub-text">${c.Formatted_Discharge_Date ? 'Released: ' + c.Formatted_Discharge_Date : 'Awaiting Final SOA &amp; Settlement'}</span>`;

        const primaryActionBtn = isStillAdmitted
            ? `<a href="admission_details.html?id=${c.Admission_ID}#tab-settlement" class="btn btn-sm btn-warning">Process Billing Clearance &rarr;</a>`
            : `<a href="admission_details.html?id=${c.Admission_ID}#tab-settlement" class="btn btn-sm btn-primary">Finalize &amp; Issue SOA &rarr;</a>`;

        const rawNetCharges = parseFloat(c.Running_Net_Charges || 0);
        const sortDateVal = c.Medical_Discharge_Date || c.Discharge_Date || '';
        const sortStageVal = isStillAdmitted ? '1-Medically Cleared' : '2-Bed Released';

        html += '<tr>';
        html += `<td data-sort-value="${c.Admission_ID}"><span class="table-primary-text text-primary">${c.Admission_Code}</span><span class="table-primary-text">${c.Patient_Name} <small class="text-muted">(${c.Patient_Code})</small></span><span class="table-sub-text">${roomMeta}</span></td>`;
        html += `<td data-sort-value="${sortDateVal}">${docText}${dxText}${instText}</td>`;
        html += `<td class="text-right" data-sort-value="${rawNetCharges}"><span class="table-amount-prominent text-primary">₱${runningCharges}</span><span class="table-sub-text">Deposits: ₱${advPaid} • Est. Due: <strong class="${estBalVal > 0 ? 'text-danger' : 'text-success'}">₱${estBal}</strong></span></td>`;
        html += `<td data-sort-value="${sortStageVal}">${stageHtml}</td>`;
        html += `<td class="text-right"><div class="clearance-action-group"><a href="admission_details.html?id=${c.Admission_ID}#tab-ledger" class="btn btn-sm btn-outline">Live Ledger</a>${primaryActionBtn}</div></td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
};

const filterAndRenderPendingClearances = () => {
    const searchEl = document.getElementById('clearance_search_input');
    const query = searchEl ? searchEl.value.toLowerCase().trim() : '';
    const stageEl = document.getElementById('clearance_stage_filter');
    const stageFilter = stageEl ? stageEl.value : 'all';

    const filtered = pendingClearances.filter(c => {
        if (stageFilter === 'medically_cleared' && c.Status !== 'Admitted') return false;
        if (stageFilter === 'discharged' && c.Status !== 'Discharged') return false;

        if (!query) return true;
        return (c.Patient_Name && c.Patient_Name.toLowerCase().includes(query)) ||
            (c.Full_Name && c.Full_Name.toLowerCase().includes(query)) ||
            (c.Patient_Code && c.Patient_Code.toLowerCase().includes(query)) ||
            (c.Admission_Code && c.Admission_Code.toLowerCase().includes(query)) ||
            (c.Medical_Discharge_Doctor_Name && c.Medical_Discharge_Doctor_Name.toLowerCase().includes(query)) ||
            (c.Assigned_Doctors && c.Assigned_Doctors.toLowerCase().includes(query)) ||
            (c.Bed_Code && c.Bed_Code.toLowerCase().includes(query)) ||
            (c.Room_Name && c.Room_Name.toLowerCase().includes(query)) ||
            (c.Diagnosis && c.Diagnosis.toLowerCase().includes(query));
    });

    renderPendingClearances(filtered);
};

const loadPendingClearances = () => {
    const formData = new FormData();
    formData.append('operation', 'getPendingBillingClearances');

    axios.post(`${getApiUrl}/invoices.php`, formData)
        .then(response => {
            pendingClearances = Array.isArray(response.data) ? response.data : [];
            filterAndRenderPendingClearances();
        })
        .catch(() => {
            pendingClearances = [];
            filterAndRenderPendingClearances();
        });
};

const refreshAllBillingData = () => {
    loadPendingClearances();
    loadInvoices();
};

const loadPaymentMethods = () => {
    const formData = new FormData();
    formData.append('operation', 'getPaymentMethods');

    axios.post(`${getApiUrl}/invoices.php`, formData)
        .then(response => {
            paymentMethods = response.data || [];
        })
        .catch(() => {});
};

const openPaymentMethodPicker = () => {
    openGenericLookupPicker({
        title: "Select Payment Method",
        items: paymentMethods.map(pm => ({
            id: pm.Payment_Method_ID,
            text: pm.Method_Name,
            subtext: `Category: ${pm.Category_Type}`,
            badge: pm.Category_Type,
            badgeClass: "badge-info"
        })),
        selectedId: document.getElementById("pay_method_id").value,
        onSelect: (item) => {
            document.getElementById("pay_method_id").value = item.id;
            document.getElementById("pay_method_id_text").value = item.text;
        }
    });
};

const renderInvoicesTable = (invoices) => {
    const tableDiv = document.getElementById('table-div');
    const total = (typeof allInvoices !== "undefined" && Array.isArray(allInvoices)) ? allInvoices.length : (invoices ? invoices.length : 0);

    const tabInvBadge = document.getElementById('tabBadgeSettledInvoices');
    if (tabInvBadge) {
        tabInvBadge.textContent = `${total} ${total === 1 ? 'Invoice' : 'Invoices'}`;
    }

    const invFilterBar = document.getElementById('invoices-filter-bar');
    let invCountEl = document.getElementById('filter_results_count');
    if (!invCountEl && invFilterBar) {
        invCountEl = document.createElement('div');
        invCountEl.id = 'filter_results_count';
        invCountEl.className = 'filter-results-count';
        invFilterBar.appendChild(invCountEl);
    }

    if (typeof updateFilterCount === "function") {
        updateFilterCount(invoices ? invoices.length : 0, total, "invoices");
    }

    if (!invoices || invoices.length === 0) {
        tableDiv.innerHTML = typeof getEmptyStateHtml === "function"
            ? getEmptyStateHtml("🧾", "No billing invoices found", "No invoices found matching the current keyword search.")
            : '<p><em>No settled invoices found matching criteria.</em></p>';
        return;
    }

    let html = '<table class="data-table">';
    html += '<thead><tr>';
    html += renderSortableTh("Invoice & Case", "Invoice_ID");
    html += renderSortableTh("Patient Demographic", "Patient_Name");
    html += renderSortableTh("Gross & Discounts", "Gross_Total");
    html += renderSortableTh("Net & Payments", "Net_Amount_Due");
    html += renderSortableTh("Settlement Status & Balance", "Remaining_Balance");
    html += '</tr></thead><tbody>';

    invoices.forEach(inv => {
        const gross = parseFloat(inv.Gross_Total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
        const net = parseFloat(inv.Net_Amount_Due || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
        const paid = parseFloat(inv.Amount_Paid || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
        const balVal = parseFloat(inv.Remaining_Balance !== undefined && inv.Remaining_Balance !== null ? inv.Remaining_Balance : Math.max(0, parseFloat(inv.Net_Amount_Due || 0) - parseFloat(inv.Amount_Paid || 0)));
        const bal = balVal.toLocaleString('en-PH', {minimumFractionDigits: 2});
        const paidVal = parseFloat(inv.Amount_Paid || 0);

        let discBadge = '<span class="text-muted table-sub-text">No discounts applied</span>';
        if (inv.Discount_Summary) {
            const discItems = inv.Discount_Summary.split(/;\s*|<br\s*\/?>/i).map(s => s.trim()).filter(Boolean);
            discBadge = `<span class="table-sub-text">${discItems.join(' • ')}</span>`;
        } else if (inv.Discount_Name && inv.Discount_Name !== 'None') {
            discBadge = `<span class="table-sub-text">${inv.Discount_Name} (${parseFloat(inv.Discount_Percentage || 0).toFixed(0)}%)</span>`;
        }

        let statusBadge = '';
        if (balVal <= 0) {
            statusBadge = '<span class="badge badge-success table-status-pill">PAID IN FULL</span>';
        } else if (inv.Promissory_Note_ID && inv.Promissory_Status === 'Active') {
            const dueStr = inv.Formatted_Promissory_Next_Due_Date || inv.Promissory_Next_Due_Date;
            const dueAmt = parseFloat(inv.Promissory_Monthly_Amount || balVal);
            statusBadge = `
                <span class="badge table-pn-badge">PROMISSORY NOTE</span>
                <span class="table-sub-text text-danger">Due: ${dueStr} (₱${dueAmt.toLocaleString('en-PH', {minimumFractionDigits: 2})})</span>
            `;
        } else if (paidVal > 0) {
            statusBadge = `
                <span class="badge badge-warning table-status-pill">PARTIALLY PAID</span>
                <span class="table-sub-text text-danger">Bal: ₱${bal}</span>
            `;
        } else {
            statusBadge = '<span class="badge badge-danger table-status-pill">PENDING PAYMENT</span>';
        }

        const balDisplay = balVal > 0 
            ? `<span class="table-amount-prominent text-danger">₱${bal}</span>`
            : `<span class="table-amount-prominent text-success">₱0.00</span>`;

        html += `<tr class="clickable-row" onclick="openPaymentHistoryModal(${inv.Invoice_ID})" title="Click row to view payment history, official receipts, SOA, or pay balance">`;
        html += `<td><span class="table-primary-text text-primary">${inv.Invoice_Code}</span><span class="table-sub-text">Case: <strong>${inv.Admission_Code}</strong></span></td>`;
        html += `<td><span class="table-primary-text">${inv.Patient_Name}</span><span class="table-sub-text">${inv.Patient_Code} • Billed: ${inv.Settlement_Date} (${inv.Cashier_Name})</span></td>`;
        html += `<td><span class="table-primary-text">Gross: ₱${gross}</span>${discBadge}</td>`;
        html += `<td class="text-right"><span class="table-amount-prominent text-primary">Net: ₱${net}</span><span class="table-sub-text">Paid: ₱${paid}</span></td>`;
        html += `<td class="text-right">${statusBadge}<span class="table-sub-text">${balDisplay}</span></td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    tableDiv.innerHTML = html;
};

const filterAndRenderInvoices = () => {
    const searchEl = document.getElementById('search_input');
    const query = searchEl ? searchEl.value.toLowerCase().trim() : '';

    const statusEl = document.getElementById('status_filter');
    const statusFilter = statusEl ? statusEl.value : 'all';

    const filtered = allInvoices.filter(inv => {
        const matchesQuery = !query || 
            (inv.Patient_Name && inv.Patient_Name.toLowerCase().includes(query)) ||
            (inv.Invoice_Code && inv.Invoice_Code.toLowerCase().includes(query)) ||
            (inv.Admission_Code && inv.Admission_Code.toLowerCase().includes(query)) ||
            (inv.Cashier_Name && inv.Cashier_Name.toLowerCase().includes(query));

        if (!matchesQuery) return false;

        const balVal = parseFloat(inv.Remaining_Balance !== undefined && inv.Remaining_Balance !== null ? inv.Remaining_Balance : Math.max(0, parseFloat(inv.Net_Amount_Due || 0) - parseFloat(inv.Amount_Paid || 0)));
        const paidVal = parseFloat(inv.Amount_Paid || 0);
        const hasPN = Boolean(inv.Promissory_Note_ID && inv.Promissory_Status === 'Active');

        if (statusFilter === 'paid') return balVal <= 0;
        if (statusFilter === 'partial') return balVal > 0 && paidVal > 0;
        if (statusFilter === 'pn') return hasPN && balVal > 0;
        if (statusFilter === 'unpaid') return balVal > 0 && paidVal <= 0;
        return true;
    });

    renderInvoicesTable(filtered);
};

const loadInvoices = () => {
    const formData = new FormData();
    formData.append('operation', 'getAllInvoices');

    axios.post(`${getApiUrl}/invoices.php`, formData)
        .then(response => {
            allInvoices = response.data || [];
            filterAndRenderInvoices();
        })
        .catch(() => {
            showPopupAlert("Failed to load invoices.");
        });
};

const viewPrintInvoice = (invoiceId) => {
    window.location.href = `invoice_print.html?id=${invoiceId}`;
};

const updatePaymentModalCalculations = () => {
    if (!currentPaymentInvoice) return;

    const net = parseFloat(currentPaymentInvoice.Net_Amount_Due || 0);
    const paidSoFar = parseFloat(currentPaymentInvoice.Amount_Paid || 0);
    const currentBal = Math.max(0, Math.round((net - paidSoFar) * 100) / 100);

    const inputVal = parseFloat(document.getElementById('pay_amount_input').value || 0);

    const lblNewBal = document.getElementById('pay_new_balance_display');
    const lblChange = document.getElementById('pay_change_display');

    if (inputVal >= currentBal) {
        const change = Math.round((inputVal - currentBal) * 100) / 100;
        if (lblNewBal) {
            lblNewBal.textContent = '₱0.00 (PAID IN FULL)';
            lblNewBal.style.color = '#16a34a';
        }
        if (lblChange) {
            lblChange.textContent = `₱${change.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
            lblChange.style.color = '#16a34a';
        }
    } else {
        const remaining = Math.max(0, Math.round((currentBal - inputVal) * 100) / 100);
        if (lblNewBal) {
            lblNewBal.textContent = `₱${remaining.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
            lblNewBal.style.color = '#dc2626';
        }
        if (lblChange) {
            lblChange.textContent = '₱0.00';
            lblChange.style.color = '#64748b';
        }
    }
};

const openPaymentModal = (invoiceId) => {
    const inv = allInvoices.find(i => String(i.Invoice_ID) === String(invoiceId));
    if (!inv) return;

    currentPaymentInvoice = inv;

    const net = parseFloat(inv.Net_Amount_Due || 0);
    const paid = parseFloat(inv.Amount_Paid || 0);
    const bal = Math.max(0, Math.round((net - paid) * 100) / 100);

    document.getElementById('pay_invoice_id').value = inv.Invoice_ID;
    document.getElementById('pay_invoice_code').textContent = inv.Invoice_Code;
    document.getElementById('pay_admission_code').textContent = inv.Admission_Code;
    document.getElementById('pay_patient_name').textContent = `${inv.Patient_Code} - ${inv.Patient_Name}`;
    document.getElementById('pay_net_due').textContent = net.toLocaleString('en-PH', {minimumFractionDigits: 2});
    document.getElementById('pay_amount_paid').textContent = paid.toLocaleString('en-PH', {minimumFractionDigits: 2});
    document.getElementById('pay_remaining_balance').textContent = bal.toLocaleString('en-PH', {minimumFractionDigits: 2});

    const input = document.getElementById('pay_amount_input');
    input.value = bal.toFixed(2);

    const notesInput = document.getElementById('pay_notes_input');
    if (notesInput) notesInput.value = '';

    const defaultMethod = paymentMethods.find(pm => (pm.Method_Name || '').toLowerCase().includes("cash")) || paymentMethods[0];
    if (defaultMethod) {
        document.getElementById("pay_method_id").value = defaultMethod.Payment_Method_ID;
        document.getElementById("pay_method_id_text").value = `${defaultMethod.Method_Name} (${defaultMethod.Category_Type})`;
    } else {
        document.getElementById("pay_method_id").value = "1";
        document.getElementById("pay_method_id_text").value = "Cash (Cash)";
    }

    updatePaymentModalCalculations();
    openModal('recordPaymentModal');
};

const openPaymentHistoryModal = (invoiceId) => {
    const inv = allInvoices.find(i => String(i.Invoice_ID) === String(invoiceId));
    if (!inv) return;

    currentPaymentInvoice = inv;
    const net = parseFloat(inv.Net_Amount_Due || 0);
    const paid = parseFloat(inv.Amount_Paid || 0);
    const balVal = parseFloat(inv.Remaining_Balance !== undefined && inv.Remaining_Balance !== null ? inv.Remaining_Balance : Math.max(0, net - paid));

    document.getElementById('hist_invoice_code').textContent = inv.Invoice_Code;
    document.getElementById('hist_admission_code').textContent = inv.Admission_Code;
    document.getElementById('hist_patient_name').textContent = `${inv.Patient_Code} - ${inv.Patient_Name}`;

    const gross = parseFloat(inv.Gross_Total || 0);
    const vatRate = parseFloat(inv.VAT_Rate !== undefined && inv.VAT_Rate !== null ? inv.VAT_Rate : 12.00);
    const vatAmt = parseFloat(inv.VAT_Amount || 0);
    const vatExemptAmt = parseFloat(inv.VAT_Exempt_Amount || 0);
    const isExempt = (vatRate === 0 || vatExemptAmt > 0);

    const elGross = document.getElementById('hist_gross_total');
    if (elGross) elGross.textContent = gross.toLocaleString('en-PH', {minimumFractionDigits: 2});

    const elVatWrap = document.getElementById('hist_vat_amount_wrap');
    if (elVatWrap) {
        if (isExempt) {
            elVatWrap.innerHTML = '<span class="badge badge-success table-status-pill">0% (VAT-Exempt)</span>';
        } else {
            elVatWrap.innerHTML = `₱${vatAmt.toLocaleString('en-PH', {minimumFractionDigits: 2})} <span class="table-sub-text">(12% included)</span>`;
        }
    }

    const elDiscSumm = document.getElementById('hist_discounts_summary');
    if (elDiscSumm) {
        if (inv.Discount_Summary) {
            const discItems = inv.Discount_Summary.split(/;\s*|<br\s*\/?>/i).map(s => s.trim()).filter(Boolean);
            elDiscSumm.textContent = discItems.join(', ');
        } else if (inv.Discount_Name && inv.Discount_Name !== 'None') {
            elDiscSumm.textContent = `${inv.Discount_Name} (${parseFloat(inv.Discount_Percentage || 0).toFixed(0)}%) - ₱${parseFloat(inv.Discount_Amount || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
        } else {
            elDiscSumm.textContent = 'None';
        }
    }

    const elNet = document.getElementById('hist_net_due');
    if (elNet) elNet.textContent = net.toLocaleString('en-PH', {minimumFractionDigits: 2});
    const elPaid = document.getElementById('hist_amount_paid');
    if (elPaid) elPaid.textContent = paid.toLocaleString('en-PH', {minimumFractionDigits: 2});
    const elBal = document.getElementById('hist_remaining_balance');
    if (elBal) {
        elBal.textContent = balVal.toLocaleString('en-PH', {minimumFractionDigits: 2});
        const wrap = document.getElementById('hist_remaining_balance_wrap');
        if (wrap) {
            wrap.className = balVal > 0 ? 'invoice-balance-highlight text-danger' : 'invoice-balance-highlight text-success';
        }
    }

    const pnWrap = document.getElementById('hist_pn_wrap');
    const pnText = document.getElementById('hist_pn_text');
    if (balVal > 0 && inv.Promissory_Next_Due_Date) {
        if (pnWrap && pnText) {
            pnWrap.style.display = 'block';
            const planStr = inv.Promissory_Plan_Name || 'Installment Plan';
            const dueStr = inv.Formatted_Promissory_Next_Due_Date || inv.Promissory_Next_Due_Date;
            const dueAmt = parseFloat(inv.Promissory_Monthly_Amount || balVal);
            pnText.textContent = `${planStr} — Next Due: ${dueStr} (₱${dueAmt.toLocaleString('en-PH', {minimumFractionDigits: 2})}/mo)`;
        }
    } else if (pnWrap) {
        pnWrap.style.display = 'none';
    }

    const btnPay = document.getElementById('btnHistPayBalance');
    const badgePaid = document.getElementById('histPaidInFullBadge');
    if (btnPay) {
        if (balVal > 0) {
            btnPay.style.display = 'inline-block';
            btnPay.onclick = () => {
                closeModal('paymentHistoryModal');
                openPaymentModal(inv.Invoice_ID);
            };
        } else {
            btnPay.style.display = 'none';
        }
    }
    if (badgePaid) {
        badgePaid.style.display = balVal <= 0 ? 'inline-block' : 'none';
    }

    const container = document.getElementById('history-modal-table-div');
    container.innerHTML = '<p class="text-muted">Loading payment transactions...</p>';

    const formData = new FormData();
    formData.append('operation', 'getPaymentHistory');
    formData.append('json', JSON.stringify({ invoice_id: invoiceId }));

    axios.post(`${getApiUrl}/invoices.php`, formData)
        .then(res => {
            let list = res.data;
            if (typeof list === 'string') {
                try { list = JSON.parse(list); } catch (e) {}
            }

            if (!Array.isArray(list) || list.length === 0) {
                container.innerHTML = '<div class="empty-state-panel"><p class="text-muted">No payment transactions recorded for this invoice yet.</p></div>';
                openModal('paymentHistoryModal');
                return;
            }

            let rows = '';
            list.forEach(p => {
                const amt = parseFloat(p.Amount_Paid || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
                const pBalVal = parseFloat(p.Balance_After || 0);
                const bal = pBalVal.toLocaleString('en-PH', {minimumFractionDigits: 2});
                const isPaid = pBalVal <= 0;
                const statusBadge = isPaid
                    ? '<span class="badge badge-success table-status-pill">PAID IN FULL</span>'
                    : '<span class="badge badge-warning table-status-pill">ACTIVE BALANCE</span>';

                rows += `
                    <tr class="clickable-row" onclick="window.location.href='payment_receipt.html?payment_id=${p.Payment_ID}'" title="Click row to view / print Official Receipt voucher">
                        <td>
                            <span class="table-primary-text text-primary font-bold">${p.Receipt_Number}</span>
                            <span class="table-sub-text">${p.Payment_Date}</span>
                        </td>
                        <td>
                            <span class="table-primary-text font-bold">${p.Payment_Method || 'Cash'}</span>
                            <span class="table-sub-text">Cashier: <strong>${p.Cashier_Name}</strong></span>
                        </td>
                        <td>
                            <span class="table-primary-text">${p.Notes || 'Official Settlement Payment'}</span>
                        </td>
                        <td class="text-right">
                            <span class="table-amount-prominent text-success">₱${amt}</span>
                            <span class="table-sub-text">Paid</span>
                        </td>
                        <td class="text-right">
                            <span class="table-amount-prominent ${isPaid ? 'text-success' : 'text-danger'}">₱${bal}</span>
                            <span class="table-sub-text">Balance</span>
                        </td>
                        <td class="text-right">
                            ${statusBadge}
                        </td>
                    </tr>
                `;
            });

            container.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Official Receipt &amp; Date</th>
                            <th>Payment Method &amp; Cashier</th>
                            <th>Particulars / Notes</th>
                            <th class="text-right">Amount Paid</th>
                            <th class="text-right">Remaining Balance</th>
                            <th class="text-right">Settlement Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            `;

            openModal('paymentHistoryModal');
        })
        .catch(() => {
            container.innerHTML = '<p class="text-danger">Failed to load payment transactions.</p>';
            openModal('paymentHistoryModal');
        });
};

const submitPayment = () => {
    if (!currentPaymentInvoice) return;

    const invoiceId = document.getElementById('pay_invoice_id').value;
    const payInput = document.getElementById('pay_amount_input');
    const rawAmount = payInput ? payInput.value.trim() : '';

    const valAmount = typeof validateNumericField === 'function' ? validateNumericField(rawAmount, 'Payment Amount', 0, false) : { valid: !isNaN(parseFloat(rawAmount)) && parseFloat(rawAmount) > 0 };
    if (!valAmount.valid) {
        showPopupAlert(valAmount.message || "Please enter a valid payment amount greater than zero.", "warning");
        if (payInput) payInput.focus();
        return;
    }

    const amount = parseFloat(rawAmount);

    if (isNaN(amount) || amount <= 0) {
        showPopupAlert("Please enter a valid payment amount greater than zero.", "warning");
        return;
    }

    const methodSelect = document.getElementById('pay_method_id');
    const paymentMethodId = methodSelect ? parseInt(methodSelect.value, 10) : 1;
    const notesInput = document.getElementById('pay_notes_input');
    const payNotes = notesInput ? notesInput.value.trim() : '';

    const userJson = sessionStorage.getItem("hospital_user");
    const user = userJson ? JSON.parse(userJson) : null;
    const userId = user ? (user.user_id || user.User_ID || 1) : 1;

    showPopupConfirm(`Confirm payment of ₱${amount.toLocaleString('en-PH', {minimumFractionDigits: 2})} for ${currentPaymentInvoice.Invoice_Code}?`, () => {
        const payload = {
            invoice_id: invoiceId,
            payment_amount: amount,
            payment_method_id: paymentMethodId,
            notes: payNotes,
            user_id: userId
        };

        const formData = new FormData();
        formData.append('operation', 'recordPayment');
        formData.append('json', JSON.stringify(payload));

        axios.post(`${postApiUrl}/invoices.php`, formData)
            .then(response => {
                if (response.data.success) {
                    closeModal('recordPaymentModal');
                    const payId = response.data.payment_id;
                    const rcptNum = response.data.receipt_number || '';
                    let msg = response.data.message;
                    if (rcptNum) {
                        msg += `\nOfficial Receipt: ${rcptNum}`;
                    }

                    showPopupAlert(msg, "success", "Payment Recorded", () => {
                        if (payId) {
                            window.location.href = `payment_receipt.html?payment_id=${payId}`;
                        } else {
                            loadInvoices();
                        }
                    });
                } else {
                    showPopupAlert(response.data.error || "Failed to record payment.", "danger");
                }
            })
            .catch(() => {
                showPopupAlert("Network error while recording payment.", "danger");
            });
    }, null, {
        title: "Confirm Payment",
        confirmText: "Post Payment",
        type: "info"
    });
};

window.viewPrintInvoice = viewPrintInvoice;
window.openPaymentModal = openPaymentModal;
window.openPaymentHistoryModal = openPaymentHistoryModal;

window.addEventListener('DOMContentLoaded', () => {
    const userJson = sessionStorage.getItem("hospital_user");
    if (!userJson) {
        window.location.href = "login.html";
        return;
    }

    const currentUser = JSON.parse(userJson);
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
        userDisplay.textContent = `${currentUser.full_name || currentUser.username} (${currentUser.role_name || 'Staff'})`;
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout && !btnLogout.dataset.wired) {
        btnLogout.dataset.wired = "true";
        btnLogout.addEventListener('click', () => {
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

    initInvoicesTabs();

    document.getElementById('clearance_search_input')?.addEventListener('input', filterAndRenderPendingClearances);
    document.getElementById('clearance_stage_filter')?.addEventListener('change', filterAndRenderPendingClearances);
    initRefreshBtn("btnRefreshClearances", refreshAllBillingData);

    document.getElementById('search_input')?.addEventListener('input', filterAndRenderInvoices);
    document.getElementById('status_filter')?.addEventListener('change', filterAndRenderInvoices);
    initRefreshBtn("btnRefreshInvoices", refreshAllBillingData);

    document.getElementById('btnClosePaymentModal')?.addEventListener('click', () => closeModal('recordPaymentModal'));
    document.getElementById('btnCancelPayment')?.addEventListener('click', () => closeModal('recordPaymentModal'));
    document.getElementById('btnSubmitPayment')?.addEventListener('click', submitPayment);

    document.getElementById('btnCloseHistoryModal')?.addEventListener('click', () => closeModal('paymentHistoryModal'));
    document.getElementById('btnDismissHistoryModal')?.addEventListener('click', () => closeModal('paymentHistoryModal'));
    document.getElementById('btnHistViewSOA')?.addEventListener('click', () => {
        if (currentPaymentInvoice) {
            viewPrintInvoice(currentPaymentInvoice.Invoice_ID);
        }
    });

    document.getElementById('btnHistViewGatePass')?.addEventListener('click', () => {
        if (currentPaymentInvoice) {
            window.location.href = `discharge_clearance.html?invoice_id=${currentPaymentInvoice.Invoice_ID}&admission_id=${currentPaymentInvoice.Admission_ID}`;
        }
    });

    document.getElementById('pay_amount_input')?.addEventListener('input', updatePaymentModalCalculations);

    document.getElementById('btnPayFullBalance')?.addEventListener('click', () => {
        if (!currentPaymentInvoice) return;
        const net = parseFloat(currentPaymentInvoice.Net_Amount_Due || 0);
        const paid = parseFloat(currentPaymentInvoice.Amount_Paid || 0);
        const bal = Math.max(0, Math.round((net - paid) * 100) / 100);
        document.getElementById('pay_amount_input').value = bal.toFixed(2);
        updatePaymentModalCalculations();
    });

    loadPaymentMethods();
    loadPendingClearances();
    loadInvoices();
});

