// theme.js
function getThemePreference() {
  const savedTheme = localStorage.getItem('admin-theme');
  if (savedTheme) {
    return savedTheme;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) {
    if (theme === 'dark') {
      toggleBtn.innerHTML = '<i class="ti ti-sun"></i>';
    } else {
      toggleBtn.innerHTML = '<i class="ti ti-moon"></i>';
    }
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('admin-theme', newTheme);
  applyTheme(newTheme);
}

// Apply immediately before FOUC
applyTheme(getThemePreference());

// Listen for system changes if no saved theme
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('admin-theme')) {
    applyTheme(e.matches ? 'dark' : 'light');
  }
});
