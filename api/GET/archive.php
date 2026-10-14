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
                               CASE WHEN d.Discount_Type_ID = 2 THEN CONCAT('Fixed: ₱', FORMAT(d.Fixed_Amount, 2)) ELSE CONCAT('Rate: ', FORMAT(d.Discount_Percentage, 2), '%') END AS Details
                        FROM Enum_Discount d
                        WHERE d.Is_Active = 0
                        ORDER BY d.Discount_Name ASC";
                break;

            case 'departments':
                $sql = "SELECT d.Station_ID AS ID,
                               CONCAT(d.Code_Prefix, '-', LPAD(d.Station_ID, 3, '0')) AS Code,
                               d.Station_Name AS Name,
                               CONCAT('Department Station | Prefix: ', d.Code_Prefix) AS Details
                        FROM Enum_Department_Station d
                        WHERE d.Is_Active = 0
                        ORDER BY d.Station_Name ASC";
                break;

            case 'staff':
            case 'users':
                $sql = "SELECT u.User_ID AS ID,
                               CONCAT('USR-', LPAD(u.User_ID, 3, '0')) AS Code,
                               CONCAT(u.Last_Name, ', ', u.First_Name, ' (@', u.Username, ')') AS Name,
                               CONCAT('Role: ', r.Role_Name, ' | Station: ', COALESCE(s.Station_Name, 'None')) AS Details
                        FROM System_User u
                        INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID
                        LEFT JOIN Enum_Department_Station s ON u.Station_ID = s.Station_ID
                        WHERE u.Is_Active = 0
                        ORDER BY u.User_ID ASC";
                break;

            case 'beds':
                $sql = "SELECT b.Bed_ID AS ID,
                               b.Bed_Code AS Code,
                               CONCAT(r.Room_Name, ' (', b.Bed_Code, ')') AS Name,
                               CONCAT('Room: ', r.Room_Name, ' | Type: ', rt.Type_Name, ' | Rate: ₱', FORMAT(COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate), 2)) AS Details
                        FROM Room_Bed b
                        INNER JOIN Room r ON b.Room_ID = r.Room_ID
                        INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                        WHERE b.Is_Active = 0
                        ORDER BY b.Bed_Code ASC";
                break;

            case 'specialties':
                $sql = "SELECT s.Specialty_ID AS ID,
                               CONCAT('SPEC-', LPAD(s.Specialty_ID, 3, '0')) AS Code,
                               s.Specialty_Name AS Name,
                               'Doctor Medical Specialty Classification' AS Details
                        FROM Enum_Specialty s
                        WHERE s.Is_Active = 0
                        ORDER BY s.Specialty_Name ASC";
                break;

            case 'payment_methods':
                $sql = "SELECT pm.Payment_Method_ID AS ID,
                               CONCAT(pm.Code_Prefix, '-', LPAD(pm.Payment_Method_ID, 3, '0')) AS Code,
                               pm.Method_Name AS Name,
                               CONCAT('Category: ', pm.Category_Type, ' | ', COALESCE(pm.Description, '')) AS Details
                        FROM Enum_Payment_Method pm
                        WHERE pm.Is_Active = 0 AND pm.Code_Prefix NOT IN ('AR', 'NR')
                        ORDER BY pm.Method_Name ASC";
                break;

            case 'room_types':
                $sql = "SELECT rt.Room_Type_ID AS ID,
                               CONCAT(rt.Code_Prefix, '-', LPAD(rt.Room_Type_ID, 3, '0')) AS Code,
                               rt.Type_Name AS Name,
                               CONCAT('Daily Rate: ₱', FORMAT(rt.Daily_Rate, 2), '/day') AS Details
                        FROM Enum_Room_Type rt
                        WHERE rt.Is_Active = 0
                        ORDER BY rt.Type_Name ASC";
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
