import {
  apiFormRequest,
  apiRequest,
  getApiBaseUrl,
  sameOriginStoragePath,
  unwrapData,
} from "@/lib/apiClient";
import { endpoints } from "@/services/endpoints";
import {
  asRecord,
  asRecordArray,
  type ApiEnvelope,
} from "@/services/mappers";
import type { ContentBlock, ContentMediaAsset, ContentStatus } from "@/models";

function envelopeMessage(raw: ApiEnvelope<unknown>, fallback: string): string {
  return raw.message || fallback;
}

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function isContentStatus(value: string): value is ContentStatus {
  return value === "draft" || value === "published";
}

function extensionOf(value: string): string {
  const base = value.split(/[\\/]/).pop() ?? value;
  const dot = base.lastIndexOf(".");
  if (dot < 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

function basenameOf(value: string): string {
  return value.split(/[\\/]/).pop() || value;
}

/**
 * Keep-payload paths must match API `path` values
 * (e.g. `content/documents/abc.pdf`), not public `/storage/...` URLs.
 */
export function toContentKeepPath(value: string): string {
  const trimmed = String(value ?? "")
    .trim()
    .replace(/\\/g, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return "";

  let path = trimmed;
  const base = getApiBaseUrl().replace(/\/$/, "");
  if (base && path.toLowerCase().startsWith(base.toLowerCase())) {
    path = path.slice(base.length);
  }

  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname || path;
    } catch {
      /* keep path */
    }
  }

  path = path.replace(/^\/+/, "");
  if (path.toLowerCase().startsWith("storage/")) {
    path = path.slice("storage/".length);
  }
  return path;
}

export function normalizeKeepPaths(paths: string[] | undefined): string[] {
  if (!paths?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of paths) {
    const normalized = toContentKeepPath(path);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

/** Resolve content media for UI. Files are served from this origin under `/storage/`. */
export function resolveContentMediaUrl(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;
  const storage = sameOriginStoragePath(trimmed);
  if (storage) return storage;
  const path = toContentKeepPath(trimmed);
  if (!path) return "";
  return `/storage/${path}`;
}

export function mapMediaAsset(item: unknown): ContentMediaAsset | null {
  if (item == null) return null;
  if (typeof item === "string") {
    const path = toContentKeepPath(item);
    if (!path) return null;
    const name = basenameOf(path);
    return {
      path,
      url: resolveContentMediaUrl(path),
      name,
      fileType: extensionOf(name) || extensionOf(path),
      size: 0,
    };
  }
  if (typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const path = toContentKeepPath(
    str(row.path ?? row.url ?? row.src ?? row.file ?? row.filename),
  );
  if (!path) return null;
  const name = str(row.name) || basenameOf(path);
  const fileType =
    str(row.fileType ?? row.file_type).toLowerCase() ||
    extensionOf(name) ||
    extensionOf(path);
  const sizeRaw = row.size;
  const size =
    typeof sizeRaw === "number"
      ? sizeRaw
      : Number.parseInt(String(sizeRaw ?? "0"), 10) || 0;
  return {
    path,
    url: str(row.url) || resolveContentMediaUrl(path),
    name,
    fileType,
    size,
  };
}

function mapMediaAssets(value: unknown): ContentMediaAsset[] {
  if (value == null) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        return mapMediaAssets(JSON.parse(trimmed));
      } catch {
        /* fall through */
      }
    }
    return trimmed
      .split(",")
      .map((part) => mapMediaAsset(part.trim()))
      .filter((item): item is ContentMediaAsset => Boolean(item));
  }
  if (!Array.isArray(value)) {
    if (typeof value === "object") {
      const row = value as Record<string, unknown>;
      for (const nestedKey of [
        "documents",
        "docs",
        "images",
        "videos",
        "files",
        "items",
        "data",
      ]) {
        if (nestedKey in row) {
          const nested = mapMediaAssets(row[nestedKey]);
          if (nested.length) return nested;
        }
      }
      const single = mapMediaAsset(row);
      return single ? [single] : [];
    }
    return [];
  }
  return value
    .map(mapMediaAsset)
    .filter((item): item is ContentMediaAsset => Boolean(item));
}

function readMediaField(
  raw: Record<string, unknown>,
  ...keys: string[]
): ContentMediaAsset[] | undefined {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(raw, key) && raw[key] != null) {
      return mapMediaAssets(raw[key]);
    }
  }
  return undefined;
}

