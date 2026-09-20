<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Student
{
  function getAllStudents()
  {
    include "connection.php";
	
    $sql = "SELECT * FROM students ORDER BY full_name";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    return json_encode($rs);
  }
}

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
  $operation = $_GET['operation'];
  $json = isset($_GET['json']) ? $_GET['json'] : "";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
  $operation = $_POST['operation'];
  $json = isset($_POST['json']) ? $_POST['json'] : "";
}

$student = new Student();
switch ($operation) {
  case "getAllStudents":
    echo $student->getAllStudents();
    break;
}
?>