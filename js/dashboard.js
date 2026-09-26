/**
 * Hospital Dashboard Controller
 * Loads KPI metrics, active admissions snapshot, and handles session/logout
 */

const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

document.addEventListener("DOMContentLoaded", () => {
    // 1. Session Verification
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
    
    // 2. Attach Logout
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to log out?")) {
                sessionStorage.removeItem("hospital_user");
                window.location.href = "login.html";
            }
        });
    }

    // 3. Load Dashboard Data & KPIs
    loadDashboardMetrics();
});

async function loadDashboardMetrics() {
    console.log("dashboard.js: Fetching dashboard KPI metrics...");

    try {
        // Fetch Active Admissions
        const admForm = new FormData();
        admForm.append('operation', 'getAllAdmissions');
        admForm.append('json', JSON.stringify({ status: 'Admitted' }));
        const admPromise = axios.post(`${getApiUrl}/admissions.php`, admForm);

        // Fetch Vacant Beds
        const bedForm = new FormData();
        bedForm.append('operation', 'getAvailableBeds');
        const bedPromise = axios.post(`${getApiUrl}/admissions.php`, bedForm);

        // Fetch Patients
        const patForm = new FormData();
        patForm.append('operation', 'getAllPatients');
        const patPromise = axios.post(`${getApiUrl}/patients.php`, patForm);

        // Fetch Invoices
        const invForm = new FormData();
        invForm.append('operation', 'getAllInvoices');
        const invPromise = axios.post(`${getApiUrl}/invoices.php`, invForm);

        const [admRes, bedRes, patRes, invRes] = await Promise.all([admPromise, bedPromise, patPromise, invPromise]);

        // Update Stat Cards
        const activeAdmissions = admRes.data || [];
        const availableBeds = bedRes.data || [];
        const patients = patRes.data || [];
        const invoices = invRes.data || [];

        document.getElementById('stat-active-admissions').textContent = activeAdmissions.length;
        document.getElementById('stat-available-beds').textContent = availableBeds.length;
        document.getElementById('stat-total-patients').textContent = patients.length;
        document.getElementById('stat-total-invoices').textContent = invoices.length;

        // Render Recent Active Admissions Table
        renderRecentAdmissions(activeAdmissions);

    } catch (err) {
        console.error("dashboard.js: Error fetching KPI metrics:", err);
    }
}

function renderRecentAdmissions(admissions) {
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
}
