<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

class Book {
    
    function getBooks() {
        include "connection.php";

        $sql = "SELECT a.*, b.category_name 
                FROM tbl_books a INNER JOIN tbl_categories b 
                ON a.category_id = b.category_id 
                ORDER BY a.book_id DESC";               
        $stmt = $con->prepare($sql);
        $stmt->execute();
        $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return json_encode($rs);
    }

    function insertBook($json) {
        include "connection.php";

        $json = json_decode($json, true);
        
        $sql = "INSERT INTO tbl_books(book_title, author, ISBN, category_id, year_published, publisher) 
                VALUES(:book_title, :author, :ISBN, :category_id, :year, :publisher)";
                
        $stmt = $con->prepare($sql);       
        $stmt->bindParam(":book_title", $json['book_title']);
        $stmt->bindParam(":author", $json['author']);
        $stmt->bindParam(":ISBN", $json['ISBN']);
        $stmt->bindParam(":category_id", $json['category_id']);
        $stmt->bindParam(":year", $json['year']);
        $stmt->bindParam(":publisher", $json['publisher']);
        
        $stmt->execute();

        $returnValue = 0;
        if($stmt->rowCount() > 0){
            $returnValue = 1;
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

$book = new Book();

switch($operation) {
    case "get_books":
        echo $book->getBooks();
        break;
    case "add_book":
        echo $book->insertBook($json);
        break;
}
?>