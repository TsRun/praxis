import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import {
  trainerStudies,
  type BaseGame,
  type ImportChapterPreview,
  type ImportResult,
  type OpeningStudyFull,
  type OpeningStudySummary,
  type BaseSearchFilters,
  type SourceFetchFilters,
  type TimeControlBucket,
} from '../lib/api';
import { Card, Btn, Chip, Segmented } from '../components/ui/atoms';
import { FenBoard } from '../components/board/FenBoard';
import { PositionSetupBoard } from '../components/board/PositionSetupBoard';
import { PlayFromStartBoard } from '../components/board/PlayFromStartBoard';
import { StudyNodePicker } from '../components/board/StudyNodePicker';
import { IconArrowL, IconCheck, IconSearch, IconDownload } from '../components/ui/Icons';

type Source = 'chesscom' | 'lichess' | 'base';
type ColorFilter = 'white' | 'black' | 'either';
type PositionMode = 'free' | 'play' | 'node';

const START_FEN = new Chess().fen();
const NORM_START = normFen(START_FEN);

function normFen(fen: string): string {
  return fen.split(/\s+/).slice(0, 4).join(' ');
}

interface Filters {
  player: string;
  color: ColorFilter;
  yearFrom: string;
  yearTo: string;
  results: Set<string>; // '1-0' | '0-1' | '1/2-1/2'
  eco: string;
  minElo: string;
  timeControls: Set<TimeControlBucket>;
  positionFen: string;
  positionEnabled: boolean;
}

const DEFAULT_FILTERS: Filters = {
  player: '',
  color: 'either',
  yearFrom: '',
  yearTo: '',
  results: new Set(['1-0', '0-1', '1/2-1/2']),
  eco: '',
  minElo: '',
  timeControls: new Set<TimeControlBucket>(['bullet', 'blitz', 'rapid', 'classical']),
  positionFen: NORM_START,
  positionEnabled: true,
};

type Stage =
  | { kind: 'searching' }
  | {
      kind: 'results';
      source: Source;
      games: ResultGame[];
      selected: Set<string>;
      total: number;
    }
  | {
      kind: 'choose-study';
    }
  | {
      kind: 'picking';
      source: Source;
      pgn: string;
      chapters: ImportChapterPreview[];
      picked: Set<number>;
    }
  | { kind: 'importing' }
  | { kind: 'done'; result: ImportResult };

interface ResultGame {
  /** stable id — for DB games this is the row id; for chess.com/lichess it's
   * the chapter index in the parsed PGN so we can re-pick later. */
  key: string;
  /** preview FEN for the thumbnail (filter position when set, else start) */
  fen: string;
  whiteName: string | null;
  whiteElo: number | null;
  blackName: string | null;
  blackElo: number | null;
  event: string | null;
  date: string | null;
  result: string;
  /** Index into the cached PGN (for chess.com/lichess) — null for DB games */
  chapterIndex: number | null;
  dbId: number | null;
  /** Whether this chapter starts from a position that matches the study root.
   * Drives the "can't import" disabled-row state for chess.com/lichess. */
  matchesStudyRoot: boolean;
  /** Opening name when known (DB games only) — shown under players line. */
  opening?: string | null;
}

