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

        $staySql = "SELECT 
                        rtl.Transfer_ID,
                        rtl.Bed_ID,
                        rb.Bed_Code,
                        r.Room_Name,
                        rt.Type_Name AS Room_Type_Name,
                        COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate,
                        DATE_FORMAT(rtl.Date_In, '%Y-%m-%d %h:%i %p') AS Formatted_Date_In,
                        GREATEST(1, DATEDIFF(NOW(), rtl.Date_In)) AS Active_Days,
                        GREATEST(1, DATEDIFF(NOW(), rtl.Date_In)) * COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Active_Fee
                    FROM Room_Transfer_Log rtl
                    INNER JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                    INNER JOIN Room r ON rb.Room_ID = r.Room_ID
                    INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                    WHERE rtl.Admission_ID = :aid AND rtl.Date_Out IS NULL
                    LIMIT 1";
        $stayStmt = $conn->prepare($staySql);
        $stayStmt->execute([':aid' => $admissionId]);
        $activeStay = $stayStmt->fetch(PDO::FETCH_ASSOC);

        if ($activeStay) {
            $activeDays = max(1, intval($activeStay['Active_Days']));
            $dailyRate = floatval($activeStay['Daily_Rate']);
            $activeFee = $activeDays * $dailyRate;
            $dayWord = $activeDays > 1 ? 'days' : 'day';

            $ledger[] = [
                'Ledger_ID' => 'STAY-' . $activeStay['Transfer_ID'],
                'Station_Name' => 'Admissions & Bed Management',
                'Category' => 'Room & Board',
                'Description' => "Board & Lodging: {$activeStay['Room_Name']} (Bed: {$activeStay['Bed_Code']}) - {$activeStay['Room_Type_Name']} (Current Active Stay: {$activeDays} {$dayWord})",
                'Quantity' => $activeDays,
                'Unit_Price' => $dailyRate,
                'Total_Charge' => $activeFee,
                'Transaction_Type' => 'Charge',
                'Timestamp' => $activeStay['Formatted_Date_In'] . ' (Active)',
                'Is_Active_Stay' => 1
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

        $staySql = "SELECT 
                        COALESCE(SUM(GREATEST(1, DATEDIFF(NOW(), rtl.Date_In)) * COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate)), 0.00) AS Active_Fee
                    FROM Room_Transfer_Log rtl
                    INNER JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                    INNER JOIN Room r ON rb.Room_ID = r.Room_ID
                    INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                    WHERE rtl.Admission_ID = :aid AND rtl.Date_Out IS NULL";
        $stayStmt = $conn->prepare($staySql);
        $stayStmt->execute([':aid' => $admissionId]);
        $activeRoomFee = floatval($stayStmt->fetchColumn() ?: 0.0);

        $roomTotal += $activeRoomFee;
        $grossTotal += $activeRoomFee;
        $netTotal += $activeRoomFee;

        $advStmt = $conn->prepare("SELECT COALESCE(SUM(Amount_Paid), 0.00) FROM Invoice_Payment WHERE Admission_ID = :aid AND (Invoice_ID IS NULL OR Is_Advance = 1)");
        $advStmt->execute([':aid' => $admissionId]);
        $advanceTotal = floatval($advStmt->fetchColumn());

        return json_encode([
            'room_total' => round($roomTotal, 2),
            'doctor_total' => round($doctorTotal, 2),
            'medicine_total' => round($medicineTotal, 2),
            'scan_total' => round($scanTotal, 2),
            'service_total' => round($serviceTotal, 2),
            'gross_total' => round($grossTotal, 2),
            'return_total' => round($returnTotal, 2),
            'net_total' => round($netTotal, 2),
            'advance_payments_total' => round($advanceTotal, 2),
            'balance_due' => round(max(0.00, $netTotal - $advanceTotal), 2),
            'total_items' => count($rows) + ($activeRoomFee > 0 ? 1 : 0)
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

    function getPartialBill($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        if (empty($admissionId)) {
            return json_encode(['error' => 'Admission ID is required.']);
        }

        $admSql = "SELECT 
                    a.Admission_ID,
                    CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                    a.Chief_Complaint,
                    a.Diagnosis,
                    a.Status AS Admission_Status,
                    DATE_FORMAT(a.Admission_Date, '%Y-%m-%d %h:%i %p') AS Admission_Date,
                    GREATEST(1, DATEDIFF(NOW(), a.Admission_Date)) AS Stay_Days_To_Date,
                    DATE_FORMAT(NOW(), '%Y-%m-%d %h:%i %p') AS Statement_Date,
                    p.Patient_ID,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Patient_Name,
                    p.Date_Of_Birth,
                    TIMESTAMPDIFF(YEAR, p.Date_Of_Birth, CURDATE()) AS Age,
                    g.Gender_Name,
                    bt.Blood_Type_Name,
                    p.Contact_Number,
                    p.Address,
                    p.Emergency_Contact_Name,
                    p.Emergency_Contact_Number
                FROM Admission a
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                LEFT JOIN Enum_Gender g ON p.Gender_ID = g.Gender_ID
                LEFT JOIN Enum_Blood_Type bt ON p.Blood_Type_ID = bt.Blood_Type_ID
                WHERE a.Admission_ID = :aid";

        $admStmt = $conn->prepare($admSql);
        $admStmt->execute([':aid' => $admissionId]);
        $bill = $admStmt->fetch(PDO::FETCH_ASSOC);

        if (!$bill) {
            return json_encode(['error' => 'Admission record not found.']);
        }

        $staySql = "SELECT 
                    rtl.Transfer_ID,
                    rtl.Bed_ID,
                    rb.Bed_Code,
                    r.Room_Name,
                    rt.Type_Name AS Room_Type_Name,
                    COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate,
                    DATE_FORMAT(rtl.Date_In, '%Y-%m-%d %h:%i %p') AS Date_In,
                    DATE_FORMAT(rtl.Date_Out, '%Y-%m-%d %h:%i %p') AS Date_Out,
                    rtl.Total_Days,
                    rtl.Total_Room_Fee,
                    CASE WHEN rtl.Date_Out IS NULL THEN 1 ELSE 0 END AS Is_Current_Stay,
                    CASE WHEN rtl.Date_Out IS NULL 
                         THEN GREATEST(1, DATEDIFF(NOW(), rtl.Date_In))
                         ELSE COALESCE(rtl.Total_Days, 1)
                    END AS Calculated_Days,
                    CASE WHEN rtl.Date_Out IS NULL 
                         THEN GREATEST(1, DATEDIFF(NOW(), rtl.Date_In)) * COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate)
                         ELSE COALESCE(rtl.Total_Room_Fee, COALESCE(rtl.Total_Days, 1) * COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate))
                    END AS Calculated_Room_Fee
                FROM Room_Transfer_Log rtl
                INNER JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                INNER JOIN Room r ON rb.Room_ID = r.Room_ID
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE rtl.Admission_ID = :aid
                ORDER BY rtl.Transfer_ID ASC";

        $stayStmt = $conn->prepare($staySql);
        $stayStmt->execute([':aid' => $admissionId]);
        $roomStays = $stayStmt->fetchAll(PDO::FETCH_ASSOC);
        $bill['Room_Stays'] = $roomStays;

        $docSql = "SELECT 
                    ad.Admission_Doctor_ID,
                    d.Doctor_ID,
                    CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                    dt.Type_Name AS Doctor_Type,
                    (
                        SELECT GROUP_CONCAT(s.Specialty_Name SEPARATOR ', ')
                        FROM Doctor_Specialty ds
                        INNER JOIN Enum_Specialty s ON ds.Specialty_ID = s.Specialty_ID
                        WHERE ds.Doctor_ID = d.Doctor_ID
                    ) AS Specialties,
                    COALESCE(SUM(drl.Charged_Fee), 0.00) AS Charges,
                    COUNT(drl.Round_ID) AS Round_Count
                FROM Admission_Doctor ad
                INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
                LEFT JOIN Doctor_Round_Log drl ON ad.Admission_Doctor_ID = drl.Admission_Doctor_ID
                WHERE ad.Admission_ID = :aid
                GROUP BY ad.Admission_Doctor_ID, d.Doctor_ID, d.First_Name, d.Last_Name, dt.Type_Name
                ORDER BY Charges DESC, d.Last_Name ASC";

        $docStmt = $conn->prepare($docSql);
        $docStmt->execute([':aid' => $admissionId]);
        $bill['Attending_Doctors'] = $docStmt->fetchAll(PDO::FETCH_ASSOC);

        $ledgerItems = json_decode($this->getAdmissionLedger(json_encode(['admission_id' => $admissionId])), true);
        $bill['Ledger_Items'] = $ledgerItems;

        $ledgerSummary = json_decode($this->getLedgerSummary(json_encode(['admission_id' => $admissionId])), true);

        $totalRoomStayCharges = 0;
        foreach ($roomStays as $stay) {
            $totalRoomStayCharges += floatval($stay['Calculated_Room_Fee']);
        }

        $advSql = "SELECT 
                    ip.Payment_ID,
                    ip.Receipt_Number,
                    ip.Amount_Paid,
                    ip.Balance_Before,
                    ip.Balance_After,
                    epm.Method_Name AS Payment_Method,
                    COALESCE(ip.Notes, 'Advance Deposit') AS Notes,
                    DATE_FORMAT(ip.Payment_Date, '%Y-%m-%d %h:%i %p') AS Payment_Date
                   FROM Invoice_Payment ip
                   INNER JOIN Enum_Payment_Method epm ON ip.Payment_Method_ID = epm.Payment_Method_ID
                   WHERE ip.Admission_ID = :aid AND (ip.Invoice_ID IS NULL OR ip.Is_Advance = 1)
                   ORDER BY ip.Payment_ID ASC";
        $advStmt = $conn->prepare($advSql);
        $advStmt->execute([':aid' => $admissionId]);
        $advPayments = $advStmt->fetchAll(PDO::FETCH_ASSOC);
        $bill['Advance_Payments'] = $advPayments;

        $totalAdvance = 0.00;
        foreach ($advPayments as $ap) {
            $totalAdvance += floatval($ap['Amount_Paid']);
        }

        $gross = floatval($ledgerSummary['gross_total']);
        $returns = floatval($ledgerSummary['return_total']);
        $alreadyInLedgerRoom = floatval($ledgerSummary['room_total']);
        $currentRoomToAdd = max(0, $totalRoomStayCharges - $alreadyInLedgerRoom);
        $totalGross = $gross + $currentRoomToAdd;
        $totalNet = $totalGross - $returns;
        $remainingBal = max(0.00, round($totalNet - $totalAdvance, 2));

        $bill['Summary'] = [
            'room_total' => round($totalRoomStayCharges, 2),
            'doctor_total' => floatval($ledgerSummary['doctor_total']),
            'medicine_total' => floatval($ledgerSummary['medicine_total']),
            'scan_total' => floatval($ledgerSummary['scan_total']),
            'service_total' => floatval($ledgerSummary['service_total']),
            'gross_total' => round($totalGross, 2),
            'return_total' => round($returns, 2),
            'net_accumulated_total' => round($totalNet, 2),
            'advance_payments_total' => round($totalAdvance, 2),
            'remaining_balance' => round($remainingBal, 2)
        ];

        return json_encode($bill);
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
    case 'getPartialBill':
        echo $ledger->getPartialBill($json);
        break;
}
?>
