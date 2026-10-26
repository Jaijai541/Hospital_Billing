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

        $stationIds = [];
        if (!empty($json['station_ids'])) {
            if (is_array($json['station_ids'])) {
                $stationIds = array_map('intval', $json['station_ids']);
            } else {
                $stationIds = array_map('intval', explode(',', $json['station_ids']));
            }
        } else if (!empty($stationId)) {
            $stationIds = [$stationId];
        }
        $stationIds = array_values(array_unique(array_filter($stationIds, fn($id) => $id > 0)));
        $primaryStationId = !empty($stationIds) ? $stationIds[0] : $stationId;

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
            ':station_id' => $primaryStationId
        ]);

        if ($res) {
            $newId = $conn->lastInsertId();
            if (!empty($stationIds)) {
                $udsStmt = $conn->prepare("INSERT INTO User_Department_Station (User_ID, Station_ID, Is_Primary, Created_At) VALUES (:uid, :sid, :is_prim, NOW())");
                foreach ($stationIds as $idx => $sid) {
                    $udsStmt->execute([
                        ':uid' => $newId,
                        ':sid' => $sid,
                        ':is_prim' => ($idx === 0 ? 1 : 0)
                    ]);
                }
            }
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

        $stationIds = [];
        if (!empty($json['station_ids'])) {
            if (is_array($json['station_ids'])) {
                $stationIds = array_map('intval', $json['station_ids']);
            } else {
                $stationIds = array_map('intval', explode(',', $json['station_ids']));
            }
        } else if (!empty($stationId)) {
            $stationIds = [$stationId];
        }
        $stationIds = array_values(array_unique(array_filter($stationIds, fn($id) => $id > 0)));
        $primaryStationId = !empty($stationIds) ? $stationIds[0] : $stationId;

        if ($userId <= 0 || empty($firstName) || empty($lastName) || empty($username) || $roleId <= 0) {
            return json_encode([
                "status" => 0,
                "message" => "First Name, Last Name, Username, and Role are required."
            ]);
        }

        $curUserStmt = $conn->prepare("SELECT Role_ID, Is_Active FROM System_User WHERE User_ID = :id");
        $curUserStmt->execute([':id' => $userId]);
        $curUserData = $curUserStmt->fetch(PDO::FETCH_ASSOC);

        if ($curUserData) {
            $curRoleId = intval($curUserData['Role_ID']);
            if ($userId === 1 && $roleId !== 1) {
                return json_encode([
                    "status" => 0,
                    "message" => "Action blocked: The primary System Administrator account (User ID 1) cannot be demoted from the Admin role."
                ]);
            }
            if ($curRoleId === 1 && $roleId !== 1) {
                $countStmt = $conn->prepare("SELECT COUNT(*) FROM System_User WHERE Role_ID = 1 AND Is_Active = 1 AND User_ID != :id");
                $countStmt->execute([':id' => $userId]);
                if (intval($countStmt->fetchColumn()) === 0) {
                    return json_encode([
                        "status" => 0,
                        "message" => "Action blocked: Cannot change role. The system must maintain at least one active Administrator to prevent system lockout."
                    ]);
                }
            }
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
            ':station_id' => $primaryStationId,
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
            $delUds = $conn->prepare("DELETE FROM User_Department_Station WHERE User_ID = :id");
            $delUds->execute([':id' => $userId]);

            if (!empty($stationIds)) {
                $udsStmt = $conn->prepare("INSERT INTO User_Department_Station (User_ID, Station_ID, Is_Primary, Created_At) VALUES (:uid, :sid, :is_prim, NOW())");
                foreach ($stationIds as $idx => $sid) {
                    $udsStmt->execute([
                        ':uid' => $userId,
                        ':sid' => $sid,
                        ':is_prim' => ($idx === 0 ? 1 : 0)
                    ]);
                }
            }

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

        $adminCheck = $conn->prepare("SELECT Role_ID FROM System_User WHERE User_ID = :id");
        $adminCheck->execute([':id' => $userId]);
        $curRole = intval($adminCheck->fetchColumn());
        if ($curRole === 1) {
            $countStmt = $conn->prepare("SELECT COUNT(*) FROM System_User WHERE Role_ID = 1 AND Is_Active = 1 AND User_ID != :id");
            $countStmt->execute([':id' => $userId]);
            if (intval($countStmt->fetchColumn()) === 0) {
                return json_encode([
                    "status" => 0,
                    "message" => "Action blocked: Cannot archive the last remaining active Administrator."
                ]);
            }
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

    function addRole($json)
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $roleName = trim($json['role_name'] ?? '');
        $isHigherUp = !empty($json['is_higher_up']) ? 1 : 0;
        $accessDomain = trim($json['access_domain'] ?? '');

        if (empty($roleName)) {
            return json_encode([
                "status" => 0,
                "message" => "Role Name cannot be empty."
            ]);
        }

        $allAddPerms = ['can_add_patient', 'can_add_doctor', 'can_add_department', 'can_add_room', 'can_add_catalog', 'can_add_discount', 'can_add_admission', 'can_add_payment', 'can_add_promissory', 'can_add_staff'];
        $defaultActions = $isHigherUp ? array_merge(['can_add', 'can_delete', 'can_print'], $allAddPerms) : array_merge(['can_add', 'can_print'], $allAddPerms);
        $allP = array_merge(["patients.html", "doctors.html", "departments.html", "rooms.html", "catalogs.html", "discounts.html", "admissions.html", "invoices.html", "promissory_notes.html", "reports.html", "staff.html", "audit_log.html", "archive.html"], ['can_add', 'can_delete', 'can_print'], $allAddPerms);
        $rawPerms = $json['permissions'] ?? null;
        if (is_string($rawPerms)) {
            $decoded = json_decode($rawPerms, true);
            $permsList = is_array($decoded) ? $decoded : [];
        } elseif (is_array($rawPerms)) {
            $permsList = $rawPerms;
        } else {
            $permsList = null;
        }

        if ($permsList !== null) {
            $permsList = array_values(array_unique(array_filter($permsList, 'is_string')));
            if (empty($accessDomain)) {
                $hasAdmin = !empty(array_intersect($permsList, ['staff.html', 'audit_log.html', 'archive.html', 'departments.html']));
                $hasClinical = in_array('admissions.html', $permsList);
                $hasFinance = !empty(array_intersect($permsList, ['invoices.html', 'promissory_notes.html', 'discounts.html', 'reports.html']));
                if ($hasAdmin) {
                    $accessDomain = 'Admin';
                } elseif ($hasClinical && $hasFinance) {
                    $accessDomain = 'Hybrid';
                } elseif ($hasFinance) {
                    $accessDomain = 'Finance';
                } else {
                    $accessDomain = 'Clinical';
                }
            }
            $permsJson = json_encode($permsList);
        } else {
            if (!in_array($accessDomain, ['Admin', 'Finance', 'Clinical', 'Hybrid'])) {
                $accessDomain = 'Clinical';
            }
            $clinActions = $isHigherUp ? ['can_add_patient', 'can_add_admission', 'can_delete', 'can_print'] : ['can_add_patient', 'can_add_admission', 'can_print'];
            $finActions = $isHigherUp ? ['can_add_discount', 'can_add_payment', 'can_add_promissory', 'can_delete', 'can_print'] : ['can_add_discount', 'can_add_payment', 'can_add_promissory', 'can_print'];
            $hybActions = $isHigherUp ? ['can_add_patient', 'can_add_admission', 'can_add_payment', 'can_add_promissory', 'can_delete', 'can_print'] : ['can_add_patient', 'can_add_admission', 'can_add_payment', 'can_add_promissory', 'can_print'];
            $clinP = array_merge(["patients.html", "doctors.html", "rooms.html", "catalogs.html", "admissions.html"], $clinActions);
            $finP = array_merge(["patients.html", "doctors.html", "rooms.html", "catalogs.html", "discounts.html", "invoices.html", "promissory_notes.html", "reports.html"], $finActions);
            $hybP = array_merge(["patients.html", "doctors.html", "rooms.html", "catalogs.html", "discounts.html", "admissions.html", "invoices.html", "promissory_notes.html", "reports.html"], $hybActions);
            if ($accessDomain === 'Admin') $permsJson = json_encode($allP);
            elseif ($accessDomain === 'Hybrid') $permsJson = json_encode($hybP);
            elseif ($accessDomain === 'Finance') $permsJson = json_encode($finP);
            else $permsJson = json_encode($clinP);
        }

        if (!in_array($accessDomain, ['Admin', 'Finance', 'Clinical', 'Hybrid'])) {
            $accessDomain = 'Clinical';
        }

        $checkStmt = $conn->prepare("SELECT Role_ID, Role_Name, Is_Active FROM Enum_User_Role WHERE LOWER(Role_Name) = LOWER(:rname)");
        $checkStmt->execute([':rname' => $roleName]);
        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            if (intval($existing['Is_Active']) == 0) {
                $updStmt = $conn->prepare("UPDATE Enum_User_Role SET Is_Active = 1, Is_Higher_Up = :higher, Access_Domain = :domain, Permissions = :perm WHERE Role_ID = :id");
                $updStmt->execute([
                    ':higher' => $isHigherUp,
                    ':domain' => $accessDomain,
                    ':perm' => $permsJson,
                    ':id' => $existing['Role_ID']
                ]);
                return json_encode([
                    "status" => 1,
                    "message" => "System role '{$existing['Role_Name']}' was previously deactivated and is now reactivated.",
                    "role_id" => intval($existing['Role_ID']),
                    "role_name" => $existing['Role_Name'],
                    "access_domain" => $accessDomain,
                    "is_higher_up" => $isHigherUp,
                    "permissions" => json_decode($permsJson, true)
                ]);
            }
            return json_encode([
                "status" => 0,
                "message" => "Role '$roleName' already exists."
            ]);
        }

        $sql = "INSERT INTO Enum_User_Role (Role_Name, Access_Domain, Permissions, Is_Higher_Up, Is_Active) VALUES (:rname, :domain, :perm, :higher, 1)";
        $stmt = $conn->prepare($sql);
        $res = $stmt->execute([
            ':rname' => $roleName,
            ':domain' => $accessDomain,
            ':perm' => $permsJson,
            ':higher' => $isHigherUp
        ]);

        if ($res) {
            $newRoleId = $conn->lastInsertId();
            return json_encode([
                "status" => 1,
                "message" => "System role '$roleName' created successfully.",
                "role_id" => intval($newRoleId),
                "role_name" => $roleName,
                "access_domain" => $accessDomain,
                "is_higher_up" => $isHigherUp,
                "permissions" => json_decode($permsJson, true)
            ]);
        } else {
            return json_encode([
                "status" => 0,
                "message" => "Failed to create system role."
            ]);
        }
    }

    function updateRole($json)
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $roleId = intval($json['role_id'] ?? 0);
        $roleName = trim($json['role_name'] ?? '');
        $isHigherUp = !empty($json['is_higher_up']) ? 1 : 0;
        $accessDomain = trim($json['access_domain'] ?? '');

        if ($roleId <= 0) {
            return json_encode([
                "status" => 0,
                "message" => "Invalid role ID."
            ]);
        }

        if (empty($roleName)) {
            return json_encode([
                "status" => 0,
                "message" => "Role Name cannot be empty."
            ]);
        }

        $allAddPerms = ['can_add_patient', 'can_add_doctor', 'can_add_department', 'can_add_room', 'can_add_catalog', 'can_add_discount', 'can_add_admission', 'can_add_payment', 'can_add_promissory', 'can_add_staff'];
        $defaultActions = $isHigherUp ? array_merge(['can_add', 'can_delete', 'can_print'], $allAddPerms) : array_merge(['can_add', 'can_print'], $allAddPerms);
        $allP = array_merge(["patients.html", "doctors.html", "departments.html", "rooms.html", "catalogs.html", "discounts.html", "admissions.html", "invoices.html", "promissory_notes.html", "reports.html", "staff.html", "audit_log.html", "archive.html"], ['can_add', 'can_delete', 'can_print'], $allAddPerms);

        if ($roleId === 1) {
            $isHigherUp = 1;
            $accessDomain = 'Admin';
            $permsJson = json_encode($allP);
        } else {
            $rawPerms = $json['permissions'] ?? null;
            if (is_string($rawPerms)) {
                $decoded = json_decode($rawPerms, true);
                $permsList = is_array($decoded) ? $decoded : [];
            } elseif (is_array($rawPerms)) {
                $permsList = $rawPerms;
            } else {
                $permsList = null;
            }

            if ($permsList !== null) {
                $permsList = array_values(array_unique(array_filter($permsList, 'is_string')));
                if (empty($accessDomain)) {
                    $hasAdmin = !empty(array_intersect($permsList, ['staff.html', 'audit_log.html', 'archive.html', 'departments.html']));
                    $hasClinical = in_array('admissions.html', $permsList);
                    $hasFinance = !empty(array_intersect($permsList, ['invoices.html', 'promissory_notes.html', 'discounts.html', 'reports.html']));
                    if ($hasAdmin) {
                        $accessDomain = 'Admin';
                    } elseif ($hasClinical && $hasFinance) {
                        $accessDomain = 'Hybrid';
                    } elseif ($hasFinance) {
                        $accessDomain = 'Finance';
                    } else {
                        $accessDomain = 'Clinical';
                    }
                }
                $permsJson = json_encode($permsList);
            } else {
                if (!in_array($accessDomain, ['Admin', 'Finance', 'Clinical', 'Hybrid'])) {
                    $accessDomain = 'Clinical';
                }
                $clinActions = $isHigherUp ? ['can_add_patient', 'can_add_admission', 'can_delete', 'can_print'] : ['can_add_patient', 'can_add_admission', 'can_print'];
            $finActions = $isHigherUp ? ['can_add_discount', 'can_add_payment', 'can_add_promissory', 'can_delete', 'can_print'] : ['can_add_discount', 'can_add_payment', 'can_add_promissory', 'can_print'];
            $hybActions = $isHigherUp ? ['can_add_patient', 'can_add_admission', 'can_add_payment', 'can_add_promissory', 'can_delete', 'can_print'] : ['can_add_patient', 'can_add_admission', 'can_add_payment', 'can_add_promissory', 'can_print'];
            $clinP = array_merge(["patients.html", "doctors.html", "rooms.html", "catalogs.html", "admissions.html"], $clinActions);
                $finP = array_merge(["patients.html", "doctors.html", "rooms.html", "catalogs.html", "discounts.html", "invoices.html", "promissory_notes.html", "reports.html"], $finActions);
                $hybP = array_merge(["patients.html", "doctors.html", "rooms.html", "catalogs.html", "discounts.html", "admissions.html", "invoices.html", "promissory_notes.html", "reports.html"], $hybActions);
                if ($accessDomain === 'Admin') $permsJson = json_encode($allP);
                elseif ($accessDomain === 'Hybrid') $permsJson = json_encode($hybP);
                elseif ($accessDomain === 'Finance') $permsJson = json_encode($finP);
                else $permsJson = json_encode($clinP);
            }
        }

        if (!in_array($accessDomain, ['Admin', 'Finance', 'Clinical', 'Hybrid'])) {
            $accessDomain = 'Clinical';
        }

        $checkStmt = $conn->prepare("SELECT Role_ID FROM Enum_User_Role WHERE LOWER(Role_Name) = LOWER(:rname) AND Role_ID != :id");
        $checkStmt->execute([':rname' => $roleName, ':id' => $roleId]);
        if ($checkStmt->fetch(PDO::FETCH_ASSOC)) {
            return json_encode([
                "status" => 0,
                "message" => "Another system role with this name already exists."
            ]);
        }

        if ($roleId === 1) {
            $accessDomain = 'Admin';
            $isHigherUp = 1;
            if ($permsList !== null) {
                $requiredPages = array_merge(['staff.html', 'audit_log.html', 'archive.html', 'departments.html', 'can_add', 'can_delete', 'can_print'], $allAddPerms);
                foreach ($requiredPages as $p) {
                    if (!in_array($p, $permsList)) {
                        $permsList[] = $p;
                    }
                }
                $permsJson = json_encode(array_values(array_unique($permsList)));
            }
        }

        $stmt = $conn->prepare("UPDATE Enum_User_Role SET Role_Name = :rname, Access_Domain = :domain, Permissions = :perm, Is_Higher_Up = :higher WHERE Role_ID = :id");
        $res = $stmt->execute([
            ':rname' => $roleName,
            ':domain' => $accessDomain,
            ':perm' => $permsJson,
            ':higher' => $isHigherUp,
            ':id' => $roleId
        ]);

        return json_encode([
            "status" => $res ? 1 : 0,
            "message" => $res ? "System role updated successfully." : "Failed to update system role.",
            "role_id" => $roleId,
            "role_name" => $roleName,
            "access_domain" => $accessDomain,
            "is_higher_up" => $isHigherUp,
            "permissions" => json_decode($permsJson, true)
        ]);
    }

    function deleteRole($json)
    {
        include "connection.php";

        $json = is_array($json) ? $json : json_decode($json, true);
        $roleId = intval($json['role_id'] ?? 0);

        if ($roleId <= 0) {
            return json_encode([
                "status" => 0,
                "message" => "Invalid role ID."
            ]);
        }

        if ($roleId === 1) {
            return json_encode([
                "status" => 0,
                "message" => "The primary Administrator role is protected and cannot be deleted."
            ]);
        }

        $checkStmt = $conn->prepare("SELECT COUNT(*) AS total FROM System_User WHERE Role_ID = :id");
        $checkStmt->execute([':id' => $roleId]);
        $row = $checkStmt->fetch(PDO::FETCH_ASSOC);
        $userCount = $row ? intval($row['total']) : 0;

        if ($userCount > 0) {
            $stmt = $conn->prepare("UPDATE Enum_User_Role SET Is_Active = 0 WHERE Role_ID = :id");
            $res = $stmt->execute([':id' => $roleId]);

            return json_encode([
                "status" => $res ? 1 : 0,
                "mode" => "deactivated",
                "role_id" => $roleId,
                "message" => "System role deactivated. Existing staff accounts with this role remain preserved."
            ]);
        } else {
            $stmt = $conn->prepare("DELETE FROM Enum_User_Role WHERE Role_ID = :id");
            $res = $stmt->execute([':id' => $roleId]);

            return json_encode([
                "status" => $res ? 1 : 0,
                "mode" => "deleted",
                "role_id" => $roleId,
                "message" => "System role deleted successfully."
            ]);
        }
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'POST') {
    $operation = $_POST['operation'] ?? "";
    $json = $_POST['json'] ?? "{}";
} else {
    $operation = $_GET['operation'] ?? "";
    $json = $_GET['json'] ?? "{}";
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
    case "addRole":
        echo $userManager->addRole($json);
        break;
    case "updateRole":
        echo $userManager->updateRole($json);
        break;
    case "deleteRole":
    case "removeRole":
        echo $userManager->deleteRole($json);
        break;
    default:
        echo json_encode(["status" => 0, "message" => "Invalid operation."]);
        break;
}
?>
