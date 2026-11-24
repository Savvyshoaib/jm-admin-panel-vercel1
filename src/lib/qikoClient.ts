import { ApiError } from "@/lib/apiClient";

function stripSlash(value: string | undefined): string {
  return value?.replace(/\/$/, "") ?? "";
}

const DEFAULT_QIKO_BASE =
  "https://preprod.qiko.ai/api/v1/tenants/joseph-mews";

export function getQikoBaseUrl(): string {
  return stripSlash(import.meta.env.VITE_QIKO_BASE_URL) || DEFAULT_QIKO_BASE;
}

export function getQikoApiKey(): string {
  return import.meta.env.VITE_QIKO_API_KEY?.trim() ?? "";
}

export function getQikoTenantId(): string {
  return import.meta.env.VITE_QIKO_TENANT_ID?.trim() || "joseph-mews";
}

/** Direct Qiko calls need a worker key. Without it we stay on jm-backend. */
export function isQikoConfigured(): boolean {
  return Boolean(getQikoApiKey());
}

type QikoRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
};

function buildQuery(
  query?: QikoRequestOptions["query"],
): string {
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
  }
  return `Qiko request failed (${status})`;
}

/**
 * Qiko worker client. Uses X-Api-Key + X-Tenant-Id (not the admin Bearer token).
 * Admin CSP must include the Qiko origin (see VITE_CSP_CONNECT_SRC).
 */
export async function qikoRequest<T>(
  path: string,
  options: QikoRequestOptions = {},
): Promise<T> {
  const key = getQikoApiKey();
  if (!key) {
    throw new ApiError(
      "Qiko API key is not configured. Set VITE_QIKO_API_KEY.",
      0,
    );
  }

  const base = getQikoBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${normalizedPath}${buildQuery(options.query)}`;
  const method = options.method ?? "GET";

  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-Api-Key": key,
      "X-Tenant-Id": getQikoTenantId(),
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

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
