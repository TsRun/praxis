import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Btn, Card, Chip, MoveChip, ProgressBar } from '../components/ui/atoms';
import { FenBoard } from '../components/board/FenBoard';
import { IconArrowL, IconArrowR, IconCheck, IconStar, IconX } from '../components/ui/Icons';
import {
  FEN_AFTER_2_NC6,
  FEN_AFTER_3_BC4,
  SCENES,
  TOTAL_MS,
  TOUR_ITALIAN,
  TOUR_TRANSPOSE_A,
  TOUR_TRANSPOSE_B,
  type SceneId,
} from './tour-script';

interface TourState {
  idx: number;
  elapsed: number;
}

export function TourPage() {
  const [state, setState] = useState<TourState>({ idx: 0, elapsed: 0 });
  const [paused, setPaused] = useState(false);
  const rafRef = useRef(0);

  useEffect(() => {
    if (paused) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.max(0, now - last);
      last = now;
      setState((prev) => {
        const dur = SCENES[prev.idx].duration;
        const isLast = prev.idx === SCENES.length - 1;
        const next = prev.elapsed + dt;
        if (next >= dur) {
          if (isLast) {
            return { idx: prev.idx, elapsed: dur };
          }
          return { idx: prev.idx + 1, elapsed: 0 };
        }
        return { idx: prev.idx, elapsed: next };
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused]);

  const scene = SCENES[state.idx];
  const isEnded = state.idx === SCENES.length - 1 && state.elapsed >= scene.duration;

  // Pause automatically when we reach the CTA end
  useEffect(() => {
    if (isEnded && !paused) setPaused(true);
  }, [isEnded, paused]);

  const goto = (idx: number) => {
    setState({ idx: Math.max(0, Math.min(SCENES.length - 1, idx)), elapsed: 0 });
    setPaused(false);
  };
  const restart = () => goto(0);

  // Global progress (% of the full 90s reel)
  let globalElapsed = state.elapsed;
  for (let i = 0; i < state.idx; i++) globalElapsed += SCENES[i].duration;
  const globalPct = (globalElapsed / TOTAL_MS) * 100;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--page-bg)',
      }}
    >
      <h1 className="sr-only">Praxis product tour</h1>
      <TopBar />
      <SceneTabs idx={state.idx} onPick={goto} />
      <div style={{ padding: '0 24px' }}>
        <ProgressBar pct={globalPct} height={3} ariaLabel="Tour progress" />
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
        }}
      >
        <SceneStage scene={scene.id} elapsed={state.elapsed} />
      </div>

      <ControlBar
        paused={paused}
        ended={isEnded}
        idx={state.idx}
        onPrev={() => goto(state.idx - 1)}
        onNext={() => goto(state.idx + 1)}
        onTogglePause={() => setPaused((p) => !p)}
        onRestart={restart}
      />
    </div>
  );
}

/* ─── chrome ─────────────────────────────────────────────────────────── */

function TopBar() {
  return (
    <div
      style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        borderBottom: '1px solid var(--hairline)',
        gap: 16,
      }}
    >
      <Link to="/" className="wordmark" style={{ fontSize: 17 }}>
        <span>Pra</span>
        <span className="accent">xis</span>
      </Link>
      <span className="hide-mobile" style={{ color: 'var(--text-faint)', fontSize: 13 }}>· 90-second tour</span>
      <div style={{ flex: 1 }} />
      <Link
        to="/"
        style={{
          color: 'var(--text-dim)',
          fontSize: 13,
          padding: '10px 12px',
          margin: '-10px -12px',
        }}
      >
        Skip
      </Link>
    </div>
  );
}

