// ─── API Configuration ────────────────────────────────────────────────────────
// All requests use RELATIVE paths so they are always routed through the Nginx
// reverse proxy (or whatever web server is in front).
// Do NOT change these to absolute URLs — all /api/* traffic is proxied by Nginx
// to http://localhost:3019.
const API_BASE = '/api';

// resolveImageUrl — handles image paths returned from the backend.
// The backend returns paths like "/uploads/photos/xxx.jpg".
// Since we're behind Nginx (same origin), relative paths work without any prefix.
function resolveImageUrl(path) {
  if (!path) return '';
  // Absolute URLs (CDN or external) pass through unchanged.
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  // Already-relative paths (e.g. /uploads/...) are returned as-is.
  // Nginx serves /uploads/ content from the backend's uploads directory.
  return path.startsWith('/') ? path : '/' + path;
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

