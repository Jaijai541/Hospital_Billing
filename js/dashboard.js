let currentDashSlide = 0;
let totalDashSlides = 4;

const triggerChartsGrowAnimation = () => {
    const slide3 = document.getElementById('dash-slide-3');
    if (!slide3) return;
    slide3.classList.add('charts-anim-reset');
    void slide3.offsetWidth;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            slide3.classList.remove('charts-anim-reset');
        });
    });
};

const showDashboardSlide = (index) => {
    currentDashSlide = (index + totalDashSlides) % totalDashSlides;
    const slides = document.querySelectorAll('.dash-carousel-slide');
    const pulseCards = document.querySelectorAll('.pulse-card');

    slides.forEach((slide, idx) => {
        if (idx === currentDashSlide) {
            slide.classList.remove('dash-slide-hidden');
            slide.style.display = 'block';
        } else {
            slide.classList.add('dash-slide-hidden');
            slide.style.display = 'none';
        }
    });

    pulseCards.forEach((card) => {
        const targetIdx = parseInt(card.getAttribute('data-target-slide') || '-1', 10);
        if (targetIdx === currentDashSlide) {
            card.classList.add('active-pulse-card');
        } else {
            card.classList.remove('active-pulse-card');
        }
    });

    if (currentDashSlide === 3) {
        triggerChartsGrowAnimation();
    }
};

const initDashboardCarousel = () => {
    const pulseCards = document.querySelectorAll('.pulse-card');

    pulseCards.forEach((card) => {
        card.addEventListener('click', () => {
            const target = parseInt(card.getAttribute('data-target-slide') || '0', 10);
            showDashboardSlide(target);
        });
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const target = parseInt(card.getAttribute('data-target-slide') || '0', 10);
                showDashboardSlide(target);
            }
        });
    });

    showDashboardSlide(0);
};

const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

const formatCompactPeso = (num) => {
    const val = parseFloat(num) || 0;
    if (val >= 1000000) {
        return `₱${(val / 1000000).toFixed(1)}M`;
    }
    if (val >= 10000) {
        return `₱${(val / 1000).toFixed(1)}k`;
    }
    if (val >= 1000) {
        return `₱${(val / 1000).toFixed(2)}k`;
    }
    return `₱${val.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
};

const formatShortMonthDay = (ymd) => {
    if (!ymd || ymd.length < 10) return ymd || '';
    const parts = ymd.slice(0, 10).split('-');
    if (parts.length < 3) return ymd;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = Math.max(0, Math.min(11, parseInt(parts[1], 10) - 1));
    return `${months[mIdx]} ${parseInt(parts[2], 10)}`;
};

const renderRecentAdmissions = (admissions) => {
    const container = document.getElementById('recent-admissions-container');
    if (!container) return;

    if (!admissions || admissions.length === 0) {
        container.innerHTML = '<p style="padding: 20px; color: var(--text-muted);"><em>No in-patients are currently admitted in the hospital.</em></p>';
        return;
    }

    const user = JSON.parse(sessionStorage.getItem("hospital_user") || "{}");
    const domain = (user.access_domain || "").toLowerCase();
    const roleId = parseInt(user.role_id, 10) || 0;
    const roleName = (user.role_name || "").toLowerCase();
    const isAdmin = domain === "admin" || roleId === 1 || roleName === "admin";
    const isNurse = domain === "clinical" || roleId === 3 || roleId === 4 || roleName === "nurse" || roleName === "head nurse";
    const isHybrid = domain === "hybrid" || roleId === 6 || roleId === 7 || roleName === "hybrid" || roleName === "head hybrid" || roleName === "ward clerk" || roleName === "head ward clerk";
    const hasClinicalAccess = isAdmin || isNurse || isHybrid;

    let html = '<table class="data-table">';
    html += '<thead><tr>';
    html += '<th>Admission & Date</th>';
    html += '<th>Patient & Bed Location</th>';
    html += '<th>Chief Complaint & Diagnosis</th>';
    html += '<th>Attending Physician(s)</th>';
    html += '</tr></thead><tbody>';

    admissions.slice(0, 5).forEach(a => {
        const bedInfo = a.Bed_Code 
            ? `<div class="table-sub-text"><code>${a.Bed_Code}</code> &bull; ${a.Room_Name} (${a.Room_Type || 'Ward'})</div>` 
            : '<div class="table-sub-text text-muted">Unassigned Bed</div>';

        const actionHref = hasClinicalAccess ? `admission_details.html?id=${a.Admission_ID}` : `invoices.html`;
        const rowTitle = hasClinicalAccess ? `Click row to open clinical chart & ledger` : `Click row to view invoices`;

        html += `<tr class="clickable-row" onclick="window.location.href='${actionHref}'" title="${rowTitle}">`;
        html += `<td>
            <div class="table-primary-text font-bold">ADM-${String(a.Admission_ID).padStart(3, '0')}</div>
            <div class="table-sub-text">${a.Admission_Date}</div>
        </td>`;
        html += `<td>
            <div class="table-primary-text font-bold">${a.Patient_Name}</div>
            <div class="table-sub-text"><code>${a.Patient_Code}</code></div>
            ${bedInfo}
        </td>`;
        html += `<td>
            <div class="table-sub-text-dark font-bold">${a.Chief_Complaint || 'Under Observation'}</div>
            <div class="table-sub-text text-info">Dx: ${a.Diagnosis || 'Pending'}</div>
        </td>`;
        html += `<td>
            <div class="table-sub-text-dark">${a.Assigned_Doctors || 'None Assigned'}</div>
        </td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
};

