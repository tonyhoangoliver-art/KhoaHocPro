# HƯỚNG DẪN CÀI ĐẶT UNICA CLONE VỚI GOOGLE SHEET + APPS SCRIPT

## 1. Tạo Google Sheet
1. Truy cập https://sheets.google.com và tạo sheet mới tên **"Unica DB"**
2. Tạo 2 sheet với tên chính xác:
   - Sheet 1: `Users` (người dùng đăng ký/đăng nhập)
   - Sheet 2: `Courses` (khóa học)
3. Sheet `Users`: thêm hàng đầu (header) với các cột:
   `id | name | email | password | role | createdAt | token`
4. Sheet `Courses`: thêm hàng đầu (header):
   `id | title | image | date | time | desc | isLive | createdAt`

## 2. Tạo Google Apps Script
1. Mở sheet "Unica DB" vừa tạo
2. Vào menu **Extensions > Apps Script**
3. Xóa toàn bộ code mặc định trong `Code.gs`
4. Copy toàn bộ nội dung file `apps-script.js` của project này và paste vào
5. Nhấn **Save** (Ctrl+S), đặt tên project (ví dụ: "Unica API")
6. Nhấn **Deploy > New deployment**
7. Chọn loại: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Nhấn **Deploy**, copy URL Web App (dạng `https://script.google.com/macros/s/.../exec`)

## 3. Cấu hình Frontend
1. Mở file `app.js` trong project
2. Sửa biến `API_URL` thành URL Web App vừa copy:
   ```javascript
   const API_URL = 'https://script.google.com/macros/s/XXXXX/exec';
   ```
3. Sửa `ADMIN_EMAIL` thành email admin của bạn:
   ```javascript
   const ADMIN_EMAIL = 'admin@gmail.com';
   ```
4. Lưu file

## 4. Chạy thử
1. Mở `index.html` trong trình duyệt
2. Nhấn **Đăng nhập**, chuyển sang tab **Đăng ký** để tạo tài khoản
3. Đăng nhập bằng tài khoản admin để truy cập chức năng quản trị

## Tính năng
- Đăng ký / Đăng nhập / Đăng xuất
- Quản lý khóa học (Thêm / Sửa / Xóa) dành cho admin
- Dữ liệu đồng bộ qua Google Sheet
- Fallback localStorage nếu API offline
- Admin chỉ có quyền quản trị khi email trùng với `ADMIN_EMAIL`

## Lưu ý
- Apps Script có giới hạn: 20,000 request/ngày, timeout 30s/request
- Mật khẩu được hash SHA-256 trước khi lưu vào sheet
- Token hết hạn sau 7 ngày
- Sheet phải được chia sẻ quyền "Editor" cho tài khoản Apps Script sử dụng
