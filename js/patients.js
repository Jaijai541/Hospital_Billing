const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allPatients = [];
let allGenders = [];
let allBloodTypes = [];
let currentLoadedPatient = null;
let bypassDuplicateCheck = false;
let matchedDuplicatePatient = null;
let currentPatientHistoryRecords = [];
let currentHistoryPatientId = null;

const switchPatientModalTab = (tabKey) => {
    const normalizedKey = tabKey === "history" ? "history" : "stay";
    const tabBtns = document.querySelectorAll(".patient-modal-tab-btn");
    const stayPane = document.getElementById("patient-tab-pane-stay");
    const historyPane = document.getElementById("patient-tab-pane-history");
    const showStay = normalizedKey === "stay";
    const showHistory = normalizedKey === "history";

    tabBtns.forEach((btn) => {
        const isTarget = btn.getAttribute("data-patient-tab") === normalizedKey;
        btn.classList.toggle("active", isTarget);
        btn.setAttribute("aria-selected", isTarget ? "true" : "false");
    });

    if (stayPane) {
        stayPane.classList.toggle("active", showStay);
        stayPane.classList.toggle("patient-tab-pane-hidden", !showStay);
        stayPane.style.display = showStay ? "block" : "none";
    }
    if (historyPane) {
        historyPane.classList.toggle("active", showHistory);
        historyPane.classList.toggle("patient-tab-pane-hidden", !showHistory);
        historyPane.style.display = showHistory ? "block" : "none";
    }

    if (showHistory) {
        renderFilteredPatientHistory();
    }
};

window.switchPatientModalTab = switchPatientModalTab;

