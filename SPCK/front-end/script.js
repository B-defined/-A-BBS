// File: script.js

// --- CONFIG & DOM ELEMENTS ---
const SEARCH_API_URL = 'https://openlibrary.org/search.json';
const BOOKS_API_URL = 'https://openlibrary.org';
const DOM = {};

// --- INITIALIZE DOM ELEMENTS ---
function initializeDOMElements() {
    const ids = [
        'search-form', 'search-input', 'home-books', 'browse-books', 'book-detail', 'browse-title', 'loader',
        'login-link', 'user-info', 'user-dropdown', 'register-form-element', 'login-form-element', 'feedback-form',
        'feedback-list', 'book-form', 'clear-form-btn', 'submit-feedback-link', 'inbox-link', 'add-book-link',
        'landing', 'theme-toggle-btn', 'admin-upgrade-btn', 'admin-code-input', 'forgot-password-form', 
        'change-password-form' // Thêm ID của form mới
    ];
    ids.forEach(id => {
        const camelCaseId = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
        DOM[camelCaseId] = document.getElementById(id);
    });
}

// --- TOAST NOTIFICATION ---
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}

// --- PAGE & UI MANAGEMENT ---
let currentPageId = null;
function showLoader(show) { DOM.loader.classList.toggle('truly-hidden', !show); }

function showPage(pageId) {
    if (currentPageId === pageId) return;

    const adminPages = ['manage-books', 'feedback-inbox'];
    if (adminPages.includes(pageId) && (!auth.currentUser || window.currentUserRole !== 'admin')) {
        return showToast('Bạn không có quyền truy cập trang này.', 'error');
    }

    if (currentPageId) {
        const currentPageElement = document.getElementById(currentPageId);
        if (currentPageElement) {
            currentPageElement.classList.add('hidden');
            setTimeout(() => {
                if(currentPageElement.classList.contains('hidden')) {
                   currentPageElement.classList.add('truly-hidden');
                }
            }, 400);
        }
    }

    const newPageElement = document.getElementById(pageId);
    if (newPageElement) {
        newPageElement.classList.remove('truly-hidden');
        setTimeout(() => newPageElement.classList.remove('hidden'), 10);
        currentPageId = pageId;

        if (pageId === 'feedback-inbox' && window.currentUserRole === 'admin') displayFeedbacks();
        if (pageId === 'settings') displayUserSettings();
    }
}


// --- API FUNCTIONS (OpenLibrary) ---
async function searchBooksAPI(query) {
    showLoader(true);
    try {
        const response = await fetch(`${SEARCH_API_URL}?q=${encodeURIComponent(query)}&limit=50`);
        if (!response.ok) throw new Error('Network error');
        return (await response.json()).docs || [];
    } catch (error) {
        console.error("API Search Error:", error);
        showToast('Lỗi khi tìm kiếm sách. Vui lòng thử lại.', 'error');
        return [];
    } finally {
        showLoader(false);
    }
}

async function fetchBookDetailsAPI(bookKey) {
    showLoader(true);
    try {
        const response = await fetch(`${BOOKS_API_URL}${bookKey}.json`);
        if (!response.ok) throw new Error('Network error');
        return await response.json();
    } catch (error) {
        console.error("API Detail Error:", error);
        showToast('Không thể tải chi tiết sách.', 'error');
        return null;
    } finally {
        showLoader(false);
    }
}

// --- DISPLAY FUNCTIONS ---
function displayBooks(books, container) {
    if(!container) return;
    container.innerHTML = '';
    const isAdmin = window.currentUserRole === 'admin';
    
    books.forEach(book => {
        const coverUrl = book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : 'https://via.placeholder.com/240x360.png?text=No+Image';
        const bookElement = document.createElement('div');
        bookElement.className = 'book';
        bookElement.innerHTML = `
            ${isAdmin ? `<div class="admin-controls"><button class="edit-btn" onclick="handleEditBook('${book.key}')">✏️</button><button class="delete-btn" onclick="handleDeleteBook('${book.key}')">🗑️</button></div>` : ''}
            <img src="${coverUrl}" alt="${book.title}" onclick="showBookDetail('${book.key}')">
            <h3 onclick="showBookDetail('${book.key}')">${book.title}</h3>
            <p class="author">${book.author_name ? book.author_name.join(', ') : 'Unknown Author'}</p>
        `;
        container.appendChild(bookElement);
    });
}

