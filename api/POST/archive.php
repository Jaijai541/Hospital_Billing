<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class ArchiveManager
{
    function restoreRecord($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $entity = $json['entity'] ?? '';
        $id = intval($json['id'] ?? 0);

        switch ($entity) {
            case 'patients':
                $sql = "UPDATE Patient SET Is_Active = 1 WHERE Patient_ID = :id";
                break;
            case 'doctors':
                $sql = "UPDATE Doctor SET Is_Active = 1 WHERE Doctor_ID = :id";
                break;
            case 'rooms':
                $sql = "UPDATE Room SET Is_Active = 1 WHERE Room_ID = :id";
                $conn->prepare("UPDATE Room_Bed SET Is_Active = 1 WHERE Room_ID = ?")->execute([$id]);
                break;
            case 'catalogs':
                $sql = "UPDATE Charge_Catalogs SET Is_Active = 1 WHERE Catalog_ID = :id";
                break;
            case 'discounts':
                $sql = "UPDATE Enum_Discount SET Is_Active = 1 WHERE Discount_ID = :id";
                break;
            default:
                return json_encode(0);
        }

        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $id);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    function hardDeleteRecord($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $entity = $json['entity'] ?? '';
        $id = intval($json['id'] ?? 0);

        try {
            switch ($entity) {
                case 'patients':
                    $sql = "DELETE FROM Patient WHERE Patient_ID = :id";
                    break;
                case 'doctors':
                    $sql = "DELETE FROM Doctor WHERE Doctor_ID = :id";
                    break;
                case 'rooms':
                    $sql = "DELETE FROM Room WHERE Room_ID = :id";
                    break;
                case 'catalogs':
                    $sql = "DELETE FROM Charge_Catalogs WHERE Catalog_ID = :id";
                    break;
                case 'discounts':
                    $sql = "DELETE FROM Enum_Discount WHERE Discount_ID = :id";
                    break;
                default:
                    return json_encode(0);
            }

            $stmt = $conn->prepare($sql);
            $stmt->bindParam(":id", $id);
            $stmt->execute();

            return json_encode($stmt->rowCount() > 0 ? 1 : 0);
        } catch (PDOException $e) {
            return json_encode([
                "status" => 0,
                "message" => "Cannot permanently delete: This archived item is referenced in historical hospital records."
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

$archive = new ArchiveManager();
switch ($operation) {
    case "restoreRecord":
        echo $archive->restoreRecord($json);
        break;
    case "hardDeleteRecord":
        echo $archive->hardDeleteRecord($json);
        break;
}
?>
