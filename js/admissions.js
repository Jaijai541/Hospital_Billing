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

    showPopupConfirm(`Are you sure you want to discharge patient "${patientName}" (Admission #${admissionId})?\n\nThis will close the active bed stay, automatically post the final Board & Lodging fee to their Billing Ledger, and release the bed for other patients.`, () => {
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
    }, null, {
        title: "Confirm Clinical Discharge",
        confirmText: "Discharge Patient",
        type: "warning"
    });
};

window.dischargePatient = dischargePatient;

const loadPatients = async () => {
    try {
        const formData = new FormData();
        formData.append('operation', 'getActivePatients');
        const response = await axios.post(`${getApiUrl}/admissions.php`, formData);
        if (response.data) {
            activePatients = response.data;
        }
    } catch (err) {
        console.error("admissions.js: Error fetching active patients:", err);
    }
};

const loadBeds = async () => {
    try {
        const formData = new FormData();
        formData.append('operation', 'getAvailableBeds');
        const response = await axios.post(`${getApiUrl}/admissions.php`, formData);
        if (response.data) {
            availableBeds = response.data;
        }
    } catch (err) {
        console.error("admissions.js: Error fetching vacant beds:", err);
    }
};

const loadDoctors = async () => {
    try {
        const formData = new FormData();
        formData.append('operation', 'getActiveDoctors');
        const response = await axios.post(`${getApiUrl}/admissions.php`, formData);
        if (response.data) {
            activeDoctors = response.data;
        }
    } catch (err) {
        console.error("admissions.js: Error fetching active doctors:", err);
    }
};

const openPatientPicker = async () => {
    if (!activePatients || activePatients.length === 0) {
        await loadPatients();
    }
    openGenericLookupPicker({
        title: "Select Registered Patient",
        items: activePatients.map(p => {
            const isAdmitted = (p.Active_Admission_ID !== null || p.Latest_Admission_Status === "Admitted");
            return {
                id: p.Patient_ID,
                text: `${p.Patient_Code} — ${p.Full_Name}`,
                subtext: `Gender: ${p.Gender_Name || "N/A"} | Blood Type: ${p.Blood_Type_Name || "N/A"}${p.Date_Of_Birth ? ` | DOB: ${p.Date_Of_Birth}` : ""}${isAdmitted ? " (Currently Admitted in hospital bed)" : ""}`,
                disabled: isAdmitted,
                badge: isAdmitted ? "Admitted" : "Available",
                badgeClass: isAdmitted ? "badge-danger" : "badge-success"
            };
        }),
        selectedId: document.getElementById("patient_id") ? document.getElementById("patient_id").value : "",
        onSelect: (item) => {
            const pId = document.getElementById("patient_id");
            if (pId) pId.value = item.id;
            const pText = document.getElementById("patient_id_text");
            if (pText) pText.value = item.text;
        }
    });
};

