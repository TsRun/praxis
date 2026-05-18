import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
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
import { buildTree, pathToNode, findChildBySan, type TreeNode } from '../lib/opening-tree';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

export function OpeningStudyEditor() {
  const { id } = useParams();
  const numId = Number(id);
  const [study, setStudy] = useState<OpeningStudyFull | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDeleteNode, setConfirmDeleteNode] = useState<TreeNode | null>(null);

  // Load study
  useEffect(() => {
    trainerStudies.get(numId).then((s) => {
      setStudy(s);
      setCurrentNodeId(null);
    });
  }, [numId]);

  // Position the board is showing (after current node, or root if none)
  const currentFen = useMemo(() => {
    if (!study) return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    if (currentNodeId == null) return study.root_fen;
    return study.nodes.find((n) => n.id === currentNodeId)?.fen ?? study.root_fen;
  }, [study, currentNodeId]);

  const currentNode: OpeningNode | null = useMemo(() => {
    if (!study || currentNodeId == null) return null;
    return study.nodes.find((n) => n.id === currentNodeId) ?? null;
  }, [study, currentNodeId]);

  const currentChapter: OpeningChapter | null = useMemo(() => {
    if (!study || !currentNode) return null;
    return study.chapters.find((c) => c.node_id === currentNode.id) ?? null;
  }, [study, currentNode]);

  // ── Board (chessground) ───────────────────────────────────────────────────
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

  // Resolve the parent FEN for upserting a new child node
  async function onBoardMove(from: Key, to: Key) {
    if (!study) return;
    const chess = new Chess(currentFen);
    let mv;
    try {
      mv = chess.move({ from, to, promotion: 'q' });
    } catch {
      mv = null;
    }
    if (!mv) return;

    // Look for an existing child first (idempotent navigation)
    const childParentId = currentNode?.id ?? null;
    const existing = findChildBySan(study.nodes, childParentId, mv.san);
    if (existing) {
      setCurrentNodeId(existing.id);
      return;
    }

    // Create a new node
    const { id: newId } = await trainerStudies.upsertNode(study.id, {
      parent_id: childParentId,
      parent_fen: currentFen.split(' ').slice(0, 4).join(' '),
      san: mv.san,
      uci: `${mv.from}${mv.to}${mv.promotion ?? ''}`,
      fen: chess.fen().split(' ').slice(0, 4).join(' '),
      ply: (currentNode?.ply ?? 0) + 1,
    });
    // Refresh study to pick up the new node
    const refreshed = await trainerStudies.get(study.id);
    setStudy(refreshed);
    setCurrentNodeId(newId);
  }

  useEffect(() => {
    if (!boardRef.current) return;
    const c = new Chess(currentFen);
    const turnColor = c.turn() === 'w' ? 'white' : 'black';
    cgRef.current = Chessground(boardRef.current, {
      fen: currentFen,
      turnColor,
      lastMove: currentNode ? ([currentNode.uci.slice(0, 2), currentNode.uci.slice(2, 4)] as [Key, Key]) : undefined,
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
  }, [study?.id]);

  useEffect(() => {
    if (!cgRef.current) return;
    const c = new Chess(currentFen);
    const turnColor = c.turn() === 'w' ? 'white' : 'black';
    cgRef.current.set({
      fen: currentFen,
      turnColor,
      lastMove: currentNode
        ? ([currentNode.uci.slice(0, 2), currentNode.uci.slice(2, 4)] as [Key, Key])
        : undefined,
      movable: {
        color: turnColor,
        dests: toDestsMap(c),
        events: { after: onBoardMove },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFen, currentNodeId]);

  if (!study) return <p className="text-zinc-500">Loading…</p>;
  const path = pathToNode(study.nodes, currentNodeId);
  const tree = buildTree(study.nodes);

  return (
    <div className="grid grid-cols-[280px_auto_1fr] gap-4">
      <aside className="panel p-3 flex flex-col gap-3 overflow-auto max-h-[80vh]">
        <h2 className="font-semibold">{study.name}</h2>
        <div className="text-xs text-zinc-500">
          Plays {study.side === 'w' ? 'white' : 'black'} · {study.nodes.length} nodes
        </div>
        <button
          onClick={() => setCurrentNodeId(null)}
          className={`text-left text-xs px-2 py-1 rounded ${
            currentNodeId == null
              ? 'bg-amber-400/15 text-amber-200'
              : 'text-zinc-400 hover:bg-zinc-800/60'
          }`}
        >
          ★ Root position
        </button>
        <TreeView
          tree={tree}
          currentNodeId={currentNodeId}
          chapters={study.chapters}
          onSelect={setCurrentNodeId}
          onDelete={(n) => setConfirmDeleteNode(n)}
          onToggleMain={async (n) => {
            await trainerStudies.setIsMain(study.id, n.id, !n.is_main);
            const refreshed = await trainerStudies.get(study.id);
            setStudy(refreshed);
          }}
        />
      </aside>

      <div className="flex flex-col gap-3">
        <div className="rounded-xl p-1 panel">
          <div ref={boardRef} className="w-[440px] h-[440px]" />
        </div>
        <div className="panel p-3 text-xs text-zinc-400 font-mono leading-6 max-w-[440px]">
          {path.length === 0 ? (
            <span className="text-zinc-600">no moves played — drag a piece to build the tree</span>
          ) : (
            path.map((n, i) => (
              <button
                key={n.id}
                onClick={() => setCurrentNodeId(n.id)}
                className={`px-1 rounded ${
                  n.id === currentNodeId
                    ? 'bg-amber-400/15 text-amber-200'
                    : 'text-zinc-300 hover:bg-amber-400/10'
                }`}
              >
                {n.ply % 2 === 1 ? `${Math.ceil(n.ply / 2)}.` : ''}
                {n.san}
              </button>
            ))
          )}
        </div>
      </div>

      <ChapterPanel
        key={currentNode?.id ?? 'root'}
        study={study}
        node={currentNode}
        chapter={currentChapter}
        busy={busy}
        onSave={async (title, body) => {
          if (!currentNode) return;
          setBusy(true);
          try {
            await trainerStudies.saveChapter(study.id, currentNode.id, title, body);
            const refreshed = await trainerStudies.get(study.id);
            setStudy(refreshed);
          } finally {
            setBusy(false);
          }
        }}
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
    </div>
  );
}

function TreeView({
  tree,
  currentNodeId,
  chapters,
  onSelect,
  onDelete,
  onToggleMain,
}: {
  tree: TreeNode[];
  currentNodeId: number | null;
  chapters: OpeningChapter[];
  onSelect: (id: number) => void;
  onDelete: (n: TreeNode) => void;
  onToggleMain: (n: TreeNode) => void;
}) {
  const hasChapter = new Set(chapters.map((c) => c.node_id));
  function render(nodes: TreeNode[], depth: number): JSX.Element[] {
    return nodes.flatMap((n) => {
      const isCur = n.id === currentNodeId;
      const moveNum = n.ply % 2 === 1 ? `${Math.ceil(n.ply / 2)}.` : '';
      return [
        <div
          key={n.id}
          className="group flex items-center gap-1"
          style={{ paddingLeft: depth * 12 }}
        >
          <button
            onClick={() => onSelect(n.id)}
            className={`text-left text-xs px-1.5 py-0.5 rounded font-mono flex-1 ${
              isCur
                ? 'bg-amber-400/15 text-amber-200'
                : 'text-zinc-300 hover:bg-amber-400/10'
            }`}
          >
            {moveNum}
            {n.san}
            {n.is_main && <span className="ml-1 text-amber-400">★</span>}
            {hasChapter.has(n.id) && <span className="ml-1 text-emerald-400">●</span>}
          </button>
          <button
            onClick={() => onToggleMain(n)}
            title={n.is_main ? 'Unmark main line' : 'Mark as main line'}
            className="opacity-0 group-hover:opacity-100 text-[10px] text-zinc-500 hover:text-amber-400"
          >
            {n.is_main ? '☆' : '★'}
          </button>
          <button
            onClick={() => onDelete(n)}
            title="Delete sub-tree"
            className="opacity-0 group-hover:opacity-100 text-[10px] text-zinc-500 hover:text-red-400"
          >
            ✕
          </button>
        </div>,
        ...render(n.children, depth + 1),
      ];
    });
  }
  return <div className="flex flex-col gap-0.5">{render(tree, 0)}</div>;
}

function ChapterPanel({
  study,
  node,
  chapter,
  busy,
  onSave,
}: {
  study: OpeningStudyFull;
  node: OpeningNode | null;
  chapter: OpeningChapter | null;
  busy: boolean;
  onSave: (title: string | null, body: string) => Promise<void>;
}) {
  const [title, setTitle] = useState<string>(chapter?.title ?? '');
  const [body, setBody] = useState<string>(chapter?.body_md ?? '');

  useEffect(() => {
    setTitle(chapter?.title ?? '');
    setBody(chapter?.body_md ?? '');
  }, [chapter, node?.id]);

  if (!node) {
    return (
      <aside className="panel p-3 flex flex-col gap-3">
        <div className="text-xs uppercase tracking-wider text-zinc-500">Chapter</div>
        <p className="text-sm text-zinc-500">
          Drop a move on the board to create the first node. Then this panel lets
          you give the position a chapter (title + markdown body).
        </p>
        <p className="text-xs text-zinc-600">
          Study root: {study.name} · plays {study.side === 'w' ? 'white' : 'black'}
        </p>
      </aside>
    );
  }

  return (
    <aside className="panel p-3 flex flex-col gap-3">
      <div className="text-xs uppercase tracking-wider text-zinc-500">
        Chapter for ply {node.ply} · {node.san}
      </div>
      <input
        className="border border-zinc-700 bg-zinc-900 rounded px-2 py-1.5 text-sm"
        placeholder="chapter title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        rows={14}
        className="bg-zinc-950/60 border border-zinc-800 rounded px-2 py-1.5 font-mono text-sm"
        placeholder="markdown body…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button
        disabled={busy}
        onClick={() => onSave(title || null, body)}
        className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save chapter'}
      </button>
    </aside>
  );
}