function SceneTabs({ idx, onPick }: { idx: number; onPick: (i: number) => void }) {
  const rowRef = useRef<HTMLDivElement>(null);

  // Keep the active scene tab visible as the tour auto-advances.
  // Without this, mobile users see scenes 4-6 play while the tab strip
  // stays scrolled at the start, hiding which scene is active.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const active = row.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (!active) return;
    const targetLeft = active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
  }, [idx]);

  return (
    <div
      ref={rowRef}
      className="scroll-row"
      role="group"
      aria-label="Tour scenes"
      style={{
        gap: 6,
        padding: '14px 24px 10px',
      }}
    >
      {SCENES.map((s, i) => {
        const active = i === idx;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(i)}
            aria-pressed={active}
            aria-label={`Scene ${i + 1}: ${s.label}`}
            style={{
              fontSize: 12.5,
              padding: '5px 10px',
              borderRadius: 999,
              border: active
                ? '1px solid var(--accent-ring)'
                : '1px solid var(--hairline)',
              background: active ? 'var(--accent-soft)' : 'transparent',
              color: active
                ? 'var(--accent)'
                : 'var(--text-dim)',
              cursor: 'pointer',
              letterSpacing: 0.2,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ marginRight: 6, fontVariantNumeric: 'tabular-nums' }}>
              {i + 1}
            </span>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

function ControlBar({
  paused,
  ended,
  idx,
  onPrev,
  onNext,
  onTogglePause,
  onRestart,
}: {
  paused: boolean;
  ended: boolean;
  idx: number;
  onPrev: () => void;
  onNext: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
}) {
  return (
    <div
      style={{
        minHeight: 64,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 16px',
        borderTop: '1px solid var(--hairline)',
        flexWrap: 'wrap',
      }}
    >
      <Btn variant="ghost" size="sm" onClick={onPrev} disabled={idx === 0}>
        <IconArrowL size={14} /> <span style={{ marginLeft: 4 }}>Back</span>
      </Btn>
      <Btn
        variant="ghost"
        size="sm"
        onClick={onTogglePause}
        aria-pressed={paused}
        aria-label={paused ? 'Play tour' : 'Pause tour'}
      >
        {paused ? '▶ Play' : '⏸ Pause'}
      </Btn>
      <Btn variant="ghost" size="sm" onClick={onNext} disabled={idx === SCENES.length - 1}>
        <span style={{ marginRight: 4 }}>Next</span> <IconArrowR size={14} />
      </Btn>

      <div style={{ flex: 1, minWidth: 8 }} />

      {ended && (
        <Btn variant="ghost" size="sm" onClick={onRestart}>
          ↺ Play again
        </Btn>
      )}
      <a href="/#auth">
        <Btn variant="primary" size="md">
          Sign up →
        </Btn>
      </a>
    </div>
  );
}

/* ─── scene router ───────────────────────────────────────────────────── */

function SceneStage({ scene, elapsed }: { scene: SceneId; elapsed: number }) {
  switch (scene) {
    case 'build':
      return <BuildScene elapsed={elapsed} />;
    case 'branch':
      return <BranchScene elapsed={elapsed} />;
    case 'chapter':
      return <ChapterScene elapsed={elapsed} />;
    case 'transpose':
      return <TransposeScene elapsed={elapsed} />;
    case 'drill':
      return <DrillScene elapsed={elapsed} />;
    case 'cta':
      return <CtaScene />;
  }
}

/* ─── layouts ────────────────────────────────────────────────────────── */

function Stage({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="tour-stage">
      <div style={{ display: 'flex', justifyContent: 'center' }}>{left}</div>
      <div>{right}</div>
    </div>
  );
}

function SceneHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h2
        style={{
          fontSize: 34,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          margin: '0 0 12px',
          lineHeight: 1.1,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: 15.5,
          color: 'var(--text-dim)',
          lineHeight: 1.55,
          margin: 0,
          maxWidth: 460,
        }}
      >
        {sub}
      </p>
    </div>
  );
}

/* ─── scene 1: build ─────────────────────────────────────────────────── */

function BuildScene({ elapsed }: { elapsed: number }) {
  const frameMs = 1800;
  const frameIdx = Math.min(
    Math.floor(elapsed / frameMs),
    TOUR_ITALIAN.length - 1,
  );
  const frame = TOUR_ITALIAN[frameIdx];
  const cfg = SCENES[0];

  return (
    <Stage
      left={<TourBoard fen={frame.fen} lastMove={frame.uci} />}
      right={
        <div>
          <SceneHeading title={cfg.title} sub={cfg.sub} />
          <Card style={{ padding: 16 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
                marginBottom: 10,
              }}
            >
              Mainline
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TOUR_ITALIAN.slice(1).map((f, i) => {
                const revealed = i < frameIdx;
                const isLast = i === frameIdx - 1;
                return (
                  <span
                    key={i}
                    style={{
                      opacity: revealed ? 1 : 0.2,
                      transform: revealed ? 'none' : 'translateY(4px)',
                      transition: 'opacity 240ms ease, transform 240ms ease',
                    }}
                  >
                    <MoveChip
                      san={f.san}
                      ply={Math.floor(i / 2) + 1 + (i % 2 === 0 ? '.' : '…')}
                      mainline
                      selected={isLast}
                    />
                  </span>
                );
              })}
            </div>
          </Card>
        </div>
      }
    />
  );
}

