"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api-client";
import { clearStoredTokens, readStoredTokens, writeStoredTokens } from "@/lib/auth-storage";
import type { TokenResponseSchema, UserResponse } from "@/lib/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: UserResponse | null;
  tokens: TokenResponseSchema | null;
  startGoogleLogin: () => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<UserResponse>;
  authenticatedRequest: <T>(
    path: string,
    options?: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown },
  ) => Promise<T>;
};

type GoogleStartResponse = {
  authorization_url: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(accessToken: string): Promise<UserResponse> {
  return apiRequest<UserResponse>("/api/users/me", { token: accessToken });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserResponse | null>(null);
  const [tokens, setTokens] = useState<TokenResponseSchema | null>(null);
  const refreshInFlight = useRef<Promise<TokenResponseSchema> | null>(null);

  const persistSession = useCallback((nextTokens: TokenResponseSchema, nextUser: UserResponse) => {
    setTokens(nextTokens);
    setUser(nextUser);
    setStatus("authenticated");
    writeStoredTokens(nextTokens);
  }, []);

  const resetSession = useCallback(() => {
    setTokens(null);
    setUser(null);
    setStatus("unauthenticated");
    clearStoredTokens();
  }, []);

  const refreshTokens = useCallback(async (): Promise<TokenResponseSchema> => {
    if (!tokens?.refresh_token) {
      throw new Error("Missing refresh token");
    }

    if (!refreshInFlight.current) {
      refreshInFlight.current = apiRequest<TokenResponseSchema>("/api/auth/refresh", {
        method: "POST",
        body: { refresh_token: tokens.refresh_token },
      })
        .then((nextTokens) => {
          setTokens(nextTokens);
          writeStoredTokens(nextTokens);
          return nextTokens;
        })
        .finally(() => {
          refreshInFlight.current = null;
        });
    }

    return refreshInFlight.current;
  }, [tokens]);

  const authenticatedRequest = useCallback(
    async <T,>(
      path: string,
      options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {},
    ): Promise<T> => {
      if (!tokens?.access_token) {
        throw new Error("Not authenticated");
      }

      try {
        return await apiRequest<T>(path, { ...options, token: tokens.access_token });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          throw error;
        }

        const refreshed = await refreshTokens();
        return apiRequest<T>(path, { ...options, token: refreshed.access_token });
      }
    },
    [refreshTokens, tokens],
  );

  const startGoogleLogin = useCallback(async () => {
    const response = await apiRequest<GoogleStartResponse>("/api/auth/google/start");
    window.location.href = response.authorization_url;
  }, []);

  const refreshProfile = useCallback(async (): Promise<UserResponse> => {
    if (!tokens?.access_token) {
      throw new Error("Not authenticated");
    }

    const profile = await authenticatedRequest<UserResponse>("/api/users/me");
    setUser(profile);
    return profile;
  }, [authenticatedRequest, tokens?.access_token]);

  useEffect(() => {
    const hydrate = async () => {
      const url = new URL(window.location.href);
      const authCode = url.searchParams.get("auth_code");

      if (authCode) {
        try {
          const exchanged = await apiRequest<TokenResponseSchema>("/api/auth/google/exchange", {
            method: "POST",
            body: { auth_code: authCode },
          });
          const profile = await loadProfile(exchanged.access_token);
          persistSession(exchanged, profile);
          url.searchParams.delete("auth_code");
          window.history.replaceState({}, "", url.toString());
          return;
        } catch {
          resetSession();
          return;
        }
      }

      const stored = readStoredTokens();
      if (!stored) {
        setStatus("unauthenticated");
        return;
      }

      try {
        const profile = await loadProfile(stored.access_token);
        persistSession(stored, profile);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          resetSession();
          return;
        }

        try {
          const refreshed = await apiRequest<TokenResponseSchema>("/api/auth/refresh", {
            method: "POST",
            body: { refresh_token: stored.refresh_token },
          });
          const profile = await loadProfile(refreshed.access_token);
          persistSession(refreshed, profile);
        } catch {
          resetSession();
        }
      }
    };

    void hydrate();
  }, [persistSession, resetSession]);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      tokens,
      startGoogleLogin,
      logout: resetSession,
      refreshProfile,
      authenticatedRequest,
    }),
    [authenticatedRequest, refreshProfile, resetSession, startGoogleLogin, status, tokens, user],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
