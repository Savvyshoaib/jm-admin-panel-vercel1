export type Role = "super_admin" | "agent" | "viewer";

export type AccountStatus = "active" | "inactive" | "pending";
export type InvitationStatus =
  | "created"
  | "sent"
  | "delivered"
  | "opened"
  | "accepted"
  | "expired"
  | "revoked";
export type SignUpStatus = "not_invited" | "invited" | "signed_up" | "first_login";
export type IntentLevel = "low" | "medium" | "high" | "urgent";
export type ResidencyStatus = "uk_resident" | "non_uk_resident" | "unknown";

export type DevelopmentStatus =
  | "draft"
  | "coming_soon"
  | "available"
  | "sold_out"
  | "completed"
  | "archived";

export type PropertyStatus =
  | "draft"
  | "coming_soon"
  | "available"
  | "reserved"
  | "sold"
  | "completed"
  | "archived"
  | "tenanted"
  | "in_build"
  | "vacant";

export type EnquiryStatus =
  | "new"
  | "assigned"
  | "contacted"
  | "qualified"
  | "viewing_arranged"
  | "in_progress"
  | "open"
  | "closed"
  | "converted"
  | "not_interested";

export type SignalStatus =
  | "new"
  | "open"
  | "viewed"
  | "contact_planned"
  | "contacted"
  | "qualified"
  | "dismissed"
  | "converted";

export type PaymentMilestoneStatus = "upcoming" | "due" | "paid" | "overdue";
export type PaymentInstallmentStatus = "paid" | "due" | "upcoming";
export type ContentStatus = "draft" | "published";

/** Owned off-plan / in-build installment (investor-facing schedule). */
export interface PaymentInstallment {
  id: string;
  label: string;
  percent: number;
  amount: number;
  dueDate: string;
  paidAt?: string;
  status: PaymentInstallmentStatus;
}

export interface PaymentPlan {
  name: string;
  basisPrice: number;
  installments: PaymentInstallment[];
}

/** Explore marketplace plan — illustrative only (no paid/due state). */
export interface StandardPaymentStage {
  label: string;
  percent: number;
  trigger: string;
}

export interface StandardPaymentPlan {
  name: string;
  stages: StandardPaymentStage[];
}

/** Property-level mortgage offer sent as `mortgagePlans[]`. */
export type PropertyMortgagePlanType = "repayment" | "interest_only";

export interface PropertyMortgagePlan {
  name: string;
  type: PropertyMortgagePlanType;
  deposit: number;
  loanAmount: number;
  interestRate: number;
  monthlyPayment: number;
  termYears: number;
  ltvPct: number;
  /** Reservation fee (GBP). Optional until API confirms key. */
  reservationFee?: number;
  /** Mortgage start / offer date (YYYY-MM-DD). */
  mortgageDate?: string;
  /** When false, plan is inactive and hidden from investor assign. Default true. */
  active?: boolean;
}

/** Developer staged cash plan sent as `paymentSchedules[]`. */
export interface PropertyPaymentScheduleStage {
  label: string;
  amount: number;
  due: string;
  /** Calendar date for the stage (YYYY-MM-DD). Optional until API confirms. */
  date?: string;
}

export interface PropertyPaymentSchedule {
  name: string;
  summary: string;
  stages: PropertyPaymentScheduleStage[];
  /** When false, plan is inactive and hidden from investor assign. Default true. */
  active?: boolean;
}

/** Inventory row sent as `units[]` on create/update. */
export interface PropertyInventoryUnit {
  type: string;
  bedrooms: number;
  bathrooms: number;
  sizeSqft: number;
  floor: string;
  unitCount: number;
  /** Total units for this inventory type — API key `totalUnits`. */
  totalUnits?: number;
  /** Remaining units that can still be assigned (GET `availableCount`). */
  availableCount?: number;
  images?: string[];
  /** Active mortgage plans only on write; `null` clears inactive/removed plans. */
  mortgagePlans?: PropertyMortgagePlan[] | null;
  /** Active payment schedules only on write; `null` clears inactive/removed plans. */
  paymentSchedules?: PropertyPaymentSchedule[] | null;
  purchasePrice?: number;
  currentValue?: number;
  /** Monthly rent amount — API key `rentalEstimate`. */
  rentalEstimate?: number;
  /** Toggle mode — API key `rentalIncomeMode`: `current` | `expected`. */
  rentalIncomeMode?: "current" | "expected";
  /** Purchase / exchange date (YYYY-MM-DD). */
  purchaseDate?: string;
  /** Annual rental growth % assumption. */
  annualRentalGrowth?: number;
  /** Cost inflation % assumption. */
  costInflation?: number;
  serviceCharge?: number;
  groundRent?: number;
  managementFee?: number;
  projectedGrossYield?: number;
  projectedNetYield?: number;
  projectedCapitalGrowth?: number;
}
export type AssumptionScope =
  | "global"
  | "development"
  | "property"
  | "nationality"
  | "residency";

