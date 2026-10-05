<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class DepartmentMaster
{
    function insertDepartment($json)
    {
        include "connection.php";

        $json = json_decode($json, true);

        $stationName = trim($json['station_name'] ?? '');
        $codePrefix = strtoupper(trim($json['code_prefix'] ?? 'DEPT'));

        if (empty($stationName)) {
            return json_encode(["status" => 0, "message" => "Department name is required."]);
        }

        $checkStmt = $conn->prepare("SELECT Station_ID FROM Enum_Department_Station WHERE LOWER(Station_Name) = LOWER(:name)");
        $checkStmt->execute([':name' => $stationName]);
        if ($checkStmt->fetch()) {
            return json_encode(["status" => 0, "message" => "A department with this name already exists."]);
        }

        $sql = "INSERT INTO Enum_Department_Station (Station_Name, Code_Prefix, Is_Active) 
                VALUES (:name, :code, 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $stationName);
        $stmt->bindParam(":code", $codePrefix);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    function updateDepartment($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $stationId = intval($json['station_id'] ?? 0);
        $stationName = trim($json['station_name'] ?? '');
        $codePrefix = strtoupper(trim($json['code_prefix'] ?? 'DEPT'));

        if (empty($stationName) || $stationId <= 0) {
            return json_encode(["status" => 0, "message" => "Valid department ID and name are required."]);
        }

        $checkStmt = $conn->prepare("SELECT Station_ID FROM Enum_Department_Station WHERE LOWER(Station_Name) = LOWER(:name) AND Station_ID != :id");
        $checkStmt->execute([':name' => $stationName, ':id' => $stationId]);
        if ($checkStmt->fetch()) {
            return json_encode(["status" => 0, "message" => "Another department already has this name."]);
        }

        $sql = "UPDATE Enum_Department_Station 
                SET Station_Name = :name, 
                    Code_Prefix  = :code 
                WHERE Station_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $stationName);
        $stmt->bindParam(":code", $codePrefix);
        $stmt->bindParam(":id", $stationId);
        $stmt->execute();

        return json_encode($stmt->rowCount() >= 0 ? 1 : 0);
    }

    function toggleStatus($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $stationId = intval($json['station_id'] ?? 0);

        if ($stationId <= 0) {
            return json_encode([
                "status" => 0,
                "message" => "Invalid department ID."
            ]);
        }

        $checkStmt = $conn->prepare("SELECT Is_Active FROM Enum_Department_Station WHERE Station_ID = :id");
        $checkStmt->execute([':id' => $stationId]);
        $dept = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$dept) {
            return json_encode([
                "status" => 0,
                "message" => "Department not found."
            ]);
        }

        if (intval($dept['Is_Active']) === 1) {
            $docStmt = $conn->prepare("SELECT COUNT(*) AS total FROM Doctor WHERE Station_ID = :id AND Is_Active = 1");
            $docStmt->execute([':id' => $stationId]);
            $docRow = $docStmt->fetch(PDO::FETCH_ASSOC);
            if ($docRow && intval($docRow['total']) > 0) {
                return json_encode([
                    "status" => 0,
                    "message" => "Cannot archive department/station: There are currently active doctors assigned to this station. Please reassign those doctors before archiving."
                ]);
            }
        }

        $sql = "UPDATE Enum_Department_Station 
                SET Is_Active = CASE WHEN Is_Active = 1 THEN 0 ELSE 1 END 
                WHERE Station_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $stationId);
        $stmt->execute();

        return json_encode(1);
    }

    function hardDeleteDepartment($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $stationId = intval($json['station_id'] ?? 0);

        try {
            $sql = "DELETE FROM Enum_Department_Station WHERE Station_ID = :id";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(":id", $stationId);
            $stmt->execute();

            return json_encode($stmt->rowCount() > 0 ? 1 : 0);
        } catch (PDOException $e) {
            return json_encode([
                "status" => 0,
                "message" => "Cannot permanently delete: This department/station is assigned to physicians or referenced in live billing ledgers. Please use Soft Delete (Send to Archive) instead."
            ]);
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "";
}

$dept = new DepartmentMaster();
switch ($operation) {
    case "insertDepartment":
        echo $dept->insertDepartment($json);
        break;
    case "updateDepartment":
        echo $dept->updateDepartment($json);
        break;
    case "toggleStatus":
        echo $dept->toggleStatus($json);
        break;
    case "hardDeleteDepartment":
        echo $dept->hardDeleteDepartment($json);
        break;
}
?>
