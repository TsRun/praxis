import { useEffect, useMemo, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api as CGApi } from 'chessground/api';
import type { Key } from 'chessground/types';
import type { OpeningNode, OpeningChapter } from '../../lib/api';
import { Card, Btn } from '../ui/atoms';
import { IconFlip } from '../ui/Icons';
import { useOpeningTreeNav } from '../../hooks/useOpeningTreeNav';
import { plyOffsetFromFen } from '../../lib/opening-tree';

export interface ChapterWalkerProps {
  studyRootFen: string;
  nodes: OpeningNode[];
  chapters: OpeningChapter[];
  /** The node that anchors the chapter being walked. */
  chapterNodeId: number;
  /** Selected node within the chapter's subtree. `null` = at chapter root. */
  currentNodeId: number | null;
  setCurrentNodeId: (id: number | null) => void;
  flip: boolean;
  setFlip: (v: boolean) => void;
  /** Trainer-only: rename the chapter. Omit for read-only viewer. */
  onSaveTitle?: (value: string, chapterNodeId: number) => void;
  busy?: boolean;
}

/**
 * Subtree-scoped walker for a single chapter. The chapter's anchor node
 * is the root of the walk; descendants whose nearest-chapter-ancestor is
 * this same anchor are inside the walk. Crossing into a nested deeper
 * chapter is shown as a "→ Chapter X" stop sign instead of recursing.
 */
