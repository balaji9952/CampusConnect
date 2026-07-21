export function isAdminRole(role: unknown): boolean {
  if (typeof role === 'number') {
    return role === 3 || role === 4;
  }

  if (typeof role !== 'string') {
    return false;
  }

  const normalized = role.trim().toLowerCase();
  return normalized === 'admin' || normalized === 'super admin' || normalized === 'super_admin';
}
