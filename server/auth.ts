import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';

export type Role = 'trainer' | 'student' | 'self';
export const ALL_ROLES: Role[] = ['trainer', 'student', 'self'];

// OWASP (2023+) recommends cost ≥ 12 for bcrypt on modern hardware.
const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function newToken(): string {
  return randomBytes(32).toString('hex');
}

const SESSION_DAYS = 14;

export async function createSession(
  pool: Pool,
  userId: number,
): Promise<{ id: string; expiresAt: Date }> {
  const id = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(`INSERT INTO session (id, user_id, expires_at) VALUES ($1, $2, $3)`, [
    id,
    userId,
    expiresAt,
  ]);
  return { id, expiresAt };
}

export interface UserRecord {
  id: number;
  email: string;
  name: string;
  roles: Role[];
}

export async function lookupUserBySession(
  pool: Pool,
  sid: string | undefined,
): Promise<UserRecord | null> {
  if (!sid) return null;
  const { rows } = await pool.query<UserRecord>(
    `SELECT u.id, u.email, u.name, u.roles
       FROM session s
       JOIN app_user u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > NOW()`,
    [sid],
  );
  return rows[0] ?? null;
}

export async function deleteSession(pool: Pool, id: string | undefined): Promise<void> {
  if (!id) return;
  await pool.query(`DELETE FROM session WHERE id = $1`, [id]);
}

export function normalizeRoles(input: unknown): Role[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<Role>();
  for (const r of input) {
    if (typeof r === 'string' && ALL_ROLES.includes(r as Role)) out.add(r as Role);
  }
  return [...out];
}
