import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Chessground } from 'chessground';
import type { Api as CGApi } from 'chessground/api';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import {
  trainerStudies,
  type OpeningStudyFull,
  type OpeningNode,
  type OpeningChapter,
} from '../lib/api';
import {
  pathToNode,
  findChildBySan,
  plyOffsetFromFen,
} from '../lib/opening-tree';
import { EditRootDialog } from './EditRootDialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { BoardToolbar } from '../components/BoardToolbar';
import { EditableTitle } from '../components/ui/EditableTitle';
import { useOpeningTreeNav } from '../hooks/useOpeningTreeNav';
import { ChapterWalker } from '../components/opening/ChapterWalker';
import { ImportLichessDialog } from './ImportLichessDialog';
import { AssignStudyDialog } from './AssignStudyDialog';
import {
  Card,
  Btn,
  Chip,
  MoveChip,
  Segmented,
  Kbd,
} from '../components/ui/atoms';
import {
  IconTree,
  IconList,
  IconDownload,
  IconAssign,
  IconFlip,
  IconPlus,
  IconStar,
  IconTrash,
  IconArrowL,
  IconArrowR,
} from '../components/ui/Icons';

type ViewMode = 'tree' | 'chapters';

// All ply-labelling goes through this. For studies that start from the
// standard position the offset is 0 and behavior is identical to before;
// when the trainer set an opening prefix, the offset shifts every label so
// (e.g.) the first reply after "1.e4 e5 2.Nf3" reads "2..." rather than "1.".
function plyLabel(ply: number, offset = 0) {
  const abs = ply + offset;
  return abs % 2 === 1 ? `${Math.ceil(abs / 2)}.` : `${Math.ceil(abs / 2)}…`;
}

function lineSan(study: OpeningStudyFull, nodeId: number, offset = 0): string {
  return pathToNode(study.nodes, nodeId)
    .map((n) => {
      const abs = n.ply + offset;
      return abs % 2 === 1
        ? `${Math.ceil(abs / 2)}.${n.san}`
        : n.san;
    })
    .join(' ');
}

function childrenOf(nodes: OpeningNode[], parentId: number | null): OpeningNode[] {
  return nodes
    .filter((n) => n.parent_id === parentId)
    .sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.id - b.id);
}

function subtreeSize(nodes: OpeningNode[], id: number): number {
  const kids = nodes.filter((n) => n.parent_id === id);
  return 1 + kids.reduce((s, k) => s + subtreeSize(nodes, k.id), 0);
}

/**
 * The chapter that "owns" a node. A chapter is a subpart of the study: it
 * starts at its `node_id` and covers every descendant until a deeper
 * descendant starts its own chapter. The active chapter for a node is the
 * nearest ancestor (inclusive) that has a chapter assignment.
 *
 * Use `makeChapterLookup(study)` when calling this inside a render loop so
 * the parent/chapter maps are built once instead of per-node.
 */
type ChapterLookup = (nodeId: number) =>
  | { node: OpeningNode; chapter: OpeningChapter }
  | null;

function makeChapterLookup(study: OpeningStudyFull): ChapterLookup {
  const byId = new Map(study.nodes.map((n) => [n.id, n] as const));
  const chapByNode = new Map(
    study.chapters.map((c) => [c.node_id, c] as const),
  );
  return (nodeId: number) => {
    let cursor: number | null = nodeId;
    while (cursor != null) {
      const node = byId.get(cursor);
      if (!node) break;
      const chap = chapByNode.get(cursor);
      if (chap?.title) return { node, chapter: chap };
      cursor = node.parent_id;
    }
    return null;
  };
}

/** Count chapters in the subtree rooted at `id` (including `id` itself). */
function chaptersInSubtree(
  nodes: OpeningNode[],
  chaptersSet: Set<number>,
  id: number,
): number {
  let count = chaptersSet.has(id) ? 1 : 0;
  for (const kid of nodes) {
    if (kid.parent_id === id)
      count += chaptersInSubtree(nodes, chaptersSet, kid.id);
  }
  return count;
}

