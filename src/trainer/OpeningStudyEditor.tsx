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
import { TreeGraph } from '../components/opening/TreeGraph';
import { ChaptersOutline } from '../components/opening/ChaptersOutline';
import { useOpeningTreeNav } from '../hooks/useOpeningTreeNav';

type ViewMode = 'tree' | 'chapters';

export function OpeningStudyEditor() {
  const { id } = useParams();
  const numId = Number(id);
  const [study, setStudy] = useState<OpeningStudyFull | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDeleteNode, setConfirmDeleteNode] = useState<TreeNode | null>(null);
  const [mode, setMode] = useState<ViewMode>('tree');

  useEffect(() => {
    trainerStudies.get(numId).then((s) => {
      setStudy(s);
      setCurrentNodeId(null);
    });
  }, [numId]);

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

  useOpeningTreeNav(
    study?.nodes ?? [],
    currentNodeId,
    setCurrentNodeId,
    mode === 'tree' && !!study,
  );

  if (!study) return <p className="text-zinc-500">Loading…</p>;

  const path = pathToNode(study.nodes, currentNodeId);
  const tree = buildTree(study.nodes);
  const chaptersSet = new Set(study.chapters.map((c) => c.node_id));

  async function onAddChild(parentNode: OpeningNode | null, parentFen: string, mv: { from: Key; to: Key; san: string; promotion?: string }) {
    if (!study) return;
    const { id: newId } = await trainerStudies.upsertNode(study.id, {
      parent_id: parentNode?.id ?? null,
      parent_fen: parentFen.split(' ').slice(0, 4).join(' '),
      san: mv.san,
      uci: `${mv.from}${mv.to}${mv.promotion ?? ''}`,
      fen: (() => {
        const c = new Chess(parentFen);
        c.move({ from: mv.from, to: mv.to, promotion: 'q' });
        return c.fen().split(' ').slice(0, 4).join(' ');
      })(),
      ply: (parentNode?.ply ?? 0) + 1,
    });
    const refreshed = await trainerStudies.get(study.id);
    setStudy(refreshed);
    setCurrentNodeId(newId);
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{study.name}</h1>
        <div className="text-xs text-zinc-500">
          plays {study.side === 'w' ? 'white' : 'black'} · {study.nodes.length} positions ·{' '}
          {study.chapters.length} chapters
        </div>
        <div className="ml-auto inline-flex bg-zinc-900/60 ring-1 ring-zinc-800 rounded-lg overflow-hidden text-xs">
          <button
            onClick={() => setMode('tree')}
            className={`px-3 py-1 ${
              mode === 'tree'
                ? 'bg-amber-400/15 text-amber-200'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            Tree
          </button>
          <button
            onClick={() => setMode('chapters')}
            className={`px-3 py-1 ${
              mode === 'chapters'
                ? 'bg-amber-400/15 text-amber-200'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            Chapters
          </button>
        </div>
      </header>

      {mode === 'tree' ? (
        <>
          <div className="grid grid-cols-[auto_1fr] gap-4">
            <div className="flex flex-col gap-3">
              <BoardWithBuild
                study={study}
                currentNode={currentNode}
                currentFen={currentFen}
                onAddChild={onAddChild}
                onSelectExisting={setCurrentNodeId}
              />
              <div className="panel p-3 text-xs text-zinc-400 font-mono leading-6 max-w-[440px]">
                {path.length === 0 ? (
                  <button
                    onClick={() => setCurrentNodeId(null)}
                    className="text-zinc-600 hover:text-amber-300"
                  >
                    ★ root position — drag a piece to start
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setCurrentNodeId(null)}
                      className={`px-1 rounded ${
                        currentNodeId == null
                          ? 'bg-amber-400/15 text-amber-200'
                          : 'text-zinc-500 hover:bg-amber-400/10'
                      }`}
                    >
                      ★
                    </button>
                    {path.map((n) => (
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
                    ))}
                  </>
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
          </div>

          <section className="panel p-3">
            <div className="flex items-center mb-2">
              <h2 className="text-xs uppercase tracking-wider text-zinc-500">Opening tree</h2>
              <div className="ml-auto flex items-center gap-3 text-[10px] text-zinc-500">
                <span><span className="text-amber-400">★</span> main line</span>
                <span><span className="text-emerald-400">●</span> has chapter</span>
                <span className="text-zinc-600">hover a node for ✕ / ★ actions</span>
              </div>
            </div>
            <TreeGraph
              tree={tree}
              currentNodeId={currentNodeId}
              chaptersSet={chaptersSet}
              onSelect={setCurrentNodeId}
              onDelete={(n) => setConfirmDeleteNode(n)}
              onToggleMain={async (n) => {
                await trainerStudies.setIsMain(study.id, n.id, !n.is_main);
                const refreshed = await trainerStudies.get(study.id);
                setStudy(refreshed);
              }}
            />
          </section>
        </>
      ) : (
        <div className="grid grid-cols-[340px_1fr] gap-4">
          <aside className="panel p-3 max-h-[80vh] overflow-auto">
            <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Chapters</h2>
            <ChaptersOutline
              nodes={study.nodes}
              chapters={study.chapters}
              currentNodeId={currentNodeId}
              onSelect={setCurrentNodeId}
            />
          </aside>
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
        </div>
      )}

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

// ─── Board (handles new-move detection + existing-child reuse) ───────────────

function BoardWithBuild({
  study,
  currentNode,
  currentFen,
  onAddChild,
  onSelectExisting,
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
}) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const cgRef = useRef<CGApi | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>(
    study.side === 'b' ? 'black' : 'white',
  );

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
    const existing = findChildBySan(study.nodes, currentNode?.id ?? null, mv.san);
    if (existing) {
      onSelectExisting(existing.id);
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
      orientation,
      lastMove: currentNode
        ? ([currentNode.uci.slice(0, 2), currentNode.uci.slice(2, 4)] as [Key, Key])
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
    cgRef.current?.set({ orientation });
  }, [orientation]);

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
  }, [currentFen, currentNode?.id]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
          title="Flip board"
          className="text-xs text-zinc-400 hover:text-amber-300 px-2 py-0.5 rounded ring-1 ring-zinc-800 hover:ring-amber-400/40"
        >
          ⇅ flip · {orientation === 'white' ? 'white' : 'black'} at bottom
        </button>
      </div>
      <div className="rounded-xl p-1 panel">
        <div ref={boardRef} className="w-[440px] h-[440px]" />
      </div>
    </div>
  );
}

// ─── Chapter editor ──────────────────────────────────────────────────────────

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
          Select a position from the tree (or play a move on the board) to attach a
          chapter — title plus markdown notes.
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
        rows={10}
        className="bg-zinc-950/60 border border-zinc-800 rounded px-2 py-1.5 font-mono text-sm"
        placeholder="markdown body…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex justify-end">
        <button
          disabled={busy}
          onClick={() => onSave(title || null, body)}
          className="bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm px-3 py-1 rounded font-medium disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </aside>
  );
}
