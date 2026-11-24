import type {
  AccountStatus,
  DocumentAsset,
  IntentLevel,
  InternalUser,
  Invitation,
  InvitationStatus,
  Investor,
  Note,
  PortfolioAssignPlanType,
  PortfolioAssignedUnit,
  PortfolioOwnership,
  ResidencyStatus,
  Role,
  SignUpStatus,
} from "@/models";
import { mapAdminToUser } from "@/services/authApi";

export type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
  errors?: unknown;
};

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isRole(value: string): value is Role {
  return value === "super_admin" || value === "agent" || value === "viewer";
}

function isAccountStatus(value: string): value is AccountStatus {
  return value === "active" || value === "inactive" || value === "pending";
}

function isResidency(value: string): value is ResidencyStatus {
  return value === "uk_resident" || value === "non_uk_resident" || value === "unknown";
}

function isIntent(value: string): value is IntentLevel {
  return value === "low" || value === "medium" || value === "high" || value === "urgent";
}

function isSignUp(value: string): value is SignUpStatus {
  return (
    value === "not_invited" ||
    value === "invited" ||
    value === "signed_up" ||
    value === "first_login"
  );
}

function isRisk(value: string): value is Investor["riskAppetite"] {
  return value === "cautious" || value === "balanced" || value === "growth";
}

function isInviteStatus(value: string): value is InvitationStatus {
  return [
    "created",
    "sent",
    "delivered",
    "opened",
    "accepted",
    "expired",
    "revoked",
  ].includes(value);
}

function isNoteKind(value: string): value is Note["kind"] {
  return value === "internal" || value === "agent" || value === "follow_up";
}

function asLocalRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Prefer `recommendedProperties` (sorted); fall back to `recommendedPropertyIds`. */
export function mapRecommendedPropertyIds(raw: Record<string, unknown>): string[] {
  const nested = raw.recommendedProperties ?? raw.recommended_properties;
  if (Array.isArray(nested) && nested.length > 0) {
    return nested
      .map((item) => {
        const row = asLocalRecord(item);
        return {
          id: str(row.id ?? row.propertyId ?? row.property_id),
          sortOrder: num(
            row.sortOrder ?? row.sort_order,
            Number.MAX_SAFE_INTEGER,
          ),
        };
      })
      .filter((row) => row.id)
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.id.localeCompare(b.id);
      })
      .map((row) => row.id);
  }
  const ids = raw.recommendedPropertyIds ?? raw.recommended_property_ids;
  if (Array.isArray(ids)) return ids.map((id) => str(id)).filter(Boolean);
  return [];
}

export function mapInvestor(raw: Record<string, unknown>): Investor {
  const residency = str(raw.residencyStatus, "unknown");
  const account = str(raw.accountStatus, "pending");
  const invite = raw.invitationStatus == null ? null : str(raw.invitationStatus);
  const signUp = str(raw.signUpStatus, "not_invited");
  const intent = str(raw.intentLevel, "low");
  const risk = str(raw.riskAppetite, "balanced");
  const agent = raw.assignedAgentId;

  return {
    id: str(raw.id),
    name: str(raw.name),
    firstName: str(raw.firstName),
    lastName: str(raw.lastName),
    email: str(raw.email),
    phone: str(raw.phone),
    country: str(raw.country, "United Kingdom"),
    nationality: str(raw.nationality, "British"),
    residencyStatus: isResidency(residency) ? residency : "unknown",
    assignedAgentId: agent == null || agent === "" ? null : str(agent),
    accountStatus: isAccountStatus(account) ? account : "pending",
    invitationStatus: invite && isInviteStatus(invite) ? invite : null,
    signUpStatus: isSignUp(signUp) ? signUp : "not_invited",
    intentLevel: isIntent(intent) ? intent : "low",
    ownedPropertyCount: num(
      raw.ownedPropertyCount ?? raw.propertiesOwned,
      0,
    ),
    lastActiveAt: raw.lastActiveAt == null ? null : str(raw.lastActiveAt),
    createdAt: str(raw.createdAt, new Date().toISOString()),
    investmentPreferences: str(raw.investmentPreferences),
    buyingPower: num(raw.buyingPower, 0),
    investmentHorizon: str(raw.investmentHorizon),
    riskAppetite: isRisk(risk) ? risk : "balanced",
    onboardingStatus: str(raw.onboardingStatus, "Created"),
    recommendedPropertyIds: mapRecommendedPropertyIds(raw),
  };
}

