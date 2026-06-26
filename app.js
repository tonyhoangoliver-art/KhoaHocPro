// ========== CONFIG ==========
const API_URL = 'https://script.google.com/macros/s/AKfycbzvbBl8dbMIJBGp1P4Aw6FPbucmc-BFLXkdok6tFbdnZumEomTtyA-OlkS_1NW6LT6z/exec'; // TODO: Thay bằng URL Web App thực tế
const ADMIN_EMAIL = 'tonyhoang.oliver@gmail.com'; // TODO: Đổi email admin của bạn

// ========== STATE ==========
let currentUser = null;
let authToken = null;
let courses = [];

// ========== DOM REFS ==========
const coursesGrid = document.getElementById('coursesGrid');
const adminSection = document.getElementById('adminSection');
const adminTableBody = document.getElementById('adminTableBody');
const modal = document.getElementById('courseModal');
const courseForm = document.getElementById('courseForm');
const authModal = document.getElementById('authModal');
const authArea = document.getElementById('authArea');
const userArea = document.getElementById('userArea');
const userName = document.getElementById('userName');

// ========== AUTH ==========
function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': 'Bearer ' + authToken } : {})
  };
}

async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: getAuthHeaders()
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(`${API_URL}?endpoint=${endpoint}`, options);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text || 'Phản hồi không hợp lệ từ máy chủ' };
    }
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Lỗi kết nối: ' + res.status);
    }
    return data;
  } catch (err) {
    console.error('API Error:', err);
    showToast(err.message || 'Không thể kết nối đến máy chủ');
    throw err;
  }
}

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function openAuthModal(tab = 'login') {
  authModal.classList.remove('hidden');
  switchAuthTab(tab);
}

function closeAuthModal() {
  authModal.classList.add('hidden');
}

function switchAuthTab(tab) {
  const tabs = document.querySelectorAll('.auth-tab');
  tabs.forEach(t => t.classList.remove('active'));
  if (tab === 'login') {
    tabs[0].classList.add('active');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
  } else {
    tabs[1].classList.add('active');
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
  }
}

async function register(event) {
  event.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirmPassword').value;

  if (password !== confirm) {
    showToast('Mật khẩu xác nhận không khớp');
    return;
  }

  try {
    const data = await apiCall('register', 'POST', { name, email, password });
    showToast('Đăng ký thành công! Vui lòng đăng nhập.');
    switchAuthTab('login');
    document.getElementById('registerForm').reset();
  } catch (err) {
    showToast(err.message || 'Đăng ký thất bại');
  }
}

async function login(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const data = await apiCall('login', 'POST', { email, password });
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('unica-token', authToken);
    localStorage.setItem('unica-user', JSON.stringify(currentUser));
    updateAuthUI();
    closeAuthModal();
    document.getElementById('loginForm').reset();
    // Nếu là admin, hiện section quản trị
    if (currentUser.email === ADMIN_EMAIL || currentUser.role === 'admin') {
      adminSection.classList.remove('hidden');
      renderAdminTable();
    } else {
      adminSection.classList.add('hidden');
    }
    showToast('Đăng nhập thành công!');
  } catch (err) {
    showToast(err.message || 'Đăng nhập thất bại');
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('unica-token');
  localStorage.removeItem('unica-user');
  updateAuthUI();
  adminSection.classList.add('hidden');
  showToast('Đã đăng xuất');
}

async function checkSession() {
  const storedToken = localStorage.getItem('unica-token');
  const storedUser = localStorage.getItem('unica-user');
  if (storedToken && storedUser) {
    try {
      const data = await apiCall('checkSession', 'POST', {});
      currentUser = data.user;
      authToken = storedToken;
      updateAuthUI();
      if (currentUser.email === ADMIN_EMAIL || currentUser.role === 'admin') {
        adminSection.classList.remove('hidden');
        renderAdminTable();
      }
    } catch {
      logout();
    }
  }
}

function updateAuthUI() {
  if (currentUser) {
    authArea.classList.add('hidden');
    userArea.classList.remove('hidden');
    userName.textContent = currentUser.name || currentUser.email;
  } else {
    authArea.classList.remove('hidden');
    userArea.classList.add('hidden');
    userName.textContent = '';
  }
}

// ========== COURSES ==========
function loadCourses() {
  // Giữ nguyên logic fallback local nếu API offline
  if (!API_URL || API_URL.includes('...')) {
    const stored = localStorage.getItem('unica-courses');
    if (stored) {
      courses = JSON.parse(stored);
    } else {
      courses = getDefaultCourses();
      saveCoursesLocal();
    }
    return;
  }
  fetchCoursesFromAPI();
}

function saveCoursesLocal() {
  localStorage.setItem('unica-courses', JSON.stringify(courses));
}

