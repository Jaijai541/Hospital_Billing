<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Category {
    
    function getCategories() {
        include "connection.php";
		
        $sql = "SELECT * FROM tbl_categories ORDER BY category_name ASC";        
        $stmt = $con->prepare($sql);
        $stmt->execute();      
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return json_encode($rs);
    }
}

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    $operation = $_GET['operation'];
} else if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $operation = $_POST['operation'];
}

$category = new Category();

switch($operation) {
    case "get_categories":
        echo $category->getCategories();
        break;
}
?>