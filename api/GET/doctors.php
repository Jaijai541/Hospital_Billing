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
        $sql = "SELECT d.*, GROUP_CONCAT(ds.Specialty_ID) AS Specialty_IDs 
                FROM Doctor d 
                LEFT JOIN Doctor_Specialty ds ON d.Doctor_ID = ds.Doctor_ID 
                WHERE d.Doctor_ID = :id 
                GROUP BY d.Doctor_ID";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['doctor_id']);
        $stmt->execute();
        $rs = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($rs) {
            $rs['specialty_ids_array'] = !empty($rs['Specialty_IDs']) ? explode(',', $rs['Specialty_IDs']) : [];
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
