const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allInvoices = [];

window.addEventListener('DOMContentLoaded', () => {
    console.log("invoices.js: Initializing Invoices view...");

    const userJson = sessionStorage.getItem("hospital_user");
    if (!userJson) {
        console.warn("invoices.js: Unauthenticated session. Redirecting to login.");
        window.location.href = "login.html";
        return;
    }

    const currentUser = JSON.parse(userJson);
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
        userDisplay.textContent = `${currentUser.full_name || currentUser.username} (${currentUser.role_name || 'Staff'})`;
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            console.log("invoices.js: Logging out...");
            sessionStorage.removeItem("hospital_user");
            window.location.href = "login.html";
        });
    }

    document.getElementById('search_input').addEventListener('input', filterAndRenderInvoices);
    document.getElementById('btnRefresh').addEventListener('click', loadInvoices);

    loadInvoices();
});

function loadInvoices() {
    console.log("invoices.js: Fetching all settled invoices...");

    const formData = new FormData();
    formData.append('operation', 'getAllInvoices');

    axios.post(`${getApiUrl}/invoices.php`, formData)
        .then(response => {
            console.log("invoices.js: Invoices received:", response.data);
            allInvoices = response.data || [];
            filterAndRenderInvoices();
        })
        .catch(err => {
            console.error("invoices.js: Error fetching invoices:", err);
            alert("Failed to load invoices.");
        });
}

function filterAndRenderInvoices() {
    const query = document.getElementById('search_input').value.toLowerCase().trim();

    if (!query) {
        renderInvoicesTable(allInvoices);
        return;
    }

    const filtered = allInvoices.filter(inv => {
        return (inv.Patient_Name && inv.Patient_Name.toLowerCase().includes(query)) ||
               (inv.Invoice_Code && inv.Invoice_Code.toLowerCase().includes(query)) ||
               (inv.Admission_Code && inv.Admission_Code.toLowerCase().includes(query)) ||
               (inv.Cashier_Name && inv.Cashier_Name.toLowerCase().includes(query));
    });

    renderInvoicesTable(filtered);
}

function renderInvoicesTable(invoices) {
    const tableDiv = document.getElementById('table-div');

    if (!invoices || invoices.length === 0) {
        tableDiv.innerHTML = '<p><em>No settled invoices found matching criteria.</em></p>';
        return;
    }

    let html = '<table class="data-table">';
    html += '<thead><tr>';
    html += '<th>Invoice #</th>';
    html += '<th>Admission #</th>';
    html += '<th>Patient Code & Name</th>';
    html += '<th>Gross Charges</th>';
    html += '<th>Applied Discount</th>';
    html += '<th>Discount Amount</th>';
    html += '<th>Net Amount Settled</th>';
    html += '<th>Settlement Date</th>';
    html += '<th>Cashier / Billed By</th>';
    html += '<th>Actions</th>';
    html += '</tr></thead><tbody>';

    invoices.forEach(inv => {
        const gross = parseFloat(inv.Gross_Total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
        const discAmt = parseFloat(inv.Discount_Amount || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
        const net = parseFloat(inv.Net_Amount_Due || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});

        const discBadge = inv.Discount_Name !== 'None' 
            ? `<span class="badge badge-info">${inv.Discount_Name} (${parseFloat(inv.Discount_Percentage).toFixed(0)}%)</span>` 
            : '<span class="text-muted">None</span>';

        html += '<tr>';
        html += `<td><strong>${inv.Invoice_Code}</strong></td>`;
        html += `<td><strong>${inv.Admission_Code}</strong></td>`;
        html += `<td><strong>${inv.Patient_Code}</strong><br>${inv.Patient_Name}</td>`;
        html += `<td>₱${gross}</td>`;
        html += `<td>${discBadge}</td>`;
        html += `<td style="color: #276749;">-₱${discAmt}</td>`;
        html += `<td><strong style="color: var(--primary-color);">₱${net}</strong></td>`;
        html += `<td>${inv.Settlement_Date}</td>`;
        html += `<td>${inv.Cashier_Name}</td>`;
        html += '<td>';
        html += `<button type="button" class="btn btn-sm btn-primary" onclick="viewPrintInvoice(${inv.Invoice_ID})">View / Print SOA</button>`;
        html += '</td>';
        html += '</tr>';
    });

    html += '</tbody></table>';
    tableDiv.innerHTML = html;
}

window.viewPrintInvoice = function(invoiceId) {
    console.log("invoices.js: Navigating to print view for Invoice ID:", invoiceId);
    window.location.href = `invoice_print.html?id=${invoiceId}`;
};
