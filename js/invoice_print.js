/**
 * Official Statement of Account / Invoice Print Controller
 * Milestone 3: Financial Settlement & Statements of Account (SOA)
 */

const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

window.addEventListener('DOMContentLoaded', () => {
    console.log("invoice_print.js: Initializing printable Statement of Account...");

    // Session Verification
    const userJson = sessionStorage.getItem("hospital_user");
    if (!userJson) {
        window.location.href = "login.html";
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get('id');
    const admissionId = urlParams.get('admission_id');

    if (!invoiceId && !admissionId) {
        alert("Invoice ID or Admission ID is missing.");
        window.location.href = "invoices.html";
        return;
    }

    loadInvoiceData(invoiceId, admissionId);
});

function loadInvoiceData(invoiceId, admissionId) {
    console.log("invoice_print.js: Fetching invoice data...", { invoiceId, admissionId });

    const payload = {};
    if (invoiceId) payload.invoice_id = invoiceId;
    if (admissionId) payload.admission_id = admissionId;

    const formData = new FormData();
    formData.append('operation', 'getInvoiceById');
    formData.append('json', JSON.stringify(payload));

    axios.post(`${getApiUrl}/invoices.php`, formData)
        .then(response => {
            console.log("invoice_print.js: Invoice data received:", response.data);
            let inv = response.data;
            if (typeof inv === 'string') {
                try {
                    inv = JSON.parse(inv);
                } catch (e) {
                    console.error("invoice_print.js: Failed to parse invoice JSON:", e);
                }
            }

            if (!inv || inv.error) {
                alert("Error loading invoice: " + (inv ? inv.error : "Empty response"));
                window.location.href = "invoices.html";
                return;
            }

            renderInvoice(inv);

            // If ?print=true parameter was provided, automatically open print dialog
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('print') === 'true') {
                setTimeout(() => {
                    window.print();
                }, 500);
            }
        })
        .catch(err => {
            console.error("invoice_print.js: Network error fetching invoice:", err);
            alert("Network error fetching official statement.");
        });
}

