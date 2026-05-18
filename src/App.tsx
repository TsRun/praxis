import { Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage } from './auth/LandingPage';
import { InvitePage } from './auth/InvitePage';
import { RequireRole } from './auth/RequireRole';
import { TrainerLayout } from './trainer/TrainerLayout';
import { StudentLayout } from './student/StudentLayout';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route
        path="/trainer/*"
        element={
          <RequireRole role="trainer">
            <TrainerLayout />
          </RequireRole>
        }
      />
      <Route
        path="/student/*"
        element={
          <RequireRole role="student">
            <StudentLayout />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
