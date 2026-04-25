/* eslint-disable react-refresh/only-export-components -- useAuth and AuthProvider are co-located by design */
import { createContext, useContext, useState, useCallback } from "react";
import * as Sentry from "@sentry/react";
import type { User } from "./types";

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  setAuth: (_token: string, _user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  setAuth: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("dw_token"),
  );
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("dw_user");
    return raw ? JSON.parse(raw) : null;
  });

  const setAuth = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem("dw_token", newToken);
    localStorage.setItem("dw_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    Sentry.setUser({ id: newUser.id, email: newUser.email });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("dw_token");
    localStorage.removeItem("dw_user");
    sessionStorage.setItem("dw_auto_login_started", "1");
    sessionStorage.setItem("dw_demo_auto_login_started_v2", "1");
    setToken(null);
    setUser(null);
    Sentry.setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
