/** Mock data for WhatsApp Sales Worker mode — UI-only, no API. */

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

export const overviewMetrics: OverviewMetric[] = [
  { key: "total", label: "Total leads", value: "8", hint: "In lead pool" },
  { key: "new", label: "New leads", value: "1", hint: "Awaiting outreach", tone: "up" },
  { key: "contacted", label: "Contacted", value: "7", hint: "Business-initiated" },
  {
    key: "active",
    label: "Active conversations",
    value: "1",
    hint: "Live with Joe",
  },
  {
    key: "response",
    label: "Response rate",
    value: "71%",
    hint: "Of contacted",
    tone: "up",
  },
  {
    key: "no_response",
    label: "No response",
    value: "29%",
    hint: "Of contacted",
    tone: "down",
  },
  {
    key: "high_intent",
    label: "High intent",
    value: "3",
    hint: "Ready for rep",
    tone: "up",
  },
  {
    key: "handoffs",
    label: "Human handoffs",
    value: "1",
    hint: "Automation paused",
    tone: "down",
  },
  { key: "bookings", label: "Bookings", value: "1", hint: "Consultations", tone: "up" },
  {
    key: "webinars",
    label: "Upcoming webinars",
    value: "12",
    hint: "Relevance matched",
  },
];

/** Demo chart series — UI-only until WhatsApp worker APIs exist. */
export const engagementSeries = [
  { label: "W1", contacted: 4, responses: 2 },
  { label: "W2", contacted: 6, responses: 4 },
  { label: "W3", contacted: 5, responses: 3 },
  { label: "W4", contacted: 7, responses: 5 },
];

/** Tiny sparkline values for overview KPI cards. */
export const metricSparks: Record<string, number[]> = {
  total: [3, 4, 5, 6, 6, 7, 8],
  new: [0, 1, 0, 2, 1, 0, 1],
  contacted: [1, 2, 3, 4, 5, 6, 7],
  active: [0, 1, 1, 0, 1, 1, 1],
  response: [40, 48, 55, 62, 58, 68, 71],
  no_response: [60, 52, 45, 38, 42, 32, 29],
  high_intent: [0, 1, 1, 2, 2, 3, 3],
  handoffs: [0, 0, 1, 1, 1, 1, 1],
  bookings: [0, 0, 0, 0, 1, 1, 1],
  webinars: [4, 6, 7, 8, 9, 11, 12],
};

export const pipelineByStatus: { status: LeadStatus; count: number }[] = [
  { status: "Active Conversation", count: 1 },
  { status: "High Intent", count: 1 },
  { status: "Qualified", count: 1 },
  { status: "Human Handoff", count: 1 },
  { status: "Nurture", count: 1 },
  { status: "No Response", count: 1 },
  { status: "Not Contacted", count: 1 },
  { status: "Opted Out", count: 1 },
];

export const whatsappActivitySeries = [
  { label: "Mon", responses: 6, highIntent: 2 },
  { label: "Tue", responses: 8, highIntent: 3 },
  { label: "Wed", responses: 5, highIntent: 1 },
  { label: "Thu", responses: 9, highIntent: 4 },
  { label: "Fri", responses: 7, highIntent: 3 },
  { label: "Sat", responses: 4, highIntent: 2 },
  { label: "Sun", responses: 3, highIntent: 1 },
];

