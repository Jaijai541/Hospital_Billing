<?php
/**
 * Hospital Rooms & Beds API (Instructor Approved Schema)
 * Milestone 1 Master File Module
 * Handles Room, Room_Bed, and Enum_Room_Type (with Daily_Rate)
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class RoomMaster
{
    /**
     * Read: Retrieve all rooms with uniform Daily_Rate from Enum_Room_Type and bed counts
     */
    function getAllRooms()
    {
        include "connection.php";

        $sql = "SELECT r.Room_ID, r.Room_Name, r.Room_Type_ID, r.Capacity, r.Custom_Daily_Rate, r.Is_Active,
                       rt.Type_Name, rt.Code_Prefix, 
                       COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate,
                       COUNT(b.Bed_ID) AS Total_Beds,
                       COALESCE(SUM(CASE WHEN b.Is_Available = 1 THEN 1 ELSE 0 END), 0) AS Vacant_Beds,
                       COALESCE(SUM(CASE WHEN b.Is_Available = 0 THEN 1 ELSE 0 END), 0) AS Occupied_Beds
                FROM Room r 
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID 
                LEFT JOIN Room_Bed b ON r.Room_ID = b.Room_ID AND b.Is_Active = 1 
                GROUP BY r.Room_ID 
                ORDER BY r.Is_Active DESC, r.Room_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    /**
     * Read: Retrieve individual beds from Room_Bed
     */
    function getAllBeds()
    {
        include "connection.php";

        $sql = "SELECT b.Bed_ID, b.Room_ID, b.Bed_Code, b.Is_Available, b.Is_Active,
                       r.Room_Name, rt.Type_Name, 
                       COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate 
                FROM Room_Bed b 
                INNER JOIN Room r ON b.Room_ID = r.Room_ID 
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID 
                ORDER BY b.Is_Active DESC, r.Room_Name ASC, b.Bed_Code ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    /**
     * Read: Retrieve room types with default Daily_Rate
     */
    function getAllRoomTypes()
    {
        include "connection.php";

        $sql = "SELECT * FROM Enum_Room_Type WHERE Is_Active = 1 ORDER BY Room_Type_ID ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    /**
     * Read: Retrieve single room by ID
     */
    function getRoomById($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $sql = "SELECT r.*, 
                       COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate, 
                       rt.Daily_Rate AS Default_Daily_Rate, 
                       rt.Type_Name 
                FROM Room r 
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID 
                WHERE r.Room_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['room_id']);
        $stmt->execute();
        $rs = $stmt->fetch(PDO::FETCH_ASSOC);

        return json_encode($rs ?: []);
    }

    /**
     * Create: Insert a new Room and provision individual Room_Bed records
     */
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

        // Auto-provision Room_Bed records
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

    /**
     * Update: Modify Room details
     */
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

    /**
     * Soft Delete / Restore: Toggles Is_Active
     */
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

        // Sync to Room_Bed
        $conn->prepare("UPDATE Room_Bed SET Is_Active = (SELECT Is_Active FROM Room WHERE Room_ID = :id) WHERE Room_ID = :id2")
             ->execute([':id' => $json['room_id'], ':id2' => $json['room_id']]);

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Hard Delete: Permanently removes room and beds if not in transfer log
     */
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

// Router for operation and json payload
if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "";
}

$room = new RoomMaster();
switch ($operation) {
    case "getAllRooms":
        echo $room->getAllRooms();
        break;
    case "getAllBeds":
        echo $room->getAllBeds();
        break;
    case "getAllRoomTypes":
        echo $room->getAllRoomTypes();
        break;
    case "getRoomById":
        echo $room->getRoomById($json);
        break;
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
