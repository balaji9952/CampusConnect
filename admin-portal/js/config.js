// config.js
// Centralized API configuration — relative paths for Nginx reverse proxy deployment.
// All /api/* requests are routed by Nginx to http://localhost:3019.
// All /uploads/* requests are proxied by Nginx to the backend's upload directory.

export const API_BASE = '/api';

// resolveImageUrl — converts backend-returned paths to browser-usable URLs.
// The backend returns paths like "/uploads/photos/xxx.jpg" or full CDN URLs.
// Since the frontend is served through Nginx on the same origin, relative paths
// resolve correctly without any absolute prefix.
export function resolveImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  
  return path.startsWith('/') ? path : '/' + path;
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