/* ─── scene 2: branch ────────────────────────────────────────────────── */

const BRANCH_OPTIONS = [
  { san: 'Bc5', label: 'Giuoco Piano', main: true },
  { san: 'Nf6', label: 'Two Knights', main: false },
  { san: 'Be7', label: 'Hungarian Defense', main: false },
  { san: 'd6', label: 'Paris Defense', main: false },
];

function BranchScene({ elapsed }: { elapsed: number }) {
  const cfg = SCENES[1];
  const revealedCount = Math.min(
    BRANCH_OPTIONS.length,
    Math.max(0, Math.floor((elapsed - 1500) / 1800) + 1),
  );

  return (
    <Stage
      left={<TourBoard fen={FEN_AFTER_3_BC4} lastMove={TOUR_ITALIAN[5].uci} />}
      right={
        <div>
          <SceneHeading title={cfg.title} sub={cfg.sub} />
          <Card style={{ padding: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                }}
              >
                Black to move · 4 candidates
              </div>
              <Chip variant="mono">3…?</Chip>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {BRANCH_OPTIONS.map((opt, i) => {
                const shown = i < revealedCount;
                return (
                  <div
                    key={opt.san}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: opt.main ? 'var(--accent-soft)' : 'var(--inset-bg)',
                      border: '1px solid ' + (opt.main ? 'var(--accent-ring)' : 'var(--inset-border)'),
                      opacity: shown ? 1 : 0,
                      transform: shown ? 'translateX(0)' : 'translateX(-8px)',
                      transition:
                        'opacity 260ms ease, transform 260ms ease',
                    }}
                  >
                    <MoveChip san={opt.san} mainline={opt.main} />
                    <span
                      style={{
                        fontSize: 13,
                        color: opt.main ? 'var(--accent)' : 'var(--text-dim)',
                      }}
                    >
                      {opt.label}
                    </span>
                    {opt.main && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: 11,
                          color: 'var(--accent)',
                          letterSpacing: 0.4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <IconStar size={11} /> Main
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      }
    />
  );
}

/* ─── scene 3: chapter ───────────────────────────────────────────────── */

function ChapterScene({ elapsed }: { elapsed: number }) {
  const cfg = SCENES[2];
  const chapterIn = elapsed > 2000;
  const subRevealed = elapsed > 5000;

  return (
    <Stage
      left={<TourBoard fen={FEN_AFTER_3_BC4} lastMove={TOUR_ITALIAN[5].uci} />}
      right={
        <div>
          <SceneHeading title={cfg.title} sub={cfg.sub} />
          <Card
            style={{
              padding: 18,
              borderLeft: '3px solid var(--success)',
              opacity: chapterIn ? 1 : 0,
              transform: chapterIn ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 360ms ease, transform 360ms ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
              }}
            >
              <span className="dot-chapter" />
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--success)',
                }}
              >
                Chapter
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
              The Italian Game
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: 13.5, marginBottom: 14 }}>
              Starts at 3.Bc4 — covers 4 sub-variations and 27 positions beneath.
            </div>

            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
                marginBottom: 8,
              }}
            >
              Positions in this chapter
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                opacity: subRevealed ? 1 : 0,
                transition: 'opacity 400ms ease',
              }}
            >
              {['3…Bc5', '4.c3', '4.b4', '3…Nf6', '4.Ng5', '3…Be7', '3…d6'].map(
                (m) => (
                  <MoveChip key={m} san={m} hasChapter />
                ),
              )}
            </div>
          </Card>
        </div>
      }
    />
  );
}

