/**
 * Official Statement of Account / Invoice Print Controller
 * Milestone 3: Financial Settlement & Statements of Account (SOA)
 */

window.addEventListener('DOMContentLoaded', () => {
    console.log("invoice_print.js: Initializing printable Statement of Account...");

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

    axios.post('../api/invoices.php', formData)
        .then(response => {
            console.log("invoice_print.js: Invoice data received:", response.data);
            if (response.data.error) {
                alert("Error loading invoice: " + response.data.error);
                window.location.href = "invoices.html";
                return;
            }

            renderInvoice(response.data);

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
    document.getElementById('inv-code').textContent = inv.Invoice_Code;
    document.getElementById('inv-settlement-date').textContent = inv.Settlement_Date;
    document.getElementById('inv-admission-code').textContent = inv.Admission_Code;
    document.getElementById('inv-admission-date').textContent = inv.Admission_Date;
    document.getElementById('inv-stay-days').textContent = inv.Length_Of_Stay_Days;
    document.getElementById('inv-cashier').textContent = `${inv.Cashier_Name} (${inv.Cashier_Role})`;

    // 2. Patient Demographics
    document.getElementById('patient-name').textContent = inv.Patient_Name;
    document.getElementById('patient-code').textContent = inv.Patient_Code;
    document.getElementById('patient-age').textContent = `${inv.Date_Of_Birth} (${inv.Age} years old)`;
    document.getElementById('patient-gender-blood').textContent = `${inv.Gender_Name || 'N/A'} / Blood: ${inv.Blood_Type_Name || 'N/A'}`;
    document.getElementById('patient-contact').textContent = inv.Contact_Number || 'N/A';
    document.getElementById('patient-address').textContent = inv.Address || 'N/A';
    document.getElementById('patient-emergency').textContent = `${inv.Emergency_Contact_Name || 'N/A'} (${inv.Emergency_Contact_Number || 'N/A'})`;
    document.getElementById('patient-complaint').textContent = inv.Chief_Complaint;

    // Assigned Physicians
    const doctors = inv.Attending_Doctors || [];
    if (doctors.length > 0) {
        const docText = doctors.map(d => `${d.Doctor_Name} (${d.Doctor_Type}${d.Specialties ? ' - ' + d.Specialties : ''})`).join('; ');
        document.getElementById('patient-doctors').textContent = docText;
        document.getElementById('sig-doctor').textContent = doctors[0].Doctor_Name;
    } else {
        document.getElementById('patient-doctors').textContent = 'None Recorded';
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
    
    const discLabel = inv.Discount_Name !== 'None' 
        ? `${inv.Discount_Name} - ${parseFloat(inv.Discount_Percentage).toFixed(2)}%` 
        : 'None (0.00%)';
    document.getElementById('discount-label').textContent = discLabel;
    document.getElementById('summary-discount').textContent = `-₱${discountAmt.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
    document.getElementById('summary-net').textContent = `₱${net.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

    // 5. Signatures
    document.getElementById('sig-cashier').textContent = inv.Cashier_Name;
    document.getElementById('sig-patient').textContent = inv.Patient_Name;
}

function renderItemizedTable(items) {
    const container = document.getElementById('itemized-charges-container');

    if (!items || items.length === 0) {
        container.innerHTML = '<p><em>No charges were accumulated in this admission.</em></p>';
        return;
    }

    let html = '<table border="1" cellpadding="5" cellspacing="0" width="100%">';
    html += '<thead><tr bgcolor="#f2f2f2">';
    html += '<th width="8%">Item #</th>';
    html += '<th width="18%">Classification / Station</th>';
    html += '<th width="42%">Particulars & Description</th>';
    html += '<th width="8%" align="center">Qty</th>';
    html += '<th width="12%" align="right">Unit Price</th>';
    html += '<th width="12%" align="right">Amount (₱)</th>';
    html += '</tr></thead><tbody>';

    items.forEach((row, idx) => {
        const isReturn = row.Transaction_Type === 'Return' || parseFloat(row.Total_Charge) < 0;
        const total = Math.abs(parseFloat(row.Total_Charge)).toLocaleString('en-PH', {minimumFractionDigits: 2});
        const unit = parseFloat(row.Unit_Price).toLocaleString('en-PH', {minimumFractionDigits: 2});

        const sign = isReturn ? '- ' : '';
        const highlight = isReturn ? 'bgcolor="#f0fff0"' : '';

        html += `<tr ${highlight}>`;
        html += `<td align="center">${idx + 1}</td>`;
        html += `<td><strong>${row.Category}</strong><br><small>${row.Station_Name}</small></td>`;
        html += `<td>${row.Description}</td>`;
        html += `<td align="center">${parseFloat(row.Quantity)}</td>`;
        html += `<td align="right">₱${unit}</td>`;
        html += `<td align="right"><strong>${sign}₱${total}</strong></td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}
