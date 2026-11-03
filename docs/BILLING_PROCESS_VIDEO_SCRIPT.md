# In-Patient Hospital Billing Process: End-to-End Demonstration Video Script

> **Focus:** Core In-Patient Billing Lifecycle (Excluding Masterfiles, Settings, and Standalone Catalogs)  
> **Target Video Duration:** 5 – 7 Minutes  
> **Recommended Resolution:** 1080p (Full Screen, 100% Zoom, Dark/Light Mode Consistent)  
> **Presenter Tone:** Confident, Professional, Clinical-Financial Explanatory  

---

## Storyboard & Timeline Summary

| Phase | Scene Title | System URL / Screen | Key Focus & Actions | Est. Time |
| :---: | :--- | :--- | :--- | :---: |
| **0** | **Video Intro & Scope** | `views/admissions.html` | Process overview: Admission $\rightarrow$ Clinical Charging $\rightarrow$ Bed Transfer $\rightarrow$ Medical Clearance $\rightarrow$ Settlement Engine $\rightarrow$ SOA/OR | `0:00 - 0:30` |
| **1** | **Patient Admission & Bed Assignment** | `views/admissions.html` | Admitting patient, selecting bed (Available vs Occupied), assigning attending doctor | `0:30 - 1:30` |
| **2** | **Clinical Orders & Live Charges** | `views/admission_details.html` | Prescribing medicines/scans, 5-stage fulfillment micro-stepper, live billing ledger posting | `1:30 - 2:45` |
| **3** | **Bedside Visits & Room Transfer** | `views/admission_details.html` | Doctor PF logging, doctor bed transfer order, nurse triage, automatic lodging charge calculation | `2:45 - 3:45` |
| **4** | **Medical Clearance & Billing Settlement** | `views/admission_details.html` | Physician clearance, 20% Senior/PWD discount, 12% VAT exemption, change vs. promissory note | `3:45 - 5:15` |
| **5** | **Statement of Account & Official Receipt** | `views/invoice_print.html` & `views/payment_receipt.html` | Itemized SOA printout, official payment voucher, bed vacancy release, invoices registry | `5:15 - 6:00` |

---

## Detailed Step-by-Step Script & Narration

---

### [0:00 – 0:30] Scene 0: Introduction & Billing Process Scope

#### Screen Action
* Open the browser directly to the **Admissions Hub** (`views/admissions.html`).
* Ensure browser address bar is clean and sidebar is visible.
* Keep the cursor centered on the active in-patient admissions table.

#### Narration (Spoken Word-for-Word)
> *"Good day, respected evaluators and panelists. Today, we demonstrate the core financial and billing lifecycle of our In-Patient Hospital Management System.*
> 
> *Unlike outpatient clinics, in-patient hospital billing is dynamic and continuous. A patient’s bill accumulates in real time—from bed accommodation and clinical doctor rounds to pharmacy orders, laboratory scans, and room transfers.*
> 
> *In this demonstration, we focus exclusively on the complete transaction journey: starting from patient admission and bed claim, moving through real-time clinical charging and fulfillment tracking, and concluding with medical discharge, statutory discount computations, customer change handling, promissory note agreements, and official BIR-standard billing printouts. Let us begin at Patient Admission."*

---

### [0:30 – 1:30] Scene 1: Patient Admission & Intelligent Bed Assignment

#### Screen Action
1. On the **In-Patient Admissions** page (`views/admissions.html`), click the primary button: **`+ New Patient Admission`**.
2. In the **New Patient Admission Modal**:
   - Click the **Patient Lookup** input. The lookup picker displays registered patients. Select an available patient (e.g., *Juan Dela Cruz*). Point out that patients who are already admitted have an "Admitted" status badge to prevent double admission.
   - In **Chief Complaint & Initial Diagnosis**, enter: `Acute Exacerbation of Bronchial Asthma; Telemetry Monitoring required`.
   - Click **Select Bed / Room**. The Bed Picker modal opens.
   - **Highlight the Bed Occupancy Indicators:**
     - Point your cursor at the green **Available** badges vs red **Occupied** badges.
     - Note that occupied beds show the current occupant’s name and are disabled to prevent duplicate occupancy.
     - Select a vacant bed (e.g., `Bed WARD-101 — General Ward • ₱500.00/day`).
   - In **Attending Physician**, select the doctor (e.g., `Dr. Maria Santos (Attending Physician)`).
