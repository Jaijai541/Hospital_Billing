<?php
/**
 * Medicines Catalog API
 * Milestone 1 Master File Module
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Medicine
{
    /**
     * Read: Retrieve all medicines with their department names
     */
    function getAllMedicines()
    {
        include "../connection.php";

        $sql = "SELECT m.*, s.Station_Name 
                FROM Catalog_Medicine m 
                INNER JOIN Enum_Department_Station s ON m.Station_ID = s.Station_ID 
                ORDER BY m.Is_Active DESC, m.Generic_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    /**
     * Read: Retrieve a single medicine by ID (for populating the Edit modal)
     */
    function getMedicineById($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $sql = "SELECT * FROM Catalog_Medicine WHERE Medicine_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['medicine_id']);
        $stmt->execute();
        $rs = $stmt->fetch(PDO::FETCH_ASSOC);

        return json_encode($rs ?: []);
    }

    /**
     * Create: Insert a new medicine into the catalog
     */
    function insertMedicine($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);

        $sql = "INSERT INTO Catalog_Medicine (Generic_Name, Station_ID, Unit_Price, Code_Prefix, Is_Active) 
                VALUES (:name, :station_id, :price, 'MED', 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $json['generic_name']);
        $stmt->bindParam(":station_id", $json['station_id']);
        $stmt->bindParam(":price", $json['unit_price']);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Update: Modify an existing medicine's name, department, or unit price
     */
    function updateMedicine($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);

        $sql = "UPDATE Catalog_Medicine 
                SET Generic_Name = :name, 
                    Station_ID   = :station_id, 
                    Unit_Price   = :price 
                WHERE Medicine_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $json['generic_name']);
        $stmt->bindParam(":station_id", $json['station_id']);
        $stmt->bindParam(":price", $json['unit_price']);
        $stmt->bindParam(":id", $json['medicine_id']);
        $stmt->execute();

        return json_encode($stmt->rowCount() >= 0 ? 1 : 0);
    }

    /**
     * Soft Delete / Restore:
     * Toggles Is_Active (1 -> 0 or 0 -> 1) so old billing records never break
     */
    function toggleStatus($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);

        $sql = "UPDATE Catalog_Medicine 
                SET Is_Active = CASE WHEN Is_Active = 1 THEN 0 ELSE 1 END 
                WHERE Medicine_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['medicine_id']);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Hard Delete:
     * Permanently removes the record from the database
     */
    function hardDeleteMedicine($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);

        try {
            $sql = "DELETE FROM Catalog_Medicine WHERE Medicine_ID = :id";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(":id", $json['medicine_id']);
            $stmt->execute();

            return json_encode($stmt->rowCount() > 0 ? 1 : 0);
        } catch (PDOException $e) {
            // Foreign Key protection: if past billing transactions reference this item
            return json_encode([
                "status" => 0, 
                "message" => "Cannot hard delete: This medicine is referenced in billing records. Please use Soft Delete (Deactivate) instead."
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

$medicine = new Medicine();
switch ($operation) {
    case "getAllMedicines":
        echo $medicine->getAllMedicines();
        break;
    case "getMedicineById":
        echo $medicine->getMedicineById($json);
        break;
    case "insertMedicine":
        echo $medicine->insertMedicine($json);
        break;
    case "updateMedicine":
        echo $medicine->updateMedicine($json);
        break;
    case "toggleStatus":
        echo $medicine->toggleStatus($json);
        break;
    case "hardDeleteMedicine":
        echo $medicine->hardDeleteMedicine($json);
        break;
}
?>

