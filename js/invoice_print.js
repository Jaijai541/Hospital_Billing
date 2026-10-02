const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";
let currentInvoice = null;

const formatMoney = (amount) => {
    return parseFloat(amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

const parseHospitalCharges = (items) => {
    const map = {
        "Drugs and Medicine": { total: 0, items: [] },
        "Clinical Laboratory": { total: 0, items: [] },
        "Radiology & Diagnostic Imaging": { total: 0, items: [] },
        "Room and Board": { total: 0, items: [] },
        "Misc. Medical Supplies & Procedures": { total: 0, items: [] }
    };

    if (!items || items.length === 0) return map;

    items.forEach(row => {
        const amt = parseFloat(row.Total_Charge || 0);
        const cat = (row.Catalog_Category || row.Category || "").toLowerCase();
        const desc = (row.Description || "").toLowerCase();
        const station = (row.Station_Name || "").toLowerCase();

        if (row.Round_ID || cat.includes("doctor") || desc.includes("bedside round")) {
            return;
        }

        if (row.Transfer_ID || cat.includes("room") || desc.includes("board & lodging")) {
            map["Room and Board"].total += amt;
            map["Room and Board"].items.push(row);
        } else if (cat.includes("medicine") || row.Transaction_Type === "Return" || desc.includes("medicine") || desc.includes("tablet") || desc.includes("capsule")) {
            map["Drugs and Medicine"].total += amt;
            map["Drugs and Medicine"].items.push(row);
        } else if (station.includes("laboratory") || desc.includes("cbc") || desc.includes("blood count") || desc.includes("phlebotomy") || desc.includes("urinalysis") || desc.includes("stool")) {
            map["Clinical Laboratory"].total += amt;
            map["Clinical Laboratory"].items.push(row);
        } else if (cat.includes("scan") || station.includes("radiology") || desc.includes("ct") || desc.includes("x-ray") || desc.includes("ultrasound") || desc.includes("ecg") || desc.includes("echo") || desc.includes("mri")) {
            map["Radiology & Diagnostic Imaging"].total += amt;
            map["Radiology & Diagnostic Imaging"].items.push(row);
        } else {
            map["Misc. Medical Supplies & Procedures"].total += amt;
            map["Misc. Medical Supplies & Procedures"].items.push(row);
        }
    });

    return map;
};

const getDoctorRounds = (doc, ledgerItems) => {
    const docNameClean = (doc.Doctor_Name || "").toLowerCase().replace("dr.", "").trim();
    return (ledgerItems || []).filter(item => {
        if (!item.Round_ID && !(item.Category || "").toLowerCase().includes("doctor")) return false;
        const roundDoc = (item.Round_Doctor_Name || item.Description || "").toLowerCase();
        return roundDoc.includes(docNameClean);
    });
};

const renderHospitalChargesTable = (hospRows) => {
    const tbody = document.getElementById("hospital-charges-tbody");
    if (!tbody) return;

    let html = "";
    let subTotal = 0;
    let subDiscount = 0;
    let subCash = 0;
    let subBalance = 0;

    hospRows.forEach(row => {
        subTotal += row.total;
        subDiscount += row.discount;
        subCash += row.cash;
        subBalance += row.balance;

        html += `<tr>
            <td>${row.particularHtml}</td>
            <td align="right">${formatMoney(row.total)}</td>
            <td align="right">${formatMoney(row.discount)}</td>
            <td align="right">${formatMoney(row.cash)}</td>
            <td align="right"><strong>${formatMoney(row.balance)}</strong></td>
        </tr>`;
    });

    tbody.innerHTML = html;
    document.getElementById("hosp-sub-total").textContent = `₱${formatMoney(subTotal)}`;
    document.getElementById("hosp-sub-discount").textContent = `₱${formatMoney(subDiscount)}`;
    document.getElementById("hosp-sub-cash").textContent = `₱${formatMoney(subCash)}`;
    document.getElementById("hosp-sub-balance").textContent = `₱${formatMoney(subBalance)}`;
};

const renderDoctorFeesTable = (docRows) => {
    const tbody = document.getElementById("doctor-fees-tbody");
    if (!tbody) return;

    if (!docRows || docRows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b; font-style: italic;">No attending physician fees recorded.</td></tr>`;
        document.getElementById("doc-sub-total").textContent = "₱0.00";
        document.getElementById("doc-sub-discount").textContent = "₱0.00";
        document.getElementById("doc-sub-balance").textContent = "₱0.00";
        return;
    }

    let html = "";
    let subTotal = 0;
    let subDiscount = 0;
    let subBalance = 0;

    docRows.forEach(row => {
        subTotal += row.total;
        subDiscount += row.discount;
        subBalance += row.balance;

        html += `<tr>
            <td>${row.doctorHtml}</td>
            <td align="right">${formatMoney(row.total)}</td>
            <td align="right">${formatMoney(row.discount)}</td>
            <td align="right"><strong>${formatMoney(row.balance)}</strong></td>
        </tr>`;
    });

    tbody.innerHTML = html;
    document.getElementById("doc-sub-total").textContent = `₱${formatMoney(subTotal)}`;
    document.getElementById("doc-sub-discount").textContent = `₱${formatMoney(subDiscount)}`;
    document.getElementById("doc-sub-balance").textContent = `₱${formatMoney(subBalance)}`;
};

const renderSettlementSummary = (hospTotal, docTotal, gross, discPct, discName, discAmt, net, amountPaid, changeAmt, remainingBalance) => {
    const inv = currentInvoice || {};
    const vatRate = parseFloat(inv.VAT_Rate !== undefined && inv.VAT_Rate !== null ? inv.VAT_Rate : 12.00);
    const vatAmt = parseFloat(inv.VAT_Amount || 0);
    const vatableAmt = parseFloat(inv.VATable_Amount || 0);
    const vatExemptAmt = parseFloat(inv.VAT_Exempt_Amount || 0);
    const isExempt = (vatRate === 0 || vatExemptAmt > 0);

    const elHosp = document.getElementById("summary-hosp-total");
    const elDoc = document.getElementById("summary-doc-total");
    const elGross = document.getElementById("summary-gross-total");
    const elDiscLabel = document.getElementById("summary-discount-label");
    const elDiscTotal = document.getElementById("summary-discount-total");
    const tbodyAppDiscounts = document.getElementById("applied-discounts-itemized-tbody");
    const elNetBeforeTax = document.getElementById("summary-net-before-tax");
    const elRowVatable = document.getElementById("row-vatable-sales");
    const elVatableAmt = document.getElementById("summary-vatable-amount");
    const elRowExempt = document.getElementById("row-vat-exempt-sales");
    const elExemptAmt = document.getElementById("summary-vat-exempt-amount");
    const elVatAmt = document.getElementById("summary-vat-amount");
    const elNetTotal = document.getElementById("summary-net-total");
    const elPayTotal = document.getElementById("summary-payment-total");
    const elChangeRow = document.getElementById("row-change-line");
    const elChangeTotal = document.getElementById("summary-change-total");
    const elBalTotal = document.getElementById("summary-balance-total");
    const elGrandDue = document.getElementById("grand-balance-due");
    const elBadge = document.getElementById("payment-status-badge");

    if (elHosp) elHosp.textContent = `₱${formatMoney(hospTotal)}`;
    if (elDoc) elDoc.textContent = `₱${formatMoney(docTotal)}`;
    if (elGross) elGross.textContent = `₱${formatMoney(gross)}`;

    if (tbodyAppDiscounts) {
        if (inv.Applied_Discounts && Array.isArray(inv.Applied_Discounts) && inv.Applied_Discounts.length > 0) {
            tbodyAppDiscounts.innerHTML = inv.Applied_Discounts.map(ad => {
                const valStr = ad.Discount_Type === 'Fixed' 
                    ? `Fixed Voucher: ₱${formatMoney(parseFloat(ad.Discount_Value || 0))}` 
                    : `${parseFloat(ad.Discount_Value || 0).toFixed(2)}%`;
                return `<tr style="font-size: 13px; color: #166534;"><td style="padding-left: 20px;">• ${ad.Discount_Name} (${valStr}):</td><td align="right">-₱${formatMoney(parseFloat(ad.Calculated_Deduction || 0))}</td></tr>`;
            }).join('');
        } else {
            tbodyAppDiscounts.innerHTML = '';
        }
    }

    if (elDiscLabel) {
        if (inv.Discount_Summary) {
            elDiscLabel.textContent = inv.Discount_Summary;
        } else if (discName && discName !== "None" && discPct > 0) {
            elDiscLabel.textContent = `${discName} - ${discPct.toFixed(2)}%`;
        } else {
            elDiscLabel.textContent = "None (0.00%)";
        }
    }

    if (elDiscTotal) elDiscTotal.textContent = `-₱${formatMoney(discAmt)}`;

    const netBefore = (vatableAmt > 0 && vatAmt > 0 ? (vatableAmt + vatAmt) : (net > 0 ? net : Math.max(0, gross - discAmt)));
    if (elNetBeforeTax) elNetBeforeTax.textContent = `₱${formatMoney(netBefore)}`;

    if (isExempt) {
        if (elRowVatable) elRowVatable.style.display = "none";
        if (elRowExempt) {
            elRowExempt.style.display = "";
            if (elExemptAmt) elExemptAmt.textContent = `₱${formatMoney(vatExemptAmt > 0 ? vatExemptAmt : netBefore)}`;
        }
        if (elVatAmt) elVatAmt.textContent = "₱0.00 (12% VAT-Exempt)";
    } else {
        if (elRowVatable) {
            elRowVatable.style.display = "";
            if (elVatableAmt) elVatableAmt.textContent = `₱${formatMoney(vatableAmt > 0 ? vatableAmt : netBefore)}`;
        }
        if (elRowExempt) elRowExempt.style.display = "none";
        if (elVatAmt) elVatAmt.textContent = `₱${formatMoney(vatAmt)}`;
    }

    if (elNetTotal) elNetTotal.textContent = `₱${formatMoney(net)}`;
    if (elPayTotal) elPayTotal.textContent = `-₱${formatMoney(amountPaid)}`;

    if (changeAmt > 0 && elChangeRow && elChangeTotal) {
        elChangeRow.style.display = "";
        elChangeTotal.textContent = `₱${formatMoney(changeAmt)}`;
    } else if (elChangeRow) {
        elChangeRow.style.display = "none";
    }

    if (elBalTotal) elBalTotal.textContent = `₱${formatMoney(remainingBalance)}`;
    if (elGrandDue) elGrandDue.textContent = `₱${formatMoney(remainingBalance)}`;

    if (elBadge) {
        if (remainingBalance <= 0) {
            elBadge.textContent = "PAID IN FULL";
            elBadge.className = "payment-status-badge paid";
        } else {
            elBadge.textContent = "BALANCE PENDING";
            elBadge.className = "payment-status-badge due";
        }
    }
};

const renderInvoice = (inv) => {
    currentInvoice = inv;
    document.getElementById("inv-code").textContent = inv.Invoice_Code || "N/A";
    document.getElementById("inv-settlement-date").textContent = inv.Settlement_Date || "N/A";
    document.getElementById("inv-admission-code").textContent = inv.Admission_Code || "N/A";
    document.getElementById("inv-admission-date").textContent = inv.Admission_Date || "N/A";
    document.getElementById("inv-stay-days").textContent = (inv.Length_Of_Stay_Days !== undefined && inv.Length_Of_Stay_Days !== null) ? inv.Length_Of_Stay_Days : "1";

    const cashierName = inv.Cashier_Name || "Cashier / Billing Officer";
    const cashierRole = inv.Cashier_Role ? ` (${inv.Cashier_Role})` : "";
    document.getElementById("inv-cashier").textContent = `${cashierName}${cashierRole}`;

    document.getElementById("patient-name").textContent = inv.Patient_Name || "N/A";
    document.getElementById("patient-code").textContent = inv.Patient_Code || "N/A";

    const dob = inv.Date_Of_Birth || "N/A";
    const ageText = (inv.Age !== null && inv.Age !== undefined && inv.Age !== "") ? ` (${inv.Age} years old)` : "";
    document.getElementById("patient-age").textContent = `${dob}${ageText}`;

    document.getElementById("patient-gender-blood").textContent = `${inv.Gender_Name || "Unspecified"} / Blood: ${inv.Blood_Type_Name || "N/A"}`;
    document.getElementById("patient-contact").textContent = inv.Contact_Number || "N/A";
    document.getElementById("patient-address").textContent = inv.Address || "N/A";

    let emergText = "None Recorded";
    if (inv.Emergency_Contact_Name && inv.Emergency_Contact_Number) {
        emergText = `${inv.Emergency_Contact_Name} (${inv.Emergency_Contact_Number})`;
    } else if (inv.Emergency_Contact_Name) {
        emergText = inv.Emergency_Contact_Name;
    } else if (inv.Emergency_Contact_Number) {
        emergText = inv.Emergency_Contact_Number;
    }
    document.getElementById("patient-emergency").textContent = emergText;
    document.getElementById("patient-complaint").textContent = inv.Chief_Complaint || "None Recorded";
    const diagEl = document.getElementById("patient-diagnosis");
    if (diagEl) {
        diagEl.textContent = inv.Diagnosis || "None Recorded";
    }

    const doctors = inv.Attending_Doctors || [];
    if (doctors.length > 0) {
        const docText = doctors.map(d => `${d.Doctor_Name || "Doctor"} (${d.Doctor_Type || "Attending"}${d.Specialties ? " - " + d.Specialties : ""})`).join("; ");
        document.getElementById("patient-doctors").textContent = docText;
        document.getElementById("sig-doctor").textContent = doctors[0].Doctor_Name || "Attending Physician";
    } else {
        document.getElementById("patient-doctors").textContent = "None Recorded";
        document.getElementById("sig-doctor").textContent = "Attending Physician";
    }

    const gross = parseFloat(inv.Gross_Total || 0);
    const discountAmt = parseFloat(inv.Discount_Amount || 0);
    const net = parseFloat(inv.Net_Amount_Due || 0);
    const discPct = parseFloat(inv.Discount_Percentage || 0);
    const discName = inv.Discount_Name || "None";

    const amountPaid = parseFloat(inv.Amount_Paid !== undefined && inv.Amount_Paid !== null ? inv.Amount_Paid : net);
    const changeAmt = parseFloat(inv.Change_Amount || 0);
    const remainingBalance = Math.max(0, Math.round((net - amountPaid) * 100) / 100);

    const isPaidInFull = amountPaid >= net;

    const hospMap = parseHospitalCharges(inv.Ledger_Items || []);
    const particularsList = [
        "Drugs and Medicine",
        "Clinical Laboratory",
        "Radiology & Diagnostic Imaging",
        "Room and Board",
        "Misc. Medical Supplies & Procedures"
    ];

    const hospRows = particularsList.map(name => {
        const catData = hospMap[name] || { total: 0, items: [] };
        const total = catData.total;
        const discount = total > 0 && gross > 0 && discountAmt > 0 
            ? Math.round(total * (discountAmt / gross) * 100) / 100 
            : 0;

        let cash = 0;
        let balance = 0;
        const netRow = Math.max(0, Math.round((total - discount) * 100) / 100);

        if (isPaidInFull) {
            cash = netRow;
            balance = 0;
        } else if (net > 0 && amountPaid > 0) {
            const ratio = amountPaid / net;
            cash = Math.round(netRow * ratio * 100) / 100;
            balance = Math.max(0, Math.round((netRow - cash) * 100) / 100);
        } else {
            cash = 0;
            balance = netRow;
        }

        let itemsHtml = "";
        if (catData.items && catData.items.length > 0) {
            itemsHtml += '<div class="particular-item-list">';
            catData.items.forEach(it => {
                const isReturn = it.Transaction_Type === "Return" || parseFloat(it.Total_Charge || 0) < 0;
                const qty = Math.abs(parseFloat(it.Quantity || 1));
                const unit = parseFloat(it.Unit_Price || 0);
                const lineAmt = parseFloat(it.Total_Charge || 0);
                const desc = it.Description || "Item";

                if (name === "Drugs and Medicine") {
                    if (isReturn) {
                        itemsHtml += `<div class="particular-sub-item return-item">
                            <span>• Return Drugs and Medicine: ${desc} ( ${qty} units x ₱${formatMoney(unit)} )</span>
                            <span>-₱${formatMoney(Math.abs(lineAmt))}</span>
                        </div>`;
                    } else {
                        itemsHtml += `<div class="particular-sub-item">
                            <span>• ${desc} ( ${qty} units x ₱${formatMoney(unit)} )</span>
                            <span>₱${formatMoney(lineAmt)}</span>
                        </div>`;
                    }
                } else if (name === "Room and Board") {
                    itemsHtml += `<div class="particular-sub-item">
                        <span>• ${desc} ( ${qty} ${qty > 1 ? "days" : "day"} x ₱${formatMoney(unit)} )</span>
                        <span>₱${formatMoney(lineAmt)}</span>
                    </div>`;
                } else if (name === "Clinical Laboratory") {
                    itemsHtml += `<div class="particular-sub-item">
                        <span>• ${desc} ( ${qty} ${qty > 1 ? "tests" : "test"} x ₱${formatMoney(unit)} )</span>
                        <span>₱${formatMoney(lineAmt)}</span>
                    </div>`;
                } else if (name === "Radiology & Diagnostic Imaging") {
                    itemsHtml += `<div class="particular-sub-item">
                        <span>• ${desc} ( ${qty} ${qty > 1 ? "scans" : "scan"} x ₱${formatMoney(unit)} )</span>
                        <span>₱${formatMoney(lineAmt)}</span>
                    </div>`;
                } else {
                    itemsHtml += `<div class="particular-sub-item">
                        <span>• ${desc} ( ${qty} ${qty > 1 ? "units" : "unit"} x ₱${formatMoney(unit)} )</span>
                        <span>₱${formatMoney(lineAmt)}</span>
                    </div>`;
                }
            });
            itemsHtml += '</div>';
        } else {
            if (name === "Radiology & Diagnostic Imaging") {
                itemsHtml += '<span class="particular-subtitle">No imaging examinations (X-Ray, Ultrasound, CT-Scan) recorded</span>';
            } else if (name === "Clinical Laboratory") {
                itemsHtml += '<span class="particular-subtitle">No laboratory examinations recorded</span>';
            } else {
                itemsHtml += '<span class="particular-subtitle">No accumulated charges recorded</span>';
            }
        }

        const particularHtml = `<strong>${name}</strong>${itemsHtml}`;

        return {
            particular: name,
            particularHtml: particularHtml,
            total: total,
            discount: discount,
            cash: cash,
            balance: balance
        };
    });

    const docRows = doctors.map(doc => {
        const total = parseFloat(doc.Charges || 0);
        const discount = total > 0 && gross > 0 && discountAmt > 0 
            ? Math.round(total * (discountAmt / gross) * 100) / 100 
            : 0;
        const netDoc = Math.max(0, Math.round((total - discount) * 100) / 100);
        const balance = isPaidInFull ? 0 : netDoc;

        const subtitle = doc.Specialties 
            ? `<span class="particular-subtitle">${doc.Doctor_Type || "Physician"} — ${doc.Specialties}</span>`
            : (doc.Doctor_Type ? `<span class="particular-subtitle">${doc.Doctor_Type}</span>` : "");

        const rounds = getDoctorRounds(doc, inv.Ledger_Items || []);
        let roundsHtml = "";
        if (rounds && rounds.length > 0) {
            roundsHtml += '<div class="particular-item-list">';
            rounds.forEach(r => {
                const rQty = parseFloat(r.Quantity || 1);
                roundsHtml += `<div class="particular-sub-item">
                    <span>• Bedside Clinical Visit ( ${rQty} ${rQty > 1 ? "visits" : "visit"} x ₱${formatMoney(r.Unit_Price)} )</span>
                    <span>₱${formatMoney(r.Total_Charge)}</span>
                </div>`;
            });
            roundsHtml += '</div>';
        } else if (total > 0) {
            roundsHtml += `<div class="particular-item-list">
                <div class="particular-sub-item">
                    <span>• Bedside Consultation & Care (${doc.Round_Count || 1} visit)</span>
                    <span>₱${formatMoney(total)}</span>
                </div>
            </div>`;
        } else {
            roundsHtml += '<span class="particular-subtitle">No bedside visit charges logged</span>';
        }

        const doctorHtml = `<strong>${doc.Doctor_Formal_Name || (doc.Doctor_Name ? doc.Doctor_Name.toUpperCase() : "DOCTOR")}</strong>${subtitle}${roundsHtml}`;

        return {
            name: doc.Doctor_Formal_Name || (doc.Doctor_Name ? doc.Doctor_Name.toUpperCase() : "DOCTOR"),
            doctorHtml: doctorHtml,
            total: total,
            discount: discount,
            balance: balance
        };
    });

    let calculatedDiscountTotal = 0;
    hospRows.forEach(r => { calculatedDiscountTotal += r.discount; });
    docRows.forEach(r => { calculatedDiscountTotal += r.discount; });

    const discountDiff = Math.round((discountAmt - calculatedDiscountTotal) * 100) / 100;
    if (Math.abs(discountDiff) > 0.001) {
        let targetRow = null;
        let maxTotal = -1;
        docRows.forEach(r => {
            if (r.total > maxTotal) {
                maxTotal = r.total;
                targetRow = r;
            }
        });
        if (!targetRow || maxTotal <= 0) {
            hospRows.forEach(r => {
                if (r.total > maxTotal) {
                    maxTotal = r.total;
                    targetRow = r;
                }
            });
        }

        if (targetRow) {
            targetRow.discount = Math.round((targetRow.discount + discountDiff) * 100) / 100;
            if (!isPaidInFull) {
                targetRow.balance = Math.max(0, Math.round((targetRow.total - (targetRow.cash || 0) - targetRow.discount) * 100) / 100);
            }
        }
    }

    renderHospitalChargesTable(hospRows);
    renderDoctorFeesTable(docRows);

    let hospSubTotal = 0;
    hospRows.forEach(r => { hospSubTotal += r.total; });
    let docSubTotal = 0;
    docRows.forEach(r => { docSubTotal += r.total; });

    renderSettlementSummary(hospSubTotal, docSubTotal, gross, discPct, discName, discountAmt, net, amountPaid, changeAmt, remainingBalance);

    document.getElementById("sig-cashier").textContent = inv.Cashier_Name || "Billing Officer";
    document.getElementById("sig-patient").textContent = inv.Patient_Name || "Patient / Authorized Representative";
};

const loadInvoiceData = (invoiceId, admissionId) => {
    const payload = {};
    if (invoiceId) payload.invoice_id = invoiceId;
    if (admissionId) payload.admission_id = admissionId;

    const formData = new FormData();
    formData.append("operation", "getInvoiceById");
    formData.append("json", JSON.stringify(payload));

    axios.post(`${getApiUrl}/invoices.php`, formData)
        .then(response => {
            let inv = response.data;
            if (typeof inv === "string") {
                try {
                    inv = JSON.parse(inv);
                } catch (e) {}
            }

            if (!inv || inv.error) {
                alert("Error loading invoice: " + (inv ? inv.error : "Empty response"), () => {
                    window.location.href = "invoices.html";
                });
                return;
            }

            renderInvoice(inv);

            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get("print") === "true") {
                setTimeout(() => {
                    window.print();
                }, 500);
            }
        })
        .catch(() => {
            alert("Network error fetching official statement.");
        });
};

const openPaymentHistoryModal = () => {
    if (!currentInvoice) return;

    document.getElementById('hist_invoice_code').textContent = currentInvoice.Invoice_Code || "N/A";
    document.getElementById('hist_admission_code').textContent = currentInvoice.Admission_Code || "N/A";
    document.getElementById('hist_patient_name').textContent = `${currentInvoice.Patient_Code || ''} - ${currentInvoice.Patient_Name || ''}`;

    const container = document.getElementById('history-modal-table-div');
    container.innerHTML = '<p class="text-muted">Loading payment transactions...</p>';

    const formData = new FormData();
    formData.append('operation', 'getPaymentHistory');
    formData.append('json', JSON.stringify({ invoice_id: currentInvoice.Invoice_ID, admission_id: currentInvoice.Admission_ID }));

    axios.post(`${getApiUrl}/invoices.php`, formData)
        .then(res => {
            let list = res.data;
            if (typeof list === 'string') {
                try { list = JSON.parse(list); } catch (e) {}
            }

            if (!Array.isArray(list) || list.length === 0) {
                container.innerHTML = '<p class="text-muted" style="margin: 12px 0;"><em>No payment transactions recorded for this invoice yet.</em></p>';
                openModal('paymentHistoryModal');
                return;
            }

            let rows = '';
            list.forEach(p => {
                const amt = parseFloat(p.Amount_Paid || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
                const bal = parseFloat(p.Balance_After || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
                const isPaid = parseFloat(p.Balance_After || 0) <= 0;

                rows += `
                    <tr class="clickable-row" onclick="window.location.href='payment_receipt.html?payment_id=${p.Payment_ID}'" title="Click row to view / print Official Receipt voucher">
                        <td><strong style="color: #0284c7;">${p.Receipt_Number}</strong></td>
                        <td>${p.Payment_Date}</td>
                        <td><span class="badge badge-info">${p.Payment_Method || 'Cash'}</span></td>
                        <td>${p.Cashier_Name}</td>
                        <td align="right"><strong style="color: #16a34a;">₱${amt}</strong></td>
                        <td align="right"><strong style="color: ${isPaid ? '#16a34a' : '#dc2626'};">₱${bal}</strong></td>
                        <td>${p.Notes || '-'}</td>
                    </tr>
                `;
            });

            container.innerHTML = `
                <table class="data-table" style="font-size: 13px;">
                    <thead>
                        <tr>
                            <th>Official Receipt #</th>
                            <th>Date & Time</th>
                            <th>Method</th>
                            <th>Cashier</th>
                            <th style="text-align: right;">Amount Paid</th>
                            <th style="text-align: right;">Remaining Bal</th>
                            <th>Particulars / Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            `;

            openModal('paymentHistoryModal');
        })
        .catch(() => {
            container.innerHTML = '<p class="text-danger">Failed to load payment transactions.</p>';
            openModal('paymentHistoryModal');
        });
};

window.addEventListener("DOMContentLoaded", () => {
    const userJson = sessionStorage.getItem("hospital_user");
    if (!userJson) {
        window.location.href = "login.html";
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get("id");
    const admissionId = urlParams.get("admission_id");

    if (!invoiceId && !admissionId) {
        alert("Invoice ID or Admission ID is missing.", () => {
            window.location.href = "invoices.html";
        });
        return;
    }

    document.getElementById('btnOpenReceiptsModal')?.addEventListener('click', openPaymentHistoryModal);
    document.getElementById('btnCloseHistoryModal')?.addEventListener('click', () => closeModal('paymentHistoryModal'));
    document.getElementById('btnDismissHistoryModal')?.addEventListener('click', () => closeModal('paymentHistoryModal'));
    document.getElementById('btnBackToOrigin')?.addEventListener('click', () => {
        if (document.referrer && (document.referrer.includes('invoices.html') || document.referrer.includes('admission_details.html'))) {
            window.location.href = document.referrer;
        } else if (admissionId || (currentInvoice && currentInvoice.Admission_ID)) {
            window.location.href = `admission_details.html?id=${admissionId || currentInvoice.Admission_ID}`;
        } else if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = 'invoices.html';
        }
    });

    loadInvoiceData(invoiceId, admissionId);
});