export const marketInterest = [
  { market: "UK", pct: 48, count: 42 },
  { market: "UAE", pct: 32, count: 28 },
  { market: "UK + UAE", pct: 13, count: 11 },
  { market: "Undecided", pct: 8, count: 7 },
];

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
      "Discussing Birmingham stock and mortgage eligibility ahead of the September UK webinar.",
    profileNotes:
      "Interested in Birmingham property. Mortgage-funded. Budget around £250k and expects to invest within four months. Responded positively to UK webinar campaign.",
    stage: "Qualification - budget & location",
    qualificationPct: 65,
    outreachNote: "Entered qualification",
    lastContactedAt: "2026-09-03T19:30:00Z",
    lastResponseAt: "2026-09-03T20:01:00Z",
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
      "High intent - requesting an advisor call on Leeds stock within 2 months.",
    profileNotes:
      "Strong interest in Leeds yield stock. Asking for advisor availability this week. Budget flexible around £180k with deposit ready.",
    stage: "Consultation request",
    qualificationPct: 82,
    outreachNote: "Requested advisor call",
    lastContactedAt: "2026-09-04T13:10:00Z",
    lastResponseAt: "2026-09-04T14:40:00Z",
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
      "Requested a human advisor - automation paused until resume.",
    profileNotes:
      "Overseas buyer based in Milan. Prefers speaking with a human about tax and remittance before continuing WhatsApp automation.",
    stage: "Human handoff",
    qualificationPct: 55,
    outreachNote: "Automation paused",
    lastContactedAt: "2026-09-02T20:40:00Z",
    lastResponseAt: "2026-09-02T21:12:00Z",
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
      "Qualified cash buyer for Birmingham - consultation booked.",
    profileNotes:
      "Cash buyer targeting Birmingham. Consultation booked with Johnny. Strong fit for off-plan and completed stock.",
    stage: "Consultation booked",
    qualificationPct: 90,
    outreachNote: "Booked consultation",
    lastContactedAt: "2026-09-05T13:20:00Z",
    lastResponseAt: "2026-09-05T14:05:00Z",
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
    lastContactedAt: "2026-09-01T15:00:00Z",
    lastResponseAt: "2026-09-01T16:20:00Z",
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
    conversationSummary: "Imported lead - no outreach yet.",
    profileNotes:
      "Imported from September lead sheet. Phone valid; email pending verification. No conversation started.",
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
    conversationSummary: "Opted out - excluded from further WhatsApp outreach.",
    profileNotes: "Explicitly opted out of WhatsApp messaging. Keep in CRM only.",
    stage: "Opted out",
    qualificationPct: 10,
    outreachNote: "Do not contact via WhatsApp",
    lastContactedAt: "2026-08-20T16:30:00Z",
    lastResponseAt: "2026-08-20T17:00:00Z",
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
    lastContactedAt: "2026-08-28T22:00:00Z",
    lastResponseAt: null,
    handoffRequested: false,
    whatsappConsent: true,
    optedOut: false,
    funding: "Cash + mortgage",
    timeline: "6 months",
    preferredLocations: ["London"],
  },
];

