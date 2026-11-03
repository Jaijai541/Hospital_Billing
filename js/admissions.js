const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allAdmissions = [];
let availableBeds = [];
let activePatients = [];
let activeDoctors = [];
let initialCatalogItems = [];
let initialCharges = [];

const openChart = (admissionId) => {
    console.log("admissions.js: Navigating to admission chart ID:", admissionId);
    window.location.href = `admission_details.html?id=${admissionId}`;
};

window.openChart = openChart;

const dischargePatient = (admissionId, patientName) => {
    console.log("admissions.js: Initiating discharge for admission ID:", admissionId);

    const targetAdm = (allAdmissions || []).find(a => parseInt(a.Admission_ID, 10) === parseInt(admissionId, 10));
    const targetDiag = targetAdm && targetAdm.Diagnosis ? targetAdm.Diagnosis.trim() : '';
    const hasDiag = targetDiag && targetDiag.toLowerCase() !== 'pending clinical diagnosis' && targetDiag.toLowerCase() !== 'loading...';

    const confirmMsg = !hasDiag
        ? `Are you sure you want to discharge patient "${patientName}" (Admission #${admissionId})?\n\nNotice: No clinical diagnosis was entered. Patient will be discharged under standard clearance ("Medically cleared for discharge / Under observation").\n\nThis will close the active bed stay, automatically post the final Board & Lodging fee to their Billing Ledger, and release the bed for other patients.`
        : `Are you sure you want to discharge patient "${patientName}" (Admission #${admissionId})?\n\nThis will close the active bed stay, automatically post the final Board & Lodging fee to their Billing Ledger, and release the bed for other patients.`;

    showPopupConfirm(confirmMsg, () => {
        const curUser = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
        const formData = new FormData();
        formData.append('operation', 'dischargePatient');
        formData.append('json', JSON.stringify({ 
            admission_id: admissionId,
            user_id: curUser.user_id,
            doctor_id: curUser.doctor_id
        }));

        axios.post(`${postApiUrl}/admissions.php`, formData)
            .then(response => {
                console.log("admissions.js: Discharge response:", response.data);
                let resData = response.data;
                if (typeof resData === 'string') {
                    try {
                        resData = JSON.parse(resData);
                    } catch (e) {}
                }

                if (resData && resData.success) {
                    alert(resData.message);
                    try {
                        loadBeds();
                        loadPatients();
                        loadAdmissions();
                    } catch (refreshErr) {
                        console.error("admissions.js: Error refreshing list after discharge:", refreshErr);
                    }
                } else {
                    const errMsg = (resData && (resData.error || resData.message)) ? (resData.error || resData.message) : "Unknown error";
                    alert("Discharge Error: " + errMsg);
                }
            })
            .catch(err => {
                console.error("admissions.js: Error discharging patient:", err);
                const errMsg = (err && err.response && err.response.data && err.response.data.error)
                    ? err.response.data.error
                    : (err && err.message ? err.message : "Network error discharging patient.");
                alert("Discharge Error: " + errMsg);
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
            if (typeof updateDoctorsText === 'function') updateDoctorsText();
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
        { value: "avail_first", label: "Available First" },
        { value: "classification_asc", label: "Classification (A–Z)" },
        { value: "classification_desc", label: "Classification (Z–A)" },
        { value: "rate_asc", label: "Rate (Low to High)" },
        { value: "rate_desc", label: "Rate (High to Low)" },
        { value: "bed_asc", label: "Bed Code (A–Z)" },
        { value: "bed_desc", label: "Bed Code (Z–A)" },
        { value: "selected_first", label: "Selected First" }
    ];

    const filterOptions = [
        { value: "all", label: "All Beds (Available & Occupied)" },
        { value: "available_only", label: "Available Beds Only" },
        { value: "occupied_only", label: "Occupied Beds Only" },
        ...classifications.map(c => ({ value: `type_${c}`, label: c })),
        { value: "selected", label: "Selected Bed" }
    ];

    const customFilter = (item, filterVal, selectedId) => {
        if (filterVal === "all") return true;
        if (filterVal === "available_only") return item.isAvailable === true;
        if (filterVal === "occupied_only") return item.isAvailable === false;
        if (filterVal === "selected") return String(item.id) === String(selectedId);
        if (filterVal.startsWith("type_")) {
            const targetType = filterVal.replace("type_", "");
            return item.classification === targetType;
        }
        return true;
    };

    const customSort = (list, sortVal, selectedId) => {
        const arr = [...list];
        if (sortVal === "avail_first") {
            arr.sort((a, b) => {
                const aAvail = a.isAvailable ? 1 : 0;
                const bAvail = b.isAvailable ? 1 : 0;
                if (aAvail !== bAvail) return bAvail - aAvail;
                const comp = (a.classification || "").localeCompare(b.classification || "");
                if (comp !== 0) return comp;
                return (a.bedCode || "").localeCompare(b.bedCode || "", undefined, { numeric: true, sensitivity: "base" });
            });
        } else if (sortVal === "classification_asc") {
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
        items: availableBeds.map(b => {
            const isAvail = (parseInt(b.Is_Available, 10) === 1 && !b.Occupied_Admission_ID);
            const occupiedInfo = !isAvail 
                ? (b.Occupied_Patient_Name ? ` | Occupied by: ${b.Occupied_Patient_Name} (${b.Occupied_Patient_Code || ''})` : " | Currently Occupied") 
                : "";
            return {
                id: b.Bed_ID,
                text: `Bed ${b.Bed_Code} — ${b.Room_Name}`,
                subtext: `Classification: ${b.Room_Type} | Board & Lodging: ₱${parseFloat(b.Daily_Rate || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}/day${occupiedInfo}`,
                classification: b.Room_Type,
                bedCode: b.Bed_Code,
                roomName: b.Room_Name,
                dailyRate: parseFloat(b.Daily_Rate || 0),
                isAvailable: isAvail,
                disabled: !isAvail,
                badge: isAvail ? "Available" : "Occupied",
                badgeClass: isAvail ? "badge-success" : "badge-danger"
            };
        }),
        sortOptions: sortOptions,
        filterOptions: filterOptions,
        defaultSort: "avail_first",
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
    const curUser = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    const names = selectedDoctorIds.map(id => {
        const d = activeDoctors.find(doc => String(doc.Doctor_ID) === String(id));
        if (d) {
            const isMe = curUser && curUser.doctor_id && String(d.Doctor_ID) === String(curUser.doctor_id);
            return isMe ? `${d.Full_Name} (You)` : d.Full_Name;
        }
        if (curUser && curUser.doctor_id && String(curUser.doctor_id) === String(id)) {
            const docName = curUser.Full_Name || `Dr. ${curUser.First_Name} ${curUser.Last_Name}`;
            return `${docName} (You)`;
        }
        return `Doctor #${id}`;
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
    const curUser = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    if (curUser && curUser.doctor_id && !tempSelectedDoctorIds.includes(String(curUser.doctor_id))) {
        tempSelectedDoctorIds.unshift(String(curUser.doctor_id));
    }
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

            const curUser = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
            const isMe = curUser && curUser.doctor_id && String(d.Doctor_ID) === String(curUser.doctor_id);
            const meBadge = isMe ? `<span class="badge badge-success" style="font-size: 11px; padding: 2px 6px;">You (Admitting Physician)</span>` : "";

            row.innerHTML = `
                <td style="text-align: center;">
                    <input type="checkbox" class="doctor-picker-cb" value="${docId}" ${isSelected ? "checked" : ""} style="cursor: pointer; pointer-events: none;">
                </td>
                <td>
                    <div style="font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                        <span>${d.Full_Name}</span>
                        ${meBadge}
                    </div>
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

    if (typeof updateFilterCount === "function") {
        const total = (typeof allAdmissions !== "undefined" && Array.isArray(allAdmissions)) ? allAdmissions.length : (admissions ? admissions.length : 0);
        updateFilterCount(admissions ? admissions.length : 0, total, "admissions");
    }

    if (!admissions || admissions.length === 0) {
        tableDiv.innerHTML = typeof getEmptyStateHtml === "function"
            ? getEmptyStateHtml("📋", "No admission records found", "No patient admissions match your current search and filter settings.")
            : '<p><em>No admission records found matching criteria.</em></p>';
        return;
    }

    let html = '<table class="data-table">';
    html += '<thead>';
    html += '<tr>';
    html += renderSortableTh("Admission & Date", "Admission_ID");
    html += renderSortableTh("Patient & Contact", "Patient_Name");
    html += renderSortableTh("Bed & Assigned Doctor", "Bed_Code");
    html += renderSortableTh("Clinical Diagnosis & Complaint", "Diagnosis");
    html += renderSortableTh("Status", "Status");
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    admissions.forEach(a => {
        const bedInfo = a.Bed_Code 
            ? `<span class="table-primary-text"><strong>${a.Bed_Code}</strong> (${a.Room_Name || ''} - ${a.Room_Type || ''})</span><span class="table-sub-text">₱${parseFloat(a.Daily_Rate || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}/day</span>`
            : '<span class="text-muted table-sub-text">None / Discharged</span>';

        const doctors = a.Assigned_Doctors ? a.Assigned_Doctors.split('; ').join(', ') : 'None assigned';

        let statusBadge = '<span class="badge badge-info">' + a.Status + '</span>';
        if (a.Status === 'Admitted') {
            if (a.Medical_Discharge_Date) {
                statusBadge = '<span class="badge badge-success" title="Medically cleared by doctor; awaiting billing clearance">✔ Medically Cleared</span>';
            } else {
                statusBadge = '<span class="badge badge-primary badge-admitted-pill">Admitted</span>';
            }
        } else if (a.Status === 'Discharged') {
            statusBadge = '<span class="badge badge-warning">Discharged</span>';
        } else if (a.Status === 'Billed') {
            const rem = parseFloat(a.Remaining_Balance !== undefined && a.Remaining_Balance !== null ? a.Remaining_Balance : 0);
            if (rem > 0) {
                let pnInfo = '';
                if (a.Promissory_Next_Due_Date) {
                    const dueStr = a.Formatted_Promissory_Next_Due_Date || a.Promissory_Next_Due_Date;
                    const dueAmt = parseFloat(a.Promissory_Monthly_Amount || rem);
                    pnInfo = `<span class="badge table-pn-badge">PN Due: ${dueStr} (₱${dueAmt.toLocaleString('en-PH', {minimumFractionDigits: 2})})</span>`;
                }
                statusBadge = `<span class="badge badge-warning badge-billed-pending">Billed (Bal: ₱${rem.toLocaleString('en-PH', {minimumFractionDigits: 2})})</span>${pnInfo ? '<br>' + pnInfo : ''}`;
            } else {
                statusBadge = '<span class="badge badge-success">Settled (Paid in Full)</span>';
            }
        }

        const diagnosisBadge = a.Diagnosis 
            ? `<span class="table-primary-text">${a.Diagnosis}</span>` 
            : '<span class="badge badge-warning table-meta-pill">Pending Diagnosis</span>';

        const passText = a.Access_Passcode ? `<span class="badge badge-info" style="font-size: 10.5px; padding: 2px 6px;" title="Patient Self-Service Portal Passcode">Passcode: ${a.Access_Passcode}</span>` : '';
        html += `<tr class="clickable-row" onclick="openChart(${a.Admission_ID})" title="Click row to open clinical chart & ledger">`;
        html += `<td><div style="display: flex; align-items: center; gap: 6px;"><span class="table-primary-text text-primary">ADM-${String(a.Admission_ID).padStart(3, '0')}</span> ${passText}</div><span class="table-sub-text">Admitted: ${a.Admission_Date}</span></td>`;
        html += `<td><span class="table-primary-text">${a.Patient_Name}</span><span class="table-sub-text">${a.Patient_Code} • ${a.Contact_Number || 'No contact'}</span></td>`;
        html += `<td>${bedInfo}<span class="table-sub-text">Dr: ${doctors}</span></td>`;
        html += `<td>${diagnosisBadge}<span class="table-sub-text">Complaint: ${a.Chief_Complaint || 'None Recorded'}</span></td>`;
        html += `<td>${statusBadge}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    tableDiv.innerHTML = html;
};

const filterAndRenderTable = () => {
    const searchElem = document.getElementById('search_input');
    const rawQuery = searchElem ? searchElem.value.trim() : '';
    const query = rawQuery.toLowerCase();
    const sortByElem = document.getElementById('sort_by');
    const sortBy = sortByElem ? sortByElem.value : 'id_desc';
    const statusElem = document.getElementById('filter_status');
    const statusFilter = statusElem ? statusElem.value : 'all';

    let list = Array.isArray(allAdmissions) ? [...allAdmissions] : [];

    if (statusFilter !== 'all') {
        list = list.filter(a => {
            if (statusFilter === 'Settled') {
                return a.Status === 'Billed' && parseFloat(a.Remaining_Balance || 0) <= 0;
            } else if (statusFilter === 'WithBalance') {
                return a.Status === 'Billed' && parseFloat(a.Remaining_Balance || 0) > 0;
            } else if (statusFilter === 'Billed') {
                return a.Status === 'Billed';
            } else {
                return a.Status === statusFilter;
            }
        });
    }

    if (query) {
        const queryNum = query.replace(/[^0-9]/g, '');
        list = list.filter(a => {
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
    }

    list.sort((a, b) => {
        switch (sortBy) {
            case 'id_desc':
                return parseInt(b.Admission_ID || 0) - parseInt(a.Admission_ID || 0);
            case 'id_asc':
                return parseInt(a.Admission_ID || 0) - parseInt(b.Admission_ID || 0);
            case 'name_asc':
                return String(a.Patient_Name || '').localeCompare(String(b.Patient_Name || ''));
            case 'name_desc':
                return String(b.Patient_Name || '').localeCompare(String(a.Patient_Name || ''));
            case 'date_desc':
                return (new Date(b.Admission_Date).getTime() || 0) - (new Date(a.Admission_Date).getTime() || 0);
            case 'date_asc':
                return (new Date(a.Admission_Date).getTime() || 0) - (new Date(b.Admission_Date).getTime() || 0);
            case 'balance_desc':
                return parseFloat(b.Remaining_Balance || 0) - parseFloat(a.Remaining_Balance || 0);
            case 'balance_asc':
                return parseFloat(a.Remaining_Balance || 0) - parseFloat(b.Remaining_Balance || 0);
            case 'status_asc': {
                const getEffectiveStatus = (rec) => {
                    if (rec.Status === 'Billed') {
                        return parseFloat(rec.Remaining_Balance || 0) > 0 ? 'Billed (With Balance)' : 'Settled (Paid in Full)';
                    }
                    return rec.Status || '';
                };
                return getEffectiveStatus(a).localeCompare(getEffectiveStatus(b));
            }
            default:
                return parseInt(b.Admission_ID || 0) - parseInt(a.Admission_ID || 0);
        }
    });

    renderAdmissionsTable(list);
};

const loadAdmissions = () => {
    console.log("admissions.js: Loading admissions list...");
    const status = document.getElementById('filter_status').value;
    const search = document.getElementById('search_input').value;
    const sort = document.getElementById('sort_by') ? document.getElementById('sort_by').value : 'id_desc';

    const curUser = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    const formData = new FormData();
    formData.append('operation', 'getAllAdmissions');
    formData.append('json', JSON.stringify({ 
        status: status, 
        search: search, 
        sort: sort,
        user_id: curUser.user_id,
        doctor_id: curUser.doctor_id
    }));

    axios.post(`${getApiUrl}/admissions.php`, formData)
        .then(response => {
            console.log("admissions.js: Admissions received:", response.data);
            allAdmissions = response.data;
            filterAndRenderTable();
        })
        .catch(err => {
            console.error("admissions.js: Error fetching admissions:", err);
            alert("Failed to load admissions.");
        });
};


const loadInitialCatalogItems = () => {
    const formData = new FormData();
    formData.append('operation', 'getCatalogList');

    return axios.post(`${getApiUrl}/clinical_orders.php`, formData)
        .then(response => {
            initialCatalogItems = Array.isArray(response.data) ? response.data : [];
        })
        .catch(() => {
            initialCatalogItems = [];
        });
};

const openInitialChargePicker = async () => {
    if (!initialCatalogItems || initialCatalogItems.length === 0) {
        await loadInitialCatalogItems();
    }

    const catSelect = document.getElementById("initial_charge_category");
    const activeCategory = catSelect ? catSelect.value : "all";

    const distinctCategories = Array.from(new Set(initialCatalogItems.map(i => i.Category_Type).filter(Boolean)));
    const filterOptions = [
        { value: "all", label: "All Categories" },
        ...distinctCategories.map(c => ({ value: `cat_${c}`, label: c })),
        { value: "selected", label: "Selected Item" }
    ];

    const customFilter = (item, filterVal, selectedId) => {
        if (filterVal === "all") return true;
        if (filterVal === "selected") return String(item.id) === String(selectedId);
        if (filterVal.startsWith("cat_")) {
            const targetCat = filterVal.replace("cat_", "");
            return item.category === targetCat;
        }
        return true;
    };

    const items = initialCatalogItems.map(item => {
        const cat = item.Category_Type || 'Service';
        let badgeClass = 'badge-primary';
        if (cat === 'Equipment Scan') badgeClass = 'badge-info';
        else if (cat === 'Medicine') badgeClass = 'badge-warning';

        return {
            id: item.Catalog_ID,
            text: item.Item_Name,
            category: cat,
            subtext: `₱${parseFloat(item.Unit_Price || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})} • Station: ${item.Station_Name || cat}`,
            classification: `${item.Item_Code} (${cat})`,
            badge: cat,
            badgeClass: badgeClass
        };
    });

    const defaultFilterVal = (activeCategory && activeCategory !== "all") ? `cat_${activeCategory}` : "all";

    openGenericLookupPicker({
        title: "Select Initial Service or Triage Charge",
        items: items,
        filterOptions: filterOptions,
        defaultFilter: defaultFilterVal,
        customFilter: customFilter,
        selectedId: document.getElementById("initial_charge_catalog_id").value,
        onSelect: (item) => {
            const found = initialCatalogItems.find(i => parseInt(i.Catalog_ID, 10) === parseInt(item.id, 10));
            const price = found ? parseFloat(found.Unit_Price || 0) : 0;
            document.getElementById("initial_charge_catalog_id").value = item.id;
            const textEl = document.getElementById("initial_charge_catalog_text");
            if (textEl) textEl.value = `[${item.category}] ${item.text} (${item.classification.split(' ')[0]}) — ₱${price.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
            if (catSelect && item.category) {
                catSelect.value = item.category;
            }
        }
    });
};

const addInitialCharge = () => {
    const idInput = document.getElementById('initial_charge_catalog_id');
    const textInput = document.getElementById('initial_charge_catalog_text');
    const qtyInput = document.getElementById('initial_charge_qty');

    if (!idInput || !idInput.value) {
        openInitialChargePicker();
        return;
    }

    const catalogId = parseInt(idInput.value, 10);
    const qty = parseFloat(qtyInput ? qtyInput.value : 1) || 1;
    if (qty <= 0) {
        if (typeof showToast === 'function') {
            showToast('Quantity must be at least 1.', 'warning');
        } else {
            alert('Quantity must be at least 1.');
        }
        return;
    }

    const item = initialCatalogItems.find(i => parseInt(i.Catalog_ID, 10) === catalogId);
    if (!item) return;

    const existing = initialCharges.find(c => c.catalog_id === catalogId);
    if (existing) {
        existing.quantity += qty;
        existing.total_charge = Math.round(existing.quantity * existing.unit_price * 100) / 100;
    } else {
        const unitPrice = parseFloat(item.Unit_Price || 0);
        initialCharges.push({
            catalog_id: catalogId,
            item_code: item.Item_Code,
            item_name: item.Item_Name,
            category_type: item.Category_Type,
            station_id: item.Station_ID,
            station_name: item.Station_Name,
            quantity: qty,
            unit_price: unitPrice,
            total_charge: Math.round(qty * unitPrice * 100) / 100
        });
    }

    idInput.value = '';
    if (textInput) textInput.value = '';
    if (qtyInput) qtyInput.value = '1';
    renderInitialChargesTable();
};

const removeInitialCharge = (catalogId) => {
    initialCharges = initialCharges.filter(c => c.catalog_id !== catalogId);
    renderInitialChargesTable();
};
window.removeInitialCharge = removeInitialCharge;

const renderInitialChargesTable = () => {
    const emptyEl = document.getElementById('initial_charges_empty');
    const tableEl = document.getElementById('initial_charges_table');
    const tbodyEl = document.getElementById('initial_charges_tbody');
    const totalEl = document.getElementById('initial_charges_total_display');
    const badgeEl = document.getElementById('initial_charges_badge');

    if (!emptyEl || !tableEl || !tbodyEl) return;

    if (initialCharges.length === 0) {
        emptyEl.classList.remove('initial-charges-table-hidden');
        tableEl.classList.add('initial-charges-table-hidden');
        if (badgeEl) {
            badgeEl.textContent = '0 Items';
            badgeEl.className = 'badge badge-secondary';
        }
        if (totalEl) totalEl.textContent = '₱0.00';
        tbodyEl.innerHTML = '';
        return;
    }

    emptyEl.classList.add('initial-charges-table-hidden');
    tableEl.classList.remove('initial-charges-table-hidden');
    if (badgeEl) {
        badgeEl.textContent = `${initialCharges.length} ${initialCharges.length === 1 ? 'Item' : 'Items'}`;
        badgeEl.className = 'badge badge-success';
    }

    let sum = 0;
    let rowsHtml = '';
    initialCharges.forEach(c => {
        sum += c.total_charge;
        let badgeClass = 'badge-primary';
        if (c.category_type === 'Equipment Scan') badgeClass = 'badge-info';
        else if (c.category_type === 'Medicine') badgeClass = 'badge-warning';

        rowsHtml += `<tr>
            <td>
                <span class="initial-charge-item-title">${c.item_name}</span>
                <span class="initial-charge-item-sub font-mono">${c.item_code}</span>
            </td>
            <td>
                <span class="badge ${badgeClass}">${c.category_type}</span>
                <span class="initial-charge-item-sub">${c.station_name || ''}</span>
            </td>
            <td class="text-right"><strong>${c.quantity}</strong></td>
            <td class="text-right">₱${c.unit_price.toLocaleString('en-PH', {minimumFractionDigits: 2})}</td>
            <td class="text-right"><strong class="text-primary">₱${c.total_charge.toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></td>
            <td class="text-center">
                <button type="button" class="btn-remove-initial-charge" onclick="removeInitialCharge(${c.catalog_id})" title="Remove charge">✕ Remove</button>
            </td>
        </tr>`;
    });

    tbodyEl.innerHTML = rowsHtml;
    if (totalEl) {
        totalEl.textContent = `₱${sum.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
    }
};

const resetForm = () => {
    document.getElementById("patient_id").value = "";
    document.getElementById("patient_id_text").value = "";
    document.getElementById('chief_complaint').value = '';
    if (document.getElementById('diagnosis')) document.getElementById('diagnosis').value = '';
    document.getElementById("bed_id").value = "";
    document.getElementById("bed_id_text").value = "";
    const curUser = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    if (curUser && curUser.doctor_id) {
        selectedDoctorIds = [String(curUser.doctor_id)];
        tempSelectedDoctorIds = [String(curUser.doctor_id)];
        updateDoctorsText();
    } else {
        selectedDoctorIds = [];
        tempSelectedDoctorIds = [];
        const docTxt = document.getElementById("selected_doctors_text");
        if (docTxt) docTxt.value = "";
    }
    initialCharges = [];
    renderInitialChargesTable();
    const initCatId = document.getElementById('initial_charge_catalog_id');
    if (initCatId) initCatId.value = '';
    const initCatTxt = document.getElementById('initial_charge_catalog_text');
    if (initCatTxt) initCatTxt.value = '';
    const initQty = document.getElementById('initial_charge_qty');
    if (initQty) initQty.value = '1';
    const initCatFilter = document.getElementById('initial_charge_category');
    if (initCatFilter) initCatFilter.value = 'all';
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

    const curUser = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    const payload = {
        patient_id: patientId,
        chief_complaint: chiefComplaint,
        diagnosis: diagnosis,
        bed_id: bedId,
        doctor_ids: selectedDoctorIds,
        submitting_doctor_id: curUser && curUser.doctor_id ? parseInt(curUser.doctor_id, 10) : 0,
        initial_charges: initialCharges
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

window.addEventListener('DOMContentLoaded', async () => {
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

    initModalControls("formModal", "btnOpenAddModal", "btnCloseModal", "btnCancel", resetForm);
    document.getElementById('btnSubmitAdmit').addEventListener('click', submitAdmission);
    const btnAddCharge = document.getElementById('btnAddInitialCharge');
    if (btnAddCharge) btnAddCharge.addEventListener('click', addInitialCharge);
    loadInitialCatalogItems();
    initRefreshBtn("btnRefreshAdmissions", async () => {
        await loadBeds();
        await loadPatients();
        await loadAdmissions();
    });

    document.getElementById('search_input').addEventListener('input', () => {
        filterAndRenderTable();
    });

    document.getElementById('filter_status').addEventListener('change', () => {
        loadAdmissions();
    });

    const sortBySelect = document.getElementById('sort_by');
    if (sortBySelect) {
        sortBySelect.addEventListener('change', () => {
            filterAndRenderTable();
        });
    }

    const patInput = document.getElementById("patient_id_text");
    if (patInput) patInput.addEventListener("click", openPatientPicker);
    const btnBrowsePat = document.getElementById("btnBrowse_patient_id");
    if (btnBrowsePat) btnBrowsePat.addEventListener("click", openPatientPicker);

    const bedInput = document.getElementById("bed_id_text");
    if (bedInput) bedInput.addEventListener("click", openBedPicker);
    const btnBrowseBed = document.getElementById("btnBrowse_bed_id");
    if (btnBrowseBed) btnBrowseBed.addEventListener("click", openBedPicker);

    const chargeInput = document.getElementById("initial_charge_catalog_text");
    if (chargeInput) chargeInput.addEventListener("click", openInitialChargePicker);
    const btnBrowseCharge = document.getElementById("btnBrowse_initial_charge");
    if (btnBrowseCharge) btnBrowseCharge.addEventListener("click", openInitialChargePicker);

    const initialCatSelect = document.getElementById('initial_charge_category');
    if (initialCatSelect) {
        initialCatSelect.addEventListener('change', () => {
            const currentCat = initialCatSelect.value;
            const idInput = document.getElementById('initial_charge_catalog_id');
            if (idInput && idInput.value && currentCat !== 'all') {
                const curItem = initialCatalogItems.find(i => parseInt(i.Catalog_ID, 10) === parseInt(idInput.value, 10));
                if (curItem && curItem.Category_Type !== currentCat) {
                    idInput.value = '';
                    const textEl = document.getElementById('initial_charge_catalog_text');
                    if (textEl) textEl.value = '';
                }
            }
        });
    }

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

    await loadPatients();
    await loadBeds();
    loadDoctors();
    loadAdmissions();
    await handlePreselectedPatient();
});

const handlePreselectedPatient = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const preselectPatientId = urlParams.get("patient_id");
    const preselectBedId = urlParams.get("bed_id");
    const shouldOpenModal = urlParams.get("admit") === "1" || Boolean(preselectPatientId) || Boolean(preselectBedId);

    if (!preselectPatientId && !preselectBedId && !shouldOpenModal) return;

    if (preselectBedId) {
        if (!availableBeds || availableBeds.length === 0) {
            await loadBeds();
        }
        const b = (availableBeds || []).find(item => String(item.Bed_ID) === String(preselectBedId));
        if (b) {
            const bId = document.getElementById("bed_id");
            if (bId) bId.value = b.Bed_ID;
            const bText = document.getElementById("bed_id_text");
            if (bText) {
                const rateVal = parseFloat(b.Daily_Rate || 0);
                bText.value = `Bed ${b.Bed_Code} — ${b.Room_Name} (${b.Room_Type}) — ₱${rateVal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}/day`;
            }
        }
    }

    if (!activePatients || activePatients.length === 0) {
        await loadPatients();
    }

    if (preselectPatientId) {
        let p = activePatients.find(item => String(item.Patient_ID) === String(preselectPatientId));
        if (!p) {
            try {
                const response = await axios.get(`${getApiUrl}/patients.php`, {
                    params: {
                        operation: "getPatientById",
                        json: JSON.stringify({ patient_id: preselectPatientId })
                    }
                });
                if (response.status === 200 && response.data) {
                    const d = response.data;
                    p = {
                        Patient_ID: d.Patient_ID,
                        Patient_Code: d.Patient_Code,
                        Full_Name: `${d.Last_Name}, ${d.First_Name}`
                    };
                }
            } catch (err) {
                console.error("admissions.js: Error fetching preselected patient details:", err);
            }
        }

        if (p) {
            const pId = document.getElementById("patient_id");
            if (pId) pId.value = p.Patient_ID;
            const pText = document.getElementById("patient_id_text");
            if (pText) pText.value = `${p.Patient_Code} — ${p.Full_Name}`;
        }
    }

    if (shouldOpenModal) {
        openModal("formModal");
    }

    if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
};

