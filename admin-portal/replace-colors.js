const fs = require('fs');
const path = require('path');

const directoryPath = 'a:/PRO-CC/admin-portal';

// 1. Process CSS File
const cssFile = path.join(directoryPath, 'assets', 'css', 'admin-shared.css');
let cssContent = fs.readFileSync(cssFile, 'utf8');

// Add root variables if not exist
if (!cssContent.includes('--bg-stat-icon-1: #f0eeff;')) {
  cssContent = cssContent.replace(':root {', `:root {
  --bg-stat-icon-1: #f0eeff;
  --bg-stat-icon-2: #fff8e6;
  --bg-stat-icon-3: #fff0ee;
  --bg-stat-icon-4: #e8faf6;`);
}

// Replace in CSS
cssContent = cssContent.replace(/background:\s*#f0eeff/g, 'background: var(--bg-stat-icon-1)');
cssContent = cssContent.replace(/background:\s*#fff8e6/g, 'background: var(--bg-stat-icon-2)');
cssContent = cssContent.replace(/background:\s*#fff0ee/g, 'background: var(--bg-stat-icon-3)');
cssContent = cssContent.replace(/background:\s*#e8faf6/g, 'background: var(--bg-stat-icon-4)');

fs.writeFileSync(cssFile, cssContent);

// 2. Process HTML Files
fs.readdirSync(directoryPath).forEach(file => {
  if (file.endsWith('.html')) {
    const filePath = path.join(directoryPath, file);
    let htmlContent = fs.readFileSync(filePath, 'utf8');

    htmlContent = htmlContent.replace(/#f0eeff/g, 'var(--bg-stat-icon-1)');
    htmlContent = htmlContent.replace(/#fff8e6/g, 'var(--bg-stat-icon-2)');
    htmlContent = htmlContent.replace(/#fff0ee/g, 'var(--bg-stat-icon-3)');
    htmlContent = htmlContent.replace(/#e8faf6/g, 'var(--bg-stat-icon-4)');

    fs.writeFileSync(filePath, htmlContent);
    console.log('Updated Colors in HTML File:', filePath);
  }
});

console.log('Color replacement script completed.');
