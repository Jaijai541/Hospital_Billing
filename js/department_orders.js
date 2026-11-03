let cachedDeptOrders = [];
let activeStageFilter = 'all';
let currentSearchQuery = '';
let currentSortOption = 'stage';
let selectedStationIds = [];
let cachedAllStations = [];
let tempModalSelectedStations = [];
let activeNursesList = [];
let selectedNurseUserId = 0;
let currentPickerAssignedNurseId = 0;




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

    if (stage === 'cancelled') {
        const isAdmDischarged = (o.Admission_Status === 'Discharged' || o.Admission_Status === 'Billed');
        if (isAdmDischarged) {
            return '<span class="badge badge-process badge-process-cancelled-settled" title="Cancelled upon discharge; excluded from billing">Cancelled • Bill Settled</span>';
        }
        return '<span class="badge badge-process badge-process-cancelled">Order Cancelled</span>';
    }

    const step1Title = 'Requested';
    const step2Title = isScan ? 'Calibrating' : 'Preparing';
    const step3Title = 'Ready';
    const step4Title = isScan ? 'Escorting' : 'Delivering';
    const step5Title = isScan ? 'Scanned' : 'Administered';

    let activeStepNum = 1;
    let seg1Class = 'is-complete';
    let seg2Class = '';
    let seg3Class = '';
    let seg4Class = '';
    let seg5Class = '';

    if (stage === 'requested') {
        activeStepNum = 1;
        seg1Class = 'is-active step-requested';
    } else if (stage === 'preparing') {
        activeStepNum = 2;
        seg1Class = 'is-complete';
        seg2Class = 'is-active step-preparing';
    } else if (stage === 'prepared') {
        activeStepNum = 3;
        seg1Class = 'is-complete';
        seg2Class = 'is-complete';
        seg3Class = 'is-active step-prepared';
    } else if (stage === 'delivering') {
        activeStepNum = 4;
        seg1Class = 'is-complete';
        seg2Class = 'is-complete';
        seg3Class = 'is-complete';
        seg4Class = 'is-active step-delivering';
    } else if (stage === 'administered') {
        activeStepNum = 5;
        seg1Class = 'is-complete';
        seg2Class = 'is-complete';
        seg3Class = 'is-complete';
        seg4Class = 'is-complete';
        seg5Class = 'is-complete step-administered is-active';
    }

    let badgeClass = 'badge-process-requested';
    let badgeText = isScan ? 'Scan Requested' : 'Requested';
    if (stage === 'preparing') {
        badgeClass = 'badge-process-preparing';
        badgeText = isScan ? 'Preparing Equipment' : 'Department Preparing';
    } else if (stage === 'prepared') {
        badgeClass = 'badge-process-prepared';
        badgeText = isScan ? 'Equipment Ready' : 'Prepared & Ready';
    } else if (stage === 'delivering') {
        badgeClass = 'badge-process-delivering';
        badgeText = isScan ? 'Escorting Patient' : 'Out for Delivery';
    } else if (stage === 'administered') {
        badgeClass = 'badge-process-administered';
        badgeText = isScan ? 'Scan Completed' : 'Administered';
    }

    let trackerMeta = '';
    if (stage === 'requested') {
        trackerMeta = `Awaiting ${o.Target_Station_Name || 'Department'} to start`;
    } else if (stage === 'preparing') {
        trackerMeta = `${o.Prepared_By_Name ? o.Prepared_By_Name : 'Staff'} preparing in ${o.Target_Station_Name || 'Dept'}`;
    } else if (stage === 'prepared') {
        trackerMeta = o.Assigned_Nurse_Name ? `Assigned: <strong>${o.Assigned_Nurse_Name}</strong>` : 'Ready for nurse pickup';
    } else if (stage === 'delivering') {
        trackerMeta = isScan ? `Nurse ${o.Assigned_Nurse_Name || ''} escorting` : `Nurse ${o.Assigned_Nurse_Name || ''} en route`;
    } else if (stage === 'administered') {
        trackerMeta = `Completed by ${o.Administered_By_Name || 'Clinical Staff'}`;
    }

    return `
        <div class="order-tracking-cell">
            <div class="tracking-status-row">
                <span class="badge-process ${badgeClass}">${badgeText}</span>
                <span class="tracking-step-counter">Step ${activeStepNum}/5</span>
            </div>
            <div class="micro-stepper-bar" role="progressbar" aria-valuenow="${activeStepNum}" aria-valuemin="1" aria-valuemax="5" title="Stage: ${badgeText}">
                <div class="micro-step-segment ${seg1Class}" title="1. ${step1Title}"></div>
                <div class="micro-step-segment ${seg2Class}" title="2. ${step2Title}"></div>
                <div class="micro-step-segment ${seg3Class}" title="3. ${step3Title}"></div>
                <div class="micro-step-segment ${seg4Class}" title="4. ${step4Title}"></div>
                <div class="micro-step-segment ${seg5Class}" title="5. ${step5Title}"></div>
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

    const curUser = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    const curUserId = parseInt(curUser.user_id || curUser.User_ID || 0, 10);
    const curRoleName = (curUser.role_name || "").toLowerCase();
    const curAccessDomain = (curUser.access_domain || "").toLowerCase();
    const curUserStationId = parseInt(curUser.station_id || 0, 10);
    const isHigherUpUser = parseInt(curUser.is_higher_up, 10) === 1 || parseInt(curUser.role_id, 10) === 1 || curAccessDomain === "admin" || curRoleName.includes("admin");
    const isNurseRole = curRoleName.includes("nurse") || (!curRoleName.includes("doctor") && curUserStationId === 5);
    const curUserStationIds = Array.isArray(curUser.station_ids) ? curUser.station_ids.map(x => parseInt(x, 10)) : (curUserStationId ? [curUserStationId] : []);

    let html = '';
    list.forEach(o => {
        const isScan = (o.Category_Type === 'Equipment Scan' || o.Category_Type === 'Service');
        const stage = getOrderProcessStage(o.Status);
        const isRowHighlight = highlightRequestId === parseInt(o.Request_ID, 10);
        const rowClass = isRowHighlight ? 'dept-order-row-highlight' : '';

        const assignedNurseUserId = parseInt(o.Assigned_Nurse_User_ID || 0, 10);
        const hasAssignedNurse = (assignedNurseUserId > 0);
        const isAssignedNurse = (hasAssignedNurse && assignedNurseUserId === curUserId);
        const targetStationId = parseInt(o.Target_Station_ID || 0, 10);
        const isDeptPersonnel = isHigherUpUser || (targetStationId > 0 && curUserStationIds.includes(targetStationId)) || (parseInt(o.Prepared_By_User_ID || 0, 10) === curUserId) || selectedStationIds.includes(targetStationId);
        const canSwitchNurse = isHigherUpUser || isAssignedNurse || isDeptPersonnel;

        let actionCellHtml = '';
        if (stage === 'requested') {
            const btnLabel = isScan ? 'Start Prep' : 'Start Preparing';
            actionCellHtml = `
                <div class="dept-action-btn-group">
                    <button type="button" class="dept-btn-prep" onclick="handleStartPreparing(${o.Request_ID})">${btnLabel}</button>
                </div>
            `;
        } else if (stage === 'preparing') {
            const btnLabel = isScan ? 'Ready • Dispatch' : 'Ready • Assign';
            actionCellHtml = `
                <div class="dept-action-btn-group">
                    <button type="button" class="dept-btn-ready" onclick="openAssignNurseModal(${o.Request_ID}, ${isScan})">${btnLabel}</button>
                </div>
            `;
        } else if (stage === 'prepared') {
            const btnDeliverText = isScan ? 'Transport Patient' : 'Pick Up & Deliver';
            const canPickUpThisOrder = isHigherUpUser || isAssignedNurse || (!hasAssignedNurse && isNurseRole);

            if (canPickUpThisOrder) {
                actionCellHtml = `
                    <div class="dept-action-btn-group">
                        ${hasAssignedNurse ? `<div class="dept-order-assigned-label">${isAssignedNurse ? 'Assigned to: <strong>You</strong>' : `Assigned: <strong>${o.Assigned_Nurse_Name}</strong>`}</div>` : ''}
                        <div class="dept-btn-action-row">
                            <button type="button" class="dept-btn-deliver" onclick="handleReceiveOrderForDelivery(${o.Request_ID})">${btnDeliverText}</button>
                            ${canSwitchNurse ? `<button type="button" class="dept-btn-switch" onclick="openSwitchNurseModal(${o.Request_ID}, ${isScan})" title="Switch to another nurse if unavailable">Switch Nurse</button>` : ''}
                        </div>
                    </div>
                `;
            } else {
                actionCellHtml = `
                    <div class="dept-action-btn-group">
                        <div class="dept-meta-assigned" title="${o.Assigned_Nurse_Name ? 'Assigned Nurse: ' + o.Assigned_Nurse_Name : ''}">
                            Awaiting Nurse: <strong>${o.Assigned_Nurse_Name || 'Assigned'}</strong>
                        </div>
                        ${canSwitchNurse ? `<button type="button" class="dept-btn-switch" onclick="openSwitchNurseModal(${o.Request_ID}, ${isScan})" title="Switch to another nurse if unavailable">Switch Nurse</button>` : ''}
                    </div>
                `;
            }
        } else if (stage === 'delivering') {
            const btnAdminText = isScan ? 'Complete Scan' : 'Deliver & Administer';
            const canAdministerThisOrder = isHigherUpUser || isAssignedNurse;

            if (canAdministerThisOrder) {
                actionCellHtml = `
                    <div class="dept-action-btn-group">
                        <div class="dept-order-assigned-label">${isAssignedNurse ? 'Delivering by: <strong>You</strong>' : `Nurse: <strong>${o.Assigned_Nurse_Name}</strong>`}</div>
                        <div class="dept-btn-action-row">
                            <button type="button" class="dept-btn-administer" onclick="handleAdministerOrderFromQueue(${o.Request_ID})">${btnAdminText}</button>
                            ${canSwitchNurse ? `<button type="button" class="dept-btn-switch" onclick="openSwitchNurseModal(${o.Request_ID}, ${isScan})" title="Hand off delivery to another nurse if unavailable">Switch Nurse</button>` : ''}
                        </div>
                    </div>
                `;
            } else {
                actionCellHtml = `
                    <div class="dept-action-btn-group">
                        <div class="dept-meta-assigned" title="${o.Assigned_Nurse_Name ? 'Nurse: ' + o.Assigned_Nurse_Name : ''}">
                            ${isScan ? 'Escorting:' : 'In Transit:'} <strong>${o.Assigned_Nurse_Name || 'Nurse'}</strong>
                        </div>
                        ${canSwitchNurse ? `<button type="button" class="dept-btn-switch" onclick="openSwitchNurseModal(${o.Request_ID}, ${isScan})" title="Hand off delivery to another nurse if unavailable">Switch Nurse</button>` : ''}
                    </div>
                `;
            }
        } else if (stage === 'administered') {
            actionCellHtml = `
                <span class="badge badge-success">${isScan ? 'Scanned' : 'Administered'}</span>
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
                    station_ids: selectedStationIds,
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
                showToast(res.data.message || "Order status updated to Preparing. Doctor notified.", "success");
                loadDepartmentOrders();
                if (typeof fetchRealtimeNotifications === "function") fetchRealtimeNotifications();
            } else {
                alert(res.data.error || "Failed to start preparing order.");
            }
        }).catch(err => {
            if (err.response && err.response.data && err.response.data.error) {
                alert(err.response.data.error);
            } else if (!err.response) {
                console.error(err);
            } else {
                alert("Network error");
            }
        });
    }, null, {
        title: "Confirm Order Preparation",
        confirmText: "Start Preparing",
        type: "primary"
    });
};

