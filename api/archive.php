<?php
/**
 * System Archive / Soft-Deleted Records API
 * Central hub for viewing and restoring archived master file records
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class ArchiveManager
{
    /**
     * Read: Retrieve archived records for a specific entity
     */
    function getArchivedRecords($json)
    {
        include __DIR__ . "/../connection.php";

        $json = json_decode($json, true);
        $entity = $json['entity'] ?? 'patients';
        $records = [];

        switch ($entity) {
            case 'patients':
                $sql = "SELECT p.Patient_ID AS ID, 
                               CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Code,
                               CONCAT(p.Last_Name, ', ', p.First_Name) AS Name,
                               CONCAT('DOB: ', p.Date_Of_Birth, ' | Contact: ', COALESCE(p.Contact_Number, 'N/A')) AS Details
                        FROM Patient p 
                        WHERE p.Is_Active = 0 
                        ORDER BY p.Last_Name ASC";
                break;

            case 'doctors':
                $sql = "SELECT d.Doctor_ID AS ID,
                               CONCAT(d.Code_Prefix, '-', LPAD(d.Doctor_ID, 3, '0')) AS Code,
                               CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Name,
                               CONCAT(dt.Type_Name, ' | Round Fee: ₱', FORMAT(d.Base_Round_Fee, 2)) AS Details
                        FROM Doctor d
                        INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
                        WHERE d.Is_Active = 0
                        ORDER BY d.Last_Name ASC";
                break;

            case 'rooms':
                $sql = "SELECT r.Room_ID AS ID,
                               r.Room_Name AS Code,
                               r.Room_Name AS Name,
                               CONCAT(rt.Type_Name, ' | Rate: ₱', FORMAT(rt.Daily_Rate, 2), '/day | Cap: ', r.Capacity, ' bed(s)') AS Details
                        FROM Room r
                        INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                        WHERE r.Is_Active = 0
                        ORDER BY r.Room_Name ASC";
                break;

            case 'catalogs':
                $sql = "SELECT c.Catalog_ID AS ID,
                               CONCAT(c.Code_Prefix, '-', LPAD(c.Catalog_ID, 3, '0')) AS Code,
                               c.Item_Name AS Name,
                               CONCAT('Category: ', c.Category_Type, ' | Unit Price: ₱', FORMAT(c.Unit_Price, 2)) AS Details
                        FROM Charge_Catalogs c
                        WHERE c.Is_Active = 0
                        ORDER BY c.Category_Type ASC, c.Item_Name ASC";
                break;

            case 'discounts':
                $sql = "SELECT d.Discount_ID AS ID,
                               CONCAT('DISC-', LPAD(d.Discount_ID, 3, '0')) AS Code,
                               d.Discount_Name AS Name,
                               CONCAT('Rate: ', FORMAT(d.Discount_Percentage, 2), '%') AS Details
                        FROM Enum_Discount d
                        WHERE d.Is_Active = 0
                        ORDER BY d.Discount_Name ASC";
                break;

            default:
                return json_encode([]);
        }

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($records);
    }

    /**
     * Restore: Reactivates an archived record (sets Is_Active = 1)
     */
    function restoreRecord($json)
    {
        include __DIR__ . "/../connection.php";

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

    /**
     * Hard Delete: Permanently removes the archived record
     */
    function hardDeleteRecord($json)
    {
        include __DIR__ . "/../connection.php";

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

// Router for operation and json payload
if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "";
}

$archive = new ArchiveManager();
switch ($operation) {
    case "getArchivedRecords":
        echo $archive->getArchivedRecords($json);
        break;
    case "restoreRecord":
        echo $archive->restoreRecord($json);
        break;
    case "hardDeleteRecord":
        echo $archive->hardDeleteRecord($json);
        break;
}
