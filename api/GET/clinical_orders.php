<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class ClinicalOrderManager
{
    function getCatalogList()
    {
        include "connection.php";

        $sql = "SELECT 
                    Catalog_ID,
                    CONCAT(Code_Prefix, '-', LPAD(Catalog_ID, 3, '0')) AS Item_Code,
                    Item_Name,
                    Category_Type,
                    Unit_Price
                FROM Charge_Catalogs
                WHERE Is_Active = 1
                ORDER BY Category_Type ASC, Item_Name ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    function getDoctorOrders($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        $sql = "SELECT 
                    dor.Request_ID,
                    dor.Admission_Doctor_ID,
                    CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                    dor.Catalog_ID,
                    c.Item_Name,
                    c.Category_Type,
                    CONCAT(c.Code_Prefix, '-', LPAD(c.Catalog_ID, 3, '0')) AS Item_Code,
                    dor.Quantity,
                    c.Unit_Price,
                    (dor.Quantity * c.Unit_Price) AS Total_Price,
                    dor.Status,
                    DATE_FORMAT(dor.Request_Timestamp, '%Y-%m-%d %h:%i %p') AS Request_Timestamp,
                    DATE_FORMAT(dor.Administered_Timestamp, '%Y-%m-%d %h:%i %p') AS Administered_Timestamp
                FROM Doctor_Order_Request dor
                INNER JOIN Admission_Doctor ad ON dor.Admission_Doctor_ID = ad.Admission_Doctor_ID
                INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                INNER JOIN Charge_Catalogs c ON dor.Catalog_ID = c.Catalog_ID
                WHERE ad.Admission_ID = :aid
                ORDER BY dor.Request_ID DESC";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':aid' => $admissionId]);
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    function getDoctorRounds($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $admissionId = intval($json['admission_id'] ?? 0);

        $sql = "SELECT 
                    drl.Round_ID,
                    drl.Admission_Doctor_ID,
                    CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name,
                    dt.Type_Name AS Doctor_Type,
                    drl.Charged_Fee,
                    DATE_FORMAT(drl.Round_Timestamp, '%Y-%m-%d %h:%i %p') AS Round_Timestamp
                FROM Doctor_Round_Log drl
                INNER JOIN Admission_Doctor ad ON drl.Admission_Doctor_ID = ad.Admission_Doctor_ID
                INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                INNER JOIN Enum_Doctor_Type dt ON d.Doctor_Type_ID = dt.Doctor_Type_ID
                WHERE ad.Admission_ID = :aid
                ORDER BY drl.Round_ID DESC";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':aid' => $admissionId]);
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }
}

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "{}";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "{}";
}

$clinical = new ClinicalOrderManager();
switch ($operation) {
    case 'getCatalogList':
        echo $clinical->getCatalogList();
        break;
    case 'getDoctorOrders':
        echo $clinical->getDoctorOrders($json);
        break;
    case 'getDoctorRounds':
        echo $clinical->getDoctorRounds($json);
        break;
}
?>
