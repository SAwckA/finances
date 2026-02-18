"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

type OpenApiSchema = {
  $ref?: string;
  type?: string;
  format?: string;
  enum?: Array<string | number | boolean>;
  default?: unknown;
  example?: unknown;
  nullable?: boolean;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  items?: OpenApiSchema;
  oneOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
  allOf?: OpenApiSchema[];
};

type OpenApiParameter = {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: OpenApiSchema;
};

type OpenApiOperation = {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: {
    required?: boolean;
    content?: {
      [contentType: string]: {
        schema?: OpenApiSchema;
      };
    };
  };
};

type OpenApiSpec = {
  paths: Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>;
  components?: {
    schemas?: Record<string, OpenApiSchema>;
  };
};

type Endpoint = {
  id: string;
  method: HttpMethod;
  path: string;
  title: string;
  description: string;
  tag: string;
  pathParams: OpenApiParameter[];
  queryParams: OpenApiParameter[];
  bodyRequired: boolean;
  bodyTemplate: unknown;
  defaultUseAuth: boolean;
};

type RequestResult = {
  status: number;
  durationMs: number;
  body: unknown;
};

const METHOD_ORDER: HttpMethod[] = ["get", "post", "put", "patch", "delete"];
const METHOD_BADGE: Record<HttpMethod, string> = {
  get: "bg-primary-700/80",
  post: "bg-success-700/80",
  put: "bg-warning-700/80",
  patch: "bg-warning-700/80",
  delete: "bg-danger-700/80",
};

const DEFAULT_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8000";

function resolveSchemaReference(ref: string, spec: OpenApiSpec): OpenApiSchema | undefined {
  const prefix = "#/components/schemas/";

  if (!ref.startsWith(prefix)) {
    return undefined;
  }

  const name = ref.slice(prefix.length);
  return spec.components?.schemas?.[name];
}

function createExampleFromSchema(
  schema: OpenApiSchema | undefined,
  spec: OpenApiSpec,
  depth = 0,
): unknown {
  if (!schema || depth > 5) {
    return undefined;
  }

  if (schema.$ref) {
    return createExampleFromSchema(resolveSchemaReference(schema.$ref, spec), spec, depth + 1);
  }

  if (schema.example !== undefined) {
    return schema.example;
  }

  if (schema.default !== undefined) {
    return schema.default;
  }

  if (schema.enum?.length) {
    return schema.enum[0];
  }

  if (schema.oneOf?.length) {
    return createExampleFromSchema(schema.oneOf[0], spec, depth + 1);
  }

  if (schema.anyOf?.length) {
    return createExampleFromSchema(schema.anyOf[0], spec, depth + 1);
  }

  if (schema.allOf?.length) {
    const merged: Record<string, unknown> = {};

    for (const partial of schema.allOf) {
      const partValue = createExampleFromSchema(partial, spec, depth + 1);
      if (partValue && typeof partValue === "object" && !Array.isArray(partValue)) {
        Object.assign(merged, partValue);
      }
    }

    if (Object.keys(merged).length > 0) {
      return merged;
    }
  }

  if (schema.type === "object" || schema.properties) {
    const properties = schema.properties ?? {};
    const required = new Set(schema.required ?? []);
    const output: Record<string, unknown> = {};

    for (const [key, propSchema] of Object.entries(properties)) {
      const value = createExampleFromSchema(propSchema, spec, depth + 1);
      if (value !== undefined || required.has(key)) {
        output[key] = value ?? null;
      }
    }

    return output;
  }

  if (schema.type === "array") {
    return [createExampleFromSchema(schema.items, spec, depth + 1) ?? null];
  }

  if (schema.type === "integer") {
    return 0;
  }

  if (schema.type === "number") {
    return 0;
  }

  if (schema.type === "boolean") {
    return false;
  }

  if (schema.type === "string") {
    if (schema.format === "date") {
      return "2026-01-01";
    }

    if (schema.format === "date-time") {
      return "2026-01-01T12:00:00Z";
    }

    if (schema.format === "email") {
      return "user@example.com";
    }

    if (schema.format === "uuid") {
      return "00000000-0000-0000-0000-000000000000";
    }

    return "";
  }

  return undefined;
}

