<?php
/**
 * Billing Ledger & Itemized Charges API
 * Milestone 2: Transaction & Clinical Workflow
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class LedgerManager
{
    /**
     * Read: Retrieve all itemized charges for an admission
     */
    function getAdmissionLedger($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        if (empty($admissionId)) {
            return json_encode([]);
        }

        $sql = "SELECT 
                    bl.Ledger_ID,
                    bl.Admission_ID,
                    bl.Station_ID,
                    eds.Station_Name,
                    bl.Catalog_ID,
                    bl.Request_ID,
                    bl.Round_ID,
                    bl.Transfer_ID,
                    bl.Quantity,
                    bl.Unit_Price,
                    bl.Total_Charge,
                    bl.Transaction_Type,
                    DATE_FORMAT(bl.Timestamp, '%Y-%m-%d %h:%i %p') AS Formatted_Timestamp,
                    c.Item_Name AS Catalog_Item_Name,
                    c.Category_Type AS Catalog_Category,
                    c.Code_Prefix AS Catalog_Prefix,
                    CONCAT('Dr. ', d_rnd.First_Name, ' ', d_rnd.Last_Name) AS Round_Doctor_Name,
                    dt_rnd.Type_Name AS Round_Doctor_Type,
                    CONCAT('Dr. ', d_req.First_Name, ' ', d_req.Last_Name) AS Order_Doctor_Name,
                    r.Room_Name,
                    rb.Bed_Code,
                    rt.Type_Name AS Room_Type_Name
                FROM Billing_Ledger bl
                LEFT JOIN Enum_Department_Station eds ON bl.Station_ID = eds.Station_ID
                LEFT JOIN Charge_Catalogs c ON bl.Catalog_ID = c.Catalog_ID
                LEFT JOIN Doctor_Order_Request dor ON bl.Request_ID = dor.Request_ID
                LEFT JOIN Doctor_Round_Log drl ON bl.Round_ID = drl.Round_ID
                LEFT JOIN Admission_Doctor ad_rnd ON drl.Admission_Doctor_ID = ad_rnd.Admission_Doctor_ID
                LEFT JOIN Doctor d_rnd ON ad_rnd.Doctor_ID = d_rnd.Doctor_ID
                LEFT JOIN Enum_Doctor_Type dt_rnd ON d_rnd.Doctor_Type_ID = dt_rnd.Doctor_Type_ID
                LEFT JOIN Admission_Doctor ad_req ON dor.Admission_Doctor_ID = ad_req.Admission_Doctor_ID
                LEFT JOIN Doctor d_req ON ad_req.Doctor_ID = d_req.Doctor_ID
                LEFT JOIN Room_Transfer_Log rtl ON bl.Transfer_ID = rtl.Transfer_ID
                LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                LEFT JOIN Room r ON rb.Room_ID = r.Room_ID
                LEFT JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE bl.Admission_ID = :aid
                ORDER BY bl.Ledger_ID ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':aid' => $admissionId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Format descriptions cleanly
        $ledger = [];
        foreach ($rows as $row) {
            $category = 'General';
            $description = 'Unspecified Charge';

            if (!empty($row['Transfer_ID'])) {
                $category = 'Room & Board';
                $description = "Board & Lodging: {$row['Room_Name']} (Bed: {$row['Bed_Code']}) - {$row['Room_Type_Name']}";
            } elseif (!empty($row['Round_ID'])) {
                $category = 'Doctor Professional Fee';
                $description = "Bedside Round: {$row['Round_Doctor_Name']} ({$row['Round_Doctor_Type']})";
            } elseif (!empty($row['Request_ID'])) {
                $category = $row['Catalog_Category'] ?? 'Doctor Order';
                $itemCode = "{$row['Catalog_Prefix']}-" . str_pad($row['Catalog_ID'], 3, '0', STR_PAD_LEFT);
                $description = "[{$itemCode}] {$row['Catalog_Item_Name']} (Ordered by {$row['Order_Doctor_Name']})";
            } elseif (!empty($row['Catalog_ID'])) {
                if ($row['Transaction_Type'] === 'Return') {
                    $category = 'Medicine Return';
                    $itemCode = "{$row['Catalog_Prefix']}-" . str_pad($row['Catalog_ID'], 3, '0', STR_PAD_LEFT);
                    $description = "RETURN CREDIT: [{$itemCode}] {$row['Catalog_Item_Name']}";
                } else {
                    $category = $row['Catalog_Category'] ?? 'Catalog Item';
                    $itemCode = "{$row['Catalog_Prefix']}-" . str_pad($row['Catalog_ID'], 3, '0', STR_PAD_LEFT);
                    $description = "[{$itemCode}] {$row['Catalog_Item_Name']}";
                }
            }

            $ledger[] = [
                'Ledger_ID' => $row['Ledger_ID'],
                'Station_Name' => $row['Station_Name'] ?? 'General',
                'Category' => $category,
                'Description' => $description,
                'Quantity' => floatval($row['Quantity']),
                'Unit_Price' => floatval($row['Unit_Price']),
                'Total_Charge' => floatval($row['Total_Charge']),
                'Transaction_Type' => $row['Transaction_Type'],
                'Timestamp' => $row['Formatted_Timestamp']
            ];
        }

        return json_encode($ledger);
    }

    /**
     * Read: Retrieve category breakdown and Net Grand Total
     */
    function getLedgerSummary($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        if (empty($admissionId)) {
            return json_encode([
                'room_total' => 0,
                'doctor_total' => 0,
                'medicine_total' => 0,
                'scan_total' => 0,
                'service_total' => 0,
                'gross_total' => 0,
                'return_total' => 0,
                'net_total' => 0,
                'total_items' => 0
            ]);
        }

        $sql = "SELECT 
                    bl.Transfer_ID,
                    bl.Round_ID,
                    bl.Request_ID,
                    bl.Catalog_ID,
                    bl.Total_Charge,
                    bl.Transaction_Type,
                    c.Category_Type
                FROM Billing_Ledger bl
                LEFT JOIN Charge_Catalogs c ON bl.Catalog_ID = c.Catalog_ID
                WHERE bl.Admission_ID = :aid";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':aid' => $admissionId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $roomTotal = 0.0;
        $doctorTotal = 0.0;
        $medicineTotal = 0.0;
        $scanTotal = 0.0;
        $serviceTotal = 0.0;
        $grossTotal = 0.0;
        $returnTotal = 0.0;
        $netTotal = 0.0;

        foreach ($rows as $r) {
            $charge = floatval($r['Total_Charge']);
            $netTotal += $charge;

            if ($r['Transaction_Type'] === 'Return' || $charge < 0) {
                $returnTotal += abs($charge);
                $medicineTotal += $charge; // Reduces medicine subtotal
            } else {
                $grossTotal += $charge;

                if (!empty($r['Transfer_ID'])) {
                    $roomTotal += $charge;
                } elseif (!empty($r['Round_ID'])) {
                    $doctorTotal += $charge;
                } elseif (($r['Category_Type'] ?? '') === 'Medicine') {
                    $medicineTotal += $charge;
                } elseif (($r['Category_Type'] ?? '') === 'Equipment Scan') {
                    $scanTotal += $charge;
                } elseif (($r['Category_Type'] ?? '') === 'Service') {
                    $serviceTotal += $charge;
                } else {
                    $serviceTotal += $charge;
                }
            }
        }

        return json_encode([
            'room_total' => $roomTotal,
            'doctor_total' => $doctorTotal,
            'medicine_total' => $medicineTotal,
            'scan_total' => $scanTotal,
            'service_total' => $serviceTotal,
            'gross_total' => $grossTotal,
            'return_total' => $returnTotal,
            'net_total' => $netTotal,
            'total_items' => count($rows)
        ]);
    }

    /**
     * Read: Retrieve list of dispensed medicines eligible for return
     */
    function getDispensedMedicines($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        if (empty($admissionId)) {
            return json_encode([]);
        }

        $sql = "SELECT 
                    c.Catalog_ID,
                    CONCAT(c.Code_Prefix, '-', LPAD(c.Catalog_ID, 3, '0')) AS Item_Code,
                    c.Item_Name,
                    c.Unit_Price,
                    COALESCE(SUM(CASE WHEN bl.Transaction_Type = 'Charge' THEN bl.Quantity ELSE 0 END), 0) AS Total_Dispensed,
                    COALESCE(SUM(CASE WHEN bl.Transaction_Type = 'Return' THEN ABS(bl.Quantity) ELSE 0 END), 0) AS Total_Returned,
                    (
                        COALESCE(SUM(CASE WHEN bl.Transaction_Type = 'Charge' THEN bl.Quantity ELSE 0 END), 0) -
                        COALESCE(SUM(CASE WHEN bl.Transaction_Type = 'Return' THEN ABS(bl.Quantity) ELSE 0 END), 0)
                    ) AS Net_Remaining_Qty
                FROM Billing_Ledger bl
                INNER JOIN Charge_Catalogs c ON bl.Catalog_ID = c.Catalog_ID
                WHERE bl.Admission_ID = :aid 
                  AND c.Category_Type = 'Medicine'
                GROUP BY c.Catalog_ID, c.Item_Name, c.Unit_Price, c.Code_Prefix
                HAVING Net_Remaining_Qty > 0
                ORDER BY c.Item_Name ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':aid' => $admissionId]);
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    /**
     * Create: Return unused medicine -> Auto-post negative charge to Billing_Ledger
     */
    function returnMedicine($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);
        $catalogId = intval($json['catalog_id'] ?? 0);
        $returnQty = floatval($json['quantity'] ?? 0);

        if (empty($admissionId) || empty($catalogId) || $returnQty <= 0) {
            return json_encode(['error' => 'Admission ID, Medicine, and valid positive return quantity are required.']);
        }

        try {
            $conn->beginTransaction();

            // 1. Verify item is Medicine and get price
            $itemStmt = $conn->prepare("SELECT Item_Name, Unit_Price, Category_Type FROM Charge_Catalogs WHERE Catalog_ID = :cid");
            $itemStmt->execute([':cid' => $catalogId]);
            $item = $itemStmt->fetch(PDO::FETCH_ASSOC);

            if (!$item || $item['Category_Type'] !== 'Medicine') {
                $conn->rollBack();
                return json_encode(['error' => 'Only medicines are eligible for return credits.']);
            }

            // 2. Compute net dispensed quantity
            $qtyCheck = $conn->prepare("
                SELECT 
                    COALESCE(SUM(CASE WHEN Transaction_Type = 'Charge' THEN Quantity ELSE 0 END), 0) AS Dispensed,
                    COALESCE(SUM(CASE WHEN Transaction_Type = 'Return' THEN ABS(Quantity) ELSE 0 END), 0) AS Returned
                FROM Billing_Ledger
                WHERE Admission_ID = :aid AND Catalog_ID = :cid
            ");
            $qtyCheck->execute([':aid' => $admissionId, ':cid' => $catalogId]);
            $quantities = $qtyCheck->fetch(PDO::FETCH_ASSOC);

            $availableQty = floatval($quantities['Dispensed']) - floatval($quantities['Returned']);

            if ($returnQty > $availableQty) {
                $conn->rollBack();
                return json_encode([
                    'error' => "Cannot return {$returnQty} units. Only {$availableQty} units remain eligible for return."
                ]);
            }

            // 3. Calculate negative credit
            $unitPrice = floatval($item['Unit_Price']);
            $negativeQty = -1.0 * $returnQty;
            $negativeCredit = -1.0 * ($returnQty * $unitPrice);

            // 4. Post negative entry to Billing_Ledger (Station_ID = 1: Central Pharmacy)
            $postSql = "INSERT INTO Billing_Ledger 
                            (Admission_ID, Station_ID, Catalog_ID, Quantity, Unit_Price, Total_Charge, Transaction_Type, Timestamp)
                        VALUES 
                            (:aid, 1, :cid, :qty, :uprice, :tot, 'Return', NOW())";
            $postStmt = $conn->prepare($postSql);
            $postStmt->execute([
                ':aid' => $admissionId,
                ':cid' => $catalogId,
                ':qty' => $negativeQty,
                ':uprice' => $unitPrice,
                ':tot' => $negativeCredit
            ]);

            $conn->commit();
            return json_encode([
                'success' => true,
                'message' => "Returned {$returnQty} unit(s) of {$item['Item_Name']}. Negative credit adjustment of ₱" . number_format(abs($negativeCredit), 2) . " applied to ledger."
            ]);

        } catch (Exception $e) {
            $conn->rollBack();
            return json_encode(['error' => 'Medicine return failed: ' . $e->getMessage()]);
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

$ledger = new LedgerManager();
switch ($operation) {
    case 'getAdmissionLedger':
        echo $ledger->getAdmissionLedger($json);
        break;
    case 'getLedgerSummary':
        echo $ledger->getLedgerSummary($json);
        break;
    case 'getDispensedMedicines':
        echo $ledger->getDispensedMedicines($json);
        break;
    case 'returnMedicine':
        echo $ledger->returnMedicine($json);
        break;
}
?>

