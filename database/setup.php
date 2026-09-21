<?php
/**
 * Database Setup & Migration Seeder (Revised Architecture)
 * Hospital Billing and Patient Information System
 * 
 * Usage: Open http://localhost/Hospital_Billing/database/setup.php in your browser
 */

$host = 'localhost';
$user = 'root';
$pass = '';

try {
    // 1. Connect to MySQL Server
    $pdo = new PDO("mysql:host={$host};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // Drop and recreate clean database for structural migrations
    $pdo->exec("DROP DATABASE IF EXISTS hospital_billing_db");
    $pdo->exec("CREATE DATABASE hospital_billing_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE hospital_billing_db");

    // 2. Read and execute revised schema.sql
    $schemaFile = __DIR__ . '/schema.sql';
    if (!file_exists($schemaFile)) {
        die("Error: schema.sql file not found in " . __DIR__);
    }

    $sql = file_get_contents($schemaFile);
    $pdo->exec($sql);

} catch (PDOException $e) {
    die("Database Setup Failed: " . $e->getMessage());
}

echo "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Database Setup</title>";
echo "<link rel='stylesheet' href='https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css'>";
echo "</head><body class='bg-light p-4'><div class='container' style='max-width: 850px;'>";
echo "<div class='card shadow-sm p-4'>";
echo "<h3 class='text-success mb-3'>✔ Database Setup & Seeders Complete (Revised Architecture)</h3>";
echo "<p class='text-muted'>Initializing normalized lookup tables, master directories, and realistic sample data...</p>";
echo "<hr><ul class='list-group list-group-flush mb-4'>";

// ── 1. GENDER LOOKUP ─────────────────────────────────────────
$pdo->exec("INSERT INTO Enum_Gender (Gender_ID, Gender_Name) VALUES
    (1, 'Male'), (2, 'Female'), (3, 'Other')");
echo "<li class='list-group-item'>✔ <strong>Enum_Gender:</strong> Male, Female, Other</li>";

// ── 2. BLOOD TYPE LOOKUP ─────────────────────────────────────
$pdo->exec("INSERT INTO Enum_Blood_Type (Blood_Type_ID, Blood_Type_Name) VALUES
    (1, 'A+'), (2, 'A-'), (3, 'B+'), (4, 'B-'), (5, 'AB+'), (6, 'AB-'), (7, 'O+'), (8, 'O-')");
echo "<li class='list-group-item'>✔ <strong>Enum_Blood_Type:</strong> A+, B+, AB+, O+, etc.</li>";

// ── 3. ROOM CLASSIFICATIONS ──────────────────────────────────
$pdo->exec("INSERT INTO Enum_Room_Type (Room_Type_ID, Type_Name, Code_Prefix, Daily_Rate, Is_Active) VALUES
    (1, 'General Ward',             'WRD',   500.00, 1),
    (2, 'Semi-Private Room',        'SPVT', 1200.00, 1),
    (3, 'Private Room',             'PVT',  2000.00, 1),
    (4, 'Intensive Care Unit (ICU)','ICU',  5000.00, 1)");
echo "<li class='list-group-item'>✔ <strong>Enum_Room_Type:</strong> Ward (500), Semi-Private (1200), Private (2000), ICU (5000)</li>";

// ── 4. DOCTOR CLASSIFICATIONS ────────────────────────────────
$pdo->exec("INSERT INTO Enum_Doctor_Type (Doctor_Type_ID, Type_Name, Is_Active) VALUES
    (1, 'Resident Physician', 1),
    (2, 'Attending Specialist', 1)");
echo "<li class='list-group-item'>✔ <strong>Enum_Doctor_Type:</strong> Resident Physician, Attending Specialist</li>";

// ── 5. MEDICAL SPECIALTIES ───────────────────────────────────
$pdo->exec("INSERT INTO Enum_Specialty (Specialty_ID, Specialty_Name, Is_Active) VALUES
    (1, 'Internal Medicine', 1),
    (2, 'Cardiology', 1),
    (3, 'Radiology & Diagnostic Imaging', 1),
    (4, 'General Surgery', 1),
    (5, 'Pediatrics', 1),
    (6, 'Pulmonology', 1),
    (7, 'Orthopedics', 1)");
echo "<li class='list-group-item'>✔ <strong>Enum_Specialty:</strong> Internal Med, Cardiology, Radiology, Surgery, Pediatrics, etc.</li>";

// ── 6. DEPARTMENT & CHARGING STATIONS ────────────────────────
$pdo->exec("INSERT INTO Enum_Department_Station (Station_ID, Station_Name, Code_Prefix, Is_Active) VALUES
    (1, 'Central Pharmacy',         'PHARM', 1),
    (2, 'Radiology & Imaging',      'RAD',   1),
    (3, 'Cardiology Station',       'CARD',  1),
    (4, 'Laboratory',               'LAB',   1),
    (5, 'Nurse Station',            'NRS',   1),
    (6, 'Physical Therapy & Rehab', 'PT',    1),
    (7, 'Billing & Cashier',        'BLG',   1)");
echo "<li class='list-group-item'>✔ <strong>Enum_Department_Station:</strong> Pharmacy, Radiology, Cardiology, Lab, Nurse Station, PT, Billing</li>";

// ── 7. CATALOG TYPES ─────────────────────────────────────────
$pdo->exec("INSERT INTO Enum_Catalog_Type (Catalog_Type_ID, Type_Name, Code_Prefix, Is_Active) VALUES
    (1, 'Medicine',                     'MED', 1),
    (2, 'Equipment / Diagnostic Scan',  'RAD', 1),
    (3, 'Procedure / Service',          'SRV', 1)");
echo "<li class='list-group-item'>✔ <strong>Enum_Catalog_Type:</strong> Medicine (MED), Diagnostic Scan (RAD), Procedure (SRV)</li>";

// ── 8. BILLING DISCOUNTS ─────────────────────────────────────
$pdo->exec("INSERT INTO Enum_Discount (Discount_ID, Discount_Name, Discount_Percentage, Is_Active) VALUES
    (1, 'Senior Citizen',                 20.00, 1),
    (2, 'Person with Disability (PWD)',   20.00, 1),
    (3, 'Government Employee',            10.00, 1)");
echo "<li class='list-group-item'>✔ <strong>Enum_Discount:</strong> Senior Citizen (20%), PWD (20%), Government (10%)</li>";

// ── 9. SYSTEM USER ROLES ─────────────────────────────────────
$pdo->exec("INSERT INTO Enum_User_Role (Role_ID, Role_Name) VALUES
    (1, 'Admin'),
    (2, 'Finance Staff'),
    (3, 'Nurse')");
echo "<li class='list-group-item'>✔ <strong>Enum_User_Role:</strong> Admin, Finance Staff, Nurse</li>";

// ── 10. SYSTEM USERS ─────────────────────────────────────────
$users = [
    [1, 'USR-001', 'System',  'Admin', 'admin',   'admin123',   1],
    [2, 'USR-002', 'Finance', 'Staff', 'finance', 'finance123', 2],
    [3, 'USR-003', 'Jane',    'Nurse', 'nurse',   'nurse123',   3],
];
$stmt = $pdo->prepare("INSERT INTO System_User (User_ID, User_Code, First_Name, Last_Name, Username, Password_Hash, Role_ID, Is_Active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)");
foreach ($users as $u) {
    $hash = password_hash($u[5], PASSWORD_DEFAULT);
    $stmt->execute([$u[0], $u[1], $u[2], $u[3], $u[4], $hash, $u[6]]);
}
echo "<li class='list-group-item'>✔ <strong>System_User:</strong> Default accounts (admin / finance / nurse)</li>";

// ── 11. PATIENT MASTER DIRECTORY ─────────────────────────────
$patients = [
    [1, 'PAT-001', 'Juan',     'Dela Cruz', '1985-04-12', 1, 1, '0917-123-4567', '123 Rizal St, Manila',        'Maria Dela Cruz', '0917-999-1111'],
    [2, 'PAT-002', 'Maria',    'Santos',    '1992-08-25', 2, 7, '0918-234-5678', '45 Mabini Ave, Quezon City',  'Pedro Santos',    '0918-888-2222'],
    [3, 'PAT-003', 'Antonio',  'Luna',      '1970-11-03', 1, 3, '0919-345-6789', '78 Bonifacio Rd, Makati',    'Clara Luna',      '0919-777-3333'],
    [4, 'PAT-004', 'Teresa',   'Magbanua',  '1998-02-14', 2, 5, '0920-456-7890', '12 Luna St, Pasig',           'Elias Magbanua',  '0920-666-4444'],
    [5, 'PAT-005', 'Emilio',   'Aguinaldo', '1955-03-22', 1, 7, '0921-567-8901', '89 Kawit Blvd, Cavite',       'Hilaria Del Rosario','0921-555-5555']
];
$stmt = $pdo->prepare("INSERT INTO Patient (Patient_ID, Patient_Code, First_Name, Last_Name, Date_Of_Birth, Gender_ID, Blood_Type_ID, Contact_Number, Address, Emergency_Contact_Name, Emergency_Contact_Number, Is_Active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)");
foreach ($patients as $p) {
    $stmt->execute($p);
}
echo "<li class='list-group-item'>✔ <strong>Patient Master:</strong> 5 sample patients with blood types, demographics, and emergency contacts</li>";

// ── 12. DOCTORS & MULTI-SPECIALTIES ──────────────────────────
$pdo->exec("INSERT INTO Doctor (Doctor_ID, Doctor_Code, First_Name, Last_Name, Doctor_Type_ID, Base_Round_Fee, Is_Active) VALUES
    (1, 'DR-001', 'Maria', 'Santos', 2, 1500.00, 1),
    (2, 'DR-002', 'Jose',  'Reyes',  2, 1200.00, 1),
    (3, 'DR-003', 'Ana',   'Cruz',   1,  800.00, 1),
    (4, 'DR-004', 'Pedro', 'Gomez',  1,  750.00, 1)");

// Doctor Multi-Specialty Assignments
$pdo->exec("INSERT INTO Doctor_Specialty (Doctor_ID, Specialty_ID) VALUES
    (1, 1), -- Dr. Santos: Internal Medicine
    (1, 2), -- Dr. Santos: Cardiology (Multiple specialties at once!)
    (2, 3), -- Dr. Reyes: Radiology & Diagnostic Imaging
    (3, 1), -- Dr. Cruz: Internal Medicine
    (3, 6), -- Dr. Cruz: Pulmonology
    (4, 4)  -- Dr. Gomez: General Surgery
");
echo "<li class='list-group-item'>✔ <strong>Doctor Master & Doctor_Specialty:</strong> 4 doctors with multi-specialty bridge records</li>";

// ── 13. ROOMS & WARDS WITH BEDS ──────────────────────────────
$pdo->exec("INSERT INTO Room (Room_ID, Room_Number, Room_Type_ID, Daily_Rate, Capacity_Beds, Is_Active) VALUES
    (1, 'WRD-01',   1,  500.00, 4, 1),
    (2, 'WRD-02',   1,  500.00, 4, 1),
    (3, 'SPVT-201', 2, 1200.00, 2, 1),
    (4, 'PVT-301',  3, 2000.00, 1, 1),
    (5, 'PVT-302',  3, 2500.00, 1, 1),
    (6, 'ICU-401',  4, 5000.00, 2, 1)");

$beds = [
    // WRD-01 (4 Beds)
    [1, 'Bed-01', 'WRD-01-B01', 1],
    [1, 'Bed-02', 'WRD-01-B02', 1],
    [1, 'Bed-03', 'WRD-01-B03', 1],
    [1, 'Bed-04', 'WRD-01-B04', 1],
    // WRD-02 (4 Beds)
    [2, 'Bed-01', 'WRD-02-B01', 1],
    [2, 'Bed-02', 'WRD-02-B02', 1],
    [2, 'Bed-03', 'WRD-02-B03', 1],
    [2, 'Bed-04', 'WRD-02-B04', 1],
    // SPVT-201 (2 Beds)
    [3, 'Bed-01', 'SPVT-201-B01', 1],
    [3, 'Bed-02', 'SPVT-201-B02', 1],
    // PVT-301 & PVT-302 (1 Bed each)
    [4, 'Bed-01', 'PVT-301-B01', 1],
    [5, 'Bed-01', 'PVT-302-B01', 1],
    // ICU-401 (2 Beds)
    [6, 'Bed-01', 'ICU-401-B01', 1],
    [6, 'Bed-02', 'ICU-401-B02', 1],
];
$stmt = $pdo->prepare("INSERT INTO Bed (Room_ID, Bed_Number, Bed_Code, Is_Available, Is_Active) VALUES (?, ?, ?, ?, 1)");
foreach ($beds as $b) {
    $stmt->execute($b);
}
echo "<li class='list-group-item'>✔ <strong>Room & Bed Hierarchy:</strong> 6 Wards/Rooms containing 14 individual beds</li>";

// ── 14. MERGED CHARGE CATALOGS ───────────────────────────────
$pdo->exec("INSERT INTO Charge_Catalog (Catalog_Type_ID, Station_ID, Item_Code, Item_Name, Hospital_Fee, Reader_Fee, Total_Fee, Performer_Role, Is_Active) VALUES
    -- Medicines (Type 1, Prefix MED)
    (1, 1, 'MED-001', 'Paracetamol 500mg Tablet',        15.00,   0.00,   15.00, 'Pharmacy Staff', 1),
    (1, 1, 'MED-002', 'Amoxicillin 500mg Capsule',       25.00,   0.00,   25.00, 'Pharmacy Staff', 1),
    (1, 1, 'MED-003', 'Omeprazole 20mg Capsule',         35.00,   0.00,   35.00, 'Pharmacy Staff', 1),
    (1, 1, 'MED-004', 'Metformin 500mg Tablet',          18.00,   0.00,   18.00, 'Pharmacy Staff', 1),
    (1, 1, 'MED-005', 'Losartan 50mg Tablet',            28.00,   0.00,   28.00, 'Pharmacy Staff', 1),
    (1, 1, 'MED-006', 'Cetirizine 10mg Tablet',          12.00,   0.00,   12.00, 'Pharmacy Staff', 1),
    (1, 1, 'MED-007', 'Ibuprofen 400mg Tablet',          20.00,   0.00,   20.00, 'Pharmacy Staff', 1),
    (1, 1, 'MED-008', 'Azithromycin 500mg Tablet',       45.00,   0.00,   45.00, 'Pharmacy Staff', 1),

    -- Equipment & Diagnostic Scans (Type 2, Prefix RAD)
    (2, 2, 'RAD-001', 'Chest X-Ray PA View',             350.00, 150.00,  500.00, 'Radiologic Technologist', 1),
    (2, 2, 'RAD-002', 'Abdominal Ultrasound',            600.00, 300.00,  900.00, 'Sonologist / Radiologist', 1),
    (2, 2, 'RAD-003', 'Head CT-Scan (Plain)',           2500.00,1000.00, 3500.00, 'CT Technologist / Radiologist', 1),
    (2, 3, 'RAD-004', '12-Lead Electrocardiogram (ECG)',  250.00, 150.00,  400.00, 'Cardiology Technologist', 1),
    (2, 3, 'RAD-005', '2D Echocardiogram with Doppler', 1800.00, 700.00, 2500.00, 'Cardiologist', 1),
    (2, 4, 'RAD-006', 'Complete Blood Count (CBC)',      150.00,  50.00,  200.00, 'Medical Technologist', 1),

    -- Hospital Procedures & Services (Type 3, Prefix SRV)
    (3, 5, 'SRV-001', 'IV Cannulation & Line Insertion', 150.00,   0.00,  150.00, 'Staff Nurse', 1),
    (3, 5, 'SRV-002', 'Wound Dressing & Cleaning',       200.00,   0.00,  200.00, 'Staff Nurse', 1),
    (3, 5, 'SRV-003', 'Vital Signs Monitoring (Daily)',   50.00,   0.00,   50.00, 'Staff Nurse', 1),
    (3, 4, 'SRV-004', 'Blood Extraction (Phlebotomy)',    80.00,   0.00,   80.00, 'Medical Technologist', 1),
    (3, 5, 'SRV-005', 'Nebulization Therapy',            120.00,   0.00,  120.00, 'Staff Nurse / Respiratory Tech', 1),
    (3, 6, 'SRV-006', 'Physical Therapy Session',        500.00,   0.00,  500.00, 'Physical Therapist', 1),
    (3, 5, 'SRV-007', 'Catheter Insertion',              250.00,   0.00,  250.00, 'Resident Physician / Senior Nurse', 1)
");
echo "<li class='list-group-item'>✔ <strong>Charge_Catalog:</strong> 21 items merged (8 Medicines [MED], 6 Scans [RAD], 7 Procedures [SRV])</li>";

echo "</ul>";
echo "<div class='alert alert-success'><strong>Migration Successful!</strong> The revised database architecture has been loaded into <code>hospital_billing_db</code>.</div>";
echo "<p><a href='../views/index.html' class='btn btn-primary'>Proceed to Dashboard &raquo;</a></p>";
echo "</div></div></body></html>";
?>
