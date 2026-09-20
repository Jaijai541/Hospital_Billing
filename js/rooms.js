/**
 * Hospital Rooms & Beds Controller (Axios / Frontend)
 * Follows the Book example structure: dynamic table creation with border="1"
 * Handles Room Classifications, Daily Rates, Availability, Search, Filter, Sort, and Console Logging
 */

const baseApiUrl = "http://localhost/Hospital_Billing/api";
let allRooms = []; // In-memory cache for fast search, filter, and sort

document.addEventListener("DOMContentLoaded", () => {
    // 1. Session Verification
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

    // 2. Initial Data Load
    displayRoomTypes();
    displayRooms();

    // 3. Form Event Listeners
    document.getElementById("btnSubmit").addEventListener("click", saveRoom);
    document.getElementById("btnCancel").addEventListener("click", resetForm);

    // 4. Search, Filter, and Sort Listeners
    document.getElementById("search_input").addEventListener("input", filterAndSortRooms);
    document.getElementById("filter_status").addEventListener("change", filterAndSortRooms);
    document.getElementById("filter_room_type").addEventListener("change", filterAndSortRooms);
    document.getElementById("filter_availability").addEventListener("change", filterAndSortRooms);
    document.getElementById("sort_by").addEventListener("change", filterAndSortRooms);
});

/**
 * Fetch all rooms from API into memory and apply initial filter/sort
 */
const displayRooms = async () => {
    const tableDiv = document.getElementById("table-div");

    try {
        console.log("[API] Requesting: getAllRooms");
        const response = await axios.get(`${baseApiUrl}/rooms.php`, {
            params: { operation: "getAllRooms" }
        });

        if (response.status === 200) {
            allRooms = response.data || [];
            console.log(`[API] Success: Loaded ${allRooms.length} hospital rooms.`);
            filterAndSortRooms();
        } else {
            console.error("[API] Error loading rooms:", response);
            alert("Error loading rooms directory!");
        }
    } catch (error) {
        console.error("[API] Network error:", error);
        tableDiv.innerHTML = `<p style="color: red;">Failed to connect to API.</p>`;
    }
};

/**
 * Search, Filter, and Sort the rooms list dynamically
 */
const filterAndSortRooms = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();
    const filterStatus = document.getElementById("filter_status").value;
    const filterRoomType = document.getElementById("filter_room_type").value;
    const filterAvailability = document.getElementById("filter_availability").value;
    const sortBy = document.getElementById("sort_by").value;

    let filtered = allRooms.filter(r => {
        const roomNum = r.Room_Number.toLowerCase();
        const typeName = r.Type_Name.toLowerCase();

        // Search filter (by Room Number or Type Name)
        const matchesSearch = roomNum.includes(searchTerm) || typeName.includes(searchTerm);

        // Status filter (All, Active, Soft-Deleted)
        let matchesStatus = true;
        if (filterStatus === "1") {
            matchesStatus = (r.Is_Active == 1);
        } else if (filterStatus === "0") {
            matchesStatus = (r.Is_Active == 0);
        }

        // Room Type filter
        let matchesType = true;
        if (filterRoomType !== "all") {
            matchesType = (r.Room_Type_ID == filterRoomType);
        }

        // Availability filter (Vacant / Occupied)
        let matchesAvailability = true;
        if (filterAvailability !== "all") {
            matchesAvailability = (r.Is_Available == filterAvailability);
        }

        return matchesSearch && matchesStatus && matchesType && matchesAvailability;
    });

    // Sorting logic
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
            case "id_desc":
                return parseInt(b.Room_ID) - parseInt(a.Room_ID);
            default:
                return 0;
        }
    });

    console.log(`[UI] Filtered & Sorted Rooms: Displaying ${filtered.length} of ${allRooms.length} items`);
    displayRoomsTable(filtered);
};

/**
 * Render pure HTML table matching Book/app.js pattern
 */
