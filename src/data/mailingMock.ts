/** Mock data for Admin Mailing Service — UI only, APIs later. */

export type MailFolder = "inbox" | "important" | "sent" | "drafts" | "trash";

export type MailMessage = {
  id: string;
  folder: MailFolder;
  fromName: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  subject: string;
  preview: string;
  body: string;
  sentAt: string;
  unread: boolean;
  important: boolean;
  starred: boolean;
};

export type MailTemplate = {
  id: string;
  name: string;
  subject: string;
  category: "Onboarding" | "Investor" | "Property" | "Ops";
  updatedAt: string;
  body: string;
  usageCount: number;
};

export type MailCampaignStatus =
  | "Draft"
  | "Scheduled"
  | "Sending"
  | "Sent"
  | "Paused";

export type MailCampaign = {
  id: string;
  name: string;
  subject: string;
  templateId: string | null;
  audienceLabel: string;
  status: MailCampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  stats: {
    recipients: number;
    delivered: number;
    opened: number;
    clicked: number;
  };
};

export const mailMessages: MailMessage[] = [
  {
    id: "m1",
    folder: "inbox",
    fromName: "Priya Shah",
    fromEmail: "priya.shah@example.com",
    to: ["ops@joseph-mews.com"],
    cc: [],
    subject: "Question on Penny Place yield assumptions",
    preview:
      "Could you confirm the net yield figure shown in the investor pack for unit 04?",
    body: `Hi team,

Could you confirm the net yield figure shown in the investor pack for Penny Place unit 04? My client is comparing it against Lombe House and wants clarity on service charge assumptions.

Thanks,
Priya`,
    sentAt: "2026-11-25T09:12:00Z",
    unread: true,
    important: true,
    starred: true,
  },
  {
    id: "m2",
    folder: "inbox",
    fromName: "James Whitaker",
    fromEmail: "james.w@example.com",
    to: ["ops@joseph-mews.com"],
    cc: ["agent@joseph-mews.com"],
    subject: "Invite not received — investor onboarding",
    preview:
      "I accepted the invite link yesterday but never received the set-password email.",
    body: `Hello,

I accepted the investor invite yesterday but never received the set-password email. Could you resend it to this address?

Kind regards,
James Whitaker`,
    sentAt: "2026-11-25T07:40:00Z",
    unread: true,
    important: false,
    starred: false,
  },
  {
    id: "m3",
    folder: "inbox",
    fromName: "JM Marketing",
    fromEmail: "marketing@joseph-mews.com",
    to: ["ops@joseph-mews.com"],
    cc: [],
    subject: "Draft: Graven Hill release announcement",
    preview:
      "Please review the investor email draft before Friday’s send window.",
    body: `Team,

Please review the attached Graven Hill release announcement before Friday’s send window. Tone should stay premium and calm — no hard sell.

JM Marketing`,
    sentAt: "2026-11-24T16:05:00Z",
    unread: false,
    important: true,
    starred: false,
  },
  {
    id: "m4",
    folder: "inbox",
    fromName: "Sophie Chen",
    fromEmail: "sophie.chen@example.com",
    to: ["ops@joseph-mews.com"],
    cc: [],
    subject: "Documents uploaded for KYC review",
    preview: "Passport and proof of address are now in my investor vault.",
    body: `Hi,

I’ve uploaded passport and proof of address to my investor vault. Please let me know if anything else is needed for verification.

Sophie`,
    sentAt: "2026-11-24T14:22:00Z",
    unread: false,
    important: false,
    starred: false,
  },
  {
    id: "m5",
    folder: "inbox",
    fromName: "Edward Clarke",
    fromEmail: "edward@qiko.ai",
    to: ["ops@joseph-mews.com"],
    cc: [],
    subject: "Re: Ownership assignment for Interchange Residences",
    preview: "Confirmed — happy for unit 12 to sit under my portfolio view.",
    body: `Confirmed — happy for unit 12 to sit under my portfolio view. Please send the summary once ownership is live.

Edward`,
    sentAt: "2026-11-23T11:18:00Z",
    unread: false,
    important: false,
    starred: true,
  },
  {
    id: "m6",
    folder: "important",
    fromName: "Compliance",
    fromEmail: "compliance@joseph-mews.com",
    to: ["ops@joseph-mews.com"],
    cc: ["superadmin@joseph-mews.com"],
    subject: "Action required: overdue investor document",
    preview: "Two investors have KYC docs expiring within 7 days.",
    body: `Action required.

Two investors have KYC documents expiring within 7 days. Please chase before the weekly compliance digest goes out.

Compliance`,
    sentAt: "2026-11-22T08:00:00Z",
    unread: true,
    important: true,
    starred: true,
  },
  {
    id: "m7",
    folder: "sent",
    fromName: "Joseph Mews Ops",
    fromEmail: "ops@joseph-mews.com",
    to: ["priya.shah@example.com"],
    cc: [],
    subject: "Re: Penny Place yield assumptions",
    preview: "Net yield uses the published assumptions pack dated Oct 2026…",
    body: `Hi Priya,

Net yield uses the published assumptions pack dated Oct 2026. Service charge is excluded from the headline net figure — we’ve clarified that in the latest investor note.

Best,
Joseph Mews Ops`,
    sentAt: "2026-11-25T10:02:00Z",
    unread: false,
    important: false,
    starred: false,
  },
  {
    id: "m8",
    folder: "sent",
    fromName: "Joseph Mews Ops",
    fromEmail: "ops@joseph-mews.com",
    to: ["james.w@example.com"],
    cc: [],
    subject: "Your Joseph Mews investor invite",
    preview: "We’ve resent your secure invite to set a password…",
    body: `Hi James,

We’ve resent your secure invite to set a password. The link expires in 48 hours.

Joseph Mews Ops`,
    sentAt: "2026-11-25T08:05:00Z",
    unread: false,
    important: false,
    starred: false,
  },
  {
    id: "m9",
    folder: "drafts",
    fromName: "Joseph Mews Ops",
    fromEmail: "ops@joseph-mews.com",
    to: ["investors@list.joseph-mews.com"],
    cc: [],
    subject: "Coming soon: Leeds Riverside registration",
    preview: "Draft campaign — register interest before release…",
    body: `Dear investor,

We’re opening early interest registration for Leeds Riverside. No commitment required — register to hear first when units are released.

Joseph Mews`,
    sentAt: "2026-11-24T12:00:00Z",
    unread: false,
    important: false,
    starred: false,
  },
  {
    id: "m10",
    folder: "trash",
    fromName: "Newsletter",
    fromEmail: "noreply@vendor.example",
    to: ["ops@joseph-mews.com"],
    cc: [],
    subject: "Unused vendor promo",
    preview: "Archived promotional mail.",
    body: "Archived promotional mail.",
    sentAt: "2026-11-10T09:00:00Z",
    unread: false,
    important: false,
    starred: false,
  },
];

