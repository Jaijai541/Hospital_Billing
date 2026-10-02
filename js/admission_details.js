const getApiUrl = "../api/GET";
const postApiUrl = "../api/POST";

let admissionId = null;
let admissionData = null;
let catalogItems = [];
let assignedDoctors = [];
let availableBedsList = [];
let dispensedMedicinesList = [];
let currentUser = null;
let discountList = [];
let paymentMethodsList = [];
let latestSummary = null;
let customVouchersList = [];
let switchClinicalTab = null;
let currentPickerConfig = null;
let currentPickerSelectedItem = null;

window.addEventListener('DOMContentLoaded', () => {
    console.log("admission_details.js: Initializing Patient Chart...");

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

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            console.log("admission_details.js: Logging out...");
            sessionStorage.removeItem("hospital_user");
            window.location.href = "login.html";
        });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get('id');

    if (!idParam || isNaN(idParam)) {
        alert("Invalid or missing Admission ID.", () => {
            window.location.href = "admissions.html";
        });
        return;
    }

    admissionId = parseInt(idParam, 10);
    console.log("admission_details.js: Loaded Admission ID:", admissionId);

    initClinicalTabs();

    document.getElementById('btnSubmitOrder').addEventListener('click', submitDoctorOrder);
    document.getElementById('btnLogRound').addEventListener('click', submitDoctorRound);
    document.getElementById('btnTransferBed').addEventListener('click', submitBedTransfer);
    document.getElementById('btnReturnMedicine').addEventListener('click', submitMedicineReturn);

    initDiagnosisModal();
    initClinicalModals();

    initLookupPicker();
    wireLookupPickers();

    const returnCatSearch = document.getElementById('return_catalog_search');
    if (returnCatSearch) returnCatSearch.addEventListener('input', filterDispensedMedicines);

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

const initClinicalTabs = () => {
    const tabBtns = document.querySelectorAll('.clinical-tabs-nav .tab-btn');
    const tabPanels = document.querySelectorAll('.tab-content-panel');
    const glider = document.getElementById('subnavGlider');
    const subnavItems = document.querySelectorAll('.clinical-slide-switcher .slide-tab-item, .clinical-subnav .subnav-btn');
    const subPanels = document.querySelectorAll('#tab-clinical .sub-panel');

    const activateSubtab = (subId) => {
        let activeIdx = 0;
        subnavItems.forEach((btn, idx) => {
            if (btn.getAttribute('data-sub') === subId) {
                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');
                activeIdx = idx;
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-selected', 'false');
            }
        });

        if (glider) {
            glider.style.transform = `translateX(${activeIdx * 100}%)`;
        }

        subPanels.forEach(panel => {
            if (panel.id === subId) {
                panel.style.display = 'block';
                panel.classList.remove('subpanel-slide-active');
                void panel.offsetWidth;
                panel.classList.add('subpanel-slide-active');
            } else {
                panel.style.display = 'none';
                panel.classList.remove('subpanel-slide-active');
            }
        });
    };

    const activateTab = (tabId) => {
        let realTabId = tabId;
        if (tabId === 'tab-orders' || tabId === 'tab-rounds' || tabId === 'tab-stays') {
            realTabId = 'tab-clinical';
        } else if (tabId === 'tab-charges') {
            realTabId = 'tab-ledger';
        }

        tabBtns.forEach(btn => {
            if (btn.getAttribute('data-tab') === realTabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        tabPanels.forEach(panel => {
            if (panel.id === realTabId) {
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        });

        if (tabId === 'tab-rounds') {
            activateSubtab('sub-rounds');
        } else if (tabId === 'tab-stays') {
            activateSubtab('sub-stays');
        } else if (tabId === 'tab-orders') {
            activateSubtab('sub-orders');
        }
    };

    switchClinicalTab = activateTab;

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab');
            activateTab(target);
            if (history.replaceState) {
                history.replaceState(null, null, `#${target}`);
            }
        });
    });

    subnavItems.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-sub');
            activateSubtab(target);
        });
    });

    const hash = window.location.hash.replace('#', '');
    if (hash) {
        activateTab(hash);
    }
};

