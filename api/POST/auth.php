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

        $sql = "SELECT u.User_ID, u.First_Name, u.Last_Name, u.Username, u.Password_Hash, u.Role_ID, r.Role_Name 
                FROM System_User u 
                INNER JOIN Enum_User_Role r ON u.Role_ID = r.Role_ID 
                WHERE u.Username = :username AND u.Is_Active = 1";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(":username", $username);
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && password_verify($password, $user['Password_Hash'])) {
            return json_encode([
                "status" => 1,
                "user" => [
                    "user_id"   => $user['User_ID'],
                    "username"  => $user['Username'],
                    "full_name" => $user['First_Name'] . " " . $user['Last_Name'],
                    "role_name" => $user['Role_Name'],
                    "role_id"   => $user['Role_ID']
                ]
            ]);
        } else {
            return json_encode([
                "status" => 0,
                "message" => "Invalid username or password."
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

$auth = new Auth();
switch ($operation) {
    case "login":
        echo $auth->login($json);
        break;
}
?>
