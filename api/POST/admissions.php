<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class AdmissionManager
{
    private function ensureBedTransferOrderTable($conn)
    {
        $conn->exec("
            CREATE TABLE IF NOT EXISTS Bed_Transfer_Order (
                Transfer_Order_ID INT(11) NOT NULL AUTO_INCREMENT,
                Admission_ID INT(11) NOT NULL,
                Doctor_ID INT(11) NOT NULL,
                Ordered_By_User_ID INT(11) DEFAULT NULL,
                Target_Room_Type_ID INT(11) DEFAULT NULL,
                Clinical_Reason TEXT NOT NULL,
                Status ENUM('Pending', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
                Fulfilled_By_User_ID INT(11) DEFAULT NULL,
                Fulfilled_Transfer_ID INT(11) DEFAULT NULL,
                Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                Fulfilled_At DATETIME DEFAULT NULL,
                PRIMARY KEY (Transfer_Order_ID),
                KEY idx_bto_admission (Admission_ID, Status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
    }

    function admitPatient($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $patientId = intval($json['patient_id'] ?? 0);
        $bedId = intval($json['bed_id'] ?? 0);
        $chiefComplaint = trim($json['chief_complaint'] ?? '');
        $diagnosis = trim($json['diagnosis'] ?? '');
        $doctorIds = $json['doctor_ids'] ?? [];
        $submittingDoctorId = intval($json['submitting_doctor_id'] ?? $json['doctor_id'] ?? 0);
        if ($submittingDoctorId > 0 && is_array($doctorIds)) {
            $existingDocInts = array_map('intval', $doctorIds);
            if (!in_array($submittingDoctorId, $existingDocInts)) {
                $doctorIds[] = $submittingDoctorId;
            }
        }
        $initialCharges = $json['initial_charges'] ?? [];

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

            if (!empty($initialCharges) && is_array($initialCharges)) {
                $catStmt = $conn->prepare("
                    SELECT Catalog_ID, Item_Name, Category_Type, Station_ID, Unit_Price 
                    FROM Charge_Catalogs 
                    WHERE Catalog_ID = :cid AND Is_Active = 1
                ");
                $ledgerStmt = $conn->prepare("
                    INSERT INTO Billing_Ledger (Admission_ID, Station_ID, Catalog_ID, Quantity, Unit_Price, Total_Charge, Transaction_Type, Timestamp)
                    VALUES (:aid, :sid, :cid, :qty, :uprice, :total, 'Charge', NOW())
                ");

                foreach ($initialCharges as $charge) {
                    $cid = intval($charge['catalog_id'] ?? 0);
                    $qty = floatval($charge['quantity'] ?? 1);
                    if ($cid <= 0 || $qty <= 0) {
                        continue;
                    }

                    $catStmt->execute([':cid' => $cid]);
                    $catItem = $catStmt->fetch(PDO::FETCH_ASSOC);
                    if ($catItem) {
                        $uPrice = floatval($catItem['Unit_Price']);
                        $sId = !empty($catItem['Station_ID']) ? intval($catItem['Station_ID']) : 5;
                        $totCharge = round($qty * $uPrice, 2);

                        $ledgerStmt->execute([
                            ':aid'    => $admissionId,
                            ':sid'    => $sId,
                            ':cid'    => $cid,
                            ':qty'    => $qty,
                            ':uprice' => $uPrice,
                            ':total'  => $totCharge
                        ]);
                    }
                }
            }

            $conn->commit();
            $successMsg = !empty($initialCharges)
                ? 'Patient successfully admitted with bed allocation and initial intake charges posted to ledger.'
                : 'Patient successfully admitted and assigned to bed.';
            return json_encode([
                'success' => true,
                'message' => $successMsg,
                'admission_id' => $admissionId,
                'access_passcode' => $accessPasscode
            ]);

        } catch (Exception $e) {
            $conn->rollBack();
            return json_encode(['error' => 'Admission failed: ' . $e->getMessage()]);
        }
    }

    function orderBedTransfer($json = '{}')
    {
        include "connection.php";
        $this->ensureBedTransferOrderTable($conn);

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);
        $userId = intval($json['user_id'] ?? 0);
        $doctorId = intval($json['doctor_id'] ?? 0);
        $targetRoomTypeId = intval($json['target_room_type_id'] ?? 0);
        $clinicalReason = trim($json['clinical_reason'] ?? '');

        if (empty($admissionId)) {
            return json_encode(['error' => 'Admission ID is required.']);
        }
        if ($clinicalReason === '') {
            return json_encode(['error' => 'Please enter the clinical reason or instructions for the bed transfer order.']);
        }

        $isCallerAdmin = false;
        if ($userId > 0) {
            $uStmt = $conn->prepare("
                SELECT u.Role_ID, r.Role_Name, d.Doctor_ID
                FROM System_User u
                INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID
                LEFT JOIN Doctor d ON d.User_ID = u.User_ID AND d.Is_Active = 1
                WHERE u.User_ID = :uid
                LIMIT 1
            ");
            $uStmt->execute([':uid' => $userId]);
            $uRow = $uStmt->fetch(PDO::FETCH_ASSOC);
            if ($uRow) {
                $isCallerAdmin = (intval($uRow['Role_ID']) === 1 || strtolower(trim($uRow['Role_Name'] ?? '')) === 'admin');
                $linkedDocId = intval($uRow['Doctor_ID'] ?? 0);
                if (!$isCallerAdmin && $linkedDocId <= 0) {
                    return json_encode(['error' => 'Clinical Protocol: Only an assigned attending physician (or System Administrator) can issue a Doctor Bed Transfer Order.']);
                }
                if (empty($doctorId) && $linkedDocId > 0) {
                    $doctorId = $linkedDocId;
                }
            }
        }

        if ($doctorId > 0) {
            $chkAssigned = $conn->prepare("SELECT COUNT(*) FROM Admission_Doctor WHERE Admission_ID = :aid AND Doctor_ID = :did");
            $chkAssigned->execute([':aid' => $admissionId, ':did' => $doctorId]);
            if (intval($chkAssigned->fetchColumn()) === 0) {
                return json_encode(['error' => 'Unauthorized: You are not assigned as an attending physician for this patient.']);
            }
        } else if ($isCallerAdmin) {
            $firstDoc = $conn->prepare("SELECT Doctor_ID FROM Admission_Doctor WHERE Admission_ID = :aid ORDER BY Admission_Doctor_ID ASC LIMIT 1");
            $firstDoc->execute([':aid' => $admissionId]);
            $doctorId = intval($firstDoc->fetchColumn() ?: 0);
            if (!$doctorId) {
                return json_encode(['error' => 'Please select the attending physician ordering the bed transfer.']);
            }
        } else {
            return json_encode(['error' => 'Please select the attending physician ordering the bed transfer.']);
        }

        try {
            $conn->beginTransaction();

            $admCheck = $conn->prepare("
                SELECT a.Status, CONCAT(p.First_Name, ' ', p.Last_Name) AS Full_Name,
                       CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                       rb.Bed_Code, r.Room_Name
                FROM Admission a
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                LEFT JOIN Room_Transfer_Log rtl ON rtl.Admission_ID = a.Admission_ID AND rtl.Date_Out IS NULL
                LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                LEFT JOIN Room r ON rb.Room_ID = r.Room_ID
                WHERE a.Admission_ID = :aid
            ");
            $admCheck->execute([':aid' => $admissionId]);
            $admRow = $admCheck->fetch(PDO::FETCH_ASSOC);

            if (!$admRow) {
                $conn->rollBack();
                return json_encode(['error' => 'Admission record not found.']);
            }
            if ($admRow['Status'] !== 'Admitted') {
                $conn->rollBack();
                return json_encode(['error' => 'Cannot issue bed transfer order: Patient is already discharged or billed.']);
            }

            $targetTypeLabel = 'Any Available Room Classification';
            if ($targetRoomTypeId > 0) {
                $rtStmt = $conn->prepare("SELECT Type_Name FROM Enum_Room_Type WHERE Room_Type_ID = :rtid");
                $rtStmt->execute([':rtid' => $targetRoomTypeId]);
                $foundType = $rtStmt->fetchColumn();
                if ($foundType) {
                    $targetTypeLabel = $foundType;
                } else {
                    $targetRoomTypeId = 0;
                }
            }

            $existingStmt = $conn->prepare("SELECT Transfer_Order_ID FROM Bed_Transfer_Order WHERE Admission_ID = :aid AND Status = 'Pending' ORDER BY Transfer_Order_ID DESC LIMIT 1");
            $existingStmt->execute([':aid' => $admissionId]);
            $existingId = intval($existingStmt->fetchColumn() ?: 0);

            if ($existingId > 0) {
                $updOrd = $conn->prepare("
                    UPDATE Bed_Transfer_Order
                    SET Doctor_ID = :did,
                        Ordered_By_User_ID = :uid,
                        Target_Room_Type_ID = :rtid,
                        Clinical_Reason = :reason,
                        Created_At = NOW()
                    WHERE Transfer_Order_ID = :oid
                ");
                $updOrd->execute([
                    ':did' => $doctorId,
                    ':uid' => $userId > 0 ? $userId : null,
                    ':rtid' => $targetRoomTypeId > 0 ? $targetRoomTypeId : null,
                    ':reason' => $clinicalReason,
                    ':oid' => $existingId
                ]);
                $orderId = $existingId;
            } else {
                $insOrd = $conn->prepare("
                    INSERT INTO Bed_Transfer_Order
                        (Admission_ID, Doctor_ID, Ordered_By_User_ID, Target_Room_Type_ID, Clinical_Reason, Status, Created_At)
                    VALUES
                        (:aid, :did, :uid, :rtid, :reason, 'Pending', NOW())
                ");
                $insOrd->execute([
                    ':aid' => $admissionId,
                    ':did' => $doctorId,
                    ':uid' => $userId > 0 ? $userId : null,
                    ':rtid' => $targetRoomTypeId > 0 ? $targetRoomTypeId : null,
                    ':reason' => $clinicalReason
                ]);
                $orderId = intval($conn->lastInsertId());
            }

            $docName = 'Attending Physician';
            $dStmt = $conn->prepare("SELECT CONCAT('Dr. ', First_Name, ' ', Last_Name) FROM Doctor WHERE Doctor_ID = :did");
            $dStmt->execute([':did' => $doctorId]);
            $docName = $dStmt->fetchColumn() ?: $docName;

            $patFullName = $admRow['Full_Name'] ?? 'In-Patient';
            $admCode = $admRow['Admission_Code'] ?? ('ADM-' . str_pad($admissionId, 3, '0', STR_PAD_LEFT));
            $fromBedStr = !empty($admRow['Bed_Code']) ? " from Bed {$admRow['Bed_Code']} ({$admRow['Room_Name']})" : "";
            $ordCode = 'TRF-ORD-' . str_pad($orderId, 3, '0', STR_PAD_LEFT);

            $nurseRolesStmt = $conn->query("
                SELECT Role_ID
                FROM Enum_User_Role
                WHERE Role_ID != 1
                  AND (
                      (Access_Domain IN ('Clinical', 'Hybrid') AND Role_Name NOT LIKE '%Doctor%' AND Role_Name NOT LIKE '%Physician%')
                      OR Role_Name LIKE '%Nurse%'
                      OR Role_Name LIKE '%Ward Clerk%'
                  )
            ");
            $nurseRoleIds = $nurseRolesStmt ? $nurseRolesStmt->fetchAll(PDO::FETCH_COLUMN) : [];

            if (!empty($nurseRoleIds)) {
                $notifStmt = $conn->prepare("
                    INSERT INTO Clinical_Notification
                        (Admission_ID, Request_ID, Sender_User_ID, Target_Role_ID, Target_Station_ID, Target_User_ID, Title, Message, Notification_Type, Is_Read, Created_At)
                    VALUES
                        (:aid, NULL, :sender, :rid, NULL, NULL, :title, :msg, 'Bed_Transfer_Ordered', 0, NOW())
                ");
                $notifTitle = "Bed Transfer Order ({$ordCode}): {$patFullName}";
                $notifMsg = "{$docName} ordered a bed transfer for {$patFullName} ({$admCode}){$fromBedStr} to {$targetTypeLabel}. Reason: {$clinicalReason}";
                foreach ($nurseRoleIds as $nRid) {
                    $notifStmt->execute([
                        ':aid' => $admissionId,
                        ':sender' => $userId > 0 ? $userId : null,
                        ':rid' => intval($nRid),
                        ':title' => $notifTitle,
                        ':msg' => $notifMsg
                    ]);
                }
            }

            $conn->commit();
            return json_encode([
                'success' => true,
                'order_id' => $orderId,
                'message' => "Bed Transfer Order ({$ordCode}) issued by {$docName} and dispatched to Nurse Station (Head Nurse, Nurses & Ward Clerks) for bed assignment."
            ]);
        } catch (Exception $e) {
            $conn->rollBack();
            return json_encode(['error' => 'Failed to issue bed transfer order: ' . $e->getMessage()]);
        }
    }

    function cancelBedTransferOrder($json = '{}')
    {
        include "connection.php";
        $this->ensureBedTransferOrderTable($conn);

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);
        $userId = intval($json['user_id'] ?? 0);

        if (empty($admissionId)) {
            return json_encode(['error' => 'Admission ID is required.']);
        }

        if ($userId > 0) {
            $uStmt = $conn->prepare("
                SELECT u.Role_ID, r.Role_Name, d.Doctor_ID
                FROM System_User u
                INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID
                LEFT JOIN Doctor d ON d.User_ID = u.User_ID AND d.Is_Active = 1
                WHERE u.User_ID = :uid
                LIMIT 1
            ");
            $uStmt->execute([':uid' => $userId]);
            $uRow = $uStmt->fetch(PDO::FETCH_ASSOC);
            if ($uRow) {
                $isAdmin = intval($uRow['Role_ID']) === 1 || strtolower($uRow['Role_Name'] ?? '') === 'admin';
                $docId = intval($uRow['Doctor_ID'] ?? 0);
                if (!$isAdmin) {
                    if ($docId <= 0) {
                        return json_encode(['error' => 'Only the attending physician or System Administrator can cancel a Doctor Bed Transfer Order.']);
                    }
                    $chkAssigned = $conn->prepare("SELECT COUNT(*) FROM Admission_Doctor WHERE Admission_ID = :aid AND Doctor_ID = :did");
                    $chkAssigned->execute([':aid' => $admissionId, ':did' => $docId]);
                    if (intval($chkAssigned->fetchColumn()) === 0) {
                        return json_encode(['error' => 'Unauthorized: You are not assigned as an attending physician for this patient.']);
                    }
                }
            }
        }

        try {
            $upd = $conn->prepare("UPDATE Bed_Transfer_Order SET Status = 'Cancelled' WHERE Admission_ID = :aid AND Status = 'Pending'");
            $upd->execute([':aid' => $admissionId]);
            if ($upd->rowCount() === 0) {
                return json_encode(['error' => 'No active pending bed transfer order found to cancel.']);
            }
            return json_encode([
                'success' => true,
                'message' => 'Pending Doctor Bed Transfer Order has been cancelled.'
            ]);
        } catch (Exception $e) {
            return json_encode(['error' => 'Failed to cancel transfer order: ' . $e->getMessage()]);
        }
    }

    function transferBed($json = '{}')
    {
        include "connection.php";
        $this->ensureBedTransferOrderTable($conn);

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);
        $userId = intval($json['user_id'] ?? 0);
        $newBedId = intval($json['new_bed_id'] ?? 0);

        if (empty($admissionId) || empty($newBedId)) {
            return json_encode(['error' => 'Admission ID and Target Bed are required.']);
        }

        $isSystemAdmin = false;
        $staffDisplayName = 'Nurse Station Staff';

        if ($userId > 0) {
            $callerStmt = $conn->prepare("
                SELECT u.User_ID, CONCAT(u.First_Name, ' ', u.Last_Name) AS Staff_Name,
                       u.Role_ID, r.Role_Name, r.Access_Domain,
                       d.Doctor_ID
                FROM System_User u
                INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID
                LEFT JOIN Doctor d ON d.User_ID = u.User_ID AND d.Is_Active = 1
                WHERE u.User_ID = :uid
                LIMIT 1
            ");
            $callerStmt->execute([':uid' => $userId]);
            $caller = $callerStmt->fetch(PDO::FETCH_ASSOC);

            if ($caller) {
                $roleId = intval($caller['Role_ID'] ?? 0);
                $roleName = strtolower(trim($caller['Role_Name'] ?? ''));
                $domain = strtolower(trim($caller['Access_Domain'] ?? ''));
                $docId = intval($caller['Doctor_ID'] ?? 0);
                $isSystemAdmin = ($roleId === 1 || $roleName === 'admin');
                $staffDisplayName = trim($caller['Staff_Name'] ?? '') ?: 'Nurse Station Staff';

                if (!$isSystemAdmin) {
                    if ($docId > 0 || strpos($roleName, 'doctor') !== false || strpos($roleName, 'physician') !== false) {
                        return json_encode(['error' => 'Clinical Protocol: Attending physicians issue a Bed Transfer Order, and Nurse Station staff (Head Nurse, Nurses & Ward Clerks) select the vacant bed and execute the transfer.']);
                    }
                    if ($domain === 'finance') {
                        return json_encode(['error' => 'Separation of Duties: Finance staff cannot transfer patient beds.']);
                    }
                }
            }
        }

        try {
            $conn->beginTransaction();

            $admStatusStmt = $conn->prepare("
                SELECT a.Status, CONCAT(p.First_Name, ' ', p.Last_Name) AS Full_Name,
                       CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code
                FROM Admission a
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                WHERE a.Admission_ID = :aid
            ");
            $admStatusStmt->execute([':aid' => $admissionId]);
            $admRow = $admStatusStmt->fetch(PDO::FETCH_ASSOC);
            if (!$admRow || $admRow['Status'] !== 'Admitted') {
                $conn->rollBack();
                return json_encode(['error' => 'Cannot transfer bed: Patient admission is no longer active.']);
            }

            $pendingStmt = $conn->prepare("
                SELECT bto.Transfer_Order_ID, bto.Doctor_ID, bto.Ordered_By_User_ID, d.User_ID AS Doctor_User_ID
                FROM Bed_Transfer_Order bto
                LEFT JOIN Doctor d ON bto.Doctor_ID = d.Doctor_ID
                WHERE bto.Admission_ID = :aid AND bto.Status = 'Pending'
                ORDER BY bto.Transfer_Order_ID DESC
                LIMIT 1
            ");
            $pendingStmt->execute([':aid' => $admissionId]);
            $pendingOrder = $pendingStmt->fetch(PDO::FETCH_ASSOC);

            $targetBedStmt = $conn->prepare("
                SELECT rb.Is_Available, rb.Bed_Code, r.Room_Name, rt.Room_Type_ID, rt.Type_Name AS Room_Type
                FROM Room_Bed rb
                INNER JOIN Room r ON rb.Room_ID = r.Room_ID
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE rb.Bed_ID = :bid
            ");
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
                    r.Room_Name,
                    rt.Room_Type_ID,
                    rt.Type_Name AS Room_Type
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

            $adminOverride = !empty($json['admin_override']) && $isSystemAdmin;
            $isTargetHighTier = (intval($targetBed['Room_Type_ID'] ?? 0) === 4 || stripos($targetBed['Room_Type'] ?? '', 'ICU') !== false || stripos($targetBed['Room_Type'] ?? '', 'Intensive Care') !== false);
            $isCurrentHighTier = (intval($currentStay['Room_Type_ID'] ?? 0) === 4 || stripos($currentStay['Room_Type'] ?? '', 'ICU') !== false || stripos($currentStay['Room_Type'] ?? '', 'Intensive Care') !== false);

            if (!$pendingOrder && !$adminOverride) {
                if ($isTargetHighTier && !$isCurrentHighTier) {
                    $conn->rollBack();
                    return json_encode([
                        'error' => "Doctor Transfer Order Required: Transferring a patient into high-tier accommodation ({$targetBed['Room_Type']}) requires an Attending Physician's Bed Transfer Order. Nurse Station staff may directly transfer between regular rooms or step down from ICU to Ward/Private."
                    ]);
                }
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
            $newTransferId = intval($conn->lastInsertId());

            $occupyBedStmt = $conn->prepare("UPDATE Room_Bed SET Is_Available = 0 WHERE Bed_ID = :bid");
            $occupyBedStmt->execute([':bid' => $newBedId]);

            if ($pendingOrder) {
                $fulfillStmt = $conn->prepare("
                    UPDATE Bed_Transfer_Order
                    SET Status = 'Completed',
                        Fulfilled_By_User_ID = :uid,
                        Fulfilled_Transfer_ID = :tid,
                        Fulfilled_At = NOW()
                    WHERE Transfer_Order_ID = :oid
                ");
                $fulfillStmt->execute([
                    ':uid' => $userId > 0 ? $userId : null,
                    ':tid' => $newTransferId,
                    ':oid' => $pendingOrder['Transfer_Order_ID']
                ]);

                $targetDocUserId = intval($pendingOrder['Doctor_User_ID'] ?: ($pendingOrder['Ordered_By_User_ID'] ?? 0));
                if ($targetDocUserId > 0 && $targetDocUserId !== $userId) {
                    $patFullName = $admRow['Full_Name'] ?? 'In-Patient';
                    $admCode = $admRow['Admission_Code'] ?? ('ADM-' . str_pad($admissionId, 3, '0', STR_PAD_LEFT));
                    $docNotifStmt = $conn->prepare("
                        INSERT INTO Clinical_Notification
                            (Admission_ID, Request_ID, Sender_User_ID, Target_Role_ID, Target_Station_ID, Target_User_ID, Title, Message, Notification_Type, Is_Read, Created_At)
                        VALUES
                            (:aid, NULL, :sender, NULL, NULL, :tuid, :title, :msg, 'Bed_Transfer_Completed', 0, NOW())
                    ");
                    $docNotifStmt->execute([
                        ':aid' => $admissionId,
                        ':sender' => $userId > 0 ? $userId : null,
                        ':tuid' => $targetDocUserId,
                        ':title' => "Bed Transfer Completed: {$patFullName}",
                        ':msg' => "{$staffDisplayName} transferred {$patFullName} ({$admCode}) into Bed {$targetBed['Bed_Code']} ({$targetBed['Room_Name']} - {$targetBed['Room_Type']})."
                    ]);
                }
            } else {
                $docLookupStmt = $conn->prepare("
                    SELECT d.User_ID
                    FROM Admission_Doctor ad
                    INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                    WHERE ad.Admission_ID = :aid AND d.User_ID IS NOT NULL AND d.User_ID != :uid
                    LIMIT 1
                ");
                $docLookupStmt->execute([':aid' => $admissionId, ':uid' => $userId]);
                $assignedDoc = $docLookupStmt->fetch(PDO::FETCH_ASSOC);
                if ($assignedDoc && !empty($assignedDoc['User_ID'])) {
                    $patFullName = $admRow['Full_Name'] ?? 'In-Patient';
                    $admCode = $admRow['Admission_Code'] ?? ('ADM-' . str_pad($admissionId, 3, '0', STR_PAD_LEFT));
                    $docNotifStmt = $conn->prepare("
                        INSERT INTO Clinical_Notification
                            (Admission_ID, Request_ID, Sender_User_ID, Target_Role_ID, Target_Station_ID, Target_User_ID, Title, Message, Notification_Type, Is_Read, Created_At)
                        VALUES
                            (:aid, NULL, :sender, NULL, NULL, :tuid, :title, :msg, 'Lateral_Bed_Transfer', 0, NOW())
                    ");
                    $docNotifStmt->execute([
                        ':aid' => $admissionId,
                        ':sender' => $userId > 0 ? $userId : null,
                        ':tuid' => $assignedDoc['User_ID'],
                        ':title' => ($isCurrentHighTier && !$isTargetHighTier) ? "ICU Step-Down Transfer: {$patFullName}" : "Direct Bed Transfer: {$patFullName}",
                        ':msg' => ($isCurrentHighTier && !$isTargetHighTier)
                            ? "{$staffDisplayName} transferred {$patFullName} ({$admCode}) from {$currentStay['Room_Type']} (Bed {$currentStay['Bed_Code']}) to {$targetBed['Room_Type']} (Bed {$targetBed['Bed_Code']}) via Nurse Station de-escalation/step-down."
                            : "{$staffDisplayName} completed a direct bed transfer of {$patFullName} ({$admCode}) from Bed {$currentStay['Bed_Code']} to Bed {$targetBed['Bed_Code']} ({$targetBed['Room_Name']} - {$targetBed['Room_Type']})."
                    ]);
                }
            }

            $conn->commit();
            return json_encode([
                'success' => true,
                'message' => "Bed transfer completed to Bed {$targetBed['Bed_Code']} ({$targetBed['Room_Name']}). Board & lodging charge of ₱" . number_format($totalRoomFee, 2) . " posted for {$totalDays} day(s) in previous bed ({$currentStay['Bed_Code']})."
            ]);

        } catch (Exception $e) {
            $conn->rollBack();
            return json_encode(['error' => 'Transfer failed: ' . $e->getMessage()]);
        }
    }

    function dischargePatient($json = '{}')
    {
        include "connection.php";
        $this->ensureBedTransferOrderTable($conn);

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

            $statusCheck = $conn->prepare("SELECT Status, Medical_Discharge_Date FROM Admission WHERE Admission_ID = :aid");
            $statusCheck->execute([':aid' => $admissionId]);
            $admRow = $statusCheck->fetch(PDO::FETCH_ASSOC);

            if (!$admRow) {
                $conn->rollBack();
                return json_encode(['error' => 'Admission record not found.']);
            }

            if ($admRow['Status'] === 'Billed') {
                $conn->rollBack();
                return json_encode(['error' => 'Patient admission is already settled and billed.']);
            }

            if ($admRow['Status'] === 'Discharged') {
                $conn->commit();
                return json_encode([
                    'success' => true,
                    'message' => 'Patient is already discharged.'
                ]);
            }

            $adminOverride = !empty($json['admin_override']);
            if (empty($admRow['Medical_Discharge_Date']) && !$adminOverride) {
                $conn->rollBack();
                return json_encode(['error' => 'Medical Clearance Required: An attending physician must first issue a Doctor\'s Discharge Order (May Go Home) before billing discharge and bed release.']);
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

            $cancelPendingTransfer = $conn->prepare("UPDATE Bed_Transfer_Order SET Status = 'Cancelled' WHERE Admission_ID = :aid AND Status = 'Pending'");
            $cancelPendingTransfer->execute([':aid' => $admissionId]);

            $cancelUnadministeredOrders = $conn->prepare("UPDATE Doctor_Order_Request SET Status = 'Cancelled' WHERE Admission_Doctor_ID IN (SELECT Admission_Doctor_ID FROM Admission_Doctor WHERE Admission_ID = :aid) AND Status NOT IN ('Administered', 'Cancelled')");
            $cancelUnadministeredOrders->execute([':aid' => $admissionId]);

            $admStmt = $conn->prepare("UPDATE Admission SET Status = 'Discharged', Access_Passcode = NULL WHERE Admission_ID = :aid");
            $admStmt->execute([':aid' => $admissionId]);

            $conn->commit();
            return json_encode([
                'success' => true,
                'message' => 'Patient successfully discharged, final room fee posted to ledger, and bed released.'
            ]);

        } catch (Exception $e) {
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }
            return json_encode(['error' => 'Discharge failed: ' . $e->getMessage()]);
        }
    }

    function orderMedicalDischarge($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);
        $userId = intval($json['user_id'] ?? 0);
        $doctorId = intval($json['doctor_id'] ?? 0);
        $instructions = trim($json['discharge_instructions'] ?? '');
        $diagnosis = trim($json['diagnosis'] ?? '');

        if (empty($admissionId)) {
            return json_encode(['error' => 'Admission ID is required.']);
        }

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
        } else {
            $firstDoc = $conn->prepare("SELECT Doctor_ID FROM Admission_Doctor WHERE Admission_ID = :aid ORDER BY Admission_Doctor_ID ASC LIMIT 1");
            $firstDoc->execute([':aid' => $admissionId]);
            $doctorId = intval($firstDoc->fetchColumn() ?: 0);
            if (!$doctorId) {
                return json_encode(['error' => 'Please select the attending physician ordering the medical discharge.']);
            }
        }

        try {
            $conn->beginTransaction();

            $statusCheck = $conn->prepare("SELECT Status, Medical_Discharge_Date FROM Admission WHERE Admission_ID = :aid");
            $statusCheck->execute([':aid' => $admissionId]);
            $row = $statusCheck->fetch(PDO::FETCH_ASSOC);

            if (!$row) {
                $conn->rollBack();
                return json_encode(['error' => 'Admission record not found.']);
            }

            if ($row['Status'] === 'Billed' || $row['Status'] === 'Discharged') {
                $conn->rollBack();
                return json_encode(['error' => 'Cannot issue discharge order: Patient is already discharged or billed.']);
            }

            $updateSql = "UPDATE Admission SET 
                            Medical_Discharge_Date = NOW(),
                            Medical_Discharge_Doctor_ID = :did,
                            Discharge_Instructions = :inst";
            $params = [
                ':aid' => $admissionId,
                ':did' => $doctorId > 0 ? $doctorId : null,
                ':inst' => !empty($instructions) ? $instructions : null
            ];

            if (!empty($diagnosis)) {
                $updateSql .= ", Diagnosis = :diag";
                $params[':diag'] = $diagnosis;
            }

            $updateSql .= " WHERE Admission_ID = :aid";

            $stmt = $conn->prepare($updateSql);
            $stmt->execute($params);

            $docName = 'Attending Physician';
            if ($doctorId > 0) {
                $dStmt = $conn->prepare("SELECT CONCAT('Dr. ', First_Name, ' ', Last_Name) FROM Doctor WHERE Doctor_ID = :did");
                $dStmt->execute([':did' => $doctorId]);
                $docName = $dStmt->fetchColumn() ?: $docName;
            }

            $patStmt = $conn->prepare("SELECT CONCAT(p.First_Name, ' ', p.Last_Name) AS Full_Name, CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code FROM Admission a INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID WHERE a.Admission_ID = :aid");
            $patStmt->execute([':aid' => $admissionId]);
            $patInfo = $patStmt->fetch(PDO::FETCH_ASSOC);
            $patFullName = $patInfo['Full_Name'] ?? 'In-Patient';
            $admCode = $patInfo['Admission_Code'] ?? ('ADM-' . str_pad($admissionId, 3, '0', STR_PAD_LEFT));

            $finRolesStmt = $conn->query("SELECT Role_ID FROM Enum_User_Role WHERE Access_Domain IN ('Finance', 'Hybrid')");
            $finRoleIds = $finRolesStmt ? $finRolesStmt->fetchAll(PDO::FETCH_COLUMN) : [];
            if (!empty($finRoleIds)) {
                $notifStmt = $conn->prepare("INSERT INTO Clinical_Notification (Admission_ID, Request_ID, Sender_User_ID, Target_Role_ID, Target_Station_ID, Target_User_ID, Title, Message, Notification_Type, Is_Read, Created_At) VALUES (:aid, NULL, :sender, :rid, NULL, NULL, :title, :msg, 'Medical_Discharge_Ordered', 0, NOW())");
                $notifTitle = "Medical Discharge Ordered: {$patFullName}";
                $notifMsg = "{$docName} issued a May Go Home order for {$patFullName} ({$admCode}). Ready for Final Billing Clearance & SOA.";
                foreach ($finRoleIds as $fRid) {
                    $notifStmt->execute([
                        ':aid' => $admissionId,
                        ':sender' => $userId > 0 ? $userId : null,
                        ':rid' => intval($fRid),
                        ':title' => $notifTitle,
                        ':msg' => $notifMsg
                    ]);
                }
            }

            $conn->commit();
            return json_encode([
                'success' => true,
                'message' => "Doctor's discharge order (May Go Home) officially recorded by {$docName}. Patient is now medically cleared for final billing clearance."
            ]);
        } catch (Exception $e) {
            $conn->rollBack();
            return json_encode(['error' => 'Failed to record discharge order: ' . $e->getMessage()]);
        }
    }

    function revokeMedicalDischarge($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        if (empty($admissionId)) {
            return json_encode(['error' => 'Admission ID is required.']);
        }

        try {
            $statusCheck = $conn->prepare("SELECT Status FROM Admission WHERE Admission_ID = :aid");
            $statusCheck->execute([':aid' => $admissionId]);
            $status = $statusCheck->fetchColumn();

            if ($status === 'Billed' || $status === 'Discharged') {
                return json_encode(['error' => 'Cannot revoke: Patient is already discharged or billed.']);
            }

            $stmt = $conn->prepare("UPDATE Admission SET Medical_Discharge_Date = NULL, Medical_Discharge_Doctor_ID = NULL, Discharge_Instructions = NULL WHERE Admission_ID = :aid");
            $stmt->execute([':aid' => $admissionId]);

            return json_encode([
                'success' => true,
                'message' => 'Medical discharge order revoked. Patient returned to active clinical care.'
            ]);
        } catch (Exception $e) {
            return json_encode(['error' => 'Failed to revoke discharge order: ' . $e->getMessage()]);
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

require_once __DIR__ . '/../ws_notify.php';

$operation = "";
$json = "{}";
if (($_SERVER['REQUEST_METHOD'] ?? '') == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "{}";
} else if (($_SERVER['REQUEST_METHOD'] ?? '') == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "{}";
}

$admission = new AdmissionManager();
$wsOut = "";
switch ($operation) {
    case 'admitPatient':
        $wsOut = $admission->admitPatient($json);
        break;
    case 'transferBed':
        $wsOut = $admission->transferBed($json);
        break;
    case 'orderBedTransfer':
        $wsOut = $admission->orderBedTransfer($json);
        break;
    case 'cancelBedTransferOrder':
        $wsOut = $admission->cancelBedTransferOrder($json);
        break;
    case 'dischargePatient':
        $wsOut = $admission->dischargePatient($json);
        break;
    case 'orderMedicalDischarge':
        $wsOut = $admission->orderMedicalDischarge($json);
        break;
    case 'revokeMedicalDischarge':
        $wsOut = $admission->revokeMedicalDischarge($json);
        break;
    case 'updateDiagnosis':
    case 'updateClinicalAssessment':
        $wsOut = $admission->updateDiagnosis($json);
        break;
}

if ($wsOut !== "") {
    echo $wsOut;
    $wsRes = json_decode($wsOut, true);
    if (is_array($wsRes) && !empty($wsRes['success'])) {
        $wsReq = is_array($json) ? $json : (json_decode($json, true) ?: []);
        $wsAdmId = intval($wsReq['admission_id'] ?? $wsRes['admission_id'] ?? 0);
        broadcastWebSocketEvent('admissions', $operation, [
            'admission_id' => $wsAdmId
        ]);
    }
}
?>
