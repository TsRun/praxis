import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/board/ChessBoard';
import { MoveList } from '../components/board/MoveList';
import { useGameStore } from '../store/gameStore';
import { student, type GameStudyForStudent } from '../lib/api';
import { Markdown } from '../lib/markdown';

type QuizState =
  | { ply: number; phase: 'asking' }
  | { ply: number; phase: 'revealed'; correct: boolean; expected: string; comment: string | null }
  | null;

export function GameStudyViewer() {
  const { id } = useParams();
  const numId = Number(id);
  const [study, setStudy] = useState<GameStudyForStudent | null>(null);
  const [showComments, setShowComments] = useState(true);
  const [quizState, setQuizState] = useState<QuizState>(null);

  const currentPly = useGameStore((s) => s.currentPly);
  const goToPly = useGameStore((s) => s.goToPly);
  const loadLine = useGameStore((s) => s.loadLine);

  useEffect(() => {
    student.game(numId).then((s) => {
      setStudy(s);
      const c = new Chess();
      try {
        c.loadPgn(s.pgn);
      } catch {
        /* ignore */
      }
      loadLine(c.history(), 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numId]);

  useEffect(() => {
    if (!study) return;
    const a = study.annotations.find((x) => x.ply === currentPly);
    const already = study.attempts.find((x) => x.ply === currentPly);
    if (a?.is_quiz && !already) {
      goToPly(currentPly - 1);
      setQuizState({ ply: currentPly, phase: 'asking' });
    }
  }, [currentPly, study, goToPly]);

  async function submitGuess(attemptedSan: string) {
    if (!study || !quizState || quizState.phase !== 'asking') return;
    const res = await student.attempt(study.id, quizState.ply, attemptedSan);
    setQuizState({
      ply: quizState.ply,
      phase: 'revealed',
      correct: res.correct,
      expected: res.expected_san ?? '?',
      comment: res.comment_md,
    });
    setStudy((prev) =>
      prev
        ? {
            ...prev,
            attempts: [
              ...prev.attempts.filter((a) => a.ply !== quizState.ply),
              { ply: quizState.ply, attempted_san: attemptedSan, correct: res.correct },
            ],
          }
        : prev,
    );
  }

  if (!study) return <p className="text-zinc-500">Loading…</p>;
  const noteByPly = new Map(study.annotations.map((a) => [a.ply, a] as const));

  return (
    <div className="grid grid-cols-[auto_1fr_360px] gap-5">
      <div className="rounded-xl p-1 panel relative">
        <ChessBoard />
        {quizState?.phase === 'asking' && <QuizPrompt onGuess={submitGuess} />}
      </div>
      <div className="panel p-3 flex flex-col gap-2 overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{study.name}</h2>
          <label className="text-xs text-zinc-500 flex items-center gap-2">
            <input
              type="checkbox"
              checked={showComments}
              onChange={(e) => setShowComments(e.target.checked)}
            />
            comments
          </label>
        </div>
        <div className="text-xs text-zinc-500">
          {study.headers_json.White} vs {study.headers_json.Black}
        </div>
        <MoveList />
        {showComments && noteByPly.get(currentPly)?.comment_md && (
          <div className="mt-2 panel p-3">
            <Markdown>{noteByPly.get(currentPly)!.comment_md!}</Markdown>
          </div>
        )}
      </div>
      <aside className="panel p-3 flex flex-col gap-3 overflow-auto">
        <div className="text-xs uppercase tracking-wider text-zinc-500">Progress</div>
        <div className="text-sm">
          {study.attempts.filter((a) => a.correct).length} /{' '}
          {study.annotations.filter((a) => a.is_quiz).length} quizzes correct
        </div>
        {quizState?.phase === 'revealed' && (
          <div
            className={`panel p-3 ${
              quizState.correct ? 'border-emerald-500/50' : 'border-red-500/50'
            }`}
          >
            <p className={quizState.correct ? 'text-emerald-400' : 'text-red-400'}>
              {quizState.correct ? '✓ Correct' : `✗ Played: ${quizState.expected}`}
            </p>
            {quizState.comment && <Markdown>{quizState.comment}</Markdown>}
            <button
              onClick={() => {
                goToPly(quizState.ply);
                setQuizState(null);
              }}
              className="mt-2 text-xs text-amber-400"
            >
              Continue →
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function QuizPrompt({ onGuess }: { onGuess: (san: string) => void }) {
  const [guess, setGuess] = useState('');
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-sm">
      <div className="panel p-4 flex flex-col gap-2 w-72">
        <strong>What would you play?</strong>
        <input
          className="border border-zinc-700 bg-zinc-900 rounded px-2 py-1.5 font-mono"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder="enter SAN (e.g. Nf3)"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && guess.trim()) onGuess(guess.trim());
          }}
        />
        <button
          disabled={!guess.trim()}
          onClick={() => onGuess(guess.trim())}
          className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium disabled:opacity-50"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
