// Shared type definitions matching the Worker API shapes.

export type Role = "subcontractor" | "admin";
export type OnboardingStatus =
  | "invited"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "approved"
  | "active"
  | "rejected";

export type StepKey =
  | "application_form"
  | "contract"
  | "questionnaire"
  | "photo_id"
  | "hs_card";
export type StepStatus =
  | "locked"
  | "not_started"
  | "in_progress"
  | "completed"
  | "rejected";

export type DocumentType = "photo_id" | "hs_card" | "insurance" | "cert" | "other";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type ContractStatus =
  | "draft"
  | "generated"
  | "viewed"
  | "signed"
  | "superseded";
export type PaymentStatus = "pending" | "processed" | "paid" | "reversed";
export type RateUnit = "hour" | "day" | "week" | "fixed";
export type RctRate = "0" | "20" | "35";
export type ChangeRequestStatus = "open" | "seen" | "actioned" | "closed";
export type QuestionnaireStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "approved"
  | "rejected";

export interface Me {
  id: string;
  email: string;
  role: Role;
  subcontractorId: string | null;
  mustChangePassword: boolean;
  privacyAccepted: boolean;
  privacyVersion: string;
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

export interface ContractRecord {
  id: string;
  subcontractorId: string;
  templateId: string;
  templateVersion: number;
  renderedHtml: string;
  pdfR2Key: string | null;
  status: ContractStatus;
  signedName: string | null;
  signedIp: string | null;
  signedToken: string | null;
  signedAt: number | null;
  signaturePng: string | null;
  createdAt: number;
}

export interface ContractTemplate {
  id: string;
  name: string;
  version: number;
  bodyHtml: string;
  isActive: boolean;
  createdAt: number;
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
  expiresAt: number | null;
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

export interface PaymentRecord {
  id: string;
  subcontractorId: string;
  paymentDate: string;
  // RCT breakdown
  grossMinor: number;
  rctRate: RctRate | null;
  rctDeductionMinor: number;
  netMinor: number;
  rctAuthNumber: string | null;
  vatReverseCharge: boolean;
  // Legacy alias for the gross amount (kept for transition)
  amountMinor: number;
  currency: string;
  reference: string | null;
  hasRemittance: boolean;
  status: PaymentStatus;
  hours: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: number;
  createdBy: string | null;
}

export interface ChangeRequest {
  id: string;
  subcontractorId: string;
  message: string;
  status: ChangeRequestStatus;
  handledBy: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface OnboardingView {
  onboardingStatus: OnboardingStatus;
  steps: Record<StepKey, StepStatus>;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
