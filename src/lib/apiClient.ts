/**
 * HTTP client for JM Backend API.
 *
 * Default: browser calls `VITE_API_BASE_URL` directly.
 * When `VITE_USE_API_PROXY=true` (local Vite only): browser uses same-origin
 * `/admin` + `/storage`, and Vite proxies those to `VITE_API_BASE_URL`.
 */

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status = 0, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function stripSlash(value: string | undefined): string {
  return value?.replace(/\/$/, "") ?? "";
}

/** Local Vite proxy on/off — driven by `VITE_USE_API_PROXY`. */
export function useApiProxy(): boolean {
  return String(import.meta.env.VITE_USE_API_PROXY ?? "")
    .trim()
    .toLowerCase() === "true";
}

/**
 * Base URL for API/media requests.
 * Empty string when proxy is on (same-origin relative paths).
 */
export function getApiBaseUrl(): string {
  if (useApiProxy()) return "";
  return stripSlash(import.meta.env.VITE_API_BASE_URL);
}

/** Configured remote API origin (always the real backend host, even with proxy). */
export function getConfiguredApiOrigin(): string {
  return stripSlash(import.meta.env.VITE_API_BASE_URL);
}

/**
 * Storage files must be same-origin. The admin host's CSP only allows media
 * from 'self', so a cross-origin or blob video URL is rejected.
 */
export function sameOriginStoragePath(value: string): string | null {
  if (value.startsWith("/storage/")) return value;
  if (value.startsWith("storage/")) return `/${value}`;
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    if (!url.pathname.startsWith("/storage/")) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

/**
 * Normalize media URLs for `<img>`, `<video>`, and file preview.
 * `/storage/...` always stays on this origin. Other relative paths still use
 * the API origin unless the local proxy is on.
 */
export function resolveMediaUrl(value: string | null | undefined): string {
  if (value == null) return "";
  const trimmed = String(value).trim().replace(/\\/g, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;

  const storage = sameOriginStoragePath(trimmed);
  if (storage) return storage;

  if (/^https?:\/\//i.test(trimmed)) {
    if (useApiProxy()) {
      const api = getConfiguredApiOrigin();
      if (api && trimmed.startsWith(api)) {
        const rest = trimmed.slice(api.length);
        return rest.startsWith("/") ? rest : `/${rest}`;
      }
    }
    return trimmed;
  }

  const origin = getApiBaseUrl();
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return origin ? `${origin}${path}` : path;
}

/**
 * URL for `<img>`. The admin CSP allows https images, but same-origin
 * `/storage/...` is often the SPA HTML page until the media worker proxies it.
 */
export function displayImageUrl(value: string | null | undefined): string {
  const resolved = resolveMediaUrl(value);
  if (!resolved) return "";
  if (resolved.startsWith("blob:") || resolved.startsWith("data:")) return resolved;
  const storage = sameOriginStoragePath(resolved);
  if (!storage) return resolved;
  const origin = getConfiguredApiOrigin().replace(/\/$/, "");
  return origin ? `${origin}${storage}` : storage;
}

export function isApiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_API_BASE_URL?.trim());
}

/** Injected from the store so every request can send Bearer without prop-drilling. */
let authTokenGetter: (() => string | null) | null = null;

export function setAuthTokenGetter(getter: () => string | null) {
  authTokenGetter = getter;
}

/** Fetch a media URL as a blob (sends Bearer when the store has a token). */
export async function fetchMediaBlob(url: string): Promise<Blob> {
  const token = authTokenGetter?.() ?? null;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "*/*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new ApiError(`Unable to load file (${res.status})`, res.status);
  }
  return res.blob();
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Override store token; pass null to force unauthenticated (login/forgot). */
  token?: string | null;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** When false, never attach Authorization (auth endpoints). Default true. */
  auth?: boolean;
};

function buildQuery(query?: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

function extractErrorMessage(parsed: unknown, status: number): string {
  if (typeof parsed === "object" && parsed) {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    // Laravel validation: { message, errors: { field: [..] } }
    if (obj.errors && typeof obj.errors === "object") {
      const first = Object.values(obj.errors as Record<string, string[]>)[0];
      if (Array.isArray(first) && typeof first[0] === "string") return first[0];
    }
  }
  return `Request failed (${status})`;
}

/**
 * Unwrap common Laravel-style envelopes: `{ data: T }` → T.
 * Leaves plain payloads unchanged.
 */
export function unwrapData<T>(payload: unknown): T {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload &&
    (payload as { data: unknown }).data !== undefined
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!isApiConfigured()) {
    throw new ApiError(
      "API base URL is not configured. Set VITE_API_BASE_URL in your environment.",
      0,
    );
  }

  const base = getApiBaseUrl();

  const {
    method = "GET",
    body,
    headers = {},
    query,
    auth = true,
  } = options;

  const token =
    options.token !== undefined
      ? options.token
      : auth
        ? (authTokenGetter?.() ?? null)
        : null;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${normalizedPath}${buildQuery(query)}`;

  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return parseResponse<T>(res);
}

type FormRequestOptions = {
  method?: "POST" | "PUT" | "PATCH";
  formData: FormData;
  token?: string | null;
  headers?: Record<string, string>;
  query?: RequestOptions["query"];
  auth?: boolean;
};

/** Multipart/form-data request — do not set Content-Type (browser sets boundary). */
export async function apiFormRequest<T>(
  path: string,
  options: FormRequestOptions,
): Promise<T> {
  if (!isApiConfigured()) {
    throw new ApiError(
      "API base URL is not configured. Set VITE_API_BASE_URL in your environment.",
      0,
    );
  }

  const base = getApiBaseUrl();
  const { method = "POST", formData, headers = {}, query, auth = true } = options;
  const token =
    options.token !== undefined
      ? options.token
      : auth
        ? (authTokenGetter?.() ?? null)
        : null;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${normalizedPath}${buildQuery(query)}`;

  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: formData,
  });

  return parseResponse<T>(res);
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    throw new ApiError(extractErrorMessage(parsed, res.status), res.status, parsed);
  }

  return parsed as T;
}

/** Lists stay empty until each endpoint is wired — avoids mock/seed conflicts. */
export function emptyList<T>(): Promise<T[]> {
  return Promise.resolve([]);
}

export function notWired(action: string): never {
  throw new ApiError(
    `${action} is not wired to a real API yet. Share the endpoint contract to connect it.`,
    0,
  );
}
