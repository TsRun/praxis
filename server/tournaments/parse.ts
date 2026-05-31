import { parse } from 'node-html-parser';

export type Cadence = 'classic' | 'rapid' | 'blitz';

/** Parsed FIDE `tournament_information.phtml` header fields. */
export interface TournamentDetail {
  name: string | null;
  city: string | null;
  country: string | null;
  players: number | null;
  startDate: string | null; // ISO yyyy-mm-dd
  endDate: string | null;
  cadence: Cadence | null;
  timeControl: string | null;
}

/** A row from the FIDE `a_tournaments.php` discovery JSON. */
export interface ListRow {
  sourceRef: string;
  name: string;
  city: string | null;
  startDate: string | null;
  period: string | null;
}

/**
 * FIDE states the rating type as a "Standard:/Rapid:/Blitz: ..." prefix on the
 * Time Control field. The list-view "S." column is NOT a reliable cadence
 * signal (a "Tournoi rapide" can show "s"), so we classify from this text.
 */
export function classifyCadence(timeControl: string | null | undefined): Cadence | null {
  if (!timeControl) return null;
  const m = /\b(standard|rapid|blitz)\b/i.exec(timeControl);
  if (!m) return null;
  const k = m[1].toLowerCase();
  return k === 'standard' ? 'classic' : (k as Cadence);
}

/** api-adresse.data.gouv.fr context: "50, Manche, Normandie" -> dept + region. */
export function parseGeocodeContext(context: string): { department: string | null; region: string | null } {
  const parts = context.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) return { department: null, region: null };
  const [code, dept, ...rest] = parts;
  return { department: `${dept} (${code})`, region: rest.join(', ') };
}

function isoDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m || m[0] === '0000-00-00') return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseTournamentDetail(html: string): TournamentDetail {
  const root = parse(html);
  const fields = new Map<string, string>();
  for (const tr of root.querySelectorAll('tr')) {
    const tds = tr.querySelectorAll('td, th');
    if (tds.length < 2) continue;
    const label = tds[0].text.trim().replace(/\s+/g, ' ');
    const value = tds[1].text.trim().replace(/\s+/g, ' ');
    if (label && value && !fields.has(label)) fields.set(label, value);
  }
  const tc = fields.get('Time Control') ?? null;
  const players = parseInt(fields.get('Number of players') ?? '', 10);
  return {
    name: fields.get('Tournament Name') ?? null,
    city: fields.get('City') ?? null,
    country: fields.get('Country') ?? null,
    players: Number.isFinite(players) ? players : null,
    startDate: isoDate(fields.get('Start Date')),
    endDate: isoDate(fields.get('End Date')),
    cadence: classifyCadence(tc),
    timeControl: tc,
  };
}

export function parseFideList(json: unknown): ListRow[] {
  const data = (json as { data?: unknown[] })?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((r) => {
      const row = r as unknown[];
      return {
        sourceRef: String(row[0] ?? ''),
        name: String(row[1] ?? ''),
        city: row[2] ? String(row[2]) : null,
        startDate: isoDate(row[4] as string),
        period: row[7] ? String(row[7]) : null,
      };
    })
    .filter((r) => r.sourceRef);
}
