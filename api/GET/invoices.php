<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class InvoiceManager
{
    function getDiscountList()
    {
        include "connection.php";

        $sql = "SELECT 
                    d.Discount_ID,
                    d.Discount_Name,
                    d.Discount_Type_ID,
                    COALESCE(edt.Type_Name, 'Percentage') AS Discount_Type,
                    d.Discount_Percentage,
                    d.Fixed_Amount,
                    d.Is_Vat_Exempt
                FROM Enum_Discount d
                LEFT JOIN Enum_Discount_Type edt ON d.Discount_Type_ID = edt.Discount_Type_ID
                WHERE d.Is_Active = 1
                ORDER BY d.Discount_Type_ID ASC, d.Discount_Percentage DESC, d.Fixed_Amount DESC, d.Discount_Name ASC";

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
                    COALESCE(fi.Advance_Payment_Amount, 0.00) AS Advance_Payment_Amount,
                    fi.VAT_Rate,
                    fi.VATable_Amount,
                    fi.VAT_Amount,
                    fi.VAT_Exempt_Amount,
                    fi.Discount_Summary,
                    fi.Net_Amount_Due,
                    COALESCE(fi.Amount_Paid, fi.Net_Amount_Due) AS Amount_Paid,
                    COALESCE(fi.Change_Amount, 0.00) AS Change_Amount,
                    GREATEST(0.00, fi.Net_Amount_Due - COALESCE(fi.Amount_Paid, 0.00)) AS Remaining_Balance,
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
                    COALESCE(fi.Advance_Payment_Amount, 0.00) AS Advance_Payment_Amount,
                    fi.VAT_Rate,
                    fi.VATable_Amount,
                    fi.VAT_Amount,
                    fi.VAT_Exempt_Amount,
                    fi.Discount_Summary,
                    fi.Net_Amount_Due,
                    COALESCE(fi.Amount_Paid, fi.Net_Amount_Due) AS Amount_Paid,
                    COALESCE(fi.Change_Amount, 0.00) AS Change_Amount,
                    GREATEST(0.00, fi.Net_Amount_Due - COALESCE(fi.Amount_Paid, 0.00)) AS Remaining_Balance,
                    DATE_FORMAT(fi.Settlement_Date, '%Y-%m-%d %h:%i %p') AS Settlement_Date,
                    COALESCE(d.Discount_Name, 'None') AS Discount_Name,
                    COALESCE(d.Discount_Percentage, 0.00) AS Discount_Percentage,
                    COALESCE(d.Fixed_Amount, 0.00) AS Fixed_Amount,
                    COALESCE(edt.Type_Name, 'Percentage') AS Discount_Type,
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
                LEFT JOIN Enum_Discount_Type edt ON d.Discount_Type_ID = edt.Discount_Type_ID
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

        $appDiscSql = "SELECT 
                        iad.Applied_Discount_ID,
                        iad.Discount_ID,
                        iad.Discount_Name,
                        ed.Discount_Type_ID,
                        COALESCE(edt.Type_Name, 'Percentage') AS Discount_Type,
                        iad.Discount_Value,
                        iad.Calculated_Deduction
                       FROM Invoice_Applied_Discount iad
                       LEFT JOIN Enum_Discount ed ON iad.Discount_ID = ed.Discount_ID
                       LEFT JOIN Enum_Discount_Type edt ON ed.Discount_Type_ID = edt.Discount_Type_ID
                       WHERE iad.Invoice_ID = :iid
                       ORDER BY iad.Applied_Discount_ID ASC";
        $appDiscStmt = $conn->prepare($appDiscSql);
        $appDiscStmt->execute([':iid' => $invoice['Invoice_ID']]);
        $invoice['Applied_Discounts'] = $appDiscStmt->fetchAll(PDO::FETCH_ASSOC);

        $aid = $invoice['Admission_ID'];

        $docSql = "SELECT 
                    ad.Admission_Doctor_ID,
                    d.Doctor_ID,
                    CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                    CONCAT(UPPER(d.Last_Name), ', ', UPPER(d.First_Name)) AS Doctor_Formal_Name,
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
    function getPaymentMethods()
    {
        include "connection.php";
        $sql = "SELECT Payment_Method_ID, Method_Name, Category_Type, Code_Prefix, Description FROM Enum_Payment_Method WHERE Is_Active = 1 ORDER BY Payment_Method_ID ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    function getPaymentHistory($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $invoiceId = intval($json['invoice_id'] ?? 0);
        $admissionId = intval($json['admission_id'] ?? 0);

        if (empty($invoiceId) && empty($admissionId)) {
            return json_encode([]);
        }

        $sql = "SELECT 
                    ip.Payment_ID,
                    ip.Invoice_ID,
                    ip.Admission_ID,
                    ip.Receipt_Number,
                    ip.Amount_Paid,
                    ip.Balance_Before,
                    ip.Balance_After,
                    ip.Payment_Method_ID,
                    ip.Is_Advance,
                    epm.Method_Name AS Payment_Method,
                    epm.Category_Type,
                    COALESCE(ip.Notes, '') AS Notes,
                    DATE_FORMAT(ip.Payment_Date, '%Y-%m-%d %h:%i %p') AS Payment_Date,
                    u.User_ID AS Cashier_User_ID,
                    CONCAT(u.First_Name, ' ', u.Last_Name) AS Cashier_Name,
                    COALESCE(fi.Net_Amount_Due, ip.Balance_Before) AS Net_Amount_Due,
                    COALESCE(fi.Gross_Total, ip.Balance_Before) AS Gross_Total,
                    COALESCE(CONCAT('INV-', LPAD(fi.Invoice_ID, 3, '0')), 'Pre-Discharge Advance Deposit') AS Invoice_Code,
                    CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Patient_Name,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code
                FROM Invoice_Payment ip
                LEFT JOIN Final_Invoice fi ON ip.Invoice_ID = fi.Invoice_ID
                INNER JOIN Admission a ON ip.Admission_ID = a.Admission_ID
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                INNER JOIN System_User u ON ip.Cashier_User_ID = u.User_ID
                INNER JOIN Enum_Payment_Method epm ON ip.Payment_Method_ID = epm.Payment_Method_ID
                WHERE " . (!empty($invoiceId) ? "ip.Invoice_ID = :iid" : "ip.Admission_ID = :aid") . "
                ORDER BY ip.Payment_ID ASC";

        $stmt = $conn->prepare($sql);
        if (!empty($invoiceId)) {
            $stmt->execute([':iid' => $invoiceId]);
        } else {
            $stmt->execute([':aid' => $admissionId]);
        }
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    function getPaymentReceipt($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $paymentId = intval($json['payment_id'] ?? 0);
        $receiptNumber = trim($json['receipt_number'] ?? '');

        if (empty($paymentId) && empty($receiptNumber)) {
            return json_encode(['error' => 'Payment ID or Receipt Number is required.']);
        }

        $sql = "SELECT 
                    ip.Payment_ID,
                    ip.Invoice_ID,
                    ip.Admission_ID,
                    ip.Receipt_Number,
                    ip.Amount_Paid,
                    ip.Balance_Before,
                    ip.Balance_After,
                    ip.Payment_Method_ID,
                    ip.Is_Advance,
                    epm.Method_Name AS Payment_Method,
                    epm.Category_Type,
                    COALESCE(ip.Notes, '') AS Notes,
                    DATE_FORMAT(ip.Payment_Date, '%Y-%m-%d %h:%i %p') AS Formatted_Payment_Date,
                    u.User_ID AS Cashier_User_ID,
                    CONCAT(u.First_Name, ' ', u.Last_Name) AS Cashier_Name,
                    ur.Role_Name AS Cashier_Role,
                    COALESCE(fi.Net_Amount_Due, ip.Balance_Before) AS Net_Amount_Due,
                    COALESCE(fi.Gross_Total, ip.Balance_Before) AS Gross_Total,
                    COALESCE(fi.Discount_Amount, 0.00) AS Discount_Amount,
                    COALESCE(d.Discount_Name, 'None') AS Discount_Name,
                    COALESCE(d.Discount_Percentage, 0.00) AS Discount_Percentage,
                    COALESCE(CONCAT('INV-', LPAD(fi.Invoice_ID, 3, '0')), 'Pre-Discharge Advance Deposit') AS Invoice_Code,
                    CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                    a.Chief_Complaint,
                    a.Diagnosis,
                    DATE_FORMAT(a.Admission_Date, '%Y-%m-%d %h:%i %p') AS Admission_Date,
                    p.Patient_ID,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Patient_Name,
                    p.Date_Of_Birth,
                    TIMESTAMPDIFF(YEAR, p.Date_Of_Birth, CURDATE()) AS Age,
                    g.Gender_Name,
                    p.Contact_Number,
                    p.Address
                FROM Invoice_Payment ip
                LEFT JOIN Final_Invoice fi ON ip.Invoice_ID = fi.Invoice_ID
                INNER JOIN Admission a ON ip.Admission_ID = a.Admission_ID
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                INNER JOIN System_User u ON ip.Cashier_User_ID = u.User_ID
                INNER JOIN Enum_User_Role ur ON u.Role_ID = ur.Role_ID
                INNER JOIN Enum_Payment_Method epm ON ip.Payment_Method_ID = epm.Payment_Method_ID
                LEFT JOIN Enum_Discount d ON fi.Discount_ID = d.Discount_ID
                LEFT JOIN Enum_Gender g ON p.Gender_ID = g.Gender_ID
                WHERE " . (!empty($paymentId) ? "ip.Payment_ID = :pid" : "ip.Receipt_Number = :rnum");

        $stmt = $conn->prepare($sql);
        if (!empty($paymentId)) {
            $stmt->execute([':pid' => $paymentId]);
        } else {
            $stmt->execute([':rnum' => $receiptNumber]);
        }
        $receipt = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$receipt) {
            return json_encode(['error' => 'Payment receipt not found.']);
        }

        return json_encode($receipt);
    }

    function getAdvancePayments($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        if (empty($admissionId)) {
            return json_encode(['error' => 'Admission ID is required.']);
        }

        $sql = "SELECT 
                    ip.Payment_ID,
                    ip.Invoice_ID,
                    ip.Admission_ID,
                    ip.Receipt_Number,
                    ip.Amount_Paid,
                    ip.Balance_Before,
                    ip.Balance_After,
                    ip.Payment_Method_ID,
                    epm.Method_Name AS Payment_Method,
                    epm.Category_Type,
                    COALESCE(ip.Notes, 'Advance Patient Deposit') AS Notes,
                    ip.Is_Advance,
                    DATE_FORMAT(ip.Payment_Date, '%Y-%m-%d %h:%i %p') AS Formatted_Payment_Date,
                    u.User_ID AS Cashier_User_ID,
                    CONCAT(u.First_Name, ' ', u.Last_Name) AS Cashier_Name
                FROM Invoice_Payment ip
                INNER JOIN System_User u ON ip.Cashier_User_ID = u.User_ID
                INNER JOIN Enum_Payment_Method epm ON ip.Payment_Method_ID = epm.Payment_Method_ID
                WHERE ip.Admission_ID = :aid AND (ip.Is_Advance = 1 OR ip.Invoice_ID IS NULL)
                ORDER BY ip.Payment_ID ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':aid' => $admissionId]);
        $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalAdvance = 0.00;
        foreach ($payments as $p) {
            $totalAdvance += floatval($p['Amount_Paid']);
        }

        return json_encode([
            'payments' => $payments,
            'total_advance_amount' => round($totalAdvance, 2),
            'count' => count($payments)
        ]);
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
    case 'getPaymentMethods':
        echo $invoice->getPaymentMethods();
        break;
    case 'getDiscountList':
        echo $invoice->getDiscountList();
        break;
    case 'getAllInvoices':
        echo $invoice->getAllInvoices($json);
        break;
    case 'getInvoiceById':
        echo $invoice->getInvoiceById($json);
        break;
    case 'getPaymentHistory':
        echo $invoice->getPaymentHistory($json);
        break;
    case 'getPaymentReceipt':
        echo $invoice->getPaymentReceipt($json);
        break;
    case 'getAdvancePayments':
        echo $invoice->getAdvancePayments($json);
        break;
}

?>
