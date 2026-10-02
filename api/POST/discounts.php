<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Discount
{
    function insertDiscount($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $typeId = 1;
        $pct = floatval($json['discount_percentage'] ?? 0);
        $fixed = 0.00;
        $isVatExempt = !empty($json['is_vat_exempt']) ? 1 : 0;

        $sql = "INSERT INTO Enum_Discount (Discount_Name, Discount_Type_ID, Discount_Percentage, Fixed_Amount, Is_Vat_Exempt, Is_Active) 
                VALUES (:name, :type_id, :percentage, :fixed, :exempt, 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $json['discount_name']);
        $stmt->bindParam(":type_id", $typeId);
        $stmt->bindParam(":percentage", $pct);
        $stmt->bindParam(":fixed", $fixed);
        $stmt->bindParam(":exempt", $isVatExempt);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    function updateDiscount($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $typeId = 1;
        $pct = floatval($json['discount_percentage'] ?? 0);
        $fixed = 0.00;
        $isVatExempt = !empty($json['is_vat_exempt']) ? 1 : 0;

        $sql = "UPDATE Enum_Discount 
                SET Discount_Name = :name, 
                    Discount_Type_ID = :type_id,
                    Discount_Percentage = :percentage,
                    Fixed_Amount = :fixed,
                    Is_Vat_Exempt = :exempt
                WHERE Discount_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $json['discount_name']);
        $stmt->bindParam(":type_id", $typeId);
        $stmt->bindParam(":percentage", $pct);
        $stmt->bindParam(":fixed", $fixed);
        $stmt->bindParam(":exempt", $isVatExempt);
        $stmt->bindParam(":id", $json['discount_id']);
        $stmt->execute();

        return json_encode($stmt->rowCount() >= 0 ? 1 : 0);
    }

    function toggleStatus($json)
    {
        include "connection.php";

        $json = json_decode($json, true);

        $sql = "UPDATE Enum_Discount 
                SET Is_Active = CASE WHEN Is_Active = 1 THEN 0 ELSE 1 END 
                WHERE Discount_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['discount_id']);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    function hardDeleteDiscount($json)
    {
        include "connection.php";

        $json = json_decode($json, true);

        try {
            $sql = "DELETE FROM Enum_Discount WHERE Discount_ID = :id";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(":id", $json['discount_id']);
            $stmt->execute();

            return json_encode($stmt->rowCount() > 0 ? 1 : 0);
        } catch (PDOException $e) {
            return json_encode([
                "status" => 0,
                "message" => "Cannot hard delete: This discount type is referenced in final billing invoices. Please use Soft Delete (Deactivate) instead."
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

$discount = new Discount();
switch ($operation) {
    case "insertDiscount":
        echo $discount->insertDiscount($json);
        break;
    case "updateDiscount":
        echo $discount->updateDiscount($json);
        break;
    case "toggleStatus":
        echo $discount->toggleStatus($json);
        break;
    case "hardDeleteDiscount":
        echo $discount->hardDeleteDiscount($json);
        break;
}
?>
