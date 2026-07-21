/* =========================================================
   CAMPUS CONNECT — AUTH.JS
   Unified Authentication Guard and Context initialization.
   ========================================================= */

(function initAuthGuard() {
  const token = localStorage.getItem('executive_token');
  const userStr = localStorage.getItem('executive_user');
  
  // Get active page
  const path = window.location.pathname;
  const isLoginPage = path.endsWith('index.html') || path.endsWith('/') || path.endsWith('login.html');

  if (!token || !userStr) {
    if (!isLoginPage) {
      window.location.replace('index.html');
    }
  } else {
    // Session exists
    try {
      const user = JSON.parse(userStr);
      window.currentUser = user;
      
      // Dynamic Role determination
      const designation = (user.designation || '').toLowerCase();
      if (designation.includes('dean')) {
        window.currentRole = 'dean';
      } else if (designation.includes('principal')) {
        window.currentRole = 'principal';
      } else if (designation.includes('director')) {
        window.currentRole = 'director';
      } else {
        // Fallback or unauthorized
        console.warn('Unknown designation:', designation);
        window.currentRole = 'dean'; // fallback
      }

      // If logged in and on login page, send directly to dashboard
      if (isLoginPage) {
        window.location.replace('dashboard.html');
      }
    } catch (e) {
      console.error('Error parsing session data', e);
      localStorage.clear();
      if (!isLoginPage) {
        window.location.replace('index.html');
      }
    }
  }
})();

function performLogout() {
  localStorage.removeItem('executive_token');
  localStorage.removeItem('executive_user');
  window.location.replace('index.html');
}
