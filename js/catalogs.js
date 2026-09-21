/**
 * Unified Charge Catalogs Controller (Axios / Frontend)
 * Follows classroom pure HTML standard: dynamic table creation with border="1"
 * Handles Charge_Catalogs: Catalog_ID, Item_Name, Category_Type, Code_Prefix, Unit_Price
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

    // Auto-fill prefix on category selection
    document.getElementById("category_type").addEventListener("change", (e) => {
        const val = e.target.value;
        const prefixInput = document.getElementById("code_prefix");
        if (val === "Medicine") prefixInput.value = "MED";
        else if (val === "Equipment Scan") prefixInput.value = "RAD";
        else if (val === "Service") prefixInput.value = "SRV";
        else prefixInput.value = "";
    });

    // Initial Data Load
    displayCatalogs();

    // Form Events
    document.getElementById("btnSubmit").addEventListener("click", saveCatalogItem);
    document.getElementById("btnCancel").addEventListener("click", resetForm);

    // Search, Filter, and Sort Listeners
    document.getElementById("search_input").addEventListener("input", filterAndSortCatalogs);
    document.getElementById("filter_category").addEventListener("change", filterAndSortCatalogs);
    document.getElementById("filter_status").addEventListener("change", filterAndSortCatalogs);
    document.getElementById("sort_by").addEventListener("change", filterAndSortCatalogs);
});

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
    const filterCategory = document.getElementById("filter_category").value;
    const filterStatus = document.getElementById("filter_status").value;
    const sortBy = document.getElementById("sort_by").value;

    let filtered = allCatalogs.filter(item => {
        const name = (item.Item_Name || "").toLowerCase();
        const code = (item.Formatted_Code || "").toLowerCase();

        const matchesSearch = name.includes(searchTerm) || code.includes(searchTerm);

        let matchesCat = true;
        if (filterCategory !== "all") matchesCat = (item.Category_Type === filterCategory);

        let matchesStatus = true;
        if (filterStatus === "1") matchesStatus = (item.Is_Active == 1);
        else if (filterStatus === "0") matchesStatus = (item.Is_Active == 0);

        return matchesSearch && matchesCat && matchesStatus;
    });

    // Sort
    filtered.sort((a, b) => {
        switch (sortBy) {
            case "code_asc":
                return a.Formatted_Code.localeCompare(b.Formatted_Code, undefined, { numeric: true });
            case "code_desc":
                return b.Formatted_Code.localeCompare(a.Formatted_Code, undefined, { numeric: true });
            case "name_asc":
                return a.Item_Name.localeCompare(b.Item_Name);
            case "name_desc":
                return b.Item_Name.localeCompare(a.Item_Name);
            case "price_asc":
                return parseFloat(a.Unit_Price) - parseFloat(b.Unit_Price);
            case "price_desc":
                return parseFloat(b.Unit_Price) - parseFloat(a.Unit_Price);
            case "id_desc":
                return parseInt(b.Catalog_ID) - parseInt(a.Catalog_ID);
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
            <th>Item Name</th>
            <th>Category Type</th>
            <th>Unit Price (₱)</th>
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
            <td><strong>${item.Formatted_Code}</strong></td>
            <td>${item.Item_Name}</td>
            <td>${item.Category_Type}</td>
            <td>₱ ${parseFloat(item.Unit_Price).toFixed(2)}</td>
            <td>${statusText}</td>
            <td>
                <button type="button" class="btn-action-edit" data-id="${item.Catalog_ID}">Edit</button>
                <button type="button" class="btn-action-soft-delete" data-id="${item.Catalog_ID}" data-status="${item.Is_Active}" data-name="${item.Item_Name}">${toggleAction}</button>
                <button type="button" class="btn-action-hard-delete" data-id="${item.Catalog_ID}" data-name="${item.Item_Name}">Hard Delete</button>
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
const loadCatalogForEdit = async (catalogId) => {
    try {
        console.log(`[API] Requesting item details for ID: ${catalogId}`);
        const response = await axios.get(`${baseApiUrl}/catalogs.php`, {
            params: {
                operation: "getCatalogById",
                json: JSON.stringify({ catalog_id: catalogId })
            }
        });

        if (response.status === 200 && response.data) {
            const item = response.data;
            document.getElementById("catalog_id").value = item.Catalog_ID;
            document.getElementById("item_name").value = item.Item_Name;
            document.getElementById("category_type").value = item.Category_Type;
            document.getElementById("code_prefix").value = item.Code_Prefix;
            document.getElementById("unit_price").value = item.Unit_Price;

            document.getElementById("form-title").textContent = `Edit Catalog Item (${item.Code_Prefix}-${String(item.Catalog_ID).padStart(3, '0')})`;
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
    const catalogId = document.getElementById("catalog_id").value;
    const itemName = document.getElementById("item_name").value.trim();
    const category = document.getElementById("category_type").value;
    const prefix = document.getElementById("code_prefix").value;
    const price = document.getElementById("unit_price").value;

    if (!itemName || !category || price === "") {
        alert("Please fill in Item Name, Category, and Unit Price.");
        return;
    }

    const jsonData = {
        item_name: itemName,
        category_type: category,
        code_prefix: prefix,
        unit_price: parseFloat(price)
    };

    const isEdit = (catalogId !== "");
    const operation = isEdit ? "updateCatalog" : "insertCatalog";

    if (isEdit) {
        jsonData.catalog_id = catalogId;
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
    document.getElementById("catalog_id").value = "";
    document.getElementById("item_name").value = "";
    document.getElementById("category_type").value = "";
    document.getElementById("code_prefix").value = "";
    document.getElementById("unit_price").value = "";

    document.getElementById("form-title").textContent = "Add New Charge Catalog Item";
    document.getElementById("btnSubmit").textContent = "Submit Item";
    document.getElementById("btnCancel").style.display = "none";
};

/**
 * Soft Delete / Restore (POST)
 */
const toggleCatalogStatus = async (catalogId, currentStatus, name) => {
    const actionText = (currentStatus == 1) ? "SOFT DELETE (deactivate)" : "RESTORE (reactivate)";
    if (!confirm(`Are you sure you want to ${actionText} "${name}"?\n\n(Soft Delete preserves historical billing ledgers)`)) {
        return;
    }

    console.log(`[Action] Toggling status for Catalog ID: ${catalogId}`);

    const formData = new FormData();
    formData.append("operation", "toggleStatus");
    formData.append("json", JSON.stringify({ catalog_id: catalogId }));

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
const hardDeleteCatalog = async (catalogId, name) => {
    if (!confirm(`WARNING: Are you sure you want to HARD DELETE "${name}" from MySQL?\n\nThis permanently removes the record and cannot be undone!`)) {
        return;
    }

    console.log(`[Action] Hard deleting Catalog ID: ${catalogId}`);

    const formData = new FormData();
    formData.append("operation", "hardDeleteCatalog");
    formData.append("json", JSON.stringify({ catalog_id: catalogId }));

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
