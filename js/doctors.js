const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allDoctors = [];
let allDoctorTypes = [];
let allStations = [];
let allSpecialties = [];
let currentLoadedDoctor = null;
let selectedDoctorSpecialties = [];
let tempSelectedSpecialties = [];
let currentFilteredSpecialties = [];

document.addEventListener("DOMContentLoaded", () => {
    loadDoctorLookups();
    displayDoctors();

    initModalControls("formModal", "btnOpenAddModal", "btnCloseModal", "btnCancel", resetForm);
    document.getElementById("btnSubmit").addEventListener("click", saveDoctor);

    const docTypeInput = document.getElementById("doctor_type_id_text");
    if (docTypeInput) docTypeInput.addEventListener("click", openDoctorTypePicker);
    const btnBrowseDocType = document.getElementById("btnBrowse_doctor_type_id");
    if (btnBrowseDocType) btnBrowseDocType.addEventListener("click", openDoctorTypePicker);

    const stationInput = document.getElementById("station_id_text");
    if (stationInput) stationInput.addEventListener("click", openStationPicker);
    const btnBrowseStation = document.getElementById("btnBrowse_station_id");
    if (btnBrowseStation) btnBrowseStation.addEventListener("click", openStationPicker);

    const btnReset = document.getElementById("btnReset");
    if (btnReset) {
        btnReset.addEventListener("click", () => {
            if (currentLoadedDoctor) {
                populateDoctorForm(currentLoadedDoctor);
            } else {
                resetForm();
            }
        });
    }

    const btnBrowse = document.getElementById("btnBrowseSpecialties");
    if (btnBrowse) {
        btnBrowse.addEventListener("click", openSpecialtyPicker);
    }
    const txtSpecialties = document.getElementById("selected_specialties_text");
    if (txtSpecialties) {
        txtSpecialties.addEventListener("click", openSpecialtyPicker);
    }

    const btnClosePicker = document.getElementById("btnCloseSpecialtyPicker");
    if (btnClosePicker) {
        btnClosePicker.addEventListener("click", closeSpecialtyPicker);
    }
    const btnCancelPicker = document.getElementById("btnCancelSpecialtyPicker");
    if (btnCancelPicker) {
        btnCancelPicker.addEventListener("click", closeSpecialtyPicker);
    }
    const btnDonePicker = document.getElementById("btnDoneSpecialtyPicker");
    if (btnDonePicker) {
        btnDonePicker.addEventListener("click", confirmSpecialtyPicker);
    }

    const pickerSearch = document.getElementById("specialty_picker_search");
    if (pickerSearch) {
        pickerSearch.addEventListener("input", renderSpecialtyPickerRows);
    }
    const pickerFilter = document.getElementById("specialty_picker_filter");
    if (pickerFilter) {
        pickerFilter.addEventListener("change", renderSpecialtyPickerRows);
    }
    const pickerSort = document.getElementById("specialty_picker_sort");
    if (pickerSort) {
        pickerSort.addEventListener("change", renderSpecialtyPickerRows);
    }
    const selectAllCb = document.getElementById("specialty_picker_select_all");
    if (selectAllCb) {
        selectAllCb.addEventListener("change", (e) => {
            toggleSelectAllPickerSpecialties(e.target.checked);
        });
    }

    const pickerModal = document.getElementById("specialtyPickerModal");
    if (pickerModal) {
        pickerModal.addEventListener("click", (e) => {
            if (e.target === pickerModal) {
                closeSpecialtyPicker();
            }
        });
    }

    const btnCloseView = document.getElementById("btnCloseViewDoctorModal");
    if (btnCloseView) btnCloseView.addEventListener("click", closeViewDoctorModal);
    const btnCloseViewBtn = document.getElementById("btnCloseViewDoctorBtn");
    if (btnCloseViewBtn) btnCloseViewBtn.addEventListener("click", closeViewDoctorModal);
    const viewModal = document.getElementById("viewDoctorModal");
    if (viewModal) {
        viewModal.addEventListener("click", (e) => {
            if (e.target === viewModal) closeViewDoctorModal();
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            const pickerModal = document.getElementById("specialtyPickerModal");
            if (pickerModal && pickerModal.style.display === "flex") {
                e.stopPropagation();
                closeSpecialtyPicker();
                return;
            }
            const specModal = document.getElementById("specialtyModal");
            if (specModal && specModal.style.display === "flex") {
                e.stopPropagation();
                closeSpecialtyModal();
                return;
            }
            const viewDocModal = document.getElementById("viewDoctorModal");
            if (viewDocModal && viewDocModal.style.display === "flex") {
                e.stopPropagation();
                closeViewDoctorModal();
                return;
            }
        }
    });

    document.getElementById("search_input").addEventListener("input", filterAndSortDoctors);
    document.getElementById("filter_status").addEventListener("change", filterAndSortDoctors);
    document.getElementById("filter_type").addEventListener("change", filterAndSortDoctors);
    document.getElementById("filter_station").addEventListener("change", filterAndSortDoctors);
    const filterSpec = document.getElementById("filter_specialty");
    if (filterSpec) {
        filterSpec.addEventListener("change", filterAndSortDoctors);
    }
    document.getElementById("sort_by").addEventListener("change", filterAndSortDoctors);

    const btnOpenSpec = document.getElementById("btnOpenAddSpecialtyModal");
    if (btnOpenSpec) {
        btnOpenSpec.addEventListener("click", openSpecialtyModal);
    }

    const btnCloseSpec = document.getElementById("btnCloseSpecialtyModal");
    if (btnCloseSpec) {
        btnCloseSpec.addEventListener("click", closeSpecialtyModal);
    }

    const btnCancelSpec = document.getElementById("btnCancelSpecialty");
    if (btnCancelSpec) {
        btnCancelSpec.addEventListener("click", closeSpecialtyModal);
    }

    const btnSubmitSpec = document.getElementById("btnSubmitSpecialty");
    if (btnSubmitSpec) {
        btnSubmitSpec.addEventListener("click", submitNewSpecialty);
    }

    const btnCancelEditSpec = document.getElementById("btnCancelEditSpecialty");
    if (btnCancelEditSpec) {
        btnCancelEditSpec.addEventListener("click", cancelEditSpecialty);
    }

    const specModal = document.getElementById("specialtyModal");
    if (specModal) {
        specModal.addEventListener("click", (e) => {
            if (e.target === specModal) {
                closeSpecialtyModal();
            }
        });
    }

    const specInput = document.getElementById("new_specialty_name");
    if (specInput) {
        specInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                submitNewSpecialty();
            }
        });
    }
});

