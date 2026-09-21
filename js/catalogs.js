/**
 * Unified Charge Catalogs Controller (Axios / Frontend)
 * Follows classroom pure HTML standard: dynamic table creation with border="1"
 * Merges Medicines (MED), Equipment Scans (RAD), and Procedures (SRV)
 */

const baseApiUrl = "http://localhost/Hospital_Billing/api";
let allCatalogs = [];

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
    loadDropdowns();
    displayCatalogs();

    // Form Events
    document.getElementById("btnSubmit").addEventListener("click", saveCatalogItem);
    document.getElementById("btnCancel").addEventListener("click", resetForm);

    // Live Fee Calculation
    document.getElementById("hospital_fee").addEventListener("input", updateTotalFeeDisplay);
    document.getElementById("reader_fee").addEventListener("input", updateTotalFeeDisplay);

    // Search, Filter, and Sort Listeners
    document.getElementById("search_input").addEventListener("input", filterAndSortCatalogs);
    document.getElementById("filter_type").addEventListener("change", filterAndSortCatalogs);
    document.getElementById("filter_station").addEventListener("change", filterAndSortCatalogs);
    document.getElementById("filter_status").addEventListener("change", filterAndSortCatalogs);
    document.getElementById("sort_by").addEventListener("change", filterAndSortCatalogs);
});

/**
 * Live total fee calculation
 */
const updateTotalFeeDisplay = () => {
    const hosp = parseFloat(document.getElementById("hospital_fee").value) || 0;
    const reader = parseFloat(document.getElementById("reader_fee").value) || 0;
    const total = hosp + reader;
    document.getElementById("total_fee_display").textContent = `₱ ${total.toFixed(2)}`;
};

/**
 * Load Catalog Types and Departments for form and filters
 */
const loadDropdowns = async () => {
    try {
        console.log("[API] Requesting dropdown lookups...");
        const [typesRes, deptsRes] = await Promise.all([
            axios.get(`${baseApiUrl}/catalogs.php`, { params: { operation: "getCatalogTypes" } }),
            axios.get(`${baseApiUrl}/departments.php`, { params: { operation: "getAllDepartments" } })
        ]);

        if (typesRes.status === 200 && typesRes.data) {
            const typeSelect = document.getElementById("catalog_type_id");
            const filterType = document.getElementById("filter_type");
            typeSelect.innerHTML = `<option value="">Select Category...</option>`;

            typesRes.data.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t.Catalog_Type_ID;
                opt.textContent = `${t.Type_Name} (${t.Code_Prefix})`;
                typeSelect.appendChild(opt);

                const filterOpt = document.createElement("option");
                filterOpt.value = t.Catalog_Type_ID;
                filterOpt.textContent = `${t.Type_Name} (${t.Code_Prefix})`;
                filterType.appendChild(filterOpt);
            });
        }

        if (deptsRes.status === 200 && deptsRes.data) {
            const deptSelect = document.getElementById("station_id");
            const filterDept = document.getElementById("filter_station");
            deptSelect.innerHTML = `<option value="">Select Department...</option>`;

            deptsRes.data.forEach(d => {
                const opt = document.createElement("option");
                opt.value = d.Station_ID;
                opt.textContent = d.Station_Name;
                deptSelect.appendChild(opt);

                const filterOpt = document.createElement("option");
                filterOpt.value = d.Station_ID;
                filterOpt.textContent = d.Station_Name;
                filterDept.appendChild(filterOpt);
            });
        }
    } catch (error) {
        console.error("[API] Error loading dropdown options:", error);
    }
};

/**
 * Fetch all catalog items from API
 */
const displayCatalogs = async () => {
    const tableDiv = document.getElementById("table-div");

    try {
        console.log("[API] Requesting: getAllCatalogs");
        const response = await axios.get(`${baseApiUrl}/catalogs.php`, {
            params: { operation: "getAllCatalogs" }
        });

        if (response.status === 200) {
            allCatalogs = response.data || [];
            console.log(`[API] Success: Loaded ${allCatalogs.length} catalog items.`);
            filterAndSortCatalogs();
        } else {
            alert("Error loading catalog records!");
        }
    } catch (error) {
        console.error("[API] Network error:", error);
        tableDiv.innerHTML = `<p style="color: red;">Failed to connect to API.</p>`;
    }
};

/**
 * Filter and sort catalog items
 */