function extractMediaBags(raw: Record<string, unknown>): {
  documents?: ContentMediaAsset[];
  images?: ContentMediaAsset[];
  videos?: ContentMediaAsset[];
} {
  const media = asRecord(raw.media ?? raw.files ?? raw.attachments ?? {});
  return {
    documents:
      readMediaField(raw, "documents", "docs", "documentUrls", "document_urls") ??
      readMediaField(media, "documents", "docs"),
    images:
      readMediaField(raw, "images", "imageUrls", "image_urls") ??
      readMediaField(media, "images"),
    videos:
      readMediaField(raw, "videos", "videoUrls", "video_urls") ??
      readMediaField(media, "videos"),
  };
}

function assetsFromKeepPaths(paths: string[] | undefined): ContentMediaAsset[] {
  return mapMediaAssets(paths ?? []);
}

function pickMedia(
  fromApi: ContentMediaAsset[] | undefined,
  fallbackPaths: string[] | undefined,
): ContentMediaAsset[] {
  if (fromApi && fromApi.length > 0) return fromApi;
  const fallback = assetsFromKeepPaths(fallbackPaths);
  if (fallback.length > 0) return fallback;
  return fromApi ?? fallback;
}

export function mapContent(raw: Record<string, unknown>): ContentBlock {
  const status = str(raw.status, "draft");
  const bags = extractMediaBags(raw);
  const propertyRaw = raw.propertyId ?? raw.property_id;
  const propertyId =
    propertyRaw == null || propertyRaw === ""
      ? null
      : str(propertyRaw);
  return {
    id: str(raw.id),
    key: str(raw.key),
    title: str(raw.title),
    area: str(raw.area, "general"),
    body: str(raw.body ?? raw.content),
    status: isContentStatus(status) ? status : "draft",
    propertyId,
    documents: bags.documents ?? [],
    images: bags.images ?? [],
    videos: bags.videos ?? [],
    updatedAt: str(raw.updatedAt ?? raw.updated_at, new Date().toISOString()),
    updatedBy: str(raw.updatedBy ?? raw.updated_by),
  };
}

function parseContentPayload(data: unknown): ContentBlock | null {
  if (data == null) return null;
  const record = asRecord(data);
  const unit =
    record.id != null || record.key != null || record.title != null
      ? record
      : asRecord(record.content ?? record.data);
  if (!unit.id && !unit.key && !unit.title) return null;
  const mapped = mapContent(unit);
  return mapped.id || mapped.key ? mapped : null;
}

export type ContentWriteInput = {
  id?: string;
  key: string;
  title: string;
  area?: string;
  body?: string;
  status?: ContentStatus;
  /** Linked property id — required on create. Field name: `propertyId`. */
  propertyId?: string | null;
  /** New document files (PDF/docs). Field name: `documents`. */
  documentFiles?: File[];
  /** New image files. Field name: `images`. */
  imageFiles?: File[];
  /** New video files. Field name: `videos`. */
  videoFiles?: File[];
  /**
   * Existing document paths/URLs to keep on update.
   * Sent as JSON string `keepDocuments`.
   */
  keepDocuments?: string[];
  keepImages?: string[];
  keepVideos?: string[];
};

function appendFiles(form: FormData, key: string, files: File[] | undefined) {
  if (!files?.length) return;
  for (const file of files) form.append(key, file);
}

function appendKeepField(form: FormData, key: string, paths: string[] | undefined) {
  // Always send JSON array on update when provided (including `[]`).
  // Omitting the field means "keep all existing" on the API.
  if (paths === undefined) return;
  form.append(key, JSON.stringify(normalizeKeepPaths(paths)));
}

