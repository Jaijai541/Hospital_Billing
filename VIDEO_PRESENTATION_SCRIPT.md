# System Demonstration Video Script: In-Patient Hospital Billing System

> **Target Duration:** 7 – 10 minutes  
> **Recommended Recording Tool:** OBS Studio, Windows Screen Recorder (`Win + Alt + R`), or Loom  
> **Recommended Resolution:** 1080p (Full Screen, 100% Browser Zoom)  

---

## Video Outline & Time Allocation

| Section | Topic | Estimated Time | Key Focus |
| :--- | :--- | :--- | :--- |
| **Intro** | Title, Project Scope & Objectives | 0:00 – 0:45 (45s) | Problem solved & technology stack |
| **Part 1** | **Masterfiles & Full CRUD** | 0:45 – 3:00 (2m 15s) | Create, Read, Update, Delete/Archive across Patients, Doctors, Catalogs, Rooms |
| **Part 2** | **Transactions** | 3:00 – 6:30 (3m 30s) | Admission, Clinical Charges, Discounts, Discharge & Promissory Note |
| **Part 3** | **Reports** | 6:30 – 8:30 (2m 00s) | Financial Reports, AR Aging, Occupancy, SOA & Receipts |
| **Outro** | Summary & Conclusion | 8:30 – 9:00 (30s) | System benefits & readiness |

---

## Step-by-Step Script & Storyboard

### [0:00 – 0:45] Introduction & System Overview

* **Screen Action:**
  * Open browser at the **Login Page** (`views/login.html`).
  * Log in using your **Admin** account (`admin` / password).
  * Land on the **Executive Dashboard** (`views/index.html`).
* **Narration / Voiceover:**
  > *"Good day, respected panelists and evaluators. Today we present our comprehensive In-Patient Hospital Information & Billing Management System.*
  > 
  > *Hospitals handle intricate operational workflows—from continuous bed occupancy and doctor bedside rounds to statutory discounts, multi-stage settlements, and promissory note agreements. Our system provides an end-to-end digital solution organized into three main pillars: Masterfile Maintenance with Full CRUD, Transaction Processing, and Comprehensive Reporting. Let us begin with the Masterfiles and their complete CRUD lifecycle."*

---

### [0:45 – 3:00] Part 1: Masterfiles (Full CRUD Demonstration & Maintenance)

#### 1. Complete CRUD Demonstration (`views/catalogs.html` or `views/patients.html`)
Showcase the complete **Create, Read, Update, Delete/Archive** lifecycle:

* **[C] Create:**
  * Click **Catalogs** on the sidebar.
  * Click **+ Add Catalog Item**.
  * Enter:
    - Item Name: `Amoxicillin 500mg Capsule`
    - Category: `Medicine`
    - Unit Price: `₱18.50`
  * Click **Save Item**.
  * Show the record immediately added to the table with its auto-generated code (e.g. `MED-010`).

* **[R] Read / Retrieve:**
  * Type `Amoxicillin` in the search box to show instant table filtering.
  * Use the **Category Filter** to switch between *All*, *Medicines*, *Scans*, and *Services*.
  * Use the **Sort By** dropdown to order by *Price (Lowest First)* or *Name (A to Z)*.
  * Click the row to open the complete inspection modal.

* **[U] Update:**
  * Inside the modal, edit the **Unit Price** from `18.50` to `22.00`.
  * Click **Update Item**.
  * Point out the table immediately reflects the updated `₱22.00` price.

* **[D] Delete / Archive & Restore:**
  * Click the item again, then click **"Send to Archive"** in the modal.
  * Confirm the prompt: the item cleanly disappears from the active table.
  * Switch the Status filter to **"Soft-Deleted Only"** (or visit **Archive** `views/archive.html`).
  * Show the item safely preserved in the archive.
  * Click **"Restore Record"** to demonstrate instant recovery with zero data loss.

