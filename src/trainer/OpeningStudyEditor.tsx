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
import { pathToNode, findChildBySan } from '../lib/opening-tree';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useOpeningTreeNav } from '../hooks/useOpeningTreeNav';
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

function plyLabel(ply: number) {
  return ply % 2 === 1 ? `${Math.ceil(ply / 2)}.` : `${Math.ceil(ply / 2)}…`;
}

function lineSan(study: OpeningStudyFull, nodeId: number): string {
  return pathToNode(study.nodes, nodeId)
    .map((n) => (n.ply % 2 === 1 ? `${Math.ceil(n.ply / 2)}.${n.san}` : n.san))
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

export function OpeningStudyEditor() {
  const { id } = useParams();
  const numId = Number(id);
  const [study, setStudy] = useState<OpeningStudyFull | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDeleteNode, setConfirmDeleteNode] =
    useState<OpeningNode | null>(null);
  const [mode, setMode] = useState<ViewMode>('tree');
  const [showImport, setShowImport] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [flip, setFlip] = useState(false);

  useEffect(() => {
    trainerStudies.get(numId).then((s) => {
      setStudy(s);
      setCurrentNodeId(null);
      setFlip(s.side === 'b');
    });
  }, [numId]);

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
    mode === 'tree' && !!study,
  );

  if (!study)
    return (
      <div style={{ padding: 28, color: 'var(--text-faint)' }}>Loading…</div>
    );

  const path = pathToNode(study.nodes, currentNodeId);
  const chaptersSet = new Set(study.chapters.map((c) => c.node_id));

  async function onAddChild(
    parentNode: OpeningNode | null,
    parentFen: string,
    mv: { from: Key; to: Key; san: string; promotion?: string },
  ) {
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

  async function saveTitle(value: string) {
    const s = study;
    if (!s || !currentNode) return;
    setBusy(true);
    try {
      await trainerStudies.saveChapter(
        s.id,
        currentNode.id,
        value || null,
        currentChapter?.body_md ?? '',
      );
      const refreshed = await trainerStudies.get(s.id);
      setStudy(refreshed);
    } finally {
      setBusy(false);
    }
  }

  async function toggleMain(n: OpeningNode) {
    const s = study;
    if (!s) return;
    await trainerStudies.setIsMain(s.id, n.id, !n.is_main);
    const refreshed = await trainerStudies.get(s.id);
    setStudy(refreshed);
  }

  return (
    <div
      style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: '24px 28px 80px',
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
        }}
      >
        <div>
          <h1 className="t-h1" style={{ margin: 0 }}>{study.name}</h1>
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
        </div>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
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
            Import
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
                <span className="ply-num">{plyLabel(n.ply)}</span>
                {n.san}
              </button>
            </span>
          ))}
        </div>
        <div
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

      {mode === 'tree' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '520px 1fr',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {/* LEFT: board */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              position: 'sticky',
              top: 72,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="overline">
                {currentNode
                  ? `After ${plyLabel(currentNode.ply)} ${currentNode.san}`
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
              <Card
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  borderLeft: currentChapter
                    ? '3px solid var(--success)'
                    : '3px solid transparent',
                }}
              >
                <span
                  className={currentChapter ? 'dot-chapter' : ''}
                  style={{ marginTop: 8 }}
                />
                <input
                  key={currentNode.id}
                  className="font-mono"
                  placeholder="untitled chapter"
                  defaultValue={currentChapter?.title ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (currentChapter?.title ?? '')) {
                      saveTitle(v);
                    }
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
              </Card>
            )}
          </div>

          {/* RIGHT: candidates + line so far */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              minWidth: 0,
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
    const existing = findChildBySan(
      study.nodes,
      currentNode?.id ?? null,
      mv.san,
    );
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

  return <div ref={boardRef} style={{ width: 520, height: 520 }} />;
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
  const titleByNode = new Map(
    study.chapters.map((c) => [c.node_id, c.title] as const),
  );

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
            const chap = titleByNode.get(c.id) ?? null;
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
                  <div
                    style={{
                      fontSize: 13.5,
                      color: 'var(--text)',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {chap ?? 'No chapter on this move'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    {sub} {sub === 1 ? 'reply' : 'replies'} below
                    {chaptersSet.has(c.id) ? ' · chapter set' : ''}
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
                  {plyLabel(n.ply)}
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
    const titleByNode = new Map(
      study.chapters.map((c) => [c.node_id, c.title] as const),
    );
    return study.nodes
      .filter((n) => titleByNode.has(n.id))
      .map((n) => ({ node: n, title: titleByNode.get(n.id) ?? '' }))
      .sort((a, b) => a.node.ply - b.node.ply || a.node.id - b.node.id);
  }, [study]);

  const selectedChap =
    currentNodeId != null
      ? chapters.find((c) => c.node.id === currentNodeId)
      : chapters[0];
  const selectedNode = selectedChap?.node ?? null;
  const fen = selectedNode?.fen ?? study.root_fen;
  const lastMove = selectedNode?.uci ?? null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 520px',
        gap: 24,
        alignItems: 'start',
      }}
    >
      <Card style={{ padding: 0 }}>
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid var(--hairline)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 className="t-h2" style={{ margin: 0 }}>Chapters</h2>
            <div className="meta">{chapters.length} chapters</div>
          </div>
        </div>
        <div style={{ padding: 10 }}>
          {chapters.length === 0 ? (
            <div className="meta" style={{ padding: 18, textAlign: 'center' }}>
              No chapters yet. In Tree mode, set a chapter title under the
              board to add one here.
            </div>
          ) : (
            chapters.map(({ node, title }, i) => {
              const active = node.id === selectedNode?.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setCurrentNodeId(node.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr auto',
                    alignItems: 'center',
                    gap: 14,
                    padding: '10px 14px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    border: 0,
                    textAlign: 'left',
                    color: 'inherit',
                    width: '100%',
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      color: 'var(--text-faint)',
                      fontSize: 12,
                      textAlign: 'right',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <div style={{ fontSize: 14.5, color: 'var(--text)', fontWeight: 500 }}>
                      {title || '(untitled)'}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 12,
                        color: 'var(--text-faint)',
                        marginTop: 2,
                      }}
                    >
                      {lineSan(study, node.id)}
                    </div>
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: active ? 'var(--text-dim)' : 'var(--text-faint)',
                      background: active
                        ? 'rgba(255,255,255,0.05)'
                        : 'var(--inset-bg)',
                      border: '1px solid var(--inset-border)',
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    ply {node.ply}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </Card>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          position: 'sticky',
          top: 72,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="overline" style={{ flex: 1 }}>
            {selectedNode
              ? `${plyLabel(selectedNode.ply)} ${selectedNode.san}`
              : 'Start position'}
          </span>
          <Btn variant="ghost" size="sm" onClick={() => setFlip(!flip)}>
            <IconFlip size={12} strokeWidth={2.4} /> Flip
          </Btn>
        </div>
        <ReadOnlyBoard fen={fen} lastMove={lastMove} flip={flip} />
        {selectedNode && (
          <Card
            style={{
              padding: '14px 16px',
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start',
              borderLeft: '3px solid var(--success)',
            }}
          >
            <span className="dot-chapter" style={{ marginTop: 8 }} />
            <input
              key={selectedNode.id}
              defaultValue={selectedChap?.title ?? ''}
              onBlur={(e) => {
                setCurrentNodeId(selectedNode.id);
                saveTitle(e.target.value.trim());
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                  (e.target as HTMLInputElement).blur();
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
              }}
            />
            <Btn variant="secondary" size="sm" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Btn>
          </Card>
        )}
      </div>
    </div>
  );
}

function ReadOnlyBoard({
  fen,
  lastMove,
  flip,
}: {
  fen: string;
  lastMove: string | null;
  flip: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cgRef = useRef<CGApi | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    cgRef.current = Chessground(ref.current, {
      fen,
      orientation: flip ? 'black' : 'white',
      viewOnly: true,
      coordinates: true,
      lastMove:
        lastMove && lastMove.length >= 4
          ? ([lastMove.slice(0, 2), lastMove.slice(2, 4)] as [Key, Key])
          : undefined,
    });
    return () => {
      cgRef.current?.destroy();
      cgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cgRef.current) return;
    cgRef.current.set({
      fen,
      orientation: flip ? 'black' : 'white',
      lastMove:
        lastMove && lastMove.length >= 4
          ? ([lastMove.slice(0, 2), lastMove.slice(2, 4)] as [Key, Key])
          : undefined,
    });
  }, [fen, lastMove, flip]);

  return <div ref={ref} style={{ width: 520, height: 520 }} />;
}

/* unused exports kept for direct prop typing */
export type { OpeningStudyFull };

void IconArrowL;
void IconArrowR;
