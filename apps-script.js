/**
 * UNICA CLONE - GOOGLE APPS SCRIPT BACKEND
 * 
 * CÁCH CÀI ĐẶT:
 * 1. Tạo Google Sheet mới, đặt tên "Unica DB"
 * 2. Tạo 2 sheet: "Users" và "Courses"
 * 3. Sheet "Users" có headers: id, name, email, password, role, createdAt
 * 4. Sheet "Courses" có headers: id, title, image, date, time, desc, isLive, createdAt
 * 5. Mở Extensions > Apps Script, xóa code mặc định và paste toàn bộ code này
 * 6. Lưu project, tạo New Deployment > chọn "Web app"
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 7. Copy URL Web App và paste vào app.js (API_URL)
 */

const SHEET_USERS = 'Users';
const SHEET_COURSES = 'Courses';
const SECRET_KEY = 'unica-secret-key-2026-v1'; // Đổi secret key của bạn

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  try {
    const params = e.parameter;
    const endpoint = params.endpoint;
    let body = {};
    if (method === 'POST') {
      try {
        body = JSON.parse(e.postData.contents);
      } catch {
        body = {};
      }
    }

    if (endpoint === 'register') return register(body);
    if (endpoint === 'login') return login(body);
    if (endpoint === 'checkSession') return checkSession(body);
    if (endpoint === 'courses') return getCourses(body);
    if (endpoint === 'addCourse') return addCourse(body);
    if (endpoint === 'updateCourse') return updateCourse(body);
    if (endpoint === 'deleteCourse') return deleteCourse(body);

    return ContentService.createTextOutput(JSON.stringify({ error: 'Endpoint không hợp lệ' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ========== UTILS ==========
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function generateId() {
  return Utilities.getUuid();
}

function hashPassword(password) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + SECRET_KEY)
    .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function getUserRow(email) {
  const sheet = getSheet(SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === email) return { row: i + 1, user: data[i] };
  }
  return null;
}

function getToken(email) {
  const token = Utilities.getUuid() + '.' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, email + SECRET_KEY));
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return { token, expires };
}

// ========== AUTH ==========
function register(body) {
  const { name, email, password } = body;
  if (!name || !email || !password) {
    return jsonResponse({ error: 'Vui lòng nhập đầy đủ thông tin' });
  }
  if (password.length < 6) {
    return jsonResponse({ error: 'Mật khẩu tối thiểu 6 ký tự' });
  }

  const sheet = getSheet(SHEET_USERS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 6).getValues()[0];
  if (!headers.includes('id')) sheet.getRange(1, 1).setValue('id');

  const existing = getUserRow(email);
  if (existing) {
    return jsonResponse({ error: 'Email đã tồn tại' });
  }

  const newUser = [
    generateId(),
    name,
    email,
    hashPassword(password),
    'user',
    new Date().toISOString()
  ];

  sheet.appendRow(newUser);
  const { token } = getToken(email);
  return jsonResponse({ token, user: { name, email, role: 'user' } });
}

function login(body) {
  const { email, password } = body;
  if (!email || !password) {
    return jsonResponse({ error: 'Vui lòng nhập email và mật khẩu' });
  }

  const found = getUserRow(email);
  if (!found) {
    return jsonResponse({ error: 'Email hoặc mật khẩu không đúng' });
  }

  const user = found.user;
  const row = found.row;
  const hashedInput = hashPassword(password);

  if (user[3] !== hashedInput) {
    return jsonResponse({ error: 'Email hoặc mật khẩu không đúng' });
  }

  // Admin check based on email
  const role = email === 'tonyhoang.oliver@gmail.com' ? 'admin' : (user[4] || 'user');

  const { token, expires } = getToken(email);
  const tokenCol = 7;
  const userSheet = getSheet(SHEET_USERS);
  const lastCol = userSheet.getLastColumn();
  if (lastCol < tokenCol) {
    userSheet.getRange(1, tokenCol, 1, tokenCol - lastCol).setValues([Array(tokenCol - lastCol).fill('')]);
  }
  userSheet.getRange(row, tokenCol).setValue(token);

  return jsonResponse({ token, user: { id: user[0], name: user[1], email: user[2], role, expires } });
}

function checkSession(body) {
  const token = body.token;
  if (!token) return jsonResponse({ error: 'Không có token' });

  const userSheet = getSheet(SHEET_USERS);
  const data = userSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const cols = data[i];
    if (cols[6] === token) {
      const email = cols[2];
      const role = email === 'tonyhoang.oliver@gmail.com' ? 'admin' : (cols[4] || 'user');
      return jsonResponse({ user: { id: cols[0], name: cols[1], email: cols[2], role } });
    }
  }
  return jsonResponse({ error: 'Token không hợp lệ' }, 401);
}

// ========== COURSES ==========
function getCourses(body) {
  const sheet = getSheet(SHEET_COURSES);
  const data = sheet.getDataRange().getValues();
  const courses = [];
  for (let i = 1; i < data.length; i++) {
    courses.push({
      id: data[i][0],
      title: data[i][1],
      image: data[i][2],
      date: data[i][3],
      time: data[i][4],
      desc: data[i][5],
      isLive: data[i][6] === 'TRUE' || data[i][6] === true,
      createdAt: data[i][7] || ''
    });
  }
  return jsonResponse({ courses });
}

function addCourse(body) {
  const { token, title, image, date, time, desc, isLive } = body;
  if (!validateToken(token)) return jsonResponse({ error: 'Không có quyền' }, 403);

  const sheet = getSheet(SHEET_COURSES);
  const course = [
    generateId(),
    title,
    image,
    date,
    time,
    desc || '',
    isLive ? 'TRUE' : 'FALSE',
    new Date().toISOString()
  ];
  sheet.appendRow(course);
  return jsonResponse({ success: true });
}

function updateCourse(body) {
  const { token, id, title, image, date, time, desc } = body;
  if (!validateToken(token)) return jsonResponse({ error: 'Không có quyền' }, 403);

  const sheet = getSheet(SHEET_COURSES);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 2).setValue(title);
      sheet.getRange(i + 1, 3).setValue(image);
      sheet.getRange(i + 1, 4).setValue(date);
      sheet.getRange(i + 1, 5).setValue(time);
      sheet.getRange(i + 1, 6).setValue(desc || '');
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ error: 'Không tìm thấy khóa học' }, 404);
}

function deleteCourse(body) {
  const { token, id } = body;
  if (!validateToken(token)) return jsonResponse({ error: 'Không có quyền' }, 403);

  const sheet = getSheet(SHEET_COURSES);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ error: 'Không tìm thấy khóa học' }, 404);
}

function validateToken(token) {
  if (!token) return false;
  const sheet = getSheet(SHEET_USERS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const tokenCol = 7;
  if (!headers.includes('token')) {
    sheet.getRange(1, tokenCol).setValue('token');
  }
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][6] === token) return true;
  }
  return false;
}

function jsonResponse(body, code = 200) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

// Auto-init headers if sheet is empty
function initSheets() {
  const userSheet = getSheet(SHEET_USERS);
  if (userSheet.getLastRow() === 0) {
    userSheet.appendRow(['id', 'name', 'email', 'password', 'role', 'createdAt', 'token']);
  }

  const courseSheet = getSheet(SHEET_COURSES);
  if (courseSheet.getLastRow() === 0) {
    courseSheet.appendRow(['id', 'title', 'image', 'date', 'time', 'desc', 'isLive', 'createdAt']);
  }
}
