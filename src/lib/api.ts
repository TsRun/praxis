export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  kind: 'trainer' | 'student';
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : undefined,
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
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export const auth = {
  me: () => api.get<CurrentUser>('/api/auth/me'),
  signin: (email: string, password: string) =>
    api.post<CurrentUser>('/api/auth/signin', { email, password }),
  signup: (email: string, password: string, name: string) =>
    api.post<CurrentUser>('/api/auth/signup', { email, password, name }),
  signout: () => api.post<{ ok: true }>('/api/auth/signout'),
};

export interface InviteInfo {
  token: string;
  expires_at: string;
  student_name: string;
  student_email: string;
  trainer_name: string;
}

export const invites = {
  lookup: (token: string) => api.get<InviteInfo>(`/api/invites/${token}`),
  accept: (token: string, password: string) =>
    api.post<CurrentUser>(`/api/invites/${token}/accept`, { password }),
};

// ─── Trainer API ──────────────────────────────────────────────────────────────

export interface StudentRow {
  id: number;
  email: string;
  name: string;
  invited_at: string;
  joined_at: string | null;
  assignment_count: number;
}

export interface StudentDetail {
  id: number;
  email: string;
  name: string;
  invited_at: string;
  joined_at: string | null;
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
  invite: (email: string, name: string) =>
    api.post<{ ok: true; student_id: number }>('/api/trainer/invites', { email, name }),
  students: () => api.get<StudentRow[]>('/api/trainer/students'),
};

export const trainerStudent = {
  get: (id: number) => api.get<StudentDetail>(`/api/trainer/students/${id}`),
  assign: (id: number, study_kind: 'opening' | 'game', study_id: number) =>
    api.post<{ ok: true }>(`/api/trainer/students/${id}/assignments`, { study_kind, study_id }),
};

export interface OpeningStudySummary {
  id: number;
  name: string;
  root_fen: string;
  eco: string | null;
  side: 'w' | 'b';
  created_at: string;
  updated_at: string;
  annotation_count: number;
}

export interface OpeningStudyFull {
  id: number;
  name: string;
  root_fen: string;
  eco: string | null;
  side: 'w' | 'b';
  annotations: { fen: string; comment_md: string }[];
}

export const trainerStudies = {
  list: () => api.get<OpeningStudySummary[]>('/api/trainer/studies/opening'),
  create: (input: { name: string; root_fen: string; eco?: string; side: 'w' | 'b' }) =>
    api.post<{ id: number }>('/api/trainer/studies/opening', input),
  get: (id: number) => api.get<OpeningStudyFull>(`/api/trainer/studies/opening/${id}`),
  saveAnnotations: (id: number, annotations: { fen: string; comment_md: string }[]) =>
    api.put<{ ok: true; count: number }>(`/api/trainer/studies/opening/${id}/annotations`, { annotations }),
};

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
