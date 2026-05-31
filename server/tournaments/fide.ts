import { parseFideList, parseTournamentDetail, type ListRow, type TournamentDetail } from './parse.js';

const BASE = 'https://ratings.fide.com';
const UA = 'praxis-tournaments/1.0 (+https://praxis.tsrun.dev)';
const HEADERS = { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest' };

async function getText(url: string, fetchFn: typeof fetch): Promise<string> {
  const res = await fetchFn(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

async function getJson(url: string, fetchFn: typeof fetch): Promise<unknown> {
  const res = await fetchFn(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

export interface Period {
  publish: string; // 'YYYY-MM-01'
  label: string; // 'June 2026'
}

/** All FIDE rating periods for a federation, newest first (back to ~2002). */
export async function listPeriods(country: string, fetchFn: typeof fetch = fetch): Promise<Period[]> {
  const url = `${BASE}/a_tournaments_panel.php?country=${encodeURIComponent(country)}&periods_tab=1`;
  const json = await getJson(url, fetchFn);
  if (!Array.isArray(json)) return [];
  return json
    .map((p) => ({ publish: String((p as { frl_publish?: unknown }).frl_publish ?? ''), label: String((p as { txt2?: unknown }).txt2 ?? '') }))
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.publish));
}

/** Discovery list for a federation (+ optional rating period). */
export async function listTournaments(
  country: string,
  period: string | null,
  fetchFn: typeof fetch = fetch,
): Promise<ListRow[]> {
  const q = period ? `&period=${encodeURIComponent(period)}` : '';
  const url = `${BASE}/a_tournaments.php?country=${encodeURIComponent(country)}${q}`;
  return parseFideList(await getJson(url, fetchFn));
}

export interface FetchedDetail extends TournamentDetail {
  sourceRef: string;
  url: string;
}

/** Enrich a single event with cadence, end date, player count, country. */
export async function fetchTournamentDetail(eventId: string, fetchFn: typeof fetch = fetch): Promise<FetchedDetail> {
  const url = `${BASE}/tournament_information.phtml?event=${encodeURIComponent(eventId)}`;
  const html = await getText(url, fetchFn);
  return { ...parseTournamentDetail(html), sourceRef: String(eventId), url };
}

/** Public URL for a tournament (used even when detail enrichment is skipped). */
export function tournamentUrl(eventId: string): string {
  return `${BASE}/tournament_information.phtml?event=${encodeURIComponent(eventId)}`;
}
