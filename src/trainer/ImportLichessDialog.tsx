import { useRef, useState } from 'react';
import { Dialog } from '../components/ui/Dialog';
import {
  trainerStudies,
  type LichessChapterPreview,
  type ImportResult,
} from '../lib/api';
import { Btn } from '../components/ui/atoms';
import { IconCheck } from '../components/ui/Icons';

interface Props {
  open: boolean;
  studyId: number;
  onClose: () => void;
  onImported: () => void;
}

type Stage =
  | { kind: 'paste' }
  | {
      kind: 'picking';
      pgn: string;
      chapters: LichessChapterPreview[];
      picked: Set<number>;
    }
  | { kind: 'importing' }
  | { kind: 'done'; result: ImportResult };

export function ImportLichessDialog({
  open,
  studyId,
  onClose,
  onImported,
}: Props) {
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
      title="Import from Lichess"
      width={580}
    >
      {stage.kind === 'paste' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className="meta">
            On Lichess: <em>Share &amp; export → PGN</em>. Paste below, or
            upload the <code style={{ color: 'var(--text-dim)' }}>.pgn</code>{' '}
            file you downloaded.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
            }}
          >
            <Btn
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose .pgn file
            </Btn>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pgn,text/plain,application/x-chess-pgn"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickFile(f);
              }}
            />
            {filename && (
              <span className="meta">
                loaded{' '}
                <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                  {filename}
                </span>
              </span>
            )}
            {pgn && !filename && (
              <span className="meta">{pgn.length.toLocaleString()} chars pasted</span>
            )}
            {pgn && (
              <Btn
                variant="ghost"
                size="sm"
                style={{ marginLeft: 'auto' }}
                onClick={() => {
                  setPgn('');
                  setFilename(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Clear
              </Btn>
            )}
          </div>
          <textarea
            rows={12}
            autoFocus
            className="font-mono"
            placeholder={'[Event "Najdorf 6.Be3"]\n\n1. e4 c5 2. Nf3 d6 …'}
            value={pgn}
            onChange={(e) => {
              setPgn(e.target.value);
              if (filename) setFilename(null);
            }}
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
          {err && (
            <span style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</span>
          )}
          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'flex-end',
            }}
          >
            <Btn
              variant="ghost"
              type="button"
              onClick={() => {
                reset();
                onClose();
              }}
              disabled={busy}
            >
              Cancel
            </Btn>
            <Btn
              variant="primary"
              type="button"
              onClick={onParse}
              disabled={busy || !pgn.trim()}
            >
              {busy ? 'Parsing…' : 'Parse PGN'}
            </Btn>
          </div>
        </div>
      )}

      {stage.kind === 'picking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className="meta">
            {stage.chapters.length} chapters found. Chapters that start from a
            different position can't be merged into this study.
          </p>
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
            {stage.chapters.map((c) => {
              const disabled = !c.matches_study_root;
              const checked = stage.picked.has(c.index);
              return (
                <label
                  key={c.index}
                  title={
                    disabled ? `Starts from ${c.root_fen}` : undefined
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    padding: '8px 10px',
                    borderRadius: 8,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                    background: checked && !disabled
                      ? 'var(--accent-soft)'
                      : 'transparent',
                  }}
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
                    <span
                      style={{ fontSize: 11, color: 'var(--accent)' }}
                    >
                      ⚠ different start
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          {err && (
            <span style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</span>
          )}
          <div
            style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}
          >
            <Btn
              variant="ghost"
              type="button"
              onClick={() => setStage({ kind: 'paste' })}
              disabled={busy}
            >
              Back
            </Btn>
            <Btn
              variant="primary"
              type="button"
              onClick={onImport}
              disabled={busy || stage.picked.size === 0}
            >
              Import {stage.picked.size}
            </Btn>
          </div>
        </div>
      )}

      {stage.kind === 'importing' && (
        <div className="meta" style={{ textAlign: 'center', padding: '32px 0' }}>
          Importing…
        </div>
      )}

      {stage.kind === 'done' && (
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
              {stage.result.imported_chapters} chapters · {stage.result.imported_nodes} new
              positions · {stage.result.reused_nodes} already in study
            </div>
          </div>
          {stage.result.skipped.length > 0 && (
            <details className="meta" style={{ fontSize: 12 }}>
              <summary>{stage.result.skipped.length} skipped</summary>
              <ul style={{ marginLeft: 16, marginTop: 6, listStyle: 'disc' }}>
                {stage.result.skipped.map((s, i) => (
                  <li key={i}>
                    <strong>{s.kind}</strong>
                    {s.name ? ` (${s.name})` : ''}: {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn
              variant="primary"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              Done
            </Btn>
          </div>
        </div>
      )}
    </Dialog>
  );
}
