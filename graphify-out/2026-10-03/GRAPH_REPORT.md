# Graph Report - Hospital_Billing  (2026-10-03)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 456 nodes · 597 edges · 65 communities (19 shown, 46 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 67 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a4338291`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- admission_details.js
- doctors.js
- admissions.js
- rooms.js
- common.js
- patients.js
- invoices.js
- invoice.js
- InvoiceManager
- departments.js
- script.js
- borrow.js
- catalogs.js
- discounts.js
- invoice_print.js
- partial_bill.js
- AdmissionManager
- RoomMaster
- archive.js
- audit_log.js
- DoctorMaster
- LedgerManager
- AdmissionManager
- Catalog
- ClinicalOrderManager
- DepartmentMaster
- Discount
- DoctorMaster
- PatientMaster
- RoomMaster
- ClinicalOrderManager
- Department
- Discount
- PatientMaster
- InvoiceManager
- SpecialtyMaster
- app.js
- payment_receipt.js
- Catalog
- ArchiveManager
- Book
- ArchiveManager
- AuditLogGET
- Auth
- LedgerManager
- Category
- Invoice
- Product
- Book
- Borrow
- Student
- dashboard.js

## God Nodes (most connected - your core abstractions)
1. `InvoiceManager` - 10 edges
2. `loadLedgerSummary()` - 8 edges
3. `renderSettlementSection()` - 8 edges
4. `renderInvoice()` - 8 edges
5. `renderPartialBill()` - 8 edges
6. `AdmissionManager` - 7 edges
7. `initClinicalModals()` - 7 edges
8. `loadLedger()` - 7 edges
9. `formatMoney()` - 7 edges
10. `RoomMaster` - 6 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (65 total, 46 thin omitted)

### Community 0 - "admission_details.js"
Cohesion: 0.07
Nodes (52): assignedDoctors, availableBedsList, catalogItems, closeLookupPicker(), customVouchersList, dischargePatientFromChart(), discountList, dispensedMedicinesList (+44 more)

### Community 1 - "doctors.js"
Cohesion: 0.11
Nodes (31): allDoctors, allDoctorTypes, allSpecialties, allStations, closeSpecialtyModal(), closeSpecialtyPicker(), closeViewDoctorModal(), confirmSpecialtyPicker() (+23 more)

### Community 2 - "admissions.js"
Cohesion: 0.13
Nodes (26): activeDoctors, activePatients, allAdmissions, availableBeds, closeDoctorPicker(), confirmDoctorPicker(), currentFilteredDoctors, dischargePatient() (+18 more)

### Community 3 - "rooms.js"
Cohesion: 0.18
Nodes (17): allBeds, allRooms, closeViewRoomModal(), displayBedsTable(), displayRoomsAndBeds(), displayRoomsTable(), filterAndSortRooms(), loadRoomForEdit() (+9 more)

### Community 4 - "common.js"
Cohesion: 0.20
Nodes (9): closeModal(), genericLookupPickerState, initAppSession(), initModalControls(), openGenericLookupPicker(), openModal(), renderGenericLookupList(), showPopupConfirm() (+1 more)

### Community 5 - "patients.js"
Cohesion: 0.22
Nodes (10): allBloodTypes, allGenders, allPatients, displayPatients(), displayPatientsTable(), filterAndSortPatients(), loadPatientForEdit(), populatePatientForm() (+2 more)

### Community 6 - "invoices.js"
Cohesion: 0.22
Nodes (9): allInvoices, filterAndRenderInvoices(), loadInvoices(), openPaymentHistoryModal(), openPaymentModal(), paymentMethods, renderInvoicesTable(), submitPayment() (+1 more)

### Community 7 - "invoice.js"
Cohesion: 0.30
Nodes (11): details, displayDetails(), formatCurrency(), formatDateYYYYMMDD(), getAllProducts(), getAllStudents(), getTotalSales(), onPageLoad() (+3 more)

### Community 9 - "departments.js"
Cohesion: 0.35
Nodes (10): allDepartments, closeViewDepartmentModal(), displayDepartments(), displayDepartmentsTable(), filterAndSortDepartments(), loadDepartmentForEdit(), openViewDepartmentModal(), populateDepartmentForm() (+2 more)

### Community 10 - "script.js"
Cohesion: 0.20
Nodes (7): apiClient, customerSelect, discountDisplay, netDisplay, priceDisplay, productSelect, qtyInput

### Community 11 - "borrow.js"
Cohesion: 0.36
Nodes (9): books, details, displayDetails(), formatDateYYYYMMDD(), getAllBooks(), getAllStudents(), onPageLoad(), openDetailsModal() (+1 more)

### Community 12 - "catalogs.js"
Cohesion: 0.36
Nodes (8): allCatalogs, displayCatalogs(), displayCatalogsTable(), filterAndSortCatalogs(), loadCatalogForEdit(), populateCatalogForm(), resetForm(), saveCatalogItem()

### Community 13 - "discounts.js"
Cohesion: 0.36
Nodes (8): allDiscounts, displayDiscounts(), displayDiscountsTable(), filterAndSortDiscounts(), loadDiscountForEdit(), populateDiscountForm(), resetForm(), saveDiscount()

### Community 14 - "invoice_print.js"
Cohesion: 0.42
Nodes (8): formatMoney(), getDoctorRounds(), loadInvoiceData(), parseHospitalCharges(), renderDoctorFeesTable(), renderHospitalChargesTable(), renderInvoice(), renderSettlementSummary()

### Community 15 - "partial_bill.js"
Cohesion: 0.56
Nodes (8): formatMoney(), loadPartialBill(), renderAdvancePayments(), renderDoctorsTable(), renderLedgerCategories(), renderPartialBill(), renderRoomStaysTable(), renderSummaryBox()

### Community 18 - "archive.js"
Cohesion: 0.57
Nodes (6): currentArchivedRecords, displayArchiveTable(), filterArchivedRecords(), hardDeleteRecord(), loadArchivedRecords(), restoreRecord()

### Community 19 - "audit_log.js"
Cohesion: 0.48
Nodes (6): allAuditLogs, filterAndRenderAuditLogs(), getActionBadgeClass(), loadAuditLogs(), renderAuditTable(), updateAuditStats()

### Community 36 - "app.js"
Cohesion: 0.60
Nodes (3): displayBooks(), displayBooksTable(), insertBook()

### Community 37 - "payment_receipt.js"
Cohesion: 0.70
Nodes (4): formatCurrency(), getUrlParam(), loadReceiptData(), renderReceipt()

## Knowledge Gaps
- **46 isolated node(s):** `assignedDoctors`, `availableBedsList`, `catalogItems`, `customVouchersList`, `discountList` (+41 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 199 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **46 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `assignedDoctors`, `availableBedsList`, `catalogItems` to the rest of the system?**
  _46 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `admission_details.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07205387205387205 - nodes in this community are weakly interconnected._
- **Should `doctors.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11088709677419355 - nodes in this community are weakly interconnected._
- **Should `admissions.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12535612535612536 - nodes in this community are weakly interconnected._