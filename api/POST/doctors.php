<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class DoctorMaster
{
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

        $conn->prepare("DELETE FROM Doctor_Specialty WHERE Doctor_ID = ?")->execute([$doctorId]);
        if (!empty($json['specialty_ids']) && is_array($json['specialty_ids'])) {
            $stmtSpec = $conn->prepare("INSERT INTO Doctor_Specialty (Doctor_ID, Specialty_ID) VALUES (?, ?)");
            foreach ($json['specialty_ids'] as $specId) {
                $stmtSpec->execute([$doctorId, intval($specId)]);
            }
        }

        return json_encode(1);
    }

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

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "";
}

$doctor = new DoctorMaster();
switch ($operation) {
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
