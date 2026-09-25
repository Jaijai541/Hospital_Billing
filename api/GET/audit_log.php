<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");

class AuditLogGET {
    function getAllAuditLogs() {
        include "connection.php";

        $sql = "SELECT 
                    Audit_ID,
                    Action_Type,
                    Module_Name,
                    Record_Reference,
                    Description,
                    Performed_By,
                    DATE_FORMAT(Created_At, '%Y-%m-%d %h:%i %p') AS Formatted_Date,
                    Created_At
                FROM Audit_Log
                ORDER BY Created_At DESC, Audit_ID DESC";

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
