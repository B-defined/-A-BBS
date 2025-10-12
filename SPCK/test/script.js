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
        'change-password-form'
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
function showLoader(show) { if (DOM.loader) DOM.loader.classList.toggle('truly-hidden', !show); }

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
    const ls = { get: (key, defaultValue = {}) => JSON.parse(localStorage.getItem(key)) || defaultValue };
    const editedBooks = ls.get('bookstore_editedBooks');
    const customBooks = ls.get('bookstore_customBooks', []);
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
        description = editedData?.description || (typeof bookDetails.description === 'string' ? bookDetails.description : (bookDetails.description?.value || 'Không có mô tả.'));
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
    if (!DOM.feedbackList) return;
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
        if (!user) {
            showToast('Không tìm thấy người dùng. Vui lòng đăng nhập lại.', 'error');
            return;
        }
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
        window.currentUserRole = userData.role;
        updateUIForUser(userData);
        initializeApp(true).then(() => {
            if (!currentPageId || ['landing', 'register', 'about'].includes(currentPageId)) {
                showPage('home');
            }
        });
        
    } else {
        window.currentUserRole = null;
        updateUIForGuest();
    }
});

function updateUIForUser(userData) {
    const aboutLink = document.getElementById('about-link-li');
    const homeLink = document.getElementById('home-link-li');
    if (aboutLink) aboutLink.classList.add('truly-hidden');
    if (homeLink) homeLink.classList.remove('truly-hidden');

    if (DOM.searchForm) DOM.searchForm.classList.remove('truly-hidden');
    if (DOM.loginLink) DOM.loginLink.classList.add('truly-hidden');
    if (DOM.userInfo) DOM.userInfo.classList.remove('truly-hidden');
    
    if (DOM.userDropdown) DOM.userDropdown.innerText = `Chào, ${userData.username}`;
    const isAdmin = userData.role === 'admin';
    window.currentUserRole = isAdmin ? 'admin' : 'user';
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('truly-hidden', !isAdmin));
    if (DOM.inboxLink) DOM.inboxLink.classList.toggle('truly-hidden', !isAdmin);
    if (DOM.submitFeedbackLink) DOM.submitFeedbackLink.classList.toggle('truly-hidden', isAdmin);
    if (DOM.addBookLink) DOM.addBookLink.classList.toggle('truly-hidden', !isAdmin);
    
    ['landing', 'register', 'forgot-password', 'about'].forEach(id => {
        const page = document.getElementById(id);
        if (page) page.classList.add('truly-hidden');
    });
}

function updateUIForGuest() {
    const aboutLink = document.getElementById('about-link-li');
    const homeLink = document.getElementById('home-link-li');
    if (aboutLink) aboutLink.classList.remove('truly-hidden');
    if (homeLink) homeLink.classList.add('truly-hidden');


    if (DOM.searchForm) DOM.searchForm.classList.add('truly-hidden');
    if (DOM.loginLink) DOM.loginLink.classList.remove('truly-hidden');
    if (DOM.userInfo) DOM.userInfo.classList.add('truly-hidden');
    
    document.querySelectorAll('.admin-only, #inbox-link, #add-book-link').forEach(el => el.classList.add('truly-hidden'));
    if (DOM.submitFeedbackLink) DOM.submitFeedbackLink.classList.add('truly-hidden');
    
    ['home', 'browse', 'book-detail', 'settings', 'submit-feedback', 'feedback-inbox', 'manage-books', 'forgot-password', 'register', 'landing'].forEach(id => {
        const page = document.getElementById(id);
        if (page) {
            page.classList.add('hidden');
            page.classList.add('truly-hidden');
        }
    });

    showPage('about');
}

