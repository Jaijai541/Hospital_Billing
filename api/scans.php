<?php
/**
 * Equipment & Diagnostic Scans Catalog API
 * Milestone 1 Master File Module
 * Handles Hospital Fee + Doctor Reader's Fee split, CRUD, and Soft/Hard Delete
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Scan
{
    /**
     * Read: Retrieve all equipment scans with department names
     */
    function getAllScans()
    {
        include "../connection.php";

        $sql = "SELECT sc.*, s.Station_Name 
                FROM Catalog_Equipment_Scan sc 
                INNER JOIN Enum_Department_Station s ON sc.Station_ID = s.Station_ID 
                ORDER BY sc.Is_Active DESC, sc.Scan_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    /**
     * Read: Retrieve a single scan by ID for the edit form
     */
    function getScanById($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $sql = "SELECT * FROM Catalog_Equipment_Scan WHERE Scan_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['scan_id']);
        $stmt->execute();
        $rs = $stmt->fetch(PDO::FETCH_ASSOC);

        return json_encode($rs ?: []);
    }

    /**
     * Create: Insert a new scan with Hospital Fee and Reader's Fee
     */
    function insertScan($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $hospitalFee = (float)($json['hospital_fee'] ?? 0);
        $readerFee   = (float)($json['reader_fee'] ?? 0);
        $totalFee    = $hospitalFee + $readerFee;

        $sql = "INSERT INTO Catalog_Equipment_Scan (Scan_Name, Station_ID, Hospital_Fee, Reader_Fee, Total_Fee, Code_Prefix, Is_Active) 
                VALUES (:name, :station_id, :hospital_fee, :reader_fee, :total_fee, 'RAD', 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $json['scan_name']);
        $stmt->bindParam(":station_id", $json['station_id']);
        $stmt->bindParam(":hospital_fee", $hospitalFee);
        $stmt->bindParam(":reader_fee", $readerFee);
        $stmt->bindParam(":total_fee", $totalFee);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Update: Modify an existing scan
     */
    function updateScan($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $hospitalFee = (float)($json['hospital_fee'] ?? 0);
        $readerFee   = (float)($json['reader_fee'] ?? 0);
        $totalFee    = $hospitalFee + $readerFee;

        $sql = "UPDATE Catalog_Equipment_Scan 
                SET Scan_Name    = :name, 
                    Station_ID   = :station_id, 
                    Hospital_Fee = :hospital_fee, 
                    Reader_Fee   = :reader_fee, 
                    Total_Fee    = :total_fee 
                WHERE Scan_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $json['scan_name']);
        $stmt->bindParam(":station_id", $json['station_id']);
        $stmt->bindParam(":hospital_fee", $hospitalFee);
        $stmt->bindParam(":reader_fee", $readerFee);
        $stmt->bindParam(":total_fee", $totalFee);
        $stmt->bindParam(":id", $json['scan_id']);
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

        $sql = "UPDATE Catalog_Equipment_Scan 
                SET Is_Active = CASE WHEN Is_Active = 1 THEN 0 ELSE 1 END 
                WHERE Scan_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['scan_id']);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Hard Delete: Permanently remove the scan from MySQL
     */
    function hardDeleteScan($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);

        try {
            $sql = "DELETE FROM Catalog_Equipment_Scan WHERE Scan_ID = :id";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(":id", $json['scan_id']);
            $stmt->execute();

            return json_encode($stmt->rowCount() > 0 ? 1 : 0);
        } catch (PDOException $e) {
            return json_encode([
                "status" => 0,
                "message" => "Cannot hard delete: This scan is referenced in past patient billing records. Please use Soft Delete instead."
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

$scan = new Scan();
switch ($operation) {
    case "getAllScans":
        echo $scan->getAllScans();
        break;
    case "getScanById":
        echo $scan->getScanById($json);
        break;
    case "insertScan":
        echo $scan->insertScan($json);
        break;
    case "updateScan":
        echo $scan->updateScan($json);
        break;
    case "toggleStatus":
        echo $scan->toggleStatus($json);
        break;
    case "hardDeleteScan":
        echo $scan->hardDeleteScan($json);
        break;
}
?>

