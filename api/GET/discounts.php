<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Discount
{
    function getAllDiscounts()
    {
        include "connection.php";

        $sql = "SELECT Discount_ID, Discount_Name, Discount_Percentage, Is_Active, 'DISC' AS Code_Prefix 
                FROM Enum_Discount 
                ORDER BY Is_Active DESC, Discount_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    function getDiscountById($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $sql = "SELECT Discount_ID, Discount_Name, Discount_Percentage, Is_Active, 'DISC' AS Code_Prefix 
                FROM Enum_Discount 
                WHERE Discount_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['discount_id']);
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

$discount = new Discount();
switch ($operation) {
    case "getAllDiscounts":
        echo $discount->getAllDiscounts();
        break;
    case "getDiscountById":
        echo $discount->getDiscountById($json);
        break;
}
?>
