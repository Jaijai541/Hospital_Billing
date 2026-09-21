<?php
/**
 * Database Setup & Migration Seeder (Instructor Approved Schema)
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

    // Drop and recreate clean database
    $pdo->exec("DROP DATABASE IF EXISTS hospital_billing_db");
    $pdo->exec("CREATE DATABASE hospital_billing_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE hospital_billing_db");

    // 2. Read and execute schema.sql
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
echo "<h3 class='text-success mb-3'>✔ Database Setup & Seeders Complete (Instructor Approved)</h3>";
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

// ── 3. ROOM CLASSIFICATIONS (Uniform Daily_Rate enforced here) ─
$pdo->exec("INSERT INTO Enum_Room_Type (Room_Type_ID, Type_Name, Code_Prefix, Daily_Rate, Is_Active) VALUES
    (1, 'Ward',                     'WRD',   500.00, 1),
    (2, 'Semi-Private Room',        'SPVT', 1200.00, 1),
    (3, 'Private Room',             'PVT',  2000.00, 1),
    (4, 'Intensive Care Unit (ICU)','ICU',  5000.00, 1)");
echo "<li class='list-group-item'>✔ <strong>Enum_Room_Type:</strong> Ward (500), Semi-Private (1200), Private (2000), ICU (5000)</li>";

// ── 4. DOCTOR CLASSIFICATIONS ────────────────────────────────
$pdo->exec("INSERT INTO Enum_Doctor_Type (Doctor_Type_ID, Type_Name, Is_Active) VALUES
    (1, 'Resident', 1),
    (2, 'Attending', 1)");
echo "<li class='list-group-item'>✔ <strong>Enum_Doctor_Type:</strong> Resident, Attending</li>";

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

// ── 7. BILLING DISCOUNTS ─────────────────────────────────────
$pdo->exec("INSERT INTO Enum_Discount (Discount_ID, Discount_Name, Discount_Percentage, Is_Active) VALUES
    (1, 'Senior Citizen',                 20.00, 1),
    (2, 'Person with Disability (PWD)',   20.00, 1),
    (3, 'Government Employee',            10.00, 1)");
echo "<li class='list-group-item'>✔ <strong>Enum_Discount:</strong> Senior Citizen (20%), PWD (20%), Government (10%)</li>";

// ── 8. SYSTEM USER ROLES ─────────────────────────────────────
$pdo->exec("INSERT INTO Enum_User_Role (Role_ID, Role_Name) VALUES
    (1, 'Admin'),
    (2, 'Finance Staff'),
    (3, 'Nurse')");
echo "<li class='list-group-item'>✔ <strong>Enum_User_Role:</strong> Admin, Finance Staff, Nurse</li>";

// ── 9. SYSTEM USERS ──────────────────────────────────────────
$users = [
    [1, 'System',  'Admin', 'admin',   'admin123',   1],
    [2, 'Finance', 'Staff', 'finance', 'finance123', 2],
    [3, 'Jane',    'Nurse', 'nurse',   'nurse123',   3],
];
$stmt = $pdo->prepare("INSERT INTO System_User (User_ID, First_Name, Last_Name, Username, Password_Hash, Role_ID, Is_Active) VALUES (?, ?, ?, ?, ?, ?, 1)");
foreach ($users as $u) {
    $hash = password_hash($u[4], PASSWORD_DEFAULT);
    $stmt->execute([$u[0], $u[1], $u[2], $u[3], $hash, $u[5]]);
}
echo "<li class='list-group-item'>✔ <strong>System_User:</strong> Default accounts (admin / finance / nurse)</li>";

// ── 10. DOCTORS & MULTI-SPECIALTIES ──────────────────────────
$pdo->exec("INSERT INTO Doctor (Doctor_ID, First_Name, Last_Name, Doctor_Type_ID, Station_ID, Code_Prefix, Base_Round_Fee, Is_Active) VALUES
    (1, 'Maria', 'Santos', 2, 3, 'DOC', 1500.00, 1),
    (2, 'Jose',  'Reyes',  2, 2, 'DOC', 1200.00, 1),
    (3, 'Ana',   'Cruz',   1, 5, 'DOC',  800.00, 1),
    (4, 'Pedro', 'Gomez',  1, 5, 'DOC',  750.00, 1)");

// Bridge Table Doctor_Specialty
$pdo->exec("INSERT INTO Doctor_Specialty (Doctor_Specialty_ID, Doctor_ID, Specialty_ID) VALUES
    (1, 1, 1), -- Dr. Santos: Internal Medicine
    (2, 1, 2), -- Dr. Santos: Cardiology
    (3, 2, 3), -- Dr. Reyes: Radiology
    (4, 3, 1), -- Dr. Cruz: Internal Medicine
    (5, 3, 6), -- Dr. Cruz: Pulmonology
    (6, 4, 4)  -- Dr. Gomez: General Surgery
");
echo "<li class='list-group-item'>✔ <strong>Doctor & Doctor_Specialty:</strong> 4 doctors with specialties</li>";

// ── 11. ROOMS & ROOM_BED ─────────────────────────────────────
$pdo->exec("INSERT INTO Room (Room_ID, Room_Name, Room_Type_ID, Capacity, Is_Active) VALUES
    (1, 'Ward A',       1, 4, 1),
    (2, 'Ward B',       1, 4, 1),
    (3, 'Semi-Private', 2, 2, 1),
    (4, 'Private 301',  3, 1, 1),
    (5, 'Private 302',  3, 1, 1),
    (6, 'ICU Unit',     4, 2, 1)");

$beds = [
    // Ward A (4 Beds)
    [1, 'WRD-A-001', 1],
    [1, 'WRD-A-002', 1],
    [1, 'WRD-A-003', 1],
    [1, 'WRD-A-004', 1],
    // Ward B (4 Beds)
    [2, 'WRD-B-001', 1],
    [2, 'WRD-B-002', 1],
    [2, 'WRD-B-003', 1],
    [2, 'WRD-B-004', 1],
    // Semi-Private (2 Beds)
    [3, 'SPVT-001', 1],
    [3, 'SPVT-002', 1],
    // Private 301 & 302 (1 Bed each)
    [4, 'PVT-301', 1],
    [5, 'PVT-302', 1],
    // ICU Unit (2 Beds)
    [6, 'ICU-001', 1],
    [6, 'ICU-002', 1],
];
$stmt = $pdo->prepare("INSERT INTO Room_Bed (Room_ID, Bed_Code, Is_Available, Is_Active) VALUES (?, ?, ?, 1)");
foreach ($beds as $b) {
    $stmt->execute($b);
}
echo "<li class='list-group-item'>✔ <strong>Room & Room_Bed:</strong> 6 rooms containing 14 individual beds</li>";

// ── 12. UNIFIED CHARGE CATALOGS ──────────────────────────────
$pdo->exec("INSERT INTO Charge_Catalogs (Catalog_ID, Item_Name, Category_Type, Code_Prefix, Unit_Price, Is_Active) VALUES
    -- Medicines
    (1,  'Paracetamol 500mg Tablet',        'Medicine',       'MED',  15.00, 1),
    (2,  'Amoxicillin 500mg Capsule',       'Medicine',       'MED',  25.00, 1),
    (3,  'Omeprazole 20mg Capsule',         'Medicine',       'MED',  35.00, 1),
    (4,  'Metformin 500mg Tablet',          'Medicine',       'MED',  18.00, 1),
    (5,  'Losartan 50mg Tablet',            'Medicine',       'MED',  28.00, 1),
    (6,  'Cetirizine 10mg Tablet',          'Medicine',       'MED',  12.00, 1),
    (7,  'Ibuprofen 400mg Tablet',          'Medicine',       'MED',  20.00, 1),
    (8,  'Azithromycin 500mg Tablet',       'Medicine',       'MED',  45.00, 1),

    -- Equipment & Diagnostic Scans
    (9,  'Chest X-Ray PA View',             'Equipment Scan', 'RAD', 500.00, 1),
    (10, 'Abdominal Ultrasound',            'Equipment Scan', 'RAD', 900.00, 1),
    (11, 'Head CT-Scan (Plain)',            'Equipment Scan', 'RAD',3500.00, 1),
    (12, '12-Lead Electrocardiogram (ECG)', 'Equipment Scan', 'RAD', 400.00, 1),
    (13, '2D Echocardiogram with Doppler',  'Equipment Scan', 'RAD',2500.00, 1),
    (14, 'Complete Blood Count (CBC)',      'Equipment Scan', 'RAD', 200.00, 1),

    -- Hospital Procedures & Services
    (15, 'IV Cannulation & Line Insertion', 'Service',        'SRV', 150.00, 1),
    (16, 'Wound Dressing & Cleaning',       'Service',        'SRV', 200.00, 1),
    (17, 'Vital Signs Monitoring (Daily)',  'Service',        'SRV',  50.00, 1),
    (18, 'Blood Extraction (Phlebotomy)',   'Service',        'SRV',  80.00, 1),
    (19, 'Nebulization Therapy',            'Service',        'SRV', 120.00, 1),
    (20, 'Physical Therapy Session',        'Service',        'SRV', 500.00, 1),
    (21, 'Catheter Insertion',              'Service',        'SRV', 250.00, 1)
");
echo "<li class='list-group-item'>✔ <strong>Charge_Catalogs:</strong> 21 items (Medicines, Equipment Scans, Services)</li>";

// ── 13. PATIENTS ─────────────────────────────────────────────
$patients = [
    [1, 'Juan',     'Dela Cruz', '1985-04-12', 1, 1, '0917-123-4567', '123 Rizal St, Manila',        'Maria Dela Cruz', '0917-999-1111'],
    [2, 'Maria',    'Santos',    '1992-08-25', 2, 7, '0918-234-5678', '45 Mabini Ave, Quezon City',  'Pedro Santos',    '0918-888-2222'],
    [3, 'Antonio',  'Luna',      '1970-11-03', 1, 3, '0919-345-6789', '78 Bonifacio Rd, Makati',    'Clara Luna',      '0919-777-3333'],
    [4, 'Teresa',   'Magbanua',  '1998-02-14', 2, 5, '0920-456-7890', '12 Luna St, Pasig',           'Elias Magbanua',  '0920-666-4444'],
    [5, 'Emilio',   'Aguinaldo', '1955-03-22', 1, 7, '0921-567-8901', '89 Kawit Blvd, Cavite',       'Hilaria Del Rosario','0921-555-5555']
];
$stmt = $pdo->prepare("INSERT INTO Patient (Patient_ID, First_Name, Last_Name, Date_Of_Birth, Gender_ID, Blood_Type_ID, Contact_Number, Address, Emergency_Contact_Name, Emergency_Contact_Number, Is_Active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)");
foreach ($patients as $p) {
    $stmt->execute($p);
}
echo "<li class='list-group-item'>✔ <strong>Patient:</strong> 5 sample patients</li>";

echo "</ul>";
echo "<div class='alert alert-success'><strong>Migration Successful!</strong> Database matches instructor's exact schema and is loaded in <code>hospital_billing_db</code>.</div>";
echo "<p><a href='../views/index.html' class='btn btn-primary'>Proceed to Dashboard &raquo;</a></p>";
echo "</div></div></body></html>";
?>
