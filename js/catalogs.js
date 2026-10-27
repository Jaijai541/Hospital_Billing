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

    const catInput = document.getElementById("category_type_text");
    if (catInput) catInput.addEventListener("click", openCategoryPicker);
    const btnBrowseCat = document.getElementById("btnBrowse_category_type");
    if (btnBrowseCat) btnBrowseCat.addEventListener("click", openCategoryPicker);

    document.getElementById("search_input").addEventListener("input", filterAndSortCatalogs);
    document.getElementById("filter_category").addEventListener("change", filterAndSortCatalogs);
    const filterStationElem = document.getElementById("filter_station");
    if (filterStationElem) filterStationElem.addEventListener("change", filterAndSortCatalogs);
    document.getElementById("filter_status").addEventListener("change", filterAndSortCatalogs);
    const sortByElem = document.getElementById("sort_by"); if (sortByElem) sortByElem.addEventListener("change", filterAndSortCatalogs);

    initRefreshBtn("btnRefreshCatalogs", displayCatalogs);
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
    const filterStation = document.getElementById("filter_station")?.value || "all";
    const filterStatus = document.getElementById("filter_status").value;
    const sortBy = document.getElementById("sort_by")?.value || "id_desc";

    let filtered = allCatalogs.filter(item => {
        const name = (item.Item_Name || "").toLowerCase();
        const code = (item.Formatted_Code || "").toLowerCase();

        const matchesSearch = name.includes(searchTerm) || code.includes(searchTerm);

        let matchesCat = true;
        if (filterCategory !== "all") matchesCat = (item.Category_Type === filterCategory);

        let matchesStation = true;
        if (filterStation !== "all") matchesStation = (String(item.Station_ID) === String(filterStation));

        let matchesStatus = true;
        if (filterStatus === "1") matchesStatus = (item.Is_Active == 1);
        else if (filterStatus === "0") matchesStatus = (item.Is_Active == 0);

        return matchesSearch && matchesCat && matchesStation && matchesStatus;
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
    if (typeof updateFilterCount === "function") {
        updateFilterCount(filtered.length, allCatalogs.length, "catalog items");
    }
    displayCatalogsTable(filtered);
};

const displayCatalogsTable = (items) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!items || items.length === 0) {
        tableDiv.innerHTML = typeof getEmptyStateHtml === "function"
            ? getEmptyStateHtml("📦", "No catalog items found", "No items match your search in this catalog category.")
            : "<p>No matching catalog items found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            ${renderSortableTh("Item & Catalog Code", "Item_Name")}
            ${renderSortableTh("Category", "Item_Category")}
            ${renderSortableTh("Owning Department", "Station_Name")}
            ${renderSortableTh("Unit Price", "Unit_Price")}
            ${renderSortableTh("Status", "Status")}
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    items.forEach(item => {
        let catBadge = '<span class="cat-pill cat-srv">' + (item.Category_Type || 'Service') + '</span>';
        if (item.Category_Type === 'Medicine') catBadge = '<span class="cat-pill cat-med">Medicine</span>';
        else if (item.Category_Type === 'Equipment Scan') catBadge = '<span class="cat-pill cat-scan">Equipment Scan</span>';

        const row = document.createElement("tr");
        row.className = "clickable-row";
        row.title = "Click to view / edit catalog item";
        row.innerHTML = `
            <td>
                <div class="table-primary-text font-bold">${item.Item_Name}</div>
                <div class="table-sub-text"><code>${item.Formatted_Code}</code></div>
            </td>
            <td>${catBadge}</td>
            <td><span class="badge badge-secondary">${item.Station_Name || 'Nurse Station'}</span></td>
            <td>
                <div class="table-amount-prominent">₱ ${parseFloat(item.Unit_Price).toFixed(2)}</div>
                <div class="table-sub-text">standard charge</div>
            </td>
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
    document.getElementById("category_type_text").value = item.Category_Type || "";
    document.getElementById("code_prefix").value = item.Code_Prefix || "";
    document.getElementById("unit_price").value = item.Unit_Price || "";
    const stationElem = document.getElementById("station_id");
    if (stationElem) stationElem.value = item.Station_ID || 1;
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

    const valPrice = typeof validateNumericField === "function" ? validateNumericField(price, "Unit Price", 0, true) : { valid: !isNaN(parseFloat(price)) && parseFloat(price) >= 0 };
    if (!valPrice.valid) {
        alert(valPrice.message || "Unit Price must be a valid number (0 or higher).");
        const el = document.getElementById("unit_price");
        if (el) el.focus();
        return;
    }

    const jsonData = {
        item_name: itemName,
        category_type: category,
        station_id: parseInt(document.getElementById("station_id")?.value || 1, 10),
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

        const resData = response.data;
        const isSuccess = (resData === 1 || resData == "1" || (resData && (resData.status === 1 || resData.status == "1")));

        if (isSuccess) {
            const successMsg = (resData && resData.message)
                ? resData.message
                : (isEdit ? "Catalog item updated successfully!" : "Catalog item added successfully!");
            alert(successMsg);
            resetForm();
            closeModal();
            displayCatalogs();
        } else {
            const errorMsg = (resData && resData.message) ? resData.message : "Error saving catalog item.";
            alert(errorMsg);
        }
    } catch (error) {
        console.error("[Error] Save request failed:", error);
        alert("Server error occurred.");
    }
};


const openCategoryPicker = () => {
    openGenericLookupPicker({
        title: "Select Catalog Category",
        items: [
            { id: "Medicine", text: "Medicine", subtext: "Code Prefix: MED", badge: "MED", badgeClass: "badge-primary" },
            { id: "Equipment Scan", text: "Equipment Scan", subtext: "Code Prefix: RAD", badge: "RAD", badgeClass: "badge-warning" },
            { id: "Service", text: "Service / Procedure", subtext: "Code Prefix: SRV", badge: "SRV", badgeClass: "badge-info" }
        ],
        selectedId: document.getElementById("category_type").value,
        onSelect: (item) => {
            document.getElementById("category_type").value = item.id;
            document.getElementById("category_type_text").value = item.text;
            const prefixInput = document.getElementById("code_prefix");
            const stationSelect = document.getElementById("station_id");
            if (prefixInput) {
                if (item.id === "Medicine") {
                    prefixInput.value = "MED";
                    if (stationSelect) stationSelect.value = "1";
                } else if (item.id === "Equipment Scan") {
                    prefixInput.value = "RAD";
                    if (stationSelect) stationSelect.value = "2";
                } else if (item.id === "Service") {
                    prefixInput.value = "SRV";
                    if (stationSelect) stationSelect.value = "5";
                }
            }
        }
    });
};

const resetForm = () => {
    currentLoadedCatalog = null;

    document.getElementById("catalog_id").value = "";
    document.getElementById("item_name").value = "";
    document.getElementById("category_type").value = "";
    document.getElementById("category_type_text").value = "";
    document.getElementById("code_prefix").value = "";
    document.getElementById("unit_price").value = "";
    const stationElem = document.getElementById("station_id");
    if (stationElem) stationElem.value = "1";

    const btnArchive = document.getElementById("btnArchive");
    if (btnArchive) btnArchive.style.display = "none";

    document.getElementById("form-title").textContent = "Add New Charge Catalog Item";
    document.getElementById("btnSubmit").textContent = "Submit Item";
};

