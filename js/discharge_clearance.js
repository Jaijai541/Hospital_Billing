const getApiUrl = "../api/GET";

const getUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    return {
        invoice_id: params.get("invoice_id") || "",
        admission_id: params.get("admission_id") || ""
    };
};

const formatCurrency = (val) => {
    const num = parseFloat(val || 0);
    return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
};

const renderClearanceSlip = (data) => {
    if (!data || data.error) {
        document.getElementById("clearance-content").innerHTML = `
            <div style="text-align: center; padding: 40px; color: #dc2626;">
                <h3>Unable to Load Discharge Clearance</h3>
                <p>${data?.error || "Required patient admission or invoice record could not be found."}</p>
                <a href="invoices.html" class="btn btn-secondary" style="margin-top: 15px;">Return to Invoices</a>
            </div>
        `;
        return;
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const passCode = `GP-${String(data.Admission_ID).padStart(4, '0')}-${dateStr}`;

    const now = new Date();
    const formattedNow = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }) + ' ' + now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    document.getElementById("meta-pass-code").textContent = passCode;
    document.getElementById("meta-clearance-date").textContent = data.Invoice?.Settlement_Date || formattedNow;
    document.getElementById("meta-admission-code").textContent = data.Admission_Code;
    document.getElementById("meta-invoice-code").textContent = data.Invoice ? data.Invoice.Invoice_Code : "Not Invoiced Yet";

    document.getElementById("pt-code-name").textContent = `${data.Patient_Code} — ${data.Patient_Name}`;
    document.getElementById("pt-demographics").textContent = `${data.Age || 'N/A'} years old / ${data.Gender_Name || 'N/A'} / Blood Type: ${data.Blood_Type_Name || 'N/A'}`;
    document.getElementById("pt-contact-address").textContent = `${data.Contact_Number || 'N/A'} | ${data.Address || 'N/A'}`;
    document.getElementById("pt-emergency").textContent = `${data.Emergency_Contact_Name || 'N/A'} (${data.Emergency_Contact_Number || 'N/A'})`;

    const acc = data.Accommodation;
    let accText = "General Hospital Ward";
    if (acc) {
        const floorPart = acc.Floor_Name ? `${acc.Floor_Name}${acc.Building_Wing ? ` (${acc.Building_Wing})` : ''}` : `Floor ${acc.Floor_Number || 1}`;
        accText = `${floorPart} • Room: ${acc.Room_Name} (${acc.Room_Type}) • Bed: ${acc.Bed_Code}`;
    }
    document.getElementById("conf-accommodation").textContent = accText;

    const admDate = data.Admission_Date;
    const disDate = acc?.Bed_Date_Out || data.Invoice?.Settlement_Date || formattedNow;
    const days = acc?.Total_Days || 1;
    document.getElementById("conf-period").textContent = `${admDate} to ${disDate} (${days} ${days > 1 ? 'days' : 'day'})`;

    document.getElementById("conf-diagnosis").innerHTML = `
        <strong>Admitting:</strong> ${data.Chief_Complaint}<br>
        <strong>Final Discharge Diagnosis:</strong> ${data.Diagnosis || 'Medically cleared for discharge / Improved'}
    `;

    const docs = data.Attending_Doctors || [];
    if (docs.length > 0) {
        document.getElementById("conf-doctors").textContent = docs.map(d => `${d.Doctor_Name}${d.Specialties ? ` (${d.Specialties})` : ''}`).join(', ');
        document.getElementById("signoff-med-name").textContent = docs[0].Doctor_Name;
    } else {
        document.getElementById("conf-doctors").textContent = "Attending Resident Staff";
        document.getElementById("signoff-med-name").textContent = "Attending Medical Officer";
    }

    const inv = data.Invoice;
    const finStatusEl = document.getElementById("signoff-fin-status");
    const finDetailsEl = document.getElementById("signoff-fin-details");
    const finNameEl = document.getElementById("signoff-fin-name");

    if (inv) {
        const remBal = parseFloat(inv.Remaining_Balance || 0);
        const orNum = data.Latest_Payment ? data.Latest_Payment.Receipt_Number : "OR Verified";
        const hasPN = data.Promissory_Note && data.Promissory_Note.Promissory_Status === "Active";

        if (remBal <= 0) {
            finStatusEl.className = "signoff-status cleared";
            finStatusEl.textContent = "Settled in Full";
            finDetailsEl.innerHTML = `Total Charges: ${formatCurrency(inv.Net_Amount_Due)}<br>Official Receipt: <strong>${orNum}</strong><br>Remaining Balance: <strong>₱0.00</strong>`;
        } else if (hasPN) {
            finStatusEl.className = "signoff-status cleared";
            finStatusEl.textContent = "Promissory Plan Active";
            finDetailsEl.innerHTML = `Remaining: ${formatCurrency(remBal)}<br>Installment Plan: <strong>${data.Promissory_Note.Plan_Type_Name}</strong><br>Guarantor: ${data.Promissory_Note.Guarantor_Name || 'Authorized'}`;
        } else {
            finStatusEl.className = "signoff-status pending";
            finStatusEl.textContent = "Pending Balance";
            finDetailsEl.innerHTML = `Unsettled Balance: <strong>${formatCurrency(remBal)}</strong><br>Settlement required prior to departure.`;
        }
        finNameEl.textContent = `${inv.Cashier_Name || 'Hospital Cashier'} (${inv.Cashier_Role || 'Billing Officer'})`;
    } else {
        finStatusEl.className = "signoff-status pending";
        finStatusEl.textContent = "Unbilled";
        finDetailsEl.textContent = "Patient billing has not been finalized at the cashier.";
    }
};

const loadClearanceData = async () => {
    const { invoice_id, admission_id } = getUrlParams();

    if (!invoice_id && !admission_id) {
        renderClearanceSlip({ error: "Missing Invoice ID or Admission ID parameter in URL." });
        return;
    }

    try {
        const fd = new FormData();
        fd.append("operation", "getDischargeClearance");
        fd.append("json", JSON.stringify({ invoice_id, admission_id }));

        const res = await axios.post(`${getApiUrl}/invoices.php`, fd);
        renderClearanceSlip(res.data);
    } catch (err) {
        renderClearanceSlip({ error: "Network or server error loading clearance details." });
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const btnBack = document.getElementById("btn-back-origin");
    if (btnBack) {
        btnBack.addEventListener("click", () => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = "invoices.html";
            }
        });
    }

    loadClearanceData();
});
