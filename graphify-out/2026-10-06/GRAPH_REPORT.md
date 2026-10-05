# Graph Report - Hospital_Billing  (2026-10-06)

## Corpus Check
- 69 files · ~82,548 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: .css 17, (none) 2)

## Summary
- 524 nodes · 721 edges · 66 communities (21 shown, 45 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 82 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `372a5484`
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
- promissory_notes.js

## God Nodes (most connected - your core abstractions)
1. `InvoiceManager` - 12 edges
2. `renderSettlementSection()` - 10 edges
3. `AdmissionManager` - 8 edges
4. `RoomMaster` - 8 edges
5. `initClinicalModals()` - 8 edges
6. `loadLedgerSummary()` - 8 edges
7. `renderInvoice()` - 8 edges
8. `renderPartialBill()` - 8 edges
9. `initEvents()` - 8 edges
10. `dischargePatientFromChart()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Critical Rules Summary` --references--> `openGenericLookupPicker()`  [INFERRED]
  AGENTS.md → js/common.js
- `Form Dropdowns vs. Lookup Picker Windows` --references--> `openGenericLookupPicker()`  [INFERRED]
  PROJECT_RULES.md → js/common.js

## Import Cycles
- None detected.

## Communities (66 total, 45 thin omitted)

### Community 0 - "admission_details.js"
Cohesion: 0.06
Nodes (61): assignedDoctors, availableBedsList, catalogItems, closeLookupPicker(), customVouchersList, dischargePatientFromChart(), discountList, dispensedMedicinesList (+53 more)

### Community 1 - "doctors.js"
Cohesion: 0.11
Nodes (33): allDoctors, allDoctorTypes, allSpecialties, allStations, cancelEditSpecialty(), closeSpecialtyModal(), closeSpecialtyPicker(), closeViewDoctorModal() (+25 more)

### Community 2 - "admissions.js"
Cohesion: 0.13
Nodes (26): activeDoctors, activePatients, allAdmissions, availableBeds, closeDoctorPicker(), confirmDoctorPicker(), currentFilteredDoctors, dischargePatient() (+18 more)

### Community 3 - "rooms.js"
Cohesion: 0.15
Nodes (26): allBeds, allRooms, cancelEditRoomType(), closeRoomTypeModal(), closeViewRoomModal(), displayBedsTable(), displayRoomsAndBeds(), displayRoomsGrid() (+18 more)

### Community 4 - "common.js"
Cohesion: 0.08
Nodes (24): Agent Guidelines & Project Instructions, Critical Rules Summary, closeModal(), genericLookupPickerState, handleUserLogout(), initAppSession(), initModalControls(), openGenericLookupPicker() (+16 more)

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
Nodes (8): categorizeLedgerItems(), formatMoney(), loadPartialBill(), renderAdvancePayments(), renderDoctorFees(), renderHospitalCharges(), renderPartialBill(), renderSummaryBox()

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

### Community 51 - "dashboard.js"
Cohesion: 0.70
Nodes (4): loadDashboardMetrics(), renderRecentAdmissions(), updateBedGauge(), updateFinancialHealth()

### Community 65 - "promissory_notes.js"
Cohesion: 0.22
Nodes (15): allPaymentMethods, allPromissoryNotes, closeHistoryModal(), closePaymentModal(), filterAndRenderPromissoryNotes(), initEvents(), loadPromissoryNotes(), openPaymentHistoryModal() (+7 more)

## Knowledge Gaps
- **56 isolated node(s):** `apiClient`, `customerSelect`, `productSelect`, `qtyInput`, `priceDisplay` (+51 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 224 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **45 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 4 inferred relationships involving `initClinicalModals()` (e.g. with `openAdvancePaymentMethodPicker()` and `openAdvancePaymentModal()`) actually correct?**
  _`initClinicalModals()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `apiClient`, `customerSelect`, `productSelect` to the rest of the system?**
  _56 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `admission_details.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06201923076923077 - nodes in this community are weakly interconnected._
- **Should `doctors.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11051693404634581 - nodes in this community are weakly interconnected._
- **Should `admissions.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12535612535612536 - nodes in this community are weakly interconnected._
- **Should `common.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07575757575757576 - nodes in this community are weakly interconnected._