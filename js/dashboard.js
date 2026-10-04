const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

const renderRecentAdmissions = (admissions) => {
    const container = document.getElementById('recent-admissions-container');
    if (!container) return;

    if (!admissions || admissions.length === 0) {
        container.innerHTML = '<p style="padding: 20px; color: var(--text-muted);"><em>No in-patients are currently admitted in the hospital.</em></p>';
        return;
    }

    let html = '<table class="data-table">';
    html += '<thead><tr>';
    html += '<th>Admission #</th>';
    html += '<th>Patient Code & Name</th>';
    html += '<th>Assigned Bed & Room</th>';
    html += '<th>Chief Complaint</th>';
    html += '<th>Assigned Physician(s)</th>';
    html += '<th>Admission Date</th>';
    html += '<th align="center">Actions</th>';
    html += '</tr></thead><tbody>';

    admissions.slice(0, 5).forEach(a => {
        const bedInfo = a.Bed_Code 
            ? `<strong>${a.Bed_Code}</strong> (${a.Room_Name} - ${a.Room_Type})` 
            : 'Unassigned';

        html += '<tr>';
        html += `<td align="center"><strong>ADM-${String(a.Admission_ID).padStart(3, '0')}</strong></td>`;
        html += `<td><strong>${a.Patient_Code}</strong><br>${a.Patient_Name}</td>`;
        html += `<td>${bedInfo}</td>`;
        html += `<td>${a.Chief_Complaint}<br><small style="color: #0369a1;"><strong>Dx:</strong> ${a.Diagnosis || '<em class="text-muted">Pending</em>'}</small></td>`;
        html += `<td><small>${a.Assigned_Doctors || 'None Assigned'}</small></td>`;
        html += `<td>${a.Admission_Date}</td>`;
        html += `<td align="center">`;
        html += `<a href="admission_details.html?id=${a.Admission_ID}" class="btn btn-sm btn-primary">Open Chart & Ledger</a>`;
        html += `</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
};

const updateBedGauge = (beds) => {
    const activeBeds = (beds || []).filter(b => b.Is_Active == 1);
    const totalBeds = activeBeds.length;
    const occupiedBeds = activeBeds.filter(b => b.Is_Available == 0).length;
    const vacantBeds = activeBeds.filter(b => b.Is_Available == 1).length;
    const occPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    const elTotal = document.getElementById('gauge-total-beds');
    if (elTotal) elTotal.textContent = totalBeds;

    const elOcc = document.getElementById('gauge-occupied-beds');
    if (elOcc) elOcc.textContent = occupiedBeds;

    const elVac = document.getElementById('gauge-vacant-beds');
    if (elVac) elVac.textContent = vacantBeds;

    const elSummary = document.getElementById('occupancy-summary-text');
    if (elSummary) elSummary.textContent = `${occupiedBeds} of ${totalBeds} Beds in Active Use`;

    const elPct = document.getElementById('occupancy-pct-text');
    if (elPct) elPct.textContent = `${occPct}% Capacity`;

    const elBadge = document.getElementById('occupancy-rate-badge');
    if (elBadge) {
        elBadge.textContent = `${occPct}% Occupied`;
        elBadge.className = occPct >= 90 ? 'badge badge-danger' : (occPct >= 70 ? 'badge badge-warning' : 'badge badge-success');
    }

    const progressBar = document.getElementById('occupancy-progress-bar');
    if (progressBar) {
        progressBar.style.width = `${occPct}%`;
        progressBar.className = 'occupancy-progress-bar ' + (occPct >= 90 ? 'high' : (occPct >= 70 ? 'medium' : 'low'));
    }
};

const updateFinancialHealth = (invoices) => {
    const invList = invoices || [];
    const totalInvoiced = invList.reduce((sum, inv) => sum + parseFloat(inv.Net_Amount_Due || 0), 0);
    const totalCollected = invList.reduce((sum, inv) => sum + parseFloat(inv.Amount_Paid || 0), 0);
    const totalAR = invList.reduce((sum, inv) => sum + parseFloat(inv.Remaining_Balance || 0), 0);

    const activePNs = invList.filter(inv => inv.Promissory_Note_ID && inv.Promissory_Status === 'Active' && parseFloat(inv.Remaining_Balance || 0) > 0);
    const pnCount = activePNs.length;
    const pnBal = activePNs.reduce((sum, inv) => sum + parseFloat(inv.Remaining_Balance || 0), 0);

    const todayStr = new Date().toISOString().slice(0, 10);
    const overduePNs = activePNs.filter(inv => inv.Promissory_Next_Due_Date && inv.Promissory_Next_Due_Date < todayStr);

    const elCollections = document.getElementById('stat-total-collections');
    if (elCollections) elCollections.textContent = `₱${totalCollected.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

    const elAR = document.getElementById('stat-total-ar');
    if (elAR) elAR.textContent = `₱${totalAR.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

    const elInvoiced = document.getElementById('health-invoiced-total');
    if (elInvoiced) elInvoiced.textContent = `₱${totalInvoiced.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

    const elPNCount = document.getElementById('health-pn-count');
    if (elPNCount) elPNCount.textContent = `${pnCount} Note${pnCount === 1 ? '' : 's'}`;

    const elStatusBadge = document.getElementById('ar-status-badge');
    if (elStatusBadge) {
        if (totalAR <= 0) {
            elStatusBadge.className = 'badge badge-success';
            elStatusBadge.textContent = '100% Settled';
        } else if (overduePNs.length > 0) {
            elStatusBadge.className = 'badge badge-danger';
            elStatusBadge.textContent = `${overduePNs.length} Overdue`;
        } else {
            elStatusBadge.className = 'badge badge-warning';
            elStatusBadge.textContent = `${pnCount} Active PN`;
        }
    }

    const alertBanner = document.getElementById('ar-alert-banner');
    const alertText = document.getElementById('ar-alert-text');
    if (alertBanner && alertText) {
        if (overduePNs.length > 0) {
            alertBanner.className = 'ar-alert-banner has-overdue';
            alertText.innerHTML = `<strong>Attention Required:</strong> ${overduePNs.length} Promissory Note payment${overduePNs.length === 1 ? ' is' : 's are'} past due. Outstanding balance: ₱${pnBal.toLocaleString('en-PH', {minimumFractionDigits: 2})}.`;
        } else if (pnCount > 0) {
            alertBanner.className = 'ar-alert-banner';
            alertText.innerHTML = `<strong>Active Agreements:</strong> ${pnCount} patient installment plan${pnCount === 1 ? '' : 's'} active with ₱${pnBal.toLocaleString('en-PH', {minimumFractionDigits: 2})} scheduled balance.`;
        } else if (totalAR > 0) {
            alertBanner.className = 'ar-alert-banner';
            alertText.innerHTML = `<strong>Unsettled Invoices:</strong> Outstanding receivables total ₱${totalAR.toLocaleString('en-PH', {minimumFractionDigits: 2})}.`;
        } else {
            alertBanner.className = 'ar-alert-banner';
            alertBanner.style.background = '#f0fdf4';
            alertBanner.style.borderColor = '#bbf7d0';
            alertBanner.style.color = '#166534';
            alertText.innerHTML = `<strong>Healthy Cash Flow:</strong> All issued hospitalization invoices have been settled in full.`;
        }
    }
};

const loadDashboardMetrics = async () => {
    try {
        const admForm = new FormData();
        admForm.append('operation', 'getAllAdmissions');
        admForm.append('json', JSON.stringify({ status: 'Admitted' }));
        const admPromise = axios.post(`${getApiUrl}/admissions.php`, admForm);

        const bedForm = new FormData();
        bedForm.append('operation', 'getAllBeds');
        const bedPromise = axios.post(`${getApiUrl}/rooms.php`, bedForm);

        const invForm = new FormData();
        invForm.append('operation', 'getAllInvoices');
        const invPromise = axios.post(`${getApiUrl}/invoices.php`, invForm);

        const [admRes, bedRes, invRes] = await Promise.all([admPromise, bedPromise, invPromise]);

        const activeAdmissions = admRes.data || [];
        const allBeds = bedRes.data || [];
        const invoices = invRes.data || [];

        const activeBeds = allBeds.filter(b => b.Is_Active == 1);
        const vacantBeds = activeBeds.filter(b => b.Is_Available == 1);

        const elAdm = document.getElementById('stat-active-admissions');
        if (elAdm) elAdm.textContent = activeAdmissions.length;

        const elBeds = document.getElementById('stat-available-beds');
        if (elBeds) elBeds.textContent = vacantBeds.length;

        renderRecentAdmissions(activeAdmissions);
        updateBedGauge(allBeds);
        updateFinancialHealth(invoices);

    } catch (err) {
        console.error("dashboard.js: Error fetching KPI metrics:", err);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const userJson = sessionStorage.getItem("hospital_user");
    if (!userJson) {
        window.location.href = "login.html";
        return;
    }

    const user = JSON.parse(userJson);
    const userDisplay = document.getElementById("user-display");
    if (userDisplay) {
        userDisplay.textContent = `${user.full_name || user.username} (${user.role_name || 'Staff'})`;
    }
    
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn && !logoutBtn.dataset.wired) {
        logoutBtn.dataset.wired = "true";
        logoutBtn.addEventListener("click", () => {
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

    loadDashboardMetrics();
});
