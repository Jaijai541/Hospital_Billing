<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class ArchiveManager
{
    private function getCategoryMap()
    {
        return [
            'patients' => [
                'label' => 'Patients',
                'sql' => "SELECT p.Patient_ID AS ID, 'patients' AS Entity, 'Patients' AS Entity_Label,
                                 CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Code,
                                 CONCAT(p.Last_Name, ', ', p.First_Name) AS Name,
                                 CONCAT('DOB: ', p.Date_Of_Birth, ' | Contact: ', COALESCE(p.Contact_Number, 'N/A')) AS Details
                          FROM Patient p 
                          WHERE p.Is_Active = 0 
                          ORDER BY p.Last_Name ASC"
            ],
            'doctors' => [
                'label' => 'Doctors',
                'sql' => "SELECT d.Doctor_ID AS ID, 'doctors' AS Entity, 'Doctors' AS Entity_Label,
                                 CONCAT(d.Code_Prefix, '-', LPAD(d.Doctor_ID, 3, '0')) AS Code,
                                 CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Name,
                                 CONCAT(dt.Type_Name, ' | Round Fee: ₱', FORMAT(d.Base_Round_Fee, 2)) AS Details
                          FROM Doctor d
                          INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
                          WHERE d.Is_Active = 0
                          ORDER BY d.Last_Name ASC"
            ],
            'rooms' => [
                'label' => 'Rooms',
                'sql' => "SELECT r.Room_ID AS ID, 'rooms' AS Entity, 'Rooms' AS Entity_Label,
                                 r.Room_Name AS Code,
                                 r.Room_Name AS Name,
                                 CONCAT(rt.Type_Name, ' | Rate: ₱', FORMAT(rt.Daily_Rate, 2), '/day | Cap: ', r.Capacity, ' bed(s)') AS Details
                          FROM Room r
                          INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                          WHERE r.Is_Active = 0
                          ORDER BY r.Room_Name ASC"
            ],
            'beds' => [
                'label' => 'Beds (Individual)',
                'sql' => "SELECT b.Bed_ID AS ID, 'beds' AS Entity, 'Beds' AS Entity_Label,
                                 b.Bed_Code AS Code,
                                 CONCAT(r.Room_Name, ' (', b.Bed_Code, ')') AS Name,
                                 CONCAT('Room: ', r.Room_Name, ' | Type: ', rt.Type_Name, ' | Rate: ₱', FORMAT(COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate), 2)) AS Details
                          FROM Room_Bed b
                          INNER JOIN Room r ON b.Room_ID = r.Room_ID
                          INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                          WHERE b.Is_Active = 0
                          ORDER BY b.Bed_Code ASC"
            ],
            'catalogs' => [
                'label' => 'Charge Catalogs',
                'sql' => "SELECT c.Catalog_ID AS ID, 'catalogs' AS Entity, 'Charge Catalogs' AS Entity_Label,
                                 CONCAT(c.Code_Prefix, '-', LPAD(c.Catalog_ID, 3, '0')) AS Code,
                                 c.Item_Name AS Name,
                                 CONCAT('Category: ', c.Category_Type, ' | Unit Price: ₱', FORMAT(c.Unit_Price, 2)) AS Details
                          FROM Charge_Catalogs c
                          WHERE c.Is_Active = 0
                          ORDER BY c.Category_Type ASC, c.Item_Name ASC"
            ],
            'discounts' => [
                'label' => 'Billing Discounts',
                'sql' => "SELECT d.Discount_ID AS ID, 'discounts' AS Entity, 'Billing Discounts' AS Entity_Label,
                                 CONCAT('DISC-', LPAD(d.Discount_ID, 3, '0')) AS Code,
                                 d.Discount_Name AS Name,
                                 CASE WHEN d.Discount_Type_ID = 2 THEN CONCAT('Fixed: ₱', FORMAT(d.Fixed_Amount, 2)) ELSE CONCAT('Rate: ', FORMAT(d.Discount_Percentage, 2), '%') END AS Details
                          FROM Enum_Discount d
                          WHERE d.Is_Active = 0
                          ORDER BY d.Discount_Name ASC"
            ],
            'departments' => [
                'label' => 'Departments & Stations',
                'sql' => "SELECT d.Station_ID AS ID, 'departments' AS Entity, 'Departments & Stations' AS Entity_Label,
                                 CONCAT(d.Code_Prefix, '-', LPAD(d.Station_ID, 3, '0')) AS Code,
                                 d.Station_Name AS Name,
                                 CONCAT('Department Station | Prefix: ', d.Code_Prefix) AS Details
                          FROM Enum_Department_Station d
                          WHERE d.Is_Active = 0
                          ORDER BY d.Station_Name ASC"
            ],
            'staff' => [
                'label' => 'Staff & System Users',
                'sql' => "SELECT u.User_ID AS ID, 'staff' AS Entity, 'Staff & Users' AS Entity_Label,
                                 CONCAT('USR-', LPAD(u.User_ID, 3, '0')) AS Code,
                                 CONCAT(u.Last_Name, ', ', u.First_Name, ' (@', u.Username, ')') AS Name,
                                 CONCAT('Role: ', r.Role_Name, ' | Station: ', COALESCE(s.Station_Name, 'None')) AS Details
                          FROM System_User u
                          INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID
                          LEFT JOIN Enum_Department_Station s ON u.Station_ID = s.Station_ID
                          WHERE u.Is_Active = 0
                          ORDER BY u.User_ID ASC"
            ],
            'specialties' => [
                'label' => 'Medical Specialties',
                'sql' => "SELECT s.Specialty_ID AS ID, 'specialties' AS Entity, 'Medical Specialties' AS Entity_Label,
                                 CONCAT('SPEC-', LPAD(s.Specialty_ID, 3, '0')) AS Code,
                                 s.Specialty_Name AS Name,
                                 'Doctor Medical Specialty Classification' AS Details
                          FROM Enum_Specialty s
                          WHERE s.Is_Active = 0
                          ORDER BY s.Specialty_Name ASC"
            ],
            'payment_methods' => [
                'label' => 'Payment Methods',
                'sql' => "SELECT pm.Payment_Method_ID AS ID, 'payment_methods' AS Entity, 'Payment Methods' AS Entity_Label,
                                 CONCAT(pm.Code_Prefix, '-', LPAD(pm.Payment_Method_ID, 3, '0')) AS Code,
                                 pm.Method_Name AS Name,
                                 CONCAT('Category: ', pm.Category_Type, ' | ', COALESCE(pm.Description, '')) AS Details
                          FROM Enum_Payment_Method pm
                          WHERE pm.Is_Active = 0 AND pm.Code_Prefix NOT IN ('AR', 'NR')
                          ORDER BY pm.Method_Name ASC"
            ],
            'room_types' => [
                'label' => 'Room Classifications',
                'sql' => "SELECT rt.Room_Type_ID AS ID, 'room_types' AS Entity, 'Room Classifications' AS Entity_Label,
                                 CONCAT(rt.Code_Prefix, '-', LPAD(rt.Room_Type_ID, 3, '0')) AS Code,
                                 rt.Type_Name AS Name,
                                 CONCAT('Daily Rate: ₱', FORMAT(rt.Daily_Rate, 2), '/day') AS Details
                          FROM Enum_Room_Type rt
                          WHERE rt.Is_Active = 0
                          ORDER BY rt.Type_Name ASC"
            ],
            'roles' => [
                'label' => 'System Roles',
                'sql' => "SELECT r.Role_ID AS ID, 'roles' AS Entity, 'System Roles' AS Entity_Label,
                                 CONCAT('ROLE-', LPAD(r.Role_ID, 3, '0')) AS Code,
                                 r.Role_Name AS Name,
                                 CONCAT('Access Role | Supervisor: ', CASE WHEN r.Is_Higher_Up = 1 THEN 'Yes' ELSE 'No' END) AS Details
                          FROM Enum_User_Role r
                          WHERE r.Is_Active = 0
                          ORDER BY r.Role_Name ASC"
            ]
        ];
    }

    function getArchivedRecords($json)
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $categoryMap = $this->getCategoryMap();

        $selectedEntities = [];
        if (!empty($json['entities']) && is_array($json['entities'])) {
            $selectedEntities = $json['entities'];
        } else if (!empty($json['entity'])) {
            if (is_array($json['entity'])) {
                $selectedEntities = $json['entity'];
            } else if ($json['entity'] === 'all') {
                $selectedEntities = array_keys($categoryMap);
            } else {
                $selectedEntities = [$json['entity']];
            }
        } else {
            $selectedEntities = ['patients'];
        }

        if (in_array('all', $selectedEntities)) {
            $selectedEntities = array_keys($categoryMap);
        }

        $allRecords = [];
        foreach ($selectedEntities as $ent) {
            if ($ent === 'users') {
                $ent = 'staff';
            }
            if (isset($categoryMap[$ent])) {
                $stmt = $conn->prepare($categoryMap[$ent]['sql']);
                $stmt->execute();
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                if (!empty($rows)) {
                    $allRecords = array_merge($allRecords, $rows);
                }
            }
        }

        return json_encode($allRecords);
    }

    function getArchiveCounts()
    {
        include "connection.php";

        $countQueries = [
            'patients' => 'SELECT COUNT(*) FROM Patient WHERE Is_Active = 0',
            'doctors' => 'SELECT COUNT(*) FROM Doctor WHERE Is_Active = 0',
            'rooms' => 'SELECT COUNT(*) FROM Room WHERE Is_Active = 0',
            'beds' => 'SELECT COUNT(*) FROM Room_Bed WHERE Is_Active = 0',
            'catalogs' => 'SELECT COUNT(*) FROM Charge_Catalogs WHERE Is_Active = 0',
            'discounts' => 'SELECT COUNT(*) FROM Enum_Discount WHERE Is_Active = 0',
            'departments' => 'SELECT COUNT(*) FROM Enum_Department_Station WHERE Is_Active = 0',
            'staff' => 'SELECT COUNT(*) FROM System_User WHERE Is_Active = 0',
            'specialties' => 'SELECT COUNT(*) FROM Enum_Specialty WHERE Is_Active = 0',
            'payment_methods' => 'SELECT COUNT(*) FROM Enum_Payment_Method WHERE Is_Active = 0 AND Code_Prefix NOT IN (\'AR\', \'NR\')',
            'room_types' => 'SELECT COUNT(*) FROM Enum_Room_Type WHERE Is_Active = 0',
            'roles' => 'SELECT COUNT(*) FROM Enum_User_Role WHERE Is_Active = 0'
        ];

        $counts = [];
        $total = 0;
        foreach ($countQueries as $cat => $sql) {
            $stmt = $conn->query($sql);
            $c = (int)($stmt ? $stmt->fetchColumn() : 0);
            $counts[$cat] = $c;
            $total += $c;
        }
        $counts['total'] = $total;

        return json_encode($counts);
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "";
} else {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "";
}

$archive = new ArchiveManager();
switch ($operation) {
    case "getArchivedRecords":
        echo $archive->getArchivedRecords($json);
        break;
    case "getArchiveCounts":
        echo $archive->getArchiveCounts();
        break;
    default:
        echo json_encode([]);
        break;
}
?>
