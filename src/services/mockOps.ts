/**
 * Mock ops data for screens not covered by inventory/investors mocks:
 * users, enquiries, payments, assumptions, content, settings, audit, rules, folders, dashboard.
 */
import { createClientId } from "@/lib/ids";
import type {
  Assumption,
  AssumptionVersion,
  AuditRecord,
  ComingSoonSection,
  ContentBlock,
  ContentMediaAsset,
  DashboardStats,
  Enquiry,
  Folder,
  InternalUser,
  PaymentSchedule,
  PlatformSettings,
  Role,
  SignalRule,
  UkhpiLog,
} from "@/models";
import type {
  CalculatorDefaultsPayload,
  PropertyInsightPreset,
} from "@/services/assumptionsApi";
import type { ContentWriteInput } from "@/services/contentApi";
import type { EnquiryPatchInput } from "@/services/enquiriesApi";
import { getMockOpsSeed } from "@/services/mockData";
import { mockListActivity, mockListDocuments, mockListInvitations, mockListInvestors, mockListSignals } from "@/services/mockInvestors";
import { mockListDevelopments, mockListProperties } from "@/services/mockInventory";

const STORAGE_KEY = "jm-admin-mock-ops-v3";

type OpsDb = {
  users: InternalUser[];
  enquiries: Enquiry[];
  payments: PaymentSchedule[];
  assumptions: Assumption[];
  assumptionVersions: AssumptionVersion[];
  content: ContentBlock[];
  settings: PlatformSettings;
  audit: AuditRecord[];
  rules: SignalRule[];
  folders: Folder[];
  ukhpiLogs: UkhpiLog[];
  comingSoon: ComingSoonSection;
  calculatorDefaults: CalculatorDefaultsPayload;
  insightPreset: PropertyInsightPreset;
};

function nowIso() {
  return new Date().toISOString();
}

function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms);
  });
}

function seedDb(): OpsDb {
  return getMockOpsSeed();
}

function readDb(): OpsDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedDb();
      writeDb(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as OpsDb;
    if (!Array.isArray(parsed.users)) {
      const seeded = seedDb();
      writeDb(seeded);
      return seeded;
    }
    return {
      ...seedDb(),
      ...parsed,
      users: parsed.users ?? [],
      enquiries: parsed.enquiries ?? [],
      payments: parsed.payments ?? [],
      assumptions: parsed.assumptions ?? [],
      assumptionVersions: parsed.assumptionVersions ?? [],
      content: parsed.content ?? [],
      settings: parsed.settings ?? seedDb().settings,
      audit: parsed.audit ?? [],
      rules: parsed.rules ?? [],
      folders: parsed.folders ?? [],
      ukhpiLogs: parsed.ukhpiLogs ?? seedDb().ukhpiLogs,
      comingSoon: parsed.comingSoon ?? seedDb().comingSoon,
      calculatorDefaults: parsed.calculatorDefaults ?? seedDb().calculatorDefaults,
      insightPreset: parsed.insightPreset ?? seedDb().insightPreset,
    };
  } catch {
    const seeded = seedDb();
    writeDb(seeded);
    return seeded;
  }
}

function writeDb(db: OpsDb) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function pushAudit(
  db: OpsDb,
  partial: Omit<AuditRecord, "id" | "timestamp" | "ip"> & { ip?: string | null },
) {
  db.audit.unshift({
    id: createClientId(),
    timestamp: nowIso(),
    ip: partial.ip ?? "127.0.0.1",
    ...partial,
  });
}

export async function mockListUsers(): Promise<InternalUser[]> {
  return delay([...readDb().users]);
}

export async function mockListAgents(): Promise<InternalUser[]> {
  const agents = readDb().users.filter((u) => u.role === "agent" || u.role === "super_admin");
  return delay(agents);
}

export async function mockUpdateUser(
  userId: string,
  patch: Partial<InternalUser>,
): Promise<InternalUser> {
  const db = readDb();
  const idx = db.users.findIndex((u) => String(u.id) === String(userId));
  if (idx < 0) throw new Error(`User ${userId} not found.`);
  db.users[idx] = { ...db.users[idx], ...patch, id: db.users[idx].id };
  pushAudit(db, {
    userId: "user-mock-admin",
    userName: "Ops Admin",
    action: "update",
    entityType: "user",
    entityId: userId,
    previousValue: null,
    newValue: JSON.stringify(patch),
  });
  writeDb(db);
  return delay(db.users[idx]);
}

