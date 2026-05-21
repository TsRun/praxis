import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../components/ui/Dialog';
import {
  trainerStudies,
  type ImportChapterPreview,
  type ImportResult,
  type BaseGame,
} from '../lib/api';
import { Btn } from '../components/ui/atoms';
import { IconCheck, IconSearch } from '../components/ui/Icons';

interface Props {
  open: boolean;
  studyId: number;
  onClose: () => void;
  onImported: () => void;
}

type Source = 'chesscom' | 'lichess' | 'base';

type BaseFilters = {
  player: string;
  color: 'white' | 'black' | 'either';
  yearFrom: string;
  yearTo: string;
};

type Stage =
  | { kind: 'select-source' }
  | { kind: 'fetching' }
  | {
      kind: 'browse-base';
      games: BaseGame[];
      selected: Set<number>;
      total: number;
      filters: BaseFilters;
    }
  | {
      kind: 'picking';
      source: Source;
      pgn: string;
      chapters: ImportChapterPreview[];
      picked: Set<number>;
      mergeMode: 'chapter' | 'tree';
    }
  | { kind: 'importing' }
  | { kind: 'done'; result: ImportResult };

const emptyFilters: BaseFilters = {
  player: '',
  color: 'either',
  yearFrom: '',
  yearTo: '',
};

