<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class ArchiveManager
{
    function getArchivedRecords($json)
    {
        include "connection.php";

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
    case "getArchivedRecords":
        echo $archive->getArchivedRecords($json);
        break;
}
?>
