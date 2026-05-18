import { Navigate } from 'react-router-dom';
import { SignInUpForm } from './SignInUpForm';
import { useAuth } from './AuthContext';
import { defaultLandingForRoles } from './routing';

export function LandingPage() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-zinc-500">Loading…</div>;
  if (user) return <Navigate to={defaultLandingForRoles(user.roles)} replace />;
  return (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <div className="max-w-3xl flex flex-col gap-10 items-center text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          Prax<span className="text-amber-400">is</span>
        </h1>
        <p className="text-zinc-400 max-w-lg">
          Build chess studies. Coach others, learn from a coach, or work
          through your own materials solo — pick whatever roles fit.
        </p>
        <div className="panel p-8">
          <SignInUpForm />
        </div>
      </div>
    </div>
  );
}
