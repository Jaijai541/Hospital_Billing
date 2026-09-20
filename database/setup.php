<?php
/**
 * Database Setup & Sample Data Seeder
 * Hospital Billing and Patient Information System
 * 
 * Usage: Open http://localhost/Hospital_Billing/database/setup.php in your browser
 */

$host = 'localhost';
$user = 'root';
$pass = '';

try {
    // 1. Connect to MySQL Server (initial connection to ensure DB exists)
    $pdo = new PDO("mysql:host={$host};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // 2. Read and execute schema.sql
    $schemaFile = __DIR__ . '/schema.sql';
    if (!file_exists($schemaFile)) {
        die("Error: schema.sql file not found in " . __DIR__);
    }

    $sql = file_get_contents($schemaFile);
    $pdo->exec($sql);

    // Reconnect specifically to the new database
    $pdo->exec("USE hospital_billing_db");

} catch (PDOException $e) {
    die("Database Setup Failed: " . $e->getMessage());
}

echo "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Database Setup</title>";
echo "<link rel='stylesheet' href='https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css'>";
echo "</head><body class='bg-light p-4'><div class='container' style='max-width: 800px;'>";
echo "<div class='card shadow-sm p-4'>";
echo "<h3 class='text-success mb-3'>✔ Database Setup & Population</h3>";
echo "<p class='text-muted'>Initializing reference data and realistic sample records for Milestone 1...</p>";
echo "<hr><ul class='list-group list-group-flush mb-4'>";

// ── 1. GENDER LOOKUP ─────────────────────────────────────────
$pdo->exec("INSERT IGNORE INTO Enum_Gender (Gender_ID, Gender_Name) VALUES
    (1, 'Male'), (2, 'Female'), (3, 'Other')");
echo "<li class='list-group-item'>✔ <strong>Enum_Gender:</strong> Male, Female, Other</li>";

// ── 2. BLOOD TYPE LOOKUP ─────────────────────────────────────
$pdo->exec("INSERT IGNORE INTO Enum_Blood_Type (Blood_Type_ID, Blood_Type_Name) VALUES
    (1, 'A+'), (2, 'A-'), (3, 'B+'), (4, 'B-'), (5, 'AB+'), (6, 'AB-'), (7, 'O+'), (8, 'O-')");
echo "<li class='list-group-item'>✔ <strong>Enum_Blood_Type:</strong> A+, B+, AB+, O+, etc.</li>";

// ── 3. ROOM TYPES ────────────────────────────────────────────
$pdo->exec("INSERT IGNORE INTO Enum_Room_Type (Room_Type_ID, Type_Name, Code_Prefix, Is_Active) VALUES
    (1, 'General Ward', 'WRD', 1),
    (2, 'Semi-Private Room', 'SPVT', 1),
    (3, 'Private Room', 'PVT', 1),
    (4, 'Intensive Care Unit (ICU)', 'ICU', 1)");
echo "<li class='list-group-item'>✔ <strong>Enum_Room_Type:</strong> Ward, Semi-Private, Private, ICU</li>";

// ── 4. DOCTOR CLASSIFICATIONS ────────────────────────────────
$pdo->exec("INSERT IGNORE INTO Enum_Doctor_Type (Doctor_Type_ID, Type_Name, Is_Active) VALUES
    (1, 'Resident Physician', 1),
    (2, 'Attending Specialist', 1)");
echo "<li class='list-group-item'>✔ <strong>Enum_Doctor_Type:</strong> Resident Physician, Attending Specialist</li>";

// ── 5. DEPARTMENT & CHARGING STATIONS ────────────────────────
$pdo->exec("INSERT IGNORE INTO Enum_Department_Station (Station_ID, Station_Name, Code_Prefix, Is_Active) VALUES
    (1, 'Central Pharmacy', 'PHARM', 1),
    (2, 'Radiology & Imaging', 'RAD', 1),
    (3, 'Cardiology Station', 'CARD', 1),
    (4, 'Laboratory', 'LAB', 1),
    (5, 'Nurse Station', 'NRS', 1),
    (6, 'Physical Therapy & Rehab', 'PT', 1),
    (7, 'Billing & Cashier', 'BLG', 1)");
echo "<li class='list-group-item'>✔ <strong>Enum_Department_Station:</strong> Pharmacy, Radiology, Cardiology, Lab, Nurse Station, PT, Billing</li>";

// ── 6. BILLING DISCOUNTS ─────────────────────────────────────
$pdo->exec("INSERT IGNORE INTO Enum_Discount (Discount_ID, Discount_Name, Discount_Percentage, Is_Active) VALUES
    (1, 'Senior Citizen', 20.00, 1),
    (2, 'Person with Disability (PWD)', 20.00, 1),
    (3, 'Government Employee', 10.00, 1)");
echo "<li class='list-group-item'>✔ <strong>Enum_Discount:</strong> Senior Citizen (20%), PWD (20%), Government (10%)</li>";

// ── 7. USER ROLES ────────────────────────────────────────────
$pdo->exec("INSERT IGNORE INTO Enum_User_Role (Role_ID, Role_Name) VALUES
    (1, 'Admin'),
    (2, 'Finance Staff'),
    (3, 'Nurse')");
echo "<li class='list-group-item'>✔ <strong>Enum_User_Role:</strong> Admin, Finance Staff, Nurse</li>";

// ── 8. SYSTEM USERS ──────────────────────────────────────────
$users = [
    [1, 'System',  'Admin', 'admin',   'admin123',   1],
    [2, 'Finance', 'Staff', 'finance', 'finance123', 2],
    [3, 'Jane',    'Nurse', 'nurse',   'nurse123',   3],
];
$stmt = $pdo->prepare("INSERT IGNORE INTO System_User (User_ID, First_Name, Last_Name, Username, Password_Hash, Role_ID, Is_Active) VALUES (?, ?, ?, ?, ?, ?, 1)");
foreach ($users as $u) {
    $hash = password_hash($u[4], PASSWORD_DEFAULT);
    $stmt->execute([$u[0], $u[1], $u[2], $u[3], $hash, $u[5]]);
}
echo "<li class='list-group-item'>✔ <strong>System_User:</strong> Default accounts (admin / finance / nurse)</li>";

// ── 9. SAMPLE ROOMS ──────────────────────────────────────────
$pdo->exec("INSERT IGNORE INTO Room (Room_ID, Room_Number, Room_Type_ID, Daily_Rate, Is_Available, Is_Active) VALUES
    (1, 'WRD-101', 1,  500.00, 1, 1),
    (2, 'WRD-102', 1,  500.00, 1, 1),
    (3, 'SPVT-201', 2, 1200.00, 1, 1),
    (4, 'PVT-301', 3, 2000.00, 1, 1),
    (5, 'PVT-302', 3, 2500.00, 1, 1),
    (6, 'ICU-401', 4, 5000.00, 1, 1)");
echo "<li class='list-group-item'>✔ <strong>Room Master:</strong> 6 rooms across Ward, Semi-Private, Private, ICU</li>";

// ── 10. SAMPLE DOCTORS ───────────────────────────────────────
$pdo->exec("INSERT IGNORE INTO Doctor (Doctor_ID, First_Name, Last_Name, Doctor_Type_ID, Station_ID, Code_Prefix, Base_Round_Fee, Is_Active) VALUES
    (1, 'Maria', 'Santos', 2, 3, 'DR', 1500.00, 1), -- Attending, Cardiology
    (2, 'Jose',  'Reyes',  2, 2, 'DR', 1200.00, 1), -- Attending, Radiology
    (3, 'Ana',   'Cruz',   1, 5, 'DR',  800.00, 1), -- Resident, Nurse Station / General
    (4, 'Pedro', 'Gomez',  1, 5, 'DR',  750.00, 1)  -- Resident, General Medicine
"); 
echo "<li class='list-group-item'>✔ <strong>Doctor Master:</strong> 4 doctors with specialties and round fees</li>";

// ── 11. MEDICINES CATALOG ────────────────────────────────────
$pdo->exec("INSERT IGNORE INTO Catalog_Medicine (Medicine_ID, Generic_Name, Station_ID, Unit_Price, Code_Prefix, Is_Active) VALUES
    (1, 'Paracetamol 500mg Tablet',        1, 15.00, 'MED', 1),
    (2, 'Amoxicillin 500mg Capsule',       1, 25.00, 'MED', 1),
    (3, 'Omeprazole 20mg Capsule',         1, 35.00, 'MED', 1),
    (4, 'Metformin 500mg Tablet',          1, 18.00, 'MED', 1),
    (5, 'Losartan 50mg Tablet',            1, 28.00, 'MED', 1),
    (6, 'Cetirizine 10mg Tablet',          1, 12.00, 'MED', 1),
    (7, 'Ibuprofen 400mg Tablet',          1, 20.00, 'MED', 1),
    (8, 'Azithromycin 500mg Tablet',       1, 45.00, 'MED', 1)");
echo "<li class='list-group-item'>✔ <strong>Catalog_Medicine:</strong> 8 medicines linked to Central Pharmacy</li>";

// ── 12. EQUIPMENT & SCANS CATALOG (Split Fee) ────────────────
$pdo->exec("INSERT IGNORE INTO Catalog_Equipment_Scan (Scan_ID, Scan_Name, Station_ID, Hospital_Fee, Reader_Fee, Total_Fee, Code_Prefix, Is_Active) VALUES
    (1, 'Chest X-Ray PA View',              2,  350.00, 150.00,  500.00, 'RAD', 1),
    (2, 'Abdominal Ultrasound',             2,  600.00, 300.00,  900.00, 'RAD', 1),
    (3, 'Head CT-Scan (Plain)',             2, 2500.00, 1000.00, 3500.00, 'RAD', 1),
    (4, '12-Lead Electrocardiogram (ECG)',   3,  250.00, 150.00,  400.00, 'CARD', 1),
    (5, '2D Echocardiogram with Doppler',   3, 1800.00, 700.00, 2500.00, 'CARD', 1),
    (6, 'Complete Blood Count (CBC)',       4,  150.00,  50.00,  200.00, 'LAB', 1)");
echo "<li class='list-group-item'>✔ <strong>Catalog_Equipment_Scan:</strong> 6 scans with Hospital + Reader's Fee split</li>";

// ── 13. SERVICES CATALOG ─────────────────────────────────────
$pdo->exec("INSERT IGNORE INTO Catalog_Service (Service_ID, Service_Name, Station_ID, Performer_Role, Service_Fee, Code_Prefix, Is_Active) VALUES
    (1, 'IV Cannulation & Line Insertion', 5, 'Staff Nurse',                          150.00, 'SRV', 1),
    (2, 'Wound Dressing & Cleaning',        5, 'Staff Nurse',                          200.00, 'SRV', 1),
    (3, 'Vital Signs Monitoring (Daily)',   5, 'Staff Nurse',                           50.00, 'SRV', 1),
    (4, 'Blood Extraction (Phlebotomy)',    4, 'Medical Technologist',                  80.00, 'SRV', 1),
    (5, 'Nebulization Therapy',             5, 'Staff Nurse / Respiratory Therapist',  120.00, 'SRV', 1),
    (6, 'Physical Therapy Session',         6, 'Physical Therapist',                   500.00, 'SRV', 1),
    (7, 'Catheter Insertion',               5, 'Resident Physician / Senior Nurse',    250.00, 'SRV', 1)");
echo "<li class='list-group-item'>✔ <strong>Catalog_Service:</strong> 7 hospital services with assigned staff roles</li>";

echo "</ul>";
echo "<div class='alert alert-info'><strong>Setup Complete!</strong> All tables and Milestone 1 reference data have been successfully loaded into <code>hospital_billing_db</code>.</div>";
echo "<p class='small text-muted'>You can re-run this setup script at any time if you ever need to restore sample records.</p>";
echo "</div></div></body></html>";
