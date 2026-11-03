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



        $roleCheck = $conn->prepare("

            SELECT r.Access_Domain, r.Role_Name 

            FROM System_User u 

            INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID 

            WHERE u.User_ID = :uid

        ");

        $roleCheck->execute([':uid' => $userId]);

        $userRole = $roleCheck->fetch(PDO::FETCH_ASSOC);



        if ($userRole && ($userRole['Access_Domain'] === 'Clinical' || stripos($userRole['Role_Name'], 'Nurse') !== false)) {

            return json_encode(['error' => 'Access Restricted: Clinical staff (Nurses/Doctors) are not authorized to collect financial deposits or issue Official Receipts.']);

        }



        try {

            $conn->beginTransaction();



            $admCheck = $conn->prepare("SELECT Admission_ID, Status, Diagnosis FROM Admission WHERE Admission_ID = :aid");

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



            $diagnosis = trim($admission['Diagnosis'] ?? '');

            if (empty($diagnosis) || strtolower($diagnosis) === 'pending clinical diagnosis' || strtolower($diagnosis) === 'loading...') {

                $diagnosis = 'Medically cleared for discharge / Under observation';

                $updateDiagStmt = $conn->prepare("UPDATE Admission SET Diagnosis = :diag WHERE Admission_ID = :aid");

                $updateDiagStmt->execute([

                    ':diag' => $diagnosis,

                    ':aid' => $admissionId

                ]);

            }



            $currStayStmt = $conn->prepare("

                SELECT 

                    rtl.Transfer_ID,

                    rtl.Bed_ID,

                    rtl.Date_In,

                    GREATEST(1, DATEDIFF(NOW(), rtl.Date_In)) AS Calculated_Days,

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

                $totalDays = max(1, intval($currentStay['Calculated_Days'] ?? 1));

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



            $discountIds = [];

            if (!empty($json['discount_ids']) && is_array($json['discount_ids'])) {

                $discountIds = array_map('intval', $json['discount_ids']);

            } else if (!empty($discountId)) {

                $discountIds = [$discountId];

            }



            $customDiscounts = [];

            if (!empty($json['custom_discounts']) && is_array($json['custom_discounts'])) {

                $customDiscounts = $json['custom_discounts'];

            }



            $allDiscountsToApply = [];

            if (!empty($discountIds)) {

                $placeholders = implode(',', array_fill(0, count($discountIds), '?'));

                $dStmt = $conn->prepare("SELECT d.Discount_ID, d.Discount_Name, d.Discount_Type_ID, COALESCE(edt.Type_Name, 'Percentage') AS Discount_Type, d.Discount_Percentage, d.Fixed_Amount, d.Is_Vat_Exempt, COALESCE(d.Target_Scope, 'Total') AS Target_Scope FROM Enum_Discount d LEFT JOIN Enum_Discount_Type edt ON d.Discount_Type_ID = edt.Discount_Type_ID WHERE d.Discount_ID IN ($placeholders) AND d.Is_Active = 1");

                $dStmt->execute($discountIds);

                $fetchedDiscs = $dStmt->fetchAll(PDO::FETCH_ASSOC);

                foreach ($fetchedDiscs as $fd) {

                    $allDiscountsToApply[] = [

                        'discount_id' => intval($fd['Discount_ID']),

                        'name' => $fd['Discount_Name'],

                        'type' => $fd['Discount_Type'],

                        'pct' => floatval($fd['Discount_Percentage']),

                        'fixed' => floatval($fd['Fixed_Amount']),

                        'is_vat_exempt' => intval($fd['Is_Vat_Exempt']),

                        'target_scope' => $fd['Target_Scope'] ?? 'Total'

                    ];

                }

            }



            foreach ($customDiscounts as $cd) {

                $cName = trim($cd['name'] ?? 'Custom Deduction');

                $cType = ($cd['type'] ?? 'Fixed') === 'Percentage' ? 'Percentage' : 'Fixed';

                $cVal = floatval($cd['value'] ?? 0);

                if ($cVal > 0) {

                    $chkDisc = $conn->prepare("SELECT Discount_ID FROM Enum_Discount WHERE Discount_Name = :name LIMIT 1");

                    $chkDisc->execute([':name' => $cName]);

                    $foundId = $chkDisc->fetchColumn();

                    if (!$foundId) {

                        $typeId = ($cType === 'Fixed') ? 2 : 1;

                        $insD = $conn->prepare("INSERT INTO Enum_Discount (Discount_Name, Discount_Type_ID, Discount_Percentage, Fixed_Amount, Is_Vat_Exempt, Is_Active) VALUES (:name, :type_id, :pct, :fixed, :exempt, 1)");

                        $insD->execute([

                            ':name' => $cName,

                            ':type_id' => $typeId,

                            ':pct' => ($cType === 'Percentage' ? $cVal : 0.00),

                            ':fixed' => ($cType === 'Fixed' ? $cVal : 0.00),

                            ':exempt' => !empty($cd['is_vat_exempt']) ? 1 : 0

                        ]);

                        $foundId = $conn->lastInsertId();

                    }



                    $allDiscountsToApply[] = [

                        'discount_id' => intval($foundId),

                        'name' => $cName,

                        'type' => $cType,

                        'pct' => ($cType === 'Percentage') ? $cVal : 0,

                        'fixed' => ($cType === 'Fixed') ? $cVal : 0,

                        'is_vat_exempt' => !empty($cd['is_vat_exempt']) ? 1 : 0

                    ];

                }

            }



            $advDiscQuery = $conn->prepare("

                SELECT ip.Discount_ID, COALESCE(ip.Discount_Name, d.Discount_Name, 'Assistance Voucher') AS Discount_Name, ip.Discount_Amount 

                FROM Invoice_Payment ip

                LEFT JOIN Enum_Discount d ON ip.Discount_ID = d.Discount_ID

                WHERE ip.Admission_ID = :aid AND (ip.Invoice_ID IS NULL OR ip.Is_Advance = 1) AND ip.Discount_Amount > 0

            ");

            $advDiscQuery->execute([':aid' => $admissionId]);

            $advDiscs = $advDiscQuery->fetchAll(PDO::FETCH_ASSOC);

            foreach ($advDiscs as $ad) {

                $alreadyIn = false;

                foreach ($allDiscountsToApply as $existing) {

                    if (!empty($existing['discount_id']) && $existing['discount_id'] == $ad['Discount_ID']) {

                        $alreadyIn = true;

                        break;

                    }

                }

                if (!$alreadyIn) {
                    $foundDiscId = !empty($ad['Discount_ID']) ? intval($ad['Discount_ID']) : null;
                    if (!$foundDiscId) {
                        $cleanName = trim(preg_replace('/\(₱[0-9.,]+\)/', '', $ad['Discount_Name']));
                        $chkD = $conn->prepare("SELECT Discount_ID FROM Enum_Discount WHERE Discount_Name = :name OR :cname LIKE CONCAT('%', Discount_Name, '%') LIMIT 1");
                        $chkD->execute([':name' => $cleanName, ':cname' => $cleanName]);
                        $matchedId = $chkD->fetchColumn();
                        if ($matchedId) {
                            $foundDiscId = intval($matchedId);
                        }
                    }
                    $allDiscountsToApply[] = [
                        'discount_id' => $foundDiscId,
                        'name' => $ad['Discount_Name'],
                        'type' => 'Fixed',
                        'pct' => 0,
                        'fixed' => floatval($ad['Discount_Amount']),
                        'is_vat_exempt' => 0
                    ];
                }

            }



            $fixedDiscounts = [];

            $pctDiscounts = [];

            $isVatExempt = false;



            foreach ($allDiscountsToApply as $d) {

                if ($d['is_vat_exempt'] == 1 || stripos($d['name'], 'Senior') !== false || stripos($d['name'], 'PWD') !== false) {

                    $isVatExempt = true;

                }

                if ($d['type'] === 'Fixed') {

                    $fixedDiscounts[] = $d;

                } else {

                    $pctDiscounts[] = $d;

                }

            }



            $subtotalsStmt = $conn->prepare("
                SELECT 
                    bl.Transfer_ID,
                    bl.Round_ID,
                    bl.Total_Charge,
                    bl.Transaction_Type,
                    c.Category_Type
                FROM Billing_Ledger bl
                LEFT JOIN Charge_Catalogs c ON bl.Catalog_ID = c.Catalog_ID
                WHERE bl.Admission_ID = :aid
            ");
            $subtotalsStmt->execute([':aid' => $admissionId]);
            $ledgerCatRows = $subtotalsStmt->fetchAll(PDO::FETCH_ASSOC);

            $scopeRoom = 0.0;
            $scopeDoctor = 0.0;
            $scopeMedicine = 0.0;
            $scopeScan = 0.0;
            $scopeService = 0.0;

            foreach ($ledgerCatRows as $lcr) {
                $amt = floatval($lcr['Total_Charge']);
                if ($lcr['Transaction_Type'] === 'Return') {
                    $scopeMedicine = max(0.0, $scopeMedicine - abs($amt));
                } elseif ($lcr['Transaction_Type'] === 'Charge') {
                    if (!empty($lcr['Transfer_ID'])) {
                        $scopeRoom += $amt;
                    } elseif (!empty($lcr['Round_ID'])) {
                        $scopeDoctor += $amt;
                    } else {
                        $cType = $lcr['Category_Type'] ?? '';
                        if ($cType === 'Medicine') {
                            $scopeMedicine += $amt;
                        } elseif ($cType === 'Equipment Scan') {
                            $scopeScan += $amt;
                        } else {
                            $scopeService += $amt;
                        }
                    }
                }
            }
            $scopeLab = $scopeScan + $scopeService;

            $availRoom = $scopeRoom;
            $availDoctor = $scopeDoctor;
            $availMedicine = $scopeMedicine;
            $availLab = $scopeLab;
            $availTotal = $grossTotal;

            $appliedItems = [];

            foreach ($fixedDiscounts as $fd) {
                $scope = $fd['target_scope'] ?? 'Total';
                $fixedVal = floatval($fd['fixed']);
                $maxDeduct = $availTotal;
                $scopeTag = '';

                if ($scope === 'Doctor') {
                    $maxDeduct = $availDoctor;
                    $scopeTag = ' [Doctor PF Only]';
                } elseif ($scope === 'Room') {
                    $maxDeduct = $availRoom;
                    $scopeTag = ' [Room Only]';
                } elseif ($scope === 'Medicine') {
                    $maxDeduct = $availMedicine;
                    $scopeTag = ' [Pharmacy Only]';
                } elseif ($scope === 'Laboratory') {
                    $maxDeduct = $availLab;
                    $scopeTag = ' [Diagnostics Only]';
                }

                $ded = min($maxDeduct, $fixedVal);
                if ($ded > 0) {
                    if ($scope === 'Doctor') $availDoctor -= $ded;
                    elseif ($scope === 'Room') $availRoom -= $ded;
                    elseif ($scope === 'Medicine') $availMedicine -= $ded;
                    elseif ($scope === 'Laboratory') $availLab -= $ded;

                    $availTotal = max(0.0, $availTotal - $ded);

                    $appliedItems[] = [
                        'discount_id' => $fd['discount_id'],
                        'name' => $fd['name'] . $scopeTag,
                        'type' => 'Fixed',
                        'value' => $fixedVal,
                        'deduction' => $ded
                    ];
                }
            }

            $pctByScope = [
                'Room' => [],
                'Doctor' => [],
                'Medicine' => [],
                'Laboratory' => [],
                'Total' => []
            ];

            foreach ($pctDiscounts as $pd) {
                $scope = $pd['target_scope'] ?? 'Total';
                if (!isset($pctByScope[$scope])) {
                    $pctByScope['Total'][] = $pd;
                } else {
                    $pctByScope[$scope][] = $pd;
                }
            }

            $scopesConfig = [
                'Room' => [&$availRoom, ' [Room Only]'],
                'Doctor' => [&$availDoctor, ' [Doctor PF Only]'],
                'Medicine' => [&$availMedicine, ' [Pharmacy Only]'],
                'Laboratory' => [&$availLab, ' [Diagnostics Only]']
            ];

            foreach ($scopesConfig as $sKey => &$conf) {
                $availRef = &$conf[0];
                $sTag = $conf[1];
                $list = $pctByScope[$sKey];
                if (!empty($list) && $availRef > 0) {
                    $sumPct = 0.0;
                    foreach ($list as $item) {
                        $sumPct += floatval($item['pct']);
                    }
                    $effectivePct = min(100.0, $sumPct);
                    $scopeDed = min($availRef, round($availRef * ($effectivePct / 100.0), 2));

                    foreach ($list as $item) {
                        $itemPct = floatval($item['pct']);
                        $itemDed = ($sumPct > 0) ? round($scopeDed * ($itemPct / $sumPct), 2) : 0.0;
                        $appliedItems[] = [
                            'discount_id' => $item['discount_id'],
                            'name' => $item['name'] . $sTag,
                            'type' => 'Percentage',
                            'value' => $itemPct,
                            'deduction' => $itemDed
                        ];
                    }

                    $availRef = max(0.0, $availRef - $scopeDed);
                    $availTotal = max(0.0, $availTotal - $scopeDed);
                }
            }

            $totalList = $pctByScope['Total'];
            if (!empty($totalList) && $availTotal > 0) {
                $sumTotalPct = 0.0;
                foreach ($totalList as $item) {
                    $sumTotalPct += floatval($item['pct']);
                }
                $effectiveTotalPct = min(100.0, $sumTotalPct);
                $overallDed = min($availTotal, round($availTotal * ($effectiveTotalPct / 100.0), 2));

                foreach ($totalList as $item) {
                    $itemPct = floatval($item['pct']);
                    $itemDed = ($sumTotalPct > 0) ? round($overallDed * ($itemPct / $sumTotalPct), 2) : 0.0;
                    $appliedItems[] = [
                        'discount_id' => $item['discount_id'],
                        'name' => $item['name'] . ' [Bill Total]',
                        'type' => 'Percentage',
                        'value' => $itemPct,
                        'deduction' => $itemDed
                    ];
                }

                $availTotal = max(0.0, $availTotal - $overallDed);
            }

            $discountAmount = round($grossTotal - $availTotal, 2);

            $netAfterDiscounts = round($availTotal, 2);



            $primaryDiscountId = null;

            if (!empty($appliedItems)) {

                foreach ($appliedItems as $ai) {

                    if (!empty($ai['discount_id'])) {

                        $primaryDiscountId = $ai['discount_id'];

                        break;

                    }

                }

            }



            $summaryParts = [];

            foreach ($appliedItems as $ai) {

                if ($ai['type'] === 'Fixed') {

                    $summaryParts[] = $ai['name'] . ' (-₱' . number_format($ai['deduction'], 2) . ')';

                } else {

                    $summaryParts[] = $ai['name'] . ' ' . number_format($ai['value'], 2) . '% (-₱' . number_format($ai['deduction'], 2) . ')';

                }

            }

            $discountSummary = !empty($summaryParts) ? implode('<br>', $summaryParts) : null;



            if ($isVatExempt) {

                $vatRate = 0.00;

                $vatableAmount = 0.00;

                $vatAmount = 0.00;

                $vatExemptAmount = $netAfterDiscounts;

                $netAmountDue = $netAfterDiscounts;

            } else {

                $vatRate = 12.00;

                $vatAmount = round($netAfterDiscounts * 0.12, 2);

                $vatableAmount = round($netAfterDiscounts - $vatAmount, 2);

                $vatExemptAmount = 0.00;

                $netAmountDue = $netAfterDiscounts;

            }



            $advStmt = $conn->prepare("SELECT COALESCE(SUM(Amount_Paid), 0.00) AS Adv_Paid, COALESCE(SUM(Discount_Amount), 0.00) AS Adv_Disc FROM Invoice_Payment WHERE Admission_ID = :aid AND (Invoice_ID IS NULL OR Is_Advance = 1)");

            $advStmt->execute([':aid' => $admissionId]);

            $advRow = $advStmt->fetch(PDO::FETCH_ASSOC);

            $totalAdvancePaid = floatval($advRow['Adv_Paid'] ?? 0.00);

            $totalAdvanceDisc = floatval($advRow['Adv_Disc'] ?? 0.00);

            $totalAdvanceCredit = round($totalAdvancePaid + $totalAdvanceDisc, 2);



            $remainingNetToSettle = max(0.00, round($netAmountDue - $totalAdvancePaid, 2));



            $amountPaidInput = isset($json['amount_paid']) ? floatval($json['amount_paid']) : null;

            $tenderedAtDischarge = ($amountPaidInput !== null && $amountPaidInput >= 0) ? round($amountPaidInput, 2) : $remainingNetToSettle;

            $totalAmountPaid = round($totalAdvancePaid + $tenderedAtDischarge, 2);

            $changeAmount = max(0.00, round($totalAmountPaid - $netAmountDue, 2));



            $invSql = "INSERT INTO Final_Invoice 

                        (Admission_ID, Processed_By_User_ID, Discount_ID, Gross_Total, Discount_Amount, Advance_Payment_Amount, VAT_Rate, VATable_Amount, VAT_Amount, VAT_Exempt_Amount, Discount_Summary, Net_Amount_Due, Amount_Paid, Change_Amount, Settlement_Date)

                       VALUES 

                        (:aid, :uid, :did, :gross, :disc, :adv, :vrate, :vatable, :vatamt, :vatexempt, :dsum, :net, :paid, :change, NOW())";

            $invStmt = $conn->prepare($invSql);

            $invStmt->execute([

                ':aid' => $admissionId,

                ':uid' => $userId,

                ':did' => $primaryDiscountId,

                ':gross' => $grossTotal,

                ':disc' => $discountAmount,

                ':adv' => $totalAdvancePaid,

                ':vrate' => $vatRate,

                ':vatable' => $vatableAmount,

                ':vatamt' => $vatAmount,

                ':vatexempt' => $vatExemptAmount,

                ':dsum' => $discountSummary,

                ':net' => $netAmountDue,

                ':paid' => $totalAmountPaid,

                ':change' => $changeAmount

            ]);

            $invoiceId = $conn->lastInsertId();



            if (!empty($appliedItems)) {

                $insAppDisc = $conn->prepare("

                    INSERT INTO Invoice_Applied_Discount 

                        (Invoice_ID, Discount_ID, Discount_Name, Discount_Value, Calculated_Deduction)

                    VALUES 

                        (:iid, :did, :dname, :dval, :dded)

                ");

                foreach ($appliedItems as $ai) {
                    $did = !empty($ai['discount_id']) ? intval($ai['discount_id']) : null;
                    if ($did === null) {
                        $chkFallback = $conn->prepare("SELECT Discount_ID FROM Enum_Discount WHERE Discount_Name = :name OR :cname LIKE CONCAT('%', Discount_Name, '%') LIMIT 1");
                        $chkFallback->execute([':name' => $ai['name'], ':cname' => $ai['name']]);
                        $foundFallback = $chkFallback->fetchColumn();
                        if ($foundFallback) {
                            $did = intval($foundFallback);
                        }
                    }
                    $insAppDisc->execute([
                        ':iid' => $invoiceId,
                        ':did' => $did,
                        ':dname' => $ai['name'],
                        ':dval' => $ai['value'],
                        ':dded' => $ai['deduction']
                    ]);
                }

            }



            $cancelPendingTransfer = $conn->prepare("UPDATE Bed_Transfer_Order SET Status = 'Cancelled' WHERE Admission_ID = :aid AND Status = 'Pending'");
            $cancelPendingTransfer->execute([':aid' => $admissionId]);

            $cancelUnadministeredOrders = $conn->prepare("UPDATE Doctor_Order_Request SET Status = 'Cancelled' WHERE Admission_Doctor_ID IN (SELECT Admission_Doctor_ID FROM Admission_Doctor WHERE Admission_ID = :aid) AND Status NOT IN ('Administered', 'Cancelled')");
            $cancelUnadministeredOrders->execute([':aid' => $admissionId]);

            $updAdm = $conn->prepare("UPDATE Admission SET Status = 'Billed', Access_Passcode = NULL WHERE Admission_ID = :aid");

            $updAdm->execute([':aid' => $admissionId]);



            $linkAdv = $conn->prepare("UPDATE Invoice_Payment SET Invoice_ID = :iid WHERE Admission_ID = :aid AND Invoice_ID IS NULL");

            $linkAdv->execute([':iid' => $invoiceId, ':aid' => $admissionId]);



            $paymentId = null;

            $receiptNumber = null;

            if ($tenderedAtDischarge > 0) {

                $countPayments = $conn->query("SELECT COUNT(*) FROM Invoice_Payment")->fetchColumn();

                $nextReceiptNum = intval($countPayments) + 1;

                $receiptNumber = 'OR-' . str_pad($nextReceiptNum, 5, '0', STR_PAD_LEFT);

                $balAfter = max(0.00, round($remainingNetToSettle - $tenderedAtDischarge, 2));



                $insPay = $conn->prepare("

                    INSERT INTO Invoice_Payment 

                        (Invoice_ID, Admission_ID, Cashier_User_ID, Receipt_Number, Amount_Paid, Balance_Before, Balance_After, Payment_Method_ID, Notes, Is_Advance, Payment_Date)

                    VALUES 

                        (:iid, :aid, :uid, :rnum, :paid, :bb, :ba, :pmid, 'Final Discharge Settlement Payment', 0, NOW())

                ");

                $insPay->execute([

                    ':iid' => $invoiceId,

                    ':aid' => $admissionId,

                    ':uid' => $userId,

                    ':rnum' => $receiptNumber,

                    ':paid' => $tenderedAtDischarge,

                    ':bb' => $remainingNetToSettle,

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

            $rem = max(0.00, round($netAmountDue - $totalAmountPaid, 2));

            $settleDesc = "Settled invoice {$invCode} for Net: ₱" . number_format($netAmountDue, 2) . ", Advance Credited: ₱" . number_format($totalAdvancePaid, 2) . ", Tendered at Discharge: ₱" . number_format($tenderedAtDischarge, 2) . ", Total Paid: ₱" . number_format($totalAmountPaid, 2) . ", Balance: ₱" . number_format($rem, 2);



            $logStmt = $conn->prepare("

                INSERT INTO Audit_Log 

                    (User_ID, Admission_ID, Action_ID, Module_ID, Record_Reference, Description, Performed_By, Created_At)

                VALUES 

                    (:uid, :aid, 

                     COALESCE((SELECT Action_ID FROM Enum_Audit_Action WHERE Action_Type = 'Billing Settled' LIMIT 1), 14), 

                     COALESCE((SELECT Module_ID FROM Enum_Audit_Module WHERE Module_Name = 'Billing' LIMIT 1), 6), 

                     :ref, :descr, :by, NOW())

            ");

            $logStmt->execute([

                ':uid' => $userId,

                ':aid' => $admissionId,

                ':ref' => $invCode,

                ':descr' => $settleDesc,

                ':by' => $cashierName

            ]);



            $promissoryNoteId = null;

            if ($rem > 0) {

                $pnData = $json['promissory_note'] ?? [];



                $planTypeId = !empty($pnData['plan_type_id']) ? intval($pnData['plan_type_id']) : 0;

                $planCode = !empty($pnData['plan_type_code']) ? trim($pnData['plan_type_code']) : '';



                if (empty($planTypeId) && !empty($planCode)) {

                    $chkPlan = $conn->prepare("SELECT Plan_Type_ID FROM Enum_Promissory_Plan_Type WHERE Plan_Type_Code = :code LIMIT 1");

                    $chkPlan->execute([':code' => $planCode]);

                    $planTypeId = intval($chkPlan->fetchColumn());

                }



                if (empty($planTypeId)) {

                    $planTypeId = 1;

                }



                $months = !empty($pnData['installment_months']) ? max(1, intval($pnData['installment_months'])) : 1;

                $monthlyAmount = !empty($pnData['monthly_amount']) && floatval($pnData['monthly_amount']) > 0

                    ? round(floatval($pnData['monthly_amount']), 2)

                    : round(ceil(($rem / $months) * 100) / 100, 2);



                $nextDueDate = !empty($pnData['next_due_date']) ? trim($pnData['next_due_date']) : '';

                if (empty($nextDueDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $nextDueDate)) {

                    $nextDueDate = date('Y-m-d', strtotime('+30 days'));

                }



                $guarantorName = !empty($pnData['guarantor_name']) ? trim($pnData['guarantor_name']) : null;

                $guarantorContact = !empty($pnData['guarantor_contact']) ? trim($pnData['guarantor_contact']) : null;

                $pnNotes = !empty($pnData['notes']) ? trim($pnData['notes']) : 'Promissory Note agreement executed at discharge';



                $insPn = $conn->prepare("

                    INSERT INTO Promissory_Note 

                        (Invoice_ID, Admission_ID, Total_Balance_Owed, Plan_Type_ID, Installment_Months, Monthly_Amount, Next_Due_Date, Guarantor_Name, Guarantor_Contact, Notes, Status, Created_At)

                    VALUES 

                        (:iid, :aid, :bal, :ptid, :months, :mamt, :ndate, :gname, :gcontact, :notes, 'Active', NOW())

                ");

                $insPn->execute([

                    ':iid' => $invoiceId,

                    ':aid' => $admissionId,

                    ':bal' => $rem,

                    ':ptid' => $planTypeId,

                    ':months' => $months,

                    ':mamt' => $monthlyAmount,

                    ':ndate' => $nextDueDate,

                    ':gname' => $guarantorName,

                    ':gcontact' => $guarantorContact,

                    ':notes' => $pnNotes

                ]);

                $promissoryNoteId = $conn->lastInsertId();



                $logPn = $conn->prepare("

                    INSERT INTO Audit_Log 

                        (User_ID, Admission_ID, Action_ID, Module_ID, Record_Reference, Description, Performed_By, Created_At)

                    VALUES 

                        (:uid, :aid, 

                         COALESCE((SELECT Action_ID FROM Enum_Audit_Action WHERE Action_Type = 'Promissory Note Executed' LIMIT 1), 17), 

                         COALESCE((SELECT Module_ID FROM Enum_Audit_Module WHERE Module_Name = 'Billing' LIMIT 1), 6), 

                         :ref, :descr, :by, NOW())

                ");

                $logPn->execute([

                    ':uid' => $userId,

                    ':aid' => $admissionId,

                    ':ref' => $invCode,

                    ':descr' => "Executed Promissory Note agreement for balance ₱" . number_format($rem, 2) . " (Next Due: {$nextDueDate}, Schedule: ₱" . number_format($monthlyAmount, 2) . " for {$months} mo(s)). Guarantor: " . ($guarantorName ?: 'Patient'),

                    ':by' => $cashierName

                ]);

            }



            $conn->commit();

            return json_encode([

                'success' => true,

                'message' => 'Billing successfully settled and Final Invoice generated!',

                'invoice_id' => $invoiceId,

                'admission_id' => $admissionId,

                'payment_id' => $paymentId,

                'receipt_number' => $receiptNumber,

                'promissory_note_id' => $promissoryNoteId,

                'gross_total' => $grossTotal,

                'discount_amount' => $discountAmount,

                'advance_payment_amount' => $totalAdvancePaid,

                'net_amount_due' => $netAmountDue,

                'tendered_at_discharge' => $tenderedAtDischarge,

                'amount_paid' => $totalAmountPaid,

                'change_amount' => $changeAmount,

                'remaining_balance' => $rem

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

                    (User_ID, Admission_ID, Action_ID, Module_ID, Record_Reference, Description, Performed_By, Created_At)

                VALUES 

                    (:uid, :aid, 

                     COALESCE((SELECT Action_ID FROM Enum_Audit_Action WHERE Action_Type = 'Payment Received' LIMIT 1), 15), 

                     COALESCE((SELECT Module_ID FROM Enum_Audit_Module WHERE Module_Name = 'Billing' LIMIT 1), 6), 

                     :ref, :descr, :by, NOW())

            ");

            $logStmt->execute([

                ':uid' => !empty($userId) ? $userId : null,

                ':aid' => $inv['Admission_ID'],

                ':ref' => $invCode,

                ':descr' => $desc,

                ':by' => $cashierName

            ]);



            $chkPn = $conn->prepare("SELECT Note_ID, Installment_Months, Monthly_Amount FROM Promissory_Note WHERE Invoice_ID = :iid ORDER BY Note_ID DESC LIMIT 1");

            $chkPn->execute([':iid' => $inv['Invoice_ID']]);

            $pnFound = $chkPn->fetch(PDO::FETCH_ASSOC);



            if ($pnFound) {

                if ($newRemaining <= 0) {

                    $updPn = $conn->prepare("UPDATE Promissory_Note SET Total_Balance_Owed = 0.00, Status = 'Settled' WHERE Note_ID = :nid");

                    $updPn->execute([':nid' => $pnFound['Note_ID']]);

                } else {

                    $nextDueDate = date('Y-m-d', strtotime('+30 days'));

                    $updPn = $conn->prepare("UPDATE Promissory_Note SET Total_Balance_Owed = :rem, Next_Due_Date = :ndate WHERE Note_ID = :nid");

                    $updPn->execute([

                        ':rem' => $newRemaining,

                        ':ndate' => $nextDueDate,

                        ':nid' => $pnFound['Note_ID']

                    ]);

                }

            }



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



    function recordAdvancePayment($json = '{}')

    {

        include "connection.php";



        $json = is_array($json) ? $json : json_decode($json, true);

        $admissionId = intval($json['admission_id'] ?? 0);

        $userId = intval($json['user_id'] ?? 0);

        $paymentAmount = isset($json['payment_amount']) ? floatval($json['payment_amount']) : 0.00;

        $discountId = !empty($json['discount_id']) ? intval($json['discount_id']) : null;

        $discountAmount = isset($json['discount_amount']) ? max(0.00, floatval($json['discount_amount'])) : 0.00;

        $discountName = !empty($json['discount_name']) ? trim($json['discount_name']) : '';



        if (!empty($json['discounts']) && is_array($json['discounts'])) {
            $sumD = 0.00;
            $namesD = [];
            foreach ($json['discounts'] as $dItem) {
                $dAmt = max(0.00, floatval($dItem['amount'] ?? 0));
                $dName = trim($dItem['name'] ?? 'Assistance Voucher');
                $dId = !empty($dItem['discount_id']) ? intval($dItem['discount_id']) : null;
                if (!$dId && !empty($dName)) {
                    $chk = $conn->prepare("SELECT Discount_ID FROM Enum_Discount WHERE Discount_Name = :n OR :cname LIKE CONCAT('%', Discount_Name, '%') LIMIT 1");
                    $chk->execute([':n' => $dName, ':cname' => $dName]);
                    $found = $chk->fetchColumn();
                    if ($found) $dId = intval($found);
                }
                if ($dId && empty($discountId)) {
                    $discountId = $dId;
                }
                if ($dAmt > 0) {
                    $sumD += $dAmt;
                    $namesD[] = "{$dName} (₱" . number_format($dAmt, 2) . ")";
                }
            }
            if ($sumD > 0) {
                $discountAmount = $sumD;
                $discountName = implode(', ', $namesD);
            }
        }



        $paymentMethodId = !empty($json['payment_method_id']) ? intval($json['payment_method_id']) : 1;

        $notes = !empty($json['notes']) ? trim($json['notes']) : 'Advance Patient Deposit';



        if (empty($admissionId)) {

            return json_encode(['error' => 'Admission ID is required for advance billing.']);

        }



        if (empty($userId)) {

            return json_encode(['error' => 'Active user session is required. Please re-login.']);

        }



        if ($paymentAmount <= 0 && $discountAmount <= 0) {

            return json_encode(['error' => 'Please enter a payment deposit amount or discount amount.']);

        }



        try {

            $conn->beginTransaction();



            $admCheck = $conn->prepare("SELECT Admission_ID, Patient_ID, Status FROM Admission WHERE Admission_ID = :aid FOR UPDATE");

            $admCheck->execute([':aid' => $admissionId]);

            $admission = $admCheck->fetch(PDO::FETCH_ASSOC);



            if (!$admission) {

                $conn->rollBack();

                return json_encode(['error' => 'Admission record not found.']);

            }



            if ($admission['Status'] === 'Billed') {

                $conn->rollBack();

                return json_encode(['error' => 'This admission is already settled and billed. Please use the invoice payments section.']);

            }



            if (!empty($discountId)) {

                $dCheck = $conn->prepare("SELECT Discount_ID, Discount_Name, Fixed_Amount FROM Enum_Discount WHERE Discount_ID = :did AND Is_Active = 1 AND (Discount_Type_ID = 2 OR Fixed_Amount > 0)");

                $dCheck->execute([':did' => $discountId]);

                $dRow = $dCheck->fetch(PDO::FETCH_ASSOC);

                if ($dRow) {

                    $discountName = $dRow['Discount_Name'];

                    if ($discountAmount <= 0) {

                        $discountAmount = floatval($dRow['Fixed_Amount']);

                    }

                } else {

                    $discountId = null;

                    if (empty($discountName) && $discountAmount > 0) {

                        $discountName = 'Custom Discount / Assistance';

                    }

                }

            } else {

                $discountId = null;

                if (empty($discountName) && $discountAmount > 0) {

                    $discountName = 'Custom Discount / Assistance';

                }

            }



            $totalTransactionCredit = round($paymentAmount + $discountAmount, 2);

            if ($totalTransactionCredit <= 0) {

                $conn->rollBack();

                return json_encode(['error' => 'Total advance credit must be greater than zero.']);

            }



            $sumStmt = $conn->prepare("SELECT COALESCE(SUM(Total_Charge), 0.00) AS Gross_Total FROM Billing_Ledger WHERE Admission_ID = :aid");

            $sumStmt->execute([':aid' => $admissionId]);

            $ledgerGross = floatval($sumStmt->fetchColumn());



            $currStayStmt = $conn->prepare("

                SELECT 

                    rtl.Date_In, 

                    GREATEST(1, DATEDIFF(NOW(), rtl.Date_In)) AS Calculated_Days,

                    COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate

                FROM Room_Transfer_Log rtl

                INNER JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID

                INNER JOIN Room r ON rb.Room_ID = r.Room_ID

                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID

                WHERE rtl.Admission_ID = :aid AND rtl.Date_Out IS NULL

            ");

            $currStayStmt->execute([':aid' => $admissionId]);

            $stay = $currStayStmt->fetch(PDO::FETCH_ASSOC);

            $runningRoomFee = 0.00;

            if ($stay) {

                $totalDays = max(1, intval($stay['Calculated_Days'] ?? 1));

                $runningRoomFee = $totalDays * floatval($stay['Daily_Rate']);

            }



            $totalRunningEst = $ledgerGross + $runningRoomFee;



            $advStmt = $conn->prepare("SELECT COALESCE(SUM(Amount_Paid), 0.00) + COALESCE(SUM(Discount_Amount), 0.00) FROM Invoice_Payment WHERE Admission_ID = :aid AND (Invoice_ID IS NULL OR Is_Advance = 1)");

            $advStmt->execute([':aid' => $admissionId]);

            $priorAdvanceTotal = floatval($advStmt->fetchColumn());



            $balBefore = max(0.00, round($totalRunningEst - $priorAdvanceTotal, 2));

            $balAfter = max(0.00, round($balBefore - $totalTransactionCredit, 2));



            $countPayments = $conn->query("SELECT COUNT(*) FROM Invoice_Payment")->fetchColumn();

            $nextReceiptNum = intval($countPayments) + 1;

            $receiptNumber = 'OR-' . str_pad($nextReceiptNum, 5, '0', STR_PAD_LEFT);



            $insPay = $conn->prepare("

                INSERT INTO Invoice_Payment 

                    (Invoice_ID, Admission_ID, Cashier_User_ID, Receipt_Number, Amount_Paid, Balance_Before, Balance_After, Payment_Method_ID, Discount_ID, Discount_Name, Discount_Amount, Notes, Is_Advance, Payment_Date)

                VALUES 

                    (NULL, :aid, :uid, :rnum, :paid, :bb, :ba, :pmid, :did, :dname, :damt, :notes, 1, NOW())

            ");

            $insPay->execute([

                ':aid' => $admissionId,

                ':uid' => $userId,

                ':rnum' => $receiptNumber,

                ':paid' => $paymentAmount,

                ':bb' => $balBefore,

                ':ba' => $balAfter,

                ':pmid' => $paymentMethodId,

                ':did' => $discountId,

                ':dname' => !empty($discountName) ? $discountName : null,

                ':damt' => $discountAmount,

                ':notes' => $notes

            ]);

            $paymentId = $conn->lastInsertId();



            $cashierName = 'Cashier Staff';

            $uStmt = $conn->prepare("SELECT CONCAT(First_Name, ' ', Last_Name) FROM System_User WHERE User_ID = :uid");

            $uStmt->execute([':uid' => $userId]);

            $uName = $uStmt->fetchColumn();

            if ($uName) {

                $cashierName = $uName;

            }



            $methodStmt = $conn->prepare("SELECT Method_Name FROM Enum_Payment_Method WHERE Payment_Method_ID = :pmid");

            $methodStmt->execute([':pmid' => $paymentMethodId]);

            $methodName = $methodStmt->fetchColumn() ?: 'Cash';



            $admCode = 'ADM-' . str_pad($admissionId, 3, '0', STR_PAD_LEFT);

            $logDescr = "Received advance deposit of ₱" . number_format($paymentAmount, 2) . " ({$methodName})";

            if ($discountAmount > 0) {

                $logDescr .= " with ₱" . number_format($discountAmount, 2) . " discount ({$discountName})";

            }

            $logDescr .= " for {$admCode}. Remarks: {$notes}";



            $logStmt = $conn->prepare("

                INSERT INTO Audit_Log 

                    (User_ID, Admission_ID, Action_ID, Module_ID, Record_Reference, Description, Performed_By, Created_At)

                VALUES 

                    (:uid, :aid, 

                     COALESCE((SELECT Action_ID FROM Enum_Audit_Action WHERE Action_Type = 'Advance Payment Recorded' LIMIT 1), 16), 

                     COALESCE((SELECT Module_ID FROM Enum_Audit_Module WHERE Module_Name = 'Billing' LIMIT 1), 6), 

                     :ref, :descr, :by, NOW())

            ");

            $logStmt->execute([

                ':uid' => $userId,

                ':aid' => $admissionId,

                ':ref' => $receiptNumber,

                ':descr' => $logDescr,

                ':by' => $cashierName

            ]);



            $conn->commit();

            return json_encode([

                'success' => true,

                'message' => 'Advance payment recorded successfully and Official Receipt generated!',

                'payment_id' => $paymentId,

                'receipt_number' => $receiptNumber,

                'amount_paid' => $paymentAmount,

                'discount_amount' => $discountAmount,

                'total_credit' => $totalTransactionCredit,

                'balance_before' => $balBefore,

                'balance_after' => $balAfter,

                'total_advance_paid' => round($priorAdvanceTotal + $totalTransactionCredit, 2)

            ]);



        } catch (Exception $e) {

            $conn->rollBack();

            return json_encode(['error' => 'Advance payment failed: ' . $e->getMessage()]);

        }

    }

}



require_once __DIR__ . '/../ws_notify.php';

$operation = "";
$json = "{}";
if (($_SERVER['REQUEST_METHOD'] ?? '') == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "{}";
} else if (($_SERVER['REQUEST_METHOD'] ?? '') == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "{}";
}

$invoice = new InvoiceManager();
$wsOut = "";
switch ($operation) {
    case 'settleInvoice':
        $wsOut = $invoice->settleInvoice($json);
        break;
    case 'recordPayment':
        $wsOut = $invoice->recordPayment($json);
        break;
    case 'recordAdvancePayment':
        $wsOut = $invoice->recordAdvancePayment($json);
        break;
}

if ($wsOut !== "") {
    echo $wsOut;
    $wsRes = json_decode($wsOut, true);
    if (is_array($wsRes) && !empty($wsRes['success'])) {
        $wsReq = is_array($json) ? $json : (json_decode($json, true) ?: []);
        $wsAdmId = intval($wsReq['admission_id'] ?? $wsRes['admission_id'] ?? 0);
        $wsInvId = intval($wsReq['invoice_id'] ?? $wsRes['invoice_id'] ?? 0);
        broadcastWebSocketEvent('invoices', $operation, [
            'admission_id' => $wsAdmId,
            'invoice_id' => $wsInvId
        ]);
    }
}

?>

