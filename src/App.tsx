import { ChessBoard } from './components/board/ChessBoard';
import { MoveList } from './components/board/MoveList';
import { MoveSelection } from './components/explorer/MoveSelection';
import { OpeningHeader } from './components/explorer/OpeningHeader';
import { PlayerFilter } from './components/ui/PlayerFilter';
import { Icon } from './components/ui/Icon';
import { useFenUrlSync } from './hooks/useFenUrlSync';
import { useKeyboardNav } from './hooks/useKeyboardNav';

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-300">
      {children}
    </kbd>
  );
}

export default function App() {
  useFenUrlSync();
  useKeyboardNav();

  return (
    <div className="h-full flex flex-col">
      <header className="relative z-40 px-6 py-3 flex items-center gap-5 border-b border-zinc-800/70 bg-zinc-950/70 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 grid place-items-center text-zinc-950 shadow-lg shadow-amber-500/20">
            <Icon name="tree" className="w-4 h-4" />
          </div>
          <h1 className="text-base font-semibold tracking-tight whitespace-nowrap">
            Opening<span className="text-amber-400">Tree</span>
          </h1>
        </div>
        <PlayerFilter />
        <OpeningHeader />
        <div className="ml-auto flex items-center gap-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
            step
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Home</Kbd> reset
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>End</Kbd> last
          </span>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-[auto_240px_1fr] gap-5 p-5 overflow-hidden">
        <section className="flex flex-col">
          <div className="rounded-xl p-1 panel">
            <ChessBoard />
          </div>
        </section>

        <section className="panel p-3 flex flex-col min-h-0">
          <MoveList />
        </section>

        <section className="panel overflow-hidden min-h-[400px]">
          <MoveSelection />
        </section>
      </main>
    </div>
  );
}
