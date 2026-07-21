import { checkAuthentication, logout } from './auth.js';
import { applyLang, t } from './translations.js';
import { getCurrentUser, initials } from './shared.js';

export async function initLayout() {
  if (!checkAuthentication()) return;

  const sidebarContainer = document.getElementById('sidebar-container');
  const topbarContainer = document.getElementById('topbar-container');

  try {
    if (sidebarContainer) {
      const sidebarRes = await fetch('components/sidebar.html');
      if (sidebarRes.ok) {
        sidebarContainer.innerHTML = await sidebarRes.text();
      }
    }
    
    if (topbarContainer) {
      const topbarRes = await fetch('components/topbar.html');
      if (topbarRes.ok) {
        topbarContainer.innerHTML = await topbarRes.text();
      }
    }
  } catch (error) {
    console.error('Failed to load layout components', error);
  }

  // Highlight active navigation
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar .nav-item').forEach(item => {
    if (item.getAttribute('href') === currentPath) {
      item.classList.add('active');
    }
  });

  // Attach logout handler
  const logoutBtn = document.getElementById('sidebar-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }

  // Set user avatar/initials
  const currentUser = getCurrentUser();
  const topAvatar = document.getElementById('top-avatar');
  if (topAvatar && currentUser) {
    if (currentUser.photo) {
      topAvatar.innerHTML = `<img src="${currentUser.photo}" alt="avatar" style="width:100%;height:100%;border-radius:50%;">`;
    } else {
      topAvatar.textContent = initials(currentUser.name);
    }
  }

  // Apply translations to the newly injected layout
  applyLang();
}

window.addEventListener('DOMContentLoaded', () => {
  // Only init layout on pages that have the containers (i.e., not index.html login)
  if (document.getElementById('sidebar-container') || document.getElementById('topbar-container')) {
    initLayout();
  } else {
    // For index.html
    applyLang();
  }
});
