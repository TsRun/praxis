import type { Role } from '../lib/api';

/**
 * Where does this user belong by default after signing in?
 * - Has 'trainer' or 'self' role → trainer workspace (where they author studies)
 * - Otherwise (student-only) → student dashboard
 */
export function defaultLandingForRoles(roles: Role[]): string {
  if (roles.includes('trainer') || roles.includes('self')) return '/trainer';
  return '/student';
}
