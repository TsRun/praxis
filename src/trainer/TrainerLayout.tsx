import { Navigate, Route, Routes } from 'react-router-dom';
import { TopBar } from '../components/ui/TopBar';
import { StudentsPage } from './StudentsPage';
import { StudentDetailPage } from './StudentDetailPage';
import { StudiesPage } from './StudiesPage';
import { OpeningStudyEditor } from './OpeningStudyEditor';
import { GameStudyEditor } from './GameStudyEditor';
import { TacticSetPage } from './TacticSetPage';
import { TacticPuzzleEditor } from './TacticPuzzleEditor';
import { ImportGamesPage } from './ImportGamesPage';
import { useAuth } from '../auth/AuthContext';
import { useKeyboardNav } from '../hooks/useKeyboardNav';

export function TrainerLayout() {
  useKeyboardNav();
  const { user } = useAuth();
  const isTrainer = user?.roles.includes('trainer') ?? false;
  const links = [
    { to: '/trainer/studies', label: 'Studies', match: (p: string) => p.startsWith('/trainer/studies') },
    ...(isTrainer
      ? [
          {
            to: '/trainer/students',
            label: 'Students',
            match: (p: string) => p.startsWith('/trainer/students'),
          },
        ]
      : []),
  ];
  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar links={links} />
      <Routes>
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/:id" element={<StudentDetailPage />} />
        <Route path="studies" element={<StudiesPage />} />
        <Route path="studies/opening/:id" element={<OpeningStudyEditor />} />
        <Route path="studies/opening/:id/import" element={<ImportGamesPage />} />
        <Route path="studies/game/:id" element={<GameStudyEditor />} />
        <Route path="studies/tactic/:id" element={<TacticSetPage />} />
        <Route
          path="studies/tactic/:id/puzzles/:pid"
          element={<TacticPuzzleEditor />}
        />
        <Route path="*" element={<Navigate to="studies" replace />} />
      </Routes>
    </div>
  );
}
