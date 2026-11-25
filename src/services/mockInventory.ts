/**
 * Local mock inventory for Developments + Properties.
 * Persists to localStorage (`jm-admin-mock-inventory-v6`) so FE testing survives reloads.
 */
import { createClientId } from "@/lib/ids";
import { compareSortOrder } from "@/lib/listOrder";
import type { Development, PropertyUnit } from "@/models";
import {
  mergeSavedDevelopment,
  type DevelopmentSortItem,
  type DevelopmentWriteInput,
} from "@/services/developmentsApi";
import { getMockInventorySeed } from "@/services/mockData";
import { USE_MOCK_DATA as USE_MOCK_INVENTORY } from "@/services/mockFlags";
import {
  propertyFromWriteInput,
  type PropertySortItem,
  type PropertyWriteInput,
} from "@/services/propertiesApi";

export { USE_MOCK_INVENTORY };

const STORAGE_KEY = "jm-admin-mock-inventory-v6";

type InventoryDb = {
  developments: Development[];
  properties: PropertyUnit[];
};

function nowIso() {
  return new Date().toISOString();
}

function seedDb(): InventoryDb {
  return getMockInventorySeed();
}

function readDb(): InventoryDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedDb();
      writeDb(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as InventoryDb;
    if (!Array.isArray(parsed.developments) || !Array.isArray(parsed.properties)) {
      const seeded = seedDb();
      writeDb(seeded);
      return seeded;
    }
    return parsed;
  } catch {
    const seeded = seedDb();
    writeDb(seeded);
    return seeded;
  }
}

function writeDb(db: InventoryDb) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function delay<T>(value: T, ms = 180): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms);
  });
}

function filesToObjectUrls(files?: File[]): string[] {
  if (!files?.length) return [];
  return files.map((file) => URL.createObjectURL(file));
}

function withSortOrder<T extends { sortOrder?: number }>(
  items: T[],
): T[] {
  return items.map((item, index) => ({
    ...item,
    sortOrder:
      typeof item.sortOrder === "number" && Number.isFinite(item.sortOrder)
        ? item.sortOrder
        : index + 1,
  }));
}

export async function mockListDevelopments(): Promise<Development[]> {
  return delay(
    withSortOrder([...readDb().developments]).sort(compareSortOrder),
  );
}

export async function mockGetDevelopment(
  developmentId: string,
): Promise<Development | undefined> {
  const item = readDb().developments.find(
    (d) => String(d.id) === String(developmentId),
  );
  return delay(item);
}

export async function mockSaveDevelopment(
  input: DevelopmentWriteInput,
): Promise<Development> {
  const db = readDb();
  const id = String(input.id || createClientId());
  const existingKeep =
    input.existingImages?.filter((u) => u && !u.startsWith("blob:")) ??
    (input.image && !String(input.image).startsWith("blob:")
      ? [input.image]
      : []);
  const uploaded = filesToObjectUrls(input.imageFiles);
  const images = [...existingKeep, ...uploaded];
  const saved = mergeSavedDevelopment(id, {
    ...input,
    image: images[0] ?? "",
    images,
  }, null);
  saved.image = images[0] ?? "";
  saved.images = images;
  saved.updatedAt = nowIso();
  saved.updatedBy = "mock";

  const idx = db.developments.findIndex((d) => String(d.id) === id);
  if (idx >= 0) {
    saved.sortOrder = db.developments[idx].sortOrder ?? idx + 1;
    db.developments[idx] = saved;
  } else {
    const maxOrder = db.developments.reduce(
      (max, d) => Math.max(max, d.sortOrder ?? 0),
      0,
    );
    saved.sortOrder = maxOrder + 1;
    db.developments.push(saved);
  }
  writeDb(db);
  return delay(saved);
}

export async function mockSortDevelopments(
  items: DevelopmentSortItem[],
): Promise<Development[]> {
  const db = readDb();
  const orderById = new Map(
    items.map((item) => [String(item.id), item.sortOrder]),
  );
  db.developments = withSortOrder(db.developments)
    .map((d) =>
      orderById.has(String(d.id))
        ? { ...d, sortOrder: orderById.get(String(d.id))! }
        : d,
    )
    .sort(compareSortOrder);
  writeDb(db);
  return delay([...db.developments]);
}

export async function mockListProperties(): Promise<PropertyUnit[]> {
  return delay(
    withSortOrder([...readDb().properties]).sort(compareSortOrder),
  );
}

