/**
 * Single source of truth for FE mock seed data.
 * Edit `src/data/mockDemoSeed.ts` to change admin creds, inventory, investors, and ops seeds.
 * Runtime mutations still persist via localStorage in mock* services.
 */
import type {
  ActivityEvent,
  Assumption,
  AssumptionVersion,
  AuditRecord,
  ContentBlock,
  Development,
  DocumentAsset,
  Enquiry,
  Folder,
  IntentSignal,
  InternalUser,
  Invitation,
  Investor,
  Note,
  PaymentSchedule,
  PlatformSettings,
  PortfolioOwnership,
  PropertyUnit,
  SignalRule,
  UkhpiLog,
  ComingSoonSection,
} from "@/models";
import type {
  CalculatorDefaultsPayload,
  PropertyInsightPreset,
} from "@/services/assumptionsApi";
import { buildMockDemo } from "@/data/mockDemoSeed";

export type MockCredential = {
  email: string;
  password: string;
  userId: string;
};

export type MockInventorySeed = {
  developments: Development[];
  properties: PropertyUnit[];
};

export type MockInvestorsSeed = {
  investors: Investor[];
  ownership: PortfolioOwnership[];
  notes: Note[];
  activity: ActivityEvent[];
  invitations: Invitation[];
  documents: DocumentAsset[];
  signals: IntentSignal[];
};

export type MockOpsSeed = {
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

export type MockDataFile = {
  auth: { credentials: MockCredential[] };
  inventory: MockInventorySeed;
  investors: MockInvestorsSeed;
  ops: MockOpsSeed;
};

/** Immutable seed payload. Dates are anchored to when this module first loads. */
export const mockDataFile: MockDataFile = buildMockDemo();

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function getMockInventorySeed(): MockInventorySeed {
  return clone(mockDataFile.inventory);
}

export function getMockInvestorsSeed(): MockInvestorsSeed {
  return clone(mockDataFile.investors);
}

export function getMockOpsSeed(): MockOpsSeed {
  return clone(mockDataFile.ops);
}

export function getMockCredentials(): MockCredential[] {
  return clone(mockDataFile.auth.credentials);
}

export function findMockCredential(
  email: string,
  password: string,
): MockCredential | undefined {
  const normalized = email.trim().toLowerCase();
  return mockDataFile.auth.credentials.find(
    (c) => c.email.trim().toLowerCase() === normalized && c.password === password,
  );
}

export function findMockUserById(userId: string): InternalUser | undefined {
  const user = mockDataFile.ops.users.find((u) => String(u.id) === String(userId));
  return user ? clone(user) : undefined;
}

export function findMockUserByEmail(email: string): InternalUser | undefined {
  const normalized = email.trim().toLowerCase();
  const user = mockDataFile.ops.users.find(
    (u) => u.email.trim().toLowerCase() === normalized,
  );
  return user ? clone(user) : undefined;
}
