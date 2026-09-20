<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

$groceryItems = [
    [ 'product_id' => 11, 'product_name' => "Dried Mangoes (200g)", 'product_price' => 180 ],
    [ 'product_id' => 12, 'product_name' => "Banana Chips (200g)", 'product_price' => 120 ],
    [ 'product_id' => 13, 'product_name' => "Tablea Chocolate (250g)", 'product_price' => 200 ],
    [ 'product_id' => 14, 'product_name' => "Coconut Oil (500ml)", 'product_price' => 180 ],
    [ 'product_id' => 15, 'product_name' => "Mango Jam (250g)", 'product_price' => 160 ],
    [ 'product_id' => 16, 'product_name' => "Peanut Brittle (200g)", 'product_price' => 150 ],
    [ 'product_id' => 17, 'product_name' => "Cashew Nuts (250g)", 'product_price' => 280 ],
    [ 'product_id' => 18, 'product_name' => "Philippine Coffee Beans (250g)", 'product_price' => 320 ],
    [ 'product_id' => 19, 'product_name' => "Native Vinegar (500ml)", 'product_price' => 120 ],
    [ 'product_id' => 110, 'product_name' => "Philippine Honey (250ml)", 'product_price' => 250 ],
    [ 'product_id' => 111, 'product_name' => "Coconut Sugar (500g)", 'product_price' => 180 ],
    [ 'product_id' => 112, 'product_name' => "Rice Crackers (200g)", 'product_price' => 100 ],
    [ 'product_id' => 113, 'product_name' => "Salted Fish (Danggit, 250g)", 'product_price' => 220 ],
    [ 'product_id' => 114, 'product_name' => "Longganisa (Frozen, 500g)", 'product_price' => 280 ],
    [ 'product_id' => 115, 'product_name' => "Tocino (Frozen, 500g)", 'product_price' => 300 ],
    [ 'product_id' => 116, 'product_name' => "Chicharon (100g)", 'product_price' => 120 ],
    [ 'product_id' => 117, 'product_name' => "Pandesal Pack (12 pcs)", 'product_price' => 80 ],
    [ 'product_id' => 118, 'product_name' => "Native Brown Rice (1kg)", 'product_price' => 90 ],
    [ 'product_id' => 119, 'product_name' => "White Rice (1kg)", 'product_price' => 70 ],
    [ 'product_id' => 120, 'product_name' => "Corn Coffee (250g)", 'product_price' => 150 ],
    [ 'product_id' => 121, 'product_name' => "Coconut Water (1L)", 'product_price' => 100 ],
    [ 'product_id' => 122, 'product_name' => "Calamansi Juice (1L)", 'product_price' => 120 ],
    [ 'product_id' => 123, 'product_name' => "Guava Jelly (250g)", 'product_price' => 160 ],
    [ 'product_id' => 124, 'product_name' => "Bagoong (250g)", 'product_price' => 90 ],
    [ 'product_id' => 125, 'product_name' => "Fish Sauce (Patis, 500ml)", 'product_price' => 110 ],
    [ 'product_id' => 126, 'product_name' => "Soy Sauce (500ml)", 'product_price' => 95 ],
    [ 'product_id' => 127, 'product_name' => "Native Salt (250g)", 'product_price' => 50 ],
    [ 'product_id' => 128, 'product_name' => "Coconut Milk Powder (200g)", 'product_price' => 140 ],
    [ 'product_id' => 129, 'product_name' => "Instant Noodles (Pack of 6)", 'product_price' => 75 ],
    [ 'product_id' => 130, 'product_name' => "Native Cheese (Kesong Puti, 250g)", 'product_price' => 180 ]
];

$customers = [
    [ "customer_id" => 102,  "full_name" => "Michael V.",  "address" => "Cagayan de Oro City",  "age" => 21],
    [ "customer_id" => 1005, "full_name" => "Piolo Pascual", "address" => "Davao City",  "age" => 24],
    [ "customer_id" => 1005, "full_name" => "Ivana Alawit", "address" => "Cebu City", "age" => 65],
    [ "customer_id" => 1007, "full_name" => "Marian Rivera", "address" => "Malaybalay City, Bukidnon", "age" => 22],
    [ "customer_id" => 1009, "full_name" => "Coco Martin", "address" => "Iligan City", "age" => 78],
    [ "customer_id" => 1002, "full_name" => "Bea Alonzo", "address" => "Butuan City", "age" => 25],
    [ "customer_id" => 100,  "full_name" => "Andrea Brillantes",  "address" => "Tagum City", "age" => 62],
    [ "customer_id" => 103,  "full_name" => "Liza Soberano", "address" => "General Santos City", "age" => 20],
    [ "customer_id" => 1006, "full_name" => "Andrew E.", "address" => "Valencia City, Bukidnon", "age" => 27],
    [ "customer_id" => 1001, "full_name" => "Kathryn Bernardo", "address" => "Ozamiz City", "age" => 89]
];

$requestPayload = json_decode(file_get_contents("php://input"), true);
$endpoint = $requestPayload['endpoint'] ?? '';

switch ($endpoint) {
    case 'getAllProducts':
        echo json_encode(["status" => "success", "items" => $groceryItems]);
        break;

    case 'getAllCustomers':
        echo json_encode(["status" => "success", "customers" => $customers]);
        break;

    case 'getCustomerAge':
        $requestedId = $requestPayload['customer_id'] ?? null;
        $foundAge = null;
        
        foreach ($customers as $customer) {
            if ($customer['customer_id'] == $requestedId) {
                $foundAge = $customer['age'];
                break;
            }
        }
        
        if ($foundAge !== null) {
            echo json_encode(["status" => "success", "age" => $foundAge]);
        } else {
            echo json_encode(["status" => "error", "message" => "Customer ID not found"]);
        }
        break;

    case 'getProductPrice':
        $requestedId = $requestPayload['product_id'] ?? null;
        $foundPrice = null;
        
        foreach ($groceryItems as $product) {
            if ($product['product_id'] == $requestedId) {
                $foundPrice = $product['product_price'];
                break;
            }
        }
        
        if ($foundPrice !== null) {
            echo json_encode(["status" => "success", "price" => $foundPrice]);
        } else {
            echo json_encode(["status" => "error", "message" => "Product ID not found"]);
        }
        break;

    default:
        echo json_encode(["status" => "error", "message" => "Invalid endpoint specified"]);
        break;
}
?>