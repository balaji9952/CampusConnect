export function appShowToast(msg, type = 'success') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    t.innerHTML = `<span id="toast-msg"></span>`;
    document.body.appendChild(t);
  }
  document.getElementById('toast-msg').textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 3000);
}

export function getCurrentUser() {
  const user = localStorage.getItem('parent_user');
  return user ? JSON.parse(user) : null;
}

export function initials(n) { 
  if(!n) return 'GU';
  const p = n.trim().split(' '); 
  return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase(); 
}

export function fmtDate(d) { 
  if(!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); 
}

export function timeAgo(d) {
  if(!d) return '';
  const date = new Date(d);
  const diff = Date.now() - date.getTime(); 
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60); 
  const dy = Math.floor(h / 24);
  if (dy > 0) return dy + 'd ago'; 
  if (h > 0) return h + 'h ago'; 
  if (m > 0) return m + 'm ago'; 
  return 'Just now';
}

export function badgeHtml(s, tFunc) {
  if (s === 0 || s === '0' || s === 'Pending') return `<span class="badge badge-pending">${tFunc ? tFunc('status_pending') : 'Pending'}</span>`;
  if (s === 1 || s === '1' || s === 'In Progress') return `<span class="badge badge-progress">${tFunc ? tFunc('status_progress') : 'In Progress'}</span>`;
  return `<span class="badge badge-resolved">${tFunc ? tFunc('status_resolved') : 'Resolved'}</span>`;
}

// Backdrop Click handlers for modals
export function setupModals() {
  const modals = document.querySelectorAll('.modal-overlay');
  modals.forEach(el => {
    el.addEventListener('click', function (e) { 
      if (e.target === this) this.classList.remove('open'); 
    });
  });
}

export function openModal(id) {
  const modal = document.getElementById(id);
  if(modal) modal.classList.add('open');
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  if(modal) modal.classList.remove('open');
}
