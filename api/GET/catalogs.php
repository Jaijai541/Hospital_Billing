<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Catalog
{
    function getAllCatalogs()
    {
        include "connection.php";

        $sql = "SELECT c.Catalog_ID, c.Item_Name, c.Category_Type, c.Station_ID, c.Code_Prefix, c.Unit_Price, c.Is_Active,
                       CONCAT(c.Code_Prefix, '-', LPAD(c.Catalog_ID, 3, '0')) AS Formatted_Code,
                       COALESCE(s.Station_Name, 'Unassigned') AS Station_Name,
                       COALESCE(s.Code_Prefix, '') AS Station_Prefix
                FROM Charge_Catalogs c
                LEFT JOIN Enum_Department_Station s ON c.Station_ID = s.Station_ID
                ORDER BY c.Is_Active DESC, c.Category_Type ASC, c.Item_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    function getCatalogsByStation($json)
    {
        include "connection.php";
        $json = is_array($json) ? $json : json_decode($json, true);
        $stationId = intval($json['station_id'] ?? 0);

        $sql = "SELECT c.Catalog_ID, c.Item_Name, c.Category_Type, c.Station_ID, c.Code_Prefix, c.Unit_Price, c.Is_Active,
                       CONCAT(c.Code_Prefix, '-', LPAD(c.Catalog_ID, 3, '0')) AS Formatted_Code,
                       COALESCE(s.Station_Name, 'Unassigned') AS Station_Name
                FROM Charge_Catalogs c
                LEFT JOIN Enum_Department_Station s ON c.Station_ID = s.Station_ID
                WHERE c.Is_Active = 1 AND (:sid = 0 OR c.Station_ID = :sid)
                ORDER BY c.Item_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute([':sid' => $stationId]);
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
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
    case "getCatalogsByStation":
        echo $catalog->getCatalogsByStation($json);
        break;
    case "getCatalogById":
        echo $catalog->getCatalogById($json);
        break;
}
?>
