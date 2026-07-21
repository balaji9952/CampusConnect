import { fetchApi } from './api.js';
import { timeAgo, badgeHtml } from './shared.js';
import { t } from './translations.js';
import { initLayout } from './layout.js';

let notifications = [];

async function loadNotifications() {
  const res = await fetchApi('/notifications');
  if (res.status === 200 && res.data.success) {
    notifications = res.data.data;
    renderNotifications();
    updateBadge();
  }
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;

  if (notifications.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><i class="ti ti-bell-off"></i></div>
      <div>${t('empty_notif')}</div>
    </div>`;
    return;
  }
  
  list.innerHTML = notifications.map(n => {
    let icon = 'ti-info-circle';
    if (n.title.includes('Resolved')) icon = 'ti-circle-check';
    if (n.title.includes('Progress')) icon = 'ti-loader';
    return `
      <div class="notif-card ${!n.is_read ? 'unread' : ''}">
        <div class="notif-icon"><i class="ti ${icon}"></i></div>
        <div style="flex:1;min-width:0">
          <div class="notif-title">${n.title}</div>
          <div class="notif-desc">${n.body}</div>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function updateBadge() {
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const dot = document.getElementById('notif-dot');
  if (dot) {
    dot.style.display = unreadCount > 0 ? 'block' : 'none';
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadNotifications();
});
