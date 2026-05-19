import { Navigate, Link } from 'react-router-dom';
import { SignInUpForm } from './SignInUpForm';
import { useAuth } from './AuthContext';
import { defaultLandingForRoles } from './routing';
import { Card, Btn } from '../components/ui/atoms';
import { FenBoard } from '../components/board/FenBoard';
import { IconTree, IconGame, IconClock } from '../components/ui/Icons';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function LandingPage() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 32, color: 'var(--text-faint)' }}>Loading…</div>;
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
            Features
          </a>
          <Link
            to="/tour"
            style={{
              color: 'var(--text-dim)',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 13.5,
            }}
          >
            Tour
          </Link>
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
            A workshop for trainers and self-learners. Author{' '}
            <strong style={{ color: 'var(--text)', fontWeight: 500 }}>
              branching opening trees
            </strong>{' '}
            and{' '}
            <strong style={{ color: 'var(--text)', fontWeight: 500 }}>
              annotated game studies
            </strong>
            . Assign them to students by nickname, and they drill the positions
            with spaced repetition until the lines stick.
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <a href="#auth">
              <Btn variant="primary" size="lg">Start a study →</Btn>
            </a>
            <Link to="/tour">
              <Btn variant="ghost" size="lg">Take the 90s tour</Btn>
            </Link>
          </div>
        </div>

        {/* hero right — single straight board, no overlays */}
        <div
          style={{
            position: 'relative',
            minHeight: 540,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
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
          <div
            style={{
              position: 'relative',
              width: 440,
              padding: 18,
              background: 'var(--card-bg)',
              borderRadius: 18,
              boxShadow:
                'var(--card-shadow), 0 40px 80px -20px rgba(0,0,0,0.6)',
              zIndex: 2,
            }}
          >
            <FenBoard fen={START_FEN} size={404} coordinates={false} />
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
              body: 'Paste a PGN, annotate ply by ply, and mark which positions become quiz cards. Your students walk the game with the same controls you used to author it.',
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
            Sign up and start a study.
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-dim)', lineHeight: 1.55, maxWidth: 460 }}>
            Pick the roles that fit you — you can be a trainer for some
            students and a student for someone else, all in the same account.
            Change them later from settings.
          </p>
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
