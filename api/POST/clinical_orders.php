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

            $admStmt = $conn->prepare("SELECT ad.Admission_ID, ad.Doctor_ID, d.User_ID AS Doctor_User_ID,
                                              CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
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

            if ($senderUserId > 0 && $admData) {
                $checkDoc = $conn->prepare("SELECT Doctor_ID FROM Doctor WHERE User_ID = :uid AND Is_Active = 1");
                $checkDoc->execute([':uid' => $senderUserId]);
                $callerDocId = $checkDoc->fetchColumn();
                if ($callerDocId && intval($callerDocId) !== intval($admData['Doctor_ID'])) {
                    return json_encode(['error' => 'Unauthorized: You are not assigned as an attending physician for this patient. Only assigned doctors can order items.']);
                }
            }

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
                $isScan = ($catItem['Category_Type'] === 'Equipment Scan' || $catItem['Category_Type'] === 'Service');

                if ($isScan) {
                    $notifTitle = "New Scan Request: {$catItem['Item_Name']}";
                    $notifMsg = "$docName requested {$catItem['Item_Name']} scan for $patName ($location). Please prepare scan room and equipment.";
                } else {
                    $notifTitle = "New Order: {$catItem['Item_Name']}";
                    $notifMsg = "$docName requested $quantity x {$catItem['Item_Name']} for $patName ($location)." . (!empty($dosage) ? " Note: $dosage" : "");
                }

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

    function startPreparingOrder($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $requestId = intval($json['request_id'] ?? 0);
        $userId = intval($json['user_id'] ?? 0);

        if (empty($requestId)) {
            return json_encode(['error' => 'Request ID is required.']);
        }

        try {
            $orderSql = "SELECT dor.Request_ID, dor.Admission_Doctor_ID, dor.Catalog_ID, dor.Quantity, dor.Status, dor.Target_Station_ID,
                                ad.Admission_ID, ad.Doctor_ID, d.User_ID AS Doctor_User_ID,
                                CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                                c.Item_Name, c.Category_Type,
                                COALESCE(s.Station_Name, 'Department') AS Station_Name,
                                CONCAT(p.First_Name, ' ', p.Last_Name) AS Patient_Name,
                                COALESCE(r.Room_Name, 'Ward') AS Room_Name,
                                COALESCE(rb.Bed_Code, 'Bed') AS Bed_Code
                         FROM Doctor_Order_Request dor
                         INNER JOIN Admission_Doctor ad ON dor.Admission_Doctor_ID = ad.Admission_Doctor_ID
                         INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
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

            $userStationIds = [];
            $isHigherUp = false;
            if ($userId > 0) {
                $uRoleStmt = $conn->prepare("SELECT u.Role_ID, u.Station_ID, r.Is_Higher_Up FROM System_User u INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID WHERE u.User_ID = :uid");
                $uRoleStmt->execute([':uid' => $userId]);
                $uRole = $uRoleStmt->fetch(PDO::FETCH_ASSOC);
                if ($uRole) {
                    $isHigherUp = (intval($uRole['Is_Higher_Up']) === 1 || intval($uRole['Role_ID']) === 1);
                    if (!empty($uRole['Station_ID'])) $userStationIds[] = intval($uRole['Station_ID']);
                }
                $udsStmt = $conn->prepare("SELECT Station_ID FROM User_Department_Station WHERE User_ID = :uid");
                $udsStmt->execute([':uid' => $userId]);
                while ($sid = $udsStmt->fetchColumn()) {
                    $userStationIds[] = intval($sid);
                }
                $userStationIds = array_values(array_unique(array_filter($userStationIds)));
            }

            $orderTargetStation = intval($order['Target_Station_ID'] ?? 0);
            if (!$isHigherUp && !empty($userStationIds) && $orderTargetStation > 0 && !in_array($orderTargetStation, $userStationIds)) {
                return json_encode(['error' => 'Unauthorized: This order is routed to ' . $order['Station_Name'] . '. Your department does not have permission to fulfill it.']);
            }

            $updateStmt = $conn->prepare("UPDATE Doctor_Order_Request 
                                          SET Status = 'Preparing', 
                                              Preparing_Timestamp = NOW(), 
                                              Prepared_By_User_ID = :puid 
                                          WHERE Request_ID = :rid");
            $updateStmt->execute([
                ':puid' => $userId > 0 ? $userId : null,
                ':rid' => $requestId
            ]);

            $isScan = ($order['Category_Type'] === 'Equipment Scan' || $order['Category_Type'] === 'Service');
            $location = "{$order['Room_Name']} - {$order['Bed_Code']}";

            if ($isScan) {
                $notifTitle = "Scan Equipment Preparing: {$order['Item_Name']}";
                $notifMsg = "{$order['Station_Name']} is currently preparing the imaging equipment for {$order['Patient_Name']}'s {$order['Item_Name']} ($location) requested by you.";
            } else {
                $notifTitle = "Order Preparing: {$order['Item_Name']}";
                $notifMsg = "Your requested {$order['Item_Name']} for patient {$order['Patient_Name']} ($location) is currently being prepared in {$order['Station_Name']}.";
            }

            $targetDoctorUserId = !empty($order['Doctor_User_ID']) ? intval($order['Doctor_User_ID']) : null;
            if ($targetDoctorUserId) {
                $notifSql = "INSERT INTO Clinical_Notification (Admission_ID, Request_ID, Sender_User_ID, Target_User_ID, Title, Message, Notification_Type, Is_Read, Created_At)
                             VALUES (:aid, :rid, :suid, :tuid, :title, :msg, 'Order_Preparing', 0, NOW())";
                $notifStmt = $conn->prepare($notifSql);
                $notifStmt->execute([
                    ':aid' => $order['Admission_ID'],
                    ':rid' => $requestId,
                    ':suid' => $userId > 0 ? $userId : null,
                    ':tuid' => $targetDoctorUserId,
                    ':title' => $notifTitle,
                    ':msg' => $notifMsg
                ]);
            }

            return json_encode([
                'success' => true,
                'message' => "Order status updated to Preparing. Prescribing physician has been alerted."
            ]);
        } catch (Exception $e) {
            return json_encode(['error' => 'Failed to start preparing order: ' . $e->getMessage()]);
        }
    }

    function markOrderPrepared($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $requestId = intval($json['request_id'] ?? 0);
        $userId = intval($json['user_id'] ?? 0);
        $nurseUserId = intval($json['nurse_user_id'] ?? ($json['assigned_nurse_user_id'] ?? 0));

        if (empty($requestId)) {
            return json_encode(['error' => 'Request ID is required.']);
        }
        if (empty($nurseUserId)) {
            return json_encode(['error' => 'Please select an active nurse to dispatch and alert.']);
        }

        try {
            $orderSql = "SELECT dor.Request_ID, dor.Admission_Doctor_ID, dor.Catalog_ID, dor.Quantity, dor.Status, dor.Target_Station_ID,
                                ad.Admission_ID, ad.Doctor_ID, d.User_ID AS Doctor_User_ID,
                                c.Item_Name, c.Category_Type,
                                COALESCE(s.Station_Name, 'Department') AS Station_Name,
                                CONCAT(p.First_Name, ' ', p.Last_Name) AS Patient_Name,
                                COALESCE(r.Room_Name, 'Ward') AS Room_Name,
                                COALESCE(rb.Bed_Code, 'Bed') AS Bed_Code
                         FROM Doctor_Order_Request dor
                         INNER JOIN Admission_Doctor ad ON dor.Admission_Doctor_ID = ad.Admission_Doctor_ID
                         INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
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

            $userStationIds = [];
            $isHigherUp = false;
            if ($userId > 0) {
                $uRoleStmt = $conn->prepare("SELECT u.Role_ID, u.Station_ID, r.Is_Higher_Up FROM System_User u INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID WHERE u.User_ID = :uid");
                $uRoleStmt->execute([':uid' => $userId]);
                $uRole = $uRoleStmt->fetch(PDO::FETCH_ASSOC);
                if ($uRole) {
                    $isHigherUp = (intval($uRole['Is_Higher_Up']) === 1 || intval($uRole['Role_ID']) === 1);
                    if (!empty($uRole['Station_ID'])) $userStationIds[] = intval($uRole['Station_ID']);
                }
                $udsStmt = $conn->prepare("SELECT Station_ID FROM User_Department_Station WHERE User_ID = :uid");
                $udsStmt->execute([':uid' => $userId]);
                while ($sid = $udsStmt->fetchColumn()) {
                    $userStationIds[] = intval($sid);
                }
                $userStationIds = array_values(array_unique(array_filter($userStationIds)));
            }

            $orderTargetStation = intval($order['Target_Station_ID'] ?? 0);
            if (!$isHigherUp && !empty($userStationIds) && $orderTargetStation > 0 && !in_array($orderTargetStation, $userStationIds)) {
                return json_encode(['error' => 'Unauthorized: This order is routed to ' . $order['Station_Name'] . '. Your department does not have permission to fulfill it.']);
            }

            $updateStmt = $conn->prepare("UPDATE Doctor_Order_Request 
                                          SET Status = 'Prepared', 
                                              Prepared_Timestamp = NOW(), 
                                              Prepared_By_User_ID = :puid,
                                              Assigned_Nurse_User_ID = :nuid
                                          WHERE Request_ID = :rid");
            $updateStmt->execute([
                ':puid' => $userId > 0 ? $userId : null,
                ':nuid' => $nurseUserId,
                ':rid' => $requestId
            ]);

            $isScan = ($order['Category_Type'] === 'Equipment Scan' || $order['Category_Type'] === 'Service');
            $location = "{$order['Room_Name']} - {$order['Bed_Code']}";

            if ($isScan) {
                $notifTitle = "Equipment Ready — Escort Patient: {$order['Item_Name']}";
                $notifMsg = "The equipment at {$order['Station_Name']} is prepared and ready for {$order['Patient_Name']} ($location). Please escort patient to {$order['Station_Name']} for their {$order['Item_Name']}.";
            } else {
                $notifTitle = "Order Ready for Pickup: {$order['Item_Name']}";
                $notifMsg = "{$order['Item_Name']} has been prepared by {$order['Station_Name']} for patient {$order['Patient_Name']} ($location). Please pick up the item at {$order['Station_Name']} for delivery.";
            }

            $notifSql = "INSERT INTO Clinical_Notification (Admission_ID, Request_ID, Sender_User_ID, Target_User_ID, Title, Message, Notification_Type, Is_Read, Created_At)
                         VALUES (:aid, :rid, :suid, :tuid, :title, :msg, 'Order_Prepared', 0, NOW())";
            $notifStmt = $conn->prepare($notifSql);
            $notifStmt->execute([
                ':aid' => $order['Admission_ID'],
                ':rid' => $requestId,
                ':suid' => $userId > 0 ? $userId : null,
                ':tuid' => $nurseUserId,
                ':title' => $notifTitle,
                ':msg' => $notifMsg
            ]);

            $nurseNameStmt = $conn->prepare("SELECT CONCAT(First_Name, ' ', Last_Name) FROM System_User WHERE User_ID = :uid");
            $nurseNameStmt->execute([':uid' => $nurseUserId]);
            $nurseName = $nurseNameStmt->fetchColumn() ?: "Nurse";

            return json_encode([
                'success' => true,
                'message' => "Order marked as Prepared. {$nurseName} has been alerted for pickup/transport."
            ]);
        } catch (Exception $e) {
            return json_encode(['error' => 'Failed to mark order prepared: ' . $e->getMessage()]);
        }
    }

    function prepareOrder($json = '{}')
    {
        return $this->markOrderPrepared($json);
    }

    function reassignOrderNurse($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $requestId = intval($json['request_id'] ?? 0);
        $userId = intval($json['user_id'] ?? 0);
        $newNurseUserId = intval($json['new_nurse_user_id'] ?? ($json['nurse_user_id'] ?? 0));

        if (empty($requestId)) {
            return json_encode(['error' => 'Request ID is required.']);
        }
        if (empty($newNurseUserId)) {
            return json_encode(['error' => 'Please select an on-duty nurse to assign.']);
        }

        try {
            $orderSql = "SELECT dor.Request_ID, dor.Admission_Doctor_ID, dor.Catalog_ID, dor.Quantity, dor.Status, dor.Target_Station_ID,
                                dor.Assigned_Nurse_User_ID, dor.Prepared_By_User_ID,
                                ad.Admission_ID, ad.Doctor_ID, d.User_ID AS Doctor_User_ID,
                                c.Item_Name, c.Category_Type,
                                COALESCE(s.Station_Name, 'Department') AS Station_Name,
                                CONCAT(p.First_Name, ' ', p.Last_Name) AS Patient_Name,
                                COALESCE(r.Room_Name, 'Ward') AS Room_Name,
                                COALESCE(rb.Bed_Code, 'Bed') AS Bed_Code
                         FROM Doctor_Order_Request dor
                         INNER JOIN Admission_Doctor ad ON dor.Admission_Doctor_ID = ad.Admission_Doctor_ID
                         INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
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
            if ($order['Status'] === 'Cancelled') {
                return json_encode(['error' => 'Order is cancelled.']);
            }

            $nurseStmt = $conn->prepare("SELECT CONCAT(First_Name, ' ', Last_Name) AS Full_Name FROM System_User WHERE User_ID = :uid AND Is_Active = 1");
            $nurseStmt->execute([':uid' => $newNurseUserId]);
            $newNurseName = $nurseStmt->fetchColumn();
            if (!$newNurseName) {
                return json_encode(['error' => 'Selected replacement nurse not found or inactive.']);
            }

            $oldNurseUserId = intval($order['Assigned_Nurse_User_ID'] ?? 0);
            if ($oldNurseUserId === $newNurseUserId) {
                return json_encode(['error' => 'Selected nurse is already assigned to this order.']);
            }

            $upStmt = $conn->prepare("UPDATE Doctor_Order_Request SET Assigned_Nurse_User_ID = :nuid WHERE Request_ID = :rid");
            $upStmt->execute([':nuid' => $newNurseUserId, ':rid' => $requestId]);

            $isScan = ($order['Category_Type'] === 'Equipment Scan' || $order['Category_Type'] === 'Service');
            $location = "{$order['Room_Name']} - {$order['Bed_Code']}";

            if ($isScan) {
                $notifTitle = "Escort Reassigned: {$order['Item_Name']}";
                $notifMsg = "You have been assigned to escort {$order['Patient_Name']} ($location) to {$order['Station_Name']} for {$order['Item_Name']}.";
            } else {
                $notifTitle = "Delivery Reassigned: {$order['Item_Name']}";
                $notifMsg = "You have been assigned to pick up {$order['Item_Name']} at {$order['Station_Name']} and deliver to {$order['Patient_Name']} ($location).";
            }
            $notifSql = "INSERT INTO Clinical_Notification (Admission_ID, Request_ID, Sender_User_ID, Target_User_ID, Title, Message, Notification_Type, Is_Read, Created_At)
                         VALUES (:aid, :rid, :suid, :tuid, :title, :msg, 'Order_Prepared', 0, NOW())";
            $notifStmt = $conn->prepare($notifSql);
            $notifStmt->execute([
                ':aid' => $order['Admission_ID'],
                ':rid' => $requestId,
                ':suid' => $userId > 0 ? $userId : null,
                ':tuid' => $newNurseUserId,
                ':title' => $notifTitle,
                ':msg' => $notifMsg
            ]);

            return json_encode([
                'success' => true,
                'message' => "Order delivery reassigned to Nurse {$newNurseName}. They have been alerted for pickup."
            ]);
        } catch (Exception $e) {
            return json_encode(['error' => 'Failed to reassign nurse: ' . $e->getMessage()]);
        }
    }

    function receiveOrderForDelivery($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $requestId = intval($json['request_id'] ?? 0);
        $userId = intval($json['user_id'] ?? 0);

        if (empty($requestId)) {
            return json_encode(['error' => 'Request ID is required.']);
        }
        if (empty($userId)) {
            return json_encode(['error' => 'Receiving nurse user ID is required.']);
        }

        try {
            $orderSql = "SELECT dor.Request_ID, dor.Admission_Doctor_ID, dor.Catalog_ID, dor.Quantity, dor.Status, dor.Target_Station_ID, dor.Assigned_Nurse_User_ID,
                                ad.Admission_ID, ad.Doctor_ID, d.User_ID AS Doctor_User_ID,
                                c.Item_Name, c.Category_Type,
                                COALESCE(s.Station_Name, 'Department') AS Station_Name,
                                CONCAT(p.First_Name, ' ', p.Last_Name) AS Patient_Name,
                                COALESCE(r.Room_Name, 'Ward') AS Room_Name,
                                COALESCE(rb.Bed_Code, 'Bed') AS Bed_Code
                         FROM Doctor_Order_Request dor
                         INNER JOIN Admission_Doctor ad ON dor.Admission_Doctor_ID = ad.Admission_Doctor_ID
                         INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
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

            $userStationIds = [];
            $isHigherUp = false;
            $userRoleName = '';
            $accessDomain = '';
            if ($userId > 0) {
                $uRoleStmt = $conn->prepare("SELECT u.Role_ID, u.Station_ID, r.Role_Name, r.Access_Domain, r.Is_Higher_Up FROM System_User u INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID WHERE u.User_ID = :uid");
                $uRoleStmt->execute([':uid' => $userId]);
                $uRole = $uRoleStmt->fetch(PDO::FETCH_ASSOC);
                if ($uRole) {
                    $isHigherUp = (intval($uRole['Is_Higher_Up']) === 1 || intval($uRole['Role_ID']) === 1);
                    $userRoleName = strtolower($uRole['Role_Name'] ?? '');
                    $accessDomain = strtolower($uRole['Access_Domain'] ?? '');
                    if (!empty($uRole['Station_ID'])) $userStationIds[] = intval($uRole['Station_ID']);
                }
                $udsStmt = $conn->prepare("SELECT Station_ID FROM User_Department_Station WHERE User_ID = :uid");
                $udsStmt->execute([':uid' => $userId]);
                while ($sid = $udsStmt->fetchColumn()) {
                    $userStationIds[] = intval($sid);
                }
                $userStationIds = array_values(array_unique(array_filter($userStationIds)));
            }

            $orderTargetStation = intval($order['Target_Station_ID'] ?? 0);
            $assignedNurseId = intval($order['Assigned_Nurse_User_ID'] ?? 0);
            if ($assignedNurseId > 0 && !$isHigherUp) {
                if ($userId !== $assignedNurseId) {
                    $assignedNameStmt = $conn->prepare("SELECT CONCAT(First_Name, ' ', Last_Name) FROM System_User WHERE User_ID = :anid");
                    $assignedNameStmt->execute([':anid' => $assignedNurseId]);
                    $assignedName = $assignedNameStmt->fetchColumn() ?: 'the assigned nurse';
                    return json_encode([
                        'error' => "This order is assigned to Nurse {$assignedName} for delivery. Only the assigned nurse can pick it up. If unavailable, please switch or reassign the nurse."
                    ]);
                }
            } else if ($assignedNurseId <= 0 && !$isHigherUp) {
                $isActualNurse = (strpos($userRoleName, 'nurse') !== false || in_array(5, $userStationIds));
                if (!$isActualNurse) {
                    return json_encode([
                        'error' => 'Only an on-duty nurse can pick up orders for patient delivery. Please assign a nurse first.'
                    ]);
                }
            }

            $updateStmt = $conn->prepare("UPDATE Doctor_Order_Request 
                                          SET Status = 'Delivering', 
                                              Delivering_Timestamp = NOW(), 
                                              Assigned_Nurse_User_ID = COALESCE(Assigned_Nurse_User_ID, :nuid)
                                          WHERE Request_ID = :rid");
            $updateStmt->execute([
                ':nuid' => $userId,
                ':rid' => $requestId
            ]);

            $nurseNameStmt = $conn->prepare("SELECT CONCAT(First_Name, ' ', Last_Name) FROM System_User WHERE User_ID = :uid");
            $nurseNameStmt->execute([':uid' => $userId]);
            $nurseName = $nurseNameStmt->fetchColumn() ?: "Nurse";

            $isScan = ($order['Category_Type'] === 'Equipment Scan' || $order['Category_Type'] === 'Service');
            $location = "{$order['Room_Name']} - {$order['Bed_Code']}";

            if ($isScan) {
                $notifTitle = "Patient In Transit to Scan Suite: {$order['Item_Name']}";
                $notifMsg = "Patient {$order['Patient_Name']} ($location) was received by Nurse {$nurseName} and is now being escorted to {$order['Station_Name']} for their {$order['Item_Name']}.";
            } else {
                $notifTitle = "Order In Transit: {$order['Item_Name']}";
                $notifMsg = "Your requested {$order['Item_Name']} for {$order['Patient_Name']} ($location) was received by Nurse {$nurseName} and is now being delivered to the patient.";
            }

            $targetDoctorUserId = !empty($order['Doctor_User_ID']) ? intval($order['Doctor_User_ID']) : null;
            if ($targetDoctorUserId) {
                $notifSql = "INSERT INTO Clinical_Notification (Admission_ID, Request_ID, Sender_User_ID, Target_User_ID, Title, Message, Notification_Type, Is_Read, Created_At)
                             VALUES (:aid, :rid, :suid, :tuid, :title, :msg, 'Order_Delivering', 0, NOW())";
                $notifStmt = $conn->prepare($notifSql);
                $notifStmt->execute([
                    ':aid' => $order['Admission_ID'],
                    ':rid' => $requestId,
                    ':suid' => $userId,
                    ':tuid' => $targetDoctorUserId,
                    ':title' => $notifTitle,
                    ':msg' => $notifMsg
                ]);
            }

            return json_encode([
                'success' => true,
                'message' => $isScan ? "Patient marked as in transit to scan room. Doctor notified." : "Order marked as received and out for delivery. Doctor notified."
            ]);
        } catch (Exception $e) {
            return json_encode(['error' => 'Failed to update delivery status: ' . $e->getMessage()]);
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
                            dor.Assigned_Nurse_User_ID,
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

            $isHigherUp = false;
            if ($userId > 0) {
                $uRoleStmt = $conn->prepare("SELECT u.Role_ID, r.Is_Higher_Up FROM System_User u INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID WHERE u.User_ID = :uid");
                $uRoleStmt->execute([':uid' => $userId]);
                $uRole = $uRoleStmt->fetch(PDO::FETCH_ASSOC);
                if ($uRole) {
                    $isHigherUp = (intval($uRole['Is_Higher_Up']) === 1 || intval($uRole['Role_ID']) === 1);
                }
            }
            $assignedNurseId = intval($order['Assigned_Nurse_User_ID'] ?? 0);
            if ($assignedNurseId > 0 && empty($doctorId) && !$isHigherUp) {
                if ($userId !== $assignedNurseId) {
                    $assignedNameStmt = $conn->prepare("SELECT CONCAT(First_Name, ' ', Last_Name) FROM System_User WHERE User_ID = :anid");
                    $assignedNameStmt->execute([':anid' => $assignedNurseId]);
                    $assignedName = $assignedNameStmt->fetchColumn() ?: 'the assigned nurse';
                    $conn->rollBack();
                    return json_encode([
                        'error' => "This order is being delivered by Nurse {$assignedName}. Only the delivering nurse can complete administration, or switch nurse if unavailable."
                    ]);
                }
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

            $isScan = ($order['Category_Type'] === 'Equipment Scan' || $order['Category_Type'] === 'Service');
            if ($isScan) {
                $notifTitle = "Scan Completed & Recorded: {$order['Item_Name']}";
                $notifMsg = "{$order['Item_Name']} scan for {$order['Patient_Name']} has been conducted and completed by $adminName. Charge of ₱" . number_format($totalCharge, 2) . " posted to Billing Ledger.";
            } else {
                $notifTitle = "Order Administered: {$order['Item_Name']}";
                $notifMsg = "{$order['Quantity']}x {$order['Item_Name']} has been administered to {$order['Patient_Name']} by $adminName. Charge of ₱" . number_format($totalCharge, 2) . " posted to Billing Ledger.";
            }

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

$clinical = new ClinicalOrderManager();
$wsOut = "";
switch ($operation) {
    case 'createDoctorOrder':
        $wsOut = $clinical->createDoctorOrder($json);
        break;
    case 'startPreparingOrder':
        $wsOut = $clinical->startPreparingOrder($json);
        break;
    case 'markOrderPrepared':
        $wsOut = $clinical->markOrderPrepared($json);
        break;
    case 'prepareOrder':
        $wsOut = $clinical->prepareOrder($json);
        break;
    case 'reassignOrderNurse':
        $wsOut = $clinical->reassignOrderNurse($json);
        break;
    case 'receiveOrderForDelivery':
        $wsOut = $clinical->receiveOrderForDelivery($json);
        break;
    case 'administerOrder':
        $wsOut = $clinical->administerOrder($json);
        break;
    case 'cancelOrder':
        $wsOut = $clinical->cancelOrder($json);
        break;
    case 'logDoctorRound':
        $wsOut = $clinical->logDoctorRound($json);
        break;
    case 'markNotificationRead':
        $wsOut = $clinical->markNotificationRead($json);
        break;
}

if ($wsOut !== "") {
    echo $wsOut;
    $wsRes = json_decode($wsOut, true);
    if (is_array($wsRes) && !empty($wsRes['success']) && $operation !== 'markNotificationRead') {
        $wsReq = is_array($json) ? $json : (json_decode($json, true) ?: []);
        $wsAdmId = intval($wsReq['admission_id'] ?? 0);
        $wsReqId = intval($wsReq['request_id'] ?? $wsRes['request_id'] ?? 0);
        if ($wsAdmId === 0 && $wsReqId > 0) {
            include "connection.php";
            if (isset($conn)) {
                $admLookup = $conn->prepare("SELECT Admission_ID FROM Doctor_Order_Request WHERE Request_ID = :rid LIMIT 1");
                $admLookup->execute([':rid' => $wsReqId]);
                $wsAdmId = intval($admLookup->fetchColumn() ?: 0);
            }
        }
        broadcastWebSocketEvent('clinical_orders', $operation, [
            'admission_id' => $wsAdmId,
            'request_id' => $wsReqId
        ]);
    }
}
?>