3. Click **Submit Admission**.
4. The system confirms admission and automatically redirects directly into the **Patient Chart & Billing Hub** (`views/admission_details.html`).

#### Narration (Spoken Word-for-Word)
> *"Our billing journey begins at the Admissions Desk. When admitting an in-patient, the system links clinical diagnosis with immediate financial accountabilities.*
> 
> *Notice our intelligent Bed Selection Picker: occupied beds throughout the facility are clearly marked in red with occupant details and disabled from selection. Only verified vacant beds can be claimed.*
> 
> *Once we select an available bed in the General Ward at five hundred pesos per day and assign the attending physician, submitting the admission generates a unique Admission ID and instantly claims the bed facility-wide. We are immediately routed into the patient’s live Chart and Billing Hub."*

---

### [1:30 – 2:45] Scene 2: Real-Time Clinical Charging & Fulfillment Tracking

#### Screen Action
1. On `views/admission_details.html`:
   - Point out the **Patient Financial Summary Cards** at the top:
     - *Total Charges:* `₱0.00`
     - *Doctor Rounds / PF:* `₱0.00`
     - *Board & Lodging:* `₱0.00`
     - *Net Balance Due:* `₱0.00`
2. Scroll to the **Clinical Care & Charges** tab $\rightarrow$ **Physician Orders & Requests**.
3. Click **`+ Place New Clinical Order`**:
   - Select Item: `Salbutamol 2mg/5mL Syrup` (Central Pharmacy, Unit Price: `₱120.00`).
   - Enter Quantity: `2`.
   - Enter Dosage Instructions: `10mL TID for wheezing`.
   - Click **Submit Order**.
4. Click **`+ Place New Clinical Order`** again:
   - Select Item: `Chest X-Ray (AP/Lateral)` (Radiology & Imaging, Unit Price: `₱850.00`).
   - Enter Quantity: `1`.
   - Click **Submit Order**.
5. **Showcase the Redesigned Clinical Orders History Table:**
   - Highlight the **Stage Filter Pills Bar** (`All Orders`, `Requested`, `Preparing`, `Prepared & Ready`, `Out for Delivery`, `Administered`).
   - Highlight the **5-Segment Micro-Stepper Tracking Bar** (`Step 1/5: Requested`).
   - Explain how fulfilling departments update orders through the Department Queue.
   - Point to the **Live Billing Ledger** sub-panel:
     - Show that once an order is marked administered or verified, charges automatically post to the itemized ledger with unit prices, quantity multipliers, and timestamps.
     - Show the top header financial metrics updating automatically to reflect the new charges.

#### Narration (Spoken Word-for-Word)
> *"During hospitalization, clinical interventions occur continuously. Here in the Clinical Care and Charges tab, attending doctors issue clinical requests for pharmaceuticals, radiology scans, and nursing procedures.*
> 
> *Notice the Clinical Orders History table, designed with the exact ergonomic layout of our Department Queue. Each order displays its fulfilling station, unit rates, dosage instructions, and a 5-stage fulfillment micro-stepper bar.*
> 
> *This establishes strict clinical-financial governance: orders begin as 'Requested', move through preparation and nurse dispatch, and only post financial charges to the Live Billing Ledger upon actual administration. This eliminates erroneous pre-billing and protects patient rights."*

---

### [2:45 – 3:45] Scene 3: Doctor Bedside Rounds & Room Transfer Lodging

