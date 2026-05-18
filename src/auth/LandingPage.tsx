import { Navigate } from 'react-router-dom';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { useAuth } from './AuthContext';

export function LandingPage() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-zinc-500">Loading…</div>;
  if (user) return <Navigate to={user.kind === 'trainer' ? '/trainer' : '/student'} replace />;
  return (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <div className="max-w-3xl flex flex-col gap-10 items-center text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          Chess<span className="text-amber-400">Coach</span>
        </h1>
        <p className="text-zinc-400 max-w-lg">
          Build opening studies and annotated game reviews for your students.
          Invite them by email, watch their progress.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 panel p-6">
          <SignInForm />
          <SignUpForm />
        </div>
      </div>
    </div>
  );
}
