/**
 * Domain API surface.
 * `VITE_USE_MOCK_DATA=true` → local mock stores.
 * `VITE_USE_MOCK_DATA=false` → live JM Backend (no mock seed).
 */
import { ApiError, emptyList } from "@/lib/apiClient";
import { ownershipFromProperty } from "@/services/mappers";
import {
  deleteInvestorRequest,
  deleteUnassignProperty,
  deleteUnassignUnits,
  fetchInvestor,
  fetchInvestorNotes,
  fetchInvestors,
  fetchInvitations,
  fetchOwnership,
  patchInvitation,
  patchInvestor,
  postAssignProperty,
  postInvitation,
  postInvestor,
  postInvestorNote,
  putInvestorRecommendedSort,
} from "@/services/investorsApi";
import {
  deleteDocument,
  deleteInvestorDocument,
  fetchDocuments,
  fetchFolders,
  fetchInvestorDocuments,
  postDocument,
  postInvestorDocument,
  putDocument,
} from "@/services/documentsApi";
import {
  deletePropertyImages,
  fetchProperties,
  fetchProperty,
  postArchiveProperty,
  postDuplicateProperty,
  postProperty,
  postPublishProperty,
  postUnarchiveProperty,
  postUnpublishProperty,
  putProperty,
  putPropertiesSort,
  type PropertySortItem,
  type PropertyWriteInput,
} from "@/services/propertiesApi";
import {
  fetchAgents,
  fetchUsers,
  inviteUserRequest,
  patchUser,
  resendUserInviteRequest,
} from "@/services/usersApi";
import { fetchAudit, type ActivityListQuery } from "@/services/activityApi";
import { fetchSettings, putSettings } from "@/services/settingsApi";
import {
  applyInsightPresetToUnit,
  fetchAssumptions,
  fetchAssumptionVersions,
  fetchCalculatorDefaults,
  fetchPropertyInsightPreset,
  invalidatePropertyInsightPreset,
  patchAssumption,
  putCalculatorDefaults,
  putPropertyInsightPreset,
  type CalculatorDefaultsPayload,
  type PropertyInsightPreset,
} from "@/services/assumptionsApi";
import {
  fetchContent,
  fetchContentOne,
  postContent,
  putContent,
  deleteContentRequest,
  type ContentWriteInput,
} from "@/services/contentApi";
import {
  deleteEnquiryRequest,
  fetchEnquiries,
  patchEnquiry,
  type EnquiryPatchInput,
} from "@/services/enquiriesApi";
import { fetchPayments, postPayment, putPayment } from "@/services/paymentsApi";
import { fetchUkhpiLog, fetchUkhpiLogs } from "@/services/ukhpiApi";
import {
  fetchCalculatorFlows,
  fetchDefaultCalculatorFlow,
  putDefaultCalculatorFlow,
  putCalculatorFlow,
} from "@/services/calculatorFlowsApi";
import {
  fetchDevelopment,
  fetchDevelopments,
  postDevelopment,
  putDevelopment,
  putDevelopmentsSort,
  type DevelopmentSortItem,
  type DevelopmentWriteInput,
} from "@/services/developmentsApi";
import { USE_MOCK_DATA } from "@/services/mockFlags";
import {
  mockArchiveProperty,
  mockDuplicateProperty,
  mockGetDevelopment,
  mockGetProperty,
  mockListDevelopments,
  mockListProperties,
  mockPublishProperty,
  mockSaveDevelopment,
  mockSaveProperty,
  mockSortDevelopments,
  mockSortProperties,
  mockUnarchiveProperty,
  mockUnpublishProperty,
} from "@/services/mockInventory";
import {
  mockAddNote,
  mockAssignProperty,
  mockCreateInvitation,
  mockCreateInvestor,
  mockDeleteInvestor,
  mockGetInvestor,
  mockGetInvestorEngagement,
  mockListActivity,
  mockListDocuments,
  mockListInvitations,
  mockListInvestors,
  mockListNotes,
  mockListOwnership,
  mockListSignals,
  mockUnassignProperty,
  mockUnassignUnits,
  mockUpdateInvitation,
  mockSortInvestorRecommended,
  mockUpdateInvestor,
  mockUpdateSignal,
  mockUploadInvestorDocument,
} from "@/services/mockInvestors";
import {
  mockGetCalculatorDefaults,
  mockGetDashboardStats,
  mockGetInsightPreset,
  mockGetSettings,
  mockGetUkhpiLog,
  mockInviteUser,
  mockListUkhpiLogs,
  mockResendUserInvite,
  mockListAgents,
  mockListAssumptionVersions,
  mockListAssumptions,
  mockListAudit,
  mockListContent,
  mockListEnquiries,
  mockListFolders,
  mockListPayments,
  mockListRules,
  mockListUsers,
  mockDeleteContent,
  mockDeleteEnquiry,
  mockSaveCalculatorDefaults,
  mockSaveContent,
  mockSaveDocument,
  mockSaveInsightPreset,
  mockSavePayment,
  mockUpdateAssumption,
  mockUpdateEnquiry,
  mockUpdateRule,
  mockUpdateSettings,
  mockUpdateUser,
} from "@/services/mockOps";
import { fetchDashboardStats } from "@/services/dashboardApi";
import {
  emptyInvestorEngagement,
  fetchQikoActivity,
  fetchQikoInvestorEngagement,
  fetchQikoSignals,
  postQikoPortfolioInsight,
  postQikoPropertyInsight,
} from "@/services/qikoApi";
import {
  fetchSignalRules,
  patchSignal,
  patchSignalRule,
  type SignalListQuery,
} from "@/services/signalsApi";
import type {
  Assumption,
  AssumptionVersion,
  ActivityEvent,
  AuditRecord,
  ContentBlock,
  DashboardStats,
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
  AssignPropertyInput,
  InvestorEngagement,
  PortfolioInsightCard,
  PortfolioOwnership,
  PropertyUnit,
  Role,
  SignalRule,
  UkhpiLog,
} from "@/models";

