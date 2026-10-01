const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allDiscounts = [];
let currentLoadedDiscount = null;

const formatMoney = (amount) => {
    return parseFloat(amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

document.addEventListener("DOMContentLoaded", () => {
    displayDiscounts();

    initModalControls("formModal", "btnOpenAddModal", "btnCloseModal", "btnCancel", resetForm);
    document.getElementById("btnSubmit").addEventListener("click", saveDiscount);

    const typeSelect = document.getElementById("discount_type");
    if (typeSelect) {
        typeSelect.addEventListener("change", handleTypeChange);
    }

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

    document.getElementById("search_input").addEventListener("input", filterAndSortDiscounts);
    const filterType = document.getElementById("filter_type");
    if (filterType) filterType.addEventListener("change", filterAndSortDiscounts);
    document.getElementById("filter_status").addEventListener("change", filterAndSortDiscounts);
    document.getElementById("sort_by").addEventListener("change", filterAndSortDiscounts);
});

const handleTypeChange = () => {
    const typeSelect = document.getElementById("discount_type");
    const val = typeSelect ? typeSelect.value : "Percentage";
    const grpPct = document.getElementById("group_percentage");
    const grpFixed = document.getElementById("group_fixed");

    if (val === "Fixed") {
        if (grpPct) grpPct.style.display = "none";
        if (grpFixed) grpFixed.style.display = "block";
    } else {
        if (grpPct) grpPct.style.display = "block";
        if (grpFixed) grpFixed.style.display = "none";
    }
};

const displayDiscounts = async () => {
    const tableDiv = document.getElementById("table-div");

    try {
        console.log("[API] Requesting: getAllDiscounts");
        const response = await axios.get(`${getApiUrl}/discounts.php`, {
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
    const filterTypeEl = document.getElementById("filter_type");
    const filterType = filterTypeEl ? filterTypeEl.value : "all";
    const filterStatus = document.getElementById("filter_status").value;
    const sortBy = document.getElementById("sort_by").value;

    let filtered = allDiscounts.filter(disc => {
        const itemCode = `${disc.Code_Prefix || 'DISC'}-${disc.Discount_ID}`.toLowerCase();
        const discountName = (disc.Discount_Name || "").toLowerCase();

        const matchesSearch = discountName.includes(searchTerm) || itemCode.includes(searchTerm);

        let matchesType = true;
        if (filterType !== "all") {
            matchesType = (disc.Discount_Type === filterType);
        }

        let matchesStatus = true;
        if (filterStatus === "1") {
            matchesStatus = (disc.Is_Active == 1);
        } else if (filterStatus === "0") {
            matchesStatus = (disc.Is_Active == 0);
        }

        return matchesSearch && matchesType && matchesStatus;
    });

    filtered.sort((a, b) => {
        const codeA = `${a.Code_Prefix || 'DISC'}-${a.Discount_ID}`;
        const codeB = `${b.Code_Prefix || 'DISC'}-${b.Discount_ID}`;

        const valA = (a.Discount_Type === 'Fixed') ? parseFloat(a.Fixed_Amount || 0) : parseFloat(a.Discount_Percentage || 0);
        const valB = (b.Discount_Type === 'Fixed') ? parseFloat(b.Fixed_Amount || 0) : parseFloat(b.Discount_Percentage || 0);

        switch (sortBy) {
            case "code_asc":
                return codeA.localeCompare(codeB, undefined, { numeric: true });
            case "code_desc":
                return codeB.localeCompare(codeA, undefined, { numeric: true });
            case "name_asc":
                return (a.Discount_Name || "").localeCompare(b.Discount_Name || "");
            case "name_desc":
                return (b.Discount_Name || "").localeCompare(a.Discount_Name || "");
            case "val_asc":
                return valA - valB;
            case "val_desc":
                return valB - valA;
            case "id_desc":
                return parseInt(b.Discount_ID) - parseInt(a.Discount_ID);
            default:
                return 0;
        }
    });

    console.log(`[UI] Filtered & Sorted: Displaying ${filtered.length} of ${allDiscounts.length} discounts`);
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
            <th>Scheme Type</th>
            <th>Deduction Value</th>
            <th>VAT Status</th>
            <th>Status</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    discounts.forEach(disc => {
        const code = `${disc.Code_Prefix || 'DISC'}-${disc.Discount_ID}`;
        const isFixed = (disc.Discount_Type === "Fixed");
        const typeBadge = isFixed 
            ? '<span class="badge badge-primary">Fixed Voucher</span>' 
            : '<span class="badge badge-info">Percentage</span>';

        const deductionVal = isFixed 
            ? `<strong>₱${formatMoney(disc.Fixed_Amount)}</strong>` 
            : `<span class="badge badge-info">${parseFloat(disc.Discount_Percentage).toFixed(2)}%</span>`;

        const vatBadge = (disc.Is_Vat_Exempt == 1)
            ? '<span class="badge badge-success">VAT-Exempt</span>'
            : '<span class="badge badge-secondary" style="opacity: 0.85;">12% VAT Applied</span>';

        const row = document.createElement("tr");
        row.className = "clickable-row";
        row.title = "Click to view / edit discount scheme";
        row.innerHTML = `
            <td><strong>${code}</strong></td>
            <td><strong>${disc.Discount_Name}</strong></td>
            <td>${typeBadge}</td>
            <td>${deductionVal}</td>
            <td>${vatBadge}</td>
            <td>${getStatusBadge(disc.Is_Active)}</td>
        `;
        row.addEventListener("click", () => loadDiscountForEdit(disc.Discount_ID));
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);
};

const populateDiscountForm = (disc) => {
    document.getElementById("discount_id").value = disc.Discount_ID || "";
    document.getElementById("discount_name").value = disc.Discount_Name || "";

    const typeSelect = document.getElementById("discount_type");
    if (typeSelect) {
        typeSelect.value = disc.Discount_Type || "Percentage";
    }

    document.getElementById("discount_percentage").value = disc.Discount_Percentage || "";
    document.getElementById("fixed_amount").value = disc.Fixed_Amount || "";

    const vatCb = document.getElementById("is_vat_exempt");
    if (vatCb) {
        vatCb.checked = (disc.Is_Vat_Exempt == 1);
    }

    handleTypeChange();
};

const loadDiscountForEdit = async (discountId) => {
    try {
        console.log(`[API] Requesting discount details for ID: ${discountId}`);
        const response = await axios.get(`${getApiUrl}/discounts.php`, {
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
    const discountType = document.getElementById("discount_type") ? document.getElementById("discount_type").value : "Percentage";
    const discountPercentage = document.getElementById("discount_percentage").value;
    const fixedAmount = document.getElementById("fixed_amount").value;
    const vatCb = document.getElementById("is_vat_exempt");
    const isVatExempt = vatCb && vatCb.checked ? 1 : 0;

    if (!discountName) {
        alert("Please enter the discount policy name.");
        return;
    }

    let pct = 0;
    let fixed = 0;

    if (discountType === "Fixed") {
        fixed = parseFloat(fixedAmount);
        if (isNaN(fixed) || fixed <= 0) {
            alert("Please enter a valid fixed voucher amount greater than 0.");
            return;
        }
    } else {
        pct = parseFloat(discountPercentage);
        if (isNaN(pct) || pct < 0 || pct > 100) {
            alert("Please enter a valid percentage between 0 and 100.");
            return;
        }
    }

    const jsonData = {
        discount_name: discountName,
        discount_type: discountType,
        discount_percentage: pct,
        fixed_amount: fixed,
        is_vat_exempt: isVatExempt
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
            url: `${postApiUrl}/discounts.php`,
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
    const typeSelect = document.getElementById("discount_type");
    if (typeSelect) typeSelect.value = "Percentage";
    document.getElementById("discount_percentage").value = "";
    document.getElementById("fixed_amount").value = "";
    const vatCb = document.getElementById("is_vat_exempt");
    if (vatCb) vatCb.checked = false;

    handleTypeChange();

    const btnArchive = document.getElementById("btnArchive");
    if (btnArchive) btnArchive.style.display = "none";

    document.getElementById("form-title").textContent = "Add New Discount Scheme";
    document.getElementById("btnSubmit").textContent = "Submit Discount";
    console.log("[UI] Form reset to Add mode.");
};
