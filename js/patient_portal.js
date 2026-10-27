const portalApi = "../api/GET/patient_portal.php";

let activeAdmissionId = null;
let activePasscode = null;
let portalPartialBillData = null;
let portalActiveDayFilter = "all";
let currentPortalTab = "tab-partial";
let cachedPortalData = null;

const formatMoney = (val) => {
    return parseFloat(val || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

document.addEventListener("DOMContentLoaded", () => {
    initPortalTabs();
    initAuthEvents();
    checkExistingSessionOrUrl();
});

const initPortalTabs = () => {
    const tabButtons = document.querySelectorAll(".portal-tab-btn");
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.dataset.tab;
            currentPortalTab = targetId;
            tabButtons.forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".portal-tab-pane").forEach(p => p.classList.remove("active"));

            btn.classList.add("active");
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add("active");
            }

            if (cachedPortalData) {
                renderPrintSheet(cachedPortalData, currentPortalTab);
            }
        });
    });
};

const initAuthEvents = () => {
    const btnVerify = document.getElementById("btnVerifyCode");
    if (btnVerify) {
        btnVerify.addEventListener("click", handlePortalLogin);
    }

    const inputId = document.getElementById("portal_identifier");
    const inputPass = document.getElementById("portal_passcode");

    if (inputId) {
        inputId.addEventListener("keydown", (e) => {
            if (e.key === "Enter") handlePortalLogin();
        });
    }
    if (inputPass) {
        inputPass.addEventListener("keydown", (e) => {
            if (e.key === "Enter") handlePortalLogin();
        });
    }

    const btnExit = document.getElementById("btnExitPortal");
    if (btnExit) {
        btnExit.addEventListener("click", handlePortalLogout);
    }
};

const checkExistingSessionOrUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const paramId = params.get("id") || params.get("code") || params.get("identifier");
    const paramPass = params.get("passcode") || params.get("pass");

    if (paramId && paramPass) {
        document.getElementById("portal_identifier").value = paramId;
        document.getElementById("portal_passcode").value = paramPass;
        handlePortalLogin();
        return;
    }

    const savedAuth = sessionStorage.getItem("patient_portal_auth");
    if (savedAuth) {
        try {
            const data = JSON.parse(savedAuth);
            if (data.admission_id && data.passcode) {
                activeAdmissionId = data.admission_id;
                activePasscode = data.passcode;
                loadPortalData(activeAdmissionId, activePasscode);
            }
        } catch (e) {
            sessionStorage.removeItem("patient_portal_auth");
        }
    }
};

const handlePortalLogin = async () => {
    const idInput = document.getElementById("portal_identifier");
    const passInput = document.getElementById("portal_passcode");
    const errAlert = document.getElementById("auth-error-alert");

    const identifier = idInput ? idInput.value.trim() : "";
    const passcode = passInput ? passInput.value.trim().toUpperCase() : "";

    if (!identifier || !passcode) {
        showError("Please enter both your Admission Code and Inpatient Access Passcode.");
        return;
    }

    if (errAlert) {
        errAlert.classList.remove("visible");
        errAlert.textContent = "";
    }

    const btnVerify = document.getElementById("btnVerifyCode");
    if (btnVerify) {
        btnVerify.disabled = true;
        btnVerify.textContent = "Verifying Credentials...";
    }

    try {
        const formData = new FormData();
        formData.append("operation", "verifyAccess");
        formData.append("json", JSON.stringify({ identifier, passcode }));

        const response = await axios.post(portalApi, formData);
        const res = response.data;

        if (res && res.success) {
            activeAdmissionId = res.admission_id;
            activePasscode = passcode;

            sessionStorage.setItem("patient_portal_auth", JSON.stringify({
                admission_id: activeAdmissionId,
                passcode: activePasscode
            }));

            loadPortalData(activeAdmissionId, activePasscode);
        } else {
            showError(res.error || "Invalid Admission Code or Inpatient Access Passcode.");
        }
    } catch (err) {
        showError("Network connection error. Please try again.");
    } finally {
        if (btnVerify) {
            btnVerify.disabled = false;
            btnVerify.textContent = "Access My Statement";
        }
    }
};

