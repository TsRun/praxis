import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  trainer,
  trainerStudies,
  trainerGames,
  trainerTactics,
  type OpeningStudySummary,
  type GameStudySummary,
  type TacticSetSummary,
} from '../lib/api';
import { NewOpeningStudyDialog } from './NewOpeningStudyDialog';
import { NewGameStudyDialog } from './NewGameStudyDialog';
import { NewTacticSetDialog } from './NewTacticSetDialog';
import { Card, Btn, Chip, Segmented } from '../components/ui/atoms';
import { FenBoard } from '../components/board/FenBoard';
import {
  IconBookOpen,
  IconUsers,
  IconList,
  IconBolt,
  IconPlus,
  IconDownload,
  IconChevDown,
  IconSearch,
  IconGrid,
  IconTree,
  IconGame,
} from '../components/ui/Icons';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

type Filter = 'all' | 'opening' | 'game' | 'tactic';
type View = 'grid' | 'list';

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function StudiesPage() {
  const [opens, setOpens] = useState<OpeningStudySummary[] | null>(null);
  const [games, setGames] = useState<GameStudySummary[] | null>(null);
  const [tactics, setTactics] = useState<TacticSetSummary[] | null>(null);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [openOpenDialog, setOpenOpenDialog] = useState(false);
  const [openGameDialog, setOpenGameDialog] = useState(false);
  const [openTacticDialog, setOpenTacticDialog] = useState(false);
  // When true, the next "Create study" lands directly in the Lichess import
  // dialog inside the editor (via ?import=lichess on the redirect URL).
  const [lichessIntent, setLichessIntent] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<View>('grid');
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [openErr, setOpenErr] = useState<string | null>(null);
  const [gameErr, setGameErr] = useState<string | null>(null);
  const [tacticErr, setTacticErr] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const nav = useNavigate();

  async function loadOpens() {
    setOpenErr(null);
    try {
      setOpens(await trainerStudies.list());
    } catch (e) {
      setOpens(null);
      setOpenErr((e as Error).message || 'Could not load opening studies');
    }
  }
  async function loadGames() {
    setGameErr(null);
    try {
      setGames(await trainerGames.list());
    } catch (e) {
      setGames(null);
      setGameErr((e as Error).message || 'Could not load game studies');
    }
  }
  async function loadTactics() {
    setTacticErr(null);
    try {
      setTactics(await trainerTactics.list());
    } catch (e) {
      setTactics(null);
      setTacticErr((e as Error).message || 'Could not load tactical sets');
    }
  }

  useEffect(() => {
    void loadOpens();
    void loadGames();
    void loadTactics();
    trainer.students()
      .then((rows) => setStudentCount(rows.length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const getItems = () =>
      Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          '#new-study-menu [role="menuitem"]',
        ),
      );
    // Move focus into the menu so keyboard users can navigate it.
    const firstItem = getItems()[0];
    firstItem?.focus();
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenuOpen(false);
        (document.getElementById('new-study-trigger') as HTMLButtonElement | null)?.focus();
        return;
      }
      const items = getItems();
      if (items.length === 0) return;
      const idx = items.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = idx < 0 ? 0 : (idx + 1) % items.length;
        items[next].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = idx < 0 ? items.length - 1 : (idx - 1 + items.length) % items.length;
        items[prev].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1].focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const filteredOpens = (opens ?? []).filter((s) =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    (s.eco ?? '').toLowerCase().includes(q.toLowerCase()),
  );
  const filteredGames = (games ?? []).filter((s) =>
    s.name.toLowerCase().includes(q.toLowerCase()),
  );
  const filteredTactics = (tactics ?? []).filter((s) =>
    s.name.toLowerCase().includes(q.toLowerCase()),
  );

  const totalChapters = (opens ?? []).reduce(
    (s, o) => s + o.annotation_count,
    0,
  ) + (games ?? []).reduce((s, g) => s + g.annotation_count, 0);

  const showOpenings = filter === 'all' || filter === 'opening';
  const showGames = filter === 'all' || filter === 'game';
  const showTactics = filter === 'all' || filter === 'tactic';

  return (
    <div className="page-wrap" style={{ paddingTop: 32, paddingBottom: 100 }}>
      {/* page head */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, paddingBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="t-h1">Studies</h1>
          <div className="meta" style={{ marginTop: 6 }}>
            Author opening repertoires and annotated games. Assign them to students by nickname.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn
            variant="secondary"
            onClick={() => {
              setLichessIntent(true);
              setOpenOpenDialog(true);
            }}
          >
            <IconDownload size={13} strokeWidth={2.4} />
            Import from Lichess
          </Btn>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <Btn
              id="new-study-trigger"
              variant="primary"
              onClick={() => setMenuOpen((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  setMenuOpen(true);
                }
              }}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls="new-study-menu"
            >
              <IconPlus size={13} strokeWidth={2.4} />
              New study
              <IconChevDown size={11} strokeWidth={2.4} style={{ marginLeft: 2 }} />
            </Btn>
            {menuOpen && (
              <div
                id="new-study-menu"
                role="menu"
                aria-labelledby="new-study-trigger"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: 'min(320px, calc(100vw - 32px))',
                  background: 'var(--card-bg)',
                  borderRadius: 12,
                  boxShadow:
                    'var(--card-shadow), 0 24px 60px -20px rgba(0,0,0,0.6)',
                  padding: 6,
                  zIndex: 30,
                }}
              >
                <NewStudyMenuItem
                  Icon={IconTree}
                  iconBg="var(--accent-soft)"
                  iconColor="var(--accent)"
                  title="Opening study"
                  sub="Branching repertoire with flat chapter list"
                  onClick={() => {
                    setMenuOpen(false);
                    setOpenOpenDialog(true);
                  }}
                />
                <NewStudyMenuItem
                  Icon={IconGame}
                  iconBg="rgba(96,165,250,0.12)"
                  iconColor="#60a5fa"
                  title="Game study"
                  sub="Annotate a PGN ply by ply"
                  onClick={() => {
                    setMenuOpen(false);
                    setOpenGameDialog(true);
                  }}
                />
                <NewStudyMenuItem
                  Icon={IconBolt}
                  iconBg="rgba(248,113,113,0.10)"
                  iconColor="#f87171"
                  title="Tactical set"
                  sub="Flat collection of puzzles to drill"
                  onClick={() => {
                    setMenuOpen(false);
                    setOpenTacticDialog(true);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
          marginBottom: 28,
        }}
      >
        <StatTile
          accent
          Icon={IconBookOpen}
          value={(opens?.length ?? 0) + (games?.length ?? 0)}
          label="studies authored"
        />
        <StatTile
          Icon={IconUsers}
          value={studentCount ?? '—'}
          label="students linked"
        />
        <StatTile Icon={IconList} value={totalChapters} label="chapters total" />
      </div>

      {/* filter bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          padding: '10px 14px',
          borderRadius: 12,
          background: 'var(--inset-bg)',
          border: '1px solid var(--inset-border)',
          marginBottom: 22,
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200, maxWidth: 360 }}>
          <IconSearch
            size={14}
            strokeWidth={2.4}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-faint)',
              pointerEvents: 'none',
            }}
          />
          <input
            className="input"
            placeholder="Find study by name or ECO…"
            aria-label="Search studies"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <Segmented<Filter>
          ariaLabel="Filter studies by type"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'opening', label: 'Opening' },
            { value: 'game', label: 'Game' },
            { value: 'tactic', label: 'Tactic' },
          ]}
        />
        <div style={{ flex: 1 }} />
        <Segmented<View>
          ariaLabel="View mode"
          value={view}
          onChange={setView}
          options={[
            { value: 'grid', label: <IconGrid size={13} strokeWidth={2.2} />, ariaLabel: 'Grid view' },
            { value: 'list', label: <IconList size={13} strokeWidth={2.2} />, ariaLabel: 'List view' },
          ]}
        />
      </div>

      {/* sections */}
      {showOpenings && (
        <Section
          title="Opening studies"
          count={filteredOpens.length}
          loading={opens == null && !openErr}
          error={openErr}
          onRetry={loadOpens}
        >
          {opens != null && (
            <div
              className={view === 'grid' ? 'grid-3' : ''}
              style={
                view === 'grid'
                  ? { gap: 16 }
                  : { display: 'grid', gridTemplateColumns: '1fr', gap: 16 }
              }
            >
              {filteredOpens.map((s) => (
                <OpeningStudyCard key={s.id} study={s} />
              ))}
              <EmptyAddCard
                title="New opening study"
                sub="Start from a position, paste a FEN, or import a Lichess study."
                onClick={() => setOpenOpenDialog(true)}
                accent="var(--accent)"
                accentBg="var(--accent-soft)"
              />
            </div>
          )}
        </Section>
      )}

      {showGames && (
        <Section
          title="Game studies"
          count={filteredGames.length}
          loading={games == null && !gameErr}
          error={gameErr}
          onRetry={loadGames}
        >
          {games != null && (
            <div
              className={view === 'grid' ? 'grid-3' : ''}
              style={
                view === 'grid'
                  ? { gap: 16 }
                  : { display: 'grid', gridTemplateColumns: '1fr', gap: 16 }
              }
            >
              {filteredGames.map((s) => (
                <GameStudyCard key={s.id} study={s} />
              ))}
              <EmptyAddCard
                title="New game study"
                sub="Paste a PGN to start annotating."
                onClick={() => setOpenGameDialog(true)}
                accent="#60a5fa"
                accentBg="rgba(96,165,250,0.12)"
              />
            </div>
          )}
        </Section>
      )}

      {showTactics && (
        <Section
          title="Tactical sets"
          count={filteredTactics.length}
          loading={tactics == null && !tacticErr}
          error={tacticErr}
          onRetry={loadTactics}
        >
          {tactics != null && (
            <div
              className={view === 'grid' ? 'grid-3' : ''}
              style={
                view === 'grid'
                  ? { gap: 16 }
                  : { display: 'grid', gridTemplateColumns: '1fr', gap: 16 }
              }
            >
              {filteredTactics.map((s) => (
                <TacticSetCard key={s.id} set={s} />
              ))}
              <EmptyAddCard
                title="New tactical set"
                sub="Author puzzles by hand from FEN + solution moves."
                onClick={() => setOpenTacticDialog(true)}
                accent="#f87171"
                accentBg="rgba(248,113,113,0.10)"
              />
            </div>
          )}
        </Section>
      )}

      <NewOpeningStudyDialog
        open={openOpenDialog}
        onClose={() => {
          setOpenOpenDialog(false);
          setLichessIntent(false);
        }}
        lichessHint={lichessIntent}
        onCreate={async ({ name, side, root_fen, root_pgn }) => {
          const { id } = await trainerStudies.create({
            name,
            root_fen,
            root_pgn,
            side,
          });
          const url = lichessIntent
            ? `/trainer/studies/opening/${id}?import=lichess`
            : `/trainer/studies/opening/${id}`;
          setLichessIntent(false);
          nav(url);
        }}
      />
      <NewGameStudyDialog
        open={openGameDialog}
        onClose={() => setOpenGameDialog(false)}
        onCreate={async ({ name, pgn }) => {
          const { id } = await trainerGames.create(name, pgn);
          nav(`/trainer/studies/game/${id}`);
        }}
      />
      <NewTacticSetDialog
        open={openTacticDialog}
        onClose={() => setOpenTacticDialog(false)}
        onCreate={async ({ name }) => {
          const { id } = await trainerTactics.create(name);
          nav(`/trainer/studies/tactic/${id}`);
        }}
      />
    </div>
  );
}

function NewStudyMenuItem({
  Icon,
  iconBg,
  iconColor,
  title,
  sub,
  onClick,
}: {
  Icon: typeof IconTree;
  iconBg: string;
  iconColor: string;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr',
        gap: 12,
        alignItems: 'center',
        padding: '10px 12px',
        borderRadius: 8,
        background: 'transparent',
        border: 0,
        cursor: 'pointer',
        textAlign: 'left',
        color: 'inherit',
        width: '100%',
      }}
      onMouseOver={(e) =>
        (e.currentTarget.style.background = 'var(--inset-bg)')
      }
      onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: iconBg,
          color: iconColor,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={14} strokeWidth={2.2} />
      </span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.005em' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  );
}

