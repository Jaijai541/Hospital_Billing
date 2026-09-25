<?php
/**
 * Clinical Orders & Doctor Rounds API
 * Milestone 2: Transaction & Clinical Workflow
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class ClinicalOrderManager
{
    /**
     * Read: Retrieve catalog items for ordering
     */
    function getCatalogList()
    {
        include "connection.php";

        $sql = "SELECT 
                    Catalog_ID,
                    CONCAT(Code_Prefix, '-', LPAD(Catalog_ID, 3, '0')) AS Item_Code,
                    Item_Name,
                    Category_Type,
                    Unit_Price
                FROM Charge_Catalogs
                WHERE Is_Active = 1
                ORDER BY Category_Type ASC, Item_Name ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    /**
     * Read: Retrieve all doctor orders for an admission
     */
    function getDoctorOrders($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        $sql = "SELECT 
                    dor.Request_ID,
                    dor.Admission_Doctor_ID,
                    CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                    dor.Catalog_ID,
                    c.Item_Name,
                    c.Category_Type,
                    CONCAT(c.Code_Prefix, '-', LPAD(c.Catalog_ID, 3, '0')) AS Item_Code,
                    dor.Quantity,
                    c.Unit_Price,
                    (dor.Quantity * c.Unit_Price) AS Total_Price,
                    dor.Status,
                    DATE_FORMAT(dor.Request_Timestamp, '%Y-%m-%d %h:%i %p') AS Request_Timestamp,
                    DATE_FORMAT(dor.Administered_Timestamp, '%Y-%m-%d %h:%i %p') AS Administered_Timestamp
                FROM Doctor_Order_Request dor
                INNER JOIN Admission_Doctor ad ON dor.Admission_Doctor_ID = ad.Admission_Doctor_ID
                INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                INNER JOIN Charge_Catalogs c ON dor.Catalog_ID = c.Catalog_ID
                WHERE ad.Admission_ID = :aid
                ORDER BY dor.Request_ID DESC";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':aid' => $admissionId]);
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    /**
     * Create: Doctor prescribes / places an order (Status = 'Pending')
     */
    function createDoctorOrder($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionDoctorId = intval($json['admission_doctor_id'] ?? 0);
        $catalogId = intval($json['catalog_id'] ?? 0);
        $quantity = floatval($json['quantity'] ?? 1);

        if (empty($admissionDoctorId) || empty($catalogId) || $quantity <= 0) {
            return json_encode(['error' => 'Doctor, Catalog item, and valid Quantity are required.']);
        }

        try {
            $sql = "INSERT INTO Doctor_Order_Request (Admission_Doctor_ID, Catalog_ID, Quantity, Status, Request_Timestamp)
                    VALUES (:adid, :cid, :qty, 'Pending', NOW())";
            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ':adid' => $admissionDoctorId,
                ':cid' => $catalogId,
                ':qty' => $quantity
            ]);

            return json_encode([
                'success' => true,
                'message' => 'Doctor order recorded with Status: Pending.',
                'request_id' => $conn->lastInsertId()
            ]);
        } catch (Exception $e) {
            return json_encode(['error' => 'Failed to create order: ' . $e->getMessage()]);
        }
    }

    /**
     * Update: Administer / Dispense order -> Automatically post charge to Billing_Ledger
     */
    function administerOrder($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $requestId = intval($json['request_id'] ?? 0);

        if (empty($requestId)) {
            return json_encode(['error' => 'Request ID is required.']);
        }

        try {
            $conn->beginTransaction();

            // 1. Fetch order details
            $orderSql = "SELECT 
                            dor.Request_ID,
                            dor.Admission_Doctor_ID,
                            dor.Catalog_ID,
                            dor.Quantity,
                            dor.Status,
                            ad.Admission_ID,
                            c.Item_Name,
                            c.Category_Type,
                            c.Unit_Price
                         FROM Doctor_Order_Request dor
                         INNER JOIN Admission_Doctor ad ON dor.Admission_Doctor_ID = ad.Admission_Doctor_ID
                         INNER JOIN Charge_Catalogs c ON dor.Catalog_ID = c.Catalog_ID
                         WHERE dor.Request_ID = :rid";

            $orderStmt = $conn->prepare($orderSql);
            $orderStmt->execute([':rid' => $requestId]);
            $order = $orderStmt->fetch(PDO::FETCH_ASSOC);

            if (!$order) {
                $conn->rollBack();
                return json_encode(['error' => 'Doctor order not found.']);
            }

            if ($order['Status'] !== 'Pending') {
                $conn->rollBack();
                return json_encode(['error' => "Cannot administer order with Status '{$order['Status']}'."]);
            }

            // 2. Mark order as Administered
            $administerStmt = $conn->prepare("UPDATE Doctor_Order_Request 
                                              SET Status = 'Administered', Administered_Timestamp = NOW() 
                                              WHERE Request_ID = :rid");
            $administerStmt->execute([':rid' => $requestId]);

            // 3. Determine Station_ID based on Category_Type
            // 1 = Central Pharmacy, 2 = Radiology & Imaging, 5 = Nurse Station
            $stationId = 5;
            if ($order['Category_Type'] === 'Medicine') {
                $stationId = 1;
            } elseif ($order['Category_Type'] === 'Equipment Scan') {
                $stationId = 2;
            }

            $qty = floatval($order['Quantity']);
            $unitPrice = floatval($order['Unit_Price']);
            $totalCharge = $qty * $unitPrice;

            // 4. Auto-post charge to Billing_Ledger
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

    /**
     * Update: Cancel a pending order
     */
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

            if ($order['Status'] !== 'Pending') {
                return json_encode(['error' => "Cannot cancel order with Status '{$order['Status']}'."]);
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

    /**
     * Read: Retrieve all doctor rounds logged for an admission
     */
    function getDoctorRounds($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        $sql = "SELECT 
                    drl.Round_ID,
                    drl.Admission_Doctor_ID,
                    CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                    dt.Type_Name AS Doctor_Type,
                    drl.Charged_Fee,
                    DATE_FORMAT(drl.Round_Timestamp, '%Y-%m-%d %h:%i %p') AS Round_Timestamp
                FROM Doctor_Round_Log drl
                INNER JOIN Admission_Doctor ad ON drl.Admission_Doctor_ID = ad.Admission_Doctor_ID
                INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
                WHERE ad.Admission_ID = :aid
                ORDER BY drl.Round_ID DESC";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':aid' => $admissionId]);
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    /**
     * Create: Log a doctor bedside visit -> Auto-post fee to Billing_Ledger
     */
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

            // 1. Fetch doctor details
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

            // 2. Insert into Doctor_Round_Log
            $roundStmt = $conn->prepare("INSERT INTO Doctor_Round_Log (Admission_Doctor_ID, Round_Timestamp, Charged_Fee)
                                        VALUES (:adid, NOW(), :fee)");
            $roundStmt->execute([
                ':adid' => $admissionDoctorId,
                ':fee' => $fee
            ]);
            $roundId = $conn->lastInsertId();

            // 3. Auto-post professional fee to Billing_Ledger
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
}

// Router for operation and json payload
if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "{}";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "{}";
}

$clinical = new ClinicalOrderManager();
switch ($operation) {
    case 'getCatalogList':
        echo $clinical->getCatalogList();
        break;
    case 'getDoctorOrders':
        echo $clinical->getDoctorOrders($json);
        break;
    case 'createDoctorOrder':
        echo $clinical->createDoctorOrder($json);
        break;
    case 'administerOrder':
        echo $clinical->administerOrder($json);
        break;
    case 'cancelOrder':
        echo $clinical->cancelOrder($json);
        break;
    case 'getDoctorRounds':
        echo $clinical->getDoctorRounds($json);
        break;
    case 'logDoctorRound':
        echo $clinical->logDoctorRound($json);
        break;
}
?>
