<?php
/**
 * Final Invoicing & Billing Settlement API
 * Milestone 3: Financial Settlement & Statements of Account (SOA)
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class InvoiceManager
{
    /**
     * Read: Retrieve list of active discount options
     */
    function getDiscountList()
    {
        include __DIR__ . "/../connection.php";

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

    /**
     * Read: Retrieve all settled invoices
     */
    function getAllInvoices($json = '{}')
    {
        include __DIR__ . "/../connection.php";

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

    /**
     * Read: Retrieve single invoice details including itemized statement for printing
     */
    function getInvoiceById($json = '{}')
    {
        include __DIR__ . "/../connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $invoiceId = intval($json['invoice_id'] ?? 0);
        $admissionId = intval($json['admission_id'] ?? 0);

        if (empty($invoiceId) && empty($admissionId)) {
            return json_encode(['error' => 'Invoice ID or Admission ID is required.']);
        }

        // 1. Fetch Invoice, Patient & Admission details
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

        // 2. Fetch assigned physicians
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

        // 3. Fetch itemized charges from Billing_Ledger
        require_once __DIR__ . '/ledger.php';
        $ledgerMgr = new LedgerManager();
        $ledgerItems = json_decode($ledgerMgr->getAdmissionLedger(json_encode(['admission_id' => $aid])), true);
        $summary = json_decode($ledgerMgr->getLedgerSummary(json_encode(['admission_id' => $aid])), true);

        $invoice['Ledger_Items'] = $ledgerItems;
        $invoice['Category_Summary'] = $summary;

        return json_encode($invoice);
    }

    /**
     * Create: Settle admission bill, apply discount, record Final_Invoice, close bed stay, set status 'Billed'
     */
    function settleInvoice($json = '{}')
    {
        include __DIR__ . "/../connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);
        $userId = intval($json['user_id'] ?? 0);
        $discountId = !empty($json['discount_id']) ? intval($json['discount_id']) : null;

        if (empty($admissionId)) {
            return json_encode(['error' => 'Admission ID is required for billing settlement.']);
        }

        if (empty($userId)) {
            return json_encode(['error' => 'Active user session is required. Please re-login.']);
        }

        try {
            $conn->beginTransaction();

            // 1. Check admission state
            $admCheck = $conn->prepare("SELECT Admission_ID, Status FROM Admission WHERE Admission_ID = :aid");
            $admCheck->execute([':aid' => $admissionId]);
            $admission = $admCheck->fetch(PDO::FETCH_ASSOC);

            if (!$admission) {
                $conn->rollBack();
                return json_encode(['error' => 'Admission not found.']);
            }

            if ($admission['Status'] === 'Billed') {
                $conn->rollBack();
                return json_encode(['error' => 'This admission has already been settled and billed.']);
            }

            // 2. If patient is currently in bed, close stay, post room fee, free bed
            $currStayStmt = $conn->prepare("
                SELECT 
                    rtl.Transfer_ID,
                    rtl.Bed_ID,
                    rtl.Date_In,
                    COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate
                FROM Room_Transfer_Log rtl
                INNER JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                INNER JOIN Room r ON rb.Room_ID = r.Room_ID
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE rtl.Admission_ID = :aid AND rtl.Date_Out IS NULL
            ");
            $currStayStmt->execute([':aid' => $admissionId]);
            $currentStay = $currStayStmt->fetch(PDO::FETCH_ASSOC);

            if ($currentStay) {
                $dateIn = new DateTime($currentStay['Date_In']);
                $now = new DateTime();
                $diffDays = $now->diff($dateIn)->days;
                $totalDays = max(1, $diffDays);
                $dailyRate = floatval($currentStay['Daily_Rate']);
                $totalRoomFee = $totalDays * $dailyRate;

                // Close transfer log
                $closeStmt = $conn->prepare("
                    UPDATE Room_Transfer_Log 
                    SET Date_Out = NOW(), Total_Days = :days, Total_Room_Fee = :fee 
                    WHERE Transfer_ID = :tid
                ");
                $closeStmt->execute([
                    ':days' => $totalDays,
                    ':fee' => $totalRoomFee,
                    ':tid' => $currentStay['Transfer_ID']
                ]);

                // Post room charge to ledger (Station 5: Nurse Station)
                $postLedger = $conn->prepare("
                    INSERT INTO Billing_Ledger 
                        (Admission_ID, Station_ID, Transfer_ID, Quantity, Unit_Price, Total_Charge, Transaction_Type, Timestamp)
                    VALUES 
                        (:aid, 5, :tid, :qty, :unit_price, :total_charge, 'Charge', NOW())
                ");
                $postLedger->execute([
                    ':aid' => $admissionId,
                    ':tid' => $currentStay['Transfer_ID'],
                    ':qty' => $totalDays,
                    ':unit_price' => $dailyRate,
                    ':total_charge' => $totalRoomFee
                ]);

                // Free bed
                $freeBed = $conn->prepare("UPDATE Room_Bed SET Is_Available = 1 WHERE Bed_ID = :bid");
                $freeBed->execute([':bid' => $currentStay['Bed_ID']]);
            }

            // 3. Compute Gross Total from Billing_Ledger
            $sumStmt = $conn->prepare("SELECT COALESCE(SUM(Total_Charge), 0.00) AS Gross_Total FROM Billing_Ledger WHERE Admission_ID = :aid");
            $sumStmt->execute([':aid' => $admissionId]);
            $grossTotal = floatval($sumStmt->fetchColumn());

            // 4. Calculate Discount
            $discountAmount = 0.00;
            if (!empty($discountId)) {
                $discStmt = $conn->prepare("SELECT Discount_Percentage FROM Enum_Discount WHERE Discount_ID = :did AND Is_Active = 1");
                $discStmt->execute([':did' => $discountId]);
                $pct = $discStmt->fetchColumn();
                if ($pct !== false) {
                    $discountAmount = round($grossTotal * (floatval($pct) / 100.0), 2);
                } else {
                    $discountId = null; // invalid discount ID
                }
            }

            $netAmountDue = max(0.00, $grossTotal - $discountAmount);

            // 5. Insert Final_Invoice
            $invSql = "INSERT INTO Final_Invoice 
                        (Admission_ID, Processed_By_User_ID, Discount_ID, Gross_Total, Discount_Amount, Net_Amount_Due, Settlement_Date)
                       VALUES 
                        (:aid, :uid, :did, :gross, :disc, :net, NOW())";
            $invStmt = $conn->prepare($invSql);
            $invStmt->execute([
                ':aid' => $admissionId,
                ':uid' => $userId,
                ':did' => $discountId,
                ':gross' => $grossTotal,
                ':disc' => $discountAmount,
                ':net' => $netAmountDue
            ]);
            $invoiceId = $conn->lastInsertId();

            // 6. Update Admission Status to 'Billed'
            $updAdm = $conn->prepare("UPDATE Admission SET Status = 'Billed' WHERE Admission_ID = :aid");
            $updAdm->execute([':aid' => $admissionId]);

            $conn->commit();
            return json_encode([
                'success' => true,
                'message' => 'Billing successfully settled and Final Invoice generated!',
                'invoice_id' => $invoiceId,
                'admission_id' => $admissionId,
                'gross_total' => $grossTotal,
                'discount_amount' => $discountAmount,
                'net_amount_due' => $netAmountDue
            ]);

        } catch (Exception $e) {
            $conn->rollBack();
            return json_encode(['error' => 'Settlement failed: ' . $e->getMessage()]);
        }
    }
}

// ── Router ──────────────────────────────────────────────────────────
$operation = $_POST['operation'] ?? '';
$json = $_POST['json'] ?? '{}';

if (!empty($operation)) {
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

        case 'settleInvoice':
            echo $invoice->settleInvoice($json);
            break;

        default:
            echo json_encode(['error' => 'Invalid operation specified.']);
            break;
    }
}