const updateWorkflowStepper = (status, remainingBalance) => {
    const s1 = document.getElementById('step-admission');
    const s2 = document.getElementById('step-charges');
    const s3 = document.getElementById('step-discharge');
    const s4 = document.getElementById('step-cashier');

    const sub1 = document.getElementById('step-sub-admission');
    const sub2 = document.getElementById('step-sub-charges');
    const sub3 = document.getElementById('step-sub-discharge');
    const sub4 = document.getElementById('step-sub-cashier');

    const b1 = document.getElementById('badge-admission');
    const b2 = document.getElementById('badge-charges');
    const b3 = document.getElementById('badge-discharge');
    const b4 = document.getElementById('badge-cashier');

    if (!s1 || !s2 || !s3 || !s4) return;

    [s1, s2, s3, s4].forEach(s => s.className = 'step-item');

    if (status === 'Admitted') {
        s1.classList.add('completed');
        if (b1) b1.textContent = '✏“';
        if (sub1) sub1.textContent = 'Bed Occupied';

        s2.classList.add('active');
        if (b2) b2.textContent = '2';
        if (sub2) sub2.textContent = 'Partial Bill Available';

        s3.classList.add('pending');
        if (b3) b3.textContent = '3';
        if (sub3) sub3.textContent = 'In Care (Not Discharged)';

        s4.classList.add('pending');
        if (b4) b4.textContent = '4';
        if (sub4) sub4.textContent = 'Pending Settlement';
    } else if (status === 'Discharged') {
        s1.classList.add('completed');
        if (b1) b1.textContent = '✏“';
        if (sub1) sub1.textContent = 'Bed Released';

        s2.classList.add('completed');
        if (b2) b2.textContent = '✏“';
        if (sub2) sub2.textContent = 'Charges Finalized';

        s3.classList.add('active');
        if (b3) b3.textContent = '3';
        if (sub3) sub3.textContent = 'Finalize SOA & Discounts';

        s4.classList.add('pending');
        if (b4) b4.textContent = '4';
        if (sub4) sub4.textContent = 'Pending Settlement';
    } else if (status === 'Billed') {
        s1.classList.add('completed');
        if (b1) b1.textContent = '✏“';
        if (sub1) sub1.textContent = 'Bed Released';

        s2.classList.add('completed');
        if (b2) b2.textContent = '✏“';
        if (sub2) sub2.textContent = 'Charges Finalized';

        s3.classList.add('completed');
        if (b3) b3.textContent = '✏“';
        if (sub3) sub3.textContent = 'SOA Finalized';

        const rem = parseFloat(remainingBalance !== undefined && remainingBalance !== null ? remainingBalance : 0);
        if (rem > 0) {
            s4.classList.add('active');
            if (b4) b4.textContent = '4';
            if (sub4) sub4.textContent = `Balance: ₱${rem.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
        } else {
            s4.classList.add('completed');
            if (b4) b4.textContent = '✏“';
            if (sub4) sub4.textContent = 'Paid in Full';
        }
    }
};

const initClinicalModals = () => {
    const btnOpenOrder = document.getElementById('btnOpenOrderModal');
    const btnCloseOrder = document.getElementById('btnCloseOrderModal');
    const btnCancelOrder = document.getElementById('btnCancelOrder');
    const orderModal = document.getElementById('orderModal');

    if (btnOpenOrder) {
        btnOpenOrder.addEventListener('click', () => {
            if (admissionData && admissionData.Status !== 'Admitted') {
                alert("Cannot place orders: Patient is already discharged or billed.");
                return;
            }
            const orderDocId = document.getElementById('order_doctor_id');
            const orderDocName = document.getElementById('order_doctor_name');
            const orderCatId = document.getElementById('order_catalog_id');
            const orderCatName = document.getElementById('order_catalog_name');
            const orderQty = document.getElementById('order_qty');
            if (orderDocId) orderDocId.value = '';
            if (orderDocName) orderDocName.value = '';
            if (orderCatId) orderCatId.value = '';
            if (orderCatName) orderCatName.value = '';
            if (orderQty) orderQty.value = '1';
            openModal('orderModal');
        });
    }
    if (btnCloseOrder) btnCloseOrder.addEventListener('click', () => closeModal('orderModal'));
    if (btnCancelOrder) btnCancelOrder.addEventListener('click', () => closeModal('orderModal'));

    const btnOpenRound = document.getElementById('btnOpenRoundModal');
    const btnCloseRound = document.getElementById('btnCloseRoundModal');
    const btnCancelRound = document.getElementById('btnCancelRound');
    const roundModal = document.getElementById('roundModal');

    if (btnOpenRound) {
        btnOpenRound.addEventListener('click', () => {
            if (admissionData && admissionData.Status !== 'Admitted') {
                alert("Cannot log bedside visits: Patient is already discharged or billed.");
                return;
            }
            const roundDocId = document.getElementById('round_doctor_id');
            const roundDocName = document.getElementById('round_doctor_name');
            const roundFee = document.getElementById('round_fee');
            if (roundDocId) roundDocId.value = '';
            if (roundDocName) roundDocName.value = '';
            if (roundFee) roundFee.value = '';
            openModal('roundModal');
        });
    }
    if (btnCloseRound) btnCloseRound.addEventListener('click', () => closeModal('roundModal'));
    if (btnCancelRound) btnCancelRound.addEventListener('click', () => closeModal('roundModal'));

    const btnOpenTransfer = document.getElementById('btnOpenTransferModal');
    const btnCloseTransfer = document.getElementById('btnCloseTransferModal');
    const btnCancelTransfer = document.getElementById('btnCancelTransfer');
    const transferModal = document.getElementById('transferModal');

    if (btnOpenTransfer) {
        btnOpenTransfer.addEventListener('click', () => {
            if (admissionData && admissionData.Status !== 'Admitted') {
                alert("Cannot transfer bed: Patient is already discharged or billed.");
                return;
            }
            const transBedId = document.getElementById('transfer_bed_id');
            const transBedName = document.getElementById('transfer_bed_name');
            if (transBedId) transBedId.value = '';
            if (transBedName) transBedName.value = '';
            loadAvailableBeds();
            openModal('transferModal');
        });
    }
    if (btnCloseTransfer) btnCloseTransfer.addEventListener('click', () => closeModal('transferModal'));
    if (btnCancelTransfer) btnCancelTransfer.addEventListener('click', () => closeModal('transferModal'));

    const btnOpenReturn = document.getElementById('btnOpenReturnModal');
    const btnOpenReturnPharm = document.getElementById('btnOpenReturnModalPharmacy');
    const btnCloseReturn = document.getElementById('btnCloseReturnModal');
    const btnCancelReturn = document.getElementById('btnCancelReturn');
    const returnModal = document.getElementById('returnModal');

    const handleOpenReturnModal = () => {
        if (admissionData && admissionData.Status !== 'Admitted') {
            alert("Cannot process returns: Patient is already discharged or billed.");
            return;
        }
        if (document.getElementById('return_catalog_search')) {
            document.getElementById('return_catalog_search').value = '';
        }
        document.getElementById('return_qty').value = '1';
        loadDispensedMedicines();
        openModal('returnModal');
    };

    if (btnOpenReturn) btnOpenReturn.addEventListener('click', handleOpenReturnModal);
    if (btnOpenReturnPharm) btnOpenReturnPharm.addEventListener('click', handleOpenReturnModal);
    if (btnCloseReturn) btnCloseReturn.addEventListener('click', () => closeModal('returnModal'));
    if (btnCancelReturn) btnCancelReturn.addEventListener('click', () => closeModal('returnModal'));

    const advanceModal = document.getElementById('advancePaymentModal');
    const btnOpenAdv = document.getElementById('btnOpenAdvancePaymentModal');
    const btnCloseAdv = document.getElementById('btnCloseAdvancePaymentModal');
    const btnCancelAdv = document.getElementById('btnCancelAdvancePayment');
    const btnSubmitAdv = document.getElementById('btnSubmitAdvancePayment');
    const btnBrowseAdvMethod = document.getElementById('btnBrowse_adv_method_id');
    const btnPayAdvExact = document.getElementById('btnPayAdvExactBalance');

    if (btnOpenAdv) btnOpenAdv.addEventListener('click', openAdvancePaymentModal);
    if (btnCloseAdv) btnCloseAdv.addEventListener('click', () => closeModal('advancePaymentModal'));
    if (btnCancelAdv) btnCancelAdv.addEventListener('click', () => closeModal('advancePaymentModal'));
    if (btnSubmitAdv) btnSubmitAdv.addEventListener('click', submitAdvancePayment);
    if (btnBrowseAdvMethod) btnBrowseAdvMethod.addEventListener('click', openAdvancePaymentMethodPicker);
    if (btnPayAdvExact) {
        btnPayAdvExact.addEventListener('click', () => {
            const netCharges = latestSummary ? parseFloat(latestSummary.net_total || 0) : 0;
            const advPaid = latestSummary ? parseFloat(latestSummary.advance_payments_total || 0) : 0;
            const unpaidBal = latestSummary && latestSummary.balance_due !== undefined ? parseFloat(latestSummary.balance_due) : Math.max(0, netCharges - advPaid);
            const input = document.getElementById('adv_amount_input');
            if (input) input.value = unpaidBal > 0 ? unpaidBal.toFixed(2) : '0.00';
        });
    }

    [orderModal, roundModal, transferModal, returnModal, advanceModal].forEach(m => {
        if (m) {
            m.addEventListener('click', (e) => {
                if (e.target === m) closeModal(m.id);
            });
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const pickerModal = document.getElementById('lookupPickerModal');
            if (pickerModal && pickerModal.style.display === 'flex') {
                closeLookupPicker();
                return;
            }
            if (orderModal && orderModal.style.display === 'flex') closeModal('orderModal');
            if (roundModal && roundModal.style.display === 'flex') closeModal('roundModal');
            if (transferModal && transferModal.style.display === 'flex') closeModal('transferModal');
            if (returnModal && returnModal.style.display === 'flex') closeModal('returnModal');
            if (advanceModal && advanceModal.style.display === 'flex') closeModal('advancePaymentModal');
        }
    });
};

const openLookupPicker = (config) => {
    currentPickerConfig = config;
    currentPickerSelectedItem = null;

    document.getElementById('lookup_picker_title').textContent = config.title;
    const searchInput = document.getElementById('lookup_picker_search');
    searchInput.placeholder = config.placeholder || 'Search...';
    searchInput.value = '';

    const filterSelect = document.getElementById('lookup_picker_filter');
    if (filterSelect) {
        if (config.filterOptions && config.filterOptions.length > 0) {
            filterSelect.style.display = 'block';
            filterSelect.innerHTML = config.filterOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');
            filterSelect.value = config.filterOptions[0].value;
        } else {
            filterSelect.style.display = 'none';
        }
    }

    const sortSelect = document.getElementById('lookup_picker_sort');
    if (sortSelect) {
        if (config.sortOptions && config.sortOptions.length > 0) {
            sortSelect.style.display = 'block';
            sortSelect.innerHTML = config.sortOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');
            sortSelect.value = config.sortOptions[0].value;
        } else {
            sortSelect.style.display = 'none';
        }
    }

    const btnDone = document.getElementById('btnDoneLookupPicker');
    btnDone.disabled = true;
    document.getElementById('lookup_picker_status').textContent = 'Click a row to select.';

    let theadHtml = '<tr>';
    config.columns.forEach(col => {
        theadHtml += `<th>${col}</th>`;
    });
    theadHtml += '</tr>';
    document.getElementById('lookup_picker_thead').innerHTML = theadHtml;

    renderLookupPickerRows();

    const pickerModal = document.getElementById('lookupPickerModal');
    if (pickerModal) {
        pickerModal.style.display = 'flex';
        setTimeout(() => searchInput.focus(), 50);
    }
};

const closeLookupPicker = () => {
    const pickerModal = document.getElementById('lookupPickerModal');
    if (pickerModal) pickerModal.style.display = 'none';
    currentPickerConfig = null;
    currentPickerSelectedItem = null;
};

const renderLookupPickerRows = () => {
    if (!currentPickerConfig) return;
    const query = (document.getElementById('lookup_picker_search').value || '').toLowerCase().trim();
    const filterSelect = document.getElementById('lookup_picker_filter');
    const filterVal = filterSelect ? filterSelect.value : 'all';
    const sortSelect = document.getElementById('lookup_picker_sort');
    const sortVal = sortSelect ? sortSelect.value : 'default';
    const tbody = document.getElementById('lookup_picker_tbody');
    const emptyDiv = document.getElementById('lookup_picker_empty');
    const btnDone = document.getElementById('btnDoneLookupPicker');

    let filtered = (currentPickerConfig.items || []).filter(item => {
        if (query && currentPickerConfig.filterFn && !currentPickerConfig.filterFn(item, query)) {
            return false;
        }
        if (filterVal && filterVal !== 'all' && currentPickerConfig.categoryFilterFn) {
            return currentPickerConfig.categoryFilterFn(item, filterVal);
        }
        return true;
    });

    if (sortVal && sortVal !== 'default' && currentPickerConfig.sortFn) {
        filtered = currentPickerConfig.sortFn(filtered, sortVal);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyDiv.style.display = 'block';
        btnDone.disabled = true;
        currentPickerSelectedItem = null;
        document.getElementById('lookup_picker_status').textContent = 'No matching records found.';
        return;
    }

    emptyDiv.style.display = 'none';

    if (currentPickerSelectedItem && !filtered.includes(currentPickerSelectedItem)) {
        currentPickerSelectedItem = null;
        btnDone.disabled = true;
        document.getElementById('lookup_picker_status').textContent = 'Click a row to select.';
    } else if (currentPickerSelectedItem && filtered.includes(currentPickerSelectedItem)) {
        btnDone.disabled = false;
        document.getElementById('lookup_picker_status').innerHTML = `Selected: <strong>${currentPickerConfig.getItemName(currentPickerSelectedItem)}</strong>`;
    } else {
        btnDone.disabled = true;
        document.getElementById('lookup_picker_status').textContent = 'Click a row to select.';
    }

    let html = '';
    filtered.forEach((item, index) => {
        const isSelected = (currentPickerSelectedItem === item);
        const selClass = isSelected ? 'picker-row clickable-row selected-row' : 'picker-row clickable-row';
        html += `<tr class="${selClass}" data-index="${index}">${currentPickerConfig.renderRowFn(item)}</tr>`;
    });
    tbody.innerHTML = html;

    const rows = tbody.querySelectorAll('tr.picker-row');
    rows.forEach(row => {
        const idx = parseInt(row.getAttribute('data-index'), 10);
        const item = filtered[idx];

        row.addEventListener('click', () => {
            rows.forEach(r => r.classList.remove('selected-row'));
            row.classList.add('selected-row');
            currentPickerSelectedItem = item;
            btnDone.disabled = false;
            document.getElementById('lookup_picker_status').innerHTML = `Selected: <strong>${currentPickerConfig.getItemName(item)}</strong>`;
        });

        row.addEventListener('dblclick', () => {
            currentPickerSelectedItem = item;
            if (currentPickerConfig.onSelect) {
                currentPickerConfig.onSelect(item);
            }
            closeLookupPicker();
        });
    });
};

const initLookupPicker = () => {
    const pickerModal = document.getElementById('lookupPickerModal');
    const btnClose = document.getElementById('btnCloseLookupPicker');
    const btnCancel = document.getElementById('btnCancelLookupPicker');
    const btnDone = document.getElementById('btnDoneLookupPicker');
    const searchInput = document.getElementById('lookup_picker_search');
    const filterSelect = document.getElementById('lookup_picker_filter');
    const sortSelect = document.getElementById('lookup_picker_sort');

    if (btnClose) btnClose.addEventListener('click', closeLookupPicker);
    if (btnCancel) btnCancel.addEventListener('click', closeLookupPicker);

    if (btnDone) {
        btnDone.addEventListener('click', () => {
            if (currentPickerConfig && currentPickerSelectedItem) {
                currentPickerConfig.onSelect(currentPickerSelectedItem);
                closeLookupPicker();
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', renderLookupPickerRows);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (currentPickerConfig && currentPickerSelectedItem) {
                    currentPickerConfig.onSelect(currentPickerSelectedItem);
                    closeLookupPicker();
                }
            }
        });
    }

    if (filterSelect) {
        filterSelect.addEventListener('change', renderLookupPickerRows);
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', renderLookupPickerRows);
    }

    if (pickerModal) {
        pickerModal.addEventListener('click', (e) => {
            if (e.target === pickerModal) closeLookupPicker();
        });
    }
};

const wireLookupPickers = () => {
    const btnBrowseOrderDoc = document.getElementById('btnBrowseOrderDoctor');
    const orderDocName = document.getElementById('order_doctor_name');
    const handleOpenOrderDocPicker = () => {
        const docList = assignedDoctors || [];
        const docTypes = [...new Set(docList.map(d => d.Doctor_Type).filter(Boolean))];
        openLookupPicker({
            title: 'Select Ordering Physician',
            placeholder: 'Search physician name, classification, or specialty...',
            columns: ['Physician Name', 'Type / Classification', 'Department / Specialty'],
            items: docList,
            filterOptions: [
                { label: 'All Classifications', value: 'all' },
                ...docTypes.map(t => ({ label: t, value: t }))
            ],
            categoryFilterFn: (d, val) => d.Doctor_Type === val,
            sortOptions: [
                { label: 'Default Order', value: 'default' },
                { label: 'Name (A to Z)', value: 'name_asc' },
                { label: 'Name (Z to A)', value: 'name_desc' }
            ],
            sortFn: (list, val) => {
                const arr = [...list];
                if (val === 'name_asc') {
                    arr.sort((a, b) => (a.Doctor_Name || '').localeCompare(b.Doctor_Name || ''));
                } else if (val === 'name_desc') {
                    arr.sort((a, b) => (b.Doctor_Name || '').localeCompare(a.Doctor_Name || ''));
                }
                return arr;
            },
            filterFn: (d, q) => {
                const str = `${d.Doctor_Name || ''} ${d.Doctor_Type || ''} ${d.Specialties || ''} ${d.Doctor_Code || ''}`.toLowerCase();
                return str.includes(q);
            },
            renderRowFn: (d) => `
                <td><strong>${d.Doctor_Name}</strong></td>
                <td><span class="badge badge-info">${d.Doctor_Type}</span></td>
                <td>${d.Specialties || 'Attending Physician'}</td>
            `,
            getItemName: (d) => `${d.Doctor_Name} (${d.Doctor_Type})`,
            onSelect: (d) => {
                document.getElementById('order_doctor_id').value = d.Admission_Doctor_ID;
                document.getElementById('order_doctor_name').value = `${d.Doctor_Name} (${d.Doctor_Type})`;
            }
        });
    };
    if (btnBrowseOrderDoc) btnBrowseOrderDoc.addEventListener('click', handleOpenOrderDocPicker);
    if (orderDocName) orderDocName.addEventListener('click', handleOpenOrderDocPicker);

    const btnBrowseCatalog = document.getElementById('btnBrowseOrderCatalog');
    const orderCatalogName = document.getElementById('order_catalog_name');
    const handleOpenCatalogPicker = () => {
        const catList = catalogItems || [];
        const categories = [...new Set(catList.map(it => it.Category_Type).filter(Boolean))];
        openLookupPicker({
            title: 'Select Catalog Item / Medication / Procedure',
            placeholder: 'Search item code, medicine, lab test, service...',
            columns: ['Item Code', 'Item Name / Description', 'Category', 'Unit Price'],
            items: catList,
            filterOptions: [
                { label: 'All Categories', value: 'all' },
                ...categories.map(c => ({ label: c, value: c }))
            ],
            categoryFilterFn: (it, val) => it.Category_Type === val,
            sortOptions: [
                { label: 'Default Order', value: 'default' },
                { label: 'Name (A to Z)', value: 'name_asc' },
                { label: 'Name (Z to A)', value: 'name_desc' },
                { label: 'Price (Low to High)', value: 'price_asc' },
                { label: 'Price (High to Low)', value: 'price_desc' }
            ],
            sortFn: (list, val) => {
                const arr = [...list];
                if (val === 'name_asc') {
                    arr.sort((a, b) => (a.Item_Name || '').localeCompare(b.Item_Name || ''));
                } else if (val === 'name_desc') {
                    arr.sort((a, b) => (b.Item_Name || '').localeCompare(a.Item_Name || ''));
                } else if (val === 'price_asc') {
                    arr.sort((a, b) => parseFloat(a.Unit_Price || 0) - parseFloat(b.Unit_Price || 0));
                } else if (val === 'price_desc') {
                    arr.sort((a, b) => parseFloat(b.Unit_Price || 0) - parseFloat(a.Unit_Price || 0));
                }
                return arr;
            },
            filterFn: (it, q) => {
                const str = `${it.Item_Code || ''} ${it.Item_Name || ''} ${it.Category_Type || ''}`.toLowerCase();
                return str.includes(q);
            },
            renderRowFn: (it) => `
                <td><strong>${it.Item_Code}</strong></td>
                <td>${it.Item_Name}</td>
                <td><span class="badge badge-secondary">${it.Category_Type}</span></td>
                <td><strong>₱${parseFloat(it.Unit_Price).toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></td>
            `,
            getItemName: (it) => `[${it.Item_Code}] ${it.Item_Name}`,
            onSelect: (it) => {
                document.getElementById('order_catalog_id').value = it.Catalog_ID;
                document.getElementById('order_catalog_name').value = `[${it.Item_Code}] ${it.Item_Name} — ₱${parseFloat(it.Unit_Price).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
            }
        });
    };
    if (btnBrowseCatalog) btnBrowseCatalog.addEventListener('click', handleOpenCatalogPicker);
    if (orderCatalogName) orderCatalogName.addEventListener('click', handleOpenCatalogPicker);

    const btnBrowseRoundDoc = document.getElementById('btnBrowseRoundDoctor');
    const roundDocName = document.getElementById('round_doctor_name');
    const handleOpenRoundDocPicker = () => {
        const roundList = assignedDoctors || [];
        const roundDocTypes = [...new Set(roundList.map(d => d.Doctor_Type).filter(Boolean))];
        openLookupPicker({
            title: 'Select Visiting Physician',
            placeholder: 'Search visiting physician...',
            columns: ['Physician Name', 'Type', 'Standard Bedside Visit Fee'],
            items: roundList,
            filterOptions: [
                { label: 'All Classifications', value: 'all' },
                ...roundDocTypes.map(t => ({ label: t, value: t }))
            ],
            categoryFilterFn: (d, val) => d.Doctor_Type === val,
            sortOptions: [
                { label: 'Default Order', value: 'default' },
                { label: 'Name (A to Z)', value: 'name_asc' },
                { label: 'Name (Z to A)', value: 'name_desc' },
                { label: 'Fee (Low to High)', value: 'fee_asc' },
                { label: 'Fee (High to Low)', value: 'fee_desc' }
            ],
            sortFn: (list, val) => {
                const arr = [...list];
                if (val === 'name_asc') {
                    arr.sort((a, b) => (a.Doctor_Name || '').localeCompare(b.Doctor_Name || ''));
                } else if (val === 'name_desc') {
                    arr.sort((a, b) => (b.Doctor_Name || '').localeCompare(a.Doctor_Name || ''));
                } else if (val === 'fee_asc') {
                    arr.sort((a, b) => parseFloat(a.Base_Round_Fee || 0) - parseFloat(b.Base_Round_Fee || 0));
                } else if (val === 'fee_desc') {
                    arr.sort((a, b) => parseFloat(b.Base_Round_Fee || 0) - parseFloat(a.Base_Round_Fee || 0));
                }
                return arr;
            },
            filterFn: (d, q) => {
                const str = `${d.Doctor_Name || ''} ${d.Doctor_Type || ''} ${d.Doctor_Code || ''}`.toLowerCase();
                return str.includes(q);
            },
            renderRowFn: (d) => `
                <td><strong>${d.Doctor_Name}</strong></td>
                <td><span class="badge badge-info">${d.Doctor_Type}</span></td>
                <td><strong style="color: #0284c7;">₱${parseFloat(d.Base_Round_Fee || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></td>
            `,
            getItemName: (d) => `${d.Doctor_Name} (${d.Doctor_Type})`,
            onSelect: (d) => {
                document.getElementById('round_doctor_id').value = d.Admission_Doctor_ID;
                document.getElementById('round_doctor_name').value = `${d.Doctor_Name} (${d.Doctor_Type})`;
                document.getElementById('round_fee').value = parseFloat(d.Base_Round_Fee || 0).toFixed(2);
            }
        });
    };
    if (btnBrowseRoundDoc) btnBrowseRoundDoc.addEventListener('click', handleOpenRoundDocPicker);
    if (roundDocName) roundDocName.addEventListener('click', handleOpenRoundDocPicker);

    const btnBrowseBed = document.getElementById('btnBrowseTransferBed');
    const transferBedName = document.getElementById('transfer_bed_name');
    const handleOpenBedPicker = () => {
        const showBedPicker = () => {
            const bedList = availableBedsList || [];
            const bedTypes = [...new Set(bedList.map(b => b.Room_Type).filter(Boolean))];
            openLookupPicker({
                title: 'Select Target Vacant Bed',
                placeholder: 'Search vacant bed by room, code, or type...',
                columns: ['Bed Code', 'Room Name', 'Room Type', 'Daily Rate'],
                items: bedList,
                filterOptions: [
                    { label: 'All Room Types', value: 'all' },
                    ...bedTypes.map(t => ({ label: t, value: t }))
                ],
                categoryFilterFn: (b, val) => b.Room_Type === val,
                sortOptions: [
                    { label: 'Default Order', value: 'default' },
                    { label: 'Classification (A to Z)', value: 'type_asc' },
                    { label: 'Classification (Z to A)', value: 'type_desc' },
                    { label: 'Bed Code (A to Z)', value: 'code_asc' },
                    { label: 'Bed Code (Z to A)', value: 'code_desc' },
                    { label: 'Rate (Low to High)', value: 'rate_asc' },
                    { label: 'Rate (High to Low)', value: 'rate_desc' }
                ],
                sortFn: (list, val) => {
                    const arr = [...list];
                    if (val === 'type_asc') {
                        arr.sort((a, b) => {
                            const comp = (a.Room_Type || '').localeCompare(b.Room_Type || '');
                            if (comp !== 0) return comp;
                            return (a.Bed_Code || '').localeCompare(b.Bed_Code || '', undefined, { numeric: true, sensitivity: 'base' });
                        });
                    } else if (val === 'type_desc') {
                        arr.sort((a, b) => {
                            const comp = (b.Room_Type || '').localeCompare(a.Room_Type || '');
                            if (comp !== 0) return comp;
                            return (a.Bed_Code || '').localeCompare(b.Bed_Code || '', undefined, { numeric: true, sensitivity: 'base' });
                        });
                    } else if (val === 'code_asc') {
                        arr.sort((a, b) => (a.Bed_Code || '').localeCompare(b.Bed_Code || '', undefined, { numeric: true, sensitivity: 'base' }));
                    } else if (val === 'code_desc') {
                        arr.sort((a, b) => (b.Bed_Code || '').localeCompare(a.Bed_Code || '', undefined, { numeric: true, sensitivity: 'base' }));
                    } else if (val === 'rate_asc') {
                        arr.sort((a, b) => parseFloat(a.Daily_Rate || 0) - parseFloat(b.Daily_Rate || 0));
                    } else if (val === 'rate_desc') {
                        arr.sort((a, b) => parseFloat(b.Daily_Rate || 0) - parseFloat(a.Daily_Rate || 0));
                    }
                    return arr;
                },
                filterFn: (b, q) => {
                    const str = `${b.Bed_Code || ''} ${b.Room_Name || ''} ${b.Room_Type || ''}`.toLowerCase();
                    return str.includes(q);
                },
                renderRowFn: (b) => `
                    <td><strong>${b.Bed_Code}</strong></td>
                    <td>${b.Room_Name}</td>
                    <td><span class="badge badge-secondary">${b.Room_Type}</span></td>
                    <td><strong>₱${parseFloat(b.Daily_Rate || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}/day</strong></td>
                `,
                getItemName: (b) => `Bed ${b.Bed_Code} (${b.Room_Name} - ${b.Room_Type})`,
                onSelect: (b) => {
                    document.getElementById('transfer_bed_id').value = b.Bed_ID;
                    document.getElementById('transfer_bed_name').value = `${b.Bed_Code} (${b.Room_Name} - ${b.Room_Type}) — ₱${parseFloat(b.Daily_Rate || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}/day`;
                }
            });
        };

        if (availableBedsList && availableBedsList.length > 0) {
            showBedPicker();
        } else {
            const formData = new FormData();
            formData.append('operation', 'getAvailableBeds');
            axios.post(`${getApiUrl}/admissions.php`, formData)
                .then(response => {
                    availableBedsList = response.data || [];
                    showBedPicker();
                })
                .catch(() => {
                    showBedPicker();
                });
        }
    };
    if (btnBrowseBed) btnBrowseBed.addEventListener('click', handleOpenBedPicker);
    if (transferBedName) transferBedName.addEventListener('click', handleOpenBedPicker);
};