const renderFloorOccupancyBars = (activeBeds) => {
    const container = document.getElementById('dashboard-floor-occupancy-list');
    if (!container) return;

    if (!activeBeds || activeBeds.length === 0) {
        container.innerHTML = '<span style="font-size: 12px; color: var(--text-muted);">No active hospital beds registered.</span>';
        return;
    }

    const floorsMap = {};
    activeBeds.forEach(b => {
        const floorKey = b.Floor_ID ? String(b.Floor_ID) : "unassigned";
        if (!floorsMap[floorKey]) {
            floorsMap[floorKey] = {
                floorNumber: parseInt(b.Floor_Number, 10) || 99,
                floorName: b.Floor_Name || (b.Floor_Number ? `Floor ${b.Floor_Number}` : "Main Floor"),
                buildingWing: b.Building_Wing || "",
                total: 0,
                occupied: 0,
                vacant: 0
            };
        }
        floorsMap[floorKey].total++;
        if (b.Is_Available == 0) {
            floorsMap[floorKey].occupied++;
        } else {
            floorsMap[floorKey].vacant++;
        }
    });

    const floorsList = Object.values(floorsMap).sort((a, b) => a.floorNumber - b.floorNumber);

    let html = "";
    floorsList.forEach(f => {
        const pct = f.total > 0 ? Math.round((f.occupied / f.total) * 100) : 0;
        const colorClass = pct >= 90 ? "high" : (pct >= 65 ? "medium" : "low");
        const badgeColor = pct >= 90 ? "#dc2626" : (pct >= 65 ? "#d97706" : "#16a34a");

        html += `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <div>
                        <strong style="font-size: 12px; color: #1e293b;">${f.floorName}</strong>
                        ${f.buildingWing ? `<span style="font-size: 11px; color: #64748b; margin-left: 5px;">(${f.buildingWing})</span>` : ''}
                    </div>
                    <div style="font-size: 11px; font-weight: 700; color: ${badgeColor};">
                        ${pct}% Occupied <span style="font-weight: 500; color: #64748b;">(${f.occupied}/${f.total} Beds)</span>
                    </div>
                </div>
                <div class="occupancy-progress-wrap" style="height: 6px;">
                    <div class="occupancy-progress-bar ${colorClass}" style="width: ${pct}%;"></div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
};

const updateBedGauge = (beds) => {
    const activeBeds = (beds || []).filter(b => b.Is_Active == 1);
    const totalBeds = activeBeds.length;
    const occupiedBeds = activeBeds.filter(b => b.Is_Available == 0).length;
    const vacantBeds = activeBeds.filter(b => b.Is_Available == 1).length;
    const occPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    const elTotal = document.getElementById('gauge-total-beds');
    if (elTotal) elTotal.textContent = totalBeds;

    const elOcc = document.getElementById('gauge-occupied-beds');
    if (elOcc) elOcc.textContent = occupiedBeds;

    const elVac = document.getElementById('gauge-vacant-beds');
    if (elVac) elVac.textContent = vacantBeds;

    const elSummary = document.getElementById('occupancy-summary-text');
    if (elSummary) elSummary.textContent = `${occupiedBeds} of ${totalBeds} Beds in Active Use`;

    const elBadge = document.getElementById('occupancy-rate-badge');
    if (elBadge) {
        elBadge.textContent = `${occPct}% Occupied`;
        elBadge.className = (occPct >= 90 ? 'badge badge-danger' : (occPct >= 70 ? 'badge badge-warning' : 'badge badge-success')) + ' dash-header-badge';
    }

    const progressBar = document.getElementById('occupancy-progress-bar');
    if (progressBar) {
        progressBar.style.width = `${occPct}%`;
        progressBar.className = 'occupancy-progress-bar ' + (occPct >= 90 ? 'high' : (occPct >= 70 ? 'medium' : 'low'));
    }

    renderFloorOccupancyBars(activeBeds);
};

const updateFinancialHealth = (invoices) => {
    const invList = invoices || [];
    const totalInvoiced = invList.reduce((sum, inv) => sum + parseFloat(inv.Net_Amount_Due || 0), 0);
    const totalCollected = invList.reduce((sum, inv) => sum + parseFloat(inv.Amount_Paid || 0), 0);
    const totalAR = invList.reduce((sum, inv) => sum + parseFloat(inv.Remaining_Balance || 0), 0);

    const activePNs = invList.filter(inv => inv.Promissory_Note_ID && inv.Promissory_Status === 'Active' && parseFloat(inv.Remaining_Balance || 0) > 0);
    const pnCount = activePNs.length;
    const pnBal = activePNs.reduce((sum, inv) => sum + parseFloat(inv.Remaining_Balance || 0), 0);

    const todayStr = new Date().toISOString().slice(0, 10);
    const overduePNs = activePNs.filter(inv => inv.Promissory_Next_Due_Date && inv.Promissory_Next_Due_Date < todayStr);

    const elCollections = document.getElementById('stat-total-collections');
    if (elCollections) elCollections.textContent = `₱${totalCollected.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

    const elAR = document.getElementById('stat-total-ar');
    if (elAR) elAR.textContent = `₱${totalAR.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

    const elInvoiced = document.getElementById('health-invoiced-total');
    if (elInvoiced) elInvoiced.textContent = `₱${totalInvoiced.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

    const elHealthCollected = document.getElementById('health-collected-total');
    if (elHealthCollected) elHealthCollected.textContent = `₱${totalCollected.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

    const elHealthAR = document.getElementById('health-ar-total');
    if (elHealthAR) elHealthAR.textContent = `₱${totalAR.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

    const elPNCount = document.getElementById('health-pn-count');
    if (elPNCount) elPNCount.textContent = `${pnCount} Note${pnCount === 1 ? '' : 's'}`;

    const elStatusBadge = document.getElementById('ar-status-badge');
    if (elStatusBadge) {
        if (totalAR <= 0) {
            elStatusBadge.className = 'badge badge-success dash-header-badge';
            elStatusBadge.textContent = '100% Settled';
        } else if (overduePNs.length > 0) {
            elStatusBadge.className = 'badge badge-danger dash-header-badge';
            elStatusBadge.textContent = `${overduePNs.length} Overdue`;
        } else {
            elStatusBadge.className = 'badge badge-warning dash-header-badge';
            elStatusBadge.textContent = `${pnCount} Active PN`;
        }
    }

    const alertBanner = document.getElementById('ar-alert-banner');
    const alertText = document.getElementById('ar-alert-text');
    if (alertBanner && alertText) {
        if (overduePNs.length > 0) {
            alertBanner.className = 'ar-alert-banner has-overdue';
            alertText.innerHTML = `<strong>Attention Required:</strong> ${overduePNs.length} Promissory Note payment${overduePNs.length === 1 ? ' is' : 's are'} past due. Outstanding balance: ₱${pnBal.toLocaleString('en-PH', {minimumFractionDigits: 2})}.`;
        } else if (pnCount > 0) {
            alertBanner.className = 'ar-alert-banner';
            alertText.innerHTML = `<strong>Active Agreements:</strong> ${pnCount} patient installment plan${pnCount === 1 ? '' : 's'} active with ₱${pnBal.toLocaleString('en-PH', {minimumFractionDigits: 2})} scheduled balance.`;
        } else if (totalAR > 0) {
            alertBanner.className = 'ar-alert-banner';
            alertText.innerHTML = `<strong>Unsettled Invoices:</strong> Outstanding receivables total ₱${totalAR.toLocaleString('en-PH', {minimumFractionDigits: 2})}.`;
        } else {
            alertBanner.className = 'ar-alert-banner';
            alertBanner.style.background = '#f0fdf4';
            alertBanner.style.borderColor = '#bbf7d0';
            alertBanner.style.color = '#166534';
            alertText.innerHTML = `<strong>Healthy Cash Flow:</strong> All issued hospitalization invoices have been settled in full.`;
        }
    }
};

const renderTrendLineGraph = (ledgerRecords, collRecords) => {
    const lineContainer = document.getElementById('dash-trend-line-chart');
    if (!lineContainer) return;

    const dailyMap = {};
    (ledgerRecords || []).forEach(r => {
        const rawDate = (r.Formatted_Date || '').slice(0, 10);
        if (!rawDate) return;
        if (!dailyMap[rawDate]) {
            dailyMap[rawDate] = { date: rawDate, charges: 0, collections: 0 };
        }
        dailyMap[rawDate].charges += parseFloat(r.Total_Charge || 0);
    });

    (collRecords || []).forEach(c => {
        const rawDate = (c.Raw_Payment_Date || c.Payment_Date || '').slice(0, 10);
        if (!rawDate) return;
        if (!dailyMap[rawDate]) {
            dailyMap[rawDate] = { date: rawDate, charges: 0, collections: 0 };
        }
        dailyMap[rawDate].collections += parseFloat(c.Amount_Paid || 0);
    });

    const sortedDays = Object.values(dailyMap)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-6);

    if (sortedDays.length === 0) {
        lineContainer.innerHTML = '<span class="dash-muted-note">No chronological trend data recorded yet.</span>';
        return;
    }

    const svgW = 540;
    const svgH = 164;
    const padL = 48;
    const padR = 22;
    const padT = 22;
    const padB = 28;
    const innerPadX = 22;
    const plotW = svgW - padL - padR;
    const usableW = plotW - innerPadX * 2;
    const plotH = svgH - padT - padB;

    const rawMax = Math.max(
        ...sortedDays.map(d => Math.max(0, d.charges, d.collections)),
        1000
    );
    const maxVal = Math.ceil(rawMax / 500) * 500;

    const stepX = sortedDays.length > 1 ? usableW / (sortedDays.length - 1) : 0;

    const getCoords = (key) => sortedDays.map((d, idx) => {
        const val = Math.max(0, d[key] || 0);
        const x = sortedDays.length > 1 ? padL + innerPadX + idx * stepX : padL + plotW / 2;
        const y = padT + plotH - (val / maxVal) * plotH;
        return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, val, date: d.date };
    });

    const collPts = getCoords('collections');
    const chgPts = getCoords('charges');

    const buildSmoothPath = (pts) => {
        if (pts.length === 0) return '';
        if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i];
            const p1 = pts[i + 1];
            const cpx = Math.round(((p0.x + p1.x) / 2) * 10) / 10;
            d += ` C ${cpx} ${p0.y}, ${cpx} ${p1.y}, ${p1.x} ${p1.y}`;
        }
        return d;
    };

    const collPathD = buildSmoothPath(collPts);
    const chgPathD = buildSmoothPath(chgPts);

    const firstX = collPts[0].x;
    const lastX = collPts[collPts.length - 1].x;
    const baseY = padT + plotH;
    const collAreaD = `${collPathD} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;

    const midVal = maxVal / 2;
    const yTop = padT;
    const yMid = padT + plotH / 2;
    const yBot = baseY;

    let nodesHtml = '';
    collPts.forEach((p, idx) => {
        const chgP = chgPts[idx];
        const dateLabel = formatShortMonthDay(p.date);
        const tipColl = `${dateLabel} — Collections: ₱${p.val.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
        const tipChg = `${dateLabel} — Charges: ₱${chgP.val.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
        const topVal = Math.max(p.val, chgP.val);
        const topY = Math.min(p.y, chgP.y);

        nodesHtml += `
            <line x1="${p.x}" y1="${yTop}" x2="${p.x}" y2="${yBot}" class="line-grid-vert"></line>
            <text x="${p.x}" y="${svgH - 7}" text-anchor="middle" class="line-date-text">${dateLabel}</text>
            <g class="line-chart-node" style="--pt-idx: ${idx};">
                <title>${tipChg}</title>
                <circle cx="${chgP.x}" cy="${chgP.y}" r="4" fill="#ffffff" stroke="#16a34a" stroke-width="2.2"></circle>
            </g>
            <g class="line-chart-node" style="--pt-idx: ${idx};">
                <title>${tipColl}</title>
                <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#0284c7" stroke="#ffffff" stroke-width="1.8"></circle>
            </g>
            <text x="${p.x}" y="${Math.max(13, topY - 8)}" text-anchor="middle" class="line-val-tag">${formatCompactPeso(topVal)}</text>
        `;
    });

    lineContainer.innerHTML = `
        <svg class="line-chart-svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="dashLineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#0284c7" stop-opacity="0.65"></stop>
                    <stop offset="100%" stop-color="#0284c7" stop-opacity="0.0"></stop>
                </linearGradient>
            </defs>
            <line x1="${padL}" y1="${yTop}" x2="${svgW - padR}" y2="${yTop}" class="line-grid-dash"></line>
            <line x1="${padL}" y1="${yMid}" x2="${svgW - padR}" y2="${yMid}" class="line-grid-dash"></line>
            <line x1="${padL}" y1="${yBot}" x2="${svgW - padR}" y2="${yBot}" stroke="#cbd5e1" stroke-width="1.2"></line>

            <text x="${padL - 8}" y="${yTop + 3.5}" text-anchor="end" class="line-axis-text">${formatCompactPeso(maxVal)}</text>
            <text x="${padL - 8}" y="${yMid + 3.5}" text-anchor="end" class="line-axis-text">${formatCompactPeso(midVal)}</text>
            <text x="${padL - 8}" y="${yBot + 3.5}" text-anchor="end" class="line-axis-text">₱0</text>

            <path d="${collAreaD}" fill="url(#dashLineAreaGrad)" class="line-chart-area"></path>
            <path d="${chgPathD}" stroke="#16a34a" pathLength="1000" class="line-chart-path"></path>
            <path d="${collPathD}" stroke="#0284c7" pathLength="1000" class="line-chart-path"></path>
            ${nodesHtml}
        </svg>
    `;
};

const renderDashboardCharts = (deptData, collData, invoices) => {
    const deptSummary = (deptData && deptData.summary) ? deptData.summary : {};
    const stations = Array.isArray(deptSummary.by_station) ? deptSummary.by_station : [];
    const ledgerRecords = (deptData && Array.isArray(deptData.records)) ? deptData.records : [];
    const collRecords = (collData && Array.isArray(collData.records)) ? collData.records : [];
    const grandNet = parseFloat(deptSummary.grand_net || 0);
    const grandTx = parseInt(deptSummary.grand_transactions || 0, 10);

    const elNetBadge = document.getElementById('charts-net-revenue-badge');
    if (elNetBadge) {
        elNetBadge.textContent = `Net Revenue: ₱${grandNet.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
    }
    const elTxBadge = document.getElementById('charts-tx-count-badge');
    if (elTxBadge) {
        elTxBadge.textContent = `${grandTx} Ledger Entries`;
    }

    const vbarContainer = document.getElementById('dash-dept-bar-chart');
    if (vbarContainer) {
        const sortedStations = [...stations].sort((a, b) => parseFloat(b.Net_Revenue || 0) - parseFloat(a.Net_Revenue || 0)).slice(0, 6);
        const maxRev = Math.max(...sortedStations.map(s => parseFloat(s.Net_Revenue || 0)), 1);
        const palette = ['#0284c7', '#0d9488', '#6366f1', '#16a34a', '#d97706', '#8b5cf6'];

        if (sortedStations.length === 0) {
            vbarContainer.innerHTML = '<span class="dash-muted-note">No station revenue data available.</span>';
        } else {
            let colsHtml = '<div class="vbar-columns-wrap">';
            sortedStations.forEach((st, idx) => {
                const rev = parseFloat(st.Net_Revenue || 0);
                const txCount = parseInt(st.Total_Transactions || 0, 10);
                const rawPct = maxRev > 0 ? Math.round((rev / maxRev) * 100) : 0;
                const barHeight = rev > 0 ? Math.max(10, rawPct) : 4;
                const color = palette[idx % palette.length];
                const shortName = (st.Station_Name || '').replace(' Station', '').replace(' Department', '');
                const tooltip = `${st.Station_Name} (${st.Code_Prefix}): ₱${rev.toLocaleString('en-PH', { minimumFractionDigits: 2 })} (${txCount} transactions)`;

                colsHtml += `
                    <div class="vbar-col" title="${tooltip}">
                        <div class="vbar-val" style="--bar-idx: ${idx};">${formatCompactPeso(rev)}</div>
                        <div class="vbar-track">
                            <div class="vbar-fill" style="--target-h: ${barHeight}%; --bar-color: ${color}; --bar-idx: ${idx};"></div>
                        </div>
                        <div class="vbar-code">${st.Code_Prefix || 'DEPT'}</div>
                        <div class="vbar-name">${shortName}</div>
                    </div>
                `;
            });
            colsHtml += '</div>';
            vbarContainer.innerHTML = colsHtml;
        }
    }

    renderTrendLineGraph(ledgerRecords, collRecords);

    const catContainer = document.getElementById('dash-category-bars');
    if (catContainer) {
        const catTotals = {
            'Board & Lodging': { label: 'Room & Lodging', amount: 0, color: '#0284c7' },
            'Equipment Scan': { label: 'Imaging & Scans', amount: 0, color: '#0d9488' },
            'Doctor Round': { label: 'Physician Rounds', amount: 0, color: '#6366f1' },
            'Medicine': { label: 'Pharmacy Meds', amount: 0, color: '#16a34a' },
            'Service': { label: 'Clinical Services', amount: 0, color: '#f59e0b' }
        };

        ledgerRecords.forEach(r => {
            const catKey = r.Item_Category || 'Service';
            const amt = parseFloat(r.Total_Charge || 0);
            if (catTotals[catKey]) {
                catTotals[catKey].amount += amt;
            } else {
                catTotals['Service'].amount += amt;
            }
        });

        const catList = Object.values(catTotals).sort((a, b) => b.amount - a.amount);
        const totalCatRev = Math.max(catList.reduce((acc, c) => acc + Math.max(0, c.amount), 0), 1);

        let catHtml = '';
        catList.forEach((c, idx) => {
            const cleanAmt = Math.max(0, c.amount);
            const sharePct = grandNet > 0 ? Math.round((cleanAmt / totalCatRev) * 100) : 0;
            const widthPct = cleanAmt > 0 ? Math.max(4, sharePct) : 0;
            catHtml += `
                <div class="hbar-item">
                    <div class="hbar-top">
                        <span class="hbar-label">
                            <span class="hbar-dot" style="background: ${c.color};"></span>
                            ${c.label}
                        </span>
                        <span class="hbar-meta">
                            ₱${cleanAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            <span class="hbar-pct">(${sharePct}%)</span>
                        </span>
                    </div>
                    <div class="hbar-track">
                        <div class="hbar-fill" style="--target-w: ${widthPct}%; --bar-color: ${c.color}; --bar-idx: ${idx};"></div>
                    </div>
                </div>
            `;
        });
        catContainer.innerHTML = catHtml;
    }

    const mixContainer = document.getElementById('dash-settlement-chart');
    if (mixContainer) {
        const collSummary = (collData && collData.summary) ? collData.summary : {};
        const settlementAmt = parseFloat(collSummary.settlement_total || 0);
        const advanceAmt = parseFloat(collSummary.advance_total || 0);
        const methods = Array.isArray(collSummary.by_method) ? collSummary.by_method : [];
        const invList = invoices || [];
        const arAmt = invList.reduce((sum, inv) => sum + parseFloat(inv.Remaining_Balance || 0), 0);

        const totalCollected = settlementAmt + advanceAmt;
        const mixTotal = Math.max(totalCollected + arAmt, 1);
        const collectedPct = (totalCollected + arAmt) > 0 ? Math.round((totalCollected / mixTotal) * 100) : 100;

        const r = 38;
        const circ = 2 * Math.PI * r;
        const seg1 = (settlementAmt / mixTotal) * circ;
        const seg2 = (advanceAmt / mixTotal) * circ;
        const seg3 = (arAmt / mixTotal) * circ;

        const offset1 = 0;
        const offset2 = -seg1;
        const offset3 = -(seg1 + seg2);

        const maxMethodAmt = Math.max(...methods.map(m => parseFloat(m.Total_Amount || 0)), 1);
        let methodsHtml = '';
        methods.slice(0, 3).forEach((m, idx) => {
            const mAmt = parseFloat(m.Total_Amount || 0);
            const mPct = Math.max(5, Math.round((mAmt / maxMethodAmt) * 100));
            methodsHtml += `
                <div class="method-mini-row">
                    <span class="method-mini-name" title="${m.Method_Name}">${m.Method_Name}</span>
                    <div class="method-mini-bar-wrap">
                        <div class="method-mini-bar-fill" style="--target-w: ${mPct}%; --bar-idx: ${idx};"></div>
                    </div>
                    <span class="method-mini-amt">${formatCompactPeso(mAmt)}</span>
                </div>
            `;
        });
        if (!methodsHtml) {
            methodsHtml = '<span class="dash-muted-note">No payments recorded yet.</span>';
        }

        mixContainer.innerHTML = `
            <div class="donut-summary-row">
                <div class="donut-svg-wrap">
                    <svg width="90" height="90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="${r}" fill="transparent" stroke="#f1f5f9" stroke-width="12"></circle>
                        <circle class="donut-seg" cx="50" cy="50" r="${r}" fill="transparent" stroke="#16a34a" stroke-width="12"
                            stroke-dasharray="${seg1} ${circ}" stroke-dashoffset="${offset1}" transform="rotate(-90 50 50)"></circle>
                        <circle class="donut-seg" cx="50" cy="50" r="${r}" fill="transparent" stroke="#0284c7" stroke-width="12"
                            stroke-dasharray="${seg2} ${circ}" stroke-dashoffset="${offset2}" transform="rotate(-90 50 50)"></circle>
                        <circle class="donut-seg" cx="50" cy="50" r="${r}" fill="transparent" stroke="#6366f1" stroke-width="12"
                            stroke-dasharray="${seg3} ${circ}" stroke-dashoffset="${offset3}" transform="rotate(-90 50 50)"></circle>
                    </svg>
                    <div class="donut-center-label">
                        <span class="donut-center-pct">${collectedPct}%</span>
                        <span class="donut-center-sub">Collected</span>
                    </div>
                </div>
                <div class="donut-legend">
                    <div class="donut-legend-item">
                        <span class="donut-legend-left"><span class="hbar-dot" style="background: #16a34a;"></span>Final SOA Paid</span>
                        <span class="donut-legend-val">${formatCompactPeso(settlementAmt)}</span>
                    </div>
                    <div class="donut-legend-item">
                        <span class="donut-legend-left"><span class="hbar-dot" style="background: #0284c7;"></span>Advance Deposits</span>
                        <span class="donut-legend-val">${formatCompactPeso(advanceAmt)}</span>
                    </div>
                    <div class="donut-legend-item">
                        <span class="donut-legend-left"><span class="hbar-dot" style="background: #6366f1;"></span>Outstanding AR</span>
                        <span class="donut-legend-val">${formatCompactPeso(arAmt)}</span>
                    </div>
                </div>
            </div>
            <div class="method-mini-section">
                <div class="method-mini-heading">Top Collection Channels</div>
                <div class="method-mini-list">
                    ${methodsHtml}
                </div>
            </div>
        `;
    }

    if (currentDashSlide === 3) {
        triggerChartsGrowAnimation();
    }
};

const updatePulseCards = (allAdmissions, allBeds, invoices, deptData, collData) => {
    const admList = Array.isArray(allAdmissions) ? allAdmissions : [];
    const activeAdmissions = admList.filter(a => a.Status === 'Admitted');
    const dischargedUnbilled = admList.filter(a => a.Status === 'Discharged');
    const todayYmd = new Date().toISOString().slice(0, 10);

    const activeCount = activeAdmissions.length;
    const diagnosedCount = activeAdmissions.filter(a => a.Diagnosis && a.Diagnosis.trim() !== '').length;
    const pendingDxCount = activeCount - diagnosedCount;
    const dxPct = activeCount > 0 ? Math.round((diagnosedCount / activeCount) * 100) : 100;
    const admittedToday = activeAdmissions.filter(a => (a.Admission_Date || '').slice(0, 10) === todayYmd).length;
    const withDoctorsCount = activeAdmissions.filter(a => a.Assigned_Doctors && a.Assigned_Doctors.trim() !== '').length;

    const elAdm = document.getElementById('stat-active-admissions');
    if (elAdm) elAdm.textContent = activeCount;

    const elClinBadge = document.getElementById('pulse-clinical-badge');
    if (elClinBadge) {
        if (activeCount === 0) {
            elClinBadge.className = 'pulse-status-pill pill-neutral';
            elClinBadge.textContent = 'No Census';
        } else if (pendingDxCount > 0) {
            elClinBadge.className = 'pulse-status-pill pill-warning';
            elClinBadge.textContent = `${pendingDxCount} Pending Dx`;
        } else {
            elClinBadge.className = 'pulse-status-pill pill-success';
            elClinBadge.textContent = '100% Diagnosed';
        }
    }

    const elClinBar = document.getElementById('pulse-clinical-bar');
    if (elClinBar) {
        elClinBar.style.setProperty('--pulse-w', `${dxPct}%`);
    }

    const elClinMeta = document.getElementById('pulse-clinical-meta');
    if (elClinMeta) {
        elClinMeta.textContent = `${diagnosedCount} of ${activeCount} patients diagnosed`;
    }

    const userJson = sessionStorage.getItem("hospital_user");
    const user = userJson ? JSON.parse(userJson) : {};
    const roleName = (user.role_name || "").toLowerCase();
    const isDoctor = roleName === "doctor" || !!user.doctor_id;

    if (isDoctor) {
        const elLabel = document.querySelector('#pulse-card-clinical .pulse-card-label');
        if (elLabel) elLabel.textContent = 'My Active In-Patients';
        if (elClinMeta) {
            elClinMeta.textContent = `${diagnosedCount} of ${activeCount} assigned patients diagnosed`;
        }
    }

    const bedList = Array.isArray(allBeds) ? allBeds : [];
    const activeBeds = bedList.filter(b => b.Is_Active == 1);
    const totalBeds = activeBeds.length;
    const vacantBeds = activeBeds.filter(b => b.Is_Available == 1);
    const vacantCount = vacantBeds.length;
    const occupiedCount = totalBeds - vacantCount;
    const occPct = totalBeds > 0 ? Math.round((occupiedCount / totalBeds) * 100) : 0;

    const elBeds = document.getElementById('stat-available-beds');
    if (elBeds) elBeds.textContent = vacantCount;

    const elCapBadge = document.getElementById('pulse-capacity-badge');
    if (elCapBadge) {
        if (occPct >= 90) {
            elCapBadge.className = 'pulse-status-pill pill-danger';
            elCapBadge.textContent = `${occPct}% Critical`;
        } else if (occPct >= 70) {
            elCapBadge.className = 'pulse-status-pill pill-warning';
            elCapBadge.textContent = `${occPct}% High Load`;
        } else {
            elCapBadge.className = 'pulse-status-pill pill-success';
            elCapBadge.textContent = `${occPct}% Occupied`;
        }
    }

    const elCapBar = document.getElementById('pulse-capacity-bar');
    if (elCapBar) {
        elCapBar.style.setProperty('--pulse-w', `${occPct}%`);
        elCapBar.className = 'pulse-progress-fill fill-capacity' + (occPct >= 90 ? ' crit' : (occPct >= 70 ? ' warn' : ''));
    }

    const elCapMeta = document.getElementById('pulse-capacity-meta');
    if (elCapMeta) {
        elCapMeta.textContent = `${occupiedCount} occupied of ${totalBeds} active beds`;
    }

    const invList = Array.isArray(invoices) ? invoices : [];
    const totalInvoiced = invList.reduce((sum, inv) => sum + parseFloat(inv.Net_Amount_Due || 0), 0);
    const totalAR = invList.reduce((sum, inv) => sum + parseFloat(inv.Remaining_Balance || 0), 0);
    const activePNs = invList.filter(inv => inv.Promissory_Note_ID && inv.Promissory_Status === 'Active' && parseFloat(inv.Remaining_Balance || 0) > 0);
    const overduePNs = activePNs.filter(inv => inv.Promissory_Next_Due_Date && inv.Promissory_Next_Due_Date < todayYmd);
    const openSoaCount = invList.filter(inv => parseFloat(inv.Remaining_Balance || 0) > 0).length;
    const unbilledCount = dischargedUnbilled.length;

    const elAR = document.getElementById('stat-total-ar');
    if (elAR) {
        elAR.textContent = `₱${totalAR.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
    }

    const elClearBadge = document.getElementById('pulse-clearance-badge');
    if (elClearBadge) {
        if (overduePNs.length > 0) {
            elClearBadge.className = 'pulse-status-pill pill-warning';
            elClearBadge.textContent = `${overduePNs.length} Overdue PN`;
        } else if (unbilledCount > 0) {
            elClearBadge.className = 'pulse-status-pill pill-info';
            elClearBadge.textContent = `${unbilledCount} Pending SOA`;
        } else if (totalAR > 0) {
            elClearBadge.className = 'pulse-status-pill pill-info';
            elClearBadge.textContent = `${openSoaCount} Open SOA`;
        } else {
            elClearBadge.className = 'pulse-status-pill pill-success';
            elClearBadge.textContent = '100% Cleared';
        }
    }

    const elClearBar = document.getElementById('pulse-clearance-bar');
    if (elClearBar) {
        if (totalAR <= 0) {
            elClearBar.className = 'pulse-progress-fill fill-clearance healthy';
            elClearBar.style.setProperty('--pulse-w', '100%');
        } else {
            const arSharePct = totalInvoiced > 0 ? Math.min(100, Math.max(8, Math.round((totalAR / totalInvoiced) * 100))) : 50;
            elClearBar.className = 'pulse-progress-fill fill-clearance';
            elClearBar.style.setProperty('--pulse-w', `${arSharePct}%`);
        }
    }

    const elClearMeta = document.getElementById('pulse-clearance-meta');
    if (elClearMeta) {
        elClearMeta.textContent = unbilledCount > 0
            ? `${unbilledCount} discharged awaiting SOA`
            : `${activePNs.length} active promissory note${activePNs.length === 1 ? '' : 's'}`;
    }

    const collSummary = (collData && collData.summary) ? collData.summary : {};
    const settlementAmt = parseFloat(collSummary.settlement_total || 0);
    const advanceAmt = parseFloat(collSummary.advance_total || 0);
    const totalCashierColl = parseFloat(collSummary.total_collections || 0) || (settlementAmt + advanceAmt);
    const invoiceCollected = invList.reduce((sum, inv) => sum + parseFloat(inv.Amount_Paid || 0), 0);
    const displayCollections = totalCashierColl > 0 ? totalCashierColl : invoiceCollected;

    const mixDenom = Math.max(displayCollections + totalAR, 1);
    const efficiencyPct = (displayCollections + totalAR) > 0 ? Math.min(100, Math.round((displayCollections / mixDenom) * 100)) : 100;

    const elColl = document.getElementById('stat-total-collections');
    if (elColl) {
        elColl.textContent = `₱${displayCollections.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
    }

    const elRevBadge = document.getElementById('pulse-revenue-badge');
    if (elRevBadge) {
        if (efficiencyPct >= 80) {
            elRevBadge.className = 'pulse-status-pill pill-success';
        } else if (efficiencyPct >= 50) {
            elRevBadge.className = 'pulse-status-pill pill-info';
        } else {
            elRevBadge.className = 'pulse-status-pill pill-warning';
        }
        elRevBadge.textContent = `${efficiencyPct}% Rate`;
    }

    const elRevBar = document.getElementById('pulse-revenue-bar');
    if (elRevBar) {
        elRevBar.style.setProperty('--pulse-w', `${efficiencyPct}%`);
    }

    const elRevMeta = document.getElementById('pulse-revenue-meta');
    if (elRevMeta) {
        elRevMeta.textContent = `${formatCompactPeso(advanceAmt)} in advance deposits`;
    }
};

const loadDashboardMetrics = async () => {
    try {
        const userJson = sessionStorage.getItem("hospital_user");
        const user = userJson ? JSON.parse(userJson) : {};
        const roleName = (user.role_name || "").toLowerCase();
        const isDoctor = roleName === "doctor" || !!user.doctor_id;

        const admPayload = { status: 'all' };
        if (isDoctor) {
            admPayload.doctor_id = user.doctor_id;
            admPayload.user_id = user.user_id;
        }

        const admForm = new FormData();
        admForm.append('operation', 'getAllAdmissions');
        admForm.append('json', JSON.stringify(admPayload));
        const admPromise = axios.post(`${getApiUrl}/admissions.php`, admForm);

        const bedForm = new FormData();
        bedForm.append('operation', 'getAllBeds');
        const bedPromise = axios.post(`${getApiUrl}/rooms.php`, bedForm);

        const invForm = new FormData();
        invForm.append('operation', 'getAllInvoices');
        const invPromise = axios.post(`${getApiUrl}/invoices.php`, invForm);

        const deptPromise = axios.get(`${getApiUrl}/reports.php?action=department_revenue`).catch(() => ({ data: null }));
        const collPromise = axios.get(`${getApiUrl}/reports.php?action=collections`).catch(() => ({ data: null }));

        let docPromise = Promise.resolve({ data: {} });
        if (isDoctor) {
            const docForm = new FormData();
            docForm.append('operation', 'getDoctorDashboardMetrics');
            docForm.append('json', JSON.stringify({ doctor_id: user.doctor_id, user_id: user.user_id }));
            docPromise = axios.post(`${getApiUrl}/clinical_orders.php`, docForm).catch(() => ({ data: {} }));
        }

        const [admRes, bedRes, invRes, deptRes, collRes, docRes] = await Promise.all([
            admPromise,
            bedPromise,
            invPromise,
            deptPromise,
            collPromise,
            docPromise
        ]);

        const allAdmissions = Array.isArray(admRes.data) ? admRes.data : [];
        const activeAdmissions = allAdmissions.filter(a => a.Status === 'Admitted');
        const allBeds = bedRes.data || [];
        const invoices = invRes.data || [];

        renderRecentAdmissions(activeAdmissions);
        updateBedGauge(allBeds);
        updateFinancialHealth(invoices);
        renderDashboardCharts(deptRes.data, collRes.data, invoices);
        updatePulseCards(allAdmissions, allBeds, invoices, deptRes.data, collRes.data);

        if (isDoctor && docRes && docRes.data) {
            const docData = docRes.data;
            const statDocOrders = document.getElementById('stat-doc-pending-orders');
            if (statDocOrders) statDocOrders.textContent = docData.pending_orders || 0;
            const badgeDocOrders = document.getElementById('pulse-doc-orders-badge');
            if (badgeDocOrders) {
                badgeDocOrders.textContent = `${docData.pending_orders || 0} Pending`;
                badgeDocOrders.className = `pulse-status-pill ${docData.pending_orders > 0 ? 'pill-warning' : 'pill-success'}`;
            }
            const metaDocOrders = document.getElementById('pulse-doc-orders-meta');
            if (metaDocOrders) {
                metaDocOrders.textContent = `${docData.orders_in_prep || 0} in prep, ${docData.orders_in_transit || 0} in transit`;
            }
            const barDocOrders = document.getElementById('pulse-doc-orders-bar');
            if (barDocOrders) {
                barDocOrders.style.setProperty('--pulse-w', docData.pending_orders > 0 ? '100%' : '0%');
            }

            const statDocRounds = document.getElementById('stat-doc-today-rounds');
            if (statDocRounds) statDocRounds.textContent = docData.today_rounds || 0;
            const metaDocRounds = document.getElementById('pulse-doc-rounds-meta');
            if (metaDocRounds) {
                metaDocRounds.textContent = `${docData.today_rounds || 0} bedside visits logged today`;
            }
            const barDocRounds = document.getElementById('pulse-doc-rounds-bar');
            if (barDocRounds) {
                barDocRounds.style.setProperty('--pulse-w', docData.today_rounds > 0 ? '100%' : '0%');
            }
        }

    } catch (err) {
        console.error("dashboard.js: Error fetching KPI metrics:", err);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const userJson = sessionStorage.getItem("hospital_user");
    if (!userJson) {
        window.location.href = "login.html";
        return;
    }

    const user = JSON.parse(userJson);
    const userDisplay = document.getElementById("user-display");
    if (userDisplay) {
        userDisplay.textContent = `${user.full_name || user.username} (${user.role_name || 'Staff'})`;
    }

    const domain = (user.access_domain || "").toLowerCase();
    const roleId = parseInt(user.role_id, 10) || 0;
    const roleName = (user.role_name || "").toLowerCase();
    const isAdmin = domain === "admin" || roleId === 1 || roleName === "admin";
    const isNurse = domain === "clinical" || roleId === 3 || roleId === 4 || roleName === "nurse" || roleName === "head nurse";
    const isHybrid = domain === "hybrid" || roleId === 6 || roleId === 7 || roleName === "hybrid" || roleName === "head hybrid" || roleName === "ward clerk" || roleName === "head ward clerk";
    const isFinance = domain === "finance" || roleId === 2 || roleId === 5 || roleName === "finance staff" || roleName === "head finance";
    const hasClinicalAccess = isAdmin || isNurse || isHybrid;
    const hasFinanceAccess = isAdmin || isFinance || isHybrid;
    const isDoctor = roleName === "doctor" || !!user.doctor_id;

    if (isDoctor) {
        totalDashSlides = 2;
        const pageHeaderTitle = document.querySelector(".page-title h2");
        if (pageHeaderTitle) pageHeaderTitle.textContent = "Physician Clinical Dashboard";
        const pageHeaderSub = document.querySelector(".page-title p");
        if (pageHeaderSub) pageHeaderSub.textContent = "Overview of your assigned in-patients, clinical orders, and ward census.";

        const quickActionBtn = document.querySelector(".page-header a.btn-primary");
        if (quickActionBtn) {
            quickActionBtn.href = "admissions.html";
            quickActionBtn.textContent = "My In-Patients Roster";
        }

        const slide0Title = document.querySelector("#dash-slide-0 .dash-card-title");
        if (slide0Title) slide0Title.textContent = "My Assigned In-Patients";

        const viewAllAdm = document.querySelector("#dash-slide-0 .card-header a.btn-outline");
        if (viewAllAdm) {
            viewAllAdm.href = "admissions.html";
            viewAllAdm.textContent = "View My In-Patients »";
        }

        const cardClearance = document.getElementById('pulse-card-clearance');
        if (cardClearance) cardClearance.classList.add('dept-tab-pane-hidden');
        const cardRevenue = document.getElementById('pulse-card-revenue');
        if (cardRevenue) cardRevenue.classList.add('dept-tab-pane-hidden');

        const cardDocOrders = document.getElementById('pulse-card-doc-orders');
        if (cardDocOrders) cardDocOrders.classList.remove('dept-tab-pane-hidden');
        const cardDocRounds = document.getElementById('pulse-card-doc-rounds');
        if (cardDocRounds) cardDocRounds.classList.remove('dept-tab-pane-hidden');
    } else if (user.station_id && !isAdmin && !isFinance) {
        totalDashSlides = 2;
        const pageHeaderTitle = document.querySelector(".page-title h2");
        if (pageHeaderTitle) pageHeaderTitle.textContent = "Department Clinical Dashboard";
        const pageHeaderSub = document.querySelector(".page-title p");
        if (pageHeaderSub) pageHeaderSub.textContent = `Live clinical order fulfillment queue for ${user.station_name || 'Department'}.`;

        const quickActionBtn = document.querySelector(".page-header a.btn-primary");
        if (quickActionBtn) {
            quickActionBtn.href = "department_orders.html";
            quickActionBtn.textContent = "Open Fulfillment Queue »";
        }

        const cardClearance = document.getElementById('pulse-card-clearance');
        if (cardClearance) cardClearance.classList.add('dept-tab-pane-hidden');
        const cardRevenue = document.getElementById('pulse-card-revenue');
        if (cardRevenue) cardRevenue.classList.add('dept-tab-pane-hidden');

        const slide0Title = document.querySelector("#dash-slide-0 .dash-card-title");
        if (slide0Title) slide0Title.textContent = "Current In-Patient Census";

        const viewAllAdm = document.querySelector("#dash-slide-0 .card-header a.btn-outline");
        if (viewAllAdm) {
            viewAllAdm.href = "department_orders.html";
            viewAllAdm.textContent = "View Department Queue »";
        }
    } else if (!hasClinicalAccess && hasFinanceAccess) {
        const quickActionBtn = document.querySelector(".page-header a.btn-primary");
        if (quickActionBtn) {
            quickActionBtn.href = "invoices.html";
            quickActionBtn.textContent = "+ Invoices & Settlement";
        }
        const viewAllAdm = document.querySelector("#dash-slide-0 .card-header a.btn-outline");
        if (viewAllAdm) {
            viewAllAdm.href = "invoices.html";
            viewAllAdm.textContent = "View Invoices \u00bb";
        }
    }

    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn && !logoutBtn.dataset.wired) {
        logoutBtn.dataset.wired = "true";
        logoutBtn.addEventListener("click", () => {
            showPopupConfirm("Are you sure you want to log out of your active session?", () => {
                if (typeof handleUserLogout === "function") {
                    handleUserLogout();
                } else {
                    sessionStorage.removeItem("hospital_user");
                    window.location.href = "login.html";
                }
            }, null, {
                title: "Confirm Logout",
                confirmText: "Logout",
                type: "warning"
            });
        });
    }

    loadDashboardMetrics();
    initRefreshBtn("btnRefreshDashboard", loadDashboardMetrics);
    initDashboardCarousel();
});
