// config.js
// Centralized API configuration — supports Local Development, Nginx Proxy, and Production.
const isStandaloneStaticDev = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  && (window.location.port === '8000' || window.location.port === '5500' || window.location.port === '3000' || window.location.port === '5000');

export const API_BASE = isStandaloneStaticDev
  ? 'http://localhost:3019/api'
  : 'https://campusconnect-nbeb.onrender.com/api';

// resolveImageUrl — converts backend-returned paths to browser-usable URLs.
export function resolveImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  
  const baseUrl = isStandaloneStaticDev
    ? 'http://localhost:3019'
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

