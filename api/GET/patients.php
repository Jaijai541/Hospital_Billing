<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class PatientMaster
{
    function getAllPatients($json = "{}")
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $userId = intval($json['user_id'] ?? 0);
        $doctorId = intval($json['doctor_id'] ?? 0);

        if ($userId > 0 && empty($doctorId)) {
            $docStmt = $conn->prepare("SELECT Doctor_ID FROM Doctor WHERE User_ID = :uid AND Is_Active = 1 LIMIT 1");
            $docStmt->execute([':uid' => $userId]);
            $foundDoc = $docStmt->fetchColumn();
            if ($foundDoc) {
                $doctorId = intval($foundDoc);
            }
        }

        $params = [];
        $whereClause = "";
        if ($doctorId > 0) {
            $whereClause = " WHERE p.Patient_ID IN (SELECT DISTINCT a.Patient_ID FROM Admission a INNER JOIN Admission_Doctor ad ON a.Admission_ID = ad.Admission_ID WHERE ad.Doctor_ID = :scoped_doc_id)";
            $params[':scoped_doc_id'] = $doctorId;
        }

        $sql = "SELECT p.*, 
                       CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                       g.Gender_Name, b.Blood_Type_Name,
                       (
                           SELECT COUNT(*) 
                           FROM Admission a 
                           WHERE a.Patient_ID = p.Patient_ID
                       ) AS Total_Admissions,
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
                {$whereClause}
                ORDER BY p.Is_Active DESC, p.Last_Name ASC, p.First_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
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
                       g.Gender_Name, 
                       b.Blood_Type_Name,
                       TIMESTAMPDIFF(YEAR, p.Date_Of_Birth, CURDATE()) AS Age,
                       a.Admission_ID AS Active_Admission_ID,
                       CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Active_Admission_Code,
                       DATE_FORMAT(a.Admission_Date, '%Y-%m-%d %h:%i %p') AS Admission_Date_Formatted,
                       a.Chief_Complaint,
                       a.Diagnosis,
                       a.Status AS Admission_Status,
                       rb.Bed_Code AS Current_Bed_Code,
                       r.Room_Name AS Current_Room_Name,
                       rt.Type_Name AS Current_Room_Type,
                       COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Current_Daily_Rate,
                       ef.Floor_Name,
                       ef.Building_Wing,
                       (
                           SELECT GROUP_CONCAT(CONCAT('Dr. ', doc.First_Name, ' ', doc.Last_Name) SEPARATOR ', ')
                           FROM Admission_Doctor ad
                           INNER JOIN Doctor doc ON ad.Doctor_ID = doc.Doctor_ID
                           WHERE ad.Admission_ID = a.Admission_ID
                       ) AS Attending_Doctors,
                       (
                           SELECT COUNT(*) 
                           FROM Admission 
                           WHERE Patient_ID = p.Patient_ID
                       ) AS Total_Admissions
                FROM Patient p 
                LEFT JOIN Enum_Gender g ON p.Gender_ID = g.Gender_ID 
                LEFT JOIN Enum_Blood_Type b ON p.Blood_Type_ID = b.Blood_Type_ID 
                LEFT JOIN Admission a ON a.Patient_ID = p.Patient_ID AND a.Status = 'Admitted'
                LEFT JOIN Room_Transfer_Log rtl ON rtl.Admission_ID = a.Admission_ID AND rtl.Date_Out IS NULL
                LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                LEFT JOIN Room r ON rb.Room_ID = r.Room_ID
                LEFT JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                LEFT JOIN Enum_Floor ef ON r.Floor_ID = ef.Floor_ID
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
        echo $patient->getAllPatients($json);
        break;
    case "getPatientEnums":
        echo $patient->getPatientEnums();
        break;
    case "getPatientById":
        echo $patient->getPatientById($json);
        break;
}
?>