export async function listUsers(): Promise<InternalUser[]> {
  if (USE_MOCK_DATA) return mockListUsers();
  const { items } = await fetchUsers();
  return items;
}

export async function listAgents(): Promise<InternalUser[]> {
  if (USE_MOCK_DATA) return mockListAgents();
  // Prefer /admin/agents, then merge agents + super_admins from /admin/users
  // so assignment dropdowns always include both roles.
  const [{ items: agents }, usersResult] = await Promise.all([
    fetchAgents(),
    fetchUsers().catch(() => ({ items: [] as InternalUser[] })),
  ]);
  const byId = new Map<string, InternalUser>();
  for (const user of agents) byId.set(String(user.id), user);
  for (const user of usersResult.items) {
    if (user.role !== "agent" && user.role !== "super_admin") continue;
    byId.set(String(user.id), user);
  }
  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export async function updateUser(
  userId: string,
  patch: Partial<InternalUser>,
): Promise<InternalUser> {
  if (USE_MOCK_DATA) return mockUpdateUser(userId, patch);
  const { user } = await patchUser(userId, patch);
  return user;
}

export async function inviteUser(input: {
  name: string;
  email: string;
  role: Role;
  calendlyUrl?: string;
  whatsappNumber?: string;
}): Promise<InternalUser> {
  if (USE_MOCK_DATA) return mockInviteUser(input);
  const { user } = await inviteUserRequest(input);
  return user;
}

export async function resendUserInvite(userId: string): Promise<string> {
  if (USE_MOCK_DATA) return mockResendUserInvite(userId);
  const { message } = await resendUserInviteRequest(userId);
  return message;
}

export async function listInvestors(_opts?: {
  role?: Role;
  userId?: string;
}): Promise<Investor[]> {
  if (USE_MOCK_DATA) return mockListInvestors();
  const { items } = await fetchInvestors();
  return items;
}

export async function getInvestor(investorId: string): Promise<Investor | undefined> {
  if (USE_MOCK_DATA) return mockGetInvestor(investorId);
  const { investor } = await fetchInvestor(investorId);
  return investor ?? undefined;
}

export async function updateInvestor(
  investorId: string,
  patch: Partial<Investor>,
): Promise<Investor> {
  if (USE_MOCK_DATA) return mockUpdateInvestor(investorId, patch);
  const { investor } = await patchInvestor(investorId, patch);
  return investor;
}

/** PUT /admin/investors/{id}/recommended-properties/sort */
export async function sortInvestorRecommendedProperties(
  investorId: string,
  orderedIds: string[],
): Promise<Investor> {
  if (USE_MOCK_DATA) {
    return mockSortInvestorRecommended(investorId, orderedIds);
  }
  const { investor } = await putInvestorRecommendedSort(investorId, orderedIds);
  if (investor) return investor;
  const refreshed = await getInvestor(investorId);
  if (!refreshed) {
    throw new ApiError("Unable to load investor after saving recommendation order.", 404);
  }
  return {
    ...refreshed,
    recommendedPropertyIds: orderedIds,
  };
}

export async function deleteInvestor(investorId: string): Promise<void> {
  if (USE_MOCK_DATA) {
    await mockDeleteInvestor(investorId);
    return;
  }
  await deleteInvestorRequest(investorId);
}

export async function createInvestor(input: {
  name: string;
  email: string;
  phone?: string;
  country?: string;
  nationality?: string;
  residencyStatus?: Investor["residencyStatus"];
  assignedAgentId?: string | null;
  accountStatus?: Investor["accountStatus"];
  invitationStatus?: Investor["invitationStatus"];
  intentLevel?: Investor["intentLevel"];
  investmentHorizon?: string;
  propertiesOwned?: number;
  buyingPower?: number;
  riskAppetite?: Investor["riskAppetite"];
  recommendedPropertyIds?: string[];
}): Promise<Investor> {
  if (USE_MOCK_DATA) return mockCreateInvestor(input);
  const { investor } = await postInvestor(input);
  return investor;
}

export async function listInvitations(): Promise<Invitation[]> {
  if (USE_MOCK_DATA) return mockListInvitations();
  const { items } = await fetchInvitations();
  return items;
}

export async function createInvitation(input: {
  name: string;
  email: string;
  assignedAgentId: string | null;
  propertyIds?: string[];
  recommendedPropertyIds?: string[];
  folderIds?: string[];
}): Promise<{ invitation: Invitation; investor: Investor }> {
  if (USE_MOCK_DATA) return mockCreateInvitation(input);
  const { invitation, investor } = await postInvitation(input);
  return { invitation, investor };
}

export async function updateInvitation(
  invitationId: string,
  patch: Partial<Invitation>,
): Promise<Invitation> {
  if (USE_MOCK_DATA) return mockUpdateInvitation(invitationId, patch);
  const { invitation } = await patchInvitation(invitationId, patch);
  return invitation;
}

export async function listDevelopments(): Promise<Development[]> {
  if (USE_MOCK_DATA) return mockListDevelopments();
  const { items } = await fetchDevelopments();
  return items;
}

export async function sortDevelopments(
  items: DevelopmentSortItem[],
): Promise<Development[]> {
  if (USE_MOCK_DATA) return mockSortDevelopments(items);
  const { items: next } = await putDevelopmentsSort(items);
  if (next.length) return next;
  return listDevelopments();
}

export async function getDevelopment(
  developmentId: string,
): Promise<Development | undefined> {
  if (USE_MOCK_DATA) return mockGetDevelopment(developmentId);
  const { development } = await fetchDevelopment(developmentId);
  return development ?? undefined;
}

export async function saveDevelopment(
  input: DevelopmentWriteInput,
): Promise<Development> {
  if (USE_MOCK_DATA) return mockSaveDevelopment(input);
  if (input.id) {
    const { development } = await putDevelopment(String(input.id), input);
    return development;
  }
  const { development } = await postDevelopment(input);
  return development;
}

/** Shared location/content fields edited on a property also live on the development. */
export type DevelopmentPropertySharedFields = {
  address: string;
  city: string;
  region: string;
  postcode: string;
  locationInfo: string;
  highlights: string[];
  amenities: string[];
  completionDate: string;
};

/**
 * PUT /admin/developments/:id with property-edited location/content fields.
 * Keeps development identity, commercial, status, and images.
 */
export async function syncDevelopmentFromProperty(
  developmentId: string,
  fields: DevelopmentPropertySharedFields,
): Promise<Development> {
  const current = await getDevelopment(developmentId);
  if (!current) {
    throw new ApiError("Selected development was not found.", 404);
  }
  const gallery =
    current.images?.length > 0
      ? current.images
      : current.image
        ? [current.image]
        : [];
  return saveDevelopment({
    ...current,
    id: current.id,
    name: current.name,
    existingImages: gallery,
    address: fields.address,
    city: fields.city,
    region: fields.region,
    postcode: fields.postcode,
    locationInfo: fields.locationInfo,
    highlights: fields.highlights,
    amenities: fields.amenities,
    completionDate: fields.completionDate,
  });
}

export async function listProperties(): Promise<PropertyUnit[]> {
  if (USE_MOCK_DATA) return mockListProperties();
  const { items } = await fetchProperties();
  return items;
}

export async function sortProperties(
  items: PropertySortItem[],
): Promise<PropertyUnit[]> {
  if (USE_MOCK_DATA) return mockSortProperties(items);
  const { items: next } = await putPropertiesSort(items);
  if (next.length) return next;
  return listProperties();
}

export async function listUkhpiLogs(): Promise<UkhpiLog[]> {
  if (USE_MOCK_DATA) return mockListUkhpiLogs();
  const { items } = await fetchUkhpiLogs();
  return items;
}

export async function getUkhpiLog(id: string): Promise<UkhpiLog | null> {
  if (USE_MOCK_DATA) return mockGetUkhpiLog(id);
  const { item } = await fetchUkhpiLog(id);
  return item;
}

export async function getProperty(propertyId: string): Promise<PropertyUnit | undefined> {
  if (USE_MOCK_DATA) return mockGetProperty(propertyId);
  const { property } = await fetchProperty(propertyId);
  return property ?? undefined;
}

export async function saveProperty(
  input: PropertyWriteInput,
): Promise<PropertyUnit> {
  if (USE_MOCK_DATA) return mockSaveProperty(input);
  if (input.id) {
    const { property } = await putProperty(String(input.id), input);
    return property;
  }
  const { property } = await postProperty(input);
  return property;
}

export async function removePropertyImages(
  propertyId: string,
  images: string[],
): Promise<void> {

  if (USE_MOCK_DATA) {
    // Mock store: images are only kept on the client property payload.
    return;
  }

  await deletePropertyImages(propertyId, images);
}

async function resolvePropertyAction(
  propertyId: string,
  result: { property: PropertyUnit | null; message: string },
): Promise<{ property: PropertyUnit; message: string }> {
  if (result.property) return { property: result.property, message: result.message };
  const property = await getProperty(propertyId);
  if (!property) {
    throw new ApiError(
      result.message || "Property action succeeded but no property was returned.",
      0,
    );
  }
  return { property, message: result.message };
}

export async function publishProperty(propertyId: string): Promise<PropertyUnit> {
  if (USE_MOCK_DATA) return mockPublishProperty(propertyId);
  const result = await postPublishProperty(propertyId);
  const { property } = await resolvePropertyAction(propertyId, result);
  return property;
}

export async function unpublishProperty(propertyId: string): Promise<PropertyUnit> {
  if (USE_MOCK_DATA) return mockUnpublishProperty(propertyId);
  const result = await postUnpublishProperty(propertyId);
  const { property } = await resolvePropertyAction(propertyId, result);
  return property;
}

export async function duplicateProperty(propertyId: string): Promise<PropertyUnit> {
  if (USE_MOCK_DATA) return mockDuplicateProperty(propertyId);
  const result = await postDuplicateProperty(propertyId);
  if (result.property) return result.property;
  throw new ApiError(
    result.message || "Duplicate succeeded but no property was returned.",
    0,
  );
}

export async function archiveProperty(propertyId: string): Promise<PropertyUnit> {
  if (USE_MOCK_DATA) return mockArchiveProperty(propertyId);
  const result = await postArchiveProperty(propertyId);
  const { property } = await resolvePropertyAction(propertyId, result);
  return property;
}

export async function unarchiveProperty(propertyId: string): Promise<PropertyUnit> {
  if (USE_MOCK_DATA) return mockUnarchiveProperty(propertyId);
  const result = await postUnarchiveProperty(propertyId);
  const { property } = await resolvePropertyAction(propertyId, result);
  return property;
}

export async function listOwnership(investorId?: string): Promise<PortfolioOwnership[]> {
  if (USE_MOCK_DATA) return mockListOwnership(investorId);

  // Source of truth: GET /admin/ownership. Empty array means no holdings — do not
  // invent rows from /admin/properties (that looked like "cached" portfolio data).
  const { items } = await fetchOwnership(investorId);
  return items;
}

export async function assignPropertyToInvestor(
  investorId: string,
  input: AssignPropertyInput,
): Promise<PortfolioOwnership> {
  if (USE_MOCK_DATA) {
    return mockAssignProperty(investorId, input);
  }

  const { ownership } = await postAssignProperty(investorId, input);
  if (ownership.purchaseValue || ownership.currentValue) {
    return {
      ...ownership,
      assignedPlanType: ownership.assignedPlanType ?? input.planType ?? null,
      assignedPlanVariant:
        ownership.assignedPlanVariant ?? input.planMode ?? null,
    };
  }

  try {
    const property = await getProperty(input.propertyId);
    if (property) {
      return {
        ...ownershipFromProperty(investorId, property, input.planType),
        id: ownership.id || `${investorId}:${input.propertyId}`,
        assignedPlanVariant: input.planMode ?? null,
        assignedUnitCount:
          ownership.assignedUnitCount ??
          input.units?.reduce((sum, u) => sum + u.quantity, 0) ??
          null,
      };
    }
  } catch {
    // Keep assign result even if property enrich fails.
  }
  return {
    ...ownership,
    assignedPlanType: ownership.assignedPlanType ?? input.planType ?? null,
    assignedPlanVariant: ownership.assignedPlanVariant ?? input.planMode ?? null,
  };
}

export async function removeUnitsFromInvestor(
  investorId: string,
  propertyId: string,
  units: Array<{ unitIndex: number; quantity?: number }>,
): Promise<void> {
  if (USE_MOCK_DATA) {
    await mockUnassignUnits(investorId, propertyId, units);
    return;
  }
  await deleteUnassignUnits(investorId, propertyId, units);
}

export async function removePropertyFromInvestor(
  investorId: string,
  propertyId: string,
): Promise<void> {
  if (USE_MOCK_DATA) {
    await mockUnassignProperty(investorId, propertyId);
    return;
  }
  await deleteUnassignProperty(investorId, propertyId);
}

export async function listEnquiries(_opts?: {
  role?: Role;
  userId?: string;
}): Promise<Enquiry[]> {
  if (USE_MOCK_DATA) return mockListEnquiries();
  const { items } = await fetchEnquiries();
  return items;
}

export async function updateEnquiry(
  enquiryId: string,
  patch: EnquiryPatchInput,
): Promise<Enquiry> {
  if (USE_MOCK_DATA) return mockUpdateEnquiry(enquiryId, patch);
  const { enquiry } = await patchEnquiry(enquiryId, patch);
  return enquiry;
}

export async function deleteEnquiry(enquiryId: string): Promise<void> {
  if (USE_MOCK_DATA) {
    await mockDeleteEnquiry(enquiryId);
    return;
  }
  await deleteEnquiryRequest(enquiryId);
}

export async function listNotes(investorId?: string): Promise<Note[]> {
  if (!investorId) return emptyList();
  if (USE_MOCK_DATA) return mockListNotes(investorId);
  const { items } = await fetchInvestorNotes(investorId);
  return items;
}

export async function addNote(input: {
  investorId: string;
  body: string;
  kind: Note["kind"];
}): Promise<{ note: Note; message: string }> {
  if (USE_MOCK_DATA) {
    return mockAddNote(input.investorId, {
      body: input.body,
      kind: input.kind,
    });
  }
  return postInvestorNote(input.investorId, {
    body: input.body,
    kind: input.kind,
  });
}

export async function listFolders(investorId?: string | null): Promise<Folder[]> {
  if (USE_MOCK_DATA) return mockListFolders(investorId);
  const { items } = await fetchFolders(investorId);
  return items;
}

export async function listDocuments(filters?: {
  investorId?: string;
  folderId?: string | null;
}): Promise<DocumentAsset[]> {
  if (USE_MOCK_DATA) return mockListDocuments(filters);
  const { items } = await fetchDocuments(filters);
  return items;
}

export async function listInvestorDocuments(investorId: string): Promise<DocumentAsset[]> {
  if (USE_MOCK_DATA) return mockListDocuments({ investorId });
  const { items } = await fetchInvestorDocuments(investorId);
  return items;
}

export async function uploadInvestorDocument(
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
  if (USE_MOCK_DATA) return mockUploadInvestorDocument(investorId, input);
  return postInvestorDocument(investorId, input);
}

export async function saveDocument(
  input: Partial<DocumentAsset> & { name: string; file?: File },
): Promise<DocumentAsset> {
  if (USE_MOCK_DATA) return mockSaveDocument(input);
  if (input.file && !input.id) {
    const { document } = await postDocument({
      file: input.file,
      name: input.name,
      visibility: input.visibility,
      category: input.category,
      folderId: input.folderId,
      investorId: input.investorId,
      propertyId: input.propertyId,
      developmentId: input.developmentId,
    });
    return document;
  }
  if (input.id) {
    const { document } = await putDocument(input.id, {
      name: input.name,
      visibility: input.visibility,
      category: input.category,
      file: input.file,
    });
    return document;
  }
  throw new ApiError("Choose a file to upload.", 422);
}

export async function removeInvestorDocument(
  investorId: string,
  documentId: string,
): Promise<void> {
  if (USE_MOCK_DATA) return;
  await deleteInvestorDocument(investorId, documentId);
}

export async function removeDocument(documentId: string): Promise<string> {
  if (USE_MOCK_DATA) return "Deleted.";
  const { message } = await deleteDocument(documentId);
  return message;
}

export async function listPayments(_opts?: {
  role?: Role;
  userId?: string;
}): Promise<PaymentSchedule[]> {
  if (USE_MOCK_DATA) return mockListPayments();
  const { items } = await fetchPayments();
  return items;
}

export async function savePayment(
  input: PaymentSchedule,
): Promise<PaymentSchedule> {
  if (USE_MOCK_DATA) return mockSavePayment(input);
  if (input.id && /^\d+$/.test(String(input.id))) {
    const { payment } = await putPayment(String(input.id), input);
    return payment;
  }
  const { payment } = await postPayment(input);
  return payment;
}

export async function listAssumptions(): Promise<Assumption[]> {
  if (USE_MOCK_DATA) return mockListAssumptions();
  const { items } = await fetchAssumptions();
  return items;
}

export async function listAssumptionVersions(
  assumptionId?: string,
): Promise<AssumptionVersion[]> {
  if (!assumptionId) return emptyList();
  if (USE_MOCK_DATA) return mockListAssumptionVersions(assumptionId);
  const { items } = await fetchAssumptionVersions(assumptionId);
  return items;
}

export async function updateAssumption(
  assumptionId: string,
  value: number,
  note: string,
  extras?: { sourceNote?: string; effectiveDate?: string },
): Promise<Assumption> {
  if (USE_MOCK_DATA) {
    return mockUpdateAssumption(assumptionId, value, note, extras);
  }
  const { assumption } = await patchAssumption(assumptionId, {
    value,
    note,
    sourceNote: extras?.sourceNote,
    effectiveDate: extras?.effectiveDate,
  });
  return assumption;
}

export async function getCalculatorDefaults(): Promise<CalculatorDefaultsPayload | null> {
  if (USE_MOCK_DATA) return mockGetCalculatorDefaults();
  return fetchCalculatorDefaults();
}

export async function getPropertyInsightPreset(): Promise<PropertyInsightPreset | null> {
  if (USE_MOCK_DATA) return mockGetInsightPreset();
  return fetchPropertyInsightPreset();
}

export async function saveCalculatorDefaults(
  body: CalculatorDefaultsPayload,
): Promise<CalculatorDefaultsPayload> {
  if (USE_MOCK_DATA) return mockSaveCalculatorDefaults(body);
  return putCalculatorDefaults(body);
}

export async function savePropertyInsightPreset(
  body: Record<string, unknown>,
): Promise<PropertyInsightPreset> {
  if (USE_MOCK_DATA) {
    invalidatePropertyInsightPreset();
    return mockSaveInsightPreset(mapSavedInsight(body));
  }
  const saved = await putPropertyInsightPreset(body);
  invalidatePropertyInsightPreset();
  return saved;
}

function mapSavedInsight(body: Record<string, unknown>): PropertyInsightPreset {
  return {
    type: String(body.type ?? "1-bed"),
    bedrooms: Number(body.bedrooms) || 1,
    bathrooms: Number(body.bathrooms) || 1,
    sizeSqft: Number(body.sizeSqft) || 0,
    floor: String(body.floor ?? ""),
    numberOfUnits: Number(body.numberOfUnits) || 1,
    totalUnits: Number(body.totalUnits) || 0,
    purchasePrice: Number(body.purchasePrice) || 0,
    currentValue: Number(body.currentValue) || 0,
    rentalEstimate: Number(body.rentalEstimate) || 0,
    rentalIncomeMode: body.rentalIncomeMode === "current" ? "current" : "expected",
    purchaseDate: String(body.purchaseDate ?? ""),
    serviceCharge: Number(body.serviceCharge) || 0,
    groundRent: Number(body.groundRent) || 0,
    managementFee: Number(body.managementFee) || 0,
    grossYield: Number(body.grossYield) || 0,
    capitalGrowth: Number(body.capitalGrowth) || 0,
    annualRentalGrowth: Number(body.annualRentalGrowth) || 0,
    paymentPlanActive: Boolean(body.paymentPlanActive),
    paymentPlanName: String(body.paymentPlanName ?? ""),
    paymentPlanSummary: String(body.paymentPlanSummary ?? ""),
    mortgagePlanActive: Boolean(body.mortgagePlanActive),
    mortgagePlanName: String(body.mortgagePlanName ?? ""),
    mortgageType:
      body.mortgageType === "interest_only" ? "interest_only" : "repayment",
    interestRate: Number(body.interestRate) || 0,
    termYears: Number(body.termYears) || 25,
    deposit: Number(body.deposit) || 0,
    reservationFee: Number(body.reservationFee) || 0,
    loanAmount: Number(body.loanAmount) || 0,
    monthlyPayment: Number(body.monthlyPayment) || 0,
    ltvPct: Number(body.ltvPct) || 0,
  };
}

export { applyInsightPresetToUnit };

export async function listRules(): Promise<SignalRule[]> {
  if (USE_MOCK_DATA) return mockListRules();
  const { items } = await fetchSignalRules();
  return items;
}

export async function updateRule(
  ruleId: string,
  patch: Partial<SignalRule>,
): Promise<SignalRule> {
  if (USE_MOCK_DATA) return mockUpdateRule(ruleId, patch);
  const { rule } = await patchSignalRule(ruleId, patch);
  return rule;
}

export async function listSignals(
  opts?: SignalListQuery & { role?: Role; userId?: string; force?: boolean },
): Promise<IntentSignal[]> {
  if (USE_MOCK_DATA) return mockListSignals();
  const { items } = await fetchQikoSignals({
    q: opts?.q,
    strength: opts?.strength,
    investorRef: opts?.investorRef,
    limit: opts?.limit,
    offset: opts?.offset,
  });
  return items;
}

export async function updateSignal(
  signalId: string,
  patch: Partial<IntentSignal>,
): Promise<IntentSignal> {
  if (USE_MOCK_DATA) return mockUpdateSignal(signalId, patch);
  const { signal } = await patchSignal(signalId, {
    status: patch.status,
    agentNotes: patch.agentNotes,
    intentLevel: patch.intentLevel,
  });
  return signal;
}

function asActivityQuery(
  query?: string | (ActivityListQuery & { force?: boolean }),
): ActivityListQuery | undefined {
  if (query == null) return undefined;
  if (typeof query === "string") return { investorId: query };
  return query;
}

export async function listActivity(
  query?: string | (ActivityListQuery & { force?: boolean }),
): Promise<ActivityEvent[]> {
  const q = asActivityQuery(query);
  if (USE_MOCK_DATA) {
    return mockListActivity(q?.investorId ?? q?.investorRef);
  }
  const { items } = await fetchQikoActivity(q);
  return items;
}

export async function listAudit(): Promise<AuditRecord[]> {
  if (USE_MOCK_DATA) return mockListAudit();
  const { items } = await fetchAudit();
  return items;
}

export async function getSettings(): Promise<PlatformSettings> {
  if (USE_MOCK_DATA) return mockGetSettings();
  const { settings } = await fetchSettings();
  return settings;
}

export async function updateSettings(
  patch: Partial<PlatformSettings>,
): Promise<PlatformSettings> {
  if (USE_MOCK_DATA) return mockUpdateSettings(patch);
  const { settings } = await putSettings(patch);
  return settings;
}

export async function listContent(): Promise<ContentBlock[]> {
  if (USE_MOCK_DATA) return mockListContent();
  const { items } = await fetchContent();
  return items;
}

export async function getContent(contentId: string): Promise<ContentBlock | null> {
  if (USE_MOCK_DATA) {
    const items = await mockListContent();
    return items.find((c) => String(c.id) === String(contentId)) ?? null;
  }
  const { content } = await fetchContentOne(contentId);
  return content;
}

export async function saveContent(
  input: ContentWriteInput,
): Promise<ContentBlock> {
  if (USE_MOCK_DATA) return mockSaveContent(input);
  if (input.id) {
    const { content } = await putContent(String(input.id), input);
    try {
      const { content: fresh } = await fetchContentOne(String(input.id));
      if (fresh) return { ...content, ...fresh, id: fresh.id || content.id };
    } catch {
      /* keep put response */
    }
    return content;
  }
  const { content } = await postContent(input);
  if (content.id) {
    try {
      const { content: fresh } = await fetchContentOne(content.id);
      if (fresh) return { ...content, ...fresh, id: fresh.id || content.id };
    } catch {
      /* keep create response */
    }
  }
  return content;
}

export async function deleteContent(contentId: string): Promise<void> {
  if (USE_MOCK_DATA) {
    await mockDeleteContent(contentId);
    return;
  }
  await deleteContentRequest(contentId);
}

export async function getDashboardStats(_opts?: {
  role?: Role;
  userId?: string;
}): Promise<DashboardStats> {
  if (USE_MOCK_DATA) return mockGetDashboardStats();
  // Run core stats + overlays in parallel (avoid stats-then-overlays waterfall).
  // Qiko signals/activity overlays are skipped here — Dashboard analytics already
  // loads fuller signal/activity lists for charts, so duplicating those calls
  // only slowed first paint.
  const [statsResult, logs, properties] = await Promise.allSettled([
    fetchDashboardStats(),
    listUkhpiLogs(),
    listProperties(),
  ]);
  if (statsResult.status !== "fulfilled") {
    throw statsResult.reason;
  }
  const { stats } = statsResult.value;
  return {
    ...stats,
    recentPriceUpdates:
      logs.status === "fulfilled"
        ? pickRecentPriceUpdates(logs.value)
        : stats.recentPriceUpdates,
    recentProperties:
      properties.status === "fulfilled"
        ? pickRecentProperties(properties.value)
        : stats.recentProperties,
  };
}

function recencyMs(value: string | undefined): number {
  const t = Date.parse(value ?? "");
  return Number.isFinite(t) ? t : 0;
}

function pickRecentPriceUpdates(logs: UkhpiLog[]): UkhpiLog[] {
  return [...logs]
    .filter((log) => log.status.toLowerCase() !== "skipped")
    .sort((a, b) => recencyMs(b.createdAt) - recencyMs(a.createdAt))
    .slice(0, 5);
}

function pickRecentProperties(properties: PropertyUnit[]): PropertyUnit[] {
  return [...properties]
    .sort((a, b) => recencyMs(b.updatedAt) - recencyMs(a.updatedAt))
    .slice(0, 5);
}

export async function getInvestorEngagement(
  investorId: string,
): Promise<InvestorEngagement> {
  if (USE_MOCK_DATA) return mockGetInvestorEngagement(investorId);
  try {
    return await fetchQikoInvestorEngagement(investorId);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
      return emptyInvestorEngagement(investorId);
    }
    throw err;
  }
}

