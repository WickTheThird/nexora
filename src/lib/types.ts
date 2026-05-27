// Shared type definitions matching the Worker API shapes.

export type Role = "subcontractor" | "admin" | "primary";
export type OnboardingStatus =
  | "invited"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "approved"
  | "active"
  | "rejected";

// Onboarding gate steps. Updated 2026-05-27: required docs are now
// Photo ID + Manual Handling (was Photo ID + H&S card). H&S card
// stays in the Documents folder as optional.
export type StepKey =
  | "application_form"
  | "questionnaire"
  | "photo_id"
  | "manual_handling";
export type StepStatus =
  | "locked"
  | "not_started"
  | "in_progress"
  | "completed"
  | "rejected";

// Round B: Enagh's `/operatives/folder_certs.asp` model - categorise
// uploads so the sub can find their certs by folder. Existing values
// stay for back-compat; new values cover the Irish construction cert
// canon (Safe Pass · CSCS · Manual Handling). Anything not on this
// list falls into "other".
export type DocumentType =
  | "photo_id"
  | "insurance"
  | "cert"
  | "safe_pass"
  | "manual_handling"
  | "first_aid"
  | "ppe"
  | "other";
export type ReviewStatus = "pending" | "approved" | "rejected";
// New lifecycle: advised → invoiced → paid (or cancelled).
// Legacy values kept so old records still type-check.
export type PaymentStatus =
  | "advised"
  | "invoiced"
  | "paid"
  | "cancelled"
  | "pending"
  | "processed"
  | "reversed";
export type RateUnit = "hour" | "day" | "week" | "fixed";
export type RctRate = "0" | "20" | "35";
export type ChangeRequestStatus = "open" | "seen" | "actioned" | "closed" | "rejected";
export type ChangeRequestEntityType = "subcontractor" | "primary_submission";
export type SubChangeAction = "remove" | "move" | "swap";
export type QuestionnaireStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "approved"
  | "rejected";

export interface AppSettings {
  principal_name: string | null;
  principal_address: string | null;
  principal_vat: string | null;
  principal_email: string | null;
  accountant_email: string | null;
  // Default fee BC charges the primary on consolidated invoices.
  // Stored as strings (worker stores all settings as strings).
  admin_fee_amount_minor: string | null;
  admin_fee_percent: string | null;
  // Invoice template - admin controls what appears on every generated PDF.
  // All optional; PDF generator falls back to sensible defaults if blank.
  invoice_header_tagline: string | null;
  invoice_payment_terms: string | null;
  invoice_footer_note: string | null;
  invoice_show_vat: string | null;             // "1" | "0"
  invoice_show_bank: string | null;            // "1" | "0"
  invoice_show_contact: string | null;         // "1" | "0"
  invoice_show_principal_ref: string | null;   // "1" | "0"
  // Job Card calculator settings (Enagh-style live totals on submission form)
  vat_rate_percent: string | null;             // e.g. "13.5"
  less_subs_default_minor: string | null;      // flat deduction in cents
  // Enagh-style "Latest News" panel on the principal home (admin freeform)
  latest_news: string | null;
  // Email used by the principal's "Changes Request" button on the home
  changes_request_email: string | null;
  // BC service fee per worker (minor units). Default 1700 = €17.
  service_fee_per_worker_minor: string | null;
  // Bank details + footer for BC-issued PDF invoices.
  bc_bank_account_name: string | null;
  bc_bank_bic: string | null;
  bc_bank_iban: string | null;
  bc_bank_account_address: string | null;
  bc_phone_roi: string | null;
  bc_phone_ni: string | null;
  bc_website: string | null;
  bc_registered_number: string | null;
  bc_signatory_name: string | null;
}

// Invoice template options surfaced in the InvoicePayload (parsed from
// app_settings server-side). Used by the PDF generator.
export interface InvoiceTemplate {
  headerTagline: string | null;
  paymentTerms: string | null;
  footerNote: string | null;
  showVat: boolean;
  showBank: boolean;
  showContact: boolean;
  showPrincipalRef: boolean;
}

// Optional extras the BC-side invoice generator needs. Populated by
// the worker on the principal-invoice detail endpoint; absent on the
// sub-side path.
export interface BcInvoiceExtras {
  bankAccountName: string | null;
  bankBic: string | null;
  bankIban: string | null;
  bankAccountAddress: string | null;
  phoneRoi: string | null;
  phoneNi: string | null;
  website: string | null;
  registeredNumber: string | null;
}

