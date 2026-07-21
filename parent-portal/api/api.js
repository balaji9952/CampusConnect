const isLocalDev = window.location.port === '5500' || window.location.protocol === 'file:';
const API_BASE = isLocalDev ? 'http://127.0.0.1:3030/api' : '/api';
const SERVER_BASE = isLocalDev ? 'http://127.0.0.1:3030' : '';

function resolveImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  const base = SERVER_BASE.endsWith('/') ? SERVER_BASE.slice(0, -1) : SERVER_BASE;
  const relativePath = path.startsWith('/') ? path : '/' + path;
  return base + relativePath;
}

const originalFetch = window.fetch;
window.fetch = async function (resource, options = {}) {
  // Resolve relative image URLs if someone fetches them directly
  if (typeof resource === 'string' && resource.startsWith('/uploads')) {
    resource = SERVER_BASE + resource;
  }

  // Inject ngrok bypass header for API calls
  if (typeof resource === 'string' && (resource.includes('ngrok') || API_BASE.includes('ngrok'))) {
    options.headers = options.headers || {};
    if (options.headers instanceof Headers) {
      options.headers.append('ngrok-skip-browser-warning', 'true');
    } else {
      options.headers['ngrok-skip-browser-warning'] = 'true';
    }
  }

  return originalFetch(resource, options);
};

class ApiService {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getHeaders(isMultipart = false) {
    const headers = {};
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async _fetch(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;

    // Add default headers unless specified otherwise
    if (!options.headers) {
      options.headers = this.getHeaders(options.body instanceof FormData);
    } else {
      const authHeader = this.getHeaders(options.body instanceof FormData);
      if (authHeader.Authorization) {
        options.headers['Authorization'] = authHeader.Authorization;
      }
    }

    try {
      const response = await fetch(url, options);

      // Handle Unauthorized/Expired token
      if (response.status === 401 || response.status === 403) {
        this.setToken(null);
        if (window.location.hash !== '' && window.location.hash !== '#lang-view' && window.location.hash !== '#welcome-view') {
          // If in app view, force redirect to welcome view or show toast
          if (typeof appShowToast === 'function') {
            appShowToast('Session expired. Please log in again.', 'error');
          }
          if (typeof navigateTo === 'function') {
            navigateTo('welcome-view');
          }
        }
      }

      const json = await response.json();
      return { status: response.status, data: json };
    } catch (error) {
      console.error(`API Error on ${endpoint}:`, error);
      return { status: 500, data: { success: false, message: 'Network connection error' } };
    }
  }

  // --- AUTHENTICATION ---
  async login(identifier, password) {
    const res = await this._fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, role: 2 })
    });
    if (res.data.success && res.data.data.token) {
      this.setToken(res.data.data.token);
    }
    return res;
  }

  async googleLogin(credential) {
    const res = await this._fetch('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential })
    });
    if (res.data.success && res.data.data.token) {
      this.setToken(res.data.data.token);
    }
    return res;
  }

  async getConfig() {
    return await this._fetch('/auth/config');
  }

  logout() {
    this.setToken(null);
  }

  isLoggedIn() {
    return !!this.token;
  }

  // --- DASHBOARD ---
  async getDashboard() {
    return await this._fetch('/dashboard/stats');
  }

  // --- TICKETS ---
  async getTickets() {
    return await this._fetch('/tickets');
  }

  async getTicketById(id) {
    return await this._fetch(`/tickets/${id}`);
  }

  async createTicket(payload) {
    return await this._fetch('/tickets', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async uploadTicketPhoto(id, formData) {
    return await this._fetch(`/tickets/${id}/photo`, {
      method: 'POST',
      body: formData // Content-Type is intentionally omitted for FormData
    });
  }

  // --- LOOKUPS ---
  async getCategories() {
    return await this._fetch('/categories');
  }

  async getLocations() {
    return await this._fetch('/locations');
  }

  // --- NOTIFICATIONS ---
  async getNotifications() {
    return await this._fetch('/notifications');
  }

  async markNotificationRead(id) {
    return await this._fetch(`/notifications/${id}/read`, {
      method: 'PUT'
    });
  }

  // --- PROFILE ---
  async getProfile() {
    return await this._fetch('/users/me');
  }

  async updateProfile(payload) {
    return await this._fetch('/users/me', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  async changePassword(currentPassword, newPassword, confirmPassword) {
    return await this._fetch('/users/me/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });
  }
}

// Instantiate globally
window.api = new ApiService();
