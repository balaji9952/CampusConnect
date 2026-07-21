// config.js
// Centralized API configuration for network-agnostic operations

const isLocalDev = window.location.port === '5500' || window.location.protocol === 'file:';

// Default to relative /api unless in local dev mode
export const API_BASE = isLocalDev ? 'http://127.0.0.1:3030/api' : '/api';
export const SERVER_BASE = isLocalDev ? 'http://127.0.0.1:3030' : '';

// Helper to resolve images ensuring they work correctly on all networks
export function resolveImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  
  const base = SERVER_BASE.endsWith('/') ? SERVER_BASE.slice(0, -1) : SERVER_BASE;
  const relativePath = path.startsWith('/') ? path : '/' + path;
  return base + relativePath;
}

// Helper for standard authenticated headers (injects ngrok bypass if needed)
export function getAuthHeaders() {
  const token = localStorage.getItem('admin_token');
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Detect if ngrok is present in hostname or API_BASE
  if (window.location.hostname.includes('ngrok') || API_BASE.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }
  
  return headers;
}
