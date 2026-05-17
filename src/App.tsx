import { ChessBoard } from './components/board/ChessBoard';
import { MoveList } from './components/board/MoveList';
import { ExplorerTable } from './components/explorer/ExplorerTable';

export default function App() {
  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-3 border-b bg-white flex items-center gap-4 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">
          <span className="text-amber-700">Opening</span>
          <span>Tree</span>
        </h1>
        <span className="text-xs text-neutral-400">chess opening explorer</span>
      </header>
      <main className="flex-1 grid grid-cols-[auto_1fr] gap-6 p-6 overflow-hidden">
        <section className="flex flex-col gap-4">
          <ChessBoard />
          <div className="w-[480px] border rounded p-3 bg-white">
            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Moves</div>
            <MoveList />
          </div>
          <div className="w-[480px] max-h-[40vh] overflow-auto border rounded p-3 bg-white">
            <ExplorerTable />
          </div>
        </section>
        <section className="rounded border bg-white grid place-items-center min-h-[400px]">
          <div className="text-neutral-400">Tree (Phase B)</div>
        </section>
      </main>
    </div>
  );
}
