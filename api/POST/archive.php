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
            case 'departments':
                $sql = "UPDATE Enum_Department_Station SET Is_Active = 1 WHERE Station_ID = :id";
                break;
            case 'staff':
            case 'users':
                $sql = "UPDATE System_User SET Is_Active = 1 WHERE User_ID = :id";
                break;
            case 'beds':
                $sql = "UPDATE Room_Bed SET Is_Active = 1 WHERE Bed_ID = :id";
                break;
            case 'specialties':
                $sql = "UPDATE Enum_Specialty SET Is_Active = 1 WHERE Specialty_ID = :id";
                break;
            case 'payment_methods':
                $sql = "UPDATE Enum_Payment_Method SET Is_Active = 1 WHERE Payment_Method_ID = :id";
                break;
            case 'room_types':
                $sql = "UPDATE Enum_Room_Type SET Is_Active = 1 WHERE Room_Type_ID = :id";
                break;
            case 'roles':
                $sql = "UPDATE Enum_User_Role SET Is_Active = 1 WHERE Role_ID = :id";
                break;
            default:
                return json_encode(0);
        }

        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $id);
        $stmt->execute();

        $rows = $stmt->rowCount();
        if ($rows > 0) {
            $performedBy = !empty($json['performed_by']) ? trim($json['performed_by']) : 'System Admin';
            $userId = intval($json['user_id'] ?? 1);
            $recordName = !empty($json['name']) ? trim($json['name']) : "Record #{$id}";
            $auditStmt = $conn->prepare("
                INSERT INTO Audit_Log (User_ID, Admission_ID, Module_ID, Action_ID, Record_Reference, Description, Performed_By)
                VALUES (:uid, NULL, 12, 11, :ref, :descr, :by)
            ");
            $auditStmt->execute([
                ':uid' => $userId,
                ':ref' => strtoupper(substr($entity, 0, 3)) . "-{$id}",
                ':descr' => "Restored archived {$entity} record: {$recordName} (ID: {$id})",
                ':by' => $performedBy
            ]);
        }

        return json_encode($rows > 0 ? 1 : 0);
    }

    function hardDeleteRecord($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $entity = $json['entity'] ?? '';
        $id = intval($json['id'] ?? 0);

        if ($id <= 0 || empty($entity)) {
            return json_encode(["status" => 0, "message" => "Invalid entity or record ID."]);
        }

        $userId = intval($json['user_id'] ?? 0);
        if ($userId > 0) {
            $uStmt = $conn->prepare("
                SELECT u.Role_ID, r.Is_Higher_Up, r.Permissions 
                FROM System_User u 
                INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID 
                WHERE u.User_ID = ?
            ");
            $uStmt->execute([$userId]);
            $uRow = $uStmt->fetch(PDO::FETCH_ASSOC);
            if ($uRow) {
                $isHigher = intval($uRow['Is_Higher_Up'] ?? 0);
                $roleId = intval($uRow['Role_ID'] ?? 0);
                $perms = json_decode($uRow['Permissions'] ?? '[]', true);
                if ($roleId !== 1 && $isHigher !== 1 && (!is_array($perms) || !in_array('can_delete', $perms))) {
                    return json_encode([
                        "status" => 0,
                        "message" => "Permission denied: You do not have permission to delete or purge records."
                    ]);
                }
            }
        }

        try {
            $conn->beginTransaction();

            switch ($entity) {
                case 'patients':
                    $admStmt = $conn->prepare("SELECT Admission_ID FROM Admission WHERE Patient_ID = ?");
                    $admStmt->execute([$id]);
                    $admissions = $admStmt->fetchAll(PDO::FETCH_COLUMN);

                    if (!empty($admissions)) {
                        $inClause = implode(',', array_fill(0, count($admissions), '?'));

                        $bedStmt = $conn->prepare("SELECT Bed_ID FROM Room_Transfer_Log WHERE Admission_ID IN ($inClause) AND Date_Out IS NULL");
                        $bedStmt->execute($admissions);
                        $activeBeds = $bedStmt->fetchAll(PDO::FETCH_COLUMN);
                        if (!empty($activeBeds)) {
                            $bedIn = implode(',', array_fill(0, count($activeBeds), '?'));
                            $conn->prepare("UPDATE Room_Bed SET Is_Available = 1 WHERE Bed_ID IN ($bedIn)")->execute($activeBeds);
                        }

                        $conn->prepare("DELETE FROM Promissory_Note WHERE Admission_ID IN ($inClause)")->execute($admissions);
                        $conn->prepare("DELETE FROM Invoice_Payment WHERE Admission_ID IN ($inClause)")->execute($admissions);
                        $conn->prepare("DELETE FROM Invoice_Applied_Discount WHERE Invoice_ID IN (SELECT Invoice_ID FROM Final_Invoice WHERE Admission_ID IN ($inClause))")->execute($admissions);
                        $conn->prepare("DELETE FROM Final_Invoice WHERE Admission_ID IN ($inClause)")->execute($admissions);
                        $conn->prepare("DELETE FROM Billing_Ledger WHERE Admission_ID IN ($inClause)")->execute($admissions);
                        $conn->prepare("DELETE FROM Doctor_Order_Request WHERE Admission_Doctor_ID IN (SELECT Admission_Doctor_ID FROM Admission_Doctor WHERE Admission_ID IN ($inClause))")->execute($admissions);
                        $conn->prepare("DELETE FROM Doctor_Round_Log WHERE Admission_Doctor_ID IN (SELECT Admission_Doctor_ID FROM Admission_Doctor WHERE Admission_ID IN ($inClause))")->execute($admissions);
                        $conn->prepare("DELETE FROM Admission_Doctor WHERE Admission_ID IN ($inClause)")->execute($admissions);
                        $conn->prepare("DELETE FROM Room_Transfer_Log WHERE Admission_ID IN ($inClause)")->execute($admissions);
                        $conn->prepare("UPDATE Audit_Log SET Admission_ID = NULL WHERE Admission_ID IN ($inClause)")->execute($admissions);
                        $conn->prepare("DELETE FROM Admission WHERE Patient_ID = ?")->execute([$id]);
                    }

                    $stmt = $conn->prepare("DELETE FROM Patient WHERE Patient_ID = ?");
                    $stmt->execute([$id]);
                    break;

                case 'doctors':
                    $adStmt = $conn->prepare("SELECT Admission_Doctor_ID FROM Admission_Doctor WHERE Doctor_ID = ?");
                    $adStmt->execute([$id]);
                    $adIds = $adStmt->fetchAll(PDO::FETCH_COLUMN);

                    if (!empty($adIds)) {
                        $inClause = implode(',', array_fill(0, count($adIds), '?'));
                        $conn->prepare("UPDATE Billing_Ledger SET Request_ID = NULL WHERE Request_ID IN (SELECT Request_ID FROM Doctor_Order_Request WHERE Admission_Doctor_ID IN ($inClause))")->execute($adIds);
                        $conn->prepare("UPDATE Billing_Ledger SET Round_ID = NULL WHERE Round_ID IN (SELECT Round_ID FROM Doctor_Round_Log WHERE Admission_Doctor_ID IN ($inClause))")->execute($adIds);
                        $conn->prepare("DELETE FROM Doctor_Order_Request WHERE Admission_Doctor_ID IN ($inClause)")->execute($adIds);
                        $conn->prepare("DELETE FROM Doctor_Round_Log WHERE Admission_Doctor_ID IN ($inClause)")->execute($adIds);
                        $conn->prepare("DELETE FROM Admission_Doctor WHERE Doctor_ID = ?")->execute([$id]);
                    }

                    $conn->prepare("DELETE FROM Doctor_Specialty WHERE Doctor_ID = ?")->execute([$id]);
                    $conn->prepare("UPDATE Doctor_Order_Request SET Administered_By_Doctor_ID = NULL WHERE Administered_By_Doctor_ID = ?")->execute([$id]);
                    $stmt = $conn->prepare("DELETE FROM Doctor WHERE Doctor_ID = ?");
                    $stmt->execute([$id]);
                    break;

                case 'rooms':
                    $bedStmt = $conn->prepare("SELECT Bed_ID FROM Room_Bed WHERE Room_ID = ?");
                    $bedStmt->execute([$id]);
                    $bedIds = $bedStmt->fetchAll(PDO::FETCH_COLUMN);

                    if (!empty($bedIds)) {
                        $inClause = implode(',', array_fill(0, count($bedIds), '?'));
                        $conn->prepare("UPDATE Billing_Ledger SET Transfer_ID = NULL WHERE Transfer_ID IN (SELECT Transfer_ID FROM Room_Transfer_Log WHERE Bed_ID IN ($inClause))")->execute($bedIds);
                        $conn->prepare("DELETE FROM Room_Transfer_Log WHERE Bed_ID IN ($inClause)")->execute($bedIds);
                        $conn->prepare("DELETE FROM Room_Bed WHERE Room_ID = ?")->execute([$id]);
                    }

                    $stmt = $conn->prepare("DELETE FROM Room WHERE Room_ID = ?");
                    $stmt->execute([$id]);
                    break;

                case 'beds':
                    $conn->prepare("UPDATE Billing_Ledger SET Transfer_ID = NULL WHERE Transfer_ID IN (SELECT Transfer_ID FROM Room_Transfer_Log WHERE Bed_ID = ?)")->execute([$id]);
                    $conn->prepare("DELETE FROM Room_Transfer_Log WHERE Bed_ID = ?")->execute([$id]);
                    $stmt = $conn->prepare("DELETE FROM Room_Bed WHERE Bed_ID = ?");
                    $stmt->execute([$id]);
                    break;

                case 'catalogs':
                    $conn->prepare("UPDATE Billing_Ledger SET Catalog_ID = NULL WHERE Catalog_ID = ?")->execute([$id]);
                    $conn->prepare("UPDATE Billing_Ledger SET Request_ID = NULL WHERE Request_ID IN (SELECT Request_ID FROM Doctor_Order_Request WHERE Catalog_ID = ?)")->execute([$id]);
                    $conn->prepare("DELETE FROM Doctor_Order_Request WHERE Catalog_ID = ?")->execute([$id]);
                    $stmt = $conn->prepare("DELETE FROM Charge_Catalogs WHERE Catalog_ID = ?");
                    $stmt->execute([$id]);
                    break;

                case 'discounts':
                    $conn->prepare("UPDATE Final_Invoice SET Discount_ID = NULL WHERE Discount_ID = ?")->execute([$id]);
                    $conn->prepare("UPDATE Invoice_Payment SET Discount_ID = NULL WHERE Discount_ID = ?")->execute([$id]);
                    $conn->prepare("DELETE FROM Invoice_Applied_Discount WHERE Discount_ID = ?")->execute([$id]);
                    $stmt = $conn->prepare("DELETE FROM Enum_Discount WHERE Discount_ID = ?");
                    $stmt->execute([$id]);
                    break;

                case 'departments':
                    $fallbackStation = $conn->query("SELECT Station_ID FROM Enum_Department_Station WHERE Station_ID != $id AND Is_Active = 1 ORDER BY Station_ID ASC LIMIT 1")->fetchColumn();
                    if (!$fallbackStation) {
                        $fallbackStation = 1;
                    }
                    $conn->prepare("UPDATE Doctor SET Station_ID = ? WHERE Station_ID = ?")->execute([$fallbackStation, $id]);
                    $conn->prepare("UPDATE Billing_Ledger SET Station_ID = ? WHERE Station_ID = ?")->execute([$fallbackStation, $id]);
                    $stmt = $conn->prepare("DELETE FROM Enum_Department_Station WHERE Station_ID = ?");
                    $stmt->execute([$id]);
                    break;

                case 'staff':
                case 'users':
                    if ($id === 1) {
                        $conn->rollBack();
                        return json_encode([
                            "status" => 0,
                            "message" => "The primary Administrator account is protected and cannot be deleted."
                        ]);
                    }
                    $conn->prepare("UPDATE Final_Invoice SET Processed_By_User_ID = 1 WHERE Processed_By_User_ID = ?")->execute([$id]);
                    $conn->prepare("UPDATE Invoice_Payment SET Cashier_User_ID = 1 WHERE Cashier_User_ID = ?")->execute([$id]);
                    $conn->prepare("UPDATE Audit_Log SET User_ID = NULL WHERE User_ID = ?")->execute([$id]);
                    $conn->prepare("UPDATE Doctor_Order_Request SET Administered_By_User_ID = NULL WHERE Administered_By_User_ID = ?")->execute([$id]);
                    $stmt = $conn->prepare("DELETE FROM System_User WHERE User_ID = ?");
                    $stmt->execute([$id]);
                    break;

                case 'specialties':
                    $conn->prepare("DELETE FROM Doctor_Specialty WHERE Specialty_ID = ?")->execute([$id]);
                    $stmt = $conn->prepare("DELETE FROM Enum_Specialty WHERE Specialty_ID = ?");
                    $stmt->execute([$id]);
                    break;

                case 'payment_methods':
                    if ($id === 1) {
                        $conn->rollBack();
                        return json_encode([
                            "status" => 0,
                            "message" => "The default Cash payment method is protected and cannot be deleted."
                        ]);
                    }
                    $conn->prepare("UPDATE Invoice_Payment SET Payment_Method_ID = 1 WHERE Payment_Method_ID = ?")->execute([$id]);
                    $stmt = $conn->prepare("DELETE FROM Enum_Payment_Method WHERE Payment_Method_ID = ?");
                    $stmt->execute([$id]);
                    break;

                case 'room_types':
                    $fallbackType = $conn->query("SELECT Room_Type_ID FROM Enum_Room_Type WHERE Room_Type_ID != $id AND Is_Active = 1 ORDER BY Room_Type_ID ASC LIMIT 1")->fetchColumn();
                    if (!$fallbackType) {
                        $fallbackType = 1;
                    }
                    $conn->prepare("UPDATE Room SET Room_Type_ID = ? WHERE Room_Type_ID = ?")->execute([$fallbackType, $id]);
                    $stmt = $conn->prepare("DELETE FROM Enum_Room_Type WHERE Room_Type_ID = ?");
                    $stmt->execute([$id]);
                    break;

                case 'roles':
                    if ($id === 1) {
                        $conn->rollBack();
                        return json_encode([
                            "status" => 0,
                            "message" => "The primary Administrator role is protected and cannot be deleted."
                        ]);
                    }
                    $fallbackRole = $conn->query("SELECT Role_ID FROM Enum_User_Role WHERE Role_ID != $id AND Is_Active = 1 ORDER BY Role_ID ASC LIMIT 1")->fetchColumn();
                    if (!$fallbackRole) {
                        $fallbackRole = 2;
                    }
                    $conn->prepare("UPDATE System_User SET Role_ID = ? WHERE Role_ID = ?")->execute([$fallbackRole, $id]);
                    $stmt = $conn->prepare("DELETE FROM Enum_User_Role WHERE Role_ID = ?");
                    $stmt->execute([$id]);
                    break;

                default:
                    $conn->rollBack();
                    return json_encode(0);
            }
            $performedBy = !empty($json['performed_by']) ? trim($json['performed_by']) : 'System Admin';
            $userId = intval($json['user_id'] ?? 1);
            $recordName = !empty($json['name']) ? trim($json['name']) : "Record #{$id}";
            $auditStmt = $conn->prepare("
                INSERT INTO Audit_Log (User_ID, Admission_ID, Module_ID, Action_ID, Record_Reference, Description, Performed_By)
                VALUES (:uid, NULL, 12, 12, :ref, :descr, :by)
            ");
            $auditStmt->execute([
                ':uid' => $userId,
                ':ref' => strtoupper(substr($entity, 0, 3)) . "-{$id}",
                ':descr' => "Permanently purged archived {$entity} record: {$recordName} (ID: {$id})",
                ':by' => $performedBy
            ]);

            $conn->commit();
            return json_encode(1);
        } catch (Exception $e) {
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }
            return json_encode([
                "status" => 0,
                "message" => "Permanent deletion error: " . $e->getMessage()
            ]);
        }
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "";
} else if ($method === 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "";
} else {
    $operation = $operation ?? "";
    $json = $json ?? "";
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
