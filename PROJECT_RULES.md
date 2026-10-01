# Hospital Billing System — Project Rules & Architecture Guidelines

> **MANDATORY INSTRUCTION FOR ALL AI AGENTS & DEVELOPERS:**
> Read this entire document before reading, writing, editing, or executing any code in this repository. All rules listed below are strictly enforced.

---

## 1. Strict Coding Standards

1. **STRICTLY ZERO COMMENTS**
   - Do **NOT** write any comments in HTML, CSS, JavaScript, or PHP files.
   - Prohibited comment formats: `//`, `/* ... */`, `<!-- ... -->`, and `#` (except for valid CSS ID selectors like `#btnSubmit` or PHP `#include` which does not apply here).
   - Code must be self-explanatory through clean naming conventions and clean structure.

2. **STRICTLY ARROW FUNCTIONS IN JAVASCRIPT**
   - All JavaScript functions must be defined using arrow functions:
     ```javascript
     const loadData = async () => { ... };
     const handleClick = (e) => { ... };
     ```
   - **Never** use traditional `function functionName() { ... }` or anonymous `function() { ... }` declarations.

3. **STRICTLY UTF-8 ENCODING WITHOUT MOJIBAKE**
   - All files must be saved with clean UTF-8 encoding.
   - Do **not** run Windows PowerShell file replacement commands (`Set-Content`, `Out-File`) that re-encode files to Windows-1252 or ANSI, which corrupts special characters (`₱`, `✔`, `—`, `🔍`, `💊`, `🛏️`, `🩺`).
   - If writing scripts or replacing text, always ensure UTF-8 encoding is preserved.

4. **CLICKABLE FILE LINKS IN ALL RESPONSES**
   - Whenever referencing files or symbols to the user, always format paths as clickable markdown links using the `file:///` URI scheme (e.g. `[views/rooms.html](file:///C:/xampp/htdocs/Hospital_Billing/views/rooms.html)`).

---

## 2. Technology Stack & Environment

- **Frontend:** Pure HTML5, CSS3, and Vanilla JavaScript (ES6+).
- **Backend:** Native PHP REST API (`api/GET/` and `api/POST/` endpoints).
- **Database:** MySQL relational database managed via local XAMPP (`database/schema.sql`).
- **HTTP Client:** Axios loaded via CDN script tag (`https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js`).
- **Web Server:** Local Apache server running inside XAMPP (`http://localhost/Hospital_Billing/`).
- **NO FRAMEWORKS / NO BUILD TOOLS:** Do not install Node packages, Vite, React, Next.js, Webpack, or TypeScript unless explicitly commanded by the user.

---

## 3. UI & Component Architecture

### Layout Structure
- **Sidebar:** Injected dynamically into `#sidebar-container` via `js/sidebar.js`.
- **Topbar:** Contains page title, current user info (`#user-display`), and logout button (`#btn-logout`).
- **Card Containers:** Main data tables and panels reside inside `.card` containers with `.card-header` and `.card-body`.
- **Filter Bars:** Form controls inside `.filter-bar` are for real-time table filtering and sorting only.

### Modal Design System
- Modals use the `.modal-overlay` and `.modal-container` classes.
- Modal open/close actions must use `openModal(modalId)` and `closeModal(modalId)` from `js/common.js`.
- Separate View-only modals (e.g. `#viewDepartmentModal`, `#viewRoomModal`) from Add/Edit form modals (`#formModal`).
- Form modals follow this standard footer layout:
  ```
  [Send to Archive]   [Reset]  ··· margin-right: auto ···  [Cancel]   [Submit]
  ```
  - `#btnArchive`: Hidden on Add mode; visible on Edit mode.
  - `#btnReset`: Has `margin-right: auto` to push Cancel and Submit to the right edge.
  - `#btnCancel`: Styled with subtle secondary slate background and border.
  - `#btnSubmit`: Primary brand color with active glow.

### Form Dropdowns vs. Lookup Picker Windows
- Table filter/sort dropdowns in `.filter-bar` remain standard `<select>` elements.
- **Form foreign-key and category inputs** use the interactive **Lookup Picker Window** (`openGenericLookupPicker` from `js/common.js`):
  ```html
  <div class="input-lookup-group">
      <input type="hidden" id="field_id" required>
      <input type="text" id="field_id_text" class="form-control" placeholder="Click to select..." readonly>
      <button type="button" id="btnBrowse_field_id" class="btn btn-outline btn-lookup">Select</button>
  </div>
  ```
- Lookup windows feature real-time search, sorting (A-Z, Z-A, Selected First), status indicators, and clean escape/backdrop closing.

### Cache-Busting
- All CSS and JS imports in `views/*.html` must use query string versioning (e.g. `<link rel="stylesheet" href="../css/common.css?v=5.1">` and `<script src="../js/rooms.js?v=5.1"></script>`).
- When modifying shared stylesheets or scripts, increment the version query parameter to prevent browser caching.

---

## 4. Key Modules & Data Flow

| Module | Core Responsibility |
| :--- | :--- |
| **Patients** (`patients.html`) | Demographic records, emergency contacts, blood type, and active bed stay tracking. |
| **Doctors & Fees** (`doctors.html`) | Physician profiles, classification, department assignments, round fees, and specialties lookup modal. |
| **Departments & Stations** (`departments.html`) | Clinical stations, station code prefixes, and assigned clinical personnel / users. |
| **Rooms & Beds** (`rooms.html`) | Room classification, daily board & lodging rates, capacity, bed code generation, and bed occupancy history modal. |
| **Admissions** (`admissions.html`) | In-patient admission workflow, vacant bed assignment, and attending doctor assignment. |
| **Patient Chart & Clinical Hub** (`admission_details.html`) | Bedside doctor rounds logging, pharmacy orders, scan/service charges, bed transfers, and diagnosis recording. |
| **Charge Catalogs** (`catalogs.html`) | Master catalog of billable Medicines (MED), Equipment Scans (RAD), and Medical Services (SRV). |
| **Billing Discounts** (`discounts.html`) | Statutory discounts (Senior Citizen 20%, PWD) and hospital policy adjustments. |
| **Invoices & Settlement** (`invoices.html`) | Itemized account statements, discount application, payment recording, and transaction history. |
| **Print Views** | Statement of Account (`invoice_print.html`), Interim Partial Bill (`partial_bill.html`), Official Receipt (`payment_receipt.html`). |

---

## 5. Verification Checklist Before Finishing Any Task

Before completing any task or handing off to another agent, verify:
- [ ] Every modified JavaScript file passes syntax validation (`node -c <file>`).
- [ ] Exactly **zero comments** exist in any modified HTML, CSS, JS, or PHP files.
- [ ] All functions are **arrow functions** (`const fn = () =>`).
- [ ] Character encoding is intact (`₱` Philippine Peso, checkmarks `✔`, em dashes `—`).
- [ ] Cache-busting query strings on HTML views are bumped if CSS/JS changed.
- [ ] No temporary or scratch files are left in the repository directory.

git add .
git commit -m "Working checkpoint: lookup pickers clean and working"