<?php
/**
 * Hospital Clinical Services & Procedures API
 * Milestone 1 Master File Module
 * Handles Services, Department Stations, Performer Staff Roles, CRUD, and Soft/Hard Delete
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Service
{
    /**
     * Read: Retrieve all clinical services with department names
     */
    function getAllServices()
    {
        include "../connection.php";

        $sql = "SELECT s.*, st.Station_Name 
                FROM Catalog_Service s 
                INNER JOIN Enum_Department_Station st ON s.Station_ID = st.Station_ID 
                ORDER BY s.Is_Active DESC, s.Service_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    /**
     * Read: Retrieve a single service by ID for editing
     */
    function getServiceById($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $sql = "SELECT * FROM Catalog_Service WHERE Service_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['service_id']);
        $stmt->execute();
        $rs = $stmt->fetch(PDO::FETCH_ASSOC);

        return json_encode($rs ?: []);
    }

    /**
     * Create: Insert a new clinical service
     */
    function insertService($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $serviceFee = (float)($json['service_fee'] ?? 0);

        $sql = "INSERT INTO Catalog_Service (Service_Name, Station_ID, Performer_Role, Service_Fee, Code_Prefix, Is_Active) 
                VALUES (:name, :station_id, :performer_role, :service_fee, 'SRV', 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $json['service_name']);
        $stmt->bindParam(":station_id", $json['station_id']);
        $stmt->bindParam(":performer_role", $json['performer_role']);
        $stmt->bindParam(":service_fee", $serviceFee);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Update: Modify an existing service
     */
    function updateService($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $serviceFee = (float)($json['service_fee'] ?? 0);

        $sql = "UPDATE Catalog_Service 
                SET Service_Name   = :name, 
                    Station_ID     = :station_id, 
                    Performer_Role = :performer_role, 
                    Service_Fee    = :service_fee 
                WHERE Service_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $json['service_name']);
        $stmt->bindParam(":station_id", $json['station_id']);
        $stmt->bindParam(":performer_role", $json['performer_role']);
        $stmt->bindParam(":service_fee", $serviceFee);
        $stmt->bindParam(":id", $json['service_id']);
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

        $sql = "UPDATE Catalog_Service 
                SET Is_Active = CASE WHEN Is_Active = 1 THEN 0 ELSE 1 END 
                WHERE Service_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['service_id']);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Hard Delete: Permanently remove the service from MySQL
     */
    function hardDeleteService($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);

        try {
            $sql = "DELETE FROM Catalog_Service WHERE Service_ID = :id";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(":id", $json['service_id']);
            $stmt->execute();

            return json_encode($stmt->rowCount() > 0 ? 1 : 0);
        } catch (PDOException $e) {
            return json_encode([
                "status" => 0,
                "message" => "Cannot hard delete: This service is referenced in patient billing records. Please use Soft Delete instead."
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

$service = new Service();
switch ($operation) {
    case "getAllServices":
        echo $service->getAllServices();
        break;
    case "getServiceById":
        echo $service->getServiceById($json);
        break;
    case "insertService":
        echo $service->insertService($json);
        break;
    case "updateService":
        echo $service->updateService($json);
        break;
    case "toggleStatus":
        echo $service->toggleStatus($json);
        break;
    case "hardDeleteService":
        echo $service->hardDeleteService($json);
        break;
}
?>

