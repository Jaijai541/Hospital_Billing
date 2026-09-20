<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Book
{
  function getAllBooks()
  {
    include "connection.php";

    // fetch books that available
    $sql = "SELECT * FROM books WHERE quantity > 0 ORDER BY title";
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

$book = new Book();
switch ($operation) {
  case "getAllBooks":
    echo $book->getAllBooks();
    break;
}
?>