const renderFilteredPatientHistory = () => {
    const tableBody = document.getElementById("view_patient_history_tbody");
    const countBadge = document.getElementById("view_patient_history_count");
    const searchInput = document.getElementById("view_patient_history_search");
    const query = (searchInput ? searchInput.value : "").trim().toLowerCase();
    const total = currentPatientHistoryRecords.length;

    const filtered = currentPatientHistoryRecords.filter((row) => {
        if (!query) return true;
        const admCode = (row.Admission_Code || "").toLowerCase();
        const inDate = (row.Admission_Date || "").toLowerCase();
        const outDate = (row.Discharge_Date || "active stay").toLowerCase();
        const bedRoom = `${row.Bed_Code || ""} ${row.Room_Name || ""} ${row.Room_Type || ""}`.toLowerCase();
        const diag = `${row.Chief_Complaint || ""} ${row.Diagnosis || ""}`.toLowerCase();
        const status = `${row.Status || ""} ${row.Payment_Status || ""} ${row.Invoice_Code || ""}`.toLowerCase();
        return (
            admCode.includes(query) ||
            inDate.includes(query) ||
            outDate.includes(query) ||
            bedRoom.includes(query) ||
            diag.includes(query) ||
            status.includes(query)
        );
    });

    if (countBadge) {
        countBadge.textContent = query
            ? `${filtered.length} of ${total} Admission${total === 1 ? '' : 's'}`
            : `${total} Admission${total === 1 ? '' : 's'}`;
        countBadge.className = total > 0
            ? "badge badge-info patient-modal-tab-badge"
            : "badge badge-secondary patient-modal-tab-badge";
    }

    if (!tableBody) return;

    if (total === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">
                    <div>No prior hospital admissions on record for this patient.</div>
                    <a href="admissions.html?patient_id=${currentHistoryPatientId}&admit=1" class="btn btn-sm btn-primary" style="margin-top: 10px; display: inline-flex; align-items: center; gap: 4px; text-decoration: none;">
                        + Admit
                    </a>
                </td>
            </tr>
        `;
        return;
    }

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">
                    No matching admission records found for your search.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = "";
    filtered.forEach(row => {
        const isCurrent = row.Status === "Admitted";
        const rowBg = isCurrent ? "#f0fdf4" : "#ffffff";
        const rowBorder = isCurrent ? "3px solid #22c55e" : "1px solid #e2e8f0";

        let statusBadge = `<span class="badge" style="background: #e0f2fe; color: #0284c7; font-weight: 600;">Admitted</span>`;
        if (row.Status === "Discharged") {
            statusBadge = `<span class="badge" style="background: #fef3c7; color: #92400e; font-weight: 600;">Discharged</span>`;
        } else if (row.Status === "Billed") {
            const remBal = parseFloat(row.Remaining_Balance || 0);
            if (remBal > 0) {
                statusBadge = `<span class="badge" style="background: #fed7aa; color: #9a3412; font-weight: 600;">Billed (Bal: ₱${remBal.toLocaleString('en-PH', {minimumFractionDigits: 2})})</span>`;
            } else {
                statusBadge = `<span class="badge" style="background: #dcfce7; color: #166534; font-weight: 600;">Settled (Paid)</span>`;
            }
        }

        let billingHtml = "";
        if (row.Invoice_Code) {
            const netAmt = parseFloat(row.Net_Amount_Due || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });
            const remBal = parseFloat(row.Remaining_Balance || 0);
            if (row.Payment_Status === "Paid in Full") {
                billingHtml = `<div><strong style="color: #0284c7;">${row.Invoice_Code}</strong> &bull; ₱${netAmt}</div><span class="badge" style="background: #dcfce7; color: #166534; font-size: 10.5px; font-weight: 700;">Paid in Full</span>`;
            } else {
                billingHtml = `<div><strong style="color: #0284c7;">${row.Invoice_Code}</strong> &bull; ₱${netAmt}</div><span class="badge" style="background: #fee2e2; color: #991b1b; font-size: 10.5px; font-weight: 700;">Bal: ₱${remBal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>`;
            }
        } else {
            billingHtml = `<span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 10.5px;">Unbilled</span>`;
        }

        const bedText = row.Bed_Code ? `<strong>${row.Bed_Code}</strong>` : `<span class="text-muted">None</span>`;
        const roomText = row.Room_Name ? `<br><small class="text-muted">${row.Room_Name} (${row.Room_Type || 'Ward'})</small>` : '';

        const complaintText = row.Chief_Complaint ? `<div><strong>Complaint:</strong> ${row.Chief_Complaint}</div>` : `<div class="text-muted">No complaint recorded</div>`;
        const diagText = row.Diagnosis 
            ? `<div><small><strong>Diagnosis:</strong> <span style="color: #0284c7; font-weight: 600;">${row.Diagnosis}</span></small></div>`
            : `<div><small class="text-muted">Diagnosis: Pending</small></div>`;

        const stayOut = row.Discharge_Date 
            ? `<div><strong>Out:</strong> ${row.Discharge_Date}</div>` 
            : `<div><span class="badge" style="background: #e0f2fe; color: #0284c7; font-weight: 600; font-size: 10.5px;">Active Stay</span></div>`;

        const seqBadge = isCurrent
            ? `<span class="badge" style="background: #16a34a; color: #ffffff; font-weight: 700;">#${row.Sequence_Number} CURRENT</span>`
            : `<span class="badge" style="background: #f1f5f9; color: #475569; font-weight: 700;">#${row.Sequence_Number}</span>`;

        const tr = document.createElement("tr");
        tr.className = "clickable-row";
        tr.style.background = rowBg;
        tr.style.borderLeft = rowBorder;
        tr.style.cursor = "pointer";
        tr.title = `Click to open patient chart (${row.Admission_Code})`;
        tr.innerHTML = `
            <td>
                <div class="table-primary-text font-bold">${seqBadge} ${row.Admission_Code}</div>
                <div class="table-sub-text">In: ${row.Admission_Date} ${row.Discharge_Date ? `&bull; Out: ${row.Discharge_Date}` : '<span class="badge badge-info">Active Stay</span>'}</div>
            </td>
            <td>
                <div class="table-primary-text">${bedText}</div>
                <div class="table-sub-text">${row.Room_Name ? `${row.Room_Name} &bull; ${row.Room_Type || 'Ward'}` : 'Unassigned'}</div>
            </td>
            <td>
                <div class="table-sub-text-dark">${complaintText}</div>
                <div class="table-sub-text">${diagText}</div>
            </td>
            <td>
                <div>${statusBadge}</div>
                <div class="table-sub-text">${billingHtml}</div>
            </td>
        `;
        const curUser = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
        const curPerms = Array.isArray(curUser.permissions) ? curUser.permissions : [];
        const isAdmin = (curUser.access_domain || '').toLowerCase() === 'admin' || parseInt(curUser.role_id, 10) === 1 || (curUser.role_name || '').toLowerCase() === 'admin';
        const hasAdmissionPerm = isAdmin || curPerms.includes("admissions.html") || curPerms.includes("admission_details.html");

        if (hasAdmissionPerm) {
            tr.className = "clickable-row";
            tr.title = `Click to open clinical chart for ${row.Admission_Code || ('ADM-' + row.Admission_ID)}`;
            tr.addEventListener("click", () => {
                window.location.href = `admission_details.html?id=${row.Admission_ID}`;
            });
        } else {
            tr.className = "restricted-row";
            tr.style.cursor = "not-allowed";
            tr.title = "Access Restricted: Your assigned role does not have permission to access clinical inpatient charts.";
            tr.addEventListener("click", () => {
                if (typeof showPopupAlert === "function") {
                    showPopupAlert("Access Restricted: Your assigned role does not have permission to access clinical inpatient charts.", "warning");
                } else {
                    alert("Access Restricted: Your assigned role does not have permission to access clinical inpatient charts.");
                }
            });
        }
        tableBody.appendChild(tr);
    });
};

const loadPatientAdmissionHistory = async (patientId) => {
    currentHistoryPatientId = patientId;
    currentPatientHistoryRecords = [];
    const tableBody = document.getElementById("view_patient_history_tbody");

    if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">Loading admission history...</td></tr>`;
    }

    try {
        const formData = new FormData();
        formData.append("operation", "getPatientAdmissionHistory");
        formData.append("json", JSON.stringify({ patient_id: patientId }));

        const response = await axios.post(`${getApiUrl}/admissions.php`, formData);
        const data = response.data;

        if (!data || data.error) {
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #dc2626; padding: 16px;">${data?.error || "Unable to load admission history."}</td></tr>`;
            }
            return;
        }

        const total = parseInt(data.total_admissions || 0, 10);
        const history = data.history || [];
        currentPatientHistoryRecords = history;

        const elHistTotal = document.getElementById("view_hist_total_count");
        if (elHistTotal) elHistTotal.textContent = total;

        const activeStay = history.find(h => h.Status === "Admitted");
        const elHistCurrent = document.getElementById("view_hist_current_stay");
        const elHistActiveBadge = document.getElementById("view_hist_active_badge");
        if (elHistCurrent) {
            elHistCurrent.textContent = activeStay ? activeStay.Admission_Code : "None";
            elHistCurrent.className = activeStay ? "patient-history-stat-val patient-history-val-active" : "patient-history-stat-val";
        }
        if (elHistActiveBadge) {
            elHistActiveBadge.textContent = activeStay ? "Admitted" : "None";
            elHistActiveBadge.className = activeStay ? "patient-history-status-pill pill-success" : "patient-history-status-pill pill-neutral";
        }

        const priorCount = activeStay ? Math.max(0, total - 1) : total;
        const elHistPrior = document.getElementById("view_hist_prior_count");
        if (elHistPrior) elHistPrior.textContent = priorCount;

        renderFilteredPatientHistory();
    } catch (err) {
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #dc2626; padding: 16px;">Network error loading admission history.</td></tr>`;
        }
    }
};

