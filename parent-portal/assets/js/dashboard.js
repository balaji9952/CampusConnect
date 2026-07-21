import { fetchApi } from './api.js';
import { getCurrentUser, openModal, closeModal, setupModals, fmtDate, timeAgo, badgeHtml, appShowToast } from './shared.js';
import { t, applyLang } from './translations.js';
import { initLayout } from './layout.js';

window.openModal = openModal;
window.closeModal = closeModal;

async function loadDashboardData() {
  try {
    const [statsRes, ticketsRes] = await Promise.all([
      fetchApi('/dashboard/stats'),
      fetchApi('/tickets')
    ]);

    if (statsRes.status === 200 && statsRes.data.success) {
      renderStats(statsRes.data.data);
    }
    if (ticketsRes.status === 200 && ticketsRes.data.success) {
      renderRecent(ticketsRes.data.data);
    }
  } catch (e) {
    console.error('Failed to load dashboard data', e);
  }
}

function renderStats(stats) {
  const grid = document.getElementById('stats-grid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="stat-card" style="border-left-color:#003BFF">
      <div class="stat-title" data-i18n="stat_total">${t('stat_total')}</div>
      <div class="stat-val">${stats.totalTickets || 0}</div>
    </div>
    <div class="stat-card" style="border-left-color:#F5A623">
      <div class="stat-title" data-i18n="stat_pending">${t('stat_pending')}</div>
      <div class="stat-val">${stats.openTickets || 0}</div>
    </div>
    <div class="stat-card" style="border-left-color:#4A90E2">
      <div class="stat-title" data-i18n="stat_progress">${t('stat_progress')}</div>
      <div class="stat-val">${stats.inProgressTickets || 0}</div>
    </div>
    <div class="stat-card" style="border-left-color:#28a745">
      <div class="stat-title" data-i18n="stat_resolved">${t('stat_resolved')}</div>
      <div class="stat-val">${stats.resolvedTickets || 0}</div>
    </div>
  `;
  applyLang();
}

function renderRecent(complaints) {
  const list = document.getElementById('recent-list');
  if (!list) return;
  if (!complaints || complaints.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><i class="ti ti-file-x"></i></div>
      <div>${t('empty_complaints')}</div>
    </div>`;
    return;
  }
  list.innerHTML = complaints.slice(0, 3).map(c => `
    <div class="complaint-card">
      <div class="c-header">
        <span class="c-id">${c.ticket_number || c.id}</span>
        ${badgeHtml(c.status, t)}
      </div>
      <div class="c-title">${t(c.category_name) || c.category_name || 'Category'}</div>
      <div class="c-meta">
        <span><i class="ti ti-map-pin"></i> ${t(c.location_name) || c.location_name || 'Location'}</span>
        <span><i class="ti ti-clock"></i> ${timeAgo(c.created_at)}</span>
      </div>
      <div class="c-desc">${c.description || 'No description provided'}</div>
    </div>
  `).join('');
}

async function updateDropdowns() {
  // Dropdowns removed for Feedback UI
}

window.openSubmitModal = async function() {
  await updateDropdowns();
  openModal('modal-submit');
};

let complaintPhotoData = null;
function initPhotoUpload() {
  // Photo upload removed for Feedback UI
}

async function submitComplaint() {
  const desc = document.getElementById('m-desc').value.trim();

  let hasErr = false;
  if (!desc) { 
    document.getElementById('m-desc-err').textContent = 'Please provide a description.';
    document.getElementById('m-desc-err').style.display = 'block'; 
    hasErr = true; 
  } else { 
    document.getElementById('m-desc-err').style.display = 'none'; 
  }

  if (hasErr) return;

  document.getElementById('btn-submit-complaint').disabled = true;
  document.getElementById('btn-submit-complaint').textContent = 'Submitting...';

  const res = await fetchApi('/tickets', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Parent Feedback',
      description: desc,
      ticket_type: 'PARENT_FEEDBACK',
      priority: 2 // Medium
    })
  });

  if (res.status === 201 && res.data.success) {
    const ticketId = res.data.data.id;

    document.getElementById('btn-submit-complaint').disabled = false;
    document.getElementById('btn-submit-complaint').textContent = t('btn_submit');

    closeModal('modal-submit');
    document.getElementById('success-ticket-id').textContent = res.data.data.ticket_number || ticketId;
    openModal('modal-success');
    document.getElementById('m-desc').value = '';
    loadDashboardData();
  } else {
    appShowToast(res.data?.message || 'Failed to submit feedback', 'error');
  }
  document.getElementById('btn-submit-complaint').disabled = false;
  document.getElementById('btn-submit-complaint').textContent = t('btn_submit');
}

window.addEventListener('DOMContentLoaded', async () => {
  setupModals();
  initPhotoUpload();
  
  const user = getCurrentUser();
  if (user) {
    const gn = document.getElementById('greet-name');
    if (gn) gn.textContent = user.name;
  }
  
  const submitBtn = document.getElementById('btn-submit-complaint');
  if (submitBtn) submitBtn.onclick = submitComplaint;

  const copyBtn = document.getElementById('btn-copy-ticket');
  if (copyBtn) copyBtn.onclick = () => {
    const id = document.getElementById('success-ticket-id').textContent;
    navigator.clipboard.writeText(id).catch(() => { });
    copyBtn.innerHTML = `<i class="ti ti-check"></i> ${t('btn_copy')}`;
    setTimeout(() => { copyBtn.innerHTML = `<i class="ti ti-copy"></i> ${t('btn_copy')}`; }, 1500);
  };

  await loadDashboardData();
});