async function fetchCoursesFromAPI() {
  try {
    const data = await apiCall('courses');
    courses = data.courses || [];
    renderCourses();
  } catch {
    // fallback local
    const stored = localStorage.getItem('unica-courses');
    if (stored) courses = JSON.parse(stored);
    renderCourses();
  }
}

function renderCourses() {
  if (courses.length === 0) {
    coursesGrid.innerHTML = '<div class="empty-state"><p>Chưa có khóa học nào.</p></div>';
    return;
  }

  coursesGrid.innerHTML = courses.map(course => `
    <div class="course-card">
      <div class="course-image" style="background-image: url('${escapeHtml(course.image)}'); background-size: cover; background-position: center;">
        ${!course.image || course.image.includes('unsplash') ? '' : escapeHtml(course.title.substring(0, 30))}
      </div>
      <div class="course-body">
        <div class="course-meta">
          <span>${escapeHtml(course.date)}</span>
          ${course.isLive ? '<span class="course-live">ĐANG TRỰC TIẾP</span>' : ''}
        </div>
        <h3 class="course-title">${escapeHtml(course.title)}</h3>
        <div class="course-meta">
          <span>${escapeHtml(course.time)}</span>
        </div>
        <button class="free-btn">Xem miễn phí</button>
      </div>
    </div>
  `).join('');
}

function renderAdminTable() {
  const isAdmin = currentUser && (currentUser.email === ADMIN_EMAIL || currentUser.role === 'admin');
  if (!isAdmin) {
    adminSection.classList.add('hidden');
    return;
  }
  adminSection.classList.remove('hidden');

  if (courses.length === 0) {
    adminTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 24px;">Chưa có khóa học</td></tr>';
    return;
  }

  adminTableBody.innerHTML = courses.map(course => `
    <tr>
      <td><img src="${escapeHtml(course.image)}" alt="" style="width:60px;height:40px;object-fit:cover;border-radius:4px;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2240%22><rect fill=%22%23ddd%22 width=%2260%22 height=%2240%22/></svg>'"></td>
      <td>${escapeHtml(course.title)}</td>
      <td>${escapeHtml(course.date)} • ${escapeHtml(course.time)}</td>
      <td>
        <button class="action-btn edit-btn" onclick="editCourse('${course.id}')">Sửa</button>
        <button class="action-btn delete-btn" onclick="deleteCourse('${course.id}')">Xóa</button>
      </td>
    </tr>
  `).join('');
}

function toggleAdmin() {
  const isAdmin = currentUser && (currentUser.email === ADMIN_EMAIL || currentUser.role === 'admin');
  if (!isAdmin) {
    showToast('Bạn không có quyền truy cập');
    openAuthModal('login');
    return;
  }
  adminSection.classList.toggle('hidden');
  if (!adminSection.classList.contains('hidden')) {
    renderAdminTable();
  }
}

function openAddCourseModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Thêm khóa học';
  document.getElementById('courseId').value = '';
  document.getElementById('courseTitle').value = '';
  document.getElementById('courseImage').value = '';
  document.getElementById('courseDate').value = '';
  document.getElementById('courseTime').value = '';
  document.getElementById('courseDesc').value = '';
  modal.classList.remove('hidden');
}

function editCourse(id) {
  const course = courses.find(c => c.id === id);
  if (!course) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = 'Sửa khóa học';
  document.getElementById('courseId').value = course.id;
  document.getElementById('courseTitle').value = course.title;
  document.getElementById('courseImage').value = course.image;
  document.getElementById('courseDate').value = course.date;
  document.getElementById('courseTime').value = course.time;
  document.getElementById('courseDesc').value = course.desc || '';
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
  editingId = null;
}

async function saveCourse(event) {
  event.preventDefault();
  const isAdmin = currentUser && (currentUser.email === ADMIN_EMAIL || currentUser.role === 'admin');
  if (!isAdmin) {
    showToast('Bạn không có quyền thực hiện');
    return;
  }

  const title = document.getElementById('courseTitle').value.trim();
  const image = document.getElementById('courseImage').value.trim();
  const date = document.getElementById('courseDate').value.trim();
  const time = document.getElementById('courseTime').value.trim();
  const desc = document.getElementById('courseDesc').value.trim();

  if (!title || !image || !date || !time) {
    showToast('Vui lòng điền đầy đủ thông tin bắt buộc');
    return;
  }

  if (editingId && !API_URL.includes('...')) {
    try {
      await apiCall('updateCourse', 'POST', {
        id: editingId, title, image, date, time, desc
      });
    } catch (err) {
      // fallback local
      updateCourseLocal(editingId, { title, image, date, time, desc });
    }
  } else if (!API_URL.includes('...')) {
    try {
      await apiCall('addCourse', 'POST', {
        title, image, date, time, desc, isLive: true
      });
    } catch (err) {
      addCourseLocal({ title, image, date, time, desc, isLive: true });
    }
  } else {
    // Demo mode: local only
    if (editingId) {
      updateCourseLocal(editingId, { title, image, date, time, desc });
    } else {
      addCourseLocal({ title, image, date, time, desc, isLive: true });
    }
  }

  renderCourses();
  renderAdminTable();
  closeModal();
}

