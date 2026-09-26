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

    document.getElementById("room_type_id").addEventListener("change", (e) => {
        const selectedId = e.target.value;
        const found = roomTypes.find(rt => rt.Room_Type_ID == selectedId);
        document.getElementById("daily_rate").value = found ? (found.Daily_Rate || "") : "";
    });

    document.getElementById("search_input").addEventListener("input", filterAndSortRooms);
    document.getElementById("filter_status").addEventListener("change", filterAndSortRooms);
    const filterRoomType = document.getElementById("filter_room_type") || document.getElementById("filter_type");
    if (filterRoomType) {
        filterRoomType.addEventListener("change", filterAndSortRooms);
    }
    document.getElementById("sort_by").addEventListener("change", filterAndSortRooms);
});

const loadRoomTypes = async () => {
    try {
        console.log("[API] Loading room types...");
        const response = await axios.get(`${getApiUrl}/rooms.php`, {
            params: { operation: "getAllRoomTypes" }
        });

        if (response.status === 200 && response.data) {
            roomTypes = response.data;
            const select = document.getElementById("room_type_id");
            const filterSelect = document.getElementById("filter_room_type");

            select.innerHTML = `<option value="">Select Classification...</option>`;
            roomTypes.forEach(rt => {
                const opt = document.createElement("option");
                opt.value = rt.Room_Type_ID;
                opt.textContent = `${rt.Type_Name} (₱ ${parseFloat(rt.Daily_Rate).toFixed(2)}/day)`;
                select.appendChild(opt);

                const filterOpt = document.createElement("option");
                filterOpt.value = rt.Room_Type_ID;
                filterOpt.textContent = rt.Type_Name;
                filterSelect.appendChild(filterOpt);
            });
        }
    } catch (error) {
        console.error("[API] Error loading room types:", error);
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
        row.title = "Click to view / edit room details";
        row.innerHTML = `
            <td><strong>${r.Room_Name}</strong></td>
            <td><span class="badge badge-info">${r.Type_Name}</span></td>
            <td>₱ ${parseFloat(r.Daily_Rate).toFixed(2)}</td>
            <td>${r.Capacity} bed(s)</td>
            <td><span class="badge badge-success">${r.Vacant_Beds} vacant</span></td>
            <td><span class="badge badge-warning">${r.Occupied_Beds} occupied</span></td>
            <td>${getStatusBadge(r.Is_Active)}</td>
        `;
        row.addEventListener("click", () => loadRoomForEdit(r.Room_ID));
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);
};

const populateRoomForm = (r) => {
    document.getElementById("room_id").value = r.Room_ID || "";
    document.getElementById("room_name").value = r.Room_Name || "";
    document.getElementById("room_type_id").value = r.Room_Type_ID || "";
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
        row.innerHTML = `
            <td><strong>${b.Bed_Code}</strong></td>
            <td>${b.Room_Name}</td>
            <td>${b.Type_Name}</td>
            <td>₱ ${parseFloat(b.Daily_Rate).toFixed(2)}</td>
            <td>${availBadge}</td>
            <td>${statusBadge}</td>
        `;
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
    document.getElementById("daily_rate").value = "";
    document.getElementById("capacity").value = "1";
    document.getElementById("capacity").disabled = false;

    const btnArchive = document.getElementById("btnArchive");
    if (btnArchive) btnArchive.style.display = "none";

    document.getElementById("form-title").textContent = "Add New Room";
    document.getElementById("btnSubmit").textContent = "Submit Room";
};
