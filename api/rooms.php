<?php
/**
 * Hospital Rooms, Wards & Beds Master File API (Revised)
 * Milestone 1 Master File Module
 * Handles Wards, Bed Capacities, Daily Rates, Individual Bed Tracking, CRUD, and Soft/Hard Delete
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class RoomMaster
{
    /**
     * Read: Retrieve all rooms/wards with aggregated bed counts
     */
    function getAllRooms()
    {
        include "../connection.php";

        $sql = "SELECT r.*, rt.Type_Name, rt.Code_Prefix,
                       COUNT(b.Bed_ID) AS Total_Beds,
                       COALESCE(SUM(CASE WHEN b.Is_Available = 1 THEN 1 ELSE 0 END), 0) AS Vacant_Beds,
                       COALESCE(SUM(CASE WHEN b.Is_Available = 0 THEN 1 ELSE 0 END), 0) AS Occupied_Beds
                FROM Room r 
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID 
                LEFT JOIN Bed b ON r.Room_ID = b.Room_ID AND b.Is_Active = 1 
                GROUP BY r.Room_ID 
                ORDER BY r.Is_Active DESC, r.Room_Number ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    /**
     * Read: Retrieve individual beds list
     */
    function getAllBeds()
    {
        include "../connection.php";

        $sql = "SELECT b.*, r.Room_Number, rt.Type_Name, r.Daily_Rate 
                FROM Bed b 
                INNER JOIN Room r ON b.Room_ID = r.Room_ID 
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID 
                ORDER BY b.Is_Active DESC, r.Room_Number ASC, b.Bed_Number ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    /**
     * Read: Retrieve active room types
     */
    function getAllRoomTypes()
    {
        include "../connection.php";

        $sql = "SELECT * FROM Enum_Room_Type WHERE Is_Active = 1 ORDER BY Room_Type_ID ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    /**
     * Read: Retrieve a single room by ID
     */
    function getRoomById($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $sql = "SELECT * FROM Room WHERE Room_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['room_id']);
        $stmt->execute();
        $rs = $stmt->fetch(PDO::FETCH_ASSOC);

        return json_encode($rs ?: []);
    }

    /**
     * Create: Insert a new room/ward and automatically generate its beds
     */
    function insertRoom($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $capacity = max(1, intval($json['capacity_beds'] ?? 1));
        $roomNumber = trim($json['room_number']);

        $sql = "INSERT INTO Room (Room_Number, Room_Type_ID, Daily_Rate, Capacity_Beds, Is_Active) 
                VALUES (:number, :type_id, :rate, :capacity, 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":number", $roomNumber);
        $stmt->bindParam(":type_id", $json['room_type_id']);
        $stmt->bindParam(":rate", $json['daily_rate']);
        $stmt->bindParam(":capacity", $capacity);
        $stmt->execute();

        $roomId = $conn->lastInsertId();

        // Auto-provision beds for this ward/room
        $stmtBed = $conn->prepare("INSERT INTO Bed (Room_ID, Bed_Number, Bed_Code, Is_Available, Is_Active) VALUES (:room_id, :bed_num, :bed_code, 1, 1)");
        for ($i = 1; $i <= $capacity; $i++) {
            $bedNumber = sprintf("Bed-%02d", $i);
            $bedCode = sprintf("%s-B%02d", $roomNumber, $i);
            $stmtBed->execute([
                ':room_id'  => $roomId,
                ':bed_num'  => $bedNumber,
                ':bed_code' => $bedCode
            ]);
        }

        return json_encode(1);
    }

    /**
     * Update: Modify room details
     */
    function updateRoom($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);

        $sql = "UPDATE Room 
                SET Room_Number  = :number, 
                    Room_Type_ID = :type_id, 
                    Daily_Rate   = :rate 
                WHERE Room_ID    = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":number", $json['room_number']);
        $stmt->bindParam(":type_id", $json['room_type_id']);
        $stmt->bindParam(":rate", $json['daily_rate']);
        $stmt->bindParam(":id", $json['room_id']);
        $stmt->execute();

        return json_encode($stmt->rowCount() >= 0 ? 1 : 0);
    }

    /**
     * Soft Delete / Restore: Toggles Is_Active
     */
    function toggleStatus($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);

        $sql = "UPDATE Room 
                SET Is_Active = CASE WHEN Is_Active = 1 THEN 0 ELSE 1 END 
                WHERE Room_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":id", $json['room_id']);
        $stmt->execute();

        // Also sync active status to beds
        $conn->prepare("UPDATE Bed SET Is_Active = (SELECT Is_Active FROM Room WHERE Room_ID = :id) WHERE Room_ID = :id2")
             ->execute([':id' => $json['room_id'], ':id2' => $json['room_id']]);

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Hard Delete: Permanently remove room and its beds if not referenced in room transfers
     */
    function hardDeleteRoom($json)
    {
        include "../connection.php";

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
                "message" => "Cannot hard delete: This room/bed has past patient stay or transfer records. Please use Soft Delete (Deactivate) instead."
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