const handlePortalLogout = () => {
    sessionStorage.removeItem("patient_portal_auth");
    activeAdmissionId = null;
    activePasscode = null;
    cachedPortalData = null;

    document.getElementById("dashboard-section").classList.add("hidden-element");
    document.getElementById("auth-section").classList.remove("hidden-element");
    document.getElementById("btnExitPortal").classList.add("hidden-element");

    document.getElementById("portal_identifier").value = "";
    document.getElementById("portal_passcode").value = "";
    const errAlert = document.getElementById("auth-error-alert");
    if (errAlert) {
        errAlert.classList.remove("visible");
        errAlert.textContent = "";
    }
};

const showError = (msg) => {
    const errAlert = document.getElementById("auth-error-alert");
    if (errAlert) {
        errAlert.textContent = msg;
        errAlert.classList.add("visible");
    } else {
        alert(msg);
    }
};

const loadPortalData = async (aid, pass) => {
    try {
        const formData = new FormData();
        formData.append("operation", "getPatientBillDetails");
        formData.append("json", JSON.stringify({ admission_id: aid, passcode: pass }));

        const response = await axios.post(portalApi, formData);
        const data = response.data;

        if (data && data.success) {
            cachedPortalData = data;
            renderPortalDashboard(data);
            renderPrintSheet(data, currentPortalTab);
            document.getElementById("auth-section").classList.add("hidden-element");
            document.getElementById("dashboard-section").classList.remove("hidden-element");
            document.getElementById("btnExitPortal").classList.remove("hidden-element");
        } else {
            showError(data.error || "Failed to load statement details.");
            handlePortalLogout();
        }
    } catch (err) {
        showError("Network error loading patient bill.");
    }
};

const renderPortalDashboard = (data) => {
    const pb = data.partial_bill || {};
    const fi = data.final_invoice;
    const payments = data.payment_history || [];

    document.getElementById("pt-name").textContent = pb.Patient_Name || "Patient";
    document.getElementById("pt-code").textContent = pb.Patient_Code || "PAT-000";
    document.getElementById("pt-admission-code").textContent = pb.Admission_Code || "ADM-000";
    document.getElementById("pt-demographics").textContent = `${pb.Gender_Name || ""}, ${pb.Age || ""} yrs old • Blood Type: ${pb.Blood_Type_Name || "N/A"}`;

    const statusPill = document.getElementById("pt-status-pill");
    const isBilled = (pb.Admission_Status === "Billed" || !!fi);
    if (statusPill) {
        statusPill.textContent = isBilled ? "Discharged / Billed" : "Currently Admitted";
        statusPill.className = isBilled ? "portal-status-pill status-billed" : "portal-status-pill status-admitted";
    }

    document.getElementById("pt-admission-date").textContent = pb.Admission_Date || "-";
    const roomStay = (pb.Room_Stays && pb.Room_Stays.length > 0) ? pb.Room_Stays[pb.Room_Stays.length - 1] : null;
    document.getElementById("pt-room-bed").textContent = roomStay ? `${roomStay.Room_Name} (${roomStay.Bed_Code})` : "General Care";
    document.getElementById("pt-stay-days").textContent = `${pb.Stay_Days_To_Date || 1} day(s)`;

    const doctors = pb.Attending_Doctors || [];
    const docNames = doctors.map(d => d.Doctor_Name).join("; ");
    document.getElementById("pt-attending-md").textContent = docNames || "Attending Physician Assigned";

    renderPartialTab(pb);
    renderFinalTab(fi, payments, data.applied_discounts || []);
};

