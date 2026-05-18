import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { invites, type InviteInfo } from '../lib/api';
import { InviteAcceptForm } from './InviteAcceptForm';

export function InvitePage() {
  const { token } = useParams();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    invites.lookup(token).then(setInfo).catch((e) => setErr((e as Error).message));
  }, [token]);

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <div className="panel p-8">
        {err && <p className="text-red-400 text-sm">{err}</p>}
        {!err && !info && <p className="text-zinc-500">Loading invite…</p>}
        {info && <InviteAcceptForm info={info} />}
      </div>
    </div>
  );
}
