/**
 * Hospital Rooms, Wards & Beds Controller (Axios / Frontend)
 * Follows classroom pure HTML standard: dynamic table creation with border="1"
 * Supports Wards with multiple beds and individual bed tracking
 */

const baseApiUrl = "http://localhost/Hospital_Billing/api";
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

    // Form Events
    document.getElementById("btnSubmit").addEventListener("click", saveRoom);
    document.getElementById("btnCancel").addEventListener("click", resetForm);

    // Auto-fill daily rate on room type selection
    document.getElementById("room_type_id").addEventListener("change", (e) => {
        const selectedId = e.target.value;
        const found = roomTypes.find(rt => rt.Room_Type_ID == selectedId);
        if (found) {
            document.getElementById("daily_rate").value = found.Daily_Rate || "";
        }
    });

    // Search, Filter, and Sort Listeners
    document.getElementById("search_input").addEventListener("input", filterAndSortRooms);
    document.getElementById("filter_status").addEventListener("change", filterAndSortRooms);
    document.getElementById("filter_room_type").addEventListener("change", filterAndSortRooms);
    document.getElementById("sort_by").addEventListener("change", filterAndSortRooms);
});

/**
 * Load room types
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
                opt.textContent = `${rt.Type_Name} (₱ ${parseFloat(rt.Daily_Rate).toFixed(2)})`;
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
 * Filter & sort rooms/wards
 */
const filterAndSortRooms = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();
    const filterStatus = document.getElementById("filter_status").value;
    const filterType = document.getElementById("filter_room_type").value;
    const sortBy = document.getElementById("sort_by").value;

    let filtered = allRooms.filter(r => {
        const num = (r.Room_Number || "").toLowerCase();
        const matchesSearch = num.includes(searchTerm);

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
            case "number_asc":
                return a.Room_Number.localeCompare(b.Room_Number, undefined, { numeric: true });
            case "number_desc":
                return b.Room_Number.localeCompare(a.Room_Number, undefined, { numeric: true });
            case "rate_asc":
                return parseFloat(a.Daily_Rate) - parseFloat(b.Daily_Rate);
            case "rate_desc":
                return parseFloat(b.Daily_Rate) - parseFloat(a.Daily_Rate);
            case "beds_desc":
                return parseInt(b.Total_Beds) - parseInt(a.Total_Beds);
            default:
                return 0;
        }
    });

    displayRoomsTable(filtered);
};

/**
 * Render Wards/Rooms table
 */
const displayRoomsTable = (rooms) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!rooms || rooms.length === 0) {
        tableDiv.innerHTML = "<p>No matching rooms/wards found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.border = "1";
    table.cellPadding = "5";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Room / Ward Number</th>
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
        const statusText = isActive ? "Active" : "Inactive (Soft Deleted)";
        const toggleAction = isActive ? "Soft Delete" : "Restore";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${r.Room_Number}</strong></td>
            <td>${r.Type_Name}</td>
            <td>₱ ${parseFloat(r.Daily_Rate).toFixed(2)}</td>
            <td>${r.Total_Beds} bed(s)</td>
            <td style="color: green;"><strong>${r.Vacant_Beds} vacant</strong></td>
            <td style="color: orange;"><strong>${r.Occupied_Beds} occupied</strong></td>
            <td>${statusText}</td>
            <td>
                <button type="button" class="btn-action-edit" data-id="${r.Room_ID}">Edit</button>
                <button type="button" class="btn-action-soft-delete" data-id="${r.Room_ID}" data-status="${r.Is_Active}" data-name="${r.Room_Number}">${toggleAction}</button>
                <button type="button" class="btn-action-hard-delete" data-id="${r.Room_ID}" data-name="${r.Room_Number}">Hard Delete</button>
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
 * Render Beds table
 */
const displayBedsTable = (beds) => {
    const bedsDiv = document.getElementById("beds-table-div");
    bedsDiv.innerHTML = "";

    if (!beds || beds.length === 0) {
        bedsDiv.innerHTML = "<p>No beds registered.</p>";
        return;
    }

    const table = document.createElement("table");
    table.border = "1";
    table.cellPadding = "5";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Bed Code</th>
            <th>Room / Ward</th>
            <th>Bed Number</th>
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
        const availText = isAvail ? "✔ Vacant (Available)" : "Occupied";
        const availColor = isAvail ? "green" : "orange";
        const isActive = (b.Is_Active == 1);

        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${b.Bed_Code}</strong></td>
            <td>${b.Room_Number}</td>
            <td>${b.Bed_Number}</td>
            <td>${b.Type_Name}</td>
            <td>₱ ${parseFloat(b.Daily_Rate).toFixed(2)}</td>
            <td style="color: ${availColor};"><strong>${availText}</strong></td>
            <td>${isActive ? "Active" : "Inactive"}</td>
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
            document.getElementById("room_number").value = r.Room_Number;
            document.getElementById("room_type_id").value = r.Room_Type_ID;
            document.getElementById("daily_rate").value = r.Daily_Rate;
            document.getElementById("capacity_beds").value = r.Capacity_Beds || 1;
            document.getElementById("capacity_beds").disabled = true; // Bed capacity locked on edit

            document.getElementById("form-title").textContent = `Edit Room / Ward (${r.Room_Number})`;
            document.getElementById("btnSubmit").textContent = "Update Room";
            document.getElementById("btnCancel").style.display = "inline";
            window.scrollTo({ top: 0, behavior: "smooth" });
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
    const roomNum = document.getElementById("room_number").value.trim();
    const typeId = document.getElementById("room_type_id").value;
    const rate = document.getElementById("daily_rate").value;
    const capacity = document.getElementById("capacity_beds").value;

    if (!roomNum || !typeId || rate === "") {
        alert("Please fill in Room Number, Classification, and Daily Rate.");
        return;
    }

    const jsonData = {
        room_number: roomNum,
        room_type_id: typeId,
        daily_rate: parseFloat(rate),
        capacity_beds: parseInt(capacity) || 1
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
    document.getElementById("room_number").value = "";
    document.getElementById("room_type_id").value = "";
    document.getElementById("daily_rate").value = "";
    document.getElementById("capacity_beds").value = "1";
    document.getElementById("capacity_beds").disabled = false;

    document.getElementById("form-title").textContent = "Add New Ward / Room";
    document.getElementById("btnSubmit").textContent = "Submit Room";
    document.getElementById("btnCancel").style.display = "none";
};

/**
 * Soft Delete / Restore (POST)
 */
const toggleRoomStatus = async (roomId, currentStatus, name) => {
    const actionText = (currentStatus == 1) ? "SOFT DELETE (deactivate)" : "RESTORE (reactivate)";
    if (!confirm(`Are you sure you want to ${actionText} room "${name}"?\n\n(Soft Delete keeps records of past board and lodging stays intact)`)) {
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
