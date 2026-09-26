<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class LedgerManager
{
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

            $itemStmt = $conn->prepare("SELECT Item_Name, Unit_Price, Category_Type FROM Charge_Catalogs WHERE Catalog_ID = :cid");
            $itemStmt->execute([':cid' => $catalogId]);
            $item = $itemStmt->fetch(PDO::FETCH_ASSOC);

            if (!$item || $item['Category_Type'] !== 'Medicine') {
                $conn->rollBack();
                return json_encode(['error' => 'Only medicines are eligible for return credits.']);
            }

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

            $unitPrice = floatval($item['Unit_Price']);
            $negativeQty = -1.0 * $returnQty;
            $negativeCredit = -1.0 * ($returnQty * $unitPrice);

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

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "{}";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "{}";
}

$ledger = new LedgerManager();
switch ($operation) {
    case 'returnMedicine':
        echo $ledger->returnMedicine($json);
        break;
}
?>
