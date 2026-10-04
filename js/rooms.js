const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allRooms = [];
let allBeds = [];
let roomTypes = [];
let currentLoadedRoom = null;

document.addEventListener("DOMContentLoaded", () => {
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
    const filterRoomType = document.getElementById("filter_room_type") || document.getElementById("filter_type");
    if (filterRoomType) {
        filterRoomType.addEventListener("change", filterAndSortRooms);
    }
    document.getElementById("sort_by").addEventListener("change", filterAndSortRooms);

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
            if (filterSelect) {
                filterSelect.innerHTML = `<option value="all">All Classifications</option>`;
                roomTypes.forEach(rt => {
                    const filterOpt = document.createElement("option");
                    filterOpt.value = rt.Room_Type_ID;
                    filterOpt.textContent = rt.Type_Name;
                    filterSelect.appendChild(filterOpt);
                });
            }
        }
    } catch (error) {
        console.error("[API] Error loading room types:", error);
    }
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
        document.getElementById("new_room_type_name").value = "";
        document.getElementById("new_room_type_prefix").value = "";
        document.getElementById("new_room_type_rate").value = "";
        renderRoomTypesManageList();
        modal.style.display = "flex";
        document.getElementById("new_room_type_name").focus();
    }
};

const closeRoomTypeModal = () => {
    const modal = document.getElementById("roomTypeModal");
    if (modal) {
        modal.style.display = "none";
    }
};

