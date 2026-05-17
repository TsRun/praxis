import { useCallback } from 'react';
import { ChessBoard } from './components/board/ChessBoard';
import { MoveList } from './components/board/MoveList';
import { ExplorerTable } from './components/explorer/ExplorerTable';
import { OpeningTree } from './components/tree/OpeningTree';
import { ViewSettings } from './components/ui/ViewSettings';
import { useTree } from './hooks/useTree';
import { useGameStore } from './store/gameStore';

export default function App() {
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
      <header className="px-6 py-3 border-b bg-white flex items-center gap-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">
          <span className="text-amber-700">Opening</span>
          <span>Tree</span>
        </h1>
        <span className="text-xs text-neutral-400">chess opening explorer</span>
        <div className="ml-auto">
          <ViewSettings />
        </div>
      </header>
      <main className="flex-1 grid grid-cols-[auto_1fr] gap-6 p-6 overflow-hidden">
        <section className="flex flex-col gap-4">
          <ChessBoard />
          <div className="w-[480px] border rounded p-3 bg-white">
            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
              Moves
            </div>
            <MoveList />
          </div>
          <div className="w-[480px] max-h-[40vh] overflow-auto border rounded p-3 bg-white">
            <ExplorerTable />
          </div>
        </section>
        <section className="rounded border bg-white relative overflow-hidden min-h-[400px]">
          {error && (
            <div className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-red-100 text-red-700 z-10">
              {error}
            </div>
          )}
          {root ? (
            <OpeningTree data={root} activePath={activePath} onNodeClick={onNodeClick} />
          ) : (
            <div className="grid place-items-center h-full text-neutral-400">
              Loading tree…
            </div>
          )}
          <div className="absolute bottom-2 left-2 text-xs text-neutral-500 bg-white/80 backdrop-blur-sm rounded px-2 py-1 pointer-events-none">
            click → expand · shift-click → jump · drag → pan · wheel → zoom
          </div>
        </section>
      </main>
    </div>
  );
}
