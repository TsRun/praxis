import type { TournamentRow } from '../lib/api';

const CAD_LABEL: Record<string, string> = { classic: 'Classique', rapid: 'Rapide', blitz: 'Blitz' };
const CAD_COLOR: Record<string, string> = { classic: '#2e7d5b', rapid: '#b8860b', blitz: '#9c4dcc' };

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function TournamentList({ rows }: { rows: TournamentRow[] }) {
  if (rows.length === 0) {
    return <p style={{ color: 'var(--text-dim)', padding: '24px 0' }}>Aucun tournoi ne correspond à ces filtres.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((t) => (
        <a
          key={t.id}
          href={t.url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
            border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', color: 'inherit',
          }}
        >
          <div style={{ textAlign: 'center', minWidth: 48 }}>
            <strong style={{ fontSize: 15 }}>{fmtDate(t.start_date)}</strong>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {[t.location, t.region].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          {t.cadence && (
            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, color: '#fff', background: CAD_COLOR[t.cadence] }}>
              {CAD_LABEL[t.cadence]}
            </span>
          )}
          {t.players != null && (
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t.players} joueurs</span>
          )}
        </a>
      ))}
    </div>
  );
}
