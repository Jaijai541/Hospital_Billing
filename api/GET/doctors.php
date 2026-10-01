<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class DoctorMaster
{
    function getAllDoctors()
    {
        include "connection.php";

        $sql = "SELECT d.Doctor_ID, d.First_Name, d.Last_Name, d.Doctor_Type_ID, d.Station_ID, d.Code_Prefix, d.Base_Round_Fee, d.Is_Active,
                       dt.Type_Name AS Doctor_Type_Name,
                       st.Station_Name,
                       CONCAT(d.Code_Prefix, '-', LPAD(d.Doctor_ID, 3, '0')) AS Formatted_Code,
                       COALESCE(GROUP_CONCAT(s.Specialty_Name ORDER BY s.Specialty_Name SEPARATOR ', '), 'General Practice') AS Specialties,
                       COALESCE(GROUP_CONCAT(s.Specialty_ID), '') AS Specialty_IDs
                FROM Doctor d 
                INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID 
                INNER JOIN Enum_Department_Station st ON d.Station_ID = st.Station_ID 
                LEFT JOIN Doctor_Specialty ds ON d.Doctor_ID = ds.Doctor_ID 
                LEFT JOIN Enum_Specialty s ON ds.Specialty_ID = s.Specialty_ID 
                GROUP BY d.Doctor_ID 
                ORDER BY d.Is_Active DESC, d.Last_Name ASC, d.First_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    function getDoctorLookups()
    {
        include "connection.php";

        $types = $conn->query("SELECT * FROM Enum_Doctor_Type WHERE Is_Active = 1 ORDER BY Doctor_Type_ID ASC")->fetchAll(PDO::FETCH_ASSOC);
        $stations = $conn->query("SELECT * FROM Enum_Department_Station WHERE Is_Active = 1 ORDER BY Station_Name ASC")->fetchAll(PDO::FETCH_ASSOC);
        $specialties = $conn->query("SELECT * FROM Enum_Specialty WHERE Is_Active = 1 ORDER BY Specialty_Name ASC")->fetchAll(PDO::FETCH_ASSOC);

        return json_encode([
            "types"       => $types,
            "stations"    => $stations,
            "specialties" => $specialties
        ]);
    }

    function getDoctorById($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $sql = "SELECT d.Doctor_ID, d.First_Name, d.Last_Name, d.Doctor_Type_ID, d.Station_ID, d.Code_Prefix, d.Base_Round_Fee, d.Is_Active,
                       dt.Type_Name AS Doctor_Type_Name,
                       st.Station_Name,
                       CONCAT(d.Code_Prefix, '-', LPAD(d.Doctor_ID, 3, '0')) AS Formatted_Code,
                       COALESCE(GROUP_CONCAT(DISTINCT s.Specialty_Name ORDER BY s.Specialty_Name SEPARATOR ', '), 'General Practice') AS Specialties,
                       COALESCE(GROUP_CONCAT(DISTINCT ds.Specialty_ID), '') AS Specialty_IDs
                FROM Doctor d 
                LEFT JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID 
                LEFT JOIN Enum_Department_Station st ON d.Station_ID = st.Station_ID 
                LEFT JOIN Doctor_Specialty ds ON d.Doctor_ID = ds.Doctor_ID 
                LEFT JOIN Enum_Specialty s ON ds.Specialty_ID = s.Specialty_ID 
                WHERE d.Doctor_ID = :id 
                GROUP BY d.Doctor_ID";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['doctor_id']);
        $stmt->execute();
        $rs = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($rs) {
            $rs['specialty_ids_array'] = !empty($rs['Specialty_IDs']) ? explode(',', $rs['Specialty_IDs']) : [];

            $patSql = "SELECT a.Admission_ID, a.Patient_ID, a.Chief_Complaint, a.Diagnosis, a.Status AS Admission_Status,
                              DATE_FORMAT(a.Admission_Date, '%Y-%m-%d %h:%i %p') AS Formatted_Admission_Date,
                              p.First_Name, p.Last_Name, CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                              CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                              rb.Bed_Code, r.Room_Name
                       FROM Admission_Doctor ad
                       INNER JOIN Admission a ON ad.Admission_ID = a.Admission_ID
                       INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                       LEFT JOIN Room_Transfer_Log rtl ON rtl.Transfer_ID = (
                           SELECT Transfer_ID FROM Room_Transfer_Log 
                           WHERE Admission_ID = a.Admission_ID 
                           ORDER BY (CASE WHEN Date_Out IS NULL THEN 0 ELSE 1 END), Date_In DESC 
                           LIMIT 1
                       )
                       LEFT JOIN Room_Bed rb ON rtl.Bed_ID = rb.Bed_ID
                       LEFT JOIN Room r ON rb.Room_ID = r.Room_ID
                       WHERE ad.Doctor_ID = :id
                       ORDER BY (CASE WHEN a.Status = 'Admitted' THEN 0 ELSE 1 END), a.Admission_Date DESC";
            $patStmt = $conn->prepare($patSql);
            $patStmt->bindParam(":id", $json['doctor_id']);
            $patStmt->execute();
            $allAssigned = $patStmt->fetchAll(PDO::FETCH_ASSOC);

            $rs['assigned_patients'] = $allAssigned;
            $rs['active_patients'] = array_values(array_filter($allAssigned, function($p) {
                return $p['Admission_Status'] === 'Admitted';
            }));
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

$doctor = new DoctorMaster();
switch ($operation) {
    case "getAllDoctors":
        echo $doctor->getAllDoctors();
        break;
    case "getDoctorLookups":
        echo $doctor->getDoctorLookups();
        break;
    case "getDoctorById":
        echo $doctor->getDoctorById($json);
        break;
}
?>