export function OpeningStudyEditor() {
  const { id } = useParams();
  const numId = Number(id);
  const nav = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [study, setStudy] = useState<OpeningStudyFull | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDeleteNode, setConfirmDeleteNode] =
    useState<OpeningNode | null>(null);
  const [mode, setMode] = useState<ViewMode>('tree');
  const [showImport, setShowImport] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showEditRoot, setShowEditRoot] = useState(false);
  const [flip, setFlip] = useState(false);

  useEffect(() => {
    trainerStudies.get(numId).then((s) => {
      setStudy(s);
      setCurrentNodeId(null);
      setFlip(s.side === 'b');
    });
  }, [numId]);

  // When opened with ?import=lichess (e.g. from the "Import from Lichess"
  // button on the studies list), auto-open the import dialog and strip the
  // param so a refresh doesn't re-open it.
  useEffect(() => {
    if (search.get('import') === 'lichess') {
      setShowImport(true);
      search.delete('import');
      setSearch(search, { replace: true });
    }
  }, [search, setSearch]);

  const currentFen = useMemo(() => {
    if (!study)
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    if (currentNodeId == null) return study.root_fen;
    return (
      study.nodes.find((n) => n.id === currentNodeId)?.fen ?? study.root_fen
    );
  }, [study, currentNodeId]);

  const currentNode: OpeningNode | null = useMemo(() => {
    if (!study || currentNodeId == null) return null;
    return study.nodes.find((n) => n.id === currentNodeId) ?? null;
  }, [study, currentNodeId]);

  const currentChapter: OpeningChapter | null = useMemo(() => {
    if (!study || !currentNode) return null;
    return study.chapters.find((c) => c.node_id === currentNode.id) ?? null;
  }, [study, currentNode]);

  useOpeningTreeNav(
    study?.nodes ?? [],
    currentNodeId,
    setCurrentNodeId,
    // Chapters mode has its own scoped nav inside ChapterWalker — only run
    // the global navigation when we're in tree view.
    mode === 'tree' && !!study,
  );

  if (!study)
    return (
      <div style={{ padding: 28, color: 'var(--text-faint)' }}>Loading…</div>
    );

  const path = pathToNode(study.nodes, currentNodeId);
  const chaptersSet = new Set(study.chapters.map((c) => c.node_id));
  const plyOffset = plyOffsetFromFen(study.root_fen);
  const transpositions = currentNode
    ? study.nodes.filter(
        (n) => n.id !== currentNode.id && n.fen === currentNode.fen,
      )
    : [];

  async function onAddChild(
    parentNode: OpeningNode | null,
    parentFen: string,
    mv: { from: Key; to: Key; san: string; promotion?: string },
  ) {
    if (!study) return;
    const trimmedParentFen = parentFen.split(' ').slice(0, 4).join(' ');
    const newFen = (() => {
      const c = new Chess(parentFen);
      c.move({ from: mv.from, to: mv.to, promotion: 'q' });
      return c.fen().split(' ').slice(0, 4).join(' ');
    })();
    const ply = (parentNode?.ply ?? 0) + 1;
    const uci = `${mv.from}${mv.to}${mv.promotion ?? ''}`;
    const { id: newId } = await trainerStudies.upsertNode(study.id, {
      parent_id: parentNode?.id ?? null,
      parent_fen: trimmedParentFen,
      san: mv.san,
      uci,
      fen: newFen,
      ply,
    });
    // Optimistic append — skip the full-study GET refetch (slow on large
    // studies). The new node is fully determined by the data we just sent.
    setStudy((prev) =>
      prev
        ? {
            ...prev,
            nodes: prev.nodes.some((n) => n.id === newId)
              ? prev.nodes
              : [
                  ...prev.nodes,
                  {
                    id: newId,
                    parent_id: parentNode?.id ?? null,
                    parent_fen: trimmedParentFen,
                    san: mv.san,
                    uci,
                    fen: newFen,
                    ply,
                    is_main: false,
                  },
                ],
          }
        : prev,
    );
    setCurrentNodeId(newId);
  }

  async function saveTitle(value: string, nodeIdOverride?: number) {
    const s = study;
    // Default to the currently-selected node when the caller doesn't pass
    // an explicit id (Tree mode's chapter card). The chapter walker passes
    // the chapter's anchor id explicitly so it doesn't matter where the
    // user has walked inside the chapter.
    const targetNodeId = nodeIdOverride ?? currentNode?.id ?? null;
    if (!s || targetNodeId == null) return;
    setBusy(true);
    try {
      const title = value || null;
      const existing = s.chapters.find((c) => c.node_id === targetNodeId);
      const body_md = existing?.body_md ?? '';
      await trainerStudies.saveChapter(s.id, targetNodeId, title, body_md);
      setStudy((prev) => {
        if (!prev) return prev;
        const others = prev.chapters.filter((c) => c.node_id !== targetNodeId);
        return {
          ...prev,
          chapters: title
            ? [...others, { node_id: targetNodeId, title, body_md }]
            : others,
        };
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggleMain(n: OpeningNode) {
    const s = study;
    if (!s) return;
    const next = !n.is_main;
    await trainerStudies.setIsMain(s.id, n.id, next);
    // Optimistic flip. When promoting a node to mainline, clear is_main
    // on its siblings so we don't end up with two main lines from one parent.
    setStudy((prev) =>
      prev
        ? {
            ...prev,
            nodes: prev.nodes.map((node) => {
              if (node.id === n.id) return { ...node, is_main: next };
              if (
                next &&
                node.parent_id === n.parent_id &&
                node.is_main
              )
                return { ...node, is_main: false };
              return node;
            }),
          }
        : prev,
    );
  }

  return (
    <div
      className="page-wrap"
      style={{
        paddingTop: 24,
        paddingBottom: 80,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 24,
          paddingBottom: 6,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 240, flex: 1 }}>
          <EditableTitle
            level="h1"
            value={study.name}
            onSave={async (next) => {
              await trainerStudies.renameOpening(study.id, next);
              setStudy((prev) => (prev ? { ...prev, name: next } : prev));
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginTop: 8,
            }}
          >
            {study.eco && <Chip variant="mono">{study.eco}</Chip>}
            <Chip>
              plays{' '}
              <span style={{ color: 'var(--text)', marginLeft: 4 }}>
                {study.side === 'w' ? 'white' : 'black'}
              </span>
            </Chip>
            <span className="meta">·</span>
            <span className="meta">{study.nodes.length} positions</span>
            <span className="meta">·</span>
            <span className="meta">{study.chapters.length} chapters</span>
          </div>
          {study.root_pgn && (
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                color: 'var(--text-dim)',
                flexWrap: 'wrap',
              }}
            >
              <span className="meta-strong">Starts from</span>
              <code
                className="mono"
                style={{
                  fontSize: 12,
                  color: 'var(--text)',
                  background: 'var(--inset-bg)',
                  border: '1px solid var(--inset-border)',
                  borderRadius: 6,
                  padding: '2px 8px',
                }}
              >
                {study.root_pgn}
              </code>
              <button
                type="button"
                onClick={() => setShowEditRoot(true)}
                className="link"
                style={{
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Edit prefix
              </button>
            </div>
          )}
          {!study.root_pgn && (
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setShowEditRoot(true)}
                className="link"
                style={{
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--text-dim)',
                }}
              >
                Set opening prefix…
              </button>
            </div>
          )}
        </div>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <Segmented<ViewMode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'tree', label: <><IconTree size={13} strokeWidth={2} />Tree</> },
              { value: 'chapters', label: <><IconList size={13} strokeWidth={2} />Chapters</> },
            ]}
          />
          <Btn variant="secondary" onClick={() => setShowImport(true)}>
            <IconDownload size={13} strokeWidth={2.4} />
            Import from Lichess
          </Btn>
          <Btn
            variant="secondary"
            onClick={() => nav(`/trainer/studies/opening/${numId}/import`)}
          >
            <IconDownload size={13} strokeWidth={2.4} />
            Import games
          </Btn>
          <Btn variant="primary" onClick={() => setShowAssign(true)}>
            <IconAssign size={13} strokeWidth={2.4} />
            Assign to student
          </Btn>
        </div>
      </div>

      {/* sub-head: breadcrumbs + keyboard cheatsheet */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 16px',
          borderRadius: 12,
          background: 'var(--inset-bg)',
          border: '1px solid var(--inset-border)',
        }}
      >
        <div className="crumbs" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setCurrentNodeId(null)}
            className={currentNodeId == null ? 'current' : ''}
          >
            start
          </button>
          {path.map((n) => (
            <span
              key={n.id}
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              <span className="sep">›</span>
              <button
                type="button"
                onClick={() => setCurrentNodeId(n.id)}
                className={n.id === currentNodeId ? 'current' : ''}
              >
                <span className="ply-num">{plyLabel(n.ply, plyOffset)}</span>
                {n.san}
              </button>
            </span>
          ))}
        </div>
        <div
          className="hide-tablet"
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            color: 'var(--text-faint)',
            fontSize: 12,
          }}
        >
          <span>
            <Kbd>←</Kbd> parent
          </span>
          <span>
            <Kbd>→</Kbd> main reply
          </span>
          <span>
            <Kbd>↑↓</Kbd> siblings
          </span>
          <span>
            <Kbd>Home</Kbd> root
          </span>
        </div>
      </div>

      {transpositions.length > 0 && (
        <TranspositionBar
          study={study}
          matches={transpositions}
          onSelect={setCurrentNodeId}
        />
      )}

      {mode === 'tree' ? (
        <div className="editor-grid">
          {/* LEFT: board */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="meta-strong" style={{ fontFamily: 'var(--font-mono)' }}>
                {currentNode
                  ? `After ${plyLabel(currentNode.ply, plyOffset)} ${currentNode.san}`
                  : 'Start position'}
              </span>
              <div style={{ flex: 1 }} />
              <Btn variant="ghost" size="sm" onClick={() => setFlip((f) => !f)}>
                <IconFlip size={12} strokeWidth={2.4} />
                Flip
              </Btn>
            </div>

            <BoardWithBuild
              study={study}
              currentNode={currentNode}
              currentFen={currentFen}
              onAddChild={onAddChild}
              onSelectExisting={setCurrentNodeId}
              flip={flip}
            />

            {currentNode && (
              <ChapterCard
                key={currentNode.id}
                study={study}
                currentNode={currentNode}
                ownChapter={currentChapter}
                busy={busy}
                onSaveTitle={saveTitle}
                onJumpTo={setCurrentNodeId}
              />
            )}
          </div>

          {/* RIGHT: candidates + line so far */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              minWidth: 0,
              width: '100%',
            }}
          >
            <CandidatesCard
              study={study}
              currentNodeId={currentNodeId}
              chaptersSet={chaptersSet}
              onSelect={setCurrentNodeId}
              onToggleMain={toggleMain}
              onDelete={setConfirmDeleteNode}
            />
            <LineSiblingsCard
              study={study}
              path={path}
              currentNodeId={currentNodeId}
              chaptersSet={chaptersSet}
              onSelect={setCurrentNodeId}
            />
          </div>
        </div>
      ) : (
        <ChaptersMode
          study={study}
          flip={flip}
          setFlip={setFlip}
          currentNodeId={currentNodeId}
          setCurrentNodeId={setCurrentNodeId}
          saveTitle={saveTitle}
          busy={busy}
        />
      )}

      <ImportLichessDialog
        open={showImport}
        studyId={study.id}
        onClose={() => setShowImport(false)}
        onImported={async () => {
          const refreshed = await trainerStudies.get(study.id);
          setStudy(refreshed);
        }}
      />

      <AssignStudyDialog
        open={showAssign}
        onClose={() => setShowAssign(false)}
        studyKind="opening"
        studyId={study.id}
        studyName={study.name}
      />

      <ConfirmDialog
        open={confirmDeleteNode != null}
        onClose={() => setConfirmDeleteNode(null)}
        title="Delete this branch?"
        body={
          confirmDeleteNode
            ? `${confirmDeleteNode.san} and every sub-line below it will be removed. This can't be undone.`
            : undefined
        }
        confirmLabel="Delete branch"
        destructive
        onConfirm={async () => {
          if (!confirmDeleteNode) return;
          await trainerStudies.deleteNode(study.id, confirmDeleteNode.id);
          const refreshed = await trainerStudies.get(study.id);
          setStudy(refreshed);
          if (
            currentNodeId === confirmDeleteNode.id ||
            path.some((p) => p.id === confirmDeleteNode.id)
          ) {
            setCurrentNodeId(null);
          }
        }}
      />

      <EditRootDialog
        open={showEditRoot}
        onClose={() => setShowEditRoot(false)}
        side={study.side}
        currentRootPgn={study.root_pgn}
        hasNodes={study.nodes.length > 0}
        onSave={async ({ root_fen, root_pgn }) => {
          await trainerStudies.setRoot(study.id, { root_fen, root_pgn });
          const refreshed = await trainerStudies.get(study.id);
          setStudy(refreshed);
          setCurrentNodeId(null);
        }}
      />
    </div>
  );
}

