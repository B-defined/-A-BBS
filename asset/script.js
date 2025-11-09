// File: script.js

// --- CONFIG & DOM ELEMENTS ---
const SEARCH_API_URL = 'https://openlibrary.org/search.json';
const BOOKS_API_URL = 'https://openlibrary.org';
const POPULAR_KEYWORDS = ["Sách văn học", "Tiểu thuyết", "Truyện ngắn", "Sách kinh tế", "Kỹ năng sống", "Harry Potter", "Lịch sử Việt Nam"];
const DOM = {};

// --- INITIALIZE DOM ELEMENTS ---
function initializeDOMElements() {
    const ids = [
        'search-form', 'search-input', 'search-suggestions', 'home-books', 'browse-books', 'book-detail', 'browse-title', 'loader',
        'login-link', 'user-info', 'user-dropdown', 'register-form-element', 'login-form-element', 'feedback-form',
        'feedback-list', 'submit-feedback-link', 'inbox-link', // 'add-book-link' replaced by 'manage-user-books-link'
        'landing', 'theme-toggle-btn', 'admin-upgrade-btn', 'admin-code-input', 'forgot-password-form', 
        'change-password-form', 'post-form', 'forum-posts-list', 'post-detail-content',
        'user-form', 'users-list-tbody', 'clear-user-form-btn',
        'my-books-link-li', 'my-books-list-tbody', 'my-book-form', 'clear-my-book-form-btn', 
        'manage-user-books-link', 'all-user-books-tbody', 'admin-book-form', 'clear-admin-book-form-btn' 
    ];
    ids.forEach(id => {
        const camelCaseId = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
        // Add checks to prevent errors if an element is missing
        const element = document.getElementById(id);
        if (element) {
            DOM[camelCaseId] = element;
        } else {
            console.warn(`Element with ID "${id}" not found.`);
        }
    });
}

// --- TOAST NOTIFICATION ---
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.error("Toast container not found!");
        return; 
    }
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10); // Trigger animation
    setTimeout(() => {
        toast.classList.remove('show');
        // Remove element after transition finishes
        toast.addEventListener('transitionend', () => toast.remove()); 
    }, duration);
}

// --- PAGE & UI MANAGEMENT ---
let currentPageId = null;
function showLoader(show) { if (DOM.loader) DOM.loader.classList.toggle('truly-hidden', !show); }

function showPage(pageId) {
    // Basic check if pageId exists
    if (!document.getElementById(pageId)) {
        console.error(`Attempted to show non-existent page: ${pageId}`);
        // Fallback to a default page
        if (auth.currentUser) showPage('home');
        else showPage('about');
        return;
    }

    if (currentPageId === pageId) return; // Don't re-render if already on the page

    const adminPages = ['feedback-inbox', 'manage-users', 'manage-books']; 
    const userPages = ['my-books', 'forum', 'settings', 'submit-feedback']; 

    // Check permissions before proceeding
    if ((adminPages.includes(pageId) || userPages.includes(pageId)) && !auth.currentUser) {
         return showToast('Bạn cần đăng nhập để truy cập trang này.', 'error');
    }
    if (adminPages.includes(pageId) && window.currentUserRole !== 'admin') {
        return showToast('Bạn không có quyền truy cập trang này.', 'error');
    }

    // Hide the current page smoothly
    if (currentPageId) {
        const currentPageElement = document.getElementById(currentPageId);
        if (currentPageElement) {
            currentPageElement.classList.add('hidden');
            // Use 'transitionend' for more reliable hiding after animation
            const hideHandler = () => {
                currentPageElement.classList.add('truly-hidden');
                currentPageElement.removeEventListener('transitionend', hideHandler);
            };
            // Add a fallback timeout in case transitionend doesn't fire (e.g., element removed)
            setTimeout(() => {
                 if (currentPageElement.classList.contains('hidden')) {
                     currentPageElement.classList.add('truly-hidden');
                 }
            }, 500); // Slightly longer than CSS transition
             currentPageElement.addEventListener('transitionend', hideHandler);
        }
    }

    // Show the new page
    const newPageElement = document.getElementById(pageId);
    if (newPageElement) {
        // Ensure it's truly hidden first, then remove hidden for transition
        newPageElement.classList.add('truly-hidden'); 
        newPageElement.classList.remove('hidden'); // Allow transition to start from opacity 0
        // Use requestAnimationFrame to ensure the browser processes the style changes
        requestAnimationFrame(() => {
            newPageElement.classList.remove('truly-hidden');
            requestAnimationFrame(() => {
                 // Removing 'hidden' triggers the opacity transition defined in CSS
                 // No need for the timeout here if CSS handles the transition properly
            });
        });
        currentPageId = pageId;

        // Load data specific to the new page
        if (pageId === 'my-books') displayMyBooks();        
        if (pageId === 'manage-books') displayAllUserBooks(); 
        if (pageId === 'manage-users') displayUsers(); 
        if (pageId === 'forum') displayForumPosts();
        if (pageId === 'feedback-inbox' && window.currentUserRole === 'admin') displayFeedbacks();
        if (pageId === 'settings') displayUserSettings();
    } 
    // No 'else' needed here, error handled at the beginning
}


