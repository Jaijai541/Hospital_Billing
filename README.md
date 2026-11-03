# In-Patient Hospital Billing & Clinical Management System

A comprehensive, production-grade web-based hospital information, bedside charging, and inpatient billing system designed for acute care facilities and hospital administration.

Built with native PHP, MySQL, Vanilla JavaScript (ES6+), and real-time WebSockets.

---

## System Overview

The **In-Patient Hospital Billing & Clinical Management System** provides end-to-end management of the inpatient journey—from admission registration and vacant bed assignment to real-time clinical bedside charging, department order dispensing, statutory discount processing, final bill settlement, and discharge clearance.

```
[Patient Admission] ──► [Bed Assignment] ──► [Bedside Care & Doctor Rounds]
                                                          │
[Final Settlement]  ◄── [Discharge Clearance] ◄── [Pharmacy & Lab Orders]
```

---

## Key Features & Modules

### 1. In-Patient Admissions & Bed Management
- **Admission Registration**: Tracks admission type (Emergency, Elective, Urgent), initial diagnosis, and emergency contact details.
- **Visual Bed Selection**: Interactive bed picker displaying real-time occupancy status, room categories (ICU, Private, Semi-Private, Ward), and daily board & lodging rates.
- **Attending & Co-Attending Physicians**: Assign primary admitting doctors and secondary specialist doctors with shared clinical ordering permissions.
- **Bed Transfer Workflows**: Dual-mode bed transfer architecture supporting direct same-tier lateral room moves for Nurse Stations and required physician orders for ICU escalation or step-down.

### 2. Clinical Hub & Bedside Order Management
- **Bedside Doctor Rounds**: Physicians log daily bedside visits with clinical progress notes, automatically generating professional fee (PF) ledger entries.
- **Pharmacy & Diagnostic Orders**: Order billable medicines, equipment scans, and laboratory procedures directly from the patient chart.
- **Department Queue & Dispensing**: Pharmacy and Laboratory departments receive orders in real time, with status tracking (`Pending` ➔ `In-Progress` ➔ `Administered` / `Cancelled`).

### 3. Comprehensive Billing Ledger & Settlement
- **Live Running Ledger**: Dynamic subtotaling of room charges, doctor rounds, medications, and diagnostic tests.
- **Advance Payments & Assistance Vouchers**: Accepts pre-settlement advance deposits and government assistance vouchers (e.g., Malasakit Center, PCSO, DSWD) during active admission.
- **Statutory Discounts**: Automated deduction calculation for Senior Citizen (20%), PWD, PhilHealth case rates, and hospital employee benefits.
- **Settlement Modes**: Supports Full Cash/Online payment, Partial Payments, and formal Promissory Note (Accounts Receivable) deferrals.
- **Official Printouts**: Statement of Account (SOA), Official Receipts (OR), and Interim Partial Bills with standardized clinical typography.

### 4. Dual-Stage Discharge Clearance
- **Medical Clearance**: Attending physician certifies the patient is medically cleared for discharge.
- **Financial Clearance**: Cashier confirms full settlement or executed promissory note before issuing exit authorization.

### 5. Real-Time WebSocket Synchronization
- Native PHP WebSocket daemon broadcasting live events (`admissions`, `clinical_orders`, `invoices`, `transfers`) across staff workstations without requiring page reloads.

---

## Directory Structure

