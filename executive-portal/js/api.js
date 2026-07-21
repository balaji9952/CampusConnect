/* =========================================================
   CAMPUS CONNECT — API.JS
   Unified API clients for Dean, Director, and Principal.
   Interacts with real Express + Prisma + PostgreSQL backend.
   ========================================================= */

const isLocalDev = window.location.port === '5500' || window.location.port === '3000' || window.location.protocol === 'file:';
const API_BASE = isLocalDev ? 'http://127.0.0.1:3030/api' : '/api';
const SERVER_BASE = isLocalDev ? 'http://127.0.0.1:3030' : '';

// Map frontend status strings to backend integers
const STATUS_MAP = {
  'open': 0,
  'in-progress': 1,
  'resolved': 2,
  'closed': 4,
  0: 'open',
  1: 'in-progress',
  2: 'resolved',
  4: 'closed'
};

function getAuthHeaders(extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...extraHeaders
  };
  const token = localStorage.getItem('executive_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

const API = {
  // Auth
  async login(username, password) {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: username,
          password: password,
          role: 1 // Staff role
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Login failed. Invalid credentials.');
      }
      return { success: true, token: data.token, user: data.user };
    } catch (error) {
      console.error('[API.login] Error:', error);
      return { success: false, message: error.message };
    }
  },

  // Stats
  async getStats() {
    try {
      const response = await fetch(`${API_BASE}/dashboard/stats`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch dashboard stats.');
      return data.success ? data : { success: true, ...data };
    } catch (error) {
      console.error('[API.getStats] Error:', error);
      // Return empty stats as fallback to prevent crash
      return {
        success: false,
        totalTickets: 0,
        openTickets: 0,
        inProgressTickets: 0,
        resolvedTickets: 0,
        escalatedTickets: 0,
        level1Tickets: 0,
        level2Tickets: 0,
        level3Tickets: 0,
        ticketsByCategory: [],
        ticketsByLocation: []
      };
    }
  },

  // Tickets
  async getTickets(params = {}) {
    try {
      const query = new URLSearchParams();
      // Fetch up to 1000 tickets to filter locally or paginate
      query.append('limit', '1000');
      
      if (params.status !== undefined) query.append('status', params.status);
      if (params.priority !== undefined) query.append('priority', params.priority);
      if (params.category_id !== undefined) query.append('category_id', params.category_id);
      if (params.location_id !== undefined) query.append('location_id', params.location_id);

      const response = await fetch(`${API_BASE}/tickets?${query.toString()}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch tickets.');
      return data; // { data: tickets[], pagination: {...}, success: true }
    } catch (error) {
      console.error('[API.getTickets] Error:', error);
      return { success: false, data: [] };
    }
  },

  async getTicketById(id) {
    try {
      const response = await fetch(`${API_BASE}/tickets/${id}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch ticket details.');
      return data.data;
    } catch (error) {
      console.error('[API.getTicketById] Error:', error);
      return null;
    }
  },

  async updateTicketStatus(id, statusStr, remarks) {
    try {
      const statusInt = STATUS_MAP[statusStr] !== undefined ? STATUS_MAP[statusStr] : 1;
      const response = await fetch(`${API_BASE}/tickets/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: statusInt,
          remarks: remarks || 'Status updated from executive console'
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update ticket status.');
      return { success: true, data: data.data };
    } catch (error) {
      console.error('[API.updateTicketStatus] Error:', error);
      return { success: false, message: error.message };
    }
  },

  // Notifications
  async getNotifications() {
    try {
      const response = await fetch(`${API_BASE}/notifications`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch notifications.');
      return data.data || [];
    } catch (error) {
      console.error('[API.getNotifications] Error:', error);
      return [];
    }
  },

  async getUnreadCount() {
    try {
      const response = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch unread count.');
      return data.data?.count || 0;
    } catch (error) {
      console.error('[API.getUnreadCount] Error:', error);
      return 0;
    }
  },

  async markNotificationRead(id) {
    try {
      const response = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to mark notification as read.');
      return true;
    } catch (error) {
      console.error('[API.markNotificationRead] Error:', error);
      return false;
    }
  },

  // Image Helper
  resolveImageUrl(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = SERVER_BASE.endsWith('/') ? SERVER_BASE.slice(0, -1) : SERVER_BASE;
    const relativePath = path.startsWith('/') ? path : '/' + path;
    return base + relativePath;
  }
};
