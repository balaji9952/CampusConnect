import prisma from '../utils/prisma';

/**
 * In-memory cache for designations — avoids hitting the DB on every request.
 * Refreshes when designations are updated.
 */
interface DesignationRecord {
  name: string;
  is_privileged: boolean;
  is_hod: boolean;
  can_escalate: boolean;
  escalation_level: number | null;
}

interface DesignationCache {
  designations: DesignationRecord[];
  /** Unix ms timestamp of last fetch */
  loadedAt: number;
}

let cache: DesignationCache = { designations: [], loadedAt: 0 };
const CACHE_TTL_MS = 60_000; // 1 minute — safe for real-time admin changes

function isCacheStale(): boolean {
  return Date.now() - cache.loadedAt > CACHE_TTL_MS;
}

async function loadCache(): Promise<DesignationRecord[]> {
  const rows = await prisma.designations.findMany({
    where: { is_active: true },
    select: {
      name: true,
      is_privileged: true,
      is_hod: true,
      can_escalate: true,
      escalation_level: true,
    },
    orderBy: { name: 'asc' },
  });

  cache = { designations: rows, loadedAt: Date.now() };
  return rows;
}

export class DesignationsService {
  // ─── Public helpers (cached) ─────────────────────────────────────────────

  /**
   * Returns true if the given designation name marks a user as privileged
   * (can see all tickets, acts as Admin-level).
   * Falls back to false for unknown designations.
   */
  static isPrivileged(designation: string | null | undefined): boolean {
    if (!designation) return false;
    if (isCacheStale()) {
      loadCache().catch(err => console.error('[DesignationsService] loadCache background error:', err));
    }
    return cache.designations.some(d => d.is_privileged && d.name === designation);
  }

  /**
   * Returns true if the given designation name marks a user as HOD.
   */
  static isHOD(designation: string | null | undefined): boolean {
    if (!designation) return false;
    if (isCacheStale()) {
      loadCache().catch(err => console.error('[DesignationsService] loadCache background error:', err));
    }
    return cache.designations.some(d => d.is_hod && d.name === designation);
  }

  /**
   * Returns true if the given designation is allowed to be an escalation target.
   */
  static canEscalate(designation: string | null | undefined): boolean {
    if (!designation) return false;
    if (isCacheStale()) {
      loadCache().catch(err => console.error('[DesignationsService] loadCache background error:', err));
    }
    return cache.designations.some(d => d.can_escalate && d.name === designation);
  }

  /**
   * Returns the escalation level (1, 2, or 3) for a given designation,
   * or null if it is not an escalation target.
   */
  static getEscalationLevel(designation: string | null | undefined): number | null {
    if (!designation) return null;
    if (isCacheStale()) {
      loadCache().catch(err => console.error('[DesignationsService] loadCache background error:', err));
    }
    const match = cache.designations.find(d => d.name === designation && d.can_escalate);
    return match?.escalation_level ?? null;
  }

  /**
   * Returns all designations that have can_escalate = true for a given level.
   */
  static async getEscalationTargets(level: 2 | 3): Promise<DesignationRecord[]> {
    if (isCacheStale()) await loadCache();
    return cache.designations.filter(d => d.can_escalate && d.escalation_level === level);
  }

  /**
   * Returns a Prisma "where" filter for finding users by escalation level designation.
   */
  static async getEscalationUserWhere(level: 2 | 3): Promise<{ designation: { in: string[] } }> {
    const targets = await this.getEscalationTargets(level);
    const names = targets.map(t => t.name);
    return { designation: { in: names } };
  }

  // ─── Admin CRUD ────────────────────────────────────────────────────────────

  /**
   * Returns all designations (including inactive ones for the admin panel).
   */
  static async getAll(includeInactive = false) {
    return prisma.designations.findMany({
      where: includeInactive ? {} : { is_active: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Creates a new designation. Throws if name already exists.
   */
  static async create(data: {
    name: string;
    description?: string;
    is_privileged?: boolean;
    is_hod?: boolean;
    can_escalate?: boolean;
    escalation_level?: number | null;
  }) {
    const result = await prisma.designations.create({ data });
    this.invalidateCache();
    return result;
  }

  /**
   * Updates an existing designation by name (unique key).
   */
  static async update(name: string, data: Partial<{
    description: string;
    is_privileged: boolean;
    is_hod: boolean;
    can_escalate: boolean;
    escalation_level: number | null;
    is_active: boolean;
  }>) {
    const result = await prisma.designations.update({
      where: { name },
      data,
    });
    this.invalidateCache();
    return result;
  }

  /**
   * Deletes a designation by name. Only succeeds if no users use this designation.
   */
  static async delete(name: string) {
    // Check for users using this designation
    const userCount = await prisma.users.count({ where: { designation: name } });
    if (userCount > 0) {
      throw new Error(`Cannot delete designation "${name}" — ${userCount} user(s) are still using it. Reassign them first.`);
    }
    await prisma.designations.delete({ where: { name } });
    this.invalidateCache();
  }

  /** Invalidates the in-memory cache. Call after any write operation. */
  static invalidateCache() {
    cache.loadedAt = 0; // Mark as stale
    loadCache().catch(err => console.error('[DesignationsService] invalidateCache background load error:', err));
  }

  /** Forces a synchronous cache refresh (useful after bulk seed operations). */
  static async warmCache() {
    await loadCache();
  }
}
