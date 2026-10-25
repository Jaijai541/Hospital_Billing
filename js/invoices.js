const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allInvoices = [];
let currentPaymentInvoice = null;
let paymentMethods = [];

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

    if (typeof updateFilterCount === "function") {
        const total = (typeof allInvoices !== "undefined" && Array.isArray(allInvoices)) ? allInvoices.length : (invoices ? invoices.length : 0);
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
            discBadge = discItems.map(item => `<span class="badge badge-info table-disc-pill">${item}</span>`).join('');
        } else if (inv.Discount_Name && inv.Discount_Name !== 'None') {
            discBadge = `<span class="badge badge-info table-disc-pill">${inv.Discount_Name} (${parseFloat(inv.Discount_Percentage || 0).toFixed(0)}%)</span>`;
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
            elDiscSumm.innerHTML = discItems.map(item => `<span class="badge badge-info table-disc-pill">${item}</span>`).join(' ');
        } else if (inv.Discount_Name && inv.Discount_Name !== 'None') {
            elDiscSumm.innerHTML = `<span class="badge badge-info table-disc-pill">${inv.Discount_Name} (${parseFloat(inv.Discount_Percentage || 0).toFixed(0)}%) - ₱${parseFloat(inv.Discount_Amount || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>`;
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
                            <span class="badge badge-info table-disc-pill">${p.Payment_Method || 'Cash'}</span>
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

    document.getElementById('search_input').addEventListener('input', filterAndRenderInvoices);
    document.getElementById('status_filter')?.addEventListener('change', filterAndRenderInvoices);
    initRefreshBtn("btnRefreshInvoices", loadInvoices);

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
    loadInvoices();
});