// --- API FUNCTIONS (OpenLibrary) ---
async function searchBooksAPI(query) {
    showLoader(true);
    try {
        const response = await fetch(`${SEARCH_API_URL}?q=${encodeURIComponent(query)}&limit=50`);
        if (!response.ok) throw new Error('Network error during search');
        const data = await response.json();
        return data.docs || [];
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
        if (!response.ok) throw new Error(`Network error fetching details for ${bookKey}`);
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
    if (!container) {
        console.error("Book display container not found");
        return;
    }
    container.innerHTML = ''; // Clear previous results
    const isAdmin = window.currentUserRole === 'admin';

    if (!books || books.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">Không tìm thấy sách nào.</p>';
        return;
    }
    
    books.forEach(book => {
        const coverUrl = book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : 'https://via.placeholder.com/240x360.png?text=No+Image';
        const bookElement = document.createElement('div');
        bookElement.className = 'book';
        // Use book.key for OpenLibrary books, book.id for Firestore books
        const bookIdentifier = book.key ? `'${book.key}'` : (book.id ? `'${book.id}'` : null); 
        if (!bookIdentifier) {
            console.warn("Skipping book due to missing identifier:", book);
            return; // Skip if no identifier
        }

        bookElement.innerHTML = `
            ${isAdmin ? `<div class="admin-controls"><button class="edit-btn" onclick="handleEditBook(${bookIdentifier})">✏️</button><button class="delete-btn" onclick="handleDeleteBook(${bookIdentifier})">🗑️</button></div>` : ''}
            <img src="${coverUrl}" alt="${book.title}" onclick="showBookDetail(${bookIdentifier})">
            <h3 onclick="showBookDetail(${bookIdentifier})">${book.title || 'Không có tiêu đề'}</h3>
            <p class="author">${book.author_name ? book.author_name.join(', ') : (book.authors || 'Unknown Author')}</p>
        `;
        container.appendChild(bookElement);
    });
}


async function showBookDetail(bookOrDocId) {
    if (!DOM.bookDetail) return; // Check if the detail section exists

    const isFirestoreId = typeof bookOrDocId === 'string' && bookOrDocId.length === 20 && !bookOrDocId.includes('/'); 
    let title = 'Không có tiêu đề';
    let authors = 'N/A';
    let publishYear = 'N/A';
    let description = 'Không có mô tả.';
    let coverUrl = 'https://via.placeholder.com/250x380.png?text=No+Image';
    
    showLoader(true);

    try {
        if (isFirestoreId) { 
            const bookDoc = await db.collection('user_books').doc(bookOrDocId).get();
            if (!bookDoc.exists) throw new Error('Book not found in Firestore');
            const bookData = bookDoc.data();
            title = bookData.title;
            authors = bookData.authors || 'N/A';
            publishYear = bookData.createdAt?.toDate().toLocaleDateString('vi-VN') || 'N/A'; // Use created date
            description = bookData.description || 'Không có mô tả.';
            coverUrl = bookData.coverUrl || 'https://via.placeholder.com/250x380.png?text=No+Image';
        } else { 
            const bookKey = bookOrDocId; 
            // Admin edits on OL books are not stored in Firestore in this version
            const bookDetails = await fetchBookDetailsAPI(bookKey);
            if (!bookDetails) throw new Error('Book not found in OpenLibrary');
            
            title = bookDetails.title;
            authors = (bookDetails.authors ? bookDetails.authors.map(a => a.key).join(', ').replace('/authors/', '') : 'N/A');
            publishYear = bookDetails.first_publish_year || 'N/A';
            description = (typeof bookDetails.description === 'string' ? bookDetails.description : (bookDetails.description?.value || 'Không có mô tả.'));
            coverUrl = (bookDetails.covers?.[0] ? `https://covers.openlibrary.org/b/id/${bookDetails.covers[0]}-L.jpg` : 'https://via.placeholder.com/250x380.png?text=No+Image');
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
                        <p><strong>Năm XB / Thêm:</strong> <span>${publishYear}</span></p> 
                    </div>
                    <h3>Giới thiệu</h3>
                    <div class="description">${description.replace(/\n/g, '<br>')}</div>
                    <div class="mt-4">
                        <button class="btn btn-secondary" onclick="goBackOrHome()">Quay lại</button> 
                        <a href="${tikiSearchUrl}" target="_blank" class="btn btn-primary ms-2">
                            <i class="fas fa-shopping-cart"></i> Mua trên Tiki
                        </a>
                    </div>
                </div>
            </div>`;
        
        showPage('book-detail');

    } catch (error) {
        console.error("Lỗi khi hiển thị chi tiết sách:", error);
        showToast('Không thể tải chi tiết sách.', 'error');
        goBackOrHome();
    } finally {
        showLoader(false);
    }
}

function goBackOrHome() {
    // Simple implementation: always go home, safer fallback
    showPage(auth.currentUser ? 'home' : 'about'); 
}


// --- FEEDBACK MANAGEMENT with FIREBASE ---
async function handleFeedbackSubmit(event) {
    event.preventDefault();
     if (!DOM.feedbackForm) return; // Check if form exists
    const button = event.target.querySelector('button[type="submit"]');
    setButtonLoading(button, true);

    const feedbackData = {
        name: DOM.feedbackForm.querySelector('#name').value,
        email: DOM.feedbackForm.querySelector('#email').value,
        message: DOM.feedbackForm.querySelector('#message').value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        user: auth.currentUser ? auth.currentUser.email : "Guest"
    };

    try {
        await db.collection("feedbacks").add(feedbackData);
        showToast('Cảm ơn bạn đã gửi phản hồi!', 'success');
        event.target.reset();
        showPage('home'); // Redirect after feedback
    } catch (error) {
        console.error("Lỗi khi gửi feedback:", error);
        showToast('Đã xảy ra lỗi khi gửi. Vui lòng thử lại.', 'error');
    } finally {
        setButtonLoading(button, false);
    }
}

async function displayFeedbacks() {
    if (!DOM.feedbackList) return;
    DOM.feedbackList.innerHTML = ''; // Clear previous
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
            card.innerHTML = `<div class="card-header">${fb.name} - ${fb.email} (${fb.createdAt?.toDate().toLocaleString('vi-VN') || 'N/A'})</div><div class="card-body"><p class="card-text">${fb.message.replace(/\n/g, '<br>')}</p></div>`; // Preserve line breaks
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
    if (button.dataset.originalText === undefined) { // Store original only once
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
        // Create user document in Firestore immediately
        await db.collection("users").doc(userCredential.user.uid).set({
            username: username,
            email: email,
            role: "user" // Default role
        });
        showToast('Đăng ký thành công!', 'success');
        toggleAuth(); // Switch to login form
    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        showToast(`Lỗi đăng ký: ${error.message}`, 'error'); // Show Firebase error message
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
        // onAuthStateChanged will handle UI updates and redirection
    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        showToast(`Lỗi đăng nhập: ${error.message}`, 'error');
    } finally {
        setButtonLoading(button, false);
    }
}

async function handleGoogleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        showToast('Đăng nhập với Google thành công!', 'success');
        // onAuthStateChanged will handle user creation in Firestore if needed
    } catch (error) {
        console.error("Lỗi đăng nhập Google:", error);
        showToast(`Lỗi Google: ${error.message}`, 'error');
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    const emailInput = form.querySelector('#forgot-password-email');
    if (!emailInput) return; // Safety check
    const email = emailInput.value;


    setButtonLoading(button, true, "Đang gửi...");

    try {
        await auth.sendPasswordResetEmail(email);
        showToast('Email hướng dẫn đã được gửi! Vui lòng kiểm tra hòm thư (kể cả spam).', 'success', 5000); // Longer duration
        form.reset();
        showPage('register'); // Go back to login
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
    const newPasswordInput = form.querySelector('#new-password');
    const confirmPasswordInput = form.querySelector('#confirm-new-password');
    if(!newPasswordInput || !confirmPasswordInput) return; // Safety check

    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;


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
            setButtonLoading(button, false); // Stop loading if no user
            return; 
        }
        await user.updatePassword(newPassword);
        showToast('Đổi mật khẩu thành công!', 'success');
        form.reset();
    } catch (error) {
        console.error("Lỗi đổi mật khẩu:", error);
        if (error.code === 'auth/requires-recent-login') {
            showToast('Để bảo mật, vui lòng đăng xuất và đăng nhập lại trước khi đổi mật khẩu.', 'error', 5000);
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
    // onAuthStateChanged will handle UI updates and redirection
}

auth.onAuthStateChanged(async user => {
    if (user) {
        // User is signed in.
        const userDocRef = db.collection("users").doc(user.uid);
        let userDoc = await userDocRef.get();
        let userData;

        if (!userDoc.exists) {
            // If user logged in via Google/other provider for the first time
            console.log("Creating Firestore user document for new provider login:", user.uid);
            const newUser = {
                username: user.displayName || user.email.split('@')[0], // Use display name or part of email
                email: user.email,
                role: "user" // Default role
            };
            try {
                await userDocRef.set(newUser);
                userData = newUser; // Use the newly created data
                 window.currentUserRole = userData.role; // Set role immediately
            } catch (error) {
                 console.error("Error creating Firestore user doc:", error);
                 showToast("Lỗi khi tạo dữ liệu người dùng. Vui lòng thử đăng nhập lại.", "error");
                 handleLogout(); // Log out if Firestore write fails
                 return;
            }
        } else {
             userData = userDoc.data();
             // Ensure userData exists before trying to access role
             if (!userData) {
                 console.error("User document exists but data is missing for user:", user.uid);
                 showToast("Lỗi: Không thể tải dữ liệu người dùng. Vui lòng đăng nhập lại.", "error");
                 handleLogout();
                 return;
             }
             window.currentUserRole = userData.role; // Set role from existing data
        }

        updateUIForUser(userData);
        // Load initial data and potentially navigate
        initializeApp(true).then(() => {
            // Navigate to home only if user was previously logged out or on specific pages
            if (!currentPageId || ['landing', 'register', 'about', 'forgot-password'].includes(currentPageId)) {
                showPage('home');
            }
        });
        
    } else {
        // User is signed out.
        window.currentUserRole = null; // Clear role
        updateUIForGuest();
    }
});

function updateUIForUser(userData) {
    const aboutLink = document.getElementById('about-link-li');
    const homeLink = document.getElementById('home-link-li');
    const forumLink = document.getElementById('forum-link-li');
    const myBooksLink = document.getElementById('my-books-link-li'); 

    if (aboutLink) aboutLink.classList.add('truly-hidden');
    if (homeLink) homeLink.classList.remove('truly-hidden');
    if (forumLink) forumLink.classList.remove('truly-hidden');
    if (myBooksLink) myBooksLink.classList.remove('truly-hidden'); 

    if (DOM.searchForm) DOM.searchForm.classList.remove('truly-hidden');
    if (DOM.loginLink) DOM.loginLink.classList.add('truly-hidden');
    if (DOM.userInfo) DOM.userInfo.classList.remove('truly-hidden');
    
    // Update dropdown text with icon
    if (DOM.userDropdown) {
        DOM.userDropdown.innerHTML = `<i class="fas fa-user me-1"></i> Chào, ${userData.username}`;
    }

    const isAdmin = userData.role === 'admin';
    window.currentUserRole = isAdmin ? 'admin' : 'user'; // Ensure role is set correctly
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('truly-hidden', !isAdmin));
    if (DOM.inboxLink) DOM.inboxLink.classList.toggle('truly-hidden', !isAdmin);
    if (DOM.submitFeedbackLink) DOM.submitFeedbackLink.classList.remove('truly-hidden'); // Users can always submit feedback
    if (DOM.manageUserBooksLink) DOM.manageUserBooksLink.classList.toggle('truly-hidden', !isAdmin); 

    ['landing', 'register', 'forgot-password', 'about'].forEach(id => {
        const page = document.getElementById(id);
        if (page) page.classList.add('truly-hidden');
    });
}

function updateUIForGuest() {
    const aboutLink = document.getElementById('about-link-li');
    const homeLink = document.getElementById('home-link-li');
    const forumLink = document.getElementById('forum-link-li');
    const myBooksLink = document.getElementById('my-books-link-li'); 

    if (aboutLink) aboutLink.classList.remove('truly-hidden');
    if (homeLink) homeLink.classList.add('truly-hidden');
    if (forumLink) forumLink.classList.add('truly-hidden');
    if (myBooksLink) myBooksLink.classList.add('truly-hidden'); 

    if (DOM.searchForm) DOM.searchForm.classList.add('truly-hidden');
    if (DOM.loginLink) DOM.loginLink.classList.remove('truly-hidden');
    if (DOM.userInfo) DOM.userInfo.classList.add('truly-hidden');
    
    document.querySelectorAll('.admin-only, #inbox-link, #add-book-link, #manage-user-books-link').forEach(el => {
         if(el) el.classList.add('truly-hidden'); // Add null check
    }); 
    if (DOM.submitFeedbackLink) DOM.submitFeedbackLink.classList.add('truly-hidden'); // Hide feedback for guests
    
    // Hide all main content sections, show 'about'
    ['home', 'browse', 'book-detail', 'settings', 'submit-feedback', 'feedback-inbox', 'manage-books', 'forgot-password', 'register', 'landing', 'forum', 'post-detail', 'manage-users', 'my-books'].forEach(id => {
        const page = document.getElementById(id);
        if (page) {
            page.classList.add('hidden');
            page.classList.add('truly-hidden');
        }
    });

    showPage('about'); // Show the about page by default for guests
    currentPageId = 'about'; // Explicitly set current page for guests
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
        } else {
             console.warn("User settings: Firestore document not found for user", auth.currentUser.uid);
        }
    }).catch(error => {
         console.error("Error fetching user settings:", error);
    });

    const currentTheme = localStorage.getItem('bookstore_theme') || 'light';
    const darkThemeRadio = document.getElementById('darkThemeRadio');
    const lightThemeRadio = document.getElementById('lightThemeRadio');
    if (darkThemeRadio && lightThemeRadio) {
        try { // Add try-catch in case elements are missing briefly during page transition
             document.getElementById(currentTheme === 'dark' ? 'darkThemeRadio' : 'lightThemeRadio').checked = true;
        } catch(e){}
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
            setButtonLoading(button, false); // Stop loading on incorrect code
            return; // Exit early
        }

        const userRef = db.collection("users").doc(auth.currentUser.uid);
        await userRef.update({ role: "admin" });

        window.currentUserRole = 'admin'; // Update role immediately
        showToast('Nâng cấp tài khoản thành Admin thành công!', 'success');

        const updatedUserData = (await userRef.get()).data();
        updateUIForUser(updatedUserData); // Refresh UI elements based on new role
        displayUserSettings(); // Refresh settings page display
        
    } catch (error) {
        showToast('Đã xảy ra lỗi khi nâng cấp.', 'error');
        console.error("Lỗi nâng cấp admin:", error);
    } finally {
        // Ensure loading always stops, even if validation fails early
        if (button.disabled) { 
            setButtonLoading(button, false);
        }
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
    if (!DOM.homeBooks) return; // Don't run if home isn't ready
    const cachedBooks = JSON.parse(localStorage.getItem('api_cache') || '[]');
    try {
        if (fetchNew || cachedBooks.length === 0) {
            const featuredBooks = await searchBooksAPI('vietnamese literature'); // Or another default search
            localStorage.setItem('api_cache', JSON.stringify(featuredBooks));
            displayBooks(featuredBooks, DOM.homeBooks);
        } else {
            displayBooks(cachedBooks, DOM.homeBooks);
        }
    } catch (error) {
        console.error("Error initializing app books:", error);
        // Maybe display a fallback message
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (DOM.themeToggleButton) DOM.themeToggleButton.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('bookstore_theme', theme);
}

// --- SEARCH SUGGESTION FUNCTIONS ---
function getSearchHistory() {
    try {
        return JSON.parse(localStorage.getItem('bookstore_searchHistory')) || [];
    } catch (e) {
        console.error("Error reading search history:", e);
        return [];
    }
}

function saveSearchHistory(query) {
    if (!query) return; // Don't save empty queries
    try {
        let history = getSearchHistory();
        history = history.filter(item => item !== query); // Remove duplicates
        history.unshift(query); // Add to the beginning
        const limitedHistory = history.slice(0, 5); // Keep only the last 5
        localStorage.setItem('bookstore_searchHistory', JSON.stringify(limitedHistory));
    } catch (e) {
        console.error("Error saving search history:", e);
    }
}

function displaySuggestions(term = '') {
    if (!DOM.searchSuggestions) return;

    const history = getSearchHistory();
    let suggestions = [];

    if (term === '') { // Show only history if input is empty
        suggestions = history;
    } else { // Filter history and popular keywords
        const lowerCaseTerm = term.toLowerCase();
        const historyMatches = history.filter(item => item.toLowerCase().includes(lowerCaseTerm));
        const popularMatches = POPULAR_KEYWORDS.filter(item => item.toLowerCase().includes(lowerCaseTerm) && !historyMatches.includes(item)); // Avoid duplicates from history
        suggestions = [...historyMatches, ...popularMatches];
    }

    if (suggestions.length === 0) {
        DOM.searchSuggestions.classList.add('truly-hidden');
        return;
    }

    DOM.searchSuggestions.innerHTML = suggestions.map(item => `
        <div class="suggestion-item">
            <span><i class="fas ${history.includes(item) ? 'fa-history' : 'fa-search'} history-icon"></i> ${item}</span>
        </div>
    `).join(''); // Use history or search icon
    DOM.searchSuggestions.classList.remove('truly-hidden');

    // Add click listeners to suggestions
    document.querySelectorAll('#search-suggestions .suggestion-item').forEach(el => {
        el.addEventListener('click', () => {
             // Extract text correctly, removing the icon part if needed
            const query = el.querySelector('span').textContent.trim(); 
            if (DOM.searchInput) DOM.searchInput.value = query;
            if (DOM.searchSuggestions) DOM.searchSuggestions.classList.add('truly-hidden');
            performSearch(query); // Trigger search immediately
        });
    });
}

async function performSearch(query) {
    if (query) {
        saveSearchHistory(query); // Save the search term
        if (DOM.browseTitle) DOM.browseTitle.innerText = `Kết quả cho "${query}"`;
        const books = await searchBooksAPI(query);
        displayBooks(books, DOM.browseBooks);
        showPage('browse'); // Navigate to results page
    }
}
// END SEARCH SUGGESTION FUNCTIONS

// --- FORUM FUNCTIONS ---
async function handlePostSubmit(event) {
    event.preventDefault();
    if (!auth.currentUser || !DOM.postForm) return showToast('Bạn cần đăng nhập để đăng bài!', 'error');

    const button = event.target.querySelector('button[type="submit"]');
    setButtonLoading(button, true);

    const titleInput = DOM.postForm.querySelector('#post-title');
    const contentInput = DOM.postForm.querySelector('#post-content');
    if(!titleInput || !contentInput) return; // Safety check

    const title = titleInput.value;
    const content = contentInput.value;


    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        if (!userDoc.exists) throw new Error("User document not found");
        const username = userDoc.data().username;

        await db.collection('forum_posts').add({
            title,
            content,
            authorId: auth.currentUser.uid,
            authorUsername: username,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Đăng bài thành công!', 'success');
        DOM.postForm.reset();
        displayForumPosts(); // Refresh the list
    } catch (error) {
        console.error("Lỗi khi đăng bài:", error);
        showToast('Đã có lỗi xảy ra khi đăng bài.', 'error');
    } finally {
        setButtonLoading(button, false);
    }
}

async function displayForumPosts() {
    if (!DOM.forumPostsList) return;
    DOM.forumPostsList.innerHTML = ''; // Clear previous
    showLoader(true);

    try {
        const snapshot = await db.collection('forum_posts').orderBy('createdAt', 'desc').limit(20).get(); // Limit results for performance
        if (snapshot.empty) {
            DOM.forumPostsList.innerHTML = '<p class="text-center">Chưa có bài viết nào. Hãy là người đầu tiên!</p>';
            return;
        }
        snapshot.forEach(doc => {
            const post = doc.data();
            const postElement = document.createElement('div');
            postElement.className = 'forum-post-item';
            postElement.setAttribute('onclick', `showPostDetail('${doc.id}')`);
            postElement.innerHTML = `
                <h5>${post.title}</h5>
                <p class="post-meta">bởi ${post.authorUsername} • ${post.createdAt?.toDate().toLocaleDateString('vi-VN') || 'Vừa xong'}</p>
            `;
            DOM.forumPostsList.appendChild(postElement);
        });
    } catch (error) {
        console.error("Lỗi tải bài viết diễn đàn:", error);
        showToast('Không thể tải danh sách bài viết.', 'error');
    } finally {
        showLoader(false);
    }
}

async function showPostDetail(postId) {
    if (!DOM.postDetailContent) return;
    DOM.postDetailContent.innerHTML = ''; // Clear previous
    showLoader(true);

    try {
        const postRef = db.collection('forum_posts').doc(postId);
        const commentsRef = postRef.collection('comments').orderBy('createdAt', 'asc');
        
        // Fetch post and comments concurrently
        const [postDoc, commentsSnapshot] = await Promise.all([
            postRef.get(), 
            commentsRef.get()
        ]);

        if (!postDoc.exists) {
            showToast('Không tìm thấy bài viết này.', 'error');
            return showPage('forum'); // Go back to forum list
        }

        const post = postDoc.data();
        let html = `
            <button class="btn btn-sm btn-secondary mb-4" onclick="showPage('forum')">← Quay lại Diễn đàn</button>
            <h2>${post.title}</h2>
            <p class="post-meta">bởi ${post.authorUsername} • ${post.createdAt?.toDate().toLocaleString('vi-VN') || 'N/A'}</p>
            <div class="post-content">${post.content.replace(/\n/g, '<br>')}</div>
            <div class="comments-section"><h4>Bình luận</h4>`;

        if (commentsSnapshot.empty) {
            html += '<p>Chưa có bình luận nào.</p>';
        } else {
            commentsSnapshot.forEach(doc => {
                const comment = doc.data();
                html += `<div class="comment-item"><p class="comment-author">${comment.authorUsername}</p><p class="comment-text">${comment.text.replace(/\n/g, '<br>')}</p></div>`;
            });
        }

        // Add comment form only if user is logged in
        if(auth.currentUser){
            html += `
                <form id="comment-form" class="mt-4">
                    <div class="mb-3"><textarea class="form-control" id="comment-text" rows="3" placeholder="Viết bình luận của bạn..." required></textarea></div>
                    <button type="submit" class="btn btn-primary">Gửi bình luận</button>
                </form>
            </div>`; // Close comments-section div
        } else {
             html += `<p class="mt-3 text-muted">Vui lòng <a href="#" onclick="showPage('register')">đăng nhập</a> để bình luận.</p></div>`; // Close comments-section div
        }
        
        DOM.postDetailContent.innerHTML = html;
        
        // Add event listener only if the form exists
        const commentForm = document.getElementById('comment-form');
        if (commentForm) { 
             commentForm.addEventListener('submit', (e) => handleCommentSubmit(e, postId));
        }
        
        showPage('post-detail'); // Show the page after content is ready

    } catch (error) {
        console.error("Lỗi tải chi tiết bài viết:", error);
        showToast('Không thể tải bài viết.', 'error');
    } finally {
        showLoader(false);
    }
}

async function handleCommentSubmit(event, postId) {
    event.preventDefault();
    if (!auth.currentUser) return showToast('Bạn cần đăng nhập để bình luận!', 'error');

    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    setButtonLoading(button, true);
    
    const textInput = form.querySelector('#comment-text');
    if(!textInput) return; // Safety check
    const text = textInput.value;

    if (!text.trim()) { // Basic validation
         showToast('Vui lòng nhập nội dung bình luận.', 'error');
         setButtonLoading(button, false);
         return;
    }

    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        if (!userDoc.exists) throw new Error("User document not found");
        const username = userDoc.data().username;

        await db.collection('forum_posts').doc(postId).collection('comments').add({
            text,
            authorId: auth.currentUser.uid,
            authorUsername: username,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Refresh the post detail view to show the new comment
        showPostDetail(postId); 
    } catch (error) {
        console.error("Lỗi gửi bình luận:", error);
        showToast('Không thể gửi bình luận.', 'error');
        setButtonLoading(button, false); // Ensure loading stops on error
    } 
    // No finally needed here as showPostDetail has its own loading management
}
// END FORUM FUNCTIONS

// --- USER MANAGEMENT FUNCTIONS ---
async function displayUsers() {
    if (!DOM.usersListTbody) return;
    DOM.usersListTbody.innerHTML = ''; // Clear previous
    showLoader(true);

    try {
        const snapshot = await db.collection('users').get();
        snapshot.forEach(doc => {
            const user = doc.data();
             // Basic check if user data is valid
            if (!user || !user.username || !user.email || !user.role) {
                console.warn("Skipping invalid user data:", doc.id, user);
                return; 
            }
            const isCurrentUser = auth.currentUser && auth.currentUser.uid === doc.id;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td><span class="badge bg-${user.role === 'admin' ? 'success' : 'secondary'}">${user.role}</span></td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editUser('${doc.id}', '${user.username}', '${user.email}', '${user.role}')">Sửa</button>
                    <button class="btn btn-sm btn-danger" ${isCurrentUser ? 'disabled title="Không thể xóa chính mình"' : ''} onclick="deleteUser('${doc.id}', '${user.username}')">Xóa</button>
                </td>
            `;
            DOM.usersListTbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Lỗi khi tải danh sách người dùng:", error);
        showToast('Không thể tải danh sách người dùng.', 'error');
    } finally {
        showLoader(false);
    }
}

function editUser(id, username, email, role) {
    if (!DOM.userForm) return;
    // Ensure input elements exist before accessing value
    const idInput = DOM.userForm.querySelector('#user-id-input');
    const usernameInput = DOM.userForm.querySelector('#user-username-input');
    const emailInput = DOM.userForm.querySelector('#user-email-input');
    const passwordInput = DOM.userForm.querySelector('#user-password-input');
    const roleSelect = DOM.userForm.querySelector('#user-role-select');

    if (idInput) idInput.value = id;
    if (usernameInput) usernameInput.value = username;
    if (emailInput) {
        emailInput.value = email;
        emailInput.disabled = true; // Cannot change email via this form
    }
    if (passwordInput) {
        passwordInput.value = ''; // Clear password field for editing
        passwordInput.placeholder = 'Để trống nếu không đổi';
    }
    if (roleSelect) roleSelect.value = role;
    
    window.scrollTo(0, 0); // Scroll to top
}

async function deleteUser(id, username) {
     if (!confirm(`Bạn có chắc chắn muốn xóa người dùng "${username}" không?\n\nLƯU Ý: Hành động này chỉ xóa dữ liệu trong Firestore. Tài khoản đăng nhập (Authentication) cần được xóa riêng (thường yêu cầu Admin SDK).`)) {
        return;
    }

    try {
        await db.collection('users').doc(id).delete();
        showToast('Xóa dữ liệu người dùng Firestore thành công!', 'success');
        displayUsers(); // Refresh the list
    } catch (error) {
        console.error("Lỗi khi xóa người dùng:", error);
        showToast('Không thể xóa dữ liệu người dùng. Vui lòng thử lại.', 'error');
    }
}

function clearUserForm() {
    if (!DOM.userForm) return;
    DOM.userForm.reset();
    const idInput = DOM.userForm.querySelector('#user-id-input');
    const emailInput = DOM.userForm.querySelector('#user-email-input');
    const passwordInput = DOM.userForm.querySelector('#user-password-input');

    if(idInput) idInput.value = '';
    if(emailInput) emailInput.disabled = false;
    if(passwordInput) passwordInput.placeholder = 'Ít nhất 6 ký tự';
}

async function handleUserFormSubmit(event) {
    event.preventDefault();
    if (!DOM.userForm) return;
    const button = event.target.querySelector('button[type="submit"]');
    setButtonLoading(button, true);

    // Get form elements safely
    const userIdInput = DOM.userForm.querySelector('#user-id-input');
    const usernameInput = DOM.userForm.querySelector('#user-username-input');
    const emailInput = DOM.userForm.querySelector('#user-email-input');
    const roleSelect = DOM.userForm.querySelector('#user-role-select');
    if(!userIdInput || !usernameInput || !emailInput || !roleSelect) return; // Safety check

    const userId = userIdInput.value;
    const username = usernameInput.value;
    const email = emailInput.value;
    const role = roleSelect.value;
    // Password should not be handled here

    try {
        if (userId) { // --- UPDATE EXISTING USER (Role and Username only) ---
            const userRef = db.collection('users').doc(userId);
            await userRef.update({ username, role });
            showToast('Cập nhật thông tin người dùng thành công!', 'success');
        } else { // --- CREATE NEW USER (Firestore data only) ---
             if (!username || !email ) {
                 showToast('Vui lòng nhập tên người dùng và email.', 'error');
                 setButtonLoading(button, false); // Stop loading on validation error
                 return;
             }
             // Check if email already exists in Firestore (basic check)
             const existingUser = await db.collection('users').where('email', '==', email).limit(1).get();
             if (!existingUser.empty) {
                 showToast('Email này đã tồn tại trong Firestore.', 'error');
                 setButtonLoading(button, false);
                 return;
             }
             
             // Add user data to Firestore. Auth account creation requires Admin SDK.
             const newUserRef = await db.collection('users').add({ 
                 username, 
                 email, 
                 role, 
                 createdAt: firebase.firestore.FieldValue.serverTimestamp() // Add creation time
             }); 
             showToast(`Tạo bản ghi người dùng mới ${username} thành công! Lưu ý: Chưa tạo tài khoản đăng nhập.`, 'success', 5000);
        }
        clearUserForm();
        displayUsers(); // Refresh the user list
    } catch (error) {
        console.error("Lỗi khi lưu người dùng:", error);
        showToast('Đã có lỗi xảy ra khi lưu người dùng.', 'error');
    } finally {
        // Ensure loading always stops, even if validation fails early
        if (button && button.disabled) { // Check if button exists before accessing disabled
            setButtonLoading(button, false);
        }
    }
}
// END USER MANAGEMENT FUNCTIONS


// --- USER BOOK MANAGEMENT FUNCTIONS (Firestore) ---
async function displayMyBooks() {
    if (!DOM.myBooksListTbody || !auth.currentUser) return;
    DOM.myBooksListTbody.innerHTML = ''; // Clear previous
    showLoader(true);

    try {
        // Query user's books, order locally if needed after fetch
        const snapshot = await db.collection('user_books')
                                .where('addedByUserId', '==', auth.currentUser.uid)
                                // .orderBy('createdAt', 'desc') // Removed due to potential index/permission issues
                                .get();
        if (snapshot.empty) {
            DOM.myBooksListTbody.innerHTML = '<tr><td colspan="4" class="text-center">Bạn chưa thêm sách nào.</td></tr>';
            return;
        }

        // Process and sort data client-side if orderBy was removed
        let booksData = [];
        snapshot.forEach(doc => {
            booksData.push({ id: doc.id, ...doc.data() });
        });
        // Sort manually by creation date (descending)
        booksData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); 

        booksData.forEach(book => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${book.title}</td>
                <td>${book.authors || 'N/A'}</td>
                <td>${book.createdAt?.toDate().toLocaleDateString('vi-VN') || 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editMyBook('${book.id}')">Sửa</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteMyBook('${book.id}', '${book.title}')">Xóa</button>
                </td>
            `;
            DOM.myBooksListTbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Lỗi khi tải sách của tôi:", error);
        // Provide more specific error if permission denied
        if (error.code === 'permission-denied' || (error.message && error.message.includes('permission'))) {
             showToast('Lỗi quyền truy cập khi tải sách. Vui lòng kiểm tra Quy tắc Bảo mật Firestore.', 'error', 5000);
        } else {
             showToast('Không thể tải danh sách sách của bạn.', 'error');
        }
    } finally {
        showLoader(false);
    }
}


async function editMyBook(bookId) {
    if (!DOM.myBookForm || !auth.currentUser) return;
    showLoader(true);
    try {
        const bookDoc = await db.collection('user_books').doc(bookId).get();
        if (bookDoc.exists) {
            const bookData = bookDoc.data();
            // Double-check ownership on client-side (although rules enforce it)
            if (bookData.addedByUserId !== auth.currentUser.uid) {
                 showToast('Bạn không có quyền sửa sách này.', 'error');
                 return;
            }
            // Safely access form elements
            const idInput = DOM.myBookForm.querySelector('#my-book-id-input');
            const titleInput = DOM.myBookForm.querySelector('#my-book-title-input');
            const authorInput = DOM.myBookForm.querySelector('#my-book-author-input');
            const coverInput = DOM.myBookForm.querySelector('#my-book-cover-input');
            const descInput = DOM.myBookForm.querySelector('#my-book-desc-input');

            if(idInput) idInput.value = bookId;
            if(titleInput) titleInput.value = bookData.title;
            if(authorInput) authorInput.value = bookData.authors || '';
            if(coverInput) coverInput.value = bookData.coverUrl || '';
            if(descInput) descInput.value = bookData.description || '';
            
            window.scrollTo(0, 0); // Scroll to top of page
        } else {
            showToast('Không tìm thấy sách để sửa.', 'error');
        }
    } catch(error) {
        console.error("Lỗi khi tải sách để sửa:", error);
        showToast('Có lỗi xảy ra khi tải sách.', 'error');
    } finally {
        showLoader(false);
    }
}

async function deleteMyBook(bookId, title) {
     if (!confirm(`Bạn có chắc chắn muốn xóa sách "${title}" không?`)) {
        return;
    }
    if (!auth.currentUser) return; // Should not happen if button is visible, but safety check
    
    showLoader(true);
    try {
         const bookRef = db.collection('user_books').doc(bookId);
         const bookDoc = await bookRef.get();
         // Verify ownership before deleting
         if (bookDoc.exists && bookDoc.data().addedByUserId === auth.currentUser.uid) {
            await bookRef.delete();
            showToast('Xóa sách thành công!', 'success');
            displayMyBooks(); // Refresh the list
            clearMyBookForm(); // Clear the form in case it held the deleted book's data
         } else {
             showToast('Bạn không có quyền xóa sách này hoặc sách không tồn tại.', 'error');
         }
    } catch (error) {
        console.error("Lỗi khi xóa sách:", error);
        showToast('Không thể xóa sách.', 'error');
    } finally {
        showLoader(false);
    }
}

function clearMyBookForm() {
    if (!DOM.myBookForm) return;
    DOM.myBookForm.reset();
    const idInput = DOM.myBookForm.querySelector('#my-book-id-input');
    if(idInput) idInput.value = ''; 
}

async function handleMyBookFormSubmit(event) {
    event.preventDefault();
    if (!DOM.myBookForm || !auth.currentUser) return;
    const button = event.target.querySelector('button[type="submit"]');
    setButtonLoading(button, true);

    // Safely access form elements
    const idInput = DOM.myBookForm.querySelector('#my-book-id-input');
    const titleInput = DOM.myBookForm.querySelector('#my-book-title-input');
    const authorInput = DOM.myBookForm.querySelector('#my-book-author-input');
    const coverInput = DOM.myBookForm.querySelector('#my-book-cover-input');
    const descInput = DOM.myBookForm.querySelector('#my-book-desc-input');
    if (!idInput || !titleInput || !authorInput || !coverInput || !descInput) return; // Safety check


    const bookId = idInput.value;
    const title = titleInput.value;
    const authors = authorInput.value;
    const coverUrl = coverInput.value;
    const description = descInput.value;


    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        if (!userDoc.exists) throw new Error("User document not found");
        const username = userDoc.data().username;

        const bookData = {
            title,
            authors,
            coverUrl,
            description,
            addedByUserId: auth.currentUser.uid, // Always set/update owner ID
            addedByUsername: username // Always set/update owner username
        };

        if (bookId) { // --- CẬP NHẬT SÁCH ---
            const bookRef = db.collection('user_books').doc(bookId);
            const currentBookDoc = await bookRef.get();
            // Verify ownership again before update
            if(currentBookDoc.exists && currentBookDoc.data().addedByUserId === auth.currentUser.uid) {
                 bookData.lastUpdatedAt = firebase.firestore.FieldValue.serverTimestamp(); // Add update timestamp
                await bookRef.update(bookData); // Update fields
                showToast('Cập nhật sách thành công!', 'success');
            } else {
                showToast('Bạn không có quyền sửa sách này hoặc sách không tồn tại.', 'error');
            }
        } else { // --- THÊM SÁCH MỚI ---
             bookData.createdAt = firebase.firestore.FieldValue.serverTimestamp(); // Add timestamp for new books
            await db.collection('user_books').add(bookData); // Use add() for auto-generated ID
            showToast('Thêm sách mới thành công!', 'success');
        }
        clearMyBookForm(); // Clear form on success
        displayMyBooks(); // Refresh the list
    } catch (error) {
        console.error("Lỗi khi lưu sách của tôi:", error);
        showToast('Đã có lỗi xảy ra khi lưu sách.', 'error');
    } finally {
        setButtonLoading(button, false);
    }
}

// --- ADMIN BOOK MANAGEMENT FUNCTIONS ---
async function displayAllUserBooks() {
    if (!DOM.allUserBooksTbody) return;
    DOM.allUserBooksTbody.innerHTML = ''; // Clear previous
    showLoader(true);

    try {
        const snapshot = await db.collection('user_books').orderBy('createdAt', 'desc').get(); // Admin can orderBy
        if (snapshot.empty) {
            DOM.allUserBooksTbody.innerHTML = '<tr><td colspan="5" class="text-center">Chưa có người dùng nào thêm sách.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const book = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${book.title}</td>
                <td>${book.authors || 'N/A'}</td>
                <td>${book.addedByUsername || 'Không rõ'} (${book.addedByUserId ? book.addedByUserId.substring(0,5) : 'N/A'}...)</td> 
                <td>${book.createdAt?.toDate().toLocaleDateString('vi-VN') || 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editAnyUserBook('${doc.id}')">Sửa</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteAnyUserBook('${doc.id}', '${book.title}')">Xóa</button>
                </td>
            `;
            DOM.allUserBooksTbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Lỗi khi tải tất cả sách user:", error);
         if (error.code === 'permission-denied' || (error.message && error.message.includes('permission'))) {
             showToast('Lỗi quyền truy cập khi tải sách. Vui lòng kiểm tra Quy tắc Bảo mật Firestore.', 'error', 5000);
         } else {
            showToast('Không thể tải danh sách sách.', 'error');
         }
    } finally {
        showLoader(false);
    }
}

async function editAnyUserBook(bookId) {
    if (!DOM.adminBookForm) return;
    showLoader(true);
    try {
        const bookDoc = await db.collection('user_books').doc(bookId).get();
        if (bookDoc.exists) {
            const bookData = bookDoc.data();
            // Safely access form elements
            const idInput = DOM.adminBookForm.querySelector('#admin-book-id-input');
            const titleInput = DOM.adminBookForm.querySelector('#admin-book-title-input');
            const authorInput = DOM.adminBookForm.querySelector('#admin-book-author-input');
            const coverInput = DOM.adminBookForm.querySelector('#admin-book-cover-input');
            const descInput = DOM.adminBookForm.querySelector('#admin-book-desc-input');

            if(idInput) idInput.value = bookId;
            if(titleInput) titleInput.value = bookData.title;
            if(authorInput) authorInput.value = bookData.authors || '';
            if(coverInput) coverInput.value = bookData.coverUrl || '';
            if(descInput) descInput.value = bookData.description || '';
            
            window.scrollTo(0, 0); // Scroll to top
        } else {
            showToast('Không tìm thấy sách để sửa.', 'error');
        }
    } catch(error) {
        console.error("Lỗi khi tải sách để admin sửa:", error);
        showToast('Có lỗi xảy ra khi tải sách.', 'error');
    } finally {
        showLoader(false);
    }
}

async function deleteAnyUserBook(bookId, title) {
     if (!confirm(`Bạn (Admin) có chắc chắn muốn xóa sách "${title}" không?`)) {
        return;
    }
    showLoader(true);
    try {
        // Admin can delete directly based on security rules
        await db.collection('user_books').doc(bookId).delete();
        showToast('Xóa sách thành công!', 'success');
        displayAllUserBooks(); // Refresh the admin list
        clearAdminBookForm(); // Clear form if it held data for the deleted book
    } catch (error) {
        console.error("Lỗi khi admin xóa sách:", error);
        showToast('Không thể xóa sách.', 'error');
    } finally {
        showLoader(false);
    }
}

function clearAdminBookForm() {
    if (!DOM.adminBookForm) return;
    DOM.adminBookForm.reset();
    const idInput = DOM.adminBookForm.querySelector('#admin-book-id-input');
    if(idInput) idInput.value = ''; 
}

async function handleAdminBookFormSubmit(event) {
    event.preventDefault();
    if (!DOM.adminBookForm) return;
    const button = event.target.querySelector('button[type="submit"]');
    setButtonLoading(button, true);

    // Safely access form elements
    const idInput = DOM.adminBookForm.querySelector('#admin-book-id-input');
    const titleInput = DOM.adminBookForm.querySelector('#admin-book-title-input');
    const authorInput = DOM.adminBookForm.querySelector('#admin-book-author-input');
    const coverInput = DOM.adminBookForm.querySelector('#admin-book-cover-input');
    const descInput = DOM.adminBookForm.querySelector('#admin-book-desc-input');
     if (!idInput || !titleInput || !authorInput || !coverInput || !descInput) return; // Safety check

    const bookId = idInput.value;
    const title = titleInput.value;
    const authors = authorInput.value;
    const coverUrl = coverInput.value;
    const description = descInput.value;

    if (!bookId) {
        showToast('Vui lòng chọn sách từ bảng bên dưới để sửa.', 'error');
        setButtonLoading(button, false);
        return;
    }

    try {
        const bookRef = db.collection('user_books').doc(bookId);
        // Admin can update these fields based on security rules
        await bookRef.update({ 
             title, 
             authors, 
             coverUrl, 
             description,
             lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp() // Add update timestamp
        }); 
        showToast('Admin cập nhật sách thành công!', 'success');
        clearAdminBookForm(); // Clear the form
        displayAllUserBooks(); // Refresh the list
    } catch (error) {
        console.error("Lỗi khi admin cập nhật sách:", error);
        showToast('Đã có lỗi xảy ra khi cập nhật sách.', 'error');
    } finally {
        setButtonLoading(button, false);
    }
}
// END BOOK MANAGEMENT FUNCTIONS


function addAllEventListeners() {
    // Search form and input listeners
    if (DOM.searchForm) {
        DOM.searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if(!DOM.searchInput) return;
            const query = DOM.searchInput.value.trim();
            performSearch(query);
            if (DOM.searchSuggestions) DOM.searchSuggestions.classList.add('truly-hidden');
        });
    }
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('focus', () => displaySuggestions(DOM.searchInput.value));
        DOM.searchInput.addEventListener('input', () => displaySuggestions(DOM.searchInput.value));
    }
    document.addEventListener('click', (e) => {
        // Close suggestions if clicking outside the search form
        if (DOM.searchForm && !DOM.searchForm.contains(e.target)) {
            if (DOM.searchSuggestions) DOM.searchSuggestions.classList.add('truly-hidden');
        }
    });

    // Auth listeners
    if (DOM.registerFormElement) DOM.registerFormElement.addEventListener('submit', handleRegister);
    if (DOM.loginFormElement) DOM.loginFormElement.addEventListener('submit', handleLogin);
    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) googleBtn.addEventListener('click', handleGoogleLogin);
    if (DOM.forgotPasswordForm) DOM.forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    if (DOM.changePasswordForm) DOM.changePasswordForm.addEventListener('submit', handleChangePassword);
    
    // Feedback listener
    if (DOM.feedbackForm) DOM.feedbackForm.addEventListener('submit', handleFeedbackSubmit);
    
    // Theme listeners
    if (DOM.themeToggleButton) DOM.themeToggleButton.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
    });
    const lightRadio = document.getElementById('lightThemeRadio');
    const darkRadio = document.getElementById('darkThemeRadio');
    if (lightRadio) lightRadio.addEventListener('change', () => applyTheme('light'));
    if (darkRadio) darkRadio.addEventListener('change', () => applyTheme('dark'));
    
    // Admin upgrade listener
    if (DOM.adminUpgradeBtn) DOM.adminUpgradeBtn.addEventListener('click', handleAdminUpgrade);
    
    // Forum listener
    if (DOM.postForm) DOM.postForm.addEventListener('submit', handlePostSubmit);
    
    // User management listeners
    if (DOM.userForm) DOM.userForm.addEventListener('submit', handleUserFormSubmit);
    if (DOM.clearUserFormBtn) DOM.clearUserFormBtn.addEventListener('click', clearUserForm);

     // User Book management listeners ("My Books" page)
    if (DOM.myBookForm) DOM.myBookForm.addEventListener('submit', handleMyBookFormSubmit);
    if (DOM.clearMyBookFormBtn) DOM.clearMyBookFormBtn.addEventListener('click', clearMyBookForm); 

    // Admin Book management listeners ("Manage Books" page)
    if (DOM.adminBookForm) DOM.adminBookForm.addEventListener('submit', handleAdminBookFormSubmit); 
    if (DOM.clearAdminBookFormBtn) DOM.clearAdminBookFormBtn.addEventListener('click', clearAdminBookForm); 
}

document.addEventListener('DOMContentLoaded', () => {
    initializeDOMElements(); // Make sure elements are found first
    addAllEventListeners(); // Then add listeners
    const savedTheme = localStorage.getItem('bookstore_theme') || 'light';
    applyTheme(savedTheme);});

