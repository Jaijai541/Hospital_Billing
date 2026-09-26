const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allCatalogs = [];
let currentLoadedCatalog = null;

document.addEventListener("DOMContentLoaded", () => {
    displayCatalogs();

    initModalControls("formModal", "btnOpenAddModal", "btnCloseModal", "btnCancel", resetForm);
    document.getElementById("btnSubmit").addEventListener("click", saveCatalogItem);

    const btnReset = document.getElementById("btnReset");
    if (btnReset) {
        btnReset.addEventListener("click", () => {
            if (currentLoadedCatalog) {
                populateCatalogForm(currentLoadedCatalog);
            } else {
                resetForm();
            }
        });
    }

    document.getElementById("category_type").addEventListener("change", (e) => {
        const val = e.target.value;
        const prefixInput = document.getElementById("code_prefix");
        if (val === "Medicine") prefixInput.value = "MED";
        else if (val === "Equipment Scan") prefixInput.value = "RAD";
        else if (val === "Service") prefixInput.value = "SRV";
        else prefixInput.value = "";
    });

    document.getElementById("search_input").addEventListener("input", filterAndSortCatalogs);
    document.getElementById("filter_category").addEventListener("change", filterAndSortCatalogs);
    document.getElementById("filter_status").addEventListener("change", filterAndSortCatalogs);
    document.getElementById("sort_by").addEventListener("change", filterAndSortCatalogs);
});

const displayCatalogs = async () => {
    const tableDiv = document.getElementById("table-div");

    try {
        console.log("[API] Requesting: getAllCatalogs");
        const response = await axios.get(`${getApiUrl}/catalogs.php`, {
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

const displayCatalogsTable = (items) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!items || items.length === 0) {
        tableDiv.innerHTML = "<p>No matching catalog items found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Code</th>
            <th>Item Name</th>
            <th>Category Type</th>
            <th>Unit Price</th>
            <th>Status</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    items.forEach(item => {
        let catBadge = '<span class="badge badge-info">' + item.Category_Type + '</span>';
        if (item.Category_Type === 'Medicine') catBadge = '<span class="badge badge-primary">Medicine</span>';
        else if (item.Category_Type === 'Equipment Scan') catBadge = '<span class="badge badge-warning">Scan</span>';

        const row = document.createElement("tr");
        row.className = "clickable-row";
        row.title = "Click to view / edit catalog item";
        row.innerHTML = `
            <td><strong>${item.Formatted_Code}</strong></td>
            <td><strong>${item.Item_Name}</strong></td>
            <td>${catBadge}</td>
            <td>₱ ${parseFloat(item.Unit_Price).toFixed(2)}</td>
            <td>${getStatusBadge(item.Is_Active)}</td>
        `;
        row.addEventListener("click", () => loadCatalogForEdit(item.Catalog_ID));
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);
};

const populateCatalogForm = (item) => {
    document.getElementById("catalog_id").value = item.Catalog_ID || "";
    document.getElementById("item_name").value = item.Item_Name || "";
    document.getElementById("category_type").value = item.Category_Type || "";
    document.getElementById("code_prefix").value = item.Code_Prefix || "";
    document.getElementById("unit_price").value = item.Unit_Price || "";
};

const loadCatalogForEdit = async (catalogId) => {
    try {
        console.log(`[API] Requesting item details for ID: ${catalogId}`);
        const response = await axios.get(`${getApiUrl}/catalogs.php`, {
            params: {
                operation: "getCatalogById",
                json: JSON.stringify({ catalog_id: catalogId })
            }
        });

        if (response.status === 200 && response.data) {
            const item = response.data;
            currentLoadedCatalog = item;
            populateCatalogForm(item);

            document.getElementById("form-title").textContent = `Edit Catalog Item (${item.Code_Prefix}-${String(item.Catalog_ID).padStart(3, '0')})`;
            document.getElementById("btnSubmit").textContent = "Update Item";

            const btnArchive = document.getElementById("btnArchive");
            if (btnArchive) {
                btnArchive.style.display = "inline-flex";
                const isActive = (item.Is_Active == 1);
                btnArchive.className = isActive ? "btn btn-warning btn-archive" : "btn btn-success btn-restore";
                btnArchive.textContent = isActive ? "Send to Archive" : "Restore Record";
                btnArchive.onclick = () => {
                    toggleRecordStatus("catalogs.php", "catalog_id", item.Catalog_ID, isActive ? 1 : 0, item.Item_Name, () => {
                        closeModal();
                        displayCatalogs();
                    });
                };
            }

            openModal();
        }
    } catch (error) {
        console.error("[API] Error loading catalog details:", error);
        alert("Failed to load item details.");
    }
};

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
            url: `${postApiUrl}/catalogs.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            alert(isEdit ? "Catalog item updated successfully!" : "Catalog item added successfully!");
            resetForm();
            closeModal();
            displayCatalogs();
        } else {
            alert("Error saving catalog item.");
        }
    } catch (error) {
        console.error("[Error] Save request failed:", error);
        alert("Server error occurred.");
    }
};

const resetForm = () => {
    currentLoadedCatalog = null;

    document.getElementById("catalog_id").value = "";
    document.getElementById("item_name").value = "";
    document.getElementById("category_type").value = "";
    document.getElementById("code_prefix").value = "";
    document.getElementById("unit_price").value = "";

    const btnArchive = document.getElementById("btnArchive");
    if (btnArchive) btnArchive.style.display = "none";

    document.getElementById("form-title").textContent = "Add New Charge Catalog Item";
    document.getElementById("btnSubmit").textContent = "Submit Item";
};
