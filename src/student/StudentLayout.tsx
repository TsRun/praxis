import { Navigate, Route, Routes } from 'react-router-dom';
import { TopBar } from '../components/ui/TopBar';
import { DashboardPage } from './DashboardPage';
import { OpeningStudyViewer } from './OpeningStudyViewer';
import { GameStudyViewer } from './GameStudyViewer';
import { TacticSetViewer } from './TacticSetViewer';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import { TOURNAMENT_NAV } from '../tournaments/nav';

export function StudentLayout() {
  useKeyboardNav();
  const links = [
    {
      to: '/student/dashboard',
      label: 'Dashboard',
      match: (p: string) => p.startsWith('/student/dashboard'),
    },
    ...TOURNAMENT_NAV,
  ];
  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar links={links} />
      <Routes>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="study/opening/:id" element={<OpeningStudyViewer />} />
        <Route path="study/game/:id" element={<GameStudyViewer />} />
        <Route path="study/tactic/:id" element={<TacticSetViewer />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </div>
  );
}
