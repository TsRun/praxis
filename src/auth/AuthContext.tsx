import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, type CurrentUser } from '../lib/api';

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  signin: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  signout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const signin = async (email: string, password: string) => {
    setUser(await auth.signin(email, password));
  };
  const signup = async (email: string, password: string, name: string) => {
    setUser(await auth.signup(email, password, name));
  };
  const signout = async () => {
    await auth.signout();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, signin, signup, signout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