const initDiagnosisModal = () => {
    const btnEdit = document.getElementById('btnEditDiagnosis');
    const modal = document.getElementById('diagnosisModal');
    const btnClose = document.getElementById('btnCloseDiagnosisModal');
    const btnCancel = document.getElementById('btnCancelDiagnosis');
    const btnSave = document.getElementById('btnSaveDiagnosis');

    if (!btnEdit || !modal) return;

    const openDiagnosisModal = () => {
        if (!admissionData) return;
        if (admissionData.Status === 'Billed') {
            alert("Diagnosis cannot be modified because this admission is already billed and settled.");
            return;
        }
        document.getElementById('diagnosis-modal-title').textContent = `Record / Update Diagnosis (${admissionData.Patient_Code} - ${admissionData.Full_Name})`;
        document.getElementById('diag-chief-complaint').textContent = admissionData.Chief_Complaint || 'None Recorded';
        document.getElementById('diag_input').value = admissionData.Diagnosis || '';
        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('diag_input').focus(), 100);
    }

    const closeDiagnosisModal = () => {
        modal.style.display = 'none';
    }

    btnEdit.addEventListener('click', openDiagnosisModal);
    if (btnClose) btnClose.addEventListener('click', closeDiagnosisModal);
    if (btnCancel) btnCancel.addEventListener('click', closeDiagnosisModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeDiagnosisModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') closeDiagnosisModal();
    });

    if (btnSave) {
        btnSave.addEventListener('click', saveDiagnosis);
    }
}

const saveDiagnosis = () => {
    if (admissionData && admissionData.Status === 'Billed') {
        alert("Diagnosis cannot be modified because this admission is already billed and settled.");
        return;
    }

    const diagInput = document.getElementById('diag_input');
    const val = diagInput.value.trim();

    if (!val) {
        alert("Please enter the medical diagnosis.");
        diagInput.focus();
        return;
    }

    const payload = {
        admission_id: admissionId,
        diagnosis: val
    };

    const formData = new FormData();
    formData.append('operation', 'updateDiagnosis');
    formData.append('json', JSON.stringify(payload));

    axios.post(`${postApiUrl}/admissions.php`, formData)
        .then(response => {
            if (response.data.success) {
                admissionData.Diagnosis = val;
                const diagEl = document.getElementById('banner-diagnosis');
                if (diagEl) {
                    diagEl.innerHTML = `<span style="color: #0284c7; font-weight: 700;">${val}</span>`;
                }
                document.getElementById('diagnosisModal').style.display = 'none';
                alert(response.data.message || "Clinical diagnosis recorded successfully.");
            } else {
                alert("Error updating diagnosis: " + (response.data.error || "Unknown error"));
            }
        })
        .catch(err => {
            console.error("admission_details.js: Error saving diagnosis:", err);
            alert("Network error saving diagnosis.");
        });
}

const loadAdmissionDetails = () => {
    console.log("admission_details.js: Fetching admission profile for ID:", admissionId);

    const formData = new FormData();
    formData.append('operation', 'getAdmissionById');
    formData.append('json', JSON.stringify({ id: admissionId }));

    axios.post(`${getApiUrl}/admissions.php`, formData)
        .then(response => {
            console.log("admission_details.js: Admission profile received:", response.data);
            if (response.data.error) {
                alert("Error: " + response.data.error, () => {
                    window.location.href = "admissions.html";
                });
                return;
            }

            admissionData = response.data;
            assignedDoctors = admissionData.Assigned_Doctors || [];

            document.getElementById('banner-patient-name').textContent = admissionData.Full_Name;
            document.getElementById('banner-patient-code').textContent = admissionData.Patient_Code;
            document.getElementById('banner-patient-age').textContent = `${admissionData.Date_Of_Birth} (${admissionData.Age} yrs old)`;
            document.getElementById('banner-patient-gender-blood').textContent = `${admissionData.Gender_Name || 'N/A'} / Blood: ${admissionData.Blood_Type_Name || 'N/A'}`;
            
            document.getElementById('banner-bed').textContent = admissionData.Bed_Code || 'Discharged / None';
            document.getElementById('banner-room').textContent = admissionData.Room_Name ? `${admissionData.Room_Name} (${admissionData.Room_Type})` : 'N/A';
            document.getElementById('banner-rate').textContent = admissionData.Daily_Rate ? `₱${parseFloat(admissionData.Daily_Rate).toLocaleString('en-PH', {minimumFractionDigits: 2})}/day` : 'N/A';

            const remBal = parseFloat(admissionData.Remaining_Balance !== undefined && admissionData.Remaining_Balance !== null ? admissionData.Remaining_Balance : 0);
            let statusDisplay = `<span class="badge badge-primary" style="background-color: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; font-weight: 600;">Admitted</span>`;
            if (admissionData.Status === 'Discharged') {
                statusDisplay = `<span class="badge badge-warning" style="font-weight: 600;">Discharged</span>`;
            } else if (admissionData.Status === 'Billed') {
                if (remBal > 0) {
                    statusDisplay = `<span class="badge badge-warning" style="background: #f59e0b; color: #fff; font-weight: 600;">Billed (Balance: ₱${remBal.toLocaleString('en-PH', {minimumFractionDigits: 2})})</span>`;
                } else {
                    statusDisplay = `<span class="badge badge-success" style="font-weight: 600;">Settled (Paid in Full)</span>`;
                }
            }
            document.getElementById('banner-status').innerHTML = `${statusDisplay} <small class="text-muted" style="margin-left: 6px;">(Admitted: ${admissionData.Admission_Date})</small>`;

            document.getElementById('banner-complaint').textContent = admissionData.Chief_Complaint || 'None Recorded';

            const diagEl = document.getElementById('banner-diagnosis');
            if (diagEl) {
                if (admissionData.Diagnosis) {
                    diagEl.innerHTML = `<span style="color: #0284c7; font-weight: 700;">${admissionData.Diagnosis}</span>`;
                } else {
                    diagEl.innerHTML = `<span class="badge badge-warning" style="font-size: 0.8rem;">Pending Clinical Diagnosis</span>`;
                }
            }

            const btnEditDiag = document.getElementById('btnEditDiagnosis');
            if (btnEditDiag) {
                if (admissionData.Status === 'Billed') {
                    btnEditDiag.disabled = true;
                    btnEditDiag.title = "Diagnosis locked: Admission is settled and billed";
                    btnEditDiag.style.cursor = "not-allowed";
                } else {
                    btnEditDiag.disabled = false;
                    btnEditDiag.title = "Edit Clinical Diagnosis";
                    btnEditDiag.style.cursor = "pointer";
                }
            }

            const docNames = assignedDoctors.map(d => `${d.Doctor_Name} (${d.Doctor_Type})`).join(', ');
            document.getElementById('banner-doctors').textContent = docNames || 'None assigned';

            populateAssignedDoctorDropdowns();

            const btnDischarge = document.getElementById('btnChartDischarge');
            if (btnDischarge) {
                if (admissionData.Status === 'Admitted') {
                    btnDischarge.style.display = 'inline-flex';
                    btnDischarge.onclick = () => dischargePatientFromChart(admissionData.Admission_ID, admissionData.Full_Name);
                } else {
                    btnDischarge.style.display = 'none';
                }
            }

            const btnTabPB = document.getElementById('btnTabLedgerPartialBill');
            const btnTabSOA = document.getElementById('btnTabSettlementSOA');

            if (admissionData.Status === 'Admitted') {
                if (btnTabPB) {
                    btnTabPB.disabled = false;
                    btnTabPB.innerHTML = '🖨 Print Partial Bill (Interim)';
                    btnTabPB.title = 'Print running interim statement of accumulated charges';
                    btnTabPB.onclick = () => { window.location.href = `partial_bill.html?admission_id=${admissionId}`; };
                }
                if (btnTabSOA) {
                    btnTabSOA.disabled = true;
                    btnTabSOA.innerHTML = '📋 Final SOA (Disabled — Discharge Patient First)';
                    btnTabSOA.title = 'Disabled: Patient is still admitted. Discharge patient first to generate Official Statement of Account.';
                    btnTabSOA.onclick = null;
                }
            } else if (admissionData.Status === 'Discharged') {
                if (btnTabPB) {
                    btnTabPB.disabled = true;
                    btnTabPB.innerHTML = '🖨 Partial Bill (Disabled — Patient Discharged)';
                    btnTabPB.title = 'Disabled: Patient is already discharged.';
                    btnTabPB.onclick = null;
                }
                if (btnTabSOA) {
                    btnTabSOA.disabled = false;
                    btnTabSOA.innerHTML = '📋 Finalize & Issue SOA';
                    btnTabSOA.title = 'Proceed to finalize Statement of Account';
                    btnTabSOA.onclick = () => {
                        if (switchClinicalTab) switchClinicalTab('tab-settlement');
                    };
                }
            } else if (admissionData.Status === 'Billed') {
                if (btnTabPB) {
                    btnTabPB.disabled = true;
                    btnTabPB.innerHTML = '🖨 Partial Bill (Disabled — Account Billed)';
                    btnTabPB.title = 'Disabled: Account is officially finalized and billed.';
                    btnTabPB.onclick = null;
                }
                if (btnTabSOA) {
                    btnTabSOA.disabled = false;
                    btnTabSOA.innerHTML = '📋 View Final Statement of Account (SOA)';
                    btnTabSOA.title = 'View and print the official Final Statement of Account';
                    btnTabSOA.onclick = () => { window.location.href = `invoice_print.html?admission_id=${admissionId}`; };
                }
            }

            updateWorkflowStepper(admissionData.Status, remBal);

            const btnOpenOrder = document.getElementById('btnOpenOrderModal');
            const btnOpenRound = document.getElementById('btnOpenRoundModal');
            const btnOpenTransfer = document.getElementById('btnOpenTransferModal');
            const btnOpenReturn = document.getElementById('btnOpenReturnModal');
            const btnOpenReturnPharm = document.getElementById('btnOpenReturnModalPharmacy');
            const isAdmitted = admissionData.Status === 'Admitted';

            if (btnOpenOrder) {
                btnOpenOrder.disabled = !isAdmitted;
                btnOpenOrder.title = isAdmitted ? '' : 'Disabled: Patient is already discharged or billed.';
            }
            if (btnOpenRound) {
                btnOpenRound.disabled = !isAdmitted;
                btnOpenRound.title = isAdmitted ? '' : 'Disabled: Patient is already discharged or billed.';
            }
            if (btnOpenTransfer) {
                btnOpenTransfer.disabled = !isAdmitted;
                btnOpenTransfer.title = isAdmitted ? '' : 'Disabled: Patient is already discharged or billed.';
            }
            if (btnOpenReturn) {
                btnOpenReturn.disabled = !isAdmitted;
                btnOpenReturn.title = isAdmitted ? '' : 'Disabled: Patient is already discharged or billed.';
            }
            if (btnOpenReturnPharm) {
                btnOpenReturnPharm.disabled = !isAdmitted;
                btnOpenReturnPharm.title = isAdmitted ? '' : 'Disabled: Patient is already discharged or billed.';
            }
            const btnOpenAdvPay = document.getElementById('btnOpenAdvancePaymentModal');
            if (btnOpenAdvPay) {
                btnOpenAdvPay.disabled = !isAdmitted;
                btnOpenAdvPay.title = isAdmitted ? '' : 'Disabled: Patient is already discharged or billed.';
                btnOpenAdvPay.style.display = isAdmitted ? 'inline-block' : 'none';
            }

            const btnSubOrder = document.getElementById('btnSubmitOrder');
            const btnSubRound = document.getElementById('btnLogRound');
            const btnSubTransfer = document.getElementById('btnTransferBed');
            const btnSubReturn = document.getElementById('btnReturnMedicine');
            if (btnSubOrder) btnSubOrder.disabled = !isAdmitted;
            if (btnSubRound) btnSubRound.disabled = !isAdmitted;
            if (btnSubTransfer) btnSubTransfer.disabled = !isAdmitted;
            if (btnSubReturn) btnSubReturn.disabled = !isAdmitted;
        })
        .catch(err => {
            console.error("admission_details.js: Error loading admission details:", err);
            alert("Failed to load admission details.");
        });
};

