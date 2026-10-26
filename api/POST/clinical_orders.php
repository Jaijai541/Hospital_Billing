<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class ClinicalOrderManager
{
    function createDoctorOrder($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionDoctorId = intval($json['admission_doctor_id'] ?? 0);
        $catalogId = intval($json['catalog_id'] ?? 0);
        $quantity = floatval($json['quantity'] ?? 1);
        $dosage = trim($json['dosage_instructions'] ?? '');
        $senderUserId = intval($json['user_id'] ?? 0);

        if (empty($admissionDoctorId) || empty($catalogId) || $quantity <= 0) {
            return json_encode(['error' => 'Doctor, Catalog item, and valid Quantity are required.']);
        }

        try {
            $catStmt = $conn->prepare("SELECT Catalog_ID, Item_Name, Category_Type, Station_ID FROM Charge_Catalogs WHERE Catalog_ID = :cid");
            $catStmt->execute([':cid' => $catalogId]);
            $catItem = $catStmt->fetch(PDO::FETCH_ASSOC);

            if (!$catItem) {
                return json_encode(['error' => 'Catalog item not found.']);
            }

            $targetStationId = !empty($catItem['Station_ID']) ? intval($catItem['Station_ID']) : 5;

            $admStmt = $conn->prepare("SELECT ad.Admission_ID, CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                                              CONCAT(p.First_Name, ' ', p.Last_Name) AS Patient_Name,
                                              CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                                              COALESCE(r.Room_Name, 'Ward') AS Room_Name,
                                              COALESCE(rb.Bed_Code, 'Bed') AS Bed_Code
                                       FROM Admission_Doctor ad
                                       INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                                       INNER JOIN Admission a ON ad.Admission_ID = a.Admission_ID
                                       INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                                       LEFT JOIN Room_Transfer_Log rtl ON a.Admission_ID = rtl.Admission_ID AND rtl.Date_Out IS NULL
                                       LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                                       LEFT JOIN Room r ON rb.Room_ID = r.Room_ID
                                       WHERE ad.Admission_Doctor_ID = :adid");
            $admStmt->execute([':adid' => $admissionDoctorId]);
            $admData = $admStmt->fetch(PDO::FETCH_ASSOC);

            $sql = "INSERT INTO Doctor_Order_Request (Admission_Doctor_ID, Catalog_ID, Target_Station_ID, Quantity, Dosage_Instructions, Status, Request_Timestamp)
                    VALUES (:adid, :cid, :tsid, :qty, :dosage, 'Requested', NOW())";
            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ':adid' => $admissionDoctorId,
                ':cid' => $catalogId,
                ':tsid' => $targetStationId,
                ':qty' => $quantity,
                ':dosage' => !empty($dosage) ? $dosage : null
            ]);
            $newRequestId = $conn->lastInsertId();

            if ($admData) {
                $docName = $admData['Doctor_Name'];
                $patName = $admData['Patient_Name'];
                $location = "{$admData['Room_Name']} - {$admData['Bed_Code']}";
                $notifTitle = "New Order: {$catItem['Item_Name']}";
                $notifMsg = "$docName requested $quantity x {$catItem['Item_Name']} for $patName ($location)." . (!empty($dosage) ? " Note: $dosage" : "");

                $notifSql = "INSERT INTO Clinical_Notification (Admission_ID, Request_ID, Sender_User_ID, Target_Station_ID, Title, Message, Notification_Type, Is_Read, Created_At)
                             VALUES (:aid, :rid, :suid, :tsid, :title, :msg, 'Order_Requested', 0, NOW())";
                $notifStmt = $conn->prepare($notifSql);
                $notifStmt->execute([
                    ':aid' => $admData['Admission_ID'],
                    ':rid' => $newRequestId,
                    ':suid' => $senderUserId > 0 ? $senderUserId : null,
                    ':tsid' => $targetStationId,
                    ':title' => $notifTitle,
                    ':msg' => $notifMsg
                ]);
            }

            return json_encode([
                'success' => true,
                'message' => 'Doctor order created successfully and routed to department queue.',
                'request_id' => $newRequestId
            ]);
        } catch (Exception $e) {
            return json_encode(['error' => 'Failed to create order: ' . $e->getMessage()]);
        }
    }

    function prepareOrder($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $requestId = intval($json['request_id'] ?? 0);
        $userId = intval($json['user_id'] ?? 0);

        if (empty($requestId)) {
            return json_encode(['error' => 'Request ID is required.']);
        }

        try {
            $orderSql = "SELECT dor.Request_ID, dor.Admission_Doctor_ID, dor.Catalog_ID, dor.Quantity, dor.Status,
                                ad.Admission_ID, c.Item_Name, c.Category_Type,
                                COALESCE(s.Station_Name, 'Fulfilling Department') AS Station_Name,
                                CONCAT(p.First_Name, ' ', p.Last_Name) AS Patient_Name,
                                COALESCE(r.Room_Name, 'Ward') AS Room_Name,
                                COALESCE(rb.Bed_Code, 'Bed') AS Bed_Code
                         FROM Doctor_Order_Request dor
                         INNER JOIN Admission_Doctor ad ON dor.Admission_Doctor_ID = ad.Admission_Doctor_ID
                         INNER JOIN Admission a ON ad.Admission_ID = a.Admission_ID
                         INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                         INNER JOIN Charge_Catalogs c ON dor.Catalog_ID = c.Catalog_ID
                         LEFT JOIN Enum_Department_Station s ON dor.Target_Station_ID = s.Station_ID
                         LEFT JOIN Room_Transfer_Log rtl ON a.Admission_ID = rtl.Admission_ID AND rtl.Date_Out IS NULL
                         LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                         LEFT JOIN Room r ON rb.Room_ID = r.Room_ID
                         WHERE dor.Request_ID = :rid";
            $orderStmt = $conn->prepare($orderSql);
            $orderStmt->execute([':rid' => $requestId]);
            $order = $orderStmt->fetch(PDO::FETCH_ASSOC);

            if (!$order) {
                return json_encode(['error' => 'Order not found.']);
            }

            if ($order['Status'] === 'Administered') {
                return json_encode(['error' => 'Order has already been administered.']);
            }

            $updateStmt = $conn->prepare("UPDATE Doctor_Order_Request 
                                          SET Status = 'Prepared', 
                                              Prepared_Timestamp = NOW(), 
                                              Prepared_By_User_ID = :puid 
                                          WHERE Request_ID = :rid");
            $updateStmt->execute([
                ':puid' => $userId > 0 ? $userId : null,
                ':rid' => $requestId
            ]);

            $notifTitle = "Order Prepared: {$order['Item_Name']}";
            $location = "{$order['Room_Name']} - {$order['Bed_Code']}";
            $notifMsg = "{$order['Station_Name']} has prepared {$order['Quantity']}x {$order['Item_Name']} for patient {$order['Patient_Name']} ($location). Ready for nurse collection and administration.";

            $notifSql = "INSERT INTO Clinical_Notification (Admission_ID, Request_ID, Sender_User_ID, Target_Station_ID, Title, Message, Notification_Type, Is_Read, Created_At)
                         VALUES (:aid, :rid, :suid, 5, :title, :msg, 'Order_Prepared', 0, NOW())";
            $notifStmt = $conn->prepare($notifSql);
            $notifStmt->execute([
                ':aid' => $order['Admission_ID'],
                ':rid' => $requestId,
                ':suid' => $userId > 0 ? $userId : null,
                ':title' => $notifTitle,
                ':msg' => $notifMsg
            ]);

            return json_encode([
                'success' => true,
                'message' => "Order marked as Prepared. Nurse Station has been notified for collection and delivery."
            ]);
        } catch (Exception $e) {
            return json_encode(['error' => 'Failed to prepare order: ' . $e->getMessage()]);
        }
    }

    function administerOrder($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $requestId = intval($json['request_id'] ?? 0);
        $userId = intval($json['user_id'] ?? 0);
        $doctorId = intval($json['doctor_id'] ?? 0);
        if (empty($userId)) {
            $userId = null;
        }
        if (empty($doctorId)) {
            $doctorId = null;
        }

        if (empty($requestId)) {
            return json_encode(['error' => 'Request ID is required.']);
        }
        if (empty($userId) && empty($doctorId)) {
            return json_encode(['error' => 'Delivering healthcare personnel (Nurse or Doctor) is required.']);
        }

        try {
            $conn->beginTransaction();

            $orderSql = "SELECT 
                            dor.Request_ID,
                            dor.Admission_Doctor_ID,
                            dor.Catalog_ID,
                            dor.Quantity,
                            dor.Status,
                            dor.Target_Station_ID,
                            ad.Admission_ID,
                            ad.Doctor_ID,
                            d.User_ID AS Doctor_User_ID,
                            CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                            c.Item_Name,
                            c.Category_Type,
                            c.Unit_Price,
                            c.Station_ID AS Catalog_Station_ID,
                            CONCAT(p.First_Name, ' ', p.Last_Name) AS Patient_Name
                         FROM Doctor_Order_Request dor
                         INNER JOIN Admission_Doctor ad ON dor.Admission_Doctor_ID = ad.Admission_Doctor_ID
                         INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                         INNER JOIN Admission a ON ad.Admission_ID = a.Admission_ID
                         INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                         INNER JOIN Charge_Catalogs c ON dor.Catalog_ID = c.Catalog_ID
                         WHERE dor.Request_ID = :rid";

            $orderStmt = $conn->prepare($orderSql);
            $orderStmt->execute([':rid' => $requestId]);
            $order = $orderStmt->fetch(PDO::FETCH_ASSOC);

            if (!$order) {
                $conn->rollBack();
                return json_encode(['error' => 'Doctor order not found.']);
            }

            if ($order['Status'] === 'Administered') {
                $conn->rollBack();
                return json_encode(['error' => "This order has already been administered."]);
            }

            $administerStmt = $conn->prepare("UPDATE Doctor_Order_Request 
                                              SET Status = 'Administered', 
                                                  Administered_Timestamp = NOW(), 
                                                  Administered_By_User_ID = :uid,
                                                  Administered_By_Doctor_ID = :did 
                                              WHERE Request_ID = :rid");
            $administerStmt->execute([
                ':rid' => $requestId, 
                ':uid' => $userId,
                ':did' => $doctorId
            ]);

            $stationId = !empty($order['Target_Station_ID']) ? intval($order['Target_Station_ID']) : intval($order['Catalog_Station_ID'] ?? 5);
            if ($stationId <= 0) {
                $stationId = 5;
            }

            $qty = floatval($order['Quantity']);
            $unitPrice = floatval($order['Unit_Price']);
            $totalCharge = $qty * $unitPrice;

            $ledgerSql = "INSERT INTO Billing_Ledger 
                            (Admission_ID, Station_ID, Request_ID, Catalog_ID, Quantity, Unit_Price, Total_Charge, Transaction_Type, Timestamp)
                          VALUES 
                            (:aid, :sid, :rid, :cid, :qty, :uprice, :tot, 'Charge', NOW())";
            $ledgerStmt = $conn->prepare($ledgerSql);
            $ledgerStmt->execute([
                ':aid' => $order['Admission_ID'],
                ':sid' => $stationId,
                ':rid' => $requestId,
                ':cid' => $order['Catalog_ID'],
                ':qty' => $qty,
                ':uprice' => $unitPrice,
                ':tot' => $totalCharge
            ]);

            $adminName = "Healthcare Staff";
            if (!empty($userId)) {
                $uStmt = $conn->prepare("SELECT CONCAT(First_Name, ' ', Last_Name) AS Full_Name FROM System_User WHERE User_ID = :uid");
                $uStmt->execute([':uid' => $userId]);
                $uRow = $uStmt->fetch(PDO::FETCH_ASSOC);
                if ($uRow) $adminName = "Nurse " . $uRow['Full_Name'];
            } else if (!empty($doctorId)) {
                $dStmt = $conn->prepare("SELECT CONCAT('Dr. ', First_Name, ' ', Last_Name) AS Full_Name FROM Doctor WHERE Doctor_ID = :did");
                $dStmt->execute([':did' => $doctorId]);
                $dRow = $dStmt->fetch(PDO::FETCH_ASSOC);
                if ($dRow) $adminName = $dRow['Full_Name'];
            }

            $notifTitle = "Order Administered: {$order['Item_Name']}";
            $notifMsg = "{$order['Quantity']}x {$order['Item_Name']} has been administered to {$order['Patient_Name']} by $adminName. Charge of ₱" . number_format($totalCharge, 2) . " posted to billing ledger.";

            if (!empty($order['Doctor_User_ID'])) {
                $notifSqlDoc = "INSERT INTO Clinical_Notification (Admission_ID, Request_ID, Sender_User_ID, Target_User_ID, Title, Message, Notification_Type, Is_Read, Created_At)
                                VALUES (:aid, :rid, :suid, :tuid, :title, :msg, 'Order_Administered', 0, NOW())";
                $notifDocStmt = $conn->prepare($notifSqlDoc);
                $notifDocStmt->execute([
                    ':aid' => $order['Admission_ID'],
                    ':rid' => $requestId,
                    ':suid' => $userId,
                    ':tuid' => $order['Doctor_User_ID'],
                    ':title' => $notifTitle,
                    ':msg' => $notifMsg
                ]);
            }

            $notifSqlDept = "INSERT INTO Clinical_Notification (Admission_ID, Request_ID, Sender_User_ID, Target_Station_ID, Title, Message, Notification_Type, Is_Read, Created_At)
                             VALUES (:aid, :rid, :suid, :tsid, :title, :msg, 'Order_Administered', 0, NOW())";
            $notifDeptStmt = $conn->prepare($notifSqlDept);
            $notifDeptStmt->execute([
                ':aid' => $order['Admission_ID'],
                ':rid' => $requestId,
                ':suid' => $userId,
                ':tsid' => $stationId,
                ':title' => $notifTitle,
                ':msg' => $notifMsg
            ]);

            $conn->commit();
            return json_encode([
                'success' => true,
                'message' => "Order administered successfully! Charge of ₱" . number_format($totalCharge, 2) . " automatically posted to Billing Ledger."
            ]);

        } catch (Exception $e) {
            $conn->rollBack();
            return json_encode(['error' => 'Administer failed: ' . $e->getMessage()]);
        }
    }

    function cancelOrder($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $requestId = intval($json['request_id'] ?? 0);

        if (empty($requestId)) {
            return json_encode(['error' => 'Request ID is required.']);
        }

        try {
            $checkStmt = $conn->prepare("SELECT Status FROM Doctor_Order_Request WHERE Request_ID = :rid");
            $checkStmt->execute([':rid' => $requestId]);
            $order = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$order) {
                return json_encode(['error' => 'Order not found.']);
            }

            if ($order['Status'] === 'Administered') {
                return json_encode(['error' => "Cannot cancel an order that has already been administered."]);
            }

            $stmt = $conn->prepare("UPDATE Doctor_Order_Request SET Status = 'Cancelled' WHERE Request_ID = :rid");
            $stmt->execute([':rid' => $requestId]);

            return json_encode([
                'success' => true,
                'message' => 'Doctor order has been cancelled.'
            ]);
        } catch (Exception $e) {
            return json_encode(['error' => 'Failed to cancel order: ' . $e->getMessage()]);
        }
    }

    function logDoctorRound($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionDoctorId = intval($json['admission_doctor_id'] ?? 0);
        $customFee = isset($json['charged_fee']) && $json['charged_fee'] !== '' ? floatval($json['charged_fee']) : null;

        if (empty($admissionDoctorId)) {
            return json_encode(['error' => 'Assigned Doctor is required.']);
        }

        try {
            $conn->beginTransaction();

            $docSql = "SELECT 
                        ad.Admission_ID,
                        ad.Doctor_ID,
                        d.First_Name,
                        d.Last_Name,
                        d.Base_Round_Fee,
                        COALESCE(d.Station_ID, 5) AS Station_ID
                       FROM Admission_Doctor ad
                       INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                       WHERE ad.Admission_Doctor_ID = :adid";
            $docStmt = $conn->prepare($docSql);
            $docStmt->execute([':adid' => $admissionDoctorId]);
            $docInfo = $docStmt->fetch(PDO::FETCH_ASSOC);

            if (!$docInfo) {
                $conn->rollBack();
                return json_encode(['error' => 'Assigned doctor record not found.']);
            }

            $fee = $customFee !== null ? $customFee : floatval($docInfo['Base_Round_Fee']);

            $roundStmt = $conn->prepare("INSERT INTO Doctor_Round_Log (Admission_Doctor_ID, Round_Timestamp, Charged_Fee)
                                        VALUES (:adid, NOW(), :fee)");
            $roundStmt->execute([
                ':adid' => $admissionDoctorId,
                ':fee' => $fee
            ]);
            $roundId = $conn->lastInsertId();

            $ledgerSql = "INSERT INTO Billing_Ledger 
                            (Admission_ID, Station_ID, Round_ID, Quantity, Unit_Price, Total_Charge, Transaction_Type, Timestamp)
                          VALUES 
                            (:aid, :sid, :rid, 1.00, :uprice, :tot, 'Charge', NOW())";
            $ledgerStmt = $conn->prepare($ledgerSql);
            $ledgerStmt->execute([
                ':aid' => $docInfo['Admission_ID'],
                ':sid' => $docInfo['Station_ID'],
                ':rid' => $roundId,
                ':uprice' => $fee,
                ':tot' => $fee
            ]);

            $conn->commit();
            return json_encode([
                'success' => true,
                'message' => "Doctor bedside visit logged! Professional fee of ₱" . number_format($fee, 2) . " automatically posted to Billing Ledger."
            ]);

        } catch (Exception $e) {
            $conn->rollBack();
            return json_encode(['error' => 'Failed to log round: ' . $e->getMessage()]);
        }
    }

    function markNotificationRead($json = '{}')
    {
        include "connection.php";
        $json = is_array($json) ? $json : json_decode($json, true);
        $notifId = intval($json['notification_id'] ?? 0);
        $userId = intval($json['user_id'] ?? 0);
        $markAll = !empty($json['mark_all']);

        if ($markAll && $userId > 0) {
            $stmt = $conn->prepare("UPDATE Clinical_Notification SET Is_Read = 1 WHERE Target_User_ID = :uid OR Target_Station_ID = (SELECT Station_ID FROM Doctor WHERE User_ID = :uid2)");
            $stmt->execute([':uid' => $userId, ':uid2' => $userId]);
            return json_encode(['success' => true, 'message' => 'All notifications marked as read.']);
        }

        if ($notifId > 0) {
            $stmt = $conn->prepare("UPDATE Clinical_Notification SET Is_Read = 1 WHERE Notification_ID = :nid");
            $stmt->execute([':nid' => $notifId]);
            return json_encode(['success' => true, 'message' => 'Notification marked as read.']);
        }

        return json_encode(['error' => 'Invalid notification ID.']);
    }
}

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "{}";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "{}";
}

$clinical = new ClinicalOrderManager();
switch ($operation) {
    case 'createDoctorOrder':
        echo $clinical->createDoctorOrder($json);
        break;
    case 'prepareOrder':
        echo $clinical->prepareOrder($json);
        break;
    case 'administerOrder':
        echo $clinical->administerOrder($json);
        break;
    case 'cancelOrder':
        echo $clinical->cancelOrder($json);
        break;
    case 'logDoctorRound':
        echo $clinical->logDoctorRound($json);
        break;
    case 'markNotificationRead':
        echo $clinical->markNotificationRead($json);
        break;
}
?>