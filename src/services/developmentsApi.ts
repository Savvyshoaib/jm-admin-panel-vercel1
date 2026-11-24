import {
  ApiError,
  apiFormRequest,
  apiRequest,
  resolveMediaUrl,
  unwrapData,
} from "@/lib/apiClient";
import { toApiDate, toDateInputValue } from "@/lib/format";
import { compareSortOrder } from "@/lib/listOrder";
import { endpoints } from "@/services/endpoints";
import {
  asRecord,
  asRecordArray,
  type ApiEnvelope,
} from "@/services/mappers";
import type { Development, DevelopmentStatus } from "@/models";

function envelopeMessage(raw: ApiEnvelope<unknown>, fallback: string): string {
  return raw.message || fallback;
}

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => str(v).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

const STATUSES: DevelopmentStatus[] = [
  "draft",
  "coming_soon",
  "available",
  "sold_out",
  "completed",
  "archived",
];

function isStatus(value: string): value is DevelopmentStatus {
  return STATUSES.includes(value as DevelopmentStatus);
}

function isTenure(value: string): value is Development["tenure"] {
  return value === "Leasehold" || value === "Freehold";
}

function mapImageEntry(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return resolveMediaUrl(value);
  if (typeof value === "object") {
    const row = asRecord(value);
    return resolveMediaUrl(
      str(row.url ?? row.path ?? row.src ?? row.full_url ?? row.original_url),
    );
  }
  return "";
}

function mapImageList(raw: unknown, fallbackImage?: unknown): string[] {
  const fromArray = Array.isArray(raw)
    ? raw.map(mapImageEntry).filter(Boolean)
    : [];
  const primary = mapImageEntry(fallbackImage);
  const list = [...fromArray];
  if (primary && !list.includes(primary)) list.unshift(primary);
  return list;
}

export function mapDevelopment(raw: Record<string, unknown>): Development {
  const status = str(raw.status, "draft");
  const tenure = str(raw.tenure, "Leasehold");
  const images = mapImageList(raw.images, raw.image ?? raw.imageUrl ?? raw.image_url);
  const image = images[0] ?? "";

  return {
    id: str(raw.id),
    reference: str(raw.reference ?? raw.ref),
    name: str(raw.name),
    developer: str(raw.developer),
    address: str(raw.address),
    city: str(raw.city),
    region: str(raw.region),
    postcode: str(raw.postcode ?? raw.postal_code),
    description: str(raw.description),
    status: isStatus(status) ? status : "draft",
    completionDate: toDateInputValue(
      str(raw.completionDate ?? raw.completion_date),
    ),
    propertyTypes: stringList(raw.propertyTypes ?? raw.property_types),
    startingPrice: num(raw.startingPrice ?? raw.starting_price),
    expectedRentalYield: num(
      raw.expectedRentalYield ?? raw.expected_rental_yield,
    ),
    expectedCapitalGrowth: num(
      raw.expectedCapitalGrowth ?? raw.expected_capital_growth,
    ),
    image,
    images,
    amenities: stringList(raw.amenities),
    highlights: stringList(raw.highlights),
    locationInfo: str(raw.locationInfo ?? raw.location_info),
    availableUnits: num(raw.availableUnits ?? raw.available_units),
    totalUnits: num(raw.totalUnits ?? raw.total_units),
    featured: bool(raw.featured),
    visibleInExplore: bool(
      raw.visibleInExplore ?? raw.visible_in_explore,
    ),
    sortOrder: num(raw.sortOrder ?? raw.sort_order, Number.MAX_SAFE_INTEGER),
    paymentPlanSummary: str(
      raw.paymentPlanSummary ?? raw.payment_plan_summary,
    ),
    tenure: isTenure(tenure) ? tenure : "Leasehold",
    leaseYears:
      raw.leaseYears == null && raw.lease_years == null
        ? undefined
        : num(raw.leaseYears ?? raw.lease_years),
    updatedAt: str(
      raw.updatedAt ?? raw.updated_at,
      new Date().toISOString(),
    ),
    updatedBy: str(raw.updatedBy ?? raw.updated_by),
  };
}

function parseDevelopmentPayload(data: unknown): Development | null {
  if (data == null) return null;
  const record = asRecord(data);
  const unit =
    record.id != null || record.name != null
      ? record
      : asRecord(record.development ?? record.data);
  if (!unit.id && !unit.name) return null;
  return mapDevelopment(unit);
}

