import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { invites, type InviteInfo } from '../lib/api';
import { useAuth } from './AuthContext';
import { SignInUpForm } from './SignInUpForm';
import { defaultLandingForRoles } from './routing';
import { Card, Btn } from '../components/ui/atoms';

const PAGE_STYLE: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '48px 24px',
};

export function InvitePage() {
  const { token } = useParams();
  const { user, loading } = useAuth();
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
      <div style={PAGE_STYLE}>
        <Card style={{ padding: 28, color: 'var(--danger)', fontSize: 14 }}>{err}</Card>
      </div>
    );
  }
  if (!info || loading) {
    return (
      <div style={PAGE_STYLE}>
        <Card style={{ padding: 28, color: 'var(--text-faint)' }}>Loading invite…</Card>
      </div>
    );
  }

  if (user && user.email === info.student_email) {
    return (
      <div style={PAGE_STYLE}>
        <Card style={{ padding: 32, width: 380, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 className="t-h2" style={{ margin: 0 }}>
            <span style={{ color: 'var(--accent)' }}>{info.trainer_name}</span> invited you
          </h2>
          <p className="meta">
            You're already signed in as {user.email}. Add them as a trainer now?
          </p>
          <Btn
            variant="primary"
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
          >
            {busy ? 'Linking…' : 'Accept'}
          </Btn>
        </Card>
      </div>
    );
  }

  return (
    <div style={PAGE_STYLE}>
      <Card
        style={{
          padding: 32,
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <h2 className="t-h2" style={{ margin: 0 }}>
          <span style={{ color: 'var(--accent)' }}>{info.trainer_name}</span> invited you to Praxis
        </h2>
        <p className="meta">
          Hi <strong style={{ color: 'var(--text)' }}>{info.student_name}</strong>. Create your account
          to claim the invite. Pick any roles you want; <em>student</em> will be added automatically.
        </p>
        <div style={{ width: '100%', textAlign: 'left' }}>
          <SignInUpForm
            inviteToken={info.token}
            inviteEmail={info.student_email}
            inviteName={info.student_name}
          />
        </div>
      </Card>
    </div>
  );
}