const openAssignNurseModal = async (requestId, isScan) => {
    const reqInput = document.getElementById("assign_nurse_request_id");
    const modeInput = document.getElementById("assign_nurse_mode");
    const title = document.getElementById("assignNurseModalTitle");
    const prompt = document.getElementById("assignNursePromptText");
    const confirmBtn = document.getElementById("btnConfirmAssignNurse");
    const searchInput = document.getElementById("nurse_search_input");

    if (reqInput) reqInput.value = String(requestId);
    if (modeInput) modeInput.value = "assign";
    if (searchInput) searchInput.value = '';
    currentPickerAssignedNurseId = 0;
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

const openSwitchNurseModal = async (requestId, isScan) => {
    const reqInput = document.getElementById("assign_nurse_request_id");
    const modeInput = document.getElementById("assign_nurse_mode");
    const title = document.getElementById("assignNurseModalTitle");
    const prompt = document.getElementById("assignNursePromptText");
    const confirmBtn = document.getElementById("btnConfirmAssignNurse");
    const searchInput = document.getElementById("nurse_search_input");

    const order = (cachedDeptOrders || []).find(x => String(x.Request_ID) === String(requestId));
    const currentNurseName = (order && order.Assigned_Nurse_Name) ? order.Assigned_Nurse_Name : "Current Nurse";

    if (reqInput) reqInput.value = String(requestId);
    if (modeInput) modeInput.value = "switch";
    if (searchInput) searchInput.value = '';
    currentPickerAssignedNurseId = (order && order.Assigned_Nurse_User_ID) ? parseInt(order.Assigned_Nurse_User_ID, 10) : 0;
    selectedNurseUserId = 0;

    if (title) title.textContent = isScan ? "Switch Escort Nurse" : "Switch Delivering Nurse";
    if (prompt) prompt.innerHTML = '<strong>' + currentNurseName + '</strong> is currently assigned. If unavailable, select another on-duty nurse to take over:';
    if (confirmBtn) confirmBtn.textContent = "Confirm Switch & Alert Nurse";

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
    const modeInput = document.getElementById("assign_nurse_mode");
    const isSwitch = modeInput && modeInput.value === "switch";
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

    if (!selectedNurseUserId) {
        const firstAvailable = filtered.find(n => !isSwitch || parseInt(n.id, 10) !== currentPickerAssignedNurseId);
        if (firstAvailable) {
            selectedNurseUserId = parseInt(firstAvailable.id, 10);
        } else if (filtered.length > 0) {
            selectedNurseUserId = parseInt(filtered[0].id, 10);
        }
    }

    let html = '';
    filtered.forEach(n => {
        const isCurrent = (currentPickerAssignedNurseId > 0 && parseInt(n.id, 10) === currentPickerAssignedNurseId);
        const isSel = (parseInt(n.id, 10) === selectedNurseUserId);
        const selClass = isSel ? 'selected' : '';
        const curClass = isCurrent ? 'current-assigned' : '';
        html += `
            <div class="nurse-picker-item ${selClass} ${curClass}" onclick="selectNurseItem(${n.id})">
                <div>
                    <div class="nurse-name-text">
                        ${n.name}
                        ${isCurrent ? '<span class="badge badge-secondary" style="font-size: 10px; margin-left: 6px; padding: 2px 6px;">Currently Assigned</span>' : ''}
                    </div>
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
    const modeInput = document.getElementById("assign_nurse_mode");
    const isSwitch = modeInput && modeInput.value === "switch";
    const requestId = parseInt(reqInput ? reqInput.value : "0", 10);
    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");

    if (!requestId) return;
    if (!selectedNurseUserId) {
        alert("Please select an on-duty nurse to assign.");
        return;
    }

    if (isSwitch) {
        if (currentPickerAssignedNurseId > 0 && selectedNurseUserId === currentPickerAssignedNurseId) {
            alert("The selected nurse is already assigned to this order. Please select a different nurse to switch.");
            return;
        }

        const fd = new FormData();
        fd.append("operation", "reassignOrderNurse");
        fd.append("json", JSON.stringify({
            request_id: requestId,
            user_id: user.user_id || user.User_ID,
            new_nurse_user_id: selectedNurseUserId
        }));

        axios.post("../api/POST/clinical_orders.php", fd).then(res => {
            if (res.data && res.data.success) {
                closeModal("assignNurseModal");
                showToast(res.data.message || "Nurse reassigned successfully.", "success");
                loadDepartmentOrders();
                if (typeof fetchRealtimeNotifications === "function") fetchRealtimeNotifications();
            } else {
                alert(res.data.error || "Failed to reassign nurse.");
            }
        }).catch(() => {
            alert("Network error reassigning nurse.");
        });
    } else {
        const fd = new FormData();
        fd.append("operation", "markOrderPrepared");
        fd.append("json", JSON.stringify({
            request_id: requestId,
            user_id: user.user_id || user.User_ID,
            nurse_user_id: selectedNurseUserId
        }));

        axios.post("../api/POST/clinical_orders.php", fd).then(res => {
            if (res.data && res.data.success) {
                closeModal("assignNurseModal");
                showToast(res.data.message || "Order marked as Prepared. Nurse alerted.", "success");
                loadDepartmentOrders();
                if (typeof fetchRealtimeNotifications === "function") fetchRealtimeNotifications();
            } else {
                alert(res.data.error || "Failed to mark order prepared.");
            }
        }).catch(() => {
            alert("Network error updating order status.");
        });
    }
};

const getStationIcon = (name = "", prefix = "") => {
    const n = (name + " " + prefix).toLowerCase();
    if (n.includes("pharm")) return "💊";
    if (n.includes("lab")) return "🧪";
    if (n.includes("radio") || n.includes("xray") || n.includes("imag") || n.includes("scan")) return "🩻";
    if (n.includes("nurse") || n.includes("ward")) return "🩺";
    if (n.includes("emerg") || n.includes("er")) return "🚨";
    if (n.includes("diet") || n.includes("food") || n.includes("nutri")) return "🥗";
    if (n.includes("supply") || n.includes("csr")) return "📦";
    return "🏥";
};

const updateStationButtonDisplay = (isHigherUp) => {
    const labelEl = document.getElementById("station_button_label");
    const badgeEl = document.getElementById("station_button_badge");
    const hiddenInput = document.getElementById("select_department_station");
    const textInput = document.getElementById("select_department_station_text");

    if (hiddenInput) {
        hiddenInput.value = selectedStationIds.join(",");
    }

    if (!labelEl || !badgeEl) return;

    if (cachedAllStations.length > 0 && selectedStationIds.length === cachedAllStations.length) {
        labelEl.innerHTML = `<span>All Stations</span>`;
        badgeEl.textContent = `${cachedAllStations.length} Stations`;
        badgeEl.className = "badge badge-primary";
        if (textInput) textInput.value = "All Stations";
    } else if (selectedStationIds.length === 1) {
        const found = cachedAllStations.find(s => parseInt(s.Station_ID, 10) === selectedStationIds[0]);
        const name = found ? found.Station_Name : "Station";
        const icon = found ? getStationIcon(found.Station_Name, found.Code_Prefix) : "🏥";
        labelEl.innerHTML = `<span>${name}</span>`;
        badgeEl.textContent = "1 Station";
        badgeEl.className = "badge badge-info";
        if (textInput) textInput.value = name;
    } else {
        labelEl.innerHTML = `<span>Multiple Stations</span>`;
        badgeEl.textContent = `${selectedStationIds.length} Stations`;
        badgeEl.className = "badge badge-info";
        if (textInput) textInput.value = `${selectedStationIds.length} Stations Selected`;
    }
};

const updateStationChips = (isHigherUp) => {
    const container = document.getElementById("station_chips_container");
    const list = document.getElementById("station_chips_list");
    if (!container || !list) return;

    list.innerHTML = "";

    if (cachedAllStations.length > 0 && selectedStationIds.length === cachedAllStations.length) {
        container.classList.remove("dept-tab-pane-hidden");
        list.innerHTML = `<span class="category-chip chip-all-stations">All ${cachedAllStations.length} Stations</span>`;
        return;
    }

    if (selectedStationIds.length > 1) {
        container.classList.remove("dept-tab-pane-hidden");
        selectedStationIds.forEach(stId => {
            const st = cachedAllStations.find(s => parseInt(s.Station_ID, 10) === stId);
            if (!st) return;
            const icon = getStationIcon(st.Station_Name, st.Code_Prefix);

            const chip = document.createElement("span");
            chip.className = "category-chip";
            chip.innerHTML = `
                <span>${icon} ${st.Station_Name}</span>
                <span class="category-chip-remove" title="Remove ${st.Station_Name} from view">&times;</span>
            `;

            const removeBtn = chip.querySelector(".category-chip-remove");
            if (removeBtn) {
                removeBtn.addEventListener("click", () => removeStationFromView(stId));
            }

            list.appendChild(chip);
        });
        return;
    }

    container.classList.add("dept-tab-pane-hidden");
};

const removeStationFromView = (stId) => {
    if (selectedStationIds.length <= 1) {
        if (typeof showToast === "function") {
            showToast("At least one station must remain selected.", "warning");
        } else {
            alert("At least one station must remain selected.");
        }
        return;
    }
    selectedStationIds = selectedStationIds.filter(id => id !== stId);
    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    const isHigherUp = parseInt(user.is_higher_up, 10) === 1 || parseInt(user.role_id, 10) === 1 || (user.access_domain || "").toLowerCase() === "admin" || (user.role_name || "").toLowerCase().includes("admin");
    updateStationButtonDisplay(isHigherUp);
    updateStationChips(isHigherUp);
    loadDepartmentOrders();
};

const openStationWindow = () => {
    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    const isHigherUp = parseInt(user.is_higher_up, 10) === 1 || parseInt(user.role_id, 10) === 1 || (user.access_domain || "").toLowerCase() === "admin" || (user.role_name || "").toLowerCase().includes("admin");

    if (selectedStationIds.length === 0 || (isHigherUp && selectedStationIds.length === cachedAllStations.length)) {
        tempModalSelectedStations = cachedAllStations.map(s => parseInt(s.Station_ID, 10));
    } else {
        tempModalSelectedStations = [...selectedStationIds];
    }

    const searchInput = document.getElementById("station_filter_search");
    if (searchInput) searchInput.value = "";

    const badgeTotal = document.getElementById("window_total_stations_badge");
    if (badgeTotal) badgeTotal.textContent = `${cachedAllStations.length} Stations`;

    renderStationCardsGrid();
    updateStationModalSummary();
    openModal("stationWindowModal");
};

const closeStationWindow = () => {
    closeModal("stationWindowModal");
};

const renderStationCardsGrid = () => {
    const grid = document.getElementById("station_cards_grid");
    if (!grid) return;

    const searchInput = document.getElementById("station_filter_search");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    grid.innerHTML = "";

    const visibleStations = cachedAllStations.filter(st => {
        return !query || st.Station_Name.toLowerCase().includes(query) || (st.Code_Prefix && st.Code_Prefix.toLowerCase().includes(query));
    });

    if (visibleStations.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: var(--text-muted);">No matching stations found.</div>`;
        return;
    }

    visibleStations.forEach(st => {
        const stId = parseInt(st.Station_ID, 10);
        const isSelected = tempModalSelectedStations.includes(stId);
        const icon = getStationIcon(st.Station_Name, st.Code_Prefix);

        const card = document.createElement("div");
        card.className = `category-card ${isSelected ? "selected" : ""}`;
        card.setAttribute("data-id", String(stId));

        card.innerHTML = `
            <div class="category-card-left">
                <input type="checkbox" class="category-card-cb" value="${stId}" ${isSelected ? "checked" : ""} style="cursor: pointer; pointer-events: none;">
                <span class="category-card-icon">${icon}</span>
                <div>
                    <div class="category-card-title">${st.Station_Name}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${st.Code_Prefix ? "Prefix: " + st.Code_Prefix : "Department Station"}</div>
                </div>
            </div>
            <div>
                <span class="badge ${isSelected ? "badge-primary" : "badge-secondary"}" style="font-size: 11px; padding: 2px 7px;">${st.Code_Prefix || "STN"}</span>
            </div>
        `;

        card.addEventListener("click", () => {
            toggleModalStation(stId);
        });

        grid.appendChild(card);
    });
};

const toggleModalStation = (stId) => {
    const idx = tempModalSelectedStations.indexOf(stId);
    if (idx > -1) {
        tempModalSelectedStations.splice(idx, 1);
    } else {
        tempModalSelectedStations.push(stId);
    }

    const card = document.querySelector(`.category-card[data-id="${stId}"]`);
    if (card) {
        const isSelected = tempModalSelectedStations.includes(stId);
        card.classList.toggle("selected", isSelected);
        const cb = card.querySelector(".category-card-cb");
        if (cb) cb.checked = isSelected;
        const badge = card.querySelector(".badge");
        if (badge) {
            badge.className = `badge ${isSelected ? "badge-primary" : "badge-secondary"}`;
        }
    }

    updateStationModalSummary();
};

const updateStationModalSummary = () => {
    const summaryEl = document.getElementById("station_modal_selection_summary");
    if (!summaryEl) return;

    const count = tempModalSelectedStations.length;
    if (count === cachedAllStations.length) {
        summaryEl.textContent = `All ${count} stations selected`;
    } else {
        summaryEl.textContent = `${count} station${count === 1 ? "" : "s"} selected`;
    }
};

const selectAllModalStations = () => {
    tempModalSelectedStations = cachedAllStations.map(s => parseInt(s.Station_ID, 10));
    renderStationCardsGrid();
    updateStationModalSummary();
};

const clearAllModalStations = () => {
    tempModalSelectedStations = [];
    renderStationCardsGrid();
    updateStationModalSummary();
};

const applyStationWindowSelection = () => {
    if (tempModalSelectedStations.length === 0) {
        if (typeof showPopupAlert === "function") {
            showPopupAlert("Please select at least one station to display.", "warning");
        } else {
            alert("Please select at least one station to display.");
        }
        return;
    }

    selectedStationIds = [...tempModalSelectedStations];
    closeStationWindow();

    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    const isHigherUp = parseInt(user.is_higher_up, 10) === 1 || parseInt(user.role_id, 10) === 1 || (user.access_domain || "").toLowerCase() === "admin" || (user.role_name || "").toLowerCase().includes("admin");

    updateStationButtonDisplay(isHigherUp);
    updateStationChips(isHigherUp);
    loadDepartmentOrders();
};

const setupStationNavigation = async (user) => {
    const pillContainer = document.getElementById("dept-station-pill-container");
    const activeStationName = document.getElementById("dept-active-station-name");
    const selectContainer = document.getElementById("dept-station-select-container");
    if (!selectContainer) return;

    const isHigherUp = parseInt(user.is_higher_up, 10) === 1 || parseInt(user.role_id, 10) === 1 || (user.access_domain || "").toLowerCase() === "admin" || (user.role_name || "").toLowerCase().includes("admin");

    const urlParams = new URLSearchParams(window.location.search);
    const paramStationId = parseInt(urlParams.get("station_id") || "0", 10);

    if (isHigherUp) {
        if (pillContainer) pillContainer.style.display = "none";
        selectContainer.style.display = "inline-flex";

        try {
            const res = await axios.get("../api/GET/departments.php", {
                params: { operation: "getActiveDepartments" }
            });
            cachedAllStations = res.data || [];
        } catch (e) {
            cachedAllStations = [];
        }

        if (paramStationId > 0) {
            selectedStationIds = [paramStationId];
        } else {
            selectedStationIds = cachedAllStations.map(s => parseInt(s.Station_ID, 10));
        }
        updateStationButtonDisplay(true);
        updateStationChips(true);
        loadDepartmentOrders();
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
        selectContainer.style.display = "none";
        if (pillContainer) {
            pillContainer.style.display = "inline-flex";
            const stName = assigned.length > 0 ? assigned[0].Station_Name : (user.station_name || "Department");
            if (activeStationName) activeStationName.textContent = stName;
        }
        selectedStationIds = assigned.length > 0 ? [assigned[0].Station_ID] : (user.station_id ? [parseInt(user.station_id, 10)] : []);
        loadDepartmentOrders();
        return;
    }

    if (pillContainer) pillContainer.style.display = "none";
    selectContainer.style.display = "inline-flex";
    cachedAllStations = assigned;

    if (paramStationId > 0 && assigned.some(s => s.Station_ID === paramStationId)) {
        selectedStationIds = [paramStationId];
    } else {
        selectedStationIds = assigned.map(s => parseInt(s.Station_ID, 10));
    }
    updateStationButtonDisplay(false);
    updateStationChips(false);

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

    const btnOpenStationFilter = document.getElementById("btnOpenStationWindowFilter");
    if (btnOpenStationFilter) {
        btnOpenStationFilter.addEventListener("click", openStationWindow);
    }
    const capsuleContainer = document.getElementById("dept-station-select-container");
    if (capsuleContainer) {
        capsuleContainer.addEventListener("click", (e) => {
            if (e.target !== btnOpenStationFilter && !btnOpenStationFilter.contains(e.target)) {
                openStationWindow();
            }
        });
    }
    const btnSelectAllStations = document.getElementById("btnStationModalSelectAll");
    if (btnSelectAllStations) {
        btnSelectAllStations.addEventListener("click", selectAllModalStations);
    }
    const btnClearAllStations = document.getElementById("btnStationModalClearAll");
    if (btnClearAllStations) {
        btnClearAllStations.addEventListener("click", clearAllModalStations);
    }
    const stationSearch = document.getElementById("station_filter_search");
    if (stationSearch) {
        stationSearch.addEventListener("input", renderStationCardsGrid);
    }
    const btnCloseStationModal = document.getElementById("btnCloseStationWindowModal");
    if (btnCloseStationModal) {
        btnCloseStationModal.addEventListener("click", closeStationWindow);
    }
    const btnCancelStationModal = document.getElementById("btnCancelStationWindow");
    if (btnCancelStationModal) {
        btnCancelStationModal.addEventListener("click", closeStationWindow);
    }
    const btnApplyStationModal = document.getElementById("btnApplyStationWindow");
    if (btnApplyStationModal) {
        btnApplyStationModal.addEventListener("click", applyStationWindowSelection);
    }
    const btnResetAll = document.getElementById("btnResetToAllStations");
    if (btnResetAll) {
        btnResetAll.addEventListener("click", () => {
            selectedStationIds = cachedAllStations.map(s => parseInt(s.Station_ID, 10));
            const u = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
            const higherUp = parseInt(u.is_higher_up, 10) === 1 || parseInt(u.role_id, 10) === 1 || (u.access_domain || "").toLowerCase() === "admin" || (u.role_name || "").toLowerCase().includes("admin");
            updateStationButtonDisplay(higherUp);
            updateStationChips(higherUp);
            loadDepartmentOrders();
        });
    }
    const stationModal = document.getElementById("stationWindowModal");
    if (stationModal) {
        stationModal.addEventListener("click", (e) => {
            if (e.target === stationModal) closeStationWindow();
        });
    }

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

const handleReceiveOrderForDelivery = (requestId) => {
    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    const order = (cachedDeptOrders || []).find(x => String(x.Request_ID) === String(requestId));
    const isScan = order && (order.Category_Type === 'Equipment Scan' || order.Category_Type === 'Service');

    const promptText = isScan
        ? "Confirm patient escort/transport to scan room?\n\nThe ordering doctor will receive an alert that the patient is in transit to the scan room."
        : "Confirm receiving prepared medication from department?\n\nThe ordering doctor will receive an alert that the item was received and is now being delivered to the patient.";

    showPopupConfirm(promptText, () => {
        const formData = new FormData();
        formData.append("operation", "receiveOrderForDelivery");
        formData.append("json", JSON.stringify({
            request_id: requestId,
            user_id: user.user_id || user.User_ID
        }));

        axios.post("../api/POST/clinical_orders.php", formData)
            .then(res => {
                if (res.data && res.data.success) {
                    showToast(res.data.message || "Order marked as received and out for delivery.", "success");
                    loadDepartmentOrders();
                    if (typeof fetchRealtimeNotifications === "function") fetchRealtimeNotifications();
                } else {
                    alert(res.data.error || "Failed to update delivery status.");
                }
            })
            .catch(err => {
                if (err.response && err.response.data && err.response.data.error) {
                    alert(err.response.data.error);
                } else {
                    alert("Network error updating delivery status.");
                }
            });
    }, null, {
        title: isScan ? "Confirm Patient Transport" : "Confirm Item Pickup",
        confirmText: isScan ? "Start Transport" : "Pick Up & Deliver",
        type: "info"
    });
};

const handleAdministerOrderFromQueue = (requestId) => {
    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    const order = (cachedDeptOrders || []).find(x => String(x.Request_ID) === String(requestId));
    const isScan = order && (order.Category_Type === 'Equipment Scan' || order.Category_Type === 'Service');
    const deliveringPersonnelName = (order && order.Assigned_Nurse_Name) ? order.Assigned_Nurse_Name : (user.full_name || user.username || "Nurse");
    const deliveringPersonnelUserId = (user.user_id || user.User_ID);

    const promptText = isScan
        ? `Confirm diagnostic scan completion and bedside charting for ${order ? order.Item_Name : 'item'}?\n\nStaff: ${deliveringPersonnelName}\n\nThis will record the scan as completed and post the official charge to the patient's billing ledger.`
        : `Confirm bedside administration of ${order ? order.Item_Name : 'medication'} to patient ${order ? order.Patient_Name : ''}?\n\nDelivering Staff: ${deliveringPersonnelName}\n\nThis will record the medication as Administered and post the official charge to the live billing ledger.`;

    showPopupConfirm(promptText, () => {
        const formData = new FormData();
        formData.append("operation", "administerOrder");
        formData.append("json", JSON.stringify({
            request_id: requestId,
            user_id: deliveringPersonnelUserId,
            doctor_id: null
        }));

        axios.post("../api/POST/clinical_orders.php", formData)
            .then(res => {
                if (res.data && res.data.success) {
                    showToast(res.data.message || "Order successfully administered and charged.", "success");
                    loadDepartmentOrders();
                    if (typeof fetchRealtimeNotifications === "function") fetchRealtimeNotifications();
                } else {
                    alert(res.data.error || "Failed to administer order.");
                }
            })
            .catch(err => {
                if (err.response && err.response.data && err.response.data.error) {
                    alert(err.response.data.error);
                } else {
                    alert("Network error administering order.");
                }
            });
    }, null, {
        title: isScan ? "Confirm Scan Completion" : "Confirm Administration",
        confirmText: isScan ? "Confirm Complete" : "Administer & Charge",
        type: "info"
    });
};

window.handleStartPreparing = handleStartPreparing;
window.openAssignNurseModal = openAssignNurseModal;
window.openSwitchNurseModal = openSwitchNurseModal;
window.selectNurseItem = selectNurseItem;
window.handleReceiveOrderForDelivery = handleReceiveOrderForDelivery;
window.handleAdministerOrderFromQueue = handleAdministerOrderFromQueue;

window.openDepartmentStationPicker = openStationWindow;