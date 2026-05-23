import { useMemo } from 'react';
import type { OpeningStudyFull, OpeningNode } from '../../lib/api';
import { pathToNode } from '../../lib/opening-tree';

/**
 * Compact list of every node in the study, labeled by its move sequence.
 * Clicking a row sets the filter FEN to that node's position. The root
 * (study start position) is offered as the first entry.
 */
export function StudyNodePicker({
  study,
  selectedFen,
  onPick,
}: {
  study: OpeningStudyFull | null;
  selectedFen: string;
  onPick: (fen: string) => void;
}) {
  const rows = useMemo(() => {
    if (!study) return [] as { id: number | null; label: string; fen: string }[];
    const out: { id: number | null; label: string; fen: string }[] = [
      { id: null, label: 'Start position', fen: normFen(study.root_fen) },
    ];
    for (const n of study.nodes) {
      out.push({
        id: n.id,
        label: nodeLabel(study.nodes, n),
        fen: normFen(n.fen),
      });
    }
    return out;
  }, [study]);

  if (!study) {
    return <div className="meta" style={{ fontSize: 12 }}>Loading study…</div>;
  }
  if (rows.length === 1) {
    return (
      <div className="meta" style={{ fontSize: 12 }}>
        This study has no recorded moves yet. Add some lines first.
      </div>
    );
  }
  return (
    <div
      className="scroll-thin"
      style={{
        maxHeight: 360,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        border: '1px solid var(--inset-border)',
        borderRadius: 10,
        padding: 4,
      }}
    >
      {rows.map((r) => {
        const active = normFen(r.fen) === normFen(selectedFen);
        return (
          <button
            type="button"
            key={r.id ?? 'root'}
            onClick={() => onPick(r.fen)}
            style={{
              textAlign: 'left',
              background: active ? 'var(--accent-soft)' : 'transparent',
              border: `1px solid ${active ? 'var(--accent-ring)' : 'transparent'}`,
              borderRadius: 8,
              padding: '7px 10px',
              fontSize: 12.5,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              color: 'var(--text)',
            }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function normFen(fen: string): string {
  return fen.split(/\s+/).slice(0, 4).join(' ');
}

function nodeLabel(nodes: OpeningNode[], node: OpeningNode): string {
  const chain = pathToNode(nodes, node.id);
  return chain
    .map((n) => (n.ply % 2 === 1 ? `${Math.ceil(n.ply / 2)}.${n.san}` : n.san))
    .join(' ');
}
