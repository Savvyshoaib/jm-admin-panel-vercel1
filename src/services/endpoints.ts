/**
 * Admin API paths from JM Backend Postman collection.
 * Investor/user auth (`/api/auth/*`) is out of scope for this admin app.
 */
export const endpoints = {
  auth: {
    signup: "/admin/auth/signup",
    login: "/admin/auth/login",
    forgotPassword: "/admin/auth/forgot-password",
    resetPassword: "/admin/auth/reset-password",
    logout: "/admin/auth/logout",
    me: "/admin/auth/me",
  },
  dashboard: {
    stats: "/admin/dashboard/stats",
  },
  users: {
    list: "/admin/users",
    invite: "/admin/users/invite",
    inviteResend: "/admin/users/invite/resend",
    one: (adminId: string | number) => `/admin/users/${adminId}`,
  },
  agents: {
    list: "/admin/agents",
  },
  investors: {
    list: "/admin/investors",
    create: "/admin/investors",
    one: (id: string | number) => `/admin/investors/${id}`,
    notes: (id: string | number) => `/admin/investors/${id}/notes`,
    documents: (id: string | number) => `/admin/investors/${id}/documents`,
    document: (investorId: string | number, documentId: string | number) =>
      `/admin/investors/${investorId}/documents/${documentId}`,
    properties: (id: string | number) => `/admin/investors/${id}/properties`,
    property: (investorId: string | number, propertyId: string | number) =>
      `/admin/investors/${investorId}/properties/${propertyId}`,
    recommendedSort: (id: string | number) =>
      `/admin/investors/${id}/recommended-properties/sort`,
  },
  invitations: {
    list: "/admin/invitations",
    create: "/admin/invitations",
    one: (id: string | number) => `/admin/invitations/${id}`,
  },
  developments: {
    list: "/admin/developments",
    create: "/admin/developments",
    one: (id: string | number) => `/admin/developments/${id}`,
    sort: "/admin/developments/sort",
  },
  properties: {
    list: "/admin/properties",
    create: "/admin/properties",
    one: (id: string | number) => `/admin/properties/${id}`,
    sort: "/admin/properties/sort",
    publish: (id: string | number) => `/admin/properties/${id}/publish`,
    unpublish: (id: string | number) => `/admin/properties/${id}/unpublish`,
    duplicate: (id: string | number) => `/admin/properties/${id}/duplicate`,
    archive: (id: string | number) => `/admin/properties/${id}/archive`,
    unarchive: (id: string | number) => `/admin/properties/${id}/unarchive`,
    images: (id: string | number) => `/admin/properties/${id}/images`,
    ownership: "/admin/ownership",
  },
  enquiries: {
    list: "/admin/enquiries",
    one: (id: string | number) => `/admin/enquiries/${id}`,
  },
  documents: {
    folders: "/admin/folders",
    list: "/admin/documents",
    create: "/admin/documents",
    one: (id: string | number) => `/admin/documents/${id}`,
  },
  payments: {
    list: "/admin/payments",
    create: "/admin/payments",
    one: (id: string | number) => `/admin/payments/${id}`,
  },
  assumptions: {
    list: "/admin/assumptions",
    calculator: "/admin/assumptions/calculator",
    propertyInsights: "/admin/assumptions/property-insights",
    versions: (id: string | number) => `/admin/assumptions/${id}/versions`,
    one: (id: string | number) => `/admin/assumptions/${id}`,
  },
  calculatorFlows: {
    list: "/admin/calculator-flows",
    default: "/admin/calculator-flows/default",
    one: (flowId: string | number) => `/admin/calculator-flows/${flowId}`,
  },
  signals: {
    rules: "/admin/signal-rules",
    rule: (id: string | number) => `/admin/signal-rules/${id}`,
    list: "/admin/signals",
    one: (id: string | number) => `/admin/signals/${id}`,
  },
  activity: {
    list: "/admin/activity",
    audit: "/admin/audit",
  },
  qiko: {
    signals: "/admin/qiko/signals",
    activity: "/admin/qiko/activity",
    investor: (id: string | number) => `/admin/qiko/investors/${id}`,
    insightsPortfolio: "/admin/qiko/insights/portfolio",
    insightsProperty: "/admin/qiko/insights/property",
  },
  content: {
    list: "/admin/content",
    create: "/admin/content",
    one: (id: string | number) => `/admin/content/${id}`,
  },
  explore: {
    comingSoon: "/admin/explore/coming-soon",
  },
  settings: {
    get: "/admin/settings",
    update: "/admin/settings",
  },
  ukhpi: {
    logs: "/admin/ukhpi/logs",
    log: (id: string | number) => `/admin/ukhpi/logs/${id}`,
  },
} as const;
