import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Chessground } from 'chessground';
import type { Api as CGApi } from 'chessground/api';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import {
  student,
  type OpeningStudyForStudent,
  type QuizCard,
} from '../lib/api';
import { buildTree, pathToNode } from '../lib/opening-tree';
import { Markdown } from '../lib/markdown';
import { TreeGraph } from '../components/opening/TreeGraph';
import { ChaptersOutline } from '../components/opening/ChaptersOutline';
import { useOpeningTreeNav } from '../hooks/useOpeningTreeNav';

type Mode = 'tree' | 'chapters' | 'quiz';

export function OpeningStudyViewer() {
  const { id } = useParams();
  const numId = Number(id);
  const [study, setStudy] = useState<OpeningStudyForStudent | null>(null);
  const [mode, setMode] = useState<Mode>('tree');

  useEffect(() => {
    student.opening(numId).then(setStudy);
  }, [numId]);

  if (!study) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{study.name}</h1>
        <span className="text-xs text-zinc-500">
          plays {study.side === 'w' ? 'white' : 'black'} · {study.nodes.length} positions ·{' '}
          {study.chapters.length} chapters
        </span>
        <div className="ml-auto inline-flex bg-zinc-900/60 ring-1 ring-zinc-800 rounded-lg overflow-hidden text-xs">
          {(['tree', 'chapters', 'quiz'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 capitalize ${
                mode === m
                  ? 'bg-amber-400/15 text-amber-200'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === 'tree' && <TreeMode study={study} />}
      {mode === 'chapters' && <ChaptersMode study={study} />}
      {mode === 'quiz' && (
        <QuizMode study={study} onAdvance={() => student.opening(numId).then(setStudy)} />
      )}
    </div>
  );
}

// ─── Tree mode (board + visual graph + chapter pane) ─────────────────────────

function TreeMode({ study }: { study: OpeningStudyForStudent }) {
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>(
    study.side === 'b' ? 'black' : 'white',
  );
  const boardRef = useRef<HTMLDivElement | null>(null);
  const cgRef = useRef<CGApi | null>(null);

  useOpeningTreeNav(study.nodes, currentNodeId, setCurrentNodeId);

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
      orientation,
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
      orientation,
      lastMove: currentNode
        ? ([currentNode.uci.slice(0, 2), currentNode.uci.slice(2, 4)] as [Key, Key])
        : undefined,
    });
  }, [currentFen, currentNode, orientation]);

  const tree = buildTree(study.nodes);
  const path = pathToNode(study.nodes, currentNodeId);
  const chaptersSet = new Set(study.chapters.map((c) => c.node_id));

  return (
    <>
      <div className="grid grid-cols-[auto_1fr] gap-4">
        <div className="flex flex-col gap-3">
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
          <div className="panel p-3 text-xs text-zinc-400 font-mono leading-6 max-w-[440px]">
            {path.length === 0 ? (
              <button
                onClick={() => setCurrentNodeId(null)}
                className="text-zinc-600 hover:text-amber-300"
              >
                ★ at start position
              </button>
            ) : (
              <>
                <button
                  onClick={() => setCurrentNodeId(null)}
                  className="px-1 rounded text-zinc-500 hover:bg-amber-400/10"
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

        <aside className="panel p-3 overflow-auto">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
            {currentChapter ? currentChapter.title ?? "Trainer's note" : 'No chapter here'}
          </div>
          {currentChapter ? (
            <Markdown>{currentChapter.body_md}</Markdown>
          ) : (
            <p className="text-zinc-500 text-sm">
              Click a node in the tree below — chapters appear on annotated positions.
            </p>
          )}
        </aside>
      </div>

      <section className="panel p-3">
        <div className="flex items-center mb-2">
          <h2 className="text-xs uppercase tracking-wider text-zinc-500">Opening tree</h2>
          <div className="ml-auto flex items-center gap-3 text-[10px] text-zinc-500">
            <span><span className="text-amber-400">★</span> main line</span>
            <span><span className="text-emerald-400">●</span> has chapter</span>
          </div>
        </div>
        <TreeGraph
          tree={tree}
          currentNodeId={currentNodeId}
          chaptersSet={chaptersSet}
          onSelect={setCurrentNodeId}
        />
      </section>
    </>
  );
}

// ─── Chapters mode (outline + body) ──────────────────────────────────────────

function ChaptersMode({ study }: { study: OpeningStudyForStudent }) {
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(
    study.chapters[0]?.node_id ?? null,
  );
  const currentChapter = useMemo(
    () => study.chapters.find((c) => c.node_id === currentNodeId) ?? null,
    [study, currentNodeId],
  );

  return (
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
      <aside className="panel p-4 overflow-auto">
        {currentChapter ? (
          <>
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
              {currentChapter.title ?? "Trainer's note"}
            </div>
            <Markdown>{currentChapter.body_md}</Markdown>
          </>
        ) : (
          <p className="text-sm text-zinc-500">
            No chapters in this study yet.
          </p>
        )}
      </aside>
    </div>
  );
}

// ─── Quiz mode (unchanged Chessable-style drilling) ──────────────────────────

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
  const [orientation, setOrientation] = useState<'white' | 'black'>(
    study.side === 'b' ? 'black' : 'white',
  );
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

  useEffect(() => {
    if (!card || !boardRef.current) return;
    const fen = `${card.parent_fen} 0 1`;
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
      orientation,
      movable: {
        free: false,
        color: turnColor,
        dests,
        events: {
          after: async (from, to) => {
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

  useEffect(() => {
    cgRef.current?.set({ orientation });
  }, [orientation]);

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
