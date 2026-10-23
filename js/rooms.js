const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allRooms = [];
let allBeds = [];
let roomTypes = [];
let floors = [];
let currentLoadedRoom = null;
let currentRoomViewMode = "grid";
let currentBedHistoryRecords = [];
let currentRoomHistoryRecords = [];

const switchRoomModalTab = (tabKey) => {
    const normalizedKey = tabKey === "history" ? "history" : "beds";
    const tabBtns = document.querySelectorAll(".room-modal-tab-btn");
    const bedsPane = document.getElementById("room-tab-pane-beds");
    const historyPane = document.getElementById("room-tab-pane-history");
    const showBeds = normalizedKey === "beds";
    const showHistory = normalizedKey === "history";

    tabBtns.forEach((btn) => {
        const isTarget = btn.getAttribute("data-room-tab") === normalizedKey;
        btn.classList.toggle("active", isTarget);
        btn.setAttribute("aria-selected", isTarget ? "true" : "false");
    });

    if (bedsPane) {
        bedsPane.classList.toggle("active", showBeds);
        bedsPane.classList.toggle("bed-tab-pane-hidden", !showBeds);
        bedsPane.style.display = showBeds ? "block" : "none";
    }
    if (historyPane) {
        historyPane.classList.toggle("active", showHistory);
        historyPane.classList.toggle("bed-tab-pane-hidden", !showHistory);
        historyPane.style.display = showHistory ? "block" : "none";
    }

    if (showHistory) {
        renderFilteredRoomHistory();
    }
};

window.switchRoomModalTab = switchRoomModalTab;

const switchBedModalTab = (tabKey) => {
    const normalizedKey = tabKey === "history" ? "history" : "occupant";
    const tabBtns = document.querySelectorAll(".bed-modal-tab-btn");
    const occupantPane = document.getElementById("bed-tab-pane-occupant");
    const historyPane = document.getElementById("bed-tab-pane-history");
    const showOccupant = normalizedKey === "occupant";
    const showHistory = normalizedKey === "history";

    tabBtns.forEach((btn) => {
        const isTarget = btn.getAttribute("data-bed-tab") === normalizedKey;
        btn.classList.toggle("active", isTarget);
        btn.setAttribute("aria-selected", isTarget ? "true" : "false");
    });

    if (occupantPane) {
        occupantPane.classList.toggle("active", showOccupant);
        occupantPane.classList.toggle("bed-tab-pane-hidden", !showOccupant);
        occupantPane.style.display = showOccupant ? "block" : "none";
    }
    if (historyPane) {
        historyPane.classList.toggle("active", showHistory);
        historyPane.classList.toggle("bed-tab-pane-hidden", !showHistory);
        historyPane.style.display = showHistory ? "block" : "none";
    }

    if (showHistory) {
        renderFilteredBedHistory();
    }
};

window.switchBedModalTab = switchBedModalTab;

const initRoomViewToggles = () => {
    const btnGrid = document.getElementById("btnViewGrid");
    const btnTable = document.getElementById("btnViewTable");
    if (btnGrid && btnTable) {
        btnGrid.addEventListener("click", () => {
            currentRoomViewMode = "grid";
            btnGrid.classList.add("active");
            btnTable.classList.remove("active");
            filterAndSortRooms();
        });
        btnTable.addEventListener("click", () => {
            currentRoomViewMode = "table";
            btnTable.classList.add("active");
            btnGrid.classList.remove("active");
            filterAndSortRooms();
        });
    }
};

document.addEventListener("DOMContentLoaded", () => {
    initRoomViewToggles();
    loadFloors();
    loadRoomTypes();
    displayRoomsAndBeds();

    initModalControls("formModal", "btnOpenAddModal", "btnCloseModal", "btnCancel", resetForm);
    document.getElementById("btnSubmit").addEventListener("click", saveRoom);

    const btnReset = document.getElementById("btnReset");
    if (btnReset) {
        btnReset.addEventListener("click", () => {
            if (currentLoadedRoom) {
                populateRoomForm(currentLoadedRoom);
            } else {
                resetForm();
            }
        });
    }

    const floorInput = document.getElementById("floor_id_text");
    if (floorInput) {
        floorInput.addEventListener("click", openFloorPicker);
    }
    const btnBrowseFloor = document.getElementById("btnBrowse_floor_id");
    if (btnBrowseFloor) {
        btnBrowseFloor.addEventListener("click", openFloorPicker);
    }

    const roomTypeInput = document.getElementById("room_type_id_text");
    if (roomTypeInput) {
        roomTypeInput.addEventListener("click", openRoomTypePicker);
    }
    const btnBrowseRoomType = document.getElementById("btnBrowse_room_type_id");
    if (btnBrowseRoomType) {
        btnBrowseRoomType.addEventListener("click", openRoomTypePicker);
    }

    const btnOpenAddRoomType = document.getElementById("btnOpenAddRoomTypeModal");
    if (btnOpenAddRoomType) {
        btnOpenAddRoomType.addEventListener("click", openRoomTypeModal);
    }
    const btnCloseRoomTypeModal = document.getElementById("btnCloseRoomTypeModal");
    if (btnCloseRoomTypeModal) {
        btnCloseRoomTypeModal.addEventListener("click", closeRoomTypeModal);
    }
    const btnCancelRoomType = document.getElementById("btnCancelRoomType");
    if (btnCancelRoomType) {
        btnCancelRoomType.addEventListener("click", closeRoomTypeModal);
    }
    const btnSubmitRoomType = document.getElementById("btnSubmitRoomType");
    if (btnSubmitRoomType) {
        btnSubmitRoomType.addEventListener("click", submitNewRoomType);
    }
    const btnCancelEditRoomType = document.getElementById("btnCancelEditRoomType");
    if (btnCancelEditRoomType) {
        btnCancelEditRoomType.addEventListener("click", cancelEditRoomType);
    }
    const roomTypeModal = document.getElementById("roomTypeModal");
    if (roomTypeModal) {
        roomTypeModal.addEventListener("click", (e) => {
            if (e.target === roomTypeModal) closeRoomTypeModal();
        });
    }

    const newRtInputs = ["new_room_type_name", "new_room_type_prefix", "new_room_type_rate"];
    newRtInputs.forEach(id => {
        const inp = document.getElementById(id);
        if (inp) {
            inp.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    submitNewRoomType();
                }
            });
        }
    });

    document.getElementById("search_input").addEventListener("input", filterAndSortRooms);
    document.getElementById("filter_status").addEventListener("change", filterAndSortRooms);
    const filterFloor = document.getElementById("filter_floor");
    if (filterFloor) {
        filterFloor.addEventListener("change", filterAndSortRooms);
    }
    const filterRoomType = document.getElementById("filter_room_type") || document.getElementById("filter_type");
    if (filterRoomType) {
        filterRoomType.addEventListener("change", filterAndSortRooms);
    }
    const sortByElem = document.getElementById("sort_by"); if (sortByElem) sortByElem.addEventListener("change", filterAndSortRooms);

    const tabRooms = document.getElementById("tabBtnRoomsMap");
    if (tabRooms) {
        tabRooms.addEventListener("click", () => switchRoomMainTab("rooms-map"));
    }
    const tabBeds = document.getElementById("tabBtnBedsInventory");
    if (tabBeds) {
        tabBeds.addEventListener("click", () => switchRoomMainTab("beds-inventory"));
    }

    const searchBedsInput = document.getElementById("search_beds_input");
    if (searchBedsInput) {
        searchBedsInput.addEventListener("input", filterAndRenderBedsTab);
    }
    const filterBedsAvail = document.getElementById("filter_beds_avail");
    if (filterBedsAvail) {
        filterBedsAvail.addEventListener("change", filterAndRenderBedsTab);
    }
    const filterBedsFloor = document.getElementById("filter_beds_floor");
    if (filterBedsFloor) {
        filterBedsFloor.addEventListener("change", filterAndRenderBedsTab);
    }
    const filterBedsType = document.getElementById("filter_beds_type");
    if (filterBedsType) {
        filterBedsType.addEventListener("change", filterAndRenderBedsTab);
    }
    const filterBedsStatus = document.getElementById("filter_beds_status");
    if (filterBedsStatus) {
        filterBedsStatus.addEventListener("change", filterAndRenderBedsTab);
    }

    const btnCloseBedModal = document.getElementById("btnCloseBedModal");
    if (btnCloseBedModal) btnCloseBedModal.addEventListener("click", closeBedOccupancyModal);
    const btnCloseBedModalBtn = document.getElementById("btnCloseBedModalBtn");
    if (btnCloseBedModalBtn) btnCloseBedModalBtn.addEventListener("click", closeBedOccupancyModal);
    const bedModal = document.getElementById("bedOccupancyModal");
    if (bedModal) {
        bedModal.addEventListener("click", (e) => {
            if (e.target === bedModal) closeBedOccupancyModal();
        });
    }

    document.querySelectorAll(".bed-modal-tab-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tabKey = btn.getAttribute("data-bed-tab") || "occupant";
            switchBedModalTab(tabKey);
        });
    });

    document.querySelectorAll(".room-modal-tab-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tabKey = btn.getAttribute("data-room-tab") || "beds";
            switchRoomModalTab(tabKey);
        });
    });

    document.addEventListener("click", (e) => {
        const tabBtn = e.target.closest(".bed-modal-tab-btn");
        if (tabBtn) {
            e.preventDefault();
            const tabKey = tabBtn.getAttribute("data-bed-tab") || "occupant";
            switchBedModalTab(tabKey);
            return;
        }
        const roomTabBtn = e.target.closest(".room-modal-tab-btn");
        if (roomTabBtn) {
            e.preventDefault();
            const roomTabKey = roomTabBtn.getAttribute("data-room-tab") || "beds";
            switchRoomModalTab(roomTabKey);
        }
    });

    const bedHistorySearch = document.getElementById("bed_history_search");
    if (bedHistorySearch) {
        bedHistorySearch.addEventListener("input", () => {
            renderFilteredBedHistory();
        });
    }

    const roomHistorySearch = document.getElementById("view_room_history_search");
    if (roomHistorySearch) {
        roomHistorySearch.addEventListener("input", () => {
            renderFilteredRoomHistory();
        });
    }

    const btnCloseView = document.getElementById("btnCloseViewRoomModal");
    if (btnCloseView) btnCloseView.addEventListener("click", closeViewRoomModal);
    const btnCloseViewBtn = document.getElementById("btnCloseViewRoomBtn");
    if (btnCloseViewBtn) btnCloseViewBtn.addEventListener("click", closeViewRoomModal);
    const viewModal = document.getElementById("viewRoomModal");
    if (viewModal) {
        viewModal.addEventListener("click", (e) => {
            if (e.target === viewModal) closeViewRoomModal();
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            const rtModal = document.getElementById("roomTypeModal");
            if (rtModal && rtModal.style.display === "flex") {
                e.stopPropagation();
                closeRoomTypeModal();
                return;
            }
            const viewRoomModal = document.getElementById("viewRoomModal");
            if (viewRoomModal && viewRoomModal.style.display === "flex") {
                e.stopPropagation();
                closeViewRoomModal();
                return;
            }
            const bedModal = document.getElementById("bedOccupancyModal");
            if (bedModal && bedModal.style.display === "flex") {
                e.stopPropagation();
                closeBedOccupancyModal();
                return;
            }
        }
    });

    initRefreshBtn("btnRefreshRooms", displayRoomsAndBeds);
    initRefreshBtn("btnRefreshBeds", displayRoomsAndBeds);
});

