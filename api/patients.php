<?php
/**
 * Patient Master Directory API (Instructor Approved Schema)
 * Milestone 1 Master File Module
 * Handles Patient: Patient_ID, First_Name, Last_Name, Date_Of_Birth, Gender_ID, Blood_Type_ID, Contact_Number, Address, Emergency_Contact_Name, Emergency_Contact_Number, Is_Active
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class PatientMaster
{
    /**
     * Read: Retrieve all patients joined with gender and blood type lookups
     */
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

    /**
     * Read: Retrieve lookups (Gender and Blood Types)
     */
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

    /**
     * Read: Retrieve single patient by ID
     */
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

    /**
     * Create: Insert a new patient
     */
    function insertPatient($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $genderSpec = !empty($json['gender_specification']) ? trim($json['gender_specification']) : null;

        $sql = "INSERT INTO Patient (First_Name, Last_Name, Date_Of_Birth, Gender_ID, Gender_Specification, Blood_Type_ID, Contact_Number, Address, Emergency_Contact_Name, Emergency_Contact_Number, Is_Active) 
                VALUES (:first_name, :last_name, :dob, :gender_id, :gender_spec, :blood_type_id, :contact, :address, :em_name, :em_contact, 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":first_name", $json['first_name']);
        $stmt->bindParam(":last_name", $json['last_name']);
        $stmt->bindParam(":dob", $json['date_of_birth']);
        $stmt->bindParam(":gender_id", $json['gender_id']);
        $stmt->bindParam(":gender_spec", $genderSpec);
        $stmt->bindParam(":blood_type_id", $json['blood_type_id']);
        $stmt->bindParam(":contact", $json['contact_number']);
        $stmt->bindParam(":address", $json['address']);
        $stmt->bindParam(":em_name", $json['emergency_contact_name']);
        $stmt->bindParam(":em_contact", $json['emergency_contact_number']);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Update: Modify patient record
     */
    function updatePatient($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $genderSpec = !empty($json['gender_specification']) ? trim($json['gender_specification']) : null;

        $sql = "UPDATE Patient 
                SET First_Name               = :first_name, 
                    Last_Name                = :last_name, 
                    Date_Of_Birth            = :dob, 
                    Gender_ID                = :gender_id, 
                    Gender_Specification     = :gender_spec,
                    Blood_Type_ID            = :blood_type_id, 
                    Contact_Number           = :contact, 
                    Address                  = :address, 
                    Emergency_Contact_Name   = :em_name, 
                    Emergency_Contact_Number = :em_contact 
                WHERE Patient_ID             = :patient_id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":first_name", $json['first_name']);
        $stmt->bindParam(":last_name", $json['last_name']);
        $stmt->bindParam(":dob", $json['date_of_birth']);
        $stmt->bindParam(":gender_id", $json['gender_id']);
        $stmt->bindParam(":gender_spec", $genderSpec);
        $stmt->bindParam(":blood_type_id", $json['blood_type_id']);
        $stmt->bindParam(":contact", $json['contact_number']);
        $stmt->bindParam(":address", $json['address']);
        $stmt->bindParam(":em_name", $json['emergency_contact_name']);
        $stmt->bindParam(":em_contact", $json['emergency_contact_number']);
        $stmt->bindParam(":patient_id", $json['patient_id']);
        $stmt->execute();

        return json_encode($stmt->rowCount() >= 0 ? 1 : 0);
    }

    /**
     * Soft Delete / Restore: Toggles Is_Active
     */
    function toggleStatus($json)
    {
        include "connection.php";

        $json = json_decode($json, true);

        $sql = "UPDATE Patient 
                SET Is_Active = CASE WHEN Is_Active = 1 THEN 0 ELSE 1 END 
                WHERE Patient_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['patient_id']);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Hard Delete: Permanently remove patient if not in admissions
     */
    function hardDeletePatient($json)
    {
        include "connection.php";

        $json = json_decode($json, true);

        try {
            $sql = "DELETE FROM Patient WHERE Patient_ID = :id";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(":id", $json['patient_id']);
            $stmt->execute();

            return json_encode($stmt->rowCount() > 0 ? 1 : 0);
        } catch (PDOException $e) {
            return json_encode([
                "status" => 0,
                "message" => "Cannot hard delete: This patient has admission records in the hospital system. Please use Soft Delete instead."
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
    case "insertPatient":
        echo $patient->insertPatient($json);
        break;
    case "updatePatient":
        echo $patient->updatePatient($json);
        break;
    case "toggleStatus":
        echo $patient->toggleStatus($json);
        break;
    case "hardDeletePatient":
        echo $patient->hardDeletePatient($json);
        break;
}
?>
