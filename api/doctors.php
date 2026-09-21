<?php
/**
 * Medical Doctors & Professional Fees Master File API (Revised)
 * Milestone 1 Master File Module
 * Handles Doctor Directory, Multi-Specialty Support (Doctor_Specialty), Classifications, Round Fees, CRUD, and Soft/Hard Delete
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Doctor
{
    /**
     * Read: Retrieve all doctors with classifications and aggregated specialties
     */
    function getAllDoctors()
    {
        include "../connection.php";

        $sql = "SELECT d.*, dt.Type_Name, 
                       COALESCE(GROUP_CONCAT(s.Specialty_Name ORDER BY s.Specialty_Name SEPARATOR ', '), 'General Practice') AS Specialties,
                       COALESCE(GROUP_CONCAT(s.Specialty_ID), '') AS Specialty_IDs
                FROM Doctor d 
                INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID 
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
     * Read: Retrieve active doctor types (Resident, Attending)
     */
    function getAllDoctorTypes()
    {
        include "../connection.php";

        $sql = "SELECT * FROM Enum_Doctor_Type WHERE Is_Active = 1 ORDER BY Doctor_Type_ID ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    /**
     * Read: Retrieve all active specialties for selection
     */
    function getAllSpecialties()
    {
        include "../connection.php";

        $sql = "SELECT * FROM Enum_Specialty WHERE Is_Active = 1 ORDER BY Specialty_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    /**
     * Read: Retrieve a single doctor by ID for editing
     */
    function getDoctorById($json)
    {
        include "../connection.php";

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
     * Create: Insert a new doctor with automated DR-xxx code and multi-specialty bridge entries
     */
    function insertDoctor($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);

        // Generate Doctor_Code
        $stmtCount = $conn->query("SELECT COUNT(*) AS total FROM Doctor");
        $nextNum = ($stmtCount->fetch(PDO::FETCH_ASSOC)['total'] ?? 0) + 1;
        $doctorCode = sprintf("DR-%03d", $nextNum);

        $sql = "INSERT INTO Doctor (Doctor_Code, First_Name, Last_Name, Doctor_Type_ID, Base_Round_Fee, Is_Active) 
                VALUES (:code, :first_name, :last_name, :type_id, :round_fee, 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":code", $doctorCode);
        $stmt->bindParam(":first_name", $json['first_name']);
        $stmt->bindParam(":last_name", $json['last_name']);
        $stmt->bindParam(":type_id", $json['doctor_type_id']);
        $stmt->bindParam(":round_fee", $json['base_round_fee']);
        $stmt->execute();

        $doctorId = $conn->lastInsertId();

        // Insert multiple specialties
        if (!empty($json['specialty_ids']) && is_array($json['specialty_ids'])) {
            $stmtSpec = $conn->prepare("INSERT INTO Doctor_Specialty (Doctor_ID, Specialty_ID) VALUES (:doc_id, :spec_id)");
            foreach ($json['specialty_ids'] as $specId) {
                $stmtSpec->execute([
                    ':doc_id' => $doctorId,
                    ':spec_id' => intval($specId)
                ]);
            }
        }

        return json_encode(1);
    }

    /**
     * Update: Modify doctor details and update specialties bridge table
     */
    function updateDoctor($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $doctorId = $json['doctor_id'];

        $sql = "UPDATE Doctor 
                SET First_Name     = :first_name, 
                    Last_Name      = :last_name, 
                    Doctor_Type_ID = :type_id, 
                    Base_Round_Fee = :round_fee 
                WHERE Doctor_ID    = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":first_name", $json['first_name']);
        $stmt->bindParam(":last_name", $json['last_name']);
        $stmt->bindParam(":type_id", $json['doctor_type_id']);
        $stmt->bindParam(":round_fee", $json['base_round_fee']);
        $stmt->bindParam(":id", $doctorId);
        $stmt->execute();

        // Refresh specialty assignments
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
        include "../connection.php";

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
     * Hard Delete: Permanently remove doctor if not assigned to past admissions
     */
    function hardDeleteDoctor($json)
    {
        include "../connection.php";

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
                "message" => "Cannot hard delete: This doctor has past admission assignments or bedside round logs in the hospital records. Please use Soft Delete (Deactivate) instead."
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

$doctor = new Doctor();
switch ($operation) {
    case "getAllDoctors":
        echo $doctor->getAllDoctors();
        break;
    case "getAllDoctorTypes":
        echo $doctor->getAllDoctorTypes();
        break;
    case "getAllSpecialties":
        echo $doctor->getAllSpecialties();
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