function renderInvoice(inv) {
    // 1. Invoice & Case Record
    document.getElementById('inv-code').textContent = inv.Invoice_Code || 'N/A';
    document.getElementById('inv-settlement-date').textContent = inv.Settlement_Date || 'N/A';
    document.getElementById('inv-admission-code').textContent = inv.Admission_Code || 'N/A';
    document.getElementById('inv-admission-date').textContent = inv.Admission_Date || 'N/A';
    document.getElementById('inv-stay-days').textContent = (inv.Length_Of_Stay_Days !== undefined && inv.Length_Of_Stay_Days !== null) ? inv.Length_Of_Stay_Days : '1';
    
    const cashierName = inv.Cashier_Name || 'Cashier / Billing Officer';
    const cashierRole = inv.Cashier_Role ? ` (${inv.Cashier_Role})` : '';
    document.getElementById('inv-cashier').textContent = `${cashierName}${cashierRole}`;

    // 2. Patient Demographics
    document.getElementById('patient-name').textContent = inv.Patient_Name || 'N/A';
    document.getElementById('patient-code').textContent = inv.Patient_Code || 'N/A';
    
    const dob = inv.Date_Of_Birth || 'N/A';
    const ageText = (inv.Age !== null && inv.Age !== undefined && inv.Age !== '') ? ` (${inv.Age} years old)` : '';
    document.getElementById('patient-age').textContent = `${dob}${ageText}`;
    
    document.getElementById('patient-gender-blood').textContent = `${inv.Gender_Name || 'Unspecified'} / Blood: ${inv.Blood_Type_Name || 'N/A'}`;
    document.getElementById('patient-contact').textContent = inv.Contact_Number || 'N/A';
    document.getElementById('patient-address').textContent = inv.Address || 'N/A';
    
    let emergText = 'None Recorded';
    if (inv.Emergency_Contact_Name && inv.Emergency_Contact_Number) {
        emergText = `${inv.Emergency_Contact_Name} (${inv.Emergency_Contact_Number})`;
    } else if (inv.Emergency_Contact_Name) {
        emergText = inv.Emergency_Contact_Name;
    } else if (inv.Emergency_Contact_Number) {
        emergText = inv.Emergency_Contact_Number;
    }
    document.getElementById('patient-emergency').textContent = emergText;
    document.getElementById('patient-complaint').textContent = inv.Chief_Complaint || 'None Recorded';
    const diagEl = document.getElementById('patient-diagnosis');
    if (diagEl) {
        diagEl.textContent = inv.Diagnosis || 'None Recorded';
    }

    // Assigned Physicians
    const doctors = inv.Attending_Doctors || [];
    if (doctors.length > 0) {
        const docText = doctors.map(d => `${d.Doctor_Name || 'Doctor'} (${d.Doctor_Type || 'Attending'}${d.Specialties ? ' - ' + d.Specialties : ''})`).join('; ');
        document.getElementById('patient-doctors').textContent = docText;
        document.getElementById('sig-doctor').textContent = doctors[0].Doctor_Name || 'Attending Physician';
    } else {
        document.getElementById('patient-doctors').textContent = 'None Recorded';
        document.getElementById('sig-doctor').textContent = 'Attending Physician';
    }

    // 3. Itemized Charges Table
    renderItemizedTable(inv.Ledger_Items || []);

    // 4. Financial Summary
    const sum = inv.Category_Summary || {};
    document.getElementById('summary-room').textContent = `₱${parseFloat(sum.room_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
    document.getElementById('summary-doctor').textContent = `₱${parseFloat(sum.doctor_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
    document.getElementById('summary-medicine').textContent = `₱${parseFloat(sum.medicine_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
    document.getElementById('summary-scan').textContent = `₱${parseFloat(sum.scan_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
    document.getElementById('summary-service').textContent = `₱${parseFloat(sum.service_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

    const gross = parseFloat(inv.Gross_Total || 0);
    const discountAmt = parseFloat(inv.Discount_Amount || 0);
    const net = parseFloat(inv.Net_Amount_Due || 0);

    document.getElementById('summary-gross').textContent = `₱${gross.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
    
    const discName = inv.Discount_Name || 'None';
    const discPct = parseFloat(inv.Discount_Percentage || 0);
    const discLabel = (discName !== 'None' && discPct > 0) 
        ? `${discName} - ${discPct.toFixed(2)}%` 
        : 'None (0.00%)';
    document.getElementById('discount-label').textContent = discLabel;
    document.getElementById('summary-discount').textContent = `-₱${discountAmt.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
    document.getElementById('summary-net').textContent = `₱${net.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

    // 5. Signatures
    document.getElementById('sig-cashier').textContent = inv.Cashier_Name || 'Billing Officer';
    document.getElementById('sig-patient').textContent = inv.Patient_Name || 'Patient / Authorized Representative';
}

function renderItemizedTable(items) {
    const container = document.getElementById('itemized-charges-container');

    if (!items || items.length === 0) {
        container.innerHTML = '<p><em>No charges were accumulated in this admission.</em></p>';
        return;
    }

    let html = '<table class="soa-table" style="margin-top: 6px;">';
    html += '<thead><tr class="header-row" style="background-color: #f1f5f9;">';
    html += '<th width="8%" style="text-align: center;">Item #</th>';
    html += '<th width="20%">Classification / Station</th>';
    html += '<th width="40%">Particulars & Description</th>';
    html += '<th width="8%" style="text-align: center;">Qty</th>';
    html += '<th width="12%" style="text-align: right;">Unit Price</th>';
    html += '<th width="12%" style="text-align: right;">Amount (₱)</th>';
    html += '</tr></thead><tbody>';

    items.forEach((row, idx) => {
        const isReturn = row.Transaction_Type === 'Return' || parseFloat(row.Total_Charge || 0) < 0;
        const total = Math.abs(parseFloat(row.Total_Charge || 0)).toLocaleString('en-PH', {minimumFractionDigits: 2});
        const unit = parseFloat(row.Unit_Price || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});

        const sign = isReturn ? '- ' : '';
        const rowStyle = isReturn ? 'style="background-color: #f0fdf4;"' : '';

        html += `<tr ${rowStyle}>`;
        html += `<td align="center">${idx + 1}</td>`;
        html += `<td><strong>${row.Category || 'Charge'}</strong><br><small style="color: #64748b;">${row.Station_Name || ''}</small></td>`;
        html += `<td>${row.Description || 'Item'}</td>`;
        html += `<td align="center">${parseFloat(row.Quantity || 1)}</td>`;
        html += `<td align="right">₱${unit}</td>`;
        html += `<td align="right"><strong>${sign}₱${total}</strong></td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}
