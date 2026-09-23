/**
 * Hospital Rooms & Beds Controller (Axios / Frontend)
 * Follows classroom pure HTML standard: dynamic table creation with border="1"
 * Handles Room, Room_Bed, and Enum_Room_Type (with Daily_Rate)
 */

const baseApiUrl = "../api";
let allRooms = [];
let allBeds = [];
let roomTypes = [];

document.addEventListener("DOMContentLoaded", () => {
    // Session Verification
    const userJson = sessionStorage.getItem("hospital_user");
    if (!userJson) {
        window.location.href = "login.html";
        return;
    }
    const user = JSON.parse(userJson);
    const userDisplay = document.getElementById("user-display");
    if (userDisplay) {
        userDisplay.textContent = `${user.full_name} (${user.role_name})`;
    }

    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to log out?")) {
                console.log("[Auth] User logged out:", user.username);
                sessionStorage.removeItem("hospital_user");
                window.location.href = "login.html";
            }
        });
    }

    // Initial Data Load
    loadRoomTypes();
    displayRoomsAndBeds();

    // Modal Controls
    const btnOpenAdd = document.getElementById("btnOpenAddModal");
    if (btnOpenAdd) {
        btnOpenAdd.addEventListener("click", () => {
            resetForm();
            openModal();
        });
    }

    const btnCloseModal = document.getElementById("btnCloseModal");
    if (btnCloseModal) {
        btnCloseModal.addEventListener("click", closeModal);
    }

    const formModal = document.getElementById("formModal");
    if (formModal) {
        formModal.addEventListener("click", (e) => {
            if (e.target === formModal) {
                closeModal();
            }
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeModal();
        }
    });

    // Form Events
    document.getElementById("btnSubmit").addEventListener("click", saveRoom);
    document.getElementById("btnCancel").addEventListener("click", () => {
        resetForm();
        closeModal();
    });

    // Auto-fill daily rate on room type selection
    document.getElementById("room_type_id").addEventListener("change", (e) => {
        const selectedId = e.target.value;
        const found = roomTypes.find(rt => rt.Room_Type_ID == selectedId);
        if (found) {
            document.getElementById("daily_rate").value = found.Daily_Rate || "";
        } else {
            document.getElementById("daily_rate").value = "";
        }
    });

    // Search, Filter, and Sort Listeners
    document.getElementById("search_input").addEventListener("input", filterAndSortRooms);
    document.getElementById("filter_status").addEventListener("change", filterAndSortRooms);
    const filterRoomType = document.getElementById("filter_room_type") || document.getElementById("filter_type");
    if (filterRoomType) {
        filterRoomType.addEventListener("change", filterAndSortRooms);
    }
    document.getElementById("sort_by").addEventListener("change", filterAndSortRooms);
});

/**
 * Modal Window Helpers
 */
const openModal = () => {
    const modal = document.getElementById("formModal");
    if (modal) {
        modal.classList.add("active");
        modal.style.display = "flex";
        const firstInput = document.getElementById("room_name");
        if (firstInput) firstInput.focus();
    }
};

const closeModal = () => {
    const modal = document.getElementById("formModal");
    if (modal) {
        modal.classList.remove("active");
        modal.style.display = "none";
    }
};

/**
 * Load room types (Daily_Rate is in Enum_Room_Type)
 */
