// Thin fetch wrapper that talks to the Samwise Worker API.
// Reads the API base URL from runtime config (public/config.js), not from build
// flags - so the SAME build artifact can be deployed to different domains.

import type {
  AppSettings,
  BankDetails,
  ChangeRequest,
  DocumentMetadataPatch,
  DocumentRecord,
  InvoicePayload,
  JobApplication,
  Me,
  OnboardingView,
  Page,
  PaymentRecord,
  PrincipalDirectoryEntry,
  Primary,
  PrimaryInvoice,
  PrimarySubmission,
  PrimarySubmissionItem,
  PublicJob,
  PublicJobRateUnit,
  PublicJobVisibility,
  QuestionnaireRecord,
  RosterEntry,
  Subcontractor,
  VendorListApplication,
  VendorListEntry,
  VendorListMembership,
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

  // -------- notifications (any authed user) --------
  listMyNotifications: (limit = 50, onlyUnread = false) =>
    request<{
      items: Array<{
        id: string; kind: string; title: string; body: string | null;
        link: string | null; entityType: string | null; entityId: string | null;
        readAt: number | null; createdAt: number;
      }>;
      unreadCount: number;
    }>("GET", `/me/notifications?limit=${limit}${onlyUnread ? "&unread=1" : ""}`),
  markNotificationRead: (id: string) =>
    request<{ ok: true }>("POST", `/me/notifications/${id}/read`),
  markAllNotificationsRead: () =>
    request<{ ok: true }>("POST", "/me/notifications/read-all"),
  getMyNotificationPrefs: () =>
    request<{ prefs: Record<string, "both" | "email" | "in_app" | "none"> }>("GET", "/me/notification-prefs"),
  setMyNotificationPrefs: (prefs: Record<string, "both" | "email" | "in_app" | "none">) =>
    request<{ prefs: Record<string, "both" | "email" | "in_app" | "none"> }>("PUT", "/me/notification-prefs", { body: { prefs } as Json }),

  // Locale preference - persisted server-side so email + push
  // templates pick the right language. localStorage is the source of
  // truth on the client; this is the mirror for backend rendering.
  patchMyPreferences: (prefs: { locale?: "en" | "ro" }) =>
    request<{ preferredLocale: "en" | "ro" }>("PATCH", "/me/preferences", { body: prefs as Json }),

  // -------- admin: signup requests inbox --------
  adminListSignupRequests: (status: "pending" | "approved" | "rejected" = "pending") =>
    request<{ items: Array<{
      id: string; kind: "primary" | "subcontractor"; fullName: string; email: string;
      mobile: string | null; trade: string | null; companyName: string | null; companyVat: string | null;
      notes: string | null; status: string; reviewedAt: number | null;
      rejectionReason: string | null; createdAt: number;
    }> }>("GET", `/admin/signup-requests?status=${status}`),
  adminApproveSignupRequest: (id: string, primaryId?: string) =>
    request<{ approved: true; userId: string; tempPassword: string; kind: "primary" | "subcontractor" }>(
      "POST", `/admin/signup-requests/${id}/approve`,
      { body: (primaryId ? { primaryId } : {}) as Json },
    ),
  adminRejectSignupRequest: (id: string, reason: string) =>
    request<{ rejected: true }>("POST", `/admin/signup-requests/${id}/reject`, { body: { reason } as Json }),

  // Cross-principal invitations dashboard. Returns every
  // principal_roster row joined to its linked sub (if any), with a
  // derived invitationStatus so the admin can filter "invited but
  // never signed up" vs "signed up + awaiting approval" vs
  // "approved" / "rejected".
  adminListInvitations: () =>
    request<{ items: Array<{
      id: string;
      primaryId: string;
      primaryName: string | null;
      rosterEmail: string;
      rosterName: string;
      linkedSubId: string | null;
      subFullName: string | null;
      subEmail: string | null;
      subcontractorRef: string | null;
      onboardingStatus: string | null;
      submittedAt: number | null;
      userVerifiedAt: number | null;
      invitationStatus: "invited" | "signed_up" | "submitted" | "approved" | "rejected";
      createdAt: number;
      updatedAt: number;
    }> }>("GET", "/admin/invitations"),

  // -------- bulk actions --------
  adminBulkSubcontractors: (
    action: "approve" | "set-rct-rate" | "anonymise",
    ids: string[],
    extra?: { rctRate?: string },
  ) => request<{
    results: Array<{ id: string; ok: boolean; error?: string; note?: string }>;
    ok: number; failed: number;
  }>("POST", "/admin/subcontractors/bulk", { body: { action, ids, ...extra } as Json }),

  adminBulkRejectSignupRequests: (ids: string[], reason: string) =>
    request<{ ok: number; failed: number }>(
      "POST", "/admin/signup-requests/bulk",
      { body: { action: "reject", ids, reason } as Json },
    ),

  // Principal-side bulk ops on their roster.
  meBulkOperatives: (
    action: "close" | "reactivate" | "accept-pairing" | "decline-pairing",
    ids: string[],
    reason?: string,
  ) => request<{
    results: Array<{ id: string; ok: boolean; error?: string; note?: string }>;
    ok: number; failed: number;
  }>("POST", "/me/primary/operatives/bulk", { body: { action, ids, reason } as Json }),
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

  // -------- Web push (any role) --------
  // Fetch the VAPID public key the client uses when subscribing.
  // Returns null when push isn't configured server-side.
  getPushPublicKey: () =>
    request<{ publicKey: string | null }>("GET", "/me/push/public-key"),
  // Register a PushSubscription with the server. Body shape mirrors
  // the W3C PushSubscription.toJSON() output.
  subscribePush: (subscription: PushSubscriptionJSON) =>
    request<{ id: string }>("POST", "/me/push/subscribe", {
      body: subscription as unknown as Record<string, unknown>,
    }),
  unsubscribePush: (endpoint: string) =>
    request<{ ok: true }>("DELETE", "/me/push/subscribe", {
      body: { endpoint },
    }),

  // -------- documents --------
  listMyDocuments: () =>
    request<{ items: DocumentRecord[] }>("GET", "/me/documents"),
  uploadMyDocument: (documentType: string, file: File, metadata?: DocumentMetadataPatch) => {
    const fd = new FormData();
    fd.append("documentType", documentType);
    fd.append("file", file);
    if (metadata) {
      // Card metadata is captured up-front via the mandatory entry
      // modal. Sent as JSON to keep the formdata flat.
      fd.append("metadata", JSON.stringify(metadata));
    }
    return request<DocumentRecord>("POST", "/me/documents", { formData: fd });
  },
  downloadMyDocumentUrl: (id: string) =>
    apiBase() + `/me/documents/${id}/download` + tokenQuery(),
  deleteMyDocument: (id: string) =>
    request<{ ok: true }>("DELETE", `/me/documents/${id}`),
  // Sub-side metadata edit. Server enforces the 10-minute hold
  // window via metadata_held_until; outside the window the worker
  // returns 403 and the UI surfaces a "Submit change request" CTA.
  patchMyDocumentMetadata: (id: string, metadata: DocumentMetadataPatch) =>
    request<DocumentRecord>("PATCH", `/me/documents/${id}/metadata`, { body: metadata as Record<string, unknown> }),

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
  // Principal: request the office to change a Job Card's status.
  primaryRequestJobCardStatusChange: (
    submissionId: string,
    requestedStatus: "draft" | "submitted" | "cancelled",
    message: string,
  ) =>
    request<ChangeRequest>(
      "POST",
      `/me/primary/submissions/${submissionId}/request-status-change`,
      { body: { requestedStatus, message } },
    ),
  // Principal: request the office to remove / move / swap a subcontractor
  // on a Job Card. 'swap' requires replacementSubcontractorId.
  primaryRequestJobCardSubChange: (
    submissionId: string,
    payload: {
      action: "remove" | "move" | "swap";
      affectedSubcontractorId: string;
      replacementSubcontractorId?: string;
      message: string;
    },
  ) =>
    request<ChangeRequest>(
      "POST",
      `/me/primary/submissions/${submissionId}/request-sub-change`,
      { body: payload },
    ),

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
    // Required - stored encrypted at rest. Captured at create time so
    // admin can record it during initial onboarding.
    ppsNumber?: string;
    // Optional - link the sub to a Principal from the creation modal.
    // Server validates the principal exists + isn't archived.
    primaryId?: string;
    // (clientRef no longer accepted from the client - worker auto-
    // generates CLI-NNNN. Same for subcontractor_ref \u2192 SUB-NNNN.)
  }) =>
    request<{
      subcontractorId: string;
      userId: string;
      email: string;
      primaryId: string | null;
      tempPassword: string;
      subRef: string;
      clientRef: string;
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
  // Admin can patch card metadata at any time, regardless of the
  // 10-minute sub-side hold. Used both for filling in fields the
  // sub left blank and for correcting typos when the sub raises a
  // change request.
  adminPatchDocumentMetadata: (
    subId: string,
    docId: string,
    metadata: DocumentMetadataPatch,
  ) =>
    request<DocumentRecord>(
      "PATCH",
      `/admin/subcontractors/${subId}/documents/${docId}/metadata`,
      { body: metadata as Record<string, unknown> },
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
  // Global payment listing for the Advice kanban. Joins subcontractor name.
  adminListPayments: (params: { status?: string; from?: string; to?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    if (params.limit) q.set("limit", String(params.limit));
    return request<{
      items: Array<PaymentRecord & {
        subcontractorName: string | null;
        subcontractorEmail: string | null;
        subcontractorRef: string | null;
      }>;
    }>("GET", "/admin/payments" + (q.toString() ? `?${q}` : ""));
  },

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

  adminGetInvoice: (subId: string, from: string, to: string) =>
    request<InvoicePayload>(
      "GET",
      `/admin/subcontractors/${subId}/invoice?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),

  // -------- bulk advice (admin) --------
  // Preview: which subs have approved+unpaid payment lines in the period and
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

  // Invite another admin. No public sign-up path for admin role (the
  // BC back office) - this is the only way to create one. Returns
  // the temp password once; the invitee also gets it via email.
  adminInviteAdmin: (email: string) =>
    request<{ userId: string; email: string; tempPassword: string; note: string }>(
      "POST",
      "/admin/admin-users/invite",
      { body: { email } },
    ),

  // -------- primary portal (read-only) --------
  getMyPrimary: () =>
    request<{
      user: { id: string; email: string; role: string };
      primary: Primary;
      stats: { subcontractorCount: number };
      jobCardCalc?: {
        vatRatePercent: number;
        lessSubsDefaultMinor: number;
      };
      // Latest News panel content (admin-controlled in Settings)
      latestNews?: string | null;
      // Email used by the principal's "Changes Request" button
      changesRequestEmail?: string | null;
    }>("GET", "/me/primary"),
  // Primary user updates their own scoped fields. Company-level info
  // (name, VAT, address) is still admin-managed.
  patchMyPrimary: (data: {
    accountantEmail?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    phone?: string | null;
  }) => request<Primary>("PATCH", "/me/primary", { body: data as Json }),
  // -------- primary site IDs (managed registry) --------
  // Per-principal list of registered Revenue SIN numbers (DUB48662N etc.).
  // Mirrors Enagh's "Site IDs" page - add once, reuse on every Job Card.
  listMyPrincipalSiteIds: (includeArchived = false) =>
    request<{
      items: Array<{
        id: string;
        primaryId: string;
        siteId: string;
        projectName: string | null;
        address: string | null;
        notes: string | null;
        archivedAt: number | null;
        createdAt: number;
        updatedAt: number;
      }>;
    }>("GET", "/me/primary/site-ids" + (includeArchived ? "?includeArchived=true" : "")),
  createMyPrincipalSiteId: (data: {
    siteId: string;
    projectName?: string | null;
    address?: string | null;
    notes?: string | null;
  }) => request<{
    id: string;
    primaryId: string;
    siteId: string;
    projectName: string | null;
    address: string | null;
    notes: string | null;
    archivedAt: number | null;
    createdAt: number;
    updatedAt: number;
  }>("POST", "/me/primary/site-ids", { body: data as Json }),
  archiveMyPrincipalSiteId: (id: string) =>
    request<{ archived: true }>("DELETE", `/me/primary/site-ids/${id}`),

  // -------- primary sites (aggregated view) --------
  // Lets the principal see what work is happening on each site across ALL
  // their subs. Server scopes by primary_id, so other principals' sites
  // never appear.
  listMyPrincipalSites: () =>
    request<{
      items: Array<{
        siteRef: string;
        subCount: number;
        sheetCount: number;
        totalHours: number;
        lastWorked: string | null;
        paymentCount: number;
        totalGrossMinor: number;
        totalNetMinor: number;
        paidNetMinor: number;
      }>;
    }>("GET", "/me/primary/sites"),
  getMyPrincipalSiteDetail: (siteRef: string) =>
    request<{
      siteRef: string;
      totals: {
        subCount: number;
        totalHours: number;
        sheetCount: number;
        totalGrossMinor: number;
        totalNetMinor: number;
        paidNetMinor: number;
      };
      subs: Array<{
        subcontractorId: string;
        fullName: string | null;
        email: string | null;
        sheetCount: number;
        totalHours: number;
        firstDate: string | null;
        lastDate: string | null;
        paymentCount: number;
        totalGrossMinor: number;
        totalNetMinor: number;
        paidNetMinor: number;
      }>;
    }>("GET", `/me/primary/sites/${encodeURIComponent(siteRef)}`),

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
    // Job Card metadata (Enagh-style). If dateEnding + jobCardType are set
    // and periodStart/End aren't, the worker derives the window.
    jobCardType?: "weekly" | "fortnightly" | "monthly";
    dateEnding?: string | null;
    // Enagh's Save → Calculate → Submit flow. 'draft' is editable, no admin
    // notification, no invoice. 'submitted' (default) is the locked state.
    status?: "draft" | "submitted";
    // A3 hardening: client sends the totals it displayed; worker validates
    // within ±€0.05 of its own per-line recompute and rejects on mismatch.
    vatAmountMinor?: number;
    lessSubsAppliedMinor?: number;
    totalToPayBcMinor?: number;
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
  // Update a draft submission (replaces items wholesale).
  updateMyDraftSubmission: (id: string, data: {
    periodStart?: string | null;
    periodEnd?: string | null;
    notes?: string | null;
    jobCardType?: "weekly" | "fortnightly" | "monthly";
    dateEnding?: string | null;
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
  }) => request<PrimarySubmission>("PATCH", `/me/primary/submissions/${id}`, { body: data as Json }),
  // Submit a draft. Moves into a 10-minute 'held' window during which
  // the principal can still edit, cancel-hold, or release-now.
  submitMyDraftSubmission: (id: string) =>
    request<PrimarySubmission>("POST", `/me/primary/submissions/${id}/submit`),
  // Skip the 10-minute hold and submit immediately.
  releaseMyHeldSubmission: (id: string) =>
    request<PrimarySubmission>("POST", `/me/primary/submissions/${id}/release-now`),
  // Cancel the hold and revert to draft for further editing.
  cancelMyHeldSubmission: (id: string) =>
    request<PrimarySubmission>("POST", `/me/primary/submissions/${id}/cancel-hold`),
  // Delete a draft.
  deleteMyDraftSubmission: (id: string) =>
    request<{ deleted: true }>("DELETE", `/me/primary/submissions/${id}`),
  getMySubmission: (id: string) =>
    request<{ submission: PrimarySubmission; items: PrimarySubmissionItem[] }>(
      "GET",
      `/me/primary/submissions/${id}`,
    ),

  // -------- admin: primary submissions inbox --------
  adminListPrimarySubmissions: (status?: string, primaryId?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (primaryId) q.set("primaryId", primaryId);
    return request<{ items: PrimarySubmission[] }>(
      "GET",
      "/admin/primary-submissions" + (q.toString() ? `?${q.toString()}` : ""),
    );
  },
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
        subcontractorRef: string | null;
        fullName: string | null;
        email: string | null;
        tel: string | null;
        mob: string | null;
        natureOfServices: string | null;
        workType: string | null;
        onboardingStatus: string;
        rctRate: string | null;
        vatReverseCharge: boolean;
        rateAmountMinor: number | null;
        rateUnit: string | null;
        closedAt: number | null;
        // Pairing governance: 'proposed' until principal accepts; 'active'
        // after; 'declined' if they declined; null if no pairing yet.
        primaryLinkStatus: "proposed" | "active" | "declined" | null;
        primaryLinkProposedAt: number | null;
      }>;
    }>("GET", "/me/primary/subcontractors"),
  // Pairing governance - principal accepts the assignment from admin.
  acceptMyPrincipalPairing: (subId: string) =>
    request<{ id: string; primaryLinkStatus: string | null }>(
      "POST", `/me/primary/operatives/${subId}/accept-pairing`,
    ),
  declineMyPrincipalPairing: (subId: string, reason: string) =>
    request<{ declined: true }>(
      "POST", `/me/primary/operatives/${subId}/decline-pairing`,
      { body: { reason } as Json },
    ),
  // Principal-set Standard Rate per operative (Enagh-style). Server scopes
  // by primary_id so a principal can only edit their own linked subs.
  setMyPrincipalOperativeRate: (
    subId: string,
    data: { rateAmountMinor: number; rateUnit?: "hour" | "day" | "week" | "fixed" },
  ) => request<{ id: string; rateAmountMinor: number | null; rateUnit: string | null }>(
    "PATCH",
    `/me/primary/operatives/${subId}/standard-rate`,
    { body: data as Json },
  ),
  // Mark an operative Closed (Enagh "Mark In-Active"). Drops them from
  // the Job Card auto-list. Idempotent.
  closeMyPrincipalOperative: (subId: string) =>
    request<{ id: string; closedAt: number | null }>(
      "POST",
      `/me/primary/operatives/${subId}/close`,
    ),
  // Bring a Closed operative back ("Mark Active" reactivation). Triggers
  // an admin re-confirmation notification.
  reactivateMyPrincipalOperative: (subId: string) =>
    request<{ id: string; closedAt: number | null }>(
      "POST",
      `/me/primary/operatives/${subId}/reactivate`,
    ),

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
  // A5: Void / credit-note flow. Voiding flips status to 'cancelled'
  // (number stays in sequence). Credit notes are sibling documents with
  // their own number sequence (BC-{shortname}-CN-{year}-{NNN}).
  adminVoidPrimaryInvoice: (id: string, reason: string) =>
    request<{ invoice: PrimaryInvoice }>(
      "POST", `/admin/primary-invoices/${id}/void`,
      { body: { reason } as Json },
    ),
  adminCreatePrimaryCreditNote: (
    invoiceId: string,
    data: { grossMinor: number; vatMinor?: number; reason?: string },
  ) =>
    request<{ creditNote: {
      id: string; primaryId: string; invoiceId: string; creditNoteNumber: string;
      grossMinor: number; vatMinor: number; totalMinor: number; currency: string;
      reason: string | null; status: string; issuedAt: string; createdAt: number;
    } }>(
      "POST", `/admin/primary-invoices/${invoiceId}/credit-note`,
      { body: data as Json },
    ),
  adminListPrimaryCreditNotes: (invoiceId: string) =>
    request<{ items: Array<{
      id: string; creditNoteNumber: string; grossMinor: number; totalMinor: number;
      reason: string | null; status: string; issuedAt: string; createdAt: number;
    }> }>("GET", `/admin/primary-invoices/${invoiceId}/credit-notes`),

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

  // One-shot: rewrite legacy SUB-NNNN refs to plaintext PPS for any
  // subs that still have a numeric ref + a PPS on file.
  adminMigrateSubRefs: () =>
    request<{ updated: number; skipped: Array<{ id: string; reason: string }> }>(
      "POST", "/admin/migrate-sub-refs",
    ),

  // -------- settings (admin) --------
  getSettings: () => request<AppSettings>("GET", "/admin/settings"),
  putSettings: (data: Partial<AppSettings>) =>
    request<{ ok: true }>("PUT", "/admin/settings", { body: data }),

  // -------- Public jobs marketplace - DECOMMISSIONED --------
  // The principal-posting + sub-browsing flow was removed. Only the
  // admin read-only review of historical listings remains so the office
  // can inspect old data when needed.
  adminListPublicJobs: (status?: string) =>
    request<{ items: PublicJob[] }>("GET", `/admin/public-jobs${status ? `?status=${status}` : ""}`),

  // -------- Site assignments (principal-driven) --------
  primaryListOperativeAssignments: (subId: string) =>
    request<{
      items: Array<{
        id: string;
        subcontractorId: string;
        primaryId: string;
        siteId: string;
        siteCode: string | null;
        siteProject: string | null;
        siteAddress: string | null;
        status: "active" | "completed" | "terminated";
        assignedAt: number;
        endedAt: number | null;
        endReason: string | null;
        notes: string | null;
      }>;
    }>("GET", `/me/primary/operatives/${subId}/assignments`),
  primaryAssignOperative: (subId: string, data: { siteId: string; notes?: string }) =>
    request<{ assignment: Record<string, unknown> }>(
      "POST",
      `/me/primary/operatives/${subId}/assignments`,
      { body: data },
    ),
  primaryEndAssignment: (subId: string, assignmentId: string, reason?: string) =>
    request<{ ended: true }>(
      "POST",
      `/me/primary/operatives/${subId}/assignments/${assignmentId}/end`,
      reason ? { body: { reason } } : undefined,
    ),

  // -------- Principal roster (workers the principal has claimed) --------
  // The roster is the principal's own list of workers (PPS + email + name).
  // It exists independently of whether the workers have a sub account.
  // When a sub later signs up + is approved with a matching PPS, the
  // server auto-populates linkedSubId on the roster entry.
  primaryListRoster: () =>
    request<{ items: RosterEntry[] }>("GET", "/me/primary/roster"),
  primaryAddRosterEntry: (data: { pps: string; email: string; name: string }) =>
    request<RosterEntry>("POST", "/me/primary/roster", { body: data }),
  primaryDeleteRosterEntry: (id: string) =>
    request<{ ok: true }>("DELETE", `/me/primary/roster/${id}`),
  // Edit a roster entry (e.g. fix a PPS typo). Any combination of pps,
  // email, name may be sent. PPS change re-runs the linkage.
  primaryUpdateRosterEntry: (id: string, data: { pps?: string; email?: string; name?: string }) =>
    request<RosterEntry>("PATCH", `/me/primary/roster/${id}`, { body: data }),
  // Bulk import - the worker validates again server-side, so the client
  // can send the pre-parsed rows directly.
  primaryImportRoster: (rows: Array<{ pps: string; email: string; name: string }>) =>
    request<{
      added: number;
      skipped: Array<{ pps: string; reason: string }>;
    }>("POST", "/me/primary/roster/import", { body: { rows } }),

  // -------- Principal vendor list (talent pool) --------
  // Kept: the principal's own curated roster of approved operatives +
  // favourites. SUB-initiated 'apply to vendor list' is gone with the
  // marketplace; principal adds operatives directly via Operative
  // Requests now.
  primaryListVendorList: (params: { status?: VendorListEntry["status"]; favourite?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.favourite) qs.set("favourite", "1");
    const s = qs.toString();
    return request<{ items: VendorListEntry[] }>("GET", `/me/primary/vendor-list${s ? `?${s}` : ""}`);
  },
  primaryAddToVendorList: (subId: string) =>
    request<{ subcontractorId: string; createdAt: number; status: "approved" }>(
      "POST", `/me/primary/vendor-list/${subId}`,
    ),
  primaryRemoveFromVendorList: (subId: string, reason?: string) =>
    request<{ removed: true }>(
      "DELETE", `/me/primary/vendor-list/${subId}`,
      reason ? { body: { reason } } : undefined,
    ),
  primaryToggleVendorListFavourite: (subId: string, favourite: boolean) =>
    request<{ subcontractorId: string; isFavourite: boolean }>(
      "POST", `/me/primary/vendor-list/${subId}/favourite`, { body: { favourite } },
    ),
  primaryListFavouriteSubs: () =>
    request<{ items: { subcontractorId: string; createdAt: number }[] }>("GET", "/me/primary/favourite-subs"),
  primaryAddFavouriteSub: (subId: string) =>
    request<{ subcontractorId: string; createdAt: number }>("POST", `/me/primary/favourite-subs/${subId}`),
  primaryRemoveFavouriteSub: (subId: string) =>
    request<{ removed: true }>("DELETE", `/me/primary/favourite-subs/${subId}`),
};
