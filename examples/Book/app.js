const baseApiUrl = "http://localhost/Book"; 

document.addEventListener("DOMContentLoaded", () => {
  displayCategories();
  displayBooks();
  
  document.getElementById("btnSubmit").addEventListener("click", () => {
    insertBook();
  });
});

const displayBooks = async() => {
  // GET
  const response = await axios.get(`${baseApiUrl}/books.php`, {
    params: { operation: "get_books" }
  });
  
  if (response.status == 200) {
    displayBooksTable(response.data);
  } else {
    alert("Error!");
  }
}

const displayBooksTable = (books) => {
  const tableDiv = document.getElementById("table-div");
  tableDiv.innerHTML = "";

  const table = document.createElement("table");
  table.border = "1";
  table.cellPadding = "4";

  const thead = document.createElement("thead");
  thead.innerHTML = `
      <tr>  
        <th>Book ID</th>
        <th>Book Title</th>
        <th>Author</th>
        <th>ISBN</th>
        <th>Category</th>
        <th>Year</th>
        <th>Publisher</th>
      </tr>
    `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  books.forEach(book => {
    let row = document.createElement("tr");
    row.innerHTML = `
        <td>${book.book_id}</td>
        <td>${book.book_title}</td>
        <td>${book.author}</td>
        <td>${book.ISBN}</td>
        <td>${book.category_name}</td>
        <td>${book.year_published}</td>
        <td>${book.publisher}</td>
      `;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  tableDiv.appendChild(table);
}

const displayCategories = async() => {
  const select = document.getElementById("category_id");

  const response = await axios.get(`${baseApiUrl}/categories.php`, {
    params: { operation: "get_categories" }
  });
  
  if (response.status == 200) {
    const categories = response.data;
    categories.forEach(category => {
      let option = document.createElement("option");
      option.innerText = category.category_name;
      option.value = category.category_id;
      select.appendChild(option);
    });
  } else {
    alert("Error!");
  }
}

 // POST
const insertBook = async() => {
  const jsonData = {
    book_title: document.getElementById("book_title").value,
    author: document.getElementById("author").value,
    ISBN: document.getElementById("isbn").value,
    category_id: document.getElementById("category_id").value,
    year: document.getElementById("year").value,
    publisher: document.getElementById("publisher").value
  };

  const formData = new FormData();
  formData.append("operation", "add_book");
  formData.append("json", JSON.stringify(jsonData));

  const response = await axios({
    url: `${baseApiUrl}/books.php`,
    method: "POST",
    data: formData
  });

  console.log(response);
  if (response.data == 1) {
    displayBooks();
    alert("Book Successfully saved!");
  } else {
    alert("ERROR");
  }
}