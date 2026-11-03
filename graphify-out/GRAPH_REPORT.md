# Graph Report - Hospital_Billing  (2026-10-18)

## Corpus Check
- 76 files · ~118,754 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 22 file(s) not represented in the graph (top: .css 19, (none) 2, .exe 1)

## Summary
- 669 nodes · 991 edges · 72 communities (25 shown, 47 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 113 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7b8a15c3`
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
- sidebar.js
- promissory_notes.js
- staff.js
- UserManager
- UserManager
- reports.js
- ReportManager
- Step-by-Step Script & Storyboard

## God Nodes (most connected - your core abstractions)
1. `initArchiveEvents()` - 14 edges
2. `InvoiceManager` - 13 edges
3. `loadArchivedRecords()` - 12 edges
4. `initStaffEvents()` - 12 edges
5. `renderSettlementSection()` - 11 edges
6. `UserManager` - 10 edges
7. `loadLedgerSummary()` - 9 edges
8. `AdmissionManager` - 8 edges
9. `ReportManager` - 8 edges
10. `RoomMaster` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Critical Rules Summary` --references--> `openGenericLookupPicker()`  [INFERRED]
  AGENTS.md → js/common.js
- `Form Dropdowns vs. Lookup Picker Windows` --references--> `openGenericLookupPicker()`  [INFERRED]
  PROJECT_RULES.md → js/common.js

## Import Cycles
- None detected.

## Communities (72 total, 47 thin omitted)

### Community 0 - "admission_details.js"
Cohesion: 0.06
Nodes (66): assignedDoctors, availableBedsList, catalogItems, closeLookupPicker(), closeVoidAdmissionModal(), customVouchersList, dischargePatientFromChart(), discountList (+58 more)

### Community 1 - "doctors.js"
Cohesion: 0.10
Nodes (34): allDoctors, allDoctorTypes, allSpecialties, allStations, cancelEditSpecialty(), closeSpecialtyModal(), closeSpecialtyPicker(), closeViewDoctorModal() (+26 more)

### Community 2 - "admissions.js"
Cohesion: 0.13
Nodes (26): activeDoctors, activePatients, allAdmissions, availableBeds, closeDoctorPicker(), confirmDoctorPicker(), currentFilteredDoctors, dischargePatient() (+18 more)

### Community 3 - "rooms.js"
Cohesion: 0.16
Nodes (26): allBeds, allRooms, cancelEditRoomType(), closeRoomTypeModal(), closeViewRoomModal(), displayBedsTable(), displayRoomsAndBeds(), displayRoomsGrid() (+18 more)

### Community 4 - "common.js"
Cohesion: 0.07
Nodes (27): Agent Guidelines & Project Instructions, Critical Rules Summary, closeModal(), closeSelfChangePasswordModal(), enforcePageRbacGuard(), genericLookupPickerState, handleUserLogout(), initAppSession() (+19 more)

### Community 5 - "patients.js"
Cohesion: 0.19
Nodes (11): allBloodTypes, allGenders, allPatients, displayPatients(), displayPatientsTable(), filterAndSortPatients(), loadPatientForEdit(), openDuplicateModal() (+3 more)

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
Cohesion: 0.15
Nodes (32): allArchivedRecords, applyCategoryWindowSelection(), ARCHIVE_CATEGORIES, batchHardDeleteRecords(), batchRestoreRecords(), categoryCounts, clearAllModalCategories(), clearAllSelections() (+24 more)

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

### Community 53 - "sidebar.js"
Cohesion: 0.43
Nodes (7): getSectionStateClass(), initSidebarSectionDropdowns(), initSidebarUserMenu(), renderNavSection(), renderSectionChevron(), renderSidebar(), sectionIcons

### Community 65 - "promissory_notes.js"
Cohesion: 0.22
Nodes (15): allPaymentMethods, allPromissoryNotes, closeHistoryModal(), closePaymentModal(), filterAndRenderPromissoryNotes(), initEvents(), loadPromissoryNotes(), openPaymentHistoryModal() (+7 more)

### Community 66 - "staff.js"
Cohesion: 0.16
Nodes (26): allStaff, archiveStaff(), cancelEditRole(), closeManageRolesModal(), filterAndRenderStaff(), getRoleBadge(), initStaffEvents(), loadRoles() (+18 more)

### Community 69 - "reports.js"
Cohesion: 0.23
Nodes (21): exportToCsv(), exportToExcel(), fetchReportData(), formatDateYMD(), formatPesos(), initReports(), loadFilterLookups(), lookupData (+13 more)

### Community 71 - "Step-by-Step Script & Storyboard"
Cohesion: 0.11
Nodes (18): [0:00 – 0:45] Introduction & System Overview, [0:45 – 3:00] Part 1: Masterfiles (Full CRUD Demonstration & Maintenance), 1. Complete CRUD Demonstration (`views/catalogs.html` or `views/patients.html`), 1. Official Statement of Account & Official Receipt, 1. Patient Admission Transaction (`views/admissions.html`), 2. Clinical Charging & Bedside Rounds (`views/admission_details.html`), 2. Financial & Analytical Reports Hub (`views/reports.html`), 2. Key Masterfile Highlights (+10 more)

## Knowledge Gaps
- **81 isolated node(s):** `apiClient`, `customerSelect`, `productSelect`, `qtyInput`, `priceDisplay` (+76 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 271 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **47 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 11 inferred relationships involving `initArchiveEvents()` (e.g. with `applyCategoryWindowSelection()` and `batchHardDeleteRecords()`) actually correct?**
  _`initArchiveEvents()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `initStaffEvents()` (e.g. with `cancelEditRole()` and `closeManageRolesModal()`) actually correct?**
  _`initStaffEvents()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `apiClient`, `customerSelect`, `productSelect` to the rest of the system?**
  _81 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `admission_details.js` be split into smaller, more focused modules?**
  _Cohesion score 0.057971014492753624 - nodes in this community are weakly interconnected._
- **Should `doctors.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10317460317460317 - nodes in this community are weakly interconnected._
- **Should `admissions.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1282051282051282 - nodes in this community are weakly interconnected._
- **Should `common.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07112375533428165 - nodes in this community are weakly interconnected._