#### Screen Action
1. Switch to the **Doctor Bedside Visits & PF** sub-tab:
   - Click **`+ Log Bedside Visit`**.
   - Select Attending Doctor `Dr. Maria Santos`.
   - The system auto-fills the doctor’s standard round fee (e.g., `₱800.00`).
   - Enter Visit Notes: `Patient evaluated; lungs cleared, stable vitals; continue current regimen`.
   - Click **Save Bedside Visit**.
   - Show the Professional Fee immediately appearing in the Visits Log and running ledger.
2. Switch to **Board & Lodging / Bed Stays & Transfers**:
   - Point out the active stay on `Bed WARD-101` with daily rate calculation.
   - Click **`+ Order Bed Transfer`**:
     - Attending physician selects Target Room Classification: `Private Room`.
     - Clinical Reason: `Patient requesting transfer to Private Room for recovery`.
     - Click **Issue Bed Transfer Order**.
   - Click **`Execute Bed Transfer`** (Nurse Station execution):
     - Select target bed: `Bed PRIV-201 — Private Room (₱1,200.00/day)`.
     - Click **Confirm Bed Transfer**.
   - Point to the Bed Occupancy History table:
     - Show the previous Ward stay closed with calculated lodging hours/days.
     - Show the new Private Room stay active.
     - Show the Live Billing Ledger updated with the exact board-and-lodging charge.

#### Narration (Spoken Word-for-Word)
> *"Next, we demonstrate physician professional fees and room lodging.*
> 
> *When a physician conducts morning rounds, the nurse logs the bedside visit. The doctor's professional fee is instantly recorded with clinical progress notes and posted to the running bill.*
> 
> *If patient condition or preference warrants room relocation, our two-tier transfer protocol applies: the attending physician issues a Bed Transfer Order, and the Nurse Station executes the physical transfer. The billing engine automatically closes the previous bed stay, calculates the pro-rated lodging fee, frees the old bed for other patients, and begins billing the new room tier in real time."*

---

### [3:45 – 5:15] Scene 4: Medical Discharge & The Final Billing Settlement Engine

#### Screen Action
1. Click the green button: **`Medical Discharge Clearance`**:
   - Enter Discharge Summary: `Asthma resolved, stable for home discharge`.
   - Enter Home Medications: `Salbutamol inhaler PRN`.
   - Click **Confirm Medical Clearance**.
   - Show the Medical Clearance banner turning green (`Medically Cleared`).
2. Click the primary financial action button: **`Discharge & Settle Bill`**.
3. **The Final Settlement Modal opens. Walk through the calculation step-by-step:**
   - **Gross Charges Breakdown:**
     - Point to the itemized summary: Hospital Services + Pharmacy + Radiology + Doctor PF + Room & Board.
   - **Statutory 20% Senior Citizen / PWD Discount & 12% VAT Exemption:**
     - Check the **Senior Citizen / PWD Discount** checkbox.
     - Enter ID Number: `OSCA-789456`.
     - Point out the system calculating the **20% statutory deduction**.
     - Point out the **12% VAT Exemption** badge automatically zeroing out the VAT payable (`₱0.00 VAT`), in strict compliance with Philippine Republic Acts 9994 and 10754.
   - **Test Case A: Customer Change (Overpayment):**
     - Point to Net Total Due (e.g., `₱3,450.00`).
     - In Amount Tendered, type `₱4,000.00`.
     - Point out the bright green indicator: **Customer Change: ₱550.00**.
   - **Test Case B: Partial Payment with Promissory Note Formalization:**
     - Erase `₱4,000.00` and type a partial payment of `₱1,000.00`.
     - Watch the modal dynamically expand the **Promissory Note Agreement Card**:
       - *Remaining Unpaid Balance:* `₱2,450.00`.
       - Select Installment Plan: `3-Month Plan (Equal Monthly Installments)`.
       - Next Due Date is automatically calculated and set.
       - Enter Guarantor Full Name: `Roberto Dela Cruz`.
       - Enter Relationship: `Brother / Primary Co-Maker`.
       - Enter Contact: `0917-123-4567`.
       - Check: `[x] I verify the guarantor has signed the physical promissory agreement`.
