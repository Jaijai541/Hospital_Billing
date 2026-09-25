<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class PatientMaster
{
    function getAllPatients()
    {
        include "connection.php";

        $sql = "SELECT p.*, 
                       CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                       g.Gender_Name, b.Blood_Type_Name,
                       (
                           SELECT a.Status 
                            FROM Admission a 
                            WHERE a.Patient_ID = p.Patient_ID 
                            ORDER BY a.Admission_ID DESC 
                            LIMIT 1
                       ) AS Latest_Admission_Status,
                       (
                           SELECT a.Admission_ID 
                           FROM Admission a 
                           WHERE a.Patient_ID = p.Patient_ID 
                           ORDER BY a.Admission_ID DESC 
                           LIMIT 1
                       ) AS Latest_Admission_ID
                FROM Patient p 
                INNER JOIN Enum_Gender g ON p.Gender_ID = g.Gender_ID 
                INNER JOIN Enum_Blood_Type b ON p.Blood_Type_ID = b.Blood_Type_ID 
                ORDER BY p.Is_Active DESC, p.Last_Name ASC, p.First_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    function getPatientEnums()
    {
        include "connection.php";

        $genders = $conn->query("SELECT * FROM Enum_Gender ORDER BY Gender_ID ASC")->fetchAll(PDO::FETCH_ASSOC);
        $bloodTypes = $conn->query("SELECT * FROM Enum_Blood_Type ORDER BY Blood_Type_ID ASC")->fetchAll(PDO::FETCH_ASSOC);

        return json_encode([
            "genders"     => $genders,
            "blood_types" => $bloodTypes
        ]);
    }

    function getPatientById($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $sql = "SELECT p.*, CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code 
                FROM Patient p 
                WHERE p.Patient_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['patient_id']);
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

$patient = new PatientMaster();
switch ($operation) {
    case "getAllPatients":
        echo $patient->getAllPatients();
        break;
    case "getPatientEnums":
        echo $patient->getPatientEnums();
        break;
    case "getPatientById":
        echo $patient->getPatientById($json);
        break;
}
?>
