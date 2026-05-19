import { useRef, useState } from 'react';
import { Dialog } from '../components/ui/Dialog';
import {
  trainerStudies,
  type LichessChapterPreview,
  type ImportResult,
} from '../lib/api';

interface Props {
  open: boolean;
  studyId: number;
  onClose: () => void;
  onImported: () => void;
}

type Stage =
  | { kind: 'paste' }
  | { kind: 'picking'; pgn: string; chapters: LichessChapterPreview[]; picked: Set<number> }
  | { kind: 'importing' }
  | { kind: 'done'; result: ImportResult };

export function ImportLichessDialog({ open, studyId, onClose, onImported }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'paste' });
  const [pgn, setPgn] = useState('');
  const [filename, setFilename] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setStage({ kind: 'paste' });
    setPgn('');
    setFilename(null);
    setErr(null);
    setBusy(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function onPickFile(file: File) {
    setErr(null);
    try {
      const text = await file.text();
      setPgn(text);
      setFilename(file.name);
    } catch (e) {
      setErr(`Could not read file: ${(e as Error).message}`);
    }
  }

  async function onParse() {
    setBusy(true);
    setErr(null);
    try {
      const { chapters } = await trainerStudies.importPreview(studyId, pgn);
      const picked = new Set(
        chapters.filter((c) => c.matches_study_root).map((c) => c.index),
      );
      setStage({ kind: 'picking', pgn, chapters, picked });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    if (stage.kind !== 'picking') return;
    setBusy(true);
    setErr(null);
    const picks = Array.from(stage.picked);
    const stashed = stage;
    setStage({ kind: 'importing' });
    try {
      const result = await trainerStudies.importLichess(studyId, stashed.pgn, picks);
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
      onClose={busy ? () => {} : () => { reset(); onClose(); }}
      title="Import from Lichess"
      width="w-[36rem]"
    >
      {stage.kind === 'paste' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-zinc-500">
            On Lichess: <em>Share &amp; export → PGN</em>. Paste below, or upload
            the <code className="text-zinc-400">.pgn</code> file you downloaded.
          </p>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1 rounded ring-1 ring-zinc-700 text-zinc-300 hover:ring-amber-400/40 hover:text-amber-300"
            >
              Choose .pgn file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pgn,text/plain,application/x-chess-pgn"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickFile(f);
              }}
            />
            {filename && (
              <span className="text-zinc-500">
                loaded <span className="text-zinc-300 font-mono">{filename}</span>
              </span>
            )}
            {pgn && !filename && (
              <span className="text-zinc-500">
                {pgn.length.toLocaleString()} chars pasted
              </span>
            )}
            {pgn && (
              <button
                type="button"
                onClick={() => {
                  setPgn('');
                  setFilename(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="ml-auto text-zinc-500 hover:text-red-400"
              >
                clear
              </button>
            )}
          </div>
          <textarea
            rows={12}
            autoFocus
            className="bg-zinc-950/60 border border-zinc-800 rounded px-2 py-1.5 font-mono text-xs"
            placeholder={'[Event "Najdorf 6.Be3"]\n\n1. e4 c5 2. Nf3 d6 …'}
            value={pgn}
            onChange={(e) => {
              setPgn(e.target.value);
              if (filename) setFilename(null);
            }}
          />
          {err && <span className="text-xs text-red-400">{err}</span>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { reset(); onClose(); }}
              disabled={busy}
              className="text-zinc-400 px-3 py-1.5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onParse}
              disabled={busy || !pgn.trim()}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium disabled:opacity-50"
            >
              {busy ? 'Parsing…' : 'Parse PGN'}
            </button>
          </div>
        </div>
      )}

      {stage.kind === 'picking' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-zinc-500">
            {stage.chapters.length} chapters found. Chapters that start from a
            different position can't be merged into this study.
          </p>
          <div className="max-h-[50vh] overflow-auto flex flex-col gap-0.5">
            {stage.chapters.map((c) => {
              const disabled = !c.matches_study_root;
              const checked = stage.picked.has(c.index);
              return (
                <label
                  key={c.index}
                  className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded ${
                    disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-zinc-800/60 cursor-pointer'
                  }`}
                  title={disabled ? `Starts from ${c.root_fen}` : undefined}
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={checked}
                    onChange={() => {
                      const next = new Set(stage.picked);
                      if (next.has(c.index)) next.delete(c.index);
                      else next.add(c.index);
                      setStage({ ...stage, picked: next });
                    }}
                  />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-zinc-500">
                    {c.mainline_move_count} moves
                  </span>
                  {disabled && (
                    <span className="text-xs text-amber-400">⚠ different start</span>
                  )}
                </label>
              );
            })}
          </div>
          {err && <span className="text-xs text-red-400">{err}</span>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setStage({ kind: 'paste' })}
              disabled={busy}
              className="text-zinc-400 px-3 py-1.5 disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={onImport}
              disabled={busy || stage.picked.size === 0}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium disabled:opacity-50"
            >
              Import {stage.picked.size}
            </button>
          </div>
        </div>
      )}

      {stage.kind === 'importing' && (
        <p className="text-sm text-zinc-400 text-center py-8">Importing…</p>
      )}

      {stage.kind === 'done' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-emerald-400">
            ✓ {stage.result.imported_chapters} chapters · {stage.result.imported_nodes} new
            positions · {stage.result.reused_nodes} already in study
          </p>
          {stage.result.skipped.length > 0 && (
            <details className="text-xs text-zinc-500">
              <summary>{stage.result.skipped.length} skipped</summary>
              <ul className="ml-4 mt-1 list-disc">
                {stage.result.skipped.map((s, i) => (
                  <li key={i}>
                    <strong>{s.kind}</strong>
                    {s.name ? ` (${s.name})` : ''}: {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex justify-end">
            <button
              onClick={() => {
                reset();
                onClose();
              }}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
