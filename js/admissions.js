const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allAdmissions = [];
let availableBeds = [];
let activePatients = [];
let activeDoctors = [];

const openChart = (admissionId) => {
    console.log("admissions.js: Navigating to admission chart ID:", admissionId);
    window.location.href = `admission_details.html?id=${admissionId}`;
};

window.openChart = openChart;

const dischargePatient = (admissionId, patientName) => {
    console.log("admissions.js: Initiating discharge for admission ID:", admissionId);

    const confirmed = confirm(`Are you sure you want to discharge patient "${patientName}" (Admission #${admissionId})?\n\nThis will close the active bed stay, automatically post the final Board & Lodging fee to their Billing Ledger, and release the bed for other patients.`);
    if (!confirmed) {
        return;
    }

    const formData = new FormData();
    formData.append('operation', 'dischargePatient');
    formData.append('json', JSON.stringify({ admission_id: admissionId }));

    axios.post(`${postApiUrl}/admissions.php`, formData)
        .then(response => {
            console.log("admissions.js: Discharge response:", response.data);
            if (response.data.success) {
                alert(response.data.message);
                loadBeds();
                loadPatients();
                loadAdmissions();
            } else {
                alert("Discharge Error: " + (response.data.error || "Unknown error"));
            }
        })
        .catch(err => {
            console.error("admissions.js: Error discharging patient:", err);
            alert("Network error discharging patient.");
        });
};

window.dischargePatient = dischargePatient;

const populatePatientDropdown = () => {
    const select = document.getElementById('patient_id');
    const query = (document.getElementById('patient_search_input')?.value || '').toLowerCase().trim();
    select.innerHTML = '<option value="">-- Select Patient --</option>';

    const filtered = activePatients.filter(p => {
        if (!query) return true;
        const text = `${p.Patient_Code || ''} ${p.Full_Name || ''} ${p.Gender_Name || ''} ${p.Blood_Type_Name || ''}`.toLowerCase();
        return text.includes(query);
    });

    if (filtered.length === 0) {
        select.innerHTML = '<option value="">No matching patients found</option>';
        return;
    }

    filtered.forEach(p => {
        const option = document.createElement('option');
        option.value = p.Patient_ID;
        const isAdmitted = (p.Active_Admission_ID !== null || p.Latest_Admission_Status === 'Admitted');

        let note = '';
        if (isAdmitted) {
            note = ' [Currently Admitted]';
            option.disabled = true;
        }

        option.textContent = `${p.Patient_Code} — ${p.Full_Name} (${p.Gender_Name || 'N/A'}, Blood: ${p.Blood_Type_Name || 'N/A'})${note}`;
        select.appendChild(option);
    });
};

const loadPatients = () => {
    console.log("admissions.js: Fetching active patients...");
    const formData = new FormData();
    formData.append('operation', 'getActivePatients');

    axios.post(`${getApiUrl}/admissions.php`, formData)
        .then(response => {
            console.log("admissions.js: Active patients received:", response.data);
            activePatients = response.data;
            populatePatientDropdown();
        })
        .catch(err => {
            console.error("admissions.js: Error fetching active patients:", err);
            alert("Failed to load active patients list.");
        });
};

const populateBedDropdown = () => {
    const select = document.getElementById('bed_id');
    const query = (document.getElementById('bed_search_input')?.value || '').toLowerCase().trim();
    select.innerHTML = '<option value="">-- Select Vacant Bed --</option>';

    if (availableBeds.length === 0) {
        select.innerHTML = '<option value="">No vacant beds available currently</option>';
        return;
    }

    const filtered = availableBeds.filter(b => {
        if (!query) return true;
        const text = `${b.Bed_Code || ''} ${b.Room_Name || ''} ${b.Room_Type || ''} ${b.Daily_Rate || ''}`.toLowerCase();
        return text.includes(query);
    });

    if (filtered.length === 0) {
        select.innerHTML = '<option value="">No matching beds found</option>';
        return;
    }

    filtered.forEach(b => {
        const option = document.createElement('option');
        option.value = b.Bed_ID;
        option.textContent = `Bed: ${b.Bed_Code} | Room: ${b.Room_Name} (${b.Room_Type}) — ₱${parseFloat(b.Daily_Rate).toLocaleString('en-PH', {minimumFractionDigits: 2})}/day`;
        select.appendChild(option);
    });
};

const loadBeds = () => {
    console.log("admissions.js: Fetching vacant beds...");
    const formData = new FormData();
    formData.append('operation', 'getAvailableBeds');

    axios.post(`${getApiUrl}/admissions.php`, formData)
        .then(response => {
            console.log("admissions.js: Vacant beds received:", response.data);
            availableBeds = response.data;
            populateBedDropdown();
        })
        .catch(err => {
            console.error("admissions.js: Error fetching vacant beds:", err);
            alert("Failed to load vacant beds.");
        });
};

const filterDoctorsCheckboxes = () => {
    const query = (document.getElementById('doctor_search_input')?.value || '').toLowerCase().trim();
    const rows = document.querySelectorAll('#doctors_container .doctor-row');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = (!query || text.includes(query)) ? '' : 'none';
    });
};