export function ImportGamesPage() {
  const { id } = useParams<{ id: string }>();
  // When `id` is undefined we're in top-level browse mode: no study to import
  // into yet, the trainer picks one after selecting games.
  const scopedStudyId = id ? Number(id) : null;
  const nav = useNavigate();
  const playerInputId = useId();
  const [study, setStudy] = useState<OpeningStudyFull | null>(null);
  const [source, setSource] = useState<Source>('chesscom');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  // chess.com / lichess fetches yield a PGN we have to keep around so we can
  // submit the picked chapter indexes to /import afterwards.
  const [cachedPgn, setCachedPgn] = useState<string>('');
  const [stage, setStage] = useState<Stage | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Snapshot of the results stage so "Back" from the picker restores it
  // without re-running the (potentially expensive) network search.
  const [lastResults, setLastResults] =
    useState<Extract<Stage, { kind: 'results' }> | null>(null);
  // chess.com / lichess inputs
  const [ccUsername, setCcUsername] = useState('');
  const [liUsername, setLiUsername] = useState('');
  // Browse-mode-only: the study the trainer chose to import INTO.
  const [targetStudyId, setTargetStudyId] = useState<number | null>(scopedStudyId);
  const [targetStudy, setTargetStudy] = useState<OpeningStudyFull | null>(null);
  const [studies, setStudies] = useState<OpeningStudySummary[] | null>(null);

  useEffect(() => {
    if (scopedStudyId != null) {
      trainerStudies.get(scopedStudyId).then(setStudy).catch(() => {});
    }
  }, [scopedStudyId]);

  // For the active import-target (browse-mode path), we need root_fen so
  // chapter matchesStudyRoot is checked correctly.
  useEffect(() => {
    if (targetStudyId != null) {
      trainerStudies.get(targetStudyId).then(setTargetStudy).catch(() => {});
    } else {
      setTargetStudy(null);
    }
  }, [targetStudyId]);

  const activeStudy = scopedStudyId != null ? study : targetStudy;
  const studyRootNorm = useMemo(
    () => (activeStudy ? normFen(activeStudy.root_fen) : NORM_START),
    [activeStudy],
  );

  function back() {
    if (scopedStudyId != null) {
      nav(`/trainer/studies/opening/${scopedStudyId}`);
    } else if (targetStudyId != null) {
      nav(`/trainer/studies/opening/${targetStudyId}`);
    } else {
      nav('/trainer/studies');
    }
  }

  async function search() {
    setBusy(true);
    setErr(null);
    setStage({ kind: 'searching' });
    try {
      if (source === 'base') {
        const params: BaseSearchFilters = {
          player: filters.player.trim() || undefined,
          color: filters.color,
          year_from: filters.yearFrom ? Number(filters.yearFrom) : undefined,
          year_to: filters.yearTo ? Number(filters.yearTo) : undefined,
          results: filters.results.size === 3 ? undefined : Array.from(filters.results),
          eco: filters.eco.trim() || undefined,
          min_elo: filters.minElo ? Number(filters.minElo) : undefined,
          position_fen: filters.positionEnabled ? filters.positionFen : undefined,
          limit: 50,
        };
        const res = await trainerStudies.searchBaseGames(params);
        setStage({
          kind: 'results',
          source: 'base',
          total: res.total,
          selected: new Set(),
          games: res.games.map((g) => baseGameToResult(g)),
        });
      } else {
        // In browse mode we don't have a study yet; chess.com / lichess fetch
        // endpoints currently need an :id to preview against. We still need a
        // valid id to hit the endpoint, so when browsing-mode we send the
        // first available study (the chapter previews never actually depend
        // on it for matchesStudyRoot — we re-check after the trainer picks).
        const probeId = scopedStudyId ?? (await ensureProbeStudyId());
        if (probeId == null) {
          setErr('Create an opening study first to use Chess.com / Lichess.');
          setStage(null);
          return;
        }
        const fetchFilters: SourceFetchFilters = {
          color: filters.color,
          results: filters.results.size === 3 ? undefined : Array.from(filters.results),
          eco: filters.eco.trim() || undefined,
          min_elo: filters.minElo ? Number(filters.minElo) : undefined,
          time_control:
            filters.timeControls.size === 4
              ? undefined
              : Array.from(filters.timeControls),
          position_fen: filters.positionEnabled ? filters.positionFen : undefined,
        };
        const username = (source === 'chesscom' ? ccUsername : liUsername).trim();
        if (!username) {
          setErr('Enter a username first.');
          setStage(null);
          return;
        }
        const fetcher =
          source === 'chesscom'
            ? trainerStudies.fetchChessCom
            : trainerStudies.fetchLichessUser;
        const { pgn, chapters } = await fetcher(probeId, username, fetchFilters);
        setCachedPgn(pgn);
        setStage({
          kind: 'results',
          source,
          total: chapters.length,
          selected: new Set(),
          games: chapters.map((c) => chapterToResult(c)),
        });
      }
    } catch (e) {
      setErr((e as Error).message);
      setStage(null);
    } finally {
      setBusy(false);
    }
  }

  // Helper: when browsing-top-level we still need *some* study id to call the
  // chess.com / lichess fetch endpoints. Lazily load the list and use the
  // first one. (We re-check fen match after the trainer picks a real target.)
  async function ensureProbeStudyId(): Promise<number | null> {
    if (studies && studies[0]) return studies[0].id;
    const list = await trainerStudies.list();
    setStudies(list);
    return list[0]?.id ?? null;
  }

  async function onResultsContinue() {
    if (stage?.kind !== 'results') return;
    if (stage.selected.size === 0) return;
    setLastResults(stage);
    if (scopedStudyId == null && targetStudyId == null) {
      // Browse mode: ask the trainer which study to import into first.
      try {
        if (!studies) {
          setBusy(true);
          const list = await trainerStudies.list();
          setStudies(list);
        }
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(false);
      }
      setStage({ kind: 'choose-study' });
    } else {
      await goToPicker(targetStudyId ?? scopedStudyId!);
    }
  }

  async function chooseStudyAndContinue(sid: number) {
    setTargetStudyId(sid);
    await goToPicker(sid);
  }

  async function goToPicker(studyId: number) {
    const results = lastResults;
    if (!results) return;
    setBusy(true);
    setErr(null);
    try {
      if (results.source === 'base') {
        const ids = Array.from(results.selected).map((k) => Number(k));
        const { pgn, chapters } = await trainerStudies.fetchBaseGames(studyId, ids);
        const picked = new Set(
          chapters.filter((c) => c.matches_study_root).map((c) => c.index),
        );
        setStage({ kind: 'picking', source: 'base', pgn, chapters, picked });
      } else {
        // chess.com / lichess: we already have the full PGN cached; restrict
        // the picker preview to the selected indexes. The server's `/import`
        // endpoint takes chapter indexes against the full PGN, so we keep the
        // PGN intact and only re-shape the preview list. Re-run the preview
        // against the chosen study so matches_study_root reflects the actual
        // target (the original preview was against the probe study).
        const indexes = new Set(
          results.games
            .filter((g) => results.selected.has(g.key) && g.chapterIndex != null)
            .map((g) => g.chapterIndex as number),
        );
        const all = await trainerStudies.importPreview(studyId, cachedPgn);
        const chapters = all.chapters.filter((c) => indexes.has(c.index));
        const picked = new Set(
          chapters.filter((c) => c.matches_study_root).map((c) => c.index),
        );
        setStage({
          kind: 'picking',
          source: results.source,
          pgn: cachedPgn,
          chapters,
          picked,
        });
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (stage?.kind !== 'picking') return;
    const studyId = targetStudyId ?? scopedStudyId;
    if (studyId == null) return;
    setBusy(true);
    setErr(null);
    const stashed = stage;
    setStage({ kind: 'importing' });
    try {
      const result = await trainerStudies.importLichess(
        studyId,
        stashed.pgn,
        Array.from(stashed.picked),
      );
      setStage({ kind: 'done', result });
    } catch (e) {
      setErr((e as Error).message);
      setStage(stashed);
    } finally {
      setBusy(false);
    }
  }

  const browseMode = scopedStudyId == null;
  const headerTitle = browseMode
    ? 'Browse games'
    : `Import games${study ? ` into "${study.name}"` : ''}`;

  return (
    <div className="page-wrap" style={{ paddingTop: 24, paddingBottom: 80 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        {!browseMode && (
          <Btn variant="ghost" size="sm" onClick={back}>
            <IconArrowL size={13} strokeWidth={2.4} />
            Back to study
          </Btn>
        )}
        <h1 className="t-h1" style={{ margin: 0 }}>{headerTitle}</h1>
      </div>

      <div className="grid-import-page">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SourceTabs source={source} setSource={setSource} />

            {source === 'chesscom' && (
              <UserInputs
                label="Chess.com username"
                username={ccUsername}
                setUsername={setCcUsername}
              />
            )}
            {source === 'lichess' && (
              <UserInputs
                label="Lichess username"
                username={liUsername}
                setUsername={setLiUsername}
              />
            )}
            {source === 'base' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor={playerInputId} className="meta" style={{ fontSize: 12 }}>Player name</label>
                <input
                  id={playerInputId}
                  value={filters.player}
                  onChange={(e) => setFilters({ ...filters, player: e.target.value })}
                  placeholder="e.g. Carlsen"
                  style={inputStyle}
                />
              </div>
            )}
          </Card>

          <Card style={{ padding: 18 }}>
            <details open style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <summary
                style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 10 }}
              >
                Filters
              </summary>
              <FilterControls
                filters={filters}
                setFilters={setFilters}
                source={source}
              />
            </details>
          </Card>

          <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={filters.positionEnabled}
                onChange={(e) =>
                  setFilters({ ...filters, positionEnabled: e.target.checked })
                }
              />
              Find games passing through this position
            </label>
            {filters.positionEnabled && (
              <PositionFilter
                fen={filters.positionFen}
                study={browseMode ? null : study}
                onFen={(fen) =>
                  setFilters((f) => ({ ...f, positionFen: normFen(fen) }))
                }
                allowNodePicker={!browseMode}
              />
            )}
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
            {stage?.kind === 'results' && (
              <span className="meta" style={{ fontSize: 12 }}>
                {stage.games.length} match{stage.games.length === 1 ? '' : 'es'}
              </span>
            )}
            <Btn variant="primary" onClick={search} disabled={busy}>
              <IconSearch size={13} strokeWidth={2.4} />
              {busy && stage?.kind === 'searching' ? 'Searching…' : 'Search'}
            </Btn>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(stage == null || stage.kind === 'searching') && (
            <Card style={{ padding: 24, textAlign: 'center' }}>
              <div className="meta" style={{ fontSize: 13 }}>
                {stage?.kind === 'searching'
                  ? 'Searching…'
                  : 'Run a search to see games.'}
              </div>
            </Card>
          )}

          {err && (
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 13, color: 'var(--danger)' }}>{err}</div>
            </Card>
          )}

          {stage?.kind === 'results' && (
            <ResultsView
              stage={stage}
              studyRoot={studyRootNorm}
              onToggle={(k) => {
                const next = new Set(stage.selected);
                if (next.has(k)) next.delete(k);
                else next.add(k);
                setStage({ ...stage, selected: next });
              }}
              onSelectAll={() =>
                setStage({
                  ...stage,
                  selected: new Set(
                    stage.games.filter((g) => g.matchesStudyRoot).map((g) => g.key),
                  ),
                })
              }
              onClear={() => setStage({ ...stage, selected: new Set() })}
              onContinue={onResultsContinue}
              busy={busy}
            />
          )}

          {stage?.kind === 'choose-study' && (
            <ChooseStudyPanel
              studies={studies}
              busy={busy}
              onBack={() => lastResults && setStage(lastResults)}
              onChoose={chooseStudyAndContinue}
            />
          )}

          {stage?.kind === 'picking' && (
            <PickerPanel
              stage={stage}
              busy={busy}
              onToggle={(idx) => {
                const next = new Set(stage.picked);
                if (next.has(idx)) next.delete(idx);
                else next.add(idx);
                setStage({ ...stage, picked: next });
              }}
              onBack={() => setStage(lastResults)}
              onImport={runImport}
            />
          )}

          {stage?.kind === 'importing' && (
            <Card style={{ padding: 24, textAlign: 'center' }}>
              <div className="meta">Importing…</div>
            </Card>
          )}

          {stage?.kind === 'done' && (
            <DonePanel result={stage.result} onBack={back} />
          )}
        </div>
      </div>
    </div>
  );
}

