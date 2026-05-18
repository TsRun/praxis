import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { WorkspaceSwitch } from '../auth/WorkspaceSwitch';
import { UserMenu } from '../auth/UserMenu';

export function TrainerNav() {
  const { user } = useAuth();
  const loc = useLocation();
  const active = (p: string) => (loc.pathname.startsWith(p) ? 'text-amber-400' : 'text-zinc-300');
  const isTrainer = user?.roles.includes('trainer') ?? false;
  return (
    <nav className="px-6 py-3 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur flex items-center gap-6 sticky top-0 z-30">
      <div className="font-semibold tracking-tight">
        Prax<span className="text-amber-400">is</span>
      </div>
      <WorkspaceSwitch />
      <Link to="/trainer/studies" className={active('/trainer/studies')}>
        Studies
      </Link>
      {isTrainer && (
        <Link to="/trainer/students" className={active('/trainer/students')}>
          Students
        </Link>
      )}
      <div className="ml-auto">
        <UserMenu />
      </div>
    </nav>
  );
}
