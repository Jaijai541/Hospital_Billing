const getApiUrl = "../api/GET";

const formatMoney = (amount) => {
    return parseFloat(amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

const renderPartialBill = (bill) => {
    document.getElementById("pb-admission-code").textContent = bill.Admission_Code || "N/A";
    document.getElementById("pb-statement-date").textContent = bill.Statement_Date || "N/A";
    document.getElementById("pb-admission-date").textContent = bill.Admission_Date || "N/A";
    document.getElementById("pb-stay-days").textContent = bill.Stay_Days_To_Date || "1";

    const statusBadge = document.getElementById("pb-admission-status");
    if (statusBadge) {
        statusBadge.textContent = bill.Admission_Status || "Admitted";
        if (bill.Admission_Status === "Discharged" || bill.Admission_Status === "Billed") {
            statusBadge.className = "badge badge-info";
        } else {
            statusBadge.className = "badge badge-success";
        }
    }

    const currentStay = (bill.Room_Stays || []).find(s => parseInt(s.Is_Current_Stay, 10) === 1);
    const bedRoomEl = document.getElementById("pb-bed-room");
    if (bedRoomEl) {
        if (currentStay) {
            bedRoomEl.textContent = `${currentStay.Bed_Code} (${currentStay.Room_Name} - ${currentStay.Room_Type_Name}) — ₱${formatMoney(currentStay.Daily_Rate)}/day`;
        } else if ((bill.Room_Stays || []).length > 0) {
            const lastStay = bill.Room_Stays[bill.Room_Stays.length - 1];
            bedRoomEl.textContent = `${lastStay.Bed_Code} (${lastStay.Room_Name} - ${lastStay.Room_Type_Name})`;
        } else {
            bedRoomEl.textContent = "None Assigned";
        }
    }

    document.getElementById("pb-patient-name").textContent = bill.Patient_Name || "N/A";
    document.getElementById("pb-patient-code").textContent = bill.Patient_Code || "N/A";

    const dob = bill.Date_Of_Birth || "N/A";
    const ageText = (bill.Age !== null && bill.Age !== undefined) ? ` (${bill.Age} years old)` : "";
    document.getElementById("pb-patient-age").textContent = `${dob}${ageText}`;
    document.getElementById("pb-patient-gender-blood").textContent = `${bill.Gender_Name || "Unspecified"} / Blood Type: ${bill.Blood_Type_Name || "N/A"}`;
    document.getElementById("pb-patient-contact").textContent = bill.Contact_Number || "N/A";
    document.getElementById("pb-patient-address").textContent = bill.Address || "N/A";

    let emergText = "None Recorded";
    if (bill.Emergency_Contact_Name && bill.Emergency_Contact_Number) {
        emergText = `${bill.Emergency_Contact_Name} (${bill.Emergency_Contact_Number})`;
    } else if (bill.Emergency_Contact_Name) {
        emergText = bill.Emergency_Contact_Name;
    }
    document.getElementById("pb-patient-emergency").textContent = emergText;

    document.getElementById("pb-patient-complaint").textContent = bill.Chief_Complaint || "None Recorded";
    document.getElementById("pb-patient-diagnosis").textContent = bill.Diagnosis || "Clinical Diagnosis Pending";

    const doctors = bill.Attending_Doctors || [];
    const docNames = doctors.map(d => `${d.Doctor_Name} (${d.Doctor_Type}${d.Specialties ? " - " + d.Specialties : ""})`);
    document.getElementById("pb-patient-doctors").textContent = docNames.length > 0 ? docNames.join("; ") : "No attending physicians assigned";

    renderRoomStaysTable(bill.Room_Stays || []);
    renderDoctorsTable(bill.Attending_Doctors || []);
    renderLedgerCategories(bill.Ledger_Items || []);
    renderSummaryBox(bill.Summary || {});

    const userJson = sessionStorage.getItem("hospital_user");
    if (userJson) {
        const u = JSON.parse(userJson);
        const sigCashier = document.getElementById("pb-sig-cashier");
        if (sigCashier) {
            sigCashier.textContent = `${u.full_name || u.username} (${u.role_name || "Billing Officer"})`;
        }
    }

    if (doctors.length > 0) {
        const sigDoc = document.getElementById("pb-sig-doctor");
        if (sigDoc) {
            sigDoc.textContent = doctors[0].Doctor_Name;
        }
    }

    const sigPat = document.getElementById("pb-sig-patient");
    if (sigPat) {
        sigPat.textContent = bill.Patient_Name || "Patient / Representative";
    }

    const btnBack = document.getElementById("btnBackToChart");
    if (btnBack) {
        btnBack.href = `admission_details.html?id=${bill.Admission_ID}`;
    }
};

const renderRoomStaysTable = (stays) => {
    const tbody = document.getElementById("pb-room-tbody");
    if (!stays || stays.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-muted"><em>No room stay logs recorded.</em></td></tr>';
        document.getElementById("pb-subtotal-room").textContent = "₱0.00";
        return;
    }

    let html = "";
    let subtotal = 0;

    stays.forEach(s => {
        const fee = parseFloat(s.Calculated_Room_Fee || 0);
        subtotal += fee;
        const isCurrent = parseInt(s.Is_Current_Stay, 10) === 1;
        const statusHtml = isCurrent 
            ? '<span class="badge badge-success">Active Bed Stay (To Date)</span>' 
            : (s.Date_Out || "Transferred");

        html += `
            <tr>
                <td><strong>${s.Bed_Code}</strong> (${s.Room_Name})</td>
                <td>${s.Room_Type_Name || "Standard"}</td>
                <td>${s.Date_In}</td>
                <td>${statusHtml}</td>
                <td align="right">${s.Calculated_Days} day(s)</td>
                <td align="right">₱${formatMoney(s.Daily_Rate)}</td>
                <td align="right"><strong>₱${formatMoney(fee)}</strong></td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    document.getElementById("pb-subtotal-room").textContent = `₱${formatMoney(subtotal)}`;
};

const renderDoctorsTable = (docs) => {
    const tbody = document.getElementById("pb-doctor-tbody");
    if (!docs || docs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted"><em>No attending physician rounds logged yet.</em></td></tr>';
        document.getElementById("pb-subtotal-doctor").textContent = "₱0.00";
        return;
    }

    let html = "";
    let subtotal = 0;

    docs.forEach(d => {
        const fee = parseFloat(d.Charges || 0);
        subtotal += fee;
        const rounds = parseInt(d.Round_Count || 0, 10);
        const spec = d.Specialties ? ` — ${d.Specialties}` : "";

        html += `
            <tr>
                <td><strong>${d.Doctor_Name}</strong></td>
                <td>${d.Doctor_Type}${spec}</td>
                <td align="center"><strong>${rounds}</strong> round(s)</td>
                <td align="right"><strong>₱${formatMoney(fee)}</strong></td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    document.getElementById("pb-subtotal-doctor").textContent = `₱${formatMoney(subtotal)}`;
};

const renderLedgerCategories = (items) => {
    const medTbody = document.getElementById("pb-medicine-tbody");
    const scanTbody = document.getElementById("pb-scan-tbody");
    const srvTbody = document.getElementById("pb-service-tbody");

    const medItems = [];
    const scanItems = [];
    const srvItems = [];

    (items || []).forEach(it => {
        const cat = (it.Category || "").toLowerCase();
        const desc = (it.Description || "").toLowerCase();
        const station = (it.Station_Name || "").toLowerCase();

        if (it.Transfer_ID || cat.includes("room") || desc.includes("board & lodging")) {
            return;
        }
        if (it.Round_ID || cat.includes("doctor") || desc.includes("bedside round")) {
            return;
        }

        if (cat.includes("medicine") || it.Transaction_Type === "Return" || desc.includes("medicine") || desc.includes("tablet") || desc.includes("capsule")) {
            medItems.push(it);
        } else if (cat.includes("scan") || station.includes("radiology") || desc.includes("ct") || desc.includes("x-ray") || desc.includes("ultrasound") || desc.includes("ecg") || desc.includes("mri") || station.includes("laboratory") || desc.includes("cbc") || desc.includes("urinalysis")) {
            scanItems.push(it);
        } else {
            srvItems.push(it);
        }
    });

    let medHtml = "";
    let medSubtotal = 0;
    if (medItems.length === 0) {
        medHtml = '<tr><td colspan="5" class="text-muted"><em>No pharmacy medications dispensed yet.</em></td></tr>';
    } else {
        medItems.forEach(m => {
            const isReturn = m.Transaction_Type === "Return" || parseFloat(m.Total_Charge || 0) < 0;
            const amt = parseFloat(m.Total_Charge || 0);
            medSubtotal += amt;
            const rowClass = isReturn ? ' style="background-color: #f0fff4; color: #166534;"' : '';
            const sign = isReturn ? "-₱" : "₱";

            medHtml += `
                <tr${rowClass}>
                    <td>${m.Timestamp || "-"}</td>
                    <td><strong>${m.Description}</strong></td>
                    <td align="right">${Math.abs(parseFloat(m.Quantity || 1))}</td>
                    <td align="right">₱${formatMoney(m.Unit_Price)}</td>
                    <td align="right"><strong>${sign}${formatMoney(Math.abs(amt))}</strong></td>
                </tr>
            `;
        });
    }
    medTbody.innerHTML = medHtml;
    document.getElementById("pb-subtotal-medicine").textContent = `₱${formatMoney(medSubtotal)}`;

    let scanHtml = "";
    let scanSubtotal = 0;
    if (scanItems.length === 0) {
        scanHtml = '<tr><td colspan="6" class="text-muted"><em>No diagnostic imaging or laboratory tests ordered yet.</em></td></tr>';
    } else {
        scanItems.forEach(s => {
            const amt = parseFloat(s.Total_Charge || 0);
            scanSubtotal += amt;
            scanHtml += `
                <tr>
                    <td>${s.Timestamp || "-"}</td>
                    <td><strong>${s.Description}</strong></td>
                    <td>${s.Station_Name || "Diagnostics"}</td>
                    <td align="right">${s.Quantity}</td>
                    <td align="right">₱${formatMoney(s.Unit_Price)}</td>
                    <td align="right"><strong>₱${formatMoney(amt)}</strong></td>
                </tr>
            `;
        });
    }
    scanTbody.innerHTML = scanHtml;
    document.getElementById("pb-subtotal-scan").textContent = `₱${formatMoney(scanSubtotal)}`;

    let srvHtml = "";
    let srvSubtotal = 0;
    if (srvItems.length === 0) {
        srvHtml = '<tr><td colspan="6" class="text-muted"><em>No procedures or clinical services recorded yet.</em></td></tr>';
    } else {
        srvItems.forEach(v => {
            const amt = parseFloat(v.Total_Charge || 0);
            srvSubtotal += amt;
            srvHtml += `
                <tr>
                    <td>${v.Timestamp || "-"}</td>
                    <td><strong>${v.Description}</strong></td>
                    <td>${v.Station_Name || "Clinical Care"}</td>
                    <td align="right">${v.Quantity}</td>
                    <td align="right">₱${formatMoney(v.Unit_Price)}</td>
                    <td align="right"><strong>₱${formatMoney(amt)}</strong></td>
                </tr>
            `;
        });
    }
    srvTbody.innerHTML = srvHtml;
    document.getElementById("pb-subtotal-service").textContent = `₱${formatMoney(srvSubtotal)}`;
};

const renderSummaryBox = (summary) => {
    const room = parseFloat(summary.room_total || 0);
    const doc = parseFloat(summary.doctor_total || 0);
    const med = parseFloat(summary.medicine_total || 0);
    const scan = parseFloat(summary.scan_total || 0);
    const srv = parseFloat(summary.service_total || 0);
    const gross = parseFloat(summary.gross_total || 0);
    const returns = parseFloat(summary.return_total || 0);
    const net = parseFloat(summary.net_accumulated_total || (gross - returns));
    const estimatedVat = Math.round(net * 0.12 * 100) / 100;
    const totalWithVat = Math.round((net + estimatedVat) * 100) / 100;

    document.getElementById("pb-sum-room").textContent = `₱${formatMoney(room)}`;
    document.getElementById("pb-sum-doctor").textContent = `₱${formatMoney(doc)}`;
    document.getElementById("pb-sum-medicine").textContent = `₱${formatMoney(med)}`;
    document.getElementById("pb-sum-scan").textContent = `₱${formatMoney(scan)}`;
    document.getElementById("pb-sum-service").textContent = `₱${formatMoney(srv)}`;
    document.getElementById("pb-sum-gross").textContent = `₱${formatMoney(gross)}`;

    const rowReturns = document.getElementById("pb-row-returns");
    if (rowReturns) {
        if (returns > 0) {
            rowReturns.style.display = "table-row";
            document.getElementById("pb-sum-returns").textContent = `-₱${formatMoney(returns)}`;
        } else {
            rowReturns.style.display = "none";
        }
    }

    document.getElementById("pb-sum-net").textContent = `₱${formatMoney(net)}`;
    const elVat = document.getElementById("pb-sum-vat");
    if (elVat) elVat.textContent = `+₱${formatMoney(estimatedVat)}`;
    const elTotalWithVat = document.getElementById("pb-sum-total-with-vat");
    if (elTotalWithVat) elTotalWithVat.textContent = `₱${formatMoney(totalWithVat)}`;
    document.getElementById("pb-banner-total").textContent = `₱${formatMoney(totalWithVat)}`;
};

const loadPartialBill = (admissionId) => {
    const formData = new FormData();
    formData.append("operation", "getPartialBill");
    formData.append("json", JSON.stringify({ admission_id: admissionId }));

    axios.post(`${getApiUrl}/ledger.php`, formData)
        .then(response => {
            let bill = response.data;
            if (typeof bill === "string") {
                try { bill = JSON.parse(bill); } catch (e) {}
            }

            if (!bill || bill.error) {
                alert("Error loading partial bill: " + (bill ? bill.error : "Unknown error"), () => {
                    window.location.href = "admissions.html";
                });
                return;
            }

            renderPartialBill(bill);

            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get("print") === "true") {
                setTimeout(() => {
                    window.print();
                }, 500);
            }
        })
        .catch(() => {
            alert("Network error fetching partial bill.");
        });
};

window.addEventListener("DOMContentLoaded", () => {
    const userJson = sessionStorage.getItem("hospital_user");
    if (!userJson) {
        window.location.href = "login.html";
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const admissionId = urlParams.get("admission_id") || urlParams.get("id");

    if (!admissionId) {
        alert("Admission ID is required to generate a partial bill.", () => {
            window.location.href = "admissions.html";
        });
        return;
    }

    loadPartialBill(admissionId);
});
