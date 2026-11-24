import { apiRequest, ApiError, unwrapData } from "@/lib/apiClient";
import { endpoints } from "@/services/endpoints";
import {
  findMockCredential,
  findMockUserByEmail,
  findMockUserById,
} from "@/services/mockData";
import { USE_MOCK_DATA } from "@/services/mockFlags";
import type { InternalUser, InvitationStatus, Role } from "@/models";

/** JM Backend envelope: { success, data, message, errors, paging } */
type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
  errors?: unknown;
};

type ApiAdmin = {
  id: string | number;
  name: string;
  email: string;
  role: Role | string;
  status: InternalUser["status"] | string;
  assignedInvestorIds?: Array<string | number>;
  lastLoginAt?: string | null;
  invitationStatus?: InvitationStatus | null;
  createdAt?: string;
  updatedAt?: string;
  calendlyUrl?: string | null;
  whatsappNumber?: string | null;
};

type LoginData = {
  admin: ApiAdmin;
  token: string;
};

type MeData = {
  admin: ApiAdmin;
};

type ForgotPasswordData = {
  resetToken?: string;
};

function isRole(value: string): value is Role {
  return value === "super_admin" || value === "agent" || value === "viewer";
}

function isUserStatus(value: string): value is InternalUser["status"] {
  return value === "active" || value === "inactive" || value === "invited";
}

/** Map API admin payload → app InternalUser (ids as strings). */
export function mapAdminToUser(admin: ApiAdmin): InternalUser {
  const role = String(admin.role);
  const status = String(admin.status);
  return {
    id: String(admin.id),
    name: admin.name,
    email: admin.email,
    role: isRole(role) ? role : "viewer",
    status: isUserStatus(status) ? status : "active",
    assignedInvestorIds: (admin.assignedInvestorIds ?? []).map(String),
    lastLoginAt: admin.lastLoginAt ?? null,
    invitationStatus: admin.invitationStatus ?? null,
    createdAt: admin.createdAt ?? new Date().toISOString(),
    calendlyUrl: admin.calendlyUrl?.trim() || undefined,
    whatsappNumber: admin.whatsappNumber?.trim() || undefined,
  };
}

function envelopeData<T>(raw: ApiEnvelope<T> | T): T {
  return unwrapData<T>(raw);
}

function mockAdminFromEmail(email: string): InternalUser {
  const fromSeed = findMockUserByEmail(email);
  if (fromSeed) {
    return {
      ...fromSeed,
      lastLoginAt: new Date().toISOString(),
    };
  }
  const trimmed = email.trim() || "admin@josephmews.com";
  const local = trimmed.split("@")[0] || "Admin";
  const name = local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    id: "user-mock-admin",
    name: name || "Ops Admin",
    email: trimmed,
    role: "super_admin",
    status: "active",
    assignedInvestorIds: [],
    lastLoginAt: new Date().toISOString(),
    invitationStatus: null,
    createdAt: new Date().toISOString(),
  };
}

function delay<T>(value: T, ms = 200): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms);
  });
}

export type LoginResult = {
  user: InternalUser;
  token: string;
  message: string;
};

export async function loginRequest(email: string, password: string): Promise<LoginResult> {
  if (USE_MOCK_DATA) {
    if (!email.trim() || !password) {
      throw new ApiError("Email and password are required.", 422);
    }
    const cred = findMockCredential(email, password);
    if (!cred) {
      throw new ApiError("Invalid email or password.", 401);
    }
    const user =
      findMockUserById(cred.userId) ?? mockAdminFromEmail(cred.email);
    user.lastLoginAt = new Date().toISOString();
    return delay({
      user,
      token: `mock-token-${user.id}`,
      message: "Signed in (mock mode).",
    });
  }

  const raw = await apiRequest<ApiEnvelope<LoginData>>(endpoints.auth.login, {
    method: "POST",
    body: { email, password },
    auth: false,
  });

  const data = envelopeData(raw);
  if (!data?.admin || !data?.token) {
    throw new ApiError(raw.message || "Login response was incomplete.", 0, raw);
  }

  return {
    user: mapAdminToUser(data.admin),
    token: data.token,
    message: raw.message || "Login successful.",
  };
}

export type MeResult = {
  user: InternalUser;
  message: string;
};

/** Current admin session — source of truth for role / assignments / status. */
export async function fetchMeRequest(): Promise<MeResult> {
  if (USE_MOCK_DATA) {
    try {
      const raw = localStorage.getItem("jm-admin-session");
      if (raw) {
        const parsed = JSON.parse(raw) as { user?: InternalUser };
        if (parsed?.user) {
          return delay({
            user: { ...parsed.user, status: parsed.user.status || "active" },
            message: "Session OK (mock).",
          });
        }
      }
    } catch {
      /* fall through */
    }
    return delay({
      user: mockAdminFromEmail("admin@josephmews.com"),
      message: "Session OK (mock).",
    });
  }

  const raw = await apiRequest<ApiEnvelope<MeData>>(endpoints.auth.me, {
    method: "GET",
  });

  const data = envelopeData(raw);
  if (!data?.admin) {
    throw new ApiError(raw.message || "Session response was incomplete.", 0, raw);
  }

  return {
    user: mapAdminToUser(data.admin),
    message: raw.message || "Success.",
  };
}

export type ForgotPasswordResult = {
  message: string;
  resetToken: string | null;
};

export async function forgotPasswordRequest(email: string): Promise<ForgotPasswordResult> {
  if (USE_MOCK_DATA) {
    return delay({
      message: "If that email exists, a reset link has been sent. (mock)",
      resetToken: `mock-reset-${encodeURIComponent(email.trim() || "user")}`,
    });
  }

  const raw = await apiRequest<ApiEnvelope<ForgotPasswordData>>(endpoints.auth.forgotPassword, {
    method: "POST",
    body: { email },
    auth: false,
  });

  const data = envelopeData(raw);
  return {
    message: raw.message || "If that email exists, a reset link has been sent.",
    resetToken: data?.resetToken ?? null,
  };
}

export type ResetPasswordResult = {
  message: string;
};

export async function resetPasswordRequest(input: {
  email: string;
  token: string;
  password: string;
  passwordConfirmation: string;
}): Promise<ResetPasswordResult> {
  if (USE_MOCK_DATA) {
    if (!input.password || input.password !== input.passwordConfirmation) {
      throw new ApiError("Passwords do not match.", 422);
    }
    return delay({ message: "Password has been reset successfully. (mock)" });
  }

  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.auth.resetPassword, {
    method: "POST",
    body: {
      email: input.email,
      token: input.token,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
    },
    auth: false,
  });

  return {
    message: raw.message || "Password has been reset successfully.",
  };
}

export type LogoutResult = {
  message: string;
};

/** Revoke current admin session on the server. Call while Bearer token is still valid. */
export async function logoutRequest(): Promise<LogoutResult> {
  if (USE_MOCK_DATA) {
    return delay({ message: "Logged out. (mock)" });
  }

  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.auth.logout, {
    method: "POST",
  });
  return {
    message: raw.message || "Logged out.",
  };
}
