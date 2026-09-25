<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");

class AuditLogGET {
    function getAllAuditLogs() {
        include "connection.php";

        $sql = "SELECT 
                    al.Audit_ID,
                    al.User_ID,
                    al.Admission_ID,
                    al.Action_Type,
                    al.Module_Name,
                    al.Record_Reference,
                    al.Description,
                    COALESCE(CONCAT(u.First_Name, ' ', u.Last_Name), al.Performed_By) AS Performed_By,
                    DATE_FORMAT(al.Created_At, '%Y-%m-%d %h:%i %p') AS Formatted_Date,
                    al.Created_At
                FROM Audit_Log al
                LEFT JOIN System_User u ON al.User_ID = u.User_ID
                LEFT JOIN Admission a ON al.Admission_ID = a.Admission_ID
                ORDER BY al.Created_At DESC, al.Audit_ID DESC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }
}

$operation = $_GET['operation'] ?? $_POST['operation'] ?? '';
$audit = new AuditLogGET();

switch ($operation) {
    case "getAllAuditLogs":
        echo $audit->getAllAuditLogs();
        break;
    default:
        echo json_encode(["status" => "error", "message" => "Invalid GET operation for Audit Log."]);
        break;
}
?>
