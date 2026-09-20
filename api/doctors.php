<?php
/**
 * Medical Doctors & Professional Fees Master File API
 * Milestone 1 Master File Module
 * Handles Doctor Directory, Classifications (Resident/Attending), Departments, Round Fees, CRUD, and Soft/Hard Delete
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Doctor
{
    /**
     * Read: Retrieve all doctors with classifications and clinical departments
     */
    function getAllDoctors()
    {
        include "../connection.php";

        $sql = "SELECT d.*, dt.Type_Name, st.Station_Name 
                FROM Doctor d 
                INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID 
                INNER JOIN Enum_Department_Station st ON d.Station_ID = st.Station_ID 
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
     * Read: Retrieve a single doctor by ID for editing
     */
    function getDoctorById($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $sql = "SELECT * FROM Doctor WHERE Doctor_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['doctor_id']);
        $stmt->execute();
        $rs = $stmt->fetch(PDO::FETCH_ASSOC);

        return json_encode($rs ?: []);
    }

    /**
     * Create: Insert a new doctor
     */
    function insertDoctor($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $roundFee = (float)($json['base_round_fee'] ?? 0);

        $sql = "INSERT INTO Doctor (First_Name, Last_Name, Doctor_Type_ID, Station_ID, Code_Prefix, Base_Round_Fee, Is_Active) 
                VALUES (:first_name, :last_name, :doctor_type_id, :station_id, 'DR', :base_round_fee, 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":first_name", $json['first_name']);
        $stmt->bindParam(":last_name", $json['last_name']);
        $stmt->bindParam(":doctor_type_id", $json['doctor_type_id']);
        $stmt->bindParam(":station_id", $json['station_id']);
        $stmt->bindParam(":base_round_fee", $roundFee);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Update: Modify an existing doctor
     */
    function updateDoctor($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $roundFee = (float)($json['base_round_fee'] ?? 0);

        $sql = "UPDATE Doctor 
                SET First_Name     = :first_name, 
                    Last_Name      = :last_name, 
                    Doctor_Type_ID = :doctor_type_id, 
                    Station_ID     = :station_id, 
                    Base_Round_Fee = :base_round_fee 
                WHERE Doctor_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":first_name", $json['first_name']);
        $stmt->bindParam(":last_name", $json['last_name']);
        $stmt->bindParam(":doctor_type_id", $json['doctor_type_id']);
        $stmt->bindParam(":station_id", $json['station_id']);
        $stmt->bindParam(":base_round_fee", $roundFee);
        $stmt->bindParam(":id", $json['doctor_id']);
        $stmt->execute();

        return json_encode($stmt->rowCount() >= 0 ? 1 : 0);
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
     * Hard Delete: Permanently remove the doctor from MySQL
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
                "message" => "Cannot hard delete: This doctor has historical patient rounds/consultation billing records. Please use Soft Delete instead."
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