export interface InternalUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "inactive" | "invited";
  assignedInvestorIds: string[];
  lastLoginAt: string | null;
  invitationStatus: InvitationStatus | null;
  createdAt: string;
  /** Calendar booking link for agents — API key `calendlyUrl`. */
  calendlyUrl?: string;
  /** WhatsApp contact for agents — API key `whatsappNumber`. */
  whatsappNumber?: string;
}

export interface Investor {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  nationality: string;
  residencyStatus: ResidencyStatus;
  assignedAgentId: string | null;
  accountStatus: AccountStatus;
  invitationStatus: InvitationStatus | null;
  signUpStatus: SignUpStatus;
  intentLevel: IntentLevel;
  ownedPropertyCount: number;
  lastActiveAt: string | null;
  createdAt: string;
  investmentPreferences: string;
  buyingPower: number;
  investmentHorizon: string;
  riskAppetite: "cautious" | "balanced" | "growth";
  onboardingStatus: string;
  /**
   * Recommended Explore properties for this investor (array order = display order).
   * API also accepts/returns `recommendedProperties: [{ id, sortOrder }]`.
   */
  recommendedPropertyIds?: string[];
}

export interface Invitation {
  id: string;
  investorId: string;
  email: string;
  name: string;
  assignedAgentId: string | null;
  propertyIds: string[];
  /** Recommended properties on invite (order = Explore sort). */
  recommendedPropertyIds?: string[];
  folderIds: string[];
  status: InvitationStatus;
  sentAt: string | null;
  acceptedAt: string | null;
  lastReminderAt: string | null;
  expiresAt: string;
  link: string;
  createdAt: string;
}

export interface Development {
  id: string;
  reference: string;
  name: string;
  developer: string;
  address: string;
  city: string;
  region: string;
  postcode: string;
  description: string;
  status: DevelopmentStatus;
  completionDate: string;
  propertyTypes: string[];
  startingPrice: number;
  expectedRentalYield: number;
  expectedCapitalGrowth: number;
  /** Primary / cover image URL (first of `images` when present). */
  image: string;
  /** All gallery image URLs from the API. */
  images: string[];
  amenities: string[];
  highlights: string[];
  locationInfo: string;
  availableUnits: number;
  totalUnits: number;
  featured: boolean;
  visibleInExplore: boolean;
  /** Explore / admin list order — lower first. */
  sortOrder: number;
  paymentPlanSummary: string;
  tenure: "Leasehold" | "Freehold";
  leaseYears?: number;
  updatedAt: string;
  updatedBy: string;
}

export interface PropertyUnit {
  id: string;
  reference: string;
  name: string;
  developmentId: string | null;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  sizeSqft: number;
  floor: string;
  purchasePrice: number;
  currentValue: number;
  reservationStatus: string;
  status: PropertyStatus;
  completionDate: string;
  rentalEstimate: number;
  serviceCharge: number;
  groundRent: number;
  managementFee: number;
  projectedGrossYield: number;
  projectedNetYield: number;
  projectedCapitalGrowth: number;
  /** Explore list/eyebrow blurb. Use "Closed" when sold out. */
  paymentPlanSummary: string;
  /** Explore standard staged plan; null when sold out / closed. */
  standardPaymentPlan: StandardPaymentPlan | null;
  /** Owned off-plan / in-build schedule. Compute paid/remaining/next from installments. */
  paymentPlan: PaymentPlan | null;
  /** Primary / cover image URL (first of `images` when present). */
  image: string;
  /** All gallery image URLs from the API. */
  images: string[];
  visibleInExplore: boolean;
  /** Explore / admin list order — lower first. */
  sortOrder: number;
  assignedInvestorId: string | null;
  city: string;
  /** Street / scheme address (often mirrored from the linked development). */
  address: string;
  region: string;
  /** Legacy / API location line — prefer `address` in UI. */
  location: string;
  postcode: string;
  highlights: string[];
  amenities: string[];
  /** Content-block location narrative (from development `locationInfo`). */
  locationInfo: string;
  loanBalance: number;
  equity: number;
  monthlyMortgage: number;
  occupancy: number;
  tenantName?: string;
  tenancyEnd?: string;
  units: PropertyInventoryUnit[];
  mortgagePlans: PropertyMortgagePlan[];
  paymentSchedules: PropertyPaymentSchedule[];
  updatedAt: string;
  updatedBy: string;
}

