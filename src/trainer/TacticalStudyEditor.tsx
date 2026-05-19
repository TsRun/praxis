import { useState } from 'react';
import { Card, Btn, Chip, Segmented, ProgressBar } from '../components/ui/atoms';
import { FenBoard } from '../components/board/FenBoard';
import {
  IconBolt,
  IconCheck,
  IconClock,
  IconStar,
  IconAssign,
  IconDownload,
  IconSearch,
  IconPlus,
} from '../components/ui/Icons';

/**
 * Tactical study editor (new study kind). Backend not yet wired — this
 * scaffolds the UI per the design brief so the experience is in place.
 */

interface Puzzle {
  id: number;
  fen: string;
  title: string;
  motif: string[];
  difficulty: 1 | 2 | 3;
  completion_pct: number;
}

const SAMPLE: Puzzle[] = [
  {
    id: 1,
    fen: 'r2qk2r/pp2bppp/2n2n2/3p4/3P4/2N2N2/PP2BPPP/R1BQK2R w KQkq - 0 9',
    title: 'Mating net via deflection',
    motif: ['deflection', 'mate'],
    difficulty: 2,
    completion_pct: 70,
  },
  {
    id: 2,
    fen: '6k1/5ppp/8/8/8/8/r4PPP/4R1K1 w - - 0 1',
    title: 'Rook endgame — back-rank weakness',
    motif: ['back-rank', 'rook ending'],
    difficulty: 3,
    completion_pct: 100,
  },
  {
    id: 3,
    fen: 'r3kb1r/pp1n1ppp/2p1pn2/8/2BP4/2N2N2/PPP2PPP/R1BQK2R w KQkq - 1 7',
    title: 'Pin the f6 knight',
    motif: ['pin'],
    difficulty: 1,
    completion_pct: 45,
  },
  {
    id: 4,
    fen: '4k3/8/8/4q3/8/8/8/4K2R w - - 0 1',
    title: 'Queen vs rook + pawn ladder',
    motif: ['endgame'],
    difficulty: 3,
    completion_pct: 12,
  },
];

type StatusFilter = 'all' | 'unsolved' | 'review';
type Sort = 'order' | 'difficulty' | 'success';

function turnFromFen(fen: string): 'w' | 'b' {
  return (fen.split(' ')[1] as 'w' | 'b') ?? 'w';
}

export function TacticalStudyEditor() {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<Sort>('order');
  const [q, setQ] = useState('');
  const [active, setActive] = useState<number | null>(null);

  let list = SAMPLE.slice();
  list = list.filter((p) =>
    (p.title + p.motif.join(' ')).toLowerCase().includes(q.toLowerCase()),
  );
  if (filter === 'unsolved') list = list.filter((p) => p.completion_pct < 100);
  if (filter === 'review')   list = list.filter((p) => p.completion_pct < 80 && p.completion_pct > 0);
  if (sort === 'difficulty') list.sort((a, b) => b.difficulty - a.difficulty);
  if (sort === 'success')    list.sort((a, b) => b.completion_pct - a.completion_pct);

  return (
    <div
      style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 28px 80px' }}
    >
      {/* head */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 22,
          paddingBottom: 6,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'var(--tactic-bg)',
            color: 'var(--tactic)',
            border: '1px solid var(--tactic-ring)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IconBolt size={26} strokeWidth={2.2} />
        </div>
        <div>
          <h1 className="t-h1" style={{ margin: 0 }}>
            Mate in two — weekly set
          </h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginTop: 8,
            }}
          >
            <Chip
              variant="mono"
              style={{
                color: 'var(--tactic)',
                background: 'var(--tactic-bg)',
                borderColor: 'var(--tactic-ring)',
              }}
            >
              ⚡ Mate in 2
            </Chip>
            <Chip>rating ~1400</Chip>
            <span className="meta">·</span>
            <span className="meta">{SAMPLE.length} puzzles</span>
            <span className="meta">·</span>
            <span className="meta">assigned to 6 students</span>
          </div>
        </div>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Btn variant="secondary">
            <IconDownload size={13} strokeWidth={2.4} />
            Pull from Lichess
          </Btn>
          <Btn variant="primary">
            <IconAssign size={13} strokeWidth={2.4} />
            Assign to student
          </Btn>
        </div>
      </div>

      {/* stats strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          margin: '20px 0 22px',
        }}
      >
        <StatTile danger Icon={IconBolt}  v={SAMPLE.length} l="puzzles in set" />
        <StatTile Icon={IconCheck} v={SAMPLE.filter(p=>p.completion_pct===100).length} l="solved" />
        <StatTile Icon={IconClock} v="42s" l="median solve time" />
        <StatTile Icon={IconStar} v="71%" l="average success" />
      </div>

      {/* filter bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          padding: '10px 14px',
          borderRadius: 12,
          background: 'var(--inset-bg)',
          border: '1px solid var(--inset-border)',
          marginBottom: 20,
        }}
      >
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <IconSearch
            size={14}
            strokeWidth={2.4}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-faint)',
              pointerEvents: 'none',
            }}
          />
          <input
            className="input"
            placeholder="Filter by title or motif…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <Segmented<StatusFilter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all',      label: 'All' },
            { value: 'unsolved', label: 'Unsolved' },
            { value: 'review',   label: 'Needs review' },
          ]}
        />
        <div style={{ flex: 1 }} />
        <span className="meta">Sort by</span>
        <Segmented<Sort>
          value={sort}
          onChange={setSort}
          options={[
            { value: 'order',      label: 'Order' },
            { value: 'difficulty', label: 'Difficulty' },
            { value: 'success',    label: 'Success' },
          ]}
        />
      </div>

      {/* list */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
        }}
      >
        {list.map((p, i) => (
          <PuzzleCard
            key={p.id}
            puzzle={p}
            idx={i}
            active={active === p.id}
            onClick={() => setActive(p.id)}
          />
        ))}
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            minHeight: 200,
            border: '1px dashed var(--inset-border)',
            background: 'transparent',
            boxShadow: 'none',
            textAlign: 'center',
            padding: 18,
            cursor: 'pointer',
            borderRadius: 14,
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'var(--tactic-bg)',
              color: 'var(--tactic)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
            }}
          >
            <IconPlus size={22} strokeWidth={2.2} />
          </div>
          <div className="meta-strong" style={{ marginBottom: 4 }}>
            Add puzzle
          </div>
          <div className="meta" style={{ maxWidth: 240, fontSize: 12 }}>
            Paste a FEN, drop a Lichess puzzle URL, or auto-pull more positions
            at this rating band.
          </div>
        </button>
      </div>
    </div>
  );
}