export function mapNote(raw: Record<string, unknown>): Note {
  const kind = str(raw.kind, "internal");
  const author =
    typeof raw.author === "object" && raw.author !== null
      ? (raw.author as Record<string, unknown>)
      : null;
  return {
    id: str(raw.id),
    investorId: str(raw.investorId ?? raw.investor_id),
    body: str(raw.body ?? raw.note ?? raw.content),
    authorId: str(raw.authorId ?? raw.author_id ?? author?.id),
    authorName: str(raw.authorName ?? raw.author_name ?? author?.name),
    kind: isNoteKind(kind) ? kind : "internal",
    createdAt: str(raw.createdAt ?? raw.created_at, new Date().toISOString()),
  };
}

export function mapInvitation(raw: Record<string, unknown>): Invitation {
  const status = str(raw.status, "sent");
  const agent = raw.assignedAgentId;
  const propertyIds = Array.isArray(raw.propertyIds)
    ? raw.propertyIds.map((id) => str(id))
    : [];
  const folderIds = Array.isArray(raw.folderIds)
    ? raw.folderIds.map((id) => str(id))
    : [];
  return {
    id: str(raw.id),
    investorId: str(raw.investorId),
    email: str(raw.email),
    name: str(raw.name),
    assignedAgentId: agent == null || agent === "" ? null : str(agent),
    propertyIds,
    recommendedPropertyIds: mapRecommendedPropertyIds(raw),
    folderIds,
    status: isInviteStatus(status) ? status : "sent",
    sentAt: raw.sentAt == null ? null : str(raw.sentAt),
    acceptedAt: raw.acceptedAt == null ? null : str(raw.acceptedAt),
    lastReminderAt: raw.lastReminderAt == null ? null : str(raw.lastReminderAt),
    expiresAt: str(raw.expiresAt),
    link: str(raw.link),
    createdAt: str(raw.createdAt, new Date().toISOString()),
  };
}

export function ownershipFromProperty(
  investorId: string,
  property: {
    id: string;
    purchasePrice?: number;
    currentValue?: number;
    loanBalance?: number;
    equity?: number;
    rentalEstimate?: number;
  },
  assignedPlanType?: PortfolioAssignPlanType | null,
): PortfolioOwnership {
  const purchaseValue = property.purchasePrice ?? 0;
  const currentValue = property.currentValue ?? purchaseValue;
  const useMortgage =
    assignedPlanType == null || assignedPlanType === "mortgage";
  const mortgageBalance = useMortgage ? (property.loanBalance ?? 0) : 0;
  return {
    id: `${investorId}:${property.id}`,
    investorId,
    propertyId: property.id,
    purchaseValue,
    currentValue,
    mortgageBalance,
    equity: property.equity ?? Math.max(0, currentValue - mortgageBalance),
    monthlyRent: property.rentalEstimate ?? 0,
    netCashFlow: 0,
    assignedPlanType: assignedPlanType ?? null,
    units: [],
  };
}

export function toApiAssignPlanType(
  plan?: PortfolioAssignPlanType | null,
): "developer_schedule" | "mortgage" | "cash" | undefined {
  if (!plan) return undefined;
  if (plan === "payment_schedule") return "developer_schedule";
  return plan;
}

export function fromApiAssignPlanType(
  plan: string | null | undefined,
): PortfolioAssignPlanType | null {
  if (!plan) return null;
  if (plan === "developer_schedule" || plan === "payment_schedule") {
    return "payment_schedule";
  }
  if (plan === "mortgage" || plan === "cash") return plan;
  return null;
}

function mapAssignedUnit(
  raw: Record<string, unknown>,
  fallbackIndex: number,
): PortfolioAssignedUnit {
  return {
    unitIndex: Math.max(0, num(raw.unitIndex ?? raw.unit_index, fallbackIndex)),
    type: str(raw.type ?? raw.propertyType, "Unit"),
    floor: str(raw.floor),
    bedrooms: num(raw.bedrooms),
    bathrooms: num(raw.bathrooms),
    sizeSqft: num(raw.sizeSqft ?? raw.size_sqft),
    quantity: Math.max(0, num(raw.quantity ?? raw.assignCount ?? raw.count, 1)),
    purchasePrice: num(raw.purchasePrice ?? raw.purchase_price),
    currentValue: num(raw.currentValue ?? raw.current_value),
    rentalEstimate: num(raw.rentalEstimate ?? raw.rental_estimate),
  };
}

