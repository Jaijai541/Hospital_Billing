<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class RoomMaster
{
    function insertRoom($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $capacity = max(1, intval($json['capacity'] ?? 1));
        $roomName = trim($json['room_name']);
        $dailyRate = isset($json['daily_rate']) && $json['daily_rate'] !== '' ? floatval($json['daily_rate']) : null;

        $sql = "INSERT INTO Room (Room_Name, Room_Type_ID, Capacity, Custom_Daily_Rate, Is_Active) 
                VALUES (:name, :type_id, :capacity, :custom_rate, 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $roomName);
        $stmt->bindParam(":type_id", $json['room_type_id']);
        $stmt->bindParam(":capacity", $capacity);
        $stmt->bindParam(":custom_rate", $dailyRate);
        $stmt->execute();

        $roomId = $conn->lastInsertId();

        $stmtType = $conn->prepare("SELECT Code_Prefix FROM Enum_Room_Type WHERE Room_Type_ID = ?");
        $stmtType->execute([$json['room_type_id']]);
        $prefix = $stmtType->fetch(PDO::FETCH_ASSOC)['Code_Prefix'] ?? 'BED';

        $stmtBed = $conn->prepare("INSERT INTO Room_Bed (Room_ID, Bed_Code, Is_Available, Is_Active) VALUES (:room_id, :code, 1, 1)");
        for ($i = 1; $i <= $capacity; $i++) {
            $cleanName = preg_replace('/[^A-Za-z0-9]/', '', $roomName);
            $bedCode = sprintf("%s-%03d", strtoupper(substr($cleanName, 0, 5)), $i);

            $stmtBed->execute([
                ':room_id' => $roomId,
                ':code'    => $bedCode
            ]);
        }

        return json_encode(1);
    }

    function updateRoom($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $dailyRate = isset($json['daily_rate']) && $json['daily_rate'] !== '' ? floatval($json['daily_rate']) : null;

        $sql = "UPDATE Room 
                SET Room_Name         = :name, 
                    Room_Type_ID      = :type_id, 
                    Custom_Daily_Rate = :custom_rate 
                WHERE Room_ID         = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $json['room_name']);
        $stmt->bindParam(":type_id", $json['room_type_id']);
        $stmt->bindParam(":custom_rate", $dailyRate);
        $stmt->bindParam(":id", $json['room_id']);
        $stmt->execute();

        return json_encode($stmt->rowCount() >= 0 ? 1 : 0);
    }

    function toggleStatus($json)
    {
        include "connection.php";

        $json = json_decode($json, true);

        $sql = "UPDATE Room 
                SET Is_Active = CASE WHEN Is_Active = 1 THEN 0 ELSE 1 END 
                WHERE Room_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['room_id']);
        $stmt->execute();

        $conn->prepare("UPDATE Room_Bed SET Is_Active = (SELECT Is_Active FROM Room WHERE Room_ID = :id) WHERE Room_ID = :id2")
             ->execute([':id' => $json['room_id'], ':id2' => $json['room_id']]);

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    function hardDeleteRoom($json)
    {
        include "connection.php";

        $json = json_decode($json, true);

        try {
            $sql = "DELETE FROM Room WHERE Room_ID = :id";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(":id", $json['room_id']);
            $stmt->execute();

            return json_encode($stmt->rowCount() > 0 ? 1 : 0);
        } catch (PDOException $e) {
            return json_encode([
                "status" => 0,
                "message" => "Cannot hard delete: Beds in this room are referenced in patient room transfer logs. Please use Soft Delete instead."
            ]);
        }
    }

    function insertRoomType($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $typeName = trim($json['type_name'] ?? '');
        $codePrefix = strtoupper(trim($json['code_prefix'] ?? ''));
        $dailyRate = isset($json['daily_rate']) && $json['daily_rate'] !== '' ? floatval($json['daily_rate']) : null;

        if (empty($typeName)) {
            return json_encode([
                "success" => false,
                "message" => "Classification name is required."
            ]);
        }

        if (empty($codePrefix)) {
            return json_encode([
                "success" => false,
                "message" => "Bed code prefix is required."
            ]);
        }

        if ($dailyRate === null || $dailyRate < 0) {
            return json_encode([
                "success" => false,
                "message" => "Valid daily board and lodging rate is required."
            ]);
        }

        $checkStmt = $conn->prepare("SELECT Room_Type_ID, Type_Name, Code_Prefix, Daily_Rate, Is_Active FROM Enum_Room_Type WHERE LOWER(Type_Name) = LOWER(:name) OR LOWER(Code_Prefix) = LOWER(:prefix)");
        $checkStmt->execute([':name' => $typeName, ':prefix' => $codePrefix]);
        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            if ($existing['Is_Active'] == 0) {
                $updStmt = $conn->prepare("UPDATE Enum_Room_Type SET Type_Name = :name, Code_Prefix = :prefix, Daily_Rate = :rate, Is_Active = 1 WHERE Room_Type_ID = :id");
                $updStmt->execute([
                    ':name' => $typeName,
                    ':prefix' => $codePrefix,
                    ':rate' => $dailyRate,
                    ':id' => $existing['Room_Type_ID']
                ]);

                return json_encode([
                    "success" => true,
                    "room_type_id" => intval($existing['Room_Type_ID']),
                    "type_name" => $typeName,
                    "code_prefix" => $codePrefix,
                    "daily_rate" => $dailyRate,
                    "already_existed" => true,
                    "reactivated" => true,
                    "message" => "Room classification '" . $typeName . "' was previously archived and has now been reactivated."
                ]);
            }

            return json_encode([
                "success" => false,
                "room_type_id" => intval($existing['Room_Type_ID']),
                "type_name" => $existing['Type_Name'],
                "already_existed" => true,
                "reactivated" => false,
                "message" => "A room classification with this name or bed prefix already exists."
            ]);
        }

        $sql = "INSERT INTO Enum_Room_Type (Type_Name, Code_Prefix, Daily_Rate, Is_Active) VALUES (:name, :prefix, :rate, 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":name", $typeName);
        $stmt->bindParam(":prefix", $codePrefix);
        $stmt->bindParam(":rate", $dailyRate);
        $stmt->execute();

        $newId = $conn->lastInsertId();

        return json_encode([
            "success" => true,
            "room_type_id" => intval($newId),
            "type_name" => $typeName,
            "code_prefix" => $codePrefix,
            "daily_rate" => $dailyRate,
            "already_existed" => false,
            "reactivated" => false,
            "message" => "Room classification '" . $typeName . "' added successfully."
        ]);
    }

    function removeRoomType($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $roomTypeId = intval($json['room_type_id'] ?? 0);

        if ($roomTypeId <= 0) {
            return json_encode([
                "success" => false,
                "message" => "Invalid room classification ID."
            ]);
        }

        $checkStmt = $conn->prepare("SELECT COUNT(*) AS total FROM Room WHERE Room_Type_ID = :id");
        $checkStmt->execute([':id' => $roomTypeId]);
        $row = $checkStmt->fetch(PDO::FETCH_ASSOC);
        $count = $row ? intval($row['total']) : 0;

        if ($count > 0) {
            $stmt = $conn->prepare("UPDATE Enum_Room_Type SET Is_Active = 0 WHERE Room_Type_ID = :id");
            $stmt->execute([':id' => $roomTypeId]);

            return json_encode([
                "success" => true,
                "mode" => "deactivated",
                "room_type_id" => $roomTypeId,
                "message" => "Room classification deactivated from new selections. Existing rooms assigned to this classification remain preserved."
            ]);
        } else {
            $stmt = $conn->prepare("DELETE FROM Enum_Room_Type WHERE Room_Type_ID = :id");
            $stmt->execute([':id' => $roomTypeId]);

            return json_encode([
                "success" => true,
                "mode" => "deleted",
                "room_type_id" => $roomTypeId,
                "message" => "Room classification removed successfully from the system."
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

$room = new RoomMaster();
switch ($operation) {
    case "insertRoom":
        echo $room->insertRoom($json);
        break;
    case "updateRoom":
        echo $room->updateRoom($json);
        break;
    case "toggleStatus":
        echo $room->toggleStatus($json);
        break;
    case "hardDeleteRoom":
        echo $room->hardDeleteRoom($json);
        break;
    case "insertRoomType":
        echo $room->insertRoomType($json);
        break;
    case "removeRoomType":
        echo $room->removeRoomType($json);
        break;
}
?>