const populateDoctorsCheckboxes = () => {
    const container = document.getElementById('doctors_container');
    container.innerHTML = '';

    if (activeDoctors.length === 0) {
        container.innerHTML = '<em>No active physicians found in master file.</em>';
        return;
    }

    activeDoctors.forEach(d => {
        const div = document.createElement('div');
        div.className = 'doctor-row';
        div.style.marginBottom = '4px';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `doc_${d.Doctor_ID}`;
        checkbox.value = d.Doctor_ID;
        checkbox.className = 'doctor-checkbox';

        const label = document.createElement('label');
        label.htmlFor = `doc_${d.Doctor_ID}`;
        const specs = d.Specialties ? ` [${d.Specialties}]` : '';
        const fee = parseFloat(d.Base_Round_Fee).toLocaleString('en-PH', {minimumFractionDigits: 2});
        label.textContent = ` ${d.Full_Name} (${d.Doctor_Type}${specs}) — Base Round Fee: ₱${fee}`;

        div.appendChild(checkbox);
        div.appendChild(label);
        container.appendChild(div);
    });

    filterDoctorsCheckboxes();
};

const loadDoctors = () => {
    console.log("admissions.js: Fetching active physicians...");
    const formData = new FormData();
    formData.append('operation', 'getActiveDoctors');

    axios.post(`${getApiUrl}/admissions.php`, formData)
        .then(response => {
            console.log("admissions.js: Active physicians received:", response.data);
            activeDoctors = response.data;
            populateDoctorsCheckboxes();
        })
        .catch(err => {
            console.error("admissions.js: Error fetching active doctors:", err);
            alert("Failed to load physicians.");
        });
};