const renderRoomTypesManageList = () => {
    const listContainer = document.getElementById("room-types-manage-list");
    if (!listContainer) return;
    listContainer.innerHTML = "";

    if (!roomTypes || roomTypes.length === 0) {
        listContainer.innerHTML = `<span style="font-size: 13px; color: var(--text-muted);">No active classifications.</span>`;
        return;
    }

    roomTypes.forEach(rt => {
        const item = document.createElement("div");
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        item.style.padding = "7px 10px";
        item.style.background = "#ffffff";
        item.style.border = "1px solid var(--border-color)";
        item.style.borderRadius = "var(--radius-sm)";
        const rateFormatted = parseFloat(rt.Daily_Rate || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        item.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 13.5px; font-weight: 600; color: var(--text-main);">${rt.Type_Name}</span>
                    <span class="badge badge-info" style="font-size: 11px; padding: 2px 7px;">Prefix: ${rt.Code_Prefix}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-muted);">
                    Daily Rate: ₱${rateFormatted} / day
                </div>
            </div>
            <button type="button" class="btn btn-sm btn-outline btn-remove-rt" style="padding: 2px 8px; font-size: 12px; color: var(--danger);" title="Remove Classification">&times; Remove</button>
        `;

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
        formData.append("operation", "insertRoomType");
        formData.append("json", JSON.stringify({
            type_name: name,
            code_prefix: prefix,
            daily_rate: parseFloat(rate)
        }));

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

                const typeId = response.data.room_type_id;
                const typeName = response.data.type_name;
                const typeRate = response.data.daily_rate !== undefined ? response.data.daily_rate : parseFloat(rate);

                document.getElementById("room_type_id").value = typeId;
                document.getElementById("room_type_id_text").value = typeName;
                document.getElementById("daily_rate").value = parseFloat(typeRate).toFixed(2);

                renderRoomTypesManageList();
                closeRoomTypeModal();
                alert(response.data.message);
            } else {
                alert(response.data.message || "Failed to add room classification.");
            }
        }
    } catch (error) {
        console.error("[API] Error adding room classification:", error);
        alert("Server error adding room classification.");
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
            filterAndSortRooms();
        }

        if (bedsRes.status === 200) {
            allBeds = bedsRes.data || [];
            displayBedsTable(allBeds);
        }
    } catch (error) {
        console.error("[API] Error loading rooms/beds:", error);
    }
};

const filterAndSortRooms = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();
    const filterStatus = document.getElementById("filter_status").value;
    const filterType = document.getElementById("filter_room_type").value;
    const sortBy = document.getElementById("sort_by").value;

    let filtered = allRooms.filter(r => {
        const name = (r.Room_Name || "").toLowerCase();
        const matchesSearch = name.includes(searchTerm);

        let matchesStatus = true;
        if (filterStatus === "1") matchesStatus = (r.Is_Active == 1);
        else if (filterStatus === "0") matchesStatus = (r.Is_Active == 0);

        let matchesType = true;
        if (filterType !== "all") matchesType = (r.Room_Type_ID == filterType);

        return matchesSearch && matchesStatus && matchesType;
    });

    filtered.sort((a, b) => {
        switch (sortBy) {
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

    displayRoomsTable(filtered);
};

const displayRoomsTable = (rooms) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!rooms || rooms.length === 0) {
        tableDiv.innerHTML = "<p>No matching rooms found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Room Name</th>
            <th>Classification</th>
            <th>Daily Rate</th>
            <th>Bed Capacity</th>
            <th>Vacant Beds</th>
            <th>Occupied Beds</th>
            <th>Status</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rooms.forEach(r => {
        const row = document.createElement("tr");
        row.className = "clickable-row";
        row.title = "Click to view room details, occupancy & stay history";
        row.innerHTML = `
            <td><strong>${r.Room_Name}</strong></td>
            <td><span class="badge badge-info">${r.Type_Name}</span></td>
            <td>₱ ${parseFloat(r.Daily_Rate).toFixed(2)}</td>
            <td>${r.Capacity} bed(s)</td>
            <td><span class="badge badge-success">${r.Vacant_Beds} vacant</span></td>
            <td><span class="badge badge-warning">${r.Occupied_Beds} occupied</span></td>
            <td>${getStatusBadge(r.Is_Active)}</td>
        `;
        row.addEventListener("click", () => openViewRoomModal(r.Room_ID));
        tbody.appendChild(row);
    });

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
                        const isAvail = (b.Is_Available == 1);
                        const availBadge = isAvail
                            ? '<span class="badge badge-success">✔ Vacant</span>'
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
                        bedsTbody.appendChild(tr);
                    });
                }
            }

            const hist = r.occupancy_history || [];
            const histCount = document.getElementById("view_room_history_count");
            const histEmpty = document.getElementById("view_room_history_empty");
            const histTbody = document.getElementById("view_room_history_tbody");

            if (histCount) histCount.textContent = `${hist.length} Past Stays`;
            if (histTbody) {
                histTbody.innerHTML = "";
                if (hist.length === 0) {
                    if (histEmpty) histEmpty.style.display = "block";
                } else {
                    if (histEmpty) histEmpty.style.display = "none";
                    hist.forEach(h => {
                        const tr = document.createElement("tr");
                        const days = h.Total_Days || 1;
                        const fee = h.Total_Room_Fee ? `₱ ${parseFloat(h.Total_Room_Fee).toFixed(2)}` : "—";
                        const dateIn = h.Formatted_Date_In || h.Date_In || "N/A";
                        const dateOut = h.Formatted_Date_Out || h.Date_Out || "N/A";
                        const patName = `${h.First_Name} ${h.Last_Name} <small style="color: var(--text-muted);">(${h.Patient_Code})</small>`;

                        tr.innerHTML = `
                            <td><strong>${h.Bed_Code}</strong></td>
                            <td>${patName}</td>
                            <td>${dateIn} <br>to ${dateOut}</td>
                            <td>${days} day(s)</td>
                            <td><strong>${fee}</strong></td>
                        `;
                        histTbody.appendChild(tr);
                    });
                }
            }

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

const closeViewRoomModal = () => {
    closeModal("viewRoomModal");
};

const populateRoomForm = (r) => {
    document.getElementById("room_id").value = r.Room_ID || "";
    document.getElementById("room_name").value = r.Room_Name || "";
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
        bedsDiv.innerHTML = "<p>No beds registered.</p>";
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Bed Code</th>
            <th>Room</th>
            <th>Classification</th>
            <th>Daily Rate</th>
            <th>Availability</th>
            <th>Status</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    beds.forEach(b => {
        const isAvail = (b.Is_Available == 1);
        const availBadge = isAvail 
            ? '<span class="badge badge-success">✔ Vacant</span>' 
            : '<span class="badge badge-warning">Occupied</span>';
        const isActive = (b.Is_Active == 1);
        const statusBadge = isActive 
            ? '<span class="badge badge-success">Active</span>' 
            : '<span class="badge badge-danger">Archived</span>';

        const row = document.createElement("tr");
        row.className = "clickable-row";
        row.title = "Click to view bed occupancy & stay history";
        row.innerHTML = `
            <td><strong>${b.Bed_Code}</strong></td>
            <td>${b.Room_Name}</td>
            <td>${b.Type_Name}</td>
            <td>₱ ${parseFloat(b.Daily_Rate).toFixed(2)}</td>
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
    const typeId = document.getElementById("room_type_id").value;
    const capacity = document.getElementById("capacity").value;
    const dailyRate = document.getElementById("daily_rate").value.trim();

    if (!roomName || !typeId) {
        alert("Please fill in Room Name and Classification.");
        return;
    }

    const jsonData = {
        room_name: roomName,
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
    document.getElementById("bed_banner_room").textContent = `${data.Room_Name} (${data.Type_Name}) — ₱ ${parseFloat(data.Daily_Rate).toFixed(2)} / day`;

    const isAvail = (data.Is_Available == 1);
    const bannerBadge = document.getElementById("bed_banner_badge");
    if (bannerBadge) {
        bannerBadge.className = isAvail ? "badge badge-success" : "badge badge-warning";
        bannerBadge.textContent = isAvail ? "✔ Vacant" : "Occupied";
    }

    const occupantCard = document.getElementById("bed_current_occupant_card");
    if (occupantCard) {
        if (data.current_occupant) {
            const occ = data.current_occupant;
            const docText = occ.Attending_Doctors || "No attending doctor assigned";
            occupantCard.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <div style="font-size: 15px; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">
                            ${occ.First_Name} ${occ.Last_Name} 
                            <span style="font-size: 12.5px; font-weight: 600; color: var(--primary-color);">(${occ.Patient_Code})</span>
                        </div>
                        <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">
                            <strong>Admission:</strong> ${occ.Admission_Code} | <strong>Admitted:</strong> ${occ.Formatted_Date_In || occ.Formatted_Admission_Date || 'N/A'}
                        </div>
                        <div style="font-size: 13px; color: var(--text-main); margin-bottom: 4px;">
                            <strong>Diagnosis:</strong> ${occ.Diagnosis || occ.Chief_Complaint || 'N/A'}
                        </div>
                        <div style="font-size: 12.5px; color: var(--text-muted);">
                            <strong>Attending Physician:</strong> ${docText}
                        </div>
                    </div>
                    <span class="badge badge-warning" style="font-size: 12px; padding: 6px 12px;">Active Occupant</span>
                </div>
            `;
        } else {
            occupantCard.innerHTML = `
                <div style="text-align: center; padding: 10px 0; color: #16a34a; font-weight: 600; font-size: 13.5px;">
                    ✔ This bed is currently vacant and available for admission.
                </div>
            `;
        }
    }

    const historyTbody = document.getElementById("bed_history_tbody");
    const historyCount = document.getElementById("bed_history_count");
    const historyEmpty = document.getElementById("bed_history_empty");

    const history = data.occupancy_history || [];
    if (historyCount) historyCount.textContent = `${history.length} Records`;

    if (historyTbody) {
        historyTbody.innerHTML = "";
        if (history.length === 0) {
            if (historyEmpty) historyEmpty.style.display = "block";
        } else {
            if (historyEmpty) historyEmpty.style.display = "none";
            history.forEach(h => {
                const tr = document.createElement("tr");
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
                historyTbody.appendChild(tr);
            });
        }
    }
};

