/**
 * Local mock Investors (+ ownership, notes, activity, invitations, docs, signals).
 * Persists to localStorage (`jm-admin-mock-investors-v4`) for FE testing across reloads.
 */
import { createClientId } from "@/lib/ids";
import type {
  ActivityEvent,
  DocumentAsset,
  IntentSignal,
  InvestorEngagement,
  Invitation,
  Investor,
  Note,
  AssignPropertyInput,
  PortfolioOwnership,
} from "@/models";
import { ownershipFromProperty } from "@/services/mappers";
import { getMockInvestorsSeed } from "@/services/mockData";
import {
  mockGetProperty,
  mockSetPropertyInvestor,
} from "@/services/mockInventory";

const STORAGE_KEY = "jm-admin-mock-investors-v4";

type InvestorsDb = {
  investors: Investor[];
  ownership: PortfolioOwnership[];
  notes: Note[];
  activity: ActivityEvent[];
  invitations: Invitation[];
  documents: DocumentAsset[];
  signals: IntentSignal[];
};

function nowIso() {
  return new Date().toISOString();
}

function delay<T>(value: T, ms = 160): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms);
  });
}

function seedDb(): InvestorsDb {
  return getMockInvestorsSeed();
}

function readDb(): InvestorsDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedDb();
      writeDb(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as InvestorsDb;
    if (!Array.isArray(parsed.investors)) {
      const seeded = seedDb();
      writeDb(seeded);
      return seeded;
    }
    return {
      investors: parsed.investors ?? [],
      ownership: parsed.ownership ?? [],
      notes: parsed.notes ?? [],
      activity: parsed.activity ?? [],
      invitations: parsed.invitations ?? [],
      documents: parsed.documents ?? [],
      signals: parsed.signals ?? [],
    };
  } catch {
    const seeded = seedDb();
    writeDb(seeded);
    return seeded;
  }
}

function writeDb(db: InvestorsDb) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function pushActivity(
  db: InvestorsDb,
  event: Omit<ActivityEvent, "id" | "timestamp"> & {
    id?: string;
    timestamp?: string;
  },
) {
  db.activity.unshift({
    id: event.id ?? createClientId(),
    investorId: event.investorId,
    type: event.type,
    title: event.title,
    detail: event.detail,
    propertyId: event.propertyId ?? null,
    developmentId: event.developmentId ?? null,
    timestamp: event.timestamp ?? nowIso(),
    metadata: event.metadata,
  });
}