function StatTile({
  accent = false,
  Icon,
  value,
  label,
}: {
  accent?: boolean;
  Icon: typeof IconBookOpen;
  value: number | string;
  label: string;
}) {
  return (
    <Card
      style={{
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: accent ? 'var(--accent-soft)' : 'var(--inset-bg)',
          border: `1px solid ${accent ? 'var(--accent-ring)' : 'var(--inset-border)'}`,
          color: accent ? 'var(--accent)' : 'var(--text-dim)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={18} />
      </div>
      <div>
        <div
          className="mono"
          style={{
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
          {label}
        </div>
      </div>
    </Card>
  );
}

function Section({
  title,
  count,
  loading,
  error,
  onRetry,
  children,
}: {
  title: string;
  count: number;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          margin: '28px 0 14px',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <h2 className="t-h2" style={{ margin: 0 }}>{title}</h2>
          <span
            className="mono"
            style={{ color: 'var(--text-faint)', fontSize: 13, marginLeft: 8 }}
          >
            {count}
          </span>
        </div>
      </div>
      {error ? (
        <div className="meta" style={{ color: 'var(--danger)' }}>
          {error}
          {onRetry && (
            <>
              {' '}
              <button
                type="button"
                onClick={onRetry}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  padding: 0,
                  font: 'inherit',
                  textDecoration: 'underline',
                }}
              >
                Retry
              </button>
            </>
          )}
        </div>
      ) : loading ? (
        <div className="meta">Loading…</div>
      ) : (
        children
      )}
    </>
  );
}

function OpeningStudyCard({ study }: { study: OpeningStudySummary }) {
  return (
    <Link
      to={`/trainer/studies/opening/${study.id}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <Card
        className="study-card-hover"
        style={{
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          cursor: 'pointer',
          transition: 'transform 120ms ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 110, flexShrink: 0 }}>
            <FenBoard
              fen={study.root_fen}
              flip={study.side === 'b'}
              size={110}
              coordinates={false}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
                marginBottom: 8,
              }}
            >
              {study.name}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {study.eco && <Chip variant="mono">{study.eco}</Chip>}
              <Chip>
                plays{' '}
                <span style={{ color: 'var(--text)', marginLeft: 4 }}>
                  {study.side === 'w' ? 'white' : 'black'}
                </span>
              </Chip>
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            paddingTop: 14,
            borderTop: '1px solid var(--hairline)',
            fontSize: 12,
            color: 'var(--text-dim)',
          }}
        >
          <span>
            <strong className="mono" style={{ color: 'var(--text)', marginRight: 2 }}>
              {study.annotation_count}
            </strong>
            chapters
          </span>
          <span style={{ marginLeft: 'auto' }}>updated {relativeDate(study.updated_at)}</span>
        </div>
      </Card>
    </Link>
  );
}

function GameStudyCard({ study }: { study: GameStudySummary }) {
  const white = study.headers_json?.White ?? '—';
  const black = study.headers_json?.Black ?? '—';
  return (
    <Link
      to={`/trainer/studies/game/${study.id}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <Card
        style={{
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 110, flexShrink: 0 }}>
            <FenBoard fen={START_FEN} size={110} coordinates={false} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
                marginBottom: 8,
              }}
            >
              {study.name}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip variant="mono">PGN</Chip>
              <Chip>{white} vs {black}</Chip>
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            paddingTop: 14,
            borderTop: '1px solid var(--hairline)',
            fontSize: 12,
            color: 'var(--text-dim)',
          }}
        >
          <span>
            <strong className="mono" style={{ color: 'var(--text)', marginRight: 2 }}>
              {study.annotation_count}
            </strong>
            notes
          </span>
          <span style={{ marginLeft: 'auto' }}>updated {relativeDate(study.updated_at)}</span>
        </div>
      </Card>
    </Link>
  );
}

