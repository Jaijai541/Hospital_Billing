<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class AdmissionManager
{
    function admitPatient($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $patientId = intval($json['patient_id'] ?? 0);
        $bedId = intval($json['bed_id'] ?? 0);
        $chiefComplaint = trim($json['chief_complaint'] ?? '');
        $diagnosis = trim($json['diagnosis'] ?? '');
        $doctorIds = $json['doctor_ids'] ?? [];

        if (empty($patientId) || empty($bedId) || empty($chiefComplaint)) {
            return json_encode(['error' => 'Patient, Bed, and Chief Complaint are required.']);
        }

        try {
            $conn->beginTransaction();

            // 1. Verify patient is not already actively admitted
            $checkPatient = $conn->prepare("SELECT Admission_ID FROM Admission WHERE Patient_ID = :pid AND Status = 'Admitted'");
            $checkPatient->execute([':pid' => $patientId]);
            if ($checkPatient->fetch()) {
                $conn->rollBack();
                return json_encode(['error' => 'This patient already has an active admission.']);
            }

            // 2. Check bed availability & fetch room rate
            $bedStmt = $conn->prepare("
                SELECT rb.Bed_ID, rb.Is_Available, rb.Room_ID, r.Custom_Daily_Rate, rt.Daily_Rate
                FROM Room_Bed rb
                INNER JOIN Room r ON rb.Room_ID = r.Room_ID
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE rb.Bed_ID = :bid
            ");
            $bedStmt->execute([':bid' => $bedId]);
            $bed = $bedStmt->fetch(PDO::FETCH_ASSOC);

            if (!$bed || !$bed['Is_Available']) {
                $conn->rollBack();
                return json_encode(['error' => 'The selected bed is no longer available.']);
            }

            // 3. Insert Admission record
            $admStmt = $conn->prepare("
                INSERT INTO Admission (Patient_ID, Admission_Date, Chief_Complaint, Diagnosis, Status)
                VALUES (:pid, NOW(), :complaint, :diagnosis, 'Admitted')
            ");
            $admStmt->execute([
                ':pid' => $patientId,
                ':complaint' => $chiefComplaint,
                ':diagnosis' => !empty($diagnosis) ? $diagnosis : null
            ]);
            $admissionId = $conn->lastInsertId();

            // 4. Create initial Room_Transfer_Log
            $transferStmt = $conn->prepare("
                INSERT INTO Room_Transfer_Log (Admission_ID, Bed_ID, Date_In)
                VALUES (:aid, :bid, NOW())
            ");
            $transferStmt->execute([
                ':aid' => $admissionId,
                ':bid' => $bedId
            ]);

            // 5. Mark Bed as Occupied
            $updBed = $conn->prepare("UPDATE Room_Bed SET Is_Available = 0 WHERE Bed_ID = :bid");
            $updBed->execute([':bid' => $bedId]);

            // 6. Assign Doctors
            if (!empty($doctorIds) && is_array($doctorIds)) {
                $docStmt = $conn->prepare("INSERT INTO Admission_Doctor (Admission_ID, Doctor_ID) VALUES (:aid, :did)");
                foreach ($doctorIds as $did) {
                    $did = intval($did);
                    if ($did > 0) {
                        $docStmt->execute([':aid' => $admissionId, ':did' => $did]);
                    }
                }
            }

            $conn->commit();
            return json_encode([
                'success' => true,
                'message' => 'Patient successfully admitted and assigned to bed.',
                'admission_id' => $admissionId
            ]);

        } catch (Exception $e) {
            $conn->rollBack();
            return json_encode(['error' => 'Admission failed: ' . $e->getMessage()]);
        }
    }

    function transferBed($json = '{}')
    {
        include "connection.php";

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

            // 3. Compute length of stay in previous bed
            $dateIn = new DateTime($currentStay['Date_In']);
            $now = new DateTime();
            $diffDays = $now->diff($dateIn)->days;
            $totalDays = max(1, $diffDays);
            $dailyRate = floatval($currentStay['Daily_Rate']);
            $totalRoomFee = $totalDays * $dailyRate;

            // 4. Close current transfer log
            $closeTransferStmt = $conn->prepare("
                UPDATE Room_Transfer_Log 
                SET Date_Out = NOW(), Total_Days = :days, Total_Room_Fee = :fee 
                WHERE Transfer_ID = :tid
            ");
            $closeTransferStmt->execute([
                ':days' => $totalDays,
                ':fee' => $totalRoomFee,
                ':tid' => $currentStay['Transfer_ID']
            ]);

            // 5. Post Board & Lodging fee to Billing_Ledger (Station_ID = 5: Nurse Station)
            $ledgerStmt = $conn->prepare("
                INSERT INTO Billing_Ledger 
                    (Admission_ID, Station_ID, Transfer_ID, Quantity, Unit_Price, Total_Charge, Transaction_Type, Timestamp)
                VALUES 
                    (:aid, 5, :tid, :qty, :unit_price, :total_charge, 'Charge', NOW())
            ");
            $ledgerStmt->execute([
                ':aid' => $admissionId,
                ':tid' => $currentStay['Transfer_ID'],
                ':qty' => $totalDays,
                ':unit_price' => $dailyRate,
                ':total_charge' => $totalRoomFee
            ]);

            // 6. Release old bed
            $releaseBedStmt = $conn->prepare("UPDATE Room_Bed SET Is_Available = 1 WHERE Bed_ID = :bid");
            $releaseBedStmt->execute([':bid' => $currentStay['Bed_ID']]);

            // 7. Create new transfer log for new bed
            $newTransferStmt = $conn->prepare("
                INSERT INTO Room_Transfer_Log (Admission_ID, Bed_ID, Date_In)
                VALUES (:aid, :bid, NOW())
            ");
            $newTransferStmt->execute([
                ':aid' => $admissionId,
                ':bid' => $newBedId
            ]);

            // 8. Occupy new bed
            $occupyBedStmt = $conn->prepare("UPDATE Room_Bed SET Is_Available = 0 WHERE Bed_ID = :bid");
            $occupyBedStmt->execute([':bid' => $newBedId]);

            $conn->commit();
            return json_encode([
                'success' => true,
                'message' => "Bed transfer completed. Board & lodging charge of ₱" . number_format($totalRoomFee, 2) . " posted for {$totalDays} day(s) in previous bed ({$currentStay['Bed_Code']})."
            ]);

        } catch (Exception $e) {
            $conn->rollBack();
            return json_encode(['error' => 'Transfer failed: ' . $e->getMessage()]);
        }
    }

    function dischargePatient($json = '{}')
    {
        include "connection.php";

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

                // Post final room charge to ledger (Station 5: Nurse Station)
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

    function updateDiagnosis($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);
        $diagnosis = trim($json['diagnosis'] ?? '');

        if (empty($admissionId)) {
            return json_encode(['error' => 'Admission ID is required.']);
        }

        if (empty($diagnosis)) {
            return json_encode(['error' => 'Clinical Diagnosis cannot be empty.']);
        }

        try {
            // Check status first - cannot edit if Billed
            $checkStmt = $conn->prepare("SELECT Status FROM Admission WHERE Admission_ID = :aid");
            $checkStmt->execute([':aid' => $admissionId]);
            $currentStatus = $checkStmt->fetchColumn();

            if (!$currentStatus) {
                return json_encode(['error' => 'Admission record not found.']);
            }

            if ($currentStatus === 'Billed') {
                return json_encode(['error' => 'Diagnosis cannot be modified because this admission is already billed and settled.']);
            }

            $sql = "UPDATE Admission SET Diagnosis = :diagnosis WHERE Admission_ID = :aid";
            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ':diagnosis' => $diagnosis,
                ':aid' => $admissionId
            ]);

            return json_encode([
                'success' => true,
                'message' => 'Clinical diagnosis recorded successfully.',
                'diagnosis' => $diagnosis
            ]);
        } catch (PDOException $e) {
            return json_encode(['error' => 'Database error updating diagnosis: ' . $e->getMessage()]);
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "{}";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "{}";
}

$admission = new AdmissionManager();
switch ($operation) {
    case 'admitPatient':
        echo $admission->admitPatient($json);
        break;
    case 'transferBed':
        echo $admission->transferBed($json);
        break;
    case 'dischargePatient':
        echo $admission->dischargePatient($json);
        break;
    case 'updateDiagnosis':
        echo $admission->updateDiagnosis($json);
        break;
}
?>
