let allDiscounts = []; // In-memory cache for fast search, filter, and sort
let currentLoadedDiscount = null;

document.addEventListener("DOMContentLoaded", () => {
    // Initial Data Load
    displayDiscounts();

    // Modal & Form Controls
    initModalControls("formModal", "btnOpenAddModal", "btnCloseModal", "btnCancel", resetForm);
    document.getElementById("btnSubmit").addEventListener("click", saveDiscount);

    const btnReset = document.getElementById("btnReset");
    if (btnReset) {
        btnReset.addEventListener("click", () => {
            if (currentLoadedDiscount) {
                populateDiscountForm(currentLoadedDiscount);
            } else {
                resetForm();
            }
        });
    }

    // Search, Filter, and Sort Listeners
    document.getElementById("search_input").addEventListener("input", filterAndSortDiscounts);
    document.getElementById("filter_status").addEventListener("change", filterAndSortDiscounts);
    document.getElementById("sort_by").addEventListener("change", filterAndSortDiscounts);
});

const displayDiscounts = async () => {
    const tableDiv = document.getElementById("table-div");

    try {
        console.log("[API] Requesting: getAllDiscounts");
        const response = await axios.get(`${baseApiUrl}/discounts.php`, {
            params: { operation: "getAllDiscounts" }
        });

        if (response.status === 200) {
            allDiscounts = response.data || [];
            console.log(`[API] Success: Loaded ${allDiscounts.length} discounts.`);
            filterAndSortDiscounts();
        } else {
            console.error("[API] Error loading discounts:", response);
            alert("Error loading discounts!");
        }
    } catch (error) {
        console.error("[API] Network error:", error);
        tableDiv.innerHTML = `<p style="color: red;">Failed to connect to API.</p>`;
    }
};

const filterAndSortDiscounts = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();
    const filterStatus = document.getElementById("filter_status").value;
    const sortBy = document.getElementById("sort_by").value;

    let filtered = allDiscounts.filter(disc => {
        const itemCode = `${disc.Code_Prefix || 'DISC'}-${disc.Discount_ID}`.toLowerCase();
        const discountName = disc.Discount_Name.toLowerCase();

        // Search filter (by Discount Name OR Code e.g. "DISC-1")
        const matchesSearch = discountName.includes(searchTerm) || itemCode.includes(searchTerm);

        // Status filter (All, Active, Soft-Deleted)
        let matchesStatus = true;
        if (filterStatus === "1") {
            matchesStatus = (disc.Is_Active == 1);
        } else if (filterStatus === "0") {
            matchesStatus = (disc.Is_Active == 0);
        }

        return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
        const codeA = `${a.Code_Prefix || 'DISC'}-${a.Discount_ID}`;
        const codeB = `${b.Code_Prefix || 'DISC'}-${b.Discount_ID}`;

        switch (sortBy) {
            case "code_asc":
                return codeA.localeCompare(codeB, undefined, { numeric: true });
            case "code_desc":
                return codeB.localeCompare(codeA, undefined, { numeric: true });
            case "name_asc":
                return a.Discount_Name.localeCompare(b.Discount_Name);
            case "name_desc":
                return b.Discount_Name.localeCompare(a.Discount_Name);
            case "percent_asc":
                return parseFloat(a.Discount_Percentage) - parseFloat(b.Discount_Percentage);
            case "percent_desc":
                return parseFloat(b.Discount_Percentage) - parseFloat(a.Discount_Percentage);
            case "id_desc":
                return parseInt(b.Discount_ID) - parseInt(a.Discount_ID);
            default:
                return 0;
        }
    });

    console.log(`[UI] Filtered & Sorted: Displaying ${filtered.length} of ${allDiscounts.length} discounts (Search: "${searchTerm}", Status: ${filterStatus}, Sort: ${sortBy})`);
    displayDiscountsTable(filtered);
};

