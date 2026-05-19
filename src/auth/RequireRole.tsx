import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { Role } from '../lib/api';
import { defaultLandingForRoles } from './routing';

interface Props {
  /** Pass any role(s) and the user passes if they have at least one. */
  anyOf: Role[];
  children: ReactNode;
}

export function RequireRole({ anyOf, children }: Props) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-8 text-zinc-500">Loading…</div>;
  if (!user) return <Navigate to="/" state={{ from: loc.pathname }} replace />;
  // First-time OAuth users land here with empty roles[] — send them to the
  // picker before they can use any role-gated area.
  if (user.roles.length === 0) return <Navigate to="/role-picker" replace />;
  const ok = anyOf.some((r) => user.roles.includes(r));
  if (!ok) return <Navigate to={defaultLandingForRoles(user.roles)} replace />;
  return <>{children}</>;
}
