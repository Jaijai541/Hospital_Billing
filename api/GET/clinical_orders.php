<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class ClinicalOrderManager
{
    function getCatalogList()
    {
        include "connection.php";

        $sql = "SELECT 
                    c.Catalog_ID,
                    CONCAT(c.Code_Prefix, '-', LPAD(c.Catalog_ID, 3, '0')) AS Item_Code,
                    c.Item_Name,
                    c.Category_Type,
                    c.Station_ID,
                    COALESCE(s.Station_Name, 'General Station') AS Station_Name,
                    COALESCE(s.Code_Prefix, '') AS Station_Prefix,
                    c.Unit_Price,
                    (
                        SELECT GROUP_CONCAT(DISTINCT CONCAT(u.First_Name, ' ', u.Last_Name, ' (', r.Role_Name, ')') SEPARATOR ', ')
                        FROM System_User u
                        INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID
                        LEFT JOIN User_Department_Station uds ON u.User_ID = uds.User_ID
                        WHERE (u.Station_ID = c.Station_ID OR uds.Station_ID = c.Station_ID) AND u.Is_Active = 1
                    ) AS Assigned_Staff_List,
                    (
                        SELECT GROUP_CONCAT(DISTINCT CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) SEPARATOR ', ')
                        FROM Doctor d
                        LEFT JOIN Doctor_Department_Station dds ON d.Doctor_ID = dds.Doctor_ID
                        WHERE (d.Station_ID = c.Station_ID OR dds.Station_ID = c.Station_ID) AND d.Is_Active = 1
                    ) AS Assigned_Doctors_List
                FROM Charge_Catalogs c
                LEFT JOIN Enum_Department_Station s ON c.Station_ID = s.Station_ID
                WHERE c.Is_Active = 1
                ORDER BY c.Category_Type ASC, c.Item_Name ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    function getDoctorOrders($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        $sql = "SELECT 
                    dor.Request_ID,
                    dor.Admission_Doctor_ID,
                    CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                    d.User_ID AS Doctor_User_ID,
                    dor.Catalog_ID,
                    c.Item_Name,
                    c.Category_Type,
                    CONCAT(c.Code_Prefix, '-', LPAD(c.Catalog_ID, 3, '0')) AS Item_Code,
                    dor.Quantity,
                    dor.Dosage_Instructions,
                    dor.Target_Station_ID,
                    COALESCE(s.Station_Name, 'General') AS Target_Station_Name,
                    c.Unit_Price,
                    (dor.Quantity * c.Unit_Price) AS Total_Price,
                    dor.Status,
                    dor.Prepared_By_User_ID,
                    dor.Assigned_Nurse_User_ID,
                    dor.Administered_By_User_ID,
                    dor.Administered_By_Doctor_ID,
                    CASE 
                        WHEN u_prep.User_ID IS NOT NULL THEN CONCAT(u_prep.First_Name, ' ', u_prep.Last_Name)
                        ELSE NULL 
                    END AS Prepared_By_Name,
                    COALESCE(r_prep.Role_Name, 'Department Staff') AS Prepared_By_Role,
                    COALESCE(s_prep.Station_Name, s.Station_Name, 'Department') AS Prepared_By_Station,
                    CASE 
                        WHEN u_nurse.User_ID IS NOT NULL THEN CONCAT(u_nurse.First_Name, ' ', u_nurse.Last_Name)
                        ELSE NULL 
                    END AS Assigned_Nurse_Name,
                    COALESCE(r_nurse.Role_Name, 'Staff Nurse') AS Assigned_Nurse_Role,
                    CASE 
                        WHEN dor.Administered_By_Doctor_ID IS NOT NULL THEN CONCAT('Dr. ', d_adm.First_Name, ' ', d_adm.Last_Name)
                        WHEN dor.Administered_By_User_ID IS NOT NULL THEN CONCAT(u.First_Name, ' ', u.Last_Name)
                        ELSE NULL 
                    END AS Administered_By_Name,
                    CASE 
                        WHEN dor.Administered_By_Doctor_ID IS NOT NULL THEN 'Attending Physician'
                        WHEN dor.Administered_By_User_ID IS NOT NULL THEN r.Role_Name
                        ELSE NULL 
                    END AS Administered_By_Role,
                    CASE 
                        WHEN dor.Administered_By_Doctor_ID IS NOT NULL THEN 'Doctor'
                        WHEN dor.Administered_By_User_ID IS NOT NULL THEN 'Nurse'
                        ELSE NULL 
                    END AS Administered_By_Type,
                    COALESCE(s_adm_u.Station_Name, s_adm_d.Station_Name, 'Nurse Station') AS Administered_By_Station,
                    dor.Request_Timestamp,
                    dor.Preparing_Timestamp,
                    dor.Prepared_Timestamp,
                    dor.Delivering_Timestamp,
                    dor.Administered_Timestamp,
                    DATE_FORMAT(dor.Request_Timestamp, '%Y-%m-%d %h:%i %p') AS Formatted_Request_Time,
                    DATE_FORMAT(dor.Preparing_Timestamp, '%Y-%m-%d %h:%i %p') AS Formatted_Preparing_Time,
                    DATE_FORMAT(dor.Prepared_Timestamp, '%Y-%m-%d %h:%i %p') AS Formatted_Prepared_Time,
                    DATE_FORMAT(dor.Delivering_Timestamp, '%Y-%m-%d %h:%i %p') AS Formatted_Delivering_Time,
                    DATE_FORMAT(dor.Administered_Timestamp, '%Y-%m-%d %h:%i %p') AS Formatted_Administered_Time,
                    ad.Admission_ID,
                    a.Status AS Admission_Status,
                    CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                    CONCAT(p.First_Name, ' ', p.Last_Name) AS Patient_Name,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                    COALESCE(r_room.Room_Name, 'Ward') AS Room_Name,
                    COALESCE(rb_bed.Bed_Code, 'Bed') AS Bed_Code
                FROM Doctor_Order_Request dor
                INNER JOIN Admission_Doctor ad ON dor.Admission_Doctor_ID = ad.Admission_Doctor_ID
                INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                INNER JOIN Admission a ON ad.Admission_ID = a.Admission_ID
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                INNER JOIN Charge_Catalogs c ON dor.Catalog_ID = c.Catalog_ID
                LEFT JOIN Enum_Department_Station s ON dor.Target_Station_ID = s.Station_ID
                LEFT JOIN System_User u_prep ON dor.Prepared_By_User_ID = u_prep.User_ID
                LEFT JOIN Enum_User_Role r_prep ON u_prep.Role_ID = r_prep.Role_ID
                LEFT JOIN Enum_Department_Station s_prep ON u_prep.Station_ID = s_prep.Station_ID
                LEFT JOIN System_User u_nurse ON dor.Assigned_Nurse_User_ID = u_nurse.User_ID
                LEFT JOIN Enum_User_Role r_nurse ON u_nurse.Role_ID = r_nurse.Role_ID
                LEFT JOIN System_User u ON dor.Administered_By_User_ID = u.User_ID
                LEFT JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID
                LEFT JOIN Enum_Department_Station s_adm_u ON u.Station_ID = s_adm_u.Station_ID
                LEFT JOIN Doctor d_adm ON dor.Administered_By_Doctor_ID = d_adm.Doctor_ID
                LEFT JOIN Enum_Department_Station s_adm_d ON d_adm.Station_ID = s_adm_d.Station_ID
                LEFT JOIN Room_Transfer_Log rtl ON a.Admission_ID = rtl.Admission_ID AND rtl.Date_Out IS NULL
                LEFT JOIN Room_Bed rb_bed ON rtl.Bed_ID = rb_bed.Bed_ID
                LEFT JOIN Room r_room ON rb_bed.Room_ID = r_room.Room_ID
                WHERE ad.Admission_ID = :aid
                ORDER BY dor.Request_ID DESC";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':aid' => $admissionId]);
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    function getDoctorRounds($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        $sql = "SELECT 
                    drl.Round_ID,
                    drl.Admission_Doctor_ID,
                    CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                    dt.Type_Name AS Doctor_Type,
                    drl.Charged_Fee,
                    DATE_FORMAT(drl.Round_Timestamp, '%Y-%m-%d %h:%i %p') AS Round_Timestamp
                FROM Doctor_Round_Log drl
                INNER JOIN Admission_Doctor ad ON drl.Admission_Doctor_ID = ad.Admission_Doctor_ID
                INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
                WHERE ad.Admission_ID = :aid
                ORDER BY drl.Round_ID DESC";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':aid' => $admissionId]);
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    function getHealthcarePersonnel($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        $clinicalUsersStmt = $conn->prepare("
            SELECT 
                u.User_ID AS id,
                'user' AS type,
                CONCAT(u.First_Name, ' ', u.Last_Name) AS name,
                r.Role_Name AS role_title,
                r.Access_Domain AS domain,
                COALESCE(GROUP_CONCAT(DISTINCT COALESCE(st_all.Station_ID, s.Station_ID)), '') AS station_ids,
                COALESCE(GROUP_CONCAT(DISTINCT st_all.Station_Name ORDER BY uds.Is_Primary DESC, st_all.Station_Name SEPARATOR ', '), s.Station_Name, 'Nurse Station') AS department,
                COALESCE(NULLIF(GROUP_CONCAT(DISTINCT doc_s.Specialty_Name ORDER BY doc_s.Specialty_Name SEPARATOR ', '), ''), 'In-Patient Nursing Care') AS specialties
            FROM System_User u
            INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID
            LEFT JOIN Enum_Department_Station s ON u.Station_ID = s.Station_ID
            LEFT JOIN User_Department_Station uds ON u.User_ID = uds.User_ID
            LEFT JOIN Enum_Department_Station st_all ON uds.Station_ID = st_all.Station_ID
            LEFT JOIN Doctor doc ON u.User_ID = doc.User_ID
            LEFT JOIN Doctor_Specialty doc_ds ON doc.Doctor_ID = doc_ds.Doctor_ID
            LEFT JOIN Enum_Specialty doc_s ON doc_ds.Specialty_ID = doc_s.Specialty_ID
            WHERE u.Is_Active = 1 
              AND (r.Access_Domain = 'Clinical' OR r.Role_Name LIKE '%Nurse%' OR r.Role_Name LIKE '%Doctor%' OR r.Role_Name LIKE '%Physician%')
            GROUP BY u.User_ID
            ORDER BY u.First_Name ASC, u.Last_Name ASC
        ");
        $clinicalUsersStmt->execute();
        $clinicalUsers = $clinicalUsersStmt->fetchAll(PDO::FETCH_ASSOC);

        $doctorsStmt = $conn->prepare("
            SELECT 
                d.Doctor_ID AS id,
                'doctor' AS type,
                CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS name,
                COALESCE(dt.Type_Name, 'Attending Physician') AS role_title,
                'Doctor' AS domain,
                1 AS is_assigned,
                COALESCE(GROUP_CONCAT(DISTINCT COALESCE(all_st.Station_ID, st.Station_ID)), '') AS station_ids,
                COALESCE(GROUP_CONCAT(DISTINCT all_st.Station_Name ORDER BY dds.Is_Primary DESC, all_st.Station_Name SEPARATOR ', '), st.Station_Name, 'General Practice') AS department,
                COALESCE(NULLIF(GROUP_CONCAT(DISTINCT s.Specialty_Name ORDER BY s.Specialty_Name SEPARATOR ', '), ''), 'General Practice') AS specialties
            FROM Admission_Doctor ad
            INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
            LEFT JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
            LEFT JOIN Enum_Department_Station st ON d.Station_ID = st.Station_ID 
            LEFT JOIN Doctor_Department_Station dds ON d.Doctor_ID = dds.Doctor_ID
            LEFT JOIN Enum_Department_Station all_st ON dds.Station_ID = all_st.Station_ID
            LEFT JOIN Doctor_Specialty ds ON d.Doctor_ID = ds.Doctor_ID 
            LEFT JOIN Enum_Specialty s ON ds.Specialty_ID = s.Specialty_ID 
            WHERE ad.Admission_ID = :aid AND d.Is_Active = 1
            GROUP BY d.Doctor_ID
            ORDER BY d.First_Name ASC, d.Last_Name ASC
        ");
        $doctorsStmt->execute([':aid' => $admissionId]);
        $doctors = $doctorsStmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode([
            'nurses' => $clinicalUsers,
            'doctors' => $doctors
        ]);
    }

    function getActiveNurses()
    {
        include "connection.php";
        $sql = "SELECT u.User_ID AS id,
                       CONCAT(u.First_Name, ' ', u.Last_Name) AS name,
                       r.Role_Name AS role_title,
                       COALESCE(s.Station_Name, 'Nurse Station') AS station_name
                FROM System_User u
                INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID
                LEFT JOIN Enum_Department_Station s ON u.Station_ID = s.Station_ID
                WHERE u.Is_Active = 1 
                  AND (r.Role_Name LIKE '%Nurse%' OR r.Access_Domain = 'Clinical') 
                  AND r.Role_Name NOT LIKE '%Doctor%' 
                  AND r.Role_Name NOT LIKE '%Physician%'
                ORDER BY u.First_Name ASC, u.Last_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    function getNotifications($json = '{}')
    {
        include "connection.php";
        $json = is_array($json) ? $json : json_decode($json, true);
        $userId = intval($json['user_id'] ?? 0);
        $roleId = intval($json['role_id'] ?? 0);
        $stationId = intval($json['station_id'] ?? 0);

        $stationIds = [];
        if (!empty($json['station_ids'])) {
            if (is_array($json['station_ids'])) {
                $stationIds = array_map('intval', $json['station_ids']);
            } else {
                $stationIds = array_map('intval', explode(',', $json['station_ids']));
            }
        }
        if ($stationId > 0) {
            $stationIds[] = $stationId;
        }

        if ($userId > 0) {
            $stStmt = $conn->prepare("
                SELECT DISTINCT Station_ID FROM (
                    SELECT Station_ID FROM User_Department_Station WHERE User_ID = :uid
                    UNION
                    SELECT dds.Station_ID FROM Doctor_Department_Station dds INNER JOIN Doctor d ON dds.Doctor_ID = d.Doctor_ID WHERE d.User_ID = :uid
                    UNION
                    SELECT Station_ID FROM System_User WHERE User_ID = :uid AND Station_ID IS NOT NULL
                    UNION
                    SELECT d.Station_ID FROM Doctor d WHERE d.User_ID = :uid AND d.Station_ID IS NOT NULL
                ) AS sub WHERE Station_ID > 0
            ");
            $stStmt->execute([':uid' => $userId]);
            $dbStationIds = $stStmt->fetchAll(PDO::FETCH_COLUMN);
            foreach ($dbStationIds as $sid) {
                $stationIds[] = intval($sid);
            }
        }
        $stationIds = array_values(array_unique(array_filter($stationIds, fn($id) => $id > 0)));

        $isAdmin = ($roleId === 1) ? 1 : 0;

        $stationCondition = "0 = 1";
        if (!empty($stationIds)) {
            $stationIdList = implode(",", $stationIds);
            $stationCondition = "cn.Target_Station_ID IN ($stationIdList)";
        }

        $sql = "SELECT cn.Notification_ID, cn.Admission_ID, cn.Request_ID, cn.Sender_User_ID,
                       cn.Target_Role_ID, cn.Target_Station_ID, cn.Target_User_ID,
                       cn.Title, cn.Message, cn.Notification_Type, cn.Is_Read,
                       DATE_FORMAT(cn.Created_At, '%h:%i %p') AS Formatted_Time,
                       DATE_FORMAT(cn.Created_At, '%b %d, %Y') AS Formatted_Date,
                       CONCAT(p.First_Name, ' ', p.Last_Name) AS Patient_Name,
                       CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                       COALESCE(c.Item_Name, 'Clinical Service') AS Item_Name,
                       c.Category_Type,
                       dor.Status AS Order_Status
                FROM Clinical_Notification cn
                INNER JOIN Admission a ON cn.Admission_ID = a.Admission_ID
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                LEFT JOIN Doctor_Order_Request dor ON cn.Request_ID = dor.Request_ID
                LEFT JOIN Charge_Catalogs c ON dor.Catalog_ID = c.Catalog_ID
                WHERE (:is_admin = 1 
                   OR cn.Target_User_ID = :uid 
                   OR (cn.Target_Station_ID IS NOT NULL AND $stationCondition)
                   OR (cn.Target_Role_ID IS NOT NULL AND cn.Target_Role_ID = :rid)
                   OR (cn.Target_Role_ID IS NULL AND cn.Target_Station_ID IS NULL AND cn.Target_User_ID IS NULL))
                ORDER BY cn.Created_At DESC
                LIMIT 50";
        $stmt = $conn->prepare($sql);
        $stmt->execute([
            ':is_admin' => $isAdmin,
            ':uid' => $userId,
            ':rid' => $roleId
        ]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $unreadCount = 0;
        foreach ($rows as $r) {
            if (intval($r['Is_Read']) === 0) {
                $unreadCount++;
            }
        }

        return json_encode([
            'unread_count' => $unreadCount,
            'notifications' => $rows
        ]);
    }

    function getDepartmentOrders($json = '{}')
    {
        include "connection.php";
        $json = is_array($json) ? $json : json_decode($json, true);
        $stationIds = [];
        if (isset($json['station_ids'])) {
            if (is_array($json['station_ids'])) {
                $stationIds = array_map('intval', $json['station_ids']);
            } else {
                $stationIds = array_map('intval', explode(',', strval($json['station_ids'])));
            }
        } elseif (isset($json['station_id'])) {
            if (is_array($json['station_id'])) {
                $stationIds = array_map('intval', $json['station_id']);
            } elseif (strpos(strval($json['station_id']), ',') !== false) {
                $stationIds = array_map('intval', explode(',', strval($json['station_id'])));
            } else {
                $sVal = intval($json['station_id']);
                if ($sVal > 0) $stationIds = [$sVal];
            }
        }
        $stationIds = array_values(array_unique(array_filter($stationIds, fn($id) => $id > 0)));

        $userId = intval($json['user_id'] ?? 0);
        $roleId = intval($json['role_id'] ?? 0);
        $status = trim($json['status'] ?? '');

        $isHigherUp = ($roleId === 1) ? 1 : 0;
        if ($roleId > 0 && !$isHigherUp) {
            $rStmt = $conn->prepare("SELECT Is_Higher_Up FROM Enum_User_Role WHERE Role_ID = :rid LIMIT 1");
            $rStmt->execute([':rid' => $roleId]);
            $isHigherUp = intval($rStmt->fetchColumn() ?: 0);
        }

        $assignedStationIds = [];
        if ($userId > 0) {
            $stStmt = $conn->prepare("
                SELECT DISTINCT Station_ID FROM (
                    SELECT Station_ID FROM User_Department_Station WHERE User_ID = :uid
                    UNION
                    SELECT dds.Station_ID FROM Doctor_Department_Station dds INNER JOIN Doctor d ON dds.Doctor_ID = d.Doctor_ID WHERE d.User_ID = :uid
                    UNION
                    SELECT Station_ID FROM System_User WHERE User_ID = :uid AND Station_ID IS NOT NULL
                    UNION
                    SELECT d.Station_ID FROM Doctor d WHERE d.User_ID = :uid AND d.Station_ID IS NOT NULL
                ) AS sub WHERE Station_ID > 0
            ");
            $stStmt->execute([':uid' => $userId]);
            $dbStationIds = $stStmt->fetchAll(PDO::FETCH_COLUMN);
            foreach ($dbStationIds as $sid) {
                $assignedStationIds[] = intval($sid);
            }
        }
        $assignedStationIds = array_values(array_unique(array_filter($assignedStationIds, fn($id) => $id > 0)));

        $nsIds = [];
        $nsStmt = $conn->query("SELECT Station_ID FROM Enum_Department_Station WHERE Code_Prefix = 'NRS' OR Station_Name LIKE '%Nurse%'");
        if ($nsStmt) {
            $nsIds = array_map('intval', $nsStmt->fetchAll(PDO::FETCH_COLUMN));
        }
        if (empty($nsIds)) {
            $nsIds = [5];
        }

        $where = "WHERE 1=1";
        $params = [];

        if (!$isHigherUp) {
            if (empty($assignedStationIds)) {
                return json_encode([]);
            }

            if (!empty($stationIds)) {
                $effectiveStationIds = array_values(array_intersect($stationIds, $assignedStationIds));
                if (empty($effectiveStationIds)) {
                    return json_encode([]);
                }
            } else {
                $effectiveStationIds = $assignedStationIds;
            }

            $hasNurseStationAccess = !empty(array_intersect($effectiveStationIds, $nsIds));
            $stationIdList = implode(",", $effectiveStationIds);

            if ($hasNurseStationAccess) {
                $where .= " AND ((dor.Target_Station_ID IN ($stationIdList) OR c.Station_ID IN ($stationIdList)) OR (dor.Status IN ('Prepared', 'Delivering', 'Administered')))";
            } else {
                $where .= " AND (dor.Target_Station_ID IN ($stationIdList) OR c.Station_ID IN ($stationIdList))";
            }
        } else {
            if (!empty($stationIds)) {
                $hasNurseStationAccess = !empty(array_intersect($stationIds, $nsIds));
                $stationIdList = implode(",", $stationIds);
                if ($hasNurseStationAccess) {
                    $where .= " AND ((dor.Target_Station_ID IN ($stationIdList) OR c.Station_ID IN ($stationIdList)) OR (dor.Status IN ('Prepared', 'Delivering', 'Administered')))";
                } else {
                    $where .= " AND (dor.Target_Station_ID IN ($stationIdList) OR c.Station_ID IN ($stationIdList))";
                }
            }
        }

        if (!empty($status)) {
            $where .= " AND dor.Status = :status";
            $params[':status'] = $status;
        }

        $sql = "SELECT 
                    dor.Request_ID,
                    dor.Admission_Doctor_ID,
                    CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                    d.User_ID AS Doctor_User_ID,
                    dor.Catalog_ID,
                    c.Item_Name,
                    c.Category_Type,
                    CONCAT(c.Code_Prefix, '-', LPAD(c.Catalog_ID, 3, '0')) AS Item_Code,
                    dor.Quantity,
                    dor.Dosage_Instructions,
                    dor.Target_Station_ID,
                    COALESCE(s.Station_Name, 'General') AS Target_Station_Name,
                    c.Unit_Price,
                    (dor.Quantity * c.Unit_Price) AS Total_Price,
                    dor.Status,
                    dor.Prepared_By_User_ID,
                    dor.Assigned_Nurse_User_ID,
                    dor.Administered_By_User_ID,
                    dor.Administered_By_Doctor_ID,
                    CASE 
                        WHEN u_prep.User_ID IS NOT NULL THEN CONCAT(u_prep.First_Name, ' ', u_prep.Last_Name)
                        ELSE NULL 
                    END AS Prepared_By_Name,
                    COALESCE(r_prep.Role_Name, 'Department Staff') AS Prepared_By_Role,
                    CASE 
                        WHEN u_nurse.User_ID IS NOT NULL THEN CONCAT(u_nurse.First_Name, ' ', u_nurse.Last_Name)
                        ELSE NULL 
                    END AS Assigned_Nurse_Name,
                    COALESCE(r_nurse.Role_Name, 'Staff Nurse') AS Assigned_Nurse_Role,
                    CASE 
                        WHEN dor.Administered_By_Doctor_ID IS NOT NULL THEN CONCAT('Dr. ', d_adm.First_Name, ' ', d_adm.Last_Name)
                        WHEN dor.Administered_By_User_ID IS NOT NULL THEN CONCAT(u.First_Name, ' ', u.Last_Name)
                        ELSE NULL 
                    END AS Administered_By_Name,
                    dor.Request_Timestamp,
                    dor.Preparing_Timestamp,
                    dor.Prepared_Timestamp,
                    dor.Delivering_Timestamp,
                    dor.Administered_Timestamp,
                    DATE_FORMAT(dor.Request_Timestamp, '%b %d, %Y %h:%i %p') AS Formatted_Request_Time,
                    DATE_FORMAT(dor.Preparing_Timestamp, '%b %d, %Y %h:%i %p') AS Formatted_Preparing_Time,
                    DATE_FORMAT(dor.Prepared_Timestamp, '%b %d, %Y %h:%i %p') AS Formatted_Prepared_Time,
                    DATE_FORMAT(dor.Delivering_Timestamp, '%b %d, %Y %h:%i %p') AS Formatted_Delivering_Time,
                    DATE_FORMAT(dor.Administered_Timestamp, '%b %d, %Y %h:%i %p') AS Formatted_Administered_Time,
                    ad.Admission_ID,
                    CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                    CONCAT(p.First_Name, ' ', p.Last_Name) AS Patient_Name,
                    CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                    COALESCE(r_room.Room_Name, 'Ward') AS Room_Name,
                    COALESCE(rb_bed.Bed_Code, 'Bed') AS Bed_Code
                FROM Doctor_Order_Request dor
                INNER JOIN Admission_Doctor ad ON dor.Admission_Doctor_ID = ad.Admission_Doctor_ID
                INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                INNER JOIN Admission a ON ad.Admission_ID = a.Admission_ID
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                INNER JOIN Charge_Catalogs c ON dor.Catalog_ID = c.Catalog_ID
                LEFT JOIN Enum_Department_Station s ON dor.Target_Station_ID = s.Station_ID
                LEFT JOIN System_User u_prep ON dor.Prepared_By_User_ID = u_prep.User_ID
                LEFT JOIN Enum_User_Role r_prep ON u_prep.Role_ID = r_prep.Role_ID
                LEFT JOIN System_User u_nurse ON dor.Assigned_Nurse_User_ID = u_nurse.User_ID
                LEFT JOIN Enum_User_Role r_nurse ON u_nurse.Role_ID = r_nurse.Role_ID
                LEFT JOIN System_User u ON dor.Administered_By_User_ID = u.User_ID
                LEFT JOIN Doctor d_adm ON dor.Administered_By_Doctor_ID = d_adm.Doctor_ID
                LEFT JOIN Room_Transfer_Log rtl ON a.Admission_ID = rtl.Admission_ID AND rtl.Date_Out IS NULL
                LEFT JOIN Room_Bed rb_bed ON rtl.Bed_ID = rb_bed.Bed_ID
                LEFT JOIN Room r_room ON rb_bed.Room_ID = r_room.Room_ID
                $where
                ORDER BY dor.Request_ID DESC
                LIMIT 100";

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    function getDoctorDashboardMetrics($json = '{}')
    {
        include "connection.php";
        $json = is_array($json) ? $json : json_decode($json, true);
        $doctorId = intval($json['doctor_id'] ?? 0);
        $userId = intval($json['user_id'] ?? 0);

        if ($userId > 0 && empty($doctorId)) {
            $docStmt = $conn->prepare("SELECT Doctor_ID FROM Doctor WHERE User_ID = :uid AND Is_Active = 1 LIMIT 1");
            $docStmt->execute([':uid' => $userId]);
            $foundDoc = $docStmt->fetchColumn();
            if ($foundDoc) {
                $doctorId = intval($foundDoc);
            }
        }

        if (empty($doctorId)) {
            return json_encode([
                'pending_orders' => 0,
                'orders_in_prep' => 0,
                'orders_in_transit' => 0,
                'today_rounds' => 0,
                'assigned_patients' => 0
            ]);
        }

        $ordStmt = $conn->prepare("
            SELECT 
                COUNT(*) AS total_pending,
                SUM(CASE WHEN dor.Status = 'Preparing' THEN 1 ELSE 0 END) AS in_prep,
                SUM(CASE WHEN dor.Status IN ('Prepared', 'Delivering') THEN 1 ELSE 0 END) AS in_transit
            FROM Doctor_Order_Request dor
            INNER JOIN Admission_Doctor ad ON dor.Admission_Doctor_ID = ad.Admission_Doctor_ID
            WHERE ad.Doctor_ID = :did AND dor.Status IN ('Requested', 'Preparing', 'Prepared', 'Delivering')
        ");
        $ordStmt->execute([':did' => $doctorId]);
        $ordRow = $ordStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $rndStmt = $conn->prepare("
            SELECT COUNT(*) 
            FROM Doctor_Round_Log drl
            INNER JOIN Admission_Doctor ad ON drl.Admission_Doctor_ID = ad.Admission_Doctor_ID
            WHERE ad.Doctor_ID = :did AND DATE(drl.Round_Timestamp) = CURDATE()
        ");
        $rndStmt->execute([':did' => $doctorId]);
        $todayRounds = intval($rndStmt->fetchColumn() ?: 0);

        $patStmt = $conn->prepare("
            SELECT COUNT(DISTINCT a.Admission_ID)
            FROM Admission a
            INNER JOIN Admission_Doctor ad ON a.Admission_ID = ad.Admission_ID
            WHERE ad.Doctor_ID = :did AND a.Status = 'Admitted'
        ");
        $patStmt->execute([':did' => $doctorId]);
        $activePatients = intval($patStmt->fetchColumn() ?: 0);

        return json_encode([
            'pending_orders' => intval($ordRow['total_pending'] ?? 0),
            'orders_in_prep' => intval($ordRow['in_prep'] ?? 0),
            'orders_in_transit' => intval($ordRow['in_transit'] ?? 0),
            'today_rounds' => $todayRounds,
            'assigned_patients' => $activePatients
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

$clinical = new ClinicalOrderManager();
switch ($operation) {
    case 'getCatalogList':
        echo $clinical->getCatalogList();
        break;
    case 'getDoctorOrders':
        echo $clinical->getDoctorOrders($json);
        break;
    case 'getDoctorRounds':
        echo $clinical->getDoctorRounds($json);
        break;
    case 'getHealthcarePersonnel':
        echo $clinical->getHealthcarePersonnel($json);
        break;
    case 'getActiveNurses':
        echo $clinical->getActiveNurses();
        break;
    case 'getNotifications':
        echo $clinical->getNotifications($json);
        break;
    case 'getDepartmentOrders':
        echo $clinical->getDepartmentOrders($json);
        break;
    case 'getDoctorDashboardMetrics':
        echo $clinical->getDoctorDashboardMetrics($json);
        break;
}
?>