const displayDiscountsTable = (discounts) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!discounts || discounts.length === 0) {
        tableDiv.innerHTML = "<p>No matching discounts found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Code</th>
            <th>Discount Policy</th>
            <th>Deduction Percentage</th>
            <th>Status</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    discounts.forEach(disc => {
        const code = `${disc.Code_Prefix || 'DISC'}-${disc.Discount_ID}`;
        const row = document.createElement("tr");
        row.className = "clickable-row";
        row.title = "Click to view / edit discount scheme";
        row.innerHTML = `
            <td><strong>${code}</strong></td>
            <td><strong>${disc.Discount_Name}</strong></td>
            <td><span class="badge badge-info">${parseFloat(disc.Discount_Percentage).toFixed(2)}%</span></td>
            <td>${getStatusBadge(disc.Is_Active)}</td>
        `;
        row.addEventListener("click", () => loadDiscountForEdit(disc.Discount_ID));
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);
};

/**
 * Populate form inputs from a discount object
 */
const populateDiscountForm = (disc) => {
    document.getElementById("discount_id").value = disc.Discount_ID || "";
    document.getElementById("discount_name").value = disc.Discount_Name || "";
    document.getElementById("discount_percentage").value = disc.Discount_Percentage || "";
};

const loadDiscountForEdit = async (discountId) => {
    try {
        console.log(`[API] Requesting discount details for ID: ${discountId}`);
        const response = await axios.get(`${baseApiUrl}/discounts.php`, {
            params: {
                operation: "getDiscountById",
                json: JSON.stringify({ discount_id: discountId })
            }
        });

        if (response.status === 200 && response.data) {
            const disc = response.data;
            currentLoadedDiscount = disc;
            populateDiscountForm(disc);

            document.getElementById("form-title").textContent = `Edit Discount (DISC-${disc.Discount_ID})`;
            document.getElementById("btnSubmit").textContent = "Update Discount";

            // Configure In-Modal Archive / Restore Button
            const btnArchive = document.getElementById("btnArchive");
            if (btnArchive) {
                btnArchive.style.display = "inline-flex";
                const isActive = (disc.Is_Active == 1);
                btnArchive.className = isActive ? "btn btn-warning btn-archive" : "btn btn-success btn-restore";
                btnArchive.textContent = isActive ? "Send to Archive" : "Restore Record";
                btnArchive.onclick = () => {
                    toggleRecordStatus("discounts.php", "discount_id", disc.Discount_ID, isActive ? 1 : 0, disc.Discount_Name, () => {
                        closeModal();
                        displayDiscounts();
                    });
                };
            }

            openModal();
            console.log("[UI] Form populated for edit:", disc);
        }
    } catch (error) {
        console.error("[API] Error loading discount details:", error);
        alert("Failed to load discount details.");
    }
};

const saveDiscount = async () => {
    const discountId = document.getElementById("discount_id").value;
    const discountName = document.getElementById("discount_name").value.trim();
    const discountPercentage = document.getElementById("discount_percentage").value;

    if (!discountName || discountPercentage === "") {
        alert("Please fill in all fields.");
        return;
    }

    const percentage = parseFloat(discountPercentage);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        alert("Please enter a valid percentage between 0 and 100.");
        return;
    }

    const jsonData = {
        discount_name: discountName,
        discount_percentage: percentage
    };

    const isEdit = (discountId !== "");
    const operation = isEdit ? "updateDiscount" : "insertDiscount";

    if (isEdit) {
        jsonData.discount_id = discountId;
    }

    console.log(`[Action] Submitting ${operation} via POST:`, jsonData);

    const formData = new FormData();
    formData.append("operation", operation);
    formData.append("json", JSON.stringify(jsonData));

    try {
        const response = await axios({
            url: `${baseApiUrl}/discounts.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] ${operation} completed successfully.`);
            alert(isEdit ? "Discount updated successfully!" : "Discount added successfully!");
            closeModal();
            resetForm();
            displayDiscounts();
        } else {
            console.warn(`[Failed] ${operation} returned non-success:`, response.data);
            alert("Error saving discount.");
        }
    } catch (error) {
        console.error("[Error] Save request failed:", error);
        alert("Server error occurred.");
    }
};

const resetForm = () => {
    currentLoadedDiscount = null;

    document.getElementById("discount_id").value = "";
    document.getElementById("discount_name").value = "";
    document.getElementById("discount_percentage").value = "";

    const btnArchive = document.getElementById("btnArchive");
    if (btnArchive) btnArchive.style.display = "none";

    document.getElementById("form-title").textContent = "Add New Discount Scheme";
    document.getElementById("btnSubmit").textContent = "Submit Discount";
    console.log("[UI] Form reset to Add mode.");
};