```text
Hospital_Billing/
├── api/                             # Backend RESTful API endpoints
│   ├── GET/                         # Read / query services
│   │   ├── admissions.php           # Admission retrieval & bed occupancy
│   │   ├── clinical_orders.php      # Chart orders, doctor rounds, & queue
│   │   ├── invoices.php             # Statements, receipts, & payment history
│   │   ├── patients.php             # Patient masterfile lookups
│   │   ├── rooms.php                # Room & bed availability status
│   │   └── ...                      # Catalogs, departments, & users
│   ├── POST/                        # Write / mutation services
│   │   ├── admissions.php           # Admitting, discharging, & bed transfers
│   │   ├── clinical_orders.php      # Placing & administering medical orders
│   │   ├── invoices.php             # Settlement, advance pay, & promissory notes
│   │   └── ...                      # Masterfile CRUD endpoints
│   ├── ws_server.php                # Native PHP WebSocket daemon
│   └── ws_notify.php                # WebSocket event broadcast dispatcher
├── css/                             # Modular clinical stylesheets
│   ├── admission_details.css        # Patient chart & settlement tab styles
│   ├── admissions.css               # Admission table & modal styling
│   ├── common.css                   # Core design tokens, modals, & tables
│   ├── department_orders.css        # Department queue styling
│   ├── invoices.css                 # Invoices & billing queue styles
│   └── ...                          # Print & masterfile styles
├── database/                        # Database schema & seed scripts
│   └── schema.sql                   # MySQL relational schema definition
├── docs/                            # Project documentation & presentation assets
│   ├── BILLING_PROCESS_VIDEO_SCRIPT.md   # Step-by-step billing walkthrough script
│   ├── VIDEO_PRESENTATION_SCRIPT.md     # Comprehensive 9-minute defense presentation
│   ├── defense_qa_handbook.docx          # Academic defense Q&A handbook
│   ├── ERD_Defense_Explanation.docx     # Entity-Relationship diagram technical guide
│   └── New_ERD_Inpatient.drawio.xml     # Full Draw.io / XML schema diagram
├── js/                              # Frontend controllers (Vanilla ES6+ arrow functions)
│   ├── admission_details.js         # Patient chart, rounds, orders, & settlement
│   ├── admissions.js                # Admission queue & bed assignment
│   ├── common.js                    # Lookup pickers, alerts, modals, & WebSocket client
│   ├── department_orders.js         # Pharmacy & laboratory order queues
│   ├── invoices.js                  # Invoices list, filter, & settlement triggers
│   └── ...                          # Masterfile CRUD scripts
├── views/                           # Frontend HTML views
│   ├── admission_details.html       # Patient electronic chart & billing hub
│   ├── admissions.html              # Inpatient admission management
│   ├── catalogs.html                # Medicines, scans, & services masterfiles
│   ├── department_orders.html       # Pharmacy / Laboratory fulfillment queue
│   ├── index.html                   # Dashboard & quick metrics
│   ├── invoices.html                # Invoices & discharge clearances
│   ├── reports.html                 # Financial summaries & analytics
│   └── rooms.html                   # Room & bed configuration
├── connection.php                   # Central PDO MySQL connection
├── index.html                       # Root application entrypoint
├── PROJECT_RULES.md                 # Enforced architectural & coding standards
└── start_websocket.bat              # Batch script to launch WebSocket server
```

---

## Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+), Axios CDN
- **Backend:** PHP 8.x (Native PDO, Object-Oriented Services)
- **Database:** MySQL 8.x / MariaDB (InnoDB engine, strict foreign key constraints)
- **Web Server:** Apache (via XAMPP)
- **Real-Time Daemon:** Native PHP CLI WebSockets (`ws_server.php` on port 8080)

---

## Installation & Setup

### 1. Prerequisites
- [XAMPP](https://www.apachefriends.org/) (Apache + PHP 8.1+ and MySQL)
- Git

### 2. Clone the Repository
Clone into your XAMPP `htdocs` directory:
```bash
cd C:\xampp\htdocs
git clone https://github.com/Jaijai541/Hospital_Billing.git
```

### 3. Database Configuration
1. Open XAMPP Control Panel and start **Apache** and **MySQL**.
2. Open phpMyAdmin (`http://localhost/phpmyadmin`) or MySQL CLI:
   ```sql
   CREATE DATABASE hospital_billing_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Import the schema file:
   - Import `database/schema.sql` into `hospital_billing_db`.
4. Verify database credentials in `connection.php`:
   ```php
   $host = "127.0.0.1";
   $user = "root";
   $password = "";
   $database = "hospital_billing_db";
   ```

### 5. Start the WebSocket Server (Optional for Real-Time Sync)
To enable instant cross-workstation updates without refreshing the browser:
```bash
cd C:\xampp\htdocs\Hospital_Billing
start_websocket.bat
```
*(Or run `php api/ws_server.php` from your terminal).*

### 6. Launch Application
Access the system in your web browser:
```
http://localhost/Hospital_Billing/views/index.html
```

---

## Documentation & Defense Resources

Full system documentation, defense guides, and video scripts are organized in the [`docs/`](docs/) directory:
- [BILLING_PROCESS_VIDEO_SCRIPT.md](docs/BILLING_PROCESS_VIDEO_SCRIPT.md): Step-by-step billing walkthrough from patient admission to final receipt.
- [VIDEO_PRESENTATION_SCRIPT.md](docs/VIDEO_PRESENTATION_SCRIPT.md): Comprehensive system demonstration script with timing cues.
- [defense_qa_handbook.docx](docs/defense_qa_handbook.docx): Defense handbook answering architectural and functional questions.
- [ERD_Defense_Explanation.docx](docs/ERD_Defense_Explanation.docx): In-depth walkthrough of the relational database design.
- [New_ERD_Inpatient.drawio.xml](docs/New_ERD_Inpatient.drawio.xml): Diagram file loadable in [diagrams.net (Draw.io)](https://app.diagrams.net/).

---

## 👨‍💻 Developer & Portfolio

### Hey, I’m Jaijai541! 👋

🎓 IT student | 🌱 Web developer | 🤖 AI-prompting explorer

I’m learning how to build things for the web and having fun along the way. I’m collecting projects and experiments here as I learn.

#### 🧰 Things I’m learning & building with:
- 🌐 HTML, CSS, and JavaScript
- 📱 Flutter
- ☕ Java & PHP / MySQL
- 🤖 AI Prompting & Agentic Workflows

#### 🎮 Beyond coding:
When I’m not learning something new, I’m probably gaming. I enjoy exploring how technology works and building tools that make hospital administration and software workflows smoother!
