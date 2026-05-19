import { Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage } from './auth/LandingPage';
import { InvitePage } from './auth/InvitePage';
import { RolePicker } from './auth/RolePicker';
import { SettingsPage } from './auth/SettingsPage';
import { RequireRole } from './auth/RequireRole';
import { TrainerLayout } from './trainer/TrainerLayout';
import { StudentLayout } from './student/StudentLayout';
import { TourPage } from './marketing/TourPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/role-picker" element={<RolePicker />} />
      <Route path="/tour" element={<TourPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route
        path="/settings"
        element={
          <RequireRole anyOf={['trainer', 'student', 'self']}>
            <SettingsPage />
          </RequireRole>
        }
      />
      <Route
        path="/trainer/*"
        element={
          <RequireRole anyOf={['trainer', 'self']}>
            <TrainerLayout />
          </RequireRole>
        }
      />
      <Route
        path="/student/*"
        element={
          <RequireRole anyOf={['trainer', 'student', 'self']}>
            <StudentLayout />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