const loadRoomTypes = async () => {
    try {
        console.log("[API] Loading room types...");
        const response = await axios.get(`${getApiUrl}/rooms.php`, {
            params: { operation: "getAllRoomTypes" }
        });

        if (response.status === 200 && response.data) {
            roomTypes = response.data;
            const filterSelect = document.getElementById("filter_room_type");
            const filterBedsType = document.getElementById("filter_beds_type");
            if (filterSelect) {
                filterSelect.innerHTML = `<option value="all">All Classifications</option>`;
                roomTypes.forEach(rt => {
                    const filterOpt = document.createElement("option");
                    filterOpt.value = rt.Room_Type_ID;
                    filterOpt.textContent = rt.Type_Name;
                    filterSelect.appendChild(filterOpt);
                });
            }
            if (filterBedsType) {
                filterBedsType.innerHTML = `<option value="all">All Classifications</option>`;
                roomTypes.forEach(rt => {
                    const filterOpt = document.createElement("option");
                    filterOpt.value = rt.Room_Type_ID;
                    filterOpt.textContent = rt.Type_Name;
                    filterBedsType.appendChild(filterOpt);
                });
            }
        }
    } catch (error) {
        console.error("[API] Error loading room types:", error);
    }
};

const loadFloors = async () => {
    try {
        const response = await axios.get(`${getApiUrl}/rooms.php`, {
            params: { operation: "getAllFloors" }
        });
        if (response.status === 200 && response.data) {
            floors = response.data;
            populateFloorFilterDropdown();
        }
    } catch (error) {
        console.error("[API] Error loading floors:", error);
    }
};

const populateFloorFilterDropdown = () => {
    const sel = document.getElementById("filter_floor");
    const bedsSel = document.getElementById("filter_beds_floor");
    if (sel) {
        const currentVal = sel.value;
        sel.innerHTML = `<option value="all">All Floors</option>`;
        floors.forEach(f => {
            const opt = document.createElement("option");
            opt.value = f.Floor_ID;
            opt.textContent = `${f.Floor_Name} (${f.Building_Wing || `Level ${f.Floor_Number}`})`;
            sel.appendChild(opt);
        });
        sel.value = currentVal || "all";
    }
    if (bedsSel) {
        const currentBedsVal = bedsSel.value;
        bedsSel.innerHTML = `<option value="all">All Floors</option>`;
        floors.forEach(f => {
            const opt = document.createElement("option");
            opt.value = f.Floor_ID;
            opt.textContent = `${f.Floor_Name} (${f.Building_Wing || `Level ${f.Floor_Number}`})`;
            bedsSel.appendChild(opt);
        });
        bedsSel.value = currentBedsVal || "all";
    }
};

const openFloorPicker = async () => {
    if (!floors || floors.length === 0) {
        await loadFloors();
    }
    openGenericLookupPicker({
        title: "Select Building Floor",
        items: floors.map(f => ({
            id: f.Floor_ID,
            text: f.Floor_Name,
            subtext: f.Building_Wing ? `${f.Building_Wing} (Level ${f.Floor_Number})` : `Level ${f.Floor_Number}`
        })),
        selectedId: document.getElementById("floor_id").value,
        onSelect: (item) => {
            document.getElementById("floor_id").value = item.id;
            document.getElementById("floor_id_text").value = item.text;
        }
    });
};

const openRoomTypePicker = async () => {
    if (!roomTypes || roomTypes.length === 0) {
        await loadRoomTypes();
    }
    openGenericLookupPicker({
        title: "Select Room Classification",
        items: roomTypes.map(rt => ({
            id: rt.Room_Type_ID,
            text: rt.Type_Name,
            subtext: `Daily Rate: ₱${parseFloat(rt.Daily_Rate).toFixed(2)}/day`
        })),
        selectedId: document.getElementById("room_type_id").value,
        onSelect: (item) => {
            document.getElementById("room_type_id").value = item.id;
            document.getElementById("room_type_id_text").value = item.text;
            const found = roomTypes.find(rt => String(rt.Room_Type_ID) === String(item.id));
            if (found) {
                document.getElementById("daily_rate").value = found.Daily_Rate || "";
            }
        }
    });
};

const openRoomTypeModal = () => {
    const modal = document.getElementById("roomTypeModal");
    if (modal) {
        cancelEditRoomType();
        renderRoomTypesManageList();
        modal.style.display = "flex";
        document.getElementById("new_room_type_name").focus();
    }
};

const closeRoomTypeModal = () => {
    const modal = document.getElementById("roomTypeModal");
    if (modal) {
        modal.style.display = "none";
        cancelEditRoomType();
    }
};

const startEditRoomType = (rt) => {
    document.getElementById("edit_room_type_id").value = rt.Room_Type_ID;
    document.getElementById("new_room_type_name").value = rt.Type_Name;
    document.getElementById("new_room_type_prefix").value = rt.Code_Prefix;
    document.getElementById("new_room_type_rate").value = parseFloat(rt.Daily_Rate || 0).toFixed(2);

    const modeTitle = document.getElementById("rt_form_mode_title");
    if (modeTitle) {
        modeTitle.innerHTML = `Edit Classification: <strong>${rt.Type_Name}</strong>`;
    }
    const btnSubmit = document.getElementById("btnSubmitRoomType");
    if (btnSubmit) {
        btnSubmit.textContent = "Save Changes";
    }
    const btnCancelEdit = document.getElementById("btnCancelEditRoomType");
    if (btnCancelEdit) {
        btnCancelEdit.style.display = "inline-block";
    }

    document.getElementById("new_room_type_name").focus();
};

const cancelEditRoomType = () => {
    const editIdInput = document.getElementById("edit_room_type_id");
    if (editIdInput) editIdInput.value = "";
    const nameInput = document.getElementById("new_room_type_name");
    if (nameInput) nameInput.value = "";
    const prefixInput = document.getElementById("new_room_type_prefix");
    if (prefixInput) prefixInput.value = "";
    const rateInput = document.getElementById("new_room_type_rate");
    if (rateInput) rateInput.value = "";

    const modeTitle = document.getElementById("rt_form_mode_title");
    if (modeTitle) {
        modeTitle.textContent = "Add New Classification";
    }
    const btnSubmit = document.getElementById("btnSubmitRoomType");
    if (btnSubmit) {
        btnSubmit.textContent = "+ Add Classification";
    }
    const btnCancelEdit = document.getElementById("btnCancelEditRoomType");
    if (btnCancelEdit) {
        btnCancelEdit.style.display = "none";
    }
};

