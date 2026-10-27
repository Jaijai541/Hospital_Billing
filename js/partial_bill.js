const getApiUrl = "../api/GET";

let currentBillData = null;
let activeDayFilter = "all";

const formatMoney = (amount) => {
    return parseFloat(amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

const categorizeLedgerItems = (items, roomStays, maxDay = null) => {
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

        let applicableDays = days;
        if (maxDay !== null) {
            applicableDays = Math.min(days, maxDay);
        }
        const applicableFee = applicableDays * rate;

        if (applicableFee > 0) {
            map["Room and Board Accommodations"].total += applicableFee;
            map["Room and Board Accommodations"].items.push({
                name: `${s.Bed_Code} (${s.Room_Name} - ${s.Room_Type_Name || "Standard"})`,
                detail: `${applicableDays} ${applicableDays > 1 ? "days" : "day"} x ₱${formatMoney(rate)} [${statusLabel}]`,
                amount: applicableFee,
                isReturn: false,
                dayNumber: s.Day_Number || 1,
                dayLabel: s.Day_Label || "Day 1"
            });
        }
    });

    (items || []).forEach(it => {
        const cat = (it.Category || "").toLowerCase();
        const desc = (it.Description || "").toLowerCase();
        const station = (it.Station_Name || "").toLowerCase();
        const amt = parseFloat(it.Total_Charge || 0);
        const qty = Math.abs(parseFloat(it.Quantity || 1));
        const unit = parseFloat(it.Unit_Price || 0);
        const isReturn = it.Transaction_Type === "Return" || amt < 0;
        const itemDay = it.Day_Number !== undefined ? parseInt(it.Day_Number, 10) : 1;

        if (maxDay !== null && itemDay > maxDay) {
            return;
        }

        if (it.Transfer_ID || cat.includes("room") || desc.includes("board & lodging")) {
            return;
        }
        if (it.Round_ID || cat.includes("doctor") || desc.includes("bedside round")) {
            return;
        }

        const itemObj = {
            name: it.Description,
            detail: `${qty} ${qty > 1 ? "units" : "unit"} x ₱${formatMoney(unit)}`,
            amount: amt,
            isReturn: isReturn,
            dayNumber: itemDay,
            dayLabel: it.Day_Label || `Day ${itemDay}`,
            itemDate: it.Formatted_Item_Date || ""
        };

        if (cat.includes("medicine") || isReturn || desc.includes("medicine") || desc.includes("tablet") || desc.includes("capsule")) {
            map["Drugs and Pharmaceuticals"].total += amt;
            map["Drugs and Pharmaceuticals"].items.push(itemObj);
        } else if (station.includes("laboratory") || desc.includes("cbc") || desc.includes("blood count") || desc.includes("phlebotomy") || desc.includes("urinalysis") || desc.includes("stool")) {
            itemObj.detail = `${qty} ${qty > 1 ? "tests" : "test"} x ₱${formatMoney(unit)}`;
            map["Clinical Laboratory Examinations"].total += amt;
            map["Clinical Laboratory Examinations"].items.push(itemObj);
        } else if (cat.includes("scan") || station.includes("radiology") || desc.includes("ct") || desc.includes("x-ray") || desc.includes("ultrasound") || desc.includes("ecg") || desc.includes("echo") || desc.includes("mri")) {
            itemObj.detail = `${qty} ${qty > 1 ? "scans" : "scan"} x ₱${formatMoney(unit)}`;
            map["Diagnostic Imaging & Radiology"].total += amt;
            map["Diagnostic Imaging & Radiology"].items.push(itemObj);
        } else {
            map["Medical Procedures & Clinical Supplies"].total += amt;
            map["Medical Procedures & Clinical Supplies"].items.push(itemObj);
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
                const dayTag = it.dayLabel ? `<span class="badge-day-tag">${it.dayLabel}</span>` : "";
                if (it.isReturn) {
                    itemsHtml += `<div class="particular-sub-item return-item">
                        <span>• Less Return: ${dayTag}${it.name} ( ${it.detail} )</span>
                        <span>-₱${formatMoney(Math.abs(it.amount))}</span>
                    </div>`;
                } else {
                    itemsHtml += `<div class="particular-sub-item">
                        <span>• ${dayTag}${it.name} ( ${it.detail} )</span>
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
                <td align="right" class="val-align-top"><strong>₱${formatMoney(cat.total)}</strong></td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    const subEl = document.getElementById("pb-hosp-subtotal");
    if (subEl) subEl.textContent = `₱${formatMoney(grandHospTotal)}`;
    return grandHospTotal;
};

const renderDailyHistory = (progression) => {
    const filterBar = document.getElementById("pb-day-filter-bar");
    const tbody = document.getElementById("pb-daily-history-tbody");
    const callout = document.getElementById("pb-combines-callout");
    if (!tbody || !progression || progression.length === 0) return;

    if (filterBar) {
        let filterHtml = `<button type="button" class="day-filter-btn ${activeDayFilter === 'all' ? 'active' : ''}" data-day="all">All Days (Cumulative Running Total)</button>`;
        progression.forEach(dp => {
            const isActive = activeDayFilter === String(dp.day_number);
            filterHtml += `<button type="button" class="day-filter-btn ${isActive ? 'active' : ''}" data-day="${dp.day_number}">${dp.day_label} (${dp.formatted_date})</button>`;
        });
        filterBar.innerHTML = filterHtml;

        const btns = filterBar.querySelectorAll(".day-filter-btn");
        btns.forEach(btn => {
            btn.addEventListener("click", () => {
                const targetDay = btn.getAttribute("data-day");
                selectDayFilter(targetDay);
            });
        });
    }

    let rowsHtml = "";
    progression.forEach(dp => {
        let itemsSummary = [];
        dp.items.forEach(it => {
            itemsSummary.push(`${it.name} [₱${formatMoney(it.amount)}]`);
        });
        const summaryText = itemsSummary.length > 0 ? itemsSummary.join("; ") : "No charges incurred on this day";

        rowsHtml += `
            <tr>
                <td>
                    <span class="day-cell-badge">${dp.day_label}</span>
                    <div class="statutory-note">${dp.formatted_date}</div>
                </td>
                <td>
                    <div class="day-item-breakdown">${summaryText}</div>
                </td>
                <td align="right">
                    <strong>₱${formatMoney(dp.day_net_total)}</strong>
                </td>
                <td align="right">
                    <strong class="combines-formula-text">₱${formatMoney(dp.cumulative_total)}</strong>
                </td>
                <td>
                    <div class="day-combines-cell">${dp.combination_text}</div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = rowsHtml;

    updateCombinesCallout(progression);
};

const updateCombinesCallout = (progression) => {
    const callout = document.getElementById("pb-combines-callout");
    if (!callout) return;

    if (activeDayFilter === "all") {
        if (progression.length > 0) {
            const last = progression[progression.length - 1];
            callout.classList.remove("hidden-element");
            callout.innerHTML = `<strong>Statement of Running Cumulative Charges:</strong> ${last.combination_text}`;
        } else {
            callout.classList.add("hidden-element");
        }
    } else {
        const dayInt = parseInt(activeDayFilter, 10);
        const selected = progression.find(p => p.day_number === dayInt);
        if (selected) {
            callout.classList.remove("hidden-element");
            if (dayInt === 1) {
                callout.innerHTML = `<strong>Viewing Day 1 Charges:</strong> Incurred on Day 1 = ₱${formatMoney(selected.day_net_total)}`;
            } else {
                callout.innerHTML = `<strong>Viewing Combined Charges as of Day ${dayInt}:</strong> ${selected.combination_text}`;
            }
        }
    }
};

const selectDayFilter = (targetDay) => {
    activeDayFilter = targetDay;
    if (!currentBillData) return;

    const btns = document.querySelectorAll("#pb-day-filter-bar .day-filter-btn");
    btns.forEach(b => {
        if (b.getAttribute("data-day") === targetDay) {
            b.classList.add("active");
        } else {
            b.classList.remove("active");
        }
    });

    const progression = currentBillData.Daily_Progression || [];
    updateCombinesCallout(progression);

    const maxDay = targetDay === "all" ? null : parseInt(targetDay, 10);
    const categories = categorizeLedgerItems(currentBillData.Ledger_Items || [], currentBillData.Room_Stays || [], maxDay);
    const hospTotal = renderHospitalCharges(categories);
    const doctors = currentBillData.Attending_Doctors || [];
    const docTotal = renderDoctorFees(doctors, currentBillData.Ledger_Items || []);

    let summaryToRender = Object.assign({}, currentBillData.Summary || {});
    if (maxDay !== null) {
        const selectedProg = progression.find(p => p.day_number === maxDay);
        if (selectedProg) {
            summaryToRender.gross_total = selectedProg.cumulative_total;
            summaryToRender.hospital_charges_total = selectedProg.cumulative_total;
            summaryToRender.net_accumulated_total = selectedProg.cumulative_total;
            summaryToRender.return_total = selectedProg.day_returns_total || 0;
        }
    }
    renderSummaryBox(summaryToRender, hospTotal, docTotal);
};

const renderDoctorFees = (doctors, ledgerItems) => {
    const tbody = document.getElementById("pb-doctor-fees-tbody");
    if (!tbody) return 0;

    if (!doctors || doctors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-center-muted">No attending physicians assigned yet.</td></tr>';
        const subEl = document.getElementById("pb-doc-subtotal");
        if (subEl) subEl.textContent = "₱0.00 (Finalized on Discharge)";
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
                <span>Est. ₱${formatMoney(total)}</span>
            </div>`;
            roundsHtml += "</div>";
        } else if (total > 0) {
            roundsHtml += '<div class="particular-item-list">';
            roundsHtml += `<div class="particular-sub-item">
                <span>• Professional Care & Consultation</span>
                <span>Est. ₱${formatMoney(total)}</span>
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
                <td align="right" class="text-right">
                    <span class="pf-excluded-badge">Finalized on Discharge</span>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    const subEl = document.getElementById("pb-doc-subtotal");
    if (subEl) subEl.textContent = "₱0.00 (Finalized on Discharge)";
    return grandDocTotal;
};

const renderAdvancePayments = (advPayments, totalAdvance) => {
    const sec = document.getElementById("pb-advance-section");
    const tbody = document.getElementById("pb-advance-tbody");
    const subtotalEl = document.getElementById("pb-subtotal-advance");
    if (!sec || !tbody) return;

    if (!advPayments || advPayments.length === 0) {
        sec.classList.add("hidden-element");
        return;
    }

    sec.classList.remove("hidden-element");
    let html = "";
    advPayments.forEach(p => {
        const amt = parseFloat(p.Amount_Paid || 0);
        const disc = parseFloat(p.Discount_Amount || 0);
        let amtHtml = `<strong>₱${formatMoney(amt)}</strong>`;
        if (disc > 0) {
            amtHtml += `<div class="discount-note-green">+₱${formatMoney(disc)} (${p.Applied_Discount_Name || 'Fixed Discount'})</div>`;
        }
        html += `
            <tr>
                <td><strong>${p.Receipt_Number}</strong></td>
                <td>${p.Payment_Date || "-"}</td>
                <td>${p.Payment_Method}</td>
                <td align="right">${amtHtml}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
    if (subtotalEl) subtotalEl.textContent = `₱${formatMoney(totalAdvance)}`;
};

const renderSummaryBox = (summary, hospTotal, docTotal) => {
    const gross = parseFloat(summary.gross_total || hospTotal);
    const returns = parseFloat(summary.return_total || 0);
    const net = parseFloat(summary.net_accumulated_total || (gross - returns));
    const advancePaid = parseFloat(summary.advance_payments_total || 0);
    const advanceDisc = parseFloat(summary.advance_discounts_total || 0);
    const totalAdvCredit = summary.advance_total_credit !== undefined ? parseFloat(summary.advance_total_credit) : (advancePaid + advanceDisc);
    const estimatedVat = Math.round(net * 0.12 * 100) / 100;
    const vatableBase = Math.round((net - estimatedVat) * 100) / 100;
    const totalAmount = net;
    const netRemaining = Math.max(0, totalAmount - totalAdvCredit);

    const elHosp = document.getElementById("pb-sum-hosp");
    const elDoc = document.getElementById("pb-sum-doc");
    const elGross = document.getElementById("pb-sum-gross");
    const elReturns = document.getElementById("pb-sum-returns");
    const rowReturns = document.getElementById("pb-row-returns");
    const elNet = document.getElementById("pb-sum-net");
    const elVat = document.getElementById("pb-sum-vat");
    const elTotalWithVat = document.getElementById("pb-sum-total-with-vat");
    const rowAdvDisc = document.getElementById("pb-row-advance-discounts");
    const elAdvDisc = document.getElementById("pb-sum-advance-discounts");
    const rowAdvance = document.getElementById("pb-row-advance-payments");
    const elAdv = document.getElementById("pb-sum-advance-payments");
    const elRemaining = document.getElementById("pb-sum-remaining-balance");
    const bannerTotal = document.getElementById("pb-banner-total");

    if (elHosp) elHosp.textContent = `₱${formatMoney(hospTotal)}`;
    if (elDoc) elDoc.textContent = "₱0.00 (Finalized on Discharge)";
    if (elGross) elGross.textContent = `₱${formatMoney(gross)}`;

    if (rowReturns) {
        if (returns > 0) {
            rowReturns.classList.remove("hidden-element");
            if (elReturns) elReturns.textContent = `-₱${formatMoney(returns)}`;
        } else {
            rowReturns.classList.add("hidden-element");
        }
    }

    if (elNet) elNet.textContent = `₱${formatMoney(vatableBase)}`;
    if (elVat) elVat.textContent = `₱${formatMoney(estimatedVat)}`;
    if (elTotalWithVat) elTotalWithVat.textContent = `₱${formatMoney(totalAmount)}`;

    if (rowAdvDisc) {
        if (advanceDisc > 0) {
            rowAdvDisc.classList.remove("hidden-element");
            if (elAdvDisc) elAdvDisc.textContent = `-₱${formatMoney(advanceDisc)}`;
        } else {
            rowAdvDisc.classList.add("hidden-element");
        }
    }

    if (rowAdvance) {
        if (advancePaid > 0) {
            rowAdvance.classList.remove("hidden-element");
            if (elAdv) elAdv.textContent = `-₱${formatMoney(advancePaid)}`;
        } else {
            rowAdvance.classList.add("hidden-element");
        }
    }

    if (elRemaining) elRemaining.textContent = `₱${formatMoney(netRemaining)}`;
    if (bannerTotal) bannerTotal.textContent = `₱${formatMoney(netRemaining)}`;
};

const renderPartialBill = (bill) => {
    currentBillData = bill;

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

    renderDailyHistory(bill.Daily_Progression || []);

    const categories = categorizeLedgerItems(bill.Ledger_Items || [], bill.Room_Stays || []);
    const hospTotal = renderHospitalCharges(categories);
    const docTotal = renderDoctorFees(doctors, bill.Ledger_Items || []);
    const advCreditTotal = bill.Summary ? (bill.Summary.advance_total_credit !== undefined ? bill.Summary.advance_total_credit : bill.Summary.advance_payments_total) : 0;
    renderAdvancePayments(bill.Advance_Payments || [], advCreditTotal);
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