export const recentActivity: ActivityItem[] = [
  {
    id: "act-1",
    leadId: "lead-fatima",
    leadName: "Fatima Al-Sayed",
    initials: "FA",
    summary: "Qualified cash buyer for Birmingham - consultation booked.",
    at: "2026-09-05T14:05:00Z",
  },
  {
    id: "act-2",
    leadId: "lead-priya",
    leadName: "Priya Patel",
    initials: "PP",
    summary:
      "High intent - requesting an advisor call on Leeds stock within 2 months.",
    at: "2026-09-04T14:40:00Z",
  },
  {
    id: "act-3",
    leadId: "lead-sarah",
    leadName: "Sarah Jones",
    initials: "SJ",
    summary:
      "Discussing Birmingham stock and mortgage eligibility ahead of the September UK webinar.",
    at: "2026-09-03T20:01:00Z",
  },
  {
    id: "act-4",
    leadId: "lead-elena",
    leadName: "Elena Rossi",
    initials: "ER",
    summary: "Requested a human advisor - automation paused until resume.",
    at: "2026-09-02T21:12:00Z",
  },
  {
    id: "act-5",
    leadId: "lead-ahmed",
    leadName: "Ahmed Hassan",
    initials: "AH",
    summary:
      "On a light nurture cadence while he researches Dubai cash purchases.",
    at: "2026-09-01T16:20:00Z",
  },
  {
    id: "act-6",
    leadId: "lead-chris",
    leadName: "Chris Nguyen",
    initials: "CN",
    summary: "No reply after first qualification opener about London.",
    at: "2026-08-28T23:00:00Z",
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
    scheduledAt: "2026-09-18T18:00:00+01:00",
    timezone: "GMT+1",
    status: "Scheduled",
    outreachMode: "Manual",
    relevantLeadIds: [
      "lead-sarah",
      "lead-elena",
      "lead-fatima",
      "lead-james",
      "lead-chris",
      "lead-priya",
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
    scheduledAt: "2026-10-02T17:30:00+01:00",
    timezone: "GMT+1",
    status: "Draft",
    outreachMode: "Automatic",
    relevantLeadIds: ["lead-sarah", "lead-fatima"],
    engagement: {
      invited: 0,
      opened: 0,
      replied: 0,
      registered: 0,
      attended: 0,
    },
    audience: audienceFromLeads(["lead-sarah", "lead-fatima"]),
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
    scheduledAt: "2026-10-16T19:00:00+04:00",
    timezone: "GST",
    status: "Scheduled",
    outreachMode: "Manual",
    relevantLeadIds: ["lead-ahmed"],
    engagement: {
      invited: 22,
      opened: 14,
      replied: 6,
      registered: 4,
      attended: 0,
    },
    audience: audienceFromLeads(["lead-ahmed"]),
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
    scheduledAt: "2026-11-05T18:30:00Z",
    timezone: "GMT",
    status: "Active",
    outreachMode: "Automatic",
    relevantLeadIds: ["lead-priya", "lead-james", "lead-chris"],
    engagement: {
      invited: 36,
      opened: 21,
      replied: 11,
      registered: 8,
      attended: 0,
    },
    audience: audienceFromLeads(["lead-priya", "lead-james", "lead-chris"]),
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
    scheduledAt: "2026-11-20T17:00:00Z",
    timezone: "GMT",
    status: "Draft",
    outreachMode: "Manual",
    relevantLeadIds: ["lead-ahmed", "lead-elena", "lead-chris", "lead-sarah"],
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
    scheduledAt: "2026-12-04T18:00:00Z",
    timezone: "GMT",
    status: "Scheduled",
    outreachMode: "Automatic",
    relevantLeadIds: ["lead-james", "lead-tom", "lead-chris"],
    engagement: {
      invited: 40,
      opened: 18,
      replied: 7,
      registered: 5,
      attended: 0,
    },
    audience: audienceFromLeads(["lead-james", "lead-chris"]),
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
    scheduledAt: "2026-12-11T18:00:00Z",
    timezone: "GMT",
    status: "Scheduled",
    outreachMode: "Manual",
    relevantLeadIds: ["lead-elena", "lead-sarah", "lead-fatima"],
    engagement: {
      invited: 28,
      opened: 16,
      replied: 9,
      registered: 6,
      attended: 0,
    },
    audience: audienceFromLeads(["lead-elena", "lead-sarah", "lead-fatima"]),
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
    scheduledAt: "2026-12-18T20:00:00+04:00",
    timezone: "GST",
    status: "Draft",
    outreachMode: "Automatic",
    relevantLeadIds: ["lead-ahmed"],
    engagement: {
      invited: 0,
      opened: 0,
      replied: 0,
      registered: 0,
      attended: 0,
    },
    audience: audienceFromLeads(["lead-ahmed"]),
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
    scheduledAt: "2027-01-08T17:30:00Z",
    timezone: "GMT",
    status: "Scheduled",
    outreachMode: "Manual",
    relevantLeadIds: ["lead-fatima", "lead-chris", "lead-priya"],
    engagement: {
      invited: 20,
      opened: 12,
      replied: 8,
      registered: 5,
      attended: 0,
    },
    audience: audienceFromLeads(["lead-fatima", "lead-chris", "lead-priya"]),
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
    scheduledAt: "2027-01-15T12:00:00Z",
    timezone: "GMT",
    status: "Scheduled",
    outreachMode: "Automatic",
    relevantLeadIds: ["lead-elena", "lead-ahmed", "lead-fatima", "lead-chris"],
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
    scheduledAt: "2026-03-12T18:00:00Z",
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
    scheduledAt: "2026-08-01T17:00:00Z",
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

export const uploadHistorySeed: UploadHistoryItem[] = [
  {
    id: "up-1",
    fileName: "september-leads.xlsx",
    uploadedAt: "2026-09-01T10:15:00Z",
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
    uploadedAt: "2026-08-22T14:40:00Z",
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
    uploadedAt: "2026-08-10T09:05:00Z",
    uploadedBy: "Amelia Hart",
    rowsTotal: 18,
    rowsNew: 15,
    rowsDuplicate: 3,
    rowsInvalid: 0,
    status: "Completed",
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
