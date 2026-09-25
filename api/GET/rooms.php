<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class RoomMaster
{
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

    function getAllRoomTypes()
    {
        include "connection.php";

        $sql = "SELECT * FROM Enum_Room_Type WHERE Is_Active = 1 ORDER BY Room_Type_ID ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

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
}
?>
