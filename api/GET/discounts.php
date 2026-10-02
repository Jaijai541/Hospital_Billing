<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Discount
{
    function getAllDiscounts()
    {
        include "connection.php";

        $sql = "SELECT d.Discount_ID, d.Discount_Name, d.Discount_Type_ID, COALESCE(edt.Type_Name, 'Percentage') AS Discount_Type, d.Discount_Percentage, d.Fixed_Amount, d.Is_Vat_Exempt, d.Is_Active, COALESCE(edt.Code_Prefix, 'DISC') AS Code_Prefix 
                FROM Enum_Discount d
                LEFT JOIN Enum_Discount_Type edt ON d.Discount_Type_ID = edt.Discount_Type_ID
                ORDER BY d.Is_Active DESC, d.Discount_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    function getDiscountById($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $sql = "SELECT d.Discount_ID, d.Discount_Name, d.Discount_Type_ID, COALESCE(edt.Type_Name, 'Percentage') AS Discount_Type, d.Discount_Percentage, d.Fixed_Amount, d.Is_Vat_Exempt, d.Is_Active, COALESCE(edt.Code_Prefix, 'DISC') AS Code_Prefix 
                FROM Enum_Discount d
                LEFT JOIN Enum_Discount_Type edt ON d.Discount_Type_ID = edt.Discount_Type_ID
                WHERE d.Discount_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['discount_id']);
        $stmt->execute();
        $rs = $stmt->fetch(PDO::FETCH_ASSOC);

        return json_encode($rs ?: []);
    }

    function getAllDiscountTypes()
    {
        include "connection.php";

        $sql = "SELECT Discount_Type_ID, Type_Name, Code_Prefix, Is_Active 
                FROM Enum_Discount_Type 
                WHERE Is_Active = 1 
                ORDER BY Discount_Type_ID ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
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
    case "getAllDiscountTypes":
        echo $discount->getAllDiscountTypes();
        break;
}
?>