/* ────────────────────────── Board ───────────────────────────── */

function BoardWithBuild({
  study,
  currentNode,
  currentFen,
  onAddChild,
  onSelectExisting,
  flip,
}: {
  study: OpeningStudyFull;
  currentNode: OpeningNode | null;
  currentFen: string;
  onAddChild: (
    parentNode: OpeningNode | null,
    parentFen: string,
    mv: { from: Key; to: Key; san: string; promotion?: string },
  ) => Promise<void>;
  onSelectExisting: (id: number) => void;
  flip: boolean;
}) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const cgRef = useRef<CGApi | null>(null);

  function toDestsMap(c: Chess): Map<Key, Key[]> {
    const dests = new Map<Key, Key[]>();
    for (const m of c.moves({ verbose: true })) {
      const from = m.from as Key;
      if (!dests.has(from)) dests.set(from, []);
      dests.get(from)!.push(m.to as Key);
    }
    return dests;
  }

  async function onBoardMove(from: Key, to: Key) {
    const chess = new Chess(currentFen);
    let mv;
    try {
      mv = chess.move({ from, to, promotion: 'q' });
    } catch {
      mv = null;
    }
    if (!mv) return;

    // Existing direct child for this SAN — common case, reuse it.
    const existing = findChildBySan(
      study.nodes,
      currentNode?.id ?? null,
      mv.san,
    );
    if (existing) {
      onSelectExisting(existing.id);
      return;
    }

    // Transposition: the resulting FEN already exists elsewhere in the tree
    // (different move order). Jump to the canonical node instead of creating
    // a duplicate. Prefer mainline matches when there's more than one.
    const targetFen = chess.fen().split(' ').slice(0, 4).join(' ');
    const fenMatches = study.nodes.filter((n) => n.fen === targetFen);
    if (fenMatches.length > 0) {
      const pick =
        fenMatches.find((n) => n.is_main) ?? fenMatches[0];
      onSelectExisting(pick.id);
      return;
    }

    await onAddChild(currentNode, currentFen, {
      from,
      to,
      san: mv.san,
      promotion: mv.promotion,
    });
  }

  useEffect(() => {
    if (!boardRef.current) return;
    const c = new Chess(currentFen);
    const turnColor = c.turn() === 'w' ? 'white' : 'black';
    cgRef.current = Chessground(boardRef.current, {
      fen: currentFen,
      turnColor,
      orientation: flip ? 'black' : 'white',
      lastMove: currentNode
        ? ([
            currentNode.uci.slice(0, 2),
            currentNode.uci.slice(2, 4),
          ] as [Key, Key])
        : undefined,
      movable: {
        free: false,
        color: turnColor,
        dests: toDestsMap(c),
        events: { after: onBoardMove },
      },
      draggable: { showGhost: true },
      animation: { duration: 150 },
    });
    return () => {
      cgRef.current?.destroy();
      cgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [study.id]);

  useEffect(() => {
    cgRef.current?.set({ orientation: flip ? 'black' : 'white' });
  }, [flip]);

  useEffect(() => {
    if (!cgRef.current) return;
    const c = new Chess(currentFen);
    const turnColor = c.turn() === 'w' ? 'white' : 'black';
    cgRef.current.set({
      fen: currentFen,
      turnColor,
      lastMove: currentNode
        ? ([
            currentNode.uci.slice(0, 2),
            currentNode.uci.slice(2, 4),
          ] as [Key, Key])
        : undefined,
      movable: {
        color: turnColor,
        dests: toDestsMap(c),
        events: { after: onBoardMove },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFen, currentNode?.id]);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div
        ref={boardRef}
        style={{ width: '100%', maxWidth: 520, aspectRatio: '1 / 1' }}
      />
      <BoardToolbar
        fen={currentFen}
        orientation={flip ? 'black' : 'white'}
      />
    </div>
  );
}

/* ────────────────────────── Candidates card ───────────────────────────── */

function CandidatesCard({
  study,
  currentNodeId,
  chaptersSet,
  onSelect,
  onToggleMain,
  onDelete,
}: {
  study: OpeningStudyFull;
  currentNodeId: number | null;
  chaptersSet: Set<number>;
  onSelect: (id: number) => void;
  onToggleMain: (n: OpeningNode) => void;
  onDelete: (n: OpeningNode) => void;
}) {
  const candidates = childrenOf(study.nodes, currentNodeId);
  const totalSub = candidates.reduce(
    (s, n) => s + subtreeSize(study.nodes, n.id),
    0,
  );
  const chapterLookup = useMemo(() => makeChapterLookup(study), [study]);

  return (
    <Card style={{ padding: '16px 18px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div>
          <h2 className="t-h2" style={{ margin: 0 }}>
            Candidate replies
          </h2>
          <div className="meta">
            {candidates.length === 0
              ? 'No replies yet — drag a piece on the board to add one.'
              : `${candidates.length} ${candidates.length === 1 ? 'move' : 'moves'} from this position · ${totalSub} sub-positions total`}
          </div>
        </div>
        <Btn variant="secondary" size="sm">
          <IconPlus size={12} strokeWidth={2.4} />
          Add move
        </Btn>
      </div>

      {candidates.length === 0 ? (
        <div
          style={{
            padding: 18,
            borderRadius: 12,
            border: '1px dashed var(--inset-border)',
            color: 'var(--text-dim)',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          Drag a piece on the board to add the first reply.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {candidates.map((c) => {
            const sub = subtreeSize(study.nodes, c.id) - 1;
            const share = totalSub
              ? Math.round((subtreeSize(study.nodes, c.id) / totalSub) * 100)
              : 0;
            const active = chapterLookup(c.id);
            const startsChapter = active?.node.id === c.id;
            const subChapters = Math.max(
              0,
              chaptersInSubtree(study.nodes, chaptersSet, c.id) -
                (startsChapter ? 1 : 0),
            );
            const isMain = c.is_main;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 1fr 110px 84px',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: isMain
                    ? 'var(--accent-soft)'
                    : 'var(--chip-bg)',
                  border: `1px solid ${isMain ? 'var(--accent-ring)' : 'var(--chip-border)'}`,
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'inherit',
                  transition: 'all 120ms ease',
                }}
                className="cand-row"
              >
                <div
                  className="mono"
                  style={{
                    fontWeight: 600,
                    fontSize: 18,
                    letterSpacing: '-0.01em',
                    color: 'var(--text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {isMain && (
                    <span style={{ color: 'var(--accent)', fontSize: 14 }}>★</span>
                  )}
                  {c.san}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    minWidth: 0,
                  }}
                >
                  {active ? (
                    <div
                      style={{
                        fontSize: 13.5,
                        color: 'var(--text)',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span className="dot-chapter" />
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {active.chapter.title}
                      </span>
                      {!startsChapter && (
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--text-faint)',
                            fontWeight: 400,
                            flexShrink: 0,
                          }}
                        >
                          (inherited)
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: 13.5,
                        color: 'var(--text-faint)',
                        fontWeight: 500,
                      }}
                    >
                      not part of any chapter
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {subChapters > 0 && (
                      <>
                        <span>
                          <strong
                            className="mono"
                            style={{ color: 'var(--text)' }}
                          >
                            {subChapters}
                          </strong>{' '}
                          sub-{subChapters === 1 ? 'chapter' : 'chapters'} below
                        </span>
                        <span style={{ color: 'var(--text-mute)' }}>·</span>
                      </>
                    )}
                    <span>
                      {sub} {sub === 1 ? 'position' : 'positions'} below
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }} className="bar">
                    <span style={{ width: `${share}%` }} />
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11.5,
                      color: 'var(--text-faint)',
                      minWidth: 32,
                      textAlign: 'right',
                    }}
                  >
                    {share}%
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    type="button"
                    title={isMain ? 'Main line' : 'Set as main line'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMain(c);
                    }}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${isMain ? 'var(--accent-ring)' : 'var(--hairline-2)'}`,
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      color: isMain ? 'var(--accent)' : 'var(--text-dim)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconStar size={12} strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    title="Remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c);
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--hairline-2)',
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconTrash size={12} strokeWidth={2.4} />
                  </button>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ────────────────────────── Line + siblings table ───────────────────── */

function LineSiblingsCard({
  study,
  path,
  currentNodeId,
  chaptersSet,
  onSelect,
}: {
  study: OpeningStudyFull;
  path: OpeningNode[];
  currentNodeId: number | null;
  chaptersSet: Set<number>;
  onSelect: (id: number) => void;
}) {
  return (
    <Card style={{ padding: '14px 16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <h2 className="t-h2" style={{ margin: 0 }}>
          Line · siblings at each ply
        </h2>
        <span className="meta">click any chip to jump</span>
      </div>
      {path.length === 0 ? (
        <div
          style={{
            padding: 18,
            borderRadius: 12,
            border: '1px dashed var(--inset-border)',
            color: 'var(--text-dim)',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          Play a move to start a line.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '38px 1fr',
            rowGap: 6,
            columnGap: 12,
            alignItems: 'center',
          }}
        >
          {path.map((n) => {
            const sibs = childrenOf(study.nodes, n.parent_id);
            return (
              <span
                key={n.id}
                style={{ display: 'contents' }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 11.5,
                    color: 'var(--text-faint)',
                    textAlign: 'right',
                    paddingRight: 4,
                  }}
                >
                  {plyLabel(n.ply, plyOffsetFromFen(study.root_fen))}
                </span>
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  {sibs.map((s) => (
                    <MoveChip
                      key={s.id}
                      san={s.san}
                      minor
                      mainline={s.is_main}
                      hasChapter={chaptersSet.has(s.id)}
                      selected={s.id === currentNodeId}
                      onClick={() => onSelect(s.id)}
                    />
                  ))}
                </div>
              </span>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ────────────────────────── Chapters mode ───────────────────────────── */

function ChaptersMode({
  study,
  flip,
  setFlip,
  currentNodeId,
  setCurrentNodeId,
  saveTitle,
  busy,
}: {
  study: OpeningStudyFull;
  flip: boolean;
  setFlip: (v: boolean) => void;
  currentNodeId: number | null;
  setCurrentNodeId: (id: number | null) => void;
  saveTitle: (v: string) => void;
  busy: boolean;
}) {
  const chapters = useMemo(() => {
    const titledChapters = study.chapters.filter(
      (c) => c.title != null && c.title.trim().length > 0,
    );
    const byNode = new Map(titledChapters.map((c) => [c.node_id, c] as const));
    const ordered = study.nodes
      .filter((n) => byNode.has(n.id))
      .map((n) => ({ node: n, chapter: byNode.get(n.id)! }))
      .sort((a, b) => a.node.ply - b.node.ply || a.node.id - b.node.id);
    return ordered;
  }, [study]);

  const chapterLookup = useMemo(() => makeChapterLookup(study), [study]);
  // Selected chapter = the chapter that owns the current node (inclusive
  // walk). If the current node isn't inside any chapter, fall back to the
  // first chapter so the right pane always has something to show.
  const selectedChapterAnchorId: number | null = useMemo(() => {
    if (currentNodeId != null) {
      const owner = chapterLookup(currentNodeId);
      if (owner) return owner.node.id;
    }
    return chapters[0]?.node.id ?? null;
  }, [currentNodeId, chapterLookup, chapters]);

  function selectChapter(anchorId: number) {
    // Reset the walk to the chapter's anchor so the board snaps to its root.
    setCurrentNodeId(anchorId);
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gap: 24,
        alignItems: 'start',
      }}
    >
      <Card style={{ padding: 0, position: 'sticky', top: 72 }}>
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--hairline)',
          }}
        >
          <h2 className="t-h2" style={{ margin: 0, fontSize: 15 }}>Chapters</h2>
          <div className="meta">
            {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
          </div>
        </div>
        <div style={{ padding: 6, maxHeight: '70vh', overflowY: 'auto' }}>
          {chapters.length === 0 ? (
            <div
              className="meta"
              style={{ padding: 16, fontSize: 12.5, lineHeight: 1.5 }}
            >
              No chapters yet. Switch to Tree mode and type a title under the
              board to start one.
            </div>
          ) : (
            chapters.map(({ node, chapter }, i) => {
              const active = node.id === selectedChapterAnchorId;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => selectChapter(node.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr',
                    alignItems: 'baseline',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    border: 0,
                    textAlign: 'left',
                    color: 'inherit',
                    width: '100%',
                    marginBottom: 2,
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      color: active ? 'var(--accent)' : 'var(--text-faint)',
                      fontSize: 11,
                      textAlign: 'right',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        color: 'var(--text)',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {chapter.title || '(untitled)'}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: 'var(--text-faint)',
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {lineSan(study, node.id, plyOffsetFromFen(study.root_fen)) || `ply ${node.ply}`}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </Card>

      {selectedChapterAnchorId != null ? (
        <ChapterWalker
          studyRootFen={study.root_fen}
          nodes={study.nodes}
          chapters={study.chapters}
          chapterNodeId={selectedChapterAnchorId}
          currentNodeId={currentNodeId}
          setCurrentNodeId={setCurrentNodeId}
          flip={flip}
          setFlip={setFlip}
          onSaveTitle={saveTitle}
          busy={busy}
        />
      ) : (
        <Card
          style={{
            padding: 32,
            textAlign: 'center',
            color: 'var(--text-dim)',
          }}
        >
          Add a chapter from Tree mode to walk it here.
        </Card>
      )}
    </div>
  );
}

/* ────────────────────────── Chapter card (under board) ─────────────────── */

function ChapterCard({
  study,
  currentNode,
  ownChapter,
  busy,
  onSaveTitle,
  onJumpTo,
}: {
  study: OpeningStudyFull;
  currentNode: OpeningNode;
  ownChapter: OpeningChapter | null;
  busy: boolean;
  onSaveTitle: (value: string) => void;
  onJumpTo: (id: number) => void;
}) {
  const owns = ownChapter != null;
  // Look upstream from the parent so we only ever describe the chapter we
  // inherit — if this node already owns one, the inherited copy is itself.
  const inherited =
    !owns && currentNode.parent_id != null
      ? makeChapterLookup(study)(currentNode.parent_id)
      : null;

  return (
    <Card
      style={{
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        borderLeft: owns
          ? '3px solid var(--success)'
          : inherited
            ? '3px solid var(--accent-ring)'
            : '3px solid transparent',
      }}
    >
      {inherited && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--text-dim)',
          }}
        >
          <span className="dot-chapter" />
          In chapter
          <button
            type="button"
            onClick={() => onJumpTo(inherited.node.id)}
            className="link"
            style={{
              background: 'transparent',
              border: 0,
              padding: 0,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {inherited.chapter.title}
          </button>
          <span className="meta" style={{ fontSize: 11 }}>
            (starts at {plyLabel(inherited.node.ply, plyOffsetFromFen(study.root_fen))} {inherited.node.san})
          </span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          className="font-mono"
          placeholder={
            inherited
              ? 'Start a new chapter at this position…'
              : 'untitled chapter'
          }
          defaultValue={ownChapter?.title ?? ''}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (ownChapter?.title ?? '')) onSaveTitle(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          style={{
            flex: 1,
            background: 'transparent',
            border: 0,
            color: 'var(--text)',
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            outline: 'none',
            padding: 0,
            fontFamily: 'var(--font-sans)',
          }}
        />
        {busy && (
          <span className="meta" style={{ fontSize: 11 }}>
            Saving…
          </span>
        )}
      </div>
    </Card>
  );
}

/* ────────────────────────── Transposition bar ───────────────────────────── */

function TranspositionBar({
  study,
  matches,
  onSelect,
}: {
  study: OpeningStudyFull;
  matches: OpeningNode[];
  onSelect: (id: number) => void;
}) {
  const visible = matches.slice(0, 3);
  const hidden = matches.length - visible.length;
  const titleByNode = new Map(
    study.chapters.map((c) => [c.node_id, c.title] as const),
  );

  function shortLine(nodeId: number): string {
    const full = pathToNode(study.nodes, nodeId);
    // last 5 plies (or full line if short) gives enough context without bloat
    const tail = full.length > 5 ? full.slice(-5) : full;
    const prefix = full.length > 5 ? '… ' : '';
    return (
      prefix +
      tail
        .map((n) =>
          n.ply % 2 === 1 ? `${Math.ceil(n.ply / 2)}.${n.san}` : n.san,
        )
        .join(' ')
    );
  }

  return (
    <div
      className="inset"
      style={{
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--accent)',
          fontSize: 12.5,
          fontWeight: 500,
        }}
      >
        <span style={{ fontSize: 14 }}>↻</span>
        Transposition · also reached via {matches.length} other{' '}
        {matches.length === 1 ? 'line' : 'lines'}
      </span>
      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {visible.map((n) => {
          const title = titleByNode.get(n.id);
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onSelect(n.id)}
              title={title ? `Chapter: ${title}` : undefined}
              className="movechip minor"
              style={{
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
              }}
            >
              <span className="san">{shortLine(n.id)}</span>
            </button>
          );
        })}
        {hidden > 0 && (
          <span className="meta" style={{ fontSize: 12 }}>
            +{hidden} more
          </span>
        )}
      </div>
    </div>
  );
}

/* unused exports kept for direct prop typing */
export type { OpeningStudyFull };

void IconArrowL;
void IconArrowR;
