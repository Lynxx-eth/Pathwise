// Auth context: holds the current user and login/signup/logout actions.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, setToken, clearToken, getToken } from "./api";

export interface User {
  id: string;
  name: string;
  email: string;
  username: string | null;
  privacyAccepted: boolean;
  xp: number;
  streakCount: number;
  bestStreak: number;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  signup: (name: string, email: string, password: string) => Promise<void>;
  signin: (email: string, password: string) => Promise<void>;
  acceptPrivacy: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on load.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get<{ user: User }>("/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function signup(name: string, email: string, password: string) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const r = await api.post<{ token: string; user: User }>("/api/auth/signup", {
      name,
      email,
      password,
      timezone: tz,
    });
    setToken(r.token);
    setUser(r.user);
  }

  async function signin(email: string, password: string) {
    const r = await api.post<{ token: string; user: User }>("/api/auth/signin", {
      email,
      password,
    });
    setToken(r.token);
    setUser(r.user);
  }

  async function acceptPrivacy() {
    const r = await api.post<{ user: User }>("/api/auth/accept-privacy");
    setUser(r.user);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, signup, signin, acceptPrivacy, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