const filterAndSortCatalogs = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();
    const filterType = document.getElementById("filter_type").value;
    const filterDept = document.getElementById("filter_station").value;
    const filterStatus = document.getElementById("filter_status").value;
    const sortBy = document.getElementById("sort_by").value;

    let filtered = allCatalogs.filter(item => {
        const name = (item.Item_Name || "").toLowerCase();
        const code = (item.Item_Code || "").toLowerCase();

        const matchesSearch = name.includes(searchTerm) || code.includes(searchTerm);

        let matchesType = true;
        if (filterType !== "all") matchesType = (item.Catalog_Type_ID == filterType);

        let matchesDept = true;
        if (filterDept !== "all") matchesDept = (item.Station_ID == filterDept);

        let matchesStatus = true;
        if (filterStatus === "1") matchesStatus = (item.Is_Active == 1);
        else if (filterStatus === "0") matchesStatus = (item.Is_Active == 0);

        return matchesSearch && matchesType && matchesDept && matchesStatus;
    });

    // Sort
    filtered.sort((a, b) => {
        switch (sortBy) {
            case "code_asc":
                return a.Item_Code.localeCompare(b.Item_Code, undefined, { numeric: true });
            case "code_desc":
                return b.Item_Code.localeCompare(a.Item_Code, undefined, { numeric: true });
            case "name_asc":
                return a.Item_Name.localeCompare(b.Item_Name);
            case "name_desc":
                return b.Item_Name.localeCompare(a.Item_Name);
            case "total_asc":
                return parseFloat(a.Total_Fee) - parseFloat(b.Total_Fee);
            case "total_desc":
                return parseFloat(b.Total_Fee) - parseFloat(a.Total_Fee);
            case "id_desc":
                return parseInt(b.Item_ID) - parseInt(a.Item_ID);
            default:
                return 0;
        }
    });

    console.log(`[UI] Displaying ${filtered.length} of ${allCatalogs.length} catalog items.`);
    displayCatalogsTable(filtered);
};

/**
 * Render dynamic pure HTML table
 */
const displayCatalogsTable = (items) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!items || items.length === 0) {
        tableDiv.innerHTML = "<p>No matching catalog items found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.border = "1";
    table.cellPadding = "5";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Code</th>
            <th>Item / Procedure Name</th>
            <th>Category</th>
            <th>Department</th>
            <th>Hospital Fee</th>
            <th>Reader Fee</th>
            <th>Total Billing Fee</th>
            <th>Performer Role</th>
            <th>Status</th>
            <th>Actions</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    items.forEach(item => {
        const isActive = (item.Is_Active == 1);
        const statusText = isActive ? "Active" : "Inactive (Soft Deleted)";
        const toggleAction = isActive ? "Soft Delete" : "Restore";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${item.Item_Code}</strong></td>
            <td>${item.Item_Name}</td>
            <td>${item.Catalog_Type_Name}</td>
            <td>${item.Station_Name}</td>
            <td>₱ ${parseFloat(item.Hospital_Fee).toFixed(2)}</td>
            <td>₱ ${parseFloat(item.Reader_Fee).toFixed(2)}</td>
            <td><strong>₱ ${parseFloat(item.Total_Fee).toFixed(2)}</strong></td>
            <td>${item.Performer_Role || 'N/A'}</td>
            <td>${statusText}</td>
            <td>
                <button type="button" class="btn-action-edit" data-id="${item.Item_ID}">Edit</button>
                <button type="button" class="btn-action-soft-delete" data-id="${item.Item_ID}" data-status="${item.Is_Active}" data-name="${item.Item_Name}">${toggleAction}</button>
                <button type="button" class="btn-action-hard-delete" data-id="${item.Item_ID}" data-name="${item.Item_Name}">Hard Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);

    // Event delegation
    document.querySelectorAll(".btn-action-edit").forEach(btn => {
        btn.addEventListener("click", () => loadCatalogForEdit(btn.dataset.id));
    });

    document.querySelectorAll(".btn-action-soft-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            toggleCatalogStatus(btn.dataset.id, btn.dataset.status, btn.dataset.name);
        });
    });

    document.querySelectorAll(".btn-action-hard-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            hardDeleteCatalog(btn.dataset.id, btn.dataset.name);
        });
    });
};

/**
 * Load catalog item for edit
 */
