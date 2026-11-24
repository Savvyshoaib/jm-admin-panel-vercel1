import { apiRequest, unwrapData } from "@/lib/apiClient";
import { endpoints } from "@/services/endpoints";
import { mapActivity } from "@/services/activityApi";
import { mapEnquiry } from "@/services/enquiriesApi";
import {
  asRecord,
  asRecordArray,
  mapDocument,
  mapInvitation,
  type ApiEnvelope,
} from "@/services/mappers";
import { mapSignal } from "@/services/signalsApi";
import type { DashboardStats } from "@/models";

function envelopeMessage(raw: ApiEnvelope<unknown>, fallback: string): string {
  return raw.message || fallback;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function mapDashboardStats(raw: Record<string, unknown>): DashboardStats {
  return {
    totalInvestors: num(raw.totalInvestors),
    invitedUsers: num(raw.invitedUsers),
    signedUpUsers: num(raw.signedUpUsers),
    pendingInvitations: num(raw.pendingInvitations),
    activeProperties: num(raw.activeProperties),
    activeDevelopments: num(raw.activeDevelopments),
    openEnquiries: num(raw.openEnquiries),
    highIntentInvestors: num(raw.highIntentInvestors),
    upcomingPayments: num(raw.upcomingPayments),
    recentDocuments: asRecordArray(raw.recentDocuments).map(mapDocument),
    highPrioritySignals: asRecordArray(raw.highPrioritySignals)
      .map(mapSignal)
      .filter((s) => s.id),
    recentActivity: asRecordArray(raw.recentActivity)
      .map(mapActivity)
      .filter((a) => a.id),
    newEnquiries: asRecordArray(raw.newEnquiries)
      .map(mapEnquiry)
      .filter((e) => e.id),
    recentInvites: asRecordArray(raw.recentInvites)
      .map(mapInvitation)
      .filter((i) => i.id),
    recentPriceUpdates: [],
    recentProperties: [],
  };
}

export async function fetchDashboardStats(): Promise<{
  stats: DashboardStats;
  message: string;
}> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.dashboard.stats);
  const data = asRecord(unwrapData(raw));
  return {
    stats: mapDashboardStats(data),
    message: envelopeMessage(raw, "Success."),
  };
}
