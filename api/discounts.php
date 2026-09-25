<?php
/**
 * Billing Discounts Master File API
 * Milestone 1 Master File Module
 * Handles Discount Directory (Senior Citizen, PWD, etc.), Percentage Rates, CRUD, and Soft/Hard Delete
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Discount
{
    /**
     * Read: Retrieve all discounts
     */
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

    /**
     * Read: Retrieve a single discount by ID for editing
     */
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

    /**
     * Create: Insert a new discount type
     */
    function insertDiscount($json)
    {
        include "connection.php";

        $json = json_decode($json, true);

        $sql = "INSERT INTO Enum_Discount (Discount_Name, Discount_Percentage, Is_Active) 
                VALUES (:name, :percentage, 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $json['discount_name']);
        $stmt->bindParam(":percentage", $json['discount_percentage']);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Update: Modify an existing discount's name or percentage
     */
    function updateDiscount($json)
    {
        include "connection.php";

        $json = json_decode($json, true);

        $sql = "UPDATE Enum_Discount 
                SET Discount_Name = :name, 
                    Discount_Percentage = :percentage 
                WHERE Discount_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $json['discount_name']);
        $stmt->bindParam(":percentage", $json['discount_percentage']);
        $stmt->bindParam(":id", $json['discount_id']);
        $stmt->execute();

        return json_encode($stmt->rowCount() >= 0 ? 1 : 0);
    }

    /**
     * Soft Delete / Restore:
     * Toggles Is_Active (1 -> 0 or 0 -> 1)
     */
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

    /**
     * Hard Delete:
     * Permanently removes the discount from MySQL with Foreign Key check
     */
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

// Router for operation and json payload
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

