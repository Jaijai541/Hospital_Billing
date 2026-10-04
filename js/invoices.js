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
    html += '<th>Invoice #</th>';
    html += '<th>Admission #</th>';
    html += '<th>Patient Code & Name</th>';
    html += '<th>Gross Charges</th>';
    html += '<th>Applied Discounts</th>';
    html += '<th>12% VAT</th>';
    html += '<th>Net Amount Due</th>';
    html += '<th>Amount Paid</th>';
    html += '<th>Balance Due</th>';
    html += '<th>Payment Status</th>';
    html += '<th>Settlement Date</th>';
    html += '<th>Cashier</th>';
    html += '</tr></thead><tbody>';

    invoices.forEach(inv => {
        const gross = parseFloat(inv.Gross_Total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
        const net = parseFloat(inv.Net_Amount_Due || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
        const paid = parseFloat(inv.Amount_Paid || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
        const balVal = parseFloat(inv.Remaining_Balance !== undefined && inv.Remaining_Balance !== null ? inv.Remaining_Balance : Math.max(0, parseFloat(inv.Net_Amount_Due || 0) - parseFloat(inv.Amount_Paid || 0)));
        const bal = balVal.toLocaleString('en-PH', {minimumFractionDigits: 2});
        const paidVal = parseFloat(inv.Amount_Paid || 0);

        let discBadge = '<span class="text-muted">None</span>';
        if (inv.Discount_Summary) {
            const discItems = inv.Discount_Summary.split(/;\s*|<br\s*\/?>/i).map(s => s.trim()).filter(Boolean);
            discBadge = discItems.map(item => `<span class="badge badge-info" style="font-size: 11px; max-width: 220px; white-space: normal; display: inline-block; text-align: left; margin-bottom: 2px;">${item}</span>`).join('<br>');
        } else if (inv.Discount_Name && inv.Discount_Name !== 'None') {
            discBadge = `<span class="badge badge-info">${inv.Discount_Name} (${parseFloat(inv.Discount_Percentage || 0).toFixed(0)}%)</span>`;
        }

        const vatRate = parseFloat(inv.VAT_Rate !== undefined && inv.VAT_Rate !== null ? inv.VAT_Rate : 12.00);
        const vatAmt = parseFloat(inv.VAT_Amount || 0);
        const vatExemptAmt = parseFloat(inv.VAT_Exempt_Amount || 0);
        let vatBadge = '';
        if (vatRate === 0 || vatExemptAmt > 0) {
            vatBadge = '<span class="badge badge-success" style="font-size: 11px;">0% (Exempt)</span>';
        } else {
            vatBadge = `₱${vatAmt.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
        }

        let statusBadge = '';
        if (balVal <= 0) {
            statusBadge = '<span class="badge badge-success" style="font-weight: 700; padding: 4px 8px; font-size: 11px;">PAID IN FULL</span>';
        } else if (inv.Promissory_Note_ID && inv.Promissory_Status === 'Active') {
            const dueStr = inv.Formatted_Promissory_Next_Due_Date || inv.Promissory_Next_Due_Date;
            const dueAmt = parseFloat(inv.Promissory_Monthly_Amount || balVal);
            statusBadge = `
                <span class="badge" style="background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; font-weight: 700; padding: 4px 8px; font-size: 11px;">PROMISSORY NOTE</span>
                <div style="font-size: 11px; color: #4338ca; margin-top: 3px; font-weight: 600;">Due: ${dueStr} (₱${dueAmt.toLocaleString('en-PH', {minimumFractionDigits: 2})})</div>
            `;
        } else if (paidVal > 0) {
            statusBadge = `
                <span class="badge badge-warning" style="font-weight: 700; padding: 4px 8px; font-size: 11px;">PARTIALLY PAID</span>
                <div style="font-size: 11px; color: #92400e; margin-top: 3px; font-weight: 600;">Bal: ₱${bal}</div>
            `;
        } else {
            statusBadge = '<span class="badge badge-danger" style="font-weight: 700; padding: 4px 8px; font-size: 11px;">PENDING PAYMENT</span>';
        }

        html += `<tr class="clickable-row" onclick="openPaymentHistoryModal(${inv.Invoice_ID})" title="Click row to view payment history, official receipts, SOA, or pay balance">`;
        html += `<td><strong>${inv.Invoice_Code}</strong></td>`;
        html += `<td><strong>${inv.Admission_Code}</strong></td>`;
        html += `<td><strong>${inv.Patient_Code}</strong><br>${inv.Patient_Name}</td>`;
        html += `<td>₱${gross}</td>`;
        html += `<td>${discBadge}</td>`;
        html += `<td>${vatBadge}</td>`;
        html += `<td><strong style="color: var(--primary);">₱${net}</strong></td>`;
        html += `<td>₱${paid}</td>`;
        html += `<td><strong style="color: ${balVal > 0 ? '#dc2626' : '#16a34a'};">₱${bal}</strong></td>`;
        html += `<td>${statusBadge}</td>`;
        html += `<td>${inv.Settlement_Date}</td>`;
        html += `<td>${inv.Cashier_Name}</td>`;
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
            elVatWrap.innerHTML = '<span class="badge badge-success" style="font-size: 11px;">0% (VAT-Exempt)</span>';
        } else {
            elVatWrap.innerHTML = `₱${vatAmt.toLocaleString('en-PH', {minimumFractionDigits: 2})} <span class="text-muted" style="font-size: 11px;">(12% included)</span>`;
        }
    }

    const elDiscSumm = document.getElementById('hist_discounts_summary');
    if (elDiscSumm) {
        if (inv.Discount_Summary) {
            const discItems = inv.Discount_Summary.split(/;\s*|<br\s*\/?>/i).map(s => s.trim()).filter(Boolean);
            elDiscSumm.innerHTML = discItems.join('<br>');
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
            wrap.style.color = balVal > 0 ? '#dc2626' : '#16a34a';
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
                container.innerHTML = '<p class="text-muted" style="margin: 12px 0;"><em>No payment transactions recorded for this invoice yet.</em></p>';
                openModal('paymentHistoryModal');
                return;
            }

            let rows = '';
            list.forEach(p => {
                const amt = parseFloat(p.Amount_Paid || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
                const bal = parseFloat(p.Balance_After || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
                const isPaid = parseFloat(p.Balance_After || 0) <= 0;

                rows += `
                    <tr class="clickable-row" onclick="window.location.href='payment_receipt.html?payment_id=${p.Payment_ID}'" title="Click row to view / print Official Receipt voucher">
                        <td><strong style="color: #0284c7;">${p.Receipt_Number}</strong></td>
                        <td>${p.Payment_Date}</td>
                        <td><span class="badge badge-info">${p.Payment_Method || 'Cash'}</span></td>
                        <td>${p.Cashier_Name}</td>
                        <td align="right"><strong style="color: #16a34a;">₱${amt}</strong></td>
                        <td align="right"><strong style="color: ${isPaid ? '#16a34a' : '#dc2626'};">₱${bal}</strong></td>
                        <td>${p.Notes || '-'}</td>
                    </tr>
                `;
            });

            container.innerHTML = `
                <table class="data-table" style="font-size: 13px;">
                    <thead>
                        <tr>
                            <th>Official Receipt #</th>
                            <th>Date & Time</th>
                            <th>Method</th>
                            <th>Cashier</th>
                            <th style="text-align: right;">Amount Paid</th>
                            <th style="text-align: right;">Remaining Bal</th>
                            <th>Particulars / Notes</th>
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
    const amount = parseFloat(document.getElementById('pay_amount_input').value || 0);

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
    document.getElementById('btnRefresh').addEventListener('click', loadInvoices);

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

