import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type {
  BankDetails,
  DocumentRecord,
  PaymentRecord,
  Primary,
  QuestionnaireRecord,
  Subcontractor,
} from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { fmtBytes, fmtDate, fmtDateTime, fmtMoney, initials } from "@/lib/format";
import { IncomeSummary } from "@/components/payments/IncomeSummary";
import { InvoiceModal } from "@/components/payments/InvoiceModal";
import { Select, Checkbox } from "@/components/ui/Input";
import { exportRowsAsCsv } from "@/lib/csv";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  KeyRound,
  RotateCcw,
  Send,
  Trash2,
  Upload,
  MessageSquareWarning,
  Download,
  UserX,
  Plus,
} from "lucide-react";

type Tab = "overview" | "documents" | "questionnaire" | "payments";

export function SubcontractorDetail() {
  const { id = "" } = useParams();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [sub, setSub] = useState<Subcontractor | null>(null);
  const [bank, setBank] = useState<BankDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSub = async () => {
    const r = await api.adminGetSubcontractor(id);
    setSub(r.subcontractor);
    setBank(r.bank);
  };

  useEffect(() => {
    (async () => {
      try { await refreshSub(); } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const runStatus = async (fn: () => Promise<Subcontractor>, label: string) => {
    try {
      const updated = await fn();
      setSub(updated);
      toast.success(label);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  const [resetModal, setResetModal] = useState(false);
  const [newTempPw, setNewTempPw] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [changesModal, setChangesModal] = useState(false);
  const [changesNote, setChangesNote] = useState("");
  const [anonModal, setAnonModal] = useState(false);
  const [anonConfirm, setAnonConfirm] = useState("");
  const [anonLoading, setAnonLoading] = useState(false);

  const resetPassword = async () => {
    try {
      const r = await api.adminResetPassword(id);
      setNewTempPw(r.tempPassword);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  const anonymise = async () => {
    setAnonLoading(true);
    try {
      await api.adminAnonymise(id);
      toast.success("Subcontractor anonymised");
      await refreshSub();
      setAnonModal(false);
      setAnonConfirm("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setAnonLoading(false);
    }
  };

  if (loading || !sub) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-1/3" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "documents", label: "Documents" },
    { key: "questionnaire", label: "Questionnaire" },
    { key: "payments", label: "Payments" },
  ];

  return (
    <>
      <Link to="/admin/subcontractors" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to subcontractors
      </Link>

      <div className="flex items-start gap-5 mb-6 flex-wrap">
        <div className="h-14 w-14 rounded-full bg-ink-900 text-white grid place-items-center font-bold">
          {initials(sub.fullName || sub.email || "?")}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-ink-900">
            {sub.fullName || "Unnamed subcontractor"}
          </h1>
          <div className="text-ink-500 text-sm">
            {sub.email} · Created {fmtDate(sub.createdAt)}
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <Badge tone="neutral">Status: {sub.onboardingStatus.replace(/_/g, " ")}</Badge>
            {sub.clientRef && <Badge tone="neutral">Client: {sub.clientRef}</Badge>}
            {sub.submittedAt && <Badge tone="info">Submitted {fmtDate(sub.submittedAt)}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Approve/Reject/Request-changes are available from any
              non-terminal status. Previously this was gated to
              ["submitted","under_review"] which trapped freshly-invited
              subs - admin had no way to fast-track them. Now admin can
              act as soon as the user is invited. */}
          {["invited","in_progress","submitted","under_review","changes_requested"].includes(sub.onboardingStatus) && (
            <>
              <Button variant="outline" onClick={() => setChangesModal(true)} leftIcon={<MessageSquareWarning className="h-4 w-4"/>}>
                Request changes
              </Button>
              <Button variant="danger" onClick={() => setRejectModal(true)} leftIcon={<XCircle className="h-4 w-4"/>}>
                Reject
              </Button>
              <Button variant="accent" onClick={() => runStatus(() => api.adminApprove(id), "Approved")} leftIcon={<CheckCircle2 className="h-4 w-4"/>}>
                Approve
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={() => setResetModal(true)} leftIcon={<KeyRound className="h-4 w-4"/>}>
            Reset password
          </Button>
          {/* Anonymise is destructive - red hover + red text on hover
              so it reads as 'danger' even in the ghost variant. */}
          <Button
            variant="ghost"
            onClick={() => setAnonModal(true)}
            leftIcon={<UserX className="h-4 w-4"/>}
            className="hover:bg-red-50 hover:text-red-700"
          >
            Anonymise
          </Button>
        </div>
      </div>

      <div className="border-b border-ink-200 mb-6">
        <div className="flex gap-2 -mb-px">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-ink-900 text-ink-900"
                  : "border-transparent text-ink-500 hover:text-ink-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && <OverviewTab sub={sub} bank={bank} onRefresh={refreshSub} />}
      {tab === "documents" && <DocumentsTab subId={id} />}
      {tab === "questionnaire" && <QuestionnaireTab subId={id} />}
      {tab === "payments" && (
        <PaymentsTab
          subId={id}
          sub={sub}
          onSubChanged={(s) => setSub(s)}
        />
      )}

      <Modal
        open={resetModal}
        onClose={() => { setResetModal(false); setNewTempPw(null); }}
        title="Reset password"
        description={newTempPw ? "Share securely. Shown once." : "Generate a new temporary password. This will log the user out of all sessions and force them to change it on next login."}
        footer={
          newTempPw ? (
            <Button onClick={() => { setResetModal(false); setNewTempPw(null); }}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setResetModal(false)}>Cancel</Button>
              <Button variant="accent" onClick={resetPassword} leftIcon={<RotateCcw className="h-4 w-4"/>}>Reset</Button>
            </>
          )
        }
      >
        {newTempPw ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-ink-950 text-white p-4 font-mono text-sm break-all select-all">
              {newTempPw}
            </div>
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(newTempPw)}>Copy to clipboard</Button>
          </div>
        ) : (
          <p className="text-sm text-ink-600">
            Are you sure you want to reset <span className="font-medium">{sub.email}</span>'s password?
          </p>
        )}
      </Modal>

      <Modal
        open={changesModal}
        onClose={() => setChangesModal(false)}
        title="Request changes"
        description="The subcontractor will be unlocked to edit their profile again."
        footer={
          <>
            <Button variant="ghost" onClick={() => setChangesModal(false)}>Cancel</Button>
            <Button
              variant="accent"
              onClick={async () => {
                await runStatus(() => api.adminRequestChanges(id, changesNote.trim()), "Changes requested");
                setChangesModal(false);
                setChangesNote("");
              }}
            >
              Send
            </Button>
          </>
        }
      >
        <Textarea label="Note to subcontractor" value={changesNote} onChange={(e) => setChangesNote(e.target.value)} rows={5} />
      </Modal>

      <Modal
        open={anonModal}
        onClose={() => { setAnonModal(false); setAnonConfirm(""); }}
        title="Anonymise subcontractor"
        description="Irreversibly scrubs personal data. Retains signed contracts and the payment ledger for tax and contract law."
        footer={
          <>
            <Button variant="ghost" onClick={() => { setAnonModal(false); setAnonConfirm(""); }}>Cancel</Button>
            <Button
              variant="danger"
              onClick={anonymise}
              loading={anonLoading}
              disabled={anonConfirm !== "ANONYMISE"}
              leftIcon={<UserX className="h-4 w-4" />}
            >
              Anonymise
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-900">
            <strong>Cannot be undone.</strong> The subcontractor will be logged out of all sessions and their account disabled. Their name, address, phone, DOB, PPS/UTR and bank details will be erased from the database. Compliance documents will be deleted from storage.
          </div>
          <Input
            label={`Type ANONYMISE to confirm erasure of ${sub.email}`}
            value={anonConfirm}
            onChange={(e) => setAnonConfirm(e.target.value)}
            placeholder="ANONYMISE"
          />
        </div>
      </Modal>

      <Modal
        open={rejectModal}
        onClose={() => setRejectModal(false)}
        title="Reject subcontractor"
        description="This is a terminal decision. They will be locked out of further onboarding."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectModal(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await runStatus(() => api.adminReject(id, rejectReason.trim()), "Rejected");
                setRejectModal(false);
                setRejectReason("");
              }}
            >
              Reject
            </Button>
          </>
        }
      >
        <Textarea label="Reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={5} />
      </Modal>
    </>
  );
}

function fieldRow(label: string, value: string | null | undefined) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-ink-400 font-semibold mb-1">{label}</div>
      <div className="text-sm text-ink-800">{value || <span className="text-ink-400">·</span>}</div>
    </div>
  );
}

function OverviewTab({
  sub, bank, onRefresh,
}: {
  sub: Subcontractor;
  bank: BankDetails | null;
  onRefresh: () => Promise<void>;
}) {
  // Operations card: change-of-status + principal reassign live here
  // so admin doesn't have to bounce out to a separate modal. The
  // header status badges are still read-only; this is where actual
  // mutation happens.
  const toast = useToast();
  const [primaries, setPrimaries] = useState<Primary[]>([]);
  const [savingPrimary, setSavingPrimary] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  useEffect(() => {
    api.adminListPrimaries().then(r => setPrimaries(r.items)).catch(() => { /* non-fatal */ });
  }, []);
  const currentPrimary = primaries.find(p => p.id === sub.primaryId);

  const changePrincipal = async (newId: string) => {
    const target = newId || null;
    if (target === sub.primaryId) return;
    setSavingPrimary(true);
    try {
      await api.adminPatchSubcontractor(sub.id, { primaryId: target } as Partial<Subcontractor>);
      toast.success(target ? `Linked to ${primaries.find(p => p.id === target)?.name || "principal"}.` : "Unlinked from principal.");
      await onRefresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally { setSavingPrimary(false); }
  };

  const changeStatus = async (newStatus: string) => {
    if (newStatus === sub.onboardingStatus) return;
    setSavingStatus(true);
    try {
      await api.adminPatchSubcontractor(sub.id, { onboardingStatus: newStatus as Subcontractor["onboardingStatus"] });
      toast.success(`Status set to ${newStatus.replace(/_/g, " ")}.`);
      await onRefresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally { setSavingStatus(false); }
  };

  return (
    <div className="space-y-6">
      {/* Quick operations - principal reassign + manual status flip.
          Lets admin tweak the two most-touched fields without
          drilling into the precise approve/reject buttons in the
          header. */}
      <div className="card-padded bg-ink-50/40">
        <h3 className="font-semibold text-ink-900 mb-5">Operations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Select
            label="Principal (editable)"
            value={sub.primaryId || ""}
            disabled={savingPrimary}
            onChange={(e) => changePrincipal(e.target.value)}
            options={[
              { value: "", label: "- Unlinked -" },
              ...primaries.filter(p => !p.archivedAt).map(p => ({ value: p.id, label: p.name })),
            ]}
            hint={currentPrimary ? `Currently linked to ${currentPrimary.name}` : "Not on any principal's wing yet"}
          />
          <Select
            label="Status (editable)"
            value={sub.onboardingStatus}
            disabled={savingStatus}
            onChange={(e) => changeStatus(e.target.value)}
            options={[
              { value: "invited",           label: "Invited" },
              { value: "in_progress",       label: "In progress" },
              { value: "submitted",         label: "Submitted" },
              { value: "under_review",      label: "Under review" },
              { value: "changes_requested", label: "Changes requested" },
              { value: "approved",          label: "Approved" },
              { value: "active",            label: "Active" },
              { value: "rejected",          label: "Rejected" },
            ]}
            hint="Use the precise Approve / Reject / Request-changes buttons in the header for audited transitions."
          />
        </div>
      </div>

      <div className="card-padded">
        <h3 className="font-semibold text-ink-900 mb-5">Personal</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {fieldRow("Full name", sub.fullName)}
          {fieldRow("Email", sub.email)}
          {fieldRow("Phone", sub.tel)}
          {fieldRow("Mobile", sub.mob)}
          {fieldRow("Date of birth", sub.dob)}
          {fieldRow("Place of birth", sub.placeOfBirth)}
          {/* PPS lives under Personal here (tax-side identity field,
              not job-related). Matches the layout on the operative's
              own My Details page + the New Subcontractor modal. */}
          {fieldRow("PPS number", sub.ppsNumber)}
        </div>
      </div>
      <div className="card-padded">
        <h3 className="font-semibold text-ink-900 mb-5">Address</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {fieldRow("Address 1", sub.address1)}
          {fieldRow("Address 2", sub.address2)}
          {fieldRow("Town", sub.town)}
          {fieldRow("Postcode", sub.postcode)}
        </div>
      </div>
      <div className="card-padded">
        <h3 className="font-semibold text-ink-900 mb-5">Work</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {fieldRow("Work type", sub.workType)}
          {fieldRow("Nature of services", sub.natureOfServices)}
          {fieldRow("VAT registered", sub.vatRegistered ? "Yes" : "No")}
          {fieldRow("VAT number", sub.vatNumber)}
          {fieldRow(
            "Pay rate",
            sub.rateAmountMinor && sub.rateUnit
              ? `${fmtMoney(sub.rateAmountMinor, bank?.currency || "EUR")} / ${sub.rateUnit}`
              : null,
          )}
        </div>
      </div>
      <div className="card-padded">
        <h3 className="font-semibold text-ink-900 mb-1">RCT · Relevant Contracts Tax</h3>
        <p className="text-sm text-ink-500 mb-5">
          Revenue-assigned deduction rate and authorisation reference. Applied to every payment.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {fieldRow("Deduction rate", sub.rctRate ? `${sub.rctRate}%` : null)}
          {fieldRow("Authorisation number", sub.rctAuthorisationNumber)}
        </div>
      </div>
      <div className="card-padded">
        <h3 className="font-semibold text-ink-900 mb-5">Bank</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {fieldRow("Bank name", bank?.bankName)}
          {fieldRow("Account holder", bank?.accountHolderName)}
          {fieldRow("Account number", bank?.accountNumber)}
          {fieldRow("Sort code", bank?.sortCode)}
          {fieldRow("IBAN", bank?.iban)}
          {fieldRow("BIC", bank?.bic)}
          {fieldRow("Currency", bank?.currency)}
          {fieldRow("Bank ref", bank?.bankRef)}
        </div>
      </div>
    </div>
  );
}

function reviewBadge(s: DocumentRecord["reviewStatus"]) {
  if (s === "approved") return <Badge tone="success" icon={<CheckCircle2 className="h-3 w-3"/>}>Approved</Badge>;
  if (s === "rejected") return <Badge tone="danger" icon={<XCircle className="h-3 w-3"/>}>Rejected</Badge>;
  return <Badge tone="warn" icon={<Clock className="h-3 w-3"/>}>Pending</Badge>;
}

function DocumentsTab({ subId }: { subId: string }) {
  const toast = useToast();
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<{ doc: DocumentRecord; status: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");

  const refresh = async () => {
    const r = await api.adminListSubDocuments(subId);
    setDocs(r.items);
  };
  useEffect(() => {
    (async () => { try { await refresh(); } finally { setLoading(false); } })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subId]);

  const doReview = async () => {
    if (!reviewing) return;
    try {
      await api.adminReviewDocument(subId, reviewing.doc.id, reviewing.status, note || undefined);
      setReviewing(null);
      setNote("");
      await refresh();
      toast.success(`Document ${reviewing.status}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  if (loading) return <div className="skeleton h-64" />;
  if (docs.length === 0) return <div className="card p-6 text-sm text-ink-500">No documents uploaded yet.</div>;

  return (
    <>
      <div className="space-y-3">
        {docs.map((d) => (
          <div key={d.id} className="card p-4 flex items-center gap-4 flex-wrap">
            <div className="h-10 w-10 rounded-lg bg-ink-100 text-ink-700 grid place-items-center flex-shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-medium text-ink-900 truncate">{d.originalFilename}</div>
                <Badge tone="neutral">{d.documentType.replace("_", " ")}</Badge>
                {reviewBadge(d.reviewStatus)}
              </div>
              <div className="text-xs text-ink-500 mt-0.5">
                {fmtBytes(d.sizeBytes)} · {fmtDateTime(d.uploadedAt)}
              </div>
              {d.reviewNote && <div className="text-xs text-ink-600 mt-1">Note: {d.reviewNote}</div>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <a
                className="btn-ghost"
                href={api.adminDownloadSubDocumentUrl(subId, d.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="h-4 w-4" /> View
              </a>
              {d.reviewStatus === "pending" && (
                <>
                  {/* Request re-upload = reject with a default note.
                      Saves the admin from typing the same 'please
                      re-upload this' message every time. */}
                  <Button
                    variant="outline"
                    onClick={() => { setReviewing({ doc: d, status: "rejected" }); setNote(`Please re-upload this ${d.documentType.replace(/_/g, " ")}. The current file is unclear / out of date / wrong type.`); }}
                  >
                    Request re-upload
                  </Button>
                  <Button variant="outline" onClick={() => { setReviewing({ doc: d, status: "rejected" }); setNote(""); }} className="hover:bg-red-50 hover:text-red-700">Reject</Button>
                  <Button variant="accent" onClick={() => { setReviewing({ doc: d, status: "approved" }); setNote(""); }}>Approve</Button>
                </>
              )}
              {/* Approved docs can be sent back for re-upload too
                  (e.g. insurance renewed annually). */}
              {d.reviewStatus === "approved" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setReviewing({ doc: d, status: "rejected" }); setNote(`This ${d.documentType.replace(/_/g, " ")} needs a refresh - please re-upload the current version.`); }}
                >
                  Request re-upload
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        title={reviewing?.status === "approved" ? "Approve document" : "Reject document"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewing(null)}>Cancel</Button>
            <Button variant={reviewing?.status === "approved" ? "accent" : "danger"} onClick={doReview}>
              Confirm
            </Button>
          </>
        }
      >
        <Textarea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
      </Modal>
    </>
  );
}


function QuestionnaireTab({ subId }: { subId: string }) {
  const toast = useToast();
  const [q, setQ] = useState<QuestionnaireRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<"approved" | "rejected" | null>(null);
  const [note, setNote] = useState("");

  const refresh = async () => {
    const r = await api.adminGetQuestionnaire(subId);
    setQ(r);
  };

  useEffect(() => {
    (async () => { try { await refresh(); } finally { setLoading(false); } })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subId]);

  const act = async () => {
    if (!reviewing) return;
    try {
      await api.adminReviewQuestionnaire(subId, reviewing, note || undefined);
      setReviewing(null);
      setNote("");
      await refresh();
      toast.success(`Questionnaire ${reviewing}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  if (loading) return <div className="skeleton h-64" />;
  if (!q) return <div className="card p-6 text-sm text-ink-500">Not submitted yet.</div>;

  return (
    <>
      <div className="card-padded space-y-4">
        <div className="flex items-center gap-3">
          <Badge tone="neutral">v{q.version}</Badge>
          <Badge tone={q.status === "approved" ? "success" : q.status === "rejected" ? "danger" : "info"}>
            {q.status}
          </Badge>
          <div className="text-sm text-ink-500">
            Submitted {fmtDateTime(q.submittedAt)}
          </div>
        </div>
        <pre className="bg-ink-50 rounded-lg p-4 text-xs text-ink-800 overflow-auto whitespace-pre-wrap">
          {JSON.stringify(q.answers, null, 2)}
        </pre>
        {q.status === "submitted" && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setReviewing("rejected"); setNote(""); }}>Reject</Button>
            <Button variant="accent" onClick={() => { setReviewing("approved"); setNote(""); }}>Approve</Button>
          </div>
        )}
      </div>
      <Modal
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        title={reviewing === "approved" ? "Approve questionnaire" : "Reject questionnaire"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewing(null)}>Cancel</Button>
            <Button variant={reviewing === "approved" ? "accent" : "danger"} onClick={act}>Confirm</Button>
          </>
        }
      >
        <Textarea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
      </Modal>
    </>
  );
}


function PaymentsTab({
  subId,
  sub,
  onSubChanged,
}: {
  subId: string;
  sub: Subcontractor;
  onSubChanged: (s: Subcontractor) => void;
}) {
  const toast = useToast();
  const [items, setItems] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [reference, setReference] = useState("");
  const [hoursInput, setHoursInput] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [autoAmount, setAutoAmount] = useState(true);
  const [rctRate, setRctRate] = useState<string>(sub.rctRate || "");
  const [rctAuthNumber, setRctAuthNumber] = useState("");
  const [vatReverseCharge, setVatReverseCharge] = useState<boolean>(sub.vatReverseCharge);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);

  const refresh = async () => {
    const r = await api.adminListSubPayments(subId);
    setItems(r.items);
  };
  useEffect(() => {
    (async () => {
      try { await refresh(); } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subId]);

  // Auto-calculate amount from hours × rate if unit is time-based
  useEffect(() => {
    if (!autoAmount) return;
    if (!sub.rateAmountMinor || !sub.rateUnit) return;
    const h = parseFloat(hoursInput);
    if (!Number.isFinite(h) || h <= 0) return;
    if (sub.rateUnit === "fixed") return;
    const computedMinor = Math.round(h * sub.rateAmountMinor);
    setAmount((computedMinor / 100).toFixed(2));
  }, [hoursInput, sub.rateAmountMinor, sub.rateUnit, autoAmount]);

  const openCreate = () => {
    setAmount("");
    setReference("");
    setHoursInput("");
    setPeriodStart("");
    setPeriodEnd("");
    setAutoAmount(true);
    setRctRate(sub.rctRate || "");
    setRctAuthNumber("");
    setVatReverseCharge(sub.vatReverseCharge);
    setCreateOpen(true);
  };

  const create = async () => {
    setCreating(true);
    try {
      const cents = Math.round(parseFloat(amount || "0") * 100);
      if (!Number.isFinite(cents) || cents <= 0) throw new Error("Enter a valid amount");
      const hours = hoursInput ? parseFloat(hoursInput) : null;
      if (hours !== null && (!Number.isFinite(hours) || hours < 0)) throw new Error("Invalid hours");
      await api.adminCreatePayment(subId, {
        paymentDate: date,
        amountMinor: cents,
        currency: currency.toUpperCase(),
        reference: reference || undefined,
        hours,
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        rctRate: rctRate || null,
        rctAuthNumber: rctAuthNumber || null,
        vatReverseCharge,
      });
      setCreateOpen(false);
      await refresh();
      toast.success("Payment created");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const del = async (p: PaymentRecord) => {
    if (!confirm(`Delete payment of ${fmtMoney(p.amountMinor, p.currency)}?`)) return;
    try {
      await api.adminDeletePayment(subId, p.id);
      await refresh();
      toast.info("Deleted");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  // Admin confirms the bank transfer went out for this payment.
  // Server flips status to 'paid'; the timesheets attached have already
  // been moved to 'paid' status when the payment was created.
  const markPaid = async (p: PaymentRecord) => {
    if (!confirm(`Mark payment ${p.invoiceNumber || p.reference || p.id.slice(0,8)} as paid? This is irreversible.`)) return;
    try {
      await api.adminMarkPaymentPaid(p.id);
      await refresh();
      toast.success("Marked as paid");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  const uploadRemit = async (file: File) => {
    if (!uploadFor) return;
    setUploading(uploadFor);
    try {
      await api.adminUploadRemittance(subId, uploadFor, file);
      await refresh();
      toast.success("Remittance uploaded");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setUploading(null);
      setUploadFor(null);
    }
  };

  const rateText =
    sub.rateAmountMinor && sub.rateUnit
      ? `${fmtMoney(sub.rateAmountMinor, currency)} / ${sub.rateUnit}`
      : "·";

  return (
    <>
      <div className="grid md:grid-cols-2 gap-4 mb-5">
        <div className="card p-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-400 font-semibold">Pay rate</div>
            <div className="text-xl font-bold text-ink-900 mt-1 tabular-nums">{rateText}</div>
            {!sub.rateAmountMinor && (
              <div className="text-xs text-ink-500 mt-1">Set a rate to auto-calculate payments from hours.</div>
            )}
          </div>
          <Button variant="outline" onClick={() => setRateOpen(true)}>
            {sub.rateAmountMinor ? "Edit" : "Set"}
          </Button>
        </div>
        <div className="card p-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-400 font-semibold">RCT</div>
            <div className="text-xl font-bold text-ink-900 mt-1 tabular-nums">
              {sub.rctRate ? `${sub.rctRate}%` : "N/A"}
            </div>
            <div className="text-xs text-ink-500 mt-1">
              {sub.rctAuthorisationNumber ? `Auth: ${sub.rctAuthorisationNumber}` : "No Revenue authorisation recorded"}
            </div>
          </div>
          <Button variant="outline" onClick={() => setTaxOpen(true)}>
            {sub.rctRate ? "Edit" : "Set"}
          </Button>
        </div>
      </div>
      <div className="flex justify-end gap-2 mb-5">
        <Button variant="outline" onClick={() => setInvoiceOpen(true)} leftIcon={<FileText className="h-4 w-4" />}>
          Generate payment advice
        </Button>
        <Button variant="accent" onClick={openCreate} leftIcon={<Send className="h-4 w-4" />}>
          Record payment
        </Button>
      </div>

      {loading ? (
        <div className="skeleton h-64" />
      ) : (
        <>
          <IncomeSummary
            items={items}
            rateAmountMinor={sub.rateAmountMinor}
            rateUnit={sub.rateUnit}
          />

          {items.length === 0 ? (
            <div className="card p-6 text-sm text-ink-500 mt-5">No payments recorded yet.</div>
          ) : (
            <div className="card overflow-hidden mt-5">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-ink-50 border-b border-ink-100">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Period</th>
                      <th className="px-5 py-3">Hours</th>
                      <th className="px-5 py-3">Reference</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Gross</th>
                      <th className="px-5 py-3 text-right">RCT</th>
                      <th className="px-5 py-3 text-right">Net</th>
                      <th className="px-5 py-3 text-right">Remittance</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p.id} className="border-b border-ink-100 last:border-b-0">
                        <td className="px-5 py-3 text-sm text-ink-900">{fmtDate(p.paymentDate)}</td>
                        <td className="px-5 py-3 text-sm text-ink-600">
                          {p.periodStart && p.periodEnd
                            ? `${fmtDate(p.periodStart)} → ${fmtDate(p.periodEnd)}`
                            : <span className="text-ink-400">·</span>}
                        </td>
                        <td className="px-5 py-3 text-sm text-ink-700 tabular-nums">
                          {p.hours != null
                            ? p.hours.toLocaleString(undefined, { maximumFractionDigits: 2 })
                            : <span className="text-ink-400">·</span>}
                        </td>
                        <td className="px-5 py-3 text-sm text-ink-600">
                          {p.reference || "·"}
                        </td>
                        <td className="px-5 py-3">
                          {(() => {
                            const cfg: Record<string, { tone: "neutral"|"info"|"success"|"danger"|"warn"; label: string }> = {
                              advised:   { tone: "warn", label: "Advised - awaiting sub invoice" },
                              invoiced:  { tone: "info",    label: p.invoiceNumber ? `Invoiced ${p.invoiceNumber}` : "Invoiced" },
                              paid:      { tone: "success", label: "Paid" },
                              cancelled: { tone: "danger",  label: "Cancelled" },
                              processed: { tone: "warn", label: "Advised - awaiting sub invoice" },
                              pending:   { tone: "neutral", label: "Pending" },
                              reversed:  { tone: "danger",  label: "Reversed" },
                            };
                            const c = cfg[p.status] || { tone: "neutral" as const, label: p.status };
                            return <Badge tone={c.tone}>{c.label}</Badge>;
                          })()}
                        </td>
                        <td className="px-5 py-3 text-sm text-ink-900 text-right font-medium tabular-nums">
                          {fmtMoney(p.grossMinor, p.currency)}
                        </td>
                        <td className="px-5 py-3 text-sm text-right tabular-nums">
                          {p.rctRate ? (
                            <span className="text-red-700">
                              -{fmtMoney(p.rctDeductionMinor, p.currency)}
                              <span className="block text-[10px] text-ink-500">@ {p.rctRate}%{p.rctAuthNumber ? ` · ${p.rctAuthNumber}` : ""}</span>
                            </span>
                          ) : (
                            <span className="text-ink-400">·</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-ink-900 text-right font-bold tabular-nums">
                          {fmtMoney(p.netMinor, p.currency)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {p.hasRemittance ? (
                            <a className="btn-ghost !py-1.5" href={api.downloadMyRemittanceUrl(p.id)} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" /> PDF
                            </a>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={uploading === p.id}
                              leftIcon={<Upload className="h-4 w-4"/>}
                              onClick={() => { setUploadFor(p.id); fileRef.current?.click(); }}
                            >
                              Upload
                            </Button>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            {p.status !== "paid" && p.status !== "cancelled" && (
                              <Button variant="accent" size="sm" onClick={() => markPaid(p)}>
                                Mark paid
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => del(p)} leftIcon={<Trash2 className="h-4 w-4"/>}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadRemit(f);
          e.target.value = "";
        }}
      />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Record payment"
        description="Hours × rate auto-calculates the amount when a rate is set."
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={create} loading={creating}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Payment date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Period start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            <Input label="Period end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            <Input label="Hours" type="number" step="0.25" value={hoursInput} onChange={(e) => setHoursInput(e.target.value)} placeholder="0" />
          </div>
          <Input
            label={`Gross amount (${currency})`}
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAutoAmount(false);
              setAmount(e.target.value);
            }}
            hint={
              sub.rateAmountMinor && sub.rateUnit && sub.rateUnit !== "fixed" && autoAmount && hoursInput
                ? `Auto: ${hoursInput}h × ${fmtMoney(sub.rateAmountMinor, currency)} / ${sub.rateUnit}`
                : sub.rateAmountMinor && !autoAmount
                ? "Manually overridden"
                : undefined
            }
            placeholder="0.00"
          />
          <Input label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Invoice # or description" />

          <div className="pt-2 border-t border-ink-100">
            <div className="label mt-2">Irish tax (RCT &amp; VAT)</div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="RCT deduction rate"
                value={rctRate}
                options={[
                  { value: "", label: "None (not applicable)" },
                  { value: "0", label: "0% (verified gross)" },
                  { value: "20", label: "20% (standard)" },
                  { value: "35", label: "35% (unknown / unregistered)" },
                ]}
                onChange={(e) => setRctRate(e.target.value)}
                hint={sub.rctRate ? `Default for this subcontractor: ${sub.rctRate}%` : "No default set on subcontractor"}
              />
              <Input
                label="Authorisation number"
                value={rctAuthNumber}
                onChange={(e) => setRctAuthNumber(e.target.value)}
                placeholder="Revenue eRCT reference"
                disabled={!rctRate}
              />
            </div>
            {/* Live breakdown */}
            {(() => {
              const grossCents = Math.round(parseFloat(amount || "0") * 100);
              if (!Number.isFinite(grossCents) || grossCents <= 0) return null;
              const deduction = rctRate ? Math.floor(grossCents * parseInt(rctRate, 10) / 100) : 0;
              const net = grossCents - deduction;
              return (
                <div className="mt-4 rounded-lg bg-ink-950 text-white p-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-ink-400">Gross</div>
                      <div className="text-lg font-bold tabular-nums">{fmtMoney(grossCents, currency)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-ink-400">RCT</div>
                      <div className="text-lg font-bold tabular-nums text-red-300">
                        {rctRate ? `-${fmtMoney(deduction, currency)}` : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-accent-300">Net</div>
                      <div className="text-lg font-bold tabular-nums text-accent-300">{fmtMoney(net, currency)}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </Modal>

      <RateModal
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        subId={subId}
        currentAmount={sub.rateAmountMinor}
        currentUnit={sub.rateUnit}
        currency={currency}
        onSaved={(updated) => {
          onSubChanged(updated);
          setRateOpen(false);
          toast.success("Rate updated");
        }}
      />

      <TaxModal
        open={taxOpen}
        onClose={() => setTaxOpen(false)}
        subId={subId}
        currentRctRate={sub.rctRate}
        currentAuthNumber={sub.rctAuthorisationNumber}
        currentVatReverseCharge={sub.vatReverseCharge}
        onSaved={(updated) => {
          onSubChanged(updated);
          setTaxOpen(false);
          toast.success("RCT settings updated");
        }}
      />

      <InvoiceModal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        subId={subId}
        defaultFrom={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; })()}
        defaultTo={new Date().toISOString().slice(0, 10)}
      />
    </>
  );
}

function TaxModal({
  open,
  onClose,
  subId,
  currentRctRate,
  currentAuthNumber,
  currentVatReverseCharge,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  subId: string;
  currentRctRate: string | null;
  currentAuthNumber: string | null;
  currentVatReverseCharge: boolean;
  onSaved: (s: Subcontractor) => void;
}) {
  const toast = useToast();
  const [rctRate, setRctRate] = useState<string>(currentRctRate || "");
  const [authNumber, setAuthNumber] = useState<string>(currentAuthNumber || "");
  const [vrc, setVrc] = useState<boolean>(currentVatReverseCharge);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRctRate(currentRctRate || "");
    setAuthNumber(currentAuthNumber || "");
    setVrc(currentVatReverseCharge);
  }, [currentRctRate, currentAuthNumber, currentVatReverseCharge, open]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.adminPatchSubcontractor(subId, {
        rctRate: (rctRate || null) as Subcontractor["rctRate"],
        rctAuthorisationNumber: authNumber.trim() || null,
        vatReverseCharge: vrc,
      });
      onSaved(updated);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="RCT &amp; VAT settings"
      description="Revenue-assigned Relevant Contracts Tax rate and the deduction authorisation number. Applied to each payment."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={save} loading={saving}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="RCT deduction rate"
          value={rctRate}
          options={[
            { value: "", label: "None (not applicable)" },
            { value: "0", label: "0% - verified gross" },
            { value: "20", label: "20% - standard" },
            { value: "35", label: "35% - unknown / unregistered" },
          ]}
          onChange={(e) => setRctRate(e.target.value)}
        />
        <Input
          label="Revenue authorisation number"
          value={authNumber}
          onChange={(e) => setAuthNumber(e.target.value)}
          placeholder="e.g. RCTXXXXXXXXXX"
          hint="Encrypted at rest. From Revenue's eRCT system."
        />
      </div>
    </Modal>
  );
}

function RateModal({
  open,
  onClose,
  subId,
  currentAmount,
  currentUnit,
  currency,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  subId: string;
  currentAmount: number | null;
  currentUnit: string | null;
  currency: string;
  onSaved: (s: Subcontractor) => void;
}) {
  const toast = useToast();
  const [major, setMajor] = useState(currentAmount ? (currentAmount / 100).toFixed(2) : "");
  const [unit, setUnit] = useState(currentUnit || "hour");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMajor(currentAmount ? (currentAmount / 100).toFixed(2) : "");
    setUnit(currentUnit || "hour");
  }, [currentAmount, currentUnit, open]);

  const save = async () => {
    setSaving(true);
    try {
      const m = Math.round(parseFloat(major || "0") * 100);
      if (!Number.isFinite(m) || m <= 0) throw new Error("Enter a valid rate");
      const updated = await api.adminPatchSubcontractor(subId, {
        rateAmountMinor: m,
        rateUnit: unit as Subcontractor["rateUnit"],
      });
      onSaved(updated);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Set pay rate"
      description="The contractual rate used to calculate payment amounts from hours worked."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={save} loading={saving}>Save rate</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={`Rate (${currency})`}
            type="number"
            step="0.01"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            placeholder="0.00"
          />
          <Select
            label="Unit"
            value={unit}
            options={[
              { value: "hour", label: "Per hour" },
              { value: "day", label: "Per day" },
              { value: "week", label: "Per week" },
              { value: "fixed", label: "Fixed (per payment)" },
            ]}
            onChange={(e) => setUnit(e.target.value)}
          />
        </div>
        <p className="text-xs text-ink-500">
          Fixed means amounts are entered manually, not computed from hours.
        </p>
      </div>
    </Modal>
  );
}
