<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class PatientPortalManager
{
    function verifyAccess($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $identifier = trim($json['identifier'] ?? '');
        $passcode = strtoupper(trim($json['passcode'] ?? ''));

        if (empty($identifier) || empty($passcode)) {
            return json_encode([
                'success' => false,
                'error' => 'Please provide both your Reference Code (Admission or Patient ID) and Access Passcode.'
            ]);
        }

        $idNum = intval(preg_replace('/[^0-9]/', '', $identifier));

        $sql = "SELECT 
                    a.Admission_ID,
                    CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                    a.Access_Passcode,
                    a.Status AS Admission_Status,
                    DATE_FORMAT(a.Admission_Date, '%M %d, %Y %h:%i %p') AS Admission_Date,
                    GREATEST(1, DATEDIFF(NOW(), a.Admission_Date)) AS Stay_Days,
                    a.Diagnosis,
                    a.Chief_Complaint,
                    p.Patient_ID,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Patient_Name,
                    TIMESTAMPDIFF(YEAR, p.Date_Of_Birth, CURDATE()) AS Age,
                    g.Gender_Name,
                    bt.Blood_Type_Name,
                    rb.Bed_Code,
                    r.Room_Name,
                    rt.Type_Name AS Room_Type_Name,
                    fi.Invoice_ID,
                    fi.Net_Amount_Due,
                    fi.Amount_Paid,
                    fi.Discount_Amount,
                    fi.Discount_Summary,
                    DATE_FORMAT(fi.Settlement_Date, '%M %d, %Y %h:%i %p') AS Settlement_Date
                FROM Admission a
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                LEFT JOIN Enum_Gender g ON p.Gender_ID = g.Gender_ID
                LEFT JOIN Enum_Blood_Type bt ON p.Blood_Type_ID = bt.Blood_Type_ID
                LEFT JOIN Room_Transfer_Log rtl ON rtl.Admission_ID = a.Admission_ID AND rtl.Date_Out IS NULL
                LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                LEFT JOIN Room r ON rb.Room_ID = r.Room_ID
                LEFT JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                LEFT JOIN Final_Invoice fi ON fi.Admission_ID = a.Admission_ID
                WHERE (
                    a.Admission_ID = :id_num
                    OR CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) = :code
                    OR CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) = :code
                    OR p.Patient_ID = :id_num_pat
                )
                AND UPPER(TRIM(a.Access_Passcode)) = :passcode
                ORDER BY a.Admission_ID DESC
                LIMIT 1";

        $stmt = $conn->prepare($sql);
        $stmt->execute([
            ':id_num' => $idNum > 0 ? $idNum : -1,
            ':id_num_pat' => $idNum > 0 ? $idNum : -1,
            ':code' => strtoupper($identifier),
            ':passcode' => $passcode
        ]);
        $record = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$record) {
            return json_encode([
                'success' => false,
                'error' => 'Invalid reference code or passcode. Please check your credentials or request an updated passcode at the Nurse Station.'
            ]);
        }

        return json_encode([
            'success' => true,
            'admission_id' => $record['Admission_ID'],
            'patient_name' => $record['Patient_Name'],
            'patient_code' => $record['Patient_Code'],
            'admission_code' => $record['Admission_Code'],
            'record' => $record
        ]);
    }

    function getPatientBillDetails($json = '{}')
    {
        include "connection.php";
        require_once "ledger.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);
        $passcode = strtoupper(trim($json['passcode'] ?? ''));

        if (empty($admissionId) || empty($passcode)) {
            return json_encode(['error' => 'Admission ID and Access Passcode are required.']);
        }

        $authStmt = $conn->prepare("SELECT Admission_ID FROM Admission WHERE Admission_ID = :aid AND UPPER(TRIM(Access_Passcode)) = :pass");
        $authStmt->execute([':aid' => $admissionId, ':pass' => $passcode]);
        if (!$authStmt->fetch()) {
            return json_encode(['error' => 'Unauthorized portal session. Please re-authenticate.']);
        }

        $ledgerMgr = new LedgerManager();
        $partialBillJson = $ledgerMgr->getPartialBill(json_encode(['admission_id' => $admissionId]));
        $partialBill = json_decode($partialBillJson, true);

        $invStmt = $conn->prepare("
            SELECT 
                fi.Invoice_ID,
                fi.Admission_ID,
                fi.Gross_Total,
                fi.Discount_Amount,
                fi.Advance_Payment_Amount,
                fi.VAT_Rate,
                fi.VATable_Amount,
                fi.VAT_Amount,
                fi.VAT_Exempt_Amount,
                fi.Discount_Summary,
                fi.Net_Amount_Due,
                fi.Amount_Paid,
                fi.Change_Amount,
                DATE_FORMAT(fi.Settlement_Date, '%M %d, %Y %h:%i %p') AS Settlement_Date,
                CONCAT(u.First_Name, ' ', u.Last_Name) AS Cashier_Name
            FROM Final_Invoice fi
            LEFT JOIN System_User u ON fi.Processed_By_User_ID = u.User_ID
            WHERE fi.Admission_ID = :aid
            ORDER BY fi.Invoice_ID DESC
            LIMIT 1
        ");
        $invStmt->execute([':aid' => $admissionId]);
        $finalInvoice = $invStmt->fetch(PDO::FETCH_ASSOC);

        $appliedDiscounts = [];
        $payments = [];

        if ($finalInvoice) {
            $discStmt = $conn->prepare("
                SELECT Applied_Discount_ID, Discount_Name, Discount_Value, Calculated_Deduction
                FROM invoice_applied_discount
                WHERE Invoice_ID = :iid
            ");
            $discStmt->execute([':iid' => $finalInvoice['Invoice_ID']]);
            $appliedDiscounts = $discStmt->fetchAll(PDO::FETCH_ASSOC);

            $payStmt = $conn->prepare("
                SELECT 
                    ip.Payment_ID,
                    ip.Receipt_Number,
                    ip.Amount_Paid,
                    ip.Discount_Amount,
                    COALESCE(d.Discount_Name, ip.Discount_Name, 'None') AS Applied_Discount_Name,
                    epm.Method_Name AS Payment_Method,
                    ip.Is_Advance,
                    DATE_FORMAT(ip.Payment_Date, '%M %d, %Y %h:%i %p') AS Payment_Date
                FROM Invoice_Payment ip
                LEFT JOIN Enum_Payment_Method epm ON ip.Payment_Method_ID = epm.Payment_Method_ID
                LEFT JOIN Enum_Discount d ON ip.Discount_ID = d.Discount_ID
                WHERE ip.Admission_ID = :aid
                ORDER BY ip.Payment_ID ASC
            ");
            $payStmt->execute([':aid' => $admissionId]);
            $payments = $payStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        return json_encode([
            'success' => true,
            'partial_bill' => $partialBill,
            'final_invoice' => $finalInvoice ?: null,
            'applied_discounts' => $appliedDiscounts,
            'payment_history' => $payments
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

$portal = new PatientPortalManager();
switch ($operation) {
    case 'verifyAccess':
        echo $portal->verifyAccess($json);
        break;
    case 'getPatientBillDetails':
        echo $portal->getPatientBillDetails($json);
        break;
}
?>