function asApiId(value: string | number): string | number {
  const raw = String(value).trim();
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw;
}

function roundMetric(value: number, digits = 1): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function splitInvestorName(
  name?: string,
  firstName?: string,
  lastName?: string,
): { firstName?: string; lastName?: string } {
  const first = firstName?.trim();
  const last = lastName?.trim();
  if (first || last) {
    return {
      ...(first ? { firstName: first } : {}),
      ...(last ? { lastName: last } : {}),
    };
  }
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  return {
    firstName: parts[0],
    ...(parts.length > 1 ? { lastName: parts.slice(1).join(" ") } : {}),
  };
}

function yieldPct(annualIncome: number, purchase: number): number {
  if (!(purchase > 0)) return 0;
  return roundMetric((annualIncome / purchase) * 100);
}

function growthPct(current: number, purchase: number): number {
  if (!(purchase > 0)) return 0;
  return roundMetric(((current - purchase) / purchase) * 100);
}

function propertyInsightMetrics(
  holding: PortfolioOwnership,
  property?: PropertyUnit,
): {
  name: string;
  grossYieldPct: number;
  capitalGrowthPct: number;
  netMonthly: number;
} {
  const assigned = (holding.units ?? []).find((u) => u.quantity > 0);
  const inventory =
    assigned && property?.units?.length
      ? property.units[assigned.unitIndex]
      : undefined;
  const qty = assigned?.quantity || holding.assignedUnitCount || 1;
  const purchase =
    holding.purchaseValue ||
    (assigned ? (assigned.purchasePrice || 0) * qty : 0) ||
    property?.purchasePrice ||
    0;
  const current =
    holding.currentValue ||
    (assigned
      ? (assigned.currentValue || assigned.purchasePrice || 0) * qty
      : 0) ||
    property?.currentValue ||
    purchase;
  const monthlyRent =
    holding.monthlyRent ||
    (assigned ? (assigned.rentalEstimate || 0) * qty : 0) ||
    property?.rentalEstimate ||
    0;
  const grossYieldPct =
    inventory?.projectedGrossYield ??
    property?.projectedGrossYield ??
    yieldPct(monthlyRent * 12, purchase);
  const capitalGrowthPct =
    inventory?.projectedCapitalGrowth ??
    property?.projectedCapitalGrowth ??
    growthPct(current, purchase);
  const netMonthly =
    holding.netCashFlow ||
    monthlyRent - (property?.monthlyMortgage ?? 0);
  return {
    name: property?.name || holding.propertyName || "Property",
    grossYieldPct: roundMetric(grossYieldPct),
    capitalGrowthPct: roundMetric(capitalGrowthPct),
    netMonthly: roundMetric(netMonthly),
  };
}

