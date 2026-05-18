import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { WorkspaceSwitch } from '../auth/WorkspaceSwitch';
import { UserMenu } from '../auth/UserMenu';
import { DashboardPage } from './DashboardPage';
import { OpeningStudyViewer } from './OpeningStudyViewer';
import { GameStudyViewer } from './GameStudyViewer';
import { useKeyboardNav } from '../hooks/useKeyboardNav';

export function StudentLayout() {
  useKeyboardNav();
  const loc = useLocation();
  return (
    <div className="min-h-screen">
      <nav className="px-6 py-3 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur flex items-center gap-6 sticky top-0 z-30">
        <div className="font-semibold tracking-tight">
          Prax<span className="text-amber-400">is</span>
        </div>
        <WorkspaceSwitch />
        <Link
          to="/student/dashboard"
          className={
            loc.pathname.startsWith('/student/dashboard') ? 'text-amber-400' : 'text-zinc-300'
          }
        >
          Dashboard
        </Link>
        <div className="ml-auto">
          <UserMenu />
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
