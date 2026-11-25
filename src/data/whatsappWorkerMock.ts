/**
 * Mock data for WhatsApp Sales Worker mode — UI-only until worker APIs exist.
 * Event / schedule dates are relative to "now" so Overview, Leads, Webinars,
 * and Data stay populated in the current week.
 */

export type LeadStatus =
  | "New"
  | "Not Contacted"
  | "Contacted"
  | "Active Conversation"
  | "Qualified"
  | "Nurture"
  | "High Intent"
  | "Human Handoff"
  | "No Response"
  | "Closed"
  | "Opted Out";

export type CampaignStatus =
  | "Draft"
  | "Scheduled"
  | "Active"
  | "Completed"
  | "Cancelled";

export type InterestLevel = "High" | "Medium" | "Low" | "Unknown";
export type Readiness = "Ready Now" | "Near Term" | "Exploring" | "Unknown";
export type MarketFocus = "UK" | "UAE" | "UK + UAE" | "Undecided";
export type OutreachMode = "Manual" | "Automatic";

export type WhatsAppLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  market: MarketFocus;
  budget: number | null;
  interest: InterestLevel;
  readiness: Readiness;
  status: LeadStatus;
  source: string;
  assignedRep: string;
  conversationSummary: string;
  profileNotes: string;
  stage: string;
  qualificationPct: number;
  outreachNote: string;
  lastContactedAt: string | null;
  lastResponseAt: string | null;
  handoffRequested: boolean;
  whatsappConsent: boolean;
  optedOut: boolean;
  funding: string;
  timeline: string;
  preferredLocations: string[];
};

export type AudiencePreview = {
  total: number;
  matching: number;
  whatsappEligible: number;
  excludedNoConsent: number;
  optedOut: number;
  finalAudience: number;
};

export type WhatsAppWebinar = {
  id: string;
  title: string;
  market: string;
  scheduledAt: string;
  timezone: string;
  status: CampaignStatus;
  outreachMode: OutreachMode;
  relevantLeadIds: string[];
  engagement: {
    invited: number;
    opened: number;
    replied: number;
    registered: number;
    attended: number;
  };
  audience: AudiencePreview;
  suggestedCriteria: string[];
  description: string;
};

export type UploadHistoryItem = {
  id: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  rowsTotal: number;
  rowsNew: number;
  rowsDuplicate: number;
  rowsInvalid: number;
  status: "Completed" | "Partial" | "Failed";
};

export type OverviewMetric = {
  key: string;
  label: string;
  value: string;
  hint: string;
  tone?: "up" | "down" | "neutral";
};

export type ActivityItem = {
  id: string;
  leadId: string;
  leadName: string;
  initials: string;
  summary: string;
  at: string;
};

export const WORKER_NAME = "Joe - WhatsApp Sales";
export const INTERAKT_CONNECTED = true;

