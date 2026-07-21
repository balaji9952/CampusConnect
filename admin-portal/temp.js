    const token = localStorage.getItem('admin_token');
    if (!token) window.location.href = 'login.html';

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    function saveToast(msg, isError = false) {
      const t = document.getElementById('toast');
      document.getElementById('toast-msg').textContent = msg || 'Changes saved successfully!';
      t.style.background = isError ? 'var(--danger)' : 'var(--success)';
      t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000);
    }
    function openSidebar() { document.getElementById('sidebar').classList.add('open'); document.getElementById('overlay').classList.add('show'); }
    function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('show'); }

    async function fetchSecuritySettings() {
      try {
        const response = await fetch(`${API_BASE}/settings/security`, { headers });
        if (response.status === 401 || response.status === 403) return window.location.href = 'login.html';
        const res = await response.json();
        if (res.success && res.data && res.data.settings) {
          const s = res.data.settings;
          document.getElementById('sec-minpwd').value = s.minPasswordLength;
          document.getElementById('sec-maxattempts').value = s.maxLoginAttempts;
          document.getElementById('sec-timeout').value = s.sessionTimeout;
          document.getElementById('sec-upper').checked = s.requireUppercase;
          document.getElementById('sec-num').checked = s.requireNumbers;
          document.getElementById('sec-special').checked = s.requireSpecial;
          document.getElementById('sec-2fa').checked = s.enable2FA;
          document.getElementById('sec-2fa-method').value = s.twoFactorMethod;
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    }

    async function fetchSessions() {
      try {
        const response = await fetch(`${API_BASE}/security/sessions`, { headers });
        const res = await response.json();
        if (res.success && res.data) {
          const container = document.getElementById('active-sessions');
          container.innerHTML = '';
          res.data.forEach(sess => {
            const date = new Date(sess.last_activity).toLocaleString();
            let icon = 'ti-device-desktop';
            let color = 'var(--text)';
            const devName = sess.device_name || 'Unknown Device';
            const dev = devName.toLowerCase();
            if(dev.includes('chrome')) { icon = 'ti-brand-chrome'; color = 'var(--primary)'; }
            else if(dev.includes('safari')) { icon = 'ti-brand-safari'; color = 'var(--secondary)'; }
            else if(dev.includes('firefox')) { icon = 'ti-brand-firefox'; color = '#e17055'; }
            else if(dev.includes('edge')) { icon = 'ti-brand-edge'; color = '#0078D7'; }

            const actionBtn = sess.is_current 
              ? `<span class="badge badge-success">Current</span>`
              : `<button class="btn btn-danger btn-sm" style="padding:4px 10px" onclick="revokeSession('${sess.id}')"><i class="ti ti-x"></i> Revoke</button>`;

            container.innerHTML += `
              <div style="background:var(--bg);border-radius:12px;padding:14px;font-size:13px;margin-bottom:8px" id="sess-${sess.id}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%"><i class="ti ${icon}" style="color:${color}"></i> ${devName}</span>
                  ${actionBtn}
                </div>
                <div style="font-size:11px;color:var(--text-hint);margin-top:3px">Last active: ${date} &middot; IP: ${sess.ip_address || 'Unknown'}</div>
              </div>
            `;
          });
        }
      } catch (err) {
        console.error("Error fetching sessions:", err);
      }
    }

    async function revokeSession(id) {
      if (confirm(`Are you sure you want to revoke this session?`)) {
        try {
          const response = await fetch(`${API_BASE}/security/sessions/${id}/revoke`, { method: 'POST', headers });
          const res = await response.json();
          if (res.success) {
            const el = document.getElementById('sess-' + id);
            if (el) { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }
            saveToast(`Session revoked`);
          } else {
            saveToast(res.message || 'Error revoking session', true);
          }
        } catch (err) {
          saveToast('Network error', true);
        }
      }
    }

    async function revokeAllSessions() {
      if (confirm('Revoke all other active sessions? You will be the only one left logged in.')) {
        try {
          const response = await fetch(`${API_BASE}/security/sessions/revoke-all`, { method: 'POST', headers });
          const res = await response.json();
          if (res.success) {
            saveToast('All other sessions revoked!');
            fetchSessions();
          } else {
            saveToast(res.message || 'Error revoking sessions', true);
          }
        } catch (err) {
          saveToast('Network error', true);
        }
      }
    }

    function enableSecurityEdit() {
      document.getElementById("sec-minpwd").removeAttribute("readonly");
      document.getElementById("sec-maxattempts").removeAttribute("readonly");
      document.getElementById("sec-timeout").removeAttribute("readonly");

      document.getElementById("sec-upper").disabled = false;
      document.getElementById("sec-num").disabled = false;
      document.getElementById("sec-special").disabled = false;
      document.getElementById("sec-2fa").disabled = false;
      document.getElementById("sec-2fa-method").disabled = false;
      
      document.getElementById("global-edit-btn").style.display = "none";
      document.getElementById("global-save-btn").style.display = "inline-flex";

      saveToast("Edit mode enabled");
    }

    async function saveSecurity() {
      const payload = {
        minPasswordLength: parseInt(document.getElementById('sec-minpwd').value) || 8,
        maxLoginAttempts: parseInt(document.getElementById('sec-maxattempts').value) || 5,
        sessionTimeout: parseInt(document.getElementById('sec-timeout').value) || 30,
        requireUppercase: document.getElementById('sec-upper').checked,
        requireNumbers: document.getElementById('sec-num').checked,
        requireSpecial: document.getElementById('sec-special').checked,
        enable2FA: document.getElementById('sec-2fa').checked,
        twoFactorMethod: document.getElementById('sec-2fa-method').value
      };

      try {
        const response = await fetch(`${API_BASE}/settings/security`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload)
        });
        const res = await response.json();
        
        if (res.success) {
          document.getElementById("sec-minpwd").setAttribute("readonly", true);
          document.getElementById("sec-maxattempts").setAttribute("readonly", true);
          document.getElementById("sec-timeout").setAttribute("readonly", true);
          document.getElementById("sec-upper").disabled = true;
          document.getElementById("sec-num").disabled = true;
          document.getElementById("sec-special").disabled = true;
          document.getElementById("sec-2fa").disabled = true;
          document.getElementById("sec-2fa-method").disabled = true;
          
          document.getElementById("global-edit-btn").style.display = "inline-flex";
          document.getElementById("global-save-btn").style.display = "none";

          saveToast("Security settings saved!");
        } else {
          saveToast(res.message || "Failed to save", true);
        }
      } catch (err) {
        saveToast("Network error", true);
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      fetchSecuritySettings();
      fetchSessions();
    });
  