function baseGameToResult(g: BaseGame): ResultGame {
  return {
    key: `db-${g.id}`,
    // v1: thumbnail shows the game's final position via parent_fen of the
    // last move — server doesn't expose that yet, so we fall back to the
    // start FEN. TODO: surface a `preview_fen` from the API.
    fen: START_FEN,
    whiteName: g.white_name,
    whiteElo: g.white_elo,
    blackName: g.black_name,
    blackElo: g.black_elo,
    event: g.event,
    date: g.event_date,
    result: prettyResult(g.result),
    chapterIndex: null,
    dbId: g.id,
    matchesStudyRoot: true,
    opening: null,
  };
}

function chapterToResult(c: ImportChapterPreview): ResultGame {
  // The preview shape lumps White/Black/Date/Result inside the chapter name
  // (it's built from PGN [Event] when nothing better is available). To keep
  // the cards informative we surface the chapter name verbatim and hide the
  // empty player slots — the trainer's main concern is "which game" and the
  // mainline_move_count tells them how deep it goes.
  return {
    key: `ch-${c.index}`,
    fen: START_FEN,
    whiteName: null,
    whiteElo: null,
    blackName: null,
    blackElo: null,
    event: c.name,
    date: null,
    result: '',
    chapterIndex: c.index,
    dbId: null,
    matchesStudyRoot: c.matches_study_root,
  };
}

