import { apiRequest, unwrapData } from "@/lib/apiClient";
import { toSortItems } from "@/lib/listOrder";
import { endpoints } from "@/services/endpoints";
import {
  asRecord,
  asRecordArray,
  mapInvitation,
  mapInvestor,
  mapNote,
  mapOwnership,
  toApiAssignPlanType,
  type ApiEnvelope,
} from "@/services/mappers";
import type {
  AssignPropertyInput,
  Invitation,
  Investor,
  Note,
  PortfolioOwnership,
} from "@/models";

function envelopeMessage(raw: ApiEnvelope<unknown>, fallback: string): string {
  return raw.message || fallback;
}

/** Body shape preferred by create/update/invite: `{ id, sortOrder }[]`. */
export function toRecommendedPropertiesPayload(ids: string[] | undefined) {
  return toSortItems((ids ?? []).map(String));
}

export async function fetchInvestors(): Promise<{ items: Investor[]; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.investors.list);
  const data = unwrapData(raw);
  return {
    items: asRecordArray(data).map(mapInvestor),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function fetchInvestor(
  investorId: string,
): Promise<{ investor: Investor | null; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.investors.one(investorId));
  const data = unwrapData(raw);
  if (!data) return { investor: null, message: envelopeMessage(raw, "Success.") };
  return {
    investor: mapInvestor(asRecord(data)),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function postInvestor(input: {
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
  /** API field name — maps to Investor.ownedPropertyCount in responses. */
  propertiesOwned?: number;
  buyingPower?: number;
  riskAppetite?: Investor["riskAppetite"];
  recommendedPropertyIds?: string[];
}): Promise<{ investor: Investor; message: string }> {
  const body: Record<string, unknown> = {
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() ?? "",
    country: input.country ?? "United Kingdom",
    nationality: input.nationality ?? "British",
    residencyStatus: input.residencyStatus ?? "uk_resident",
    assignedAgentId:
      input.assignedAgentId == null || input.assignedAgentId === ""
        ? null
        : Number(input.assignedAgentId) || input.assignedAgentId,
    accountStatus: input.accountStatus ?? "pending",
    invitationStatus: input.invitationStatus ?? null,
    intentLevel: input.intentLevel ?? "low",
    investmentHorizon: input.investmentHorizon ?? "",
    propertiesOwned: input.propertiesOwned ?? 0,
    buyingPower: input.buyingPower ?? 0,
    riskAppetite: input.riskAppetite ?? "balanced",
  };
  if (input.recommendedPropertyIds) {
    body.recommendedProperties = toRecommendedPropertiesPayload(
      input.recommendedPropertyIds,
    );
  }
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.investors.create, {
    method: "POST",
    body,
  });
  return {
    investor: mapInvestor(asRecord(unwrapData(raw))),
    message: envelopeMessage(raw, "Created."),
  };
}

export async function deleteInvestorRequest(
  investorId: string,
): Promise<{ message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.investors.one(investorId),
    { method: "DELETE" },
  );
  return { message: envelopeMessage(raw, "Investor deleted.") };
}

export async function patchInvestor(
  investorId: string,
  patch: Partial<Investor>,
): Promise<{ investor: Investor; message: string }> {
  const body: Record<string, unknown> = { ...patch };
  if ("assignedAgentId" in patch) {
    body.assignedAgentId =
      patch.assignedAgentId == null
        ? null
        : Number(patch.assignedAgentId) || patch.assignedAgentId;
  }
  if ("recommendedPropertyIds" in patch) {
    body.recommendedProperties = toRecommendedPropertiesPayload(
      patch.recommendedPropertyIds ?? [],
    );
    delete body.recommendedPropertyIds;
  }
  if ("id" in body) delete body.id;
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.investors.one(investorId), {
    method: "PATCH",
    body,
  });
  return {
    investor: mapInvestor(asRecord(unwrapData(raw))),
    message: envelopeMessage(raw, "Updated."),
  };
}

