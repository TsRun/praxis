import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { ALL_ROLES, type Role } from '../lib/api';
import { Avatar, Btn, Chip } from '../components/ui/atoms';
import { IconChevDown, IconLogout } from '../components/ui/Icons';

const ROLE_LABEL: Record<Role, string> = {
  trainer: 'Trainer',
  student: 'Student',
  self: 'Own trainer',
};

export function UserMenu() {
  const { user, signout, setRoles } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!user) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          background: 'transparent',
          border: 0,
          borderRadius: 8,
          color: 'inherit',
          cursor: 'pointer',
        }}
        onMouseOver={(e) =>
          (e.currentTarget.style.background = 'var(--inset-bg)')
        }
        onMouseOut={(e) =>
          (e.currentTarget.style.background = 'transparent')
        }
      >
        <Avatar name={user.name} />
        <span className="meta-strong" style={{ fontSize: 13 }}>
          {user.name}
        </span>
        <IconChevDown size={11} strokeWidth={2.4} style={{ color: 'var(--text-faint)' }} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            marginTop: 8,
            width: 300,
            background: 'var(--card-bg)',
            borderRadius: 12,
            boxShadow: 'var(--card-shadow), 0 24px 60px -20px rgba(0,0,0,0.6)',
            padding: 14,
            zIndex: 40,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              {user.name}
            </div>
            <div className="meta" style={{ fontSize: 12 }}>{user.email}</div>
          </div>

          {!editing ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {user.roles.map((r) => (
                  <Chip key={r} variant="accent">
                    {ROLE_LABEL[r]}
                  </Chip>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                style={{
                  textAlign: 'left',
                  background: 'transparent',
                  border: 0,
                  color: 'var(--text-dim)',
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Manage roles →
              </button>
              <div
                style={{
                  borderTop: '1px solid var(--hairline)',
                  paddingTop: 10,
                  display: 'flex',
                }}
              >
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    setOpen(false);
                    await signout();
                  }}
                  style={{ color: 'var(--text-dim)' }}
                >
                  <IconLogout size={12} strokeWidth={2.4} />
                  Sign out
                </Btn>
              </div>
            </>
          ) : (
            <RolesEditor
              onCancel={() => setEditing(false)}
              onSave={async (roles) => {
                await setRoles(roles);
                setEditing(false);
              }}
              initial={user.roles}
            />
          )}
        </div>
      )}
    </div>
  );
}

function RolesEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: Role[];
  onSave: (roles: Role[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<Set<Role>>(new Set(initial));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(r: Role) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="overline">Your roles</div>
      {ALL_ROLES.map((r) => (
        <label
          key={r}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13.5,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={picked.has(r)}
            onChange={() => toggle(r)}
          />
          {ROLE_LABEL[r]}
        </label>
      ))}
      {err && (
        <span style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</span>
      )}
      <div
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          marginTop: 4,
        }}
      >
        <Btn variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn
          variant="primary"
          size="sm"
          disabled={busy || picked.size === 0}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await onSave([...picked]);
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Saving…' : 'Save'}
        </Btn>
      </div>
    </div>
  );
}
