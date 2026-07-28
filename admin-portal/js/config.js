// config.js
// Centralized API configuration — supports both Local Development and Render Production.
export const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3019/api'
  : 'https://campusconnect-nbeb.onrender.com/api';

// resolveImageUrl — converts backend-returned paths to browser-usable URLs.
export function resolveImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  
  const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''
    : 'https://campusconnect-nbeb.onrender.com';

  return path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
}

// Helper for standard authenticated headers
export function getAuthHeaders() {
  const token = localStorage.getItem('admin_token');
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

