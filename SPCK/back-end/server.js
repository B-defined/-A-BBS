// File: backend/server.js

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Dữ liệu giả lập (thay thế cho database thật)
let users = [];

app.use(cors());
app.use(express.json());

// --- API Endpoint để Đăng ký ---
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    console.log('Đã nhận yêu cầu đăng ký cho email:', email);

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin.' });
    }
    if (users.find(user => user.email === email)) {
        return res.status(409).json({ message: 'Email này đã được sử dụng.' });
    }

    const newUser = { id: Date.now(), username, email, password, role: 'user' };
    users.push(newUser);
    console.log('Người dùng mới đã được tạo:', newUser);
    console.log('Tất cả người dùng hiện tại:', users);
    res.status(201).json({ message: 'Đăng ký thành công!' });
});


// --- API ENDPOINT MỚI: Đăng nhập ---
app.post('/api/login', (req, res) => {
    // Lấy email và mật khẩu từ front-end gửi lên
    const { email, password } = req.body;
    console.log('Đã nhận yêu cầu đăng nhập cho email:', email);

    // Tìm người dùng trong mảng dữ liệu giả
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        // Nếu tìm thấy, trả về thành công và thông tin người dùng (trừ mật khẩu)
        console.log('Đăng nhập thành công:', user.email);
        const userInfo = {
            username: user.username,
            email: user.email,
            role: user.role
        };
        res.status(200).json({ message: 'Đăng nhập thành công!', user: userInfo });
    } else {
        // Nếu không tìm thấy, trả về lỗi
        console.log('Đăng nhập thất bại:', email);
        res.status(401).json({ message: 'Sai email hoặc mật khẩu.' });
    }
});


app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});