/* ─── scene 4: transpose ─────────────────────────────────────────────── */

function TransposeScene({ elapsed }: { elapsed: number }) {
  const cfg = SCENES[3];
  // Each board plays its 3-ply line over the first 7s. Then both linger.
  const stepMs = 2000;
  const idxA = Math.min(TOUR_TRANSPOSE_A.length - 1, Math.floor(elapsed / stepMs));
  const idxB = Math.min(
    TOUR_TRANSPOSE_B.length - 1,
    Math.floor(elapsed / stepMs),
  );
  const merged = idxA === TOUR_TRANSPOSE_A.length - 1 && idxB === TOUR_TRANSPOSE_B.length - 1;
  const mergeT = elapsed - stepMs * (TOUR_TRANSPOSE_A.length - 1);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 1080,
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h2
          style={{
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: '0 0 8px',
          }}
        >
          {cfg.title}
        </h2>
        <p
          style={{
            fontSize: 15,
            color: 'var(--text-dim)',
            lineHeight: 1.55,
            margin: 0,
            maxWidth: 540,
            marginInline: 'auto',
          }}
        >
          {cfg.sub}
        </p>
      </div>

      <div className="tour-stage-3">
        <TransposePane
          label="Path A"
          movesText="1.e4 e5 2.Nf3"
          frame={TOUR_TRANSPOSE_A[idxA]}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            opacity: merged ? 1 : 0.25,
            transition: 'opacity 500ms ease',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent-ring)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              fontSize: 18,
              position: 'relative',
            }}
          >
            =
            {merged && mergeT < 1500 && (
              <span
                className="pulse-ring"
                style={{
                  position: 'absolute',
                  inset: -6,
                  borderRadius: 999,
                  border: '2px solid var(--accent)',
                }}
              />
            )}
          </div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              textAlign: 'center',
            }}
          >
            Same FEN
          </div>
        </div>
        <TransposePane
          label="Path B"
          movesText="1.Nf3 e5 2.e4"
          frame={TOUR_TRANSPOSE_B[idxB]}
        />
      </div>
    </div>
  );
}

function TransposePane({
  label,
  movesText,
  frame,
}: {
  label: string;
  movesText: string;
  frame: { fen: string; uci: string | null };
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
        }}
      >
        {label}
      </div>
      <TourBoard fen={frame.fen} lastMove={frame.uci} size={300} />
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12.5,
          color: 'var(--text-dim)',
        }}
      >
        {movesText}
      </div>
    </div>
  );
}

/* ─── scene 5: drill ─────────────────────────────────────────────────── */

function DrillScene({ elapsed }: { elapsed: number }) {
  const cfg = SCENES[4];

  // Beats:
  //   0–4s:   ask + thinking
  //   4–7s:   wrong attempt 3.b3 shown
  //   7–10s:  back to thinking
  //   10–14s: correct 3.Bc4 + success
  //   14–18s: scheduled card lingers
  type Beat = 'ask' | 'wrong' | 'retry' | 'correct';
  const beat: Beat =
    elapsed < 4000 ? 'ask'
    : elapsed < 7000 ? 'wrong'
    : elapsed < 10000 ? 'retry'
    : 'correct';

  return (
    <Stage
      left={<TourBoard fen={FEN_AFTER_2_NC6} lastMove={TOUR_ITALIAN[4].uci} />}
      right={
        <div>
          <SceneHeading title={cfg.title} sub={cfg.sub} />
          <Card style={{ padding: 18 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                }}
              >
                Quiz · Italian Game
              </div>
              <Chip variant="mono">4 / 12</Chip>
            </div>
            <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 14 }}>
              Your move as White?
            </div>

            <DrillAttempts beat={beat} />

            {beat === 'correct' && elapsed > 13000 && (
              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--inset-bg)',
                  border: '1px solid var(--inset-border)',
                  fontSize: 13.5,
                  color: 'var(--text-dim)',
                  opacity: 0,
                  animation: 'fadein 320ms ease forwards',
                }}
              >
                Next review: in <strong style={{ color: 'var(--text)' }}>3 days</strong> ·
                streak 4 →&nbsp;5
              </div>
            )}
          </Card>
        </div>
      }
    />
  );
}

