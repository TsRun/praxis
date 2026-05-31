export type Role = 'trainer' | 'student' | 'self';
export const ALL_ROLES: Role[] = ['trainer', 'student', 'self'];

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  roles: Role[];
}

async function request<T>(method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(extraHeaders ?? {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `${method} ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>('POST', path, body, headers),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export const auth = {
  me: () => api.get<CurrentUser>('/api/auth/me'),
  signin: (email: string, password: string) =>
    api.post<CurrentUser>('/api/auth/signin', { email, password }),
  signup: (email: string, password: string, name: string, roles: Role[], inviteToken?: string) =>
    api.post<CurrentUser>('/api/auth/signup', { email, password, name, roles },
      inviteToken ? { 'X-Invite-Token': inviteToken } : undefined),
  signout: () => api.post<{ ok: true }>('/api/auth/signout'),
  setRoles: (roles: Role[]) => api.put<CurrentUser>('/api/auth/roles', { roles }),
  updateProfile: (patch: { name?: string; email?: string }) =>
    api.put<CurrentUser>('/api/auth/profile', patch),
  updatePassword: (current_password: string, new_password: string) =>
    api.put<{ ok: true }>('/api/auth/password', {
      current_password,
      new_password,
    }),
};

export interface ApiKeyRow {
  id: number;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export interface ApiKeyMinted extends ApiKeyRow {
  /** Returned ONCE on mint; never shown again. */
  key: string;
}

export const apiKeys = {
  list: () => api.get<ApiKeyRow[]>('/api/auth/api-keys'),
  create: (name: string) =>
    api.post<ApiKeyMinted>('/api/auth/api-keys', { name }),
  revoke: (id: number) => api.del<{ ok: true }>(`/api/auth/api-keys/${id}`),
};

export interface InviteInfo {
  token: string;
  expires_at: string;
  student_name: string;
  student_email: string;
  trainer_name: string;
  already_user: boolean;
}

export const invites = {
  lookup: (token: string) => api.get<InviteInfo>(`/api/invites/${token}`),
  link: (token: string) => api.post<{ ok: true }>(`/api/invites/${token}/link`),
};

// ─── Trainer-only API (roster + invites; the studies endpoints are usable by
// either 'trainer' or 'self' role and are documented here for clarity) ───

export interface StudentRow {
  id: number;
  email: string;
  name: string;
  linked_at: string;
  assignment_count: number;
}

export interface StudentDetail {
  id: number;
  email: string;
  name: string;
  assignments: {
    id: number;
    study_kind: 'opening' | 'game';
    study_id: number;
    name: string;
    assigned_at: string;
    completed_at: string | null;
  }[];
}

export const trainer = {
  /**
   * Link an existing signed-in user as your student by nickname (case-
   * insensitive exact match). On 409 the server reports an ambiguous
   * nickname; the caller should advise the student to pick a unique one.
   */
  link: (name: string) =>
    api.post<{ ok: true; mode: 'linked-existing'; student_user_id: number }>(
      '/api/trainer/invites',
      { name },
    ),
  /**
   * Send a magic-link email invite when the student doesn't yet have an
   * account. If a user already exists with this email, the server links
   * them directly and reports `mode: 'linked-existing'` instead.
   */
  inviteByEmail: (email: string, name?: string) =>
    api.post<
      | { ok: true; mode: 'invited'; token: string }
      | { ok: true; mode: 'linked-existing'; student_user_id: number }
    >('/api/trainer/invites/email', { email, name }),
  students: () => api.get<StudentRow[]>('/api/trainer/students'),
};

export const trainerStudent = {
  get: (id: number) => api.get<StudentDetail>(`/api/trainer/students/${id}`),
  assign: (id: number, study_kind: 'opening' | 'game' | 'tactic', study_id: number) =>
    api.post<{ ok: true }>(`/api/trainer/students/${id}/assignments`, { study_kind, study_id }),
};

export interface OpeningStudySummary {
  id: number;
  name: string;
  root_fen: string;
  root_pgn: string | null;
  eco: string | null;
  side: 'w' | 'b';
  created_at: string;
  updated_at: string;
  annotation_count: number;
}

export interface OpeningNode {
  id: number;
  parent_id: number | null;
  parent_fen: string;
  san: string;
  uci: string;
  fen: string;
  ply: number;
  is_main: boolean;
}

export interface OpeningChapter {
  node_id: number;
  title: string | null;
  body_md: string;
}

export interface OpeningStudyFull {
  id: number;
  name: string;
  root_fen: string;
  root_pgn: string | null;
  eco: string | null;
  side: 'w' | 'b';
  nodes: OpeningNode[];
  chapters: OpeningChapter[];
}

export const trainerStudies = {
  list: () => api.get<OpeningStudySummary[]>('/api/trainer/studies/opening'),
  create: (input: {
    name: string;
    root_fen: string;
    root_pgn?: string | null;
    eco?: string;
    side: 'w' | 'b';
  }) => api.post<{ id: number }>('/api/trainer/studies/opening', input),
  get: (id: number) => api.get<OpeningStudyFull>(`/api/trainer/studies/opening/${id}`),
  renameOpening: (id: number, name: string) =>
    api.put<{ ok: true }>(`/api/trainer/studies/opening/${id}`, { name }),
  setRoot: (id: number, input: { root_fen: string; root_pgn: string | null }) =>
    api.put<{ ok: true }>(`/api/trainer/studies/opening/${id}/root`, input),
  renameGame: (id: number, name: string) =>
    api.put<{ ok: true }>(`/api/trainer/studies/game/${id}`, { name }),
  upsertNode: (
    id: number,
    input: {
      parent_id: number | null;
      parent_fen: string;
      san: string;
      uci: string;
      fen: string;
      ply: number;
    },
  ) => api.post<{ id: number; created: boolean }>(`/api/trainer/studies/opening/${id}/nodes`, input),
  deleteNode: (id: number, nid: number) =>
    api.del<{ ok: true }>(`/api/trainer/studies/opening/${id}/nodes/${nid}`),
  setIsMain: (id: number, nid: number, is_main: boolean) =>
    api.put<{ ok: true }>(`/api/trainer/studies/opening/${id}/nodes/${nid}`, { is_main }),
  saveChapter: (id: number, nid: number, title: string | null, body_md: string) =>
    api.put<{ ok: true }>(`/api/trainer/studies/opening/${id}/nodes/${nid}/chapter`, {
      title,
      body_md,
    }),
  importPreview: (id: number, pgn: string) =>
    api.post<{ chapters: ImportChapterPreview[] }>(
      `/api/trainer/studies/opening/${id}/import-preview`,
      { pgn },
    ),
  importLichess: (id: number, pgn: string, chapter_indexes: number[]) =>
    api.post<ImportResult>(
      `/api/trainer/studies/opening/${id}/import`,
      { pgn, chapter_indexes },
    ),
  fetchChessCom: (
    id: number,
    username: string,
    filters?: SourceFetchFilters,
  ) =>
    api.post<{ pgn: string; chapters: ImportChapterPreview[] }>(
      `/api/trainer/studies/opening/${id}/fetch-chesscom`,
      { username, ...serializeSourceFilters(filters) },
    ),
  fetchLichessUser: (
    id: number,
    username: string,
    filters?: SourceFetchFilters,
  ) =>
    api.post<{ pgn: string; chapters: ImportChapterPreview[] }>(
      `/api/trainer/studies/opening/${id}/fetch-lichess`,
      { username, ...serializeSourceFilters(filters) },
    ),
  fetchBaseGames: (id: number, game_ids: number[]) =>
    api.post<{ pgn: string; chapters: ImportChapterPreview[] }>(
      `/api/trainer/studies/opening/${id}/fetch-base`,
      { game_ids },
    ),
  searchBaseGames: (params: BaseSearchFilters) => {
    const q = new URLSearchParams();
    if (params.player) q.set('player', params.player);
    if (params.color && params.color !== 'either') q.set('color', params.color);
    if (params.year_from != null) q.set('year_from', String(params.year_from));
    if (params.year_to != null) q.set('year_to', String(params.year_to));
    if (params.results && params.results.length > 0) {
      q.set('result', params.results.join(','));
    }
    if (params.eco) q.set('eco', params.eco);
    if (params.min_elo != null) q.set('min_elo', String(params.min_elo));
    if (params.position_fen) q.set('position_fen', params.position_fen);
    if (params.limit != null) q.set('limit', String(params.limit));
    if (params.offset != null) q.set('offset', String(params.offset));
    const qs = q.toString();
    return api.get<BaseSearchResult>(
      `/api/trainer/games${qs ? `?${qs}` : ''}`,
    );
  },
};

export type TimeControlBucket = 'bullet' | 'blitz' | 'rapid' | 'classical';

export interface BaseSearchFilters {
  player?: string;
  color?: 'white' | 'black' | 'either';
  year_from?: number;
  year_to?: number;
  results?: string[]; // '1-0' | '0-1' | '1/2-1/2'
  eco?: string;
  min_elo?: number;
  position_fen?: string;
  limit?: number;
  offset?: number;
}

export interface SourceFetchFilters {
  color?: 'white' | 'black' | 'either';
  results?: string[];
  eco?: string;
  min_elo?: number;
  time_control?: TimeControlBucket[];
  position_fen?: string;
}

function serializeSourceFilters(f?: SourceFetchFilters) {
  if (!f) return {};
  const out: Record<string, unknown> = {};
  if (f.color && f.color !== 'either') out.color = f.color;
  if (f.results && f.results.length > 0) out.result = f.results;
  if (f.eco) out.eco = f.eco;
  if (f.min_elo != null && f.min_elo > 0) out.min_elo = f.min_elo;
  if (f.time_control && f.time_control.length > 0) out.time_control = f.time_control;
  if (f.position_fen) out.position_fen = f.position_fen;
  return out;
}

export interface ImportChapterPreview {
  index: number;
  name: string;
  mainline_move_count: number;
  root_fen: string;
  matches_study_root: boolean;
}

/** @deprecated Use ImportChapterPreview. Kept as an alias for downstream code. */
export type LichessChapterPreview = ImportChapterPreview;

export interface BaseGame {
  id: number;
  white_name: string | null;
  black_name: string | null;
  event: string | null;
  event_date: string | null;
  result: string;
  white_elo: number | null;
  black_elo: number | null;
}

export interface BaseSearchResult {
  games: BaseGame[];
  total: number;
}

export interface ImportResult {
  imported_chapters: number;
  imported_nodes: number;
  reused_nodes: number;
  skipped: {
    kind: 'chapter-exists' | 'fen-mismatch' | 'parse-error';
    name?: string;
    reason: string;
  }[];
}

export interface GameStudySummary {
  id: number;
  name: string;
  headers_json: Record<string, string>;
  created_at: string;
  updated_at: string;
  annotation_count: number;
}
export interface GameAnnotation {
  ply: number;
  comment_md: string | null;
  is_quiz: boolean;
}
export interface GameStudyFull {
  id: number;
  name: string;
  pgn: string;
  headers_json: Record<string, string>;
  annotations: GameAnnotation[];
}

export const trainerGames = {
  list: () => api.get<GameStudySummary[]>('/api/trainer/studies/game'),
  create: (name: string, pgn: string) =>
    api.post<{ id: number }>('/api/trainer/studies/game', { name, pgn }),
  get: (id: number) => api.get<GameStudyFull>(`/api/trainer/studies/game/${id}`),
  saveAnnotations: (id: number, annotations: GameAnnotation[]) =>
    api.put<{ ok: true; count: number }>(`/api/trainer/studies/game/${id}/annotations`, { annotations }),
};

// ─── Tactical sets (trainer-authored) ────────────────────────────────────────

export interface TacticSetSummary {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  puzzle_count: number;
}

export interface TacticPuzzle {
  id: number;
  ord: number;
  fen: string;
  solution_san: string[];
  comment_md: string;
}

export interface TacticSetFull {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  puzzles: TacticPuzzle[];
}

export interface TacticSetForStudent {
  id: number;
  name: string;
  puzzles: TacticPuzzle[];
  solved_ids: number[];
}

export const trainerTactics = {
  list: () => api.get<TacticSetSummary[]>('/api/trainer/studies/tactic'),
  create: (name: string) =>
    api.post<{ id: number }>('/api/trainer/studies/tactic', { name }),
  get: (id: number) => api.get<TacticSetFull>(`/api/trainer/studies/tactic/${id}`),
  rename: (id: number, name: string) =>
    api.put<{ ok: true }>(`/api/trainer/studies/tactic/${id}`, { name }),
  delete: (id: number) =>
    api.del<{ ok: true }>(`/api/trainer/studies/tactic/${id}`),
  addPuzzle: (
    id: number,
    body: { fen: string; solution_san: string[]; comment_md?: string },
  ) => api.post<{ id: number }>(`/api/trainer/studies/tactic/${id}/puzzles`, body),
  updatePuzzle: (
    id: number,
    pid: number,
    body: { fen: string; solution_san: string[]; comment_md?: string },
  ) =>
    api.put<{ ok: true }>(
      `/api/trainer/studies/tactic/${id}/puzzles/${pid}`,
      body,
    ),
  deletePuzzle: (id: number, pid: number) =>
    api.del<{ ok: true }>(`/api/trainer/studies/tactic/${id}/puzzles/${pid}`),
};

// ─── Student / any-user API ───────────────────────────────────────────────────

export interface AssignmentRow {
  id: number;
  study_kind: 'opening' | 'game' | 'tactic';
  study_id: number;
  name: string;
  assigned_at: string;
  completed_at: string | null;
  progress_pct: number;
}

export interface NodeQuizState {
  node_id: number;
  correct_streak: number;
  wrong_count: number;
  last_seen_at: string | null;
  next_due_at: string;
}

export interface OpeningStudyForStudent {
  id: number;
  name: string;
  root_fen: string;
  root_pgn: string | null;
  eco: string | null;
  side: 'w' | 'b';
  nodes: OpeningNode[];
  chapters: OpeningChapter[];
  quiz_state: NodeQuizState[];
}

export interface QuizCard {
  node_id: number;
  parent_fen: string;
  ply: number;
  opponent_line: string[];
  root_fen: string;
}

export interface GameStudyForStudent {
  id: number;
  name: string;
  pgn: string;
  headers_json: Record<string, string>;
  annotations: { ply: number; comment_md: string | null; is_quiz: boolean }[];
  attempts: { ply: number; attempted_san: string; correct: boolean }[];
}

export const student = {
  assignments: () => api.get<AssignmentRow[]>('/api/student/assignments'),
  opening: (id: number) => api.get<OpeningStudyForStudent>(`/api/student/studies/opening/${id}`),
  game: (id: number) => api.get<GameStudyForStudent>(`/api/student/studies/game/${id}`),
  attempt: (id: number, ply: number, attempted_san: string) =>
    api.post<{
      correct: boolean;
      expected_san: string | null;
      comment_md: string | null;
    }>(`/api/student/studies/game/${id}/attempt`, { ply, attempted_san }),
  nextQuiz: (id: number) =>
    api.get<{ card: QuizCard | null }>(`/api/student/studies/opening/${id}/quiz/next`),
  quizAttempt: (id: number, node_id: number, attempted_san: string) =>
    api.post<{
      correct: boolean;
      expected_san: string;
      chapter: { title: string | null; body_md: string } | null;
    }>(`/api/student/studies/opening/${id}/quiz/attempt`, { node_id, attempted_san }),
  tactic: (id: number) =>
    api.get<TacticSetForStudent>(`/api/student/studies/tactic/${id}`),
  tacticAttempt: (id: number, puzzle_id: number, correct: boolean) =>
    api.post<{ ok: true }>(`/api/student/studies/tactic/${id}/attempt`, {
      puzzle_id,
      correct,
    }),
};

export type Cadence = 'classic' | 'rapid' | 'blitz';

export interface TournamentRow {
  id: number;
  name: string;
  url: string;
  country: string;
  location: string | null;
  region: string | null;
  department: string | null;
  lat: number | null;
  lon: number | null;
  start_date: string | null;
  end_date: string | null;
  players: number | null;
  cadence: Cadence | null;
  time_control: string | null;
}

export interface TournamentFilters {
  country?: string;
  region?: string;
  cadence?: Cadence;
  from?: string;
  to?: string;
  q?: string;
  sort?: 'date' | 'name' | 'region';
}

export const tournaments = {
  list: (f: TournamentFilters = {}) => {
    const qs = new URLSearchParams(
      Object.entries(f).filter(([, v]) => v != null && v !== '') as [string, string][],
    );
    return api.get<TournamentRow[]>(`/api/tournaments?${qs.toString()}`);
  },
  regions: (country = 'FRA') =>
    api.get<string[]>(`/api/tournaments/regions?country=${country}`),
};
