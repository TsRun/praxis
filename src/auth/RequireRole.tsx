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
  const ok = anyOf.some((r) => user.roles.includes(r));
  if (!ok) return <Navigate to={defaultLandingForRoles(user.roles)} replace />;
  return <>{children}</>;
}