const dischargePatientFromChart = (admId, patientName) => {
    showPopupConfirm(`Are you sure you want to discharge patient "${patientName}" (Admission #${admId})?\n\nThis will close the active bed stay, automatically post the final Board & Lodging fee to their Billing Ledger, and release the bed for other patients.`, () => {
        const formData = new FormData();
        formData.append('operation', 'dischargePatient');
        formData.append('json', JSON.stringify({ admission_id: admId }));

        axios.post(`${postApiUrl}/admissions.php`, formData)
            .then(response => {
                if (response.data.success) {
                    alert(response.data.message);
                    loadAdmissionDetails();
                    loadBedHistory();
                    loadLedger();
                    loadLedgerSummary();
                } else {
                    alert("Discharge Error: " + (response.data.error || "Unknown error"));
                }
            })
            .catch(err => {
                console.error("admission_details.js: Error discharging patient:", err);
                alert("Network error discharging patient.");
            });
    }, null, {
        title: "Confirm Clinical Discharge",
        confirmText: "Discharge Patient",
        type: "warning"
    });
};

const populateAssignedDoctorDropdowns = () => {
    filterOrderDoctors();
    filterRoundDoctors();
}

const filterOrderDoctors = () => {
    const select = document.getElementById('order_doctor_id');
    if (!select || select.tagName !== 'SELECT') return;
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

const filterRoundDoctors = () => {
    const select = document.getElementById('round_doctor_id');
    if (!select || select.tagName !== 'SELECT') return;
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

const loadCatalogItems = () => {
    console.log("admission_details.js: Fetching charge catalog items...");

    const formData = new FormData();
    formData.append('operation', 'getCatalogList');

    axios.post(`${getApiUrl}/clinical_orders.php`, formData)
        .then(response => {
            console.log("admission_details.js: Catalog items received:", response.data);
            catalogItems = response.data || [];
            filterCatalogItems();
        })
        .catch(err => {
            console.error("admission_details.js: Error fetching catalog:", err);
        });
}

const filterCatalogItems = () => {
    const select = document.getElementById('order_catalog_id');
    if (!select || select.tagName !== 'SELECT') return;
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

const loadOrders = () => {
    console.log("admission_details.js: Loading orders for admission ID:", admissionId);

    const formData = new FormData();
    formData.append('operation', 'getDoctorOrders');
    formData.append('json', JSON.stringify({ admission_id: admissionId }));

    axios.post(`${getApiUrl}/clinical_orders.php`, formData)
        .then(response => {
            console.log("admission_details.js: Orders received:", response.data);
            renderOrdersTable(response.data);
        })
        .catch(err => {
            console.error("admission_details.js: Error loading orders:", err);
        });
}

const renderOrdersTable = (orders) => {
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

const submitDoctorOrder = () => {
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

    axios.post(`${postApiUrl}/clinical_orders.php`, formData)
        .then(response => {
            console.log("admission_details.js: Order creation response:", response.data);
            if (response.data.success) {
                alert(response.data.message);
                closeModal('orderModal');
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

window.administerOrder = (requestId) => {
    console.log("admission_details.js: Administering order ID:", requestId);

    showPopupConfirm("Confirm administration / dispensation of this order?\n\nThis will mark the order as 'Administered' and automatically post the charge to the Live Billing Ledger.", () => {
        const formData = new FormData();
        formData.append('operation', 'administerOrder');
        formData.append('json', JSON.stringify({ request_id: requestId }));

        axios.post(`${postApiUrl}/clinical_orders.php`, formData)
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
    }, null, {
        title: "Confirm Administration",
        confirmText: "Administer",
        type: "info"
    });
};

window.cancelOrder = (requestId) => {
    console.log("admission_details.js: Cancelling order ID:", requestId);

    showPopupConfirm("Are you sure you want to cancel this pending order?", () => {
        const formData = new FormData();
        formData.append('operation', 'cancelOrder');
        formData.append('json', JSON.stringify({ request_id: requestId }));

        axios.post(`${postApiUrl}/clinical_orders.php`, formData)
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
    }, null, {
        title: "Cancel Order",
        confirmText: "Cancel Order",
        type: "warning"
    });
};

const loadRounds = () => {
    console.log("admission_details.js: Loading rounds for admission ID:", admissionId);

    const formData = new FormData();
    formData.append('operation', 'getDoctorRounds');
    formData.append('json', JSON.stringify({ admission_id: admissionId }));

    axios.post(`${getApiUrl}/clinical_orders.php`, formData)
        .then(response => {
            console.log("admission_details.js: Rounds received:", response.data);
            renderRoundsTable(response.data);
        })
        .catch(err => {
            console.error("admission_details.js: Error loading rounds:", err);
        });
}

const renderRoundsTable = (rounds) => {
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

const submitDoctorRound = () => {
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

    axios.post(`${postApiUrl}/clinical_orders.php`, formData)
        .then(response => {
            console.log("admission_details.js: Round logged response:", response.data);
            if (response.data.success) {
                alert(response.data.message);
                closeModal('roundModal');
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

const loadTransfers = () => {
    console.log("admission_details.js: Loading bed transfer history...");

    const formData = new FormData();
    formData.append('operation', 'getBedTransfers');
    formData.append('json', JSON.stringify({ admission_id: admissionId }));

    axios.post(`${getApiUrl}/admissions.php`, formData)
        .then(response => {
            console.log("admission_details.js: Bed transfers received:", response.data);
            renderTransfersTable(response.data);
        })
        .catch(err => {
            console.error("admission_details.js: Error loading transfers:", err);
        });
}

const renderTransfersTable = (transfers) => {
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
        const rawRate = parseFloat(t.Daily_Rate || t.Room_Rate || 0);
        const rate = isNaN(rawRate) ? '0.00' : rawRate.toLocaleString('en-PH', {minimumFractionDigits: 2});
        const fee = t.Total_Room_Fee ? `₱${parseFloat(t.Total_Room_Fee).toLocaleString('en-PH', {minimumFractionDigits: 2})}` : '<span class="text-muted">Accumulating...</span>';
        const isCurrent = (t.Is_Current == 1 || t.Is_Current_Stay == 1 || !t.Date_Out || t.Date_Out === 'Currently In Bed');

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

const loadAvailableBeds = () => {
    console.log("admission_details.js: Fetching vacant beds for transfer...");

    const formData = new FormData();
    formData.append('operation', 'getAvailableBeds');

    axios.post(`${getApiUrl}/admissions.php`, formData)
        .then(response => {
            availableBedsList = response.data || [];
            filterAvailableBeds();
        })
        .catch(err => {
            console.error("admission_details.js: Error fetching vacant beds:", err);
        });
}

const filterAvailableBeds = () => {
    const select = document.getElementById('transfer_bed_id');
    if (!select || select.tagName !== 'SELECT') return;
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
        const rate = parseFloat(b.Daily_Rate || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
        opt.textContent = `Bed: ${b.Bed_Code} | ${b.Room_Name} (${b.Room_Type}) — ₱${rate}/day`;
        if (String(b.Bed_ID) === String(currentVal)) opt.selected = true;
        select.appendChild(opt);
    });
}

const submitBedTransfer = () => {
    console.log("admission_details.js: Submitting bed transfer...");

    const newBedId = document.getElementById('transfer_bed_id').value;

    if (!newBedId) {
        alert("Please select a target vacant bed.");
        return;
    }

    showPopupConfirm("Are you sure you want to transfer this patient to the selected bed?\n\nThis will automatically calculate the prior bed stay, post the room fee to the Live Billing Ledger, free the old bed, and occupy the new bed.", () => {
        const payload = {
            admission_id: admissionId,
            new_bed_id: newBedId
        };

        const formData = new FormData();
        formData.append('operation', 'transferBed');
        formData.append('json', JSON.stringify(payload));

        axios.post(`${postApiUrl}/admissions.php`, formData)
            .then(response => {
                console.log("admission_details.js: Bed transfer response:", response.data);
                if (response.data.success) {
                    alert(response.data.message);
                    closeModal('transferModal');
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
    }, null, {
        title: "Confirm Bed Transfer",
        confirmText: "Transfer Bed",
        type: "warning"
    });
};

const loadLedger = () => {
    console.log("admission_details.js: Loading billing ledger for admission ID:", admissionId);

    const formData = new FormData();
    formData.append('operation', 'getAdmissionLedger');
    formData.append('json', JSON.stringify({ admission_id: admissionId }));

    axios.post(`${getApiUrl}/ledger.php`, formData)
        .then(response => {
            console.log("admission_details.js: Ledger rows received:", response.data);
            renderLedgerTable(response.data);
        })
        .catch(err => {
            console.error("admission_details.js: Error loading ledger:", err);
        });
}

const renderLedgerTable = (ledger) => {
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

const loadLedgerSummary = () => {
    console.log("admission_details.js: Loading ledger financial summary...");

    const formData = new FormData();
    formData.append('operation', 'getLedgerSummary');
    formData.append('json', JSON.stringify({ admission_id: admissionId }));

    axios.post(`${getApiUrl}/ledger.php`, formData)
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

const renderSummaryBox = (summary) => {
    const container = document.getElementById('ledger-summary-div');

    const room = parseFloat(summary.room_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const doc = parseFloat(summary.doctor_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const med = parseFloat(summary.medicine_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const scan = parseFloat(summary.scan_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const srv = parseFloat(summary.service_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const gross = parseFloat(summary.gross_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const returns = parseFloat(summary.return_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const net = parseFloat(summary.net_total || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
    const advPaid = parseFloat(summary.advance_payments_total || 0);
    const balDue = parseFloat(summary.balance_due !== undefined ? summary.balance_due : Math.max(0, (summary.net_total || 0) - advPaid));
    const formattedAdv = advPaid.toLocaleString('en-PH', {minimumFractionDigits: 2});
    const formattedBal = balDue.toLocaleString('en-PH', {minimumFractionDigits: 2});

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
    if (advPaid > 0) {
        html += `<tr style="background-color: #f0fdf4;"><td><strong style="color: #16a34a;">Less: Total Advance Payments &amp; Deposits Paid:</strong></td><td align="right"><strong style="color: #16a34a;">-₱${formattedAdv}</strong></td></tr>`;
        html += `<tr style="background-color: #eff6ff;"><td><h3 style="margin: 4px 0; color: #1e3a8a;">ESTIMATED UNPAID RUNNING BALANCE:</h3></td><td align="right"><h3 style="margin: 4px 0; color: #1e3a8a;">₱${formattedBal}</h3></td></tr>`;
    }
    html += '</tbody></table>';

    container.innerHTML = html;
};

const loadDispensedMedicines = () => {
    console.log("admission_details.js: Loading dispensed medicines for returns...");

    const formData = new FormData();
    formData.append('operation', 'getDispensedMedicines');
    formData.append('json', JSON.stringify({ admission_id: admissionId }));

    axios.post(`${getApiUrl}/ledger.php`, formData)
        .then(response => {
            console.log("admission_details.js: Dispensed medicines received:", response.data);
            dispensedMedicinesList = response.data || [];
            filterDispensedMedicines();
        })
        .catch(err => {
            console.error("admission_details.js: Error loading dispensed medicines:", err);
        });
}

const openReturnMedicinePicker = () => {
    openGenericLookupPicker({
        title: "Select Dispensed Medicine to Return",
        items: dispensedMedicinesList.map(m => ({
            id: m.Catalog_ID,
            text: `[${m.Item_Code}] ${m.Item_Name}`,
            subtext: `Available to return: ${m.Total_Dispensed} unit(s)`,
            badge: `${m.Total_Dispensed} units`,
            badgeClass: "badge-primary"
        })),
        selectedId: document.getElementById("return_catalog_id").value,
        onSelect: (item) => {
            document.getElementById("return_catalog_id").value = item.id;
            document.getElementById("return_catalog_id_text").value = item.text;
            const match = dispensedMedicinesList.find(x => String(x.Catalog_ID) === String(item.id));
            if (match) {
                document.getElementById("return_qty").value = match.Total_Dispensed;
                document.getElementById("return_qty").setAttribute("max", match.Total_Dispensed);
                document.getElementById("return_qty").dataset.max = match.Total_Dispensed;
            }
        }
    });
};

const filterDispensedMedicines = () => {};

const submitMedicineReturn = () => {
    const catalogId = document.getElementById('return_catalog_id').value;
    const qty = parseFloat(document.getElementById('return_qty').value);

    if (!catalogId) {
        alert("Please select a dispensed medicine to return.");
        return;
    }

    if (isNaN(qty) || qty <= 0) {
        alert("Please enter a valid return quantity.");
        return;
    }

    const match = dispensedMedicinesList.find(x => String(x.Catalog_ID) === String(catalogId));
    const maxAvailable = match ? parseFloat(match.Total_Dispensed) : parseFloat(document.getElementById('return_qty').dataset.max || 0);

    if (qty > maxAvailable) {
        alert(`Cannot return ${qty} unit(s). Only ${maxAvailable} unit(s) are eligible for return.`);
        return;
    }

    const returnMsg = `Confirm return of ${qty} unit(s)?\n\nThis will post a negative credit adjustment to the Live Billing Ledger.`;
    showPopupConfirm(returnMsg, () => {
        const payload = {
            admission_id: admissionId,
            catalog_id: catalogId,
            quantity: qty
        };

        const formData = new FormData();
        formData.append('operation', 'returnMedicine');
        formData.append('json', JSON.stringify(payload));

        axios.post(`${postApiUrl}/ledger.php`, formData)
            .then(response => {
                if (response.data.success) {
                    closeModal('returnModal');
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
            .catch(() => {
                alert("Network error processing medicine return.");
            });
    }, null, { title: 'Confirm Medicine Return', confirmText: 'Process Return', type: 'warning' });
};

const getPaymentMethodOptionsHtml = (selectedId = 1) => {
    let opts = '';
    if (!paymentMethodsList || paymentMethodsList.length === 0) {
        opts = '<option value="1">Cash (Cash)</option>';
        return opts;
    }
    paymentMethodsList.forEach(pm => {
        const isSel = pm.Payment_Method_ID == selectedId ? 'selected' : '';
        opts += `<option value="${pm.Payment_Method_ID}" ${isSel}>${pm.Method_Name} (${pm.Category_Type})</option>`;
    });
    return opts;
};

const openAdvancePaymentModal = () => {
    if (!admissionData) {
        showPopupAlert('Admission details not loaded yet.', 'warning');
        return;
    }

    const netCharges = latestSummary ? parseFloat(latestSummary.net_total || 0) : 0;
    const advPaid = latestSummary ? parseFloat(latestSummary.advance_payments_total || 0) : 0;
    const unpaidBal = latestSummary && latestSummary.balance_due !== undefined ? parseFloat(latestSummary.balance_due) : Math.max(0, netCharges - advPaid);

    const elPatient = document.getElementById('adv_patient_name');
    const elAdmCode = document.getElementById('adv_admission_code');
    const elRunning = document.getElementById('adv_running_charges');
    const elPaid = document.getElementById('adv_prior_paid');
    const elBal = document.getElementById('adv_unpaid_balance');

    if (elPatient) elPatient.textContent = admissionData.Full_Name || 'Patient';
    if (elAdmCode) elAdmCode.textContent = admissionData.Admission_Code || ('ADM-' + String(admissionId).padStart(3, '0'));
    if (elRunning) elRunning.textContent = `₱${netCharges.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
    if (elPaid) elPaid.textContent = `₱${advPaid.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
    if (elBal) elBal.textContent = `₱${unpaidBal.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

    const inputMethodId = document.getElementById('adv_method_id');
    const inputMethodText = document.getElementById('adv_method_id_text');
    const inputAmount = document.getElementById('adv_amount_input');
    const inputNotes = document.getElementById('adv_notes_input');

    if (inputMethodId) inputMethodId.value = '1';
    if (inputMethodText) inputMethodText.value = 'Cash (Cash)';
    if (inputAmount) inputAmount.value = '';
    if (inputNotes) inputNotes.value = '';

    openModal('advancePaymentModal');
};

const openAdvancePaymentMethodPicker = () => {
    if (!paymentMethodsList || paymentMethodsList.length === 0) {
        const fd = new FormData();
        fd.append('operation', 'getPaymentMethods');
        axios.post(`${getApiUrl}/invoices.php`, fd).then(res => {
            paymentMethodsList = res.data || [];
            showAdvanceMethodPicker();
        }).catch(() => {
            showAdvanceMethodPicker();
        });
        return;
    }
    showAdvanceMethodPicker();
};

const showAdvanceMethodPicker = () => {
    const list = (paymentMethodsList && paymentMethodsList.length > 0) ? paymentMethodsList : [
        { Payment_Method_ID: 1, Method_Name: 'Cash', Category_Type: 'Cash' },
        { Payment_Method_ID: 2, Method_Name: 'GCash', Category_Type: 'E-Wallet' },
        { Payment_Method_ID: 3, Method_Name: 'Maya', Category_Type: 'E-Wallet' },
        { Payment_Method_ID: 4, Method_Name: 'Credit / Debit Card', Category_Type: 'Card' },
        { Payment_Method_ID: 5, Method_Name: 'Bank Wire / Online Transfer', Category_Type: 'Bank' }
    ];

    openGenericLookupPicker({
        title: "Select Payment Method",
        items: list.map(pm => ({
            id: pm.Payment_Method_ID,
            text: `${pm.Method_Name}`,
            subtext: `Category: ${pm.Category_Type || 'Payment'}`,
            badge: pm.Category_Type || 'Payment',
            badgeClass: 'badge-info'
        })),
        selectedId: document.getElementById('adv_method_id') ? document.getElementById('adv_method_id').value : 1,
        onSelect: (item) => {
            const inputId = document.getElementById('adv_method_id');
            const inputText = document.getElementById('adv_method_id_text');
            if (inputId) inputId.value = item.id;
            if (inputText) inputText.value = item.text;
        }
    });
};

const submitAdvancePayment = () => {
    const methodInput = document.getElementById('adv_method_id');
    const methodId = methodInput && methodInput.value ? parseInt(methodInput.value, 10) : 1;
    const amountInput = document.getElementById('adv_amount_input');
    const amt = amountInput ? parseFloat(amountInput.value) : 0;
    const notesInput = document.getElementById('adv_notes_input');
    const notes = notesInput ? notesInput.value.trim() : '';

    if (isNaN(amt) || amt <= 0) {
        showPopupAlert('Please enter a valid deposit amount greater than 0.00.', 'warning');
        return;
    }

    const confirmMsg = `Confirm recording advance deposit of ₱${amt.toLocaleString('en-PH', {minimumFractionDigits: 2})}?\n\nAn official payment receipt (OR) will be issued immediately and the deposit will be credited against the patient's final bill upon discharge.`;

    showPopupConfirm(confirmMsg, () => {
        const userJson = sessionStorage.getItem('hospital_user');
        const user = userJson ? JSON.parse(userJson) : null;
        const uid = user ? (user.user_id || user.User_ID || 1) : 1;

        const payload = {
            admission_id: admissionId,
            user_id: uid,
            payment_amount: amt,
            payment_method_id: methodId,
            notes: notes || 'Advance Patient Deposit'
        };

        const formData = new FormData();
        formData.append('operation', 'recordAdvancePayment');
        formData.append('json', JSON.stringify(payload));

        axios.post(`${postApiUrl}/invoices.php`, formData)
            .then(res => {
                if (res.data && res.data.success) {
                    closeModal('advancePaymentModal');
                    const payId = res.data.payment_id;
                    const rcptNum = res.data.receipt_number || '';
                    const alertMsg = `${res.data.message}\n\nOfficial Receipt: ${rcptNum}\nDeposit Tendered: ₱${parseFloat(res.data.amount_paid).toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

                    loadLedger();
                    loadLedgerSummary();
                    loadAdmissionDetails();

                    showPopupAlert(alertMsg, 'success', 'Advance Payment Accepted', () => {
                        if (payId) {
                            window.location.href = `payment_receipt.html?payment_id=${payId}`;
                        }
                    });
                } else {
                    const err = res.data && res.data.error ? res.data.error : 'Failed to record advance payment.';
                    showPopupAlert('Advance Payment Error: ' + err, 'danger');
                }
            })
            .catch(() => {
                showPopupAlert('Network error processing advance payment.', 'danger');
            });
    }, null, {
        title: 'Confirm Advance Payment',
        confirmText: 'Post Advance Payment',
        type: 'info'
    });
};

const renderAdmittedAdvanceBillingCard = (advList) => {
    const container = document.getElementById('settlement-container');
    if (!container) return;

    const runningGross = latestSummary ? parseFloat(latestSummary.net_total || 0) : 0;
    const totalAdvPaid = advList.reduce((acc, p) => acc + parseFloat(p.Amount_Paid || 0), 0);
    const unpaidBal = Math.max(0, runningGross - totalAdvPaid);

    const formattedRunning = runningGross.toLocaleString('en-PH', {minimumFractionDigits: 2});
    const formattedAdv = totalAdvPaid.toLocaleString('en-PH', {minimumFractionDigits: 2});
    const formattedBal = unpaidBal.toLocaleString('en-PH', {minimumFractionDigits: 2});

    let advRowsHtml = '';
    if (advList.length === 0) {
        advRowsHtml = '<tr><td colspan="7" class="text-muted text-center" style="padding: 16px;"><em>No advance payments recorded yet for this admission. The patient or relatives may make advance deposits at any time.</em></td></tr>';
    } else {
        advList.forEach(p => {
            const pAmt = parseFloat(p.Amount_Paid || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
            const methodBadge = `<span class="badge badge-info">${p.Payment_Method || 'Cash'}</span>`;
            advRowsHtml += `
                <tr class="clickable-row" onclick="window.location.href='payment_receipt.html?payment_id=${p.Payment_ID}'" title="Click to view Official Receipt">
                    <td><strong style="color: #0284c7;">${p.Receipt_Number}</strong></td>
                    <td>${p.Formatted_Payment_Date || p.Payment_Date}</td>
                    <td>${methodBadge}</td>
                    <td>${p.Cashier_Name || 'Cashier Staff'}</td>
                    <td align="right"><strong style="color: #16a34a;">₱${pAmt}</strong></td>
                    <td>${p.Notes || 'Advance Patient Deposit'}</td>
                    <td align="center">
                        <button type="button" class="btn btn-sm btn-outline" onclick="event.stopPropagation(); window.location.href='payment_receipt.html?payment_id=${p.Payment_ID}'" style="white-space: nowrap; font-weight: 600;">🧾 Print OR</button>
                    </td>
                </tr>
            `;
        });
    }

    container.innerHTML = `
        <div class="card p-4" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                <h3 style="margin: 0; color: #0f172a;">Stage 3: Advance Billing &amp; Pre-Discharge Deposits</h3>
                <span class="badge badge-warning" style="font-size: 13px; padding: 6px 12px;">PATIENT CURRENTLY ADMITTED</span>
            </div>
            <p class="text-muted mb-3">This patient is currently staying in Bed <strong>${admissionData.Bed_Code || 'Assigned Bed'}</strong>. Bed board & lodging and clinical charges continue to accumulate daily.</p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 18px;">
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; border-left: 4px solid #3b82f6;">
                    <div style="font-size: 12.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Running Charges To Date</div>
                    <div style="font-size: 22px; font-weight: 800; color: #1e293b; margin-top: 4px;">₱${formattedRunning}</div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">Net of medicine returns</div>
                </div>
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; border-left: 4px solid #16a34a;">
                    <div style="font-size: 12.5px; font-weight: 700; color: #16a34a; text-transform: uppercase;">Total Advance Deposits Paid</div>
                    <div style="font-size: 22px; font-weight: 800; color: #16a34a; margin-top: 4px;">₱${formattedAdv}</div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">Official Receipts issued</div>
                </div>
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; border-left: 4px solid #f59e0b;">
                    <div style="font-size: 12.5px; font-weight: 700; color: #b45309; text-transform: uppercase;">Estimated Unpaid Balance</div>
                    <div style="font-size: 22px; font-weight: 800; color: #b45309; margin-top: 4px;">₱${formattedBal}</div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">Running charges less deposits</div>
                </div>
            </div>

            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 14px; margin-bottom: 18px;">
                <strong style="color: #1e40af;">Pre-Discharge Advance Payment Policy</strong>
                <p style="margin: 4px 0 0; font-size: 13.5px; color: #1e3a8a;">Patients and relatives may make deposits at any time during admission. All advance payments immediately produce Official Receipts (OR) and will be automatically credited against the final bill upon clinical discharge.</p>
            </div>

            <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 20px;">
                <button type="button" class="btn btn-primary" onclick="openAdvancePaymentModal()">💵 Record Advance Payment</button>
                <button type="button" class="btn btn-outline" onclick="window.location.href='partial_bill.html?admission_id=${admissionId}'">🖨 Print Interim Partial Bill</button>
                <button type="button" class="btn btn-danger" onclick="dischargePatientFromChart(${admissionData.Admission_ID}, '${admissionData.Full_Name}')">🚪 Discharge Patient Now &amp; Unlock SOA</button>
            </div>

            <div class="card p-3" style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <h4 style="margin: 0; color: #1e293b;">Advance Deposits &amp; Official Receipts History</h4>
                    <span class="text-muted" style="font-size: 13px;">Pre-discharge payments recorded for this admission</span>
                </div>
                <div class="table-responsive">
                    <table class="data-table" style="font-size: 13.5px;">
                        <thead>
                            <tr>
                                <th>Official Receipt #</th>
                                <th>Date &amp; Time</th>
                                <th>Payment Method</th>
                                <th>Cashier</th>
                                <th style="text-align: right;">Amount Paid</th>
                                <th>Particulars / Notes</th>
                                <th style="text-align: center;">Official Receipt</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${advRowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
};

const renderPaymentHistoryTable = (invId, admId, targetEl) => {
    const formData = new FormData();
    formData.append('operation', 'getPaymentHistory');
    formData.append('json', JSON.stringify({ invoice_id: invId, admission_id: admId }));

    axios.post(`${getApiUrl}/invoices.php`, formData)
        .then(res => {
            let list = res.data;
            if (typeof list === 'string') {
                try { list = JSON.parse(list); } catch (e) {}
            }
            if (!Array.isArray(list) || list.length === 0) {
                targetEl.innerHTML = '<p class="text-muted" style="margin: 8px 0;"><em>No payment transactions recorded yet.</em></p>';
                return;
            }

            let rows = '';
            list.forEach(p => {
                const amt = parseFloat(p.Amount_Paid || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
                const bal = parseFloat(p.Balance_After || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
                const isPaid = parseFloat(p.Balance_After || 0) <= 0;
                const methodBadge = `<span class="badge badge-info">${p.Payment_Method || 'Cash'}</span>`;

                rows += `
                    <tr class="clickable-row" onclick="window.location.href='payment_receipt.html?payment_id=${p.Payment_ID}'" title="Click row to view / print Official Receipt voucher">
                        <td><strong style="color: #0284c7;">${p.Receipt_Number}</strong></td>
                        <td>${p.Payment_Date}</td>
                        <td>${methodBadge}</td>
                        <td>${p.Cashier_Name}</td>
                        <td align="right"><strong style="color: #16a34a;">₱${amt}</strong></td>
                        <td align="right"><strong style="color: ${isPaid ? '#16a34a' : '#dc2626'};">₱${bal}</strong></td>
                        <td>${p.Notes || '-'}</td>
                        <td align="center"><button type="button" class="btn btn-sm btn-outline" onclick="event.stopPropagation(); window.location.href='payment_receipt.html?payment_id=${p.Payment_ID}'" style="white-space: nowrap; font-weight: 600;">🧾 Print OR</button></td>
                    </tr>
                `;
            });

            targetEl.innerHTML = `
                <table class="data-table" style="font-size: 13.5px;">
                    <thead>
                        <tr>
                            <th>Official Receipt #</th>
                            <th>Date & Time</th>
                            <th>Payment Method</th>
                            <th>Cashier</th>
                            <th style="text-align: right;">Amount Paid</th>
                            <th style="text-align: right;">Remaining Bal</th>
                            <th>Notes / Remarks</th>
                            <th style="text-align: center;">Official Receipt</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            `;
        })
        .catch(() => {
            targetEl.innerHTML = '<p class="text-danger">Failed to load payment transaction history.</p>';
        });
};

const loadDiscounts = () => {
    const p1 = axios.post(`${getApiUrl}/invoices.php`, (() => {
        const fd = new FormData();
        fd.append('operation', 'getDiscountList');
        return fd;
    })());

    const p2 = axios.post(`${getApiUrl}/invoices.php`, (() => {
        const fd = new FormData();
        fd.append('operation', 'getPaymentMethods');
        return fd;
    })());

    Promise.all([p1, p2])
        .then(([resDisc, resPay]) => {
            discountList = resDisc.data || [];
            paymentMethodsList = resPay.data || [];
            renderSettlementSection();
        })
        .catch(() => {
            renderSettlementSection();
        });
};

const renderBilledSettlementCard = (inv) => {
    const container = document.getElementById('settlement-container');
    if (!container) return;

    if (!inv || inv.error) {
        container.innerHTML = `
            <div class="card p-3" style="background-color: #f0fff4; border: 1px solid #48bb78; border-radius: 8px;">
                <h3 style="margin-top:0; color: #276749;">✔ THIS ADMISSION HAS BEEN OFFICIALLY SETTLED & BILLED</h3>
                <p class="text-muted">The billing invoice and official Statement of Account (SOA) have been generated and finalized.</p>
                <button type="button" class="btn btn-primary" onclick="window.location.href='invoice_print.html?admission_id=${admissionId}'">🖨 View / Print Official Statement of Account (SOA)</button>
            </div>
        `;
        return;
    }

    const netDue = parseFloat(inv.Net_Amount_Due || 0);
    const amountPaid = parseFloat(inv.Amount_Paid || 0);
    const remainingBal = parseFloat(inv.Remaining_Balance !== undefined && inv.Remaining_Balance !== null ? inv.Remaining_Balance : Math.max(0, netDue - amountPaid));
    const grossTotal = parseFloat(inv.Gross_Total || 0);
    const discountAmt = parseFloat(inv.Discount_Amount || 0);
    const changeAmt = parseFloat(inv.Change_Amount || 0);

    const vatRate = parseFloat(inv.VAT_Rate !== undefined && inv.VAT_Rate !== null ? inv.VAT_Rate : 12.00);
    const vatAmt = parseFloat(inv.VAT_Amount || 0);
    const vatableAmt = parseFloat(inv.VATable_Amount || 0);
    const vatExemptAmt = parseFloat(inv.VAT_Exempt_Amount || 0);

    let discountDetailsHtml = 'None (₱0.00)';
    if (inv.Applied_Discounts && Array.isArray(inv.Applied_Discounts) && inv.Applied_Discounts.length > 0) {
        discountDetailsHtml = inv.Applied_Discounts.map(ad => {
            const valStr = ad.Discount_Type === 'Fixed' 
                ? `Fixed: ₱${parseFloat(ad.Discount_Value || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}` 
                : `${parseFloat(ad.Discount_Value || 0).toFixed(2)}%`;
            return `<div>• <strong>${ad.Discount_Name}</strong> (${valStr}) — <span style="color: #166534; font-weight: 600;">-₱${parseFloat(ad.Calculated_Deduction || 0).toLocaleString('en-PH', {minimumFractionDigits: 2})}</span></div>`;
        }).join('');
    } else if (inv.Discount_Summary) {
        const discItems = inv.Discount_Summary.split(/;\s*|<br\s*\/?>/i).map(s => s.trim()).filter(Boolean);
        discountDetailsHtml = `${discItems.join('<br>')} — <span style="color: #166534; font-weight: 600;">-₱${discountAmt.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>`;
    } else if (discountAmt > 0) {
        discountDetailsHtml = `${inv.Discount_Name || 'Statutory Discount'} (${parseFloat(inv.Discount_Percentage || 0).toFixed(2)}%) — <span style="color: #166534; font-weight: 600;">-₱${discountAmt.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>`;
    }

    let vatDetailsHtml = '';
    if (vatRate === 0 || vatExemptAmt > 0) {
        vatDetailsHtml = '<span class="badge badge-success" style="font-size: 13px;">₱0.00 (12% VAT-Exempt — Senior/PWD)</span>';
    } else {
        vatDetailsHtml = `+₱${vatAmt.toLocaleString('en-PH', {minimumFractionDigits: 2})} <span class="text-muted" style="font-size: 13px;">(12% VAT on ₱${vatableAmt.toLocaleString('en-PH', {minimumFractionDigits: 2})})</span>`;
    }

    const netBeforeTax = (vatableAmt > 0 ? vatableAmt : (vatExemptAmt > 0 ? vatExemptAmt : Math.max(0, grossTotal - discountAmt)));

    updateWorkflowStepper('Billed', remainingBal);

    if (remainingBal <= 0) {
        container.innerHTML = `
            <div class="card p-4" style="background-color: #f0fff4; border: 1px solid #48bb78; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                    <h3 style="margin: 0; color: #276749;">✔ THIS ADMISSION HAS BEEN FULLY SETTLED & BILLED</h3>
                    <span class="badge badge-success" style="font-size: 14px; padding: 6px 14px;">PAID IN FULL</span>
                </div>
                <table class="data-table mb-3">
                    <tbody>
                        <tr><td width="40%">Official Invoice Number:</td><td><strong>${inv.Invoice_Code}</strong></td></tr>
                        <tr><td>Gross Charges Assessed:</td><td>₱${grossTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</td></tr>
                        <tr><td>Cumulative Discounts Applied:</td><td>${discountDetailsHtml}</td></tr>
                        <tr><td>Net Billable (Before Tax):</td><td>₱${netBeforeTax.toLocaleString('en-PH', {minimumFractionDigits: 2})}</td></tr>
                        <tr><td>Value-Added Tax (12% VAT):</td><td>${vatDetailsHtml}</td></tr>
                        <tr><td>Net Amount Assessed:</td><td><strong>₱${netDue.toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></td></tr>
                        ${parseFloat(inv.Advance_Payment_Amount || 0) > 0 ? `<tr><td>Pre-Discharge Advance Deposits Credited:</td><td><strong style="color: #16a34a;">-₱${parseFloat(inv.Advance_Payment_Amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></td></tr>` : ''}
                        <tr><td>Total Payments Received:</td><td><strong style="color: #16a34a;">₱${amountPaid.toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></td></tr>
                        ${changeAmt > 0 ? `<tr><td>Customer Change Given:</td><td>₱${changeAmt.toLocaleString('en-PH', {minimumFractionDigits: 2})}</td></tr>` : ''}
                        <tr><td>Remaining Balance Due:</td><td><strong style="color: #16a34a;">₱0.00</strong></td></tr>
                        <tr><td>Settled & Finalized On:</td><td>${inv.Settlement_Date} by ${inv.Cashier_Name}</td></tr>
                    </tbody>
                </table>
                <div style="margin-top: 16px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-primary" onclick="window.location.href='invoice_print.html?id=${inv.Invoice_ID}'">🖨 View / Print Official Statement of Account (SOA)</button>
                </div>

                <div class="card p-3 mt-4" style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                        <h4 style="margin: 0; color: #1e293b;">Cumulative Payment & Installment Transaction History</h4>
                        <span class="text-muted" style="font-size: 13px;">Official cash vouchers & receipts issued for this admission</span>
                    </div>
                    <div id="payment-history-table-wrapper" class="table-responsive">
                        <p class="text-muted">Loading payment transactions...</p>
                    </div>
                </div>
            </div>
        `;

        const wrapper = document.getElementById('payment-history-table-wrapper');
        if (wrapper) {
            renderPaymentHistoryTable(inv.Invoice_ID, inv.Admission_ID, wrapper);
        }
        return;
    }

    container.innerHTML = `
        <div class="card p-4" style="background-color: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                <h3 style="margin: 0; color: #92400e;">⚠️ ADMISSION BILLED — OUTSTANDING BALANCE PENDING</h3>
                <span class="badge badge-danger" style="font-size: 14px; padding: 6px 14px;">BALANCE DUE: ₱${remainingBal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
            </div>
            <p class="text-muted mb-3">This account was settled with a partial or specific-category payment. Follow-up payments can be posted below until the balance is cleared.</p>
            
            <table class="data-table mb-3">
                <tbody>
                    <tr><td width="40%">Official Invoice Number:</td><td><strong>${inv.Invoice_Code}</strong></td></tr>
                    <tr><td>Gross Charges Assessed:</td><td>₱${grossTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</td></tr>
                    <tr><td>Cumulative Discounts Applied:</td><td>${discountDetailsHtml}</td></tr>
                    <tr><td>Net Billable (Before Tax):</td><td>₱${netBeforeTax.toLocaleString('en-PH', {minimumFractionDigits: 2})}</td></tr>
                    <tr><td>Value-Added Tax (12% VAT):</td><td>${vatDetailsHtml}</td></tr>
                    <tr><td>Net Amount Due:</td><td><strong>₱${netDue.toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></td></tr>
                    ${parseFloat(inv.Advance_Payment_Amount || 0) > 0 ? `<tr><td>Pre-Discharge Advance Deposits Credited:</td><td><strong style="color: #16a34a;">-₱${parseFloat(inv.Advance_Payment_Amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></td></tr>` : ''}
                    <tr><td>Total Amount Paid So Far:</td><td><strong style="color: #16a34a;">₱${amountPaid.toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></td></tr>
                    <tr style="background-color: #fef2f2;">
                        <td><strong style="color: #dc2626;">REMAINING BALANCE DUE:</strong></td>
                        <td><strong style="color: #dc2626; font-size: 17px;">₱${remainingBal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></td>
                    </tr>
                </tbody>
            </table>

            <div class="card p-3 mb-3" style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px;">
                <h4 style="margin-top: 0; margin-bottom: 12px; color: #1e293b;">Record Additional Follow-Up Payment</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px;">
                    <div class="form-group">
                        <label class="form-label" for="tab5_additional_payment">Payment Tendered (₱) *</label>
                        <input type="number" id="tab5_additional_payment" class="form-control" step="0.01" min="0.01" value="${remainingBal.toFixed(2)}" style="font-weight: 700; font-size: 16px;">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="tab5_payment_method_id">Payment Method *</label>
                        <select id="tab5_payment_method_id" class="form-select">
                            ${getPaymentMethodOptionsHtml(1)}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="tab5_payment_notes">Notes / Remarks</label>
                        <input type="text" id="tab5_payment_notes" class="form-control" placeholder="e.g. 2nd Installment / Promissory Note">
                    </div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; align-items: center; flex-wrap: wrap;">
                    <button type="button" class="btn btn-secondary" id="btnTab5ExactBalance">Pay Full Balance</button>
                    <button type="button" class="btn btn-primary" id="btnTab5SubmitPayment">Record Payment & Update Invoice</button>
                </div>
                <div id="tab5_payment_calc_row" style="margin-top: 10px; font-size: 13.5px; color: #475569; display: flex; justify-content: flex-end; gap: 20px;">
                    <span>New Remaining Balance: <strong id="tab5_new_bal_display" style="color: #16a34a;">₱0.00</strong></span>
                    <span>Customer Change Given: <strong id="tab5_change_display" style="color: #16a34a;">₱0.00</strong></span>
                </div>
            </div>

            <div style="margin-top: 16px;">
                <button type="button" class="btn btn-primary" onclick="window.location.href='invoice_print.html?id=${inv.Invoice_ID}'">🖨 View / Print Official Statement of Account (SOA)</button>
            </div>

            <div class="card p-3 mt-4" style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <h4 style="margin: 0; color: #1e293b;">Cumulative Payment & Installment Transaction History</h4>
                    <span class="text-muted" style="font-size: 13px;">Official cash vouchers & receipts issued for this admission</span>
                </div>
                <div id="payment-history-table-wrapper" class="table-responsive">
                    <p class="text-muted">Loading payment transactions...</p>
                </div>
            </div>
        </div>
    `;

    const wrapper = document.getElementById('payment-history-table-wrapper');
    if (wrapper) {
        renderPaymentHistoryTable(inv.Invoice_ID, inv.Admission_ID, wrapper);
    }

    const payInput = document.getElementById('tab5_additional_payment');
    const updateTab5PayCalc = () => {
        const val = parseFloat(payInput.value || 0);
        const lblBal = document.getElementById('tab5_new_bal_display');
        const lblChg = document.getElementById('tab5_change_display');

        if (val >= remainingBal) {
            const chg = Math.round((val - remainingBal) * 100) / 100;
            if (lblBal) {
                lblBal.textContent = '₱0.00 (PAID IN FULL)';
                lblBal.style.color = '#16a34a';
            }
            if (lblChg) {
                lblChg.textContent = `₱${chg.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
                lblChg.style.color = '#16a34a';
            }
        } else {
            const newBal = Math.max(0, Math.round((remainingBal - val) * 100) / 100);
            if (lblBal) {
                lblBal.textContent = `₱${newBal.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
                lblBal.style.color = '#dc2626';
            }
            if (lblChg) {
                lblChg.textContent = '₱0.00';
                lblChg.style.color = '#64748b';
            }
        }
    };

    if (payInput) {
        payInput.addEventListener('input', updateTab5PayCalc);
    }

    document.getElementById('btnTab5ExactBalance')?.addEventListener('click', () => {
        if (payInput) {
            payInput.value = remainingBal.toFixed(2);
            updateTab5PayCalc();
        }
    });

    document.getElementById('btnTab5SubmitPayment')?.addEventListener('click', () => {
        const amt = parseFloat(payInput ? payInput.value : 0);
        if (isNaN(amt) || amt <= 0) {
            showPopupAlert('Please enter a valid payment amount greater than zero.', 'warning');
            return;
        }

        const methodSelect = document.getElementById('tab5_payment_method_id');
        const pMethodId = methodSelect ? parseInt(methodSelect.value, 10) : 1;
        const notesInput = document.getElementById('tab5_payment_notes');
        const payNotes = notesInput ? notesInput.value.trim() : '';

        showPopupConfirm(`Confirm payment of ₱${amt.toLocaleString('en-PH', {minimumFractionDigits: 2})} for ${inv.Invoice_Code}?`, () => {
            const userJson = sessionStorage.getItem('hospital_user');
            const user = userJson ? JSON.parse(userJson) : null;
            const uid = user ? (user.user_id || user.User_ID || 1) : 1;

            const payload = {
                invoice_id: inv.Invoice_ID,
                payment_amount: amt,
                payment_method_id: pMethodId,
                notes: payNotes,
                user_id: uid
            };

            const formData = new FormData();
            formData.append('operation', 'recordPayment');
            formData.append('json', JSON.stringify(payload));

            axios.post(`${postApiUrl}/invoices.php`, formData)
                .then(res => {
                    if (res.data.success) {
                        const payId = res.data.payment_id;
                        const rcptNum = res.data.receipt_number || '';
                        let msg = res.data.message;
                        if (rcptNum) {
                            msg += `\nOfficial Receipt: ${rcptNum}`;
                        }
                        showPopupAlert(msg, 'success', 'Payment Recorded', () => {
                            if (payId) {
                                window.location.href = `payment_receipt.html?payment_id=${payId}`;
                            } else {
                                renderSettlementSection();
                            }
                        });
                    } else {
                        showPopupAlert(res.data.error || 'Failed to record payment.', 'danger');
                    }
                })
                .catch(() => {
                    showPopupAlert('Network error recording payment.', 'danger');
                });
        }, null, {
            title: 'Confirm Payment',
            confirmText: 'Post Payment',
            type: 'info'
        });
    });
};

const renderSettlementSection = () => {
    const container = document.getElementById('settlement-container');
    if (!container) return;

    if (!admissionData) {
        container.innerHTML = '<p>Loading admission information...</p>';
        return;
    }

    if (admissionData.Status === 'Billed') {
        const formData = new FormData();
        formData.append('operation', 'getInvoiceById');
        formData.append('json', JSON.stringify({ admission_id: admissionId }));

        axios.post(`${getApiUrl}/invoices.php`, formData)
            .then(res => {
                let inv = res.data;
                if (typeof inv === 'string') {
                    try { inv = JSON.parse(inv); } catch (e) {}
                }
                renderBilledSettlementCard(inv);
            })
            .catch(() => {
                renderBilledSettlementCard(null);
            });
        return;
    }

    if (admissionData.Status === 'Admitted') {
        const formData = new FormData();
        formData.append('operation', 'getAdvancePayments');
        formData.append('json', JSON.stringify({ admission_id: admissionId }));

        axios.post(`${getApiUrl}/invoices.php`, formData)
            .then(res => {
                let list = res.data;
                if (typeof list === 'string') {
                    try { list = JSON.parse(list); } catch (e) {}
                }
                if (list && list.payments && Array.isArray(list.payments)) {
                    list = list.payments;
                } else if (!Array.isArray(list)) {
                    list = [];
                }
                renderAdmittedAdvanceBillingCard(list);
            })
            .catch(() => {
                renderAdmittedAdvanceBillingCard([]);
            });
        return;
    }

    const gross = latestSummary ? parseFloat(latestSummary.net_total || 0) : 0;
    const formattedGross = gross.toLocaleString('en-PH', {minimumFractionDigits: 2});
    const advancePaid = latestSummary ? parseFloat(latestSummary.advance_payments_total || 0) : 0;
    const formattedAdv = advancePaid.toLocaleString('en-PH', {minimumFractionDigits: 2});
    const initialRemaining = Math.max(0, gross - advancePaid);

    const medTotal = latestSummary ? Math.max(0, parseFloat(latestSummary.medicine_total || 0)) : 0;
    const docTotal = latestSummary ? Math.max(0, parseFloat(latestSummary.doctor_total || 0)) : 0;
    const roomTotal = latestSummary ? Math.max(0, parseFloat(latestSummary.room_total || 0)) : 0;
    const scanTotal = latestSummary ? Math.max(0, parseFloat(latestSummary.scan_total || 0)) : 0;
    const srvTotal = latestSummary ? Math.max(0, parseFloat(latestSummary.service_total || 0)) : 0;

    const isOccupyingBed = admissionData.Bed_Code ? `<p style="color: #856404; background-color: #fff3cd; padding: 10px; border-radius: 6px; border: 1px solid #ffeeba;"><strong>Note:</strong> The patient is currently assigned to Bed <strong>${admissionData.Bed_Code}</strong>. Processing settlement will automatically calculate final board & lodging, release the bed as available, and finalize the account.</p>` : '';

    let discountCheckboxesHtml = '';
    discountList.forEach(d => {
        const valText = `${parseFloat(d.Discount_Percentage || 0).toFixed(2)}%`;
        const vatBadge = (d.Is_Vat_Exempt == 1) ? `<span class="badge badge-success" style="font-size: 11px; padding: 2px 7px;">12% VAT EXEMPT</span>` : '';

        discountCheckboxesHtml += `
            <label style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; user-select: none;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" class="discount-checkbox" data-id="${d.Discount_ID}" data-name="${d.Discount_Name}" data-type="Percentage" data-pct="${d.Discount_Percentage}" data-fixed="0.00" data-vat-exempt="${d.Is_Vat_Exempt}" style="width: 17px; height: 17px; cursor: pointer;">
                    <span style="font-weight: 600; font-size: 13.5px; color: #1e293b;">${d.Discount_Name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="badge" style="background: #fef3c7; color: #92400e; font-size: 11.5px; padding: 3px 8px;">${valText}</span>
                    ${vatBadge}
                </div>
            </label>
        `;
    });

    let html = `
        ${isOccupyingBed}
        <div class="card p-3 mb-3" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                <label class="form-label" style="font-size: 14px; font-weight: 700; color: #1e293b; margin: 0;">
                    Pay For Specific Charges / Category (Optional):
                </label>
                <span class="text-muted" style="font-size: 12.5px;">Click a category button or select checkboxes below to pay for specific items now</span>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
                <button type="button" class="btn btn-sm btn-primary cat-quick-btn" data-cat="all">All Charges (Full Bill)</button>
                ${medTotal > 0 ? `<button type="button" class="btn btn-sm btn-outline cat-quick-btn" data-cat="medicine">Drugs & Medicine (₱${medTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})})</button>` : ''}
                ${docTotal > 0 ? `<button type="button" class="btn btn-sm btn-outline cat-quick-btn" data-cat="doctor">Doctor Fees (₱${docTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})})</button>` : ''}
                ${roomTotal > 0 ? `<button type="button" class="btn btn-sm btn-outline cat-quick-btn" data-cat="room">Room & Board (₱${roomTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})})</button>` : ''}
                ${scanTotal > 0 ? `<button type="button" class="btn btn-sm btn-outline cat-quick-btn" data-cat="scan">Diagnostic Imaging (₱${scanTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})})</button>` : ''}
                ${srvTotal > 0 ? `<button type="button" class="btn btn-sm btn-outline cat-quick-btn" data-cat="service">Procedures & Services (₱${srvTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})})</button>` : ''}
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; background: #ffffff; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                ${medTotal > 0 ? `
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 13.5px; cursor: pointer; user-select: none;">
                        <input type="checkbox" class="cat-checkbox" data-cat="medicine" data-name="Drugs & Medicine" data-amount="${medTotal}" checked>
                        <span>Drugs & Medicine: <strong>₱${medTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></span>
                    </label>
                ` : ''}
                ${docTotal > 0 ? `
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 13.5px; cursor: pointer; user-select: none;">
                        <input type="checkbox" class="cat-checkbox" data-cat="doctor" data-name="Doctor Fees" data-amount="${docTotal}" checked>
                        <span>Doctor Fees: <strong>₱${docTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></span>
                    </label>
                ` : ''}
                ${roomTotal > 0 ? `
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 13.5px; cursor: pointer; user-select: none;">
                        <input type="checkbox" class="cat-checkbox" data-cat="room" data-name="Room & Board" data-amount="${roomTotal}" checked>
                        <span>Room & Board: <strong>₱${roomTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></span>
                    </label>
                ` : ''}
                ${scanTotal > 0 ? `
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 13.5px; cursor: pointer; user-select: none;">
                        <input type="checkbox" class="cat-checkbox" data-cat="scan" data-name="Diagnostic Imaging" data-amount="${scanTotal}" checked>
                        <span>Diagnostic Imaging: <strong>₱${scanTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></span>
                    </label>
                ` : ''}
                ${srvTotal > 0 ? `
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 13.5px; cursor: pointer; user-select: none;">
                        <input type="checkbox" class="cat-checkbox" data-cat="service" data-name="Medical Services" data-amount="${srvTotal}" checked>
                        <span>Services: <strong>₱${srvTotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong></span>
                    </label>
                ` : ''}
            </div>
            <div id="cat-scope-notice" style="margin-top: 8px; font-size: 13px; color: #0369a1; font-weight: 600;">
                Paying for: All charges (Full bill)
            </div>
        </div>

        <div class="card p-3 mb-3" style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                <label class="form-label" style="font-size: 14px; font-weight: 700; color: #1e293b; margin: 0;">
                    Institutional Policy Discounts (Cumulative / Stacking Enabled):
                </label>
                <span class="text-muted" style="font-size: 12.5px;">Medical assistance &amp; vouchers deduct first, then percentage discounts apply</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; margin-bottom: 12px;">
                ${discountCheckboxesHtml || '<p class="text-muted">No institutional discounts configured.</p>'}
            </div>

            <div style="background: #f8fafc; border: 1px dashed #94a3b8; border-radius: 6px; padding: 10px 14px;">
                <div style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px;">+ Add Medical Assistance / Dynamic Voucher (e.g. Malasakit, PCSO, DSWD, Guarantee Letter):</div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    <input type="text" id="custom_voucher_name_input" class="form-control" style="max-width: 270px; font-size: 13px;" placeholder="e.g. Malasakit, PCSO, DSWD, Guarantee Letter">
                    <input type="number" id="custom_voucher_val_input" class="form-control" style="max-width: 170px; font-size: 13px;" step="0.01" min="0.01" placeholder="Acquired Amount (₱)">
                    <button type="button" id="btnAddCustomVoucher" class="btn btn-outline btn-sm" style="font-weight: 600;">+ Add Assistance</button>
                </div>
                <div id="custom-vouchers-tags" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;"></div>
            </div>
        </div>

        <table class="data-table mb-3">
            <thead>
                <tr><th colspan="2">Billing Settlement &amp; 12% VAT Breakdown</th></tr>
            </thead>
            <tbody>
            <tr>
                <td width="45%">Gross Total Accumulated Charges:</td>
                <td width="55%" align="right"><strong>₱<span id="settle-gross-display">${formattedGross}</span></strong></td>
            </tr>
            <tr>
                <td>Less: Medical Assistance &amp; Vouchers:</td>
                <td align="right" style="color: #276749;"><strong>-<span id="settle-fixed-deductions-display">₱0.00</span></strong></td>
            </tr>
            <tr style="background-color: #f8fafc;">
                <td>Subtotal After Assistance / Vouchers:</td>
                <td align="right"><strong>₱<span id="settle-subtotal-after-fixed-display">${formattedGross}</span></strong></td>
            </tr>
            <tr>
                <td>Less: Percentage Discount (<span id="settle-discount-pct-label">0.00%</span>):</td>
                <td align="right" style="color: #276749;"><strong>-<span id="settle-pct-discount-display">₱0.00</span></strong></td>
            </tr>
            <tr style="background-color: #f1f5f9;">
                <td><strong>Total Net Bill:</strong></td>
                <td align="right"><strong id="settle-net-before-tax-display">₱${formattedGross}</strong></td>
            </tr>
            <tr id="settle-vat-row">
                <td style="padding-left: 20px; font-size: 13px; color: #475569;">• 12% Value-Added Tax (included in bill):</td>
                <td align="right"><strong id="settle-vat-display" style="color: #0369a1;">₱0.00</strong></td>
            </tr>
            <tr style="background-color: #edf2f7;">
                <td><h3 style="margin: 5px 0;">NET AMOUNT ASSESSED:</h3></td>
                <td align="right"><h3 style="margin: 5px 0; color: var(--primary);" id="settle-net-display">₱${formattedGross}</h3></td>
            </tr>
            ${advancePaid > 0 ? `
            <tr style="background-color: #f0fdf4;">
                <td><strong style="color: #16a34a;">Less: Advance Payments &amp; Patient Deposits Credited:</strong></td>
                <td align="right"><strong style="color: #16a34a;">-<span id="settle-advance-display">₱${formattedAdv}</span></strong></td>
            </tr>
            <tr style="background-color: #eff6ff;">
                <td><h3 style="margin: 5px 0; color: #1e3a8a;">NET BALANCE DUE AT DISCHARGE:</h3></td>
                <td align="right"><h3 style="margin: 5px 0; color: #1e3a8a;" id="settle-balance-due-display">₱${initialRemaining.toLocaleString('en-PH', {minimumFractionDigits: 2})}</h3></td>
            </tr>
            ` : ''}
            <tr>
                <td><strong>Payment Method:</strong></td>
                <td align="right">
                    <select id="settle_payment_method_id" class="form-select" style="max-width: 280px; display: inline-block;">
                        ${getPaymentMethodOptionsHtml(1)}
                    </select>
                </td>
            </tr>
            <tr>
                <td><strong>Amount Tendered / Paid at Discharge (₱):</strong></td>
                <td align="right">
                    <div style="display: flex; gap: 8px; align-items: center; justify-content: flex-end;">
                        <button type="button" id="btn-exact-cash" class="btn btn-secondary btn-sm" style="white-space: nowrap; font-size: 13px;" title="Reset input to exact remaining balance">Exact Balance</button>
                        <input type="number" id="settle_amount_paid" class="form-control" step="0.01" min="0" placeholder="0.00" value="${initialRemaining.toFixed(2)}" style="max-width: 170px; font-weight: 700; font-size: 15px; text-align: right;">
                        <button type="button" id="btn-pay-now" class="btn btn-primary" style="font-weight: 700; padding: 9px 24px; white-space: nowrap;">Pay</button>
                    </div>
                </td>
            </tr>
            <tr>
                <td>Change / Outstanding Balance Status:</td>
                <td align="right"><strong id="settle-change-display" style="font-size: 14.5px; color: #16a34a;">Change: ₱0.00</strong></td>
            </tr>
            </tbody>
        </table>

        ${advancePaid > 0 ? `
            <div class="card p-3 mb-3" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                    <h4 style="margin: 0; color: #166534;">Advance Patient Deposits Credited to Final Bill</h4>
                    <span class="badge badge-success" style="font-size: 13px;">₱${formattedAdv} Total Deposits</span>
                </div>
                <div id="discharged-advance-history-table" class="table-responsive">
                    <p class="text-muted" style="margin: 4px 0;">Loading advance deposits...</p>
                </div>
            </div>
        ` : ''}

        <div class="mt-3" style="display: flex; justify-content: flex-end;">
            <button id="btnSettleBill" class="btn btn-primary btn-lg">Process Billing Settlement & Generate Official Invoice</button>
        </div>
    `;

    container.innerHTML = html;

    if (advancePaid > 0) {
        const advDiv = document.getElementById('discharged-advance-history-table');
        if (advDiv) {
            renderPaymentHistoryTable(null, admissionId, advDiv);
        }
    }

    const cashInput = document.getElementById('settle_amount_paid');
    const catCheckboxes = container.querySelectorAll('.cat-checkbox');
    const catButtons = container.querySelectorAll('.cat-quick-btn');
    const noticeEl = document.getElementById('cat-scope-notice');

    const computeSettlementMath = () => {
        let selectedBase = gross;
        let checkedCount = 0;
        let totalCount = 0;
        catCheckboxes.forEach(cb => {
            totalCount++;
            if (cb.checked) checkedCount++;
        });

        if (checkedCount > 0 && checkedCount < totalCount) {
            selectedBase = 0;
            catCheckboxes.forEach(cb => {
                if (cb.checked) {
                    selectedBase += parseFloat(cb.dataset.amount || 0);
                }
            });
        }

        const selectedDiscounts = [];
        const checkedBoxes = container.querySelectorAll('.discount-checkbox:checked');
        let isVatExempt = false;

        checkedBoxes.forEach(cb => {
            const did = parseInt(cb.dataset.id, 10);
            const dtype = cb.dataset.type;
            const dpct = parseFloat(cb.dataset.pct || 0);
            const dfixed = parseFloat(cb.dataset.fixed || 0);
            const dname = cb.dataset.name || '';
            const dvatExempt = parseInt(cb.dataset.vatExempt || '0', 10) === 1 || dname.toLowerCase().includes('senior') || dname.toLowerCase().includes('pwd');

            if (dvatExempt) isVatExempt = true;

            selectedDiscounts.push({
                id: did,
                name: dname,
                type: dtype,
                pct: dpct,
                fixed: dfixed,
                isVatExempt: dvatExempt
            });
        });

        customVouchersList.forEach(cv => {
            selectedDiscounts.push({
                id: null,
                name: cv.name,
                type: 'Fixed',
                pct: 0,
                fixed: cv.amount,
                isVatExempt: false
            });
        });

        let running = selectedBase;
        let totalFixedDeduction = 0;

        selectedDiscounts.filter(d => d.type === 'Fixed').forEach(fd => {
            const ded = Math.min(running, fd.fixed);
            running = Math.max(0, Math.round((running - ded) * 100) / 100);
            totalFixedDeduction = Math.round((totalFixedDeduction + ded) * 100) / 100;
        });

        const subtotalAfterFixed = running;

        let totalPctRate = 0;
        selectedDiscounts.filter(d => d.type === 'Percentage').forEach(pd => {
            totalPctRate += pd.pct;
        });

        const pctDeduction = Math.round((subtotalAfterFixed * (totalPctRate / 100)) * 100) / 100;
        const netBeforeTax = Math.max(0, Math.round((subtotalAfterFixed - pctDeduction) * 100) / 100);
        const totalDiscountDeduction = Math.round((totalFixedDeduction + pctDeduction) * 100) / 100;

        let vatRate = 0;
        let vatAmount = 0;
        let vatableAmount = 0;
        let vatExemptAmount = 0;
        let netAmountDue = netBeforeTax;

        if (isVatExempt) {
            vatRate = 0;
            vatAmount = 0;
            vatExemptAmount = netBeforeTax;
            vatableAmount = 0;
            netAmountDue = netBeforeTax;
        } else {
            vatRate = 12.00;
            vatAmount = Math.round((netBeforeTax * 0.12) * 100) / 100;
            vatableAmount = Math.round((netBeforeTax - vatAmount) * 100) / 100;
            vatExemptAmount = 0;
            netAmountDue = netBeforeTax;
        }

        const advancePaid = latestSummary ? parseFloat(latestSummary.advance_payments_total || 0) : 0;
        const remainingNetToSettle = Math.max(0, Math.round((netAmountDue - advancePaid) * 100) / 100);

        return {
            selectedBase,
            totalFixedDeduction,
            subtotalAfterFixed,
            totalPctRate,
            pctDeduction,
            netBeforeTax,
            totalDiscountDeduction,
            isVatExempt,
            vatRate,
            vatAmount,
            vatableAmount,
            vatExemptAmount,
            netAmountDue,
            advancePaid,
            remainingNetToSettle,
            selectedDiscounts
        };
    };

    const updateSettlementTotals = () => {
        const math = computeSettlementMath();

        const lblGross = document.getElementById('settle-gross-display');
        const lblFixed = document.getElementById('settle-fixed-deductions-display');
        const lblSubAfter = document.getElementById('settle-subtotal-after-fixed-display');
        const lblPctLabel = document.getElementById('settle-discount-pct-label');
        const lblPctAmt = document.getElementById('settle-pct-discount-display');
        const lblNetBeforeTax = document.getElementById('settle-net-before-tax-display');
        const lblVat = document.getElementById('settle-vat-display');
        const lblNet = document.getElementById('settle-net-display');
        const lblAdv = document.getElementById('settle-advance-display');
        const lblBalDue = document.getElementById('settle-balance-due-display');
        const lblChange = document.getElementById('settle-change-display');

        if (lblGross) lblGross.textContent = math.selectedBase.toLocaleString('en-PH', {minimumFractionDigits: 2});
        if (lblFixed) lblFixed.textContent = `₱${math.totalFixedDeduction.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
        if (lblSubAfter) lblSubAfter.textContent = math.subtotalAfterFixed.toLocaleString('en-PH', {minimumFractionDigits: 2});
        if (lblPctLabel) lblPctLabel.textContent = `${math.totalPctRate.toFixed(2)}%`;
        if (lblPctAmt) lblPctAmt.textContent = `₱${math.pctDeduction.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
        if (lblNetBeforeTax) lblNetBeforeTax.textContent = `₱${math.netBeforeTax.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

        if (lblVat) {
            if (math.isVatExempt) {
                lblVat.innerHTML = '<span class="badge badge-success" style="font-size: 12px;">₱0.00 (12% VAT-Exempt — Senior/PWD)</span>';
            } else {
                lblVat.innerHTML = `₱${math.vatAmount.toLocaleString('en-PH', {minimumFractionDigits: 2})} <span class="text-muted" style="font-size: 12.5px;">(12% included; VATable: ₱${math.vatableAmount.toLocaleString('en-PH', {minimumFractionDigits: 2})})</span>`;
            }
        }

        if (lblNet) lblNet.textContent = `₱${math.netAmountDue.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
        if (lblAdv) lblAdv.textContent = `₱${math.advancePaid.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
        if (lblBalDue) lblBalDue.textContent = `₱${math.remainingNetToSettle.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;

        const paid = cashInput ? parseFloat(cashInput.value || 0) : 0;
        if (lblChange) {
            if (paid >= math.remainingNetToSettle) {
                const change = Math.round((paid - math.remainingNetToSettle) * 100) / 100;
                lblChange.textContent = change > 0 
                    ? `Change: ₱${change.toLocaleString('en-PH', {minimumFractionDigits: 2})} (Fully Paid)` 
                    : 'Fully Settled (₱0.00 Balance)';
                lblChange.style.color = '#16a34a';
            } else {
                const bal = Math.round((math.remainingNetToSettle - paid) * 100) / 100;
                lblChange.textContent = `Remaining Balance Due: ₱${bal.toLocaleString('en-PH', {minimumFractionDigits: 2})}`;
                lblChange.style.color = '#dc2626';
            }
        }
    };

    const renderCustomVoucherTags = () => {
        const tagsContainer = document.getElementById('custom-vouchers-tags');
        if (!tagsContainer) return;

        if (customVouchersList.length === 0) {
            tagsContainer.innerHTML = '';
            return;
        }

        tagsContainer.innerHTML = customVouchersList.map((cv, idx) => `
            <span class="badge" style="background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; font-size: 12px; padding: 5px 10px; display: inline-flex; align-items: center; gap: 6px;">
                🎟️ <strong>${cv.name}</strong> (-₱${cv.amount.toLocaleString('en-PH', {minimumFractionDigits: 2})})
                <button type="button" class="btn-remove-cv" data-index="${idx}" style="background: none; border: none; color: #ef4444; font-weight: 700; cursor: pointer; padding: 0 2px;">&times;</button>
            </span>
        `).join('');

        tagsContainer.querySelectorAll('.btn-remove-cv').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index, 10);
                customVouchersList.splice(idx, 1);
                renderCustomVoucherTags();
                const math = computeSettlementMath();
                if (cashInput) cashInput.value = math.remainingNetToSettle.toFixed(2);
                updateSettlementTotals();
            });
        });
    };

    const applyCategorySelection = () => {
        const math = computeSettlementMath();
        let totalCount = 0;
        let checkedCount = 0;
        const selectedNames = [];

        catCheckboxes.forEach(cb => {
            totalCount++;
            if (cb.checked) {
                checkedCount++;
                selectedNames.push(cb.dataset.name);
            }
        });

        if (checkedCount === totalCount || checkedCount === 0) {
            if (cashInput) {
                cashInput.value = math.remainingNetToSettle.toFixed(2);
            }
            if (noticeEl) {
                noticeEl.textContent = 'Paying for: All charges (Full bill)';
                noticeEl.style.color = '#0369a1';
            }
        } else {
            if (cashInput) {
                cashInput.value = math.remainingNetToSettle.toFixed(2);
            }
            if (noticeEl) {
                noticeEl.textContent = `Patient is paying for: ${selectedNames.join(', ')} (₱${math.remainingNetToSettle.toLocaleString('en-PH', {minimumFractionDigits: 2})}). Balance will remain pending.`;
                noticeEl.style.color = '#d97706';
            }
        }

        updateSettlementTotals();
    };

    catButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetCat = btn.dataset.cat;
            catButtons.forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-outline');
            });
            btn.classList.remove('btn-outline');
            btn.classList.add('btn-primary');

            catCheckboxes.forEach(cb => {
                if (targetCat === 'all') {
                    cb.checked = true;
                } else {
                    cb.checked = (cb.dataset.cat === targetCat);
                }
            });

            applyCategorySelection();
        });
    });

    catCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            catButtons.forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-outline');
            });
            applyCategorySelection();
        });
    });

    container.querySelectorAll('.discount-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            const math = computeSettlementMath();
            if (cashInput) cashInput.value = math.remainingNetToSettle.toFixed(2);
            updateSettlementTotals();
        });
    });

    document.getElementById('btnAddCustomVoucher')?.addEventListener('click', () => {
        const nameInput = document.getElementById('custom_voucher_name_input');
        const valInput = document.getElementById('custom_voucher_val_input');

        const vName = nameInput ? nameInput.value.trim() : '';
        const vAmt = valInput ? parseFloat(valInput.value) : 0;

        if (!vName) {
            showPopupAlert('Please enter a voucher or deduction name.', 'warning');
            return;
        }

        if (isNaN(vAmt) || vAmt <= 0) {
            showPopupAlert('Please enter a valid voucher amount greater than 0.', 'warning');
            return;
        }

        customVouchersList.push({ name: vName, amount: vAmt });
        if (nameInput) nameInput.value = '';
        if (valInput) valInput.value = '';

        renderCustomVoucherTags();
        const math = computeSettlementMath();
        if (cashInput) cashInput.value = math.remainingNetToSettle.toFixed(2);
        updateSettlementTotals();
    });

    if (cashInput) {
        cashInput.addEventListener('input', updateSettlementTotals);
    }

    document.getElementById('btn-exact-cash')?.addEventListener('click', () => {
        const math = computeSettlementMath();
        if (cashInput) {
            cashInput.value = math.remainingNetToSettle.toFixed(2);
        }
        updateSettlementTotals();
    });

    document.getElementById('btn-pay-now')?.addEventListener('click', submitSettlement);
    document.getElementById('btnSettleBill')?.addEventListener('click', submitSettlement);

    cashInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitSettlement();
        }
    });

    renderCustomVoucherTags();
    const initialMath = computeSettlementMath();
    if (cashInput) cashInput.value = initialMath.remainingNetToSettle.toFixed(2);
    updateSettlementTotals();
};

const submitSettlement = () => {
    const container = document.getElementById('settlement-container');
    const checkedBoxes = container ? container.querySelectorAll('.discount-checkbox:checked') : [];
    const discountIds = Array.from(checkedBoxes).map(cb => parseInt(cb.dataset.id, 10));

    const customDiscounts = customVouchersList.map(cv => ({
        name: cv.name,
        type: 'Fixed',
        value: cv.amount,
        is_vat_exempt: 0
    }));

    const cashInput = document.getElementById('settle_amount_paid');
    const amountPaid = cashInput ? parseFloat(cashInput.value || 0) : 0;
    const payMethodSelect = document.getElementById('settle_payment_method_id');
    const paymentMethodId = payMethodSelect ? parseInt(payMethodSelect.value, 10) : 1;

    if (isNaN(amountPaid) || amountPaid < 0) {
        showPopupAlert('Please enter a valid payment amount.', 'warning');
        return;
    }

    const gross = latestSummary ? parseFloat(latestSummary.net_total || 0) : 0;

    let totalFixed = 0;
    checkedBoxes.forEach(cb => {
        if (cb.dataset.type === 'Fixed') totalFixed += parseFloat(cb.dataset.fixed || 0);
    });
    customVouchersList.forEach(cv => { totalFixed += cv.amount; });

    const afterFixed = Math.max(0, gross - totalFixed);

    let totalPct = 0;
    let isExempt = false;
    checkedBoxes.forEach(cb => {
        if (cb.dataset.type === 'Percentage') totalPct += parseFloat(cb.dataset.pct || 0);
        const dname = cb.dataset.name || '';
        if (parseInt(cb.dataset.vatExempt || '0', 10) === 1 || dname.toLowerCase().includes('senior') || dname.toLowerCase().includes('pwd')) {
            isExempt = true;
        }
    });

    const pctDed = Math.round(afterFixed * (totalPct / 100) * 100) / 100;
    const netBeforeTax = Math.max(0, Math.round((afterFixed - pctDed) * 100) / 100);
    const vatAmt = isExempt ? 0 : Math.round(netBeforeTax * 0.12 * 100) / 100;
    const netAmt = netBeforeTax;

    const totalAdvancePaid = latestSummary ? parseFloat(latestSummary.advance_payments_total || 0) : 0;
    const remainingNetToSettle = Math.max(0, Math.round((netAmt - totalAdvancePaid) * 100) / 100);

    let confirmMsg = '';
    if (amountPaid < remainingNetToSettle) {
        const remaining = Math.max(0, Math.round((remainingNetToSettle - amountPaid) * 100) / 100);
        confirmMsg = `Confirm partial settlement payment of ₱${amountPaid.toLocaleString('en-PH', {minimumFractionDigits: 2})}?\n\nAn outstanding balance of ₱${remaining.toLocaleString('en-PH', {minimumFractionDigits: 2})} will remain on the invoice. Pre-discharge advance deposits of ₱${totalAdvancePaid.toLocaleString('en-PH', {minimumFractionDigits: 2})} will be officially credited. Any active bed stay will be closed and released.`;
    } else {
        confirmMsg = `Confirm final billing settlement of ₱${amountPaid.toLocaleString('en-PH', {minimumFractionDigits: 2})}?\n\nPre-discharge advance deposits of ₱${totalAdvancePaid.toLocaleString('en-PH', {minimumFractionDigits: 2})} will be officially credited. This will record the official Final Invoice as PAID IN FULL and release the bed.`;
    }

    showPopupConfirm(confirmMsg, () => {
        const userJson = sessionStorage.getItem('hospital_user');
        const user = userJson ? JSON.parse(userJson) : null;
        const uid = user ? (user.user_id || user.User_ID || 1) : 1;

        const payload = {
            admission_id: admissionId,
            user_id: uid,
            discount_ids: discountIds,
            custom_discounts: customDiscounts,
            amount_paid: amountPaid,
            payment_method_id: paymentMethodId
        };

        const formData = new FormData();
        formData.append('operation', 'settleInvoice');
        formData.append('json', JSON.stringify(payload));

        axios.post(`${postApiUrl}/invoices.php`, formData)
            .then(response => {
                if (response.data && response.data.success) {
                    const payId = response.data.payment_id;
                    const invId = response.data.invoice_id;
                    const rcptNum = response.data.receipt_number || '';
                    let msg = response.data.message;
                    if (rcptNum) {
                        msg += `\nOfficial Receipt: ${rcptNum}`;
                    }

                    showPopupAlert(msg, 'success', 'Settlement Completed', () => {
                        window.location.href = `invoice_print.html?id=${invId}`;
                    });
                } else {
                    const err = response.data && response.data.error ? response.data.error : 'Failed to settle bill.';
                    showPopupAlert('Settlement Error: ' + err, 'danger');
                }
            })
            .catch(() => {
                showPopupAlert('Network error processing settlement.', 'danger');
            });
    }, null, {
        title: 'Confirm Billing Settlement',
        confirmText: 'Process Settlement',
        type: amountPaid < remainingNetToSettle ? 'warning' : 'info'
    });
};



