import { fetchApi } from './api.js';

export function getToken() {
  return localStorage.getItem('parent_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('parent_token', token);
  } else {
    localStorage.removeItem('parent_token');
  }
}

export function isLoggedIn() {
  return !!getToken();
}

export async function login(identifier, password) {
  const res = await fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password, role: 2 })
  });
  if (res.status === 200 && res.data.success && res.data.data.token) {
    setToken(res.data.data.token);
    localStorage.setItem('parent_user', JSON.stringify(res.data.data.user));
  }
  return res;
}

export async function googleLogin(credential) {
  const res = await fetchApi('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential })
  });
  if (res.status === 200 && res.data.success && res.data.data.token) {
    setToken(res.data.data.token);
    localStorage.setItem('parent_user', JSON.stringify(res.data.data.user));
  }
  return res;
}

export function logout() {
  setToken(null);
  localStorage.removeItem('parent_user');
  window.location.href = 'index.html';
}

export function checkAuthentication() {
  if (!isLoggedIn()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

export async function getProfile() {
  return await fetchApi('/users/me');
}
