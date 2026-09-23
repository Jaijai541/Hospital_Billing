/**
 * In-Patient Clinical Chart & Live Billing Ledger Controller
 * Milestone 2: Transaction & Clinical Workflow
 */

// Global State
let admissionId = null;
let admissionData = null;
let catalogItems = [];
let assignedDoctors = [];
let availableBedsList = [];
let dispensedMedicinesList = [];
let currentUser = null;
let discountList = [];
let latestSummary = null;

// 1. Initialization
window.addEventListener('DOMContentLoaded', () => {
    console.log("admission_details.js: Initializing Patient Chart...");

    // Check Authentication
    const userJson = sessionStorage.getItem("hospital_user");
    if (!userJson) {
        console.warn("admission_details.js: Unauthenticated session. Redirecting to login.");
        window.location.href = "login.html";
        return;
    }

    currentUser = JSON.parse(userJson);
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
        userDisplay.textContent = `${currentUser.full_name || currentUser.username} (${currentUser.role_name || 'Staff'})`;
    }

    // Attach Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            console.log("admission_details.js: Logging out...");
            sessionStorage.removeItem("hospital_user");
            window.location.href = "login.html";
        });
    }

    // Parse Admission ID from URL query string
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get('id');

    if (!idParam || isNaN(idParam)) {
        alert("Invalid or missing Admission ID.");
        window.location.href = "admissions.html";
        return;
    }

    admissionId = parseInt(idParam, 10);
    console.log("admission_details.js: Loaded Admission ID:", admissionId);

    // Setup Clinical Navigation Tabs
    initClinicalTabs();

    // Attach Event Listeners
    document.getElementById('btnSubmitOrder').addEventListener('click', submitDoctorOrder);
    document.getElementById('btnLogRound').addEventListener('click', submitDoctorRound);
    document.getElementById('btnTransferBed').addEventListener('click', submitBedTransfer);
    document.getElementById('btnReturnMedicine').addEventListener('click', submitMedicineReturn);

    // Attach Live Quick Search Filters for Selectors
    const orderDocSearch = document.getElementById('order_doctor_search');
    if (orderDocSearch) orderDocSearch.addEventListener('input', filterOrderDoctors);

    const orderCatSearch = document.getElementById('order_catalog_search');
    if (orderCatSearch) orderCatSearch.addEventListener('input', filterCatalogItems);

    const roundDocSearch = document.getElementById('round_doctor_search');
    if (roundDocSearch) roundDocSearch.addEventListener('input', filterRoundDoctors);

    const transferBedSearch = document.getElementById('transfer_bed_search');
    if (transferBedSearch) transferBedSearch.addEventListener('input', filterAvailableBeds);

    const returnCatSearch = document.getElementById('return_catalog_search');
    if (returnCatSearch) returnCatSearch.addEventListener('input', filterDispensedMedicines);

    // Auto-fill round fee when doctor changes
    document.getElementById('round_doctor_id').addEventListener('change', (e) => {
        const selectedDocId = e.target.value;
        const doc = assignedDoctors.find(d => String(d.Admission_Doctor_ID) === String(selectedDocId));
        if (doc) {
            document.getElementById('round_fee').value = parseFloat(doc.Base_Round_Fee || 0).toFixed(2);
        } else {
            document.getElementById('round_fee').value = '';
        }
    });

    // Initial Load Sequence
    loadAdmissionDetails();
    loadCatalogItems();
    loadOrders();
    loadRounds();
    loadTransfers();
    loadAvailableBeds();
    loadLedger();
    loadLedgerSummary();
    loadDispensedMedicines();
    loadDiscounts();
});

// Tab Controller
function initClinicalTabs() {
    const tabBtns = document.querySelectorAll('.clinical-tabs-nav .tab-btn');
    const tabPanels = document.querySelectorAll('.tab-content-panel');

    function activateTab(tabId) {
        tabBtns.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        tabPanels.forEach(panel => {
            if (panel.id === tabId) {
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        });
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab');
            activateTab(target);
            if (history.replaceState) {
                history.replaceState(null, null, `#${target}`);
            }
        });
    });

    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) {
        activateTab(hash);
    }
}

