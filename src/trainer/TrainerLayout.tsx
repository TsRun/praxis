import { Navigate, Route, Routes } from 'react-router-dom';
import { TrainerNav } from './TrainerNav';
import { StudentsPage } from './StudentsPage';
import { StudentDetailPage } from './StudentDetailPage';
import { StudiesPage } from './StudiesPage';
import { OpeningStudyEditor } from './OpeningStudyEditor';
import { GameStudyEditor } from './GameStudyEditor';
import { useKeyboardNav } from '../hooks/useKeyboardNav';

export function TrainerLayout() {
  useKeyboardNav();
  return (
    <div className="min-h-screen">
      <TrainerNav />
      <main className="p-6 max-w-7xl mx-auto">
        <Routes>
          <Route path="students" element={<StudentsPage />} />
          <Route path="students/:id" element={<StudentDetailPage />} />
          <Route path="studies" element={<StudiesPage />} />
          <Route path="studies/opening/:id" element={<OpeningStudyEditor />} />
          <Route path="studies/game/:id" element={<GameStudyEditor />} />
          <Route path="*" element={<Navigate to="students" replace />} />
        </Routes>
      </main>
    </div>
  );
}