function StatTile({
  Icon,
  v,
  l,
  danger = false,
}: {
  Icon: typeof IconBolt;
  v: string | number;
  l: string;
  danger?: boolean;
}) {
  return (
    <Card
      style={{
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: danger ? 'var(--tactic-bg)' : 'var(--inset-bg)',
          border: `1px solid ${danger ? 'var(--tactic-ring)' : 'var(--inset-border)'}`,
          color: danger ? 'var(--tactic)' : 'var(--text-dim)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={16} strokeWidth={2.4} />
      </div>
      <div>
        <div
          className="mono"
          style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}
        >
          {v}
        </div>
        <div
          style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 1 }}
        >
          {l}
        </div>
      </div>
    </Card>
  );
}

function PuzzleCard({
  puzzle,
  idx,
  active,
  onClick,
}: {
  puzzle: Puzzle;
  idx: number;
  active: boolean;
  onClick: () => void;
}) {
  const turn = turnFromFen(puzzle.fen);
  const solved = puzzle.completion_pct === 100;
  return (
    <Card
      onClick={onClick}
      style={{
        padding: 14,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        cursor: 'pointer',
        position: 'relative',
        boxShadow: active
          ? 'var(--card-shadow), 0 0 0 2px var(--accent)'
          : 'var(--card-shadow)',
      }}
    >
      {solved && (
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: 'var(--success)',
            color: '#04201c',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            boxShadow: '0 0 0 2px var(--card-bg)',
          }}
        >
          ✓
        </span>
      )}
      <div style={{ width: 96, flexShrink: 0 }}>
        <FenBoard
          fen={puzzle.fen}
          flip={turn === 'b'}
          size={96}
          coordinates={false}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            letterSpacing: '0.04em',
            marginBottom: 4,
          }}
        >
          #{String(idx + 1).padStart(2, '0')}
        </div>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            letterSpacing: '-0.005em',
            marginBottom: 4,
          }}
        >
          {puzzle.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-dim)',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginBottom: 8,
            alignItems: 'center',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: 999,
              marginRight: 4,
              background: turn === 'w' ? '#f8fafc' : '#18181b',
              boxShadow:
                turn === 'w'
                  ? '0 0 0 1px rgba(255,255,255,0.2)'
                  : '0 0 0 1px #e7e7eb',
            }}
          />
          {turn === 'w' ? 'White' : 'Black'} to play · mate in 2
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {puzzle.motif.map((m) => (
            <span
              key={m}
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                background: 'var(--tactic-bg)',
                border: '1px solid var(--tactic-ring)',
                color: 'var(--tactic)',
                fontSize: 11,
              }}
            >
              {m}
            </span>
          ))}
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: 'var(--inset-bg)',
              border: '1px solid var(--inset-border)',
              color: 'var(--text-dim)',
              fontSize: 11,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <DiffPips lvl={puzzle.difficulty} />
            diff
          </span>
        </div>
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11.5,
            color: 'var(--text-faint)',
          }}
        >
          <span>{puzzle.completion_pct}% solved</span>
          <div style={{ flex: 1 }}>
            <ProgressBar pct={puzzle.completion_pct} height={3} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function DiffPips({ lvl }: { lvl: 1 | 2 | 3 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          style={{
            width: 6,
            height: 6,
            borderRadius: 2,
            background: n <= lvl ? 'var(--accent)' : 'var(--inset-bg)',
            border: `1px solid ${n <= lvl ? 'var(--accent-ring)' : 'var(--hairline-2)'}`,
          }}
        />
      ))}
    </span>
  );
}