function TacticSetCard({ set }: { set: TacticSetSummary }) {
  return (
    <Link
      to={`/trainer/studies/tactic/${set.id}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <Card
        style={{
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div
            style={{
              width: 110,
              height: 110,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              background: 'rgba(248,113,113,0.10)',
              color: '#f87171',
            }}
          >
            <IconBolt size={42} strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
                marginBottom: 8,
              }}
            >
              {set.name}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip variant="mono">Tactic</Chip>
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            paddingTop: 14,
            borderTop: '1px solid var(--hairline)',
            fontSize: 12,
            color: 'var(--text-dim)',
          }}
        >
          <span>
            <strong className="mono" style={{ color: 'var(--text)', marginRight: 2 }}>
              {set.puzzle_count}
            </strong>
            puzzles
          </span>
          <span style={{ marginLeft: 'auto' }}>updated {relativeDate(set.updated_at)}</span>
        </div>
      </Card>
    </Link>
  );
}

function EmptyAddCard({
  title,
  sub,
  onClick,
  accent,
  accentBg,
}: {
  title: string;
  sub: string;
  onClick: () => void;
  accent: string;
  accentBg: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: '1px dashed var(--inset-border)',
        borderRadius: 14,
        boxShadow: 'none',
        padding: 18,
        minHeight: 220,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color: 'inherit',
        transition: 'border-color 120ms ease',
      }}
      onMouseOver={(e) =>
        (e.currentTarget.style.borderColor = 'var(--hairline-2)')
      }
      onMouseOut={(e) =>
        (e.currentTarget.style.borderColor = 'var(--inset-border)')
      }
    >
      <div>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: accentBg,
            color: accent,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
          }}
        >
          <IconPlus size={22} strokeWidth={2.2} />
        </div>
        <div className="meta-strong" style={{ marginBottom: 4 }}>{title}</div>
        <div className="meta" style={{ maxWidth: 240, margin: '0 auto' }}>{sub}</div>
      </div>
    </button>
  );
}
