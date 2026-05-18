import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, type CurrentUser, type Role } from '../lib/api';

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  signin: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, roles: Role[], inviteToken?: string) => Promise<void>;
  signout: () => Promise<void>;
  setRoles: (roles: Role[]) => Promise<void>;
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
  const signup = async (email: string, password: string, name: string, roles: Role[], inviteToken?: string) => {
    setUser(await auth.signup(email, password, name, roles, inviteToken));
  };
  const signout = async () => {
    await auth.signout();
    setUser(null);
  };
  const setRoles = async (roles: Role[]) => {
    setUser(await auth.setRoles(roles));
  };

  return (
    <Ctx.Provider value={{ user, loading, signin, signup, signout, setRoles }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