const updateSpecialtiesText = () => {
    const txt = document.getElementById("selected_specialties_text");
    if (!txt) return;

    if (!selectedDoctorSpecialties || selectedDoctorSpecialties.length === 0) {
        txt.value = "";
        return;
    }

    const names = [];
    selectedDoctorSpecialties.forEach(id => {
        const found = allSpecialties.find(s => String(s.Specialty_ID) === String(id));
        if (found) {
            names.push(found.Specialty_Name);
        }
    });

    txt.value = names.join(", ");
};

const openSpecialtyPicker = () => {
    tempSelectedSpecialties = [...selectedDoctorSpecialties];

    const searchInput = document.getElementById("specialty_picker_search");
    if (searchInput) {
        searchInput.value = "";
    }

    const filterSelect = document.getElementById("specialty_picker_filter");
    if (filterSelect) {
        filterSelect.value = "all";
    }

    const sortSelect = document.getElementById("specialty_picker_sort");
    if (sortSelect) {
        sortSelect.value = "name_asc";
    }

    renderSpecialtyPickerRows();

    const pickerModal = document.getElementById("specialtyPickerModal");
    if (pickerModal) {
        pickerModal.style.display = "flex";
        setTimeout(() => {
            if (searchInput) searchInput.focus();
        }, 50);
    }
};

const closeSpecialtyPicker = () => {
    const pickerModal = document.getElementById("specialtyPickerModal");
    if (pickerModal) {
        pickerModal.style.display = "none";
    }
    tempSelectedSpecialties = [];
};

const confirmSpecialtyPicker = () => {
    selectedDoctorSpecialties = [...tempSelectedSpecialties];
    updateSpecialtiesText();
    closeSpecialtyPicker();
};