const renderPortalDailyHistory = (progression) => {
    const filterBar = document.getElementById("portal-day-filter-bar");
    const tbody = document.getElementById("portal-daily-history-tbody");
    if (!tbody || !progression || progression.length === 0) return;

    if (filterBar) {
        let filterHtml = `<button type="button" class="portal-day-pill ${portalActiveDayFilter === 'all' ? 'active' : ''}" data-day="all">All Days (Cumulative Running Bill)</button>`;
        progression.forEach(dp => {
            const isActive = portalActiveDayFilter === String(dp.day_number);
            filterHtml += `<button type="button" class="portal-day-pill ${isActive ? 'active' : ''}" data-day="${dp.day_number}">${dp.day_label} (${dp.formatted_date})</button>`;
        });
        filterBar.innerHTML = filterHtml;

        const btns = filterBar.querySelectorAll(".portal-day-pill");
        btns.forEach(btn => {
            btn.addEventListener("click", () => {
                const targetDay = btn.getAttribute("data-day");
                selectPortalDayFilter(targetDay);
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
                    <span class="portal-day-badge">${dp.day_label}</span>
                    <div class="portal-progression-meta">${dp.formatted_date}</div>
                </td>
                <td>
                    <div class="portal-progression-meta">${summaryText}</div>
                </td>
                <td class="text-right">
                    <strong>₱${formatMoney(dp.day_net_total)}</strong>
                </td>
                <td>
                    <div class="portal-combines-text">${dp.combination_text}</div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = rowsHtml;

    updatePortalCombinesBanner(progression);
};

const updatePortalCombinesBanner = (progression) => {
    const banner = document.getElementById("portal-combines-banner");
    if (!banner) return;

    if (portalActiveDayFilter === "all") {
        if (progression.length > 0) {
            const last = progression[progression.length - 1];
            banner.classList.remove("hidden-element");
            banner.innerHTML = `<strong>Statement of Running Cumulative Charges:</strong> ${last.combination_text}`;
        } else {
            banner.classList.add("hidden-element");
        }
    } else {
        const dayInt = parseInt(portalActiveDayFilter, 10);
        const selected = progression.find(p => p.day_number === dayInt);
        if (selected) {
            banner.classList.remove("hidden-element");
            if (dayInt === 1) {
                banner.innerHTML = `<strong>Viewing Day 1 Charges:</strong> Incurred on Day 1 = ₱${formatMoney(selected.day_net_total)}`;
            } else {
                banner.innerHTML = `<strong>Viewing Combined Charges as of Day ${dayInt}:</strong> ${selected.combination_text}`;
            }
        }
    }
};

const selectPortalDayFilter = (targetDay) => {
    portalActiveDayFilter = targetDay;
    if (!portalPartialBillData) return;

    const btns = document.querySelectorAll("#portal-day-filter-bar .portal-day-pill");
    btns.forEach(b => {
        if (b.getAttribute("data-day") === targetDay) {
            b.classList.add("active");
        } else {
            b.classList.remove("active");
        }
    });

    const progression = portalPartialBillData.Daily_Progression || [];
    updatePortalCombinesBanner(progression);
    renderPortalPartialItems(portalPartialBillData, targetDay);
};

const renderPortalPartialItems = (pb, maxDayFilter = "all") => {
    const tbody = document.getElementById("portal-partial-items-tbody");
    if (!tbody) return;

    const items = pb.Ledger_Items || [];
    const maxDay = maxDayFilter === "all" ? null : parseInt(maxDayFilter, 10);

    const nonPfItems = items.filter(it => {
        if (it.Category === "Doctor Professional Fee") return false;
        if (maxDay !== null) {
            const itemDay = it.Day_Number !== undefined ? parseInt(it.Day_Number, 10) : 1;
            return itemDay <= maxDay;
        }
        return true;
    });

    if (nonPfItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No accumulated hospital charges logged for the selected period.</td></tr>';
    } else {
        let html = "";
        nonPfItems.forEach(it => {
            const isReturn = (it.Transaction_Type === "Return");
            const amtClass = isReturn ? "text-success text-right font-bold" : "text-right font-bold";
            const amtSign = isReturn ? "-₱" : "₱";
            const dayTag = it.Day_Label ? `<span class="badge-portal-day">${it.Day_Label}</span>` : "";
            html += `
                <tr>
                    <td>${dayTag}${it.Description}</td>
                    <td><span class="badge badge-secondary">${it.Category || "Clinical Service"}</span></td>
                    <td class="${amtClass}">${amtSign}${formatMoney(Math.abs(it.Total_Charge))}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    const progression = pb.Daily_Progression || [];
    let hospTotal = 0;
    let returns = 0;
    let net = 0;

    if (maxDay !== null) {
        const selectedProg = progression.find(p => p.day_number === maxDay);
        if (selectedProg) {
            hospTotal = selectedProg.cumulative_total;
            returns = selectedProg.day_returns_total || 0;
            net = selectedProg.cumulative_total;
        }
    } else {
        const summary = pb.Summary || {};
        hospTotal = parseFloat(summary.hospital_charges_total || summary.gross_total || 0);
        returns = parseFloat(summary.return_total || 0);
        net = parseFloat(summary.net_accumulated_total || (hospTotal - returns));
    }

    const summary = pb.Summary || {};
    const advancePaid = parseFloat(summary.advance_payments_total || 0);
    const balance = Math.max(0, net - advancePaid);

    document.getElementById("portal-partial-subtotal").textContent = `₱${formatMoney(hospTotal)}`;
    document.getElementById("pb-sum-hosp-display").textContent = `₱${formatMoney(hospTotal)}`;

    const rowReturns = document.getElementById("row-portal-returns");
    if (rowReturns) {
        if (returns > 0) {
            rowReturns.classList.remove("hidden-element");
            document.getElementById("pb-sum-returns-display").textContent = `-₱${formatMoney(returns)}`;
        } else {
            rowReturns.classList.add("hidden-element");
        }
    }

    const rowAdvance = document.getElementById("row-portal-advance");
    if (rowAdvance) {
        if (advancePaid > 0) {
            rowAdvance.classList.remove("hidden-element");
            document.getElementById("pb-sum-advance-display").textContent = `-₱${formatMoney(advancePaid)}`;
        } else {
            rowAdvance.classList.add("hidden-element");
        }
    }

    document.getElementById("pb-sum-net-display").textContent = `₱${formatMoney(net)}`;
    document.getElementById("pb-sum-balance-display").textContent = `₱${formatMoney(balance)}`;
};

const renderPartialTab = (pb) => {
    portalPartialBillData = pb;
    renderPortalDailyHistory(pb.Daily_Progression || []);
    renderPortalPartialItems(pb, portalActiveDayFilter);
};

const renderFinalTab = (fi, payments, appliedDiscounts) => {
    const content = document.getElementById("final-invoice-content");
    const pending = document.getElementById("final-invoice-pending");

    if (!fi) {
        if (content) content.classList.add("hidden-element");
        if (pending) pending.classList.remove("hidden-element");
        return;
    }

    if (content) content.classList.remove("hidden-element");
    if (pending) pending.classList.add("hidden-element");

    const gross = parseFloat(fi.Gross_Total || 0);
    const discount = parseFloat(fi.Discount_Amount || 0);
    const advance = parseFloat(fi.Advance_Payment_Amount || 0);
    const net = parseFloat(fi.Net_Amount_Due || 0);
    const paid = parseFloat(fi.Amount_Paid || 0);
    const change = parseFloat(fi.Change_Amount || 0);
    const remaining = Math.max(0, Math.round((net - paid) * 100) / 100);

    document.getElementById("soa-gross-display").textContent = `₱${formatMoney(gross)}`;

    const discRow = document.getElementById("soa-discount-row");
    if (discRow) {
        if (discount > 0) {
            discRow.classList.remove("hidden-element");
            document.getElementById("soa-discount-display").textContent = `-₱${formatMoney(discount)}`;
            if (fi.Discount_Summary) {
                document.getElementById("soa-discount-label").innerHTML = `Less: Applied Discounts &amp; Assistance (${fi.Discount_Summary}):`;
            }
        } else {
            discRow.classList.add("hidden-element");
        }
    }

    const advRow = document.getElementById("soa-advance-row");
    if (advRow) {
        if (advance > 0) {
            advRow.classList.remove("hidden-element");
            document.getElementById("soa-advance-display").textContent = `-₱${formatMoney(advance)}`;
        } else {
            advRow.classList.add("hidden-element");
        }
    }

    document.getElementById("soa-net-display").textContent = `₱${formatMoney(net)}`;
    document.getElementById("soa-paid-display").textContent = `₱${formatMoney(paid)}`;
    document.getElementById("soa-change-display").textContent = `₱${formatMoney(change)}`;

    const balEl = document.getElementById("soa-balance-display");
    if (balEl) {
        balEl.textContent = remaining > 0 ? `₱${formatMoney(remaining)}` : "₱0.00 (PAID IN FULL)";
        if (remaining === 0) {
            balEl.classList.add("text-success");
        }
    }

    const rcptTbody = document.getElementById("soa-receipts-tbody");
    if (rcptTbody) {
        if (payments.length === 0) {
            rcptTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No official receipts logged.</td></tr>';
        } else {
            let html = "";
            payments.forEach(p => {
                const isAdv = (p.Is_Advance == 1);
                const tag = isAdv ? '<span class="badge badge-warning">Advance Deposit</span>' : '<span class="badge badge-success">Official Settlement</span>';
                html += `
                    <tr>
                        <td><strong>${p.Receipt_Number}</strong> ${tag}</td>
                        <td>${p.Payment_Date || "-"}</td>
                        <td>${p.Payment_Method}</td>
                        <td class="text-right"><strong>₱${formatMoney(p.Amount_Paid)}</strong></td>
                    </tr>
                `;
            });
            rcptTbody.innerHTML = html;
        }
    }
};

const categorizeLedgerItems = (items, roomStays, maxDay = null) => {
    const map = {
        "Room and Board Accommodations": { total: 0, items: [] },
        "Drugs and Pharmaceuticals": { total: 0, items: [] },
        "Diagnostic Imaging & Radiology": { total: 0, items: [] },
        "Clinical Laboratory Examinations": { total: 0, items: [] },
        "Medical Procedures & Clinical Supplies": { total: 0, items: [] }
    };

    (roomStays || []).forEach(s => {
        const rate = parseFloat(s.Daily_Rate || 0);
        const days = parseInt(s.Calculated_Days || 1, 10);
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

        if (maxDay !== null && itemDay > maxDay) return;
        if (it.Transfer_ID || cat.includes("room") || desc.includes("board & lodging")) return;
        if (it.Round_ID || cat.includes("doctor") || desc.includes("bedside round")) return;

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

const renderPrintSheet = (data, activeTab = "tab-partial") => {
    if (!data) return;
    const pb = data.partial_bill || {};
    const fi = data.final_invoice;
    const payments = data.payment_history || [];

    const isFinalMode = activeTab === "tab-final" && !!fi;

    const elDocTitle = document.getElementById("print-doc-title");
    const elInterimWrap = document.getElementById("print-interim-badge-wrap");
    const elInterimPill = document.getElementById("print-interim-pill");
    const elPfNotice = document.getElementById("print-pf-notice");
    const elDailySec = document.getElementById("print-daily-history-section");
    const elHeadParticulars = document.getElementById("print-header-particulars");
    const elAdvanceSec = document.getElementById("print-advance-section");
    const elFinalPaymentsSec = document.getElementById("print-final-payments-section");
    const elSumTitle = document.getElementById("print-summary-title");
    const elRowSumHosp = document.getElementById("print-row-sum-hosp");
    const elRowSumGross = document.getElementById("print-row-sum-gross");
    const elRowReturns = document.getElementById("print-row-returns");
    const elRowSumNet = document.getElementById("print-row-sum-net");
    const elRowVat = document.getElementById("print-row-vat");
    const elRowSumTotalVat = document.getElementById("print-row-sum-total-vat");
    const elRowAdvDisc = document.getElementById("print-row-advance-discounts");
    const elRowAdvPay = document.getElementById("print-row-advance-payments");
    const elRowFinalPaid = document.getElementById("print-row-final-paid");
    const elRowFinalChange = document.getElementById("print-row-final-change");
    const elLabelBalance = document.getElementById("print-label-balance");
    const elStatutoryNote = document.getElementById("print-statutory-note");
    const elBannerLabel = document.getElementById("print-banner-label");
    const elBannerTotal = document.getElementById("print-banner-total");
    const elFooterNote = document.getElementById("print-footer-note");

    document.getElementById("print-pt-name").textContent = pb.Patient_Name || "Patient";
    document.getElementById("print-pt-code").textContent = pb.Patient_Code || "PAT-000";
    document.getElementById("print-adm-code").textContent = pb.Admission_Code || "ADM-000";
    document.getElementById("print-pt-demographics").textContent = `${pb.Gender_Name || "Unspecified"} • Blood: ${pb.Blood_Type_Name || "N/A"}`;
    document.getElementById("print-adm-date").textContent = pb.Admission_Date || "-";
    document.getElementById("print-stay-days").textContent = `${pb.Stay_Days_To_Date || 1}`;

    const roomStay = (pb.Room_Stays && pb.Room_Stays.length > 0) ? pb.Room_Stays[pb.Room_Stays.length - 1] : null;
    document.getElementById("print-bed-room").textContent = roomStay ? `${roomStay.Room_Name} (${roomStay.Bed_Code})` : "General Care";
    document.getElementById("print-statement-date").textContent = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    document.getElementById("print-adm-status").textContent = isFinalMode ? "Discharged / Billed" : (pb.Admission_Status || "Admitted");
    document.getElementById("print-diagnosis").textContent = pb.Diagnosis || "Clinical Diagnosis Pending";

    const doctors = pb.Attending_Doctors || [];
    const docNames = doctors.map(d => d.Doctor_Name).join("; ");
    document.getElementById("print-doctors").textContent = docNames || "Attending Physician Assigned";

    const sigDoc = document.getElementById("print-sig-doctor");
    if (sigDoc && doctors.length > 0) {
        sigDoc.textContent = doctors[0].Doctor_Name;
    }
    const sigPat = document.getElementById("print-sig-patient");
    if (sigPat) {
        sigPat.textContent = pb.Patient_Name || "Patient / Authorized Representative";
    }

    if (isFinalMode) {
        if (elDocTitle) elDocTitle.textContent = "OFFICIAL STATEMENT OF ACCOUNT (FINAL SOA)";
        if (elInterimPill) elInterimPill.textContent = `FINAL INVOICE #${String(fi.Invoice_ID).padStart(4, '0')} — PATIENT DISCHARGED`;
        if (elPfNotice) elPfNotice.classList.add("hidden-element");
        if (elDailySec) elDailySec.classList.add("hidden-element");
        if (elHeadParticulars) elHeadParticulars.textContent = "FINAL AUDITED HOSPITAL & CLINICAL SERVICES";
        if (elAdvanceSec) elAdvanceSec.classList.add("hidden-element");
        if (elSumTitle) elSumTitle.textContent = "FINAL ACCOUNT SETTLEMENT SUMMARY";

        const gross = parseFloat(fi.Gross_Total || 0);
        const discount = parseFloat(fi.Discount_Amount || 0);
        const advance = parseFloat(fi.Advance_Payment_Amount || 0);
        const net = parseFloat(fi.Net_Amount_Due || 0);
        const paid = parseFloat(fi.Amount_Paid || 0);
        const change = parseFloat(fi.Change_Amount || 0);
        const remaining = Math.max(0, Math.round((net - paid) * 100) / 100);

        const categories = categorizeLedgerItems(pb.Ledger_Items || [], pb.Room_Stays || []);
        let hospHtml = "";
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
            }
            hospHtml += `
                <tr>
                    <td>
                        <span class="particular-category-title">${catName}</span>
                        ${itemsHtml}
                    </td>
                    <td align="right" class="val-align-top"><strong>₱${formatMoney(cat.total)}</strong></td>
                </tr>
            `;
        });
        document.getElementById("print-hospital-charges-tbody").innerHTML = hospHtml;
        document.getElementById("print-hosp-subtotal").textContent = `₱${formatMoney(grandHospTotal)}`;

        if (elFinalPaymentsSec) {
            if (payments.length > 0) {
                elFinalPaymentsSec.classList.remove("hidden-element");
                let payHtml = "";
                payments.forEach(p => {
                    const isAdv = (p.Is_Advance == 1);
                    const tag = isAdv ? ' (Advance Deposit)' : ' (Official Settlement)';
                    payHtml += `
                        <tr>
                            <td><strong>${p.Receipt_Number}</strong>${tag}</td>
                            <td>${p.Payment_Date || "-"}</td>
                            <td>${p.Payment_Method}</td>
                            <td align="right"><strong>₱${formatMoney(p.Amount_Paid)}</strong></td>
                        </tr>
                    `;
                });
                document.getElementById("print-final-payments-tbody").innerHTML = payHtml;
            } else {
                elFinalPaymentsSec.classList.add("hidden-element");
            }
        }

        if (elRowSumHosp) elRowSumHosp.classList.add("hidden-element");
        if (elRowReturns) elRowReturns.classList.add("hidden-element");
        if (elRowVat) elRowVat.classList.add("hidden-element");
        if (elRowSumTotalVat) elRowSumTotalVat.classList.add("hidden-element");

        document.getElementById("print-sum-gross").textContent = `₱${formatMoney(gross)}`;
        document.getElementById("print-sum-net").textContent = `₱${formatMoney(net)}`;

        if (elRowAdvDisc) {
            if (discount > 0) {
                elRowAdvDisc.classList.remove("hidden-element");
                document.getElementById("print-label-discounts").textContent = `Less: Applied Discounts & Assistance (${fi.Discount_Summary || 'Senior/PWD/PhilHealth'}):`;
                document.getElementById("print-sum-advance-discounts").textContent = `-₱${formatMoney(discount)}`;
            } else {
                elRowAdvDisc.classList.add("hidden-element");
            }
        }

        if (elRowAdvPay) {
            if (advance > 0) {
                elRowAdvPay.classList.remove("hidden-element");
                document.getElementById("print-label-advance-payments").textContent = "Less: Advance Payments Credited:";
                document.getElementById("print-sum-advance-payments").textContent = `-₱${formatMoney(advance)}`;
            } else {
                elRowAdvPay.classList.add("hidden-element");
            }
        }

        if (elRowFinalPaid) {
            elRowFinalPaid.classList.remove("hidden-element");
            document.getElementById("print-sum-final-paid").textContent = `₱${formatMoney(paid)}`;
        }
        if (elRowFinalChange) {
            if (change > 0) {
                elRowFinalChange.classList.remove("hidden-element");
                document.getElementById("print-sum-final-change").textContent = `₱${formatMoney(change)}`;
            } else {
                elRowFinalChange.classList.add("hidden-element");
            }
        }

        if (elLabelBalance) elLabelBalance.textContent = "Discharge Account Balance:";
        document.getElementById("print-sum-remaining-balance").textContent = remaining > 0 ? `₱${formatMoney(remaining)}` : "₱0.00 (PAID IN FULL)";
        if (elStatutoryNote) elStatutoryNote.textContent = "*This Statement of Account is final, audited, and official for all financial and insurance claims.";

        if (elBannerLabel) elBannerLabel.textContent = "FINAL DISCHARGE BALANCE:";
        if (elBannerTotal) elBannerTotal.textContent = remaining > 0 ? `₱${formatMoney(remaining)}` : "₱0.00 (PAID IN FULL)";
        if (elFooterNote) elFooterNote.textContent = "Official Statement of Account • In-Patient Hospital Billing System • Fully audited and certified";

    } else {
        if (elDocTitle) elDocTitle.textContent = "INTERIM STATEMENT OF ACCOUNT & RUNNING BILL";
        if (elInterimPill) elInterimPill.textContent = "INTERIM RUNNING BILL — PATIENT CURRENTLY ADMITTED";
        if (elPfNotice) elPfNotice.classList.remove("hidden-element");
        if (elDailySec) elDailySec.classList.remove("hidden-element");
        if (elHeadParticulars) elHeadParticulars.textContent = "HOSPITAL CHARGES BY CATEGORY (RUNNING TO DATE)";
        if (elFinalPaymentsSec) elFinalPaymentsSec.classList.add("hidden-element");
        if (elSumTitle) elSumTitle.textContent = "RUNNING SETTLEMENT SUMMARY";

        let dailyHtml = "";
        (pb.Daily_Progression || []).forEach(dp => {
            let itemsSummary = [];
            (dp.items || []).forEach(it => {
                itemsSummary.push(`${it.name} [₱${formatMoney(it.amount)}]`);
            });
            const summaryText = itemsSummary.length > 0 ? itemsSummary.join("; ") : "No charges incurred on this day";
            dailyHtml += `
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
        document.getElementById("print-daily-history-tbody").innerHTML = dailyHtml;

        const categories = categorizeLedgerItems(pb.Ledger_Items || [], pb.Room_Stays || []);
        let hospHtml = "";
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
            hospHtml += `
                <tr>
                    <td>
                        <span class="particular-category-title">${catName}</span>
                        ${itemsHtml}
                    </td>
                    <td align="right" class="val-align-top"><strong>₱${formatMoney(cat.total)}</strong></td>
                </tr>
            `;
        });
        document.getElementById("print-hospital-charges-tbody").innerHTML = hospHtml;
        document.getElementById("print-hosp-subtotal").textContent = `₱${formatMoney(grandHospTotal)}`;

        const advPayments = pb.Advance_Payments || [];
        const advTotal = (pb.Summary && pb.Summary.advance_total_credit !== undefined) ? pb.Summary.advance_total_credit : (pb.Summary ? pb.Summary.advance_payments_total : 0);
        if (elAdvanceSec) {
            if (advPayments.length > 0) {
                elAdvanceSec.classList.remove("hidden-element");
                let advHtml = "";
                advPayments.forEach(p => {
                    const amt = parseFloat(p.Amount_Paid || 0);
                    const disc = parseFloat(p.Discount_Amount || 0);
                    let amtHtml = `<strong>₱${formatMoney(amt)}</strong>`;
                    if (disc > 0) {
                        amtHtml += `<div class="discount-note-green">+₱${formatMoney(disc)} (${p.Applied_Discount_Name || 'Fixed Discount'})</div>`;
                    }
                    advHtml += `
                        <tr>
                            <td><strong>${p.Receipt_Number}</strong></td>
                            <td>${p.Payment_Date || "-"}</td>
                            <td>${p.Payment_Method}</td>
                            <td align="right">${amtHtml}</td>
                        </tr>
                    `;
                });
                document.getElementById("print-advance-tbody").innerHTML = advHtml;
                document.getElementById("print-subtotal-advance").textContent = `₱${formatMoney(advTotal)}`;
            } else {
                elAdvanceSec.classList.add("hidden-element");
            }
        }

        const summary = pb.Summary || {};
        const gross = parseFloat(summary.gross_total || grandHospTotal);
        const returns = parseFloat(summary.return_total || 0);
        const net = parseFloat(summary.net_accumulated_total || (gross - returns));
        const advancePaid = parseFloat(summary.advance_payments_total || 0);
        const advanceDisc = parseFloat(summary.advance_discounts_total || 0);
        const totalAdvCredit = summary.advance_total_credit !== undefined ? parseFloat(summary.advance_total_credit) : (advancePaid + advanceDisc);
        const estimatedVat = Math.round(net * 0.12 * 100) / 100;
        const vatableBase = Math.round((net - estimatedVat) * 100) / 100;
        const netRemaining = Math.max(0, net - totalAdvCredit);

        if (elRowSumHosp) {
            elRowSumHosp.classList.remove("hidden-element");
            document.getElementById("print-sum-hosp").textContent = `₱${formatMoney(grandHospTotal)}`;
        }
        if (elRowSumGross) elRowSumGross.classList.remove("hidden-element");
        document.getElementById("print-sum-gross").textContent = `₱${formatMoney(gross)}`;

        if (elRowReturns) {
            if (returns > 0) {
                elRowReturns.classList.remove("hidden-element");
                document.getElementById("print-sum-returns").textContent = `-₱${formatMoney(returns)}`;
            } else {
                elRowReturns.classList.add("hidden-element");
            }
        }

        if (elRowSumNet) elRowSumNet.classList.remove("hidden-element");
        document.getElementById("print-sum-net").textContent = `₱${formatMoney(vatableBase)}`;
        if (elRowVat) elRowVat.classList.remove("hidden-element");
        document.getElementById("print-sum-vat").textContent = `₱${formatMoney(estimatedVat)}`;
        if (elRowSumTotalVat) elRowSumTotalVat.classList.remove("hidden-element");
        document.getElementById("print-sum-total-with-vat").textContent = `₱${formatMoney(net)}`;

        if (elRowAdvDisc) {
            if (advanceDisc > 0) {
                elRowAdvDisc.classList.remove("hidden-element");
                document.getElementById("print-label-discounts").textContent = "Less: Discounts Credited in Advance:";
                document.getElementById("print-sum-advance-discounts").textContent = `-₱${formatMoney(advanceDisc)}`;
            } else {
                elRowAdvDisc.classList.add("hidden-element");
            }
        }

        if (elRowAdvPay) {
            if (advancePaid > 0) {
                elRowAdvPay.classList.remove("hidden-element");
                document.getElementById("print-label-advance-payments").textContent = "Less: Advance Payments & Deposits Received:";
                document.getElementById("print-sum-advance-payments").textContent = `-₱${formatMoney(advancePaid)}`;
            } else {
                elRowAdvPay.classList.add("hidden-element");
            }
        }

        if (elRowFinalPaid) elRowFinalPaid.classList.add("hidden-element");
        if (elRowFinalChange) elRowFinalChange.classList.add("hidden-element");

        if (elLabelBalance) elLabelBalance.textContent = "Estimated Net Running Balance Due:";
        document.getElementById("print-sum-remaining-balance").textContent = `₱${formatMoney(netRemaining)}`;

        if (elStatutoryNote) elStatutoryNote.textContent = "*Statutory discounts (PhilHealth, Senior, PWD) and Professional Fees are assessed upon final patient discharge.";

        if (elBannerLabel) elBannerLabel.textContent = "ESTIMATED NET RUNNING BALANCE:";
        if (elBannerTotal) elBannerTotal.textContent = `₱${formatMoney(netRemaining)}`;
        if (elFooterNote) elFooterNote.textContent = "Official Interim Running Bill • In-Patient Hospital Billing System • Charges remain subject to updates until final discharge";
    }
};

const triggerPortalPrint = (tabKey) => {
    if (tabKey) currentPortalTab = tabKey;
    if (cachedPortalData) {
        renderPrintSheet(cachedPortalData, currentPortalTab);
    }
    window.print();
};

window.triggerPortalPrint = triggerPortalPrint;