export async function mockInviteUser(input: {
  name: string;
  email: string;
  role: Role;
  calendlyUrl?: string;
  whatsappNumber?: string;
}): Promise<InternalUser> {
  const db = readDb();
  const user: InternalUser = {
    id: createClientId(),
    name: input.name,
    email: input.email,
    role: input.role,
    status: "invited",
    assignedInvestorIds: [],
    lastLoginAt: null,
    invitationStatus: "sent",
    createdAt: nowIso(),
    calendlyUrl: input.calendlyUrl?.trim() || undefined,
    whatsappNumber: input.whatsappNumber?.trim() || undefined,
  };
  db.users.unshift(user);
  pushAudit(db, {
    userId: "user-mock-admin",
    userName: "Ops Admin",
    action: "invite",
    entityType: "user",
    entityId: user.id,
    previousValue: null,
    newValue: user.email,
  });
  writeDb(db);
  return delay(user);
}

export async function mockResendUserInvite(userId: string): Promise<string> {
  const db = readDb();
  const user = db.users.find((u) => String(u.id) === String(userId));
  if (!user) throw new Error(`User ${userId} not found in mock store.`);
  if (user.status !== "invited") {
    throw new Error("Only invited users can receive a resent invitation.");
  }
  user.invitationStatus = "sent";
  pushAudit(db, {
    userId: "user-mock-admin",
    userName: "Ops Admin",
    action: "invite_resend",
    entityType: "user",
    entityId: user.id,
    previousValue: null,
    newValue: user.email,
  });
  writeDb(db);
  return delay("Invitation resent.");
}

export async function mockListEnquiries(): Promise<Enquiry[]> {
  return delay([...readDb().enquiries]);
}

export async function mockUpdateEnquiry(
  enquiryId: string,
  patch: EnquiryPatchInput,
): Promise<Enquiry> {
  const db = readDb();
  const idx = db.enquiries.findIndex((e) => String(e.id) === String(enquiryId));
  if (idx < 0) throw new Error(`Enquiry ${enquiryId} not found.`);
  db.enquiries[idx] = { ...db.enquiries[idx], ...patch, id: db.enquiries[idx].id };
  writeDb(db);
  return delay(db.enquiries[idx]);
}

export async function mockDeleteEnquiry(enquiryId: string): Promise<void> {
  const db = readDb();
  const idx = db.enquiries.findIndex((e) => String(e.id) === String(enquiryId));
  if (idx < 0) throw new Error(`Enquiry ${enquiryId} not found.`);
  db.enquiries.splice(idx, 1);
  writeDb(db);
  return delay(undefined);
}

export async function mockListPayments(): Promise<PaymentSchedule[]> {
  return delay([...readDb().payments]);
}

export async function mockSavePayment(input: PaymentSchedule): Promise<PaymentSchedule> {
  const db = readDb();
  const next: PaymentSchedule = {
    ...input,
    id: input.id || createClientId(),
    updatedAt: nowIso(),
  };
  const idx = db.payments.findIndex((p) => String(p.id) === String(next.id));
  if (idx >= 0) db.payments[idx] = next;
  else db.payments.unshift(next);
  writeDb(db);
  return delay(next);
}

export async function mockListAssumptions(): Promise<Assumption[]> {
  return delay([...readDb().assumptions]);
}

export async function mockListAssumptionVersions(
  assumptionId?: string,
): Promise<AssumptionVersion[]> {
  const rows = readDb().assumptionVersions.filter(
    (v) => !assumptionId || String(v.assumptionId) === String(assumptionId),
  );
  return delay(rows);
}

export async function mockUpdateAssumption(
  assumptionId: string,
  value: number,
  note: string,
  extras?: { sourceNote?: string; effectiveDate?: string },
): Promise<Assumption> {
  const db = readDb();
  const idx = db.assumptions.findIndex((a) => String(a.id) === String(assumptionId));
  if (idx < 0) throw new Error(`Assumption ${assumptionId} not found.`);
  const prev = db.assumptions[idx];
  const next: Assumption = {
    ...prev,
    value,
    sourceNote: extras?.sourceNote ?? note,
    effectiveDate: extras?.effectiveDate ?? prev.effectiveDate,
    updatedAt: nowIso(),
    updatedBy: "Ops Admin",
  };
  db.assumptions[idx] = next;
  db.assumptionVersions.unshift({
    id: createClientId(),
    assumptionId,
    previousValue: prev.value,
    newValue: value,
    changedAt: nowIso(),
    changedBy: "Ops Admin",
    note,
  });
  writeDb(db);
  return delay(next);
}

export async function mockListContent(): Promise<ContentBlock[]> {
  return delay(
    readDb().content.map((c) => ({
      ...c,
      documents: c.documents ?? [],
      images: c.images ?? [],
      videos: c.videos ?? [],
    })),
  );
}

