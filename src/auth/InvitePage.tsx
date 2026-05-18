import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { invites, type InviteInfo } from '../lib/api';
import { useAuth } from './AuthContext';
import { SignInUpForm } from './SignInUpForm';
import { defaultLandingForRoles } from './routing';

export function InvitePage() {
  const { token } = useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    invites
      .lookup(token)
      .then(setInfo)
      .catch((e) => setErr((e as Error).message));
  }, [token]);

  if (err) {
    return (
      <div className="min-h-screen grid place-items-center px-6 py-12">
        <div className="panel p-8 text-red-400 text-sm">{err}</div>
      </div>
    );
  }
  if (!info || loading) {
    return (
      <div className="min-h-screen grid place-items-center px-6 py-12">
        <div className="panel p-8 text-zinc-500">Loading invite…</div>
      </div>
    );
  }

  // If the user is already signed in with a matching email, offer one-click link.
  if (user && user.email === info.student_email) {
    return (
      <div className="min-h-screen grid place-items-center px-6 py-12">
        <div className="panel p-8 flex flex-col gap-3 w-96">
          <h2 className="text-lg font-semibold tracking-tight">
            <span className="text-amber-400">{info.trainer_name}</span> invited you
          </h2>
          <p className="text-sm text-zinc-400">
            You're already signed in as {user.email}. Add them as a trainer now?
          </p>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await invites.link(info.token);
                window.location.assign(defaultLandingForRoles(user.roles));
              } catch (e) {
                setErr((e as Error).message);
                setBusy(false);
              }
            }}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium disabled:opacity-50"
          >
            {busy ? 'Linking…' : 'Accept'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <div className="panel p-8 flex flex-col gap-4 items-center">
        <h2 className="text-lg font-semibold tracking-tight">
          <span className="text-amber-400">{info.trainer_name}</span> invited you to ChessCoach
        </h2>
        <p className="text-sm text-zinc-400 text-center max-w-md">
          Hi <strong className="text-zinc-200">{info.student_name}</strong>. Create your account
          to claim the invite. Pick any roles you want; <em>student</em> will be added automatically.
        </p>
        <SignInUpForm
          inviteToken={info.token}
          inviteEmail={info.student_email}
          inviteName={info.student_name}
        />
      </div>
    </div>
  );
}