/** Plan chosen when assigning a property into an investor portfolio. */
export type PortfolioAssignPlanType = "mortgage" | "payment_schedule" | "cash";
export type PortfolioAssignPlanMode = "default" | "custom";

export interface AssignPropertyUnitInput {
  unitIndex: number;
  quantity: number;
}

export interface AssignPropertyInput {
  propertyId: string;
  units?: AssignPropertyUnitInput[];
  planType?: PortfolioAssignPlanType;
  planMode?: PortfolioAssignPlanMode;
  mortgagePlan?: PropertyMortgagePlan;
  paymentSchedule?: PropertyPaymentSchedule;
}

export interface PortfolioAssignedUnit {
  unitIndex: number;
  type: string;
  floor: string;
  bedrooms: number;
  bathrooms: number;
  sizeSqft: number;
  quantity: number;
  purchasePrice: number;
  currentValue: number;
  rentalEstimate: number;
}

export interface PortfolioOwnership {
  id: string;
  investorId: string;
  propertyId: string;
  propertyName?: string;
  purchaseValue: number;
  currentValue: number;
  mortgageBalance: number;
  equity: number;
  monthlyRent: number;
  netCashFlow: number;
  assignedPlanType?: PortfolioAssignPlanType | null;
  assignedPlanVariant?: "default" | "custom" | null;
  assignedUnitCount?: number | null;
  units: PortfolioAssignedUnit[];
}

export interface Mortgage {
  id: string;
  propertyId: string;
  investorId: string;
  balance: number;
  monthlyPayment: number;
  ratePct: number;
  type: "interest_only" | "repayment";
  termYears: number;
  ltvPct: number;
}

export interface Assumption {
  id: string;
  key: string;
  label: string;
  value: number;
  unit: "%" | "GBP" | "years" | "months" | "ratio";
  description: string;
  scope: AssumptionScope;
  scopeRefId: string | null;
  effectiveDate: string;
  updatedAt: string;
  updatedBy: string;
  sourceNote: string;
  isDraftPlaceholder?: boolean;
}

export interface AssumptionVersion {
  id: string;
  assumptionId: string;
  previousValue: number;
  newValue: number;
  changedAt: string;
  changedBy: string;
  note: string;
}

export interface PaymentMilestone {
  id: string;
  label: string;
  percentOrAmount: "percent" | "amount";
  value: number;
  dueDate: string;
  status: PaymentMilestoneStatus;
  paidDate: string | null;
  reference: string | null;
  notes: string;
}

export interface PaymentSchedule {
  id: string;
  investorId: string;
  propertyId: string;
  totalPurchaseAmount: number;
  milestones: PaymentMilestone[];
  notes: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  category: string;
  investorId: string | null;
  isTemplate: boolean;
}

export interface DocumentAsset {
  id: string;
  name: string;
  folderId: string | null;
  category: string;
  investorId: string | null;
  propertyId: string | null;
  developmentId: string | null;
  paymentMilestoneId: string | null;
  fileType: string;
  size: string;
  /** Absolute or relative URL when the API provides one. */
  url: string | null;
  uploadedBy: string;
  uploadedAt: string;
  expiryDate: string | null;
  version: number;
  visibility: "investor" | "internal" | "both";
  downloadCount: number;
  lastViewedAt: string | null;
}

export interface Enquiry {
  id: string;
  investorId: string | null;
  investorName: string;
  propertyId: string | null;
  developmentId: string | null;
  type: string;
  message: string;
  submittedAt: string;
  assignedAgentId: string | null;
  status: EnquiryStatus;
  priority: "low" | "medium" | "high";
  latestAction: string;
  followUpDate: string | null;
  /** Preferred contact date from investor (YYYY-MM-DD). */
  date: string | null;
  /** Preferred contact time (HH:mm). */
  time: string | null;
  linkedSignalId: string | null;
  outcome: string | null;
}

export interface Note {
  id: string;
  investorId: string;
  body: string;
  authorId: string;
  authorName: string;
  kind: "internal" | "agent" | "follow_up";
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  investorId: string;
  type: string;
  title: string;
  detail: string;
  propertyId: string | null;
  developmentId: string | null;
  timestamp: string;
  metadata?: Record<string, string | number>;
  propertyName?: string | null;
  location?: string | null;
  postcode?: string | null;
}

