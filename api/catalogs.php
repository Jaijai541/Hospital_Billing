<?php
/**
 * Unified Charge Catalogs API
 * Milestone 1 Master File Module
 * Handles Merged Catalogs: Medicines (MED), Diagnostic Scans (RAD), and Procedures (SRV)
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Catalog
{
    /**
     * Read: Retrieve all catalog items joined with type and department station
     */
    function getAllCatalogs()
    {
        include "../connection.php";

        $sql = "SELECT c.*, t.Type_Name AS Catalog_Type_Name, t.Code_Prefix AS Type_Prefix, s.Station_Name 
                FROM Charge_Catalog c 
                INNER JOIN Enum_Catalog_Type t ON c.Catalog_Type_ID = t.Catalog_Type_ID 
                INNER JOIN Enum_Department_Station s ON c.Station_ID = s.Station_ID 
                ORDER BY c.Is_Active DESC, c.Catalog_Type_ID ASC, c.Item_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    /**
     * Read: Retrieve catalog types for dropdowns
     */
    function getCatalogTypes()
    {
        include "../connection.php";

        $sql = "SELECT * FROM Enum_Catalog_Type WHERE Is_Active = 1 ORDER BY Catalog_Type_ID ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    /**
     * Read: Retrieve single catalog item by ID for editing
     */
    function getCatalogById($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $sql = "SELECT c.*, t.Code_Prefix AS Type_Prefix 
                FROM Charge_Catalog c 
                INNER JOIN Enum_Catalog_Type t ON c.Catalog_Type_ID = t.Catalog_Type_ID 
                WHERE c.Item_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['item_id']);
        $stmt->execute();
        $rs = $stmt->fetch(PDO::FETCH_ASSOC);

        return json_encode($rs ?: []);
    }

    /**
     * Create: Insert a new catalog item with automated code generation
     */
    function insertCatalog($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);

        // Fetch prefix for selected catalog type
        $stmtType = $conn->prepare("SELECT Code_Prefix FROM Enum_Catalog_Type WHERE Catalog_Type_ID = :type_id");
        $stmtType->bindParam(":type_id", $json['catalog_type_id']);
        $stmtType->execute();
        $typeRow = $stmtType->fetch(PDO::FETCH_ASSOC);
        $prefix = $typeRow['Code_Prefix'] ?? 'ITM';

        // Generate Item_Code (e.g. MED-009, RAD-007, SRV-008)
        $stmtCount = $conn->prepare("SELECT COUNT(*) AS total FROM Charge_Catalog WHERE Catalog_Type_ID = :type_id");
        $stmtCount->bindParam(":type_id", $json['catalog_type_id']);
        $stmtCount->execute();
        $nextNum = ($stmtCount->fetch(PDO::FETCH_ASSOC)['total'] ?? 0) + 1;
        $itemCode = sprintf("%s-%03d", $prefix, $nextNum);

        // Calculate total fee
        $hospitalFee = floatval($json['hospital_fee'] ?? 0);
        $readerFee = floatval($json['reader_fee'] ?? 0);
        $totalFee = $hospitalFee + $readerFee;
        $performerRole = !empty($json['performer_role']) ? $json['performer_role'] : null;

        $sql = "INSERT INTO Charge_Catalog (Catalog_Type_ID, Station_ID, Item_Code, Item_Name, Hospital_Fee, Reader_Fee, Total_Fee, Performer_Role, Is_Active) 
                VALUES (:catalog_type_id, :station_id, :item_code, :item_name, :hospital_fee, :reader_fee, :total_fee, :performer_role, 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":catalog_type_id", $json['catalog_type_id']);
        $stmt->bindParam(":station_id", $json['station_id']);
        $stmt->bindParam(":item_code", $itemCode);
        $stmt->bindParam(":item_name", $json['item_name']);
        $stmt->bindParam(":hospital_fee", $hospitalFee);
        $stmt->bindParam(":reader_fee", $readerFee);
        $stmt->bindParam(":total_fee", $totalFee);
        $stmt->bindParam(":performer_role", $performerRole);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Update: Modify catalog item details and recalculated fees
     */
    function updateCatalog($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);

        $hospitalFee = floatval($json['hospital_fee'] ?? 0);
        $readerFee = floatval($json['reader_fee'] ?? 0);
        $totalFee = $hospitalFee + $readerFee;
        $performerRole = !empty($json['performer_role']) ? $json['performer_role'] : null;

        $sql = "UPDATE Charge_Catalog 
                SET Catalog_Type_ID = :catalog_type_id, 
                    Station_ID      = :station_id, 
                    Item_Name       = :item_name, 
                    Hospital_Fee    = :hospital_fee, 
                    Reader_Fee      = :reader_fee, 
                    Total_Fee       = :total_fee, 
                    Performer_Role  = :performer_role 
                WHERE Item_ID = :item_id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":catalog_type_id", $json['catalog_type_id']);
        $stmt->bindParam(":station_id", $json['station_id']);
        $stmt->bindParam(":item_name", $json['item_name']);
        $stmt->bindParam(":hospital_fee", $hospitalFee);
        $stmt->bindParam(":reader_fee", $readerFee);
        $stmt->bindParam(":total_fee", $totalFee);
        $stmt->bindParam(":performer_role", $performerRole);
        $stmt->bindParam(":item_id", $json['item_id']);
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

        $sql = "UPDATE Charge_Catalog 
                SET Is_Active = CASE WHEN Is_Active = 1 THEN 0 ELSE 1 END 
                WHERE Item_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['item_id']);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Hard Delete: Permanently remove item if not referenced in billing
     */
    function hardDeleteCatalog($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);

        try {
            $sql = "DELETE FROM Charge_Catalog WHERE Item_ID = :id";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(":id", $json['item_id']);
            $stmt->execute();

            return json_encode($stmt->rowCount() > 0 ? 1 : 0);
        } catch (PDOException $e) {
            return json_encode([
                "status" => 0,
                "message" => "Cannot hard delete: This catalog item is referenced in doctor orders or patient billing records. Please use Soft Delete (Deactivate) instead."
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

$catalog = new Catalog();
switch ($operation) {
    case "getAllCatalogs":
        echo $catalog->getAllCatalogs();
        break;
    case "getCatalogTypes":
        echo $catalog->getCatalogTypes();
        break;
    case "getCatalogById":
        echo $catalog->getCatalogById($json);
        break;
    case "insertCatalog":
        echo $catalog->insertCatalog($json);
        break;
    case "updateCatalog":
        echo $catalog->updateCatalog($json);
        break;
    case "toggleStatus":
        echo $catalog->toggleStatus($json);
        break;
    case "hardDeleteCatalog":
        echo $catalog->hardDeleteCatalog($json);
        break;
}
?>