// 2. Load Patient & Admission Profile Banner
function loadAdmissionDetails() {
    console.log("admission_details.js: Fetching admission profile for ID:", admissionId);

    const formData = new FormData();
    formData.append('operation', 'getAdmissionById');
    formData.append('json', JSON.stringify({ id: admissionId }));

    axios.post('../api/admissions.php', formData)
        .then(response => {
            console.log("admission_details.js: Admission profile received:", response.data);
            if (response.data.error) {
                alert("Error: " + response.data.error);
                window.location.href = "admissions.html";
                return;
            }

            admissionData = response.data;
            assignedDoctors = admissionData.Assigned_Doctors || [];

            // Populate Banner
            document.getElementById('banner-patient-name').textContent = admissionData.Full_Name;
            document.getElementById('banner-patient-code').textContent = admissionData.Patient_Code;
            document.getElementById('banner-patient-age').textContent = `${admissionData.Date_Of_Birth} (${admissionData.Age} yrs old)`;
            document.getElementById('banner-patient-gender-blood').textContent = `${admissionData.Gender_Name || 'N/A'} / Blood: ${admissionData.Blood_Type_Name || 'N/A'}`;
            
            document.getElementById('banner-bed').textContent = admissionData.Bed_Code || 'Discharged / None';
            document.getElementById('banner-room').textContent = admissionData.Room_Name ? `${admissionData.Room_Name} (${admissionData.Room_Type})` : 'N/A';
            document.getElementById('banner-rate').textContent = admissionData.Daily_Rate ? `₱${parseFloat(admissionData.Daily_Rate).toLocaleString('en-PH', {minimumFractionDigits: 2})}/day` : 'N/A';
            document.getElementById('banner-status').innerHTML = `<strong>${admissionData.Status}</strong> (Admitted: ${admissionData.Admission_Date})`;

            document.getElementById('banner-complaint').textContent = admissionData.Chief_Complaint;

            const docNames = assignedDoctors.map(d => `${d.Doctor_Name} (${d.Doctor_Type})`).join(', ');
            document.getElementById('banner-doctors').textContent = docNames || 'None assigned';

            // Populate Doctors in Order and Round forms
            populateAssignedDoctorDropdowns();

            // Disable transactional actions if not admitted
            if (admissionData.Status !== 'Admitted') {
                document.getElementById('order-form-container').innerHTML = '<p><em>Orders disabled: Patient is already discharged or billed.</em></p>';
                document.getElementById('round-form-container').innerHTML = '<p><em>Rounds disabled: Patient is already discharged or billed.</em></p>';
                document.getElementById('transfer-form-container').innerHTML = '<p><em>Transfers disabled: Patient is already discharged or billed.</em></p>';
            }
        })
        .catch(err => {
            console.error("admission_details.js: Error loading admission details:", err);
            alert("Failed to load admission details.");
        });
}

function populateAssignedDoctorDropdowns() {
    filterOrderDoctors();
    filterRoundDoctors();
}

function filterOrderDoctors() {
    const select = document.getElementById('order_doctor_id');
    if (!select) return;
    const query = (document.getElementById('order_doctor_search')?.value || '').toLowerCase().trim();
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Select Prescribing Doctor --</option>';

    const filtered = assignedDoctors.filter(doc => {
        if (!query) return true;
        const text = `${doc.Doctor_Name || ''} ${doc.Doctor_Type || ''} ${doc.Doctor_Code || ''}`.toLowerCase();
        return text.includes(query);
    });

    if (filtered.length === 0) {
        select.innerHTML = '<option value="">No matching physicians</option>';
        return;
    }

    filtered.forEach(doc => {
        const opt = document.createElement('option');
        opt.value = doc.Admission_Doctor_ID;
        opt.textContent = `${doc.Doctor_Name} (${doc.Doctor_Type})`;
        if (String(doc.Admission_Doctor_ID) === String(currentVal)) opt.selected = true;
        select.appendChild(opt);
    });
}

function filterRoundDoctors() {
    const select = document.getElementById('round_doctor_id');
    if (!select) return;
    const query = (document.getElementById('round_doctor_search')?.value || '').toLowerCase().trim();
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Select Visiting Doctor --</option>';

    const filtered = assignedDoctors.filter(doc => {
        if (!query) return true;
        const text = `${doc.Doctor_Name || ''} ${doc.Doctor_Type || ''} ${doc.Doctor_Code || ''}`.toLowerCase();
        return text.includes(query);
    });

    if (filtered.length === 0) {
        select.innerHTML = '<option value="">No matching physicians</option>';
        return;
    }

    filtered.forEach(doc => {
        const opt = document.createElement('option');
        opt.value = doc.Admission_Doctor_ID;
        opt.textContent = `${doc.Doctor_Name} (${doc.Doctor_Type}) — Fee: ₱${parseFloat(doc.Base_Round_Fee).toFixed(2)}`;
        if (String(doc.Admission_Doctor_ID) === String(currentVal)) opt.selected = true;
        select.appendChild(opt);
    });
}

// 3. Load Catalog Items for Ordering
function loadCatalogItems() {
    console.log("admission_details.js: Fetching charge catalog items...");

    const formData = new FormData();
    formData.append('operation', 'getCatalogList');

    axios.post('../api/clinical_orders.php', formData)
        .then(response => {
            console.log("admission_details.js: Catalog items received:", response.data);
            catalogItems = response.data || [];
            filterCatalogItems();
        })
        .catch(err => {
            console.error("admission_details.js: Error fetching catalog:", err);
        });
}

function filterCatalogItems() {
    const select = document.getElementById('order_catalog_id');
    if (!select) return;
    const query = (document.getElementById('order_catalog_search')?.value || '').toLowerCase().trim();
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Select Catalog Item / Medication / Service --</option>';

    const filtered = catalogItems.filter(item => {
        if (!query) return true;
        const text = `${item.Item_Code || ''} ${item.Item_Name || ''} ${item.Category_Type || ''}`.toLowerCase();
        return text.includes(query);
    });

    if (filtered.length === 0) {
        select.innerHTML = '<option value="">No matching catalog items</option>';
        return;
    }

    filtered.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.Catalog_ID;
        const price = parseFloat(item.Unit_Price).toLocaleString('en-PH', {minimumFractionDigits: 2});
        opt.textContent = `[${item.Item_Code}] ${item.Item_Name} (${item.Category_Type}) — ₱${price}`;
        if (String(item.Catalog_ID) === String(currentVal)) opt.selected = true;
        select.appendChild(opt);
    });
}