const loadCatalogForEdit = async (itemId) => {
    try {
        console.log(`[API] Requesting item details for ID: ${itemId}`);
        const response = await axios.get(`${baseApiUrl}/catalogs.php`, {
            params: {
                operation: "getCatalogById",
                json: JSON.stringify({ item_id: itemId })
            }
        });

        if (response.status === 200 && response.data) {
            const item = response.data;
            document.getElementById("item_id").value = item.Item_ID;
            document.getElementById("catalog_type_id").value = item.Catalog_Type_ID;
            document.getElementById("station_id").value = item.Station_ID;
            document.getElementById("item_name").value = item.Item_Name;
            document.getElementById("hospital_fee").value = item.Hospital_Fee;
            document.getElementById("reader_fee").value = item.Reader_Fee;
            document.getElementById("performer_role").value = item.Performer_Role || "";

            updateTotalFeeDisplay();

            document.getElementById("form-title").textContent = `Edit Catalog Item (${item.Item_Code})`;
            document.getElementById("btnSubmit").textContent = "Update Item";
            document.getElementById("btnCancel").style.display = "inline";
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    } catch (error) {
        console.error("[API] Error loading catalog details:", error);
        alert("Failed to load item details.");
    }
};

/**
 * Save Catalog Item (Insert or Update via POST)
 */
const saveCatalogItem = async () => {
    const itemId = document.getElementById("item_id").value;
    const typeId = document.getElementById("catalog_type_id").value;
    const stationId = document.getElementById("station_id").value;
    const itemName = document.getElementById("item_name").value.trim();
    const hospFee = document.getElementById("hospital_fee").value;
    const readerFee = document.getElementById("reader_fee").value || 0;
    const role = document.getElementById("performer_role").value.trim();

    if (!typeId || !stationId || !itemName || hospFee === "") {
        alert("Please fill in Category, Department, Item Name, and Hospital Fee.");
        return;
    }

    const jsonData = {
        catalog_type_id: typeId,
        station_id: stationId,
        item_name: itemName,
        hospital_fee: parseFloat(hospFee),
        reader_fee: parseFloat(readerFee),
        performer_role: role
    };

    const isEdit = (itemId !== "");
    const operation = isEdit ? "updateCatalog" : "insertCatalog";

    if (isEdit) {
        jsonData.item_id = itemId;
    }

    console.log(`[Action] Submitting ${operation} via POST:`, jsonData);

    const formData = new FormData();
    formData.append("operation", operation);
    formData.append("json", JSON.stringify(jsonData));

    try {
        const response = await axios({
            url: `${baseApiUrl}/catalogs.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            alert(isEdit ? "Catalog item updated successfully!" : "Catalog item added successfully!");
            resetForm();
            displayCatalogs();
        } else {
            alert("Error saving catalog item.");
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
    document.getElementById("item_id").value = "";
    document.getElementById("catalog_type_id").value = "";
    document.getElementById("station_id").value = "";
    document.getElementById("item_name").value = "";
    document.getElementById("hospital_fee").value = "";
    document.getElementById("reader_fee").value = "0.00";
    document.getElementById("performer_role").value = "";
    document.getElementById("total_fee_display").textContent = "₱ 0.00";

    document.getElementById("form-title").textContent = "Add New Charge Catalog Item";
    document.getElementById("btnSubmit").textContent = "Submit Item";
    document.getElementById("btnCancel").style.display = "none";
};

/**
 * Soft Delete / Restore (POST)
 */
const toggleCatalogStatus = async (itemId, currentStatus, name) => {
    const actionText = (currentStatus == 1) ? "SOFT DELETE (deactivate)" : "RESTORE (reactivate)";
    if (!confirm(`Are you sure you want to ${actionText} "${name}"?\n\n(Soft Delete preserves historical doctor orders and billing ledger records)`)) {
        return;
    }

    console.log(`[Action] Toggling status for Item ID: ${itemId}`);

    const formData = new FormData();
    formData.append("operation", "toggleStatus");
    formData.append("json", JSON.stringify({ item_id: itemId }));

    try {
        const response = await axios({
            url: `${baseApiUrl}/catalogs.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            displayCatalogs();
        } else {
            alert("Error updating item status.");
        }
    } catch (error) {
        console.error("[Error] Toggle failed:", error);
        alert("Error occurred.");
    }
};

/**
 * Hard Delete (POST)
 */
const hardDeleteCatalog = async (itemId, name) => {
    if (!confirm(`WARNING: Are you sure you want to HARD DELETE "${name}" from MySQL?\n\nThis permanently removes the record and cannot be undone!`)) {
        return;
    }

    console.log(`[Action] Hard deleting Item ID: ${itemId}`);

    const formData = new FormData();
    formData.append("operation", "hardDeleteCatalog");
    formData.append("json", JSON.stringify({ item_id: itemId }));

    try {
        const response = await axios({
            url: `${baseApiUrl}/catalogs.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            alert(`"${name}" was permanently deleted.`);
            displayCatalogs();
        } else if (response.data && response.data.message) {
            alert(response.data.message);
        } else {
            alert("Could not permanently delete catalog item.");
        }
    } catch (error) {
        console.error("[Error] Hard delete failed:", error);
        alert("Server error during deletion.");
    }
};
