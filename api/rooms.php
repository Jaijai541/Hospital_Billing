<?php
/**
 * Hospital Rooms & Beds Master File API
 * Milestone 1 Master File Module
 * Handles Room Numbers, Room Classifications (Ward, Private, ICU), Daily Rates, CRUD, and Soft/Hard Delete
 */
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Room
{
    /**
     * Read: Retrieve all rooms with room type classifications
     */
    function getAllRooms()
    {
        include "../connection.php";

        $sql = "SELECT r.*, rt.Type_Name, rt.Code_Prefix 
                FROM Room r 
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID 
                ORDER BY r.Is_Active DESC, r.Room_Number ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    /**
     * Read: Retrieve active room types for the classification dropdown
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
     * Read: Retrieve a single room by ID for editing
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
     * Create: Insert a new hospital room
     */
    function insertRoom($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $roomNumber = trim($json['room_number'] ?? '');
        $dailyRate  = (float)($json['daily_rate'] ?? 0);

        // Check if room number already exists
        $checkSql = "SELECT COUNT(*) FROM Room WHERE Room_Number = :num";
        $checkStmt = $conn->prepare($checkSql);
        $checkStmt->bindParam(":num", $roomNumber);
        $checkStmt->execute();
        if ($checkStmt->fetchColumn() > 0) {
            return json_encode(["status" => 0, "message" => "Room Number '{$roomNumber}' already exists."]);
        }

        $sql = "INSERT INTO Room (Room_Number, Room_Type_ID, Daily_Rate, Is_Available, Is_Active) 
                VALUES (:room_number, :room_type_id, :daily_rate, 1, 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":room_number", $roomNumber);
        $stmt->bindParam(":room_type_id", $json['room_type_id']);
        $stmt->bindParam(":daily_rate", $dailyRate);
        $stmt->execute();

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Update: Modify an existing room
     */
    function updateRoom($json)
    {
        include "../connection.php";

        $json = json_decode($json, true);
        $roomNumber = trim($json['room_number'] ?? '');
        $dailyRate  = (float)($json['daily_rate'] ?? 0);

        // Ensure room number is unique to other rooms
        $checkSql = "SELECT COUNT(*) FROM Room WHERE Room_Number = :num AND Room_ID != :id";
        $checkStmt = $conn->prepare($checkSql);
        $checkStmt->bindParam(":num", $roomNumber);
        $checkStmt->bindParam(":id", $json['room_id']);
        $checkStmt->execute();
        if ($checkStmt->fetchColumn() > 0) {
            return json_encode(["status" => 0, "message" => "Room Number '{$roomNumber}' already exists on another room."]);
        }

        $sql = "UPDATE Room 
                SET Room_Number  = :room_number, 
                    Room_Type_ID = :room_type_id, 
                    Daily_Rate   = :daily_rate 
                WHERE Room_ID = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":room_number", $roomNumber);
        $stmt->bindParam(":room_type_id", $json['room_type_id']);
        $stmt->bindParam(":daily_rate", $dailyRate);
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

        return json_encode($stmt->rowCount() > 0 ? 1 : 0);
    }

    /**
     * Hard Delete: Permanently remove the room from MySQL
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
                "message" => "Cannot hard delete: This room has historical occupancy/billing records. Please use Soft Delete instead."
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

$room = new Room();
switch ($operation) {
    case "getAllRooms":
        echo $room->getAllRooms();
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

