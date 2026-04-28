import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, tokenStore } from "./api";
import type { Me } from "./types";

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const m = await api.me();
      setMe(m);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setMe(null);
        tokenStore.clear();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Any API call returning AUTH_REQUIRED / FORBIDDEN dispatches this event;
  // we drop the cached user + token so the router bounces back to /login on
  // the next render, instead of leaving stale UI rendering against a dead
  // session.
  useEffect(() => {
    const onLost = () => {
      tokenStore.clear();
      setMe(null);
    };
    window.addEventListener("samwise:auth-lost", onLost);
    return () => window.removeEventListener("samwise:auth-lost", onLost);
  }, []);

  const login = async (email: string, password: string) => {
    const m = await api.login(email, password);
    if (m.sessionToken) tokenStore.set(m.sessionToken);
    setMe(m);
    return m;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    tokenStore.clear();
    setMe(null);
  };

  const changePassword = async (current: string, next: string) => {
    const r = await api.changePassword(current, next);
    if (r.sessionToken) tokenStore.set(r.sessionToken);
    await refresh();
  };

  return (
    <Ctx.Provider value={{ me, loading, login, logout, refresh, changePassword }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
