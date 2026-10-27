let cachedDeptOrders = [];
let activeStageFilter = 'all';
let currentSearchQuery = '';
let currentSortOption = 'stage';
let selectedStationId = 0;
let activeNursesList = [];
let selectedNurseUserId = 0;




const getOrderProcessStage = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'requested' || s === 'pending') return 'requested';
    if (s === 'preparing') return 'preparing';
    if (s === 'prepared') return 'prepared';
    if (s === 'delivering' || s === 'in transit') return 'delivering';
    if (s === 'administered') return 'administered';
    if (s === 'cancelled') return 'cancelled';
    return 'requested';
};

const getStageRank = (status) => {
    const stage = getOrderProcessStage(status);
    switch (stage) {
        case 'requested': return 1;
        case 'preparing': return 2;
        case 'prepared': return 3;
        case 'delivering': return 4;
        case 'administered': return 5;
        case 'cancelled': return 6;
        default: return 7;
    }
};

const renderTrackingStepper = (o) => {
    const isScan = (o.Category_Type === 'Equipment Scan' || o.Category_Type === 'Service');
    const stage = getOrderProcessStage(o.Status);

    const step1Title = 'Requested';
    const step2Title = isScan ? 'Preparing Equipment' : 'Preparing';
    const step3Title = isScan ? 'Equipment Ready' : 'Prepared';
    const step4Title = isScan ? 'Escorting Patient' : 'Delivering';
    const step5Title = isScan ? 'Scan Completed' : 'Administered';

    let s1State = 'is-complete';
    let s2State = '';
    let s3State = '';
    let s4State = '';
    let s5State = '';

    if (stage === 'requested') {
        s1State = 'is-active step-requested';
    } else if (stage === 'preparing') {
        s1State = 'is-complete';
        s2State = 'is-active step-preparing';
    } else if (stage === 'prepared') {
        s1State = 'is-complete';
        s2State = 'is-complete';
        s3State = 'is-active step-prepared';
    } else if (stage === 'delivering') {
        s1State = 'is-complete';
        s2State = 'is-complete';
        s3State = 'is-complete';
        s4State = 'is-active step-delivering';
    } else if (stage === 'administered') {
        s1State = 'is-complete';
        s2State = 'is-complete';
        s3State = 'is-complete';
        s4State = 'is-complete';
        s5State = 'is-complete step-administered is-active';
    } else if (stage === 'cancelled') {
        return '<span class="badge badge-process badge-process-cancelled">Order Cancelled</span>';
    }

    let badgeClass = 'badge-process-requested';
    let badgeText = isScan ? 'Scan Requested' : 'Requested';
    if (stage === 'preparing') {
        badgeClass = 'badge-process-preparing';
        badgeText = isScan ? 'Preparing Equipment' : 'Department Preparing';
    } else if (stage === 'prepared') {
        badgeClass = 'badge-process-prepared';
        badgeText = isScan ? 'Equipment Ready (Nurse Dispatched)' : 'Prepared (Ready for Pickup)';
    } else if (stage === 'delivering') {
        badgeClass = 'badge-process-delivering';
        badgeText = isScan ? 'Escorting Patient to Scan' : 'Out for Delivery';
    } else if (stage === 'administered') {
        badgeClass = 'badge-process-administered';
        badgeText = isScan ? 'Scan Completed & Recorded' : 'Delivered & Administered';
    }

    let trackerMeta = '';
    if (stage === 'requested') {
        trackerMeta = `Awaiting ${o.Target_Station_Name || 'Department'} to start preparation`;
    } else if (stage === 'preparing') {
        trackerMeta = `${o.Prepared_By_Name ? o.Prepared_By_Name : 'Staff'} preparing in ${o.Target_Station_Name || 'Department'}`;
    } else if (stage === 'prepared') {
        trackerMeta = o.Assigned_Nurse_Name ? `Assigned to Nurse: <strong>${o.Assigned_Nurse_Name}</strong>` : 'Ready for nurse pickup';
    } else if (stage === 'delivering') {
        trackerMeta = isScan ? `Nurse ${o.Assigned_Nurse_Name || ''} escorting patient to ${o.Target_Station_Name || 'Suite'}` : `Nurse ${o.Assigned_Nurse_Name || ''} en route to patient`;
    } else if (stage === 'administered') {
        trackerMeta = `Completed & Charged to Ledger by ${o.Administered_By_Name || 'Clinical Staff'}`;
    }

    return `
        <div class="order-tracking-cell">
            <div><span class="badge-process ${badgeClass}">${badgeText}</span></div>
            <div class="tracking-stepper">
                <div class="tracking-step ${s1State}">
                    <div class="tracking-node" title="Doctor Order Placed">1</div>
                    <div class="tracking-label">${step1Title}</div>
                </div>
                <div class="tracking-step ${s2State}">
                    <div class="tracking-node" title="Department Prepares Item / Scan Room">2</div>
                    <div class="tracking-label">${step2Title}</div>
                </div>
                <div class="tracking-step ${s3State}">
                    <div class="tracking-node" title="Ready / Active Nurse Assigned">3</div>
                    <div class="tracking-label">${step3Title}</div>
                </div>
                <div class="tracking-step ${s4State}">
                    <div class="tracking-node" title="Nurse Picked Up / Patient In Transit">4</div>
                    <div class="tracking-label">${step4Title}</div>
                </div>
                <div class="tracking-step ${s5State}">
                    <div class="tracking-node" title="Delivered & Administered">5</div>
                    <div class="tracking-label">${step5Title}</div>
                </div>
            </div>
            <div class="tracking-meta-desc">${trackerMeta}</div>
        </div>
    `;
};