function prettyResult(r: string): string {
  if (r === '1') return '1-0';
  if (r === '0') return '0-1';
  if (r === 'd' || r === 'D' || r === '=') return '½-½';
  if (r === '1-0' || r === '0-1' || r === '1/2-1/2') return r === '1/2-1/2' ? '½-½' : r;
  return r;
}

function SourceTabs({
  source,
  setSource,
}: {
  source: Source;
  setSource: (s: Source) => void;
}) {
  return (
    <Segmented
      value={source}
      onChange={setSource}
      ariaLabel="Game source"
      options={[
        { value: 'chesscom', label: 'Chess.com' },
        { value: 'lichess', label: 'Lichess' },
        { value: 'base', label: 'Database' },
      ]}
    />
  );
}

function UserInputs({
  label,
  username,
  setUsername,
}: {
  label: string;
  username: string;
  setUsername: (v: string) => void;
}) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} className="meta" style={{ fontSize: 12 }}>{label}</label>
      <input
        id={id}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="e.g. Hikaru"
        style={inputStyle}
      />
    </div>
  );
}

function FilterControls({
  filters,
  setFilters,
  source,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  source: Source;
}) {
  const tcEnabled = source !== 'base';
  const yearEnabled = source === 'base';
  const yearFromId = useId();
  const yearToId = useId();
  const ecoId = useId();
  const minEloId = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div role="group" aria-label="Color">
        <span className="meta" style={{ fontSize: 12 }}>Color</span>
        <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
          {(['white', 'black', 'either'] as ColorFilter[]).map((c) => (
            <label
              key={c}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <input
                type="radio"
                checked={filters.color === c}
                onChange={() => setFilters({ ...filters, color: c })}
              />
              {c[0].toUpperCase() + c.slice(1)}
            </label>
          ))}
        </div>
      </div>

      <div
        style={{ display: 'flex', gap: 10 }}
        title={yearEnabled ? undefined : 'Only available for the database source'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <label htmlFor={yearFromId} className="meta" style={{ fontSize: 12 }}>Year from</label>
          <input
            id={yearFromId}
            type="number"
            value={filters.yearFrom}
            disabled={!yearEnabled}
            onChange={(e) => setFilters({ ...filters, yearFrom: e.target.value })}
            placeholder="1900"
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <label htmlFor={yearToId} className="meta" style={{ fontSize: 12 }}>Year to</label>
          <input
            id={yearToId}
            type="number"
            value={filters.yearTo}
            disabled={!yearEnabled}
            onChange={(e) => setFilters({ ...filters, yearTo: e.target.value })}
            placeholder="2026"
            style={inputStyle}
          />
        </div>
      </div>

      <div role="group" aria-label="Result">
        <span className="meta" style={{ fontSize: 12 }}>Result</span>
        <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
          {[
            { token: '1-0', label: '1-0' },
            { token: '1/2-1/2', label: '½-½' },
            { token: '0-1', label: '0-1' },
          ].map((r) => (
            <label
              key={r.token}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <input
                type="checkbox"
                checked={filters.results.has(r.token)}
                onChange={(e) => {
                  const next = new Set(filters.results);
                  if (e.target.checked) next.add(r.token);
                  else next.delete(r.token);
                  setFilters({ ...filters, results: next });
                }}
              />
              {r.label}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={ecoId} className="meta" style={{ fontSize: 12 }}>ECO / opening</label>
        <input
          id={ecoId}
          value={filters.eco}
          onChange={(e) => setFilters({ ...filters, eco: e.target.value })}
          placeholder="Sicilian, B22, …"
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 180 }}>
        <label htmlFor={minEloId} className="meta" style={{ fontSize: 12 }}>Min Elo</label>
        <input
          id={minEloId}
          type="number"
          value={filters.minElo}
          onChange={(e) => setFilters({ ...filters, minElo: e.target.value })}
          placeholder="e.g. 2000"
          style={inputStyle}
        />
      </div>

      <div
        role="group"
        aria-label="Time control"
        title={tcEnabled ? undefined : 'Time control isn\'t stored for database games.'}
      >
        <span className="meta" style={{ fontSize: 12 }}>Time control</span>
        <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
          {(['bullet', 'blitz', 'rapid', 'classical'] as TimeControlBucket[]).map((tc) => (
            <label
              key={tc}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                opacity: tcEnabled ? 1 : 0.5,
              }}
            >
              <input
                type="checkbox"
                disabled={!tcEnabled}
                checked={filters.timeControls.has(tc)}
                onChange={(e) => {
                  const next = new Set(filters.timeControls);
                  if (e.target.checked) next.add(tc);
                  else next.delete(tc);
                  setFilters({ ...filters, timeControls: next });
                }}
              />
              {tc[0].toUpperCase() + tc.slice(1)}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function PositionFilter({
  fen,
  study,
  onFen,
  allowNodePicker,
}: {
  fen: string;
  study: OpeningStudyFull | null;
  onFen: (fen: string) => void;
  allowNodePicker: boolean;
}) {
  // Default mode is "play" — the trainer plays moves on the start board to
  // narrow the filter. "Pick study node" only makes sense when we have a
  // study context (i.e. we're in the per-study importer).
  const [mode, setMode] = useState<PositionMode>('play');
  const atStart = normFen(fen) === NORM_START;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Segmented
        value={mode}
        onChange={setMode}
        ariaLabel="Position filter source"
        options={
          allowNodePicker
            ? [
                { value: 'free', label: 'Free editor' },
                { value: 'play', label: 'Play moves' },
                { value: 'node', label: 'Pick study node' },
              ]
            : [
                { value: 'free', label: 'Free editor' },
                { value: 'play', label: 'Play moves' },
              ]
        }
      />
      {mode === 'free' && (
        <PositionSetupBoard
          fen={fen}
          onChange={onFen}
          maxBoardWidth={360}
        />
      )}
      {mode === 'play' && (
        <PlayFromStartBoard onFen={onFen} maxBoardWidth={360} />
      )}
      {mode === 'node' && allowNodePicker && (
        <StudyNodePicker
          study={study}
          selectedFen={fen}
          onPick={onFen}
        />
      )}
      {atStart && (
        <div className="meta" style={{ fontSize: 12 }}>
          All games match — play moves on the board to filter.
        </div>
      )}
      <div className="meta" style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>
        Filter FEN: {fen}
      </div>
    </div>
  );
}

function ResultsView({
  stage,
  studyRoot,
  onToggle,
  onSelectAll,
  onClear,
  onContinue,
  busy,
}: {
  stage: Extract<Stage, { kind: 'results' }>;
  studyRoot: string;
  onToggle: (k: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onContinue: () => void;
  busy: boolean;
}) {
  const useGrid = stage.source === 'base';
  return (
    <Card style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Chip>Showing {stage.games.length} of {stage.total.toLocaleString()}</Chip>
          {stage.source !== 'base' && (
            <span className="meta" style={{ fontSize: 12 }}>post-filtered</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn variant="ghost" size="sm" onClick={onSelectAll} disabled={busy}>
            Select all visible
          </Btn>
          <Btn variant="ghost" size="sm" onClick={onClear} disabled={busy}>
            Clear
          </Btn>
        </div>
      </div>
      {useGrid ? (
        <DbCardGrid stage={stage} onToggle={onToggle} />
      ) : (
        <SourceList stage={stage} studyRoot={studyRoot} onToggle={onToggle} />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
          paddingTop: 6,
        }}
      >
        <Btn
          variant="primary"
          onClick={onContinue}
          disabled={busy || stage.selected.size === 0}
        >
          <IconDownload size={13} strokeWidth={2.4} />
          Import {stage.selected.size} selected →
        </Btn>
      </div>
    </Card>
  );
}

function DbCardGrid({
  stage,
  onToggle,
}: {
  stage: Extract<Stage, { kind: 'results' }>;
  onToggle: (k: string) => void;
}) {
  if (stage.games.length === 0) {
    return (
      <div className="meta" style={{ padding: 24, fontSize: 13, textAlign: 'center' }}>
        No games match those filters.
      </div>
    );
  }
  return (
    <div
      className="scroll-thin"
      style={{
        maxHeight: '64vh',
        overflow: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
        padding: 2,
      }}
    >
      {stage.games.map((g) => {
        const checked = stage.selected.has(g.key);
        return (
          <button
            key={g.key}
            type="button"
            onClick={() => onToggle(g.key)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: 12,
              borderRadius: 12,
              border: `1px solid ${checked ? 'var(--accent-ring)' : 'var(--inset-border)'}`,
              background: checked ? 'var(--accent-soft)' : 'var(--inset-bg)',
              cursor: 'pointer',
              textAlign: 'left',
              color: 'var(--text)',
              font: 'inherit',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {g.result && (
                  <Chip variant="mono" mono>{g.result}</Chip>
                )}
                <span className="meta" style={{ fontSize: 11.5 }}>
                  {g.date ? g.date.slice(0, 10) : ''}
                </span>
              </div>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(g.key)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <FenBoard fen={g.fen} size={140} coordinates={false} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 13 }}>
                <strong>{g.whiteName ?? '?'}</strong>
                {g.whiteElo ? ` (${g.whiteElo})` : ''}
              </div>
              <div style={{ fontSize: 13 }}>
                <strong>{g.blackName ?? '?'}</strong>
                {g.blackElo ? ` (${g.blackElo})` : ''}
              </div>
              {(g.event || g.opening) && (
                <div
                  className="meta"
                  style={{
                    fontSize: 11.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {g.event ?? ''}
                  {g.event && g.opening ? ' · ' : ''}
                  {g.opening ?? ''}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SourceList({
  stage,
  studyRoot,
  onToggle,
}: {
  stage: Extract<Stage, { kind: 'results' }>;
  studyRoot: string;
  onToggle: (k: string) => void;
}) {
  return (
    <div
      className="scroll-thin"
      style={{
        maxHeight: '60vh',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {stage.games.length === 0 && (
        <div className="meta" style={{ padding: 18, fontSize: 13, textAlign: 'center' }}>
          No games match those filters.
        </div>
      )}
      {stage.games.map((g) => {
        const checked = stage.selected.has(g.key);
        const disabled = !g.matchesStudyRoot;
        return (
          <label
            key={g.key}
            title={
              disabled
                ? `This chapter starts from a different position than the study root (${studyRoot})`
                : undefined
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 10,
              borderRadius: 10,
              border: `1px solid ${checked ? 'var(--accent-ring)' : 'var(--inset-border)'}`,
              background: checked ? 'var(--accent-soft)' : 'var(--inset-bg)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.55 : 1,
            }}
          >
            <FenBoard fen={g.fen} size={56} coordinates={false} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {g.whiteName || g.blackName ? (
                <div style={{ fontSize: 13.5 }}>
                  <strong>{g.whiteName ?? '?'}</strong>
                  {g.whiteElo ? ` (${g.whiteElo})` : ''}
                  {' vs '}
                  <strong>{g.blackName ?? '?'}</strong>
                  {g.blackElo ? ` (${g.blackElo})` : ''}
                </div>
              ) : (
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{g.event ?? ''}</div>
              )}
              <div className="meta" style={{ fontSize: 11.5 }}>
                {g.whiteName || g.blackName ? (g.event ?? '') : null}
                {g.event && g.date ? ' · ' : ''}
                {g.date ? g.date.slice(0, 10) : ''}
              </div>
            </div>
            {g.result && (
              <Chip variant="mono" mono>
                {g.result}
              </Chip>
            )}
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle(g.key)}
            />
          </label>
        );
      })}
    </div>
  );
}

function ChooseStudyPanel({
  studies,
  busy,
  onBack,
  onChoose,
}: {
  studies: OpeningStudySummary[] | null;
  busy: boolean;
  onBack: () => void;
  onChoose: (id: number) => void;
}) {
  return (
    <Card style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Choose a study to import into</h2>
        <p className="meta" style={{ margin: 0, fontSize: 12 }}>
          The picked games will be appended to this opening study.
        </p>
      </div>
      <div
        className="scroll-thin"
        style={{
          maxHeight: '60vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {studies == null && (
          <div className="meta" style={{ padding: 18, fontSize: 13, textAlign: 'center' }}>
            Loading…
          </div>
        )}
        {studies != null && studies.length === 0 && (
          <div className="meta" style={{ padding: 18, fontSize: 13, textAlign: 'center' }}>
            You don't have any opening studies yet.
          </div>
        )}
        {(studies ?? []).map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: 10,
              border: '1px solid var(--inset-border)',
              background: 'var(--inset-bg)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
              <div className="meta" style={{ fontSize: 11.5 }}>
                {s.side === 'w' ? 'White' : 'Black'}
                {s.eco ? ` · ${s.eco}` : ''}
                {' · '}
                {s.annotation_count} chapter{s.annotation_count === 1 ? '' : 's'}
              </div>
            </div>
            <Btn
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => onChoose(s.id)}
            >
              Choose
            </Btn>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn variant="ghost" onClick={onBack} disabled={busy}>
          Back
        </Btn>
      </div>
    </Card>
  );
}

function PickerPanel({
  stage,
  busy,
  onToggle,
  onBack,
  onImport,
}: {
  stage: Extract<Stage, { kind: 'picking' }>;
  busy: boolean;
  onToggle: (idx: number) => void;
  onBack: () => void;
  onImport: () => void;
}) {
  return (
    <Card style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p className="meta" style={{ margin: 0, fontSize: 13 }}>
        {stage.chapters.length} chapter{stage.chapters.length === 1 ? '' : 's'} ready to import. Chapters whose starting position differs from this study's root can't be merged.
      </p>
      <div
        className="scroll-thin"
        style={{
          maxHeight: '55vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          border: '1px solid var(--inset-border)',
          borderRadius: 10,
          padding: 4,
        }}
      >
        {stage.chapters.map((c) => {
          const disabled = !c.matches_study_root;
          const checked = stage.picked.has(c.index);
          return (
            <label
              key={c.index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13,
                padding: '8px 10px',
                borderRadius: 8,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                background:
                  checked && !disabled ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <input
                type="checkbox"
                disabled={disabled}
                checked={checked}
                onChange={() => onToggle(c.index)}
              />
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.name}
              </span>
              {c.mainline_move_count > 0 && (
                <span className="meta" style={{ fontSize: 11.5 }}>
                  {c.mainline_move_count} moves
                </span>
              )}
              {disabled && (
                <span style={{ fontSize: 11, color: 'var(--accent)' }}>
                  ⚠ different start
                </span>
              )}
            </label>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn variant="ghost" onClick={onBack} disabled={busy}>
          Back
        </Btn>
        <Btn
          variant="primary"
          onClick={onImport}
          disabled={busy || stage.picked.size === 0}
        >
          Import {stage.picked.size}
        </Btn>
      </div>
    </Card>
  );
}

function DonePanel({
  result,
  onBack,
}: {
  result: ImportResult;
  onBack: () => void;
}) {
  return (
    <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '12px 14px',
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
          Done! {result.imported_chapters} chapters · {result.imported_nodes} new positions · {result.reused_nodes} already in study
        </div>
      </div>
      {result.skipped.length > 0 && (
        <details className="meta" style={{ fontSize: 12 }}>
          <summary>{result.skipped.length} skipped</summary>
          <ul style={{ marginLeft: 16, marginTop: 6, listStyle: 'disc' }}>
            {result.skipped.map((s, i) => (
              <li key={i}>
                <strong>{s.kind}</strong>
                {s.name ? ` (${s.name})` : ''}: {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn variant="primary" onClick={onBack}>Back to study</Btn>
      </div>
    </Card>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--inset-bg)',
  border: '1px solid var(--inset-border)',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  color: 'var(--text)',
};