export function ChapterWalker(props: ChapterWalkerProps) {
  const {
    studyRootFen,
    nodes,
    chapters,
    chapterNodeId,
    currentNodeId,
    setCurrentNodeId,
    flip,
    setFlip,
    onSaveTitle,
    busy,
  } = props;
  const plyOffset = plyOffsetFromFen(studyRootFen);

  const chapter = useMemo(
    () => chapters.find((c) => c.node_id === chapterNodeId) ?? null,
    [chapters, chapterNodeId],
  );

  const { subtree, childChapterStops } = useMemo(
    () => buildSubtreeScope(nodes, chapters, chapterNodeId),
    [nodes, chapters, chapterNodeId],
  );

  // Scope keyboard nav (←/→/↑/↓/Home) to the chapter subtree.
  useOpeningTreeNav(subtree, currentNodeId, setCurrentNodeId, true);

  const anchorNode = useMemo(
    () => nodes.find((n) => n.id === chapterNodeId) ?? null,
    [nodes, chapterNodeId],
  );

  const currentNode = useMemo(
    () => (currentNodeId != null ? nodes.find((n) => n.id === currentNodeId) ?? null : null),
    [nodes, currentNodeId],
  );

  // Board shows the current node if any, else the chapter anchor's
  // position (i.e. the position *after* the move that names the chapter).
  const fen = currentNode?.fen ?? anchorNode?.fen ?? props.studyRootFen;
  const lastMove = currentNode?.uci ?? anchorNode?.uci ?? null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 520px',
        gap: 24,
        alignItems: 'start',
      }}
    >
      <Card style={{ padding: '14px 18px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <span className="dot-chapter" style={{ marginTop: 8 }} />
          {onSaveTitle ? (
            <input
              key={chapterNodeId}
              defaultValue={chapter?.title ?? ''}
              placeholder="untitled chapter"
              onBlur={(e) => onSaveTitle(e.target.value.trim(), chapterNodeId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              style={{
                flex: 1,
                background: 'transparent',
                border: 0,
                color: 'var(--text)',
                fontSize: 19,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                outline: 'none',
                padding: 0,
                fontFamily: 'var(--font-sans)',
              }}
            />
          ) : (
            <div
              style={{
                flex: 1,
                fontSize: 19,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: 'var(--text)',
              }}
            >
              {chapter?.title?.trim() || (
                <em style={{ color: 'var(--text-faint)' }}>untitled chapter</em>
              )}
            </div>
          )}
          {busy && (
            <span className="meta" style={{ fontSize: 11 }}>
              Saving…
            </span>
          )}
        </div>

        <ChapterMoveList
          subtree={subtree}
          currentNodeId={currentNodeId}
          onSelect={setCurrentNodeId}
          childChapterStops={childChapterStops}
          plyOffset={plyOffset}
        />
      </Card>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          position: 'sticky',
          top: 72,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className="meta-strong"
            style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
          >
            {currentNode
              ? `${plyLabel(currentNode.ply + plyOffset)} ${currentNode.san}`
              : anchorNode
                ? `Chapter root · after ${plyLabel(anchorNode.ply + plyOffset)} ${anchorNode.san}`
                : 'Start position'}
          </span>
          <Btn variant="ghost" size="sm" onClick={() => setFlip(!flip)}>
            <IconFlip size={12} strokeWidth={2.4} /> Flip
          </Btn>
        </div>
        <WalkerBoard fen={fen} lastMove={lastMove} flip={flip} />
      </div>
    </div>
  );
}

/**
 * Determines which nodes belong to a chapter's subtree (the anchor plus
 * descendants whose nearest titled-chapter ancestor is the same anchor)
 * and collects the deeper chapters that branch off of it.
 *
 * The anchor's `parent_id` is rewritten to `null` in the returned list so
 * that `useOpeningTreeNav` treats it as the root of this scoped walk.
 */
export interface ChildChapterStop {
  chapter: OpeningChapter;
  /** The id of the node *inside* the current subtree that this deeper
   *  chapter hangs off of (i.e. the deeper chapter's anchor.parent_id). */
  attachedTo: number;
}

export function buildSubtreeScope(
  allNodes: OpeningNode[],
  chapters: OpeningChapter[],
  chapterAnchorId: number,
): { subtree: OpeningNode[]; childChapterStops: ChildChapterStop[] } {
  const nodeById = new Map(allNodes.map((n) => [n.id, n] as const));
  const titledChapterByNode = new Map<number, OpeningChapter>();
  for (const c of chapters) {
    if (c.title && c.title.trim().length > 0) titledChapterByNode.set(c.node_id, c);
  }

  const subtree: OpeningNode[] = [];
  const childChapterStops: ChildChapterStop[] = [];

  function visit(node: OpeningNode) {
    subtree.push(node);
    for (const kid of allNodes) {
      if (kid.parent_id !== node.id) continue;
      const deeper = titledChapterByNode.get(kid.id);
      if (deeper) {
        childChapterStops.push({ chapter: deeper, attachedTo: node.id });
        continue;
      }
      visit(kid);
    }
  }
  const anchor = nodeById.get(chapterAnchorId);
  if (anchor) visit(anchor);

  const scoped = subtree.map((n) =>
    n.id === chapterAnchorId ? { ...n, parent_id: null } : n,
  );
  return { subtree: scoped, childChapterStops };
}

function plyLabel(ply: number) {
  return ply % 2 === 1 ? `${Math.ceil(ply / 2)}.` : `${Math.ceil(ply / 2)}…`;
}

/* ───────────────────────────── moves list ───────────────────────────── */

interface ChapterMoveListProps {
  subtree: OpeningNode[];
  currentNodeId: number | null;
  onSelect: (id: number) => void;
  childChapterStops: ChildChapterStop[];
  plyOffset?: number;
}

/**
 * Lichess-style flowing move list, scoped to the chapter subtree.
 * Mainline runs left-to-right; sibling variations appear inline in
 * parentheses. Deeper sub-chapters branching off the tree are shown as
 * "→ Chapter title" stop signs that don't recurse.
 */
function ChapterMoveList({
  subtree,
  currentNodeId,
  onSelect,
  childChapterStops,
  plyOffset = 0,
}: ChapterMoveListProps) {
  const childrenByParent = useMemo(() => {
    const m = new Map<number | null, OpeningNode[]>();
    for (const n of subtree) {
      const list = m.get(n.parent_id) ?? [];
      list.push(n);
      m.set(n.parent_id, list);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.id - b.id);
    }
    return m;
  }, [subtree]);

  // Bucket deeper-chapter stop signs by the node inside this subtree
  // they're attached to.
  const stopsByParent = useMemo(() => {
    const m = new Map<number, OpeningChapter[]>();
    for (const stop of childChapterStops) {
      const list = m.get(stop.attachedTo) ?? [];
      list.push(stop.chapter);
      m.set(stop.attachedTo, list);
    }
    return m;
  }, [childChapterStops]);

  function stopsFor(nodeId: number): React.ReactNode[] {
    const list = stopsByParent.get(nodeId) ?? [];
    return list.map((dc) => (
      <ChapterStop key={`cs-${dc.node_id}`} chapter={dc} />
    ));
  }

  function renderNode(
    node: OpeningNode,
    opts: { variation?: boolean; anchor?: boolean },
  ): React.ReactNode[] {
    return [
      <MoveBtn
        key={`m-${node.id}`}
        node={node}
        selected={node.id === currentNodeId}
        onClick={() => onSelect(node.id)}
        variation={opts.variation}
        anchor={opts.anchor}
        plyOffset={plyOffset}
      />,
      ...stopsFor(node.id),
    ];
  }

  function renderLine(parentId: number | null): React.ReactNode[] {
    const kids = childrenByParent.get(parentId) ?? [];
    if (kids.length === 0) return [];
    const out: React.ReactNode[] = [];
    const main = kids[0];

    out.push(...renderNode(main, {}));

    for (const sib of kids.slice(1)) {
      out.push(<span key={`op-${sib.id}`} className="chap-var-paren">(</span>);
      out.push(...renderNode(sib, { variation: true }));
      out.push(...renderLine(sib.id));
      out.push(<span key={`cl-${sib.id}`} className="chap-var-paren">)</span>);
    }

    out.push(...renderLine(main.id));
    return out;
  }

  // Anchor has rewritten parent_id = null; render it explicitly so its own
  // stops + the rest of the line flow underneath.
  const rootKids = childrenByParent.get(null) ?? [];
  if (rootKids.length === 0) return null;
  const anchor = rootKids[0];

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        lineHeight: 1.85,
        padding: '4px 0',
      }}
    >
      {renderNode(anchor, { anchor: true })}
      {renderLine(anchor.id)}
    </div>
  );
}

