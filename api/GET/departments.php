<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Department
{
    function getAllDepartments()
    {
        include "connection.php";

        $sql = "SELECT s.Station_ID, s.Station_Name, s.Code_Prefix, s.Is_Active,
                       (SELECT COUNT(*) FROM Doctor d WHERE d.Station_ID = s.Station_ID AND d.Is_Active = 1) AS Active_Doctors_Count,
                       (SELECT COUNT(*) FROM System_User u WHERE u.Station_ID = s.Station_ID AND u.Is_Active = 1) AS Active_Staff_Count,
                       (SELECT COUNT(*) FROM Doctor_Order_Request dor WHERE dor.Target_Station_ID = s.Station_ID AND dor.Status IN ('Requested', 'Pending')) AS Pending_Orders_Count
                FROM Enum_Department_Station s 
                ORDER BY s.Is_Active DESC, s.Station_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    function getActiveDepartments()
    {
        include "connection.php";

        $sql = "SELECT Station_ID, Station_Name, Code_Prefix, Is_Active 
                FROM Enum_Department_Station 
                WHERE Is_Active = 1 
                ORDER BY Station_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    function getDepartmentById($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $sql = "SELECT Station_ID, Station_Name, Code_Prefix, Is_Active 
                FROM Enum_Department_Station 
                WHERE Station_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['station_id']);
        $stmt->execute();
        $rs = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($rs) {
            $docSql = "SELECT d.Doctor_ID, d.First_Name, d.Last_Name, dt.Type_Name AS Doctor_Type_Name, d.Is_Active,
                              CONCAT('DOC-', LPAD(d.Doctor_ID, 3, '0')) AS Formatted_Code
                       FROM Doctor d
                       INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
                       WHERE d.Station_ID = :id
                       ORDER BY d.Is_Active DESC, d.Last_Name ASC";
            $docStmt = $conn->prepare($docSql);
            $docStmt->bindParam(":id", $json['station_id']);
            $docStmt->execute();
            $rs['assigned_doctors'] = $docStmt->fetchAll(PDO::FETCH_ASSOC);

            $userSql = "SELECT u.User_ID, u.First_Name, u.Last_Name, u.Username, r.Role_Name, u.Is_Active,
                               CONCAT('USR-', LPAD(u.User_ID, 3, '0')) AS Formatted_Code
                        FROM System_User u
                        INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID
                        WHERE u.Station_ID = :id
                        ORDER BY u.Is_Active DESC, u.Last_Name ASC";
            $userStmt = $conn->prepare($userSql);
            $userStmt->bindParam(":id", $json['station_id']);
            $userStmt->execute();
            $rs['assigned_users'] = $userStmt->fetchAll(PDO::FETCH_ASSOC);

            $orderSql = "SELECT dor.Request_ID, dor.Quantity, dor.Dosage_Instructions, dor.Status,
                                c.Item_Name, c.Category_Type, c.Unit_Price,
                                DATE_FORMAT(dor.Request_Timestamp, '%Y-%m-%d %h:%i %p') AS Request_Timestamp,
                                CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                                CONCAT(p.First_Name, ' ', p.Last_Name) AS Patient_Name,
                                CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                                COALESCE(r.Room_Name, 'Ward') AS Room_Name,
                                COALESCE(rb.Bed_Code, 'Bed') AS Bed_Code
                         FROM Doctor_Order_Request dor
                         INNER JOIN Admission_Doctor ad ON dor.Admission_Doctor_ID = ad.Admission_Doctor_ID
                         INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                         INNER JOIN Admission a ON ad.Admission_ID = a.Admission_ID
                         INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                         INNER JOIN Charge_Catalogs c ON dor.Catalog_ID = c.Catalog_ID
                         LEFT JOIN Room_Transfer_Log rtl ON a.Admission_ID = rtl.Admission_ID AND rtl.Date_Out IS NULL
                         LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                         LEFT JOIN Room r ON rb.Room_ID = r.Room_ID
                         WHERE dor.Target_Station_ID = :id
                         ORDER BY dor.Request_ID DESC LIMIT 30";
            $orderStmt = $conn->prepare($orderSql);
            $orderStmt->bindParam(":id", $json['station_id']);
            $orderStmt->execute();
            $rs['assigned_orders'] = $orderStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        return json_encode($rs ?: []);
    }
}

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "";
}

$department = new Department();
switch ($operation) {
    case "getAllDepartments":
        echo $department->getAllDepartments();
        break;
    case "getActiveDepartments":
        echo $department->getActiveDepartments();
        break;
    case "getDepartmentById":
        echo $department->getDepartmentById($json);
        break;
}
?>