export type DevelopmentWriteInput = Partial<Development> & {
  name: string;
  imageFiles?: File[];
  /** Keep previously uploaded URLs when sending multipart. */
  existingImages?: string[];
  /** Stored paths/URLs to delete (collection: removeImages). */
  removeImages?: string[];
};

function csvOrList(values: string[] | undefined): string {
  return (values ?? []).map((v) => v.trim()).filter(Boolean).join(", ");
}

/** JSON body matching JM Admin collection create/update. */
function developmentWriteBody(input: DevelopmentWriteInput) {
  const body: Record<string, unknown> = {
    name: input.name.trim(),
    reference: (input.reference ?? "").trim(),
    developer: input.developer ?? "",
    address: input.address ?? "",
    city: input.city ?? "",
    region: input.region ?? "",
    postcode: input.postcode ?? "",
    description: input.description ?? "",
    startingPrice: input.startingPrice ?? 0,
    expectedRentalYield: input.expectedRentalYield ?? 0,
    expectedCapitalGrowth: input.expectedCapitalGrowth ?? 0,
    completionDate: toApiDate(input.completionDate) || input.completionDate || "",
    status: input.status ?? "draft",
    highlights: input.highlights ?? [],
    amenities: input.amenities ?? [],
    locationInfo: input.locationInfo ?? "",
    featured: Boolean(input.featured),
    visibleInExplore: Boolean(input.visibleInExplore),
  };
  if (input.removeImages?.length) {
    body.removeImages = input.removeImages.filter((u) => u && !u.startsWith("blob:"));
  }
  return body;
}

/** Multipart body — field names match Postman form + images. */
export function buildDevelopmentFormData(input: DevelopmentWriteInput): FormData {
  const form = new FormData();
  const json = developmentWriteBody(input);

  for (const [key, value] of Object.entries(json)) {
    if (value === undefined || value === null) continue;
    if (key === "highlights" || key === "amenities") {
      form.append(key, csvOrList(value as string[]));
      continue;
    }
    if (key === "removeImages") {
      form.append("removeImages", csvOrList(value as string[]));
      continue;
    }
    if (typeof value === "boolean") {
      form.append(key, value ? "true" : "false");
      continue;
    }
    if (Array.isArray(value)) {
      form.append(key, csvOrList(value.map(String)));
      continue;
    }
    form.append(key, String(value));
  }

  for (const file of input.imageFiles ?? []) {
    form.append("images", file);
  }

  return form;
}

/**
 * Prefer API entity when complete; fill gaps from the submitted form when
 * the write response is thin.
 */
export function mergeSavedDevelopment(
  developmentId: string,
  input: DevelopmentWriteInput,
  fromApi: Development | null,
): Development {
  const submitted: Development = {
    id: developmentId,
    reference: (input.reference ?? "").trim(),
    name: input.name.trim(),
    developer: input.developer ?? "",
    address: input.address ?? "",
    city: input.city ?? "",
    region: input.region ?? "",
    postcode: input.postcode ?? "",
    description: input.description ?? "",
    status: input.status ?? "draft",
    completionDate: input.completionDate ?? "",
    propertyTypes: input.propertyTypes ?? [],
    startingPrice: input.startingPrice ?? 0,
    expectedRentalYield: input.expectedRentalYield ?? 0,
    expectedCapitalGrowth: input.expectedCapitalGrowth ?? 0,
    image: input.image ?? input.images?.[0] ?? "",
    images: input.images?.length
      ? input.images
      : input.image
        ? [input.image]
        : input.existingImages ?? [],
    amenities: input.amenities ?? [],
    highlights: input.highlights ?? [],
    locationInfo: input.locationInfo ?? "",
    availableUnits: input.availableUnits ?? 0,
    totalUnits: input.totalUnits ?? 0,
    featured: Boolean(input.featured),
    visibleInExplore: Boolean(input.visibleInExplore),
    sortOrder: input.sortOrder ?? Number.MAX_SAFE_INTEGER,
    paymentPlanSummary: input.paymentPlanSummary ?? "",
    tenure: input.tenure ?? "Leasehold",
    leaseYears: input.leaseYears,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy ?? "",
  };

  if (!fromApi) return submitted;

  return {
    ...submitted,
    ...fromApi,
    id: str(fromApi.id || developmentId),
    name: fromApi.name || submitted.name,
    reference: fromApi.reference || submitted.reference,
    image: fromApi.image || submitted.image,
    images: fromApi.images?.length ? fromApi.images : submitted.images,
    amenities: fromApi.amenities?.length ? fromApi.amenities : submitted.amenities,
    highlights: fromApi.highlights?.length
      ? fromApi.highlights
      : submitted.highlights,
    locationInfo: fromApi.locationInfo || submitted.locationInfo,
    propertyTypes: fromApi.propertyTypes?.length
      ? fromApi.propertyTypes
      : submitted.propertyTypes,
  };
}

