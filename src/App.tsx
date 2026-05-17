import { useCallback } from 'react';
import { ChessBoard } from './components/board/ChessBoard';
import { MoveList } from './components/board/MoveList';
import { ExplorerTable } from './components/explorer/ExplorerTable';
import { OpeningHeader } from './components/explorer/OpeningHeader';
import { OpeningTree } from './components/tree/OpeningTree';
import { ViewSettings } from './components/ui/ViewSettings';
import { SearchBar } from './components/ui/SearchBar';
import { Icon } from './components/ui/Icon';
import { useTree } from './hooks/useTree';
import { useFenUrlSync } from './hooks/useFenUrlSync';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { useGameStore } from './store/gameStore';

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
  const { root, activePath, expand, error } = useTree();
  const setFen = useGameStore((s) => s.setFen);

  const onNodeClick = useCallback(
    (id: string, shift: boolean) => {
      if (shift) setFen(id);
      else expand(id);
    },
    [expand, setFen],
  );

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-3 flex items-center gap-6 border-b border-zinc-800/70 bg-zinc-950/70 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 grid place-items-center text-zinc-950 shadow-lg shadow-amber-500/20">
            <Icon name="tree" className="w-4 h-4" />
          </div>
          <h1 className="text-base font-semibold tracking-tight whitespace-nowrap">
            Opening<span className="text-amber-400">Tree</span>
          </h1>
        </div>
        <SearchBar />
        <OpeningHeader />
        <div className="ml-auto flex items-center gap-6">
          <ViewSettings />
        </div>
      </header>

      <main className="flex-1 grid grid-cols-[auto_1fr] gap-5 p-5 overflow-hidden">
        <section className="flex flex-col gap-4">
          <div className="rounded-xl p-1 panel">
            <ChessBoard />
          </div>
          <div className="panel p-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5">
              <Icon name="rewind" className="w-3 h-3" />
              moves
            </div>
            <MoveList />
          </div>
          <div className="panel p-3 max-h-[44vh] overflow-auto scroll-thin">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5">
              <Icon name="search" className="w-3 h-3" />
              next moves
            </div>
            <ExplorerTable />
          </div>
        </section>

        <section className="panel relative overflow-hidden min-h-[400px]">
          {error && (
            <div className="absolute top-3 right-3 text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 ring-1 ring-red-500/30 backdrop-blur z-10">
              {error}
            </div>
          )}
          {root ? (
            <OpeningTree data={root} activePath={activePath} onNodeClick={onNodeClick} />
          ) : (
            <div className="grid place-items-center h-full text-zinc-500">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 rounded-full border-2 border-zinc-700 border-t-amber-400 animate-spin" />
                <span className="text-sm">Loading tree…</span>
              </div>
            </div>
          )}

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-4 pointer-events-none">
            <div className="flex items-center gap-3 text-[11px] text-zinc-400 bg-zinc-950/60 backdrop-blur rounded-lg px-2.5 py-1.5 ring-1 ring-zinc-800/80">
              <span className="flex items-center gap-1.5">
                <Kbd>click</Kbd> expand
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>⇧ click</Kbd> jump
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>drag</Kbd> pan
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>wheel</Kbd> zoom
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-zinc-500 bg-zinc-950/60 backdrop-blur rounded-lg px-2.5 py-1.5 ring-1 ring-zinc-800/80">
              <span className="flex items-center gap-1.5">
                <Kbd>←</Kbd> back
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>Home</Kbd> reset
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
