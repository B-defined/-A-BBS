import sys, json, os, requests
from PyQt5 import uic
from PyQt5.QtWidgets import QApplication, QMainWindow, QMessageBox, QListWidgetItem, QInputDialog

# === DATA FILES ===
USER_FILE = "users.json"
BOOK_FILE = "books.json"
FEEDBACK_FILE = "feedback.json"

def load_json(file, default):
    if os.path.exists(file):
        with open(file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return default

def save_json(file, data):
    with open(file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# === INIT DATA ===
users = load_json(USER_FILE, [])
books = load_json(BOOK_FILE, [
    {"title": "Lập trình Python", "author": "Bill", "desc": "Sách cơ bản về Python"},
    {"title": "Thuật toán AI", "author": "Admin", "desc": "Giới thiệu AI"}
])
feedbacks = load_json(FEEDBACK_FILE, [])

current_user = None

class BookStoreApp(QMainWindow):
    def __init__(self):
        super().__init__()
        uic.loadUi("mainwindow.ui", self)

        # Connect Login signals
        self.btn_login.clicked.connect(self.handle_login)
        self.btn_go_register.clicked.connect(lambda: self.stackedWidget.setCurrentWidget(self.page_register))

        # Connect Register signals
        self.btn_register.clicked.connect(self.handle_register)
        self.btn_back_login.clicked.connect(lambda: self.stackedWidget.setCurrentWidget(self.page_login))

        # Connect Home
        self.btn_search_home.clicked.connect(self.search_books_local)
        self.search_home.returnPressed.connect(self.search_books_online)

        # Connect Feedback
        self.btn_send_feedback.clicked.connect(self.send_feedback)

        # Connect Manage Books
        self.btn_add_book.clicked.connect(self.add_book)
        self.list_manage_books.itemDoubleClicked.connect(self.delete_book)

        # Start with login page
        self.stackedWidget.setCurrentWidget(self.page_login)

    # === LOGIN ===
    def handle_login(self):
        global current_user
        email = self.login_email.text().strip()
        pwd = self.login_password.text().strip()
        user = next((u for u in users if u['email']==email and u['password']==pwd), None)
        if user:
            current_user = user
            QMessageBox.information(self, "Thành công", f"Xin chào {user['username']} ({user['role']})")
            self.show_home()
        else:
            QMessageBox.warning(self, "Lỗi", "Sai email hoặc mật khẩu")

    # === REGISTER ===
    def handle_register(self):
        name = self.reg_username.text().strip()
        email = self.reg_email.text().strip()
        pwd = self.reg_password.text().strip()
        if not email.endswith("@gmail.com"):
            QMessageBox.warning(self, "Lỗi", "Email phải có @gmail.com")
            return
        if len(pwd) < 6:
            QMessageBox.warning(self, "Lỗi", "Mật khẩu ít nhất 6 ký tự")
            return
        if any(u['email']==email for u in users):
            QMessageBox.warning(self, "Lỗi", "Email đã tồn tại")
            return

        code, ok = QInputDialog.getText(self, "Mã admin", "Nhập mã admin (bỏ trống nếu user)")
        role = "admin" if ok and code=="0000" else "user"

        users.append({"username": name, "email": email, "password": pwd, "role": role})
        save_json(USER_FILE, users)
        QMessageBox.information(self, "Thành công", "Đăng ký thành công, hãy đăng nhập")
        self.stackedWidget.setCurrentWidget(self.page_login)

    # === SHOW HOME ===
    def show_home(self):
        self.stackedWidget.setCurrentWidget(self.page_home)
        self.refresh_home_books()

    def refresh_home_books(self):
        self.list_home_books.clear()
        for b in books:
            self.list_home_books.addItem(f"{b['title']} - {b['author']}: {b['desc']}")

    # === SEARCH LOCAL ===
    def search_books_local(self):
        q = self.search_home.text().lower()
        filtered = [b for b in books if q in b['title'].lower() or q in b['author'].lower()]
        self.list_home_books.clear()
        if not filtered:
            self.list_home_books.addItem("Không tìm thấy trong thư viện cục bộ.")
        for b in filtered:
            self.list_home_books.addItem(f"{b['title']} - {b['author']}: {b['desc']}")

    # === SEARCH ONLINE ===
    def search_books_online(self):
        query = self.search_home.text().strip()
        if not query:
            return
        url = f"https://openlibrary.org/search.json?q={query}"
        try:
            resp = requests.get(url, timeout=5)
            data = resp.json()
            docs = data.get("docs", [])
            self.list_home_books.clear()
            if not docs:
                self.list_home_books.addItem("Không tìm thấy sách online.")
                return
            for doc in docs[:10]:
                title = doc.get("title", "No title")
                authors = ", ".join(doc.get("author_name", ["Unknown"]))
                year = doc.get("first_publish_year", "?")
                self.list_home_books.addItem(f"[ONLINE] {title} - {authors} ({year})")
        except Exception as e:
            QMessageBox.warning(self, "Lỗi API", f"Không thể lấy dữ liệu online: {e}")

    # === FEEDBACK ===
    def send_feedback(self):
        msg = self.feedback_text.toPlainText().strip()
        if not msg:
            return
        feedbacks.append({"user": current_user['username'], "message": msg})
        save_json(FEEDBACK_FILE, feedbacks)
        QMessageBox.information(self, "Cảm ơn", "Phản hồi đã gửi!")
        self.feedback_text.clear()
        self.load_feedbacks()

    def load_feedbacks(self):
        self.list_feedbacks.clear()
        if current_user and current_user['role']=="admin":
            for fb in feedbacks:
                self.list_feedbacks.addItem(f"{fb['user']}: {fb['message']}")

    # === MANAGE BOOKS ===
    def add_book(self):
        books.append({"title": self.book_title.text(), "author": self.book_author.text(), "desc": self.book_desc.text()})
        save_json(BOOK_FILE, books)
        QMessageBox.information(self, "Thành công", "Đã thêm sách")
        self.load_books()

    def load_books(self):
        self.list_manage_books.clear()
        for b in books:
            self.list_manage_books.addItem(f"{b['title']} - {b['author']}")

    def delete_book(self, item):
        idx = self.list_manage_books.row(item)
        if QMessageBox.question(self, "Xóa sách", "Bạn có chắc muốn xóa?")==QMessageBox.Yes:
            books.pop(idx)
            save_json(BOOK_FILE, books)
            self.load_books()

if __name__ == '__main__':
    app = QApplication(sys.argv)

    if os.path.exists("style.qss"):
        with open("style.qss") as f:
            app.setStyleSheet(f.read())

    win = BookStoreApp()
    win.show()
    sys.exit(app.exec_())
