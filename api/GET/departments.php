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