const updateStageCounts = (orders) => {
    const counts = {
        all: orders.length,
        requested: 0,
        preparing: 0,
        prepared: 0,
        delivering: 0,
        administered: 0
    };

    orders.forEach(o => {
        const stage = getOrderProcessStage(o.Status);
        if (counts[stage] !== undefined) {
            counts[stage]++;
        }
    });

    Object.keys(counts).forEach(k => {
        const el = document.getElementById(`count-stage-${k}`);
        if (el) el.textContent = String(counts[k]);
    });
};

const renderDepartmentOrdersTable = () => {
    const tbody = document.getElementById("dept-orders-tbody");
    const emptyCard = document.getElementById("dept-orders-empty");
    if (!tbody) return;

    let list = [...cachedDeptOrders];

    if (activeStageFilter !== 'all') {
        list = list.filter(o => getOrderProcessStage(o.Status) === activeStageFilter);
    }

    if (currentSearchQuery) {
        list = list.filter(o => {
            const pat = `${o.Patient_Name || ''} ${o.Patient_Code || ''}`.toLowerCase();
            const doc = `${o.Doctor_Name || ''}`.toLowerCase();
            const itm = `${o.Item_Name || ''} ${o.Item_Code || ''}`.toLowerCase();
            const loc = `${o.Room_Name || ''} ${o.Bed_Code || ''}`.toLowerCase();
            const ord = `ord-${o.Request_ID}`.toLowerCase();
            return pat.includes(currentSearchQuery) || doc.includes(currentSearchQuery) || itm.includes(currentSearchQuery) || loc.includes(currentSearchQuery) || ord.includes(currentSearchQuery);
        });
    }

    if (currentSortOption === 'stage') {
        list.sort((a, b) => {
            const rA = getStageRank(a.Status);
            const rB = getStageRank(b.Status);
            if (rA !== rB) return rA - rB;
            return parseInt(b.Request_ID, 10) - parseInt(a.Request_ID, 10);
        });
    } else if (currentSortOption === 'time_desc') {
        list.sort((a, b) => parseInt(b.Request_ID, 10) - parseInt(a.Request_ID, 10));
    } else if (currentSortOption === 'time_asc') {
        list.sort((a, b) => parseInt(a.Request_ID, 10) - parseInt(b.Request_ID, 10));
    } else if (currentSortOption === 'patient_asc') {
        list.sort((a, b) => (a.Patient_Name || '').localeCompare(b.Patient_Name || ''));
    } else if (currentSortOption === 'doctor_asc') {
        list.sort((a, b) => (a.Doctor_Name || '').localeCompare(b.Doctor_Name || ''));
    }

    if (list.length === 0) {
        tbody.innerHTML = '';
        if (emptyCard) emptyCard.classList.remove('dept-tab-pane-hidden');
        return;
    }

    if (emptyCard) emptyCard.classList.add('dept-tab-pane-hidden');

    const urlParams = new URLSearchParams(window.location.search);
    const highlightRequestId = parseInt(urlParams.get("request_id") || "0", 10);

    let html = '';
    list.forEach(o => {
        const isScan = (o.Category_Type === 'Equipment Scan' || o.Category_Type === 'Service');
        const stage = getOrderProcessStage(o.Status);
        const isRowHighlight = highlightRequestId === parseInt(o.Request_ID, 10);
        const rowClass = isRowHighlight ? 'dept-order-row-highlight' : '';

        let actionCellHtml = '';
        if (stage === 'requested') {
            const btnLabel = isScan ? 'Prepare Equipment' : 'Start Preparing';
            actionCellHtml = `
                <div class="dept-action-btn-group">
                    <button type="button" class="dept-btn-prep" onclick="handleStartPreparing(${o.Request_ID})">${btnLabel}</button>
                </div>
            `;
        } else if (stage === 'preparing') {
            const btnLabel = isScan ? 'Equipment Ready &amp; Dispatch Nurse' : 'Mark Prepared &amp; Assign Nurse';
            actionCellHtml = `
                <div class="dept-action-btn-group">
                    <button type="button" class="dept-btn-ready" onclick="openAssignNurseModal(${o.Request_ID}, ${isScan})">${btnLabel}</button>
                </div>
            `;
        } else if (stage === 'prepared') {
            actionCellHtml = `
                <div class="dept-meta-assigned">Awaiting Nurse Pickup${o.Assigned_Nurse_Name ? `: <strong>${o.Assigned_Nurse_Name}</strong>` : ''}</div>
            `;
        } else if (stage === 'delivering') {
            actionCellHtml = `
                <div class="dept-meta-assigned">${isScan ? 'En Route to Scan Suite' : 'Out for Delivery'}${o.Assigned_Nurse_Name ? `: <strong>${o.Assigned_Nurse_Name}</strong>` : ''}</div>
            `;
        } else if (stage === 'administered') {
            actionCellHtml = `
                <span class="badge badge-success">Completed &amp; Recorded</span>
            `;
        } else {
            actionCellHtml = `<span class="badge badge-secondary">Cancelled</span>`;
        }

        const catPill = (window.getCategoryPill ? window.getCategoryPill(o.Category_Type) : `<span class="cat-pill">${o.Category_Type || 'Item'}</span>`);
        const dosageBlock = o.Dosage_Instructions ? `<div class="dept-item-dosage">${o.Dosage_Instructions}</div>` : '';

        html += `
            <tr class="${rowClass}" id="dept-order-row-${o.Request_ID}">
                <td class="dept-order-id-cell">
                    <div class="dept-order-code">ORD-${String(o.Request_ID).padStart(3, '0')}</div>
                    <div class="dept-order-time">${o.Formatted_Request_Time || o.Request_Timestamp || '-'}</div>
                </td>
                <td class="dept-doc-cell">
                    <div class="dept-doc-name">${o.Doctor_Name}</div>
                    <div class="dept-doc-station">${o.Target_Station_Name || 'Department Station'}</div>
                </td>
                <td class="dept-patient-cell">
                    <div class="dept-pat-name">${o.Patient_Name}</div>
                    <div class="dept-pat-location"><code>${o.Patient_Code}</code> • ${o.Room_Name || 'Ward'} (${o.Bed_Code || 'Bed'})</div>
                </td>
                <td class="dept-item-cell">
                    <div class="dept-item-name">${o.Item_Name}</div>
                    <div class="dept-item-sub"><code>${o.Item_Code}</code> • ${catPill} • Qty: <strong>${o.Quantity}</strong></div>
                    ${dosageBlock}
                </td>
                <td>
                    ${renderTrackingStepper(o)}
                </td>
                <td class="dept-actions-cell">
                    ${actionCellHtml}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    if (highlightRequestId > 0) {
        const el = document.getElementById(`dept-order-row-${highlightRequestId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
};

const loadDepartmentOrders = async () => {
    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    const roleId = parseInt(user.role_id, 10) || 0;
    const userId = parseInt(user.user_id, 10) || 0;

    try {
        const res = await axios.get("../api/GET/clinical_orders.php", {
            params: {
                operation: "getDepartmentOrders",
                json: JSON.stringify({
                    station_id: selectedStationId,
                    user_id: userId,
                    role_id: roleId
                })
            }
        });

        cachedDeptOrders = Array.isArray(res.data) ? res.data : [];
        updateStageCounts(cachedDeptOrders);
        renderDepartmentOrdersTable();
    } catch (e) {
        console.error("Failed to load department orders:", e);
    }
};

const handleStartPreparing = (requestId) => {
    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    showPopupConfirm("Start preparing this requested item in your department?\n\nThe ordering doctor will receive an alert that preparation is underway.", () => {
        const fd = new FormData();
        fd.append("operation", "startPreparingOrder");
        fd.append("json", JSON.stringify({
            request_id: requestId,
            user_id: user.user_id
        }));

        axios.post("../api/POST/clinical_orders.php", fd).then(res => {
            if (res.data && res.data.success) {
                showToastNotification("Order status updated to Preparing. Doctor notified.", "success");
                loadDepartmentOrders();
                if (typeof fetchRealtimeNotifications === "function") fetchRealtimeNotifications();
            } else {
                alert(res.data.error || "Failed to start preparing order.");
            }
        }).catch(err => {
            const msg = (err.response && err.response.data && err.response.data.error) ? err.response.data.error : "Network error";
            alert(msg);
        });
    }, null, {
        title: "Confirm Order Preparation",
        confirmText: "Start Preparing",
        type: "primary"
    });
};

const openAssignNurseModal = async (requestId, isScan) => {
    const reqInput = document.getElementById("assign_nurse_request_id");
    const title = document.getElementById("assignNurseModalTitle");
    const prompt = document.getElementById("assignNursePromptText");
    const confirmBtn = document.getElementById("btnConfirmAssignNurse");
    const searchInput = document.getElementById("nurse_search_input");

    if (reqInput) reqInput.value = String(requestId);
    if (searchInput) searchInput.value = '';
    selectedNurseUserId = 0;

    if (isScan) {
        if (title) title.textContent = "Equipment Ready — Assign Nurse for Patient Transport";
        if (prompt) prompt.textContent = "The imaging equipment has been prepared and calibrated. Select an on-duty nurse to escort the patient to the scan suite:";
        if (confirmBtn) confirmBtn.textContent = "Alert Nurse & Mark Equipment Ready";
    } else {
        if (title) title.textContent = "Item Prepared — Assign Nurse for Delivery";
        if (prompt) prompt.textContent = "This prescription has been prepared. Select an on-duty nurse to pick up the item and deliver to the patient:";
        if (confirmBtn) confirmBtn.textContent = "Alert Nurse & Mark Prepared";
    }

    try {
        const res = await axios.get("../api/GET/clinical_orders.php", {
            params: { operation: "getActiveNurses" }
        });
        activeNursesList = Array.isArray(res.data) ? res.data : [];
        renderNursePickerList();
        openModal("assignNurseModal");
    } catch (e) {
        alert("Failed to load active nurses list.");
    }
};

const renderNursePickerList = () => {
    const container = document.getElementById("nurse-picker-list-container");
    const searchInput = document.getElementById("nurse_search_input");
    const q = (searchInput ? searchInput.value : '').toLowerCase().trim();
    if (!container) return;

    let filtered = activeNursesList;
    if (q) {
        filtered = filtered.filter(n => (n.name || '').toLowerCase().includes(q) || (n.station_name || '').toLowerCase().includes(q));
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div class="dept-empty-card"><div class="dept-empty-text">No matching active nurses found.</div></div>';
        return;
    }

    let html = '';
    filtered.forEach((n, idx) => {
        if (!selectedNurseUserId && idx === 0) {
            selectedNurseUserId = parseInt(n.id, 10);
        }
        const isSel = (parseInt(n.id, 10) === selectedNurseUserId);
        const selClass = isSel ? 'selected' : '';
        html += `
            <div class="nurse-picker-item ${selClass}" onclick="selectNurseItem(${n.id})">
                <div>
                    <div class="nurse-name-text">${n.name}</div>
                    <div class="nurse-role-text">${n.role_title} • ${n.station_name}</div>
                </div>
                <div>
                    <input type="radio" name="selected_nurse_radio" value="${n.id}" ${isSel ? 'checked' : ''}>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
};

const selectNurseItem = (nurseId) => {
    selectedNurseUserId = parseInt(nurseId, 10);
    renderNursePickerList();
};

const confirmAssignNurseAction = () => {
    const reqInput = document.getElementById("assign_nurse_request_id");
    const requestId = parseInt(reqInput ? reqInput.value : "0", 10);
    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");

    if (!requestId) return;
    if (!selectedNurseUserId) {
        alert("Please select an on-duty nurse to assign.");
        return;
    }

    const fd = new FormData();
    fd.append("operation", "markOrderPrepared");
    fd.append("json", JSON.stringify({
        request_id: requestId,
        user_id: user.user_id,
        nurse_user_id: selectedNurseUserId
    }));

    axios.post("../api/POST/clinical_orders.php", fd).then(res => {
        if (res.data && res.data.success) {
            closeModal("assignNurseModal");
            showToastNotification(res.data.message || "Order marked as Prepared. Nurse alerted.", "success");
            loadDepartmentOrders();
            if (typeof fetchRealtimeNotifications === "function") fetchRealtimeNotifications();
        } else {
            alert(res.data.error || "Failed to mark order prepared.");
        }
    }).catch(err => {
        const msg = (err.response && err.response.data && err.response.data.error) ? err.response.data.error : "Network error";
        alert(msg);
    });
};

const setupStationNavigation = (user) => {
    const pillContainer = document.getElementById("dept-station-pill-container");
    const activeStationName = document.getElementById("dept-active-station-name");
    const selectContainer = document.getElementById("dept-station-select-container");
    const select = document.getElementById("select_department_station");
    if (!selectContainer || !select) return;

    const isHigherUp = parseInt(user.is_higher_up, 10) === 1 || parseInt(user.role_id, 10) === 1 || (user.access_domain || "").toLowerCase() === "admin" || (user.role_name || "").toLowerCase().includes("admin");

    const urlParams = new URLSearchParams(window.location.search);
    const paramStationId = parseInt(urlParams.get("station_id") || "0", 10);

    if (isHigherUp) {
        if (pillContainer) pillContainer.style.display = 'none';
        selectContainer.style.display = 'inline-flex';

        axios.get("../api/GET/departments.php", {
            params: { operation: "getActiveDepartments" }
        }).then(res => {
            const depts = res.data || [];
            let html = '<option value="0">All Hospital Stations</option>';
            depts.forEach(d => {
                const prefix = d.Code_Prefix ? ` (${d.Code_Prefix})` : '';
                html += `<option value="${d.Station_ID}">${d.Station_Name}${prefix}</option>`;
            });
            select.innerHTML = html;
            if (paramStationId > 0) {
                selectedStationId = paramStationId;
                select.value = String(paramStationId);
            }
            loadDepartmentOrders();
        }).catch(() => {
            loadDepartmentOrders();
        });

        select.addEventListener("change", () => {
            selectedStationId = parseInt(select.value, 10) || 0;
            loadDepartmentOrders();
        });
        return;
    }

    const assigned = Array.isArray(user.assigned_stations) ? user.assigned_stations : [];
    if (assigned.length === 0 && user.station_id) {
        assigned.push({
            Station_ID: parseInt(user.station_id, 10),
            Station_Name: user.station_name || "Department Station",
            Code_Prefix: ""
        });
    }

    if (assigned.length <= 1) {
        selectContainer.style.display = 'none';
        if (pillContainer) {
            pillContainer.style.display = 'inline-flex';
            const stName = assigned.length > 0 ? assigned[0].Station_Name : (user.station_name || "Department");
            if (activeStationName) activeStationName.textContent = stName;
        }
        selectedStationId = assigned.length > 0 ? assigned[0].Station_ID : (user.station_id ? parseInt(user.station_id, 10) : 0);
        loadDepartmentOrders();
        return;
    }

    if (pillContainer) pillContainer.style.display = 'none';
    selectContainer.style.display = 'inline-flex';

    let html = '';
    assigned.forEach((st, idx) => {
        const prefix = st.Code_Prefix ? ` (${st.Code_Prefix})` : '';
        html += `<option value="${st.Station_ID}">${st.Station_Name}${prefix}</option>`;
    });
    select.innerHTML = html;

    if (paramStationId > 0 && assigned.some(s => s.Station_ID === paramStationId)) {
        selectedStationId = paramStationId;
        select.value = String(paramStationId);
    } else {
        selectedStationId = assigned[0].Station_ID;
        select.value = String(assigned[0].Station_ID);
    }

    select.addEventListener("change", () => {
        selectedStationId = parseInt(select.value, 10) || 0;
        loadDepartmentOrders();
    });

    loadDepartmentOrders();
};

document.addEventListener("DOMContentLoaded", () => {
    const userJson = sessionStorage.getItem("hospital_user");
    if (!userJson) {
        window.location.href = "login.html";
        return;
    }
    const user = JSON.parse(userJson);

    setupStationNavigation(user);

    const refreshBtn = document.getElementById("btnRefreshDeptOrders");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            loadDepartmentOrders();
        });
    }

    const searchInput = document.getElementById("search_dept_input");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            currentSearchQuery = searchInput.value.toLowerCase().trim();
            renderDepartmentOrdersTable();
        });
    }

    const sortSelect = document.getElementById("sort_dept_by");
    if (sortSelect) {
        sortSelect.addEventListener("change", () => {
            currentSortOption = sortSelect.value;
            renderDepartmentOrdersTable();
        });
    }

    const stageBtns = document.querySelectorAll(".dept-stage-pill-btn");
    stageBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            stageBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeStageFilter = btn.getAttribute("data-stage");
            renderDepartmentOrdersTable();
        });
    });

    const btnCloseNurse = document.getElementById("btnCloseAssignNurseModal");
    if (btnCloseNurse) {
        btnCloseNurse.addEventListener("click", () => closeModal("assignNurseModal"));
    }

    const btnCancelNurse = document.getElementById("btnCancelAssignNurse");
    if (btnCancelNurse) {
        btnCancelNurse.addEventListener("click", () => closeModal("assignNurseModal"));
    }

    const btnConfirmNurse = document.getElementById("btnConfirmAssignNurse");
    if (btnConfirmNurse) {
        btnConfirmNurse.addEventListener("click", confirmAssignNurseAction);
    }

    const nurseSearch = document.getElementById("nurse_search_input");
    if (nurseSearch) {
        nurseSearch.addEventListener("input", renderNursePickerList);
    }

    setInterval(() => {
        loadDepartmentOrders();
    }, 15000);
});

window.handleStartPreparing = handleStartPreparing;
window.openAssignNurseModal = openAssignNurseModal;
window.selectNurseItem = selectNurseItem;
