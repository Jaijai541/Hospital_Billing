<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

class ReportManager
{
    private function getDb()
    {
        include __DIR__ . '/connection.php';
        return $conn;
    }

    public function getDailyCollections($params = [])
    {
        $conn = $this->getDb();
        $startDate = trim($params['start_date'] ?? '');
        $endDate = trim($params['end_date'] ?? '');
        $cashierId = intval($params['cashier_id'] ?? 0);
        $methodId = intval($params['method_id'] ?? 0);

        $where = [];
        $bindings = [];

        if (!empty($startDate)) {
            $where[] = "DATE(ip.Payment_Date) >= :start_date";
            $bindings[':start_date'] = $startDate;
        }

        if (!empty($endDate)) {
            $where[] = "DATE(ip.Payment_Date) <= :end_date";
            $bindings[':end_date'] = $endDate;
        }

        if ($cashierId > 0) {
            $where[] = "ip.Cashier_User_ID = :cashier_id";
            $bindings[':cashier_id'] = $cashierId;
        }

        if ($methodId > 0) {
            $where[] = "ip.Payment_Method_ID = :method_id";
            $bindings[':method_id'] = $methodId;
        }

        $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";

        $sql = "SELECT 
                    ip.Payment_ID,
                    ip.Receipt_Number,
                    DATE_FORMAT(ip.Payment_Date, '%Y-%m-%d %h:%i %p') AS Payment_Date,
                    ip.Payment_Date AS Raw_Payment_Date,
                    ip.Admission_ID,
                    CONCAT('ADM-', LPAD(ip.Admission_ID, 3, '0')) AS Admission_Code,
                    p.Patient_ID,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Patient_Name,
                    COALESCE(pm.Payment_Method_ID, 1) AS Payment_Method_ID,
                    COALESCE(pm.Method_Name, 'Cash') AS Payment_Method,
                    ip.Is_Advance,
                    CASE WHEN ip.Is_Advance = 1 THEN 'Advance Deposit' ELSE 'Final Settlement' END AS Payment_Type,
                    ip.Amount_Paid,
                    ip.Balance_Before,
                    ip.Balance_After,
                    ip.Notes,
                    ip.Cashier_User_ID,
                    CONCAT(u.First_Name, ' ', u.Last_Name) AS Cashier_Name,
                    fi.Invoice_ID,
                    CASE WHEN fi.Invoice_ID IS NOT NULL THEN CONCAT('INV-', LPAD(fi.Invoice_ID, 3, '0')) ELSE '—' END AS Invoice_Code
                FROM Invoice_Payment ip
                LEFT JOIN Final_Invoice fi ON ip.Invoice_ID = fi.Invoice_ID
                LEFT JOIN Admission a ON ip.Admission_ID = a.Admission_ID
                LEFT JOIN Patient p ON a.Patient_ID = p.Patient_ID
                LEFT JOIN System_User u ON ip.Cashier_User_ID = u.User_ID
                LEFT JOIN Enum_Payment_Method pm ON ip.Payment_Method_ID = pm.Payment_Method_ID
                $whereClause
                ORDER BY ip.Payment_Date DESC, ip.Payment_ID DESC";

        $stmt = $conn->prepare($sql);
        foreach ($bindings as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->execute();
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalCollections = 0.00;
        $advanceTotal = 0.00;
        $settlementTotal = 0.00;
        $methodBreakdown = [];

        foreach ($records as $r) {
            $amt = floatval($r['Amount_Paid']);
            $totalCollections += $amt;
            if (intval($r['Is_Advance']) === 1) {
                $advanceTotal += $amt;
            } else {
                $settlementTotal += $amt;
            }

            $methodName = $r['Payment_Method'];
            if (!isset($methodBreakdown[$methodName])) {
                $methodBreakdown[$methodName] = [
                    'Method_Name' => $methodName,
                    'Transaction_Count' => 0,
                    'Total_Amount' => 0.00
                ];
            }
            $methodBreakdown[$methodName]['Transaction_Count']++;
            $methodBreakdown[$methodName]['Total_Amount'] += $amt;
        }

        return [
            'status' => 'success',
            'report_type' => 'collections',
            'summary' => [
                'total_collections' => $totalCollections,
                'advance_total' => $advanceTotal,
                'settlement_total' => $settlementTotal,
                'transaction_count' => count($records),
                'by_method' => array_values($methodBreakdown)
            ],
            'records' => $records
        ];
    }

    public function getDepartmentRevenue($params = [])
    {
        $conn = $this->getDb();
        $startDate = trim($params['start_date'] ?? '');
        $endDate = trim($params['end_date'] ?? '');

        $joinDateConditions = [];
        $whereDetails = [];
        $bindings = [];

        if (!empty($startDate)) {
            $joinDateConditions[] = "DATE(bl.Timestamp) >= :start_date";
            $whereDetails[] = "DATE(bl.Timestamp) >= :start_date";
            $bindings[':start_date'] = $startDate;
        }

        if (!empty($endDate)) {
            $joinDateConditions[] = "DATE(bl.Timestamp) <= :end_date";
            $whereDetails[] = "DATE(bl.Timestamp) <= :end_date";
            $bindings[':end_date'] = $endDate;
        }

        $joinDateSql = !empty($joinDateConditions) ? " AND " . implode(" AND ", $joinDateConditions) : "";

        $summarySql = "SELECT 
                            s.Station_ID,
                            s.Station_Name,
                            s.Code_Prefix,
                            COUNT(bl.Ledger_ID) AS Total_Transactions,
                            SUM(CASE WHEN bl.Transaction_Type = 'Charge' THEN bl.Total_Charge ELSE 0.00 END) AS Gross_Charges,
                            SUM(CASE WHEN bl.Transaction_Type = 'Return' THEN ABS(bl.Total_Charge) ELSE 0.00 END) AS Total_Returns,
                            SUM(COALESCE(bl.Total_Charge, 0.00)) AS Net_Revenue
                        FROM Enum_Department_Station s
                        LEFT JOIN Billing_Ledger bl ON s.Station_ID = bl.Station_ID $joinDateSql
                        WHERE s.Is_Active = 1
                        GROUP BY s.Station_ID, s.Station_Name, s.Code_Prefix
                        ORDER BY Net_Revenue DESC, s.Station_Name ASC";

        $summaryStmt = $conn->prepare($summarySql);
        foreach ($bindings as $key => $val) {
            $summaryStmt->bindValue($key, $val);
        }
        $summaryStmt->execute();
        $stationSummaries = $summaryStmt->fetchAll(PDO::FETCH_ASSOC);

        $grandGross = 0.00;
        $grandReturns = 0.00;
        $grandNet = 0.00;
        $grandTransactions = 0;

        foreach ($stationSummaries as &$st) {
            $gross = floatval($st['Gross_Charges'] ?? 0);
            $returns = floatval($st['Total_Returns'] ?? 0);
            $net = floatval($st['Net_Revenue'] ?? 0);
            $count = intval($st['Total_Transactions'] ?? 0);

            $st['Gross_Charges'] = $gross;
            $st['Total_Returns'] = $returns;
            $st['Net_Revenue'] = $net;
            $st['Total_Transactions'] = $count;

            $grandGross += $gross;
            $grandReturns += $returns;
            $grandNet += $net;
            $grandTransactions += $count;
        }
        unset($st);

        foreach ($stationSummaries as &$st) {
            $st['Revenue_Share_Pct'] = $grandNet > 0 ? round(($st['Net_Revenue'] / $grandNet) * 100, 2) : 0.00;
        }
        unset($st);

        $detailsWhereClause = !empty($whereDetails) ? "WHERE " . implode(" AND ", $whereDetails) : "";

        $detailsSql = "SELECT 
                            bl.Ledger_ID,
                            DATE_FORMAT(bl.Timestamp, '%Y-%m-%d %h:%i %p') AS Formatted_Date,
                            bl.Admission_ID,
                            CONCAT('ADM-', LPAD(bl.Admission_ID, 3, '0')) AS Admission_Code,
                            CONCAT(p.Last_Name, ', ', p.First_Name) AS Patient_Name,
                            s.Station_Name,
                            bl.Transaction_Type,
                            bl.Quantity,
                            bl.Unit_Price,
                            bl.Total_Charge,
                            CASE 
                                WHEN bl.Catalog_ID IS NOT NULL THEN cc.Item_Name
                                WHEN bl.Request_ID IS NOT NULL THEN req_cat.Item_Name
                                WHEN bl.Round_ID IS NOT NULL THEN CONCAT('Dr. ', doc.Last_Name, ' Bedside Round')
                                WHEN bl.Transfer_ID IS NOT NULL THEN CONCAT(rm.Room_Name, ' (Bed ', rb.Bed_Code, ')')
                                ELSE 'Hospital Service / Charge'
                            END AS Item_Description,
                            CASE 
                                WHEN bl.Catalog_ID IS NOT NULL THEN cc.Category_Type
                                WHEN bl.Request_ID IS NOT NULL THEN req_cat.Category_Type
                                WHEN bl.Round_ID IS NOT NULL THEN 'Doctor Round'
                                WHEN bl.Transfer_ID IS NOT NULL THEN 'Board & Lodging'
                                ELSE 'Hospital Service'
                            END AS Item_Category
                        FROM Billing_Ledger bl
                        JOIN Enum_Department_Station s ON bl.Station_ID = s.Station_ID
                        JOIN Admission a ON bl.Admission_ID = a.Admission_ID
                        JOIN Patient p ON a.Patient_ID = p.Patient_ID
                        LEFT JOIN Charge_Catalogs cc ON bl.Catalog_ID = cc.Catalog_ID
                        LEFT JOIN Doctor_Order_Request dor ON bl.Request_ID = dor.Request_ID
                        LEFT JOIN Charge_Catalogs req_cat ON dor.Catalog_ID = req_cat.Catalog_ID
                        LEFT JOIN Doctor_Round_Log drl ON bl.Round_ID = drl.Round_ID
                        LEFT JOIN Admission_Doctor ad ON drl.Admission_Doctor_ID = ad.Admission_Doctor_ID
                        LEFT JOIN Doctor doc ON ad.Doctor_ID = doc.Doctor_ID
                        LEFT JOIN Room_Transfer_Log rtl ON bl.Transfer_ID = rtl.Transfer_ID
                        LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                        LEFT JOIN Room rm ON rb.Room_ID = rm.Room_ID
                        $detailsWhereClause
                        ORDER BY bl.Timestamp DESC, bl.Ledger_ID DESC";

        $detailsStmt = $conn->prepare($detailsSql);
        foreach ($bindings as $key => $val) {
            $detailsStmt->bindValue($key, $val);
        }
        $detailsStmt->execute();
        $details = $detailsStmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'status' => 'success',
            'report_type' => 'department_revenue',
            'summary' => [
                'grand_gross' => $grandGross,
                'grand_returns' => $grandReturns,
                'grand_net' => $grandNet,
                'grand_transactions' => $grandTransactions,
                'by_station' => $stationSummaries
            ],
            'records' => $details
        ];
    }