function requireInvestor(investorId: string): Investor {
  const item = readDb().investors.find((i) => String(i.id) === String(investorId));
  if (!item) throw new Error(`Investor ${investorId} not found in mock store.`);
  return item;
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function mockListInvestors(): Promise<Investor[]> {
  return delay([...readDb().investors]);
}

export async function mockGetInvestor(
  investorId: string,
): Promise<Investor | undefined> {
  const item = readDb().investors.find((i) => String(i.id) === String(investorId));
  return delay(item);
}

export async function mockUpdateInvestor(
  investorId: string,
  patch: Partial<Investor>,
): Promise<Investor> {
  const db = readDb();
  const idx = db.investors.findIndex((i) => String(i.id) === String(investorId));
  if (idx < 0) throw new Error(`Investor ${investorId} not found in mock store.`);
  const current = db.investors[idx];
  const nextName = patch.name ?? current.name;
  const names = splitName(nextName);
  const next: Investor = {
    ...current,
    ...patch,
    id: current.id,
    name: nextName,
    firstName: patch.firstName ?? names.firstName,
    lastName: patch.lastName ?? names.lastName,
    lastActiveAt: nowIso(),
  };
  db.investors[idx] = next;
  pushActivity(db, {
    investorId: next.id,
    type: "profile",
    title: "Investor updated",
    detail: "Profile fields updated (mock).",
    propertyId: null,
    developmentId: null,
  });
  writeDb(db);
  return delay(next);
}

export async function mockSortInvestorRecommended(
  investorId: string,
  orderedIds: string[],
): Promise<Investor> {
  return mockUpdateInvestor(investorId, {
    recommendedPropertyIds: orderedIds.map(String),
  });
}

export async function mockDeleteInvestor(investorId: string): Promise<void> {
  const db = readDb();
  const idx = db.investors.findIndex((i) => String(i.id) === String(investorId));
  if (idx < 0) throw new Error(`Investor ${investorId} not found in mock store.`);
  const [removed] = db.investors.splice(idx, 1);
  pushActivity(db, {
    investorId: removed.id,
    type: "profile",
    title: "Investor deleted",
    detail: "Investor removed (mock).",
    propertyId: null,
    developmentId: null,
  });
  writeDb(db);
  return delay(undefined);
}

export async function mockCreateInvestor(input: {
  name: string;
  email: string;
  phone?: string;
  country?: string;
  nationality?: string;
  residencyStatus?: Investor["residencyStatus"];
  assignedAgentId?: string | null;
  accountStatus?: Investor["accountStatus"];
  invitationStatus?: Investor["invitationStatus"];
  propertiesOwned?: number;
  buyingPower?: number;
  riskAppetite?: Investor["riskAppetite"];
  recommendedPropertyIds?: string[];
}): Promise<Investor> {
  const db = readDb();
  const names = splitName(input.name);
  const investor: Investor = {
    id: createClientId(),
    name: input.name.trim() || input.email,
    firstName: names.firstName,
    lastName: names.lastName,
    email: input.email.trim(),
    phone: input.phone ?? "",
    country: input.country ?? "United Kingdom",
    nationality: input.nationality ?? "",
    residencyStatus: input.residencyStatus ?? "uk_resident",
    assignedAgentId: input.assignedAgentId ?? null,
    accountStatus: input.accountStatus ?? "pending",
    invitationStatus: input.invitationStatus ?? "sent",
    signUpStatus: "invited",
    intentLevel: "low",
    ownedPropertyCount: input.propertiesOwned ?? 0,
    lastActiveAt: null,
    createdAt: nowIso(),
    investmentPreferences: "",
    buyingPower: input.buyingPower ?? 0,
    investmentHorizon: "",
    riskAppetite: input.riskAppetite ?? "balanced",
    onboardingStatus: "invited",
    recommendedPropertyIds: input.recommendedPropertyIds ?? [],
  };
  db.investors.unshift(investor);
  pushActivity(db, {
    investorId: investor.id,
    type: "profile",
    title: "Investor created",
    detail: `Created ${investor.email} (mock).`,
    propertyId: null,
    developmentId: null,
  });
  writeDb(db);
  return delay(investor);
}

export async function mockListOwnership(
  investorId?: string,
): Promise<PortfolioOwnership[]> {
  const rows = readDb().ownership;
  const filtered = investorId
    ? rows.filter((o) => String(o.investorId) === String(investorId))
    : rows;
  return delay([...filtered]);
}

export async function mockAssignProperty(
  investorId: string,
  input: AssignPropertyInput,
): Promise<PortfolioOwnership> {
  requireInvestor(investorId);
  const propertyId = input.propertyId;
  const property = await mockGetProperty(propertyId);
  if (!property) {
    throw new Error(`Property ${propertyId} not found in mock inventory.`);
  }

  await mockSetPropertyInvestor(propertyId, investorId);

  const db = readDb();
  const qty = input.units?.reduce((sum, u) => sum + u.quantity, 0) ?? 1;
  const ownership: PortfolioOwnership = {
    ...ownershipFromProperty(investorId, property, input.planType),
    assignedPlanVariant: input.planMode ?? "default",
    assignedUnitCount: qty,
  };
  db.ownership = [
    ...db.ownership.filter((o) => String(o.propertyId) !== String(propertyId)),
    ownership,
  ];

  const invIdx = db.investors.findIndex((i) => String(i.id) === String(investorId));
  if (invIdx >= 0) {
    const ownedIds = new Set(
      db.ownership
        .filter((o) => String(o.investorId) === String(investorId))
        .map((o) => o.propertyId),
    );
    db.investors[invIdx] = {
      ...db.investors[invIdx],
      ownedPropertyCount: ownedIds.size,
      lastActiveAt: nowIso(),
    };
  }

  pushActivity(db, {
    investorId,
    type: "portfolio",
    title: "Property assigned",
    detail: input.planType
      ? `Assigned ${property.name} · plan: ${input.planType}`
      : `Assigned ${property.name}`,
    propertyId,
    developmentId: property.developmentId,
  });
  writeDb(db);
  return delay(ownership);
}

export async function mockUnassignUnits(
  investorId: string,
  propertyId: string,
  units: Array<{ unitIndex: number; quantity?: number }>,
): Promise<void> {
  const db = readDb();
  const idx = db.ownership.findIndex(
    (o) =>
      String(o.investorId) === String(investorId) &&
      String(o.propertyId) === String(propertyId),
  );
  if (idx < 0) return;

  const holding = db.ownership[idx];
  const removeAll = new Set(
    units.filter((u) => u.quantity == null).map((u) => u.unitIndex),
  );
  const reduceBy = new Map<number, number>();
  for (const u of units) {
    if (u.quantity == null) continue;
    reduceBy.set(u.unitIndex, (reduceBy.get(u.unitIndex) ?? 0) + u.quantity);
  }

  const nextUnits = (holding.units ?? [])
    .map((unit) => {
      if (removeAll.has(unit.unitIndex)) return { ...unit, quantity: 0 };
      const take = reduceBy.get(unit.unitIndex) ?? 0;
      return { ...unit, quantity: Math.max(0, unit.quantity - take) };
    })
    .filter((unit) => unit.quantity > 0);

  if (nextUnits.length === 0) {
    await mockUnassignProperty(investorId, propertyId);
    return;
  }

  db.ownership[idx] = {
    ...holding,
    units: nextUnits,
    assignedUnitCount: nextUnits.reduce((sum, u) => sum + u.quantity, 0),
  };
  writeDb(db);
  return delay(undefined);
}

export async function mockUnassignProperty(
  investorId: string,
  propertyId: string,
): Promise<void> {
  await mockSetPropertyInvestor(propertyId, null);
  const db = readDb();
  db.ownership = db.ownership.filter(
    (o) =>
      !(
        String(o.investorId) === String(investorId) &&
        String(o.propertyId) === String(propertyId)
      ),
  );
  const invIdx = db.investors.findIndex((i) => String(i.id) === String(investorId));
  if (invIdx >= 0) {
    const ownedIds = new Set(
      db.ownership
        .filter((o) => String(o.investorId) === String(investorId))
        .map((o) => o.propertyId),
    );
    db.investors[invIdx] = {
      ...db.investors[invIdx],
      ownedPropertyCount: ownedIds.size,
      lastActiveAt: nowIso(),
    };
  }
  pushActivity(db, {
    investorId,
    type: "portfolio",
    title: "Property removed",
    detail: `Removed property ${propertyId} from portfolio.`,
    propertyId,
    developmentId: null,
  });
  writeDb(db);
  await delay(undefined);
}

export async function mockListNotes(investorId: string): Promise<Note[]> {
  const items = readDb()
    .notes.filter((n) => String(n.investorId) === String(investorId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return delay(items);
}

export async function mockAddNote(
  investorId: string,
  input: { body: string; kind: Note["kind"] },
): Promise<{ note: Note; message: string }> {
  requireInvestor(investorId);
  const db = readDb();
  const note: Note = {
    id: createClientId(),
    investorId,
    body: input.body.trim(),
    authorId: "mock-admin",
    authorName: "Ops Admin",
    kind: input.kind,
    createdAt: nowIso(),
  };
  db.notes.unshift(note);
  pushActivity(db, {
    investorId,
    type: "note",
    title: "Note added",
    detail: input.body.trim().slice(0, 120),
    propertyId: null,
    developmentId: null,
  });
  writeDb(db);
  return delay({ note, message: "Note created." });
}

export async function mockListActivity(
  investorId?: string,
): Promise<ActivityEvent[]> {
  const rows = readDb().activity;
  const filtered = investorId
    ? rows.filter((a) => String(a.investorId) === String(investorId))
    : rows;
  return delay([...filtered]);
}

export async function mockListInvitations(): Promise<Invitation[]> {
  return delay([...readDb().invitations]);
}

export async function mockCreateInvitation(input: {
  name: string;
  email: string;
  assignedAgentId: string | null;
  propertyIds?: string[];
  recommendedPropertyIds?: string[];
  folderIds?: string[];
}): Promise<{ invitation: Invitation; investor: Investor }> {
  const created = await mockCreateInvestor({
    name: input.name,
    email: input.email,
    assignedAgentId: input.assignedAgentId,
    accountStatus: "pending",
    invitationStatus: "sent",
  });
  const investor = input.recommendedPropertyIds?.length
    ? await mockUpdateInvestor(created.id, {
        recommendedPropertyIds: input.recommendedPropertyIds,
      })
    : created;
  const db = readDb();
  const invitation: Invitation = {
    id: createClientId(),
    investorId: investor.id,
    email: investor.email,
    name: investor.name,
    assignedAgentId: input.assignedAgentId,
    propertyIds: input.propertyIds ?? [],
    folderIds: input.folderIds ?? [],
    status: "sent",
    sentAt: nowIso(),
    acceptedAt: null,
    lastReminderAt: null,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    link: `https://mock.josephmews.local/invite/${investor.id}`,
    createdAt: nowIso(),
  };
  db.invitations.unshift(invitation);
  writeDb(db);
  return delay({ invitation, investor });
}

export async function mockUpdateInvitation(
  invitationId: string,
  patch: Partial<Invitation>,
): Promise<Invitation> {
  const db = readDb();
  const idx = db.invitations.findIndex((i) => String(i.id) === String(invitationId));
  if (idx < 0) throw new Error(`Invitation ${invitationId} not found in mock store.`);
  const next = { ...db.invitations[idx], ...patch, id: db.invitations[idx].id };
  db.invitations[idx] = next;
  writeDb(db);
  return delay(next);
}

export async function mockListDocuments(filters?: {
  investorId?: string;
  folderId?: string | null;
}): Promise<DocumentAsset[]> {
  let rows = [...readDb().documents];
  if (filters?.investorId) {
    rows = rows.filter((d) => String(d.investorId) === String(filters.investorId));
  }
  if (filters?.folderId !== undefined) {
    rows = rows.filter((d) =>
      filters.folderId == null
        ? d.folderId == null
        : String(d.folderId) === String(filters.folderId),
    );
  }
  return delay(rows);
}

export async function mockUploadInvestorDocument(
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
  requireInvestor(investorId);
  const db = readDb();
  const document: DocumentAsset = {
    id: createClientId(),
    name: input.name?.trim() || input.file.name,
    folderId: input.folderId ?? null,
    category: input.category ?? "others",
    investorId,
    propertyId: input.propertyId ?? null,
    developmentId: null,
    paymentMilestoneId: null,
    fileType: input.file.type || "application/octet-stream",
    size: `${Math.max(1, Math.round(input.file.size / 1024))} KB`,
    url: URL.createObjectURL(input.file),
    uploadedBy: "Ops Admin",
    uploadedAt: nowIso(),
    expiryDate: null,
    version: 1,
    visibility: input.visibility ?? "both",
    downloadCount: 0,
    lastViewedAt: null,
  };
  db.documents.unshift(document);
  pushActivity(db, {
    investorId,
    type: "document",
    title: "Document uploaded",
    detail: document.name,
    propertyId: document.propertyId,
    developmentId: null,
  });
  writeDb(db);
  return delay({ document, message: "Document uploaded." });
}

export async function mockListSignals(): Promise<IntentSignal[]> {
  return delay([...readDb().signals]);
}

export async function mockUpdateSignal(
  signalId: string,
  patch: Partial<IntentSignal>,
): Promise<IntentSignal> {
  const db = readDb();
  const idx = db.signals.findIndex((s) => String(s.id) === String(signalId));
  if (idx < 0) throw new Error(`Signal ${signalId} not found in mock store.`);
  db.signals[idx] = { ...db.signals[idx], ...patch, id: db.signals[idx].id };
  writeDb(db);
  return delay(db.signals[idx]);
}

export async function mockGetInvestorEngagement(
  investorId: string,
): Promise<InvestorEngagement> {
  const db = readDb();
  const recent = db.activity
    .filter((event) => String(event.investorId) === String(investorId))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const signals = db.signals.filter(
    (signal) => String(signal.investorId) === String(investorId),
  );
  const propertyCounts = new Map<string, { name: string; count: number }>();
  for (const event of recent) {
    if (!event.propertyId) continue;
    const current = propertyCounts.get(event.propertyId) ?? {
      name: event.title,
      count: 0,
    };
    current.count += 1;
    propertyCounts.set(event.propertyId, current);
  }
  return delay({
    investorRef: investorId,
    screens: [
      { label: "Explore", visitCount: Math.max(4, recent.length) },
      { label: "Property", visitCount: Math.max(2, propertyCounts.size + 1) },
      {
        label: "Calculator",
        visitCount: recent.filter((e) => e.type === "calculator").length || 2,
      },
      { label: "Portfolio", visitCount: 2 },
    ],
    properties: [...propertyCounts.entries()].map(([id, row]) => ({
      propertyName: row.name || id,
      location: null,
      postcode: null,
      visitCount: row.count,
    })),
    calculatorSteps: [
      { step: "Goal", visitCount: 4 },
      { step: "Route", visitCount: 3 },
      { step: "Capital", visitCount: 2 },
      { step: "Finance", visitCount: 2 },
    ],
    totalEvents: recent.length + signals.length,
    recent,
    signals,
    insufficientActivity: false,
    reason: null,
    activityEventCount: recent.length,
  });
}

export function resetMockInvestors() {
  localStorage.removeItem(STORAGE_KEY);
}