function MoveBtn({
  node,
  selected,
  onClick,
  variation,
  anchor,
  plyOffset = 0,
}: {
  node: OpeningNode;
  selected: boolean;
  onClick: () => void;
  variation?: boolean;
  anchor?: boolean;
  plyOffset?: number;
}) {
  const abs = node.ply + plyOffset;
  const num = Math.ceil(abs / 2);
  const prefix = abs % 2 === 1 ? `${num}.` : '';
  const ellipsis = abs % 2 === 0 ? `${num}…` : '';
  const label = `${prefix || ellipsis}${node.san}`;
  return (
    <button
      type="button"
      onClick={onClick}
      className="mono"
      style={{
        background: selected ? 'var(--accent-soft)' : 'transparent',
        border: `1px solid ${selected ? 'var(--accent-ring)' : 'transparent'}`,
        color: variation ? 'var(--text-dim)' : 'var(--text)',
        fontWeight: node.is_main || anchor ? 600 : 500,
        padding: '2px 6px',
        borderRadius: 6,
        fontSize: variation ? 12.5 : 13.5,
        cursor: 'pointer',
        letterSpacing: '-0.005em',
      }}
    >
      {label}
    </button>
  );
}

function ChapterStop({ chapter }: { chapter: OpeningChapter }) {
  return (
    <span
      title={`Continues in chapter "${chapter.title ?? 'untitled'}"`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11.5,
        color: 'var(--text-dim)',
        background: 'var(--inset-bg)',
        border: '1px dashed var(--inset-border)',
        padding: '1px 8px',
        borderRadius: 999,
      }}
    >
      → {chapter.title ?? 'sub-chapter'}
    </span>
  );
}

/* ───────────────────────────── board ───────────────────────────── */

function WalkerBoard({
  fen,
  lastMove,
  flip,
}: {
  fen: string;
  lastMove: string | null;
  flip: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cgRef = useRef<CGApi | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    cgRef.current = Chessground(ref.current, {
      fen,
      orientation: flip ? 'black' : 'white',
      viewOnly: true,
      coordinates: true,
      lastMove:
        lastMove && lastMove.length >= 4
          ? ([lastMove.slice(0, 2), lastMove.slice(2, 4)] as [Key, Key])
          : undefined,
    });
    return () => {
      cgRef.current?.destroy();
      cgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cgRef.current) return;
    cgRef.current.set({
      fen,
      orientation: flip ? 'black' : 'white',
      lastMove:
        lastMove && lastMove.length >= 4
          ? ([lastMove.slice(0, 2), lastMove.slice(2, 4)] as [Key, Key])
          : undefined,
    });
  }, [fen, lastMove, flip]);

  return <div ref={ref} style={{ width: 520, height: 520 }} />;
}