export async function generatePortfolioInsights(input: {
  investorId: string;
  investorName?: string;
  investorFirstName?: string;
  investorLastName?: string;
  holdings: PortfolioOwnership[];
  properties?: PropertyUnit[];
}): Promise<PortfolioInsightCard[]> {
  const investorNames = splitInvestorName(
    input.investorName,
    input.investorFirstName,
    input.investorLastName,
  );
  const properties = input.properties ?? [];
  const uniqueHoldings = [
    ...new Map(
      input.holdings
        .filter((h) => String(h.propertyId ?? "").trim())
        .map((h) => [String(h.propertyId), h]),
    ).values(),
  ];
  const metrics = uniqueHoldings.map((holding) => {
    const property = properties.find(
      (p) => String(p.id) === String(holding.propertyId),
    );
    return {
      holding,
      property,
      ...propertyInsightMetrics(holding, property),
    };
  });
  if (metrics.length === 0) return [];

  if (USE_MOCK_DATA) {
    const firstName =
      investorNames.firstName || input.investorName || "This investor";
    return metrics.slice(0, 4).map((row) => ({
      category: row.grossYieldPct >= 5 ? "Yield" : "Growth",
      metric: `${row.grossYieldPct}% gross · ${row.capitalGrowthPct}% growth`,
      headline: `${row.name} is carrying the portfolio`,
      evidence: `${firstName}'s holding shows ${row.grossYieldPct}% gross yield and about £${Math.round(row.netMonthly).toLocaleString("en-GB")} net a month.`,
      trend: row.capitalGrowthPct >= 3 ? "high" : "medium",
    }));
  }

  const platformAverages: Record<
    string,
    { growthPct3m: number; grossYieldPct: number }
  > = {};
  const buckets = new Map<string, { growth: number[]; yieldPct: number[] }>();
  for (const row of metrics) {
    const region = (row.property?.region || row.property?.city || "unknown")
      .trim()
      .toLowerCase();
    const key = region.includes("london")
      ? "london"
      : region.replace(/[\s-]+/g, "_") || "unknown";
    const bucket = buckets.get(key) ?? { growth: [], yieldPct: [] };
    bucket.growth.push(row.capitalGrowthPct);
    bucket.yieldPct.push(row.grossYieldPct);
    buckets.set(key, bucket);
  }
  for (const [key, bucket] of buckets) {
    const mean = (ns: number[]) =>
      ns.length
        ? roundMetric(ns.reduce((sum, n) => sum + n, 0) / ns.length)
        : 0;
    platformAverages[key] = {
      growthPct3m: mean(bucket.growth),
      grossYieldPct: mean(bucket.yieldPct),
    };
  }

  const meanYield = roundMetric(
    metrics.reduce((sum, row) => sum + row.grossYieldPct, 0) / metrics.length,
  );
  const meanGrowth = roundMetric(
    metrics.reduce((sum, row) => sum + row.capitalGrowthPct, 0) / metrics.length,
  );

  const payload = {
    requestId: crypto.randomUUID(),
    investor: {
      id: asApiId(input.investorId),
      ...investorNames,
    },
    properties: metrics.map((row) => ({
      propertyName: row.name,
      location: row.property?.city || row.property?.location || "",
      postcode: row.property?.postcode || "",
      region: row.property?.region || "",
      grossYieldPct: row.grossYieldPct,
      capitalGrowthPct: row.capitalGrowthPct,
      netMonthly: row.netMonthly,
      status: row.property?.status || "available",
    })),
    platformAverages,
  };

  const posted = await Promise.allSettled([
    postQikoPortfolioInsight(payload),
    ...metrics.map((row) =>
      postQikoPropertyInsight({
        requestId: crypto.randomUUID(),
        investor: {
          id: asApiId(input.investorId),
          ...investorNames,
        },
        property: {
          id: asApiId(row.holding.propertyId),
          name: row.name,
          grossYieldPct: row.grossYieldPct,
          capitalGrowthPct: row.capitalGrowthPct,
          netMonthly: row.netMonthly,
        },
        portfolioAverages: {
          grossYieldPct: meanYield,
          capitalGrowthPct: meanGrowth,
        },
        locale: "en-GB",
      }),
    ),
  ]);
  return posted.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
}

export {
  fetchCalculatorFlows,
  fetchDefaultCalculatorFlow,
  putDefaultCalculatorFlow,
  putCalculatorFlow,
};