export const mailTemplates: MailTemplate[] = [
  {
    id: "t1",
    name: "Investor invite",
    subject: "You're invited to Joseph Mews Investor Platform",
    category: "Onboarding",
    updatedAt: "2026-11-20T10:00:00Z",
    usageCount: 128,
    body: `Hi {{first_name}},

You've been invited to the Joseph Mews Investor Platform. Use the secure link below to set your password and access your portfolio.

{{invite_link}}

Joseph Mews`,
  },
  {
    id: "t2",
    name: "KYC reminder",
    subject: "Action needed: complete your verification documents",
    category: "Investor",
    updatedAt: "2026-11-18T14:30:00Z",
    usageCount: 64,
    body: `Hi {{first_name}},

To keep your account active, please upload any outstanding verification documents in your investor vault.

Joseph Mews Ops`,
  },
  {
    id: "t3",
    name: "Property update",
    subject: "Update on {{property_name}}",
    category: "Property",
    updatedAt: "2026-11-12T09:15:00Z",
    usageCount: 41,
    body: `Hi {{first_name}},

Here's a brief update on {{property_name}}. {{update_summary}}

View details in your portfolio when convenient.

Joseph Mews`,
  },
  {
    id: "t4",
    name: "Ownership confirmation",
    subject: "Ownership assigned — {{property_name}}",
    category: "Ops",
    updatedAt: "2026-11-05T16:40:00Z",
    usageCount: 22,
    body: `Hi {{first_name}},

{{property_name}} is now visible in your portfolio ownership view.

If anything looks incorrect, reply to this email and we’ll amend it.

Joseph Mews Ops`,
  },
];

export const mailCampaigns: MailCampaign[] = [
  {
    id: "c1",
    name: "Graven Hill release",
    subject: "New release: Graven Hill",
    templateId: "t3",
    audienceLabel: "Active UK investors · 186",
    status: "Scheduled",
    scheduledAt: "2026-11-28T09:00:00Z",
    sentAt: null,
    stats: { recipients: 186, delivered: 0, opened: 0, clicked: 0 },
  },
  {
    id: "c2",
    name: "KYC chase — November",
    subject: "Action needed: complete your verification documents",
    templateId: "t2",
    audienceLabel: "Investors with incomplete KYC · 42",
    status: "Sent",
    scheduledAt: null,
    sentAt: "2026-11-21T08:30:00Z",
    stats: { recipients: 42, delivered: 41, opened: 28, clicked: 11 },
  },
  {
    id: "c3",
    name: "Coming soon — Leeds Riverside",
    subject: "Register interest: Leeds Riverside",
    templateId: null,
    audienceLabel: "All active investors · 312",
    status: "Draft",
    scheduledAt: null,
    sentAt: null,
    stats: { recipients: 312, delivered: 0, opened: 0, clicked: 0 },
  },
  {
    id: "c4",
    name: "Invite wave — agents",
    subject: "You're invited to Joseph Mews Investor Platform",
    templateId: "t1",
    audienceLabel: "Pending invites · 18",
    status: "Sending",
    scheduledAt: null,
    sentAt: "2026-11-25T11:00:00Z",
    stats: { recipients: 18, delivered: 9, opened: 4, clicked: 2 },
  },
];

export function messagesForFolder(folder: MailFolder): MailMessage[] {
  if (folder === "important") {
    return mailMessages
      .filter((m) => m.important && m.folder !== "trash")
      .sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt));
  }
  return mailMessages
    .filter((m) => m.folder === folder)
    .sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt));
}

export function folderUnreadCount(folder: MailFolder): number {
  return messagesForFolder(folder).filter((m) => m.unread).length;
}

export function getTemplateName(id: string | null): string {
  if (!id) return "Custom";
  return mailTemplates.find((t) => t.id === id)?.name ?? "Template";
}
