import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { ALL_ROLES, type Role } from '../lib/api';

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

  // Close when clicking outside
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
  const initials = user.name
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-zinc-800/60"
      >
        <div className="w-7 h-7 rounded-full bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30 grid place-items-center text-[11px] font-semibold">
          {initials || '?'}
        </div>
        <span className="text-sm text-zinc-200">{user.name}</span>
        <span className="text-zinc-500 text-[10px]" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 panel p-3 z-40 flex flex-col gap-3"
        >
          <div className="flex flex-col gap-0.5">
            <div className="text-sm font-medium text-zinc-100">{user.name}</div>
            <div className="text-xs text-zinc-500">{user.email}</div>
          </div>

          {!editing ? (
            <>
              <div className="flex flex-wrap gap-1">
                {user.roles.map((r) => (
                  <span
                    key={r}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30"
                  >
                    {ROLE_LABEL[r]}
                  </span>
                ))}
              </div>
              <button
                onClick={() => setEditing(true)}
                className="text-left text-xs text-zinc-300 hover:text-amber-300"
              >
                Manage roles →
              </button>
              <div className="border-t border-zinc-800/70 pt-2">
                <button
                  onClick={async () => {
                    setOpen(false);
                    await signout();
                  }}
                  className="text-left text-xs text-zinc-400 hover:text-red-400"
                >
                  Sign out
                </button>
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
    <div className="flex flex-col gap-2">
      <div className="text-xs uppercase tracking-wider text-zinc-500">Your roles</div>
      {ALL_ROLES.map((r) => (
        <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={picked.has(r)}
            onChange={() => toggle(r)}
          />
          {ROLE_LABEL[r]}
        </label>
      ))}
      {err && <div className="text-xs text-red-400">{err}</div>}
      <div className="flex gap-2 justify-end mt-1">
        <button onClick={onCancel} className="text-xs text-zinc-400 px-2 py-1">
          Cancel
        </button>
        <button
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
          className="text-xs bg-amber-500 hover:bg-amber-400 text-zinc-950 px-2 py-1 rounded font-medium disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