function buildEndpoints(spec: OpenApiSpec): Endpoint[] {
  const endpoints: Endpoint[] = [];

  for (const [path, operations] of Object.entries(spec.paths)) {
    for (const method of METHOD_ORDER) {
      const operation = operations[method];
      if (!operation) {
        continue;
      }

      const params = operation.parameters ?? [];
      const pathParams = params.filter((param) => param.in === "path");
      const queryParams = params.filter((param) => param.in === "query");
      const jsonSchema = operation.requestBody?.content?.["application/json"]?.schema;

      const id = `${method.toUpperCase()} ${path}`;
      const title = operation.summary?.trim() || id;
      const description = operation.description?.trim() || "Описание не указано";
      const tag = operation.tags?.[0] || "General";
      const defaultUseAuth = !path.startsWith("/api/auth") && path !== "/health";

      endpoints.push({
        id,
        method,
        path,
        title,
        description,
        tag,
        pathParams,
        queryParams,
        bodyRequired: Boolean(operation.requestBody?.required),
        bodyTemplate: createExampleFromSchema(jsonSchema, spec),
        defaultUseAuth,
      });
    }
  }

  return endpoints.sort((a, b) => {
    if (a.tag !== b.tag) {
      return a.tag.localeCompare(b.tag);
    }

    if (a.path !== b.path) {
      return a.path.localeCompare(b.path);
    }

    return METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method);
  });
}