const renderSpecialtyPickerRows = () => {
    const searchInput = document.getElementById("specialty_picker_search");
    const query = (searchInput ? searchInput.value : "").trim().toLowerCase();
    const filterSelect = document.getElementById("specialty_picker_filter");
    const filterVal = filterSelect ? filterSelect.value : "all";
    const sortSelect = document.getElementById("specialty_picker_sort");
    const sortBy = sortSelect ? sortSelect.value : "name_asc";

    const tbody = document.getElementById("specialty_picker_tbody");
    const emptyMsg = document.getElementById("specialty_picker_empty");
    const statusMsg = document.getElementById("specialty_picker_status");
    const selectAllCb = document.getElementById("specialty_picker_select_all");

    let list = allSpecialties.filter(s => {
        const sid = String(s.Specialty_ID);
        const isSelected = tempSelectedSpecialties.includes(sid);
        const matchesQuery = s.Specialty_Name.toLowerCase().includes(query);
        const isActiveOrSelected = (s.Is_Active == 1) || isSelected;

        let matchesFilter = true;
        if (filterVal === "selected") {
            matchesFilter = isSelected;
        } else if (filterVal === "unselected") {
            matchesFilter = !isSelected;
        }

        return matchesQuery && isActiveOrSelected && matchesFilter;
    });

    list.sort((a, b) => {
        const aSelected = tempSelectedSpecialties.includes(String(a.Specialty_ID));
        const bSelected = tempSelectedSpecialties.includes(String(b.Specialty_ID));

        if (sortBy === "selected_first") {
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            return a.Specialty_Name.localeCompare(b.Specialty_Name);
        } else if (sortBy === "name_desc") {
            return b.Specialty_Name.localeCompare(a.Specialty_Name);
        } else {
            return a.Specialty_Name.localeCompare(b.Specialty_Name);
        }
    });

    currentFilteredSpecialties = list;
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

        list.forEach(s => {
            const sid = String(s.Specialty_ID);
            const isSelected = tempSelectedSpecialties.includes(sid);

            const row = document.createElement("tr");
            row.className = `picker-row ${isSelected ? "selected-row" : ""}`;
            row.setAttribute("data-id", sid);

            const statusBadge = (s.Is_Active == 1)
                ? `<span class="badge badge-success" style="font-size: 11.5px; padding: 2px 8px;">Active</span>`
                : `<span class="badge badge-secondary" style="font-size: 11.5px; padding: 2px 8px;">Inactive</span>`;

            row.innerHTML = `
                <td style="text-align: center;">
                    <input type="checkbox" class="specialty-picker-cb" value="${sid}" ${isSelected ? "checked" : ""} style="cursor: pointer; pointer-events: none;">
                </td>
                <td><strong>${s.Specialty_Name}</strong></td>
                <td style="text-align: center;">${statusBadge}</td>
            `;

            row.addEventListener("click", () => {
                togglePickerSpecialty(sid);
            });

            tbody.appendChild(row);
        });

        const allVisibleSelected = list.every(s => tempSelectedSpecialties.includes(String(s.Specialty_ID)));
        const someVisibleSelected = list.some(s => tempSelectedSpecialties.includes(String(s.Specialty_ID)));

        if (selectAllCb) {
            selectAllCb.checked = allVisibleSelected;
            selectAllCb.indeterminate = (!allVisibleSelected && someVisibleSelected);
        }
    }

    if (statusMsg) {
        const count = tempSelectedSpecialties.length;
        statusMsg.textContent = count === 0 ? "No specialties selected" : `${count} specialt${count === 1 ? "y" : "ies"} selected`;
    }
};

const togglePickerSpecialty = (sid) => {
    sid = String(sid);
    const index = tempSelectedSpecialties.indexOf(sid);
    if (index > -1) {
        tempSelectedSpecialties.splice(index, 1);
    } else {
        tempSelectedSpecialties.push(sid);
    }

    const row = document.querySelector(`#specialty_picker_tbody tr[data-id="${sid}"]`);
    if (row) {
        const isNowSelected = tempSelectedSpecialties.includes(sid);
        const cb = row.querySelector(".specialty-picker-cb");
        if (cb) cb.checked = isNowSelected;
        if (isNowSelected) {
            row.classList.add("selected-row");
        } else {
            row.classList.remove("selected-row");
        }
    }

    const selectAllCb = document.getElementById("specialty_picker_select_all");
    if (selectAllCb && currentFilteredSpecialties.length > 0) {
        const allVisibleSelected = currentFilteredSpecialties.every(s => tempSelectedSpecialties.includes(String(s.Specialty_ID)));
        const someVisibleSelected = currentFilteredSpecialties.some(s => tempSelectedSpecialties.includes(String(s.Specialty_ID)));
        selectAllCb.checked = allVisibleSelected;
        selectAllCb.indeterminate = (!allVisibleSelected && someVisibleSelected);
    }

    const statusMsg = document.getElementById("specialty_picker_status");
    if (statusMsg) {
        const count = tempSelectedSpecialties.length;
        statusMsg.textContent = count === 0 ? "No specialties selected" : `${count} specialt${count === 1 ? "y" : "ies"} selected`;
    }
};

const toggleSelectAllPickerSpecialties = (checked) => {
    currentFilteredSpecialties.forEach(s => {
        const sid = String(s.Specialty_ID);
        const idx = tempSelectedSpecialties.indexOf(sid);
        if (checked) {
            if (idx === -1) tempSelectedSpecialties.push(sid);
        } else {
            if (idx > -1) tempSelectedSpecialties.splice(idx, 1);
        }
    });

    renderSpecialtyPickerRows();
};

const loadDoctorLookups = async () => {
    try {
        console.log("[API] Loading doctor lookups...");
        const response = await axios.get(`${getApiUrl}/doctors.php`, {
            params: { operation: "getDoctorLookups" }
        });

        if (response.status === 200 && response.data) {
            const data = response.data;
            allDoctorTypes = data.types || [];
            allStations = data.stations || [];
            allSpecialties = data.specialties || [];

            const filterType = document.getElementById("filter_type");
            if (filterType) {
                filterType.innerHTML = `<option value="all">All Classifications</option>`;
                allDoctorTypes.forEach(t => {
                    const filterOpt = document.createElement("option");
                    filterOpt.value = t.Doctor_Type_ID;
                    filterOpt.textContent = t.Type_Name;
                    filterType.appendChild(filterOpt);
                });
            }

            const filterStation = document.getElementById("filter_station");
            if (filterStation) {
                filterStation.innerHTML = `<option value="all">All Stations</option>`;
                allStations.forEach(st => {
                    const filterOpt = document.createElement("option");
                    filterOpt.value = st.Station_ID;
                    filterOpt.textContent = st.Station_Name;
                    filterStation.appendChild(filterOpt);
                });
            }

            const filterSpec = document.getElementById("filter_specialty");
            if (filterSpec) {
                filterSpec.innerHTML = `<option value="all">All Specialties</option>`;
                allSpecialties.forEach(s => {
                    const filterOpt = document.createElement("option");
                    filterOpt.value = s.Specialty_ID;
                    filterOpt.textContent = s.Specialty_Name;
                    filterSpec.appendChild(filterOpt);
                });
            }
        }
    } catch (error) {
        console.error("[API] Error loading doctor lookups:", error);
    }
};