const renderAdmissionsTable = (admissions) => {
    const tableDiv = document.getElementById('table-div');

    if (!admissions || admissions.length === 0) {
        tableDiv.innerHTML = '<p><em>No admission records found matching criteria.</em></p>';
        return;
    }

    let html = '<table class="data-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Admission #</th>';
    html += '<th>Patient Code & Name</th>';
    html += '<th>Current Bed & Room</th>';
    html += '<th>Chief Complaint</th>';
    html += '<th>Clinical Diagnosis</th>';
    html += '<th>Assigned Physician(s)</th>';
    html += '<th>Admission Date</th>';
    html += '<th>Status</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    admissions.forEach(a => {
        const bedInfo = a.Bed_Code 
            ? `<strong>${a.Bed_Code}</strong> (${a.Room_Name || ''} - ${a.Room_Type || ''})<br><small class="text-muted">₱${parseFloat(a.Daily_Rate || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}/day</small>`
            : '<span class="text-muted">None / Discharged</span>';

        const doctors = a.Assigned_Doctors ? a.Assigned_Doctors.split('; ').join('<br>') : '<span class="text-muted">None</span>';

        let statusBadge = '<span class="badge badge-info">' + a.Status + '</span>';
        if (a.Status === 'Admitted') statusBadge = '<span class="badge badge-success">Admitted</span>';
        else if (a.Status === 'Discharged') statusBadge = '<span class="badge badge-warning">Discharged</span>';
        else if (a.Status === 'Billed') statusBadge = '<span class="badge badge-info">Billed / Settled</span>';

        const diagnosisBadge = a.Diagnosis 
            ? `<strong>${a.Diagnosis}</strong>` 
            : '<span class="badge badge-warning" style="font-size: 0.75rem;">Pending Dx</span>';

        html += `<tr class="clickable-row" onclick="openChart(${a.Admission_ID})" title="Click row to open clinical chart & ledger">`;
        html += `<td><strong>ADM-${String(a.Admission_ID).padStart(3, '0')}</strong></td>`;
        html += `<td><strong>${a.Patient_Code}</strong><br>${a.Patient_Name}<br><small class="text-muted">Contact: ${a.Contact_Number || 'N/A'}</small></td>`;
        html += `<td>${bedInfo}</td>`;
        html += `<td>${a.Chief_Complaint}</td>`;
        html += `<td>${diagnosisBadge}</td>`;
        html += `<td><small>${doctors}</small></td>`;
        html += `<td>${a.Admission_Date}</td>`;
        html += `<td>${statusBadge}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    tableDiv.innerHTML = html;
};

const filterAndRenderTable = () => {
    const query = document.getElementById('search_input').value.toLowerCase().trim();
    if (!query) {
        renderAdmissionsTable(allAdmissions);
        return;
    }

    const filtered = allAdmissions.filter(a => {
        return (a.Patient_Name && a.Patient_Name.toLowerCase().includes(query)) ||
               (a.Patient_Code && a.Patient_Code.toLowerCase().includes(query)) ||
               (a.Bed_Code && a.Bed_Code.toLowerCase().includes(query)) ||
               (a.Chief_Complaint && a.Chief_Complaint.toLowerCase().includes(query)) ||
               (a.Diagnosis && a.Diagnosis.toLowerCase().includes(query)) ||
               (a.Admission_ID && a.Admission_ID.toString().includes(query));
    });

    renderAdmissionsTable(filtered);
};

const loadAdmissions = () => {
    console.log("admissions.js: Loading admissions list...");
    const status = document.getElementById('filter_status').value;
    const search = document.getElementById('search_input').value;

    const formData = new FormData();
    formData.append('operation', 'getAllAdmissions');
    formData.append('json', JSON.stringify({ status: status, search: search }));

    axios.post(`${getApiUrl}/admissions.php`, formData)
        .then(response => {
            console.log("admissions.js: Admissions received:", response.data);
            allAdmissions = response.data;
            renderAdmissionsTable(allAdmissions);
        })
        .catch(err => {
            console.error("admissions.js: Error fetching admissions:", err);
            alert("Failed to load admissions.");
        });
};

const resetForm = () => {
    if (document.getElementById('patient_search_input')) document.getElementById('patient_search_input').value = '';
    if (document.getElementById('bed_search_input')) document.getElementById('bed_search_input').value = '';
    if (document.getElementById('doctor_search_input')) document.getElementById('doctor_search_input').value = '';

    document.getElementById('patient_id').value = '';
    document.getElementById('chief_complaint').value = '';
    if (document.getElementById('diagnosis')) document.getElementById('diagnosis').value = '';
    document.getElementById('bed_id').value = '';
    const checkedBoxes = document.querySelectorAll('.doctor-checkbox:checked');
    checkedBoxes.forEach(cb => cb.checked = false);

    populatePatientDropdown();
    populateBedDropdown();
    filterDoctorsCheckboxes();
};

const submitAdmission = () => {
    console.log("admissions.js: Processing admission submission...");

    const patientId = document.getElementById('patient_id').value;
    const chiefComplaint = document.getElementById('chief_complaint').value.trim();
    const diagnosis = document.getElementById('diagnosis') ? document.getElementById('diagnosis').value.trim() : '';
    const bedId = document.getElementById('bed_id').value;

    if (!patientId) {
        alert("Please select a registered patient.");
        return;
    }

    if (!chiefComplaint) {
        alert("Please enter the Chief Complaint.");
        return;
    }

    if (!bedId) {
        alert("Please assign a vacant bed.");
        return;
    }

    const checkedBoxes = document.querySelectorAll('.doctor-checkbox:checked');
    const doctorIds = Array.from(checkedBoxes).map(cb => cb.value);

    if (doctorIds.length === 0) {
        alert("Please assign at least one attending or resident physician.");
        return;
    }

    const payload = {
        patient_id: patientId,
        chief_complaint: chiefComplaint,
        diagnosis: diagnosis,
        bed_id: bedId,
        doctor_ids: doctorIds
    };

    console.log("admissions.js: Submitting payload:", payload);

    const formData = new FormData();
    formData.append('operation', 'admitPatient');
    formData.append('json', JSON.stringify(payload));

    axios.post(`${postApiUrl}/admissions.php`, formData)
        .then(response => {
            console.log("admissions.js: Response from admitPatient:", response.data);
            if (response.data.success) {
                closeModal();
                alert(response.data.message);
                resetForm();
                loadBeds();
                loadPatients();
                loadAdmissions();
                if (confirm("Patient admitted! Would you like to open their clinical chart and ledger now?")) {
                    openChart(response.data.admission_id);
                }
            } else {
                alert("Admission Error: " + (response.data.error || "Unknown error occurred."));
            }
        })
        .catch(err => {
            console.error("admissions.js: Error admitting patient:", err);
            alert("Network or server error while admitting patient.");
        });
};

window.addEventListener('DOMContentLoaded', () => {
    console.log("admissions.js: Initializing In-Patient Admissions view...");

    const userJson = sessionStorage.getItem("hospital_user");
    if (!userJson) {
        console.warn("admissions.js: Unauthenticated session. Redirecting to login.");
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
            console.log("admissions.js: Logging out...");
            sessionStorage.removeItem("hospital_user");
            window.location.href = "login.html";
        });
    }

    initModalControls("formModal", "btnOpenAddModal", "btnCloseModal", "btnCancel", resetForm);
    document.getElementById('btnSubmitAdmit').addEventListener('click', submitAdmission);
    document.getElementById('btnRefresh').addEventListener('click', () => {
        loadBeds();
        loadPatients();
        loadAdmissions();
    });

    document.getElementById('search_input').addEventListener('input', () => {
        filterAndRenderTable();
    });

    document.getElementById('filter_status').addEventListener('change', () => {
        loadAdmissions();
    });

    const patSearch = document.getElementById('patient_search_input');
    if (patSearch) {
        patSearch.addEventListener('input', populatePatientDropdown);
    }

    const bedSearch = document.getElementById('bed_search_input');
    if (bedSearch) {
        bedSearch.addEventListener('input', populateBedDropdown);
    }

    const docSearch = document.getElementById('doctor_search_input');
    if (docSearch) {
        docSearch.addEventListener('input', filterDoctorsCheckboxes);
    }

    loadPatients();
    loadBeds();
    loadDoctors();
    loadAdmissions();
});
