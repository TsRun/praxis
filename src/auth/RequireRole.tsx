import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface Props {
  role: 'trainer' | 'student';
  children: ReactNode;
}

export function RequireRole({ role, children }: Props) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-8 text-zinc-500">Loading…</div>;
  if (!user) return <Navigate to="/" state={{ from: loc.pathname }} replace />;
  if (user.kind !== role) return <Navigate to={user.kind === 'trainer' ? '/trainer' : '/student'} replace />;
  return <>{children}</>;
}
