const isLocalDev = window.location.port === '5500' || window.location.protocol === 'file:' || window.location.port === '8080';

export const API_BASE = isLocalDev ? 'http://127.0.0.1:3030/api' : '/api';
export const SERVER_BASE = isLocalDev ? 'http://127.0.0.1:3030' : '';

export function resolveImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  
  const base = SERVER_BASE.endsWith('/') ? SERVER_BASE.slice(0, -1) : SERVER_BASE;
  const relativePath = path.startsWith('/') ? path : '/' + path;
  return base + relativePath;
}

export function getAuthHeaders() {
  const token = localStorage.getItem('parent_token');
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (window.location.hostname.includes('ngrok') || API_BASE.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }
  
  return headers;
}

export async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = getAuthHeaders();
  
  if (options.headers) {
    Object.assign(headers, options.headers);
  }
  
  // Handle FormData
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }
  
  const config = {
    ...options,
    headers
  };
  
  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    return { status: 500, data: { success: false, message: 'Network error occurred' } };
  }
}
