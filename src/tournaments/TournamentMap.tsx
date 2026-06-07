import { useMemo } from 'react';
import { geoConicConformal, geoPath } from 'd3';
import type { FeatureCollection } from 'geojson';
import type { TournamentRow } from '../lib/api';
import franceGeo from './france-regions.geo.json';

const W = 720;
const H = 720;
const CAD_COLOR: Record<string, string> = { classic: '#2e7d5b', rapid: '#8b6914', blitz: '#9c4dcc' };

export function TournamentMap({ rows, onSelect }: {
  rows: TournamentRow[];
  onSelect: (t: TournamentRow) => void;
}) {
  const { paths, project } = useMemo(() => {
    const fc = franceGeo as unknown as FeatureCollection;
    // Conic conformal (Lambert) is the standard projection for metropolitan
    // France; rotate/parallels shape it, fitSize sets scale + translate.
    const projection = geoConicConformal()
      .rotate([-3, 0])
      .parallels([44, 49])
      .fitSize([W, H], fc);
    const path = geoPath(projection);
    return {
      paths: fc.features.map((f) => path(f) ?? ''),
      project: (lon: number, lat: number) => projection([lon, lat]),
    };
  }, []);

  const mapped = rows.filter((r) => r.lat != null && r.lon != null);
  const unmapped = rows.length - mapped.length;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', maxWidth: 640, display: 'block', margin: '0 auto', background: 'var(--inset-bg)', borderRadius: 12 }}
        role="img"
        aria-label="Carte des tournois en France"
      >
        {paths.map((d, i) => (
          <path key={i} d={d} fill="rgba(125,125,125,0.08)" stroke="var(--border)" strokeWidth={0.6} />
        ))}
        {mapped.map((t) => {
          const p = project(t.lon!, t.lat!);
          if (!p) return null;
          const color = t.cadence ? CAD_COLOR[t.cadence] : '#5b8cff';
          return (
            <circle
              key={t.id}
              cx={p[0]}
              cy={p[1]}
              r={5}
              fill={color}
              fillOpacity={0.85}
              stroke="#fff"
              strokeWidth={1.2}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelect(t)}
            >
              <title>{t.name} — {t.location}</title>
            </circle>
          );
        })}
      </svg>
      {unmapped > 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', marginTop: 8 }}>
          {unmapped} tournoi(s) sans coordonnées non affiché(s) sur la carte — voir la liste.
        </p>
      )}
    </div>
  );
}