export function ImportGamesDialog({ open, studyId, onClose, onImported }: Props) {
  const [tab, setTab] = useState<Source>('chesscom');
  const [stage, setStage] = useState<Stage>({ kind: 'select-source' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Per-tab inputs
  const [ccUsername, setCcUsername] = useState('');
  const [ccMax, setCcMax] = useState(30);
  const [liUsername, setLiUsername] = useState('');
  const [liMax, setLiMax] = useState(30);
  const [liPgn, setLiPgn] = useState('');
  const liFileRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setTab('chesscom');
    setStage({ kind: 'select-source' });
    setErr(null);
    setBusy(false);
    setCcUsername('');
    setCcMax(30);
    setLiUsername('');
    setLiMax(30);
    setLiPgn('');
    if (liFileRef.current) liFileRef.current.value = '';
  }

  useEffect(() => {
    if (!open) return;
    // Clear errors when switching tabs at the source-select stage.
    setErr(null);
  }, [tab, open]);

  function goToPicker(
    source: Source,
    pgn: string,
    chapters: ImportChapterPreview[],
  ) {
    const picked = new Set(
      chapters.filter((c) => c.matches_study_root).map((c) => c.index),
    );
    setStage({
      kind: 'picking',
      source,
      pgn,
      chapters,
      picked,
      mergeMode: 'chapter',
    });
  }

  async function onFetchChessCom() {
    if (!ccUsername.trim()) return;
    setBusy(true);
    setErr(null);
    setStage({ kind: 'fetching' });
    try {
      const { pgn, chapters } = await trainerStudies.fetchChessCom(
        studyId,
        ccUsername.trim(),
        ccMax,
      );
      if (!pgn.trim() || chapters.length === 0) {
        setErr('No games found for that account.');
        setStage({ kind: 'select-source' });
      } else {
        goToPicker('chesscom', pgn, chapters);
      }
    } catch (e) {
      setErr((e as Error).message);
      setStage({ kind: 'select-source' });
    } finally {
      setBusy(false);
    }
  }

  async function onFetchLichess() {
    if (!liUsername.trim()) return;
    setBusy(true);
    setErr(null);
    setStage({ kind: 'fetching' });
    try {
      const { pgn, chapters } = await trainerStudies.fetchLichessUser(
        studyId,
        liUsername.trim(),
        liMax,
      );
      if (!pgn.trim() || chapters.length === 0) {
        setErr('No games found for that account.');
        setStage({ kind: 'select-source' });
      } else {
        goToPicker('lichess', pgn, chapters);
      }
    } catch (e) {
      setErr((e as Error).message);
      setStage({ kind: 'select-source' });
    } finally {
      setBusy(false);
    }
  }

  async function onParsePastedPgn() {
    if (!liPgn.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const { chapters } = await trainerStudies.importPreview(studyId, liPgn);
      if (chapters.length === 0) {
        setErr('No chapters found in PGN.');
      } else {
        goToPicker('lichess', liPgn, chapters);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onPickPgnFile(file: File) {
    setErr(null);
    try {
      setLiPgn(await file.text());
    } catch (e) {
      setErr(`Could not read file: ${(e as Error).message}`);
    }
  }

  async function runBaseSearch(filters: BaseFilters) {
    setBusy(true);
    setErr(null);
    try {
      const res = await trainerStudies.searchBaseGames({
        player: filters.player.trim() || undefined,
        color: filters.color,
        year_from: filters.yearFrom ? Number(filters.yearFrom) : undefined,
        year_to: filters.yearTo ? Number(filters.yearTo) : undefined,
        limit: 50,
      });
      setStage({
        kind: 'browse-base',
        games: res.games,
        selected: new Set(),
        total: res.total,
        filters,
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onImportSelectedBaseGames() {
    if (stage.kind !== 'browse-base') return;
    const ids = Array.from(stage.selected);
    if (ids.length === 0) return;
    setBusy(true);
    setErr(null);
    setStage({ kind: 'fetching' });
    try {
      const { pgn, chapters } = await trainerStudies.fetchBaseGames(studyId, ids);
      if (chapters.length === 0) {
        setErr('Could not reconstruct PGN for the selected games.');
        setStage({ kind: 'select-source' });
      } else {
        goToPicker('base', pgn, chapters);
      }
    } catch (e) {
      setErr((e as Error).message);
      setStage({ kind: 'select-source' });
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    if (stage.kind !== 'picking') return;
    setBusy(true);
    setErr(null);
    const stashed = stage;
    const picks = Array.from(stage.picked);
    // TODO: tree-merge implementation — server currently ignores mergeMode and
    // always inserts as new chapters / variations from the study root. The
    // checkbox UI is wired but the field isn't sent on the wire yet.
    setStage({ kind: 'importing' });
    try {
      const result = await trainerStudies.importLichess(
        studyId,
        stashed.pgn,
        picks,
      );
      setStage({ kind: 'done', result });
      onImported();
    } catch (e) {
      setErr((e as Error).message);
      setStage(stashed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={
        busy
          ? () => {}
          : () => {
              reset();
              onClose();
            }
      }
      title="Import games"
      width={640}
    >
      {(stage.kind === 'select-source' || stage.kind === 'browse-base') && (
        <TabBar tab={tab} setTab={(t) => {
          setTab(t);
          if (stage.kind === 'browse-base') setStage({ kind: 'select-source' });
        }} />
      )}

      {stage.kind === 'select-source' && tab === 'chesscom' && (
        <UserFetchPanel
          label="Chess.com username"
          username={ccUsername}
          setUsername={setCcUsername}
          max={ccMax}
          setMax={setCcMax}
          busy={busy}
          onFetch={onFetchChessCom}
          err={err}
          onCancel={() => {
            reset();
            onClose();
          }}
        />
      )}

      {stage.kind === 'select-source' && tab === 'lichess' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <UserFetchPanel
            label="Lichess username"
            username={liUsername}
            setUsername={setLiUsername}
            max={liMax}
            setMax={setLiMax}
            busy={busy}
            onFetch={onFetchLichess}
            err={err}
            onCancel={() => {
              reset();
              onClose();
            }}
          />
          <details style={{ fontSize: 12 }}>
            <summary
              className="meta"
              style={{ cursor: 'pointer', padding: '4px 0' }}
            >
              Or paste PGN
            </summary>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                marginTop: 10,
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Btn
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => liFileRef.current?.click()}
                >
                  Choose .pgn file
                </Btn>
                <input
                  ref={liFileRef}
                  type="file"
                  accept=".pgn,text/plain,application/x-chess-pgn"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onPickPgnFile(f);
                  }}
                />
                {liPgn && (
                  <span className="meta">
                    {liPgn.length.toLocaleString()} chars loaded
                  </span>
                )}
              </div>
              <textarea
                rows={8}
                className="font-mono"
                placeholder={'[Event "…"]\n\n1. e4 c5 …'}
                value={liPgn}
                onChange={(e) => setLiPgn(e.target.value)}
                style={{
                  background: 'var(--inset-bg)',
                  border: '1px solid var(--inset-border)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 12,
                  color: 'var(--text)',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Btn
                  variant="primary"
                  size="sm"
                  type="button"
                  onClick={onParsePastedPgn}
                  disabled={busy || !liPgn.trim()}
                >
                  {busy ? 'Parsing…' : 'Parse PGN'}
                </Btn>
              </div>
            </div>
          </details>
        </div>
      )}

      {stage.kind === 'select-source' && tab === 'base' && (
        <BaseSearchPanel
          initial={emptyFilters}
          busy={busy}
          err={err}
          onSearch={(f) => void runBaseSearch(f)}
          onCancel={() => {
            reset();
            onClose();
          }}
        />
      )}

      {stage.kind === 'browse-base' && (
        <BaseResultsPanel
          games={stage.games}
          total={stage.total}
          selected={stage.selected}
          filters={stage.filters}
          busy={busy}
          err={err}
          onToggle={(id) => {
            const next = new Set(stage.selected);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setStage({ ...stage, selected: next });
          }}
          onBack={() => setStage({ kind: 'select-source' })}
          onImport={onImportSelectedBaseGames}
          onRefilter={(f) => void runBaseSearch(f)}
        />
      )}

      {stage.kind === 'fetching' && (
        <div className="meta" style={{ textAlign: 'center', padding: '32px 0' }}>
          Fetching games…
        </div>
      )}

      {stage.kind === 'picking' && (
        <PickerPanel
          chapters={stage.chapters}
          picked={stage.picked}
          mergeMode={stage.mergeMode}
          source={stage.source}
          busy={busy}
          err={err}
          onTogglePick={(idx) => {
            const next = new Set(stage.picked);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            setStage({ ...stage, picked: next });
          }}
          onSetMergeMode={(m) => setStage({ ...stage, mergeMode: m })}
          onBack={() => setStage({ kind: 'select-source' })}
          onImport={onImport}
        />
      )}

      {stage.kind === 'importing' && (
        <div className="meta" style={{ textAlign: 'center', padding: '32px 0' }}>
          Importing…
        </div>
      )}

      {stage.kind === 'done' && (
        <DonePanel
          result={stage.result}
          onClose={() => {
            reset();
            onClose();
          }}
        />
      )}
    </Dialog>
  );
}

function TabBar({
  tab,
  setTab,
}: {
  tab: Source;
  setTab: (t: Source) => void;
}) {
  const tabs: { id: Source; label: string }[] = [
    { id: 'chesscom', label: 'Chess.com' },
    { id: 'lichess', label: 'Lichess' },
    { id: 'base', label: 'Database' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid var(--inset-border)',
        marginBottom: 4,
      }}
    >
      {tabs.map((t) => {
        const active = t.id === tab;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '8px 14px',
              fontSize: 13,
              cursor: 'pointer',
              borderBottom: active
                ? '2px solid var(--accent)'
                : '2px solid transparent',
              color: active ? 'var(--text)' : 'var(--text-dim)',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function UserFetchPanel({
  label,
  username,
  setUsername,
  max,
  setMax,
  busy,
  onFetch,
  err,
  onCancel,
}: {
  label: string;
  username: string;
  setUsername: (v: string) => void;
  max: number;
  setMax: (v: number) => void;
  busy: boolean;
  onFetch: () => void;
  err: string | null;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label className="meta" style={{ fontSize: 12 }}>
          {label}
        </label>
        <input
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. Hikaru"
          style={inputStyle}
        />
      </div>
      <div
        style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}
      >
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 160 }}
        >
          <label className="meta" style={{ fontSize: 12 }}>
            Last N games
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={max}
            onChange={(e) =>
              setMax(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
            }
            style={inputStyle}
          />
        </div>
      </div>
      {err && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</span>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </Btn>
        <Btn
          variant="primary"
          type="button"
          onClick={onFetch}
          disabled={busy || !username.trim()}
        >
          {busy ? 'Fetching…' : 'Fetch'}
        </Btn>
      </div>
    </div>
  );
}

function BaseSearchPanel({
  initial,
  busy,
  err,
  onSearch,
  onCancel,
}: {
  initial: BaseFilters;
  busy: boolean;
  err: string | null;
  onSearch: (f: BaseFilters) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState(initial);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label className="meta" style={{ fontSize: 12 }}>
          Player name
        </label>
        <input
          autoFocus
          value={f.player}
          onChange={(e) => setF({ ...f, player: e.target.value })}
          placeholder="e.g. Carlsen"
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <label className="meta" style={{ fontSize: 12 }}>
            Side
          </label>
          <select
            value={f.color}
            onChange={(e) =>
              setF({ ...f, color: e.target.value as BaseFilters['color'] })
            }
            style={inputStyle}
          >
            <option value="either">Either</option>
            <option value="white">White</option>
            <option value="black">Black</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <label className="meta" style={{ fontSize: 12 }}>
            Year from
          </label>
          <input
            type="number"
            value={f.yearFrom}
            onChange={(e) => setF({ ...f, yearFrom: e.target.value })}
            placeholder="1900"
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <label className="meta" style={{ fontSize: 12 }}>
            Year to
          </label>
          <input
            type="number"
            value={f.yearTo}
            onChange={(e) => setF({ ...f, yearTo: e.target.value })}
            placeholder="2026"
            style={inputStyle}
          />
        </div>
      </div>
      {err && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</span>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </Btn>
        <Btn
          variant="primary"
          type="button"
          onClick={() => onSearch(f)}
          disabled={busy}
        >
          <IconSearch size={13} strokeWidth={2.4} />
          {busy ? 'Searching…' : 'Search'}
        </Btn>
      </div>
    </div>
  );
}

function BaseResultsPanel({
  games,
  total,
  selected,
  filters,
  busy,
  err,
  onToggle,
  onBack,
  onImport,
  onRefilter,
}: {
  games: BaseGame[];
  total: number;
  selected: Set<number>;
  filters: BaseFilters;
  busy: boolean;
  err: string | null;
  onToggle: (id: number) => void;
  onBack: () => void;
  onImport: () => void;
  onRefilter: (f: BaseFilters) => void;
}) {
  const [f, setF] = useState(filters);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 2, minWidth: 140 }}>
          <label className="meta" style={{ fontSize: 11 }}>Player</label>
          <input
            value={f.player}
            onChange={(e) => setF({ ...f, player: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 90 }}>
          <label className="meta" style={{ fontSize: 11 }}>Side</label>
          <select
            value={f.color}
            onChange={(e) =>
              setF({ ...f, color: e.target.value as BaseFilters['color'] })
            }
            style={inputStyle}
          >
            <option value="either">Either</option>
            <option value="white">White</option>
            <option value="black">Black</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: 80 }}>
          <label className="meta" style={{ fontSize: 11 }}>From</label>
          <input
            type="number"
            value={f.yearFrom}
            onChange={(e) => setF({ ...f, yearFrom: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: 80 }}>
          <label className="meta" style={{ fontSize: 11 }}>To</label>
          <input
            type="number"
            value={f.yearTo}
            onChange={(e) => setF({ ...f, yearTo: e.target.value })}
            style={inputStyle}
          />
        </div>
        <Btn
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => onRefilter(f)}
          disabled={busy}
        >
          <IconSearch size={12} strokeWidth={2.4} />
          Filter
        </Btn>
      </div>
      <div className="meta" style={{ fontSize: 12 }}>
        {games.length} of {total.toLocaleString()} games shown
      </div>
      <div
        className="scroll-thin"
        style={{
          maxHeight: '40vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          border: '1px solid var(--inset-border)',
          borderRadius: 10,
          padding: 4,
        }}
      >
        {games.map((g) => {
          const checked = selected.has(g.id);
          return (
            <label
              key={g.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12.5,
                padding: '7px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                background: checked ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(g.id)}
              />
              <span style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                <strong>{g.white_name ?? '?'}</strong>
                {g.white_elo ? ` (${g.white_elo})` : ''}
                {' vs '}
                <strong>{g.black_name ?? '?'}</strong>
                {g.black_elo ? ` (${g.black_elo})` : ''}
              </span>
              <span className="meta" style={{ fontSize: 11, width: 80, textAlign: 'right' }}>
                {g.event_date ? g.event_date.slice(0, 10) : ''}
              </span>
              <span style={{ fontSize: 11, width: 50, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                {prettyResult(g.result)}
              </span>
            </label>
          );
        })}
        {games.length === 0 && !busy && (
          <div className="meta" style={{ padding: 16, textAlign: 'center', fontSize: 12 }}>
            No games match those filters.
          </div>
        )}
      </div>
      {err && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</span>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" type="button" onClick={onBack} disabled={busy}>
          Back
        </Btn>
        <Btn
          variant="primary"
          type="button"
          onClick={onImport}
          disabled={busy || selected.size === 0}
        >
          {busy ? 'Loading…' : `Import ${selected.size || ''}`}
        </Btn>
      </div>
    </div>
  );
}

function PickerPanel({
  chapters,
  picked,
  mergeMode,
  source,
  busy,
  err,
  onTogglePick,
  onSetMergeMode,
  onBack,
  onImport,
}: {
  chapters: ImportChapterPreview[];
  picked: Set<number>;
  mergeMode: 'chapter' | 'tree';
  source: Source;
  busy: boolean;
  err: string | null;
  onTogglePick: (idx: number) => void;
  onSetMergeMode: (m: 'chapter' | 'tree') => void;
  onBack: () => void;
  onImport: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <p className="meta" style={{ margin: 0 }}>
          {chapters.length} game{chapters.length === 1 ? '' : 's'} loaded from {sourceLabel(source)}. Chapters that start from a different position can't be merged into this study.
        </p>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11.5,
            color: 'var(--text-dim)',
            whiteSpace: 'nowrap',
          }}
          title="Merge mainline into the current chapter's variation tree instead of creating a new chapter. (Coming soon — toggle has no effect yet.)"
        >
          <input
            type="checkbox"
            checked={mergeMode === 'tree'}
            onChange={(e) => onSetMergeMode(e.target.checked ? 'tree' : 'chapter')}
          />
          Merge into tree
        </label>
      </div>
      <div
        className="scroll-thin"
        style={{
          maxHeight: '50vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          border: '1px solid var(--inset-border)',
          borderRadius: 10,
          padding: 4,
        }}
      >
        {chapters.map((c) => {
          const disabled = !c.matches_study_root;
          const checked = picked.has(c.index);
          return (
            <label
              key={c.index}
              title={disabled ? `Starts from ${c.root_fen}` : undefined}
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
                onChange={() => onTogglePick(c.index)}
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
              <span className="meta" style={{ fontSize: 11.5 }}>
                {c.mainline_move_count} moves
              </span>
              {disabled && (
                <span style={{ fontSize: 11, color: 'var(--accent)' }}>
                  ⚠ different start
                </span>
              )}
            </label>
          );
        })}
      </div>
      {err && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</span>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" type="button" onClick={onBack} disabled={busy}>
          Back
        </Btn>
        <Btn
          variant="primary"
          type="button"
          onClick={onImport}
          disabled={busy || picked.size === 0}
        >
          Import {picked.size}
        </Btn>
      </div>
    </div>
  );
}

function DonePanel({
  result,
  onClose,
}: {
  result: ImportResult;
  onClose: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
          {result.imported_chapters} chapters · {result.imported_nodes} new
          positions · {result.reused_nodes} already in study
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
        <Btn variant="primary" onClick={onClose}>
          Done
        </Btn>
      </div>
    </div>
  );
}

function sourceLabel(s: Source): string {
  if (s === 'chesscom') return 'Chess.com';
  if (s === 'lichess') return 'Lichess';
  return 'the database';
}

function prettyResult(r: string): string {
  if (r === '1') return '1-0';
  if (r === '0') return '0-1';
  if (r === 'd' || r === 'D' || r === '=') return '½-½';
  return r;
}

const inputStyle: React.CSSProperties = {
  background: 'var(--inset-bg)',
  border: '1px solid var(--inset-border)',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  color: 'var(--text)',
  outline: 'none',
};