export function mapOwnership(raw: Record<string, unknown>): PortfolioOwnership {
  const nested =
    raw.property && typeof raw.property === "object"
      ? (raw.property as Record<string, unknown>)
      : null;
  const propertyId = str(raw.propertyId ?? raw.property_id ?? nested?.id);
  const investorId = str(raw.investorId ?? raw.investor_id);
  const purchaseValue = num(
    raw.purchaseValue ?? nested?.purchasePrice ?? nested?.purchaseValue,
  );
  const currentValue = num(
    raw.currentValue ?? nested?.currentValue,
    purchaseValue,
  );
  const mortgageBalance = num(
    raw.mortgageBalance ?? nested?.loanBalance ?? nested?.mortgageBalance,
  );
  const units = asRecordArray(raw.units).map(mapAssignedUnit);
  const unitQty = units.reduce((sum, u) => sum + u.quantity, 0);
  return {
    id: str(raw.id, propertyId && investorId ? `${investorId}:${propertyId}` : ""),
    investorId,
    propertyId,
    propertyName: str(raw.propertyName ?? raw.property_name ?? nested?.name) || undefined,
    purchaseValue,
    currentValue,
    mortgageBalance,
    equity: num(
      raw.equity ?? nested?.equity,
      Math.max(0, currentValue - mortgageBalance),
    ),
    monthlyRent: num(raw.monthlyRent ?? nested?.rentalEstimate ?? nested?.monthlyRent),
    netCashFlow: num(raw.netCashFlow),
    assignedPlanType: fromApiAssignPlanType(
      str(
        raw.assignedPlanType ?? raw.planType ?? raw.plan_type ?? raw.assigned_plan_type,
      ),
    ),
    assignedPlanVariant: (() => {
      const mode = str(raw.planMode ?? raw.plan_mode ?? raw.assignedPlanVariant);
      if (mode === "default" || mode === "custom") return mode;
      return null;
    })(),
    assignedUnitCount: unitQty > 0 ? unitQty : (() => {
      const n = num(raw.assignedUnitCount ?? raw.quantity ?? raw.unitCount);
      return n > 0 ? n : null;
    })(),
    units,
  };
}

function isDocVisibility(value: string): value is DocumentAsset["visibility"] {
  return value === "investor" || value === "internal" || value === "both";
}

function formatFileSize(value: unknown): string {
  if (typeof value === "string" && value.trim() && !/^\d+$/.test(value.trim())) {
    return value;
  }
  const bytes = num(value, 0);
  if (bytes <= 0) return str(value, "—");
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mapDocument(raw: Record<string, unknown>): DocumentAsset {
  const visibility = str(raw.visibility, "both");
  return {
    id: str(raw.id),
    name: str(raw.name),
    folderId: raw.folderId == null || raw.folderId === "" ? null : str(raw.folderId),
    category: str(raw.category, "General"),
    investorId: raw.investorId == null || raw.investorId === "" ? null : str(raw.investorId),
    propertyId: raw.propertyId == null || raw.propertyId === "" ? null : str(raw.propertyId),
    developmentId:
      raw.developmentId == null || raw.developmentId === "" ? null : str(raw.developmentId),
    paymentMilestoneId:
      raw.paymentMilestoneId == null || raw.paymentMilestoneId === ""
        ? null
        : str(raw.paymentMilestoneId),
    fileType: str(raw.fileType, "file").toUpperCase(),
    size: formatFileSize(raw.size),
    url: raw.url == null || raw.url === "" ? null : str(raw.url),
    uploadedBy: str(raw.uploadedBy),
    uploadedAt: str(raw.uploadedAt, new Date().toISOString()),
    expiryDate: raw.expiryDate == null || raw.expiryDate === "" ? null : str(raw.expiryDate),
    version: num(raw.version, 1),
    visibility: isDocVisibility(visibility) ? visibility : "both",
    downloadCount: num(raw.downloadCount, 0),
    lastViewedAt:
      raw.lastViewedAt == null || raw.lastViewedAt === "" ? null : str(raw.lastViewedAt),
  };
}

export function mapUser(raw: Record<string, unknown>): InternalUser {
  return mapAdminToUser({
    id: raw.id as string | number,
    name: str(raw.name),
    email: str(raw.email),
    role: isRole(str(raw.role)) ? str(raw.role) : "viewer",
    status: str(raw.status, "active") as InternalUser["status"],
    assignedInvestorIds: Array.isArray(raw.assignedInvestorIds)
      ? (raw.assignedInvestorIds as Array<string | number>)
      : Array.isArray(raw.assigned_investor_ids)
        ? (raw.assigned_investor_ids as Array<string | number>)
        : [],
    lastLoginAt: (raw.lastLoginAt as string | null) ?? (raw.last_login_at as string | null) ?? null,
    invitationStatus:
      (raw.invitationStatus as InvitationStatus | null) ??
      (raw.invitation_status as InvitationStatus | null) ??
      null,
    createdAt: str(raw.createdAt ?? raw.created_at, new Date().toISOString()),
    calendlyUrl: str(raw.calendlyUrl ?? raw.calendlyurl ?? raw.calendly_url) || undefined,
    whatsappNumber:
      str(
        raw.whatsappNumber ??
          raw.whatsapp_number ??
          raw.whatsAppNumber ??
          raw.whatsapp,
      ) || undefined,
  });
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map(asRecord);
}
