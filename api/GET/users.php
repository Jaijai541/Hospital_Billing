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
                       u.Station_ID,
                       COALESCE(s.Station_Name, 'General Administration') AS Station_Name,
                       s.Code_Prefix AS Station_Code_Prefix,
                       u.Is_Active
                FROM System_User u
                INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID
                LEFT JOIN Enum_Department_Station s ON u.Station_ID = s.Station_ID
                $whereClause
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

        return json_encode($user ?: null);
    }

    function getUserRoles()
    {
        include "connection.php";

        $sql = "SELECT Role_ID, Role_Name FROM Enum_User_Role ORDER BY Role_ID ASC";
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