export async function fetchDevelopments(): Promise<{
  items: Development[];
  message: string;
}> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.developments.list);
  const data = unwrapData(raw);
  const rows = Array.isArray(data)
    ? asRecordArray(data)
    : asRecordArray(
        asRecord(data).items ?? asRecord(data).developments,
      );
  return {
    items: rows
      .map(mapDevelopment)
      .filter((d) => d.id)
      .sort(compareSortOrder),
    message: envelopeMessage(raw, "Success."),
  };
}

export type DevelopmentSortItem = {
  id: string | number;
  sortOrder: number;
};

/** Bulk-update Explore / admin list order. Lower sortOrder appears first. */
export async function putDevelopmentsSort(
  items: DevelopmentSortItem[],
): Promise<{ items: Development[]; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.developments.sort, {
    method: "PUT",
    body: { items },
  });
  const data = unwrapData(raw);
  const rows = Array.isArray(data)
    ? asRecordArray(data)
    : asRecordArray(
        asRecord(data).items ?? asRecord(data).developments ?? [],
      );
  return {
    items: (rows.length ? rows.map(mapDevelopment).filter((d) => d.id) : []).sort(
      compareSortOrder,
    ),
    message: envelopeMessage(raw, "Order saved."),
  };
}

export async function fetchDevelopment(
  developmentId: string,
): Promise<{ development: Development | null; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.developments.one(developmentId),
  );
  const development = parseDevelopmentPayload(unwrapData(raw));
  return {
    development: development
      ? { ...development, id: development.id || developmentId }
      : null,
    message: envelopeMessage(raw, "Success."),
  };
}

export async function postDevelopment(
  input: DevelopmentWriteInput,
): Promise<{ development: Development; message: string }> {
  const hasFiles = Boolean(input.imageFiles?.length);
  const raw = hasFiles
    ? await apiFormRequest<ApiEnvelope<unknown>>(endpoints.developments.create, {
        method: "POST",
        formData: buildDevelopmentFormData(input),
      })
    : await apiRequest<ApiEnvelope<unknown>>(endpoints.developments.create, {
        method: "POST",
        body: developmentWriteBody(input),
      });
  const message = envelopeMessage(raw, "Created.");
  const fromApi = parseDevelopmentPayload(unwrapData(raw));
  const developmentId = str(fromApi?.id || input.id);
  if (!developmentId) {
    throw new ApiError(
      message || "Create succeeded but no development id was returned.",
      0,
    );
  }
  const refreshed = hasFiles
    ? (await fetchDevelopment(developmentId)).development
    : fromApi;
  return {
    development: mergeSavedDevelopment(developmentId, input, refreshed ?? fromApi),
    message,
  };
}

export async function putDevelopment(
  developmentId: string,
  input: DevelopmentWriteInput,
): Promise<{ development: Development; message: string }> {
  const hasFiles = Boolean(input.imageFiles?.length);
  const raw = hasFiles
    ? await apiFormRequest<ApiEnvelope<unknown>>(
        endpoints.developments.one(developmentId),
        {
          method: "PUT",
          formData: buildDevelopmentFormData(input),
        },
      )
    : await apiRequest<ApiEnvelope<unknown>>(
        endpoints.developments.one(developmentId),
        {
          method: "PUT",
          body: developmentWriteBody(input),
        },
      );
  const message = envelopeMessage(raw, "Updated.");
  const fromApi = parseDevelopmentPayload(unwrapData(raw));
  const refreshed = hasFiles
    ? (await fetchDevelopment(developmentId)).development
    : fromApi;
  return {
    development: mergeSavedDevelopment(developmentId, input, refreshed ?? fromApi),
    message,
  };
}
