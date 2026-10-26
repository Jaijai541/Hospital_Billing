<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Auth
{
    function login($json)
    {
        include "connection.php";

        $json = json_decode($json, true);
        $username = trim($json['username'] ?? '');
        $password = $json['password'] ?? '';

        if (empty($username) || empty($password)) {
            return json_encode([
                "status" => 0,
                "message" => "Please enter both username and password."
            ]);
        }

        $sql = "SELECT u.User_ID, u.First_Name, u.Last_Name, u.Username, u.Password_Hash, u.Role_ID, u.Station_ID,
                       r.Role_Name, r.Access_Domain, r.Permissions, r.Is_Higher_Up,
                       d.Doctor_ID, d.Station_ID AS Doctor_Station_ID,
                       COALESCE(s_user.Station_Name, s_doc.Station_Name) AS Station_Name,
                       COALESCE(u.Station_ID, d.Station_ID) AS Effective_Station_ID
                FROM System_User u 
                INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID 
                LEFT JOIN Doctor d ON u.User_ID = d.User_ID AND d.Is_Active = 1
                LEFT JOIN Enum_Department_Station s_user ON u.Station_ID = s_user.Station_ID
                LEFT JOIN Enum_Department_Station s_doc ON d.Station_ID = s_doc.Station_ID
                WHERE u.Username = :username AND u.Is_Active = 1";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":username", $username);
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && password_verify($password, $user['Password_Hash'])) {
            $perms = [];
            if (!empty($user['Permissions'])) {
                $decoded = json_decode($user['Permissions'], true);
                if (is_array($decoded)) {
                    $perms = $decoded;
                }
            }
            $effStationId = !empty($user['Effective_Station_ID']) ? intval($user['Effective_Station_ID']) : null;
            return json_encode([
                "status" => 1,
                "user" => [
                    "user_id"           => $user['User_ID'],
                    "username"          => $user['Username'],
                    "full_name"         => $user['First_Name'] . " " . $user['Last_Name'],
                    "role_name"         => $user['Role_Name'],
                    "role_id"           => $user['Role_ID'],
                    "access_domain"     => $user['Access_Domain'] ?? 'Clinical',
                    "is_higher_up"      => intval($user['Is_Higher_Up'] ?? 0),
                    "permissions"       => $perms,
                    "station_id"        => $effStationId,
                    "station_name"      => $user['Station_Name'] ?? null,
                    "doctor_id"         => !empty($user['Doctor_ID']) ? intval($user['Doctor_ID']) : null,
                    "doctor_station_id" => !empty($user['Doctor_Station_ID']) ? intval($user['Doctor_Station_ID']) : $effStationId
                ]
            ]);
        } else {
            return json_encode([
                "status" => 0,
                "message" => "Invalid username or password."
            ]);
        }
    }

    function logout()
    {
        include "connection.php";
        return json_encode([
            "status" => 1,
            "message" => "Logged out successfully."
        ]);
    }
}

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "";
}

$auth = new Auth();
switch ($operation) {
    case "login":
        echo $auth->login($json);
        break;
    case "logout":
        echo $auth->logout();
        break;
}
?>