const openViewPatientModal = async (patientId) => {
    try {
        console.log(`[API] Fetching patient details for view modal: ${patientId}`);
        const response = await axios.get(`${getApiUrl}/patients.php`, {
            params: {
                operation: "getPatientById",
                json: JSON.stringify({ patient_id: patientId })
            }
        });

        if (response.status === 200 && response.data) {
            const p = response.data;
            currentLoadedPatient = p;

            const nameEl = document.getElementById("view_patient_name");
            if (nameEl) nameEl.textContent = `${p.Last_Name}, ${p.First_Name}`;

            const codeBadge = document.getElementById("view_patient_code_badge");
            if (codeBadge) codeBadge.textContent = p.Patient_Code || `PAT-${String(p.Patient_ID).padStart(3, '0')}`;

            const bloodBadge = document.getElementById("view_patient_blood_badge");
            if (bloodBadge) bloodBadge.textContent = `Blood: ${p.Blood_Type_Name || 'N/A'}`;

            const statusBadge = document.getElementById("view_patient_status_badge");
            if (statusBadge) {
                const isActive = (p.Is_Active == 1);
                statusBadge.className = isActive ? "badge badge-success" : "badge badge-danger";
                statusBadge.textContent = isActive ? "Active" : "Archived";
            }

            const ageText = (p.Age !== null && p.Age !== undefined) ? ` (${p.Age} yrs old)` : '';
            const dobAgeEl = document.getElementById("view_patient_dob_age");
            if (dobAgeEl) dobAgeEl.textContent = `DOB: ${p.Date_Of_Birth || 'N/A'}${ageText}`;

            let genderStr = p.Gender_Name || 'N/A';
            if (p.Gender_Specification) {
                genderStr += ` (${p.Gender_Specification})`;
            }
            const genderEl = document.getElementById("view_patient_gender");
            if (genderEl) genderEl.textContent = `Gender: ${genderStr}`;

            const contactEl = document.getElementById("view_patient_contact");
            if (contactEl) contactEl.textContent = `Contact: ${p.Contact_Number || 'N/A'}`;

            const addressEl = document.getElementById("view_patient_address");
            if (addressEl) addressEl.textContent = p.Address || 'No residential address recorded';

            const emergencyEl = document.getElementById("view_patient_emergency");
            if (emergencyEl) {
                const emName = p.Emergency_Contact_Name || 'None';
                const emPhone = p.Emergency_Contact_Number ? ` (${p.Emergency_Contact_Number})` : '';
                emergencyEl.textContent = `${emName}${emPhone}`;
            }

            const bedCard = document.getElementById("view_patient_bed_assignment");
            const bedBadge = document.getElementById("view_patient_bed_badge");
            const bedContent = document.getElementById("view_patient_bed_content");

            const isAdmitted = Boolean(p.Current_Bed_Code || p.Active_Admission_ID || p.Admission_Status === "Admitted");

            if (isAdmitted) {
                if (bedCard) {
                    const curUser = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
                    const curPerms = Array.isArray(curUser.permissions) ? curUser.permissions : [];
                    const isAdmin = (curUser.access_domain || '').toLowerCase() === 'admin' || parseInt(curUser.role_id, 10) === 1 || (curUser.role_name || '').toLowerCase() === 'admin';
                    const hasAdmissionPerm = isAdmin || curPerms.includes("admissions.html") || curPerms.includes("admission_details.html");

                    if (hasAdmissionPerm) {
                        bedCard.className = "patient-bed-assignment-card is-clickable";
                        bedCard.style.backgroundColor = "#f0fdf4";
                        bedCard.style.borderColor = "#bbf7d0";
                        bedCard.setAttribute("role", "button");
                        bedCard.setAttribute("tabindex", "0");
                        bedCard.title = `Click to open patient chart (${p.Active_Admission_Code || ('ADM-' + p.Active_Admission_ID)})`;
                        const goToActiveChart = () => {
                            if (p.Active_Admission_ID) {
                                window.location.href = `admission_details.html?id=${p.Active_Admission_ID}`;
                            }
                        };
                        bedCard.onclick = goToActiveChart;
                        bedCard.onkeydown = (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                goToActiveChart();
                            }
                        };
                    } else {
                        bedCard.className = "patient-bed-assignment-card";
                        bedCard.style.backgroundColor = "#f0fdf4";
                        bedCard.style.borderColor = "#bbf7d0";
                        bedCard.title = "Access Restricted: Your assigned role does not have permission to access clinical inpatient charts.";
                        bedCard.onclick = () => {
                            if (typeof showPopupAlert === "function") {
                                showPopupAlert("Access Restricted: Your assigned role does not have permission to access clinical inpatient charts.", "warning");
                            } else {
                                alert("Access Restricted: Your assigned role does not have permission to access clinical inpatient charts.");
                            }
                        };
                        bedCard.onkeydown = null;
                    }
                }
                if (bedBadge) {
                    bedBadge.className = "badge badge-success patient-modal-tab-badge";
                    bedBadge.textContent = p.Active_Admission_Code ? `Currently Admitted (${p.Active_Admission_Code})` : "Currently Admitted";
                }

                const floorWingParts = [];
                if (p.Floor_Name) floorWingParts.push(p.Floor_Name);
                if (p.Building_Wing) floorWingParts.push(p.Building_Wing);
                const floorWingStr = floorWingParts.length > 0 ? floorWingParts.join(" • ") : "Main In-Patient Wing";

                const dailyRateFormatted = p.Current_Daily_Rate 
                    ? `₱${parseFloat(p.Current_Daily_Rate).toLocaleString('en-PH', {minimumFractionDigits: 2})}/day` 
                    : 'N/A';

                const complaintParts = [];
                if (p.Chief_Complaint) complaintParts.push(p.Chief_Complaint);
                if (p.Diagnosis) complaintParts.push(`Assessment: ${p.Diagnosis}`);
                const complaintStr = complaintParts.length > 0 ? complaintParts.join(" — ") : "No complaint details recorded";

                if (bedContent) {
                    bedContent.innerHTML = `
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px 16px; margin-top: 4px;">
                            <div><strong>Bed Code:</strong> <span style="color: #166534; font-weight: 700;">${p.Current_Bed_Code || 'Assigned'}</span></div>
                            <div><strong>Room / Ward:</strong> ${p.Current_Room_Name || 'Room'} <span class="text-muted">(${p.Current_Room_Type || 'Ward'})</span></div>
                            <div><strong>Ward Location:</strong> ${floorWingStr}</div>
                            <div><strong>Daily Board Rate:</strong> ${dailyRateFormatted}</div>
                            <div><strong>Admission Date:</strong> ${p.Admission_Date_Formatted || 'N/A'}</div>
                            <div><strong>Active Case:</strong> <strong>${p.Active_Admission_Code || ('ADM-' + p.Active_Admission_ID)}</strong></div>
                            <div style="grid-column: 1 / -1;"><strong>Attending Physician(s):</strong> ${p.Attending_Doctors || 'Pending physician round assignment'}</div>
                            <div style="grid-column: 1 / -1;"><strong>Chief Complaint &amp; Diagnosis:</strong> ${complaintStr}</div>
                        </div>
                    `;
                }
            } else {
                if (bedCard) {
                    bedCard.className = "patient-bed-assignment-card";
                    bedCard.style.backgroundColor = "#f8fafc";
                    bedCard.style.borderColor = "#e2e8f0";
                    bedCard.removeAttribute("role");
                    bedCard.removeAttribute("tabindex");
                    bedCard.title = "";
                    bedCard.onclick = null;
                    bedCard.onkeydown = null;
                }
                if (bedBadge) {
                    bedBadge.className = "badge badge-secondary patient-modal-tab-badge";
                    bedBadge.textContent = "No Active Stay";
                }
                if (bedContent) {
                    bedContent.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                            <span style="color: #64748b;">This patient is not currently admitted or occupying any hospital bed.</span>
                            <a href="admissions.html?patient_id=${p.Patient_ID}&admit=1" class="btn btn-sm btn-primary" style="font-size: 12px; padding: 4px 12px; text-decoration: none;">+ Admit</a>
                        </div>
                    `;
                }
            }

            document.querySelectorAll(".patient-modal-tab-btn").forEach((btn) => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const tabKey = btn.getAttribute("data-patient-tab") || "stay";
                    switchPatientModalTab(tabKey);
                };
            });

            const histSearch = document.getElementById("view_patient_history_search");
            if (histSearch) {
                histSearch.value = "";
                histSearch.oninput = () => renderFilteredPatientHistory();
                histSearch.dispatchEvent(new Event("keyup"));
            }

            switchPatientModalTab("stay");
            loadPatientAdmissionHistory(p.Patient_ID);

            const btnEdit = document.getElementById("btnOpenEditFromPatientView");
            if (btnEdit) {
                btnEdit.onclick = () => {
                    closeViewPatientModal();
                    loadPatientForEdit(p.Patient_ID);
                };
            }

            openModal("viewPatientModal");
        }
    } catch (error) {
        console.error("[API] Error loading patient details for view modal:", error);
        alert("Failed to load patient record.");
    }
};

const closeViewPatientModal = () => {
    closeModal("viewPatientModal");
};

const openDuplicateModal = (p) => {
    matchedDuplicatePatient = p;
    const modal = document.getElementById("duplicatePatientModal");
    if (!modal) return;
    document.getElementById("dup_patient_code").textContent = p.Patient_Code || `PAT-${String(p.Patient_ID).padStart(3, '0')}`;
    const statusBadge = document.getElementById("dup_patient_status");
    if (statusBadge) {
        statusBadge.className = (p.Is_Active == 1) ? "badge badge-success" : "badge badge-danger";
        statusBadge.textContent = (p.Is_Active == 1) ? "Active" : "Archived";
    }
    document.getElementById("dup_patient_name").textContent = `${p.Last_Name}, ${p.First_Name}`;
    document.getElementById("dup_patient_dob").textContent = p.Date_Of_Birth || "N/A";
    document.getElementById("dup_patient_gender_blood").textContent = `${p.Gender_Name || "-"} | Blood Type: ${p.Blood_Type_Name || "-"}`;
    document.getElementById("dup_patient_contact").textContent = p.Contact_Number || "N/A";
    document.getElementById("dup_patient_address").textContent = p.Address || "N/A";
    modal.style.display = "flex";
};

const closeDuplicateModal = () => {
    const modal = document.getElementById("duplicatePatientModal");
    if (modal) modal.style.display = "none";
    matchedDuplicatePatient = null;
};

document.addEventListener("DOMContentLoaded", () => {
    loadPatientEnums();
    displayPatients();

    initModalControls("formModal", "btnOpenAddModal", "btnCloseModal", "btnCancel", resetForm);
    document.getElementById("btnSubmit").addEventListener("click", savePatient);

    const btnCloseView = document.getElementById("btnCloseViewPatientModal");
    if (btnCloseView) btnCloseView.addEventListener("click", closeViewPatientModal);
    const btnCloseViewBtn = document.getElementById("btnCloseViewPatientBtn");
    if (btnCloseViewBtn) btnCloseViewBtn.addEventListener("click", closeViewPatientModal);
    const viewModal = document.getElementById("viewPatientModal");
    if (viewModal) {
        viewModal.addEventListener("click", (e) => {
            if (e.target === viewModal) closeViewPatientModal();
        });
    }

    document.querySelectorAll(".patient-modal-tab-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tabKey = btn.getAttribute("data-patient-tab") || "stay";
            switchPatientModalTab(tabKey);
        });
    });

    document.addEventListener("click", (e) => {
        const tabBtn = e.target.closest(".patient-modal-tab-btn");
        if (tabBtn) {
            e.preventDefault();
            const tabKey = tabBtn.getAttribute("data-patient-tab") || "stay";
            switchPatientModalTab(tabKey);
        }
    });

    const patHistSearch = document.getElementById("view_patient_history_search");
    if (patHistSearch) {
        patHistSearch.addEventListener("input", () => {
            renderFilteredPatientHistory();
        });
    }

    const btnCloseDup = document.getElementById("btnCloseDuplicateModal");
    if (btnCloseDup) btnCloseDup.addEventListener("click", closeDuplicateModal);
    const btnCancelDup = document.getElementById("btnCancelDuplicateModal");
    if (btnCancelDup) btnCancelDup.addEventListener("click", closeDuplicateModal);

    const btnProceedNew = document.getElementById("btnProceedNewPatient");
    if (btnProceedNew) {
        btnProceedNew.addEventListener("click", () => {
            bypassDuplicateCheck = true;
            closeDuplicateModal();
            savePatient();
        });
    }

    const btnViewExisting = document.getElementById("btnViewExistingPatient");
    if (btnViewExisting) {
        btnViewExisting.addEventListener("click", () => {
            const targetId = matchedDuplicatePatient ? matchedDuplicatePatient.Patient_ID : null;
            closeDuplicateModal();
            closeModal("formModal");
            if (targetId) {
                openViewPatientModal(targetId);
            }
        });
    }

    const btnReset = document.getElementById("btnReset");
    if (btnReset) {
        btnReset.addEventListener("click", () => {
            if (currentLoadedPatient) {
                populatePatientForm(currentLoadedPatient);
            } else {
                resetForm();
            }
        });
    }

    const genderInput = document.getElementById("gender_id_text");
    if (genderInput) genderInput.addEventListener("click", openGenderPicker);
    const btnBrowseGender = document.getElementById("btnBrowse_gender_id");
    if (btnBrowseGender) btnBrowseGender.addEventListener("click", openGenderPicker);

    const bloodInput = document.getElementById("blood_type_id_text");
    if (bloodInput) bloodInput.addEventListener("click", openBloodTypePicker);
    const btnBrowseBlood = document.getElementById("btnBrowse_blood_type_id");
    if (btnBrowseBlood) btnBrowseBlood.addEventListener("click", openBloodTypePicker);

    document.getElementById("search_input").addEventListener("input", filterAndSortPatients);
    document.getElementById("filter_status").addEventListener("change", filterAndSortPatients);
    document.getElementById("filter_blood").addEventListener("change", filterAndSortPatients);
    const sortByElem = document.getElementById("sort_by"); if (sortByElem) sortByElem.addEventListener("change", filterAndSortPatients);

    initRefreshBtn("btnRefreshPatients", displayPatients);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            const vm = document.getElementById("viewPatientModal");
            if (vm && (vm.classList.contains("active") || vm.style.display === "flex")) {
                closeViewPatientModal();
            }
        }
    });
});

const loadPatientEnums = async () => {
    try {
        console.log("[API] Requesting: getPatientEnums");
        const response = await axios.get(`${getApiUrl}/patients.php`, {
            params: { operation: "getPatientEnums" }
        });

        if (response.status === 200 && response.data) {
            const data = response.data;
            allGenders = data.genders || [];
            allBloodTypes = data.blood_types || [];

            const bloodFilter = document.getElementById("filter_blood");
            if (bloodFilter) {
                bloodFilter.innerHTML = `<option value="all">All Blood Types</option>`;
                allBloodTypes.forEach(b => {
                    const filterOpt = document.createElement("option");
                    filterOpt.value = b.Blood_Type_ID;
                    filterOpt.textContent = b.Blood_Type_Name;
                    bloodFilter.appendChild(filterOpt);
                });
            }
            console.log("[API] Lookups loaded successfully.");
        }
    } catch (error) {
        console.error("[API] Error loading patient lookups:", error);
    }
};

const openGenderPicker = () => {
    openGenericLookupPicker({
        title: "Select Gender",
        items: allGenders.map(g => ({
            id: g.Gender_ID,
            text: g.Gender_Name
        })),
        selectedId: document.getElementById("gender_id").value,
        onSelect: (item) => {
            document.getElementById("gender_id").value = item.id;
            document.getElementById("gender_id_text").value = item.text;
            const isOther = (item.text || "").toLowerCase().includes("other") || String(item.id) === "3";
            const otherGroup = document.getElementById("gender_other_group");
            if (otherGroup) {
                otherGroup.style.display = isOther ? "block" : "none";
                if (isOther) {
                    const specInput = document.getElementById("gender_specification");
                    if (specInput) specInput.focus();
                } else {
                    const specInput = document.getElementById("gender_specification");
                    if (specInput) specInput.value = "";
                }
            }
        }
    });
};

const openBloodTypePicker = () => {
    openGenericLookupPicker({
        title: "Select Blood Type",
        items: allBloodTypes.map(b => ({
            id: b.Blood_Type_ID,
            text: b.Blood_Type_Name
        })),
        selectedId: document.getElementById("blood_type_id").value,
        onSelect: (item) => {
            document.getElementById("blood_type_id").value = item.id;
            document.getElementById("blood_type_id_text").value = item.text;
        }
    });
};

const displayPatients = async () => {
    const tableDiv = document.getElementById("table-div");

    try {
        console.log("[API] Requesting: getAllPatients");
        const response = await axios.get(`${getApiUrl}/patients.php`, {
            params: { 
                operation: "getAllPatients",
                json: JSON.stringify({
                    user_id: JSON.parse(sessionStorage.getItem("hospital_user") || "{}").user_id,
                    doctor_id: JSON.parse(sessionStorage.getItem("hospital_user") || "{}").doctor_id
                })
            }
        });

        if (response.status === 200) {
            allPatients = response.data || [];
            console.log(`[API] Success: Loaded ${allPatients.length} patients.`);
            filterAndSortPatients();
        } else {
            console.error("[API] Error loading patients:", response);
            alert("Error loading patient records!");
        }
    } catch (error) {
        console.error("[API] Network error:", error);
        tableDiv.innerHTML = `<p style="color: red;">Failed to connect to API.</p>`;
    }
};

const filterAndSortPatients = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();
    const filterStatus = document.getElementById("filter_status").value;
    const filterBlood = document.getElementById("filter_blood").value;
    const sortBy = document.getElementById("sort_by")?.value || "id_desc";

    let filtered = allPatients.filter(pat => {
        const fullName = `${pat.First_Name} ${pat.Last_Name}`.toLowerCase();
        const code = (pat.Patient_Code || "").toLowerCase();

        const matchesSearch = fullName.includes(searchTerm) || code.includes(searchTerm);

        let matchesStatus = true;
        if (filterStatus === "active" || filterStatus === "1") {
            matchesStatus = (pat.Is_Active == 1 && (!pat.Latest_Admission_Status || pat.Latest_Admission_Status === ""));
        } else if (filterStatus === "admitted") {
            matchesStatus = (pat.Is_Active == 1 && pat.Latest_Admission_Status === "Admitted");
        } else if (filterStatus === "discharged") {
            matchesStatus = (pat.Is_Active == 1 && (pat.Latest_Admission_Status === "Discharged" || pat.Latest_Admission_Status === "Billed"));
        } else if (filterStatus === "archived" || filterStatus === "0") {
            matchesStatus = (pat.Is_Active == 0);
        }

        let matchesBlood = true;
        if (filterBlood !== "all") matchesBlood = (pat.Blood_Type_ID == filterBlood);

        return matchesSearch && matchesStatus && matchesBlood;
    });

    filtered.sort((a, b) => {
        switch (sortBy) {
            case "code_asc":
                return a.Patient_Code.localeCompare(b.Patient_Code, undefined, { numeric: true });
            case "code_desc":
                return b.Patient_Code.localeCompare(a.Patient_Code, undefined, { numeric: true });
            case "name_asc":
                return a.Last_Name.localeCompare(b.Last_Name);
            case "name_desc":
                return b.Last_Name.localeCompare(a.Last_Name);
            case "dob_desc":
                return new Date(b.Date_Of_Birth) - new Date(a.Date_Of_Birth);
            case "dob_asc":
                return new Date(a.Date_Of_Birth) - new Date(b.Date_Of_Birth);
            case "id_desc":
                return parseInt(b.Patient_ID) - parseInt(a.Patient_ID);
            default:
                return 0;
        }
    });

    console.log(`[UI] Displaying ${filtered.length} of ${allPatients.length} patients.`);
    if (typeof updateFilterCount === "function") {
        updateFilterCount(filtered.length, allPatients.length, "patients");
    }
    displayPatientsTable(filtered);
};

const displayPatientsTable = (patients) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!patients || patients.length === 0) {
        tableDiv.innerHTML = typeof getEmptyStateHtml === "function"
            ? getEmptyStateHtml("👤", "No matching patient records found", "Try adjusting your search query, status filter, or blood type.")
            : "<p>No matching patient records found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            ${renderSortableTh("Patient Code & Record", "Patient_Code")}
            ${renderSortableTh("Full Name & Demographics", "Last_Name")}
            ${renderSortableTh("Medical & Blood Profile", "Blood_Type")}
            ${renderSortableTh("Contact & Emergency", "Contact_Number")}
            ${renderSortableTh("Status", "Status")}
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    patients.forEach(pat => {
        const isActive = (pat.Is_Active == 1);
        const fullName = `${pat.Last_Name}, ${pat.First_Name}`;
        const emContact = pat.Emergency_Contact_Name ? `${pat.Emergency_Contact_Name} (${pat.Emergency_Contact_Number || 'N/A'})` : 'None';

        let statusBadge = "";
        if (!isActive) {
            statusBadge = '<span class="badge badge-danger">Archived</span>';
        } else if (pat.Latest_Admission_Status === "Admitted") {
            const bedHint = pat.Current_Bed_Code ? ` title="Current Bed Stay: ${pat.Current_Bed_Code} (${pat.Current_Room_Name || ''})"` : '';
            statusBadge = `<span class="badge badge-info"${bedHint}>Admitted</span>`;
        } else if (pat.Latest_Admission_Status === "Discharged" || pat.Latest_Admission_Status === "Billed") {
            statusBadge = '<span class="badge badge-warning">Discharged</span>';
        } else {
            statusBadge = '<span class="badge badge-success">Active</span>';
        }

        const bedInfoTitle = pat.Current_Bed_Code 
            ? `Current Bed: ${pat.Current_Bed_Code} (${pat.Current_Room_Name || ''}) - Click to view patient details` 
            : "Click to view patient details";

        const admCount = parseInt(pat.Total_Admissions || 0, 10);
        const admBadge = admCount > 0
            ? `<span class="badge badge-adm-count-pill">${admCount} Admission${admCount > 1 ? 's' : ''}</span>`
            : `<span class="badge badge-adm-none-pill">No Prior Admissions</span>`;

        const bedDisplay = pat.Current_Bed_Code
            ? `<span class="table-sub-text text-primary">Bed: <strong>${pat.Current_Bed_Code}</strong> (${pat.Current_Room_Name || ''})</span>`
            : '';

        const row = document.createElement("tr");
        row.className = "clickable-row";
        row.title = bedInfoTitle;
        row.innerHTML = `
            <td><span class="table-primary-text text-primary">${pat.Patient_Code}</span>${admBadge}</td>
            <td><span class="table-primary-text">${fullName}</span><span class="table-sub-text">${pat.Gender_Name}${pat.Gender_Specification ? ` (${pat.Gender_Specification})` : ''} • DOB: ${pat.Date_Of_Birth}</span></td>
            <td><span class="badge badge-info">Blood: ${pat.Blood_Type_Name || 'N/A'}</span>${bedDisplay}</td>
            <td><span class="table-primary-text">${pat.Contact_Number || 'No phone'}</span><span class="table-sub-text">Emergency: ${emContact}</span></td>
            <td>${statusBadge}</td>
        `;
        row.addEventListener("click", () => openViewPatientModal(pat.Patient_ID));
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);
};

const populatePatientForm = (p) => {
    document.getElementById("patient_id").value = p.Patient_ID || "";
    document.getElementById("first_name").value = p.First_Name || "";
    document.getElementById("last_name").value = p.Last_Name || "";
    document.getElementById("date_of_birth").value = p.Date_Of_Birth || "";
    document.getElementById("gender_id").value = p.Gender_ID || "";
    if (p.Gender_ID) {
        const g = allGenders.find(gen => gen.Gender_ID == p.Gender_ID);
        document.getElementById("gender_id_text").value = g ? g.Gender_Name : "";
    } else {
        document.getElementById("gender_id_text").value = "";
    }
    document.getElementById("blood_type_id").value = p.Blood_Type_ID || "";
    if (p.Blood_Type_ID) {
        const b = allBloodTypes.find(bt => bt.Blood_Type_ID == p.Blood_Type_ID);
        document.getElementById("blood_type_id_text").value = b ? b.Blood_Type_Name : "";
    } else {
        document.getElementById("blood_type_id_text").value = "";
    }
    document.getElementById("contact_number").value = p.Contact_Number || "";
    document.getElementById("address").value = p.Address || "";
    document.getElementById("emergency_contact_name").value = p.Emergency_Contact_Name || "";
    document.getElementById("emergency_contact_number").value = p.Emergency_Contact_Number || "";

    const isOther = (p.Gender_ID == 3);
    const otherGroup = document.getElementById("gender_other_group");
    const specInput = document.getElementById("gender_specification");
    if (otherGroup) otherGroup.style.display = isOther ? "block" : "none";
    if (specInput) specInput.value = p.Gender_Specification || "";
};

const loadPatientForEdit = async (patientId) => {
    try {
        console.log(`[API] Requesting patient details for ID: ${patientId}`);
        const response = await axios.get(`${getApiUrl}/patients.php`, {
            params: {
                operation: "getPatientById",
                json: JSON.stringify({ patient_id: patientId })
            }
        });

        if (response.status === 200 && response.data) {
            const p = response.data;
            currentLoadedPatient = p;
            populatePatientForm(p);

            document.getElementById("form-title").textContent = `Edit Patient Details (${p.Patient_Code})`;
            document.getElementById("btnSubmit").textContent = "Update Patient";

            const btnArchive = document.getElementById("btnArchive");
            if (btnArchive) {
                btnArchive.style.display = "inline-flex";
                const isActive = (p.Is_Active == 1);
                btnArchive.className = isActive ? "btn btn-warning btn-archive" : "btn btn-success btn-restore";
                btnArchive.textContent = isActive ? "Send to Archive" : "Restore Record";
                btnArchive.onclick = () => {
                    const fullName = `${p.Last_Name}, ${p.First_Name}`;
                    toggleRecordStatus("patients.php", "patient_id", p.Patient_ID, isActive ? 1 : 0, fullName, () => {
                        closeModal("formModal");
                        displayPatients();
                    });
                };
            }

            openModal("formModal");
        }
    } catch (error) {
        console.error("[API] Error loading patient details:", error);
        alert("Failed to load patient record.");
    }
};

const savePatient = async () => {
    const patientId = document.getElementById("patient_id").value;
    const firstName = document.getElementById("first_name").value.trim();
    const lastName = document.getElementById("last_name").value.trim();
    const dob = document.getElementById("date_of_birth").value;
    const genderId = document.getElementById("gender_id").value;
    const bloodTypeId = document.getElementById("blood_type_id").value;
    const contact = document.getElementById("contact_number").value.trim();
    const address = document.getElementById("address").value.trim();
    const emName = document.getElementById("emergency_contact_name").value.trim();
    const emContact = document.getElementById("emergency_contact_number").value.trim();
    const genderSpec = document.getElementById("gender_specification") ? document.getElementById("gender_specification").value.trim() : "";

    if (!firstName || !lastName || !dob || !genderId || !bloodTypeId) {
        alert("Please fill in all required fields (First Name, Last Name, DOB, Gender, Blood Type).");
        return;
    }

    const validFirst = typeof validatePersonName === "function" ? validatePersonName(firstName, "First Name", true) : { valid: !/\d/.test(firstName) };
    if (!validFirst.valid) {
        alert(validFirst.message || "First Name cannot contain numbers. Please use letters only.");
        const el = document.getElementById("first_name");
        if (el) el.focus();
        return;
    }

    const validLast = typeof validatePersonName === "function" ? validatePersonName(lastName, "Last Name", true) : { valid: !/\d/.test(lastName) };
    if (!validLast.valid) {
        alert(validLast.message || "Last Name cannot contain numbers. Please use letters only.");
        const el = document.getElementById("last_name");
        if (el) el.focus();
        return;
    }

    if (contact) {
        const validContact = typeof validateContactNumber === "function" ? validateContactNumber(contact, "Contact Number", false) : { valid: !/[a-zA-Z]/.test(contact) };
        if (!validContact.valid) {
            alert(validContact.message || "Contact Number cannot contain letters. Please enter numbers only.");
            const el = document.getElementById("contact_number");
            if (el) el.focus();
            return;
        }
    }

    if (emName) {
        const validEmName = typeof validatePersonName === "function" ? validatePersonName(emName, "Emergency Contact Name", false) : { valid: !/\d/.test(emName) };
        if (!validEmName.valid) {
            alert(validEmName.message || "Emergency Contact Name cannot contain numbers.");
            const el = document.getElementById("emergency_contact_name");
            if (el) el.focus();
            return;
        }
    }

    if (emContact) {
        const validEmContact = typeof validateContactNumber === "function" ? validateContactNumber(emContact, "Emergency Contact Number", false) : { valid: !/[a-zA-Z]/.test(emContact) };
        if (!validEmContact.valid) {
            alert(validEmContact.message || "Emergency Contact Number cannot contain letters.");
            const el = document.getElementById("emergency_contact_number");
            if (el) el.focus();
            return;
        }
    }

    if (genderId == "3" && !genderSpec) {
        alert("Please specify the patient's gender preference.");
        const specInput = document.getElementById("gender_specification");
        if (specInput) specInput.focus();
        return;
    }

    const jsonData = {
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dob,
        gender_id: genderId,
        gender_specification: genderSpec,
        blood_type_id: bloodTypeId,
        contact_number: contact,
        address: address,
        emergency_contact_name: emName,
        emergency_contact_number: emContact
    };

    const isEdit = (patientId !== "");
    const operation = isEdit ? "updatePatient" : "insertPatient";

    if (!isEdit && !bypassDuplicateCheck) {
        const match = allPatients.find(p => 
            (p.First_Name || "").trim().toLowerCase() === firstName.toLowerCase() && 
            (p.Last_Name || "").trim().toLowerCase() === lastName.toLowerCase()
        );
        if (match) {
            openDuplicateModal(match);
            return;
        }
    }

    if (isEdit) {
        jsonData.patient_id = patientId;
    }

    console.log(`[Action] Submitting ${operation} via POST:`, jsonData);

    const formData = new FormData();
    formData.append("operation", operation);
    formData.append("json", JSON.stringify(jsonData));

    try {
        const response = await axios({
            url: `${postApiUrl}/patients.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] ${operation} completed successfully.`);
            bypassDuplicateCheck = false;
            alert(isEdit ? "Patient updated successfully!" : "Patient registered successfully!");
            resetForm();
            closeModal("formModal");
            displayPatients();
        } else {
            console.warn(`[Failed] ${operation} returned:`, response.data);
            alert("Error saving patient record.");
        }
    } catch (error) {
        console.error("[Error] Save request failed:", error);
        alert("Server error occurred.");
    }
};

const resetForm = () => {
    currentLoadedPatient = null;
    bypassDuplicateCheck = false;

    document.getElementById("patient_id").value = "";
    document.getElementById("first_name").value = "";
    document.getElementById("last_name").value = "";
    document.getElementById("date_of_birth").value = "";
    document.getElementById("gender_id").value = "";
    document.getElementById("gender_id_text").value = "";
    document.getElementById("blood_type_id").value = "";
    document.getElementById("blood_type_id_text").value = "";
    document.getElementById("contact_number").value = "";
    document.getElementById("address").value = "";
    document.getElementById("emergency_contact_name").value = "";
    document.getElementById("emergency_contact_number").value = "";

    const specInput = document.getElementById("gender_specification");
    if (specInput) specInput.value = "";
    const otherGroup = document.getElementById("gender_other_group");
    if (otherGroup) otherGroup.style.display = "none";

    const btnArchive = document.getElementById("btnArchive");
    if (btnArchive) btnArchive.style.display = "none";

    document.getElementById("form-title").textContent = "Register New Patient";
    document.getElementById("btnSubmit").textContent = "Submit Patient";
};