const openDoctorTypePicker = async () => {
    if (!allDoctorTypes || allDoctorTypes.length === 0) {
        await loadDoctorLookups();
    }
    openGenericLookupPicker({
        title: "Select Doctor Classification",
        items: allDoctorTypes.map(t => ({
            id: t.Doctor_Type_ID,
            text: t.Type_Name
        })),
        selectedId: document.getElementById("doctor_type_id").value,
        onSelect: (item) => {
            document.getElementById("doctor_type_id").value = item.id;
            document.getElementById("doctor_type_id_text").value = item.text;
        }
    });
};

const openStationPicker = async () => {
    if (!allStations || allStations.length === 0) {
        await loadDoctorLookups();
    }
    openGenericLookupPicker({
        title: "Select Department / Station",
        items: allStations.map(st => ({
            id: st.Station_ID,
            text: st.Station_Name,
            subtext: st.Code_Prefix ? `Code: ${st.Code_Prefix}` : ""
        })),
        selectedId: document.getElementById("station_id").value,
        onSelect: (item) => {
            document.getElementById("station_id").value = item.id;
            document.getElementById("station_id_text").value = item.text;
        }
    });
};

const displayDoctors = async () => {
    const tableDiv = document.getElementById("table-div");

    try {
        console.log("[API] Requesting: getAllDoctors");
        const response = await axios.get(`${getApiUrl}/doctors.php`, {
            params: { operation: "getAllDoctors" }
        });

        if (response.status === 200) {
            allDoctors = response.data || [];
            console.log(`[API] Success: Loaded ${allDoctors.length} doctors.`);
            filterAndSortDoctors();
        } else {
            alert("Error loading doctor records!");
        }
    } catch (error) {
        console.error("[API] Error in displayDoctors:", error);
        tableDiv.innerHTML = `<p style="color: red;">Failed to load doctor records. Please refresh the page.</p>`;
    }
};

const filterAndSortDoctors = () => {
    const searchInput = document.getElementById("search_input");
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const filterStatusElem = document.getElementById("filter_status");
    const filterStatus = filterStatusElem ? filterStatusElem.value : "all";
    const filterTypeElem = document.getElementById("filter_type");
    const filterType = filterTypeElem ? filterTypeElem.value : "all";
    const filterStationElem = document.getElementById("filter_station");
    const filterStation = filterStationElem ? filterStationElem.value : "all";
    const filterSpecElem = document.getElementById("filter_specialty");
    const filterSpec = filterSpecElem ? filterSpecElem.value : "all";
    const sortByElem = document.getElementById("sort_by");
    const sortBy = sortByElem ? sortByElem.value : "name_asc";

    let filtered = allDoctors.filter(doc => {
        const name = `${doc.First_Name} ${doc.Last_Name}`.toLowerCase();
        const code = (doc.Formatted_Code || "").toLowerCase();

        const matchesSearch = name.includes(searchTerm) || code.includes(searchTerm);

        let matchesStatus = true;
        if (filterStatus === "1") matchesStatus = (doc.Is_Active == 1);
        else if (filterStatus === "0") matchesStatus = (doc.Is_Active == 0);

        let matchesType = true;
        if (filterType !== "all") matchesType = (doc.Doctor_Type_ID == filterType);

        let matchesStation = true;
        if (filterStation !== "all") matchesStation = (doc.Station_ID == filterStation);

        let matchesSpec = true;
        if (filterSpec !== "all") {
            const specIds = (doc.Specialty_IDs || "").split(",");
            matchesSpec = specIds.includes(filterSpec);
        }

        return matchesSearch && matchesStatus && matchesType && matchesStation && matchesSpec;
    });

    filtered.sort((a, b) => {
        switch (sortBy) {
            case "code_asc":
                return a.Formatted_Code.localeCompare(b.Formatted_Code, undefined, { numeric: true });
            case "code_desc":
                return b.Formatted_Code.localeCompare(a.Formatted_Code, undefined, { numeric: true });
            case "name_asc":
                return a.Last_Name.localeCompare(b.Last_Name);
            case "name_desc":
                return b.Last_Name.localeCompare(a.Last_Name);
            case "fee_asc":
                return parseFloat(a.Base_Round_Fee) - parseFloat(b.Base_Round_Fee);
            case "fee_desc":
                return parseFloat(b.Base_Round_Fee) - parseFloat(a.Base_Round_Fee);
            case "id_desc":
                return parseInt(b.Doctor_ID) - parseInt(a.Doctor_ID);
            default:
                return 0;
        }
    });

    displayDoctorsTable(filtered);
};

