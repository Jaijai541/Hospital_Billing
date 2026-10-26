<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class UserManager
{
    function getUsers($json = '{}')
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $roleId = intval($json['role_id'] ?? 0);
        $status = $json['status'] ?? 'all';

        $conditions = [];
        $params = [];

        if ($roleId > 0) {
            $conditions[] = "u.Role_ID = :role_id";
            $params[':role_id'] = $roleId;
        }

        if ($status === 'active') {
            $conditions[] = "u.Is_Active = 1";
        } else if ($status === 'archived' || $status === 'inactive') {
            $conditions[] = "u.Is_Active = 0";
        }

        $whereClause = !empty($conditions) ? "WHERE " . implode(" AND ", $conditions) : "";

        $sql = "SELECT u.User_ID,
                       CONCAT('USR-', LPAD(u.User_ID, 3, '0')) AS User_Code,
                       u.First_Name,
                       u.Last_Name,
                       CONCAT(u.Last_Name, ', ', u.First_Name) AS Full_Name,
                       u.Username,
                       u.Role_ID,
                       r.Role_Name,
                       r.Access_Domain,
                       r.Permissions,
                       r.Is_Higher_Up,
                       u.Station_ID,
                       COALESCE(s.Station_Name, 'General Administration') AS Station_Name,
                       s.Code_Prefix AS Station_Code_Prefix,
                       u.Is_Active,
                       COALESCE(GROUP_CONCAT(DISTINCT st_all.Station_Name ORDER BY uds.Is_Primary DESC, st_all.Station_Name SEPARATOR ', '), s.Station_Name, 'General Administration') AS Assigned_Stations_Text,
                       COALESCE(GROUP_CONCAT(DISTINCT st_all.Station_ID ORDER BY uds.Is_Primary DESC), CAST(u.Station_ID AS CHAR), '') AS Assigned_Station_IDs
                FROM System_User u
                INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID
                LEFT JOIN Enum_Department_Station s ON u.Station_ID = s.Station_ID
                LEFT JOIN User_Department_Station uds ON u.User_ID = uds.User_ID
                LEFT JOIN Enum_Department_Station st_all ON uds.Station_ID = st_all.Station_ID
                $whereClause
                GROUP BY u.User_ID
                ORDER BY u.User_ID ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($users);
    }

    function getUserById($json)
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $id = intval($json['user_id'] ?? $json['id'] ?? 0);

        if ($id <= 0) {
            return json_encode(null);
        }

        $sql = "SELECT u.User_ID,
                       CONCAT('USR-', LPAD(u.User_ID, 3, '0')) AS User_Code,
                       u.First_Name,
                       u.Last_Name,
                       CONCAT(u.Last_Name, ', ', u.First_Name) AS Full_Name,
                       u.Username,
                       u.Role_ID,
                       r.Role_Name,
                       r.Access_Domain,
                       r.Permissions,
                       r.Is_Higher_Up,
                       u.Station_ID,
                       COALESCE(s.Station_Name, 'General Administration') AS Station_Name,
                       u.Is_Active
                FROM System_User u
                INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID
                LEFT JOIN Enum_Department_Station s ON u.Station_ID = s.Station_ID
                WHERE u.User_ID = :id";

        $stmt = $conn->prepare($sql);
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user) {
            $stStmt = $conn->prepare("
                SELECT s.Station_ID, s.Station_Name, s.Code_Prefix, uds.Is_Primary
                FROM User_Department_Station uds
                INNER JOIN Enum_Department_Station s ON uds.Station_ID = s.Station_ID
                WHERE uds.User_ID = :id
                ORDER BY uds.Is_Primary DESC, s.Station_Name ASC
            ");
            $stStmt->execute([':id' => $id]);
            $assignedStations = $stStmt->fetchAll(PDO::FETCH_ASSOC);

            $assignedStationIds = [];
            $assignedStationNames = [];
            foreach ($assignedStations as $st) {
                $assignedStationIds[] = intval($st['Station_ID']);
                $assignedStationNames[] = $st['Station_Name'];
            }
            if (empty($assignedStationIds) && !empty($user['Station_ID'])) {
                $assignedStationIds[] = intval($user['Station_ID']);
                $assignedStationNames[] = $user['Station_Name'];
            }
            $user['assigned_station_ids'] = $assignedStationIds;
            $user['assigned_stations'] = $assignedStations;
            $user['assigned_stations_text'] = implode(', ', $assignedStationNames);
        }

        return json_encode($user ?: null);
    }

    function getUserRoles()
    {
        include "connection.php";

        $sql = "SELECT r.Role_ID, r.Role_Name, r.Access_Domain, r.Permissions, r.Is_Higher_Up, r.Is_Active,
                       (SELECT COUNT(*) FROM System_User u WHERE u.Role_ID = r.Role_ID) AS User_Count
                FROM Enum_User_Role r 
                WHERE r.Is_Active = 1 
                ORDER BY r.Role_ID ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $roles = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($roles);
    }

    function getDepartmentStations()
    {
        include "connection.php";

        $sql = "SELECT Station_ID, Station_Name, Code_Prefix 
                FROM Enum_Department_Station 
                WHERE Is_Active = 1 
                ORDER BY Station_Name ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $stations = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($stations);
    }
}

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "{}";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "{}";
}

$userManager = new UserManager();
switch ($operation) {
    case "getUsers":
        echo $userManager->getUsers($json);
        break;
    case "getUserById":
        echo $userManager->getUserById($json);
        break;
    case "getUserRoles":
        echo $userManager->getUserRoles();
        break;
    case "getDepartmentStations":
        echo $userManager->getDepartmentStations();
        break;
    default:
        echo json_encode([]);
        break;
}
?>