async function showBookDetail(bookKey) {
    const ls = { get: (key, defaultValue = []) => JSON.parse(localStorage.getItem(key)) || defaultValue };
    const editedBooks = ls.get('bookstore_editedBooks', {});
    const customBooks = ls.get('bookstore_customBooks');
    const customBook = customBooks.find(b => b.key === bookKey);
    const editedData = editedBooks[bookKey];

    let title, authors, publishYear, description, coverUrl;

    if (customBook) {
        title = editedData?.title || customBook.title;
        authors = editedData?.authors || customBook.authors;
        publishYear = 'N/A';
        description = editedData?.description || customBook.description || 'Không có mô tả.';
        coverUrl = editedData?.coverUrl || customBook.coverUrl;
    } else {
        const bookDetails = await fetchBookDetailsAPI(bookKey);
        if (!bookDetails) return;
        title = editedData?.title || bookDetails.title;
        authors = editedData?.authors || (bookDetails.authors ? bookDetails.authors.map(a => a.key).join(', ').replace('/authors/', '') : 'N/A');
        publishYear = bookDetails.first_publish_year || 'N/A';
        description = editedData?.description || (typeof bookDetails.description === 'string' ? bookDetails.description : bookDetails.description?.value) || 'Không có mô tả.';
        coverUrl = editedData?.coverUrl || (bookDetails.covers?.[0] ? `https://covers.openlibrary.org/b/id/${bookDetails.covers[0]}-L.jpg` : 'https://via.placeholder.com/250x380.png?text=No+Image');
    }
    
    const tikiSearchUrl = `https://tiki.vn/search?q=${encodeURIComponent(title)}`;

    DOM.bookDetail.innerHTML = `
        <div id="book-detail-content">
            <div class="book-detail-img">
                <img src="${coverUrl}" alt="${title}">
            </div>
            <div class="book-detail-info">
                <h2>${title}</h2>
                <p class="author">bởi ${authors}</p>
                <div class="meta-info">
                    <p><strong>Năm XB đầu tiên:</strong> <span>${publishYear}</span></p>
                </div>
                <h3>Giới thiệu</h3>
                <div class="description">${description.replace(/\n/g, '<br>')}</div>
                <div class="mt-4">
                    <button class="btn btn-secondary" onclick="showPage('home')">Quay lại</button>
                    <a href="${tikiSearchUrl}" target="_blank" class="btn btn-primary ms-2">
                        <i class="fas fa-shopping-cart"></i> Mua trên Tiki
                    </a>
                </div>
            </div>
        </div>`;
    
    showPage('book-detail');
}

// --- FEEDBACK MANAGEMENT with FIREBASE ---
async function handleFeedbackSubmit(event) {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    setButtonLoading(button, true);

    const feedbackData = {
        name: event.target.name.value,
        email: event.target.email.value,
        message: event.target.message.value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        user: auth.currentUser ? auth.currentUser.email : "Guest"
    };

    try {
        await db.collection("feedbacks").add(feedbackData);
        showToast('Cảm ơn bạn đã gửi phản hồi!', 'success');
        event.target.reset();
        showPage('home');
    } catch (error) {
        console.error("Lỗi khi gửi feedback:", error);
        showToast('Đã xảy ra lỗi khi gửi. Vui lòng thử lại.', 'error');
    } finally {
        setButtonLoading(button, false);
    }
}

async function displayFeedbacks() {
    DOM.feedbackList.innerHTML = '';
    showLoader(true);
    try {
        const snapshot = await db.collection("feedbacks").orderBy("createdAt", "desc").get();
        if (snapshot.empty) {
            DOM.feedbackList.innerHTML = '<p class="text-center">Chưa có phản hồi nào.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const fb = doc.data();
            const card = document.createElement('div');
            card.className = 'card mb-3';
            card.innerHTML = `<div class="card-header">${fb.name} - ${fb.email} (${fb.createdAt?.toDate().toLocaleString('vi-VN') || 'N/A'})</div><div class="card-body"><p class="card-text">${fb.message}</p></div>`;
            DOM.feedbackList.appendChild(card);
        });
    } catch (error) {
        console.error("Lỗi khi tải feedbacks:", error);
        showToast("Không thể tải danh sách feedback.", "error");
    } finally {
        showLoader(false);
    }
}

// --- AUTHENTICATION with FIREBASE ---
let currentUserRole = null; 

