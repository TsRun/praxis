import { Navigate, Link } from 'react-router-dom';
import { SignInUpForm } from './SignInUpForm';
import { useAuth } from './AuthContext';
import { defaultLandingForRoles } from './routing';
import { Card, Btn, Chip, MoveChip } from '../components/ui/atoms';
import { FenBoard } from '../components/board/FenBoard';
import { IconTree, IconGame, IconClock, IconCheck } from '../components/ui/Icons';

const CAROKANN_FEN = 'rn1qkbnr/pp2pppp/2p3b1/8/3P4/6N1/PPP2PPP/R1BQKBNR w KQkq - 3 6';
const ITALIAN_FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';
const KID_FEN = 'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R b KQ - 0 6';

export function LandingPage() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 32, color: 'var(--text-faint)' }}>Loading…</div>;
  // A first-time OAuth user lands here signed-in but with no roles yet —
  // send them to the role picker before they can use the rest of the app.
  if (user && user.roles.length === 0) return <Navigate to="/role-picker" replace />;
  if (user) return <Navigate to={defaultLandingForRoles(user.roles)} replace />;

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* nav */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          height: 64,
          padding: '0 32px',
          maxWidth: 1320,
          margin: '0 auto',
        }}
      >
        <Link to="/" className="wordmark" style={{ fontSize: 18 }}>
          <span>Pra</span>
          <span className="accent">xis</span>
        </Link>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <a
            href="#features"
            style={{
              color: 'var(--text-dim)',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 13.5,
            }}
          >
            Coaches
          </a>
          <a
            href="#features"
            style={{
              color: 'var(--text-dim)',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 13.5,
            }}
          >
            Students
          </a>
          <a
            href="#auth"
            style={{
              color: 'var(--text-dim)',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 13.5,
            }}
          >
            Sign in
          </a>
        </div>
        <a href="#auth">
          <Btn variant="primary" size="sm">Get started</Btn>
        </a>
      </div>

      {/* hero */}
      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '60px 32px 40px',
          display: 'grid',
          gridTemplateColumns: '1.05fr 1fr',
          gap: 56,
          alignItems: 'center',
        }}
      >
        <div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 12px 5px 6px',
              borderRadius: 999,
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent-ring)',
              color: 'var(--accent)',
              fontSize: 12,
              fontWeight: 500,
              marginBottom: 22,
            }}
          >
            <span
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-on)',
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              New
            </span>
            <span>Spaced-repetition drills for opening trees</span>
          </span>

          <h1
            style={{
              fontSize: 64,
              lineHeight: 1.02,
              fontWeight: 600,
              letterSpacing: '-0.035em',
              margin: '0 0 18px',
            }}
          >
            Build chess studies.
            <br />
            <span style={{ color: 'var(--accent)' }}>Coach, learn, drill.</span>
          </h1>

          <p
            style={{
              fontSize: 19,
              lineHeight: 1.5,
              color: 'var(--text-dim)',
              maxWidth: 540,
              marginBottom: 30,
            }}
          >
            A small workshop for trainers and self-learners. Author{' '}
            <strong style={{ color: 'var(--text)', fontWeight: 500 }}>
              branching opening trees
            </strong>{' '}
            and{' '}
            <strong style={{ color: 'var(--text)', fontWeight: 500 }}>
              annotated game studies
            </strong>
            . Assign by nickname. Your students drill them with Chessable-style
            spaced repetition until the lines stick.
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <a href="#auth">
              <Btn variant="primary" size="lg">Start a study →</Btn>
            </a>
            <a href="#features">
              <Btn variant="ghost" size="lg">Watch the 90-second tour</Btn>
            </a>
          </div>

          <div
            style={{
              marginTop: 28,
              display: 'flex',
              gap: 14,
              alignItems: 'center',
              fontSize: 12.5,
              color: 'var(--text-faint)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="avatar">★</div>
              <span>
                <strong style={{ color: 'var(--text)' }}>4.8</strong> · 240+ trainers
              </span>
            </div>
            <span>·</span>
            <span>From the team that built Layout Tester</span>
          </div>
        </div>

        {/* hero right */}
        <div style={{ position: 'relative', minHeight: 540 }}>
          <div
            style={{
              position: 'absolute',
              inset: '-10% -10% auto -10%',
              height: '60%',
              background:
                'radial-gradient(800px 320px at 50% 50%, var(--accent-soft), transparent 70%)',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />
          {/* main board card */}
          <div
            style={{
              position: 'absolute',
              width: 360,
              background: 'var(--card-bg)',
              borderRadius: 18,
              padding: 16,
              boxShadow: 'var(--card-shadow), 0 40px 80px -20px rgba(0,0,0,0.6)',
              transform: 'rotate(-3deg)',
              top: 20,
              left: '12%',
              zIndex: 2,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
                padding: '0 4px',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="dot-mainline" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Caro-Kann · Classical</span>
              </div>
              <Chip variant="mono">B19</Chip>
            </div>
            <FenBoard fen={CAROKANN_FEN} flip lastMove="f5g6" size={328} coordinates={false} />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 12,
                padding: '0 4px',
                alignItems: 'center',
              }}
            >
              <span className="meta">After 5…Bg6</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <MoveChip san="h4" ply={6} mainline minor />
                <MoveChip san="Bd3" minor />
                <MoveChip san="Nh5" minor />
              </div>
            </div>
          </div>

          {/* side study stack */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 50,
              width: 320,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              transform: 'rotate(2deg)',
              zIndex: 1,
            }}
          >
            {[
              { name: 'Italian Game', sub: 'C53 · 22 chapters · 5 students', fen: ITALIAN_FEN, pct: '62%', flip: false },
              { name: "King's Indian · Mar del Plata", sub: 'E97 · 9 chapters · 2 students', fen: KID_FEN, pct: '28%', flip: true },
              { name: 'Carlsen — Nepo g6', sub: 'annotated · 38 chapters', fen: 'r1bq1rk1/pp2bppp/2n2n2/2pp4/3P4/2NBPN2/PPP2PPP/R1BQ1RK1 w - - 1 8', pct: '88%', flip: false },
            ].map((s) => (
              <div
                key={s.name}
                style={{
                  background: 'var(--card-bg)',
                  borderRadius: 14,
                  padding: 14,
                  boxShadow: 'var(--card-shadow)',
                  display: 'grid',
                  gridTemplateColumns: '56px 1fr auto',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <FenBoard fen={s.fen} flip={s.flip} size={56} coordinates={false} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{s.sub}</div>
                </div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  {s.pct}
                </div>
              </div>
            ))}
          </div>

          {/* quiz toast */}
          <div
            style={{
              position: 'absolute',
              left: '4%',
              bottom: 24,
              background: 'var(--card-bg)',
              borderRadius: 14,
              padding: '14px 16px',
              width: 260,
              boxShadow: 'var(--card-shadow), 0 20px 50px -12px rgba(0,0,0,0.6)',
              transform: 'rotate(-2deg)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              zIndex: 4,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: 'rgba(52,211,153,0.18)',
                color: 'var(--success)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconCheck size={16} strokeWidth={2.6} />
            </div>
            <div style={{ fontSize: 13 }}>
              <div>
                <strong className="mono">capablanka</strong> nailed{' '}
                <strong className="mono" style={{ color: 'var(--accent)' }}>Bf5</strong>
              </div>
              <div className="meta" style={{ fontSize: 11.5 }}>streak +1 · Caro-Kann</div>
            </div>
          </div>
        </div>
      </div>

      {/* features */}
      <div id="features" style={{ maxWidth: 1320, margin: '80px auto 0', padding: '0 32px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 28,
            gap: 24,
          }}
        >
          <h2
            style={{
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: '-0.025em',
              margin: 0,
              maxWidth: 560,
              lineHeight: 1.1,
            }}
          >
            Two modes. The same calm workspace.
          </h2>
          <div style={{ color: 'var(--text-dim)', fontSize: 15, maxWidth: 360 }}>
            Build a repertoire as a branching tree, or annotate a master game.
            Students see the same board, drilled in the same way.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          {[
            {
              Icon: IconTree,
              title: 'Opening trees',
              body: 'Branch every move. Star main lines. Attach chapter titles to the positions you want to teach. Keyboard arrows walk the tree faster than your students can dispute it.',
            },
            {
              Icon: IconGame,
              title: 'Game studies',
              body: 'Paste a PGN, annotate per ply, mark which positions become quiz cards. Carlsen-Nepo Game 6 is in there as a sample — copy a chapter and ride.',
            },
            {
              Icon: IconClock,
              title: 'Spaced repetition',
              body: 'Students drill positions until the lines feel automatic. The schedule reaches back into your tree on its own — you write content, the algorithm does the testing.',
            },
          ].map((f, i) => (
            <Card
              key={i}
              style={{
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <f.Icon size={18} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: '-0.005em' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-dim)', margin: 0 }}>
                {f.body}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* auth */}
      <div
        id="auth"
        style={{
          maxWidth: 1320,
          margin: '100px auto 80px',
          padding: '0 32px',
          display: 'grid',
          gridTemplateColumns: '1fr 480px',
          gap: 60,
          alignItems: 'center',
        }}
      >
        <div>
          <h2 style={{ fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
            Start your first study in under a minute.
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-dim)', lineHeight: 1.55, maxWidth: 460 }}>
            Sign up with any email. Pick the roles that fit you — you can be a
            trainer for some students and a student for someone else, all in
            the same account.
          </p>
          <ul
            style={{
              marginTop: 24,
              paddingLeft: 18,
              lineHeight: 1.9,
              color: 'var(--text-dim)',
              fontSize: 14,
            }}
          >
            <li>Free for up to 3 students</li>
            <li>Import Lichess studies in one click</li>
            <li>No installs, no plugins</li>
          </ul>
        </div>
        <Card style={{ padding: 28 }}>
          <SignInUpForm />
        </Card>
      </div>

      <div
        style={{
          textAlign: 'center',
          padding: '40px 32px',
          color: 'var(--text-faint)',
          fontSize: 12.5,
          borderTop: '1px solid var(--hairline)',
        }}
      >
        Praxis · made for chess coaches.
      </div>
    </div>
  );
}
