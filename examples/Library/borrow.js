const baseApiUrl = "http://localhost/Library";

let details = [];
let books = [];

const saveBorrow = async () => {
  const header = {
    studentId: document.getElementById("students-select").value,
    borrowDate: document.getElementById("borrow-date").value,
    userId: 1, 
    totalBooks: details.length,
  };

  const jsonData = { header: header, details: details };

  const formData = new FormData();
  formData.append("operation", "saveBorrow");
  formData.append("json", JSON.stringify(jsonData));

  const response = await axios({
    url: `${baseApiUrl}/borrow.php`,
    method: "POST",
    data: formData,
  });

  if (response.data == 1) {
    alert("Borrow record has been successfully saved!");
    details = [];
    displayDetails();
  } else {
    alert("ERROR!");
  }
};

const openDetailsModal = async () => {
  document.getElementById("blank-modal-title").innerText = "Add Book to Borrow";
  books = await getAllBooks();

  let myHtml = `
      <select class="form-select book-select" id="book">
        <option value="0">SELECT BOOK</option>
    `;
  books.forEach((book) => {
    myHtml += `<option value="${book.book_id}">${book.title} by ${book.author}</option>`;
  });
  myHtml += `</select>`;

  const modalBody = document.getElementById("blank-main-div");
  modalBody.innerHTML = myHtml;

  modalBody.querySelector(".book-select").addEventListener("change", (e) => {
    const bookId = e.target.value;
    const book = books.find((b) => b.book_id == bookId);
    
    if (book) {
      // Prevent duplicate additions
      const exists = details.find(d => d.bookId == bookId);
      if(!exists) {
        const item = {
          bookId: book.book_id,
          title: book.title,
          author: book.author,
          category: book.category
        };
        details.push(item);
        displayDetails();
      }
    }
  });

  const myModal = new bootstrap.Modal(document.getElementById("blank-modal"), {
    keyboard: true,
    backdrop: "static",
  });

  myModal.show();
};

const displayDetails = () => {
  const tbody = document.getElementById("details-body");
  let myHtml = ``;
  details.forEach((detail) => {
    myHtml += `
        <tr>
          <td>${detail.title}</td>
          <td>${detail.author}</td>
          <td>${detail.category}</td>
        </tr>
      `;
  });
  tbody.innerHTML = myHtml;
  document.getElementById("total-books").innerText = details.length;
};

const onPageLoad = async () => {
  const select = document.getElementById("students-select");
  const students = await getAllStudents();

  var html = `<option value="0">-- SELECT STUDENT --</option>`;
  students.forEach((student) => {
    html += `<option value=${student.student_id}>${student.student_number} - ${student.full_name}</option>`;
  });
  select.innerHTML = html;

  document.getElementById("borrow-date").value = formatDateYYYYMMDD();

  document.getElementById("button-details").addEventListener("click", () => {
    openDetailsModal();
  });

  document.getElementById("button-save").addEventListener("click", () => {
    if(document.getElementById("students-select").value == 0) {
        alert("Please select a student.");
        return;
    }
    if(details.length === 0) {
        alert("Please add at least one book.");
        return;
    }
    saveBorrow();
  });
};

const getAllStudents = async () => {
  const response = await axios.get(`${baseApiUrl}/students.php`, {
    params: { operation: "getAllStudents" },
  });

  if (response.status == 200) {
    return response.data;
  } else {
    alert("Error!");
  }
};

const getAllBooks = async () => {
  const response = await axios.get(`${baseApiUrl}/books.php`, {
    params: { operation: "getAllBooks" },
  });

  if (response.status == 200) {
    return response.data;
  } else {
    alert("Error!");
  }
};

const formatDateYYYYMMDD = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
};

document.addEventListener("DOMContentLoaded", () => {
  onPageLoad();
});