    public function getDoctorFeesSummary($params = [])
    {
        $conn = $this->getDb();
        $startDate = trim($params['start_date'] ?? '');
        $endDate = trim($params['end_date'] ?? '');
        $doctorId = intval($params['doctor_id'] ?? 0);

        $joinDateConditions = [];
        $whereItemized = [];
        $bindings = [];

        if (!empty($startDate)) {
            $joinDateConditions[] = "DATE(drl.Round_Timestamp) >= :start_date";
            $whereItemized[] = "DATE(drl.Round_Timestamp) >= :start_date";
            $bindings[':start_date'] = $startDate;
        }

        if (!empty($endDate)) {
            $joinDateConditions[] = "DATE(drl.Round_Timestamp) <= :end_date";
            $whereItemized[] = "DATE(drl.Round_Timestamp) <= :end_date";
            $bindings[':end_date'] = $endDate;
        }

        $joinDateSql = !empty($joinDateConditions) ? " AND " . implode(" AND ", $joinDateConditions) : "";

        $whereDoctor = ["d.Is_Active = 1"];
        if ($doctorId > 0) {
            $whereDoctor[] = "d.Doctor_ID = :doctor_id";
            $whereItemized[] = "d.Doctor_ID = :doctor_id";
            $bindings[':doctor_id'] = $doctorId;
        }
        $whereDoctorSql = "WHERE " . implode(" AND ", $whereDoctor);

        $summarySql = "SELECT 
                            d.Doctor_ID,
                            CONCAT('DOC-', LPAD(d.Doctor_ID, 3, '0')) AS Doctor_Code,
                            CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                            COALESCE(dt.Type_Name, 'Physician') AS Doctor_Type,
                            COALESCE(ds.Station_Name, 'General Practice') AS Department_Station,
                            d.Base_Round_Fee,
                            COUNT(drl.Round_ID) AS Total_Rounds,
                            COUNT(DISTINCT a.Patient_ID) AS Unique_Patients_Attended,
                            SUM(COALESCE(drl.Charged_Fee, 0.00)) AS Total_PF_Generated
                        FROM Doctor d
                        LEFT JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
                        LEFT JOIN Enum_Department_Station ds ON d.Station_ID = ds.Station_ID
                        LEFT JOIN Admission_Doctor ad ON d.Doctor_ID = ad.Doctor_ID
                        LEFT JOIN Admission a ON ad.Admission_ID = a.Admission_ID
                        LEFT JOIN Doctor_Round_Log drl ON ad.Admission_Doctor_ID = drl.Admission_Doctor_ID $joinDateSql
                        $whereDoctorSql
                        GROUP BY d.Doctor_ID, d.First_Name, d.Last_Name, dt.Type_Name, ds.Station_Name, d.Base_Round_Fee
                        ORDER BY Total_PF_Generated DESC, Total_Rounds DESC, d.Last_Name ASC";

        $summaryStmt = $conn->prepare($summarySql);
        foreach ($bindings as $key => $val) {
            $summaryStmt->bindValue($key, $val);
        }
        $summaryStmt->execute();
        $doctorSummaries = $summaryStmt->fetchAll(PDO::FETCH_ASSOC);

        $grandPF = 0.00;
        $grandRounds = 0;

        foreach ($doctorSummaries as &$doc) {
            $pf = floatval($doc['Total_PF_Generated'] ?? 0);
            $rounds = intval($doc['Total_Rounds'] ?? 0);
            $doc['Total_PF_Generated'] = $pf;
            $doc['Total_Rounds'] = $rounds;
            $doc['Unique_Patients_Attended'] = intval($doc['Unique_Patients_Attended'] ?? 0);
            $doc['Base_Round_Fee'] = floatval($doc['Base_Round_Fee'] ?? 0);

            $grandPF += $pf;
            $grandRounds += $rounds;
        }
        unset($doc);

        $itemizedWhereSql = !empty($whereItemized) ? "WHERE " . implode(" AND ", $whereItemized) : "";

        $itemizedSql = "SELECT 
                            drl.Round_ID,
                            DATE_FORMAT(drl.Round_Timestamp, '%Y-%m-%d %h:%i %p') AS Round_Date,
                            CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                            COALESCE(dt.Type_Name, 'Physician') AS Doctor_Type,
                            CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                            CONCAT(p.Last_Name, ', ', p.First_Name) AS Patient_Name,
                            a.Status AS Admission_Status,
                            drl.Charged_Fee,
                            COALESCE(a.Diagnosis, 'Under Assessment') AS Clinical_Diagnosis
                        FROM Doctor_Round_Log drl
                        JOIN Admission_Doctor ad ON drl.Admission_Doctor_ID = ad.Admission_Doctor_ID
                        JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                        LEFT JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
                        JOIN Admission a ON ad.Admission_ID = a.Admission_ID
                        JOIN Patient p ON a.Patient_ID = p.Patient_ID
                        $itemizedWhereSql
                        ORDER BY drl.Round_Timestamp DESC, drl.Round_ID DESC";

        $itemizedStmt = $conn->prepare($itemizedSql);
        foreach ($bindings as $key => $val) {
            $itemizedStmt->bindValue($key, $val);
        }
        $itemizedStmt->execute();
        $itemized = $itemizedStmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'status' => 'success',
            'report_type' => 'doctor_fees',
            'summary' => [
                'grand_pf_total' => $grandPF,
                'grand_rounds_count' => $grandRounds,
                'doctors_count' => count($doctorSummaries),
                'by_doctor' => $doctorSummaries
            ],
            'records' => $itemized
        ];
    }

    public function getAgingAccountsReceivable($params = [])
    {
        $conn = $this->getDb();
        $statusFilter = trim($params['status'] ?? '');

        $where = [];
        $bindings = [];

        if (!empty($statusFilter)) {
            $where[] = "pn.Status = :status";
            $bindings[':status'] = $statusFilter;
        }

        $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";

        $sql = "SELECT 
                    pn.Note_ID,
                    CONCAT('PN-', LPAD(pn.Note_ID, 3, '0')) AS Note_Code,
                    pn.Invoice_ID,
                    CONCAT('INV-', LPAD(fi.Invoice_ID, 3, '0')) AS Invoice_Code,
                    pn.Admission_ID,
                    CONCAT('ADM-', LPAD(pn.Admission_ID, 3, '0')) AS Admission_Code,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Patient_Name,
                    p.Contact_Number AS Patient_Contact,
                    ppt.Plan_Type_Name,
                    pn.Installment_Months,
                    pn.Monthly_Amount,
                    pn.Total_Balance_Owed,
                    DATE_FORMAT(pn.Next_Due_Date, '%Y-%m-%d') AS Due_Date,
                    DATEDIFF(CURDATE(), pn.Next_Due_Date) AS Days_Overdue,
                    CASE 
                        WHEN pn.Status = 'Settled' THEN 'Settled (Fully Paid)'
                        WHEN DATEDIFF(CURDATE(), pn.Next_Due_Date) <= 0 THEN 'Current (Not Due)'
                        WHEN DATEDIFF(CURDATE(), pn.Next_Due_Date) BETWEEN 1 AND 30 THEN '1-30 Days Overdue'
                        WHEN DATEDIFF(CURDATE(), pn.Next_Due_Date) BETWEEN 31 AND 60 THEN '31-60 Days Overdue'
                        WHEN DATEDIFF(CURDATE(), pn.Next_Due_Date) BETWEEN 61 AND 90 THEN '61-90 Days Overdue'
                        ELSE '90+ Days (High Risk)'
                    END AS Aging_Bracket,
                    COALESCE(pn.Guarantor_Name, 'Self / None') AS Guarantor_Name,
                    COALESCE(pn.Guarantor_Contact, '—') AS Guarantor_Contact,
                    pn.Status,
                    DATE_FORMAT(pn.Created_At, '%Y-%m-%d') AS Agreement_Date
                FROM Promissory_Note pn
                JOIN Final_Invoice fi ON pn.Invoice_ID = fi.Invoice_ID
                JOIN Admission a ON pn.Admission_ID = a.Admission_ID
                JOIN Patient p ON a.Patient_ID = p.Patient_ID
                JOIN Enum_Promissory_Plan_Type ppt ON pn.Plan_Type_ID = ppt.Plan_Type_ID
                $whereClause
                ORDER BY 
                    CASE WHEN pn.Status = 'Overdue' THEN 1 WHEN pn.Status = 'Active' THEN 2 ELSE 3 END,
                    pn.Next_Due_Date ASC,
                    pn.Note_ID DESC";

        $stmt = $conn->prepare($sql);
        foreach ($bindings as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->execute();
        $notes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalAR = 0.00;
        $currentAR = 0.00;
        $overdue30 = 0.00;
        $overdue60 = 0.00;
        $overdue90 = 0.00;
        $overdueOver90 = 0.00;
        $settledTotal = 0.00;

        foreach ($notes as $n) {
            $bal = floatval($n['Total_Balance_Owed']);
            $bracket = $n['Aging_Bracket'];

            if ($n['Status'] === 'Settled') {
                $settledTotal += $bal;
            } else {
                $totalAR += $bal;
                if ($bracket === 'Current (Not Due)') {
                    $currentAR += $bal;
                } elseif ($bracket === '1-30 Days Overdue') {
                    $overdue30 += $bal;
                } elseif ($bracket === '31-60 Days Overdue') {
                    $overdue60 += $bal;
                } elseif ($bracket === '61-90 Days Overdue') {
                    $overdue90 += $bal;
                } elseif ($bracket === '90+ Days (High Risk)') {
                    $overdueOver90 += $bal;
                }
            }
        }

        return [
            'status' => 'success',
            'report_type' => 'ar_aging',
            'summary' => [
                'total_active_ar' => $totalAR,
                'current_not_due' => $currentAR,
                'overdue_1_30' => $overdue30,
                'overdue_31_60' => $overdue60,
                'overdue_61_90' => $overdue90,
                'overdue_over_90' => $overdueOver90,
                'total_settled' => $settledTotal,
                'notes_count' => count($notes)
            ],
            'records' => $notes
        ];
    }

    public function getBedOccupancySummary()
    {
        $conn = $this->getDb();

        $roomsSql = "SELECT 
                        r.Room_ID,
                        r.Room_Name,
                        rt.Type_Name AS Room_Type,
                        COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate,
                        r.Capacity,
                        COUNT(b.Bed_ID) AS Total_Beds,
                        SUM(CASE WHEN b.Is_Available = 0 THEN 1 ELSE 0 END) AS Occupied_Beds,
                        SUM(CASE WHEN b.Is_Available = 1 THEN 1 ELSE 0 END) AS Vacant_Beds
                    FROM Room r
                    JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                    LEFT JOIN Room_Bed b ON r.Room_ID = b.Room_ID AND b.Is_Active = 1
                    WHERE r.Is_Active = 1
                    GROUP BY r.Room_ID, r.Room_Name, rt.Type_Name, r.Custom_Daily_Rate, rt.Daily_Rate, r.Capacity
                    ORDER BY rt.Type_Name ASC, r.Room_Name ASC";

        $roomsStmt = $conn->prepare($roomsSql);
        $roomsStmt->execute();
        $roomSummaries = $roomsStmt->fetchAll(PDO::FETCH_ASSOC);

        $hospitalTotalBeds = 0;
        $hospitalOccupied = 0;
        $hospitalVacant = 0;

        foreach ($roomSummaries as &$rm) {
            $total = intval($rm['Total_Beds'] ?? 0);
            $occ = intval($rm['Occupied_Beds'] ?? 0);
            $vac = intval($rm['Vacant_Beds'] ?? 0);

            $rm['Total_Beds'] = $total;
            $rm['Occupied_Beds'] = $occ;
            $rm['Vacant_Beds'] = $vac;
            $rm['Daily_Rate'] = floatval($rm['Daily_Rate']);
            $rm['Occupancy_Rate'] = $total > 0 ? round(($occ / $total) * 100, 1) : 0.0;

            $hospitalTotalBeds += $total;
            $hospitalOccupied += $occ;
            $hospitalVacant += $vac;
        }
        unset($rm);

        $occupantsSql = "SELECT 
                            b.Bed_ID,
                            b.Bed_Code,
                            r.Room_Name,
                            rt.Type_Name AS Room_Type,
                            COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate,
                            a.Admission_ID,
                            CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                            CONCAT(p.Last_Name, ', ', p.First_Name) AS Patient_Name,
                            DATE_FORMAT(rtl.Date_In, '%Y-%m-%d %h:%i %p') AS Bed_Admitted_Date,
                            GREATEST(1, DATEDIFF(CURDATE(), DATE(rtl.Date_In))) AS Current_Stay_Days,
                            (GREATEST(1, DATEDIFF(CURDATE(), DATE(rtl.Date_In))) * COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate)) AS Estimated_Accumulating_Room_Fee,
                            COALESCE(a.Diagnosis, a.Chief_Complaint) AS Medical_Assessment
                        FROM Room_Transfer_Log rtl
                        JOIN Room_Bed b ON rtl.Bed_ID = b.Bed_ID
                        JOIN Room r ON b.Room_ID = r.Room_ID
                        JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                        JOIN Admission a ON rtl.Admission_ID = a.Admission_ID
                        JOIN Patient p ON a.Patient_ID = p.Patient_ID
                        WHERE rtl.Date_Out IS NULL AND a.Status = 'Admitted'
                        ORDER BY r.Room_Name ASC, b.Bed_Code ASC";

        $occStmt = $conn->prepare($occupantsSql);
        $occStmt->execute();
        $occupants = $occStmt->fetchAll(PDO::FETCH_ASSOC);

        $hospitalOccupancyRate = $hospitalTotalBeds > 0 ? round(($hospitalOccupied / $hospitalTotalBeds) * 100, 1) : 0.0;

        return [
            'status' => 'success',
            'report_type' => 'bed_occupancy',
            'summary' => [
                'total_beds' => $hospitalTotalBeds,
                'occupied_beds' => $hospitalOccupied,
                'vacant_beds' => $hospitalVacant,
                'occupancy_rate' => $hospitalOccupancyRate,
                'rooms_count' => count($roomSummaries),
                'by_room' => $roomSummaries
            ],
            'records' => $occupants
        ];
    }

    public function getFilterLookups()
    {
        $conn = $this->getDb();

        $cashiersStmt = $conn->query("SELECT User_ID, CONCAT(First_Name, ' ', Last_Name) AS Full_Name FROM System_User WHERE Is_Active = 1 ORDER BY First_Name ASC");
        $cashiers = $cashiersStmt->fetchAll(PDO::FETCH_ASSOC);

        $doctorsStmt = $conn->query("SELECT Doctor_ID, CONCAT('Dr. ', First_Name, ' ', Last_Name) AS Full_Name FROM Doctor WHERE Is_Active = 1 ORDER BY Last_Name ASC");
        $doctors = $doctorsStmt->fetchAll(PDO::FETCH_ASSOC);

        $methodsStmt = $conn->query("SELECT Payment_Method_ID, Method_Name FROM Enum_Payment_Method WHERE Is_Active = 1 AND Code_Prefix NOT IN ('AR', 'NR') ORDER BY Payment_Method_ID ASC");
        $methods = $methodsStmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'status' => 'success',
            'cashiers' => $cashiers,
            'doctors' => $doctors,
            'payment_methods' => $methods
        ];
    }
}

$reportManager = new ReportManager();
$action = trim($_GET['action'] ?? 'collections');

switch ($action) {
    case 'collections':
        echo json_encode($reportManager->getDailyCollections($_GET));
        break;
    case 'department_revenue':
        echo json_encode($reportManager->getDepartmentRevenue($_GET));
        break;
    case 'doctor_fees':
        echo json_encode($reportManager->getDoctorFeesSummary($_GET));
        break;
    case 'ar_aging':
        echo json_encode($reportManager->getAgingAccountsReceivable($_GET));
        break;
    case 'bed_occupancy':
        echo json_encode($reportManager->getBedOccupancySummary());
        break;
    case 'lookups':
        echo json_encode($reportManager->getFilterLookups());
        break;
    default:
        echo json_encode(['status' => 'error', 'message' => 'Invalid report action specified.']);
        break;
}