export async function mockSaveContent(input: ContentWriteInput): Promise<ContentBlock> {
  const db = readDb();
  const toAsset = (
    file: File,
    folder: "docs" | "images" | "videos",
    i: number,
  ): ContentMediaAsset => {
    const ext = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase()
      : "";
    const path = `mock/content/${folder}/${Date.now()}-${i}-${file.name}`;
    return {
      path,
      url: `/storage/${path}`,
      name: file.name,
      fileType: ext,
      size: file.size,
    };
  };
  const newDocs = (input.documentFiles ?? []).map((f, i) => toAsset(f, "docs", i));
  const newImages = (input.imageFiles ?? []).map((f, i) => toAsset(f, "images", i));
  const newVideos = (input.videoFiles ?? []).map((f, i) => toAsset(f, "videos", i));
  const keepAsAssets = (
    keep: string[] | undefined,
    prev: ContentMediaAsset[] | undefined,
  ): ContentMediaAsset[] => {
    if (keep === undefined) return prev ?? [];
    const byPath = new Map((prev ?? []).map((a) => [a.path, a]));
    return keep.map(
      (path) =>
        byPath.get(path) ?? {
          path,
          url: `/storage/${path}`,
          name: path.split("/").pop() || path,
          fileType: path.includes(".")
            ? path.slice(path.lastIndexOf(".") + 1).toLowerCase()
            : "",
          size: 0,
        },
    );
  };
  if (input.id) {
    const idx = db.content.findIndex((c) => String(c.id) === String(input.id));
    if (idx < 0) throw new Error(`Content ${input.id} not found.`);
    const prev = db.content[idx];
    db.content[idx] = {
      ...prev,
      key: input.key,
      title: input.title,
      area: input.area ?? prev.area,
      body: input.body ?? prev.body,
      status: input.status ?? prev.status,
      propertyId:
        input.propertyId !== undefined
          ? input.propertyId
            ? String(input.propertyId)
            : null
          : prev.propertyId ?? null,
      documents: [
        ...keepAsAssets(input.keepDocuments, prev.documents),
        ...newDocs,
      ],
      images: [...keepAsAssets(input.keepImages, prev.images), ...newImages],
      videos: [...keepAsAssets(input.keepVideos, prev.videos), ...newVideos],
      updatedAt: nowIso(),
      updatedBy: "Ops Admin",
    };
    writeDb(db);
    return delay(db.content[idx]);
  }
  const created: ContentBlock = {
    id: createClientId(),
    key: input.key,
    title: input.title,
    area: input.area ?? "general",
    body: input.body ?? "",
    status: input.status ?? "draft",
    propertyId: input.propertyId ? String(input.propertyId) : null,
    documents: newDocs,
    images: newImages,
    videos: newVideos,
    updatedAt: nowIso(),
    updatedBy: "Ops Admin",
  };
  db.content.unshift(created);
  writeDb(db);
  return delay(created);
}

export async function mockDeleteContent(contentId: string): Promise<void> {
  const db = readDb();
  db.content = db.content.filter((c) => String(c.id) !== String(contentId));
  writeDb(db);
  await delay(undefined);
}

export async function mockGetSettings(): Promise<PlatformSettings> {
  return delay({ ...readDb().settings });
}

export async function mockUpdateSettings(
  patch: Partial<PlatformSettings>,
): Promise<PlatformSettings> {
  const db = readDb();
  db.settings = { ...db.settings, ...patch };
  writeDb(db);
  return delay({ ...db.settings });
}

export async function mockListAudit(): Promise<AuditRecord[]> {
  return delay([...readDb().audit]);
}

export async function mockListRules(): Promise<SignalRule[]> {
  return delay([...readDb().rules]);
}

export async function mockUpdateRule(
  ruleId: string,
  patch: Partial<SignalRule>,
): Promise<SignalRule> {
  const db = readDb();
  const idx = db.rules.findIndex((r) => String(r.id) === String(ruleId));
  if (idx < 0) throw new Error(`Rule ${ruleId} not found.`);
  db.rules[idx] = { ...db.rules[idx], ...patch, id: db.rules[idx].id };
  writeDb(db);
  return delay(db.rules[idx]);
}

export async function mockListFolders(investorId?: string | null): Promise<Folder[]> {
  const rows = readDb().folders.filter((f) => {
    if (investorId == null || investorId === "") return true;
    return f.investorId == null || String(f.investorId) === String(investorId);
  });
  return delay(rows);
}

