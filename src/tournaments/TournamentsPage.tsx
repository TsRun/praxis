import { useEffect, useState, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TopBar } from '../components/ui/TopBar';
import { tournaments, type TournamentRow, type Cadence } from '../lib/api';
import { TournamentList } from './TournamentList';
import { TOURNAMENT_NAV } from './nav';

// Code-split the map: it bundles the ~420 KB France GeoJSON, which we only
// need once the user actually switches to the map view.
const TournamentMap = lazy(() =>
  import('./TournamentMap').then((m) => ({ default: m.TournamentMap })),
);

const CADENCES: { key: Cadence; label: string }[] = [
  { key: 'classic', label: 'Classique' },
  { key: 'rapid', label: 'Rapide' },
  { key: 'blitz', label: 'Blitz' },
];

const selectStyle: React.CSSProperties = {
  height: 36, padding: '0 8px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--inset-bg)', color: 'inherit', fontSize: 13,
};

export function TournamentsPage() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const region = params.get('region') ?? '';
  const cadence = (params.get('cadence') as Cadence | null) ?? undefined;
  const sort = (params.get('sort') as 'date' | 'name' | 'region' | null) ?? 'date';

  useEffect(() => {
    tournaments.regions().then(setRegions).catch(() => {});
  }, []);

  useEffect(() => {
    setError(null);
    setLoading(true);
    tournaments
      .list({ region: region || undefined, cadence, sort })
      .then(setRows)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [region, cadence, sort]);

  const patch = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar links={TOURNAMENT_NAV} />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px' }}>
        <h1 style={{ fontSize: 22, marginBottom: 14 }}>Tournois</h1>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <select value={region} onChange={(e) => patch('region', e.target.value)} aria-label="Région" style={selectStyle}>
            <option value="">Toutes régions</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>

          <div role="group" aria-label="Cadence" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CADENCES.map((c) => {
              const on = cadence === c.key;
              return (
                <button
                  key={c.key}
                  className="pill-btn"
                  onClick={() => patch('cadence', on ? '' : c.key)}
                  aria-pressed={on}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <select value={sort} onChange={(e) => patch('sort', e.target.value)} aria-label="Trier" style={selectStyle}>
            <option value="date">Trier : date</option>
            <option value="name">Trier : nom</option>
            <option value="region">Trier : région</option>
          </select>

          <div role="group" aria-label="Vue" style={{ marginLeft: 'auto', display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button className="seg-toggle-btn" onClick={() => setView('list')} aria-pressed={view === 'list'}>Liste</button>
            <button className="seg-toggle-btn" onClick={() => setView('map')} aria-pressed={view === 'map'}>Carte</button>
          </div>
        </div>

        {error && <p role="alert" style={{ color: 'crimson' }}>{error}</p>}
        {loading && !error && <p role="status" aria-live="polite" style={{ color: 'var(--text-dim)' }}>Chargement…</p>}
        {!loading && !error && (
          view === 'list'
            ? <TournamentList rows={rows} />
            : (
              <Suspense fallback={<p style={{ color: 'var(--text-dim)' }}>Chargement de la carte…</p>}>
                <TournamentMap rows={rows} onSelect={(t) => window.open(t.url, '_blank')} />
              </Suspense>
            )
        )}
      </div>
    </div>
  );
}
