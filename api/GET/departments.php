<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Department
{
    function getAllDepartments()
    {
        include "connection.php";

        $sql = "SELECT * FROM Enum_Department_Station WHERE Is_Active = 1 ORDER BY Station_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
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
}
?>
