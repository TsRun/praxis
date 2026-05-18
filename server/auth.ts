import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function newToken(): string {
  return randomBytes(32).toString('hex');
}

const SESSION_DAYS = 30;

export async function createSession(
  pool: Pool,
  userKind: 'trainer' | 'student',
  userId: number,
): Promise<{ id: string; expiresAt: Date }> {
  const id = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO session (id, user_kind, user_id, expires_at) VALUES ($1, $2, $3, $4)`,
    [id, userKind, userId, expiresAt],
  );
  return { id, expiresAt };
}

export interface SessionRow {
  user_kind: 'trainer' | 'student';
  user_id: number;
}

export async function lookupSession(pool: Pool, id: string | undefined): Promise<SessionRow | null> {
  if (!id) return null;
  const { rows } = await pool.query<SessionRow>(
    `SELECT user_kind, user_id FROM session WHERE id = $1 AND expires_at > NOW()`,
    [id],
  );
  return rows[0] ?? null;
}

export async function deleteSession(pool: Pool, id: string | undefined): Promise<void> {
  if (!id) return;
  await pool.query(`DELETE FROM session WHERE id = $1`, [id]);
}