4. Click **Confirm Settlement & Complete Discharge**.
5. System displays a success alert: *Billing Settled, Promissory Note Formalized, Patient Discharged, and Bed Released.*

#### Narration (Spoken Word-for-Word)
> *"We now reach the climax of the in-patient billing cycle: Final Discharge and Settlement.*
> 
> *First, clinical protocol requires attending physician clearance. Once cleared, the billing cashier accesses the Final Settlement Engine.*
> 
> *Observe the mathematical precision of our billing calculator:
> When we check Senior Citizen or PWD discount, the engine immediately applies the twenty percent statutory deduction and enforces the twelve percent VAT exemption.*
> 
> *Our settlement modal handles real-world cashier scenarios seamlessly:
> If the family pays in excess cash, the system calculates and prints exact customer change.
> But if the family cannot settle the full bill today, our system provides an ethical and compliant solution. By tendering a partial payment of one thousand pesos, the engine dynamically activates the Promissory Note Agreement. The remaining two thousand four hundred fifty pesos is structured into a formal three-month installment plan with designated due dates, legal guarantor accountability, and co-maker details.*
> 
> *When we confirm settlement, the patient is officially discharged, the invoice is finalized, and the hospital bed is immediately released back to the Available pool for new emergency admissions."*

---

### [5:15 – 6:00] Scene 5: Official Statements of Account, Receipts & Invoices Registry

#### Screen Action
1. Open the generated **Official Statement of Account (SOA)** (`views/invoice_print.html`):
   - Point out the formal Hospital Header, Patient Demographics, Room/Bed history.
   - Show the itemized chronological ledger with subtotals per department.
   - Show the statutory deduction line, PhilHealth coverage, net bill, cash paid, and outstanding promissory note balance.
   - Point out the signature certification lines for Chief Cashier, Billing Officer, and Patient/Guarantor.
2. Open the **Official Payment Receipt** (`views/payment_receipt.html`):
   - Point out the official OR Number, payment method, amount tendered, change returned, and remaining balance voucher.
3. Briefly navigate to the **Invoices Registry** (`views/invoices.html`):
   - Show the newly generated Invoice listed.
   - Highlight the status badge: **Promissory Note Active** with the outstanding balance.
   - Click the row to show the settlement history audit log.

#### Narration (Spoken Word-for-Word)
> *"Upon confirmation, the system instantly outputs official, audit-ready hospital documentation:*
> 
> *Here is the Official Statement of Account, or SOA. It presents an itemized breakdown categorized by hospital cost centers, doctor fees, room lodging, and statutory discount deductions, finalized with legal signature lines for hospital audit and insurance claims.*
> 
> *Accompanying the SOA is the Official Payment Receipt voucher, detailing the cashier identification, official OR number, cash tendered, and active promissory note balance.*
> 
> *Finally, in the Invoices Hub, finance officers can track all settled admissions alongside active promissory note aging schedules, guaranteeing total financial transparency from admission to complete account clearance.*
> 
> *This concludes our demonstration of the In-Patient Hospital Billing Process. Thank you very much for your time."*

---

## Technical Tips for Recording Your Video

1. **Clean Screen Setup:**
   - Press `F11` in your browser to go full screen.
   - Hide the Chrome bookmark bar (`Ctrl + Shift + B`).
   - Clear browser cache before recording so badge colors and animations render cleanly.
2. **Pre-populate Realistic Test Data:**
   - Ensure you have an admitted patient with a few realistic medication charges, bedside rounds, and bed logs already in the system, or follow the script's exact step-by-step click path.
3. **Pacing and Cursor Movement:**
   - Move the mouse deliberately. When pointing out figures (e.g., VAT exemption or Customer Change), pause for 1–2 seconds on the element.
4. **Audio Clarity:**
   - Keep microphone 4–6 inches from your mouth.
   - Speak in a steady, confident cadence matching the word-for-word voiceover script above.
