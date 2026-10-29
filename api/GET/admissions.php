<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class AdmissionManager
{
    private function ensureBedTransferOrderTable($conn)
    {
        $conn->exec("
            CREATE TABLE IF NOT EXISTS Bed_Transfer_Order (
                Transfer_Order_ID INT(11) NOT NULL AUTO_INCREMENT,
                Admission_ID INT(11) NOT NULL,
                Doctor_ID INT(11) NOT NULL,
                Ordered_By_User_ID INT(11) DEFAULT NULL,
                Target_Room_Type_ID INT(11) DEFAULT NULL,
                Clinical_Reason TEXT NOT NULL,
                Status ENUM('Pending', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
                Fulfilled_By_User_ID INT(11) DEFAULT NULL,
                Fulfilled_Transfer_ID INT(11) DEFAULT NULL,
                Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                Fulfilled_At DATETIME DEFAULT NULL,
                PRIMARY KEY (Transfer_Order_ID),
                KEY idx_bto_admission (Admission_ID, Status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
    }

    function getAllAdmissions($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $statusFilter = $json['status'] ?? 'all';
        $search = trim($json['search'] ?? '');
        $sort = $json['sort'] ?? 'id_desc';
        $userId = intval($json['user_id'] ?? 0);
        $doctorId = intval($json['doctor_id'] ?? 0);

        if ($userId > 0 && empty($doctorId)) {
            $docStmt = $conn->prepare("SELECT Doctor_ID FROM Doctor WHERE User_ID = :uid AND Is_Active = 1 LIMIT 1");
            $docStmt->execute([':uid' => $userId]);
            $foundDoc = $docStmt->fetchColumn();
            if ($foundDoc) {
                $doctorId = intval($foundDoc);
            }
        }

        $sql = "SELECT 
                    a.Admission_ID,
                    a.Patient_ID,
                    CASE WHEN a.Status IN ('Discharged', 'Billed') THEN NULL ELSE COALESCE(a.Access_Passcode, CONCAT('ADM-', LPAD(a.Admission_ID, 4, '0'))) END AS Access_Passcode,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Patient_Name,
                    p.Contact_Number,
                    a.Chief_Complaint,
                    a.Diagnosis,
                    DATE_FORMAT(a.Admission_Date, '%Y-%m-%d %h:%i %p') AS Admission_Date,
                    a.Status,
                    a.Medical_Discharge_Date,
                    DATE_FORMAT(a.Medical_Discharge_Date, '%Y-%m-%d %h:%i %p') AS Formatted_Medical_Discharge_Date,
                    a.Medical_Discharge_Doctor_ID,
                    (SELECT CONCAT('Dr. ', md_doc.First_Name, ' ', md_doc.Last_Name) FROM Doctor md_doc WHERE md_doc.Doctor_ID = a.Medical_Discharge_Doctor_ID) AS Medical_Discharge_Doctor_Name,
                    a.Discharge_Instructions,
                    rb.Bed_Code,
                    r.Room_Name,
                    rt.Room_Type_ID,
                    rt.Type_Name AS Room_Type,
                    COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate,
                    (
                        SELECT GROUP_CONCAT(CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) SEPARATOR '; ')
                        FROM Admission_Doctor ad
                        INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                        WHERE ad.Admission_ID = a.Admission_ID
                    ) AS Assigned_Doctors,
                    fi.Invoice_ID,
                    fi.Net_Amount_Due,
                    fi.Amount_Paid,
                    GREATEST(0, ROUND(COALESCE(fi.Net_Amount_Due, 0) - COALESCE(fi.Amount_Paid, 0), 2)) AS Remaining_Balance,
                    (SELECT COUNT(*) FROM Admission WHERE Patient_ID = a.Patient_ID) AS Total_Admissions,
                    (SELECT COUNT(*) FROM Admission WHERE Patient_ID = a.Patient_ID AND Admission_ID <= a.Admission_ID) AS Admission_Sequence,
                    pn.Note_ID AS Promissory_Note_ID,
                    ppt.Plan_Type_Code AS Promissory_Plan_Code,
                    ppt.Plan_Type_Name AS Promissory_Plan_Name,
                    pn.Installment_Months AS Promissory_Months,
                    pn.Monthly_Amount AS Promissory_Monthly_Amount,
                    DATE_FORMAT(pn.Next_Due_Date, '%Y-%m-%d') AS Promissory_Next_Due_Date,
                    DATE_FORMAT(pn.Next_Due_Date, '%b %d, %Y') AS Formatted_Promissory_Next_Due_Date,
                    pn.Status AS Promissory_Status
                FROM Admission a
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                LEFT JOIN Room_Transfer_Log rtl ON rtl.Admission_ID = a.Admission_ID AND rtl.Date_Out IS NULL
                LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                LEFT JOIN Room r ON rb.Room_ID = r.Room_ID
                LEFT JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                LEFT JOIN Final_Invoice fi ON fi.Admission_ID = a.Admission_ID
                LEFT JOIN Promissory_Note pn ON pn.Admission_ID = a.Admission_ID
                LEFT JOIN Enum_Promissory_Plan_Type ppt ON pn.Plan_Type_ID = ppt.Plan_Type_ID
                WHERE 1=1";

        $params = [];

        if ($doctorId > 0) {
            $sql .= " AND EXISTS (SELECT 1 FROM Admission_Doctor doc_filter WHERE doc_filter.Admission_ID = a.Admission_ID AND doc_filter.Doctor_ID = :doc_filter_id)";
            $params[':doc_filter_id'] = $doctorId;
        }

        if ($statusFilter !== 'all' && !empty($statusFilter)) {
            if ($statusFilter === 'Settled') {
                $sql .= " AND a.Status = 'Billed' AND GREATEST(0, ROUND(COALESCE(fi.Net_Amount_Due, 0) - COALESCE(fi.Amount_Paid, 0), 2)) <= 0";
            } else if ($statusFilter === 'WithBalance') {
                $sql .= " AND a.Status = 'Billed' AND GREATEST(0, ROUND(COALESCE(fi.Net_Amount_Due, 0) - COALESCE(fi.Amount_Paid, 0), 2)) > 0";
            } else {
                $sql .= " AND a.Status = :status";
                $params[':status'] = $statusFilter;
            }
        }

        if (!empty($search)) {
            $numOnly = preg_replace('/[^0-9]/', '', $search);
            $searchId = !empty($numOnly) ? intval($numOnly) : 0;
            $sql .= " AND (p.First_Name LIKE :search 
                           OR p.Last_Name LIKE :search 
                           OR CONCAT(p.Last_Name, ', ', p.First_Name) LIKE :search
                           OR CONCAT(p.First_Name, ' ', p.Last_Name) LIKE :search
                           OR CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) LIKE :search
                           OR rb.Bed_Code LIKE :search 
                           OR r.Room_Name LIKE :search
                           OR a.Chief_Complaint LIKE :search 
                           OR a.Diagnosis LIKE :search 
                           OR CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) LIKE :search
                           OR CAST(a.Admission_ID AS CHAR) LIKE :search
                           OR a.Admission_ID = :search_id)";
            $params[':search'] = "%{$search}%";
            $params[':search_id'] = $searchId;
        }

        switch ($sort) {
            case 'id_asc':
                $sql .= " ORDER BY a.Admission_ID ASC";
                break;
            case 'name_asc':
                $sql .= " ORDER BY p.Last_Name ASC, p.First_Name ASC";
                break;
            case 'name_desc':
                $sql .= " ORDER BY p.Last_Name DESC, p.First_Name DESC";
                break;
            case 'date_desc':
                $sql .= " ORDER BY a.Admission_Date DESC";
                break;
            case 'date_asc':
                $sql .= " ORDER BY a.Admission_Date ASC";
                break;
            case 'balance_desc':
                $sql .= " ORDER BY Remaining_Balance DESC, a.Admission_ID DESC";
                break;
            case 'balance_asc':
                $sql .= " ORDER BY Remaining_Balance ASC, a.Admission_ID DESC";
                break;
            default:
                $sql .= " ORDER BY a.Admission_ID DESC";
                break;
        }

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $admissions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($admissions);
    }

    function getAdmissionById($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $id = intval($json['id'] ?? $json['admission_id'] ?? 0);

        if (empty($id)) {
            return json_encode(['error' => 'Admission ID is required.']);
        }

        $userId = intval($json['user_id'] ?? 0);
        $doctorId = intval($json['doctor_id'] ?? 0);
        $roleId = intval($json['role_id'] ?? 0);

        if ($userId > 0 && empty($doctorId)) {
            $docStmt = $conn->prepare("SELECT Doctor_ID FROM Doctor WHERE User_ID = :uid AND Is_Active = 1 LIMIT 1");
            $docStmt->execute([':uid' => $userId]);
            $foundDoc = $docStmt->fetchColumn();
            if ($foundDoc) {
                $doctorId = intval($foundDoc);
            }
        }

        if ($doctorId > 0 && $roleId !== 1) {
            $checkDoc = $conn->prepare("SELECT COUNT(*) FROM Admission_Doctor WHERE Admission_ID = :aid AND Doctor_ID = :did");
            $checkDoc->execute([':aid' => $id, ':did' => $doctorId]);
            if (intval($checkDoc->fetchColumn()) === 0) {
                return json_encode(['error' => 'Access Restricted: Confidentiality Protocol: You are not assigned as an attending physician for this in-patient.']);
            }
        }

        $sql = "SELECT 
                    a.Admission_ID,
                    CASE WHEN a.Status IN ('Discharged', 'Billed') THEN NULL ELSE COALESCE(a.Access_Passcode, CONCAT('ADM-', LPAD(a.Admission_ID, 4, '0'))) END AS Access_Passcode,
                    a.Chief_Complaint,
                    a.Diagnosis,
                    DATE_FORMAT(a.Admission_Date, '%Y-%m-%d %h:%i %p') AS Admission_Date,
                    a.Status,
                    a.Medical_Discharge_Date,
                    DATE_FORMAT(a.Medical_Discharge_Date, '%Y-%m-%d %h:%i %p') AS Formatted_Medical_Discharge_Date,
                    a.Medical_Discharge_Doctor_ID,
                    (SELECT CONCAT('Dr. ', md_doc.First_Name, ' ', md_doc.Last_Name) FROM Doctor md_doc WHERE md_doc.Doctor_ID = a.Medical_Discharge_Doctor_ID) AS Medical_Discharge_Doctor_Name,
                    a.Discharge_Instructions,
                    p.Patient_ID,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                    p.First_Name,
                    p.Last_Name,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Full_Name,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Patient_Name,
                    p.Date_Of_Birth,
                    TIMESTAMPDIFF(YEAR, p.Date_Of_Birth, CURDATE()) AS Age,
                    g.Gender_Name,
                    bt.Blood_Type_Name,
                    p.Contact_Number,
                    p.Address,
                    p.Emergency_Contact_Name,
                    p.Emergency_Contact_Number,
                    rtl.Transfer_ID,
                    rtl.Bed_ID,
                    rb.Bed_Code,
                    r.Room_Name,
                    rt.Room_Type_ID,
                    rt.Type_Name AS Room_Type,
                    COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate,
                    DATE_FORMAT(rtl.Date_In, '%Y-%m-%d %h:%i %p') AS Bed_Date_In,
                    DATE_FORMAT(rtl.Date_In, '%Y-%m-%d %h:%i %p') AS Bed_Assigned_Since,
                    fi.Invoice_ID,
                    fi.Net_Amount_Due,
                    fi.Amount_Paid,
                    GREATEST(0, ROUND(COALESCE(fi.Net_Amount_Due, 0) - COALESCE(fi.Amount_Paid, 0), 2)) AS Remaining_Balance,
                    (SELECT COUNT(*) FROM Admission WHERE Patient_ID = a.Patient_ID) AS Total_Admissions,
                    (SELECT COUNT(*) FROM Admission WHERE Patient_ID = a.Patient_ID AND Admission_ID <= a.Admission_ID) AS Admission_Sequence
                FROM Admission a
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                LEFT JOIN Enum_Gender g ON p.Gender_ID = g.Gender_ID
                LEFT JOIN Enum_Blood_Type bt ON p.Blood_Type_ID = bt.Blood_Type_ID
                LEFT JOIN Room_Transfer_Log rtl ON rtl.Admission_ID = a.Admission_ID AND rtl.Date_Out IS NULL
                LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                LEFT JOIN Room r ON rb.Room_ID = r.Room_ID
                LEFT JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                LEFT JOIN Final_Invoice fi ON fi.Admission_ID = a.Admission_ID
                WHERE a.Admission_ID = :id";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':id' => $id]);
        $admission = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$admission) {
            return json_encode(['error' => 'Admission record not found.']);
        }

        $docSql = "SELECT 
                    ad.Admission_Doctor_ID,
                    d.Doctor_ID,
                    CONCAT(d.Code_Prefix, '-', LPAD(d.Doctor_ID, 3, '0')) AS Doctor_Code,
                    CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                    dt.Type_Name AS Doctor_Type,
                    d.Base_Round_Fee,
                    d.Station_ID,
                    DATE_FORMAT(ad.Assigned_Date, '%Y-%m-%d %h:%i %p') AS Assigned_Date,
                    (
                        SELECT GROUP_CONCAT(s.Specialty_Name SEPARATOR ', ')
                        FROM Doctor_Specialty ds
                        INNER JOIN Enum_Specialty s ON ds.Specialty_ID = s.Specialty_ID
                        WHERE ds.Doctor_ID = d.Doctor_ID
                    ) AS Specialties
                FROM Admission_Doctor ad
                INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
                INNER JOIN Enum_Department_Station st ON d.Station_ID = st.Station_ID
                WHERE ad.Admission_ID = :id";
        $docStmt = $conn->prepare($docSql);
        $docStmt->execute([':id' => $id]);
        $admission['Assigned_Doctors'] = $docStmt->fetchAll(PDO::FETCH_ASSOC);

        $pnSql = "SELECT 
                    pn.Note_ID,
                    pn.Invoice_ID,
                    pn.Admission_ID,
                    pn.Total_Balance_Owed,
                    pn.Plan_Type_ID,
                    ppt.Plan_Type_Code,
                    ppt.Plan_Type_Name,
                    pn.Installment_Months,
                    pn.Monthly_Amount,
                    DATE_FORMAT(pn.Next_Due_Date, '%Y-%m-%d') AS Next_Due_Date,
                    DATE_FORMAT(pn.Next_Due_Date, '%M %d, %Y') AS Formatted_Next_Due_Date,
                    pn.Guarantor_Name,
                    pn.Guarantor_Contact,
                    pn.Notes,
                    pn.Status,
                    DATE_FORMAT(pn.Created_At, '%Y-%m-%d %h:%i %p') AS Created_At
                  FROM Promissory_Note pn
                  INNER JOIN Enum_Promissory_Plan_Type ppt ON pn.Plan_Type_ID = ppt.Plan_Type_ID
                  WHERE pn.Admission_ID = :id
                  ORDER BY pn.Note_ID DESC LIMIT 1";
        $pnStmt = $conn->prepare($pnSql);
        $pnStmt->execute([':id' => $id]);
        $admission['Promissory_Note'] = $pnStmt->fetch(PDO::FETCH_ASSOC) ?: null;

        $userId = intval($json['user_id'] ?? 0);
        $doctorId = intval($json['doctor_id'] ?? 0);
        if ($userId > 0 && empty($doctorId)) {
            $docStmt = $conn->prepare("SELECT Doctor_ID FROM Doctor WHERE User_ID = :uid AND Is_Active = 1 LIMIT 1");
            $docStmt->execute([':uid' => $userId]);
            $foundDoc = $docStmt->fetchColumn();
            if ($foundDoc) {
                $doctorId = intval($foundDoc);
            }
        }
        $isAssignedDoctor = true;
        if ($doctorId > 0) {
            $isAssignedDoctor = false;
            foreach ($admission['Assigned_Doctors'] as $adDoc) {
                if (intval($adDoc['Doctor_ID']) === $doctorId) {
                    $isAssignedDoctor = true;
                    break;
                }
            }
        }
        $admission['is_assigned_doctor'] = $isAssignedDoctor;
        $admission['requesting_doctor_id'] = $doctorId;

        $this->ensureBedTransferOrderTable($conn);
        $btoStmt = $conn->prepare("
            SELECT 
                bto.Transfer_Order_ID,
                CONCAT('TRF-ORD-', LPAD(bto.Transfer_Order_ID, 3, '0')) AS Order_Code,
                bto.Admission_ID,
                bto.Doctor_ID,
                CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                bto.Target_Room_Type_ID,
                COALESCE(rt.Type_Name, 'Any Available Classification') AS Target_Room_Type_Name,
                rt.Daily_Rate AS Target_Daily_Rate,
                bto.Clinical_Reason,
                bto.Status,
                DATE_FORMAT(bto.Created_At, '%Y-%m-%d %h:%i %p') AS Ordered_At
            FROM Bed_Transfer_Order bto
            LEFT JOIN Doctor d ON bto.Doctor_ID = d.Doctor_ID
            LEFT JOIN Enum_Room_Type rt ON bto.Target_Room_Type_ID = rt.Room_Type_ID
            WHERE bto.Admission_ID = :aid AND bto.Status = 'Pending'
            ORDER BY bto.Transfer_Order_ID DESC
            LIMIT 1
        ");
        $btoStmt->execute([':aid' => $id]);
        $admission['Pending_Transfer_Order'] = $btoStmt->fetch(PDO::FETCH_ASSOC) ?: null;

        return json_encode($admission);
    }

    function getAvailableBeds()
    {
        include "connection.php";

        $sql = "SELECT 
                    b.Bed_ID,
                    b.Bed_Code,
                    b.Room_ID,
                    r.Room_Name,
                    rt.Room_Type_ID,
                    rt.Type_Name AS Room_Type,
                    COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate
                FROM Room_Bed b
                INNER JOIN Room r ON b.Room_ID = r.Room_ID
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE b.Is_Available = 1 
                  AND b.Is_Active = 1 
                  AND r.Is_Active = 1
                ORDER BY r.Room_Name ASC, b.Bed_Code ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $beds = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($beds);
    }

    function getActivePatients()
    {
        include "connection.php";

        $sql = "SELECT 
                    p.Patient_ID,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                    CONCAT(p.Last_Name, ', ', p.First_Name) AS Full_Name,
                    p.Date_Of_Birth,
                    g.Gender_Name,
                    bt.Blood_Type_Name,
                    (
                        SELECT a.Admission_ID 
                        FROM Admission a 
                        WHERE a.Patient_ID = p.Patient_ID AND a.Status = 'Admitted'
                        LIMIT 1
                    ) AS Active_Admission_ID,
                    (
                        SELECT a.Status 
                        FROM Admission a 
                        WHERE a.Patient_ID = p.Patient_ID 
                        ORDER BY a.Admission_ID DESC 
                        LIMIT 1
                    ) AS Latest_Admission_Status
                FROM Patient p
                LEFT JOIN Enum_Gender g ON p.Gender_ID = g.Gender_ID
                LEFT JOIN Enum_Blood_Type bt ON p.Blood_Type_ID = bt.Blood_Type_ID
                WHERE p.Is_Active = 1
                ORDER BY p.Last_Name ASC, p.First_Name ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $patients = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($patients);
    }

    function getActiveDoctors()
    {
        include "connection.php";

        $sql = "SELECT 
                    d.Doctor_ID,
                    CONCAT(d.Code_Prefix, '-', LPAD(d.Doctor_ID, 3, '0')) AS Doctor_Code,
                    CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Full_Name,
                    dt.Type_Name AS Doctor_Type,
                    st.Station_Name,
                    d.Base_Round_Fee,
                    (
                        SELECT GROUP_CONCAT(s.Specialty_Name SEPARATOR ', ')
                        FROM Doctor_Specialty ds
                        INNER JOIN Enum_Specialty s ON ds.Specialty_ID = s.Specialty_ID
                        WHERE ds.Doctor_ID = d.Doctor_ID
                    ) AS Specialties
                FROM Doctor d
                INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
                INNER JOIN Enum_Department_Station st ON d.Station_ID = st.Station_ID
                WHERE d.Is_Active = 1
                ORDER BY d.Last_Name ASC, d.First_Name ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $doctors = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($doctors);
    }

    function getRoomTypes()
    {
        include "connection.php";

        $stmt = $conn->prepare("
            SELECT Room_Type_ID, Type_Name, Daily_Rate
            FROM Enum_Room_Type
            ORDER BY Daily_Rate ASC, Type_Name ASC
        ");
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    function getBedTransferOrders($json = '{}')
    {
        include "connection.php";
        $this->ensureBedTransferOrderTable($conn);

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);
        if (empty($admissionId)) {
            return json_encode([]);
        }

        $stmt = $conn->prepare("
            SELECT 
                bto.Transfer_Order_ID,
                CONCAT('TRF-ORD-', LPAD(bto.Transfer_Order_ID, 3, '0')) AS Order_Code,
                bto.Admission_ID,
                bto.Doctor_ID,
                CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                bto.Target_Room_Type_ID,
                COALESCE(rt.Type_Name, 'Any Available Classification') AS Target_Room_Type_Name,
                bto.Clinical_Reason,
                bto.Status,
                bto.Fulfilled_Transfer_ID,
                CONCAT(u.First_Name, ' ', u.Last_Name) AS Fulfilled_By_Staff_Name,
                DATE_FORMAT(bto.Created_At, '%Y-%m-%d %h:%i %p') AS Ordered_At,
                DATE_FORMAT(bto.Fulfilled_At, '%Y-%m-%d %h:%i %p') AS Fulfilled_At
            FROM Bed_Transfer_Order bto
            LEFT JOIN Doctor d ON bto.Doctor_ID = d.Doctor_ID
            LEFT JOIN Enum_Room_Type rt ON bto.Target_Room_Type_ID = rt.Room_Type_ID
            LEFT JOIN System_User u ON bto.Fulfilled_By_User_ID = u.User_ID
            WHERE bto.Admission_ID = :aid
            ORDER BY bto.Transfer_Order_ID DESC
        ");
        $stmt->execute([':aid' => $admissionId]);
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    function getBedTransfers($json = '{}')
    {
        include "connection.php";
        $this->ensureBedTransferOrderTable($conn);

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        if (empty($admissionId)) {
            return json_encode([]);
        }

        $sql = "SELECT 
                    rtl.Transfer_ID,
                    rtl.Admission_ID,
                    rtl.Bed_ID,
                    rb.Bed_Code,
                    r.Room_Name,
                    rt.Type_Name AS Room_Type,
                    COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate, 0.00) AS Daily_Rate,
                    DATE_FORMAT(rtl.Date_In, '%Y-%m-%d %h:%i %p') AS Date_In,
                    DATE_FORMAT(rtl.Date_Out, '%Y-%m-%d %h:%i %p') AS Date_Out,
                    COALESCE(rtl.Total_Days, GREATEST(1, DATEDIFF(NOW(), rtl.Date_In))) AS Total_Days,
                    COALESCE(rtl.Total_Room_Fee, GREATEST(1, DATEDIFF(NOW(), rtl.Date_In)) * COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate, 0.00)) AS Total_Room_Fee,
                    GREATEST(1, DATEDIFF(NOW(), rtl.Date_In)) AS Calculated_Days,
                    GREATEST(1, DATEDIFF(NOW(), rtl.Date_In)) * COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate, 0.00) AS Calculated_Room_Fee,
                    (CASE WHEN rtl.Date_Out IS NULL THEN 1 ELSE 0 END) AS Is_Current,
                    (CASE WHEN rtl.Date_Out IS NULL THEN 1 ELSE 0 END) AS Is_Current_Stay,
                    bto.Transfer_Order_ID,
                    CASE WHEN bto.Transfer_Order_ID IS NOT NULL THEN CONCAT('TRF-ORD-', LPAD(bto.Transfer_Order_ID, 3, '0')) ELSE NULL END AS Transfer_Order_Code,
                    CASE WHEN bto_doc.Doctor_ID IS NOT NULL THEN CONCAT('Dr. ', bto_doc.First_Name, ' ', bto_doc.Last_Name) ELSE NULL END AS Ordered_By_Doctor_Name,
                    CASE WHEN bto_usr.User_ID IS NOT NULL THEN CONCAT(bto_usr.First_Name, ' ', bto_usr.Last_Name) ELSE NULL END AS Fulfilled_By_Staff_Name,
                    bto.Clinical_Reason AS Transfer_Reason
                FROM Room_Transfer_Log rtl
                INNER JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                INNER JOIN Room r ON rb.Room_ID = r.Room_ID
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                LEFT JOIN Bed_Transfer_Order bto ON bto.Fulfilled_Transfer_ID = rtl.Transfer_ID
                LEFT JOIN Doctor bto_doc ON bto.Doctor_ID = bto_doc.Doctor_ID
                LEFT JOIN System_User bto_usr ON bto.Fulfilled_By_User_ID = bto_usr.User_ID
                WHERE rtl.Admission_ID = :aid
                ORDER BY rtl.Transfer_ID ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':aid' => $admissionId]);
        $transfers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($transfers);
    }

    function getPatientAdmissionHistory($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $patientId = intval($json['patient_id'] ?? 0);
        $admissionId = intval($json['admission_id'] ?? 0);

        if (empty($patientId) && !empty($admissionId)) {
            $pStmt = $conn->prepare("SELECT Patient_ID FROM Admission WHERE Admission_ID = :aid");
            $pStmt->execute([':aid' => $admissionId]);
            $patientId = intval($pStmt->fetchColumn() ?: 0);
        }

        if (empty($patientId)) {
            return json_encode(['error' => 'Patient ID or Admission ID is required.']);
        }

        $pQuery = "SELECT 
                        p.Patient_ID,
                        CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                        CONCAT(p.Last_Name, ', ', p.First_Name) AS Full_Name,
                        TIMESTAMPDIFF(YEAR, p.Date_Of_Birth, CURDATE()) AS Age,
                        g.Gender_Name,
                        bt.Blood_Type_Name
                   FROM Patient p
                   LEFT JOIN Enum_Gender g ON p.Gender_ID = g.Gender_ID
                   LEFT JOIN Enum_Blood_Type bt ON p.Blood_Type_ID = bt.Blood_Type_ID
                   WHERE p.Patient_ID = :pid";
        $stmtP = $conn->prepare($pQuery);
        $stmtP->execute([':pid' => $patientId]);
        $patient = $stmtP->fetch(PDO::FETCH_ASSOC);

        if (!$patient) {
            return json_encode(['error' => 'Patient not found.']);
        }

        $sql = "SELECT 
                    a.Admission_ID,
                    CASE WHEN a.Status IN ('Discharged', 'Billed') THEN NULL ELSE COALESCE(a.Access_Passcode, CONCAT('ADM-', LPAD(a.Admission_ID, 4, '0'))) END AS Access_Passcode,
                    CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                    DATE_FORMAT(a.Admission_Date, '%Y-%m-%d %h:%i %p') AS Admission_Date,
                    DATE_FORMAT(fi.Settlement_Date, '%Y-%m-%d %h:%i %p') AS Discharge_Date,
                    a.Chief_Complaint,
                    a.Diagnosis,
                    a.Status,
                    a.Medical_Discharge_Date,
                    DATE_FORMAT(a.Medical_Discharge_Date, '%Y-%m-%d %h:%i %p') AS Formatted_Medical_Discharge_Date,
                    a.Medical_Discharge_Doctor_ID,
                    (SELECT CONCAT('Dr. ', md_doc.First_Name, ' ', md_doc.Last_Name) FROM Doctor md_doc WHERE md_doc.Doctor_ID = a.Medical_Discharge_Doctor_ID) AS Medical_Discharge_Doctor_Name,
                    a.Discharge_Instructions,
                    (
                        SELECT rb.Bed_Code
                        FROM Room_Transfer_Log rtl
                        INNER JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                        WHERE rtl.Admission_ID = a.Admission_ID
                        ORDER BY rtl.Transfer_ID DESC
                        LIMIT 1
                    ) AS Bed_Code,
                    (
                        SELECT r.Room_Name
                        FROM Room_Transfer_Log rtl
                        INNER JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                        INNER JOIN Room r ON rb.Room_ID = r.Room_ID
                        WHERE rtl.Admission_ID = a.Admission_ID
                        ORDER BY rtl.Transfer_ID DESC
                        LIMIT 1
                    ) AS Room_Name,
                    (
                        SELECT rt.Type_Name
                        FROM Room_Transfer_Log rtl
                        INNER JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                        INNER JOIN Room r ON rb.Room_ID = r.Room_ID
                        INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                        WHERE rtl.Admission_ID = a.Admission_ID
                        ORDER BY rtl.Transfer_ID DESC
                        LIMIT 1
                    ) AS Room_Type,
                    fi.Invoice_ID,
                    CONCAT('INV-', LPAD(fi.Invoice_ID, 4, '0')) AS Invoice_Code,
                    fi.Gross_Total,
                    fi.Net_Amount_Due,
                    fi.Amount_Paid,
                    GREATEST(0, ROUND(COALESCE(fi.Net_Amount_Due, 0) - COALESCE(fi.Amount_Paid, 0), 2)) AS Remaining_Balance,
                    CASE 
                        WHEN fi.Invoice_ID IS NULL THEN 'Unbilled'
                        WHEN fi.Net_Amount_Due <= fi.Amount_Paid THEN 'Paid in Full'
                        ELSE 'Balance Pending'
                    END AS Payment_Status
                FROM Admission a
                LEFT JOIN Final_Invoice fi ON fi.Admission_ID = a.Admission_ID
                WHERE a.Patient_ID = :pid
                ORDER BY a.Admission_ID DESC";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':pid' => $patientId]);
        $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalCount = count($history);
        $seq = $totalCount;
        foreach ($history as &$row) {
            $row['Sequence_Number'] = $seq--;
        }

        return json_encode([
            'patient' => $patient,
            'total_admissions' => $totalCount,
            'history' => $history
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

$admission = new AdmissionManager();
switch ($operation) {
    case 'getAllAdmissions':
        echo $admission->getAllAdmissions($json);
        break;
    case 'getAdmissionById':
        echo $admission->getAdmissionById($json);
        break;
    case 'getPatientAdmissionHistory':
        echo $admission->getPatientAdmissionHistory($json);
        break;
    case 'getAvailableBeds':
        echo $admission->getAvailableBeds();
        break;
    case 'getActivePatients':
        echo $admission->getActivePatients();
        break;
    case 'getActiveDoctors':
        echo $admission->getActiveDoctors();
        break;
    case 'getBedTransfers':
        echo $admission->getBedTransfers($json);
        break;
    case 'getBedTransferOrders':
        echo $admission->getBedTransferOrders($json);
        break;
    case 'getRoomTypes':
        echo $admission->getRoomTypes();
        break;
}
?>
