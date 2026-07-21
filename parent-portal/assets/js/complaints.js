import { fetchApi, resolveImageUrl } from './api.js';
import { getCurrentUser, openModal, closeModal, setupModals, fmtDate, timeAgo, badgeHtml } from './shared.js';
import { t } from './translations.js';
import { initLayout } from './layout.js';

window.openModal = openModal;
window.closeModal = closeModal;

let allComplaints = [];
let currentFilter = 'All';

async function loadComplaints() {
  const res = await fetchApi('/tickets');
  if (res.status === 200 && res.data.success) {
    allComplaints = res.data.data;
    renderComplaints();
  }
}

function renderComplaints() {
  const list = document.getElementById('complaints-list');
  if (!list) return;

  const filterMap = { 'Pending': 0, 'In Progress': 1, 'Resolved': 2 };
  const filtered = currentFilter === 'All' 
    ? allComplaints 
    : allComplaints.filter(c => c.status === filterMap[currentFilter] || String(c.status) === String(filterMap[currentFilter]) || c.status === currentFilter);
  
  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><i class="ti ti-file-x"></i></div>
      <div>${t('empty_complaints')}</div>
    </div>`;
    return;
  }
  
  list.innerHTML = filtered.map(c => `
    <div class="complaint-card" style="cursor:pointer" onclick="window.viewComplaintDetail('${c.ticket_number || c.id}')">
      <div class="c-header">
        <span class="c-id">${c.ticket_number || c.id}</span>
        ${badgeHtml(c.status, t)}
      </div>
      <div class="c-meta">
        <span><i class="ti ti-calendar"></i> ${fmtDate(c.created_at)}</span>
      </div>
    </div>
  `).join('');
}

window.viewComplaintDetail = function(id) {
  const c = allComplaints.find(x => (x.ticket_number || x.id) === id);
  if (!c) return;
  const user = getCurrentUser();
  
  document.getElementById('d-id').textContent = c.ticket_number || c.id;
  document.getElementById('d-badge').outerHTML = badgeHtml(c.status, t);
  document.getElementById('d-badge').id = 'd-badge'; // Re-apply ID after outerHTML replacement
  
  document.getElementById('d-desc').textContent = c.description || 'No description provided';
  document.getElementById('d-date').innerHTML = `<i class="ti ti-calendar"></i> ${fmtDate(c.created_at)}`;
  document.getElementById('d-parent').textContent = user ? user.name : 'Unknown';
  document.getElementById('d-mobile').textContent = (user ? user.phone : null) || 'Not provided';
  
  openModal('modal-detail');
};

function setupFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.getAttribute('data-f');
      renderComplaints();
    });
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  setupModals();
  setupFilters();
  await loadComplaints();
});