const renderRoomTypesManageList = () => {
    const listContainer = document.getElementById("room-types-manage-list");
    const countBadge = document.getElementById("room_types_badge_count");
    if (countBadge) {
        countBadge.textContent = `${roomTypes ? roomTypes.length : 0} Active`;
    }
    if (!listContainer) return;
    listContainer.innerHTML = "";

    if (!roomTypes || roomTypes.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 25px 15px; color: var(--text-muted); background: #ffffff; border-radius: 6px; border: 1px dashed var(--border-color);">
                <div style="font-size: 24px; margin-bottom: 6px;">🏷️</div>
                <div style="font-weight: 600; font-size: 13.5px; color: var(--text-main);">No room classifications found</div>
                <div style="font-size: 12px; margin-top: 2px;">Add your first classification using the form above.</div>
            </div>
        `;
        return;
    }

    roomTypes.forEach(rt => {
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
        const rateFormatted = parseFloat(rt.Daily_Rate || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        item.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="font-size: 14px; font-weight: 700; color: var(--text-main);">${rt.Type_Name}</span>
                    <span class="badge" style="background: #e0f2fe; color: #0369a1; font-weight: 600; font-size: 11px; padding: 2px 7px; border-radius: 4px; border: 1px solid #bae6fd;">Prefix: ${rt.Code_Prefix}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="badge" style="background: #f0fdf4; color: #15803d; font-weight: 700; font-size: 11.5px; padding: 2px 8px; border-radius: 4px; border: 1px solid #bbf7d0;">₱ ${rateFormatted} / day</span>
                    <span style="font-size: 11.5px; color: var(--text-muted);">Standard board rate</span>
                </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
                <button type="button" class="btn btn-sm btn-outline btn-edit-rt" style="width: 28px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; border-radius: 5px; color: var(--text-main);" title="Edit Classification" aria-label="Edit">✎</button>
                <button type="button" class="btn btn-sm btn-outline btn-remove-rt" style="width: 28px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--danger); border-color: #fecaca; border-radius: 5px;" title="Remove Classification" aria-label="Remove">✕</button>
            </div>
        `;

        const btnEdit = item.querySelector(".btn-edit-rt");
        btnEdit.addEventListener("click", () => {
            startEditRoomType(rt);
        });

        const btnRemove = item.querySelector(".btn-remove-rt");
        btnRemove.addEventListener("click", () => {
            promptRemoveRoomType(rt.Room_Type_ID, rt.Type_Name);
        });

        listContainer.appendChild(item);
    });
};

const promptRemoveRoomType = (roomTypeId, typeName) => {
    showPopupConfirm(`Are you sure you want to remove the room classification "${typeName}"?\n\nIf any existing rooms are assigned to this classification, it will be safely deactivated so existing records and billing logs remain accurate.`, async () => {
        try {
            const formData = new FormData();
            formData.append("operation", "removeRoomType");
            formData.append("json", JSON.stringify({ room_type_id: roomTypeId }));

            const response = await axios.post(`${postApiUrl}/rooms.php`, formData);
            if (response.data && response.data.success) {
                await loadRoomTypes();

                const currentSelectedId = document.getElementById("room_type_id").value;
                if (parseInt(currentSelectedId) === parseInt(roomTypeId)) {
                    document.getElementById("room_type_id").value = "";
                    document.getElementById("room_type_id_text").value = "";
                    document.getElementById("daily_rate").value = "";
                }

                cancelEditRoomType();
                renderRoomTypesManageList();
                displayRoomsAndBeds();
                alert(response.data.message);
            } else {
                alert(response.data?.message || "Failed to remove room classification.");
            }
        } catch (error) {
            console.error("[API] Error removing room classification:", error);
            alert("Server error while removing room classification.");
        }
    }, null, {
        title: "Remove Room Classification",
        confirmText: "Remove Classification",
        type: "warning"
    });
};

const submitNewRoomType = async () => {
    const editIdInput = document.getElementById("edit_room_type_id");
    const editId = editIdInput ? editIdInput.value.trim() : "";

    const nameInput = document.getElementById("new_room_type_name");
    const prefixInput = document.getElementById("new_room_type_prefix");
    const rateInput = document.getElementById("new_room_type_rate");

    const name = nameInput.value.trim();
    const prefix = prefixInput.value.trim().toUpperCase();
    const rate = rateInput.value.trim();

    if (!name) {
        alert("Please enter a classification name.");
        nameInput.focus();
        return;
    }

    if (!prefix) {
        alert("Please enter a bed prefix.");
        prefixInput.focus();
        return;
    }

    if (rate === "" || isNaN(parseFloat(rate)) || parseFloat(rate) < 0) {
        alert("Please enter a valid daily rate (0 or higher).");
        rateInput.focus();
        return;
    }

    try {
        const formData = new FormData();
        const isEdit = Boolean(editId);
        formData.append("operation", isEdit ? "updateRoomType" : "insertRoomType");
        const payload = {
            type_name: name,
            code_prefix: prefix,
            daily_rate: parseFloat(rate)
        };
        if (isEdit) {
            payload.room_type_id = parseInt(editId);
        }
        formData.append("json", JSON.stringify(payload));

        const response = await axios.post(`${postApiUrl}/rooms.php`, formData);
        if (response.data) {
            if (response.data.already_existed && !response.data.reactivated) {
                const existingId = response.data.room_type_id;
                if (existingId) {
                    document.getElementById("room_type_id").value = existingId;
                    document.getElementById("room_type_id_text").value = response.data.type_name;
                    const found = roomTypes.find(rt => parseInt(rt.Room_Type_ID) === parseInt(existingId));
                    if (found) {
                        document.getElementById("daily_rate").value = found.Daily_Rate;
                    }
                }
                closeRoomTypeModal();
                alert(response.data.message);
                return;
            }

            if (response.data.success) {
                await loadRoomTypes();

                const typeId = response.data.room_type_id || editId;
                const typeName = response.data.type_name;
                const typeRate = response.data.daily_rate !== undefined ? response.data.daily_rate : parseFloat(rate);

                const currentSelectedId = document.getElementById("room_type_id").value;
                if (!currentSelectedId || parseInt(currentSelectedId) === parseInt(typeId)) {
                    document.getElementById("room_type_id").value = typeId;
                    document.getElementById("room_type_id_text").value = typeName;
                    document.getElementById("daily_rate").value = parseFloat(typeRate).toFixed(2);
                }

                cancelEditRoomType();
                renderRoomTypesManageList();
                displayRoomsAndBeds();
                alert(response.data.message);
            } else {
                alert(response.data.message || "Failed to save room classification.");
            }
        }
    } catch (error) {
        console.error("[API] Error saving room classification:", error);
        alert("Server error saving room classification.");
    }
};

const displayRoomsAndBeds = async () => {
    try {
        console.log("[API] Fetching rooms and beds...");
        const [roomsRes, bedsRes] = await Promise.all([
            axios.get(`${getApiUrl}/rooms.php`, { params: { operation: "getAllRooms" } }),
            axios.get(`${getApiUrl}/rooms.php`, { params: { operation: "getAllBeds" } })
        ]);

        if (roomsRes.status === 200) {
            allRooms = roomsRes.data || [];
        }

        if (bedsRes.status === 200) {
            allBeds = bedsRes.data || [];
            displayBedsTable(allBeds);
        }

        filterAndSortRooms();
        filterAndRenderBedsTab();
        updateRoomsAndBedsTabBadges();
    } catch (error) {
        console.error("[API] Error loading rooms/beds:", error);
    }
};

