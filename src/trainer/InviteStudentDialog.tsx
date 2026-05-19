import { useState, type FormEvent } from 'react';
import { trainer, type LinkCandidate } from '../lib/api';
import { Btn, Avatar } from '../components/ui/atoms';
import { IconSearch, IconX } from '../components/ui/Icons';

type Ambig = { kind: 'ambiguous'; candidates: LinkCandidate[] };

export function InviteStudentDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ambig, setAmbig] = useState<Ambig | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    setAmbig(null);
    try {
      await trainer.link(name.trim());
      onClose();
    } catch (e) {
      const msg = (e as Error).message ?? '';
      try {
        const res = await fetch('/api/trainer/invites', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: name.trim() }),
        });
        if (res.status === 409) {
          const body = (await res.json()) as { candidates: LinkCandidate[] };
          setAmbig({ kind: 'ambiguous', candidates: body.candidates });
        } else if (res.status === 404) {
          setErr(`No signed-in user has the nickname "${name.trim()}".`);
        } else if (!res.ok) {
          setErr(msg);
        }
      } catch {
        setErr(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function linkById(id: number) {
    setBusy(true);
    setErr(null);
    try {
      await trainer.linkById(id);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          padding: 24,
          background: 'var(--card-bg)',
          borderRadius: 16,
          boxShadow: 'var(--card-shadow), 0 30px 80px -20px rgba(0,0,0,0.6)',
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
          <h2 className="t-h2" style={{ margin: 0 }}>Invite a student</h2>
          <Btn variant="ghost" size="sm" type="button" onClick={onClose}>
            <IconX size={14} strokeWidth={2.4} />
          </Btn>
        </div>
        <div
          style={{
            color: 'var(--text-dim)',
            fontSize: 13.5,
            marginBottom: 18,
          }}
        >
          Type a nickname. If they already use Praxis we'll link them and send
          a notification email.
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
            className="input input-lg"
            placeholder="student nickname"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setAmbig(null);
              setErr(null);
            }}
            style={{ paddingLeft: 38 }}
          />
        </div>

        {ambig && (
          <div
            style={{
              marginTop: 6,
              background: 'var(--inset-bg)',
              border: '1px solid var(--inset-border)',
              borderRadius: 12,
              maxHeight: 240,
              overflow: 'auto',
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                fontSize: 12,
                color: 'var(--accent)',
              }}
            >
              Multiple users share that nickname — pick the right one:
            </div>
            {ambig.candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busy}
                onClick={() => linkById(c.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 0,
                  padding: '10px 12px',
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr auto',
                  gap: 10,
                  alignItems: 'center',
                  cursor: 'pointer',
                  color: 'var(--text)',
                }}
              >
                <Avatar name={c.name} />
                <div className="mono" style={{ fontSize: 14 }}>{c.name}</div>
                <span
                  style={{ fontSize: 11, color: 'var(--text-faint)' }}
                >
                  #{c.id}
                </span>
              </button>
            ))}
          </div>
        )}

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
          <a href="#" className="link">
            Invite by email
          </a>{' '}
          — they'll get a magic link to claim the nickname.
        </div>

        {err && (
          <div
            style={{ fontSize: 12, color: 'var(--danger)', marginTop: 12 }}
          >
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
          <Btn variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            disabled={busy || !name.trim()}
            type="submit"
          >
            {busy ? 'Linking…' : 'Send invite'}
          </Btn>
        </div>
      </form>
    </div>
  );
}
