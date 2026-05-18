import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function TrainerNav() {
  const { user, signout } = useAuth();
  const loc = useLocation();
  const active = (p: string) => (loc.pathname.startsWith(p) ? 'text-amber-400' : 'text-zinc-300');
  const isTrainer = user?.roles.includes('trainer') ?? false;
  const isStudent = user?.roles.includes('student') ?? false;
  return (
    <nav className="px-6 py-3 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur flex items-center gap-6 sticky top-0 z-30">
      <div className="font-semibold tracking-tight">
        Chess<span className="text-amber-400">Coach</span>
      </div>
      {isTrainer && (
        <Link to="/trainer/students" className={active('/trainer/students')}>
          Students
        </Link>
      )}
      <Link to="/trainer/studies" className={active('/trainer/studies')}>
        Studies
      </Link>
      {isStudent && (
        <Link to="/student/dashboard" className={active('/student')}>
          My studies
        </Link>
      )}
      <div className="ml-auto flex items-center gap-3 text-sm">
        <span className="text-zinc-400">{user?.name}</span>
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
          {user?.roles.join(' · ')}
        </span>
        <button onClick={signout} className="text-zinc-400 hover:text-amber-400">
          sign out
        </button>
      </div>
    </nav>
  );
}
