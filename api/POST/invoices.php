<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class InvoiceManager
{
    function settleInvoice($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);
        $userId = intval($json['user_id'] ?? 0);
        $discountId = !empty($json['discount_id']) ? intval($json['discount_id']) : null;
        $paymentMethodId = !empty($json['payment_method_id']) ? intval($json['payment_method_id']) : 1;

        if (empty($admissionId)) {
            return json_encode(['error' => 'Admission ID is required for billing settlement.']);
        }

        if (empty($userId)) {
            return json_encode(['error' => 'Active user session is required. Please re-login.']);
        }

        try {
            $conn->beginTransaction();

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

                $freeBed = $conn->prepare("UPDATE Room_Bed SET Is_Available = 1 WHERE Bed_ID = :bid");
                $freeBed->execute([':bid' => $currentStay['Bed_ID']]);
            }

            $sumStmt = $conn->prepare("SELECT COALESCE(SUM(Total_Charge), 0.00) AS Gross_Total FROM Billing_Ledger WHERE Admission_ID = :aid");
            $sumStmt->execute([':aid' => $admissionId]);
            $grossTotal = floatval($sumStmt->fetchColumn());

            $discountAmount = 0.00;
            if (!empty($discountId)) {
                $discStmt = $conn->prepare("SELECT Discount_Percentage FROM Enum_Discount WHERE Discount_ID = :did AND Is_Active = 1");
                $discStmt->execute([':did' => $discountId]);
                $pct = $discStmt->fetchColumn();
                if ($pct !== false) {
                    $discountAmount = round($grossTotal * (floatval($pct) / 100.0), 2);
                } else {
                    $discountId = null;
                }
            }

            $netAmountDue = max(0.00, $grossTotal - $discountAmount);

            $amountPaidInput = isset($json['amount_paid']) ? floatval($json['amount_paid']) : null;
            $amountPaid = ($amountPaidInput !== null && $amountPaidInput >= 0) ? round($amountPaidInput, 2) : $netAmountDue;
            $changeAmount = max(0.00, round($amountPaid - $netAmountDue, 2));

            $invSql = "INSERT INTO Final_Invoice 
                        (Admission_ID, Processed_By_User_ID, Discount_ID, Gross_Total, Discount_Amount, Net_Amount_Due, Amount_Paid, Change_Amount, Settlement_Date)
                       VALUES 
                        (:aid, :uid, :did, :gross, :disc, :net, :paid, :change, NOW())";
            $invStmt = $conn->prepare($invSql);
            $invStmt->execute([
                ':aid' => $admissionId,
                ':uid' => $userId,
                ':did' => $discountId,
                ':gross' => $grossTotal,
                ':disc' => $discountAmount,
                ':net' => $netAmountDue,
                ':paid' => $amountPaid,
                ':change' => $changeAmount
            ]);
            $invoiceId = $conn->lastInsertId();

            $updAdm = $conn->prepare("UPDATE Admission SET Status = 'Billed' WHERE Admission_ID = :aid");
            $updAdm->execute([':aid' => $admissionId]);

            $paymentId = null;
            $receiptNumber = null;
            if ($amountPaid > 0) {
                $countPayments = $conn->query("SELECT COUNT(*) FROM Invoice_Payment")->fetchColumn();
                $nextReceiptNum = intval($countPayments) + 1;
                $receiptNumber = 'OR-' . str_pad($nextReceiptNum, 5, '0', STR_PAD_LEFT);
                $initialApplied = min($amountPaid, $netAmountDue);
                $balAfter = max(0.00, round($netAmountDue - $amountPaid, 2));

                $insPay = $conn->prepare("
                    INSERT INTO Invoice_Payment 
                        (Invoice_ID, Admission_ID, Cashier_User_ID, Receipt_Number, Amount_Paid, Balance_Before, Balance_After, Payment_Method_ID, Notes, Payment_Date)
                    VALUES 
                        (:iid, :aid, :uid, :rnum, :paid, :bb, :ba, :pmid, 'Initial Settlement Payment', NOW())
                ");
                $insPay->execute([
                    ':iid' => $invoiceId,
                    ':aid' => $admissionId,
                    ':uid' => $userId,
                    ':rnum' => $receiptNumber,
                    ':paid' => $initialApplied,
                    ':bb' => $netAmountDue,
                    ':ba' => $balAfter,
                    ':pmid' => $paymentMethodId
                ]);
                $paymentId = $conn->lastInsertId();
            }

            $cashierName = 'Cashier Staff';
            if (!empty($userId)) {
                $uStmt = $conn->prepare("SELECT CONCAT(First_Name, ' ', Last_Name) FROM System_User WHERE User_ID = :uid");
                $uStmt->execute([':uid' => $userId]);
                $uName = $uStmt->fetchColumn();
                if ($uName) {
                    $cashierName = $uName;
                }
            }

            $invCode = 'INV-' . str_pad($invoiceId, 3, '0', STR_PAD_LEFT);
            $rem = max(0.00, round($netAmountDue - $amountPaid, 2));
            $settleDesc = "Settled invoice {$invCode} for Net: ₱" . number_format($netAmountDue, 2) . ", Tendered: ₱" . number_format($amountPaid, 2) . ", Balance: ₱" . number_format($rem, 2);

            $logStmt = $conn->prepare("
                INSERT INTO Audit_Log 
                    (User_ID, Admission_ID, Action_Type, Module_Name, Record_Reference, Description, Performed_By, Created_At)
                VALUES 
                    (:uid, :aid, 'Billing Settled', 'Billing', :ref, :descr, :by, NOW())
            ");
            $logStmt->execute([
                ':uid' => $userId,
                ':aid' => $admissionId,
                ':ref' => $invCode,
                ':descr' => $settleDesc,
                ':by' => $cashierName
            ]);

            $conn->commit();
            return json_encode([
                'success' => true,
                'message' => 'Billing successfully settled and Final Invoice generated!',
                'invoice_id' => $invoiceId,
                'admission_id' => $admissionId,
                'payment_id' => $paymentId,
                'receipt_number' => $receiptNumber,
                'gross_total' => $grossTotal,
                'discount_amount' => $discountAmount,
                'net_amount_due' => $netAmountDue,
                'amount_paid' => $amountPaid,
                'change_amount' => $changeAmount,
                'remaining_balance' => max(0.00, round($netAmountDue - $amountPaid, 2))
            ]);

        } catch (Exception $e) {
            $conn->rollBack();
            return json_encode(['error' => 'Settlement failed: ' . $e->getMessage()]);
        }
    }

    function recordPayment($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $invoiceId = intval($json['invoice_id'] ?? 0);
        $admissionId = intval($json['admission_id'] ?? 0);
        $userId = intval($json['user_id'] ?? 0);
        $paymentAmount = floatval($json['payment_amount'] ?? 0);
        $paymentMethodId = !empty($json['payment_method_id']) ? intval($json['payment_method_id']) : 1;

        if (empty($invoiceId) && empty($admissionId)) {
            return json_encode(['error' => 'Invoice ID or Admission ID is required.']);
        }

        if ($paymentAmount <= 0) {
            return json_encode(['error' => 'Payment amount must be greater than zero.']);
        }

        try {
            $conn->beginTransaction();

            $sql = "SELECT 
                        fi.Invoice_ID,
                        fi.Admission_ID,
                        fi.Net_Amount_Due,
                        COALESCE(fi.Amount_Paid, 0.00) AS Amount_Paid,
                        COALESCE(fi.Change_Amount, 0.00) AS Change_Amount,
                        GREATEST(0.00, fi.Net_Amount_Due - COALESCE(fi.Amount_Paid, 0.00)) AS Remaining_Balance
                    FROM Final_Invoice fi
                    WHERE " . (!empty($invoiceId) ? "fi.Invoice_ID = :iid" : "fi.Admission_ID = :aid") . " FOR UPDATE";

            $stmt = $conn->prepare($sql);
            if (!empty($invoiceId)) {
                $stmt->execute([':iid' => $invoiceId]);
            } else {
                $stmt->execute([':aid' => $admissionId]);
            }
            $inv = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$inv) {
                $conn->rollBack();
                return json_encode(['error' => 'Invoice not found.']);
            }

            $currentBal = floatval($inv['Remaining_Balance']);
            if ($currentBal <= 0) {
                $conn->rollBack();
                return json_encode(['error' => 'This invoice is already paid in full.']);
            }

            $currentPaid = floatval($inv['Amount_Paid']);
            $currentChange = floatval($inv['Change_Amount']);
            $netDue = floatval($inv['Net_Amount_Due']);

            if ($paymentAmount >= $currentBal) {
                $appliedPayment = $currentBal;
                $changeGiven = round($paymentAmount - $currentBal, 2);
                $newPaid = round($currentPaid + $paymentAmount, 2);
                $newChange = round($currentChange + $changeGiven, 2);
                $newRemaining = 0.00;
            } else {
                $appliedPayment = $paymentAmount;
                $changeGiven = 0.00;
                $newPaid = round($currentPaid + $paymentAmount, 2);
                $newChange = $currentChange;
                $newRemaining = max(0.00, round($netDue - $newPaid, 2));
            }

            $updStmt = $conn->prepare("UPDATE Final_Invoice SET Amount_Paid = :paid, Change_Amount = :change WHERE Invoice_ID = :iid");
            $updStmt->execute([
                ':paid' => $newPaid,
                ':change' => $newChange,
                ':iid' => $inv['Invoice_ID']
            ]);

            $countPayments = $conn->query("SELECT COUNT(*) FROM Invoice_Payment")->fetchColumn();
            $nextReceiptNum = intval($countPayments) + 1;
            $receiptNumber = 'OR-' . str_pad($nextReceiptNum, 5, '0', STR_PAD_LEFT);

            $insPay = $conn->prepare("
                INSERT INTO Invoice_Payment 
                    (Invoice_ID, Admission_ID, Cashier_User_ID, Receipt_Number, Amount_Paid, Balance_Before, Balance_After, Payment_Method_ID, Notes, Payment_Date)
                VALUES 
                    (:iid, :aid, :uid, :rnum, :paid, :bb, :ba, :pmid, :notes, NOW())
            ");
            $payNotes = !empty($json['notes']) ? trim($json['notes']) : 'Follow-up Installment Payment';
            $insPay->execute([
                ':iid' => $inv['Invoice_ID'],
                ':aid' => $inv['Admission_ID'],
                ':uid' => $userId,
                ':rnum' => $receiptNumber,
                ':paid' => $appliedPayment,
                ':bb' => $currentBal,
                ':ba' => $newRemaining,
                ':pmid' => $paymentMethodId,
                ':notes' => $payNotes
            ]);
            $paymentId = $conn->lastInsertId();

            $cashierName = 'Cashier Staff';
            if (!empty($userId)) {
                $uStmt = $conn->prepare("SELECT CONCAT(First_Name, ' ', Last_Name) FROM System_User WHERE User_ID = :uid");
                $uStmt->execute([':uid' => $userId]);
                $uName = $uStmt->fetchColumn();
                if ($uName) {
                    $cashierName = $uName;
                }
            }

            $invCode = 'INV-' . str_pad($inv['Invoice_ID'], 3, '0', STR_PAD_LEFT);
            $desc = "Received additional payment of ₱" . number_format($paymentAmount, 2) . " ({$receiptNumber}) for {$invCode}. Applied: ₱" . number_format($appliedPayment, 2) . ", Change: ₱" . number_format($changeGiven, 2) . ", Remaining: ₱" . number_format($newRemaining, 2);

            $logStmt = $conn->prepare("
                INSERT INTO Audit_Log 
                    (User_ID, Admission_ID, Action_Type, Module_Name, Record_Reference, Description, Performed_By, Created_At)
                VALUES 
                    (:uid, :aid, 'Payment Received', 'Billing', :ref, :descr, :by, NOW())
            ");
            $logStmt->execute([
                ':uid' => !empty($userId) ? $userId : null,
                ':aid' => $inv['Admission_ID'],
                ':ref' => $invCode,
                ':descr' => $desc,
                ':by' => $cashierName
            ]);

            $conn->commit();

            return json_encode([
                'success' => true,
                'message' => "Payment of ₱" . number_format($appliedPayment, 2) . " successfully recorded! Official Receipt: {$receiptNumber}",
                'invoice_id' => $inv['Invoice_ID'],
                'admission_id' => $inv['Admission_ID'],
                'payment_id' => $paymentId,
                'receipt_number' => $receiptNumber,
                'payment_tendered' => $paymentAmount,
                'payment_applied' => $appliedPayment,
                'change_given' => $changeGiven,
                'total_amount_paid' => $newPaid,
                'remaining_balance' => $newRemaining,
                'is_paid_in_full' => ($newRemaining <= 0)
            ]);

        } catch (Exception $e) {
            $conn->rollBack();
            return json_encode(['error' => 'Payment processing failed: ' . $e->getMessage()]);
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

$invoice = new InvoiceManager();
switch ($operation) {
    case 'settleInvoice':
        echo $invoice->settleInvoice($json);
        break;
    case 'recordPayment':
        echo $invoice->recordPayment($json);
        break;
}
?>
