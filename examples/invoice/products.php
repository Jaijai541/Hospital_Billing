<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Product
{
  function getAllProducts()
  {
    include "connection-pdo.php";

    $sql = "SELECT * FROM tblproducts ORDER BY product_name";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    return json_encode($rs);
  }
}

//submitted by the client - operation and json
if ($_SERVER['REQUEST_METHOD'] == 'GET') {
  $operation = $_GET['operation'];
  $json = isset($_GET['json']) ? $_GET['json'] : "";
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
  $operation = $_POST['operation'];
  $json = isset($_POST['json']) ? $_POST['json'] : "";
}

$product = new Product();
switch ($operation) {
  case "getAllProducts":
    echo $product->getAllProducts($json);
    break;
}
