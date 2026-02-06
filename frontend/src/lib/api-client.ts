export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers);
  const method = options.method ?? "GET";

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const hasBody = options.body !== undefined;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    method,
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const contentLength = response.headers.get("content-length");
  const isEmpty = contentLength === "0";
  const payload = contentType.includes("application/json")
    ? isEmpty
      ? null
      : ((await response.json()) as unknown)
    : ((await response.text()) as unknown);

  if (!response.ok) {
    throw new ApiError(`Request failed: ${response.status}`, response.status, payload);
  }

  return payload as T;
}