const filterAndSortRooms = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();
    const filterStatus = document.getElementById("filter_status").value;
    const filterFloor = document.getElementById("filter_floor") ? document.getElementById("filter_floor").value : "all";
    const filterType = document.getElementById("filter_room_type").value;
    const sortBy = document.getElementById("sort_by")?.value || "floor_asc";

    let filtered = allRooms.filter(r => {
        const name = (r.Room_Name || "").toLowerCase();
        const typeName = (r.Type_Name || "").toLowerCase();
        const floorName = (r.Floor_Name || "").toLowerCase();
        const wingName = (r.Building_Wing || "").toLowerCase();
        const roomBeds = allBeds.filter(b => parseInt(b.Room_ID) === parseInt(r.Room_ID) && b.Is_Active == 1);
        const matchesBedCode = roomBeds.some(b => {
            const code = (b.Bed_Code || "").toLowerCase();
            const patName = `${b.First_Name || ''} ${b.Last_Name || ''}`.toLowerCase();
            const patCode = (b.Patient_Code || "").toLowerCase();
            const admCode = (b.Admission_Code || "").toLowerCase();
            return code.includes(searchTerm) || patName.includes(searchTerm) || patCode.includes(searchTerm) || admCode.includes(searchTerm);
        });

        const matchesSearch = !searchTerm || name.includes(searchTerm) || typeName.includes(searchTerm) || floorName.includes(searchTerm) || wingName.includes(searchTerm) || matchesBedCode;

        let matchesStatus = true;
        if (filterStatus === "1") matchesStatus = (r.Is_Active == 1);
        else if (filterStatus === "0") matchesStatus = (r.Is_Active == 0);

        let matchesFloor = true;
        if (filterFloor !== "all") matchesFloor = (r.Floor_ID == filterFloor);

        let matchesType = true;
        if (filterType !== "all") matchesType = (r.Room_Type_ID == filterType);

        return matchesSearch && matchesStatus && matchesFloor && matchesType;
    });

    filtered.sort((a, b) => {
        switch (sortBy) {
            case "floor_asc":
                return (parseInt(a.Floor_Number) || 0) - (parseInt(b.Floor_Number) || 0) || a.Room_Name.localeCompare(b.Room_Name);
            case "floor_desc":
                return (parseInt(b.Floor_Number) || 0) - (parseInt(a.Floor_Number) || 0) || a.Room_Name.localeCompare(b.Room_Name);
            case "name_asc":
                return a.Room_Name.localeCompare(b.Room_Name);
            case "name_desc":
                return b.Room_Name.localeCompare(a.Room_Name);
            case "rate_asc":
                return parseFloat(a.Daily_Rate) - parseFloat(b.Daily_Rate);
            case "rate_desc":
                return parseFloat(b.Daily_Rate) - parseFloat(a.Daily_Rate);
            case "capacity_desc":
                return parseInt(b.Capacity) - parseInt(a.Capacity);
            default:
                return 0;
        }
    });

    const totalCapacity = allRooms.reduce((acc, r) => acc + parseInt(r.Capacity || 0), 0);
    const totalOccupied = allRooms.reduce((acc, r) => acc + parseInt(r.Occupied_Beds || 0), 0);
    const totalVacant = allRooms.reduce((acc, r) => acc + parseInt(r.Vacant_Beds || 0), 0);
    const statEl = document.getElementById("rooms_capacity_stat");
    if (statEl) {
        statEl.style.display = "inline-flex";
        statEl.textContent = `${totalOccupied}/${totalCapacity} Beds Occupied (${totalVacant} Vacant)`;
    }

    if (typeof updateFilterCount === "function") {
        updateFilterCount(filtered.length, allRooms.length, "rooms");
    }

    const gridDiv = document.getElementById("grid-div");
    const tableWrap = document.getElementById("table-wrap-div");

    if (currentRoomViewMode === "grid") {
        if (gridDiv) gridDiv.style.display = "flex";
        if (tableWrap) tableWrap.style.display = "none";
        displayRoomsGrid(filtered);
    } else {
        if (gridDiv) gridDiv.style.display = "none";
        if (tableWrap) tableWrap.style.display = "block";
        displayRoomsTable(filtered);
    }

    let filteredBeds = allBeds.filter(b => {
        const bedCode = (b.Bed_Code || "").toLowerCase();
        const roomName = (b.Room_Name || "").toLowerCase();
        const typeName = (b.Type_Name || "").toLowerCase();
        const patName = `${b.First_Name || ''} ${b.Last_Name || ''}`.toLowerCase();
        const patCode = (b.Patient_Code || "").toLowerCase();
        const admCode = (b.Admission_Code || "").toLowerCase();

        const matchesSearch = !searchTerm ||
            bedCode.includes(searchTerm) ||
            roomName.includes(searchTerm) ||
            typeName.includes(searchTerm) ||
            patName.includes(searchTerm) ||
            patCode.includes(searchTerm) ||
            admCode.includes(searchTerm);

        let matchesStatus = true;
        if (filterStatus === "1") matchesStatus = (b.Is_Active == 1);
        else if (filterStatus === "0") matchesStatus = (b.Is_Active == 0);

        let matchesFloor = true;
        if (filterFloor !== "all") {
            const parentRoom = allRooms.find(rm => parseInt(rm.Room_ID) === parseInt(b.Room_ID));
            matchesFloor = parentRoom ? (parentRoom.Floor_ID == filterFloor) : true;
        }

        let matchesType = true;
        if (filterType !== "all") {
            const parentRoom = allRooms.find(rm => parseInt(rm.Room_ID) === parseInt(b.Room_ID));
            matchesType = parentRoom ? (parentRoom.Room_Type_ID == filterType) : true;
        }

        return matchesSearch && matchesStatus && matchesFloor && matchesType;
    });

    displayBedsTable(filteredBeds);
    updateRoomsAndBedsTabBadges();
};

let currentRoomMainTab = "rooms-map";

const switchRoomMainTab = (tabName) => {
    currentRoomMainTab = tabName;
    const btnRooms = document.getElementById("tabBtnRoomsMap");
    const btnBeds = document.getElementById("tabBtnBedsInventory");
    const cardRooms = document.getElementById("card-rooms-map");
    const cardBeds = document.getElementById("card-beds-inventory");

    if (tabName === "beds-inventory") {
        if (btnRooms) {
            btnRooms.classList.remove("active");
            btnRooms.setAttribute("aria-selected", "false");
        }
        if (btnBeds) {
            btnBeds.classList.add("active");
            btnBeds.setAttribute("aria-selected", "true");
        }
        if (cardRooms) cardRooms.classList.add("rooms-pane-hidden");
        if (cardBeds) cardBeds.classList.remove("rooms-pane-hidden");
        filterAndRenderBedsTab();
    } else {
        if (btnBeds) {
            btnBeds.classList.remove("active");
            btnBeds.setAttribute("aria-selected", "false");
        }
        if (btnRooms) {
            btnRooms.classList.add("active");
            btnRooms.setAttribute("aria-selected", "true");
        }
        if (cardBeds) cardBeds.classList.add("rooms-pane-hidden");
        if (cardRooms) cardRooms.classList.remove("rooms-pane-hidden");
        filterAndSortRooms();
    }
};

const updateRoomsAndBedsTabBadges = () => {
    const tabBadgeRooms = document.getElementById("tabBadgeRoomsCount");
    const tabBadgeBeds = document.getElementById("tabBadgeBedsCount");
    const bedsStat = document.getElementById("beds_inventory_stat");

    const activeBeds = allBeds.filter(b => b.Is_Active == 1);
    const vacantBeds = activeBeds.filter(b => b.Is_Available == 1).length;
    const occupiedBeds = activeBeds.filter(b => b.Is_Available == 0).length;

    if (tabBadgeRooms) {
        tabBadgeRooms.textContent = `${allRooms.length} Rooms`;
    }
    if (tabBadgeBeds) {
        tabBadgeBeds.textContent = `${vacantBeds} Vacant / ${activeBeds.length} Beds`;
    }
    if (bedsStat) {
        bedsStat.textContent = `${vacantBeds} Vacant • ${occupiedBeds} Occupied (${activeBeds.length} Total Active)`;
    }
};

const filterAndRenderBedsTab = () => {
    const searchInput = document.getElementById("search_beds_input");
    const searchTerm = (searchInput ? searchInput.value : "").trim().toLowerCase();
    const availSelect = document.getElementById("filter_beds_avail");
    const availFilter = availSelect ? availSelect.value : "all";
    const floorSelect = document.getElementById("filter_beds_floor");
    const floorFilter = floorSelect ? floorSelect.value : "all";
    const typeSelect = document.getElementById("filter_beds_type");
    const typeFilter = typeSelect ? typeSelect.value : "all";
    const statusSelect = document.getElementById("filter_beds_status");
    const statusFilter = statusSelect ? statusSelect.value : "1";

    let filtered = allBeds.filter(b => {
        const bedCode = (b.Bed_Code || "").toLowerCase();
        const roomName = (b.Room_Name || "").toLowerCase();
        const typeName = (b.Type_Name || "").toLowerCase();
        const patName = `${b.First_Name || ""} ${b.Last_Name || ""}`.toLowerCase();
        const patCode = (b.Patient_Code || "").toLowerCase();
        const admCode = (b.Admission_Code || "").toLowerCase();

        const matchesSearch = !searchTerm ||
            bedCode.includes(searchTerm) ||
            roomName.includes(searchTerm) ||
            typeName.includes(searchTerm) ||
            patName.includes(searchTerm) ||
            patCode.includes(searchTerm) ||
            admCode.includes(searchTerm);

        let matchesAvail = true;
        if (availFilter === "1") matchesAvail = (b.Is_Available == 1);
        else if (availFilter === "0") matchesAvail = (b.Is_Available == 0);

        let matchesStatus = true;
        if (statusFilter === "1") matchesStatus = (b.Is_Active == 1);
        else if (statusFilter === "0") matchesStatus = (b.Is_Active == 0);

        let matchesFloor = true;
        if (floorFilter !== "all") {
            const parentRoom = allRooms.find(rm => parseInt(rm.Room_ID) === parseInt(b.Room_ID));
            matchesFloor = parentRoom ? (parentRoom.Floor_ID == floorFilter) : true;
        }

        let matchesType = true;
        if (typeFilter !== "all") {
            const parentRoom = allRooms.find(rm => parseInt(rm.Room_ID) === parseInt(b.Room_ID));
            matchesType = parentRoom ? (parentRoom.Room_Type_ID == typeFilter) : true;
        }

        return matchesSearch && matchesAvail && matchesStatus && matchesFloor && matchesType;
    });

    displayBedsTable(filtered);
    updateRoomsAndBedsTabBadges();
};

window.switchRoomMainTab = switchRoomMainTab;