const loadRoomTypes = async () => {
    try {
        console.log("[API] Loading room types...");
        const response = await axios.get(`${baseApiUrl}/rooms.php`, {
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

/**
 * Fetch both Rooms and Beds
 */
const displayRoomsAndBeds = async () => {
    try {
        console.log("[API] Fetching rooms and beds...");
        const [roomsRes, bedsRes] = await Promise.all([
            axios.get(`${baseApiUrl}/rooms.php`, { params: { operation: "getAllRooms" } }),
            axios.get(`${baseApiUrl}/rooms.php`, { params: { operation: "getAllBeds" } })
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

/**
 * Filter & sort rooms
 */
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

    // Sort
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

/**
 * Render Rooms table
 */
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
            <th>Actions</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rooms.forEach(r => {
        const isActive = (r.Is_Active == 1);
        const statusBadge = isActive 
            ? '<span class="badge badge-success">Active</span>' 
            : '<span class="badge badge-danger">Archived</span>';
        const toggleAction = isActive ? "Send to Archive" : "Restore";
        const toggleIcon = isActive ? "🗑️" : "🔄";
        const toggleTitle = isActive ? "Send to Archive (Soft Delete)" : "Restore Room";
        const toggleBtnClass = isActive ? "btn-warning btn-archive" : "btn-success btn-restore";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${r.Room_Name}</strong></td>
            <td><span class="badge badge-info">${r.Type_Name}</span></td>
            <td>₱ ${parseFloat(r.Daily_Rate).toFixed(2)}</td>
            <td>${r.Capacity} bed(s)</td>
            <td><span class="badge badge-success">${r.Vacant_Beds} vacant</span></td>
            <td><span class="badge badge-warning">${r.Occupied_Beds} occupied</span></td>
            <td>${statusBadge}</td>
            <td>
                <div class="table-actions">
                    <button type="button" class="btn btn-sm btn-icon btn-secondary btn-action-edit" data-id="${r.Room_ID}" title="Edit Room" aria-label="Edit Room">✏️</button>
                    <button type="button" class="btn btn-sm btn-icon ${toggleBtnClass} btn-action-soft-delete" data-id="${r.Room_ID}" data-status="${r.Is_Active}" data-name="${r.Room_Name}" title="${toggleTitle}" aria-label="${toggleTitle}">${toggleIcon}</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);

    // Event delegation
    document.querySelectorAll(".btn-action-edit").forEach(btn => {
        btn.addEventListener("click", () => loadRoomForEdit(btn.dataset.id));
    });

    document.querySelectorAll(".btn-action-soft-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            toggleRoomStatus(btn.dataset.id, btn.dataset.status, btn.dataset.name);
        });
    });

    document.querySelectorAll(".btn-action-hard-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            hardDeleteRoom(btn.dataset.id, btn.dataset.name);
        });
    });
};

/**
 * Render Beds table (Room_Bed)
 */
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

/**
 * Load room for edit
 */
const loadRoomForEdit = async (roomId) => {
    try {
        console.log(`[API] Requesting room details for ID: ${roomId}`);
        const response = await axios.get(`${baseApiUrl}/rooms.php`, {
            params: {
                operation: "getRoomById",
                json: JSON.stringify({ room_id: roomId })
            }
        });

        if (response.status === 200 && response.data) {
            const r = response.data;
            document.getElementById("room_id").value = r.Room_ID;
            document.getElementById("room_name").value = r.Room_Name;
            document.getElementById("room_type_id").value = r.Room_Type_ID;
            document.getElementById("daily_rate").value = r.Daily_Rate;
            document.getElementById("capacity").value = r.Capacity || 1;
            document.getElementById("capacity").disabled = true;

            document.getElementById("form-title").textContent = `Edit Room (${r.Room_Name})`;
            document.getElementById("btnSubmit").textContent = "Update Room";
            openModal();
        }
    } catch (error) {
        console.error("[API] Error loading room:", error);
    }
};

/**
 * Save Room (Insert or Update via POST)
 */
const saveRoom = async () => {
    const roomId = document.getElementById("room_id").value;
    const roomName = document.getElementById("room_name").value.trim();
    const typeId = document.getElementById("room_type_id").value;
    const capacity = document.getElementById("capacity").value;

    if (!roomName || !typeId) {
        alert("Please fill in Room Name and Classification.");
        return;
    }

    const jsonData = {
        room_name: roomName,
        room_type_id: typeId,
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
            url: `${baseApiUrl}/rooms.php`,
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

/**
 * Reset form
 */
const resetForm = () => {
    document.getElementById("room_id").value = "";
    document.getElementById("room_name").value = "";
    document.getElementById("room_type_id").value = "";
    document.getElementById("daily_rate").value = "";
    document.getElementById("capacity").value = "1";
    document.getElementById("capacity").disabled = false;

    document.getElementById("form-title").textContent = "Add New Room";
    document.getElementById("btnSubmit").textContent = "Submit Room";
    document.getElementById("btnCancel").style.display = "none";
};

/**
 * Soft Delete / Restore (POST)
 */
const toggleRoomStatus = async (roomId, currentStatus, name) => {
    const actionText = (currentStatus == 1) ? "send to the System Archive" : "restore from the System Archive";
    if (!confirm(`Are you sure you want to ${actionText} room "${name}"?\n\n(Archived rooms keep records of past board and lodging stays intact)`)) {
        return;
    }

    const formData = new FormData();
    formData.append("operation", "toggleStatus");
    formData.append("json", JSON.stringify({ room_id: roomId }));

    try {
        const response = await axios({
            url: `${baseApiUrl}/rooms.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            displayRoomsAndBeds();
        } else {
            alert("Error updating room status.");
        }
    } catch (error) {
        console.error("[Error] Toggle failed:", error);
        alert("Error occurred.");
    }
};

/**
 * Hard Delete (POST)
 */
const hardDeleteRoom = async (roomId, name) => {
    if (!confirm(`WARNING: Are you sure you want to HARD DELETE room "${name}" and its beds from MySQL?\n\nThis permanently removes the room and cannot be undone!`)) {
        return;
    }

    const formData = new FormData();
    formData.append("operation", "hardDeleteRoom");
    formData.append("json", JSON.stringify({ room_id: roomId }));

    try {
        const response = await axios({
            url: `${baseApiUrl}/rooms.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            alert(`"${name}" was permanently deleted.`);
            displayRoomsAndBeds();
        } else if (response.data && response.data.message) {
            alert(response.data.message);
        } else {
            alert("Could not permanently delete room record.");
        }
    } catch (error) {
        console.error("[Error] Hard delete failed:", error);
        alert("Server error during deletion.");
    }
};