function EndpointCard({
  endpoint,
  baseUrl,
  accessToken,
  onExtractTokens,
}: {
  endpoint: Endpoint;
  baseUrl: string;
  accessToken: string;
  onExtractTokens: (body: unknown) => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [useAuth, setUseAuth] = useState(endpoint.defaultUseAuth);
  const [result, setResult] = useState<RequestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pathValues, setPathValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(endpoint.pathParams.map((param) => [param.name, ""])),
  );
  const [queryValues, setQueryValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(endpoint.queryParams.map((param) => [param.name, ""])),
  );
  const [bodyText, setBodyText] = useState<string>(() =>
    endpoint.bodyTemplate === undefined ? "" : JSON.stringify(endpoint.bodyTemplate, null, 2),
  );

  const hasBody = endpoint.bodyTemplate !== undefined;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    let resolvedPath = endpoint.path;

    for (const param of endpoint.pathParams) {
      const value = pathValues[param.name]?.trim() ?? "";
      if (!value && param.required) {
        setError(`Укажите обязательный path-параметр: ${param.name}`);
        return;
      }

      resolvedPath = resolvedPath.replace(`{${param.name}}`, encodeURIComponent(value));
    }

    const searchParams = new URLSearchParams();
    for (const param of endpoint.queryParams) {
      const value = queryValues[param.name]?.trim() ?? "";
      if (!value && param.required) {
        setError(`Укажите обязательный query-параметр: ${param.name}`);
        return;
      }

      if (value) {
        searchParams.set(param.name, value);
      }
    }

    let parsedBody: string | undefined;
    if (hasBody && bodyText.trim()) {
      try {
        parsedBody = JSON.stringify(JSON.parse(bodyText));
      } catch {
        setError("Тело запроса должно быть валидным JSON.");
        return;
      }
    }

    const normalizedBase = baseUrl.trim().replace(/\/$/, "");
    const query = searchParams.toString();
    const targetUrl = `${normalizedBase}${resolvedPath}${query ? `?${query}` : ""}`;

    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (useAuth && accessToken.trim()) {
      headers.Authorization = `Bearer ${accessToken.trim()}`;
    }

    if (parsedBody !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    try {
      setIsPending(true);
      const startedAt = performance.now();

      const response = await fetch(targetUrl, {
        method: endpoint.method.toUpperCase(),
        headers,
        body: parsedBody,
      });

      const finishedAt = performance.now();
      const text = await response.text();

      let parsed: unknown = text;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }

      setResult({
        status: response.status,
        durationMs: Math.round(finishedAt - startedAt),
        body: parsed,
      });

      onExtractTokens(parsed);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Запрос завершился с ошибкой");
      setResult(null);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <article className="rounded-2xl border border-default-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white ${METHOD_BADGE[endpoint.method]}`}
        >
          {endpoint.method}
        </span>
        <code className="rounded bg-default-100 px-2 py-1 text-sm text-default-700">{endpoint.path}</code>
      </div>

      <h3 className="text-base font-semibold text-default-900">{endpoint.title}</h3>
      <p className="mt-1 text-sm text-default-600">{endpoint.description}</p>

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        {endpoint.pathParams.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {endpoint.pathParams.map((param) => (
              <label className="text-sm text-default-700" key={param.name}>
                {param.name}
                {param.required ? " *" : ""}
                <input
                  className="mt-1 w-full rounded-lg border border-default-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500"
                  onChange={(event) => {
                    setPathValues((prev) => ({ ...prev, [param.name]: event.target.value }));
                  }}
                  placeholder={param.description || "Значение"}
                  value={pathValues[param.name] ?? ""}
                />
              </label>
            ))}
          </div>
        )}

        {endpoint.queryParams.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {endpoint.queryParams.map((param) => (
              <label className="text-sm text-default-700" key={param.name}>
                {param.name}
                {param.required ? " *" : ""}
                <input
                  className="mt-1 w-full rounded-lg border border-default-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500"
                  onChange={(event) => {
                    setQueryValues((prev) => ({ ...prev, [param.name]: event.target.value }));
                  }}
                  placeholder={param.description || "Значение"}
                  value={queryValues[param.name] ?? ""}
                />
              </label>
            ))}
          </div>
        )}

        {hasBody && (
          <label className="block text-sm text-default-700">
            JSON body {endpoint.bodyRequired ? "*" : ""}
            <textarea
              className="mt-1 min-h-32 w-full rounded-lg border border-default-300 px-3 py-2 font-mono text-xs outline-none transition focus:border-primary-500"
              onChange={(event) => setBodyText(event.target.value)}
              value={bodyText}
            />
          </label>
        )}

        <label className="inline-flex items-center gap-2 text-sm text-default-700">
          <input
            checked={useAuth}
            className="size-4 rounded border-default-300"
            onChange={(event) => setUseAuth(event.target.checked)}
            type="checkbox"
          />
          Добавить Bearer токен
        </label>

        {error && <p className="text-sm text-danger-700">{error}</p>}

        <button
          className="rounded-lg bg-default-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-default-700 disabled:cursor-not-allowed disabled:bg-default-400"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Выполняю..." : "Отправить запрос"}
        </button>
      </form>

      {result && (
        <div className="mt-4 space-y-2 rounded-xl border border-default-200 bg-default-950 p-3 text-default-100">
          <p className="text-xs text-default-300">
            Status: {result.status} • {result.durationMs} ms
          </p>
          <pre className="max-h-80 overflow-auto text-xs leading-relaxed">
            {JSON.stringify(result.body, null, 2)}
          </pre>
        </div>
      )}
    </article>
  );
}

