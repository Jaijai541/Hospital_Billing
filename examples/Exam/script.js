document.addEventListener('DOMContentLoaded', () => {
    customerSelect.addEventListener('change', processTransaction);
    productSelect.addEventListener('change', processTransaction);
    qtyInput.addEventListener('input', processTransaction);
    initializeStore();
});

const apiClient = axios.create({
    baseURL: 'api.php',
    headers: {'Content-Type': 'application/json'}
});

const customerSelect = document.getElementById('customer-select');
const productSelect = document.getElementById('product-select');
const qtyInput = document.getElementById('qty-input');
const priceDisplay = document.getElementById('price-display');
const discountDisplay = document.getElementById('discount-display');
const netDisplay = document.getElementById('net-display');

const initializeStore = async () => {
    try {
        const [customersResponse, productsResponse] = await Promise.all([
            apiClient.post('', { endpoint: 'getAllCustomers' }),
            apiClient.post('', { endpoint: 'getAllProducts' })
            ]);

        const customers = customersResponse.data.customers;
        customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.customer_id;
            option.textContent = customer.full_name;
            customerSelect.appendChild(option);
            });

        const products = productsResponse.data.items;
        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.product_id;
            option.textContent = product.product_name;
            productSelect.appendChild(option);
            });

    } catch (error) {
        console.error("Error: ", error.message);
    }
};

const processTransaction = async () => {
    const customerId = customerSelect.value;
    const productId = productSelect.value;
    const qty = parseFloat(qtyInput.value) || 0;

    if (!customerId || !productId || qty <= 0) {
        priceDisplay.textContent = "0.00";
        discountDisplay.textContent = "0.00";
        netDisplay.textContent = "0.00";
        return;
    }

    try {
        const [ageResponse, priceResponse] = await Promise.all([
            apiClient.post('', { endpoint: 'getCustomerAge', customer_id: customerId }),
            apiClient.post('', { endpoint: 'getProductPrice', product_id: productId })
        ]);

        const customerAge = parseInt(ageResponse.data.age);
        const unitPrice = parseFloat(priceResponse.data.price);

        const totalPrice = unitPrice * qty;
                
        let discountAmount = 0;
        if (customerAge >= 60) {
            discountAmount = totalPrice * 0.12; // discount
        }

        const netAmount = totalPrice - discountAmount;

        priceDisplay.textContent = totalPrice.toFixed(2);
        discountDisplay.textContent = discountAmount.toFixed(2);
        netDisplay.textContent = netAmount.toFixed(2);

    } catch (error) {
        console.error("Error processing transaction:", error.message);
    }
};