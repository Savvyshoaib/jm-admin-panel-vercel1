import { apiRequest, unwrapData } from "@/lib/apiClient";
import { mapActivity, type ActivityListQuery } from "@/services/activityApi";
import { endpoints } from "@/services/endpoints";
import { asRecord, asRecordArray } from "@/services/mappers";
import { mapSignal, type SignalListQuery } from "@/services/signalsApi";
import type {
  ActivityEvent,
  CalculatorStepCount,
  InvestorEngagement,
  IntentSignal,
  PortfolioInsightCard,
  PropertyVisitCount,
  ScreenVisitCount,
} from "@/models";

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function unwrapRecord(raw: unknown): Record<string, unknown> {
  return asRecord(unwrapData(raw));
}

export async function fetchQikoSignals(query?: SignalListQuery): Promise<{
  items: IntentSignal[];
  total: number;
}> {
  const raw = await apiRequest<unknown>(endpoints.qiko.signals, {
    query: {
      q: query?.q,
      strength: query?.strength,
      investorRef: query?.investorRef,
      limit: query?.limit ?? 50,
      offset: query?.offset ?? 0,
    },
  });
  const record = unwrapRecord(raw);
  const rows = asRecordArray(record.signals ?? record.items);
  const items = rows.map(mapSignal).filter((s) => s.signalType || s.investorId);
  return { items, total: num(record.total, items.length) };
}

export async function fetchQikoActivity(query?: ActivityListQuery): Promise<{
  items: ActivityEvent[];
  total: number;
}> {
  const raw = await apiRequest<unknown>(endpoints.qiko.activity, {
    query: {
      investorRef: query?.investorRef ?? query?.investorId,
      q: query?.q,
      category: query?.category,
      sort: query?.sort ?? "-occurredAt",
      since: query?.since,
      until: query?.until,
      limit: query?.limit ?? 50,
      offset: query?.offset ?? 0,
    },
  });
  const record = unwrapRecord(raw);
  const rows = asRecordArray(record.events ?? record.items);
  const items = rows.map(mapActivity).filter((a) => a.title || a.investorId);
  return { items, total: num(record.total, items.length) };
}

function mapScreenCounts(raw: unknown): ScreenVisitCount[] {
  return asRecordArray(raw).map((row) => ({
    label: str(row.label),
    visitCount: num(row.visitCount ?? row.visit_count),
  }));
}

function mapPropertyCounts(raw: unknown): PropertyVisitCount[] {
  return asRecordArray(raw).map((row) => ({
    propertyName: str(row.propertyName ?? row.property_name),
    location: row.location == null || row.location === "" ? null : str(row.location),
    postcode:
      row.postcode == null || row.postcode === "" ? null : str(row.postcode),
    visitCount: num(row.visitCount ?? row.visit_count),
  }));
}

function mapStepCounts(raw: unknown): CalculatorStepCount[] {
  return asRecordArray(raw).map((row) => ({
    step: str(row.step ?? row.label),
    visitCount: num(row.visitCount ?? row.visit_count),
  }));
}

export function emptyInvestorEngagement(investorRef: string): InvestorEngagement {
  return {
    investorRef,
    screens: [],
    properties: [],
    calculatorSteps: [],
    totalEvents: 0,
    recent: [],
    signals: [],
    insufficientActivity: true,
    reason: null,
    activityEventCount: 0,
  };
}

export async function fetchQikoInvestorEngagement(
  investorRef: string,
  recentLimit = 50,
): Promise<InvestorEngagement> {
  const raw = await apiRequest<unknown>(endpoints.qiko.investor(investorRef), {
    query: { recentLimit },
  });
  const record = unwrapRecord(raw);
  const activity = asRecord(record.activity);
  const recent = asRecordArray(activity.recent ?? activity.events).map(mapActivity);
  const signals = asRecordArray(record.signals).map(mapSignal);
  return {
    investorRef: str(record.investorRef ?? investorRef),
    screens: mapScreenCounts(activity.screens),
    properties: mapPropertyCounts(activity.properties),
    calculatorSteps: mapStepCounts(
      activity.calculatorSteps ?? activity.calculator_steps,
    ),
    totalEvents: num(activity.totalEvents ?? activity.total_events),
    recent,
    signals,
    insufficientActivity: bool(record.insufficientActivity),
    reason:
      record.reason == null || record.reason === "" ? null : str(record.reason),
    activityEventCount: num(
      record.activityEventCount ?? record.activity_event_count,
    ),
  };
}

function mapInsightCards(raw: unknown): PortfolioInsightCard[] {
  const rows = Array.isArray(raw)
    ? asRecordArray(raw)
    : asRecordArray(asRecord(raw).cards ?? asRecord(raw).items);
  return rows.map((row) => ({
    category: str(row.category),
    metric: str(row.metric),
    headline: str(row.headline),
    evidence: str(row.evidence),
    trend: str(row.trend),
  }));
}

export type QikoInsightGeneratePayload = {
  requestId: string;
  investor: {
    id: string | number;
    firstName?: string;
    lastName?: string;
  };
  properties: Array<{
    propertyName: string;
    location: string;
    postcode: string;
    region: string;
    grossYieldPct: number;
    capitalGrowthPct: number;
    netMonthly: number;
    status: string;
  }>;
  platformAverages: Record<
    string,
    { growthPct3m: number; grossYieldPct: number }
  >;
};

export type QikoPropertyInsightPayload = {
  requestId: string;
  investor: {
    id: string | number;
    firstName?: string;
    lastName?: string;
  };
  property: {
    id: string | number;
    name: string;
    grossYieldPct: number;
    capitalGrowthPct: number;
    netMonthly: number;
  };
  portfolioAverages: {
    grossYieldPct: number;
    capitalGrowthPct: number;
  };
  locale: string;
};

export async function postQikoPortfolioInsight(
  payload: QikoInsightGeneratePayload,
): Promise<PortfolioInsightCard[]> {
  const raw = await apiRequest<unknown>(endpoints.qiko.insightsPortfolio, {
    method: "POST",
    body: payload,
  });
  return mapInsightCards(unwrapData(raw));
}

export async function postQikoPropertyInsight(
  payload: QikoPropertyInsightPayload,
): Promise<PortfolioInsightCard[]> {
  const raw = await apiRequest<unknown>(endpoints.qiko.insightsProperty, {
    method: "POST",
    body: payload,
  });
  return mapInsightCards(unwrapData(raw));
}
