<?php
/**
 * Unified Charge Catalogs API (Instructor Approved Schema)
 * Milestone 1 Master File Module
 * Handles Charge_Catalogs: Catalog_ID, Item_Name, Category_Type, Code_Prefix, Unit_Price, Is_Active
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Catalog
{
    /**
     * Read: Retrieve all catalog items
     */
    function getAllCatalogs()
    {
        include "../connection.php";

        $sql = "SELECT Catalog_ID, Item_Name, Category_Type, Code_Prefix, Unit_Price, Is_Active,
                       CONCAT(Code_Prefix, '-', LPAD(Catalog_ID, 3, '0')) AS Formatted_Code
                FROM Charge_Catalogs 
                ORDER BY Is_Active DESC, Category_Type ASC, Item_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    /**
     * Read: Retrieve single catalog item by ID
     */
    function getCatalogById($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $sql = "SELECT * FROM Charge_Catalogs WHERE Catalog_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['catalog_id']);
        $stmt->execute();
        $rs = $stmt->fetch(PDO::FETCH_ASSOC);

        return json_encode($rs ?: []);
    }

    /**
     * Create: Insert a new item into Charge_Catalogs
     */
    function insertCatalog($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);

        // Derive code prefix if not explicitly provided
        $category = trim($json['category_type']);
        $prefix = trim($json['code_prefix'] ?? '');
        if (empty($prefix)) {
            if ($category === 'Medicine') $prefix = 'MED';
            else if ($category === 'Equipment Scan') $prefix = 'RAD';
            else $prefix = 'SRV';
        }

        $sql = "INSERT INTO Charge_Catalogs (Item_Name, Category_Type, Code_Prefix, Unit_Price, Is_Active) 
                VALUES (:name, :category, :prefix, :price, 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $json['item_name']);
        $stmt->bindParam(":category", $category);
        $stmt->bindParam(":prefix", $prefix);
        $stmt->bindParam(":price", $json['unit_price']);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Update: Modify existing catalog item
     */
    function updateCatalog($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);

        $category = trim($json['category_type']);
        $prefix = trim($json['code_prefix'] ?? '');
        if (empty($prefix)) {
            if ($category === 'Medicine') $prefix = 'MED';
            else if ($category === 'Equipment Scan') $prefix = 'RAD';
            else $prefix = 'SRV';
        }

        $sql = "UPDATE Charge_Catalogs 
                SET Item_Name     = :name, 
                    Category_Type = :category, 
                    Code_Prefix   = :prefix, 
                    Unit_Price    = :price 
                WHERE Catalog_ID  = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $json['item_name']);
        $stmt->bindParam(":category", $category);
        $stmt->bindParam(":prefix", $prefix);
        $stmt->bindParam(":price", $json['unit_price']);
        $stmt->bindParam(":id", $json['catalog_id']);
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

        $sql = "UPDATE Charge_Catalogs 
                SET Is_Active = CASE WHEN Is_Active = 1 THEN 0 ELSE 1 END 
                WHERE Catalog_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['catalog_id']);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Hard Delete: Permanently removes item if not referenced in ledger or doctor orders
     */
    function hardDeleteCatalog($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);

        try {
            $sql = "DELETE FROM Charge_Catalogs WHERE Catalog_ID = :id";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(":id", $json['catalog_id']);
            $stmt->execute();

            return json_encode($stmt->rowCount() > 0 ? 1 : 0);
        } catch (PDOException $e) {
            return json_encode([
                "status" => 0,
                "message" => "Cannot hard delete: This item is referenced in patient billing ledgers or doctor order requests. Please use Soft Delete instead."
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
