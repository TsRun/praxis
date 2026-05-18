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
