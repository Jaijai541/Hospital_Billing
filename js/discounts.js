const baseApiUrl = "http://localhost/Hospital_Billing/api";
let allDiscounts = []; // In-memory cache for fast search, filter, and sort

document.addEventListener("DOMContentLoaded", () => {
    // 1.
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

    // 2.
    displayDiscounts();

    // 3.
    document.getElementById("btnSubmit").addEventListener("click", saveDiscount);
    document.getElementById("btnCancel").addEventListener("click", resetForm);

    // 4.
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
            <th>Actions</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    discounts.forEach(disc => {
        const isActive = (disc.Is_Active == 1);
        const statusBadge = isActive 
            ? '<span class="badge badge-success">Active</span>' 
            : '<span class="badge badge-danger">Archived</span>';
        const toggleAction = isActive ? "Send to Archive" : "Restore";
        const toggleBtnClass = isActive ? "btn-warning btn-archive" : "btn-success btn-restore";
        const code = `${disc.Code_Prefix || 'DISC'}-${disc.Discount_ID}`;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${code}</strong></td>
            <td><strong>${disc.Discount_Name}</strong></td>
            <td><span class="badge badge-info">${parseFloat(disc.Discount_Percentage).toFixed(2)}%</span></td>
            <td>${statusBadge}</td>
            <td>
                <button type="button" class="btn btn-sm btn-secondary btn-action-edit" data-id="${disc.Discount_ID}">Edit</button>
                <button type="button" class="btn btn-sm ${toggleBtnClass} btn-action-soft-delete" data-id="${disc.Discount_ID}" data-status="${disc.Is_Active}" data-name="${disc.Discount_Name}">${toggleAction}</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);

    // Event delegation with semantic classes
    document.querySelectorAll(".btn-action-edit").forEach(btn => {
        btn.addEventListener("click", () => loadDiscountForEdit(btn.dataset.id));
    });

    document.querySelectorAll(".btn-action-soft-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            toggleDiscountStatus(btn.dataset.id, btn.dataset.status, btn.dataset.name);
        });
    });

    document.querySelectorAll(".btn-action-hard-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            hardDeleteDiscount(btn.dataset.id, btn.dataset.name);
        });
    });
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
            document.getElementById("discount_id").value = disc.Discount_ID;
            document.getElementById("discount_name").value = disc.Discount_Name;
            document.getElementById("discount_percentage").value = disc.Discount_Percentage;

            document.getElementById("form-title").textContent = `Edit Discount (DISC-${disc.Discount_ID})`;
            document.getElementById("btnSubmit").textContent = "Update Discount";
            document.getElementById("btnCancel").style.display = "inline";
            window.scrollTo({ top: 0, behavior: "smooth" });
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
    document.getElementById("discount_id").value = "";
    document.getElementById("discount_name").value = "";
    document.getElementById("discount_percentage").value = "";

    document.getElementById("form-title").textContent = "Add New Discount";
    document.getElementById("btnSubmit").textContent = "Submit";
    document.getElementById("btnCancel").style.display = "none";
    console.log("[UI] Form reset to Add mode.");
};

const toggleDiscountStatus = async (discountId, currentStatus, name) => {
    const actionText = (currentStatus == 1) ? "send to the System Archive" : "restore from the System Archive";
    if (!confirm(`Are you sure you want to ${actionText} "${name}"?\n\n(Archived discount policies are kept so past finalized billing invoices remain intact)`)) {
        return;
    }

    console.log(`[Action] Toggling status for Discount ID: ${discountId} (Current: ${currentStatus})`);

    const formData = new FormData();
    formData.append("operation", "toggleStatus");
    formData.append("json", JSON.stringify({ discount_id: discountId }));

    try {
        const response = await axios({
            url: `${baseApiUrl}/discounts.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] Status toggled successfully for Discount ID: ${discountId}`);
            displayDiscounts();
        } else {
            console.warn("[Failed] Status toggle returned non-success:", response.data);
            alert("Error updating status.");
        }
    } catch (error) {
        console.error("[Error] Toggle request failed:", error);
        alert("Error occurred.");
    }
};

const hardDeleteDiscount = async (discountId, name) => {
    if (!confirm(`WARNING: Are you sure you want to HARD DELETE (permanently remove) "${name}" from the database?\n\nThis action physically deletes the record from MySQL and cannot be undone!`)) {
        return;
    }

    console.log(`[Action] Attempting Hard Delete for Discount ID: ${discountId}`);

    const formData = new FormData();
    formData.append("operation", "hardDeleteDiscount");
    formData.append("json", JSON.stringify({ discount_id: discountId }));

    try {
        const response = await axios({
            url: `${baseApiUrl}/discounts.php`,
            method: "POST",
            data: formData
        });

        if (response.data == 1) {
            console.log(`[Success] Hard deleted Discount ID: ${discountId}`);
            alert(`"${name}" was permanently deleted from the database.`);
            displayDiscounts();
        } else if (response.data && response.data.message) {
            console.warn("[Protected] Hard delete blocked:", response.data.message);
            alert(response.data.message);
        } else {
            console.error("[Failed] Hard delete failed:", response.data);
            alert("Error: Could not permanently delete record.");
        }
    } catch (error) {
        console.error("[Error] Hard delete request failed:", error);
        alert("Server error during hard delete.");
    }
};