function buildContentFormData(
  input: ContentWriteInput,
  mode: "create" | "update",
): FormData {
  const form = new FormData();
  if (mode === "create") {
    form.append("key", input.key.trim());
    form.append("area", input.area?.trim() || "general");
  } else if (input.area != null) {
    form.append("area", input.area.trim() || "general");
  }
  form.append("title", input.title.trim());
  form.append("body", input.body ?? "");
  form.append("status", input.status ?? "draft");
  if (input.propertyId != null && String(input.propertyId).trim()) {
    form.append("propertyId", String(input.propertyId).trim());
  }

  appendFiles(form, "documents", input.documentFiles);
  appendFiles(form, "images", input.imageFiles);
  appendFiles(form, "videos", input.videoFiles);

  if (mode === "update") {
    appendKeepField(form, "keepDocuments", input.keepDocuments);
    appendKeepField(form, "keepImages", input.keepImages);
    appendKeepField(form, "keepVideos", input.keepVideos);
  }

  return form;
}

export async function fetchContent(): Promise<{
  items: ContentBlock[];
  message: string;
}> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.content.list);
  const data = unwrapData(raw);
  const rows = Array.isArray(data)
    ? asRecordArray(data)
    : asRecordArray(asRecord(data).items ?? asRecord(data).content);
  return {
    items: rows.map(mapContent).filter((c) => c.id || c.key),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function fetchContentOne(
  contentId: string,
): Promise<{ content: ContentBlock | null; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.content.one(contentId),
  );
  return {
    content: parseContentPayload(unwrapData(raw)),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function postContent(
  input: ContentWriteInput,
): Promise<{ content: ContentBlock; message: string }> {
  const raw = await apiFormRequest<ApiEnvelope<unknown>>(
    endpoints.content.create,
    {
      method: "POST",
      formData: buildContentFormData(input, "create"),
    },
  );
  const message = envelopeMessage(raw, "Created.");
  const fromApi = parseContentPayload(unwrapData(raw));
  const content: ContentBlock = {
    id: str(fromApi?.id),
    key: fromApi?.key || input.key.trim(),
    title: fromApi?.title || input.title.trim(),
    area: fromApi?.area || input.area?.trim() || "general",
    body: fromApi?.body ?? input.body ?? "",
    status: fromApi?.status ?? input.status ?? "draft",
    propertyId:
      fromApi?.propertyId ??
      (input.propertyId != null && String(input.propertyId).trim()
        ? String(input.propertyId).trim()
        : null),
    documents: pickMedia(fromApi?.documents, []),
    images: pickMedia(fromApi?.images, []),
    videos: pickMedia(fromApi?.videos, []),
    updatedAt: fromApi?.updatedAt || new Date().toISOString(),
    updatedBy: fromApi?.updatedBy || "",
  };
  return { content, message };
}

export async function putContent(
  contentId: string,
  input: ContentWriteInput,
): Promise<{ content: ContentBlock; message: string }> {
  const raw = await apiFormRequest<ApiEnvelope<unknown>>(
    endpoints.content.one(contentId),
    {
      method: "PUT",
      formData: buildContentFormData(input, "update"),
    },
  );
  const message = envelopeMessage(raw, "Updated.");
  const fromApi = parseContentPayload(unwrapData(raw));
  const keptDocuments = normalizeKeepPaths(input.keepDocuments);
  const keptImages = normalizeKeepPaths(input.keepImages);
  const keptVideos = normalizeKeepPaths(input.keepVideos);
  const content: ContentBlock = {
    id: str(fromApi?.id || contentId),
    key: fromApi?.key || input.key.trim(),
    title: fromApi?.title || input.title.trim(),
    area: fromApi?.area || input.area?.trim() || "general",
    body: fromApi?.body ?? input.body ?? "",
    status: fromApi?.status ?? input.status ?? "draft",
    propertyId:
      fromApi?.propertyId ??
      (input.propertyId != null && String(input.propertyId).trim()
        ? String(input.propertyId).trim()
        : null),
    // Thin update responses often omit media arrays (`[]`); don't wipe local keep state.
    documents: pickMedia(fromApi?.documents, keptDocuments),
    images: pickMedia(fromApi?.images, keptImages),
    videos: pickMedia(fromApi?.videos, keptVideos),
    updatedAt: fromApi?.updatedAt || new Date().toISOString(),
    updatedBy: fromApi?.updatedBy || "",
  };
  return { content, message };
}

export async function deleteContentRequest(
  contentId: string,
): Promise<{ message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.content.one(contentId),
    { method: "DELETE" },
  );
  return { message: envelopeMessage(raw, "Deleted.") };
}