function isoDaysAgo(days: number, hour = 10, minute = 20): string {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function isoDaysAhead(days: number, hour = 18, minute = 0): string {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export const whatsappLeads: WhatsAppLead[] = [
  {
    id: "lead-sarah",
    name: "Sarah Jones",
    email: "sarah.jones@example.com",
    phone: "+447700900123",
    market: "UK",
    budget: 250_000,
    interest: "High",
    readiness: "Near Term",
    status: "Active Conversation",
    source: "How to Invest in UK Property",
    assignedRep: "Johnny Conran",
    conversationSummary:
      "Discussing Birmingham stock and mortgage eligibility ahead of the next UK webinar.",
    profileNotes:
      "Interested in Birmingham property. Mortgage-funded. Budget around £250k and expects to invest within four months.",
    stage: "Qualification - budget & location",
    qualificationPct: 65,
    outreachNote: "Entered qualification",
    lastContactedAt: isoDaysAgo(0, 19, 30),
    lastResponseAt: isoDaysAgo(0, 20, 1),
    handoffRequested: false,
    whatsappConsent: true,
    optedOut: false,
    funding: "Mortgage",
    timeline: "Within 4 months",
    preferredLocations: ["Birmingham", "Midlands"],
  },
  {
    id: "lead-priya",
    name: "Priya Patel",
    email: "priya.patel@example.com",
    phone: "+447711223344",
    market: "UK",
    budget: 180_000,
    interest: "High",
    readiness: "Ready Now",
    status: "High Intent",
    source: "Birmingham Investment Opportunities",
    assignedRep: "Johnny Conran",
    conversationSummary:
      "High intent — requesting an advisor call on Leeds stock within 2 months.",
    profileNotes:
      "Strong interest in Leeds yield stock. Asking for advisor availability this week. Budget flexible around £180k with deposit ready.",
    stage: "Consultation request",
    qualificationPct: 82,
    outreachNote: "Requested advisor call",
    lastContactedAt: isoDaysAgo(1, 13, 10),
    lastResponseAt: isoDaysAgo(1, 14, 40),
    handoffRequested: false,
    whatsappConsent: true,
    optedOut: false,
    funding: "Cash + mortgage",
    timeline: "Within 2 months",
    preferredLocations: ["Leeds", "Yorkshire"],
  },
  {
    id: "lead-elena",
    name: "Elena Rossi",
    email: "elena.rossi@example.com",
    phone: "+447700333444",
    market: "UK",
    budget: 220_000,
    interest: "Medium",
    readiness: "Near Term",
    status: "Human Handoff",
    source: "How to Invest in UK Property",
    assignedRep: "Johnny Conran",
    conversationSummary:
      "Requested a human advisor — automation paused until resume.",
    profileNotes:
      "Overseas buyer based in Milan. Prefers speaking with a human about tax and remittance before continuing WhatsApp automation.",
    stage: "Human handoff",
    qualificationPct: 55,
    outreachNote: "Automation paused",
    lastContactedAt: isoDaysAgo(2, 20, 40),
    lastResponseAt: isoDaysAgo(2, 21, 12),
    handoffRequested: true,
    whatsappConsent: true,
    optedOut: false,
    funding: "Cash",
    timeline: "3–6 months",
    preferredLocations: ["Manchester", "London"],
  },
  {
    id: "lead-fatima",
    name: "Fatima Al-Sayed",
    email: "fatima.alsayed@example.com",
    phone: "+447700777888",
    market: "UK",
    budget: 320_000,
    interest: "High",
    readiness: "Ready Now",
    status: "Qualified",
    source: "How to Invest in UK Property",
    assignedRep: "Johnny Conran",
    conversationSummary:
      "Qualified cash buyer for Birmingham — consultation booked.",
    profileNotes:
      "Cash buyer targeting Birmingham. Consultation booked with Johnny. Strong fit for off-plan and completed stock.",
    stage: "Consultation booked",
    qualificationPct: 90,
    outreachNote: "Booked consultation",
    lastContactedAt: isoDaysAgo(1, 13, 20),
    lastResponseAt: isoDaysAgo(1, 14, 5),
    handoffRequested: false,
    whatsappConsent: true,
    optedOut: false,
    funding: "Cash",
    timeline: "Immediate",
    preferredLocations: ["Birmingham"],
  },
  {
    id: "lead-ahmed",
    name: "Ahmed Hassan",
    email: "ahmed.hassan@example.com",
    phone: "+971501234567",
    market: "UAE",
    budget: 400_000,
    interest: "Medium",
    readiness: "Exploring",
    status: "Nurture",
    source: "External ad",
    assignedRep: "Amelia Hart",
    conversationSummary:
      "On a light nurture cadence while he researches Dubai cash purchases.",
    profileNotes:
      "UAE-based cash buyer exploring Dubai off-plan. Not ready for heavy outreach; prefer nurture cadence.",
    stage: "Nurture",
    qualificationPct: 40,
    outreachNote: "Light nurture",
    lastContactedAt: isoDaysAgo(3, 15),
    lastResponseAt: isoDaysAgo(3, 16, 20),
    handoffRequested: false,
    whatsappConsent: true,
    optedOut: false,
    funding: "Cash",
    timeline: "6–12 months",
    preferredLocations: ["Dubai", "Abu Dhabi"],
  },
  {
    id: "lead-james",
    name: "James Okafor",
    email: "james.okafor@example.com",
    phone: "+447700111222",
    market: "UK",
    budget: null,
    interest: "Unknown",
    readiness: "Unknown",
    status: "Not Contacted",
    source: "Spreadsheet upload",
    assignedRep: "Amelia Hart",
    conversationSummary: "Imported lead — no outreach yet.",
    profileNotes:
      "Imported from the latest lead sheet. Phone valid; email pending verification. No conversation started.",
    stage: "New import",
    qualificationPct: 5,
    outreachNote: "Awaiting first touch",
    lastContactedAt: null,
    lastResponseAt: null,
    handoffRequested: false,
    whatsappConsent: true,
    optedOut: false,
    funding: "Unknown",
    timeline: "Unknown",
    preferredLocations: [],
  },
  {
    id: "lead-maya",
    name: "Maya Chen",
    email: "maya.chen@example.com",
    phone: "+447700444555",
    market: "UK + UAE",
    budget: 275_000,
    interest: "Medium",
    readiness: "Near Term",
    status: "New",
    source: "Organic inbound",
    assignedRep: "Amelia Hart",
    conversationSummary: "Just landed in the pool from an inbound form.",
    profileNotes:
      "Comparing UK yield vs Dubai off-plan. No WhatsApp opener sent yet.",
    stage: "New",
    qualificationPct: 8,
    outreachNote: "Queue for first touch",
    lastContactedAt: null,
    lastResponseAt: null,
    handoffRequested: false,
    whatsappConsent: true,
    optedOut: false,
    funding: "Cash + mortgage",
    timeline: "3–6 months",
    preferredLocations: ["Manchester", "Dubai"],
  },
  {
    id: "lead-tom",
    name: "Tom Baker",
    email: "tom.baker@example.com",
    phone: "+447700555666",
    market: "UK",
    budget: 150_000,
    interest: "Low",
    readiness: "Exploring",
    status: "Opted Out",
    source: "External ad",
    assignedRep: "Amelia Hart",
    conversationSummary: "Opted out — excluded from further WhatsApp outreach.",
    profileNotes: "Explicitly opted out of WhatsApp messaging. Keep in CRM only.",
    stage: "Opted out",
    qualificationPct: 10,
    outreachNote: "Do not contact via WhatsApp",
    lastContactedAt: isoDaysAgo(18, 16, 30),
    lastResponseAt: isoDaysAgo(18, 17),
    handoffRequested: false,
    whatsappConsent: false,
    optedOut: true,
    funding: "Mortgage",
    timeline: "Unknown",
    preferredLocations: ["London"],
  },
  {
    id: "lead-chris",
    name: "Chris Nguyen",
    email: "chris.nguyen@example.com",
    phone: "+447700999000",
    market: "UK",
    budget: 500_000,
    interest: "Medium",
    readiness: "Exploring",
    status: "No Response",
    source: "Organic inbound",
    assignedRep: "Amelia Hart",
    conversationSummary:
      "No reply after first qualification opener about London.",
    profileNotes:
      "Inbound interest in London stock at £500k. No reply after opener; schedule a polite follow-up.",
    stage: "Follow-up due",
    qualificationPct: 25,
    outreachNote: "No reply",
    lastContactedAt: isoDaysAgo(5, 22),
    lastResponseAt: null,
    handoffRequested: false,
    whatsappConsent: true,
    optedOut: false,
    funding: "Cash + mortgage",
    timeline: "6 months",
    preferredLocations: ["London"],
  },
  {
    id: "lead-noah",
    name: "Noah Williams",
    email: "noah.williams@example.com",
    phone: "+447700222333",
    market: "UK",
    budget: 195_000,
    interest: "Medium",
    readiness: "Near Term",
    status: "Contacted",
    source: "Leeds & Yorkshire Yield Walkthrough",
    assignedRep: "Johnny Conran",
    conversationSummary:
      "Opened the Leeds webinar invite and replied with budget range.",
    profileNotes:
      "First-time investor. Prefers Yorkshire yield. Waiting on deposit confirmation from bank.",
    stage: "Awaiting deposit proof",
    qualificationPct: 45,
    outreachNote: "Awaiting docs",
    lastContactedAt: isoDaysAgo(2, 11),
    lastResponseAt: isoDaysAgo(2, 12, 15),
    handoffRequested: false,
    whatsappConsent: true,
    optedOut: false,
    funding: "Mortgage",
    timeline: "Within 4 months",
    preferredLocations: ["Leeds", "Sheffield"],
  },
  {
    id: "lead-layla",
    name: "Layla Ibrahim",
    email: "layla.ibrahim@example.com",
    phone: "+971509876543",
    market: "UAE",
    budget: 550_000,
    interest: "High",
    readiness: "Ready Now",
    status: "High Intent",
    source: "Dubai Property Market Briefing",
    assignedRep: "Amelia Hart",
    conversationSummary:
      "Ready to view Abu Dhabi off-plan — asking for a same-week call.",
    profileNotes:
      "Cash buyer. Strong fit for Abu Dhabi masterclass and Dubai briefing follow-up.",
    stage: "Consultation request",
    qualificationPct: 78,
    outreachNote: "Book UAE desk",
    lastContactedAt: isoDaysAgo(0, 15, 40),
    lastResponseAt: isoDaysAgo(0, 16, 5),
    handoffRequested: false,
    whatsappConsent: true,
    optedOut: false,
    funding: "Cash",
    timeline: "Immediate",
    preferredLocations: ["Abu Dhabi", "Dubai"],
  },
  {
    id: "lead-oliver",
    name: "Oliver Grant",
    email: "oliver.grant@example.com",
    phone: "+447700666777",
    market: "UK",
    budget: 410_000,
    interest: "Low",
    readiness: "Exploring",
    status: "Closed",
    source: "Portfolio Review Clinic",
    assignedRep: "Johnny Conran",
    conversationSummary: "Closed after deciding to pause investing this year.",
    profileNotes: "Keep warm for Q2 — asked not to chase until April.",
    stage: "Closed",
    qualificationPct: 30,
    outreachNote: "Paused until Q2",
    lastContactedAt: isoDaysAgo(12, 10),
    lastResponseAt: isoDaysAgo(12, 11),
    handoffRequested: false,
    whatsappConsent: true,
    optedOut: false,
    funding: "Cash + mortgage",
    timeline: "Next year",
    preferredLocations: ["Bristol", "Bath"],
  },
];

const leadCount = whatsappLeads.length;
const highIntentCount = whatsappLeads.filter((l) => l.interest === "High").length;
const handoffCount = whatsappLeads.filter((l) => l.status === "Human Handoff").length;
const activeCount = whatsappLeads.filter(
  (l) => l.status === "Active Conversation",
).length;
const newCount = whatsappLeads.filter((l) => l.status === "New").length;
const contactedCount = whatsappLeads.filter(
  (l) =>
    l.lastContactedAt != null &&
    !["New", "Not Contacted", "Opted Out"].includes(l.status),
).length;
const respondedCount = whatsappLeads.filter((l) => l.lastResponseAt != null).length;
const responsePct = contactedCount
  ? Math.round((respondedCount / contactedCount) * 100)
  : 0;
const noResponsePct = Math.max(0, 100 - responsePct);
const bookingCount = whatsappLeads.filter((l) => l.status === "Qualified").length;

export const overviewMetrics: OverviewMetric[] = [
  {
    key: "total",
    label: "Total leads",
    value: String(leadCount),
    hint: "In lead pool",
  },
  {
    key: "new",
    label: "New leads",
    value: String(newCount),
    hint: "Awaiting outreach",
    tone: "up",
  },
  {
    key: "contacted",
    label: "Contacted",
    value: String(contactedCount),
    hint: "Business-initiated",
  },
  {
    key: "active",
    label: "Active conversations",
    value: String(activeCount),
    hint: "Live with Joe",
  },
  {
    key: "response",
    label: "Response rate",
    value: `${responsePct}%`,
    hint: "Of contacted",
    tone: "up",
  },
  {
    key: "no_response",
    label: "No response",
    value: `${noResponsePct}%`,
    hint: "Of contacted",
    tone: "down",
  },
  {
    key: "high_intent",
    label: "High intent",
    value: String(highIntentCount),
    hint: "Ready for rep",
    tone: "up",
  },
  {
    key: "handoffs",
    label: "Human handoffs",
    value: String(handoffCount),
    hint: "Automation paused",
    tone: "down",
  },
  {
    key: "bookings",
    label: "Bookings",
    value: String(bookingCount),
    hint: "Consultations",
    tone: "up",
  },
  {
    key: "webinars",
    label: "Upcoming webinars",
    value: "10",
    hint: "Relevance matched",
  },
];

/** Demo chart series — UI-only until WhatsApp worker APIs exist. */
export const engagementSeries = [
  { label: "W1", contacted: 5, responses: 3 },
  { label: "W2", contacted: 7, responses: 5 },
  { label: "W3", contacted: 6, responses: 4 },
  { label: "W4", contacted: 9, responses: 7 },
];

/** Tiny sparkline values for overview KPI cards. */
export const metricSparks: Record<string, number[]> = {
  total: [4, 5, 6, 8, 9, 11, leadCount],
  new: [0, 1, 0, 2, 1, 0, newCount],
  contacted: [2, 3, 4, 5, 6, 7, contactedCount],
  active: [0, 1, 1, 0, 1, 1, activeCount],
  response: [40, 48, 55, 62, 58, 68, responsePct],
  no_response: [60, 52, 45, 38, 42, 32, noResponsePct],
  high_intent: [1, 1, 2, 2, 3, 3, highIntentCount],
  handoffs: [0, 0, 1, 1, 1, 1, handoffCount],
  bookings: [0, 0, 0, 1, 1, 1, bookingCount],
  webinars: [4, 6, 7, 8, 9, 10, 10],
};

export const pipelineByStatus: { status: LeadStatus; count: number }[] = (
  [
    "Active Conversation",
    "High Intent",
    "Qualified",
    "Human Handoff",
    "Nurture",
    "Contacted",
    "No Response",
    "Not Contacted",
    "New",
    "Closed",
    "Opted Out",
  ] as LeadStatus[]
)
  .map((status) => ({
    status,
    count: whatsappLeads.filter((l) => l.status === status).length,
  }))
  .filter((row) => row.count > 0);

export const whatsappActivitySeries = [
  { label: "Mon", responses: 6, highIntent: 2 },
  { label: "Tue", responses: 8, highIntent: 3 },
  { label: "Wed", responses: 5, highIntent: 1 },
  { label: "Thu", responses: 9, highIntent: 4 },
  { label: "Fri", responses: 7, highIntent: 3 },
  { label: "Sat", responses: 4, highIntent: 2 },
  { label: "Sun", responses: 3, highIntent: 1 },
];

const ukCount = whatsappLeads.filter((l) => l.market === "UK").length;
const uaeCount = whatsappLeads.filter((l) => l.market === "UAE").length;
const bothCount = whatsappLeads.filter((l) => l.market === "UK + UAE").length;
const undecidedCount = whatsappLeads.filter((l) => l.market === "Undecided").length;

export const marketInterest = [
  {
    market: "UK",
    pct: Math.round((ukCount / leadCount) * 100),
    count: ukCount,
  },
  {
    market: "UAE",
    pct: Math.round((uaeCount / leadCount) * 100),
    count: uaeCount,
  },
  {
    market: "UK + UAE",
    pct: Math.round((bothCount / leadCount) * 100),
    count: bothCount,
  },
  {
    market: "Undecided",
    pct: Math.round((undecidedCount / leadCount) * 100),
    count: undecidedCount,
  },
].filter((row) => row.count > 0);

export const recentActivity: ActivityItem[] = [
  {
    id: "act-1",
    leadId: "lead-layla",
    leadName: "Layla Ibrahim",
    initials: "LI",
    summary: "Ready to view Abu Dhabi off-plan — asking for a same-week call.",
    at: isoDaysAgo(0, 16, 5),
  },
  {
    id: "act-2",
    leadId: "lead-sarah",
    leadName: "Sarah Jones",
    initials: "SJ",
    summary:
      "Discussing Birmingham stock and mortgage eligibility ahead of the next UK webinar.",
    at: isoDaysAgo(0, 20, 1),
  },
  {
    id: "act-3",
    leadId: "lead-priya",
    leadName: "Priya Patel",
    initials: "PP",
    summary:
      "High intent — requesting an advisor call on Leeds stock within 2 months.",
    at: isoDaysAgo(1, 14, 40),
  },
  {
    id: "act-4",
    leadId: "lead-fatima",
    leadName: "Fatima Al-Sayed",
    initials: "FA",
    summary: "Qualified cash buyer for Birmingham — consultation booked.",
    at: isoDaysAgo(1, 14, 5),
  },
  {
    id: "act-5",
    leadId: "lead-elena",
    leadName: "Elena Rossi",
    initials: "ER",
    summary: "Requested a human advisor — automation paused until resume.",
    at: isoDaysAgo(2, 21, 12),
  },
  {
    id: "act-6",
    leadId: "lead-noah",
    leadName: "Noah Williams",
    initials: "NW",
    summary: "Opened the Leeds webinar invite and replied with budget range.",
    at: isoDaysAgo(2, 12, 15),
  },
  {
    id: "act-7",
    leadId: "lead-ahmed",
    leadName: "Ahmed Hassan",
    initials: "AH",
    summary:
      "On a light nurture cadence while he researches Dubai cash purchases.",
    at: isoDaysAgo(3, 16, 20),
  },
  {
    id: "act-8",
    leadId: "lead-chris",
    leadName: "Chris Nguyen",
    initials: "CN",
    summary: "No reply after first qualification opener about London.",
    at: isoDaysAgo(5, 22),
  },
];

function audienceFromLeads(ids: string[]): AudiencePreview {
  const matched = whatsappLeads.filter((l) => ids.includes(l.id));
  const total = whatsappLeads.length;
  const matching = matched.length;
  const optedOut = matched.filter((l) => l.optedOut).length;
  const excludedNoConsent = matched.filter(
    (l) => !l.whatsappConsent && !l.optedOut,
  ).length;
  const whatsappEligible = matched.filter(
    (l) => l.whatsappConsent && !l.optedOut,
  ).length;
  return {
    total,
    matching,
    whatsappEligible,
    excludedNoConsent,
    optedOut,
    finalAudience: whatsappEligible,
  };
}

export const whatsappWebinars: WhatsAppWebinar[] = [
  {
    id: "web-uk-invest",
    title: "How to Invest in UK Property",
    market: "UK",
    scheduledAt: isoDaysAhead(3, 18),
    timezone: "GMT",
    status: "Active",
    outreachMode: "Manual",
    relevantLeadIds: [
      "lead-sarah",
      "lead-elena",
      "lead-fatima",
      "lead-james",
      "lead-chris",
      "lead-priya",
      "lead-noah",
      "lead-maya",
    ],
    engagement: {
      invited: 48,
      opened: 31,
      replied: 18,
      registered: 12,
      attended: 0,
    },
    audience: audienceFromLeads([
      "lead-sarah",
      "lead-elena",
      "lead-fatima",
      "lead-james",
      "lead-chris",
      "lead-priya",
      "lead-noah",
      "lead-maya",
    ]),
    suggestedCriteria: [
      "Market focus: UK",
      "Interest: High or Medium",
      "WhatsApp consent: yes",
      "Status not Opted Out",
    ],
    description:
      "Introductory session covering UK regions, yields, and first-time investor pathways.",
  },
  {
    id: "web-bham",
    title: "Birmingham Investment Opportunities",
    market: "UK",
    scheduledAt: isoDaysAhead(8, 17, 30),
    timezone: "GMT",
    status: "Scheduled",
    outreachMode: "Automatic",
    relevantLeadIds: ["lead-sarah", "lead-fatima", "lead-maya"],
    engagement: {
      invited: 24,
      opened: 14,
      replied: 8,
      registered: 5,
      attended: 0,
    },
    audience: audienceFromLeads(["lead-sarah", "lead-fatima", "lead-maya"]),
    suggestedCriteria: [
      "Preferred locations include Birmingham",
      "Budget ≥ £200k",
      "Readiness: Near Term or Ready Now",
    ],
    description:
      "Deep dive into Birmingham regeneration schemes and Joseph Mews stock.",
  },
  {
    id: "web-dubai",
    title: "Dubai Property Market Briefing",
    market: "UAE",
    scheduledAt: isoDaysAhead(12, 19),
    timezone: "GST",
    status: "Scheduled",
    outreachMode: "Manual",
    relevantLeadIds: ["lead-ahmed", "lead-layla", "lead-maya"],
    engagement: {
      invited: 22,
      opened: 14,
      replied: 6,
      registered: 4,
      attended: 0,
    },
    audience: audienceFromLeads(["lead-ahmed", "lead-layla", "lead-maya"]),
    suggestedCriteria: [
      "Market focus: UAE",
      "Funding: Cash",
      "WhatsApp eligible",
    ],
    description: "Off-plan and ready stock briefing for UAE-based buyers.",
  },
  {
    id: "web-leeds",
    title: "Leeds & Yorkshire Yield Walkthrough",
    market: "UK",
    scheduledAt: isoDaysAhead(5, 18, 30),
    timezone: "GMT",
    status: "Scheduled",
    outreachMode: "Automatic",
    relevantLeadIds: ["lead-priya", "lead-james", "lead-chris", "lead-noah"],
    engagement: {
      invited: 36,
      opened: 21,
      replied: 11,
      registered: 8,
      attended: 0,
    },
    audience: audienceFromLeads([
      "lead-priya",
      "lead-james",
      "lead-chris",
      "lead-noah",
    ]),
    suggestedCriteria: [
      "Preferred locations: Leeds / Yorkshire",
      "Interest High or Medium",
      "Not Opted Out",
    ],
    description: "Yield-focused walkthrough of Leeds and Yorkshire inventory.",
  },
  {
    id: "web-uk-uae",
    title: "UK vs UAE: Where to Deploy Capital",
    market: "UK + UAE",
    scheduledAt: isoDaysAhead(16, 17),
    timezone: "GMT",
    status: "Draft",
    outreachMode: "Manual",
    relevantLeadIds: [
      "lead-ahmed",
      "lead-elena",
      "lead-chris",
      "lead-sarah",
      "lead-maya",
      "lead-layla",
    ],
    engagement: {
      invited: 0,
      opened: 0,
      replied: 0,
      registered: 0,
      attended: 0,
    },
    audience: audienceFromLeads([
      "lead-ahmed",
      "lead-elena",
      "lead-chris",
      "lead-sarah",
      "lead-maya",
      "lead-layla",
    ]),
    suggestedCriteria: [
      "Market: UK, UAE, or UK + UAE",
      "Budget ≥ £200k",
      "Exploring or Near Term readiness",
    ],
    description:
      "Comparative session for investors weighing UK and UAE allocation.",
  },
  {
    id: "web-starter",
    title: "First-Time Investor Starter Session",
    market: "UK",
    scheduledAt: isoDaysAhead(20, 18),
    timezone: "GMT",
    status: "Scheduled",
    outreachMode: "Automatic",
    relevantLeadIds: ["lead-james", "lead-tom", "lead-chris", "lead-noah", "lead-maya"],
    engagement: {
      invited: 40,
      opened: 18,
      replied: 7,
      registered: 5,
      attended: 0,
    },
    audience: audienceFromLeads([
      "lead-james",
      "lead-chris",
      "lead-noah",
      "lead-maya",
    ]),
    suggestedCriteria: [
      "Status: New / Not Contacted / Exploring",
      "First-time investor signals",
      "WhatsApp consent",
    ],
    description: "Friendly intro for first-time UK property investors.",
  },
  {
    id: "web-manc",
    title: "Manchester Regeneration Spotlight",
    market: "UK",
    scheduledAt: isoDaysAhead(24, 18),
    timezone: "GMT",
    status: "Scheduled",
    outreachMode: "Manual",
    relevantLeadIds: ["lead-elena", "lead-sarah", "lead-fatima", "lead-maya"],
    engagement: {
      invited: 28,
      opened: 16,
      replied: 9,
      registered: 6,
      attended: 0,
    },
    audience: audienceFromLeads([
      "lead-elena",
      "lead-sarah",
      "lead-fatima",
      "lead-maya",
    ]),
    suggestedCriteria: [
      "Preferred locations include Manchester",
      "Interest Medium+",
      "Not Opted Out",
    ],
    description: "Manchester schemes and regeneration narrative for investors.",
  },
  {
    id: "web-auh",
    title: "Abu Dhabi Off-Plan Masterclass",
    market: "UAE",
    scheduledAt: isoDaysAhead(28, 20),
    timezone: "GST",
    status: "Draft",
    outreachMode: "Automatic",
    relevantLeadIds: ["lead-ahmed", "lead-layla"],
    engagement: {
      invited: 0,
      opened: 0,
      replied: 0,
      registered: 0,
      attended: 0,
    },
    audience: audienceFromLeads(["lead-ahmed", "lead-layla"]),
    suggestedCriteria: [
      "Market: UAE",
      "Cash buyers preferred",
      "WhatsApp eligible",
    ],
    description: "Off-plan masterclass focused on Abu Dhabi opportunities.",
  },
  {
    id: "web-portfolio",
    title: "Portfolio Review Clinic",
    market: "UK",
    scheduledAt: isoDaysAhead(35, 17, 30),
    timezone: "GMT",
    status: "Scheduled",
    outreachMode: "Manual",
    relevantLeadIds: ["lead-fatima", "lead-chris", "lead-priya", "lead-noah"],
    engagement: {
      invited: 20,
      opened: 12,
      replied: 8,
      registered: 5,
      attended: 0,
    },
    audience: audienceFromLeads([
      "lead-fatima",
      "lead-chris",
      "lead-priya",
      "lead-noah",
    ]),
    suggestedCriteria: [
      "Qualified or High Intent",
      "Budget ≥ £180k",
      "Active conversation history",
    ],
    description: "Clinic-style session for investors reviewing portfolio fit.",
  },
  {
    id: "web-tax",
    title: "Tax & Structuring for Overseas Buyers",
    market: "UK",
    scheduledAt: isoDaysAhead(42, 12),
    timezone: "GMT",
    status: "Scheduled",
    outreachMode: "Automatic",
    relevantLeadIds: [
      "lead-elena",
      "lead-ahmed",
      "lead-fatima",
      "lead-chris",
      "lead-layla",
    ],
    engagement: {
      invited: 34,
      opened: 19,
      replied: 10,
      registered: 7,
      attended: 0,
    },
    audience: audienceFromLeads([
      "lead-elena",
      "lead-ahmed",
      "lead-fatima",
      "lead-chris",
      "lead-layla",
    ]),
    suggestedCriteria: [
      "Overseas / remittance questions",
      "Market UK or UAE",
      "Handoff or High Intent preferred",
    ],
    description:
      "Tax and structuring overview for overseas buyers entering UK stock.",
  },
  {
    id: "web-completed-demo",
    title: "Spring Investor Roundtable (past)",
    market: "UK",
    scheduledAt: isoDaysAgo(40, 18),
    timezone: "GMT",
    status: "Completed",
    outreachMode: "Manual",
    relevantLeadIds: ["lead-sarah", "lead-fatima"],
    engagement: {
      invited: 55,
      opened: 40,
      replied: 22,
      registered: 18,
      attended: 14,
    },
    audience: audienceFromLeads(["lead-sarah", "lead-fatima"]),
    suggestedCriteria: ["Historical — completed campaign"],
    description: "Completed spring roundtable used for engagement baselines.",
  },
  {
    id: "web-cancelled-demo",
    title: "Cancelled Soft Launch Briefing",
    market: "UK",
    scheduledAt: isoDaysAgo(20, 17),
    timezone: "GMT",
    status: "Cancelled",
    outreachMode: "Automatic",
    relevantLeadIds: [],
    engagement: {
      invited: 10,
      opened: 2,
      replied: 0,
      registered: 0,
      attended: 0,
    },
    audience: audienceFromLeads([]),
    suggestedCriteria: [],
    description: "Cancelled before outreach — kept for status demo.",
  },
];

overviewMetrics.find((m) => m.key === "webinars")!.value = String(
  whatsappWebinars.filter((w) =>
    ["Draft", "Scheduled", "Active"].includes(w.status),
  ).length,
);

export const uploadHistorySeed: UploadHistoryItem[] = [
  {
    id: "up-1",
    fileName: "november-leads.xlsx",
    uploadedAt: isoDaysAgo(1, 10, 15),
    uploadedBy: "Amelia Hart",
    rowsTotal: 42,
    rowsNew: 28,
    rowsDuplicate: 10,
    rowsInvalid: 4,
    status: "Partial",
  },
  {
    id: "up-2",
    fileName: "webinar-registrants-uk.csv",
    uploadedAt: isoDaysAgo(4, 14, 40),
    uploadedBy: "Johnny Conran",
    rowsTotal: 65,
    rowsNew: 51,
    rowsDuplicate: 12,
    rowsInvalid: 2,
    status: "Completed",
  },
  {
    id: "up-3",
    fileName: "uae-cash-buyers.xlsx",
    uploadedAt: isoDaysAgo(8, 9, 5),
    uploadedBy: "Amelia Hart",
    rowsTotal: 18,
    rowsNew: 15,
    rowsDuplicate: 3,
    rowsInvalid: 0,
    status: "Completed",
  },
  {
    id: "up-4",
    fileName: "manchester-inbound.csv",
    uploadedAt: isoDaysAgo(12, 11, 20),
    uploadedBy: "Johnny Conran",
    rowsTotal: 31,
    rowsNew: 22,
    rowsDuplicate: 7,
    rowsInvalid: 2,
    status: "Partial",
  },
];

export function getLeadById(id: string): WhatsAppLead | undefined {
  return whatsappLeads.find((l) => l.id === id);
}

export function getWebinarById(id: string): WhatsAppWebinar | undefined {
  return whatsappWebinars.find((w) => w.id === id);
}

export function leadsNeedingAttention(): WhatsAppLead[] {
  return whatsappLeads.filter((l) =>
    ["High Intent", "Human Handoff", "Active Conversation", "Qualified"].includes(
      l.status,
    ),
  );
}

export function upcomingWebinars(): WhatsAppWebinar[] {
  return whatsappWebinars
    .filter((w) => ["Draft", "Scheduled", "Active"].includes(w.status))
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
}

export function leadInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Client-side mock parse of a lead sheet (no real XLSX parsing). */
export function mockParseLeadSheet(file: File): {
  rowsTotal: number;
  rowsNew: number;
  rowsDuplicate: number;
  rowsInvalid: number;
  status: UploadHistoryItem["status"];
} {
  const base = Math.max(12, Math.min(80, Math.round(file.size / 1800) || 24));
  const rowsInvalid = Math.min(5, Math.floor(base * 0.08));
  const rowsDuplicate = Math.min(12, Math.floor(base * 0.18));
  const rowsNew = Math.max(0, base - rowsDuplicate - rowsInvalid);
  const status: UploadHistoryItem["status"] =
    rowsInvalid > 0 ? "Partial" : rowsNew === 0 ? "Failed" : "Completed";
  return {
    rowsTotal: base,
    rowsNew,
    rowsDuplicate,
    rowsInvalid,
    status,
  };
}
