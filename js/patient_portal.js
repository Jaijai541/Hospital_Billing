const portalApi = "../api/GET/patient_portal.php";

let activeAdmissionId = null;
let activePasscode = null;
let portalPartialBillData = null;
let portalActiveDayFilter = "all";

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
            tabButtons.forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".portal-tab-pane").forEach(p => p.classList.remove("active"));

            btn.classList.add("active");
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add("active");
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
            renderPortalDashboard(data);
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
                    <td>
                        <strong>${dayTag}${it.Description || "Charge"}</strong>
                        <div class="portal-item-meta">Station: ${it.Station_Name || "Hospital"} ${it.Formatted_Item_Date ? '&bull; ' + it.Formatted_Item_Date : ''}</div>
                    </td>
                    <td><span class="badge badge-secondary">${it.Category || "Hospital Charge"}</span></td>
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
