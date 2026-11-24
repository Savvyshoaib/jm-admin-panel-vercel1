import { apiFormRequest, apiRequest, unwrapData } from "@/lib/apiClient";
import { endpoints } from "@/services/endpoints";
import {
  asRecord,
  asRecordArray,
  mapDocument,
  type ApiEnvelope,
} from "@/services/mappers";
import type { DocumentAsset, Folder } from "@/models";

function envelopeMessage(raw: ApiEnvelope<unknown>, fallback: string): string {
  return raw.message || fallback;
}

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

export function mapFolder(raw: Record<string, unknown>): Folder {
  return {
    id: str(raw.id),
    name: str(raw.name),
    parentId: raw.parentId == null || raw.parentId === "" ? null : str(raw.parentId),
    category: str(raw.category, "General"),
    investorId:
      raw.investorId == null || raw.investorId === "" ? null : str(raw.investorId),
    isTemplate: bool(raw.isTemplate ?? raw.is_template),
  };
}

export async function fetchFolders(investorId?: string | null): Promise<{
  items: Folder[];
  message: string;
}> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.documents.folders, {
    query: investorId ? { investorId } : undefined,
  });
  const data = unwrapData(raw);
  const rows = Array.isArray(data)
    ? asRecordArray(data)
    : asRecordArray(asRecord(data).items ?? asRecord(data).folders);
  return {
    items: rows.map(mapFolder).filter((f) => f.id),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function fetchInvestorDocuments(
  investorId: string,
): Promise<{ items: DocumentAsset[]; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.investors.documents(investorId),
  );
  return {
    items: asRecordArray(unwrapData(raw)).map(mapDocument),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function fetchDocuments(filters?: {
  investorId?: string;
  folderId?: string | null;
  propertyId?: string | null;
  developmentId?: string | null;
}): Promise<{ items: DocumentAsset[]; message: string }> {
  if (
    filters?.investorId &&
    !filters.folderId &&
    !filters.propertyId &&
    !filters.developmentId
  ) {
    return fetchInvestorDocuments(filters.investorId);
  }
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.documents.list, {
    query: {
      investorId: filters?.investorId,
      folderId: filters?.folderId ?? undefined,
      propertyId: filters?.propertyId ?? undefined,
      developmentId: filters?.developmentId ?? undefined,
    },
  });
  return {
    items: asRecordArray(unwrapData(raw)).map(mapDocument),
    message: envelopeMessage(raw, "Success."),
  };
}

function appendDocumentFields(
  formData: FormData,
  input: {
    name?: string;
    visibility?: DocumentAsset["visibility"];
    category?: string;
    folderId?: string | null;
    propertyId?: string | null;
    developmentId?: string | null;
    investorId?: string | null;
  },
  fileNameFallback = "",
) {
  formData.append(
    "name",
    (input.name?.trim() || fileNameFallback).trim() || "Document",
  );
  formData.append("visibility", input.visibility ?? "both");
  formData.append("category", (input.category ?? "others").trim() || "others");
  if (input.folderId) formData.append("folderId", input.folderId);
  if (input.propertyId) formData.append("propertyId", input.propertyId);
  if (input.developmentId) formData.append("developmentId", input.developmentId);
  if (input.investorId) formData.append("investorId", input.investorId);
}

export async function postInvestorDocument(
  investorId: string,
  input: {
    file: File;
    name?: string;
    visibility?: DocumentAsset["visibility"];
    category?: string;
    folderId?: string | null;
    propertyId?: string | null;
  },
): Promise<{ document: DocumentAsset; message: string }> {
  const formData = new FormData();
  formData.append("file", input.file);
  appendDocumentFields(formData, input, input.file.name);

  const raw = await apiFormRequest<ApiEnvelope<unknown>>(
    endpoints.investors.documents(investorId),
    { method: "POST", formData },
  );
  return {
    document: mapDocument(asRecord(unwrapData(raw))),
    message: envelopeMessage(raw, "Uploaded."),
  };
}

export async function deleteInvestorDocument(
  investorId: string,
  documentId: string,
): Promise<{ message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.investors.document(investorId, documentId),
    { method: "DELETE" },
  );
  return { message: envelopeMessage(raw, "Deleted.") };
}

export async function deleteDocument(
  documentId: string,
): Promise<{ message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.documents.one(documentId),
    { method: "DELETE" },
  );
  return { message: envelopeMessage(raw, "Deleted.") };
}

export async function postDocument(input: {
  file: File;
  name?: string;
  visibility?: DocumentAsset["visibility"];
  category?: string;
  folderId?: string | null;
  investorId?: string | null;
  propertyId?: string | null;
  developmentId?: string | null;
}): Promise<{ document: DocumentAsset; message: string }> {
  const formData = new FormData();
  formData.append("file", input.file);
  appendDocumentFields(formData, input, input.file.name);
  const raw = await apiFormRequest<ApiEnvelope<unknown>>(endpoints.documents.create, {
    method: "POST",
    formData,
  });
  return {
    document: mapDocument(asRecord(unwrapData(raw))),
    message: envelopeMessage(raw, "Uploaded."),
  };
}

export async function putDocument(
  documentId: string,
  input: {
    name?: string;
    visibility?: DocumentAsset["visibility"];
    category?: string;
    file?: File;
  },
): Promise<{ document: DocumentAsset; message: string }> {
  const formData = new FormData();
  if (input.file) formData.append("file", input.file);
  if (input.name) formData.append("name", input.name.trim());
  if (input.category) formData.append("category", input.category.trim());
  if (input.visibility) formData.append("visibility", input.visibility);
  const raw = await apiFormRequest<ApiEnvelope<unknown>>(
    endpoints.documents.one(documentId),
    { method: "PUT", formData },
  );
  return {
    document: mapDocument(asRecord(unwrapData(raw))),
    message: envelopeMessage(raw, "Updated."),
  };
}