const displayRoomsTable = (rooms) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!rooms || rooms.length === 0) {
        tableDiv.innerHTML = "<p>No matching rooms found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.border = "1";
    table.cellPadding = "5";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Room Number</th>
            <th>Room Classification</th>
            <th>Daily Board & Lodging Rate</th>
            <th>Availability</th>
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
        const availabilityText = (r.Is_Available == 1) ? "Vacant" : "Occupied";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${r.Room_Number}</strong></td>
            <td>${r.Type_Name}</td>
            <td>₱ ${parseFloat(r.Daily_Rate).toFixed(2)} / day</td>
            <td>${availabilityText}</td>
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

    // Event delegation with semantic classes
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
 * Fetch and populate room classification types (for both form and filter)
 */
const displayRoomTypes = async () => {
    const formSelect = document.getElementById("room_type_id");
    const filterSelect = document.getElementById("filter_room_type");

    try {
        console.log("[API] Requesting: getAllRoomTypes");
        const response = await axios.get(`${baseApiUrl}/rooms.php`, {
            params: { operation: "getAllRoomTypes" }
        });

        if (response.status === 200) {
            const types = response.data;
            formSelect.innerHTML = `<option value="">Select Room Type...</option>`;
            filterSelect.innerHTML = `<option value="all">All Room Types</option>`;

            types.forEach(t => {
                const opt1 = document.createElement("option");
                opt1.value = t.Room_Type_ID;
                opt1.textContent = t.Type_Name;
                formSelect.appendChild(opt1);

                const opt2 = document.createElement("option");
                opt2.value = t.Room_Type_ID;
                opt2.textContent = t.Type_Name;
                filterSelect.appendChild(opt2);
            });
            console.log(`[API] Loaded ${types.length} room types.`);
        }
    } catch (error) {
        console.error("[API] Error loading room types:", error);
    }
};

/**
 * Load existing room data into form for editing
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

            document.getElementById("form-title").textContent = `Edit Room (${r.Room_Number})`;
            document.getElementById("btnSubmit").textContent = "Update Room";
            document.getElementById("btnCancel").style.display = "inline";
            window.scrollTo({ top: 0, behavior: "smooth" });
            console.log("[UI] Form populated for edit:", r);
        }
    } catch (error) {
        console.error("[API] Error loading room details:", error);
        alert("Failed to load room details.");
    }
};

/**
 * Insert or Update Room (POST)
 */
const saveRoom = async () => {
    const roomId = document.getElementById("room_id").value;
    const roomNumber = document.getElementById("room_number").value.trim().toUpperCase();
    const roomTypeId = document.getElementById("room_type_id").value;
    const dailyRate = document.getElementById("daily_rate").value;

    if (!roomNumber || !roomTypeId || dailyRate === "") {
        alert("Please fill in all fields.");
        return;
    }

    const jsonData = {
        room_number: roomNumber,
        room_type_id: roomTypeId,
        daily_rate: parseFloat(dailyRate)
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
            console.log(`[Success] ${operation} completed successfully.`);
            alert(isEdit ? "Room updated successfully!" : "Room added successfully!");
            resetForm();
            displayRooms();
        } else if (response.data && response.data.message) {
            console.warn(`[Validation Error]`, response.data.message);
            alert(response.data.message);
        } else {
            console.warn(`[Failed] ${operation} returned non-success:`, response.data);
            alert("Error saving room.");
        }
    } catch (error) {
        console.error("[Error] Save request failed:", error);
        alert("Server error occurred.");
    }
};

/**
 * Reset form back to Add mode
 */
const resetForm = () => {
    document.getElementById("room_id").value = "";
    document.getElementById("room_number").value = "";
    document.getElementById("room_type_id").value = "";
    document.getElementById("daily_rate").value = "";

    document.getElementById("form-title").textContent = "Add New Room / Bed";
    document.getElementById("btnSubmit").textContent = "Submit";
    document.getElementById("btnCancel").style.display = "none";
    console.log("[UI] Form reset to Add mode.");
};

/**
 * Soft Delete / Restore (POST)
 */
const toggleRoomStatus = async (roomId, currentStatus, name) => {
    const actionText = (currentStatus == 1) ? "SOFT DELETE (mark as inactive)" : "RESTORE (reactivate)";
    if (!confirm(`Are you sure you want to ${actionText} Room "${name}"?\n\n(Soft Delete keeps the room in the database so past patient stays remain intact)`)) {
        return;
    }

    console.log(`[Action] Toggling status for Room ID: ${roomId} (Current: ${currentStatus})`);

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
            console.log(`[Success] Status toggled successfully for Room ID: ${roomId}`);
            displayRooms();
        } else {
            console.warn("[Failed] Status toggle returned non-success:", response.data);
            alert("Error updating status.");
        }
    } catch (error) {
        console.error("[Error] Toggle request failed:", error);
        alert("Error occurred.");
    }
};

/**
 * Hard Delete: Permanently remove the record from MySQL (POST)
 */
const hardDeleteRoom = async (roomId, name) => {
    if (!confirm(`WARNING: Are you sure you want to HARD DELETE (permanently remove) Room "${name}" from the database?\n\nThis action physically deletes the record from MySQL and cannot be undone!`)) {
        return;
    }

    console.log(`[Action] Attempting Hard Delete for Room ID: ${roomId}`);

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
            console.log(`[Success] Hard deleted Room ID: ${roomId}`);
            alert(`Room "${name}" was permanently deleted from the database.`);
            displayRooms();
        } else if (response.data && response.data.message) {
            console.warn("[Protected] Hard delete blocked:", response.data.message);
            alert(response.data.message);
        } else {
            console.error("[Failed] Hard delete failed:", response.data);
            alert("Error: Could not permanently delete room.");
        }
    } catch (error) {
        console.error("[Error] Hard delete request failed:", error);
        alert("Server error during hard delete.");
    }
};

