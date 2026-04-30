// Thin fetch wrapper that talks to the Samwise Worker API.
// Reads the API base URL from runtime config (public/config.js), not from build
// flags — so the SAME build artifact can be deployed to different domains.

import type {
  AppSettings,
  BankDetails,
  ChangeRequest,
  ContractRecord,
  ContractTemplate,
  DocumentRecord,
  InvoicePayload,
  Me,
  OnboardingView,
  Page,
  PaymentRecord,
  Primary,
  PrimaryInvoice,
  PrimarySubmission,
  PrimarySubmissionItem,
  QuestionnaireRecord,
  Subcontractor,
  Timesheet,
} from "./types";

declare global {
  interface Window {
    // Runtime config injected by public/config.js. Window-attached so it can
    // be edited in place after deployment without rebuilding the SPA.
    __SAMWISE_CONFIG__?: { apiUrl?: string; brand?: string };
  }
}

function apiBase(): string {
  const url = window.__SAMWISE_CONFIG__?.apiUrl;
  if (!url) {
    throw new Error(
      "Samwise runtime config missing. Ensure /config.js defines window.__SAMWISE_CONFIG__.apiUrl",
    );
  }
  return url.replace(/\/$/, "");
}

export function brandName(): string {
  return window.__SAMWISE_CONFIG__?.brand || "Samwise";
}

