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
                       COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate,
                       p.First_Name, p.Last_Name,
                       CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                       CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                       a.Admission_ID
                FROM Room_Bed b 
                INNER JOIN Room r ON b.Room_ID = r.Room_ID 
                INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID 
                LEFT JOIN Room_Transfer_Log rtl ON b.Bed_ID = rtl.Bed_ID AND rtl.Date_Out IS NULL
                LEFT JOIN Admission a ON rtl.Admission_ID = a.Admission_ID AND a.Status = 'Admitted'
                LEFT JOIN Patient p ON a.Patient_ID = p.Patient_ID
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

        if ($rs) {
            $bedsSql = "SELECT b.Bed_ID, b.Bed_Code, b.Is_Available, b.Is_Active,
                               p.First_Name, p.Last_Name,
                               CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                               CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                               DATE_FORMAT(rtl.Date_In, '%Y-%m-%d %h:%i %p') AS Formatted_Date_In,
                               a.Chief_Complaint, a.Diagnosis
                        FROM Room_Bed b
                        LEFT JOIN Room_Transfer_Log rtl ON b.Bed_ID = rtl.Bed_ID AND rtl.Date_Out IS NULL
                        LEFT JOIN Admission a ON rtl.Admission_ID = a.Admission_ID AND a.Status = 'Admitted'
                        LEFT JOIN Patient p ON a.Patient_ID = p.Patient_ID
                        WHERE b.Room_ID = :id
                        ORDER BY b.Bed_Code ASC";
            $bedsStmt = $conn->prepare($bedsSql);
            $bedsStmt->bindParam(":id", $json['room_id']);
            $bedsStmt->execute();
            $rs['beds'] = $bedsStmt->fetchAll(PDO::FETCH_ASSOC);

            $histSql = "SELECT rtl.Transfer_ID, rtl.Admission_ID, rtl.Bed_ID, b.Bed_Code,
                               rtl.Date_In, rtl.Date_Out, rtl.Total_Days, rtl.Total_Room_Fee,
                               DATE_FORMAT(rtl.Date_In, '%Y-%m-%d %h:%i %p') AS Formatted_Date_In,
                               DATE_FORMAT(rtl.Date_Out, '%Y-%m-%d %h:%i %p') AS Formatted_Date_Out,
                               p.First_Name, p.Last_Name,
                               CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                               CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                               a.Chief_Complaint, a.Diagnosis
                        FROM Room_Transfer_Log rtl
                        INNER JOIN Room_Bed b ON rtl.Bed_ID = b.Bed_ID
                        INNER JOIN Admission a ON rtl.Admission_ID = a.Admission_ID
                        INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                        WHERE b.Room_ID = :id AND rtl.Date_Out IS NOT NULL
                        ORDER BY rtl.Date_Out DESC
                        LIMIT 20";
            $histStmt = $conn->prepare($histSql);
            $histStmt->bindParam(":id", $json['room_id']);
            $histStmt->execute();
            $rs['occupancy_history'] = $histStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        return json_encode($rs ?: []);
    }

    function getBedOccupancyHistory($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $bedId = $json['bed_id'] ?? 0;

        $bedSql = "SELECT b.Bed_ID, b.Bed_Code, b.Is_Available, b.Is_Active,
                          r.Room_ID, r.Room_Name, rt.Type_Name,
                          COALESCE(r.Custom_Daily_Rate, rt.Daily_Rate) AS Daily_Rate
                   FROM Room_Bed b
                   INNER JOIN Room r ON b.Room_ID = r.Room_ID
                   INNER JOIN Enum_Room_Type rt ON r.Room_Type_ID = rt.Room_Type_ID
                   WHERE b.Bed_ID = :bed_id";
        $stmt = $conn->prepare($bedSql);
        $stmt->bindParam(":bed_id", $bedId);
        $stmt->execute();
        $bed = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$bed) {
            return json_encode([]);
        }

        $currSql = "SELECT rtl.Transfer_ID, rtl.Admission_ID, rtl.Bed_ID, rtl.Date_In,
                           DATE_FORMAT(rtl.Date_In, '%Y-%m-%d %h:%i %p') AS Formatted_Date_In,
                           a.Patient_ID, a.Chief_Complaint, a.Diagnosis, a.Status AS Admission_Status,
                           DATE_FORMAT(a.Admission_Date, '%Y-%m-%d %h:%i %p') AS Formatted_Admission_Date,
                           p.First_Name, p.Last_Name,
                           CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                           CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code,
                           (SELECT GROUP_CONCAT(CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) SEPARATOR ', ')
                            FROM Admission_Doctor ad
                            INNER JOIN Doctor d ON ad.Doctor_ID = d.Doctor_ID
                            WHERE ad.Admission_ID = a.Admission_ID) AS Attending_Doctors
                    FROM Room_Transfer_Log rtl
                    INNER JOIN Admission a ON rtl.Admission_ID = a.Admission_ID AND a.Status = 'Admitted'
                    INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                    WHERE rtl.Bed_ID = :bed_id AND rtl.Date_Out IS NULL
                    LIMIT 1";
        $currStmt = $conn->prepare($currSql);
        $currStmt->bindParam(":bed_id", $bedId);
        $currStmt->execute();
        $bed['current_occupant'] = $currStmt->fetch(PDO::FETCH_ASSOC) ?: null;

        $histSql = "SELECT rtl.Transfer_ID, rtl.Admission_ID, rtl.Bed_ID, rtl.Date_In, rtl.Date_Out,
                           rtl.Total_Days, rtl.Total_Room_Fee,
                           DATE_FORMAT(rtl.Date_In, '%Y-%m-%d %h:%i %p') AS Formatted_Date_In,
                           DATE_FORMAT(rtl.Date_Out, '%Y-%m-%d %h:%i %p') AS Formatted_Date_Out,
                           a.Patient_ID, a.Chief_Complaint, a.Diagnosis, a.Status AS Admission_Status,
                           p.First_Name, p.Last_Name,
                           CONCAT('PAT-', LPAD(p.Patient_ID, 3, '0')) AS Patient_Code,
                           CONCAT('ADM-', LPAD(a.Admission_ID, 3, '0')) AS Admission_Code
                    FROM Room_Transfer_Log rtl
                    INNER JOIN Admission a ON rtl.Admission_ID = a.Admission_ID
                    INNER JOIN Patient p ON a.Patient_ID = p.Patient_ID
                    WHERE rtl.Bed_ID = :bed_id AND rtl.Date_Out IS NOT NULL
                    ORDER BY rtl.Date_Out DESC";
        $histStmt = $conn->prepare($histSql);
        $histStmt->bindParam(":bed_id", $bedId);
        $histStmt->execute();
        $bed['occupancy_history'] = $histStmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($bed);
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
    case "getBedOccupancyHistory":
        echo $room->getBedOccupancyHistory($json);
        break;
}
?>
