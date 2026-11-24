import { apiRequest, unwrapData } from "@/lib/apiClient";
import { endpoints } from "@/services/endpoints";
import {
  asRecord,
  asRecordArray,
  mapUser,
  type ApiEnvelope,
} from "@/services/mappers";
import type { InternalUser, Role } from "@/models";

function envelopeMessage(raw: ApiEnvelope<unknown>, fallback: string): string {
  return raw.message || fallback;
}

export async function fetchUsers(): Promise<{ items: InternalUser[]; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.users.list);
  return {
    items: asRecordArray(unwrapData(raw)).map(mapUser),
    message: envelopeMessage(raw, "Success."),
  };
}

/** Assignable agents for investor CRM dropdowns. */
export async function fetchAgents(): Promise<{ items: InternalUser[]; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.agents.list);
  return {
    items: asRecordArray(unwrapData(raw)).map(mapUser),
    message: envelopeMessage(raw, "Success."),
  };
}

/** GET /admin/users/:id — not available on current backend (405). Prefer list + find. */
export async function fetchUser(
  adminId: string,
): Promise<{ user: InternalUser | null; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.users.one(adminId));
  const data = unwrapData(raw);
  if (!data) return { user: null, message: envelopeMessage(raw, "Success.") };
  return {
    user: mapUser(asRecord(data)),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function inviteUserRequest(input: {
  name: string;
  email: string;
  role: Role;
  calendlyUrl?: string;
  whatsappNumber?: string;
}): Promise<{ user: InternalUser; message: string }> {
  const body: Record<string, unknown> = {
    name: input.name,
    email: input.email,
    role: input.role,
  };
  if (input.calendlyUrl !== undefined) {
    body.calendlyUrl = input.calendlyUrl;
  }
  if (input.whatsappNumber !== undefined) {
    body.whatsappNumber = input.whatsappNumber;
  }
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.users.invite, {
    method: "POST",
    body,
  });
  return {
    user: mapUser(asRecord(unwrapData(raw))),
    message: envelopeMessage(raw, "Invitation created."),
  };
}

/** POST /admin/users/invite/resend — body `{ id }`. */
export async function resendUserInviteRequest(
  userId: string,
): Promise<{ message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.users.inviteResend,
    {
      method: "POST",
      body: { id: Number(userId) || userId },
    },
  );
  return { message: envelopeMessage(raw, "Invitation resent.") };
}

export async function patchUser(
  adminId: string,
  patch: Partial<
    Pick<
      InternalUser,
      | "name"
      | "email"
      | "role"
      | "status"
      | "assignedInvestorIds"
      | "calendlyUrl"
      | "whatsappNumber"
    >
  >,
): Promise<{ user: InternalUser; message: string }> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.email !== undefined) body.email = patch.email;
  if (patch.role !== undefined) body.role = patch.role;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.calendlyUrl !== undefined) body.calendlyUrl = patch.calendlyUrl;
  if (patch.whatsappNumber !== undefined) {
    body.whatsappNumber = patch.whatsappNumber;
  }
  if (patch.assignedInvestorIds !== undefined) {
    body.assignedInvestorIds = patch.assignedInvestorIds.map((id) => Number(id) || id);
  }

  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.users.one(adminId), {
    method: "PATCH",
    body,
  });
  return {
    user: mapUser(asRecord(unwrapData(raw))),
    message: envelopeMessage(raw, "Updated."),
  };
}