export async function mockGetProperty(
  propertyId: string,
): Promise<PropertyUnit | undefined> {
  const item = readDb().properties.find(
    (p) => String(p.id) === String(propertyId),
  );
  return delay(item);
}

export async function mockSaveProperty(
  input: PropertyWriteInput,
): Promise<PropertyUnit> {
  const db = readDb();
  const id = String(input.id || createClientId());
  const existingKeep =
    input.existingImages?.filter((u) => u && !u.startsWith("blob:")) ??
    (input.images ?? []).filter((u) => u && !u.startsWith("blob:"));
  const uploaded = filesToObjectUrls(
    input.imageFiles?.length
      ? input.imageFiles
      : input.imageFile
        ? [input.imageFile]
        : [],
  );
  const images = [...existingKeep, ...uploaded];
  const saved = propertyFromWriteInput(id, {
    ...input,
    images,
    image: images[0] ?? "",
  });
  saved.updatedAt = nowIso();
  saved.updatedBy = "mock";

  const idx = db.properties.findIndex((p) => String(p.id) === id);
  if (idx >= 0) {
    saved.sortOrder = db.properties[idx].sortOrder ?? idx + 1;
    db.properties[idx] = saved;
  } else {
    const maxOrder = db.properties.reduce(
      (max, p) => Math.max(max, p.sortOrder ?? 0),
      0,
    );
    saved.sortOrder = maxOrder + 1;
    db.properties.push(saved);
  }
  writeDb(db);
  return delay(saved);
}

export async function mockSortProperties(
  items: PropertySortItem[],
): Promise<PropertyUnit[]> {
  const db = readDb();
  const orderById = new Map(
    items.map((item) => [String(item.id), item.sortOrder]),
  );
  db.properties = withSortOrder(db.properties)
    .map((p) =>
      orderById.has(String(p.id))
        ? { ...p, sortOrder: orderById.get(String(p.id))! }
        : p,
    )
    .sort(compareSortOrder);
  writeDb(db);
  return delay([...db.properties]);
}

function requireProperty(propertyId: string): PropertyUnit {
  const item = readDb().properties.find(
    (p) => String(p.id) === String(propertyId),
  );
  if (!item) {
    throw new Error(`Property ${propertyId} not found in mock inventory.`);
  }
  return item;
}

function patchProperty(
  propertyId: string,
  patch: Partial<PropertyUnit>,
): PropertyUnit {
  const db = readDb();
  const idx = db.properties.findIndex((p) => String(p.id) === String(propertyId));
  if (idx < 0) {
    throw new Error(`Property ${propertyId} not found in mock inventory.`);
  }
  const next = {
    ...db.properties[idx],
    ...patch,
    id: String(propertyId),
    updatedAt: nowIso(),
    updatedBy: "mock",
  };
  db.properties[idx] = next;
  writeDb(db);
  return next;
}

/** Assign / clear investor link on a mock property without a full form rewrite. */
export async function mockSetPropertyInvestor(
  propertyId: string,
  investorId: string | null,
): Promise<PropertyUnit> {
  return delay(patchProperty(propertyId, { assignedInvestorId: investorId }));
}

export async function mockPublishProperty(
  propertyId: string,
): Promise<PropertyUnit> {
  return delay(
    patchProperty(propertyId, {
      status: "available",
      visibleInExplore: true,
    }),
  );
}

export async function mockUnpublishProperty(
  propertyId: string,
): Promise<PropertyUnit> {
  return delay(
    patchProperty(propertyId, {
      visibleInExplore: false,
    }),
  );
}

export async function mockArchiveProperty(
  propertyId: string,
): Promise<PropertyUnit> {
  return delay(patchProperty(propertyId, { status: "archived" }));
}

export async function mockUnarchiveProperty(
  propertyId: string,
): Promise<PropertyUnit> {
  return delay(patchProperty(propertyId, { status: "draft" }));
}

export async function mockDuplicateProperty(
  propertyId: string,
): Promise<PropertyUnit> {
  const source = requireProperty(propertyId);
  const copy: PropertyUnit = {
    ...source,
    id: createClientId(),
    reference: `${source.reference}-COPY`,
    name: `${source.name} (copy)`,
    status: "draft",
    visibleInExplore: false,
    assignedInvestorId: null,
    updatedAt: nowIso(),
    updatedBy: "mock",
  };
  const db = readDb();
  db.properties.unshift(copy);
  writeDb(db);
  return delay(copy);
}

export function resetMockInventory() {
  localStorage.removeItem(STORAGE_KEY);
}