function setButtonLoading(button, isLoading, text = 'Đang xử lý...') {
    if(!button) return;
    if (!button.dataset.originalText) {
        button.dataset.originalText = button.innerHTML;
    }
    button.disabled = isLoading;
    button.innerHTML = isLoading ? `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${text}` : button.dataset.originalText;
}

async function handleRegister(event) {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    setButtonLoading(button, true);

    const email = form.querySelector('#register-email').value;
    const password = form.querySelector('#register-password').value;
    const username = form.querySelector('#register-username').value;

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection("users").doc(userCredential.user.uid).set({
            username: username,
            email: email,
            role: "user"
        });
        showToast('Đăng ký thành công!', 'success');
        toggleAuth();
    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        showToast(error.message, 'error');
    } finally {
        setButtonLoading(button, false);
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    setButtonLoading(button, true);

    const email = form.querySelector('#login-email').value;
    const password = form.querySelector('#login-password').value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        showToast(error.message, 'error');
    } finally {
        setButtonLoading(button, false);
    }
}

async function handleGoogleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        showToast('Đăng nhập với Google thành công!', 'success');
    } catch (error) {
        console.error("Lỗi đăng nhập Google:", error);
        showToast(error.message, 'error');
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    const email = form.querySelector('#forgot-password-email').value;

    setButtonLoading(button, true, "Đang gửi...");

    try {
        await auth.sendPasswordResetEmail(email);
        showToast('Email hướng dẫn đã được gửi! Vui lòng kiểm tra hòm thư.', 'success');
        form.reset();
        showPage('register');
    } catch (error) {
        console.error("Lỗi gửi email reset:", error);
        if (error.code === 'auth/user-not-found') {
            showToast('Lỗi: Không tìm thấy người dùng với email này.', 'error');
        } else {
            showToast('Đã có lỗi xảy ra. Vui lòng thử lại.', 'error');
        }
    } finally {
        setButtonLoading(button, false);
    }
}

async function handleChangePassword(event) {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    const newPassword = form.querySelector('#new-password').value;
    const confirmPassword = form.querySelector('#confirm-new-password').value;

    if (newPassword.length < 6) {
        showToast('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast('Mật khẩu xác nhận không khớp!', 'error');
        return;
    }

    setButtonLoading(button, true, "Đang cập nhật...");

    try {
        const user = auth.currentUser;
        await user.updatePassword(newPassword);
        showToast('Đổi mật khẩu thành công!', 'success');
        form.reset();
    } catch (error) {
        console.error("Lỗi đổi mật khẩu:", error);
        if (error.code === 'auth/requires-recent-login') {
            showToast('Để bảo mật, vui lòng đăng xuất và đăng nhập lại trước khi đổi mật khẩu.', 'error');
        } else {
            showToast('Có lỗi xảy ra, không thể đổi mật khẩu.', 'error');
        }
    } finally {
        setButtonLoading(button, false);
    }
}

function handleLogout() {
    auth.signOut();
    showToast('Bạn đã đăng xuất.', 'info');
}

auth.onAuthStateChanged(async user => {
    if (user) {
        const userDocRef = db.collection("users").doc(user.uid);
        let userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            const newUser = {
                username: user.displayName || user.email.split('@')[0],
                email: user.email,
                role: "user"
            };
            await userDocRef.set(newUser);
            userDoc = await userDocRef.get();
        }

        const userData = userDoc.data();
        currentUserRole = userData.role;
        updateUIForUser(userData);
        
    } else {
        currentUserRole = null;
        updateUIForGuest();
    }
});

function updateUIForUser(userData) {
    DOM.searchForm.classList.remove('truly-hidden');
    DOM.loginLink.classList.add('truly-hidden');
    DOM.userInfo.classList.remove('truly-hidden');
    
    DOM.userDropdown.innerText = `Chào, ${userData.username}`;
    const isAdmin = userData.role === 'admin';
    currentUserRole = isAdmin ? 'admin' : 'user';
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('truly-hidden', !isAdmin));
    DOM.inboxLink.classList.toggle('truly-hidden', !isAdmin);
    DOM.submitFeedbackLink.classList.toggle('truly-hidden', isAdmin);
    DOM.addBookLink.classList.toggle('truly-hidden', !isAdmin);
    
    document.getElementById('landing').classList.add('truly-hidden');
    document.getElementById('register').classList.add('truly-hidden');
    document.getElementById('forgot-password').classList.add('truly-hidden');

    initializeApp(true).then(() => showPage('home'));
}

