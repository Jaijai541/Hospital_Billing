const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let allAuditLogs = [];

document.addEventListener("DOMContentLoaded", () => {
    const refreshBtn = document.getElementById("btn-refresh-logs");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", loadAuditLogs);
    }

    document.getElementById("search_input").addEventListener("input", filterAndRenderAuditLogs);
    document.getElementById("filter_module").addEventListener("change", filterAndRenderAuditLogs);
    document.getElementById("filter_action").addEventListener("change", filterAndRenderAuditLogs);
    document.getElementById("sort_order").addEventListener("change", filterAndRenderAuditLogs);

    loadAuditLogs();
});

const loadAuditLogs = async () => {
    const tableDiv = document.getElementById("table-div");

    try {
        const response = await axios.get(`${getApiUrl}/audit_log.php`, {
            params: { operation: "getAllAuditLogs" }
        });

        if (response.status === 200 && Array.isArray(response.data)) {
            allAuditLogs = response.data;
            updateAuditStats(allAuditLogs);
            filterAndRenderAuditLogs();
        } else {
            tableDiv.innerHTML = `<p style="color: red;">Error loading audit logs.</p>`;
        }
    } catch (error) {
        console.error("[AuditLog] Failed to load logs:", error);
        tableDiv.innerHTML = `<p style="color: red;">Failed to connect to Audit Log API.</p>`;
    }
};

const updateAuditStats = (logs) => {
    const totalEl = document.getElementById("stat-total-logs");
    const clinicalEl = document.getElementById("stat-clinical-logs");
    const billingEl = document.getElementById("stat-billing-logs");
    const systemEl = document.getElementById("stat-system-logs");

    const clinicalActions = ["ADMIT", "TRANSFER", "DISCHARGE", "ORDER", "ROUND"];
    const billingActions = ["BILLING", "RETURN"];

    const clinicalCount = logs.filter(l => clinicalActions.includes(l.Action_Type)).length;
    const billingCount = logs.filter(l => billingActions.includes(l.Action_Type)).length;
    const systemCount = logs.length - clinicalCount - billingCount;

    if (totalEl) totalEl.textContent = logs.length;
    if (clinicalEl) clinicalEl.textContent = clinicalCount;
    if (billingEl) billingEl.textContent = billingCount;
    if (systemEl) systemEl.textContent = systemCount;
};

const getActionBadgeClass = (actionType) => {
    switch (actionType) {
        case "ADMIT":
        case "CREATE":
        case "RESTORE":
            return "badge badge-success";
        case "BILLING":
        case "ORDER":
        case "ROUND":
        case "AUTH":
            return "badge badge-primary";
        case "DISCHARGE":
        case "TRANSFER":
        case "UPDATE":
        case "ARCHIVE":
            return "badge badge-warning";
        case "DELETE":
        case "RETURN":
            return "badge badge-danger";
        default:
            return "badge badge-secondary";
    }
};

const filterAndRenderAuditLogs = () => {
    const searchTerm = document.getElementById("search_input").value.trim().toLowerCase();
    const moduleFilter = document.getElementById("filter_module").value;
    const actionFilter = document.getElementById("filter_action").value;
    const sortOrder = document.getElementById("sort_order").value;

    let filtered = allAuditLogs.filter(item => {
        if (moduleFilter !== "ALL" && item.Module_Name !== moduleFilter) return false;
        if (actionFilter !== "ALL" && item.Action_Type !== actionFilter) return false;

        if (searchTerm) {
            const ref = (item.Record_Reference || "").toLowerCase();
            const desc = (item.Description || "").toLowerCase();
            const mod = (item.Module_Name || "").toLowerCase();
            const user = (item.Performed_By || "").toLowerCase();
            return ref.includes(searchTerm) || desc.includes(searchTerm) || mod.includes(searchTerm) || user.includes(searchTerm);
        }
        return true;
    });

    filtered.sort((a, b) => {
        const idA = parseInt(a.Audit_ID) || 0;
        const idB = parseInt(b.Audit_ID) || 0;
        return sortOrder === "ASC" ? idA - idB : idB - idA;
    });

    renderAuditTable(filtered);
};

const renderAuditTable = (logs) => {
    const tableDiv = document.getElementById("table-div");
    tableDiv.innerHTML = "";

    if (!logs || logs.length === 0) {
        tableDiv.innerHTML = `<p style="padding: 15px;">No audit log entries match the selected filters.</p>`;
        return;
    }

    const table = document.createElement("table");
    table.className = "data-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Log ID</th>
            <th>Date & Time</th>
            <th>Action</th>
            <th>Module</th>
            <th>Reference</th>
            <th>Activity Description</th>
            <th>Performed By</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    logs.forEach(log => {
        const row = document.createElement("tr");
        const badgeClass = getActionBadgeClass(log.Action_Type);
        const formattedId = `AUD-${String(log.Audit_ID).padStart(4, "0")}`;

        row.innerHTML = `
            <td><strong>${formattedId}</strong></td>
            <td style="white-space: nowrap;">${log.Formatted_Date || log.Created_At}</td>
            <td><span class="${badgeClass}">${log.Action_Type}</span></td>
            <td><strong>${log.Module_Name}</strong></td>
            <td><code>${log.Record_Reference || "-"}</code></td>
            <td>${log.Description}</td>
            <td>${log.Performed_By || "System Admin"}</td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableDiv.appendChild(table);
};
