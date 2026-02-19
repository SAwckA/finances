import type { TokenResponseSchema } from "@/lib/types";

const STORAGE_KEY = "finances.auth.tokens";
const ACTIVE_WORKSPACE_KEY = "finances.activeWorkspaceId";

export function readStoredTokens(): TokenResponseSchema | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as TokenResponseSchema;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function writeStoredTokens(tokens: TokenResponseSchema): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function clearStoredTokens(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function readStoredActiveWorkspaceId(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    return null;
  }

  return parsed;
}

export function writeStoredActiveWorkspaceId(workspaceId: number): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, String(workspaceId));
}

export function clearStoredActiveWorkspaceId(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
}