export interface InvoicePayload {
  issuedAt: string;
  period: { from: string; to: string };
  invoiceNumber: string;
  // Optional - present only for BC-issued primary invoices.
  jobCardType?: string | null;
  invoiceKind?: "labour" | "service" | null;
  siteCodes?: string[];
  bc?: BcInvoiceExtras;
  vatAmountMinor?: number;
  grossAmountMinor?: number;
  netAmountMinor?: number;
  principal: {
    name: string | null;
    address: string | null;
    vat: string | null;
    email: string | null;
  };
  subcontractor: Subcontractor;
  bank: BankDetails | null;
  lines: PaymentRecord[];
  totals: {
    gross: number;
    rct: number;
    net: number;
    hours: number;
    count: number;
    currency: string;
  };
  totalsByCurrency: Record<string, {
    gross: number;
    rct: number;
    net: number;
    hours: number;
    count: number;
  }>;
  rct: {
    byRate: Array<{
      rate: string;
      gross: number;
      deduction: number;
      count: number;
    }>;
  };
  vat: {
    subcontractorVatRegistered: boolean;
    subcontractorVatNumber: string | null;
    principalVatNumber: string | null;
    reverseChargeApplied: boolean;
    reverseChargePaymentCount: number;
    note: string | null;
  };
  accountantEmail: string | null;
  // Admin-controlled template options. Optional for back-compat; PDF
  // generator falls back to defaults when undefined.
  template?: InvoiceTemplate;
}

export interface Me {
  id: string;
  email: string;
  role: Role;
  subcontractorId: string | null;
  primaryId: string | null;
  mustChangePassword: boolean;
  privacyAccepted: boolean;
  privacyVersion: string;
  // Server-side locale preference. UI defaults to localStorage; this
  // mirror exists so email + push templates render in the right
  // language. "en" if the user hasn't picked one yet.
  preferredLocale?: "en" | "ro";
  // Only present on /auth/login responses; persisted in localStorage so the
  // frontend can authenticate via Authorization: Bearer in environments that
  // block third-party cookies (incognito Chrome, Safari ITP, etc.).
  sessionToken?: string;
}