function DrillAttempts({ beat }: { beat: 'ask' | 'wrong' | 'retry' | 'correct' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <DrillRow
        san="Nc3"
        state={beat === 'wrong' ? 'wrong' : beat === 'retry' || beat === 'correct' ? 'wrong-faded' : 'hidden'}
        note="not the book line"
      />
      <DrillRow
        san="Bc4"
        state={beat === 'correct' ? 'correct' : 'hidden'}
        note="Italian Game"
      />
    </div>
  );
}

function DrillRow({
  san,
  state,
  note,
}: {
  san: string;
  state: 'hidden' | 'wrong' | 'wrong-faded' | 'correct';
  note: string;
}) {
  if (state === 'hidden') {
    return <div style={{ height: 38 }} />;
  }
  const isCorrect = state === 'correct';
  const isWrong = state === 'wrong' || state === 'wrong-faded';
  const dim = state === 'wrong-faded';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 8,
        flexWrap: 'wrap',
        background: isCorrect
          ? 'var(--success-bg)'
          : isWrong
          ? 'var(--danger-bg)'
          : 'var(--inset-bg)',
        border:
          '1px solid ' +
          (isCorrect
            ? 'rgba(52, 211, 153, 0.4)'
            : isWrong
            ? 'rgba(248, 113, 113, 0.4)'
            : 'var(--inset-border)'),
        opacity: dim ? 0.6 : 1,
        animation: state === 'wrong' ? 'shake 320ms ease' : undefined,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: 999,
          background: isCorrect ? 'var(--success)' : 'var(--danger)',
          color: '#0a0a0c',
        }}
      >
        {isCorrect ? <IconCheck size={12} /> : <IconX size={12} />}
      </span>
      <MoveChip san={san} mainline={isCorrect} />
      <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{note}</span>
    </div>
  );
}

/* ─── scene 6: CTA ───────────────────────────────────────────────────── */

function CtaScene() {
  const cfg = SCENES[5];
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 640,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 18,
          background:
            'linear-gradient(135deg, #fcc845 0%, #f5a623 100%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 36,
          color: 'var(--accent-on)',
          fontWeight: 700,
          boxShadow: '0 0 40px var(--accent-glow)',
          marginBottom: 8,
        }}
      >
        ♚
      </div>
      <h2
        style={{
          fontSize: 40,
          fontWeight: 600,
          letterSpacing: '-0.025em',
          margin: 0,
        }}
      >
        {cfg.title}
      </h2>
      <p
        style={{
          fontSize: 16,
          color: 'var(--text-dim)',
          margin: 0,
          lineHeight: 1.55,
          maxWidth: 480,
        }}
      >
        {cfg.sub}
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <a href="/#auth">
          <Btn variant="primary" size="lg">
            Create a free account →
          </Btn>
        </a>
        <Link to="/">
          <Btn variant="ghost" size="lg">
            Back to home
          </Btn>
        </Link>
      </div>
    </div>
  );
}

/* ─── shared bits ────────────────────────────────────────────────────── */

function TourBoard({
  fen,
  lastMove,
  size = 400,
}: {
  fen: string;
  lastMove: string | null;
  size?: number;
}) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: size + 28,
        marginInline: 'auto',
        padding: 14,
        background: 'var(--card-bg)',
        borderRadius: 16,
        boxShadow:
          'var(--card-shadow), 0 30px 60px -24px rgba(0,0,0,0.6)',
      }}
    >
      <FenBoard fen={fen} lastMove={lastMove ?? undefined} size={size} coordinates={false} />
    </div>
  );
}