const openBedPicker = async () => {
    if (!availableBeds || availableBeds.length === 0) {
        await loadBeds();
    }

    const classifications = [...new Set(availableBeds.map(b => b.Room_Type).filter(Boolean))].sort((a, b) => a.localeCompare(b));

    const sortOptions = [
        { value: "classification_asc", label: "Classification (A–Z)" },
        { value: "classification_desc", label: "Classification (Z–A)" },
        { value: "rate_asc", label: "Rate (Low to High)" },
        { value: "rate_desc", label: "Rate (High to Low)" },
        { value: "bed_asc", label: "Bed Code (A–Z)" },
        { value: "bed_desc", label: "Bed Code (Z–A)" },
        { value: "selected_first", label: "Selected First" }
    ];

    const filterOptions = [
        { value: "all", label: "All Classifications" },
        ...classifications.map(c => ({ value: `type_${c}`, label: c })),
        { value: "selected", label: "Selected Bed" }
    ];

    const customFilter = (item, filterVal, selectedId) => {
        if (filterVal === "all") return true;
        if (filterVal === "selected") return String(item.id) === String(selectedId);
        if (filterVal.startsWith("type_")) {
            const targetType = filterVal.replace("type_", "");
            return item.classification === targetType;
        }
        return true;
    };

    const customSort = (list, sortVal, selectedId) => {
        const arr = [...list];
        if (sortVal === "classification_asc") {
            arr.sort((a, b) => {
                const comp = (a.classification || "").localeCompare(b.classification || "");
                if (comp !== 0) return comp;
                return (a.bedCode || "").localeCompare(b.bedCode || "", undefined, { numeric: true, sensitivity: "base" });
            });
        } else if (sortVal === "classification_desc") {
            arr.sort((a, b) => {
                const comp = (b.classification || "").localeCompare(a.classification || "");
                if (comp !== 0) return comp;
                return (a.bedCode || "").localeCompare(b.bedCode || "", undefined, { numeric: true, sensitivity: "base" });
            });
        } else if (sortVal === "rate_asc") {
            arr.sort((a, b) => {
                const diff = (a.dailyRate || 0) - (b.dailyRate || 0);
                if (diff !== 0) return diff;
                return (a.bedCode || "").localeCompare(b.bedCode || "", undefined, { numeric: true, sensitivity: "base" });
            });
        } else if (sortVal === "rate_desc") {
            arr.sort((a, b) => {
                const diff = (b.dailyRate || 0) - (a.dailyRate || 0);
                if (diff !== 0) return diff;
                return (a.bedCode || "").localeCompare(b.bedCode || "", undefined, { numeric: true, sensitivity: "base" });
            });
        } else if (sortVal === "bed_asc") {
            arr.sort((a, b) => (a.bedCode || "").localeCompare(b.bedCode || "", undefined, { numeric: true, sensitivity: "base" }));
        } else if (sortVal === "bed_desc") {
            arr.sort((a, b) => (b.bedCode || "").localeCompare(a.bedCode || "", undefined, { numeric: true, sensitivity: "base" }));
        } else if (sortVal === "selected_first") {
            arr.sort((a, b) => {
                const aSel = String(a.id) === String(selectedId) ? 1 : 0;
                const bSel = String(b.id) === String(selectedId) ? 1 : 0;
                if (aSel !== bSel) return bSel - aSel;
                const comp = (a.classification || "").localeCompare(b.classification || "");
                if (comp !== 0) return comp;
                return (a.bedCode || "").localeCompare(b.bedCode || "", undefined, { numeric: true, sensitivity: "base" });
            });
        }
        return arr;
    };

    openGenericLookupPicker({
        title: "Assign Vacant Bed",
        items: availableBeds.map(b => ({
            id: b.Bed_ID,
            text: `Bed ${b.Bed_Code} — ${b.Room_Name}`,
            subtext: `Classification: ${b.Room_Type} | Board & Lodging: ₱${parseFloat(b.Daily_Rate || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}/day`,
            classification: b.Room_Type,
            bedCode: b.Bed_Code,
            roomName: b.Room_Name,
            dailyRate: parseFloat(b.Daily_Rate || 0),
            badge: b.Room_Type,
            badgeClass: "badge-info"
        })),
        sortOptions: sortOptions,
        filterOptions: filterOptions,
        defaultSort: "classification_asc",
        defaultFilter: "all",
        customSort: customSort,
        customFilter: customFilter,
        selectedId: document.getElementById("bed_id") ? document.getElementById("bed_id").value : "",
        onSelect: (item) => {
            const bId = document.getElementById("bed_id");
            if (bId) bId.value = item.id;
            const bText = document.getElementById("bed_id_text");
            if (bText) bText.value = `${item.text} (${item.classification}) — ₱${item.dailyRate.toLocaleString("en-PH", { minimumFractionDigits: 2 })}/day`;
        }
    });
};

let selectedDoctorIds = [];
let tempSelectedDoctorIds = [];
let currentFilteredDoctors = [];

const updateDoctorsText = () => {
    const txt = document.getElementById("selected_doctors_text");
    if (!txt) return;
    if (selectedDoctorIds.length === 0) {
        txt.value = "";
        return;
    }
    const names = selectedDoctorIds.map(id => {
        const d = activeDoctors.find(doc => String(doc.Doctor_ID) === String(id));
        return d ? d.Full_Name : `Doctor #${id}`;
    });
    txt.value = names.join("; ");
};

const openDoctorPicker = async () => {
    if (!activeDoctors || activeDoctors.length === 0) {
        await loadDoctors();
    }
    tempSelectedDoctorIds = [...selectedDoctorIds];

    const searchInput = document.getElementById("doctor_picker_search");
    if (searchInput) searchInput.value = "";

    const filterSelect = document.getElementById("doctor_picker_filter");
    if (filterSelect) filterSelect.value = "all";

    const sortSelect = document.getElementById("doctor_picker_sort");
    if (sortSelect) sortSelect.value = "name_asc";

    renderDoctorPickerRows();

    const pickerModal = document.getElementById("doctorPickerModal");
    if (pickerModal) {
        pickerModal.classList.add("active");
        pickerModal.style.display = "flex";
        setTimeout(() => {
            if (searchInput) searchInput.focus();
        }, 50);
    }
};

