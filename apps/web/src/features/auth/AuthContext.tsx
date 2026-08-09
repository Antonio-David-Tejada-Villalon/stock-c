import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AuthUser } from "@stock-c/shared-types";
import { loginRequest, logoutRequest, meRequest, refreshRequest, ApiAuthError } from "./api";
import { clearOfflineData } from "../../offline/db";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  status: "checking" | "authenticated" | "unauthenticated";
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Actualiza el usuario cacheado después de editar el perfil propio
   * (Fase 13) — evita recargar la página para ver el cambio reflejado. */
  setUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, accessToken: null, status: "checking" });

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const { accessToken } = await refreshRequest();
        const { user } = await meRequest(accessToken);
        if (!cancelled) setState({ user, accessToken, status: "authenticated" });
      } catch {
        if (!cancelled) setState({ user: null, accessToken: null, status: "unauthenticated" });
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, user } = await loginRequest(email, password);
    setState({ user, accessToken, status: "authenticated" });
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest().catch(() => undefined);
    // Sin esto, el caché offline de esta empresa podría quedar visible si
    // otro usuario (de otra empresa) inicia sesión después en este mismo
    // dispositivo — ver docs/10-offline-first.md, sección 7.
    await clearOfflineData().catch(() => undefined);
    setState({ user: null, accessToken: null, status: "unauthenticated" });
  }, []);

  const setUser = useCallback((user: AuthUser) => {
    setState((prev) => ({ ...prev, user }));
  }, []);

  const value = useMemo(() => ({ ...state, login, logout, setUser }), [state, login, logout, setUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiAuthError };
