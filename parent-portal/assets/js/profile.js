import { fetchApi } from './api.js';
import { getCurrentUser, initials, appShowToast } from './shared.js';
import { t, getLang, setLang, applyLang } from './translations.js';
import { initLayout } from './layout.js';

let isEditMode = false;

function syncUserToUI() {
  const user = getCurrentUser();
  if (!user) return;
  
  const n = user.name || 'Unknown', e = user.email || '', ph = user.phone || '—';
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  
  setEl('pv-name', n); 
  setEl('pv-email', e); 
  setEl('pv-phone', ph);
  setEl('profile-disp-name', n); 
  setEl('profile-disp-email', e);
  
  document.getElementById('pi-name').value = n;
  document.getElementById('pi-email').value = e;
  document.getElementById('pi-phone').value = user.phone || '';
  document.getElementById('pi-lang').value = getLang();
  
  const profAv = document.getElementById('profile-avatar');
  if (user.photo) {
    profAv.innerHTML = `<img src="${user.photo}" alt="avatar" style="width:100%;height:100%;border-radius:50%;">`;
  } else {
    profAv.textContent = initials(n);
  }
}

async function toggleEdit() {
  const btn = document.getElementById('profile-edit-btn');
  const user = getCurrentUser();
  
  if (!isEditMode) {
    isEditMode = true;
    ['name', 'email', 'phone', 'lang'].forEach(f => {
      document.getElementById('pv-' + f).style.display = 'none';
      document.getElementById('pi-' + f).style.display = 'block';
    });
    const photoBtn = document.getElementById('btn-upload-photo');
    if (photoBtn) photoBtn.style.display = 'flex';
    btn.innerHTML = `<i class="ti ti-device-floppy"></i> <span>${t('btn_save') || 'Save'}</span>`;
  } else {
    btn.disabled = true;
    btn.innerHTML = `<i class="ti ti-loader"></i> <span>Saving...</span>`;
    
    const n = document.getElementById('pi-name').value.trim() || user.name;
    const e = document.getElementById('pi-email').value.trim() || user.email;
    const ph = document.getElementById('pi-phone').value.trim();
    const newLang = document.getElementById('pi-lang').value;
    
    const res = await fetchApi('/users/me', {
      method: 'PUT',
      body: JSON.stringify({ name: n, email: e, phone: ph })
    });

    if (res.status === 200 && res.data.success) {
      isEditMode = false;
      const updatedUser = { ...user, name: n, email: e, phone: ph };
      localStorage.setItem('parent_user', JSON.stringify(updatedUser));
      
      if (newLang !== getLang()) { 
        setLang(newLang); 
        applyLang(); 
      }
      
      syncUserToUI();
      
      ['name', 'email', 'phone', 'lang'].forEach(f => {
        document.getElementById('pv-' + f).style.display = 'block';
        document.getElementById('pi-' + f).style.display = 'none';
      });
      const photoBtn = document.getElementById('btn-upload-photo');
      if (photoBtn) photoBtn.style.display = 'none';
      
      btn.innerHTML = `<i class="ti ti-edit"></i> <span data-i18n="btn_edit">${t('btn_edit') || 'Edit'}</span>`;
      appShowToast('Profile updated successfully');
    } else {
      appShowToast(res.data.message || 'Failed to update profile', 'error');
      btn.innerHTML = `<i class="ti ti-device-floppy"></i> <span>${t('btn_save') || 'Save'}</span>`;
    }
    btn.disabled = false;
  }
}


function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function (e) {
    // Ideally upload to backend here, but for now we'll simulate success
    const user = getCurrentUser();
    const updatedUser = { ...user, photo: e.target.result };
    localStorage.setItem('parent_user', JSON.stringify(updatedUser));
    syncUserToUI();
    // Also trigger topbar avatar update if possible
    const topAvatar = document.getElementById('top-avatar');
    if (topAvatar) {
      topAvatar.innerHTML = `<img src="${e.target.result}" alt="avatar" style="width:100%;height:100%;border-radius:50%;">`;
    }
  };
  reader.readAsDataURL(file);
}

window.addEventListener('DOMContentLoaded', () => {
  syncUserToUI();
  
  const editBtn = document.getElementById('profile-edit-btn');
  if (editBtn) editBtn.onclick = toggleEdit;
  

  const photoIn = document.getElementById('photo-input');
  if (photoIn) photoIn.onchange = handlePhotoUpload;
});
