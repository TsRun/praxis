import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Segmented control between the two workspaces:
 *   Coach   → /trainer (visible if user has 'trainer' or 'self' role)
 *   Student → /student (visible if user has 'student' role)
 *
 * If only one workspace is available we just hide the switch — no point
 * showing a one-option toggle.
 */
export function WorkspaceSwitch() {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return null;

  const canCoach = user.roles.includes('trainer') || user.roles.includes('self');
  const canStudent = user.roles.includes('student');
  if (!(canCoach && canStudent)) return null;

  const inCoach = loc.pathname.startsWith('/trainer');
  const inStudent = loc.pathname.startsWith('/student');

  return (
    <div
      role="tablist"
      aria-label="Switch workspace"
      className="inline-flex bg-zinc-900/60 ring-1 ring-zinc-800 rounded-lg overflow-hidden text-xs"
    >
      <Link
        to="/trainer"
        role="tab"
        aria-selected={inCoach}
        className={`px-3 py-1 transition-colors ${
          inCoach
            ? 'bg-amber-400/15 text-amber-200'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
        }`}
      >
        Coach
      </Link>
      <Link
        to="/student"
        role="tab"
        aria-selected={inStudent}
        className={`px-3 py-1 transition-colors ${
          inStudent
            ? 'bg-amber-400/15 text-amber-200'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
        }`}
      >
        Student
      </Link>
    </div>
  );
}