const createRoomCardElement = (r, currentSearch) => {
    const roomBeds = allBeds.filter(b => parseInt(b.Room_ID) === parseInt(r.Room_ID) && b.Is_Active == 1);
    const card = document.createElement("div");
    card.className = "room-card";

    const occBeds = parseInt(r.Occupied_Beds || 0);
    const cap = parseInt(r.Capacity || 0);
    let occBadgeCls = "badge-success";
    let occBadgeText = "All Vacant";
    if (occBeds >= cap && cap > 0) {
        occBadgeCls = "badge-danger";
        occBadgeText = "100% Full";
    } else if (occBeds > 0) {
        occBadgeCls = "badge-warning";
        occBadgeText = `${occBeds}/${cap} Occupied`;
    }

    let bedsHtml = "";
    if (roomBeds.length === 0) {
        bedsHtml = `<div style="grid-column: 1 / -1; font-size: 12px; color: var(--text-muted); font-style: italic; padding: 8px 0;">No individual beds registered yet.</div>`;
    } else {
        bedsHtml = roomBeds.map(b => {
            const isAvail = (b.Is_Available == 1);
            const isMatch = currentSearch && (b.Bed_Code || "").toLowerCase().includes(currentSearch);
            const tileCls = isAvail ? "bed-vacant-tile" : "bed-occupied-tile";
            const dotCls = isAvail ? "dot-vacant" : "dot-occupied";
            const patientName = b.Last_Name ? `${b.Last_Name}, ${b.First_Name}` : (isAvail ? "Available for Intake" : "Admitted Patient");
            const admCode = b.Admission_Code ? ` (${b.Admission_Code})` : "";
            const matchStyle = isMatch ? 'outline: 2px solid #0284c7; box-shadow: 0 0 8px rgba(2, 132, 199, 0.45); font-weight: 700; transform: scale(1.05);' : '';

            return `
                <div class="bed-tile ${tileCls}" data-bed-id="${b.Bed_ID}" style="${matchStyle}" title="${b.Bed_Code}: ${patientName}${admCode} — Click to view stay details">
                    <span class="bed-code-label">${b.Bed_Code}</span>
                    <span class="bed-status-dot ${dotCls}"></span>
                </div>
            `;
        }).join("");
    }

    card.innerHTML = `
        <div class="room-card-header">
            <div>
                <div class="room-card-title">
                    <span>${r.Room_Name}</span>
                </div>
                <div class="room-card-meta">
                    <span class="badge badge-secondary" style="font-size: 11px; padding: 2px 7px;">${r.Floor_Name || '1st Floor'}</span>
                    <span class="badge badge-info" style="font-size: 11px; padding: 2px 7px;">${r.Type_Name}</span>
                    <span>₱ ${parseFloat(r.Daily_Rate || 0).toFixed(2)}/day</span>
                </div>
            </div>
            <span class="badge ${occBadgeCls}" style="font-size: 11.5px; padding: 3px 8px;">${occBadgeText}</span>
        </div>
        <div class="room-card-body">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; font-weight: 700; color: var(--text-main);">Beds Inventory (${roomBeds.length}/${r.Capacity})</span>
                <span style="font-size: 11px; color: var(--text-muted);">${r.Vacant_Beds} vacant</span>
            </div>
            <div class="room-beds-grid">
                ${bedsHtml}
            </div>
        </div>
        <div class="room-card-footer">
            <span style="font-size: 11.5px; color: var(--text-muted);">${getStatusBadge(r.Is_Active)}</span>
            <div style="display: flex; gap: 6px;">
                <button type="button" class="btn btn-sm btn-outline btn-card-view-room" data-room-id="${r.Room_ID}" style="padding: 3px 10px; font-size: 11.5px; font-weight: 600;">Details</button>
                <button type="button" class="btn btn-sm btn-outline btn-card-edit-room" data-room-id="${r.Room_ID}" style="width: 26px; height: 26px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;" title="Edit Room">✎</button>
            </div>
        </div>
    `;

    card.querySelectorAll(".bed-tile").forEach(tile => {
        tile.addEventListener("click", (e) => {
            e.stopPropagation();
            const bedId = tile.dataset.bedId;
            openBedOccupancyModal(bedId);
        });
    });

    const btnView = card.querySelector(".btn-card-view-room");
    if (btnView) {
        btnView.addEventListener("click", () => openViewRoomModal(r.Room_ID));
    }

    const btnEdit = card.querySelector(".btn-card-edit-room");
    if (btnEdit) {
        btnEdit.addEventListener("click", () => loadRoomForEdit(r.Room_ID));
    }

    return card;
};

