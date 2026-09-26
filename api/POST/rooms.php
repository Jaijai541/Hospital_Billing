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
}
?>
