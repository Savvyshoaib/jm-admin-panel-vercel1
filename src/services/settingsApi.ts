import { apiRequest, unwrapData } from "@/lib/apiClient";
import { endpoints } from "@/services/endpoints";
import { asRecord, type ApiEnvelope } from "@/services/mappers";
import type { PlatformSettings } from "@/models";

function envelopeMessage(raw: ApiEnvelope<unknown>, fallback: string): string {
  return raw.message || fallback;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

export function mapSettings(raw: Record<string, unknown>): PlatformSettings {
  return {
    maintenanceBanner: bool(
      raw.maintenanceBanner ?? raw.maintenance_banner,
      false,
    ),
    inviteOnly: bool(
      raw.inviteOnly ?? raw.invite_only ?? raw.requireInvite,
      true,
    ),
  };
}

export async function fetchSettings(): Promise<{
  settings: PlatformSettings;
  message: string;
}> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.settings.get);
  const data = asRecord(unwrapData(raw));
  return {
    settings: mapSettings(data),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function putSettings(
  patch: Partial<PlatformSettings>,
): Promise<{ settings: PlatformSettings; message: string }> {
  const body: Record<string, boolean> = {};
  if (patch.maintenanceBanner !== undefined) {
    body.maintenanceBanner = patch.maintenanceBanner;
  }
  if (patch.inviteOnly !== undefined) {
    body.inviteOnly = patch.inviteOnly;
  }

  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.settings.update, {
    method: "PUT",
    body,
  });
  const data = asRecord(unwrapData(raw));
  const settings = Object.keys(data).length
    ? mapSettings(data)
    : {
        maintenanceBanner: patch.maintenanceBanner ?? false,
        inviteOnly: patch.inviteOnly ?? true,
      };

  return {
    settings,
    message: envelopeMessage(raw, "Updated."),
  };
}