const closeDoctorPicker = () => {
    const pickerModal = document.getElementById("doctorPickerModal");
    if (pickerModal) {
        pickerModal.classList.remove("active");
        pickerModal.style.display = "none";
    }
    tempSelectedDoctorIds = [];
};

const confirmDoctorPicker = () => {
    selectedDoctorIds = [...tempSelectedDoctorIds];
    updateDoctorsText();
    closeDoctorPicker();
};

const togglePickerDoctor = (docId) => {
    docId = String(docId);
    const index = tempSelectedDoctorIds.indexOf(docId);
    if (index > -1) {
        tempSelectedDoctorIds.splice(index, 1);
    } else {
        tempSelectedDoctorIds.push(docId);
    }

    const row = document.querySelector(`#doctor_picker_tbody tr[data-id="${docId}"]`);
    if (row) {
        const isNowSelected = tempSelectedDoctorIds.includes(docId);
        const cb = row.querySelector(".doctor-picker-cb");
        if (cb) cb.checked = isNowSelected;
        if (isNowSelected) {
            row.classList.add("selected-row");
        } else {
            row.classList.remove("selected-row");
        }
    }

    const selectAllCb = document.getElementById("doctor_picker_select_all");
    if (selectAllCb && currentFilteredDoctors.length > 0) {
        const allVisibleSelected = currentFilteredDoctors.every(d => tempSelectedDoctorIds.includes(String(d.Doctor_ID)));
        const someVisibleSelected = currentFilteredDoctors.some(d => tempSelectedDoctorIds.includes(String(d.Doctor_ID)));
        selectAllCb.checked = allVisibleSelected;
        selectAllCb.indeterminate = (!allVisibleSelected && someVisibleSelected);
    }

    const statusMsg = document.getElementById("doctor_picker_status");
    if (statusMsg) {
        const count = tempSelectedDoctorIds.length;
        statusMsg.textContent = count === 0 ? "No physicians selected" : `${count} physician${count === 1 ? "" : "s"} selected`;
    }
};

const toggleSelectAllPickerDoctors = (checked) => {
    currentFilteredDoctors.forEach(d => {
        const docId = String(d.Doctor_ID);
        const idx = tempSelectedDoctorIds.indexOf(docId);
        if (checked) {
            if (idx === -1) tempSelectedDoctorIds.push(docId);
        } else {
            if (idx > -1) tempSelectedDoctorIds.splice(idx, 1);
        }
    });
    renderDoctorPickerRows();
};