* **Narration / Voiceover:**
  > *"Every masterfile in our system implements a full CRUD architecture with data integrity guarantees:
  > * First, Create: When adding a new catalog item or patient, unique item codes are generated automatically.
  > * Second, Read: Records are retrieved with multi-column sorting, real-time search, and category filtering.
  > * Third, Update: Staff can modify prices, contact numbers, or configurations with instant database updates.
  > * Fourth, Delete and Archive: To prevent accidental permanent data loss in a clinical setting, records use soft-deletion. Archived items are removed from active operations but can be restored with a single click."*

---

#### 2. Key Masterfile Highlights

* **Patient Registry & Duplicate Detection** (`views/patients.html`):
  * Click **Patients** > Click **+ Register New Patient**.
  * Enter an existing name (e.g. *Juan Dela Cruz*). Click Submit.
  * **Show the Duplicate Detection Warning Modal**:
    > *"Notice our intelligent duplicate detection guard: when registering, if a matching first and last name is detected, the system alerts the clerk, preventing duplicate medical records while still allowing intentional duplicate names."*

* **Doctors & Medical Specialties** (`views/doctors.html`):
  * Show doctor classifications (Resident vs Attending), department stations, and base bedside round fees.
  * Click any physician to display their live assigned patients.

* **Rooms & Bed Capacity Grid** (`views/rooms.html`):
  * Highlight the visual **Bed Capacity Grid**: Green badges for *Available* beds, Blue badges for *Occupied* beds, and daily rates per ward tier (ICU, Private, Semi-Private, Ward).

* **System Users & Roles** (`views/staff.html`):
  * Show role-based access control (Admin, Finance Staff, Nurse, Supervisor) with distinct permission tiers.

---

### [3:00 – 6:30] Part 2: Transactions (Core Business Logic)

#### 1. Patient Admission Transaction (`views/admissions.html`)
* **Screen Action:**
  * Click **Admissions** > click **+ Admit Patient**.
  * Select a registered patient.
  * Enter a Chief Complaint / Diagnosis.
  * Assign an available Bed (notice only unoccupied beds appear).
  * Assign an Attending Doctor. Click **Submit Admission**.
  * Land on **Admission Clinical Chart & Ledger** (`views/admission_details.html`).
* **Narration / Voiceover:**
  > *"Now we transition to core operational transactions. When admitting a patient, the system links the patient profile, clinical diagnosis, attending physician, and automatically claims an available bed, marking it occupied hospital-wide."*

#### 2. Clinical Charging & Bedside Rounds (`views/admission_details.html`)
* **Screen Action:**
  * Inside the patient admission details:
  * Click **+ Log Doctor Round**: select doctor, submit round fee.
  * Click **+ Add Charge**: pick a Medicine (e.g. Paracetamol) and a Scan (e.g. Chest X-Ray).
  * Show the **Billing Ledger** updating in real time with running subtotals.
* **Narration / Voiceover:**
  > *"During hospitalization, clinical transactions occur. Staff log bedside doctor rounds, pharmacy medication issuances, and diagnostic procedures. Each transaction automatically posts to the running patient ledger with exact timestamps and station attributions."*

#### 3. Room Transfer Transaction
* **Screen Action:**
  * Click **Transfer Room / Bed**.
  * Select a new room/bed and submit.
  * Point to the ledger showing the previous room closed and board & lodging calculated.
* **Narration / Voiceover:**
  > *"If a patient is transferred to another ward, the system automatically closes the previous bed stay, calculates the exact board-and-lodging duration, releases the old bed, and transfers the patient to the new room."*

#### 4. Discharge & Final Settlement Transaction (The Core Highlight!)
* **Screen Action:**
  * Click **Discharge & Settle Bill**.
  * The **Billing Settlement Modal** opens.
  * Check **Senior Citizen / PWD Discount**:
    * Point out the **20% statutory deduction**.
    * Point out the automatic **12% VAT exemption** badge (₱0.00 VAT).
  * **Test Overpayment (Customer Change):**
    * Type an excess cash amount (e.g. bill is ₱1,500, enter ₱2,000).
    * Show the green box: **"Customer Change: ₱500.00"**.
  * **Show Partial / Promissory Note:**
    * Change cash to a partial amount (e.g. ₱500).
    * Show the **Promissory Note Agreement** card expanding.
    * Select installment plan (e.g. 3 Months), enter guarantor name.
  * Click **Confirm Settlement**.