const displayRoomsGrid = (rooms) => {
    const gridDiv = document.getElementById("grid-div");
    if (!gridDiv) return;
    gridDiv.innerHTML = "";

    if (!rooms || rooms.length === 0) {
        gridDiv.innerHTML = typeof getEmptyStateHtml === "function"
            ? getEmptyStateHtml("🛏️", "No matching rooms or beds found", "Try selecting a different room classification or status filter.")
            : "<p>No matching rooms found.</p>";
        return;
    }

    const searchInput = document.getElementById("search_input");
    const currentSearch = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const sortBy = document.getElementById("sort_by") ? document.getElementById("sort_by").value : "floor_asc";

    if (sortBy === "floor_asc" || sortBy === "floor_desc") {
        const floorGroups = {};
        rooms.forEach(r => {
            const fId = r.Floor_ID || 1;
            if (!floorGroups[fId]) {
                floorGroups[fId] = {
                    floorId: fId,
                    floorNumber: parseInt(r.Floor_Number) || 1,
                    floorName: r.Floor_Name || `Floor ${fId}`,
                    buildingWing: r.Building_Wing || "",
                    rooms: []
                };
            }
            floorGroups[fId].rooms.push(r);
        });

        const sortedFloorIds = Object.keys(floorGroups).sort((a, b) => {
            return sortBy === "floor_desc"
                ? floorGroups[b].floorNumber - floorGroups[a].floorNumber
                : floorGroups[a].floorNumber - floorGroups[b].floorNumber;
        });

        sortedFloorIds.forEach(fId => {
            const group = floorGroups[fId];
            const floorRooms = group.rooms;
            const floorCap = floorRooms.reduce((acc, rm) => acc + parseInt(rm.Capacity || 0), 0);
            const floorVacant = floorRooms.reduce((acc, rm) => acc + parseInt(rm.Vacant_Beds || 0), 0);
            const floorOccupied = floorRooms.reduce((acc, rm) => acc + parseInt(rm.Occupied_Beds || 0), 0);
            const floorPct = floorCap > 0 ? Math.round((floorOccupied / floorCap) * 100) : 0;
            const floorBarColor = floorPct >= 90 ? '#ef4444' : (floorPct >= 65 ? '#f59e0b' : '#10b981');
            const floorTextColor = floorPct >= 90 ? '#b91c1c' : (floorPct >= 65 ? '#b45309' : '#047857');

            const section = document.createElement("div");
            section.className = "floor-section-group";

            const header = document.createElement("div");
            header.className = "floor-section-header";
            header.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <span class="badge badge-primary" style="font-size: 13px; font-weight: 700; padding: 4px 10px;">${group.floorName}</span>
                    ${group.buildingWing ? `<span style="font-size: 13px; color: var(--text-muted); font-weight: 500;">${group.buildingWing}</span>` : ""}
                </div>
                <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 100px; height: 6px; background: #e2e8f0; border-radius: 9999px; overflow: hidden;">
                            <div style="width: ${floorPct}%; height: 100%; background: ${floorBarColor}; border-radius: 9999px;"></div>
                        </div>
                        <span style="font-size: 12px; font-weight: 700; color: ${floorTextColor};">${floorPct}% Full</span>
                    </div>
                    <div style="font-size: 12.5px; color: var(--text-muted); font-weight: 500;">
                        <span>${floorRooms.length} Room${floorRooms.length > 1 ? "s" : ""}</span> • 
                        <span>${floorCap} Bed${floorCap > 1 ? "s" : ""} (${floorVacant} Vacant, ${floorOccupied} Occupied)</span>
                    </div>
                </div>
            `;
            section.appendChild(header);

            const cardsGrid = document.createElement("div");
            cardsGrid.className = "rooms-grid-container";

            floorRooms.forEach(r => {
                cardsGrid.appendChild(createRoomCardElement(r, currentSearch));
            });

            section.appendChild(cardsGrid);
            gridDiv.appendChild(section);
        });
    } else {
        const flatGrid = document.createElement("div");
        flatGrid.className = "rooms-grid-container";

        rooms.forEach(r => {
            flatGrid.appendChild(createRoomCardElement(r, currentSearch));
        });

        gridDiv.appendChild(flatGrid);
    }
};

const createRoomTableRowElement = (r) => {
    const row = document.createElement("tr");
    row.className = "clickable-row";
    row.title = "Click to view room details, occupancy & stay history";
    row.innerHTML = `
        <td>
            <div class="table-primary-text">${r.Room_Name}</div>
            <div class="table-sub-text"><span class="badge badge-secondary">${r.Floor_Name || '1st Floor'}</span> &bull; <span class="badge badge-info">${r.Type_Name}</span></div>
        </td>
        <td>
            <div class="table-sub-text-dark"><strong>${r.Capacity}</strong> Bed${r.Capacity > 1 ? 's' : ''}</div>
            <div class="table-sub-text"><span class="badge badge-success">${r.Vacant_Beds} vacant</span> <span class="badge badge-warning">${r.Occupied_Beds} occupied</span></div>
        </td>
        <td>
            <div class="table-amount-prominent">₱ ${parseFloat(r.Daily_Rate).toFixed(2)}</div>
            <div class="table-sub-text">per day</div>
        </td>
        <td>${getStatusBadge(r.Is_Active)}</td>
    `;
    row.addEventListener("click", () => openViewRoomModal(r.Room_ID));
    return row;
};

const displayRoomsTable = (rooms) => {
    const tableDiv = document.getElementById("table-div");
    if (!tableDiv) return;
    tableDiv.innerHTML = "";

    if (!rooms || rooms.length === 0) {
        tableDiv.innerHTML = typeof getEmptyStateHtml === "function"
            ? getEmptyStateHtml("🛏️", "No matching rooms or beds found", "Try selecting a different room classification or status filter.")
            : "<p>No matching rooms found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            ${renderSortableTh("Room & Location", "Room_Name")}
            ${renderSortableTh("Bed Capacity & Occupancy", "Bed_Capacity", true)}
            ${renderSortableTh("Daily Board Rate", "Daily_Rate", true)}
            ${renderSortableTh("Status", "Status")}
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const sortBy = document.getElementById("sort_by") ? document.getElementById("sort_by").value : "floor_asc";

    if (sortBy === "floor_asc" || sortBy === "floor_desc") {
        const floorGroups = {};
        rooms.forEach(r => {
            const fId = r.Floor_ID || 1;
            if (!floorGroups[fId]) {
                floorGroups[fId] = {
                    floorId: fId,
                    floorNumber: parseInt(r.Floor_Number) || 1,
                    floorName: r.Floor_Name || `Floor ${fId}`,
                    buildingWing: r.Building_Wing || "",
                    rooms: []
                };
            }
            floorGroups[fId].rooms.push(r);
        });

        const sortedFloorIds = Object.keys(floorGroups).sort((a, b) => {
            return sortBy === "floor_desc"
                ? floorGroups[b].floorNumber - floorGroups[a].floorNumber
                : floorGroups[a].floorNumber - floorGroups[b].floorNumber;
        });

        sortedFloorIds.forEach(fId => {
            const group = floorGroups[fId];
            const floorRooms = group.rooms;
            const floorCap = floorRooms.reduce((acc, rm) => acc + parseInt(rm.Capacity || 0), 0);
            const floorVacant = floorRooms.reduce((acc, rm) => acc + parseInt(rm.Vacant_Beds || 0), 0);

            const sectionRow = document.createElement("tr");
            sectionRow.className = "table-floor-divider-row";
            sectionRow.innerHTML = `
                <td colspan="4">
                    <div class="table-floor-divider-inner">
                        <div class="table-floor-divider-title">
                            <span class="badge badge-primary">${group.floorName}</span>
                            <span>${group.buildingWing || ''}</span>
                        </div>
                        <span class="table-floor-divider-meta">${floorRooms.length} Room${floorRooms.length > 1 ? "s" : ""} • ${floorCap} Beds (${floorVacant} Vacant)</span>
                    </div>
                </td>
            `;
            tbody.appendChild(sectionRow);

            floorRooms.forEach(r => {
                tbody.appendChild(createRoomTableRowElement(r));
            });
        });
    } else {
        rooms.forEach(r => {
            tbody.appendChild(createRoomTableRowElement(r));
        });
    }

    table.appendChild(tbody);
    tableDiv.appendChild(table);
};

const openViewRoomModal = async (roomId) => {
    try {
        console.log(`[API] Fetching room details for ID: ${roomId}`);
        const response = await axios.get(`${getApiUrl}/rooms.php`, {
            params: {
                operation: "getRoomById",
                json: JSON.stringify({ room_id: roomId })
            }
        });

        if (response.status === 200 && response.data) {
            const r = response.data;
            currentLoadedRoom = r;

            document.getElementById("view-room-title").textContent = `Room Details (${r.Room_Name})`;
            document.getElementById("view_room_name").textContent = r.Room_Name || "";
            const floorBadge = document.getElementById("view_room_floor_badge");
            if (floorBadge) {
                floorBadge.textContent = r.Floor_Name ? `${r.Floor_Name} (${r.Building_Wing || `Level ${r.Floor_Number}`})` : "1st Floor";
            }
            document.getElementById("view_room_type_badge").textContent = r.Type_Name || "Classification";
            document.getElementById("view_room_rate").textContent = `Rate: ₱ ${parseFloat(r.Daily_Rate || 0).toFixed(2)} / day`;
            document.getElementById("view_room_capacity").textContent = `Capacity: ${r.Capacity || 0} Beds`;

            const badge = document.getElementById("view_room_status_badge");
            if (badge) {
                const isActive = (r.Is_Active == 1);
                badge.className = isActive ? "badge badge-success" : "badge badge-danger";
                badge.textContent = isActive ? "Active" : "Archived";
            }

            const beds = r.beds || [];
            const vacantCount = beds.filter(b => b.Is_Available == 1).length;
            const occupiedCount = beds.filter(b => b.Is_Available == 0).length;
            const occSummary = document.getElementById("view_room_occupancy_summary");
            if (occSummary) {
                occSummary.textContent = `${vacantCount} Vacant, ${occupiedCount} Occupied`;
            }

            const bedsCount = document.getElementById("view_room_beds_count");
            const bedsEmpty = document.getElementById("view_room_beds_empty");
            const bedsTbody = document.getElementById("view_room_beds_tbody");

            if (bedsCount) bedsCount.textContent = `${beds.length} Beds`;
            if (bedsTbody) {
                bedsTbody.innerHTML = "";
                if (beds.length === 0) {
                    if (bedsEmpty) bedsEmpty.style.display = "block";
                } else {
                    if (bedsEmpty) bedsEmpty.style.display = "none";
                    beds.forEach(b => {
                        const tr = document.createElement("tr");
                        tr.className = "clickable-row";
                        tr.title = `Click to view bed occupancy & history (${b.Bed_Code})`;
                        const isAvail = (b.Is_Available == 1);
                        const availBadge = isAvail
                            ? '<span class="badge badge-success">Vacant</span>'
                            : '<span class="badge badge-warning">Occupied</span>';
                        const occupantText = isAvail
                            ? '<span style="color: var(--text-muted); font-size: 12.5px;">None</span>'
                            : `<strong>${b.First_Name} ${b.Last_Name}</strong> <small style="color: var(--text-muted);">(${b.Patient_Code})</small>`;
                        const diagText = isAvail ? "—" : (b.Diagnosis || b.Chief_Complaint || 'N/A');
                        const dateInText = isAvail ? "—" : (b.Formatted_Date_In || 'N/A');

                        tr.innerHTML = `
                            <td><strong>${b.Bed_Code}</strong></td>
                            <td>${availBadge}</td>
                            <td>${occupantText}</td>
                            <td>${diagText}</td>
                            <td>${dateInText}</td>
                        `;
                        tr.addEventListener("click", () => {
                            closeViewRoomModal();
                            openBedOccupancyModal(b.Bed_ID);
                        });
                        bedsTbody.appendChild(tr);
                    });
                }
            }

            currentRoomHistoryRecords = r.occupancy_history || [];

            document.querySelectorAll(".room-modal-tab-btn").forEach((btn) => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const tabKey = btn.getAttribute("data-room-tab") || "beds";
                    switchRoomModalTab(tabKey);
                };
            });

            const roomHistorySearch = document.getElementById("view_room_history_search");
            if (roomHistorySearch) {
                roomHistorySearch.value = "";
                roomHistorySearch.oninput = () => renderFilteredRoomHistory();
                roomHistorySearch.dispatchEvent(new Event("keyup"));
            }

            renderFilteredRoomHistory();
            switchRoomModalTab("beds");

            const btnEdit = document.getElementById("btnOpenEditFromRoomView");
            if (btnEdit) {
                btnEdit.onclick = () => {
                    closeViewRoomModal();
                    loadRoomForEdit(roomId);
                };
            }

            openModal("viewRoomModal");
        }
    } catch (error) {
        console.error("[API] Error fetching room details:", error);
        alert("Failed to load room details.");
    }
};

const renderFilteredRoomHistory = () => {
    const histCount = document.getElementById("view_room_history_count");
    const histEmpty = document.getElementById("view_room_history_empty");
    const histTbody = document.getElementById("view_room_history_tbody");
    const histSearch = document.getElementById("view_room_history_search");
    const query = (histSearch ? histSearch.value : "").trim().toLowerCase();

    const filtered = currentRoomHistoryRecords.filter((h) => {
        if (!query) return true;
        const bedCode = (h.Bed_Code || "").toLowerCase();
        const patName = `${h.First_Name || ""} ${h.Last_Name || ""} ${h.Patient_Code || ""}`.toLowerCase();
        const admCode = (h.Admission_Code || "").toLowerCase();
        const dateIn = (h.Formatted_Date_In || h.Date_In || "").toLowerCase();
        const dateOut = (h.Formatted_Date_Out || h.Date_Out || "").toLowerCase();
        const diag = (h.Diagnosis || h.Chief_Complaint || "").toLowerCase();
        return (
            bedCode.includes(query) ||
            patName.includes(query) ||
            admCode.includes(query) ||
            dateIn.includes(query) ||
            dateOut.includes(query) ||
            diag.includes(query)
        );
    });

    if (histCount) {
        histCount.textContent = query
            ? `${filtered.length} of ${currentRoomHistoryRecords.length} Past Stays`
            : `${currentRoomHistoryRecords.length} Past Stays`;
    }

    if (histTbody) {
        histTbody.innerHTML = "";
        if (filtered.length === 0) {
            if (histEmpty) {
                histEmpty.textContent = query
                    ? "No matching room occupancy records found for your search."
                    : "No previous patient occupancy history recorded for this room.";
                histEmpty.style.display = "block";
            }
        } else {
            if (histEmpty) histEmpty.style.display = "none";
            filtered.forEach((h) => {
                const tr = document.createElement("tr");
                tr.className = "clickable-row";
                tr.title = `Click to open admission chart (${h.Admission_Code})`;
                const days = h.Total_Days || 1;
                const fee = h.Total_Room_Fee ? `₱ ${parseFloat(h.Total_Room_Fee).toFixed(2)}` : "—";
                const dateIn = h.Formatted_Date_In || h.Date_In || "N/A";
                const dateOut = h.Formatted_Date_Out || h.Date_Out || "N/A";
                const patName = `${h.First_Name} ${h.Last_Name} <small style="color: var(--text-muted);">(${h.Patient_Code})</small>`;

                tr.innerHTML = `
                    <td><strong>${h.Bed_Code}</strong></td>
                    <td>${patName}<br><small style="color: var(--text-muted);">${h.Admission_Code}</small></td>
                    <td>${dateIn} <br>to ${dateOut}</td>
                    <td>${days} day(s)</td>
                    <td><strong>${fee}</strong></td>
                `;
                tr.addEventListener("click", () => {
                    if (h.Admission_ID) {
                        window.location.href = `admission_details.html?id=${h.Admission_ID}`;
                    }
                });
                histTbody.appendChild(tr);
            });
        }
    }
};

const closeViewRoomModal = () => {
    closeModal("viewRoomModal");
};

const populateRoomForm = (r) => {
    document.getElementById("room_id").value = r.Room_ID || "";
    document.getElementById("room_name").value = r.Room_Name || "";
    document.getElementById("floor_id").value = r.Floor_ID || "1";
    if (r.Floor_ID) {
        const fl = floors.find(f => f.Floor_ID == r.Floor_ID);
        document.getElementById("floor_id_text").value = fl ? `${fl.Floor_Name} (${fl.Building_Wing || `Level ${fl.Floor_Number}`})` : (r.Floor_Name || "1st Floor");
    } else {
        document.getElementById("floor_id_text").value = "";
    }
    document.getElementById("room_type_id").value = r.Room_Type_ID || "";
    if (r.Room_Type_ID) {
        const rt = roomTypes.find(t => t.Room_Type_ID == r.Room_Type_ID);
        document.getElementById("room_type_id_text").value = rt ? rt.Type_Name : "";
    } else {
        document.getElementById("room_type_id_text").value = "";
    }
    document.getElementById("daily_rate").value = r.Daily_Rate || "";
    document.getElementById("capacity").value = r.Capacity || 1;
    document.getElementById("capacity").disabled = true;
};

const displayBedsTable = (beds) => {
    const bedsDiv = document.getElementById("beds-table-div");
    bedsDiv.innerHTML = "";

    if (!beds || beds.length === 0) {
        bedsDiv.innerHTML = typeof getEmptyStateHtml === "function"
            ? getEmptyStateHtml("🛏️", "No matching beds found", "No registered beds match your search query or filter criteria.")
            : "<p style=\"padding: 20px;\">No matching beds found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            ${renderSortableTh("Bed & Room", "Bed_Code")}
            ${renderSortableTh("Classification & Daily Rate", "Daily_Rate")}
            ${renderSortableTh("Availability", "Is_Available")}
            ${renderSortableTh("Status", "Status")}
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    beds.forEach(b => {
        const isAvail = (b.Is_Available == 1);
        const availBadge = isAvail 
            ? '<span class="badge badge-success">Vacant</span>' 
            : '<span class="badge badge-warning">Occupied</span>';
        const isActive = (b.Is_Active == 1);
        const statusBadge = isActive 
            ? '<span class="badge badge-success">Active</span>' 
            : '<span class="badge badge-danger">Archived</span>';

        const row = document.createElement("tr");
        row.className = "clickable-row";
        row.title = "Click to view bed occupancy & stay history";
        row.innerHTML = `
            <td>
                <div class="table-primary-text">${b.Bed_Code}</div>
                <div class="table-sub-text">${b.Room_Name} &bull; <span class="badge badge-secondary">${b.Floor_Name || '1st Floor'}</span></div>
            </td>
            <td>
                <div class="table-amount-prominent">₱ ${parseFloat(b.Daily_Rate).toFixed(2)}</div>
                <div class="table-sub-text">${b.Type_Name}</div>
            </td>
            <td>${availBadge}</td>
            <td>${statusBadge}</td>
        `;
        row.addEventListener("click", () => openBedOccupancyModal(b.Bed_ID));
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    bedsDiv.appendChild(table);
};

const loadRoomForEdit = async (roomId) => {
    try {
        console.log(`[API] Requesting room details for ID: ${roomId}`);
        const response = await axios.get(`${getApiUrl}/rooms.php`, {
            params: {
                operation: "getRoomById",
                json: JSON.stringify({ room_id: roomId })
            }
        });

        if (response.status === 200 && response.data) {
            const r = response.data;
            currentLoadedRoom = r;
            populateRoomForm(r);

            document.getElementById("form-title").textContent = `Edit Room (${r.Room_Name})`;
            document.getElementById("btnSubmit").textContent = "Update Room";

            const btnArchive = document.getElementById("btnArchive");
            if (btnArchive) {
                btnArchive.style.display = "inline-flex";
                const isActive = (r.Is_Active == 1);
                btnArchive.className = isActive ? "btn btn-warning btn-archive" : "btn btn-success btn-restore";
                btnArchive.textContent = isActive ? "Send to Archive" : "Restore Record";
                btnArchive.onclick = () => {
                    toggleRecordStatus("rooms.php", "room_id", r.Room_ID, isActive ? 1 : 0, r.Room_Name, () => {
                        closeModal();
                        displayRoomsAndBeds();
                    });
                };
            }

            openModal();
        }
    } catch (error) {
        console.error("[API] Error loading room:", error);
    }
};

const saveRoom = async () => {
    const roomId = document.getElementById("room_id").value;
    const roomName = document.getElementById("room_name").value.trim();
    const floorId = document.getElementById("floor_id").value || "1";
    const typeId = document.getElementById("room_type_id").value;
    const capacity = document.getElementById("capacity").value;
    const dailyRate = document.getElementById("daily_rate").value.trim();

    if (!roomName || !typeId || !floorId) {
        alert("Please fill in Room Name, Building Floor, and Classification.");
        return;
    }

    if (dailyRate !== "") {
        const valRate = typeof validateNumericField === "function" ? validateNumericField(dailyRate, "Daily Rate", 0, true) : { valid: !isNaN(parseFloat(dailyRate)) && parseFloat(dailyRate) >= 0 };
        if (!valRate.valid) {
            alert(valRate.message || "Daily Rate must be a valid number (0 or higher).");
            const el = document.getElementById("daily_rate");
            if (el) el.focus();
            return;
        }
    }

    if (capacity !== "") {
        const valCap = typeof validateNumericField === "function" ? validateNumericField(capacity, "Room Capacity", 1, false) : { valid: !isNaN(parseInt(capacity)) && parseInt(capacity) >= 1 };
        if (!valCap.valid || !Number.isInteger(Number(capacity))) {
            alert(valCap.message || "Room Capacity must be a whole number of at least 1.");
            const el = document.getElementById("capacity");
            if (el) el.focus();
            return;
        }
    }

    const jsonData = {
        room_name: roomName,
        floor_id: floorId,
        room_type_id: typeId,
        daily_rate: dailyRate !== "" ? parseFloat(dailyRate) : null,
        capacity: parseInt(capacity) || 1
    };

    const isEdit = (roomId !== "");
    const operation = isEdit ? "updateRoom" : "insertRoom";

    if (isEdit) {
        jsonData.room_id = roomId;
    }

    console.log(`[Action] Submitting ${operation} via POST:`, jsonData);

    const formData = new FormData();
    formData.append("operation", operation);
    formData.append("json", JSON.stringify(jsonData));

    try {
        const response = await axios({
            url: `${postApiUrl}/rooms.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            alert(isEdit ? "Room updated successfully!" : "Room and beds registered successfully!");
            resetForm();
            closeModal();
            displayRoomsAndBeds();
        } else {
            alert("Error saving room.");
        }
    } catch (error) {
        console.error("[Error] Save failed:", error);
        alert("Server error occurred.");
    }
};

const resetForm = () => {
    currentLoadedRoom = null;

    document.getElementById("room_id").value = "";
    document.getElementById("room_name").value = "";
    document.getElementById("floor_id").value = "1";
    const defaultFloor = floors.find(f => f.Floor_ID == 1);
    document.getElementById("floor_id_text").value = defaultFloor ? `${defaultFloor.Floor_Name} (${defaultFloor.Building_Wing || `Level ${defaultFloor.Floor_Number}`})` : "1st Floor";
    document.getElementById("room_type_id").value = "";
    document.getElementById("room_type_id_text").value = "";
    document.getElementById("daily_rate").value = "";
    document.getElementById("capacity").value = "1";
    document.getElementById("capacity").disabled = false;

    const btnArchive = document.getElementById("btnArchive");
    if (btnArchive) btnArchive.style.display = "none";

    document.getElementById("form-title").textContent = "Add New Room";
    document.getElementById("btnSubmit").textContent = "Submit Room";
};

const openBedOccupancyModal = async (bedId) => {
    try {
        console.log(`[API] Requesting bed occupancy details for Bed ID: ${bedId}`);
        const response = await axios.get(`${getApiUrl}/rooms.php`, {
            params: {
                operation: "getBedOccupancyHistory",
                json: JSON.stringify({ bed_id: bedId })
            }
        });

        if (response.status === 200 && response.data) {
            const data = response.data;
            renderBedOccupancyData(data);
            const modal = document.getElementById("bedOccupancyModal");
            if (modal) modal.style.display = "flex";
        } else {
            alert("Error loading bed occupancy details.");
        }
    } catch (error) {
        console.error("[API] Error fetching bed occupancy:", error);
        alert("Failed to load bed occupancy.");
    }
};

const closeBedOccupancyModal = () => {
    const modal = document.getElementById("bedOccupancyModal");
    if (modal) modal.style.display = "none";
};

const renderBedOccupancyData = (data) => {
    document.getElementById("bed-modal-title").textContent = `Bed Occupancy & History (${data.Bed_Code})`;
    document.getElementById("bed_banner_code").textContent = data.Bed_Code;
    document.getElementById("bed_banner_room").textContent = `${data.Room_Name} • ${data.Floor_Name || '1st Floor'} (${data.Type_Name}) — ₱ ${parseFloat(data.Daily_Rate).toFixed(2)} / day`;

    const isAvail = (data.Is_Available == 1);
    const bannerBadge = document.getElementById("bed_banner_badge");
    if (bannerBadge) {
        bannerBadge.className = isAvail ? "badge badge-success" : "badge badge-warning";
        bannerBadge.textContent = isAvail ? "Vacant" : "Occupied";
    }

    const occupantCard = document.getElementById("bed_current_occupant_card");
    if (occupantCard) {
        if (data.current_occupant) {
            const occ = data.current_occupant;
            const docText = occ.Attending_Doctors || "No attending doctor assigned";
            occupantCard.className = "bed-current-occupant-card is-clickable";
            occupantCard.setAttribute("role", "button");
            occupantCard.setAttribute("tabindex", "0");
            occupantCard.title = `Click to open clinical chart & ledger for ${occ.First_Name} ${occ.Last_Name} (${occ.Admission_Code})`;
            occupantCard.innerHTML = `
                <div class="bed-occupant-card-row">
                    <div>
                        <div class="bed-occupant-name">
                            ${occ.First_Name} ${occ.Last_Name} 
                            <span class="bed-occupant-code">(${occ.Patient_Code})</span>
                        </div>
                        <div class="bed-occupant-meta">
                            <strong>Admission:</strong> ${occ.Admission_Code} | <strong>Admitted:</strong> ${occ.Formatted_Date_In || occ.Formatted_Admission_Date || 'N/A'}
                        </div>
                        <div class="bed-occupant-diag">
                            <strong>Diagnosis:</strong> ${occ.Diagnosis || occ.Chief_Complaint || 'N/A'}
                        </div>
                        <div class="bed-occupant-doc">
                            <strong>Attending Physician:</strong> ${docText}
                        </div>
                    </div>
                    <span class="badge badge-warning bed-occupant-badge">Active Occupant</span>
                </div>
            `;
            const goToOccupantChart = () => {
                if (occ.Admission_ID) {
                    window.location.href = `admission_details.html?id=${occ.Admission_ID}`;
                }
            };
            occupantCard.onclick = goToOccupantChart;
            occupantCard.onkeydown = (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goToOccupantChart();
                }
            };
        } else {
            occupantCard.className = "bed-current-occupant-card is-clickable is-vacant-clickable";
            occupantCard.setAttribute("role", "button");
            occupantCard.setAttribute("tabindex", "0");
            occupantCard.title = `Click to admit a patient into ${data.Bed_Code}`;
            occupantCard.innerHTML = `
                <div class="bed-vacant-state">
                    <span class="bed-vacant-text">
                        This bed is currently vacant and available for admission.
                    </span>
                </div>
            `;
            const goToAdmitBed = () => {
                window.location.href = `admissions.html?admit=1&bed_id=${data.Bed_ID}`;
            };
            occupantCard.onclick = goToAdmitBed;
            occupantCard.onkeydown = (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goToAdmitBed();
                }
            };
        }
    }

    const history = data.occupancy_history || [];
    currentBedHistoryRecords = history;

    document.querySelectorAll(".bed-modal-tab-btn").forEach((btn) => {
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tabKey = btn.getAttribute("data-bed-tab") || "occupant";
            switchBedModalTab(tabKey);
        };
    });

    const historySearch = document.getElementById("bed_history_search");
    if (historySearch) {
        historySearch.value = "";
        historySearch.oninput = () => renderFilteredBedHistory();
        historySearch.dispatchEvent(new Event("keyup"));
    }

    renderFilteredBedHistory();
    switchBedModalTab("occupant");
};

