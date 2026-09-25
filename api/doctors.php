<?php
/**
 * Medical Doctors & Professional Fees API (Instructor Approved Schema)
 * Milestone 1 Master File Module
 * Handles Doctor, Doctor_Specialty, Enum_Doctor_Type, Enum_Department_Station, and Enum_Specialty
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class DoctorMaster
{
    /**
     * Read: Retrieve all doctors with classification, station, and specialties
     */
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

    /**
     * Read: Retrieve lookups (Doctor Types, Stations, Specialties)
     */
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

    /**
     * Read: Retrieve single doctor by ID
     */
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

    /**
     * Create: Insert a new doctor with Doctor_Specialty entries
     */
    function insertDoctor($json)
    {
        include "connection.php";

        $json = json_decode($json, true);

        $sql = "INSERT INTO Doctor (First_Name, Last_Name, Doctor_Type_ID, Station_ID, Code_Prefix, Base_Round_Fee, Is_Active) 
                VALUES (:first_name, :last_name, :type_id, :station_id, 'DOC', :round_fee, 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":first_name", $json['first_name']);
        $stmt->bindParam(":last_name", $json['last_name']);
        $stmt->bindParam(":type_id", $json['doctor_type_id']);
        $stmt->bindParam(":station_id", $json['station_id']);
        $stmt->bindParam(":round_fee", $json['base_round_fee']);
        $stmt->execute();

        $doctorId = $conn->lastInsertId();

        // Insert specialties
        if (!empty($json['specialty_ids']) && is_array($json['specialty_ids'])) {
            $stmtSpec = $conn->prepare("INSERT INTO Doctor_Specialty (Doctor_ID, Specialty_ID) VALUES (:doc_id, :spec_id)");
            foreach ($json['specialty_ids'] as $specId) {
                $stmtSpec->execute([
                    ':doc_id'  => $doctorId,
                    ':spec_id' => intval($specId)
                ]);
            }
        }

        return json_encode(1);
    }

    /**
     * Update: Modify doctor details and refresh specialties
     */
    function updateDoctor($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $doctorId = $json['doctor_id'];

        $sql = "UPDATE Doctor 
                SET First_Name     = :first_name, 
                    Last_Name      = :last_name, 
                    Doctor_Type_ID = :type_id, 
                    Station_ID     = :station_id, 
                    Base_Round_Fee = :round_fee 
                WHERE Doctor_ID    = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":first_name", $json['first_name']);
        $stmt->bindParam(":last_name", $json['last_name']);
        $stmt->bindParam(":type_id", $json['doctor_type_id']);
        $stmt->bindParam(":station_id", $json['station_id']);
        $stmt->bindParam(":round_fee", $json['base_round_fee']);
        $stmt->bindParam(":id", $doctorId);
        $stmt->execute();

        // Reassign specialties
        $conn->prepare("DELETE FROM Doctor_Specialty WHERE Doctor_ID = ?")->execute([$doctorId]);
        if (!empty($json['specialty_ids']) && is_array($json['specialty_ids'])) {
            $stmtSpec = $conn->prepare("INSERT INTO Doctor_Specialty (Doctor_ID, Specialty_ID) VALUES (?, ?)");
            foreach ($json['specialty_ids'] as $specId) {
                $stmtSpec->execute([$doctorId, intval($specId)]);
            }
        }

        return json_encode(1);
    }

    /**
     * Soft Delete / Restore: Toggles Is_Active
     */
    function toggleStatus($json)
    {
        include "connection.php";

        $json = json_decode($json, true);

        $sql = "UPDATE Doctor 
                SET Is_Active = CASE WHEN Is_Active = 1 THEN 0 ELSE 1 END 
                WHERE Doctor_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['doctor_id']);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Hard Delete: Permanently remove doctor if not referenced in clinical workflow
     */
    function hardDeleteDoctor($json)
    {
        include "connection.php";

        $json = json_decode($json, true);

        try {
            $sql = "DELETE FROM Doctor WHERE Doctor_ID = :id";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(":id", $json['doctor_id']);
            $stmt->execute();

            return json_encode($stmt->rowCount() > 0 ? 1 : 0);
        } catch (PDOException $e) {
            return json_encode([
                "status" => 0,
                "message" => "Cannot hard delete: This doctor has assigned admissions or bedside round records. Please use Soft Delete instead."
            ]);
        }
    }
}

// Router for operation and json payload
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
    case "insertDoctor":
        echo $doctor->insertDoctor($json);
        break;
    case "updateDoctor":
        echo $doctor->updateDoctor($json);
        break;
    case "toggleStatus":
        echo $doctor->toggleStatus($json);
        break;
    case "hardDeleteDoctor":
        echo $doctor->hardDeleteDoctor($json);
        break;
}
?>
