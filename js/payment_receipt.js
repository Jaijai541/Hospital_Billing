const getApiUrl = "../api/GET";

let currentPaymentData = null;

const getUrlParam = (param) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
};

const formatCurrency = (val) => {
    const num = parseFloat(val || 0);
    return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const renderReceipt = (data) => {
    currentPaymentData = data;

    document.getElementById('or-number').textContent = data.Receipt_Number || 'OR-00000';
    document.getElementById('or-date').textContent = data.Formatted_Payment_Date || '-';
    const isAdvance = (data.Is_Advance == 1 || data.Invoice_Code === 'Pre-Discharge Advance Deposit');
    document.getElementById('or-invoice-code').textContent = isAdvance ? 'Pre-Discharge Advance Deposit' : (data.Invoice_Code || '-');
    document.getElementById('or-admission-code').textContent = data.Admission_Code || '-';

    const banner = document.querySelector('.receipt-banner');
    if (banner && isAdvance) {
        banner.textContent = 'Official Receipt / Patient Advance Deposit Voucher';
    }

    document.getElementById('or-patient-name').textContent = `${data.Patient_Code} - ${data.Patient_Name}`;
    const ageStr = data.Age !== null && data.Age !== undefined ? `${data.Age} yrs` : '-';
    const genderStr = data.Gender_Name || '-';
    document.getElementById('or-patient-demographics').textContent = `${ageStr} / ${genderStr}`;
    document.getElementById('or-patient-contact').textContent = data.Contact_Number || 'N/A';

    const methodDisplay = data.Category_Type && data.Category_Type !== data.Payment_Method 
        ? `${data.Payment_Method} (${data.Category_Type})` 
        : (data.Payment_Method || 'Cash');
    document.getElementById('or-payment-method').textContent = methodDisplay;
    document.getElementById('or-payment-notes').textContent = data.Notes || (isAdvance ? 'Advance Patient Deposit' : 'Installment Payment');

    document.getElementById('or-net-assessed').textContent = formatCurrency(data.Net_Amount_Due);
    document.getElementById('or-balance-before').textContent = formatCurrency(data.Balance_Before);
    document.getElementById('or-amount-paid').textContent = formatCurrency(data.Amount_Paid);

    const balAfter = parseFloat(data.Balance_After || 0);
    const lblBalAfter = document.getElementById('or-balance-after');
    const statusCell = document.getElementById('or-status-cell');

    lblBalAfter.textContent = formatCurrency(balAfter);

    if (balAfter <= 0) {
        lblBalAfter.style.color = '#16a34a';
        if (statusCell) {
            statusCell.textContent = isAdvance ? 'RUNNING CHARGES COVERED' : 'PAID IN FULL';
        }
    } else {
        lblBalAfter.style.color = '#dc2626';
        if (statusCell) {
            statusCell.textContent = `${isAdvance ? 'EST. RUNNING BALANCE: ' : 'PENDING BALANCE: '}${formatCurrency(balAfter)}`;
        }
    }

    const pnRow = document.getElementById('or-pn-schedule-row');
    const pnBox = document.getElementById('or-pn-agreement-box');
    if (data.Promissory_Note && balAfter > 0) {
        if (pnRow) {
            pnRow.style.display = '';
            document.getElementById('or-next-due-date').textContent = data.Promissory_Note.Formatted_Next_Due_Date || data.Promissory_Note.Next_Due_Date || '—';
            document.getElementById('or-next-monthly-amount').textContent = formatCurrency(data.Promissory_Note.Monthly_Amount || balAfter);
            document.getElementById('or-pn-plan-name').textContent = data.Promissory_Note.Plan_Type_Name || 'Installment Plan';
        }
        if (pnBox) {
            pnBox.style.display = 'block';
        }
    } else {
        if (pnRow) pnRow.style.display = 'none';
        if (pnBox) pnBox.style.display = 'none';
    }

    document.getElementById('or-cashier-name').textContent = data.Cashier_Name || 'Cashier Staff';
    document.getElementById('or-cashier-role').textContent = `${data.Cashier_Role || 'Cashier'} / Official Hospital Staff`;

    document.title = `Official Receipt ${data.Receipt_Number} — ${data.Patient_Name}`;
};

const loadReceiptData = () => {
    const paymentId = getUrlParam('payment_id') || getUrlParam('id');
    const receiptNum = getUrlParam('receipt_number');

    if (!paymentId && !receiptNum) {
        showPopupAlert("No payment ID or receipt number specified.", "danger", "Receipt Error", () => {
            window.location.href = "invoices.html";
        });
        return;
    }

    const payload = {};
    if (paymentId) payload.payment_id = paymentId;
    if (receiptNum) payload.receipt_number = receiptNum;

    const formData = new FormData();
    formData.append('operation', 'getPaymentReceipt');
    formData.append('json', JSON.stringify(payload));

    axios.post(`${getApiUrl}/invoices.php`, formData)
        .then(res => {
            let data = res.data;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) {}
            }
            if (!data || data.error) {
                showPopupAlert(data && data.error ? data.error : "Receipt not found.", "danger", "Receipt Error", () => {
                    window.location.href = "invoices.html";
                });
                return;
            }
            renderReceipt(data);
        })
        .catch(() => {
            showPopupAlert("Failed to fetch payment receipt data.", "danger");
        });
};

window.addEventListener('DOMContentLoaded', () => {
    const userJson = sessionStorage.getItem('hospital_user');
    if (!userJson) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('btn-back-origin')?.addEventListener('click', () => {
        if (document.referrer && (document.referrer.includes('invoices.html') || document.referrer.includes('admission_details.html') || document.referrer.includes('invoice_print.html') || document.referrer.includes('promissory_notes.html'))) {
            window.location.href = document.referrer;
        } else if (currentPaymentData && currentPaymentData.Admission_ID) {
            window.location.href = `admission_details.html?id=${currentPaymentData.Admission_ID}&tab=5`;
        } else if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = 'invoices.html';
        }
    });

    loadReceiptData();
});