const renderFilteredBedHistory = () => {
    const historyTbody = document.getElementById("bed_history_tbody");
    const historyCount = document.getElementById("bed_history_count");
    const historyEmpty = document.getElementById("bed_history_empty");
    const historySearch = document.getElementById("bed_history_search");
    const query = (historySearch ? historySearch.value : "").trim().toLowerCase();

    const filtered = currentBedHistoryRecords.filter((h) => {
        if (!query) return true;
        const patName = `${h.First_Name || ""} ${h.Last_Name || ""} ${h.Patient_Code || ""}`.toLowerCase();
        const admCode = (h.Admission_Code || "").toLowerCase();
        const dateIn = (h.Formatted_Date_In || h.Date_In || "").toLowerCase();
        const dateOut = (h.Formatted_Date_Out || h.Date_Out || "").toLowerCase();
        const diag = (h.Diagnosis || h.Chief_Complaint || "").toLowerCase();
        return (
            patName.includes(query) ||
            admCode.includes(query) ||
            dateIn.includes(query) ||
            dateOut.includes(query) ||
            diag.includes(query)
        );
    });

    if (historyCount) {
        historyCount.textContent = query
            ? `${filtered.length} of ${currentBedHistoryRecords.length} Records`
            : `${currentBedHistoryRecords.length} Records`;
    }

    if (historyTbody) {
        historyTbody.innerHTML = "";
        if (filtered.length === 0) {
            if (historyEmpty) {
                historyEmpty.textContent = query
                    ? "No matching occupancy records found for your search."
                    : "No past occupancy records found for this bed.";
                historyEmpty.style.display = "block";
            }
        } else {
            if (historyEmpty) historyEmpty.style.display = "none";
            filtered.forEach((h) => {
                const tr = document.createElement("tr");
                tr.className = "clickable-row";
                tr.title = `Click to open admission chart (${h.Admission_Code})`;
                const days = h.Total_Days || 1;
                const fee = h.Total_Room_Fee ? `₱ ${parseFloat(h.Total_Room_Fee).toFixed(2)}` : "—";
                const dateIn = h.Formatted_Date_In || h.Date_In || "N/A";
                const dateOut = h.Formatted_Date_Out || h.Date_Out || "N/A";
                const patName = `${h.First_Name} ${h.Last_Name} (${h.Patient_Code})`;
                tr.innerHTML = `
                    <td><strong>${patName}</strong><br><small style="color: var(--text-muted);">${h.Admission_Code}</small></td>
                    <td>${dateIn} <br>to ${dateOut}</td>
                    <td>${days} day(s)</td>
                    <td><strong>${fee}</strong></td>
                    <td>${h.Diagnosis || h.Chief_Complaint || 'N/A'}</td>
                `;
                tr.addEventListener("click", () => {
                    if (h.Admission_ID) {
                        window.location.href = `admission_details.html?id=${h.Admission_ID}`;
                    }
                });
                historyTbody.appendChild(tr);
            });
        }
    }
};

