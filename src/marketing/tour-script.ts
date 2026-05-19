import { Chess } from 'chess.js';

export interface Frame {
  fen: string;
  uci: string | null;
  san: string;
}

function frames(sans: string[]): Frame[] {
  const c = new Chess();
  const out: Frame[] = [{ fen: c.fen(), uci: null, san: '' }];
  for (const san of sans) {
    const m = c.move(san);
    if (!m) throw new Error(`tour-script: bad SAN ${san}`);
    out.push({ fen: c.fen(), uci: `${m.from}${m.to}${m.promotion ?? ''}`, san: m.san });
  }
  return out;
}

export const TOUR_ITALIAN = frames(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
export const TOUR_TRANSPOSE_A = frames(['e4', 'e5', 'Nf3']);
export const TOUR_TRANSPOSE_B = frames(['Nf3', 'e5', 'e4']);

export const FEN_AFTER_3_BC4 = TOUR_ITALIAN[5].fen;
export const FEN_AFTER_2_NC6 = TOUR_ITALIAN[4].fen;

export type SceneId = 'build' | 'branch' | 'chapter' | 'transpose' | 'drill' | 'cta';

export interface SceneCfg {
  id: SceneId;
  duration: number;
  label: string;
  title: string;
  sub: string;
}

export const SCENES: SceneCfg[] = [
  {
    id: 'build',
    duration: 14000,
    label: 'Author',
    title: 'Build move by move.',
    sub: 'Drop a move on the board — the position becomes a node, and your tree grows from it.',
  },
  {
    id: 'branch',
    duration: 14000,
    label: 'Branch',
    title: 'Branch every variation.',
    sub: 'Star the main line. Keep the side lines as siblings, ready for students to find.',
  },
  {
    id: 'chapter',
    duration: 14000,
    label: 'Chapters',
    title: 'Chapters cover subtrees.',
    sub: 'Title a position once — everything beneath inherits the chapter until a deeper one takes over.',
  },
  {
    id: 'transpose',
    duration: 16000,
    label: 'Transposition',
    title: 'Same position, any move order.',
    sub: 'Praxis links transpositions by FEN: one canonical node, many paths to reach it.',
  },
  {
    id: 'drill',
    duration: 18000,
    label: 'Drill',
    title: 'Students drill until it sticks.',
    sub: 'Spaced repetition. Misses come back sooner; learned lines drift to weeks.',
  },
  {
    id: 'cta',
    duration: 14000,
    label: 'Start',
    title: 'Start your first study.',
    sub: "Sign up free — invite students by email when you're ready.",
  },
];

export const TOTAL_MS = SCENES.reduce((s, x) => s + x.duration, 0);
