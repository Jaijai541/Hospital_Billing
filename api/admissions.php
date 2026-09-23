<?php
/**
 * In-Patient Admissions & Bed Management API
 * Milestone 2: Transaction & Clinical Workflow
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class AdmissionManager
{
    /**
     * Read: Retrieve all admissions with patient and bed info
     */
    function getAllAdmissions($json = '{}')
    {
        include __DIR__ . "/../connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $statusFilter = $json['status'] ?? 'all';
        $search = trim($json['search'] ?? '');

        $sql = "SELECT 
                    a.Admission_ID,
                    a.Patient_ID,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Patient_Name,
                    p.Contact_Number,
                    a.Chief_Complaint,
                    DATE_FORMAT(a.Admission_Date, '%Y-%m-%d %h:%i %p') AS Admission_Date,
                    a.Status,
                    rb.Bed_Code,
                    r.Room_Name,
                    rt.Type_Name AS Room_Type,
                    COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate,
                    (
                        SELECT GROUP_CONCAT(CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) SEPARATOR '; ')
                        FROM Admission_Doctor ad
                        INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                        WHERE ad.Admission_ID = a.Admission_ID
                    ) AS Assigned_Doctors
                FROM Admission a
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                LEFT JOIN Room_Transfer_Log rtl ON rtl.Admission_ID = a.Admission_ID AND rtl.Date_Out IS NULL
                LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                LEFT JOIN Room r ON rb.Room_ID = r.Room_ID
                LEFT JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE 1=1";

        $params = [];

        if ($statusFilter !== 'all' && !empty($statusFilter)) {
            $sql .= " AND a.Status = :status";
            $params[':status'] = $statusFilter;
        }

        if (!empty($search)) {
            $sql .= " AND (p.First_Name LIKE :search 
                           OR p.Last_Name LIKE :search 
                           OR rb.Bed_Code LIKE :search 
                           OR a.Admission_ID = :search_id)";
            $params[':search'] = "%{$search}%";
            $params[':search_id'] = is_numeric($search) ? intval($search) : 0;
        }

        $sql .= " ORDER BY a.Admission_ID DESC";

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $admissions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($admissions);
    }

    /**
     * Read: Retrieve single admission details, patient chart & assigned doctors
     */
    function getAdmissionById($json = '{}')
    {
        include __DIR__ . "/../connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['id'] ?? 0);

        // 1. Admission & Patient info
        $sql = "SELECT 
                    a.Admission_ID,
                    a.Chief_Complaint,
                    DATE_FORMAT(a.Admission_Date, '%Y-%m-%d %h:%i %p') AS Admission_Date,
                    a.Status,
                    p.Patient_ID,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                    p.First_Name,
                    p.Last_Name,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Full_Name,
                    p.Date_Of_Birth,
                    TIMESTAMPDIFF(YEAR, p.Date_Of_Birth, CURDATE()) AS Age,
                    g.Gender_Name,
                    bt.Blood_Type_Name,
                    p.Contact_Number,
                    p.Address,
                    p.Emergency_Contact_Name,
                    p.Emergency_Contact_Number,
                    rtl.Transfer_ID,
                    rtl.Bed_ID,
                    rb.Bed_Code,
                    r.Room_Name,
                    rt.Type_Name AS Room_Type,
                    COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate,
                    DATE_FORMAT(rtl.Date_In, '%Y-%m-%d %h:%i %p') AS Bed_Date_In
                FROM Admission a
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                LEFT JOIN Enum_Gender g ON p.Gender_ID = g.Gender_ID
                LEFT JOIN Enum_Blood_Type bt ON p.Blood_Type_ID = bt.Blood_Type_ID
                LEFT JOIN Room_Transfer_Log rtl ON rtl.Admission_ID = a.Admission_ID AND rtl.Date_Out IS NULL
                LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                LEFT JOIN Room r ON rb.Room_ID = r.Room_ID
                LEFT JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE a.Admission_ID = :id";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':id' => $admissionId]);
        $admission = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$admission) {
            return json_encode(['error' => 'Admission not found']);
        }

        // 2. Assigned doctors
        $docSql = "SELECT 
                    ad.Admission_Doctor_ID,
                    ad.Doctor_ID,
                    CONCAT(d.Code_Prefix, '-', LPAD(d.Doctor_ID, 3, '0')) AS Doctor_Code,
                    CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                    dt.Type_Name AS Doctor_Type,
                    d.Base_Round_Fee,
                    d.Station_ID,
                    DATE_FORMAT(ad.Assigned_Date, '%Y-%m-%d %h:%i %p') AS Assigned_Date,
                    (
                        SELECT GROUP_CONCAT(s.Specialty_Name SEPARATOR ', ')
                        FROM Doctor_Specialty ds
                        INNER JOIN Enum_Specialty s ON ds.Specialty_ID = s.Specialty_ID
                        WHERE ds.Doctor_ID = d.Doctor_ID
                    ) AS Specialties
                FROM Admission_Doctor ad
                INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
                WHERE ad.Admission_ID = :id";

        $docStmt = $conn->prepare($docSql);
        $docStmt->execute([':id' => $admissionId]);
        $admission['Assigned_Doctors'] = $docStmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($admission);
    }

    /**
     * Read: Retrieve vacant beds eligible for assignment
     */
    function getAvailableBeds()
    {
        include __DIR__ . "/../connection.php";

        $sql = "SELECT 
                    rb.Bed_ID,
                    rb.Bed_Code,
                    r.Room_ID,
                    r.Room_Name,
                    rt.Type_Name AS Room_Type,
                    COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate
                FROM Room_Bed rb
                INNER JOIN Room r ON rb.Room_ID = r.Room_ID
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE rb.Is_Available = 1 
                  AND rb.Is_Active = 1 
                  AND r.Is_Active = 1
                ORDER BY r.Room_Name ASC, rb.Bed_Code ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    /**
     * Read: Retrieve active patients eligible for admission
     */
    function getActivePatients()
    {
        include __DIR__ . "/../connection.php";

        $sql = "SELECT 
                    p.Patient_ID,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Full_Name,
                    p.Date_Of_Birth,
                    g.Gender_Name,
                    bt.Blood_Type_Name,
                    p.Contact_Number,
                    (
                        SELECT a.Admission_ID 
                        FROM Admission a 
                        WHERE a.Patient_ID = p.Patient_ID AND a.Status = 'Admitted'
                        LIMIT 1
                    ) AS Active_Admission_ID,
                    (
                        SELECT a.Status 
                        FROM Admission a 
                        WHERE a.Patient_ID = p.Patient_ID 
                        ORDER BY a.Admission_ID DESC 
                        LIMIT 1
                    ) AS Latest_Admission_Status
                FROM Patient p
                LEFT JOIN Enum_Gender g ON p.Gender_ID = g.Gender_ID
                LEFT JOIN Enum_Blood_Type bt ON p.Blood_Type_ID = bt.Blood_Type_ID
                WHERE p.Is_Active = 1
                ORDER BY p.Last_Name ASC, p.First_Name ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    /**
     * Read: Retrieve active doctors for assignment
     */
    function getActiveDoctors()
    {
        include __DIR__ . "/../connection.php";

        $sql = "SELECT 
                    d.Doctor_ID,
                    CONCAT(d.Code_Prefix, '-', LPAD(d.Doctor_ID, 3, '0')) AS Doctor_Code,
                    CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Full_Name,
                    dt.Type_Name AS Doctor_Type,
                    d.Base_Round_Fee,
                    (
                        SELECT GROUP_CONCAT(s.Specialty_Name SEPARATOR ', ')
                        FROM Doctor_Specialty ds
                        INNER JOIN Enum_Specialty s ON ds.Specialty_ID = s.Specialty_ID
                        WHERE ds.Doctor_ID = d.Doctor_ID
                    ) AS Specialties
                FROM Doctor d
                INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
                WHERE d.Is_Active = 1
                ORDER BY d.Last_Name ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    /**
     * Read: Retrieve all bed stays and transfer history for an admission
     */
    function getBedTransfers($json = '{}')
    {
        include __DIR__ . "/../connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        $sql = "SELECT 
                    rtl.Transfer_ID,
                    rtl.Bed_ID,
                    rb.Bed_Code,
                    r.Room_Name,
                    rt.Type_Name AS Room_Type,
                    COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate,
                    DATE_FORMAT(rtl.Date_In, '%Y-%m-%d %h:%i %p') AS Date_In,
                    DATE_FORMAT(rtl.Date_Out, '%Y-%m-%d %h:%i %p') AS Date_Out,
                    rtl.Total_Days,
                    rtl.Total_Room_Fee,
                    (CASE WHEN rtl.Date_Out IS NULL THEN 1 ELSE 0 END) AS Is_Current_Stay
                FROM Room_Transfer_Log rtl
                INNER JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                INNER JOIN Room r ON rb.Room_ID = r.Room_ID
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE rtl.Admission_ID = :aid
                ORDER BY rtl.Transfer_ID ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':aid' => $admissionId]);
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    /**
     * Create: Admit a patient, occupy bed, assign doctors
     */
    function admitPatient($json = '{}')
    {
        include __DIR__ . "/../connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $patientId = intval($json['patient_id'] ?? 0);
        $chiefComplaint = trim($json['chief_complaint'] ?? '');
        $bedId = intval($json['bed_id'] ?? 0);
        $doctorIds = $json['doctor_ids'] ?? [];

        if (empty($patientId) || empty($chiefComplaint) || empty($bedId)) {
            return json_encode(['error' => 'Patient, Chief Complaint, and Bed assignment are required.']);
        }

        if (empty($doctorIds) || !is_array($doctorIds)) {
            return json_encode(['error' => 'At least one Attending/Resident Physician must be assigned.']);
        }

        try {
            $conn->beginTransaction();

            // 1. Check if patient is already admitted
            $checkStmt = $conn->prepare("SELECT Admission_ID FROM Admission WHERE Patient_ID = :pid AND Status = 'Admitted'");
            $checkStmt->execute([':pid' => $patientId]);
            if ($checkStmt->fetch()) {
                $conn->rollBack();
                return json_encode(['error' => 'This patient currently has an active admission.']);
            }

            // 2. Check if bed is available
            $bedCheck = $conn->prepare("SELECT Is_Available FROM Room_Bed WHERE Bed_ID = :bid");
            $bedCheck->execute([':bid' => $bedId]);
            $bed = $bedCheck->fetch(PDO::FETCH_ASSOC);
            if (!$bed || !$bed['Is_Available']) {
                $conn->rollBack();
                return json_encode(['error' => 'The selected bed is no longer available. Please select another bed.']);
            }

            // 3. Insert Admission
            $admStmt = $conn->prepare("INSERT INTO Admission (Patient_ID, Chief_Complaint, Status, Admission_Date) 
                                      VALUES (:pid, :complaint, 'Admitted', NOW())");
            $admStmt->execute([
                ':pid' => $patientId,
                ':complaint' => $chiefComplaint
            ]);
            $admissionId = $conn->lastInsertId();

            // 4. Record initial bed stay in Room_Transfer_Log
            $transferStmt = $conn->prepare("INSERT INTO Room_Transfer_Log (Admission_ID, Bed_ID, Date_In) 
                                           VALUES (:aid, :bid, NOW())");
            $transferStmt->execute([
                ':aid' => $admissionId,
                ':bid' => $bedId
            ]);

            // 5. Mark bed as occupied
            $occStmt = $conn->prepare("UPDATE Room_Bed SET Is_Available = 0 WHERE Bed_ID = :bid");
            $occStmt->execute([':bid' => $bedId]);

            // 6. Assign doctors
            $docStmt = $conn->prepare("INSERT INTO Admission_Doctor (Admission_ID, Doctor_ID, Assigned_Date) 
                                      VALUES (:aid, :did, NOW())");
            foreach ($doctorIds as $docId) {
                $docStmt->execute([
                    ':aid' => $admissionId,
                    ':did' => intval($docId)
                ]);
            }

            $conn->commit();
            return json_encode([
                'success' => true,
                'message' => 'Patient successfully admitted and bed allocated.',
                'admission_id' => $admissionId
            ]);

        } catch (Exception $e) {
            $conn->rollBack();
            return json_encode(['error' => 'Admission failed: ' . $e->getMessage()]);
        }
    }

    /**
     * Update: Transfer patient to another bed & calculate board & lodging charge
     */
    function transferBed($json = '{}')
    {
        include __DIR__ . "/../connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);
        $newBedId = intval($json['new_bed_id'] ?? 0);

        if (empty($admissionId) || empty($newBedId)) {
            return json_encode(['error' => 'Admission ID and Target Bed are required.']);
        }

        try {
            $conn->beginTransaction();

            // 1. Check target bed availability
            $targetBedStmt = $conn->prepare("SELECT Is_Available FROM Room_Bed WHERE Bed_ID = :bid");
            $targetBedStmt->execute([':bid' => $newBedId]);
            $targetBed = $targetBedStmt->fetch(PDO::FETCH_ASSOC);
            if (!$targetBed || !$targetBed['Is_Available']) {
                $conn->rollBack();
                return json_encode(['error' => 'The selected target bed is not available.']);
            }

            // 2. Fetch current open bed stay
            $currStayStmt = $conn->prepare("
                SELECT 
                    rtl.Transfer_ID,
                    rtl.Bed_ID,
                    rtl.Date_In,
                    COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate,
                    rb.Bed_Code,
                    r.Room_Name
                FROM Room_Transfer_Log rtl
                INNER JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                INNER JOIN Room r ON rb.Room_ID = r.Room_ID
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE rtl.Admission_ID = :aid AND rtl.Date_Out IS NULL
            ");
            $currStayStmt->execute([':aid' => $admissionId]);
            $currentStay = $currStayStmt->fetch(PDO::FETCH_ASSOC);

            if (!$currentStay) {
                $conn->rollBack();
                return json_encode(['error' => 'No active bed stay found for this admission.']);
            }

            if ($currentStay['Bed_ID'] == $newBedId) {
                $conn->rollBack();
                return json_encode(['error' => 'Patient is already assigned to this bed.']);
            }

            // 3. Compute days and room fee for closing stay
            $dateIn = new DateTime($currentStay['Date_In']);
            $now = new DateTime();
            $diffDays = $now->diff($dateIn)->days;
            $totalDays = max(1, $diffDays);
            $dailyRate = floatval($currentStay['Daily_Rate']);
            $totalRoomFee = $totalDays * $dailyRate;

            // 4. Close current transfer log
            $closeStmt = $conn->prepare("
                UPDATE Room_Transfer_Log 
                SET Date_Out = NOW(), Total_Days = :days, Total_Room_Fee = :fee 
                WHERE Transfer_ID = :tid
            ");
            $closeStmt->execute([
                ':days' => $totalDays,
                ':fee' => $totalRoomFee,
                ':tid' => $currentStay['Transfer_ID']
            ]);

            // 5. Post Board & Lodging fee to Billing_Ledger (Station_ID = 5: Nurse Station)
            $postLedger = $conn->prepare("
                INSERT INTO Billing_Ledger 
                    (Admission_ID, Station_ID, Transfer_ID, Quantity, Unit_Price, Total_Charge, Transaction_Type, Timestamp)
                VALUES 
                    (:aid, 5, :tid, :qty, :unit_price, :total_charge, 'Charge', NOW())
            ");
            $postLedger->execute([
                ':aid' => $admissionId,
                ':tid' => $currentStay['Transfer_ID'],
                ':qty' => $totalDays,
                ':unit_price' => $dailyRate,
                ':total_charge' => $totalRoomFee
            ]);

            // 6. Release old bed
            $freeBed = $conn->prepare("UPDATE Room_Bed SET Is_Available = 1 WHERE Bed_ID = :old_bid");
            $freeBed->execute([':old_bid' => $currentStay['Bed_ID']]);

            // 7. Occupy new bed
            $occupyBed = $conn->prepare("UPDATE Room_Bed SET Is_Available = 0 WHERE Bed_ID = :new_bid");
            $occupyBed->execute([':new_bid' => $newBedId]);

            // 8. Open new transfer log
            $newStay = $conn->prepare("INSERT INTO Room_Transfer_Log (Admission_ID, Bed_ID, Date_In) VALUES (:aid, :bid, NOW())");
            $newStay->execute([
                ':aid' => $admissionId,
                ':bid' => $newBedId
            ]);

            $conn->commit();
            return json_encode([
                'success' => true,
                'message' => "Transferred to new bed. Prior stay ({$totalDays} day(s) at ₱{$dailyRate}/day = ₱{$totalRoomFee}) posted to ledger."
            ]);

        } catch (Exception $e) {
            $conn->rollBack();
            return json_encode(['error' => 'Bed transfer failed: ' . $e->getMessage()]);
        }
    }

    /**
     * Update: Discharge patient, close bed stay, post final room charge, release bed
     */
    function dischargePatient($json = '{}')
    {
        include __DIR__ . "/../connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        if (empty($admissionId)) {
            return json_encode(['error' => 'Admission ID is required.']);
        }

        try {
            $conn->beginTransaction();

            // 1. Fetch current open bed stay
            $currStayStmt = $conn->prepare("
                SELECT 
                    rtl.Transfer_ID,
                    rtl.Bed_ID,
                    rtl.Date_In,
                    COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate
                FROM Room_Transfer_Log rtl
                INNER JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                INNER JOIN Room r ON rb.Room_ID = r.Room_ID
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE rtl.Admission_ID = :aid AND rtl.Date_Out IS NULL
            ");
            $currStayStmt->execute([':aid' => $admissionId]);
            $currentStay = $currStayStmt->fetch(PDO::FETCH_ASSOC);

            if ($currentStay) {
                $dateIn = new DateTime($currentStay['Date_In']);
                $now = new DateTime();
                $diffDays = $now->diff($dateIn)->days;
                $totalDays = max(1, $diffDays);
                $dailyRate = floatval($currentStay['Daily_Rate']);
                $totalRoomFee = $totalDays * $dailyRate;

                // Close transfer log
                $closeStmt = $conn->prepare("
                    UPDATE Room_Transfer_Log 
                    SET Date_Out = NOW(), Total_Days = :days, Total_Room_Fee = :fee 
                    WHERE Transfer_ID = :tid
                ");
                $closeStmt->execute([
                    ':days' => $totalDays,
                    ':fee' => $totalRoomFee,
                    ':tid' => $currentStay['Transfer_ID']
                ]);

                // Post room charge to ledger
                $postLedger = $conn->prepare("
                    INSERT INTO Billing_Ledger 
                        (Admission_ID, Station_ID, Transfer_ID, Quantity, Unit_Price, Total_Charge, Transaction_Type, Timestamp)
                    VALUES 
                        (:aid, 5, :tid, :qty, :unit_price, :total_charge, 'Charge', NOW())
                ");
                $postLedger->execute([
                    ':aid' => $admissionId,
                    ':tid' => $currentStay['Transfer_ID'],
                    ':qty' => $totalDays,
                    ':unit_price' => $dailyRate,
                    ':total_charge' => $totalRoomFee
                ]);

                // Free bed
                $freeBed = $conn->prepare("UPDATE Room_Bed SET Is_Available = 1 WHERE Bed_ID = :bid");
                $freeBed->execute([':bid' => $currentStay['Bed_ID']]);
            }

            // 2. Mark admission as Discharged
            $admStmt = $conn->prepare("UPDATE Admission SET Status = 'Discharged' WHERE Admission_ID = :aid");
            $admStmt->execute([':aid' => $admissionId]);

            $conn->commit();
            return json_encode([
                'success' => true,
                'message' => 'Patient successfully discharged, final room fee posted to ledger, and bed released.'
            ]);

        } catch (Exception $e) {
            $conn->rollBack();
            return json_encode(['error' => 'Discharge failed: ' . $e->getMessage()]);
        }
    }
}

// ── Router ──────────────────────────────────────────────────────────
$operation = $_POST['operation'] ?? '';
$json = $_POST['json'] ?? '{}';

if (!empty($operation)) {
    $admission = new AdmissionManager();

    switch ($operation) {
        case 'getAllAdmissions':
            echo $admission->getAllAdmissions($json);
            break;

        case 'getAdmissionById':
            echo $admission->getAdmissionById($json);
            break;

        case 'getAvailableBeds':
            echo $admission->getAvailableBeds();
            break;

        case 'getActivePatients':
            echo $admission->getActivePatients();
            break;

        case 'getActiveDoctors':
            echo $admission->getActiveDoctors();
            break;

        case 'getBedTransfers':
            echo $admission->getBedTransfers($json);
            break;

        case 'admitPatient':
            echo $admission->admitPatient($json);
            break;

        case 'transferBed':
            echo $admission->transferBed($json);
            break;

        case 'dischargePatient':
            echo $admission->dischargePatient($json);
            break;

        default:
            echo json_encode(['error' => 'Invalid operation specified.']);
            break;
    }
}
