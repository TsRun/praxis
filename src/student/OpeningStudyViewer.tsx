import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Chessground } from 'chessground';
import type { Api as CGApi } from 'chessground/api';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import {
  student,
  type OpeningStudyForStudent,
  type OpeningNode,
  type QuizCard,
} from '../lib/api';
import { buildTree, pathToNode, type TreeNode } from '../lib/opening-tree';
import { Markdown } from '../lib/markdown';

type Mode = 'browse' | 'quiz';

export function OpeningStudyViewer() {
  const { id } = useParams();
  const numId = Number(id);
  const [study, setStudy] = useState<OpeningStudyForStudent | null>(null);
  const [mode, setMode] = useState<Mode>('browse');

  useEffect(() => {
    student.opening(numId).then(setStudy);
  }, [numId]);

  if (!study) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{study.name}</h1>
        <span className="text-xs text-zinc-500">
          plays {study.side === 'w' ? 'white' : 'black'} · {study.nodes.length} positions
        </span>
        <div className="ml-auto inline-flex bg-zinc-900/60 ring-1 ring-zinc-800 rounded-lg overflow-hidden text-xs">
          <button
            onClick={() => setMode('browse')}
            className={`px-3 py-1 ${
              mode === 'browse'
                ? 'bg-amber-400/15 text-amber-200'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            Browse
          </button>
          <button
            onClick={() => setMode('quiz')}
            className={`px-3 py-1 ${
              mode === 'quiz'
                ? 'bg-amber-400/15 text-amber-200'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            Quiz
          </button>
        </div>
      </div>

      {mode === 'browse' ? (
        <BrowseMode study={study} />
      ) : (
        <QuizMode study={study} onAdvance={() => student.opening(numId).then(setStudy)} />
      )}
    </div>
  );
}

// ─── Browse mode ─────────────────────────────────────────────────────────────

function BrowseMode({ study }: { study: OpeningStudyForStudent }) {
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const cgRef = useRef<CGApi | null>(null);

  const currentFen = useMemo(() => {
    if (currentNodeId == null) return study.root_fen;
    return study.nodes.find((n) => n.id === currentNodeId)?.fen ?? study.root_fen;
  }, [study, currentNodeId]);

  const currentNode = useMemo(
    () => study.nodes.find((n) => n.id === currentNodeId) ?? null,
    [study, currentNodeId],
  );
  const currentChapter = useMemo(
    () => study.chapters.find((c) => c.node_id === currentNodeId) ?? null,
    [study, currentNodeId],
  );

  useEffect(() => {
    if (!boardRef.current) return;
    cgRef.current = Chessground(boardRef.current, {
      fen: currentFen,
      viewOnly: true,
      coordinates: true,
      lastMove: currentNode
        ? ([currentNode.uci.slice(0, 2), currentNode.uci.slice(2, 4)] as [Key, Key])
        : undefined,
    });
    return () => {
      cgRef.current?.destroy();
      cgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [study.id]);

  useEffect(() => {
    if (!cgRef.current) return;
    cgRef.current.set({
      fen: currentFen,
      lastMove: currentNode
        ? ([currentNode.uci.slice(0, 2), currentNode.uci.slice(2, 4)] as [Key, Key])
        : undefined,
    });
  }, [currentFen, currentNode]);

  const tree = buildTree(study.nodes);
  const path = pathToNode(study.nodes, currentNodeId);

  return (
    <div className="grid grid-cols-[260px_auto_1fr] gap-4">
      <aside className="panel p-3 max-h-[80vh] overflow-auto flex flex-col gap-2">
        <button
          onClick={() => setCurrentNodeId(null)}
          className={`text-left text-xs px-2 py-1 rounded ${
            currentNodeId == null
              ? 'bg-amber-400/15 text-amber-200'
              : 'text-zinc-400 hover:bg-zinc-800/60'
          }`}
        >
          ★ Root
        </button>
        <NavTree
          tree={tree}
          currentNodeId={currentNodeId}
          chaptersSet={new Set(study.chapters.map((c) => c.node_id))}
          onSelect={setCurrentNodeId}
        />
      </aside>

      <div className="flex flex-col gap-3">
        <div className="rounded-xl p-1 panel">
          <div ref={boardRef} className="w-[440px] h-[440px]" />
        </div>
        <div className="panel p-3 text-xs text-zinc-400 font-mono leading-6 max-w-[440px]">
          {path.length === 0 ? (
            <span className="text-zinc-600">at start position</span>
          ) : (
            path.map((n) => (
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

      <aside className="panel p-3 overflow-auto">
        <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
          {currentChapter ? currentChapter.title ?? "Trainer's note" : 'No chapter here'}
        </div>
        {currentChapter ? (
          <Markdown>{currentChapter.body_md}</Markdown>
        ) : (
          <p className="text-zinc-500 text-sm">
            Keep navigating — chapters appear on annotated positions.
          </p>
        )}
      </aside>
    </div>
  );
}

function NavTree({
  tree,
  currentNodeId,
  chaptersSet,
  onSelect,
}: {
  tree: TreeNode[];
  currentNodeId: number | null;
  chaptersSet: Set<number>;
  onSelect: (id: number) => void;
}) {
  function render(nodes: TreeNode[], depth: number): JSX.Element[] {
    return nodes.flatMap((n) => [
      <div
        key={n.id}
        style={{ paddingLeft: depth * 12 }}
        className="flex items-center"
      >
        <button
          onClick={() => onSelect(n.id)}
          className={`text-left text-xs px-1.5 py-0.5 rounded font-mono flex-1 ${
            n.id === currentNodeId
              ? 'bg-amber-400/15 text-amber-200'
              : 'text-zinc-300 hover:bg-amber-400/10'
          }`}
        >
          {n.ply % 2 === 1 ? `${Math.ceil(n.ply / 2)}.` : ''}
          {n.san}
          {n.is_main && <span className="ml-1 text-amber-400">★</span>}
          {chaptersSet.has(n.id) && <span className="ml-1 text-emerald-400">●</span>}
        </button>
      </div>,
      ...render(n.children, depth + 1),
    ]);
  }
  return <div className="flex flex-col gap-0.5">{render(tree, 0)}</div>;
}

// ─── Quiz mode ───────────────────────────────────────────────────────────────

function QuizMode({
  study,
  onAdvance,
}: {
  study: OpeningStudyForStudent;
  onAdvance: () => void;
}) {
  const [card, setCard] = useState<QuizCard | null | undefined>(undefined);
  const [revealed, setRevealed] = useState<
    | { correct: boolean; expected: string; chapter: { title: string | null; body_md: string } | null }
    | null
  >(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const cgRef = useRef<CGApi | null>(null);

  async function loadNext() {
    setRevealed(null);
    const res = await student.nextQuiz(study.id);
    setCard(res.card);
  }

  useEffect(() => {
    loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [study.id]);

  // Set up board for current card
  useEffect(() => {
    if (!card || !boardRef.current) return;
    const fen = `${card.parent_fen} 0 1`; // EPD → completed FEN
    const c = new Chess(card.parent_fen.split(' ').slice(0, 4).join(' ') + ' 0 1');
    const turnColor = c.turn() === 'w' ? 'white' : 'black';
    const dests = new Map<Key, Key[]>();
    for (const m of c.moves({ verbose: true })) {
      const from = m.from as Key;
      if (!dests.has(from)) dests.set(from, []);
      dests.get(from)!.push(m.to as Key);
    }
    cgRef.current = Chessground(boardRef.current, {
      fen,
      turnColor,
      movable: {
        free: false,
        color: turnColor,
        dests,
        events: {
          after: async (from, to) => {
            // Convert from/to to SAN
            const cc = new Chess(card.parent_fen.split(' ').slice(0, 4).join(' ') + ' 0 1');
            let m;
            try {
              m = cc.move({ from, to, promotion: 'q' });
            } catch {
              m = null;
            }
            if (!m) return;
            const res = await student.quizAttempt(study.id, card.node_id, m.san);
            setRevealed({
              correct: res.correct,
              expected: res.expected_san,
              chapter: res.chapter,
            });
            onAdvance();
          },
        },
      },
      draggable: { showGhost: true },
      animation: { duration: 150 },
    });
    return () => {
      cgRef.current?.destroy();
      cgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.node_id]);

  if (card === undefined) return <p className="text-zinc-500">Loading…</p>;
  if (card === null) {
    return (
      <div className="panel p-6 text-center text-zinc-300">
        <p className="text-lg">✓ All caught up.</p>
        <p className="text-sm text-zinc-500 mt-1">
          No cards are due right now. Come back later to keep your repertoire fresh.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[auto_1fr] gap-5">
      <div className="flex flex-col gap-3">
        <div className="rounded-xl p-1 panel">
          <div ref={boardRef} className="w-[440px] h-[440px]" />
        </div>
        <div className="panel p-3 text-xs text-zinc-400 font-mono leading-6 max-w-[440px]">
          {card.opponent_line.length === 0 ? (
            <span className="text-zinc-600">root position — your move</span>
          ) : (
            card.opponent_line.map((san, i) => (
              <span key={i} className="px-1">
                {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ''}
                {san}
              </span>
            ))
          )}
        </div>
      </div>
      <aside className="panel p-4 flex flex-col gap-3">
        {!revealed ? (
          <>
            <div className="text-xs uppercase tracking-wider text-zinc-500">Your move</div>
            <p className="text-sm text-zinc-300">
              Drag a piece on the board to play your prepared move.
            </p>
            <p className="text-xs text-zinc-500">
              ply {card.ply} · {study.side === 'w' ? 'white' : 'black'} to move
            </p>
          </>
        ) : (
          <>
            <div
              className={`text-base font-medium ${
                revealed.correct ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {revealed.correct ? '✓ Correct' : `✗ Played: ${revealed.expected}`}
            </div>
            {revealed.chapter && (
              <div className="panel p-3">
                {revealed.chapter.title && (
                  <div className="text-sm font-medium text-zinc-100 mb-1">
                    {revealed.chapter.title}
                  </div>
                )}
                <Markdown>{revealed.chapter.body_md}</Markdown>
              </div>
            )}
            <button
              onClick={loadNext}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium"
            >
              Next →
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
