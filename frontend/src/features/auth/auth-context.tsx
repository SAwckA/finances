"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api-client";
import {
  clearStoredActiveWorkspaceId,
  clearStoredTokens,
  readStoredActiveWorkspaceId,
  readStoredTokens,
  writeStoredActiveWorkspaceId,
  writeStoredTokens,
} from "@/lib/auth-storage";
import type { TokenResponseSchema, UserResponse, WorkspaceResponse } from "@/lib/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
};

type AuthContextValue = {
  status: AuthStatus;
  user: UserResponse | null;
  tokens: TokenResponseSchema | null;
  workspaces: WorkspaceResponse[];
  activeWorkspaceId: number | null;
  activeWorkspace: WorkspaceResponse | null;
  setActiveWorkspace: (workspaceId: number) => void;
  refreshWorkspaces: () => Promise<WorkspaceResponse[]>;
  startGoogleLogin: () => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<UserResponse>;
  authenticatedRequest: <T>(path: string, options?: RequestOptions) => Promise<T>;
};

type GoogleStartResponse = {
  authorization_url: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(accessToken: string): Promise<UserResponse> {
  return apiRequest<UserResponse>("/api/users/me", { token: accessToken });
}

async function loadWorkspaces(accessToken: string): Promise<WorkspaceResponse[]> {
  return apiRequest<WorkspaceResponse[]>("/api/workspaces", { token: accessToken });
}

function pickActiveWorkspaceId(
  workspaces: WorkspaceResponse[],
  preferredWorkspaceId: number | null,
): number | null {
  if (workspaces.length === 0) {
    return null;
  }

  if (preferredWorkspaceId && workspaces.some((workspace) => workspace.id === preferredWorkspaceId)) {
    return preferredWorkspaceId;
  }

  const personal = workspaces.find((workspace) => workspace.kind === "personal");
  if (personal) {
    return personal.id;
  }

  return workspaces[0]?.id ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserResponse | null>(null);
  const [tokens, setTokens] = useState<TokenResponseSchema | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceResponse[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<number | null>(null);
  const refreshInFlight = useRef<Promise<TokenResponseSchema> | null>(null);

  const applyWorkspaceState = useCallback(
    (workspaceList: WorkspaceResponse[], preferredWorkspaceId: number | null) => {
      const resolvedActiveId = pickActiveWorkspaceId(workspaceList, preferredWorkspaceId);
      setWorkspaces(workspaceList);
      setActiveWorkspaceIdState(resolvedActiveId);

      if (resolvedActiveId) {
        writeStoredActiveWorkspaceId(resolvedActiveId);
      } else {
        clearStoredActiveWorkspaceId();
      }
    },
    [],
  );

  const persistSession = useCallback(
    (
      nextTokens: TokenResponseSchema,
      nextUser: UserResponse,
      nextWorkspaces: WorkspaceResponse[],
      preferredWorkspaceId: number | null,
    ) => {
      setTokens(nextTokens);
      setUser(nextUser);
      applyWorkspaceState(nextWorkspaces, preferredWorkspaceId);
      setStatus("authenticated");
      writeStoredTokens(nextTokens);
    },
    [applyWorkspaceState],
  );

  const resetSession = useCallback(() => {
    setTokens(null);
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspaceIdState(null);
    setStatus("unauthenticated");
    clearStoredTokens();
    clearStoredActiveWorkspaceId();
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
    async <T,>(path: string, options: RequestOptions = {}): Promise<T> => {
      if (!tokens?.access_token) {
        throw new Error("Not authenticated");
      }

      const headers = new Headers(options.headers);
      const shouldAttachWorkspaceHeader =
        activeWorkspaceId !== null &&
        !path.startsWith("/api/workspaces") &&
        !path.startsWith("/api/users");
      if (shouldAttachWorkspaceHeader && !headers.has("X-Workspace-Id")) {
        headers.set("X-Workspace-Id", String(activeWorkspaceId));
      }

      try {
        return await apiRequest<T>(path, {
          ...options,
          headers,
          token: tokens.access_token,
        });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          throw error;
        }

        const refreshed = await refreshTokens();
        return apiRequest<T>(path, {
          ...options,
          headers,
          token: refreshed.access_token,
        });
      }
    },
    [activeWorkspaceId, refreshTokens, tokens],
  );

  const refreshWorkspaces = useCallback(async (): Promise<WorkspaceResponse[]> => {
    const workspaceList = await authenticatedRequest<WorkspaceResponse[]>("/api/workspaces");
    const preferredWorkspaceId = activeWorkspaceId ?? readStoredActiveWorkspaceId();
    applyWorkspaceState(workspaceList, preferredWorkspaceId);
    return workspaceList;
  }, [activeWorkspaceId, applyWorkspaceState, authenticatedRequest]);

  const setActiveWorkspace = useCallback(
    (workspaceId: number) => {
      if (!workspaces.some((workspace) => workspace.id === workspaceId)) {
        throw new Error("Workspace is not available for current user");
      }

      setActiveWorkspaceIdState(workspaceId);
      writeStoredActiveWorkspaceId(workspaceId);
    },
    [workspaces],
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
      const preferredWorkspaceId = readStoredActiveWorkspaceId();

      if (authCode) {
        try {
          const exchanged = await apiRequest<TokenResponseSchema>("/api/auth/google/exchange", {
            method: "POST",
            body: { auth_code: authCode },
          });
          const [profile, workspaceList] = await Promise.all([
            loadProfile(exchanged.access_token),
            loadWorkspaces(exchanged.access_token),
          ]);
          persistSession(exchanged, profile, workspaceList, preferredWorkspaceId);
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
        const [profile, workspaceList] = await Promise.all([
          loadProfile(stored.access_token),
          loadWorkspaces(stored.access_token),
        ]);
        persistSession(stored, profile, workspaceList, preferredWorkspaceId);
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
          const [profile, workspaceList] = await Promise.all([
            loadProfile(refreshed.access_token),
            loadWorkspaces(refreshed.access_token),
          ]);
          persistSession(refreshed, profile, workspaceList, preferredWorkspaceId);
        } catch {
          resetSession();
        }
      }
    };

    void hydrate();
  }, [persistSession, resetSession]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces],
  );

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      tokens,
      workspaces,
      activeWorkspaceId,
      activeWorkspace,
      setActiveWorkspace,
      refreshWorkspaces,
      startGoogleLogin,
      logout: resetSession,
      refreshProfile,
      authenticatedRequest,
    }),
    [
      activeWorkspace,
      activeWorkspaceId,
      authenticatedRequest,
      refreshProfile,
      refreshWorkspaces,
      resetSession,
      setActiveWorkspace,
      startGoogleLogin,
      status,
      tokens,
      user,
      workspaces,
    ],
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
