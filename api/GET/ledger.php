<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class LedgerManager
{
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

    function getLedgerSummary($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        if (empty($admissionId)) {
            return json_encode([
                'room_total' => 0.00,
                'doctor_total' => 0.00,
                'medicine_total' => 0.00,
                'scan_total' => 0.00,
                'service_total' => 0.00,
                'gross_total' => 0.00,
                'return_total' => 0.00,
                'net_total' => 0.00
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
            $amt = floatval($r['Total_Charge']);
            $netTotal += $amt;

            if ($r['Transaction_Type'] === 'Return') {
                $returnTotal += abs($amt);
                $medicineTotal += $amt;
            } else {
                $grossTotal += $amt;
                if (!empty($r['Transfer_ID'])) {
                    $roomTotal += $amt;
                } elseif (!empty($r['Round_ID'])) {
                    $doctorTotal += $amt;
                } else {
                    $cat = $r['Category_Type'] ?? '';
                    if ($cat === 'Medicine') {
                        $medicineTotal += $amt;
                    } elseif ($cat === 'Equipment Scan') {
                        $scanTotal += $amt;
                    } elseif ($cat === 'Service') {
                        $serviceTotal += $amt;
                    }
                }
            }
        }

        return json_encode([
            'room_total' => round($roomTotal, 2),
            'doctor_total' => round($doctorTotal, 2),
            'medicine_total' => round($medicineTotal, 2),
            'scan_total' => round($scanTotal, 2),
            'service_total' => round($serviceTotal, 2),
            'gross_total' => round($grossTotal, 2),
            'return_total' => round($returnTotal, 2),
            'net_total' => round($netTotal, 2),
            'total_items' => count($rows)
        ]);
    }

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
    case 'getAdmissionLedger':
        echo $ledger->getAdmissionLedger($json);
        break;
    case 'getLedgerSummary':
        echo $ledger->getLedgerSummary($json);
        break;
    case 'getDispensedMedicines':
        echo $ledger->getDispensedMedicines($json);
        break;
}
?>
