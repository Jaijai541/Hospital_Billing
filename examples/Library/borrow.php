<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Borrow
{
  function saveBorrow($json)
  {
    include "connection.php";

    $json = json_decode($json, true);
    $header = $json['header'];
    $details = $json['details'];

    try {
      $conn->beginTransaction();

      $sql = "INSERT INTO tbl_borrow_header(hdr_student_id, hdr_date, hdr_user_id, hdr_total_books)
          VALUES(:studentId, :borrowDate, :userId, :totalBooks)";
      $stmt = $conn->prepare($sql);
      $stmt->bindParam(":studentId", $header['studentId']);
      $stmt->bindParam(":borrowDate", $header['borrowDate']);
      $stmt->bindParam(":userId", $header['userId']);
      $stmt->bindParam(":totalBooks", $header['totalBooks']);
      $stmt->execute();
      
      $newId = $conn->lastInsertId();

      $sqlDtl = "INSERT INTO tbl_borrow_details(dtl_header_id, dtl_book_id) 
                 VALUES(:headerId, :bookId)";
      $stmtDtl = $conn->prepare($sqlDtl);
      
      foreach ($details as $row) {
        $stmtDtl->bindParam(":headerId", $newId);
        $stmtDtl->bindParam(":bookId", $row['bookId']);
        $stmtDtl->execute();
      }
      
      $conn->commit();
      $returnValue = 1;
    } catch (Exception $e) {
      $conn->rollBack();
      $returnValue = 0;
    }
    return json_encode($returnValue);
  }
}

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
  $operation = $_GET['operation'];
  $json = isset($_GET['json']) ? $_GET['json'] : "";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
  $operation = $_POST['operation'];
  $json = isset($_POST['json']) ? $_POST['json'] : "";
}

$borrow = new Borrow();
switch ($operation) {
  case "saveBorrow":
    echo $borrow->saveBorrow($json);
    break;
}
?>