const displayDoctorsTable = (doctors) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!doctors || doctors.length === 0) {
        tableDiv.innerHTML = "<p>No matching doctors found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Code</th>
            <th>Doctor Full Name</th>
            <th>Classification</th>
            <th>Station</th>
            <th>Medical Specialties</th>
            <th>Base Round Fee</th>
            <th>Status</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    doctors.forEach(doc => {
        const fullName = `Dr. ${doc.First_Name} ${doc.Last_Name}`;

        const row = document.createElement("tr");
        row.className = "clickable-row";
        row.title = "Click to view doctor details & assigned patients";
        row.innerHTML = `
            <td><strong>${doc.Formatted_Code}</strong></td>
            <td><strong>${fullName}</strong></td>
            <td><span class="badge badge-primary">${doc.Doctor_Type_Name}</span></td>
            <td>${doc.Station_Name}</td>
            <td><small>${doc.Specialties || 'General Practice'}</small></td>
            <td>₱ ${parseFloat(doc.Base_Round_Fee).toFixed(2)}</td>
            <td>${getStatusBadge(doc.Is_Active)}</td>
        `;
        row.addEventListener("click", () => openViewDoctorModal(doc.Doctor_ID));
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);
};

const openViewDoctorModal = async (doctorId) => {
    try {
        console.log(`[API] Fetching doctor details for ID: ${doctorId}`);
        const response = await axios.get(`${getApiUrl}/doctors.php`, {
            params: {
                operation: "getDoctorById",
                json: JSON.stringify({ doctor_id: doctorId })
            }
        });

        if (response.status === 200 && response.data) {
            const doc = response.data;
            currentLoadedDoctor = doc;

            const fullName = `Dr. ${doc.First_Name} ${doc.Last_Name}`;
            const codeFormatted = doc.Formatted_Code || `DOC-${String(doc.Doctor_ID).padStart(3, '0')}`;

            document.getElementById("view-doc-title").textContent = `Doctor Details (${codeFormatted})`;
            document.getElementById("view_doc_name").textContent = fullName;
            document.getElementById("view_doc_code").textContent = `Code: ${codeFormatted}`;
            document.getElementById("view_doc_type_badge").textContent = doc.Doctor_Type_Name || "Physician";
            document.getElementById("view_doc_station").textContent = `Station: ${doc.Station_Name || "Unassigned"}`;
            document.getElementById("view_doc_fee").textContent = `Fee: ₱ ${parseFloat(doc.Base_Round_Fee || 0).toFixed(2)} / round`;
            document.getElementById("view_doc_specialties").textContent = doc.Specialties || "General Practice";

            const badge = document.getElementById("view_doc_status_badge");
            if (badge) {
                const isActive = (doc.Is_Active == 1);
                badge.className = isActive ? "badge badge-success" : "badge badge-danger";
                badge.textContent = isActive ? "Active" : "Archived";
            }

            const assigned = doc.assigned_patients || [];
            const activeCount = (doc.active_patients || []).length;
            const countElem = document.getElementById("view_doc_patients_count");
            const emptyElem = document.getElementById("view_doc_patients_empty");
            const tbody = document.getElementById("view_doc_patients_tbody");

            if (countElem) {
                countElem.textContent = `${assigned.length} Assigned (${activeCount} Active)`;
            }

            if (tbody) {
                tbody.innerHTML = "";
                if (assigned.length === 0) {
                    if (emptyElem) emptyElem.style.display = "block";
                } else {
                    if (emptyElem) emptyElem.style.display = "none";
                    assigned.forEach(p => {
                        const tr = document.createElement("tr");
                        tr.className = "clickable-row";
                        tr.title = `Click to open clinical chart & ledger for ${p.First_Name} ${p.Last_Name} (${p.Admission_Code || 'ADM-' + String(p.Admission_ID).padStart(3, '0')})`;

                        const isAdmitted = (p.Admission_Status === "Admitted");
                        const statusBadge = isAdmitted
                            ? '<span class="badge badge-success">Admitted</span>'
                            : `<span class="badge badge-secondary">${p.Admission_Status || 'Discharged'}</span>`;

                        const bedLocation = p.Bed_Code
                            ? `${p.Bed_Code} (${p.Room_Name || ''})`
                            : (isAdmitted ? "Bed Pending" : "Discharged");
                        const bedBadgeClass = isAdmitted ? "badge badge-primary" : "badge badge-secondary";

                        const patName = `${p.First_Name} ${p.Last_Name} <small style="color: var(--text-muted);">(${p.Patient_Code})</small>`;
                        const admCode = `<strong>${p.Admission_Code || ('ADM-' + String(p.Admission_ID).padStart(3, '0'))}</strong>`;
                        const diagnosis = p.Diagnosis || p.Chief_Complaint || "N/A";
                        const admDate = p.Formatted_Admission_Date || "N/A";

                        tr.innerHTML = `
                            <td><strong style="color: var(--primary);">${patName}</strong></td>
                            <td>${admCode}</td>
                            <td><span class="${bedBadgeClass}">${bedLocation}</span></td>
                            <td>${diagnosis}</td>
                            <td>${admDate}</td>
                            <td>${statusBadge}</td>
                        `;

                        tr.addEventListener("click", () => {
                            window.location.href = `admission_details.html?id=${p.Admission_ID}`;
                        });

                        tbody.appendChild(tr);
                    });
                }
            }

            const btnEdit = document.getElementById("btnOpenEditFromDoctorView");
            if (btnEdit) {
                btnEdit.onclick = () => {
                    closeViewDoctorModal();
                    loadDoctorForEdit(doctorId);
                };
            }

            openModal("viewDoctorModal");
        }
    } catch (error) {
        console.error("[API] Error fetching doctor details:", error);
        alert("Failed to load doctor details.");
    }
};

const closeViewDoctorModal = () => {
    closeModal("viewDoctorModal");
};

const populateDoctorForm = (doc) => {
    document.getElementById("doctor_id").value = doc.Doctor_ID || "";
    document.getElementById("first_name").value = doc.First_Name || "";
    document.getElementById("last_name").value = doc.Last_Name || "";
    document.getElementById("doctor_type_id").value = doc.Doctor_Type_ID || "";
    if (doc.Doctor_Type_ID) {
        const t = allDoctorTypes.find(dt => String(dt.Doctor_Type_ID) === String(doc.Doctor_Type_ID));
        document.getElementById("doctor_type_id_text").value = t ? t.Type_Name : "";
    } else {
        document.getElementById("doctor_type_id_text").value = "";
    }
    document.getElementById("station_id").value = doc.Station_ID || "";
    if (doc.Station_ID) {
        const st = allStations.find(s => String(s.Station_ID) === String(doc.Station_ID));
        document.getElementById("station_id_text").value = st ? st.Station_Name : "";
    } else {
        document.getElementById("station_id_text").value = "";
    }
    document.getElementById("base_round_fee").value = doc.Base_Round_Fee || "";

    const assignedSpecs = doc.specialty_ids_array || [];
    selectedDoctorSpecialties = assignedSpecs.map(id => String(id));
    updateSpecialtiesText();
};

const loadDoctorForEdit = async (doctorId) => {
    try {
        console.log(`[API] Requesting doctor details for ID: ${doctorId}`);
        const response = await axios.get(`${getApiUrl}/doctors.php`, {
            params: {
                operation: "getDoctorById",
                json: JSON.stringify({ doctor_id: doctorId })
            }
        });

        if (response.status === 200 && response.data) {
            const doc = response.data;
            currentLoadedDoctor = doc;
            populateDoctorForm(doc);

            document.getElementById("form-title").textContent = `Edit Doctor (DOC-${String(doc.Doctor_ID).padStart(3, '0')})`;
            document.getElementById("btnSubmit").textContent = "Update Doctor";

            const btnArchive = document.getElementById("btnArchive");
            if (btnArchive) {
                btnArchive.style.display = "inline-flex";
                const isActive = (doc.Is_Active == 1);
                btnArchive.className = isActive ? "btn btn-warning btn-archive" : "btn btn-success btn-restore";
                btnArchive.textContent = isActive ? "Send to Archive" : "Restore Record";
                btnArchive.onclick = () => {
                    const fullName = `Dr. ${doc.First_Name} ${doc.Last_Name}`;
                    toggleRecordStatus("doctors.php", "doctor_id", doc.Doctor_ID, isActive ? 1 : 0, fullName, () => {
                        closeModal();
                        displayDoctors();
                    });
                };
            }

            openModal();
        }
    } catch (error) {
        console.error("[API] Error loading doctor details:", error);
        alert("Failed to load doctor record.");
    }
};

const saveDoctor = async () => {
    const doctorId = document.getElementById("doctor_id").value;
    const firstName = document.getElementById("first_name").value.trim();
    const lastName = document.getElementById("last_name").value.trim();
    const typeId = document.getElementById("doctor_type_id").value;
    const stationId = document.getElementById("station_id").value;
    const fee = document.getElementById("base_round_fee").value;

    if (!firstName || !lastName || !typeId || !stationId || fee === "") {
        alert("Please fill in First Name, Last Name, Classification, Station, and Base Round Fee.");
        return;
    }

    if (!selectedDoctorSpecialties || selectedDoctorSpecialties.length === 0) {
        alert("Please select at least one medical specialty.");
        return;
    }

    const jsonData = {
        first_name: firstName,
        last_name: lastName,
        doctor_type_id: typeId,
        station_id: stationId,
        base_round_fee: parseFloat(fee),
        specialty_ids: selectedDoctorSpecialties
    };

    const isEdit = (doctorId !== "");
    const operation = isEdit ? "updateDoctor" : "insertDoctor";

    if (isEdit) {
        jsonData.doctor_id = doctorId;
    }

    console.log(`[Action] Submitting ${operation} via POST:`, jsonData);

    const formData = new FormData();
    formData.append("operation", operation);
    formData.append("json", JSON.stringify(jsonData));

    try {
        const response = await axios({
            url: `${postApiUrl}/doctors.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            alert(isEdit ? "Doctor updated successfully!" : "Doctor registered successfully!");
            resetForm();
            closeModal();
            displayDoctors();
        } else {
            alert("Error saving doctor record.");
        }
    } catch (error) {
        console.error("[Error] Save failed:", error);
        alert("Server error occurred.");
    }
};

const resetForm = () => {
    currentLoadedDoctor = null;

    document.getElementById("doctor_id").value = "";
    document.getElementById("first_name").value = "";
    document.getElementById("last_name").value = "";
    document.getElementById("doctor_type_id").value = "";
    document.getElementById("doctor_type_id_text").value = "";
    document.getElementById("station_id").value = "";
    document.getElementById("station_id_text").value = "";
    document.getElementById("base_round_fee").value = "";

    selectedDoctorSpecialties = [];
    updateSpecialtiesText();

    const btnArchive = document.getElementById("btnArchive");
    if (btnArchive) btnArchive.style.display = "none";

    document.getElementById("form-title").textContent = "Add New Doctor";
    document.getElementById("btnSubmit").textContent = "Submit Doctor";
};

const openSpecialtyModal = () => {
    const specModal = document.getElementById("specialtyModal");
    if (specModal) {
        cancelEditSpecialty();
        renderSpecialtiesManageList();
        specModal.style.display = "flex";
        document.getElementById("new_specialty_name").focus();
    }
};

const closeSpecialtyModal = () => {
    const specModal = document.getElementById("specialtyModal");
    if (specModal) {
        specModal.style.display = "none";
        cancelEditSpecialty();
    }
};

const startEditSpecialty = (s) => {
    document.getElementById("edit_specialty_id").value = s.Specialty_ID;
    document.getElementById("new_specialty_name").value = s.Specialty_Name;

    const modeTitle = document.getElementById("spec_form_mode_title");
    if (modeTitle) {
        modeTitle.innerHTML = `<span>✎</span> Edit Specialty: <strong>${s.Specialty_Name}</strong>`;
    }
    const btnSubmit = document.getElementById("btnSubmitSpecialty");
    if (btnSubmit) {
        btnSubmit.textContent = "💾 Save Changes";
    }
    const btnCancelEdit = document.getElementById("btnCancelEditSpecialty");
    if (btnCancelEdit) {
        btnCancelEdit.style.display = "inline-block";
    }

    document.getElementById("new_specialty_name").focus();
};

const cancelEditSpecialty = () => {
    const editIdInput = document.getElementById("edit_specialty_id");
    if (editIdInput) editIdInput.value = "";
    const nameInput = document.getElementById("new_specialty_name");
    if (nameInput) nameInput.value = "";

    const modeTitle = document.getElementById("spec_form_mode_title");
    if (modeTitle) {
        modeTitle.innerHTML = `<span>➕</span> Add New Specialty`;
    }
    const btnSubmit = document.getElementById("btnSubmitSpecialty");
    if (btnSubmit) {
        btnSubmit.textContent = "+ Add Specialty";
    }
    const btnCancelEdit = document.getElementById("btnCancelEditSpecialty");
    if (btnCancelEdit) {
        btnCancelEdit.style.display = "none";
    }
};

const renderSpecialtiesManageList = () => {
    const listContainer = document.getElementById("specialties-manage-list");
    const countBadge = document.getElementById("specialties_badge_count");
    if (countBadge) {
        countBadge.textContent = `${allSpecialties ? allSpecialties.length : 0} Active`;
    }
    if (!listContainer) return;
    listContainer.innerHTML = "";

    if (!allSpecialties || allSpecialties.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 25px 15px; color: var(--text-muted); background: #ffffff; border-radius: 6px; border: 1px dashed var(--border-color);">
                <div style="font-size: 24px; margin-bottom: 6px;">🩺</div>
                <div style="font-weight: 600; font-size: 13.5px; color: var(--text-main);">No medical specialties found</div>
                <div style="font-size: 12px; margin-top: 2px;">Add your first specialty using the form above.</div>
            </div>
        `;
        return;
    }

    allSpecialties.forEach(s => {
        const item = document.createElement("div");
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        item.style.padding = "10px 12px";
        item.style.background = "#ffffff";
        item.style.border = "1px solid var(--border-color)";
        item.style.borderRadius = "6px";
        item.style.boxShadow = "0 1px 2px rgba(0,0,0,0.02)";
        item.style.transition = "all 0.15s ease";
        item.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="font-size: 14px; font-weight: 700; color: var(--text-main);">${s.Specialty_Name}</span>
                    <span class="badge" style="background: #f0fdf4; color: #15803d; font-weight: 600; font-size: 11px; padding: 2px 7px; border-radius: 4px; border: 1px solid #bbf7d0;">Active</span>
                </div>
                <div style="font-size: 11.5px; color: var(--text-muted);">Clinical practice credential</div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
                <button type="button" class="btn btn-sm btn-outline btn-edit-spec" style="width: 28px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; border-radius: 5px; color: var(--text-main);" title="Edit Specialty" aria-label="Edit">✎</button>
                <button type="button" class="btn btn-sm btn-outline btn-remove-spec" style="width: 28px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--danger); border-color: #fecaca; border-radius: 5px;" title="Remove Specialty" aria-label="Remove">✕</button>
            </div>
        `;

        const btnEdit = item.querySelector(".btn-edit-spec");
        btnEdit.addEventListener("click", () => {
            startEditSpecialty(s);
        });

        const btnRemove = item.querySelector(".btn-remove-spec");
        btnRemove.addEventListener("click", () => {
            promptRemoveSpecialty(s.Specialty_ID, s.Specialty_Name);
        });

        listContainer.appendChild(item);
    });
};

const promptRemoveSpecialty = (specialtyId, specialtyName) => {
    showPopupConfirm(`Are you sure you want to remove the medical specialty "${specialtyName}"?\n\nIf any physicians currently hold this specialty, it will be safely deactivated so their profiles remain accurate.`, async () => {
        try {
            const formData = new FormData();
            formData.append("operation", "removeSpecialty");
            formData.append("json", JSON.stringify({ specialty_id: specialtyId }));

            const response = await axios.post(`${postApiUrl}/specialties.php`, formData);
            if (response.data && response.data.success) {
                allSpecialties = allSpecialties.filter(s => parseInt(s.Specialty_ID) !== parseInt(specialtyId));

                selectedDoctorSpecialties = selectedDoctorSpecialties.filter(id => parseInt(id) !== parseInt(specialtyId));
                updateSpecialtiesText();

                const filterSpec = document.getElementById("filter_specialty");
                if (filterSpec) {
                    const filterOpt = filterSpec.querySelector(`option[value="${specialtyId}"]`);
                    if (filterOpt) filterOpt.remove();
                }

                cancelEditSpecialty();
                renderSpecialtiesManageList();
                alert(response.data.message);
            } else {
                alert(response.data?.message || "Failed to remove specialty.");
            }
        } catch (error) {
            console.error("[API] Error removing specialty:", error);
            alert("Server error while removing specialty.");
        }
    }, null, {
        title: "Remove Specialty",
        confirmText: "Remove Specialty",
        type: "warning"
    });
};

const submitNewSpecialty = async () => {
    const editIdInput = document.getElementById("edit_specialty_id");
    const editId = editIdInput ? editIdInput.value.trim() : "";

    const specInput = document.getElementById("new_specialty_name");
    const name = specInput.value.trim();

    if (!name) {
        alert("Please enter a specialty name.");
        specInput.focus();
        return;
    }

    try {
        const formData = new FormData();
        const isEdit = Boolean(editId);
        formData.append("operation", isEdit ? "updateSpecialty" : "insertSpecialty");
        const payload = { specialty_name: name };
        if (isEdit) {
            payload.specialty_id = parseInt(editId);
        }
        formData.append("json", JSON.stringify(payload));

        const response = await axios.post(`${postApiUrl}/specialties.php`, formData);

        if (response.data) {
            const specId = response.data.specialty_id || editId;
            const specName = response.data.specialty_name || name;

            if (response.data.already_existed && !response.data.reactivated) {
                if (!selectedDoctorSpecialties.includes(String(specId))) {
                    selectedDoctorSpecialties.push(String(specId));
                    updateSpecialtiesText();
                }
                closeSpecialtyModal();
                alert(response.data.message);
                return;
            }

            if (response.data.success) {
                const existsIndex = allSpecialties.findIndex(s => parseInt(s.Specialty_ID) === parseInt(specId));
                if (existsIndex >= 0) {
                    allSpecialties[existsIndex].Specialty_Name = specName;
                } else {
                    allSpecialties.push({ Specialty_ID: specId, Specialty_Name: specName, Is_Active: 1 });
                    allSpecialties.sort((a, b) => a.Specialty_Name.localeCompare(b.Specialty_Name));
                }

                updateSpecialtiesText();

                const filterSpec = document.getElementById("filter_specialty");
                if (filterSpec) {
                    const opt = filterSpec.querySelector(`option[value="${specId}"]`);
                    if (opt) {
                        opt.textContent = specName;
                    } else {
                        const newOpt = document.createElement("option");
                        newOpt.value = specId;
                        newOpt.textContent = specName;
                        filterSpec.appendChild(newOpt);
                    }
                }

                cancelEditSpecialty();
                renderSpecialtiesManageList();
                if (!isEdit) {
                    if (!selectedDoctorSpecialties.includes(String(specId))) {
                        selectedDoctorSpecialties.push(String(specId));
                        updateSpecialtiesText();
                    }
                }
                alert(response.data.message);
            } else {
                alert(response.data.error || response.data.message || "Failed to save specialty.");
            }
        }
    } catch (error) {
        console.error("[API] Error saving specialty:", error);
        alert("Server error saving specialty.");
    }
};

