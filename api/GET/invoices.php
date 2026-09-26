<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class InvoiceManager
{
    function getDiscountList()
    {
        include "connection.php";

        $sql = "SELECT 
                    Discount_ID,
                    Discount_Name,
                    Discount_Percentage
                FROM Enum_Discount
                WHERE Is_Active = 1
                ORDER BY Discount_Percentage DESC, Discount_Name ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    function getAllInvoices($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $search = trim($json['search'] ?? '');

        $sql = "SELECT 
                    fi.Invoice_ID,
                    CONCAT('INV-', LPAD(fi.Invoice_ID, 3, '0')) AS Invoice_Code,
                    fi.Admission_ID,
                    CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                    p.Patient_ID,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Patient_Name,
                    CONCAT(u.First_Name, ' ', u.Last_Name) AS Cashier_Name,
                    COALESCE(d.Discount_Name, 'None') AS Discount_Name,
                    COALESCE(d.Discount_Percentage, 0.00) AS Discount_Percentage,
                    fi.Gross_Total,
                    fi.Discount_Amount,
                    fi.Net_Amount_Due,
                    DATE_FORMAT(fi.Settlement_Date, '%Y-%m-%d %h:%i %p') AS Settlement_Date
                FROM Final_Invoice fi
                INNER JOIN Admission a ON fi.Admission_ID = a.Admission_ID
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                INNER JOIN System_User u ON fi.Processed_By_User_ID = u.User_ID
                LEFT JOIN Enum_Discount d ON fi.Discount_ID = d.Discount_ID
                WHERE 1=1";

        $params = [];
        if (!empty($search)) {
            $sql .= " AND (p.First_Name LIKE :search 
                           OR p.Last_Name LIKE :search 
                           OR fi.Invoice_ID = :search_id
                           OR a.Admission_ID = :search_aid
                           OR u.First_Name LIKE :search 
                           OR u.Last_Name LIKE :search)";
            $params[':search'] = "%{$search}%";
            $params[':search_id'] = is_numeric($search) ? intval($search) : 0;
            $params[':search_aid'] = is_numeric($search) ? intval($search) : 0;
        }

        $sql .= " ORDER BY fi.Invoice_ID DESC";

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    function getInvoiceById($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $invoiceId = intval($json['invoice_id'] ?? 0);
        $admissionId = intval($json['admission_id'] ?? 0);

        if (empty($invoiceId) && empty($admissionId)) {
            return json_encode(['error' => 'Invoice ID or Admission ID is required.']);
        }

        $sql = "SELECT 
                    fi.Invoice_ID,
                    CONCAT('INV-', LPAD(fi.Invoice_ID, 3, '0')) AS Invoice_Code,
                    fi.Gross_Total,
                    fi.Discount_Amount,
                    fi.Net_Amount_Due,
                    DATE_FORMAT(fi.Settlement_Date, '%Y-%m-%d %h:%i %p') AS Settlement_Date,
                    COALESCE(d.Discount_Name, 'None') AS Discount_Name,
                    COALESCE(d.Discount_Percentage, 0.00) AS Discount_Percentage,
                    u.User_ID AS Cashier_User_ID,
                    CONCAT(u.First_Name, ' ', u.Last_Name) AS Cashier_Name,
                    ur.Role_Name AS Cashier_Role,
                    a.Admission_ID,
                    CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                    a.Chief_Complaint,
                    a.Diagnosis,
                    DATE_FORMAT(a.Admission_Date, '%Y-%m-%d %h:%i %p') AS Admission_Date,
                    GREATEST(1, DATEDIFF(fi.Settlement_Date, a.Admission_Date)) AS Length_Of_Stay_Days,
                    a.Status AS Admission_Status,
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
                FROM Final_Invoice fi
                INNER JOIN Admission a ON fi.Admission_ID = a.Admission_ID
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                INNER JOIN System_User u ON fi.Processed_By_User_ID = u.User_ID
                INNER JOIN Enum_User_Role ur ON u.Role_ID = ur.Role_ID
                LEFT JOIN Enum_Gender g ON p.Gender_ID = g.Gender_ID
                LEFT JOIN Enum_Blood_Type bt ON p.Blood_Type_ID = bt.Blood_Type_ID
                LEFT JOIN Enum_Discount d ON fi.Discount_ID = d.Discount_ID
                WHERE " . (!empty($invoiceId) ? "fi.Invoice_ID = :iid" : "fi.Admission_ID = :aid");

        $stmt = $conn->prepare($sql);
        if (!empty($invoiceId)) {
            $stmt->execute([':iid' => $invoiceId]);
        } else {
            $stmt->execute([':aid' => $admissionId]);
        }
        $invoice = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$invoice) {
            return json_encode(['error' => 'Invoice not found.']);
        }

        $aid = $invoice['Admission_ID'];

        $docSql = "SELECT 
                    CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                    dt.Type_Name AS Doctor_Type,
                    (
                        SELECT GROUP_CONCAT(s.Specialty_Name SEPARATOR ', ')
                        FROM Doctor_Specialty ds
                        INNER JOIN Enum_Specialty s ON ds.Specialty_ID = s.Specialty_ID
                        WHERE ds.Doctor_ID = d.Doctor_ID
                    ) AS Specialties
                   FROM Admission_Doctor ad
                   INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                   INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
                   WHERE ad.Admission_ID = :aid";
        $docStmt = $conn->prepare($docSql);
        $docStmt->execute([':aid' => $aid]);
        $invoice['Attending_Doctors'] = $docStmt->fetchAll(PDO::FETCH_ASSOC);

        $invoice['Ledger_Items'] = $this->fetchLedgerItems($conn, $aid);
        $invoice['Category_Summary'] = $this->fetchLedgerSummary($conn, $aid);

        return json_encode($invoice);
    }

    function fetchLedgerItems($conn, $admissionId)
    {
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

        return $ledger;
    }

    function fetchLedgerSummary($conn, $admissionId)
    {
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

        return [
            'room_total' => round($roomTotal, 2),
            'doctor_total' => round($doctorTotal, 2),
            'medicine_total' => round($medicineTotal, 2),
            'scan_total' => round($scanTotal, 2),
            'service_total' => round($serviceTotal, 2),
            'gross_total' => round($grossTotal, 2),
            'return_total' => round($returnTotal, 2),
            'net_total' => round($netTotal, 2),
            'total_items' => count($rows)
        ];
    }
}

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "{}";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "{}";
}

$invoice = new InvoiceManager();
switch ($operation) {
    case 'getDiscountList':
        echo $invoice->getDiscountList();
        break;
    case 'getAllInvoices':
        echo $invoice->getAllInvoices($json);
        break;
    case 'getInvoiceById':
        echo $invoice->getInvoiceById($json);
        break;
}
?>
