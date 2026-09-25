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
}
?>
