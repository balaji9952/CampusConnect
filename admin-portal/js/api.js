// ─── API Configuration ────────────────────────────────────────────────────────
// Centralized API Base URL definition.
// - Local standalone static server (e.g. port 8000 / 5500): uses http://localhost:3019/api
// - Direct-to-backend or Nginx proxy / production: uses origin-based /api or relative /api
var isStandaloneStaticDev = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  && (window.location.port === '8000' || window.location.port === '5500' || window.location.port === '3000' || window.location.port === '5000');

var API_BASE = isStandaloneStaticDev
  ? 'http://localhost:3019/api'
  : 'https://campusconnect-nbeb.onrender.com/api';

window.API_BASE = API_BASE;

// resolveImageUrl — handles image paths returned from the backend.
// The backend returns paths like "/uploads/photos/xxx.jpg".
function resolveImageUrl(path) {
  if (!path) return '';
  // Absolute URLs (CDN or external) pass through unchanged.
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  const baseUrl = isStandaloneStaticDev
    ? 'http://localhost:3019'
    : 'https://campusconnect-nbeb.onrender.com';
  return path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
}

function getAuthHeaders(extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...extraHeaders
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

// Globally available token and user for all admin pages
const token = localStorage.getItem('admin_token');
let user = null;

if (!token && !window.location.pathname.endsWith('login.html')) {
  window.location.href = 'login.html';
}

try {
  const userStr = localStorage.getItem('admin_user');
  if (userStr) user = JSON.parse(userStr);
} catch (e) {
  console.error("Error parsing user from localStorage", e);
}

// Update sidebar user info dynamically across all pages
function updateSidebarUser() {
  if (user) {
    // Support both class-based (legacy) and ID-based (new pages) sidebar elements
    const adminNameEl = document.querySelector('.admin-name') || document.getElementById('sidebar-name');
    const adminRoleEl = document.querySelector('.admin-role') || document.getElementById('sidebar-role');
    const adminAvatarEl = document.querySelector('.admin-avatar') || document.getElementById('sidebar-avatar');

    // Also try ID-based elements separately (for pages that have both)
    const sidebarNameById = document.getElementById('sidebar-name');
    const sidebarRoleById = document.getElementById('sidebar-role');
    const sidebarAvatarById = document.getElementById('sidebar-avatar');

    if (sidebarNameById) sidebarNameById.textContent = user.name || 'Admin';
    if (sidebarRoleById) sidebarRoleById.textContent = user.roleLabel || 'Administrator';

    if (adminNameEl && !sidebarNameById) adminNameEl.textContent = user.name || 'Admin';
    if (adminRoleEl && !sidebarRoleById) adminRoleEl.textContent = user.roleLabel || 'Administrator';

    const targetAvatar = sidebarAvatarById || adminAvatarEl;
    if (targetAvatar) {
      if (user.avatarUrl) {
        targetAvatar.innerHTML = '';
        const img = document.createElement('img');
        img.src = resolveImageUrl(user.avatarUrl);
        img.alt = 'Profile Photo';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = 'inherit';
        targetAvatar.appendChild(img);
      } else if (user.name) {
        targetAvatar.textContent = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      }
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateSidebarUser);
} else {
  updateSidebarUser();
}

