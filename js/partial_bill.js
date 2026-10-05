const getApiUrl = "../api/GET";

const formatMoney = (amount) => {
    return parseFloat(amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

const categorizeLedgerItems = (items, roomStays) => {
    const map = {
        "Room and Board Accommodations": {
            total: 0,
            items: []
        },
        "Drugs and Pharmaceuticals": {
            total: 0,
            items: []
        },
        "Diagnostic Imaging & Radiology": {
            total: 0,
            items: []
        },
        "Clinical Laboratory Examinations": {
            total: 0,
            items: []
        },
        "Medical Procedures & Clinical Supplies": {
            total: 0,
            items: []
        }
    };

    (roomStays || []).forEach(s => {
        const fee = parseFloat(s.Calculated_Room_Fee || 0);
        const days = parseInt(s.Calculated_Days || 1, 10);
        const rate = parseFloat(s.Daily_Rate || 0);
        const isCurrent = parseInt(s.Is_Current_Stay, 10) === 1;
        const statusLabel = isCurrent ? "Active Stay (To Date)" : (s.Date_Out || "Transferred");

        map["Room and Board Accommodations"].total += fee;
        map["Room and Board Accommodations"].items.push({
            name: `${s.Bed_Code} (${s.Room_Name} - ${s.Room_Type_Name || "Standard"})`,
            detail: `${days} ${days > 1 ? "days" : "day"} x ₱${formatMoney(rate)} [${statusLabel}]`,
            amount: fee,
            isReturn: false
        });
    });

    (items || []).forEach(it => {
        const cat = (it.Category || "").toLowerCase();
        const desc = (it.Description || "").toLowerCase();
        const station = (it.Station_Name || "").toLowerCase();
        const amt = parseFloat(it.Total_Charge || 0);
        const qty = Math.abs(parseFloat(it.Quantity || 1));
        const unit = parseFloat(it.Unit_Price || 0);
        const isReturn = it.Transaction_Type === "Return" || amt < 0;

        if (it.Transfer_ID || cat.includes("room") || desc.includes("board & lodging")) {
            return;
        }
        if (it.Round_ID || cat.includes("doctor") || desc.includes("bedside round")) {
            return;
        }

        if (cat.includes("medicine") || isReturn || desc.includes("medicine") || desc.includes("tablet") || desc.includes("capsule")) {
            map["Drugs and Pharmaceuticals"].total += amt;
            map["Drugs and Pharmaceuticals"].items.push({
                name: it.Description,
                detail: `${qty} ${qty > 1 ? "units" : "unit"} x ₱${formatMoney(unit)}`,
                amount: amt,
                isReturn: isReturn
            });
        } else if (station.includes("laboratory") || desc.includes("cbc") || desc.includes("blood count") || desc.includes("phlebotomy") || desc.includes("urinalysis") || desc.includes("stool")) {
            map["Clinical Laboratory Examinations"].total += amt;
            map["Clinical Laboratory Examinations"].items.push({
                name: it.Description,
                detail: `${qty} ${qty > 1 ? "tests" : "test"} x ₱${formatMoney(unit)}`,
                amount: amt,
                isReturn: false
            });
        } else if (cat.includes("scan") || station.includes("radiology") || desc.includes("ct") || desc.includes("x-ray") || desc.includes("ultrasound") || desc.includes("ecg") || desc.includes("echo") || desc.includes("mri")) {
            map["Diagnostic Imaging & Radiology"].total += amt;
            map["Diagnostic Imaging & Radiology"].items.push({
                name: it.Description,
                detail: `${qty} ${qty > 1 ? "scans" : "scan"} x ₱${formatMoney(unit)}`,
                amount: amt,
                isReturn: false
            });
        } else {
            map["Medical Procedures & Clinical Supplies"].total += amt;
            map["Medical Procedures & Clinical Supplies"].items.push({
                name: it.Description,
                detail: `${qty} ${qty > 1 ? "units" : "unit"} x ₱${formatMoney(unit)}`,
                amount: amt,
                isReturn: false
            });
        }
    });

    return map;
};

const renderHospitalCharges = (categories) => {
    const tbody = document.getElementById("pb-hospital-charges-tbody");
    if (!tbody) return 0;

    let html = "";
    let grandHospTotal = 0;

    Object.keys(categories).forEach(catName => {
        const cat = categories[catName];
        grandHospTotal += cat.total;

        let itemsHtml = "";
        if (cat.items && cat.items.length > 0) {
            itemsHtml += '<div class="particular-item-list">';
            cat.items.forEach(it => {
                if (it.isReturn) {
                    itemsHtml += `<div class="particular-sub-item return-item">
                        <span>• Less Return: ${it.name} ( ${it.detail} )</span>
                        <span>-₱${formatMoney(Math.abs(it.amount))}</span>
                    </div>`;
                } else {
                    itemsHtml += `<div class="particular-sub-item">
                        <span>• ${it.name} ( ${it.detail} )</span>
                        <span>₱${formatMoney(it.amount)}</span>
                    </div>`;
                }
            });
            itemsHtml += "</div>";
        } else {
            itemsHtml += '<span class="particular-subtitle">No accumulated charges recorded to date</span>';
        }

        html += `
            <tr>
                <td>
                    <span class="particular-category-title">${catName}</span>
                    ${itemsHtml}
                </td>
                <td align="right" style="vertical-align: top;"><strong>₱${formatMoney(cat.total)}</strong></td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    const subEl = document.getElementById("pb-hosp-subtotal");
    if (subEl) subEl.textContent = `₱${formatMoney(grandHospTotal)}`;
    return grandHospTotal;
};

const renderDoctorFees = (doctors, ledgerItems) => {
    const tbody = document.getElementById("pb-doctor-fees-tbody");
    if (!tbody) return 0;

    if (!doctors || doctors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #64748b; font-style: italic;">No attending physicians assigned yet.</td></tr>';
        const subEl = document.getElementById("pb-doc-subtotal");
        if (subEl) subEl.textContent = "₱0.00";
        return 0;
    }

    let html = "";
    let grandDocTotal = 0;

    doctors.forEach(doc => {
        const total = parseFloat(doc.Charges || 0);
        grandDocTotal += total;
        const rounds = parseInt(doc.Round_Count || 0, 10);
        const subtitle = doc.Specialties 
            ? `<span class="particular-subtitle">${doc.Doctor_Type || "Physician"} — ${doc.Specialties}</span>`
            : (doc.Doctor_Type ? `<span class="particular-subtitle">${doc.Doctor_Type}</span>` : "");

        let roundsHtml = "";
        if (rounds > 0) {
            roundsHtml += '<div class="particular-item-list">';
            roundsHtml += `<div class="particular-sub-item">
                <span>• Bedside Clinical Rounds (${rounds} ${rounds > 1 ? "visits" : "visit"})</span>
                <span>₱${formatMoney(total)}</span>
            </div>`;
            roundsHtml += "</div>";
        } else if (total > 0) {
            roundsHtml += '<div class="particular-item-list">';
            roundsHtml += `<div class="particular-sub-item">
                <span>• Professional Care & Consultation</span>
                <span>₱${formatMoney(total)}</span>
            </div>`;
            roundsHtml += "</div>";
        } else {
            roundsHtml += '<span class="particular-subtitle">No bedside visit charges logged to date</span>';
        }

        html += `
            <tr>
                <td>
                    <span class="particular-category-title">${doc.Doctor_Name}</span>
                    ${subtitle}
                    ${roundsHtml}
                </td>
                <td align="right" style="vertical-align: top;"><strong>₱${formatMoney(total)}</strong></td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    const subEl = document.getElementById("pb-doc-subtotal");
    if (subEl) subEl.textContent = `₱${formatMoney(grandDocTotal)}`;
    return grandDocTotal;
};

const renderAdvancePayments = (advPayments, totalAdvance) => {
    const sec = document.getElementById("pb-advance-section");
    const tbody = document.getElementById("pb-advance-tbody");
    const subtotalEl = document.getElementById("pb-subtotal-advance");
    if (!sec || !tbody) return;

    if (!advPayments || advPayments.length === 0) {
        sec.style.display = "none";
        return;
    }

    sec.style.display = "block";
    let html = "";
    advPayments.forEach(p => {
        html += `
            <tr>
                <td><strong>${p.Receipt_Number}</strong></td>
                <td>${p.Payment_Date || "-"}</td>
                <td>${p.Payment_Method}</td>
                <td align="right"><strong>₱${formatMoney(p.Amount_Paid)}</strong></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
    if (subtotalEl) subtotalEl.textContent = `₱${formatMoney(totalAdvance)}`;
};

const renderSummaryBox = (summary, hospTotal, docTotal) => {
    const gross = parseFloat(summary.gross_total || (hospTotal + docTotal));
    const returns = parseFloat(summary.return_total || 0);
    const net = parseFloat(summary.net_accumulated_total || (gross - returns));
    const advancePaid = parseFloat(summary.advance_payments_total || 0);
    const estimatedVat = Math.round(net * 0.12 * 100) / 100;
    const vatableBase = Math.round((net - estimatedVat) * 100) / 100;
    const totalAmount = net;
    const netRemaining = Math.max(0, totalAmount - advancePaid);

    const elHosp = document.getElementById("pb-sum-hosp");
    const elDoc = document.getElementById("pb-sum-doc");
    const elGross = document.getElementById("pb-sum-gross");
    const elReturns = document.getElementById("pb-sum-returns");
    const rowReturns = document.getElementById("pb-row-returns");
    const elNet = document.getElementById("pb-sum-net");
    const elVat = document.getElementById("pb-sum-vat");
    const elTotalWithVat = document.getElementById("pb-sum-total-with-vat");
    const rowAdvance = document.getElementById("pb-row-advance-payments");
    const elAdv = document.getElementById("pb-sum-advance-payments");
    const elRemaining = document.getElementById("pb-sum-remaining-balance");
    const bannerTotal = document.getElementById("pb-banner-total");

    if (elHosp) elHosp.textContent = `₱${formatMoney(hospTotal)}`;
    if (elDoc) elDoc.textContent = `₱${formatMoney(docTotal)}`;
    if (elGross) elGross.textContent = `₱${formatMoney(gross)}`;

    if (rowReturns) {
        if (returns > 0) {
            rowReturns.style.display = "table-row";
            if (elReturns) elReturns.textContent = `-₱${formatMoney(returns)}`;
        } else {
            rowReturns.style.display = "none";
        }
    }

    if (elNet) elNet.textContent = `₱${formatMoney(vatableBase)}`;
    if (elVat) elVat.textContent = `₱${formatMoney(estimatedVat)}`;
    if (elTotalWithVat) elTotalWithVat.textContent = `₱${formatMoney(totalAmount)}`;

    if (rowAdvance) {
        if (advancePaid > 0) {
            rowAdvance.style.display = "table-row";
            if (elAdv) elAdv.textContent = `-₱${formatMoney(advancePaid)}`;
        } else {
            rowAdvance.style.display = "none";
        }
    }

    if (elRemaining) elRemaining.textContent = `₱${formatMoney(netRemaining)}`;
    if (bannerTotal) bannerTotal.textContent = `₱${formatMoney(netRemaining)}`;
};

const renderPartialBill = (bill) => {
    document.getElementById("pb-admission-code").textContent = bill.Admission_Code || "N/A";
    document.getElementById("pb-statement-date").textContent = bill.Statement_Date || "N/A";
    document.getElementById("pb-admission-date").textContent = bill.Admission_Date || "N/A";
    document.getElementById("pb-stay-days").textContent = bill.Stay_Days_To_Date || "1";

    const statusBadge = document.getElementById("pb-admission-status");
    if (statusBadge) {
        statusBadge.textContent = bill.Admission_Status || "Admitted";
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
    const ageText = (bill.Age !== null && bill.Age !== undefined) ? ` (${bill.Age} yrs)` : "";
    document.getElementById("pb-patient-age").textContent = `${dob}${ageText}`;
    document.getElementById("pb-patient-gender-blood").textContent = `${bill.Gender_Name || "Unspecified"} / Blood: ${bill.Blood_Type_Name || "N/A"}`;
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

    const categories = categorizeLedgerItems(bill.Ledger_Items || [], bill.Room_Stays || []);
    const hospTotal = renderHospitalCharges(categories);
    const docTotal = renderDoctorFees(doctors, bill.Ledger_Items || []);
    renderAdvancePayments(bill.Advance_Payments || [], bill.Summary ? bill.Summary.advance_payments_total : 0);
    renderSummaryBox(bill.Summary || {}, hospTotal, docTotal);

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
