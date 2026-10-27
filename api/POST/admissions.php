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

            $checkPatient = $conn->prepare("SELECT Admission_ID FROM Admission WHERE Patient_ID = :pid AND Status = 'Admitted'");
            $checkPatient->execute([':pid' => $patientId]);
            if ($checkPatient->fetch()) {
                $conn->rollBack();
                return json_encode(['error' => 'This patient already has an active admission.']);
            }

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

            $accessPasscode = sprintf("ADM-%04d", rand(1000, 9999));
            $admStmt = $conn->prepare("
                INSERT INTO Admission (Patient_ID, Admission_Date, Chief_Complaint, Diagnosis, Status, Access_Passcode)
                VALUES (:pid, NOW(), :complaint, :diagnosis, 'Admitted', :passcode)
            ");
            $admStmt->execute([
                ':pid' => $patientId,
                ':complaint' => $chiefComplaint,
                ':diagnosis' => !empty($diagnosis) ? $diagnosis : null,
                ':passcode' => $accessPasscode
            ]);
            $admissionId = $conn->lastInsertId();

            $transferStmt = $conn->prepare("
                INSERT INTO Room_Transfer_Log (Admission_ID, Bed_ID, Date_In)
                VALUES (:aid, :bid, NOW())
            ");
            $transferStmt->execute([
                ':aid' => $admissionId,
                ':bid' => $bedId
            ]);

            $updBed = $conn->prepare("UPDATE Room_Bed SET Is_Available = 0 WHERE Bed_ID = :bid");
            $updBed->execute([':bid' => $bedId]);

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
                'admission_id' => $admissionId,
                'access_passcode' => $accessPasscode
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
        $userId = intval($json['user_id'] ?? 0);
        $doctorId = intval($json['doctor_id'] ?? 0);
        if ($userId > 0 && empty($doctorId)) {
            $docStmt = $conn->prepare("SELECT Doctor_ID FROM Doctor WHERE User_ID = :uid AND Is_Active = 1 LIMIT 1");
            $docStmt->execute([':uid' => $userId]);
            $foundDoc = $docStmt->fetchColumn();
            if ($foundDoc) {
                $doctorId = intval($foundDoc);
            }
        }
        if ($doctorId > 0) {
            $chkAssigned = $conn->prepare("SELECT COUNT(*) FROM Admission_Doctor WHERE Admission_ID = :aid AND Doctor_ID = :did");
            $chkAssigned->execute([':aid' => $admissionId, ':did' => $doctorId]);
            if (intval($chkAssigned->fetchColumn()) === 0) {
                return json_encode(['error' => 'Unauthorized: You are not assigned as an attending physician for this patient.']);
            }
        }
        $newBedId = intval($json['new_bed_id'] ?? 0);

        if (empty($admissionId) || empty($newBedId)) {
            return json_encode(['error' => 'Admission ID and Target Bed are required.']);
        }

        try {
            $conn->beginTransaction();

            $targetBedStmt = $conn->prepare("SELECT Is_Available FROM Room_Bed WHERE Bed_ID = :bid");
            $targetBedStmt->execute([':bid' => $newBedId]);
            $targetBed = $targetBedStmt->fetch(PDO::FETCH_ASSOC);
            if (!$targetBed || !$targetBed['Is_Available']) {
                $conn->rollBack();
                return json_encode(['error' => 'The selected target bed is not available.']);
            }

            $currStayStmt = $conn->prepare("
                SELECT 
                    rtl.Transfer_ID,
                    rtl.Bed_ID,
                    rtl.Date_In,
                    GREATEST(1, DATEDIFF(NOW(), rtl.Date_In)) AS Calculated_Days,
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

            $totalDays = max(1, intval($currentStay['Calculated_Days'] ?? 1));
            $dailyRate = floatval($currentStay['Daily_Rate']);
            $totalRoomFee = $totalDays * $dailyRate;

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

            $releaseBedStmt = $conn->prepare("UPDATE Room_Bed SET Is_Available = 1 WHERE Bed_ID = :bid");
            $releaseBedStmt->execute([':bid' => $currentStay['Bed_ID']]);

            $newTransferStmt = $conn->prepare("
                INSERT INTO Room_Transfer_Log (Admission_ID, Bed_ID, Date_In)
                VALUES (:aid, :bid, NOW())
            ");
            $newTransferStmt->execute([
                ':aid' => $admissionId,
                ':bid' => $newBedId
            ]);

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
        $userId = intval($json['user_id'] ?? 0);
        $doctorId = intval($json['doctor_id'] ?? 0);
        if ($userId > 0 && empty($doctorId)) {
            $docStmt = $conn->prepare("SELECT Doctor_ID FROM Doctor WHERE User_ID = :uid AND Is_Active = 1 LIMIT 1");
            $docStmt->execute([':uid' => $userId]);
            $foundDoc = $docStmt->fetchColumn();
            if ($foundDoc) {
                $doctorId = intval($foundDoc);
            }
        }
        if ($doctorId > 0) {
            $chkAssigned = $conn->prepare("SELECT COUNT(*) FROM Admission_Doctor WHERE Admission_ID = :aid AND Doctor_ID = :did");
            $chkAssigned->execute([':aid' => $admissionId, ':did' => $doctorId]);
            if (intval($chkAssigned->fetchColumn()) === 0) {
                return json_encode(['error' => 'Unauthorized: You are not assigned as an attending physician for this patient.']);
            }
        }

        if (empty($admissionId)) {
            return json_encode(['error' => 'Admission ID is required.']);
        }

        try {
            $conn->beginTransaction();

            $statusCheck = $conn->prepare("SELECT Status FROM Admission WHERE Admission_ID = :aid");
            $statusCheck->execute([':aid' => $admissionId]);
            $currentStatus = $statusCheck->fetchColumn();

            if (!$currentStatus) {
                $conn->rollBack();
                return json_encode(['error' => 'Admission record not found.']);
            }

            if ($currentStatus === 'Billed') {
                $conn->rollBack();
                return json_encode(['error' => 'Patient admission is already settled and billed.']);
            }

            if ($currentStatus === 'Discharged') {
                $conn->commit();
                return json_encode([
                    'success' => true,
                    'message' => 'Patient is already discharged.'
                ]);
            }

            $currStayStmt = $conn->prepare("
                SELECT 
                    rtl.Transfer_ID,
                    rtl.Bed_ID,
                    rtl.Date_In,
                    GREATEST(1, DATEDIFF(NOW(), rtl.Date_In)) AS Calculated_Days,
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
                $totalDays = max(1, intval($currentStay['Calculated_Days'] ?? 1));
                $dailyRate = floatval($currentStay['Daily_Rate']);
                $totalRoomFee = $totalDays * $dailyRate;

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

                $freeBed = $conn->prepare("UPDATE Room_Bed SET Is_Available = 1 WHERE Bed_ID = :bid");
                $freeBed->execute([':bid' => $currentStay['Bed_ID']]);
            }

            $admStmt = $conn->prepare("UPDATE Admission SET Status = 'Discharged', Access_Passcode = NULL WHERE Admission_ID = :aid");
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
        $userId = intval($json['user_id'] ?? 0);
        $doctorId = intval($json['doctor_id'] ?? 0);
        if ($userId > 0 && empty($doctorId)) {
            $docStmt = $conn->prepare("SELECT Doctor_ID FROM Doctor WHERE User_ID = :uid AND Is_Active = 1 LIMIT 1");
            $docStmt->execute([':uid' => $userId]);
            $foundDoc = $docStmt->fetchColumn();
            if ($foundDoc) {
                $doctorId = intval($foundDoc);
            }
        }
        if ($doctorId > 0) {
            $chkAssigned = $conn->prepare("SELECT COUNT(*) FROM Admission_Doctor WHERE Admission_ID = :aid AND Doctor_ID = :did");
            $chkAssigned->execute([':aid' => $admissionId, ':did' => $doctorId]);
            if (intval($chkAssigned->fetchColumn()) === 0) {
                return json_encode(['error' => 'Unauthorized: You are not assigned as an attending physician for this patient.']);
            }
        }
        $diagnosis = trim($json['diagnosis'] ?? '');
        $chiefComplaint = trim($json['chief_complaint'] ?? '');

        if (empty($admissionId)) {
            return json_encode(['error' => 'Admission ID is required.']);
        }

        if (empty($diagnosis)) {
            return json_encode(['error' => 'Clinical Diagnosis cannot be empty.']);
        }

        try {
            $checkStmt = $conn->prepare("SELECT Status FROM Admission WHERE Admission_ID = :aid");
            $checkStmt->execute([':aid' => $admissionId]);
            $currentStatus = $checkStmt->fetchColumn();

            if (!$currentStatus) {
                return json_encode(['error' => 'Admission record not found.']);
            }

            if ($currentStatus === 'Billed') {
                return json_encode(['error' => 'Clinical assessment cannot be modified because this admission is already billed and settled.']);
            }

            if ($chiefComplaint !== '') {
                $sql = "UPDATE Admission SET Diagnosis = :diagnosis, Chief_Complaint = :complaint WHERE Admission_ID = :aid";
                $stmt = $conn->prepare($sql);
                $stmt->execute([
                    ':diagnosis' => $diagnosis,
                    ':complaint' => $chiefComplaint,
                    ':aid' => $admissionId
                ]);
            } else {
                $sql = "UPDATE Admission SET Diagnosis = :diagnosis WHERE Admission_ID = :aid";
                $stmt = $conn->prepare($sql);
                $stmt->execute([
                    ':diagnosis' => $diagnosis,
                    ':aid' => $admissionId
                ]);
            }

            return json_encode([
                'success' => true,
                'message' => 'Clinical assessment recorded successfully.',
                'diagnosis' => $diagnosis,
                'chief_complaint' => $chiefComplaint
            ]);
        } catch (PDOException $e) {
            return json_encode(['error' => 'Database error updating clinical assessment: ' . $e->getMessage()]);
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
    case 'updateClinicalAssessment':
        echo $admission->updateDiagnosis($json);
        break;
}
?>