/** PUT /admin/investors/{id}/recommended-properties/sort */
export async function putInvestorRecommendedSort(
  investorId: string,
  orderedIds: string[],
): Promise<{ investor: Investor | null; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.investors.recommendedSort(investorId),
    {
      method: "PUT",
      body: { items: toSortItems(orderedIds) },
    },
  );
  const data = unwrapData(raw);
  const record = asRecord(data);
  const investorRaw =
    record.id != null || record.email != null
      ? record
      : asRecord(record.investor ?? record.data);
  return {
    investor:
      investorRaw.id != null || investorRaw.email != null
        ? mapInvestor(investorRaw)
        : null,
    message: envelopeMessage(raw, "Recommendation order saved."),
  };
}

export async function fetchInvestorNotes(
  investorId: string,
): Promise<{ items: Note[]; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.investors.notes(investorId));
  return {
    items: asRecordArray(unwrapData(raw)).map(mapNote),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function postInvestorNote(
  investorId: string,
  input: { body: string; kind: Note["kind"] },
): Promise<{ note: Note; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.investors.notes(investorId), {
    method: "POST",
    body: { body: input.body, kind: input.kind },
  });
  return {
    note: mapNote(asRecord(unwrapData(raw))),
    message: envelopeMessage(raw, "Created."),
  };
}

export async function postAssignProperty(
  investorId: string,
  input: AssignPropertyInput,
): Promise<{ ownership: PortfolioOwnership; message: string }> {
  const propertyId = input.propertyId;
  const body: Record<string, unknown> = {
    propertyId: Number(propertyId) || propertyId,
  };
  if (input.units?.length) {
    body.units = input.units.map((u) => ({
      unitIndex: u.unitIndex,
      quantity: u.quantity,
    }));
  }
  const planType = toApiAssignPlanType(input.planType);
  if (planType) body.planType = planType;
  const planMode =
    input.planMode ??
    (input.planType === "cash" || input.planType ? "default" : undefined);
  if (planMode) body.planMode = planMode;
  if (input.planType === "mortgage" && input.mortgagePlan) {
    body.mortgagePlan = {
      name: input.mortgagePlan.name,
      type: input.mortgagePlan.type,
      deposit: input.mortgagePlan.deposit,
      loanAmount: input.mortgagePlan.loanAmount,
      interestRate: input.mortgagePlan.interestRate,
      monthlyPayment: input.mortgagePlan.monthlyPayment,
      termYears: input.mortgagePlan.termYears,
      ltvPct: input.mortgagePlan.ltvPct,
      reservationFee: input.mortgagePlan.reservationFee ?? 0,
      mortgageDate: input.mortgagePlan.mortgageDate ?? "",
    };
  }
  if (input.planType === "payment_schedule" && input.paymentSchedule) {
    body.paymentSchedule = {
      name: input.paymentSchedule.name,
      summary: input.paymentSchedule.summary,
      stages: input.paymentSchedule.stages.map((s) => ({
        label: s.label,
        amount: s.amount,
        due: s.due,
        date: s.date ?? "",
      })),
    };
  }

  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.investors.properties(investorId),
    {
      method: "POST",
      body,
    },
  );
  const data = unwrapData(raw);
  const record = asRecord(data);
  const mapped = mapOwnership(record);
  const ownership: PortfolioOwnership = mapped.propertyId
    ? {
        ...mapped,
        investorId: mapped.investorId || investorId,
        propertyId: mapped.propertyId || propertyId,
        assignedPlanType: mapped.assignedPlanType ?? input.planType ?? null,
        assignedPlanVariant: mapped.assignedPlanVariant ?? planMode ?? null,
        assignedUnitCount:
          mapped.assignedUnitCount ??
          input.units?.reduce((sum, u) => sum + u.quantity, 0) ??
          null,
      }
    : {
        id: `${investorId}:${propertyId}`,
        investorId,
        propertyId,
        purchaseValue: 0,
        currentValue: 0,
        mortgageBalance: 0,
        equity: 0,
        monthlyRent: 0,
        netCashFlow: 0,
        assignedPlanType: input.planType ?? null,
        assignedPlanVariant: planMode ?? null,
        assignedUnitCount:
          input.units?.reduce((sum, u) => sum + u.quantity, 0) ?? null,
        units: [],
      };
  return {
    ownership,
    message: envelopeMessage(raw, "Assigned."),
  };
}