* **Narration / Voiceover:**
  > *"Here is the most critical transaction: Final Discharge Billing. Our settlement engine accurately handles multi-tier deductions. When applying Senior Citizen or PWD benefits, the system computes the 20% discount and enforces the statutory 12% VAT exemption.*
  > 
  > *If the patient tenders excess cash, the system immediately calculates and records customer change. Conversely, if the family cannot settle the full amount today, the cashier can enter a partial payment or zero-down, and the remainder is formalized into an official Promissory Note installment agreement with next due dates and guarantor accountability, releasing the patient and freeing the bed."*

---

### [6:30 – 8:30] Part 3: Reports & Official Printouts

#### 1. Official Statement of Account & Official Receipt
* **Screen Action:**
  * Open the generated **Statement of Account / Invoice** (`views/invoice_print.html`).
  * Show the hospital header, itemized breakdown (Hospital charges vs Doctor PF), statutory deductions, and cashier signature lines.
  * Open the **Official Receipt (OR)** (`views/payment_receipt.html`) showing OR number, cash received, and remaining balance.
* **Narration / Voiceover:**
  > *"Immediately upon settlement, the system produces BIR and hospital-standard audit printouts: an itemized Statement of Account detailing department subtotals, VAT calculations, and customer change, accompanied by an Official Receipt voucher complete with cashier attributions."*

#### 2. Financial & Analytical Reports Hub (`views/reports.html`)
* **Screen Action:**
  * Click **Reports** on the sidebar.
  * Switch through the 5 report tabs:
    1. **Daily Cashier Collections & Remittance:** show KPIs (Total Collections, Advance Deposits, Final Settlements) and payment method breakdown (Cash, GCash, Card).
    2. **Departmental & Station Revenue:** show revenue per station (Pharmacy, Radiology, Nursing, Room & Board).
    3. **Doctor Professional Fees (PF):** show total doctor rounds and fees accumulated.
    4. **Accounts Receivable (AR) & Promissory Note Aging:** show outstanding promissory notes, balances, and due dates.
    5. **Bed Capacity & Occupancy:** show live hospital bed utilization rates.
  * Click **Export Excel (.xlsx)** or **Print Official Report** on any report to show the printable view.
* **Narration / Voiceover:**
  > *"For executive management and financial auditing, our Reports Hub generates live analytical reports:
  > 1. Cashier Collections and Remittance tracking daily cash flow.
  > 2. Departmental Revenue breakdowns across hospital cost centers.
  > 3. Doctor Professional Fees and bedside rounds summaries.
  > 4. Accounts Receivable Aging for monitoring promissory note balances.
  > 5. In-Patient Bed Occupancy rates for capacity planning.
  > All reports support date filtering, presets, and spreadsheet export."*

#### 3. Audit Log & Archive Governance
* **Screen Action:**
  * Briefly open **Audit Log** (`views/audit_log.html`) to show immutable activity logs.
  * Briefly open **Archive** (`views/archive.html`) to show multi-category soft-deleted record recovery.
* **Narration / Voiceover:**
  > *"To ensure data integrity, every transaction is logged in an immutable Audit Trail, and all deleted records are safely held in an Archive with single-click restoration."*

---

### [8:30 – 9:00] Conclusion & Wrap-Up

* **Screen Action:**
  * Return to the **Dashboard** (`views/index.html`).
* **Narration / Voiceover:**
  > *"In summary, our In-Patient Hospital Billing System effectively unifies masterfile integrity with complete CRUD, complex clinical transactions, and real-time financial reporting into an intuitive, secure web platform. Thank you for your time, and we are ready for your questions."*

---

## Technical Tips for a High-Scoring Video

1. **Audio Quality:** Use a decent headset or microphone. Speak clearly at a steady pace.
2. **Smooth Cursor Movements:** Avoid jittery mouse movements; move deliberately to the button you are explaining.
3. **Clean Browser Window:** Hide your browser bookmark bar (`Ctrl + Shift + B`) and press `F11` for full-screen mode if desired.
4. **Pre-populated Data:** Have your database pre-loaded with realistic doctor names, medicines, and room numbers before recording.
