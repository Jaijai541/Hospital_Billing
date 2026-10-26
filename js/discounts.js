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
    document.getElementById("filter_status").addEventListener("change", filterAndSortDiscounts);
    const filterScope = document.getElementById("filter_scope");
    if (filterScope) {
        filterScope.addEventListener("change", filterAndSortDiscounts);
    }
    const sortByElem = document.getElementById("sort_by");
    if (sortByElem) {
        sortByElem.addEventListener("change", filterAndSortDiscounts);
    }

    initRefreshBtn("btnRefreshDiscounts", displayDiscounts);
});

const displayDiscounts = async () => {
    const tableDiv = document.getElementById("table-div");

    try {
        const response = await axios.get(`${getApiUrl}/discounts.php`, {
            params: { operation: "getAllDiscounts" }
        });

        if (response.status === 200) {
            allDiscounts = response.data || [];
            filterAndSortDiscounts();
        } else {
            alert("Error loading discounts!");
        }
    } catch (error) {
        tableDiv.innerHTML = `<p class="text-danger">Failed to connect to API.</p>`;
    }
};

const filterAndSortDiscounts = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();
    const filterStatus = document.getElementById("filter_status").value;
    const filterScopeEl = document.getElementById("filter_scope");
    const filterScope = filterScopeEl ? filterScopeEl.value : "all";
    const sortBy = document.getElementById("sort_by")?.value || "name_asc";

    let filtered = allDiscounts.filter(disc => {
        const itemCode = `${disc.Code_Prefix || 'DISC'}-${disc.Discount_ID}`.toLowerCase();
        const discountName = (disc.Discount_Name || "").toLowerCase();
        const targetScope = (disc.Target_Scope || "Total");

        const matchesSearch = discountName.includes(searchTerm) || itemCode.includes(searchTerm);

        let matchesStatus = true;
        if (filterStatus === "1") {
            matchesStatus = (disc.Is_Active == 1);
        } else if (filterStatus === "0") {
            matchesStatus = (disc.Is_Active == 0);
        }

        let matchesScope = true;
        if (filterScope !== "all") {
            matchesScope = (targetScope === filterScope);
        }

        return matchesSearch && matchesStatus && matchesScope;
    });

    filtered.sort((a, b) => {
        const codeA = `${a.Code_Prefix || 'DISC'}-${a.Discount_ID}`;
        const codeB = `${b.Code_Prefix || 'DISC'}-${b.Discount_ID}`;

        const valA = parseFloat(a.Discount_Percentage || 0);
        const valB = parseFloat(b.Discount_Percentage || 0);

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

    if (typeof updateFilterCount === "function") {
        updateFilterCount(filtered.length, allDiscounts.length, "discounts");
    }
    displayDiscountsTable(filtered);
};

const displayDiscountsTable = (discounts) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!discounts || discounts.length === 0) {
        tableDiv.innerHTML = typeof getEmptyStateHtml === "function"
            ? getEmptyStateHtml("🏷️", "No statutory or institutional discounts found", "No discount records match your search criteria.")
            : "<p>No matching discounts found.</p>";
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            ${renderSortableTh("Discount Scheme & Code", "Discount_Name")}
            ${renderSortableTh("Target Scope", "Target_Scope")}
            ${renderSortableTh("Discount Rate", "Discount_Percentage")}
            ${renderSortableTh("VAT Status", "Is_Vat_Exempt")}
            ${renderSortableTh("Status", "Status")}
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    discounts.forEach(disc => {
        const code = `${disc.Code_Prefix || 'DISC'}-${disc.Discount_ID}`;
        const deductionVal = `<span class="table-amount-prominent text-primary font-bold">${parseFloat(disc.Discount_Percentage || 0).toFixed(2)}%</span>`;

        const scope = disc.Target_Scope || "Total";
        let scopeClass = "scope-pill-total";
        let scopeLabel = "Total Gross Bill";
        if (scope === "Doctor") {
            scopeClass = "scope-pill-doctor";
            scopeLabel = "Doctor Fees Only";
        } else if (scope === "Room") {
            scopeClass = "scope-pill-room";
            scopeLabel = "Room & Board Only";
        } else if (scope === "Medicine") {
            scopeClass = "scope-pill-medicine";
            scopeLabel = "Pharmacy Only";
        } else if (scope === "Laboratory") {
            scopeClass = "scope-pill-laboratory";
            scopeLabel = "Diagnostics Only";
        }

        const scopeBadge = `<span class="scope-pill ${scopeClass}">${scopeLabel}</span>`;

        const vatBadge = (disc.Is_Vat_Exempt == 1)
            ? '<span class="badge badge-success">VAT-Exempt</span>'
            : '<span class="badge badge-secondary">12% VAT Applied</span>';

        const row = document.createElement("tr");
        row.className = "clickable-row";
        row.title = "Click to view / edit discount scheme";
        row.innerHTML = `
            <td>
                <div class="table-primary-text font-bold">${disc.Discount_Name}</div>
                <div class="table-sub-text"><code>${code}</code></div>
            </td>
            <td>${scopeBadge}</td>
            <td>
                <div>${deductionVal}</div>
                <div class="table-sub-text">policy reduction</div>
            </td>
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
    document.getElementById("discount_percentage").value = disc.Discount_Percentage || "";
    const scopeEl = document.getElementById("target_scope");
    if (scopeEl) {
        scopeEl.value = disc.Target_Scope || "Total";
    }

    const vatCb = document.getElementById("is_vat_exempt");
    if (vatCb) {
        vatCb.checked = (disc.Is_Vat_Exempt == 1);
    }
};

const loadDiscountForEdit = async (discountId) => {
    try {
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
                btnArchive.classList.remove("hidden-element");
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
        }
    } catch (error) {
        alert("Failed to load discount details.");
    }
};

const saveDiscount = async () => {
    const discountId = document.getElementById("discount_id").value;
    const discountName = document.getElementById("discount_name").value.trim();
    const discountPercentage = document.getElementById("discount_percentage").value;
    const targetScope = document.getElementById("target_scope")?.value || "Total";
    const vatCb = document.getElementById("is_vat_exempt");
    const isVatExempt = vatCb && vatCb.checked ? 1 : 0;

    if (!discountName) {
        alert("Please enter the discount policy name.");
        return;
    }

    const valPct = typeof validateNumericField === "function" ? validateNumericField(discountPercentage, "Discount Percentage", 0, true) : { valid: !isNaN(parseFloat(discountPercentage)) && parseFloat(discountPercentage) >= 0 && parseFloat(discountPercentage) <= 100 };
    const pct = parseFloat(discountPercentage);
    if (!valPct.valid || isNaN(pct) || pct < 0 || pct > 100) {
        alert("Please enter a valid percentage rate between 0 and 100.");
        const el = document.getElementById("discount_percentage");
        if (el) el.focus();
        return;
    }

    const jsonData = {
        discount_name: discountName,
        discount_type_id: 1,
        discount_type: "Percentage",
        discount_percentage: pct,
        fixed_amount: 0.00,
        is_vat_exempt: isVatExempt,
        target_scope: targetScope
    };

    const isEdit = (discountId !== "");
    const operation = isEdit ? "updateDiscount" : "insertDiscount";

    if (isEdit) {
        jsonData.discount_id = discountId;
    }

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
            alert(isEdit ? "Discount updated successfully!" : "Discount added successfully!");
            closeModal();
            resetForm();
            displayDiscounts();
        } else {
            alert("Error saving discount.");
        }
    } catch (error) {
        alert("Server error occurred.");
    }
};

const resetForm = () => {
    currentLoadedDiscount = null;

    document.getElementById("discount_id").value = "";
    document.getElementById("discount_name").value = "";
    document.getElementById("discount_percentage").value = "";
    const scopeEl = document.getElementById("target_scope");
    if (scopeEl) {
        scopeEl.value = "Total";
    }
    const vatCb = document.getElementById("is_vat_exempt");
    if (vatCb) vatCb.checked = false;

    const btnArchive = document.getElementById("btnArchive");
    if (btnArchive) {
        btnArchive.classList.add("hidden-element");
        btnArchive.style.display = "none";
    }

    document.getElementById("form-title").textContent = "Add New Discount Scheme";
    document.getElementById("btnSubmit").textContent = "Submit Discount";
};