export async function mockSaveDocument(input: {
  name: string;
} & Partial<import("@/models").DocumentAsset>): Promise<import("@/models").DocumentAsset> {
  const { mockUploadInvestorDocument } = await import("@/services/mockInvestors");
  const investorId = input.investorId || "inv-mock-raheel8";
  const blob = new Blob([`Mock document: ${input.name}`], { type: "text/plain" });
  const file = new File([blob], input.name.endsWith(".txt") ? input.name : `${input.name}.txt`, {
    type: "text/plain",
  });
  const { document } = await mockUploadInvestorDocument(investorId, {
    file,
    name: input.name,
    visibility: input.visibility,
    category: input.category,
    folderId: input.folderId,
    propertyId: input.propertyId,
  });
  return document;
}

export async function mockGetDashboardStats(): Promise<DashboardStats> {
  const [investors, properties, developments, enquiries, signals, activity, docs, invites, payments] =
    await Promise.all([
      mockListInvestors(),
      mockListProperties(),
      mockListDevelopments(),
      mockListEnquiries(),
      mockListSignals(),
      mockListActivity(),
      mockListDocuments(),
      mockListInvitations(),
      mockListPayments(),
    ]);

  const openEnquiries = enquiries.filter(
    (e) =>
      e.status === "new" ||
      e.status === "assigned" ||
      e.status === "contacted" ||
      e.status === "in_progress",
  );

  const stats: DashboardStats = {
    totalInvestors: investors.length,
    invitedUsers: investors.filter(
      (i) => i.signUpStatus === "invited" || i.invitationStatus === "sent",
    ).length,
    signedUpUsers: investors.filter((i) => i.signUpStatus === "signed_up").length,
    pendingInvitations: invites.filter(
      (i) => i.status === "created" || i.status === "sent" || i.status === "delivered",
    ).length,
    activeProperties: properties.filter((p) => p.status !== "archived").length,
    activeDevelopments: developments.filter((d) => d.status !== "archived").length,
    openEnquiries: openEnquiries.length,
    highIntentInvestors: investors.filter(
      (i) => i.intentLevel === "high" || i.intentLevel === "urgent",
    ).length,
    upcomingPayments: payments.reduce(
      (n, p) => n + p.milestones.filter((m) => m.status === "upcoming" || m.status === "due").length,
      0,
    ),
    recentDocuments: docs.slice(0, 5),
    highPrioritySignals: signals
      .filter((s) => s.intentLevel === "high" || s.intentLevel === "urgent" || s.status === "new")
      .slice(0, 5),
    recentActivity: activity.slice(0, 8),
    newEnquiries: openEnquiries.slice(0, 5),
    recentInvites: invites.slice(0, 5),
    recentPriceUpdates: [...readDb().ukhpiLogs]
      .filter((log) => log.status.toLowerCase() !== "skipped")
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 5),
    recentProperties: [...properties]
      .sort(
        (a, b) =>
          Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || ""),
      )
      .slice(0, 5),
  };

  return delay(stats);
}

export async function mockListUkhpiLogs(): Promise<UkhpiLog[]> {
  return delay([...readDb().ukhpiLogs]);
}

export async function mockGetUkhpiLog(id: string): Promise<UkhpiLog | null> {
  const row = readDb().ukhpiLogs.find((log) => String(log.id) === String(id));
  return delay(row ?? null);
}

export async function mockGetComingSoon(): Promise<ComingSoonSection> {
  return delay(structuredClone(readDb().comingSoon));
}

export async function mockSaveComingSoon(
  section: ComingSoonSection,
): Promise<ComingSoonSection> {
  const db = readDb();
  db.comingSoon = structuredClone(section);
  writeDb(db);
  return delay(db.comingSoon);
}

export async function mockGetCalculatorDefaults(): Promise<CalculatorDefaultsPayload> {
  return delay(structuredClone(readDb().calculatorDefaults));
}

export async function mockSaveCalculatorDefaults(
  body: CalculatorDefaultsPayload,
): Promise<CalculatorDefaultsPayload> {
  const db = readDb();
  db.calculatorDefaults = structuredClone(body);
  writeDb(db);
  return delay(db.calculatorDefaults);
}

export async function mockGetInsightPreset(): Promise<PropertyInsightPreset> {
  return delay(structuredClone(readDb().insightPreset));
}

export async function mockSaveInsightPreset(
  preset: PropertyInsightPreset,
): Promise<PropertyInsightPreset> {
  const db = readDb();
  db.insightPreset = structuredClone(preset);
  writeDb(db);
  return delay(db.insightPreset);
}

export function resetMockOps() {
  localStorage.removeItem(STORAGE_KEY);
}