const renderDoctorPickerRows = () => {
    const searchInput = document.getElementById("doctor_picker_search");
    const query = (searchInput ? searchInput.value : "").trim().toLowerCase();
    const filterSelect = document.getElementById("doctor_picker_filter");
    const filterVal = filterSelect ? filterSelect.value : "all";
    const sortSelect = document.getElementById("doctor_picker_sort");
    const sortBy = sortSelect ? sortSelect.value : "name_asc";

    const tbody = document.getElementById("doctor_picker_tbody");
    const emptyMsg = document.getElementById("doctor_picker_empty");
    const statusMsg = document.getElementById("doctor_picker_status");
    const selectAllCb = document.getElementById("doctor_picker_select_all");

    let list = activeDoctors.filter(d => {
        const docId = String(d.Doctor_ID);
        const isSelected = tempSelectedDoctorIds.includes(docId);
        const nameMatch = (d.Full_Name || "").toLowerCase().includes(query);
        const specMatch = (d.Specialties || "").toLowerCase().includes(query);
        const typeMatch = (d.Doctor_Type || "").toLowerCase().includes(query);
        const stationMatch = (d.Station_Name || "").toLowerCase().includes(query);
        const matchesQuery = !query || nameMatch || specMatch || typeMatch || stationMatch;

        let matchesFilter = true;
        if (filterVal === "selected") {
            matchesFilter = isSelected;
        } else if (filterVal === "unselected") {
            matchesFilter = !isSelected;
        } else if (filterVal === "Resident") {
            matchesFilter = d.Doctor_Type === "Resident";
        } else if (filterVal === "Attending") {
            matchesFilter = d.Doctor_Type === "Attending";
        }

        return matchesQuery && matchesFilter;
    });

    list.sort((a, b) => {
        const aSelected = tempSelectedDoctorIds.includes(String(a.Doctor_ID));
        const bSelected = tempSelectedDoctorIds.includes(String(b.Doctor_ID));

        if (sortBy === "selected_first") {
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            return (a.Full_Name || "").localeCompare(b.Full_Name || "");
        } else if (sortBy === "name_desc") {
            return (b.Full_Name || "").localeCompare(a.Full_Name || "");
        } else if (sortBy === "fee_asc") {
            return parseFloat(a.Base_Round_Fee || 0) - parseFloat(b.Base_Round_Fee || 0);
        } else if (sortBy === "fee_desc") {
            return parseFloat(b.Base_Round_Fee || 0) - parseFloat(a.Base_Round_Fee || 0);
        } else {
            return (a.Full_Name || "").localeCompare(b.Full_Name || "");
        }
    });

    currentFilteredDoctors = list;
    tbody.innerHTML = "";

    if (list.length === 0) {
        if (emptyMsg) emptyMsg.style.display = "block";
        if (selectAllCb) {
            selectAllCb.checked = false;
            selectAllCb.indeterminate = false;
            selectAllCb.disabled = true;
        }
    } else {
        if (emptyMsg) emptyMsg.style.display = "none";
        if (selectAllCb) selectAllCb.disabled = false;

        list.forEach(d => {
            const docId = String(d.Doctor_ID);
            const isSelected = tempSelectedDoctorIds.includes(docId);

            const row = document.createElement("tr");
            row.className = `picker-row ${isSelected ? "selected-row" : ""}`;
            row.setAttribute("data-id", docId);
            row.style.cursor = "pointer";

            const specs = d.Specialties ? `<div style="font-size: 11.5px; color: var(--text-muted);">${d.Specialties}</div>` : "";
            const station = d.Station_Name ? `<span class="badge badge-info" style="font-size: 11px; padding: 2px 6px;">${d.Station_Name}</span>` : "";
            const typeBadge = `<span class="badge ${d.Doctor_Type === 'Attending' ? 'badge-primary' : 'badge-secondary'}" style="font-size: 11px; padding: 2px 6px;">${d.Doctor_Type}</span>`;

            row.innerHTML = `
                <td style="text-align: center;">
                    <input type="checkbox" class="doctor-picker-cb" value="${docId}" ${isSelected ? "checked" : ""} style="cursor: pointer; pointer-events: none;">
                </td>
                <td>
                    <div style="font-weight: 600; color: var(--text-main);">${d.Full_Name}</div>
                    <div style="display: flex; gap: 6px; align-items: center; margin-top: 2px;">
                        ${typeBadge}
                        ${station}
                    </div>
                    ${specs}
                </td>
                <td style="text-align: right; font-weight: 600;">
                    ₱${parseFloat(d.Base_Round_Fee || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </td>
            `;

            row.addEventListener("click", () => {
                togglePickerDoctor(docId);
            });

            tbody.appendChild(row);
        });

        const allVisibleSelected = list.every(d => tempSelectedDoctorIds.includes(String(d.Doctor_ID)));
        const someVisibleSelected = list.some(d => tempSelectedDoctorIds.includes(String(d.Doctor_ID)));

        if (selectAllCb) {
            selectAllCb.checked = allVisibleSelected;
            selectAllCb.indeterminate = (!allVisibleSelected && someVisibleSelected);
        }
    }

    if (statusMsg) {
        const count = tempSelectedDoctorIds.length;
        statusMsg.textContent = count === 0 ? "No physicians selected" : `${count} physician${count === 1 ? "" : "s"} selected`;
    }
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
        if (a.Status === 'Admitted') {
            statusBadge = '<span class="badge badge-primary" style="background-color: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; font-weight: 600;">Admitted</span>';
        } else if (a.Status === 'Discharged') {
            statusBadge = '<span class="badge badge-warning">Discharged</span>';
        } else if (a.Status === 'Billed') {
            const rem = parseFloat(a.Remaining_Balance !== undefined && a.Remaining_Balance !== null ? a.Remaining_Balance : 0);
            if (rem > 0) {
                statusBadge = `<span class="badge badge-warning" style="background: #f59e0b; color: #fff;">Billed (Balance: ₱${rem.toLocaleString('en-PH', {minimumFractionDigits: 2})})</span>`;
            } else {
                statusBadge = '<span class="badge badge-success">Settled (Paid in Full)</span>';
            }
        }

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
    const rawQuery = document.getElementById('search_input').value.trim();
    const query = rawQuery.toLowerCase();
    if (!query) {
        renderAdmissionsTable(allAdmissions);
        return;
    }

    const queryNum = query.replace(/[^0-9]/g, '');

    const filtered = allAdmissions.filter(a => {
        const admIdStr = String(a.Admission_ID || '');
        const admCode = `adm-${admIdStr.padStart(3, '0')}`;
        const admCodeShort = `adm-${admIdStr}`;
        const patCode = String(a.Patient_Code || '').toLowerCase();
        const patName = String(a.Patient_Name || '').toLowerCase();
        const bedCode = String(a.Bed_Code || '').toLowerCase();
        const roomName = String(a.Room_Name || '').toLowerCase();
        const complaint = String(a.Chief_Complaint || '').toLowerCase();
        const diagnosis = String(a.Diagnosis || '').toLowerCase();

        const matchesAdmId = admCode.includes(query) ||
                             admCodeShort.includes(query) ||
                             admIdStr.includes(query) ||
                             (query.includes('adm') && queryNum && String(a.Admission_ID) === String(parseInt(queryNum, 10)));

        return matchesAdmId ||
               patCode.includes(query) ||
               patName.includes(query) ||
               bedCode.includes(query) ||
               roomName.includes(query) ||
               complaint.includes(query) ||
               diagnosis.includes(query);
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
    document.getElementById("patient_id").value = "";
    document.getElementById("patient_id_text").value = "";
    document.getElementById('chief_complaint').value = '';
    if (document.getElementById('diagnosis')) document.getElementById('diagnosis').value = '';
    document.getElementById("bed_id").value = "";
    document.getElementById("bed_id_text").value = "";
    selectedDoctorIds = [];
    tempSelectedDoctorIds = [];
    const docTxt = document.getElementById("selected_doctors_text");
    if (docTxt) docTxt.value = "";
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

    if (!selectedDoctorIds || selectedDoctorIds.length === 0) {
        alert("Please assign at least one attending or resident physician.");
        return;
    }

    const payload = {
        patient_id: patientId,
        chief_complaint: chiefComplaint,
        diagnosis: diagnosis,
        bed_id: bedId,
        doctor_ids: selectedDoctorIds
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
                showPopupConfirm("Patient admitted! Would you like to open their clinical chart and ledger now?", () => {
                    openChart(response.data.admission_id);
                }, null, {
                    title: "Admission Confirmed",
                    confirmText: "Open Chart",
                    cancelText: "Stay Here",
                    type: "success"
                });
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

    const patInput = document.getElementById("patient_id_text");
    if (patInput) patInput.addEventListener("click", openPatientPicker);
    const btnBrowsePat = document.getElementById("btnBrowse_patient_id");
    if (btnBrowsePat) btnBrowsePat.addEventListener("click", openPatientPicker);

    const bedInput = document.getElementById("bed_id_text");
    if (bedInput) bedInput.addEventListener("click", openBedPicker);
    const btnBrowseBed = document.getElementById("btnBrowse_bed_id");
    if (btnBrowseBed) btnBrowseBed.addEventListener("click", openBedPicker);

    const docInput = document.getElementById("selected_doctors_text");
    if (docInput) docInput.addEventListener("click", openDoctorPicker);
    const btnBrowseDoc = document.getElementById("btnBrowseDoctors");
    if (btnBrowseDoc) btnBrowseDoc.addEventListener("click", openDoctorPicker);

    const btnCloseDoc = document.getElementById("btnCloseDoctorPicker");
    if (btnCloseDoc) btnCloseDoc.addEventListener("click", closeDoctorPicker);
    const btnCancelDoc = document.getElementById("btnCancelDoctorPicker");
    if (btnCancelDoc) btnCancelDoc.addEventListener("click", closeDoctorPicker);
    const btnConfirmDoc = document.getElementById("btnConfirmDoctorPicker");
    if (btnConfirmDoc) btnConfirmDoc.addEventListener("click", confirmDoctorPicker);

    const docModal = document.getElementById("doctorPickerModal");
    if (docModal) {
        docModal.addEventListener("click", (e) => {
            if (e.target === docModal) closeDoctorPicker();
        });
    }

    const docSearch = document.getElementById("doctor_picker_search");
    if (docSearch) docSearch.addEventListener("input", renderDoctorPickerRows);
    const docFilter = document.getElementById("doctor_picker_filter");
    if (docFilter) docFilter.addEventListener("change", renderDoctorPickerRows);
    const docSort = document.getElementById("doctor_picker_sort");
    if (docSort) docSort.addEventListener("change", renderDoctorPickerRows);
    const docSelectAll = document.getElementById("doctor_picker_select_all");
    if (docSelectAll) {
        docSelectAll.addEventListener("change", (e) => {
            toggleSelectAllPickerDoctors(e.target.checked);
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            const docPicker = document.getElementById("doctorPickerModal");
            if (docPicker && (docPicker.classList.contains("active") || docPicker.style.display === "flex")) {
                e.stopImmediatePropagation();
                closeDoctorPicker();
            }
        }
    });

    loadPatients();
    loadBeds();
    loadDoctors();
    loadAdmissions();
});

