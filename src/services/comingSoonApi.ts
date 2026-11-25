import { ApiError, apiRequest, unwrapData } from "@/lib/apiClient";
import { createClientId } from "@/lib/ids";
import type { ComingSoonCard, ComingSoonSection } from "@/models";
import { deleteContentRequest, postContent } from "@/services/contentApi";
import { endpoints } from "@/services/endpoints";
import { asRecord, asRecordArray, type ApiEnvelope } from "@/services/mappers";
import { USE_MOCK_DATA } from "@/services/mockFlags";
import { mockGetComingSoon, mockSaveComingSoon } from "@/services/mockOps";

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

export function emptyComingSoon(): ComingSoonSection {
  return {
    title: "Coming soon",
    description: "",
    published: false,
    cards: [],
  };
}

function mapCard(raw: Record<string, unknown>): ComingSoonCard {
  const status = str(raw.status, "coming_soon").trim() || "coming_soon";
  return {
    name: str(raw.name).trim(),
    city: str(raw.city).trim(),
    region: str(raw.region).trim(),
    description: str(raw.description).trim(),
    expectedFrom: str(raw.expectedFrom ?? raw.expected_from).trim(),
    image: str(raw.image).trim(),
    buttonLabel: str(raw.buttonLabel ?? raw.button_label).trim(),
    status,
  };
}

export function mapComingSoon(raw: Record<string, unknown>): ComingSoonSection {
  const cardsRaw = raw.cards ?? raw.items;
  return {
    title: str(raw.title).trim(),
    description: str(raw.description).trim(),
    published: bool(raw.published, false),
    cards: asRecordArray(cardsRaw).map(mapCard),
  };
}

function toPayload(section: ComingSoonSection): ComingSoonSection {
  return {
    title: section.title.trim(),
    description: section.description.trim(),
    published: section.published,
    cards: section.cards.map((card) => ({
      name: card.name.trim(),
      city: card.city.trim(),
      region: card.region.trim(),
      description: card.description.trim(),
      expectedFrom: card.expectedFrom.trim(),
      image: card.image.trim(),
      buttonLabel: card.buttonLabel.trim(),
      status: card.status.trim() || "coming_soon",
    })),
  };
}

/** Read the full section, including unpublished cards. 404 means nothing saved yet. */
export async function fetchComingSoon(): Promise<ComingSoonSection> {
  if (USE_MOCK_DATA) return mockGetComingSoon();
  try {
    const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.explore.comingSoon);
    const data = unwrapData<unknown>(raw);
    if (data == null) return emptyComingSoon();
    return mapComingSoon(asRecord(data));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return emptyComingSoon();
    throw err;
  }
}

/**
 * Coming soon stores an image path, not a file. Upload through content media,
 * keep the stored file, and drop the temporary content row.
 * Delete content keeps the file on disk.
 */
export async function uploadComingSoonImage(file: File): Promise<string> {
  if (USE_MOCK_DATA) return URL.createObjectURL(file);
  const created = await postContent({
    key: `coming-soon-${createClientId()}`,
    title: "Coming soon image",
    area: "general",
    body: "",
    status: "draft",
    imageFiles: [file],
  });
  const path = created.content.images[0]?.path?.trim() ?? "";
  if (created.content.id) {
    try {
      await deleteContentRequest(created.content.id);
    } catch {
      // The stored file is what the card needs. A leftover draft is secondary.
    }
  }
  if (!path) {
    throw new ApiError("Image upload did not return a stored path.");
  }
  return path;
}

/**
 * Replace the entire section. POST and PUT both replace cards; omitted cards
 * are removed. There is no DELETE endpoint. PUT is the update.
 */
export async function saveComingSoon(
  section: ComingSoonSection,
): Promise<{ section: ComingSoonSection; message: string }> {
  if (USE_MOCK_DATA) {
    const sectionSaved = await mockSaveComingSoon(section);
    return { section: sectionSaved, message: "Saved." };
  }
  const body = toPayload(section);
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.explore.comingSoon, {
    method: "PUT",
    body,
  });
  const data = unwrapData<unknown>(raw);
  const saved =
    data && typeof data === "object" ? mapComingSoon(asRecord(data)) : body;
  return {
    section: saved.title || saved.cards.length ? saved : body,
    message: raw.message || "Saved.",
  };
}
