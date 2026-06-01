import { useState, useRef, useEffect, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { trainer } from '../lib/api';
import { Btn } from '../components/ui/atoms';
import { IconSearch, IconX, IconCheck } from '../components/ui/Icons';

type Mode = 'nickname' | 'email';

export function InviteStudentDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('nickname');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailName, setEmailName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<
    | { kind: 'invited'; email: string }
    | { kind: 'linked'; name: string }
    | null
  >(null);

  async function submitNickname(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await trainer.link(name.trim());
      onClose();
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (msg.includes('multiple users')) {
        setErr(
          `Multiple users share that nickname — ask your student to set a unique one before linking.`,
        );
      } else if (msg.includes('no signed-in user')) {
        setErr(
          `No signed-in user has the nickname "${name.trim()}". Invite them by email instead.`,
        );
      } else {
        setErr(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await trainer.inviteByEmail(
        email.trim(),
        emailName.trim() || undefined,
      );
      if (res.mode === 'linked-existing') {
        setSent({
          kind: 'linked',
          name: emailName.trim() || email.split('@')[0],
        });
      } else {
        setSent({ kind: 'invited', email: email.trim() });
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setErr(null);
  }

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-student-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          // Keep the dialog within the viewport on narrow / short screens —
          // matches the constraints on the shared Dialog component so the
          // panel never touches viewport edges and never clips its footer.
          maxWidth: '92vw',
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          padding: 24,
          background: 'var(--card-bg)',
          borderRadius: 16,
          boxShadow:
            'var(--card-shadow), 0 30px 80px -20px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <h2 id="invite-student-title" className="t-h2" style={{ margin: 0 }}>Invite a student</h2>
          <Btn
            variant="ghost"
            size="sm"
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ minWidth: 36, minHeight: 36, padding: 0, justifyContent: 'center' }}
          >
            <IconX size={14} strokeWidth={2.4} />
          </Btn>
        </div>

        {sent ? (
          <SentBanner sent={sent} onDone={onClose} />
        ) : mode === 'nickname' ? (
          <NicknameForm
            name={name}
            setName={(v) => {
              setName(v);
              setErr(null);
            }}
            busy={busy}
            err={err}
            onSubmit={submitNickname}
            onSwitchToEmail={() => switchMode('email')}
            onCancel={onClose}
          />
        ) : (
          <EmailForm
            email={email}
            setEmail={setEmail}
            emailName={emailName}
            setEmailName={setEmailName}
            busy={busy}
            err={err}
            onSubmit={submitEmail}
            onSwitchToNickname={() => switchMode('nickname')}
            onCancel={onClose}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

function NicknameForm({
  name,
  setName,
  busy,
  err,
  onSubmit,
  onSwitchToEmail,
  onCancel,
}: {
  name: string;
  setName: (v: string) => void;
  busy: boolean;
  err: string | null;
  onSubmit: (e: FormEvent) => void;
  onSwitchToEmail: () => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          color: 'var(--text-dim)',
          fontSize: 13.5,
          marginBottom: 18,
        }}
      >
        Type a nickname. If they already use Praxis we'll link them and send a
        notification email.
      </div>
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <IconSearch
          size={14}
          strokeWidth={2.4}
          style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-faint)',
            pointerEvents: 'none',
          }}
        />
        <input
          autoFocus
          id="invite-nickname"
          aria-label="Student nickname"
          className="input input-lg"
          placeholder="student nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ paddingLeft: 38 }}
        />
      </div>

      <div
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          background: 'var(--inset-bg)',
          border: '1px solid var(--inset-border)',
          fontSize: 12,
          color: 'var(--text-dim)',
          lineHeight: 1.5,
          marginTop: 14,
        }}
      >
        Can't find them?{' '}
        <button
          type="button"
          onClick={onSwitchToEmail}
          className="link"
          style={{
            background: 'transparent',
            border: 0,
            padding: 0,
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          Invite by email
        </button>{' '}
        — they'll get a magic link to claim the nickname.
      </div>

      {err && (
        <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 12 }}>
          {err}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginTop: 22,
          justifyContent: 'flex-end',
        }}
      >
        <Btn variant="ghost" type="button" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn variant="primary" disabled={busy || !name.trim()} type="submit">
          {busy ? 'Linking…' : 'Send invite'}
        </Btn>
      </div>
    </form>
  );
}

function suggestNickFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  return local
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
}

function EmailForm({
  email,
  setEmail,
  emailName,
  setEmailName,
  busy,
  err,
  onSubmit,
  onSwitchToNickname,
  onCancel,
}: {
  email: string;
  setEmail: (v: string) => void;
  emailName: string;
  setEmailName: (v: string) => void;
  busy: boolean;
  err: string | null;
  onSubmit: (e: FormEvent) => void;
  onSwitchToNickname: () => void;
  onCancel: () => void;
}) {
  // Track whether the user has typed in the name field themselves. If they
  // haven't, follow the email-derived suggestion as they type.
  const nameTouchedRef = useRef(false);
  const suggestion =
    email.includes('@') ? suggestNickFromEmail(email) : '';

  function onEmailChange(v: string) {
    setEmail(v);
    if (!nameTouchedRef.current) {
      setEmailName(suggestNickFromEmail(v));
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          color: 'var(--text-dim)',
          fontSize: 13.5,
          marginBottom: 18,
        }}
      >
        Enter the student's email. They'll get a magic link to create their
        account; once they accept, they'll be linked to you as a student.
      </div>

      <label
        htmlFor="invite-email"
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-dim)',
          marginBottom: 6,
        }}
      >
        Email
      </label>
      <input
        autoFocus
        id="invite-email"
        className="input input-lg"
        type="email"
        placeholder="student@example.com"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        style={{ marginBottom: 14 }}
      />

      <label
        htmlFor="invite-suggested-nickname"
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-dim)',
          marginBottom: 6,
          display: 'flex',
          gap: 6,
          alignItems: 'baseline',
        }}
      >
        Suggested nickname
        <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>
          (we'll suggest this if they don't pick their own)
        </span>
      </label>
      <input
        id="invite-suggested-nickname"
        className="input"
        placeholder={suggestion || 'how to greet them in the email'}
        value={emailName}
        onChange={(e) => {
          nameTouchedRef.current = true;
          setEmailName(e.target.value);
        }}
      />
      {suggestion && emailName !== suggestion && (
        <button
          type="button"
          onClick={() => {
            nameTouchedRef.current = false;
            setEmailName(suggestion);
          }}
          className="link"
          style={{
            background: 'transparent',
            border: 0,
            padding: 0,
            cursor: 'pointer',
            fontSize: 12,
            marginTop: 6,
            alignSelf: 'flex-start',
          }}
        >
          Use suggestion: <span className="mono">{suggestion}</span>
        </button>
      )}

      {err && (
        <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 12 }}>
          {err}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginTop: 22,
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={onSwitchToNickname}
          style={{
            background: 'transparent',
            border: 0,
            padding: 0,
            cursor: 'pointer',
            color: 'var(--text-dim)',
            fontSize: 13,
          }}
        >
          ← Search by nickname instead
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            disabled={busy || !email.includes('@')}
            type="submit"
          >
            {busy ? 'Sending…' : 'Send invite'}
          </Btn>
        </div>
      </div>
    </form>
  );
}

function SentBanner({
  sent,
  onDone,
}: {
  sent: { kind: 'invited'; email: string } | { kind: 'linked'; name: string };
  onDone: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          padding: '14px 16px',
          borderRadius: 10,
          background: 'var(--success-bg)',
          boxShadow: 'inset 0 0 0 1px rgba(52,211,153,0.30)',
          color: 'var(--text)',
          fontSize: 13.5,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: 'rgba(52,211,153,0.18)',
            color: 'var(--success)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IconCheck size={16} strokeWidth={2.6} />
        </div>
        <div>
          {sent.kind === 'invited' ? (
            <>
              Magic-link invite sent to <strong>{sent.email}</strong>. They'll
              show up in your roster once they accept it (valid for 14 days).
            </>
          ) : (
            <>
              <strong>{sent.name}</strong> already had a Praxis account. They've
              been linked as your student.
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn variant="primary" onClick={onDone}>
          Done
        </Btn>
      </div>
    </div>
  );
}
