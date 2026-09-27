<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class SpecialtyMaster
{
    function insertSpecialty($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $specialtyName = trim($json['specialty_name'] ?? '');

        if (empty($specialtyName)) {
            return json_encode([
                "success" => false,
                "error" => "Specialty name is required."
            ]);
        }

        $checkStmt = $conn->prepare("SELECT Specialty_ID, Specialty_Name, Is_Active FROM Enum_Specialty WHERE LOWER(Specialty_Name) = LOWER(:name)");
        $checkStmt->execute([':name' => $specialtyName]);
        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            if ($existing['Is_Active'] == 0) {
                $updStmt = $conn->prepare("UPDATE Enum_Specialty SET Is_Active = 1 WHERE Specialty_ID = :id");
                $updStmt->execute([':id' => $existing['Specialty_ID']]);
            }
            return json_encode([
                "success" => true,
                "specialty_id" => intval($existing['Specialty_ID']),
                "specialty_name" => $existing['Specialty_Name'],
                "already_existed" => true,
                "message" => "Specialty '" . $existing['Specialty_Name'] . "' is already registered and ready for selection."
            ]);
        }

        $sql = "INSERT INTO Enum_Specialty (Specialty_Name, Is_Active) VALUES (:name, 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $specialtyName);
        $stmt->execute();

        $newId = $conn->lastInsertId();

        return json_encode([
            "success" => true,
            "specialty_id" => intval($newId),
            "specialty_name" => $specialtyName,
            "already_existed" => false,
            "message" => "Specialty '" . $specialtyName . "' added successfully."
        ]);
    }

    function getAllSpecialties()
    {
        include "connection.php";

        $stmt = $conn->query("SELECT * FROM Enum_Specialty WHERE Is_Active = 1 ORDER BY Specialty_Name ASC");
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

$specialty = new SpecialtyMaster();
switch ($operation) {
    case "insertSpecialty":
        echo $specialty->insertSpecialty($json);
        break;
    case "getAllSpecialties":
        echo $specialty->getAllSpecialties();
        break;
}
?>
