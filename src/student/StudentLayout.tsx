import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { DashboardPage } from './DashboardPage';
import { OpeningStudyViewer } from './OpeningStudyViewer';
import { GameStudyViewer } from './GameStudyViewer';

export function StudentLayout() {
  const { user, signout } = useAuth();
  const loc = useLocation();
  return (
    <div className="min-h-screen">
      <nav className="px-6 py-3 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur flex items-center gap-6 sticky top-0 z-30">
        <div className="font-semibold tracking-tight">
          Chess<span className="text-amber-400">Coach</span>
        </div>
        <Link
          to="/student/dashboard"
          className={
            loc.pathname.startsWith('/student/dashboard') ? 'text-amber-400' : 'text-zinc-300'
          }
        >
          Dashboard
        </Link>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-zinc-400">{user?.name}</span>
          <button onClick={signout} className="text-zinc-400 hover:text-amber-400">
            sign out
          </button>
        </div>
      </nav>
      <main className="p-6 max-w-7xl mx-auto">
        <Routes>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="study/opening/:id" element={<OpeningStudyViewer />} />
          <Route path="study/game/:id" element={<GameStudyViewer />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
