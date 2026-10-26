<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Catalog
{
    function insertCatalog($json)
    {
        include "connection.php";

        $json = json_decode($json, true);

        $name = trim($json['item_name'] ?? '');
        $category = trim($json['category_type'] ?? '');
        $price = floatval($json['unit_price'] ?? 0);
        $prefix = trim($json['code_prefix'] ?? '');
        $stationId = intval($json['station_id'] ?? 0);
        if ($stationId <= 0) {
            if ($category === 'Medicine') $stationId = 1;
            else if ($category === 'Equipment Scan') $stationId = 2;
            else $stationId = 5;
        }
        if (empty($prefix)) {
            if ($category === 'Medicine') $prefix = 'MED';
            else if ($category === 'Equipment Scan') $prefix = 'RAD';
            else $prefix = 'SRV';
        }

        $checkStmt = $conn->prepare("
            SELECT Catalog_ID, Item_Name, Category_Type, Code_Prefix, Unit_Price, Is_Active 
            FROM Charge_Catalogs 
            WHERE LOWER(TRIM(Item_Name)) = LOWER(:name) AND Category_Type = :category
            LIMIT 1
        ");
        $checkStmt->execute([
            ':name'     => $name,
            ':category' => $category
        ]);
        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            if (intval($existing['Is_Active']) === 1) {
                return json_encode([
                    "status"  => 0,
                    "message" => "An item named '{$existing['Item_Name']}' already exists in the {$existing['Category_Type']} category at ₱" . number_format(floatval($existing['Unit_Price']), 2) . ". Please edit the existing item instead."
                ]);
            } else {
                $reactivateStmt = $conn->prepare("
                    UPDATE Charge_Catalogs 
                    SET Is_Active   = 1, 
                        Unit_Price  = :price, 
                        Code_Prefix = :prefix 
                    WHERE Catalog_ID = :id
                ");
                $reactivateStmt->execute([
                    ':price'  => $price,
                    ':prefix' => $prefix,
                    ':id'     => $existing['Catalog_ID']
                ]);
                return json_encode([
                    "status"      => 1,
                    "reactivated" => true,
                    "message"     => "The item '{$existing['Item_Name']}' was previously archived and is now reactivated with unit price ₱" . number_format($price, 2) . "."
                ]);
            }
        }

        $sql = "INSERT INTO Charge_Catalogs (Item_Name, Category_Type, Station_ID, Code_Prefix, Unit_Price, Is_Active) 
                VALUES (:name, :category, :sid, :prefix, :price, 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $name);
        $stmt->bindParam(":category", $category);
        $stmt->bindParam(":sid", $stationId);
        $stmt->bindParam(":prefix", $prefix);
        $stmt->bindParam(":price", $price);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            return json_encode([
                "status"  => 1,
                "message" => "Catalog item added successfully!"
            ]);
        } else {
            return json_encode([
                "status"  => 0,
                "message" => "Failed to add catalog item."
            ]);
        }
    }

    function updateCatalog($json)
    {
        include "connection.php";

        $json = json_decode($json, true);

        $catalogId = intval($json['catalog_id'] ?? 0);
        $name = trim($json['item_name'] ?? '');
        $category = trim($json['category_type'] ?? '');
        $price = floatval($json['unit_price'] ?? 0);
        $prefix = trim($json['code_prefix'] ?? '');
        $stationId = intval($json['station_id'] ?? 0);
        if ($stationId <= 0) {
            if ($category === 'Medicine') $stationId = 1;
            else if ($category === 'Equipment Scan') $stationId = 2;
            else $stationId = 5;
        }
        if (empty($prefix)) {
            if ($category === 'Medicine') $prefix = 'MED';
            else if ($category === 'Equipment Scan') $prefix = 'RAD';
            else $prefix = 'SRV';
        }

        $checkStmt = $conn->prepare("
            SELECT Catalog_ID, Item_Name, Category_Type, Unit_Price, Is_Active 
            FROM Charge_Catalogs 
            WHERE LOWER(TRIM(Item_Name)) = LOWER(:name) 
              AND Category_Type = :category 
              AND Catalog_ID != :id
            LIMIT 1
        ");
        $checkStmt->execute([
            ':name'     => $name,
            ':category' => $category,
            ':id'       => $catalogId
        ]);
        $duplicate = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if ($duplicate) {
            if (intval($duplicate['Is_Active']) === 1) {
                return json_encode([
                    "status"  => 0,
                    "message" => "Another item named '{$duplicate['Item_Name']}' already exists in the {$duplicate['Category_Type']} category. Please choose a distinct name."
                ]);
            } else {
                return json_encode([
                    "status"  => 0,
                    "message" => "An archived item named '{$duplicate['Item_Name']}' already exists in the {$duplicate['Category_Type']} category. Please restore that item instead of renaming."
                ]);
            }
        }

        $sql = "UPDATE Charge_Catalogs 
                SET Item_Name     = :name, 
                    Category_Type = :category, 
                    Station_ID    = :sid,
                    Code_Prefix   = :prefix, 
                    Unit_Price    = :price 
                WHERE Catalog_ID  = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $name);
        $stmt->bindParam(":category", $category);
        $stmt->bindParam(":sid", $stationId);
        $stmt->bindParam(":prefix", $prefix);
        $stmt->bindParam(":price", $price);
        $stmt->bindParam(":id", $catalogId);
        $stmt->execute();

        return json_encode([
            "status"  => 1,
            "message" => "Catalog item updated successfully!"
        ]);
    }

    function toggleStatus($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $catalogId = intval($json['catalog_id'] ?? 0);

        if ($catalogId <= 0) {
            return json_encode([
                "status" => 0,
                "message" => "Invalid catalog ID."
            ]);
        }

        $checkStmt = $conn->prepare("SELECT Is_Active FROM Charge_Catalogs WHERE Catalog_ID = :id");
        $checkStmt->execute([':id' => $catalogId]);
        $cat = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$cat) {
            return json_encode([
                "status" => 0,
                "message" => "Catalog item not found."
            ]);
        }

        if (intval($cat['Is_Active']) === 1) {
            $ordStmt = $conn->prepare("
                SELECT COUNT(*) AS total
                FROM Doctor_Order_Request dor
                INNER JOIN Admission_Doctor ad ON dor.Admission_Doctor_ID = ad.Admission_Doctor_ID
                INNER JOIN Admission a ON ad.Admission_ID = a.Admission_ID AND a.Status = 'Admitted'
                WHERE dor.Catalog_ID = :id AND dor.Status = 'Pending'
            ");
            $ordStmt->execute([':id' => $catalogId]);
            $ord = $ordStmt->fetch(PDO::FETCH_ASSOC);
            if ($ord && intval($ord['total']) > 0) {
                return json_encode([
                    "status" => 0,
                    "message" => "Cannot archive catalog item: There are pending doctor orders for this item for active in-patients. Please fulfill or cancel those orders before archiving."
                ]);
            }
        }

        $sql = "UPDATE Charge_Catalogs 
                SET Is_Active = CASE WHEN Is_Active = 1 THEN 0 ELSE 1 END 
                WHERE Catalog_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $catalogId);
        $stmt->execute();

        return json_encode(1);
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
