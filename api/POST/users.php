<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class UserManager
{
    function addUser($json)
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $firstName = trim($json['first_name'] ?? '');
        $lastName = trim($json['last_name'] ?? '');
        $username = trim($json['username'] ?? '');
        $password = trim($json['password'] ?? '');
        $roleId = intval($json['role_id'] ?? 0);
        $stationId = !empty($json['station_id']) ? intval($json['station_id']) : null;

        if (empty($firstName) || empty($lastName) || empty($username) || empty($password) || $roleId <= 0) {
            return json_encode([
                "status" => 0,
                "message" => "First Name, Last Name, Username, Role, and Password are required."
            ]);
        }

        $checkStmt = $conn->prepare("SELECT COUNT(*) FROM System_User WHERE LOWER(Username) = LOWER(:uname)");
        $checkStmt->execute([':uname' => $username]);
        if (intval($checkStmt->fetchColumn()) > 0) {
            return json_encode([
                "status" => 0,
                "message" => "Username '$username' is already taken. Please choose a different username."
            ]);
        }

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);

        $sql = "INSERT INTO System_User 
                    (First_Name, Last_Name, Username, Password_Hash, Role_ID, Station_ID, Is_Active)
                VALUES 
                    (:fname, :lname, :uname, :hash, :role_id, :station_id, 1)";
        $stmt = $conn->prepare($sql);
        $res = $stmt->execute([
            ':fname' => $firstName,
            ':lname' => $lastName,
            ':uname' => $username,
            ':hash' => $passwordHash,
            ':role_id' => $roleId,
            ':station_id' => $stationId
        ]);

        if ($res) {
            $newId = $conn->lastInsertId();
            return json_encode([
                "status" => 1,
                "message" => "Staff account created successfully.",
                "user_id" => $newId,
                "user" => [
                    "user_id" => $newId,
                    "full_name" => "$firstName $lastName",
                    "username" => $username
                ]
            ]);
        } else {
            return json_encode([
                "status" => 0,
                "message" => "Database error creating staff account."
            ]);
        }
    }

    function updateUser($json)
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $userId = intval($json['user_id'] ?? 0);
        $firstName = trim($json['first_name'] ?? '');
        $lastName = trim($json['last_name'] ?? '');
        $username = trim($json['username'] ?? '');
        $password = trim($json['password'] ?? '');
        $roleId = intval($json['role_id'] ?? 0);
        $stationId = !empty($json['station_id']) ? intval($json['station_id']) : null;

        if ($userId <= 0 || empty($firstName) || empty($lastName) || empty($username) || $roleId <= 0) {
            return json_encode([
                "status" => 0,
                "message" => "First Name, Last Name, Username, and Role are required."
            ]);
        }

        $checkStmt = $conn->prepare("SELECT COUNT(*) FROM System_User WHERE LOWER(Username) = LOWER(:uname) AND User_ID != :id");
        $checkStmt->execute([':uname' => $username, ':id' => $userId]);
        if (intval($checkStmt->fetchColumn()) > 0) {
            return json_encode([
                "status" => 0,
                "message" => "Username '$username' is already taken by another account."
            ]);
        }

        $params = [
            ':fname' => $firstName,
            ':lname' => $lastName,
            ':uname' => $username,
            ':role_id' => $roleId,
            ':station_id' => $stationId,
            ':id' => $userId
        ];

        if (!empty($password)) {
            $passwordHash = password_hash($password, PASSWORD_DEFAULT);
            $sql = "UPDATE System_User 
                    SET First_Name = :fname,
                        Last_Name = :lname,
                        Username = :uname,
                        Password_Hash = :hash,
                        Role_ID = :role_id,
                        Station_ID = :station_id
                    WHERE User_ID = :id";
            $params[':hash'] = $passwordHash;
        } else {
            $sql = "UPDATE System_User 
                    SET First_Name = :fname,
                        Last_Name = :lname,
                        Username = :uname,
                        Role_ID = :role_id,
                        Station_ID = :station_id
                    WHERE User_ID = :id";
        }

        $stmt = $conn->prepare($sql);
        $res = $stmt->execute($params);

        if ($res) {
            return json_encode([
                "status" => 1,
                "message" => "Staff account updated successfully.",
                "user_id" => $userId
            ]);
        } else {
            return json_encode([
                "status" => 0,
                "message" => "Database error updating staff account."
            ]);
        }
    }

    function archiveUser($json)
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $userId = intval($json['user_id'] ?? $json['id'] ?? 0);

        if ($userId <= 0) {
            return json_encode([
                "status" => 0,
                "message" => "Invalid user ID."
            ]);
        }

        if ($userId === 1) {
            return json_encode([
                "status" => 0,
                "message" => "Cannot archive the primary System Admin account."
            ]);
        }

        $stmt = $conn->prepare("UPDATE System_User SET Is_Active = 0 WHERE User_ID = :id");
        $res = $stmt->execute([':id' => $userId]);

        return json_encode([
            "status" => $res ? 1 : 0,
            "message" => $res ? "Staff account archived successfully." : "Failed to archive staff account."
        ]);
    }

    function restoreUser($json)
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $userId = intval($json['user_id'] ?? $json['id'] ?? 0);

        if ($userId <= 0) {
            return json_encode([
                "status" => 0,
                "message" => "Invalid user ID."
            ]);
        }

        $stmt = $conn->prepare("UPDATE System_User SET Is_Active = 1 WHERE User_ID = :id");
        $res = $stmt->execute([':id' => $userId]);

        return json_encode([
            "status" => $res ? 1 : 0,
            "message" => $res ? "Staff account restored successfully." : "Failed to restore staff account."
        ]);
    }

    function resetPassword($json)
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $userId = intval($json['user_id'] ?? 0);
        $newPassword = trim($json['password'] ?? '');

        if ($userId <= 0 || empty($newPassword)) {
            return json_encode([
                "status" => 0,
                "message" => "User ID and new password are required."
            ]);
        }

        if (strlen($newPassword) < 4) {
            return json_encode([
                "status" => 0,
                "message" => "Password must be at least 4 characters long."
            ]);
        }

        $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("UPDATE System_User SET Password_Hash = :hash WHERE User_ID = :id");
        $res = $stmt->execute([':hash' => $passwordHash, ':id' => $userId]);

        return json_encode([
            "status" => $res ? 1 : 0,
            "message" => $res ? "Password reset successfully." : "Failed to reset password."
        ]);
    }

    function changePassword($json)
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $userId = intval($json['user_id'] ?? 0);
        $currentPassword = $json['current_password'] ?? '';
        $newPassword = trim($json['new_password'] ?? '');

        if ($userId <= 0 || empty($currentPassword) || empty($newPassword)) {
            return json_encode([
                "status" => 0,
                "message" => "All password fields are required."
            ]);
        }

        if (strlen($newPassword) < 4) {
            return json_encode([
                "status" => 0,
                "message" => "New password must be at least 4 characters long."
            ]);
        }

        $stmt = $conn->prepare("SELECT Password_Hash FROM System_User WHERE User_ID = :id AND Is_Active = 1");
        $stmt->execute([':id' => $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($currentPassword, $user['Password_Hash'])) {
            return json_encode([
                "status" => 0,
                "message" => "The current password you entered is incorrect."
            ]);
        }

        $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $updateStmt = $conn->prepare("UPDATE System_User SET Password_Hash = :hash WHERE User_ID = :id");
        $res = $updateStmt->execute([':hash' => $passwordHash, ':id' => $userId]);

        return json_encode([
            "status" => $res ? 1 : 0,
            "message" => $res ? "Your password has been changed successfully." : "Failed to change password."
        ]);
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
    case "addUser":
        echo $userManager->addUser($json);
        break;
    case "updateUser":
        echo $userManager->updateUser($json);
        break;
    case "archiveUser":
        echo $userManager->archiveUser($json);
        break;
    case "restoreUser":
        echo $userManager->restoreUser($json);
        break;
    case "resetPassword":
        echo $userManager->resetPassword($json);
        break;
    case "changePassword":
        echo $userManager->changePassword($json);
        break;
    default:
        echo json_encode(["status" => 0, "message" => "Invalid operation."]);
        break;
}
?>
