<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Catalog
{
    function getAllCatalogs()
    {
        include "connection.php";

        $sql = "SELECT Catalog_ID, Item_Name, Category_Type, Code_Prefix, Unit_Price, Is_Active,
                       CONCAT(Code_Prefix, '-', LPAD(Catalog_ID, 3, '0')) AS Formatted_Code
                FROM Charge_Catalogs 
                ORDER BY Is_Active DESC, Category_Type ASC, Item_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    function getCatalogById($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $sql = "SELECT * FROM Charge_Catalogs WHERE Catalog_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['catalog_id']);
        $stmt->execute();
        $rs = $stmt->fetch(PDO::FETCH_ASSOC);

        return json_encode($rs ?: []);
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
    case "getAllCatalogs":
        echo $catalog->getAllCatalogs();
        break;
    case "getCatalogById":
        echo $catalog->getCatalogById($json);
        break;
}
?>