export async function deleteUnassignUnits(
  investorId: string,
  propertyId: string,
  units: Array<{ unitIndex: number; quantity?: number }>,
): Promise<{ message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.investors.property(investorId, propertyId),
    {
      method: "DELETE",
      body: {
        units: units.map((u) =>
          u.quantity == null
            ? { unitIndex: u.unitIndex }
            : { unitIndex: u.unitIndex, quantity: u.quantity },
        ),
      },
      query:
        units.length === 1
          ? {
              unitIndex: units[0].unitIndex,
              ...(units[0].quantity == null
                ? {}
                : { quantity: units[0].quantity }),
            }
          : undefined,
    },
  );
  return { message: envelopeMessage(raw, "Removed.") };
}

export async function deleteUnassignProperty(
  investorId: string,
  propertyId: string,
): Promise<{ message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.investors.property(investorId, propertyId),
    { method: "DELETE" },
  );
  return { message: envelopeMessage(raw, "Removed.") };
}

export async function fetchOwnership(
  investorId?: string,
): Promise<{ items: PortfolioOwnership[]; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.properties.ownership, {
    query: investorId ? { investorId } : undefined,
  });
  const data = unwrapData(raw);
  // Accept array, or { items|ownership|data: [] } wrappers.
  const rows = Array.isArray(data)
    ? asRecordArray(data)
    : asRecordArray(
        asRecord(data).items ??
          asRecord(data).ownership ??
          asRecord(data).data,
      );
  return {
    items: rows.map(mapOwnership).filter((o) => o.propertyId),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function fetchInvitations(): Promise<{ items: Invitation[]; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.invitations.list);
  return {
    items: asRecordArray(unwrapData(raw)).map(mapInvitation),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function postInvitation(input: {
  name: string;
  email: string;
  assignedAgentId: string | null;
  propertyIds?: string[];
  recommendedPropertyIds?: string[];
  folderIds?: string[];
}): Promise<{ invitation: Invitation; investor: Investor; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.invitations.create, {
    method: "POST",
    body: {
      name: input.name,
      email: input.email,
      assignedAgentId: input.assignedAgentId
        ? Number(input.assignedAgentId) || input.assignedAgentId
        : null,
      propertyIds: (input.propertyIds ?? []).map((id) => Number(id) || id),
      recommendedProperties: toRecommendedPropertiesPayload(
        input.recommendedPropertyIds,
      ),
      folderIds: (input.folderIds ?? []).map((id) => Number(id) || id),
    },
  });
  const data = asRecord(unwrapData(raw));
  return {
    invitation: mapInvitation(asRecord(data.invitation)),
    investor: mapInvestor(asRecord(data.investor)),
    message: envelopeMessage(raw, "Invitation created."),
  };
}

export async function patchInvitation(
  invitationId: string,
  patch: Partial<Invitation>,
): Promise<{ invitation: Invitation; message: string }> {
  const body: Record<string, unknown> = { ...patch };
  if (patch.propertyIds) {
    body.propertyIds = patch.propertyIds.map((id) => Number(id) || id);
  }
  if (patch.folderIds) {
    body.folderIds = patch.folderIds.map((id) => Number(id) || id);
  }
  if ("recommendedPropertyIds" in patch) {
    body.recommendedProperties = toRecommendedPropertiesPayload(
      patch.recommendedPropertyIds ?? [],
    );
    delete body.recommendedPropertyIds;
  }
  if ("id" in body) delete body.id;
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.invitations.one(invitationId), {
    method: "PATCH",
    body,
  });
  return {
    invitation: mapInvitation(asRecord(unwrapData(raw))),
    message: envelopeMessage(raw, "Updated."),
  };
}