// 4. Section 1: Orders (Medicines, Scans, Procedures)
function loadOrders() {
    console.log("admission_details.js: Loading orders for admission ID:", admissionId);

    const formData = new FormData();
    formData.append('operation', 'getDoctorOrders');
    formData.append('json', JSON.stringify({ admission_id: admissionId }));

    axios.post('../api/clinical_orders.php', formData)
        .then(response => {
            console.log("admission_details.js: Orders received:", response.data);
            renderOrdersTable(response.data);
        })
        .catch(err => {
            console.error("admission_details.js: Error loading orders:", err);
        });
}

function renderOrdersTable(orders) {
    const container = document.getElementById('orders-table-div');

    if (!orders || orders.length === 0) {
        container.innerHTML = '<p><em>No doctor orders requested yet for this admission.</em></p>';
        return;
    }

    let html = '<table class="data-table">';
    html += '<thead><tr>';
    html += '<th>Order #</th>';
    html += '<th>Prescribing Physician</th>';
    html += '<th>Item Code & Description</th>';
    html += '<th>Category</th>';
    html += '<th>Qty</th>';
    html += '<th>Unit Price</th>';
    html += '<th>Total Amount</th>';
    html += '<th>Status</th>';
    html += '<th>Timestamps</th>';
    html += '<th>Actions</th>';
    html += '</tr></thead><tbody>';

    orders.forEach(o => {
        const unitPrice = parseFloat(o.Unit_Price).toLocaleString('en-PH', {minimumFractionDigits: 2});
        const total = parseFloat(o.Total_Price).toLocaleString('en-PH', {minimumFractionDigits: 2});

        let statusBadge = `<span class="badge badge-info">${o.Status}</span>`;
        if (o.Status === 'Administered') {
            statusBadge = `<span class="badge badge-success">Administered</span><br><small class="text-muted">(Charge Posted)</small>`;
        } else if (o.Status === 'Pending') {
            statusBadge = `<span class="badge badge-warning">Pending</span>`;
        } else if (o.Status === 'Cancelled') {
            statusBadge = `<span class="badge badge-danger">Cancelled</span>`;
        }

        let actionHtml = '<span class="text-muted">—</span>';
        if (o.Status === 'Pending') {
            actionHtml = `
                <button type="button" class="btn btn-sm btn-success" onclick="administerOrder(${o.Request_ID})">Administer</button>
                <button type="button" class="btn btn-sm btn-danger btn-delete" onclick="cancelOrder(${o.Request_ID})">Cancel</button>
            `;
        }

        html += '<tr>';
        html += `<td><strong>ORD-${String(o.Request_ID).padStart(3, '0')}</strong></td>`;
        html += `<td>${o.Doctor_Name}</td>`;
        html += `<td><strong>${o.Item_Code}</strong>: ${o.Item_Name}</td>`;
        html += `<td><span class="badge badge-info">${o.Category_Type}</span></td>`;
        html += `<td>${parseFloat(o.Quantity)}</td>`;
        html += `<td>₱${unitPrice}</td>`;
        html += `<td><strong>₱${total}</strong></td>`;
        html += `<td>${statusBadge}</td>`;
        html += `<td><small class="text-muted">Req: ${o.Request_Timestamp}<br>Adm: ${o.Administered_Timestamp || 'Pending'}</small></td>`;
        html += `<td>${actionHtml}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function submitDoctorOrder() {
    console.log("admission_details.js: Submitting new doctor order...");

    const doctorId = document.getElementById('order_doctor_id').value;
    const catalogId = document.getElementById('order_catalog_id').value;
    const qty = parseFloat(document.getElementById('order_qty').value);

    if (!doctorId) {
        alert("Please select the prescribing physician.");
        return;
    }

    if (!catalogId) {
        alert("Please select a catalog item/medication/service.");
        return;
    }

    if (isNaN(qty) || qty <= 0) {
        alert("Please enter a valid positive quantity.");
        return;
    }

    const payload = {
        admission_doctor_id: doctorId,
        catalog_id: catalogId,
        quantity: qty
    };

    const formData = new FormData();
    formData.append('operation', 'createDoctorOrder');
    formData.append('json', JSON.stringify(payload));

    axios.post('../api/clinical_orders.php', formData)
        .then(response => {
            console.log("admission_details.js: Order creation response:", response.data);
            if (response.data.success) {
                alert(response.data.message);
                document.getElementById('order_catalog_id').value = '';
                document.getElementById('order_qty').value = '1';
                loadOrders();
            } else {
                alert("Error: " + (response.data.error || "Failed to create order."));
            }
        })
        .catch(err => {
            console.error("admission_details.js: Error creating order:", err);
            alert("Network error creating order.");
        });
}

window.administerOrder = function(requestId) {
    console.log("admission_details.js: Administering order ID:", requestId);

    if (!confirm("Confirm administration / dispensation of this order?\n\nThis will mark the order as 'Administered' and automatically post the charge to the Live Billing Ledger.")) {
        return;
    }

    const formData = new FormData();
    formData.append('operation', 'administerOrder');
    formData.append('json', JSON.stringify({ request_id: requestId }));

    axios.post('../api/clinical_orders.php', formData)
        .then(response => {
            console.log("admission_details.js: Administer response:", response.data);
            if (response.data.success) {
                alert(response.data.message);
                loadOrders();
                loadLedger();
                loadLedgerSummary();
                loadDispensedMedicines();
            } else {
                alert("Administer Error: " + (response.data.error || "Unknown error."));
            }
        })
        .catch(err => {
            console.error("admission_details.js: Error administering order:", err);
            alert("Network error administering order.");
        });
};

window.cancelOrder = function(requestId) {
    console.log("admission_details.js: Cancelling order ID:", requestId);

    if (!confirm("Are you sure you want to cancel this pending order?")) {
        return;
    }

    const formData = new FormData();
    formData.append('operation', 'cancelOrder');
    formData.append('json', JSON.stringify({ request_id: requestId }));

    axios.post('../api/clinical_orders.php', formData)
        .then(response => {
            if (response.data.success) {
                alert(response.data.message);
                loadOrders();
            } else {
                alert("Cancel Error: " + (response.data.error || "Unknown error."));
            }
        })
        .catch(err => {
            console.error("admission_details.js: Error cancelling order:", err);
            alert("Network error cancelling order.");
        });
};

// 5. Section 2: Bedside Rounds
function loadRounds() {
    console.log("admission_details.js: Loading rounds for admission ID:", admissionId);

    const formData = new FormData();
    formData.append('operation', 'getDoctorRounds');
    formData.append('json', JSON.stringify({ admission_id: admissionId }));

    axios.post('../api/clinical_orders.php', formData)
        .then(response => {
            console.log("admission_details.js: Rounds received:", response.data);
            renderRoundsTable(response.data);
        })
        .catch(err => {
            console.error("admission_details.js: Error loading rounds:", err);
        });
}

function renderRoundsTable(rounds) {
    const container = document.getElementById('rounds-table-div');

    if (!rounds || rounds.length === 0) {
        container.innerHTML = '<p><em>No doctor bedside visits logged yet.</em></p>';
        return;
    }

    let html = '<table class="data-table">';
    html += '<thead><tr>';
    html += '<th>Round #</th>';
    html += '<th>Visiting Physician</th>';
    html += '<th>Doctor Classification</th>';
    html += '<th>Professional Fee Charged</th>';
    html += '<th>Visit Timestamp</th>';
    html += '<th>Billing Status</th>';
    html += '</tr></thead><tbody>';

    rounds.forEach(r => {
        const fee = parseFloat(r.Charged_Fee).toLocaleString('en-PH', {minimumFractionDigits: 2});
        html += '<tr>';
        html += `<td><strong>RND-${String(r.Round_ID).padStart(3, '0')}</strong></td>`;
        html += `<td><strong>${r.Doctor_Name}</strong></td>`;
        html += `<td>${r.Doctor_Type}</td>`;
        html += `<td><strong>₱${fee}</strong></td>`;
        html += `<td>${r.Round_Timestamp}</td>`;
        html += `<td><span class="badge badge-success">Posted to Ledger</span></td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function submitDoctorRound() {
    console.log("admission_details.js: Submitting doctor bedside round...");

    const doctorId = document.getElementById('round_doctor_id').value;
    const fee = document.getElementById('round_fee').value;

    if (!doctorId) {
        alert("Please select the visiting physician.");
        return;
    }

    if (fee === '' || isNaN(fee) || parseFloat(fee) < 0) {
        alert("Please enter a valid professional fee.");
        return;
    }

    const payload = {
        admission_doctor_id: doctorId,
        charged_fee: parseFloat(fee)
    };

    const formData = new FormData();
    formData.append('operation', 'logDoctorRound');
    formData.append('json', JSON.stringify(payload));

    axios.post('../api/clinical_orders.php', formData)
        .then(response => {
            console.log("admission_details.js: Round logged response:", response.data);
            if (response.data.success) {
                alert(response.data.message);
                loadRounds();
                loadLedger();
                loadLedgerSummary();
            } else {
                alert("Error: " + (response.data.error || "Failed to log round."));
            }
        })
        .catch(err => {
            console.error("admission_details.js: Error logging round:", err);
            alert("Network error logging bedside round.");
        });
}

// 6. Section 3: Room Transfers
function loadTransfers() {
    console.log("admission_details.js: Loading bed transfer history...");

    const formData = new FormData();
    formData.append('operation', 'getBedTransfers');
    formData.append('json', JSON.stringify({ admission_id: admissionId }));

    axios.post('../api/admissions.php', formData)
        .then(response => {
            console.log("admission_details.js: Bed transfers received:", response.data);
            renderTransfersTable(response.data);
        })
        .catch(err => {
            console.error("admission_details.js: Error loading transfers:", err);
        });
}

function renderTransfersTable(transfers) {
    const container = document.getElementById('transfers-table-div');

    if (!transfers || transfers.length === 0) {
        container.innerHTML = '<p><em>No bed stay logs found.</em></p>';
        return;
    }

    let html = '<table class="data-table">';
    html += '<thead><tr>';
    html += '<th>Stay #</th>';
    html += '<th>Bed & Room</th>';
    html += '<th>Classification</th>';
    html += '<th>Daily Rate</th>';
    html += '<th>Date Admitted / In</th>';
    html += '<th>Date Out</th>';
    html += '<th>Days Stayed</th>';
    html += '<th>Room Charge</th>';
    html += '<th>Status</th>';
    html += '</tr></thead><tbody>';

    transfers.forEach(t => {
        const rate = parseFloat(t.Daily_Rate).toLocaleString('en-PH', {minimumFractionDigits: 2});
        const fee = t.Total_Room_Fee ? `₱${parseFloat(t.Total_Room_Fee).toLocaleString('en-PH', {minimumFractionDigits: 2})}` : '<span class="text-muted">Accumulating...</span>';
        const isCurrent = t.Is_Current_Stay == 1;

        const stayBadge = isCurrent 
            ? '<span class="badge badge-success">Active Occupancy</span>' 
            : '<span class="badge badge-secondary">Closed & Charged</span>';

        html += '<tr>';
        html += `<td><strong>STAY-${String(t.Transfer_ID).padStart(3, '0')}</strong></td>`;
        html += `<td><strong>${t.Bed_Code}</strong> (${t.Room_Name})</td>`;
        html += `<td>${t.Room_Type}</td>`;
        html += `<td>₱${rate}/day</td>`;
        html += `<td>${t.Date_In}</td>`;
        html += `<td>${t.Date_Out || '<span class="text-muted">Currently In Bed</span>'}</td>`;
        html += `<td>${t.Total_Days || 'Active'}</td>`;
        html += `<td><strong>${fee}</strong></td>`;
        html += `<td>${stayBadge}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function loadAvailableBeds() {
    console.log("admission_details.js: Fetching vacant beds for transfer...");

    const formData = new FormData();
    formData.append('operation', 'getAvailableBeds');

    axios.post('../api/admissions.php', formData)
        .then(response => {
            availableBedsList = response.data || [];
            filterAvailableBeds();
        })
        .catch(err => {
            console.error("admission_details.js: Error fetching vacant beds:", err);
        });
}

function filterAvailableBeds() {
    const select = document.getElementById('transfer_bed_id');
    if (!select) return;
    const query = (document.getElementById('transfer_bed_search')?.value || '').toLowerCase().trim();
    const currentVal = select.value;

    select.innerHTML = '<option value="">-- Select Vacant Target Bed --</option>';
    if (availableBedsList.length === 0) {
        select.innerHTML = '<option value="">No other vacant beds available</option>';
        return;
    }

    const filtered = availableBedsList.filter(b => {
        if (!query) return true;
        const text = `${b.Bed_Code || ''} ${b.Room_Name || ''} ${b.Room_Type || ''} ${b.Daily_Rate || ''}`.toLowerCase();
        return text.includes(query);
    });

    if (filtered.length === 0) {
        select.innerHTML = '<option value="">No matching vacant beds</option>';
        return;
    }

    filtered.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.Bed_ID;
        const rate = parseFloat(b.Daily_Rate).toLocaleString('en-PH', {minimumFractionDigits: 2});
        opt.textContent = `Bed: ${b.Bed_Code} | ${b.Room_Name} (${b.Room_Type}) — ₱${rate}/day`;
        if (String(b.Bed_ID) === String(currentVal)) opt.selected = true;
        select.appendChild(opt);
    });
}

function submitBedTransfer() {
    console.log("admission_details.js: Submitting bed transfer...");

    const newBedId = document.getElementById('transfer_bed_id').value;

    if (!newBedId) {
        alert("Please select a target vacant bed.");
        return;
    }

    if (!confirm("Are you sure you want to transfer this patient to the selected bed?\n\nThis will automatically calculate the prior bed stay, post the room fee to the Live Billing Ledger, free the old bed, and occupy the new bed.")) {
        return;
    }

    const payload = {
        admission_id: admissionId,
        new_bed_id: newBedId
    };

    const formData = new FormData();
    formData.append('operation', 'transferBed');
    formData.append('json', JSON.stringify(payload));

    axios.post('../api/admissions.php', formData)
        .then(response => {
            console.log("admission_details.js: Bed transfer response:", response.data);
            if (response.data.success) {
                alert(response.data.message);
                if (document.getElementById('transfer_bed_search')) {
                    document.getElementById('transfer_bed_search').value = '';
                }
                loadAdmissionDetails();
                loadTransfers();
                loadAvailableBeds();
                loadLedger();
                loadLedgerSummary();
            } else {
                alert("Transfer Error: " + (response.data.error || "Failed to transfer bed."));
            }
        })
        .catch(err => {
            console.error("admission_details.js: Error transferring bed:", err);
            alert("Network error transferring bed.");
        });
}

// 7. Section 4: Live Itemized Billing Ledger
function loadLedger() {
    console.log("admission_details.js: Loading billing ledger for admission ID:", admissionId);

    const formData = new FormData();
    formData.append('operation', 'getAdmissionLedger');
    formData.append('json', JSON.stringify({ admission_id: admissionId }));

    axios.post('../api/ledger.php', formData)
        .then(response => {
            console.log("admission_details.js: Ledger rows received:", response.data);
            renderLedgerTable(response.data);
        })
        .catch(err => {
            console.error("admission_details.js: Error loading ledger:", err);
        });
}

function renderLedgerTable(ledger) {
    const container = document.getElementById('ledger-table-div');

    if (!ledger || ledger.length === 0) {
        container.innerHTML = '<p><em>No charges have been accumulated yet in the ledger for this admission.</em></p>';
        return;
    }

    let html = '<table class="data-table">';
    html += '<thead><tr>';
    html += '<th>Ledger #</th>';
    html += '<th>Department Station</th>';
    html += '<th>Category</th>';
    html += '<th>Item Description</th>';
    html += '<th>Qty</th>';
    html += '<th>Unit Price</th>';
    html += '<th>Total Amount</th>';
    html += '<th>Type</th>';
    html += '<th>Timestamp</th>';
    html += '</tr></thead><tbody>';

    ledger.forEach(row => {
        const isReturn = row.Transaction_Type === 'Return' || row.Total_Charge < 0;
        const formattedTotal = parseFloat(row.Total_Charge).toLocaleString('en-PH', {minimumFractionDigits: 2});
        const unitPrice = parseFloat(row.Unit_Price).toLocaleString('en-PH', {minimumFractionDigits: 2});

        const typeBadge = isReturn 
            ? '<span class="badge badge-warning">CREDIT / RETURN</span>' 
            : '<span class="badge badge-primary">CHARGE</span>';

        html += `<tr ${isReturn ? 'style="background-color: #f0fff4;"' : ''}>`;
        html += `<td><strong>LDG-${String(row.Ledger_ID).padStart(4, '0')}</strong></td>`;
        html += `<td>${row.Station_Name}</td>`;
        html += `<td><span class="badge badge-info">${row.Category}</span></td>`;
        html += `<td>${row.Description}</td>`;
        html += `<td>${row.Quantity}</td>`;
        html += `<td>₱${unitPrice}</td>`;
        html += `<td><strong>${isReturn ? '-' : ''}₱${Math.abs(parseFloat(row.Total_Charge)).toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></td>`;
        html += `<td>${typeBadge}</td>`;
        html += `<td><small class="text-muted">${row.Timestamp}</small></td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function loadLedgerSummary() {
    console.log("admission_details.js: Loading ledger financial summary...");

    const formData = new FormData();
    formData.append('operation', 'getLedgerSummary');
    formData.append('json', JSON.stringify({ admission_id: admissionId }));

    axios.post('../api/ledger.php', formData)
        .then(response => {
            console.log("admission_details.js: Financial summary received:", response.data);
            latestSummary = response.data;
            renderSummaryBox(response.data);
            renderSettlementSection();
        })
        .catch(err => {
            console.error("admission_details.js: Error fetching summary:", err);
        });
}

function renderSummaryBox(summary) {
    const container = document.getElementById('ledger-summary-div');

    const room = parseFloat(summary.room_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const doc = parseFloat(summary.doctor_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const med = parseFloat(summary.medicine_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const scan = parseFloat(summary.scan_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const srv = parseFloat(summary.service_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const gross = parseFloat(summary.gross_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const returns = parseFloat(summary.return_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const net = parseFloat(summary.net_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});

    let html = '<table class="data-table mb-3">';
    html += '<thead><tr><th colspan="2">Running Financial Breakdown & Statement of Charges</th></tr></thead><tbody>';
    html += `<tr><td width="70%">Room Accommodation & Board Subtotal:</td><td align="right">₱${room}</td></tr>`;
    html += `<tr><td>Doctor Professional Fees Subtotal:</td><td align="right">₱${doc}</td></tr>`;
    html += `<tr><td>Medications Subtotal (Net of Returns):</td><td align="right">₱${med}</td></tr>`;
    html += `<tr><td>Diagnostic & Equipment Scans Subtotal:</td><td align="right">₱${scan}</td></tr>`;
    html += `<tr><td>Procedures & Medical Services Subtotal:</td><td align="right">₱${srv}</td></tr>`;
    html += `<tr><td><strong>Gross Accumulated Charges:</strong></td><td align="right"><strong>₱${gross}</strong></td></tr>`;
    if (parseFloat(summary.return_total) > 0) {
        html += `<tr style="background-color: #f0fff4;"><td><strong style="color: #2f855a;">Less: Total Medicine Returns Credited:</strong></td><td align="right"><strong style="color: #2f855a;">-₱${returns}</strong></td></tr>`;
    }
    html += `<tr style="background-color: #edf2f7;"><td><h3 style="margin: 4px 0; color: #1a202c;">NET CHARGES ACCUMULATED TO DATE:</h3></td><td align="right"><h3 style="margin: 4px 0; color: var(--primary-color);">₱${net}</h3></td></tr>`;
    html += '</tbody></table>';

    container.innerHTML = html;
}

// 8. Medicine Returns
function loadDispensedMedicines() {
    console.log("admission_details.js: Loading dispensed medicines for returns...");

    const formData = new FormData();
    formData.append('operation', 'getDispensedMedicines');
    formData.append('json', JSON.stringify({ admission_id: admissionId }));

    axios.post('../api/ledger.php', formData)
        .then(response => {
            console.log("admission_details.js: Dispensed medicines received:", response.data);
            dispensedMedicinesList = response.data || [];
            filterDispensedMedicines();
        })
        .catch(err => {
            console.error("admission_details.js: Error loading dispensed medicines:", err);
        });
}

function filterDispensedMedicines() {
    const select = document.getElementById('return_catalog_id');
    if (!select) return;
    const query = (document.getElementById('return_catalog_search')?.value || '').toLowerCase().trim();
    const currentVal = select.value;

    if (!dispensedMedicinesList || dispensedMedicinesList.length === 0) {
        select.innerHTML = '<option value="">No dispensed medicines eligible for return</option>';
        return;
    }

    select.innerHTML = '<option value="">-- Select Dispensed Medicine to Return --</option>';

    const filtered = dispensedMedicinesList.filter(m => {
        if (!query) return true;
        const text = `${m.Item_Code || ''} ${m.Item_Name || ''}`.toLowerCase();
        return text.includes(query);
    });

    if (filtered.length === 0) {
        select.innerHTML = '<option value="">No matching dispensed medicines</option>';
        return;
    }

    filtered.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.Catalog_ID;
        const unitPrice = parseFloat(m.Unit_Price).toLocaleString('en-PH', {minimumFractionDigits: 2});
        opt.textContent = `[${m.Item_Code}] ${m.Item_Name} — Available for return: ${parseFloat(m.Net_Remaining_Qty)} unit(s) (₱${unitPrice}/unit)`;
        opt.dataset.max = m.Net_Remaining_Qty;
        if (String(m.Catalog_ID) === String(currentVal)) opt.selected = true;
        select.appendChild(opt);
    });
}

function submitMedicineReturn() {
    console.log("admission_details.js: Processing medicine return submission...");

    const select = document.getElementById('return_catalog_id');
    const catalogId = select.value;
    const qty = parseFloat(document.getElementById('return_qty').value);

    if (!catalogId) {
        alert("Please select a dispensed medicine to return.");
        return;
    }

    if (isNaN(qty) || qty <= 0) {
        alert("Please enter a valid return quantity.");
        return;
    }

    const selectedOption = select.options[select.selectedIndex];
    const maxAvailable = parseFloat(selectedOption.dataset.max || 0);

    if (qty > maxAvailable) {
        alert(`Cannot return ${qty} unit(s). Only ${maxAvailable} unit(s) are eligible for return.`);
        return;
    }

    if (!confirm(`Confirm return of ${qty} unit(s)?\n\nThis will post a negative credit adjustment to the Live Billing Ledger.`)) {
        return;
    }

    const payload = {
        admission_id: admissionId,
        catalog_id: catalogId,
        quantity: qty
    };

    const formData = new FormData();
    formData.append('operation', 'returnMedicine');
    formData.append('json', JSON.stringify(payload));

    axios.post('../api/ledger.php', formData)
        .then(response => {
            console.log("admission_details.js: Return medicine response:", response.data);
            if (response.data.success) {
                alert(response.data.message);
                if (document.getElementById('return_catalog_search')) {
                    document.getElementById('return_catalog_search').value = '';
                }
                loadLedger();
                loadLedgerSummary();
                loadDispensedMedicines();
                document.getElementById('return_qty').value = '1';
            } else {
                alert("Return Error: " + (response.data.error || "Failed to process return."));
            }
        })
        .catch(err => {
            console.error("admission_details.js: Error processing return:", err);
            alert("Network error processing medicine return.");
        });
}

// 9. Section 5: Billing Settlement & Discounts
function loadDiscounts() {
    console.log("admission_details.js: Fetching discount options...");

    const formData = new FormData();
    formData.append('operation', 'getDiscountList');

    axios.post('../api/invoices.php', formData)
        .then(response => {
            console.log("admission_details.js: Discounts received:", response.data);
            discountList = response.data || [];
            renderSettlementSection();
        })
        .catch(err => {
            console.error("admission_details.js: Error loading discounts:", err);
        });
}

function renderSettlementSection() {
    const container = document.getElementById('settlement-container');
    if (!container) return;

    if (!admissionData) {
        container.innerHTML = '<p>Loading admission information...</p>';
        return;
    }

    if (admissionData.Status === 'Billed') {
        container.innerHTML = `
            <div class="card p-3" style="background-color: #f0fff4; border: 1px solid #48bb78; border-radius: 8px;">
                <h3 style="margin-top:0; color: #276749;">✔ THIS ADMISSION HAS BEEN OFFICIALLY SETTLED & BILLED</h3>
                <p class="text-muted">The billing invoice and official Statement of Account (SOA) have been generated and finalized.</p>
                <button type="button" class="btn btn-primary" onclick="window.location.href='invoice_print.html?admission_id=${admissionId}'">🖨 View / Print Official Statement of Account (SOA)</button>
            </div>
        `;
        return;
    }

    const gross = latestSummary ? parseFloat(latestSummary.net_total || 0) : 0;
    const formattedGross = gross.toLocaleString('en-PH', {minimumFractionDigits: 2});

    let discountOptionsHtml = '<option value="" data-pct="0">None (0.00%)</option>';
    discountList.forEach(d => {
        discountOptionsHtml += `<option value="${d.Discount_ID}" data-pct="${d.Discount_Percentage}">${d.Discount_Name} (${parseFloat(d.Discount_Percentage).toFixed(2)}%)</option>`;
    });

    const isOccupyingBed = admissionData.Bed_Code ? `<p style="color: #856404; background-color: #fff3cd; padding: 10px; border-radius: 6px; border: 1px solid #ffeeba;"><strong>Note:</strong> The patient is currently assigned to Bed <strong>${admissionData.Bed_Code}</strong>. Processing settlement will automatically calculate final board & lodging, release the bed as available, and finalize the account.</p>` : '';

    let html = `
        ${isOccupyingBed}
        <table class="data-table mb-3">
            <thead>
                <tr><th colspan="2">Billing Settlement & Statutory Discount Breakdown</th></tr>
            </thead>
            <tbody>
            <tr>
                <td width="40%"><strong>Select Statutory / Institutional Discount:</strong></td>
                <td width="60%">
                    <select id="settle_discount_id" class="form-select">
                        ${discountOptionsHtml}
                    </select>
                </td>
            </tr>
            <tr>
                <td>Gross Total Accumulated Charges:</td>
                <td align="right"><strong>₱<span id="settle-gross-display">${formattedGross}</span></strong></td>
            </tr>
            <tr>
                <td>Applied Discount (<span id="settle-discount-pct-label">0.00%</span>):</td>
                <td align="right" style="color: #276749;"><strong>-<span id="settle-discount-amount-display">₱0.00</span></strong></td>
            </tr>
            <tr style="background-color: #edf2f7;">
                <td><h3 style="margin: 5px 0;">NET AMOUNT DUE / SETTLED:</h3></td>
                <td align="right"><h3 style="margin: 5px 0; color: var(--primary-color);" id="settle-net-display">₱${formattedGross}</h3></td>
            </tr>
            </tbody>
        </table>
        <div class="mt-3">
            <button id="btnSettleBill" class="btn btn-primary btn-lg">Process Final Settlement & Generate Official Invoice</button>
        </div>
    `;

    container.innerHTML = html;

    // Attach Discount recalculation listener
    const discountSelect = document.getElementById('settle_discount_id');
    if (discountSelect) {
        discountSelect.addEventListener('change', () => {
            const selectedOpt = discountSelect.options[discountSelect.selectedIndex];
            const pct = parseFloat(selectedOpt.dataset.pct || 0);
            const discountAmt = Math.round((gross * (pct / 100)) * 100) / 100;
            const netAmt = Math.max(0, gross - discountAmt);

            document.getElementById('settle-discount-pct-label').textContent = `${pct.toFixed(2)}%`;
            document.getElementById('settle-discount-amount-display').textContent = `₱${discountAmt.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
            document.getElementById('settle-net-display').textContent = `₱${netAmt.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
        });
    }

    // Attach Settle button listener
    const btnSettle = document.getElementById('btnSettleBill');
    if (btnSettle) {
        btnSettle.addEventListener('click', submitSettlement);
    }
}

function submitSettlement() {
    console.log("admission_details.js: Submitting final billing settlement...");

    const discountSelect = document.getElementById('settle_discount_id');
    const discountId = discountSelect ? discountSelect.value : null;

    if (!confirm("Are you sure you want to finalize this billing settlement?\n\nThis will record the official Final Invoice, calculate statutory discounts, release the bed (if active), and mark the admission as 'Billed'.")) {
        return;
    }

    const payload = {
        admission_id: admissionId,
        user_id: currentUser ? (currentUser.user_id || currentUser.User_ID || 1) : 1,
        discount_id: discountId
    };

    console.log("admission_details.js: Settlement payload:", payload);

    const formData = new FormData();
    formData.append('operation', 'settleInvoice');
    formData.append('json', JSON.stringify(payload));

    axios.post('../api/invoices.php', formData)
        .then(response => {
            console.log("admission_details.js: Settlement response:", response.data);
            if (response.data.success) {
                alert(response.data.message);
                // Redirect immediately to the official printable invoice
                window.location.href = `invoice_print.html?id=${response.data.invoice_id}`;
            } else {
                alert("Settlement Error: " + (response.data.error || "Failed to settle bill."));
            }
        })
        .catch(err => {
            console.error("admission_details.js: Error during settlement:", err);
            alert("Network error processing settlement.");
        });
}