function updateUIForGuest() {
    DOM.searchForm.classList.add('truly-hidden');
    DOM.loginLink.classList.remove('truly-hidden');
    DOM.userInfo.classList.add('truly-hidden');
    
    document.querySelectorAll('.admin-only, #inbox-link, #add-book-link').forEach(el => el.classList.add('truly-hidden'));
    DOM.submitFeedbackLink.classList.remove('truly-hidden');
    
    ['home', 'browse', 'book-detail', 'about', 'settings', 'submit-feedback', 'feedback-inbox', 'manage-books', 'forgot-password'].forEach(id => {
        const page = document.getElementById(id);
        if (page) {
            page.classList.add('hidden');
            page.classList.add('truly-hidden');
        }
    });

    document.getElementById('landing').classList.remove('truly-hidden', 'hidden');
    document.getElementById('register').classList.remove('truly-hidden', 'hidden');
    currentPageId = null; 
}

function displayUserSettings() {
    if (!auth.currentUser) return;
    const userDocRef = db.collection("users").doc(auth.currentUser.uid);
    userDocRef.get().then(doc => {
        if (doc.exists) {
            const userData = doc.data();
            document.getElementById('setting-username').textContent = userData.username;
            document.getElementById('setting-email').textContent = userData.email;
            document.getElementById('admin-upgrade-block').classList.toggle('truly-hidden', userData.role === 'admin');
        }
    });

    const currentTheme = localStorage.getItem('bookstore_theme') || 'light';
    document.getElementById(currentTheme === 'dark' ? 'darkThemeRadio' : 'lightThemeRadio').checked = true;
}

async function handleAdminUpgrade() {
    const button = DOM.adminUpgradeBtn;
    setButtonLoading(button, true, 'Kiểm tra...');

    const code = DOM.adminCodeInput.value;
    if (code !== '0000') {
        setTimeout(() => { showToast('Mã Admin không chính xác.', 'error'); setButtonLoading(button, false); }, 500);
        return;
    }

    try {
        const userRef = db.collection("users").doc(auth.currentUser.uid);
        await userRef.update({ role: "admin" });
        currentUserRole = 'admin';
        showToast('Nâng cấp tài khoản thành Admin thành công!', 'success');
        displayUserSettings();
        updateUIForUser((await userRef.get()).data());
    } catch (error) {
        showToast('Đã xảy ra lỗi khi nâng cấp.', 'error');
    } finally {
        setButtonLoading(button, false);
    }
}

function toggleAuth() { 
    document.getElementById('registerForm').classList.toggle('truly-hidden');
    document.getElementById('loginForm').classList.toggle('truly-hidden');
}

async function initializeApp(fetchNew = true) {
    const cachedBooks = JSON.parse(localStorage.getItem('api_cache') || '[]');
    if (fetchNew || cachedBooks.length === 0) {
        const featuredBooks = await searchBooksAPI('vietnamese literature');
        localStorage.setItem('api_cache', JSON.stringify(featuredBooks));
        displayBooks(featuredBooks, DOM.homeBooks);
    } else {
        displayBooks(cachedBooks, DOM.homeBooks);
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    DOM.themeToggleButton.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('bookstore_theme', theme);
}

function addAllEventListeners() {
    DOM.searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = DOM.searchInput.value.trim();
        if (query) {
            DOM.browseTitle.innerText = `Kết quả cho "${query}"`;
            const books = await searchBooksAPI(query);
            displayBooks(books, DOM.browseBooks);
            showPage('browse');
        }
    });

    DOM.registerFormElement.addEventListener('submit', handleRegister);
    DOM.loginFormElement.addEventListener('submit', handleLogin);
    document.getElementById('google-login-btn').addEventListener('click', handleGoogleLogin);
    DOM.forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    DOM.changePasswordForm.addEventListener('submit', handleChangePassword); // Thêm event listener mới
    DOM.feedbackForm.addEventListener('submit', handleFeedbackSubmit);
    DOM.themeToggleButton.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
    });
    document.getElementById('lightThemeRadio').addEventListener('change', () => applyTheme('light'));
    document.getElementById('darkThemeRadio').addEventListener('change', () => applyTheme('dark'));
    DOM.adminUpgradeBtn.addEventListener('click', handleAdminUpgrade);
}

document.addEventListener('DOMContentLoaded', () => {
    initializeDOMElements();
    addAllEventListeners();
    const savedTheme = localStorage.getItem('bookstore_theme') || 'light';
    applyTheme(savedTheme);
});