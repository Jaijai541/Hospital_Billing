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
                       ) AS Latest_Admission_ID,
                       (
                           SELECT rb.Bed_Code
                           FROM Admission a
                           INNER JOIN Room_Transfer_Log rtl ON rtl.Admission_ID = a.Admission_ID AND rtl.Date_Out IS NULL
                           INNER JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                           WHERE a.Patient_ID = p.Patient_ID AND a.Status = 'Admitted'
                           ORDER BY a.Admission_ID DESC
                           LIMIT 1
                       ) AS Current_Bed_Code,
                       (
                           SELECT r.Room_Name
                           FROM Admission a
                           INNER JOIN Room_Transfer_Log rtl ON rtl.Admission_ID = a.Admission_ID AND rtl.Date_Out IS NULL
                           INNER JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                           INNER JOIN Room r ON rb.Room_ID = r.Room_ID
                           WHERE a.Patient_ID = p.Patient_ID AND a.Status = 'Admitted'
                           ORDER BY a.Admission_ID DESC
                           LIMIT 1
                       ) AS Current_Room_Name
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
        $sql = "SELECT p.*, 
                       CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                       a.Admission_ID AS Active_Admission_ID,
                       a.Status AS Admission_Status,
                       rb.Bed_Code AS Current_Bed_Code,
                       r.Room_Name AS Current_Room_Name,
                       rt.Type_Name AS Current_Room_Type,
                       COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Current_Daily_Rate
                FROM Patient p 
                LEFT JOIN Admission a ON a.Patient_ID = p.Patient_ID AND a.Status = 'Admitted'
                LEFT JOIN Room_Transfer_Log rtl ON rtl.Admission_ID = a.Admission_ID AND rtl.Date_Out IS NULL
                LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                LEFT JOIN Room r ON rb.Room_ID = r.Room_ID
                LEFT JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                WHERE p.Patient_ID = :id
                ORDER BY a.Admission_ID DESC
                LIMIT 1";
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
