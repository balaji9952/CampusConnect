const isLocalDev = window.location.port === '5500' || window.location.protocol === 'file:';
const API_BASE = isLocalDev ? 'http://127.0.0.1:3030/api' : '/api';
const SERVER_BASE = isLocalDev ? 'http://127.0.0.1:3030' : '';

function resolveImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  const base = SERVER_BASE.endsWith('/') ? SERVER_BASE.slice(0, -1) : SERVER_BASE;
  const relativePath = path.startsWith('/') ? path : '/' + path;
  return base + relativePath;
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

  if (window.location.hostname.includes('ngrok') || API_BASE.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  return headers;
}

const originalFetch = window.fetch;
window.fetch = async function (resource, options = {}) {
  // 1. Resolve relative image URLs if someone fetches them directly
  if (typeof resource === 'string' && resource.startsWith('/uploads')) {
    resource = SERVER_BASE + resource;
  }

  // 2. Inject ngrok bypass header for API calls
  if (typeof resource === 'string' && (resource.includes('ngrok') || API_BASE.includes('ngrok') || window.location.hostname.includes('ngrok'))) {
    options.headers = options.headers || {};
    // Handle both plain objects and Headers objects
    if (options.headers instanceof Headers) {
      options.headers.append('ngrok-skip-browser-warning', 'true');
    } else {
      options.headers['ngrok-skip-browser-warning'] = 'true';
    }
  }

  return originalFetch(resource, options);
};

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