function displayUserSettings() {
    if (!auth.currentUser) return;
    const userDocRef = db.collection("users").doc(auth.currentUser.uid);
    userDocRef.get().then(doc => {
        if (doc.exists) {
            const userData = doc.data();
            const usernameSpan = document.getElementById('setting-username');
            const emailSpan = document.getElementById('setting-email');
            const adminBlock = document.getElementById('admin-upgrade-block');

            if (usernameSpan) usernameSpan.textContent = userData.username;
            if (emailSpan) emailSpan.textContent = userData.email;
            if (adminBlock) adminBlock.classList.toggle('truly-hidden', userData.role === 'admin');
        }
    });

    const currentTheme = localStorage.getItem('bookstore_theme') || 'light';
    const darkThemeRadio = document.getElementById('darkThemeRadio');
    const lightThemeRadio = document.getElementById('lightThemeRadio');
    if (darkThemeRadio && lightThemeRadio) {
        document.getElementById(currentTheme === 'dark' ? 'darkThemeRadio' : 'lightThemeRadio').checked = true;
    }
}

async function handleAdminUpgrade() {
    if (!DOM.adminUpgradeBtn || !DOM.adminCodeInput) return;
    const button = DOM.adminUpgradeBtn;
    setButtonLoading(button, true, 'Kiểm tra...');

    const code = DOM.adminCodeInput.value;

    try {
        if (code !== '0000') {
            showToast('Mã Admin không chính xác.', 'error');
            return;
        }

        const userRef = db.collection("users").doc(auth.currentUser.uid);
        await userRef.update({ role: "admin" });

        window.currentUserRole = 'admin'; 
        showToast('Nâng cấp tài khoản thành Admin thành công!', 'success');

        const updatedUserData = (await userRef.get()).data();
        updateUIForUser(updatedUserData);
        displayUserSettings();
        
    } catch (error) {
        showToast('Đã xảy ra lỗi khi nâng cấp.', 'error');
        console.error("Lỗi nâng cấp admin:", error);
    } finally {
        setButtonLoading(button, false);
    }
}


function toggleAuth() { 
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    if (registerForm && loginForm) {
        registerForm.classList.toggle('truly-hidden');
        loginForm.classList.toggle('truly-hidden');
    }
}

async function initializeApp(fetchNew = true) {
    if (!DOM.homeBooks) return;
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
    if (DOM.themeToggleButton) DOM.themeToggleButton.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('bookstore_theme', theme);
}

function addAllEventListeners() {
    if (DOM.searchForm) DOM.searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = DOM.searchInput.value.trim();
        if (query) {
            if (DOM.browseTitle) DOM.browseTitle.innerText = `Kết quả cho "${query}"`;
            const books = await searchBooksAPI(query);
            displayBooks(books, DOM.browseBooks);
            showPage('browse');
        }
    });

    if (DOM.registerFormElement) DOM.registerFormElement.addEventListener('submit', handleRegister);
    if (DOM.loginFormElement) DOM.loginFormElement.addEventListener('submit', handleLogin);
    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) googleBtn.addEventListener('click', handleGoogleLogin);
    if (DOM.forgotPasswordForm) DOM.forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    if (DOM.changePasswordForm) DOM.changePasswordForm.addEventListener('submit', handleChangePassword);
    if (DOM.feedbackForm) DOM.feedbackForm.addEventListener('submit', handleFeedbackSubmit);
    if (DOM.themeToggleButton) DOM.themeToggleButton.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
    });
    const lightRadio = document.getElementById('lightThemeRadio');
    const darkRadio = document.getElementById('darkThemeRadio');
    if (lightRadio) lightRadio.addEventListener('change', () => applyTheme('light'));
    if (darkRadio) darkRadio.addEventListener('change', () => applyTheme('dark'));
    if (DOM.adminUpgradeBtn) DOM.adminUpgradeBtn.addEventListener('click', handleAdminUpgrade);
}

document.addEventListener('DOMContentLoaded', () => {
    initializeDOMElements();
    addAllEventListeners();
    const savedTheme = localStorage.getItem('bookstore_theme') || 'light';
    applyTheme(savedTheme);
});