export interface SignalRule {
  id: string;
  name: string;
  description: string;
  eventType: string;
  threshold: number;
  windowDays: number;
  intentLevel: IntentLevel;
  enabled: boolean;
  suggestedAction: string;
}

export interface IntentSignal {
  id: string;
  investorId: string;
  assignedAgentId: string | null;
  signalType: string;
  triggeringActivity: string;
  propertyId: string | null;
  developmentId: string | null;
  intentLevel: IntentLevel;
  generatedAt: string;
  summary: string | null;
  suggestedNextAction: string;
  status: SignalStatus;
  agentNotes: string;
  ruleId: string | null;
  category?: string | null;
}

export interface ScreenVisitCount {
  label: string;
  visitCount: number;
}

export interface PropertyVisitCount {
  propertyName: string;
  location: string | null;
  postcode: string | null;
  visitCount: number;
}

export interface CalculatorStepCount {
  step: string;
  visitCount: number;
}

export interface InvestorEngagement {
  investorRef: string;
  screens: ScreenVisitCount[];
  properties: PropertyVisitCount[];
  calculatorSteps: CalculatorStepCount[];
  totalEvents: number;
  recent: ActivityEvent[];
  signals: IntentSignal[];
  insufficientActivity: boolean;
  reason: string | null;
  activityEventCount: number;
}

export interface PortfolioInsightCard {
  category: string;
  metric: string;
  headline: string;
  evidence: string;
  trend: string;
}

export interface ContentMediaAsset {
  /** Storage path used in keep* payloads (e.g. `content/documents/abc.pdf`). */
  path: string;
  /** Public URL for preview/download. */
  url: string;
  /** Original upload filename from API (`name`). */
  name: string;
  /** Extension/type from API (`fileType`), e.g. `pdf`, `mp4`. */
  fileType: string;
  size: number;
}

export interface ContentBlock {
  id: string;
  key: string;
  title: string;
  area: string;
  body: string;
  status: ContentStatus;
  /** Linked property — one content block per property. */
  propertyId: string | null;
  documents: ContentMediaAsset[];
  images: ContentMediaAsset[];
  videos: ContentMediaAsset[];
  updatedAt: string;
  updatedBy: string;
}

export interface AuditRecord {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue: string | null;
  newValue: string | null;
  timestamp: string;
  ip: string | null;
}

/** Platform settings from GET/PUT /admin/settings */
export interface PlatformSettings {
  maintenanceBanner: boolean;
  /** API field `inviteOnly` — invitation-only onboarding. */
  inviteOnly: boolean;
}

/** One card in GET/POST/PUT /admin/explore/coming-soon */
export interface ComingSoonCard {
  name: string;
  city: string;
  region: string;
  description: string;
  /** Display copy such as "late 2027" — not a date field. */
  expectedFrom: string;
  /** Existing storage path or URL. Not a file upload. */
  image: string;
  /** Display label only. Does not register investor interest. */
  buttonLabel: string;
  status: string;
}

/** Investor Explore "Coming soon" section. Saving replaces the whole section. */
export interface ComingSoonSection {
  title: string;
  description: string;
  published: boolean;
  cards: ComingSoonCard[];
}

/** Snapshot from GET /admin/dashboard/stats, plus overlay lists. */
export interface DashboardStats {
  totalInvestors: number;
  invitedUsers: number;
  signedUpUsers: number;
  pendingInvitations: number;
  activeProperties: number;
  activeDevelopments: number;
  openEnquiries: number;
  highIntentInvestors: number;
  upcomingPayments: number;
  recentDocuments: DocumentAsset[];
  highPrioritySignals: IntentSignal[];
  recentActivity: ActivityEvent[];
  newEnquiries: Enquiry[];
  recentInvites: Invitation[];
  recentPriceUpdates: UkhpiLog[];
  recentProperties: PropertyUnit[];
}

/** UKHPI price-history application log for a property. */
export interface UkhpiLog {
  id: string;
  propertyId: string | null;
  propertyName: string;
  propertyReference: string;
  region: string;
  regionSlug: string;
  refMonth: string;
  percentageChange: number | null;
  previousValue: number | null;
  newValue: number | null;
  averagePrice: number | null;
  housePriceIndex: number | null;
  sourceUrl: string;
  status: string;
  message: string;
  createdAt: string;
  updatedAt: string;
}
