<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Catalog
{
    function insertCatalog($json)
    {
        include "connection.php";

        $json = json_decode($json, true);

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

    function updateCatalog($json)
    {
        include "connection.php";

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

    function toggleStatus($json)
    {
        include "connection.php";

        $json = json_decode($json, true);

        $sql = "UPDATE Charge_Catalogs 
                SET Is_Active = CASE WHEN Is_Active = 1 THEN 0 ELSE 1 END 
                WHERE Catalog_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['catalog_id']);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    function hardDeleteCatalog($json)
    {
        include "connection.php";

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

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "";
}

$catalog = new Catalog();
switch ($operation) {
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