// Token-based auth fallback for environments where third-party cookies are
// blocked (incognito Chrome, Safari ITP, etc.). The session id received on
// login is stored here and sent as Authorization: Bearer on every request.
const TOKEN_KEY = "nx_token";
export const tokenStore = {
  get(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(t: string): void {
    try { localStorage.setItem(TOKEN_KEY, t); } catch { /* private mode */ }
  },
  clear(): void {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  },
};

// For URLs that have to work without an Authorization header (anchor tags,
// `<img src>`, `window.open`), append the token as a query param. The Worker
// reads `?_token=` as a fallback for the bearer header on download routes.
function tokenQuery(): string {
  const t = tokenStore.get();
  return t ? `?_token=${encodeURIComponent(t)}` : "";
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Json = Record<string, unknown> | unknown[] | null;

async function request<T>(
  method: string,
  path: string,
  opts: {
    body?: Json;
    formData?: FormData;
    raw?: boolean;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const tok = tokenStore.get();
  if (tok) headers["authorization"] = `Bearer ${tok}`;
  const init: RequestInit = {
    method,
    credentials: "include",
    headers,
  };
  if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  } else if (opts.formData) {
    init.body = opts.formData;
  }
  const res = await fetch(apiBase() + path, init);
  if (opts.raw) {
    if (!res.ok) {
      const data = await res
        .json()
        .catch(() => ({ error: { code: "HTTP_" + res.status, message: res.statusText } }));
      throw new ApiError(
        data?.error?.code || "HTTP_ERROR",
        data?.error?.message || res.statusText,
        res.status,
      );
    }
    return res as unknown as T;
  }
  let data: { ok: boolean; data?: T; error?: { code: string; message: string } };
  try {
    data = await res.json();
  } catch {
    throw new ApiError("PARSE_ERROR", "Malformed response", res.status);
  }
  if (!data.ok) {
    const code = data.error?.code || "API_ERROR";
    // Auth lapses (cookie or token rejected): notify the app shell so it can
    // redirect to /login instead of letting the page silently render zeros.
    if (code === "AUTH_REQUIRED" || code === "FORBIDDEN") {
      try {
        window.dispatchEvent(new CustomEvent("samwise:auth-lost", { detail: { code } }));
      } catch { /* SSR / older browsers */ }
    }
    throw new ApiError(
      code,
      data.error?.message || "Request failed",
      res.status,
    );
  }
  return data.data as T;
}

// -------- auth --------
export const api = {
  login: (email: string, password: string) =>
    request<Me>("POST", "/auth/login", { body: { email, password } }),
  logout: () => request<Record<string, never>>("POST", "/auth/logout"),
  me: () => request<Me>("GET", "/auth/me"),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true; sessionToken?: string }>("POST", "/me/change-password", {
      body: { currentPassword, newPassword },
    }),
  acceptPrivacy: (version: string) =>
    request<{ consentedAt: number; privacyVersion: string }>(
      "POST",
      "/auth/accept-privacy",
      { body: { version } },
    ),
  // Password reset (public). Always returns 200 from the worker regardless of
  // whether the email exists, so the UI shouldn't reveal account existence.
  requestPasswordReset: (email: string) =>
    request<{ ok: true }>("POST", "/auth/request-password-reset", {
      body: { email },
    }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ ok: true }>("POST", "/auth/reset-password", {
      body: { token, newPassword },
    }),
  exportMyDataUrl: () =>
    // Returning URL so a plain <a> can download with credentials.
    (window.__SAMWISE_CONFIG__?.apiUrl?.replace(/\/$/, "") || "") + "/me/export" + tokenQuery(),
  submitErasureRequest: (reason?: string) =>
    request<{ id: string; note: string }>("POST", "/me/erasure-request", {
      body: { reason },
    }),
  adminAnonymise: (subId: string) =>
    request<{ anonymised: true; anonymisedAt: number }>(
      "POST",
      `/admin/subcontractors/${subId}/anonymise`,
    ),

  // -------- profile --------
  getMyProfile: () =>
    request<{
      user: { id: string; email: string; role: string };
      subcontractor: Subcontractor;
      bank: BankDetails;
    }>("GET", "/me/profile"),
  patchMyProfile: (data: Partial<Subcontractor>) =>
    request<Subcontractor>("PATCH", "/me/profile", { body: data as Json }),
  patchMyBank: (data: Partial<BankDetails>) =>
    request<BankDetails>("PATCH", "/me/bank-details", { body: data as Json }),
  submitMyProfile: () =>
    request<{ onboardingStatus: string; submittedAt: number }>(
      "POST",
      "/me/profile/submit",
    ),
  getMyOnboarding: () => request<OnboardingView>("GET", "/me/onboarding"),

  // -------- contracts --------
  getMyContract: () => request<ContractRecord>("GET", "/me/contracts/current"),
  signMyContract: (signedName: string, signaturePng?: string) =>
    request<ContractRecord>("POST", "/me/contracts/current/sign", {
      body: { signedName, agreed: true, signaturePng },
    }),

  // -------- documents --------
  listMyDocuments: () =>
    request<{ items: DocumentRecord[] }>("GET", "/me/documents"),
  uploadMyDocument: (documentType: string, file: File) => {
    const fd = new FormData();
    fd.append("documentType", documentType);
    fd.append("file", file);
    return request<DocumentRecord>("POST", "/me/documents", { formData: fd });
  },
  downloadMyDocumentUrl: (id: string) =>
    apiBase() + `/me/documents/${id}/download` + tokenQuery(),
  deleteMyDocument: (id: string) =>
    request<{ ok: true }>("DELETE", `/me/documents/${id}`),

  // -------- questionnaire --------
  getMyQuestionnaire: () =>
    request<QuestionnaireRecord | null>("GET", "/me/questionnaire"),
  submitMyQuestionnaire: (version: number, answers: Record<string, unknown>) =>
    request<QuestionnaireRecord>("POST", "/me/questionnaire", {
      body: { version, answers },
    }),

  // -------- payments --------
  listMyPayments: (cursor?: string) =>
    request<Page<PaymentRecord>>(
      "GET",
      "/me/payments" + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""),
    ),
  downloadMyRemittanceUrl: (id: string) =>
    apiBase() + `/me/payments/${id}/download` + tokenQuery(),
  // Sub accepts a payment advice and issues their own invoice. Server
  // assigns the invoice number and flips status from 'advised' → 'invoiced'.
  generateMyInvoice: (paymentId: string) =>
    request<PaymentRecord>("POST", `/me/payments/${paymentId}/generate-invoice`),

  // -------- change requests --------
  listMyChangeRequests: () =>
    request<{ items: ChangeRequest[] }>("GET", "/me/change-requests"),
  postMyChangeRequest: (message: string) =>
    request<ChangeRequest>("POST", "/me/change-requests", {
      body: { message },
    }),

  // -------- admin: subcontractors --------
  adminListSubcontractors: (params: {
    status?: string;
    q?: string;
    cursor?: string;
    limit?: number;
    primaryId?: string | "none";  // "none" = unlinked subs only
  }) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.q) q.set("q", params.q);
    if (params.cursor) q.set("cursor", params.cursor);
    if (params.limit) q.set("limit", String(params.limit));
    if (params.primaryId) q.set("primaryId", params.primaryId);
    return request<Page<Subcontractor>>(
      "GET",
      "/admin/subcontractors" + (q.toString() ? `?${q}` : ""),
    );
  },
  adminGetSubcontractor: (id: string) =>
    request<{ subcontractor: Subcontractor; bank: BankDetails }>(
      "GET",
      `/admin/subcontractors/${id}`,
    ),
  adminCreateSubcontractor: (data: {
    email: string;
    fullName?: string;
    clientRef?: string;
  }) =>
    request<{
      subcontractorId: string;
      userId: string;
      email: string;
      tempPassword: string;
      note: string;
    }>("POST", "/admin/subcontractors", { body: data }),
  adminPatchSubcontractor: (id: string, data: Partial<Subcontractor>) =>
    request<Subcontractor>(
      "PATCH",
      `/admin/subcontractors/${id}`,
      { body: data as Json },
    ),
  adminApprove: (id: string, note?: string) =>
    request<Subcontractor>(
      "POST",
      `/admin/subcontractors/${id}/approve`,
      { body: { note } },
    ),
  adminReject: (id: string, reason?: string) =>
    request<Subcontractor>(
      "POST",
      `/admin/subcontractors/${id}/reject`,
      { body: { reason } },
    ),
  adminRequestChanges: (id: string, note: string) =>
    request<Subcontractor>(
      "POST",
      `/admin/subcontractors/${id}/request-changes`,
      { body: { note } },
    ),
  adminResetPassword: (id: string) =>
    request<{ tempPassword: string; note: string }>(
      "POST",
      `/admin/subcontractors/${id}/reset-password`,
    ),
  adminGenerateContract: (id: string, templateId?: string) =>
    request<ContractRecord>(
      "POST",
      `/admin/subcontractors/${id}/generate-contract`,
      { body: templateId ? { templateId } : {} },
    ),

  // -------- admin: documents --------
  adminListSubDocuments: (subId: string) =>
    request<{ items: DocumentRecord[] }>(
      "GET",
      `/admin/subcontractors/${subId}/documents`,
    ),
  adminDownloadSubDocumentUrl: (subId: string, docId: string) =>
    apiBase() + `/admin/subcontractors/${subId}/documents/${docId}/download` + tokenQuery(),
  adminReviewDocument: (
    subId: string,
    docId: string,
    status: "approved" | "rejected",
    note?: string,
  ) =>
    request<DocumentRecord>(
      "POST",
      `/admin/subcontractors/${subId}/documents/${docId}/review`,
      { body: { status, note } },
    ),

  // -------- admin: questionnaire --------
  adminGetQuestionnaire: (subId: string) =>
    request<QuestionnaireRecord | null>(
      "GET",
      `/admin/subcontractors/${subId}/questionnaire`,
    ),
  adminReviewQuestionnaire: (
    subId: string,
    status: "approved" | "rejected",
    note?: string,
  ) =>
    request<QuestionnaireRecord>(
      "POST",
      `/admin/subcontractors/${subId}/questionnaire/review`,
      { body: { status, note } },
    ),

  // -------- admin: payments --------
  adminListSubPayments: (subId: string, cursor?: string) =>
    request<Page<PaymentRecord>>(
      "GET",
      `/admin/subcontractors/${subId}/payments` +
        (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""),
    ),
  adminCreatePayment: (
    subId: string,
    data: {
      paymentDate: string;
      amountMinor: number;
      currency?: string;
      reference?: string;
      status?: string;
      hours?: number | null;
      periodStart?: string | null;
      periodEnd?: string | null;
      rctRate?: string | null;
      rctAuthNumber?: string | null;
      vatReverseCharge?: boolean;
      siteRef?: string | null;
    },
  ) =>
    request<PaymentRecord>(
      "POST",
      `/admin/subcontractors/${subId}/payments`,
      { body: data },
    ),
  adminUploadRemittance: (subId: string, paymentId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<PaymentRecord>(
      "POST",
      `/admin/subcontractors/${subId}/payments/${paymentId}/remittance`,
      { formData: fd },
    );
  },
  adminDeletePayment: (subId: string, paymentId: string) =>
    request<{ ok: true }>(
      "DELETE",
      `/admin/subcontractors/${subId}/payments/${paymentId}`,
    ),
  // Admin marks a sub-issued invoice as paid (after the bank transfer).
  // Status flips to 'paid'.
  adminMarkPaymentPaid: (paymentId: string) =>
    request<PaymentRecord>("POST", `/admin/payments/${paymentId}/mark-paid`),

  // -------- admin: templates --------
  adminCreateTemplate: (name: string, bodyHtml: string) =>
    request<ContractTemplate>("POST", "/admin/contract-templates", {
      body: { name, bodyHtml },
    }),
  adminListTemplates: () =>
    request<{ items: ContractTemplate[] }>("GET", "/admin/contract-templates"),

  // -------- admin: change requests --------
  adminListChangeRequests: (status?: string) =>
    request<Page<ChangeRequest>>(
      "GET",
      "/admin/change-requests" + (status ? `?status=${status}` : ""),
    ),
  adminPatchChangeRequest: (id: string, status: string) =>
    request<ChangeRequest>("PATCH", `/admin/change-requests/${id}`, {
      body: { status },
    }),

  // -------- timesheets: subcontractor --------
  listMyTimesheets: (params: { from?: string; to?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    return request<{ items: Timesheet[] }>(
      "GET",
      "/me/timesheets" + (q.toString() ? `?${q}` : ""),
    );
  },
  createMyTimesheet: (data: {
    workDate: string;
    hours?: number | null;
    siteRef?: string | null;
    notes?: string | null;
  }) => request<Timesheet>("POST", "/me/timesheets", { body: data }),
  patchMyTimesheet: (id: string, data: Partial<{ hours: number | null; siteRef: string | null; notes: string | null; workDate: string }>) =>
    request<Timesheet>("PATCH", `/me/timesheets/${id}`, { body: data }),
  deleteMyTimesheet: (id: string) =>
    request<{ ok: true }>("DELETE", `/me/timesheets/${id}`),
  clockIn: (siteRef?: string | null) =>
    request<Timesheet>("POST", "/me/timesheets/clock-in", { body: siteRef ? { siteRef } : {} }),
  clockOut: () => request<Timesheet>("POST", "/me/timesheets/clock-out"),
  getMyActiveClock: () => request<Timesheet | null>("GET", "/me/timesheets/active"),

  // -------- timesheets: admin --------
  adminListSubTimesheets: (
    subId: string,
    params: { from?: string; to?: string; status?: string } = {},
  ) => {
    const q = new URLSearchParams();
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    if (params.status) q.set("status", params.status);
    return request<{ items: Timesheet[] }>(
      "GET",
      `/admin/subcontractors/${subId}/timesheets` + (q.toString() ? `?${q}` : ""),
    );
  },
  adminReviewTimesheet: (id: string, status: "approved" | "rejected") =>
    request<Timesheet>("POST", `/admin/timesheets/${id}/review`, { body: { status } }),
  adminGeneratePaymentFromPeriod: (subId: string, from: string, to: string) =>
    request<PaymentRecord>(
      "POST",
      `/admin/subcontractors/${subId}/payments/from-period`,
      { body: { from, to } },
    ),
  adminGetInvoice: (subId: string, from: string, to: string) =>
    request<InvoicePayload>(
      "GET",
      `/admin/subcontractors/${subId}/invoice?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),

  // -------- bulk advice (admin) --------
  // Preview: which subs have approved+unpaid timesheets in the period and
  // would receive a payment advice if we sent now. The UI lets the admin
  // untick anyone before committing.
  adminBulkAdvicePreview: (from: string, to: string) =>
    request<{
      period: { from: string; to: string };
      items: Array<{
        subcontractorId: string;
        fullName: string | null;
        email: string | null;
        rateAmountMinor: number | null;
        rateUnit: string | null;
        rctRate: string | null;
        sheetCount: number;
        totalHours: number;
        grossMinor: number;
        rctDeductionMinor: number;
        netMinor: number;
        currency: string;
        eligible: boolean;
        ineligibleReason: string | null;
        timesheetIds: string[];
      }>;
    }>("GET", `/admin/bulk-advice/preview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  adminBulkAdviceSend: (
    from: string,
    to: string,
    subcontractorIds: string[],
    notify = true,
  ) =>
    request<{
      created: Array<{ subId: string; paymentId: string; grossMinor: number; netMinor: number; sheetCount: number }>;
      skipped: Array<{ subId: string; reason: string }>;
      period: { from: string; to: string };
    }>("POST", "/admin/bulk-advice", { body: { from, to, subcontractorIds, notify } }),

  // CSV import for bulk advice. The CSV mirrors Enagh's export shape.
  // commit=false → preview only (per-row resolution). commit=true → create
  // payment records for matched rows, optionally email each sub.
  adminBulkAdviceImport: (
    file: File,
    periodStart: string,
    periodEnd: string,
    opts: { commit?: boolean; notify?: boolean } = {},
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("periodStart", periodStart);
    fd.append("periodEnd", periodEnd);
    const qp = new URLSearchParams();
    if (opts.commit) qp.set("commit", "true");
    if (opts.notify === false) qp.set("notify", "false");
    return request<{
      mode: "preview" | "committed";
      period: { from: string; to: string };
      headerColumns?: string[];
      itemCount?: number;
      matchedCount?: number;
      totalGrossMinor?: number;
      items?: Array<{
        rowIndex: number;
        code: string;
        csvName: string;
        jobNumber: string;
        siteAddress: string;
        quantity: number;
        rate: number;
        materialValue: number;
        extras: number;
        grossMinor: number;
        rctRate: string | null;
        rctDeductionMinor: number;
        netMinor: number;
        subcontractorId: string | null;
        subcontractorName: string | null;
        subcontractorEmail: string | null;
        primaryId: string | null;
        matched: boolean;
        ineligibleReason: string | null;
      }>;
      created?: Array<{ code: string; paymentId: string; grossMinor: number; netMinor: number }>;
      skipped?: Array<{ code: string; reason: string }>;
    }>("POST", "/admin/bulk-advice/import" + (qp.toString() ? `?${qp}` : ""), { formData: fd });
  },

  // -------- primaries (admin) --------
  // Primary = top of the 3-tier hierarchy: developers / main contractors who
  // hire BC Construction. Subs are linked to a primary; BC consolidates sub
  // work and invoices the primary.
  adminListPrimaries: (includeArchived = false) =>
    request<{ items: Primary[] }>(
      "GET",
      "/admin/primaries" + (includeArchived ? "?includeArchived=true" : ""),
    ),
  adminCreatePrimary: (data: Partial<Primary>) =>
    request<Primary>("POST", "/admin/primaries", { body: data as Json }),
  adminGetPrimary: (id: string) =>
    request<{
      primary: Primary;
      stats: {
        subcontractorCount: number;
        moneyByStatus: Record<string, { count: number; grossMinor: number; netMinor: number }>;
      };
      subcontractors: Subcontractor[];
    }>("GET", `/admin/primaries/${id}`),
  adminPatchPrimary: (id: string, data: Partial<Primary>) =>
    request<Primary>("PATCH", `/admin/primaries/${id}`, { body: data as Json }),
  adminArchivePrimary: (id: string) =>
    request<{ archived: true }>("DELETE", `/admin/primaries/${id}`),
  // Invite a primary user (creates a user with role='primary' linked to the
  // given primary). Returns a one-time temp password to share securely.
  adminInvitePrimaryUser: (primaryId: string, email: string) =>
    request<{ userId: string; email: string; primaryId: string; tempPassword: string; note: string }>(
      "POST",
      `/admin/primaries/${primaryId}/invite`,
      { body: { email } },
    ),

  // -------- primary portal (read-only) --------
  getMyPrimary: () =>
    request<{
      user: { id: string; email: string; role: string };
      primary: Primary;
      stats: { subcontractorCount: number };
    }>("GET", "/me/primary"),
  // Primary user updates their own scoped fields (only accountantEmail today).
  patchMyPrimary: (data: { accountantEmail?: string | null }) =>
    request<Primary>("PATCH", "/me/primary", { body: data as Json }),

  // -------- primary submissions (primary-side) --------
  // Primary user submits payment data to BC. Each item references one of
  // their linked subs by reference code. Server resolves and stores. Admin
  // is notified by email and processes from their inbox.
  listMySubmissions: () =>
    request<{ items: PrimarySubmission[] }>("GET", "/me/primary/submissions"),
  createMySubmission: (data: {
    periodStart?: string | null;
    periodEnd?: string | null;
    notes?: string | null;
    source?: "manual" | "csv";
    items: Array<{
      subcontractorRef?: string;
      subcontractorName?: string;
      jobNumber?: string;
      siteAddress?: string;
      quantity?: number | string;
      rate?: number | string;
      materialValue?: number | string;
      extras?: number | string;
      notes?: string;
    }>;
  }) => request<PrimarySubmission>("POST", "/me/primary/submissions", { body: data as Json }),
  getMySubmission: (id: string) =>
    request<{ submission: PrimarySubmission; items: PrimarySubmissionItem[] }>(
      "GET",
      `/me/primary/submissions/${id}`,
    ),

  // -------- admin: primary submissions inbox --------
  adminListPrimarySubmissions: (status?: string) =>
    request<{ items: PrimarySubmission[] }>(
      "GET",
      "/admin/primary-submissions" + (status ? `?status=${status}` : ""),
    ),
  adminGetPrimarySubmission: (id: string) =>
    request<{
      submission: PrimarySubmission;
      primary: Primary;
      items: PrimarySubmissionItem[];
    }>("GET", `/admin/primary-submissions/${id}`),
  adminProcessPrimarySubmission: (id: string) =>
    request<{
      created: Array<{ itemId: string; paymentId: string; grossMinor: number }>;
      skipped: Array<{ itemId: string; ref: string | null; reason: string }>;
      status: string;
    }>("POST", `/admin/primary-submissions/${id}/process`),
  adminRejectPrimarySubmission: (id: string, reason: string) =>
    request<{ rejected: true }>("POST", `/admin/primary-submissions/${id}/reject`, {
      body: { reason },
    }),
  getMyPrimaryDashboard: () =>
    request<{
      subcontractorCount: number;
      openInvoicesCount: number;
      openInvoicesNetMinor: number;
      moneyByStatus: Record<string, { count: number; grossMinor: number }>;
    }>("GET", "/me/primary/dashboard"),
  listMyPrimarySubs: () =>
    request<{
      items: Array<{
        id: string;
        fullName: string | null;
        email: string | null;
        tel: string | null;
        mob: string | null;
        natureOfServices: string | null;
        workType: string | null;
        onboardingStatus: string;
        rctRate: string | null;
        vatReverseCharge: boolean;
      }>;
    }>("GET", "/me/primary/subcontractors"),
  getMyPrimarySubDetail: (subId: string) =>
    request<{
      subcontractor: {
        id: string;
        fullName: string | null;
        email: string | null;
        natureOfServices: string | null;
        onboardingStatus: string;
        rctRate: string | null;
        vatReverseCharge: boolean;
      };
      payments: Array<Record<string, unknown>>;
      timesheets: Array<Record<string, unknown>>;
    }>("GET", `/me/primary/subcontractors/${subId}`),
  listMyPrimaryInvoices: () =>
    request<{ items: PrimaryInvoice[] }>("GET", "/me/primary/invoices"),
  getMyPrimaryInvoice: (invId: string) =>
    request<{
      invoice: PrimaryInvoice;
      primary: Primary;
      lines: Array<Record<string, unknown>>;
    }>("GET", `/me/primary/invoices/${invId}`),

  // -------- primary invoices (admin) --------
  adminListPrimaryInvoices: (primaryId: string) =>
    request<{ items: PrimaryInvoice[] }>("GET", `/admin/primaries/${primaryId}/invoices`),
  adminCreatePrimaryInvoice: (
    primaryId: string,
    data: { from: string; to: string; markupMinor?: number; notes?: string },
  ) => request<PrimaryInvoice>("POST", `/admin/primaries/${primaryId}/invoices`, { body: data }),
  adminGetPrimaryInvoice: (id: string) =>
    request<{
      invoice: PrimaryInvoice;
      primary: Primary;
      lines: (PaymentRecord & { subFullName: string })[];
    }>("GET", `/admin/primary-invoices/${id}`),
  adminMarkPrimaryInvoiceSent: (id: string) =>
    request<PrimaryInvoice>("POST", `/admin/primary-invoices/${id}/mark-sent`),
  adminMarkPrimaryInvoicePaid: (id: string) =>
    request<PrimaryInvoice>("POST", `/admin/primary-invoices/${id}/mark-paid`),

  // -------- dashboard --------
  adminDashboardStats: () =>
    request<{
      primaries: number;
      subcontractors: number;
      advisedPayments: number;
      invoicedPayments: number;
      primaryInvoicesOpen: number;
      netPaidLast30Minor: number;
    }>("GET", "/admin/dashboard-stats"),

  // -------- settings (admin) --------
  getSettings: () => request<AppSettings>("GET", "/admin/settings"),
  putSettings: (data: Partial<AppSettings>) =>
    request<{ ok: true }>("PUT", "/admin/settings", { body: data }),
};
