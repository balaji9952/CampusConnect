const fs = require('fs');
const path = require('path');

const directoryPath = 'a:/PRO-CC/admin-portal';

// 1. Process CSS File
const cssFile = path.join(directoryPath, 'assets', 'css', 'admin-shared.css');
let cssContent = fs.readFileSync(cssFile, 'utf8');

const darkThemeVars = `
[data-theme="dark"] {
  --primary: #818cf8;
  --primary-light: #a5b4fc;
  --primary-bg: rgba(99, 102, 241, 0.15);
  --bg: #0f172a;
  --bg-card: #1e293b;
  --bg-sidebar: #1e293b;
  --bg-topbar: rgba(30, 41, 59, 0.92);
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-hint: #64748b;
  --border: #334155;
  --shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 40px rgba(0, 0, 0, 0.4);
  
  --bg-admin-card: #0f172a;
  --bg-nav-hover: rgba(255, 255, 255, 0.05);
  --bg-nav-active: rgba(99, 102, 241, 0.15);
  
  /* Component overrides */
  --bg-stat-icon-1: rgba(99, 102, 241, 0.15);
  --bg-stat-icon-2: rgba(212, 160, 23, 0.15);
  --bg-stat-icon-3: rgba(225, 112, 85, 0.15);
  --bg-stat-icon-4: rgba(0, 184, 148, 0.15);
}

body {
  transition: background-color 0.3s ease, color 0.3s ease;
}

* {
  transition: background-color 0.3s ease, border-color 0.3s ease;
}
`;

if (!cssContent.includes('[data-theme="dark"]')) {
  cssContent += darkThemeVars;
  
  // Replace hardcoded values in CSS
  cssContent = cssContent.replace(
    /\.sidebar\s*\{[^}]*background:\s*#ffffff;/g, 
    match => match.replace('#ffffff', 'var(--bg-sidebar)')
  );
  cssContent = cssContent.replace(
    /\.topbar\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.92\);/g, 
    match => match.replace('rgba(255, 255, 255, 0.92)', 'var(--bg-topbar)')
  );
  cssContent = cssContent.replace(
    /\.admin-card\s*\{[^}]*background:\s*#f8f9ff;/g, 
    match => match.replace('#f8f9ff', 'var(--bg-admin-card)')
  );
  cssContent = cssContent.replace(
    /\.nav-item:hover\s*\{[^}]*background:\s*#f5f7ff;/g, 
    match => match.replace('#f5f7ff', 'var(--bg-nav-hover)')
  );
  cssContent = cssContent.replace(
    /\.nav-item\.active\s*\{[^}]*background:\s*#eef2ff;/g, 
    match => match.replace('#eef2ff', 'var(--bg-nav-active)')
  );
  // Add dark mode toggle button styling
  cssContent += `
.btn-theme-toggle {
  width: 38px;
  height: 38px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: transparent;
  color: var(--text-secondary);
  border: 1.5px solid var(--border);
  cursor: pointer;
  transition: all .2s;
  font-size: 18px;
}
.btn-theme-toggle:hover {
  background: var(--bg);
  color: var(--primary);
  border-color: var(--primary);
}
`;
  
  fs.writeFileSync(cssFile, cssContent);
  console.log('Updated CSS File:', cssFile);
}

// 2. Process HTML Files
fs.readdirSync(directoryPath).forEach(file => {
  if (file.endsWith('.html')) {
    const filePath = path.join(directoryPath, file);
    let htmlContent = fs.readFileSync(filePath, 'utf8');

    let modified = false;

    // Inject JS into head if not exists
    if (!htmlContent.includes('<script src="assets/js/theme.js"></script>')) {
      htmlContent = htmlContent.replace(
        '</head>',
        '  <script src="assets/js/theme.js"></script>\n</head>'
      );
      modified = true;
    }

    // Inject toggle button into .topbar-actions if not exists
    if (htmlContent.includes('<div class="topbar-actions">') && !htmlContent.includes('id="theme-toggle-btn"')) {
      htmlContent = htmlContent.replace(
        '<div class="topbar-actions">',
        `<div class="topbar-actions">\n        <button id="theme-toggle-btn" class="btn-theme-toggle" onclick="toggleTheme()" title="Toggle Dark Mode">\n          <i class="ti ti-moon"></i>\n        </button>`
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, htmlContent);
      console.log('Updated HTML File:', filePath);
    }
  }
});

console.log('Theme injection script completed.');