export interface Subcontractor {
  id: string;
  userId: string;
  clientRef: string | null;
  subcontractorRef: string | null;
  fullName: string | null;
  address1: string | null;
  address2: string | null;
  town: string | null;
  postcode: string | null;
  dob: string | null;
  placeOfBirth: string | null;
  tel: string | null;
  mob: string | null;
  email: string | null;
  ppsNumber: string | null;
  natureOfServices: string | null;
  workType: string | null;
  vatRegistered: boolean;
  vatNumber: string | null;
  rateAmountMinor: number | null;
  rateUnit: RateUnit | null;
  rctRate: RctRate | null;
  rctAuthorisationNumber: string | null;
  vatReverseCharge: boolean;
  onboardingStatus: OnboardingStatus;
  submittedAt: number | null;
  // Subcontractor's own accountant - who they want their invoices CC'd to.
  // Distinct from the principal's accountant (in AppSettings).
  accountantEmail: string | null;
  // Default Primary this sub typically works for.
  primaryId: string | null;
  anonymisedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface BankDetails {
  bankName: string | null;
  accountHolderName: string | null;
  accountNumber: string | null;
  sortCode: string | null;
  iban: string | null;
  bic: string | null;
  bankRef: string | null;
  currency: string;
}

// Roster entry: a principal's claim that a given PPS + email + name is
// one of their workers. Lives independently of whether a sub account
// exists for that PPS. When a sub later signs up + is approved by admin
// with the matching PPS, linkedSubId is populated.
export interface RosterEntry {
  id: string;
  primaryId: string;
  // Encrypted PPS - never exposed in the clear. The list endpoint
  // returns a masked version (e.g. "1234567A" -> "*****67A").
  ppsMasked: string;
  email: string;
  name: string;
  linkedSubId: string | null;
  // Subcontractor approval status when linked, null otherwise.
  linkedSubStatus: OnboardingStatus | null;
  createdAt: number;
  updatedAt: number;
}

export interface DocumentRecord {
  id: string;
  subcontractorId: string;
  documentType: DocumentType;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: number | null;
  uploadedAt: number;
  // Card / cert metadata. Captured at upload time on the sub side via
  // a mandatory data-entry modal; the admin can patch any of them
  // later. expiresAt drives payment-eligibility: any approved document
  // whose expiresAt is in the past blocks payment processing for that
  // sub (see worker.js processPrimarySubmissionCore).
  expiresAt: number | null;
  issuedAt: number | null;
  cardNumber: string | null;
  issuingBody: string | null;
  holderName: string | null;
  // 10-minute hold window after the sub's last save. While this is in
  // the future the sub can keep editing the card metadata freely;
  // once it passes, the row is read-only on the sub side and any
  // change must go via the admin Change Requests inbox. Mirrors the
  // principal Job Card hold pattern.
  metadataHeldUntil: number | null;
  metadataUpdatedAt: number | null;
}

// Patch shape for both sub-side and admin-side metadata writes.
// All fields optional; sending null clears the value, sending
// undefined leaves it alone. Dates are ms-epoch numbers (or
// null to clear).
export interface DocumentMetadataPatch {
  expiresAt?: number | null;
  issuedAt?: number | null;
  cardNumber?: string | null;
  issuingBody?: string | null;
  holderName?: string | null;
}

export interface QuestionnaireRecord {
  id: string;
  subcontractorId: string;
  version: number;
  answers: Record<string, unknown> | null;
  status: QuestionnaireStatus;
  submittedAt: number | null;
  reviewedAt: number | null;
  reviewedBy: string | null;
  createdAt: number;
}

// Status of a primary-tier invoice (BC → developer).
export type PrimaryInvoiceStatus = "draft" | "sent" | "paid" | "cancelled";

// Status of a primary submission (developer's payment data sent to BC for processing).
// 'held' is the 10-minute grace window after the principal hits Submit -
// the row is still editable; auto-promotes to 'submitted' when the
// auto_submit_at timestamp passes.
export type PrimarySubmissionStatus =
  | "draft"
  | "held"
  | "submitted"
  | "processing"
  // Invoices issued + payment_records created, but not all payments
  // have been settled by admin yet. Auto-promotes to 'completed'
  // when the last payment_record is marked paid.
  | "awaiting_payment"
  | "completed"
  | "rejected";

export type JobCardType = "weekly" | "fortnightly" | "monthly";

export type OperativeRequestStatus = "requested" | "approved" | "rejected" | "cancelled";

export interface OperativeRequest {
  id: string;
  primaryId: string;
  requestedBy: string | null;
  name: string;
  mobile: string | null;
  email: string | null;
  notes: string | null;
  status: OperativeRequestStatus;
  reviewedAt: number | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  resultingSubcontractorId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PrimarySubmission {
  id: string;
  /** Per-principal sequential reference, e.g. JOB-0012. Auto-generated
   *  at submission time. This is the identifier the principal sees in
   *  every UI surface; the UUID `id` stays as the internal key. Older
   *  rows backfilled by the 2026-05 migration. */
  jobRef: string | null;
  primaryId: string;
  submittedBy: string | null;
  status: PrimarySubmissionStatus;
  periodStart: string | null;
  periodEnd: string | null;
  notes: string | null;
  source: "manual" | "csv";
  itemCount: number;
  totalGrossMinor: number;
  submittedAt: number;
  processedAt: number | null;
  processedBy: string | null;
  rejectionReason: string | null;
  // Enagh-style Job Card metadata. jobCardType ∈ weekly/fortnightly/monthly;
  // dateEnding is YYYY-MM-DD end of the reporting window. Both nullable on
  // older rows; new submissions always set them.
  jobCardType: JobCardType | null;
  dateEnding: string | null;
  // ms-epoch when a 'held' submission auto-promotes to 'submitted'.
  // Null when status is anything other than 'held'.
  autoSubmitAt: number | null;
  createdAt: number;
  // Enagh-parity: surface the auto-generated principal invoice number on
  // the list view. Populated only after admin Process step completes;
  // null while the submission is still draft / submitted / rejected.
  invoiceNumber?: string | null;
}

export interface PrimarySubmissionItem {
  id: string;
  submissionId: string;
  subcontractorId: string | null;
  subcontractorRef: string | null;
  subcontractorName: string | null;
  jobNumber: string | null;
  siteAddress: string | null;
  quantity: number;
  rateMinor: number;
  materialValueMinor: number;
  extrasMinor: number;
  grossMinor: number;
  notes: string | null;
  paymentId: string | null;
  matched: boolean;
  /** RCT deduction rate chosen by the principal for this row at
   *  submission time. Defaults to the sub's recorded rate. Admin uses
   *  this value when generating the payment record. */
  rctRate: "0" | "20" | "35" | null;
  createdAt: number;
}

// An invoice issued by BC Construction (admin) to the primary (developer)
// for a period of work. Sums up all sub payments in the window for subs
// linked to this primary, plus any markup.
export interface PrimaryInvoice {
  id: string;
  primaryId: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  grossMinor: number;
  markupMinor: number;
  // VAT only applies to 'service' invoices (BC's fee). Labour pass-
  // through is VAT-free under RCT reverse-charge.
  vatMinor: number;
  vatRatePercent: number | null;
  netMinor: number;
  currency: string;
  status: PrimaryInvoiceStatus;
  notes: string | null;
  issuedAt: string;
  sentAt: number | null;
  paidAt: number | null;
  createdAt: number;
  createdBy: string | null;
  // 'labour' = pass-through invoice covering the wages BC will hand to
  // the subs. 'service' = BC's own fee. Legacy rows default to 'labour'.
  kind: "labour" | "service";
  // Link back to the Job Card + site this invoice was issued for.
  // submission_id is the primary_submission UUID; site_id is the
  // sites.id UUID. Snapshots are human-readable labels captured at
  // issue time so the printed invoice survives later renames.
  submissionId: string | null;
  siteId: string | null;
  siteCodeSnapshot: string | null;
  siteProjectSnapshot: string | null;
  // Job Card per-principal sequential reference (JOB-0012). JOINed on
  // the list endpoints from the parent primary_submission row.
  jobRef: string | null;
  // Optional issuer + template overlays - populated by the worker on the
  // detail endpoint so the PDF generator can pull them without an extra
  // settings call. Absent on list endpoints; never required.
  issuerName?: string | null;
  issuerAddress?: string | null;
  issuerVat?: string | null;
  issuerEmail?: string | null;
  template?: InvoiceTemplate;
  // BC bank/footer config + the source Job Card type. Populated by the
  // worker on the detail endpoint for use by the Enagh-style PDF.
  jobCardType?: string | null;
  bc?: BcInvoiceExtras;
}

// Top of the 3-tier hierarchy: Primary (developer/main contractor) →
// Admin (BC Construction) → Subcontractors. BC issues invoices UP to the
// primary by consolidating sub work; subs invoice DOWN to BC.
export interface Primary {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  address: string | null;
  vat: string | null;
  phone: string | null;
  notes: string | null;
  // Primary's own accountant - distinct from the principal's accountant.
  // The primary user can set this themselves from their portal.
  accountantEmail: string | null;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface PaymentRecord {
  id: string;
  subcontractorId: string;
  paymentDate: string;
  // RCT breakdown
  grossMinor: number;
  rctRate: RctRate | null;
  rctDeductionMinor: number;
  // BC service fee deducted from this sub's payment (per-worker flat
  // from app_settings.service_fee_per_worker_minor at process time).
  // 0 for records created before the 2026-05-27 fee restructure.
  // Optional in the TS type so existing mock-payload sites that
  // build a PaymentRecord by hand don't have to set it.
  serviceFeeMinor?: number;
  netMinor: number;
  rctAuthNumber: string | null;
  vatReverseCharge: boolean;
  // Legacy alias for the gross amount (kept for transition)
  amountMinor: number;
  currency: string;
  reference: string | null;
  hasRemittance: boolean;
  status: PaymentStatus;
  // Sub-issued invoice number (assigned when sub clicks "Generate invoice"
  // on an advised payment). Null while still in 'advised' state.
  invoiceNumber: string | null;
  invoicedAt: number | null;
  hours: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  siteRef: string | null;
  primaryId: string | null;
  createdAt: number;
  createdBy: string | null;
}

export interface ChangeRequest {
  id: string;
  /** Discriminator: 'subcontractor' (legacy sub-side request) or
   *  'primary_submission' (principal-side request on a Job Card). */
  entityType: ChangeRequestEntityType;
  /** Populated when entityType === 'subcontractor'. Nullable for Job
   *  Card requests. */
  subcontractorId: string | null;
  /** Populated when entityType === 'primary_submission'. */
  primarySubmissionId: string | null;
  // --- Job Card sub-change fields (entityType === 'primary_submission',
  // category === 'sub_change') ---
  subChangeAction: SubChangeAction | null;
  affectedSubcontractorId: string | null;
  replacementSubcontractorId: string | null;
  // --- Job Card status-change field (entityType === 'primary_submission',
  // category === 'status_change') ---
  requestedStatus: string | null;
  message: string;
  status: ChangeRequestStatus;
  handledBy: string | null;
  createdBy: string | null;
  /** 'erasure' | 'status_change' | 'sub_change' | null */
  category: string | null;
  resolutionNote: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface OnboardingView {
  onboardingStatus: OnboardingStatus;
  steps: Record<StepKey, StepStatus>;
}

// -------- Public Jobs marketplace (Phase 4) + Procurement (Phase 4.5) --------
export type PublicJobStatus = "open" | "paused" | "closed" | "filled" | "removed";
export type PublicJobRateUnit = "hour" | "day" | "fixed";
/** Procurement visibility model (Phase 4.5):
 *   invite_only  - principal pre-selects named subs; only they see it
 *   vendor_list  - visible to every approved sub on the principal's list
 *   discoverable - visible to all subs who are on AT LEAST ONE
 *                  principal's approved vendor list (trust gate) */
export type PublicJobVisibility = "invite_only" | "vendor_list" | "discoverable";
export type JobApplicationStatus =
  | "invited"   // principal pre-created on invite-only post; awaiting sub response
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "declined"; // sub turned down the invite
export type VendorListEntryStatus = "pending" | "approved" | "removed";
export type VendorListApplicationStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface VendorListEntry {
  primaryId: string;
  subcontractorId: string;
  subcontractorName: string | null;
  subcontractorRef: string | null;
  subcontractorEmail: string | null;
  trade: string | null;
  rctRate: string | null;
  onboardingStatus: string | null;
  status: VendorListEntryStatus;
  isFavourite: boolean;
  createdAt: number;
  approvedAt: number | null;
  approvedBy: string | null;
  removedAt: number | null;
  removedBy: string | null;
  removedReason: string | null;
}

export interface VendorListApplication {
  id: string;
  primaryId: string;
  primaryName: string | null;
  subcontractorId: string;
  subcontractorName: string | null;
  subcontractorRef: string | null;
  subcontractorEmail: string | null;
  trade: string | null;
  message: string | null;
  status: VendorListApplicationStatus;
  appliedAt: number;
  decidedAt: number | null;
  decidedBy: string | null;
  decidedReason: string | null;
  nextApplyAllowedAt: number | null;
}

/** Sub-side membership row in /app/vendor-lists. */
export interface VendorListMembership {
  primaryId: string;
  primaryName: string;
  status: VendorListEntryStatus;
  isFavourite: boolean;
  approvedAt: number | null;
  removedAt: number | null;
  removedReason: string | null;
}

/** Sub-side principal browse row in /app/vendor-lists/discover. */
export interface PrincipalDirectoryEntry {
  id: string;
  name: string;
  address: string | null;
  vat: string | null;
  membershipStatus: VendorListEntryStatus | null;
  lastApplicationStatus: VendorListApplicationStatus | null;
  nextApplyAllowedAt: number | null;
}

export interface PublicJob {
  id: string;
  primaryId: string;
  primaryName: string | null;
  jobRef: string | null;
  title: string;
  brief: string | null;
  trade: string | null;
  location: string | null;
  payRateMinor: number | null;
  rateUnit: PublicJobRateUnit | null;
  startDate: string | null;
  endDate: string | null;
  status: PublicJobStatus;
  visibility: PublicJobVisibility;
  createdBy: string | null;
  removedAt: number | null;
  removedReason: string | null;
  removedBy: string | null;
  createdAt: number;
  updatedAt: number;
  applicationCount: number | null;
  pendingCount: number | null;
  // Sub-side only: decoration showing whether the viewer already applied.
  myApplicationStatus: JobApplicationStatus | null;
  myApplicationId: string | null;
  isFavourite?: boolean;
}

export interface JobApplication {
  id: string;
  jobId: string;
  subcontractorId: string;
  subcontractorName: string | null;
  subcontractorRef: string | null;
  jobTitle: string | null;
  jobRef: string | null;
  primaryId: string | null;
  primaryName: string | null;
  message: string | null;
  status: JobApplicationStatus;
  appliedAt: number;
  decidedAt: number | null;
  decidedBy: string | null;
  decidedReason: string | null;
  nextApplyAllowedAt: number | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
