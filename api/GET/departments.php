<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Department
{
    function getAllDepartments()
    {
        include "connection.php";

        $sql = "SELECT Station_ID, Station_Name, Code_Prefix, Is_Active 
                FROM Enum_Department_Station 
                ORDER BY Is_Active DESC, Station_Name ASC";
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