async function deleteCourse(id) {
  const isAdmin = currentUser && (currentUser.email === ADMIN_EMAIL || currentUser.role === 'admin');
  if (!isAdmin) {
    showToast('Bạn không có quyền thực hiện');
    return;
  }
  if (!confirm('Bạn có chắc chắn muốn xóa khóa học này?')) return;

  if (!API_URL.includes('...')) {
    try {
      await apiCall('deleteCourse', 'POST', { id });
    } catch {
      deleteCourseLocal(id);
    }
  } else {
    deleteCourseLocal(id);
  }

  renderCourses();
  renderAdminTable();
}

// Fallback local ops
function addCourseLocal(course) {
  course.id = 'course_' + Date.now();
  courses.push(course);
  saveCoursesLocal();
}

function updateCourseLocal(id, updates) {
  const idx = courses.findIndex(c => c.id === id);
  if (idx !== -1) {
    courses[idx] = { ...courses[idx], ...updates };
    saveCoursesLocal();
  }
}

function deleteCourseLocal(id) {
  courses = courses.filter(c => c.id !== id);
  saveCoursesLocal();
}

function getDefaultCourses() {
  return [
    { id: 'default1', title: 'Xây kênh và Bắt kiếm tiền Youtube AI, Affiliate', image: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&h=250&fit=crop', date: '26/08 - 27/08', time: '19:30 - 22:30', desc: 'Học cách xây dựng kênh YouTube tự động với AI và kiếm tiền từ affiliate marketing.', isLive: true },
    { id: 'default2', title: 'XÂY DỰNG HỆ THỐNG KINH DOANH TỰ ĐỘNG 1 NGƯỜI VỚI OPEN CLAW', image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=250&fit=crop', date: '26/08 - 27/08', time: '19:30 - 23:00', desc: 'Xây dựng hệ thống kinh doanh tự động hoàn toàn chỉ với một người vận hành.', isLive: true },
    { id: 'default3', title: 'Khóa học Biquyết ăn đứng sống trưởng thành', image: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&h=250&fit=crop', date: '27/08', time: '19:30 - 22:30', desc: 'Bí quyết để đứng thẳng và sống trưởng thành trong thời đại số.', isLive: true },
    { id: 'default4', title: 'ỨNG DỤNG AI TỰ ĐỘNG HÓA KINH DOANH & BÙNG NỔ DOANH SỐ', image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&h=250&fit=crop', date: '27/08 - 14/08', time: '19:15 - 17:00', desc: 'Nguyên tắc ứng dụng AI để tự động hóa kinh doanh và bùng nổ doanh số.', isLive: true },
    { id: 'default5', title: 'XÂY DỰNG SIÊU TRỢ LÝ AI TOÀN NĂNG VỚI OPEN CLAW', image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=250&fit=crop', date: '28/08 - 20/08', time: '13:15 - 17:00', desc: 'Xây dựng trợ lý AI mạnh mẽ với Open CLAW để tối ưu công việc.', isLive: true },
    { id: 'default6', title: 'Thực chiến xây kênh FACEBOOK Reels kiếm tiền', image: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400&h=250&fit=crop', date: '28/08 - 7/08', time: '08:00 - 11:00', desc: 'Hướng dẫn thực chiến xây kênh Facebook Reels và kiếm tiền thực tế.', isLive: true },
    { id: 'default7', title: 'AFFILIATE SHOPEE- META FACEBOOK 2026 TỪ A-Z', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=250&fit=crop', date: '28/08', time: '19:30 - 23:30', desc: 'Khóa học Affiliate Shopee và Meta Facebook 2026 từ A đến Z.', isLive: true },
    { id: 'default8', title: 'Ứng dụng AI tự động hóa kinh doanh & bùng nổ doanh số', image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=400&h=250&fit=crop', date: '30/08', time: '19:15 - 22:30', desc: 'Ứng dụng AI vào kinh doanh để tự động hóa và tăng trưởng doanh số.', isLive: true }
  ];
}

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  loadCourses();
  renderCourses();
  checkSession();
});

document.addEventListener('click', (e) => {
  if (e.target === authModal) closeAuthModal();
  if (e.target === modal) closeModal();
});