export function FinanceWorkbench() {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [accessToken, setAccessToken] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem("finances.access_token") ?? "";
  });
  const [refreshToken, setRefreshToken] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem("finances.refresh_token") ?? "";
  });

  const [search, setSearch] = useState("");

  useEffect(() => {
    window.localStorage.setItem("finances.access_token", accessToken);
  }, [accessToken]);

  useEffect(() => {
    window.localStorage.setItem("finances.refresh_token", refreshToken);
  }, [refreshToken]);

  useEffect(() => {
    let mounted = true;

    async function loadOpenApiSpec() {
      try {
        const response = await fetch("/openapi.json", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Не удалось загрузить openapi.json (${response.status})`);
        }

        const payload = (await response.json()) as OpenApiSpec;

        if (mounted) {
          setSpec(payload);
          setLoadingError(null);
        }
      } catch (error) {
        if (mounted) {
          const message = error instanceof Error ? error.message : "Неизвестная ошибка";
          setLoadingError(message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadOpenApiSpec();

    return () => {
      mounted = false;
    };
  }, []);

  const endpoints = useMemo(() => {
    if (!spec) {
      return [];
    }

    return buildEndpoints(spec);
  }, [spec]);

  const filteredEndpoints = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return endpoints;
    }

    return endpoints.filter((endpoint) => {
      const combined = `${endpoint.method} ${endpoint.path} ${endpoint.title} ${endpoint.description}`.toLowerCase();
      return combined.includes(query);
    });
  }, [endpoints, search]);

  const endpointsByTag = useMemo(() => {
    const groups = new Map<string, Endpoint[]>();

    for (const endpoint of filteredEndpoints) {
      const existing = groups.get(endpoint.tag);
      if (existing) {
        existing.push(endpoint);
      } else {
        groups.set(endpoint.tag, [endpoint]);
      }
    }

    return groups;
  }, [filteredEndpoints]);

  function extractTokensFromBody(body: unknown) {
    if (!body || typeof body !== "object") {
      return;
    }

    const access = (body as Record<string, unknown>).access_token;
    const refresh = (body as Record<string, unknown>).refresh_token;

    if (typeof access === "string") {
      setAccessToken(access);
    }

    if (typeof refresh === "string") {
      setRefreshToken(refresh);
    }
  }

  return (
    <section className="space-y-6 pb-10">
      <header className="rounded-3xl border border-white/60 bg-[linear-gradient(130deg,#134e4a_0%,#0f172a_45%,#1e293b_100%)] p-6 text-white shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-primary-100/80">Finances API</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Frontend рабочее пространство для всех эндпоинтов</h1>
        <p className="mt-2 max-w-3xl text-sm text-default-200">
          Интерфейс читает спецификацию OpenAPI и позволяет отправлять запросы ко всем backend endpoint&apos;ам.
        </p>
      </header>

      <section className="grid gap-3 rounded-2xl border border-default-200 bg-white/90 p-4 shadow-sm sm:grid-cols-2">
        <label className="text-sm text-default-700">
          Base URL backend
          <input
            className="mt-1 w-full rounded-lg border border-default-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500"
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="http://localhost:8000"
            value={baseUrl}
          />
        </label>

        <label className="text-sm text-default-700">
          Поиск endpoint
          <input
            className="mt-1 w-full rounded-lg border border-default-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="/api/transactions, login, summary..."
            value={search}
          />
        </label>

        <label className="text-sm text-default-700 sm:col-span-2">
          Access token (Bearer)
          <input
            className="mt-1 w-full rounded-lg border border-default-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500"
            onChange={(event) => setAccessToken(event.target.value)}
            value={accessToken}
          />
        </label>

        <label className="text-sm text-default-700 sm:col-span-2">
          Refresh token
          <input
            className="mt-1 w-full rounded-lg border border-default-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500"
            onChange={(event) => setRefreshToken(event.target.value)}
            value={refreshToken}
          />
        </label>
      </section>

      {loading && <p className="text-sm text-default-600">Загружаю OpenAPI спецификацию...</p>}
      {loadingError && <p className="text-sm text-danger-700">Ошибка: {loadingError}</p>}

      {!loading && !loadingError && (
        <div className="space-y-4">
          <p className="text-sm text-default-600">
            Найдено endpoint: <strong>{filteredEndpoints.length}</strong> из <strong>{endpoints.length}</strong>
          </p>

          {Array.from(endpointsByTag.entries()).map(([tag, group]) => (
            <section className="space-y-3" key={tag}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-default-900">{tag}</h2>
                <span className="rounded-full bg-default-100 px-3 py-1 text-xs text-default-600">{group.length}</span>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {group.map((endpoint) => (
                  <EndpointCard
                    accessToken={accessToken}
                    baseUrl={baseUrl}
                    endpoint={endpoint}
                    key={endpoint.id}
                    onExtractTokens={extractTokensFromBody}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
