<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class ClinicalOrderManager
{
    function getCatalogList()
    {
        include "connection.php";

        $sql = "SELECT 
                    Catalog_ID,
                    CONCAT(Code_Prefix, '-', LPAD(Catalog_ID, 3, '0')) AS Item_Code,
                    Item_Name,
                    Category_Type,
                    Unit_Price
                FROM Charge_Catalogs
                WHERE Is_Active = 1
                ORDER BY Category_Type ASC, Item_Name ASC";

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
                    dor.Administered_By_User_ID,
                    dor.Administered_By_Doctor_ID,
                    CASE 
                        WHEN u_prep.User_ID IS NOT NULL THEN CONCAT(u_prep.First_Name, ' ', u_prep.Last_Name)
                        ELSE NULL 
                    END AS Prepared_By_Name,
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
                    DATE_FORMAT(dor.Request_Timestamp, '%Y-%m-%d %h:%i %p') AS Request_Timestamp,
                    DATE_FORMAT(dor.Prepared_Timestamp, '%Y-%m-%d %h:%i %p') AS Prepared_Timestamp,
                    DATE_FORMAT(dor.Administered_Timestamp, '%Y-%m-%d %h:%i %p') AS Administered_Timestamp
                FROM Doctor_Order_Request dor
                INNER JOIN Admission_Doctor ad ON dor.Admission_Doctor_ID = ad.Admission_Doctor_ID
                INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                INNER JOIN Charge_Catalogs c ON dor.Catalog_ID = c.Catalog_ID
                LEFT JOIN Enum_Department_Station s ON dor.Target_Station_ID = s.Station_ID
                LEFT JOIN System_User u_prep ON dor.Prepared_By_User_ID = u_prep.User_ID
                LEFT JOIN System_User u ON dor.Administered_By_User_ID = u.User_ID
                LEFT JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID
                LEFT JOIN Doctor d_adm ON dor.Administered_By_Doctor_ID = d_adm.Doctor_ID
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
                r.Access_Domain AS domain
            FROM System_User u
            INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID
            WHERE u.Is_Active = 1 
              AND (r.Access_Domain = 'Clinical' OR r.Role_Name LIKE '%Nurse%' OR r.Role_Name LIKE '%Doctor%' OR r.Role_Name LIKE '%Physician%')
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
                1 AS is_assigned
            FROM Admission_Doctor ad
            INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
            LEFT JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
            WHERE ad.Admission_ID = :aid AND d.Is_Active = 1
            ORDER BY d.First_Name ASC, d.Last_Name ASC
        ");
        $doctorsStmt->execute([':aid' => $admissionId]);
        $doctors = $doctorsStmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode([
            'nurses' => $clinicalUsers,
            'doctors' => $doctors
        ]);
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
                LIMIT 40";
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
        $stationId = intval($json['station_id'] ?? 0);
        $userId = intval($json['user_id'] ?? 0);
        $roleId = intval($json['role_id'] ?? 0);
        $status = trim($json['status'] ?? '');

        $stationIds = [];
        if (!empty($json['station_ids'])) {
            if (is_array($json['station_ids'])) {
                $stationIds = array_map('intval', $json['station_ids']);
            } else {
                $stationIds = array_map('intval', explode(',', $json['station_ids']));
            }
        }

        if ($stationId <= 0 && $userId > 0) {
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

        $where = "WHERE 1=1";
        $params = [];
        if ($stationId > 0) {
            $where .= " AND (dor.Target_Station_ID = :sid OR c.Station_ID = :sid)";
            $params[':sid'] = $stationId;
        } else if (!empty($stationIds) && $roleId !== 1) {
            $stationIdList = implode(",", $stationIds);
            $where .= " AND (dor.Target_Station_ID IN ($stationIdList) OR c.Station_ID IN ($stationIdList))";
        }
        if (!empty($status)) {
            $where .= " AND dor.Status = :status";
            $params[':status'] = $status;
        }

        $sql = "SELECT dor.Request_ID, dor.Admission_Doctor_ID, dor.Catalog_ID, dor.Quantity,
                       dor.Dosage_Instructions, dor.Status, dor.Target_Station_ID,
                       c.Item_Name, c.Category_Type, c.Unit_Price, (dor.Quantity * c.Unit_Price) AS Total_Price,
                       CONCAT(c.Code_Prefix, '-', LPAD(c.Catalog_ID, 3, '0')) AS Item_Code,
                       DATE_FORMAT(dor.Request_Timestamp, '%Y-%m-%d %h:%i %p') AS Request_Timestamp,
                       DATE_FORMAT(dor.Prepared_Timestamp, '%Y-%m-%d %h:%i %p') AS Prepared_Timestamp,
                       DATE_FORMAT(dor.Administered_Timestamp, '%Y-%m-%d %h:%i %p') AS Administered_Timestamp,
                       CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                       ad.Admission_ID,
                       CONCAT(p.First_Name, ' ', p.Last_Name) AS Patient_Name,
                       CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                       COALESCE(r.Room_Name, 'Not Assigned') AS Room_Name,
                       COALESCE(rb.Bed_Code, 'Bed N/A') AS Bed_Code,
                       COALESCE(s.Station_Name, 'General') AS Target_Station_Name
                FROM Doctor_Order_Request dor
                INNER JOIN Admission_Doctor ad ON dor.Admission_Doctor_ID = ad.Admission_Doctor_ID
                INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                INNER JOIN Admission a ON ad.Admission_ID = a.Admission_ID
                INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                INNER JOIN Charge_Catalogs c ON dor.Catalog_ID = c.Catalog_ID
                LEFT JOIN Enum_Department_Station s ON dor.Target_Station_ID = s.Station_ID
                LEFT JOIN Room_Transfer_Log rtl ON a.Admission_ID = rtl.Admission_ID AND rtl.Date_Out IS NULL
                LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                LEFT JOIN Room r ON rb.Room_ID = r.Room_ID
                $where
                ORDER BY dor.Request_ID DESC LIMIT 100";
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
$operation = '';
$json = '{}';
if ($method == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "{}";
} else if ($method == 'POST') {
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
    case 'getNotifications':
        echo $clinical->getNotifications($json);
        break;
    case 'getDepartmentOrders':
        echo $clinical->getDepartmentOrders($json);
        break;
}
?>
