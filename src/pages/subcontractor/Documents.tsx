import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { DocumentRecord, DocumentMetadataPatch, DocumentType } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { PageHeader } from "@/components/layout/PortalShell";
import { fmtBytes, fmtDate, fmtDateTime } from "@/lib/format";
import {
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  Download,
  FileText,
  IdCard,
  ShieldCheck,
  FilePlus,
  HardHat,
  HeartPulse,
  Boxes,
  FolderOpen,
  AlertTriangle,
  Pencil,
  MessageSquarePlus,
  CalendarClock,
} from "lucide-react";

// Round B: Enagh's `/operatives/folder_certs.asp` model - group document
// types into named folders so the sub can find their certs at a glance.
// Each folder is a panel of types; each type still uploads/reviews
// independently. New types (safe_pass / cscs / manual_handling /
// first_aid / ppe) cover the Irish construction-cert canon.
type DocTypeDef = {
  value: DocumentType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
  required?: boolean;
};
type DocFolder = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  types: DocTypeDef[];
};
const folders: DocFolder[] = [
  {
    key: "identity",
    label: "Identity",
    icon: IdCard,
    description: "Who you are. Required before BC can pay you.",
    types: [
      { value: "photo_id", label: "Photographic ID", icon: IdCard, hint: "Passport or driving licence", required: true },
    ],
  },
  {
    key: "cards-certs",
    label: "Cards & Certs",
    icon: ShieldCheck,
    description: "Your training and safety credentials.",
    types: [
      { value: "manual_handling", label: "Manual Handling",   icon: Boxes,       hint: "Manual handling cert (typically annual)", required: true },
      { value: "hs_card",         label: "H&S card",          icon: ShieldCheck, hint: "Current safety card (optional)" },
      { value: "safe_pass",       label: "Safe Pass",         icon: HardHat,     hint: "Solas Safe Pass card (3-year cycle)" },
      { value: "first_aid",       label: "First Aid",         icon: HeartPulse,  hint: "Occupational first-aid cert (if applicable)" },
      { value: "ppe",             label: "PPE",               icon: HardHat,     hint: "PPE training / sign-off" },
    ],
  },
  {
    key: "other",
    label: "Other",
    icon: FolderOpen,
    description: "Insurance, trade certs, anything else.",
    types: [
      { value: "insurance", label: "Insurance",      icon: FileText, hint: "Public liability etc." },
      { value: "cert",      label: "Trade certs",    icon: FileText, hint: "Trade-specific certifications" },
      { value: "other",     label: "Other",          icon: FileText, hint: "Anything else relevant" },
    ],
  },
];

function reviewBadge(s: DocumentRecord["reviewStatus"]) {
  if (s === "approved")  return <Badge tone="success" icon={<CheckCircle2 className="h-3 w-3"/>}>Approved</Badge>;
  if (s === "rejected")  return <Badge tone="danger" icon={<XCircle className="h-3 w-3"/>}>Rejected</Badge>;
  return <Badge tone="warn" icon={<Clock className="h-3 w-3"/>}>Pending review</Badge>;
}

// Expiry status helpers. Compares expiresAt to "today" (midnight UTC
// boundary). Anything within 30 days surfaces as "expiring soon" so
// the sub gets a heads-up before payments get blocked. Anything past
// expires renders red and is what the worker hard-gates on.
function expiryState(expiresAt: number | null): "none" | "fresh" | "soon" | "expired" {
  if (!expiresAt) return "none";
  const now = Date.now();
  if (expiresAt < now) return "expired";
  const days = (expiresAt - now) / (1000 * 60 * 60 * 24);
  if (days <= 30) return "soon";
  return "fresh";
}
function expiryBadge(expiresAt: number | null) {
  const s = expiryState(expiresAt);
  if (s === "expired") return <Badge tone="danger" icon={<AlertTriangle className="h-3 w-3"/>}>Expired</Badge>;
  if (s === "soon")    return <Badge tone="warn"   icon={<CalendarClock className="h-3 w-3"/>}>Expires soon</Badge>;
  if (s === "fresh")   return <Badge tone="success" icon={<CheckCircle2 className="h-3 w-3"/>}>Valid</Badge>;
  return null;
}

// Convert ms-epoch <-> "YYYY-MM-DD" for <input type="date">. Date inputs
// are timezone-naive; we treat them as UTC midnight to stay consistent
// with how the worker stores card expiry dates.
function dateToYmd(ms: number | null | undefined): string {
  if (!ms) return "";
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function ymdToMs(s: string): number | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d);
}

// Card-metadata entry modal. Used in two modes:
//   "upload"  - file already picked, metadata required before POST
//   "edit"    - editing existing doc within its 10-min hold window
// Refuses submit if expires < today.
function MetadataModal({
  open, mode, docTypeLabel, initial, fileName, onSubmit, onClose, busy,
}: {
  open: boolean;
  mode: "upload" | "edit";
  docTypeLabel: string;
  initial: DocumentMetadataPatch;
  fileName?: string;
  onSubmit: (m: DocumentMetadataPatch) => Promise<void> | void;
  onClose: () => void;
  busy: boolean;
}) {
  const [issuingBody, setIssuingBody] = useState(initial.issuingBody || "");
  const [cardNumber, setCardNumber] = useState(initial.cardNumber || "");
  const [holderName, setHolderName] = useState(initial.holderName || "");
  const [issuedAt, setIssuedAt] = useState(dateToYmd(initial.issuedAt));
  const [expiresAt, setExpiresAt] = useState(dateToYmd(initial.expiresAt));
  const [err, setErr] = useState<string | null>(null);

  // Reset when the modal reopens for a different doc.
  useEffect(() => {
    if (!open) return;
    setIssuingBody(initial.issuingBody || "");
    setCardNumber(initial.cardNumber || "");
    setHolderName(initial.holderName || "");
    setIssuedAt(dateToYmd(initial.issuedAt));
    setExpiresAt(dateToYmd(initial.expiresAt));
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial.issuingBody, initial.cardNumber, initial.holderName, initial.issuedAt, initial.expiresAt]);

  const handleSubmit = async () => {
    setErr(null);
    const expMs = ymdToMs(expiresAt);
    const issMs = ymdToMs(issuedAt);
    if (!expMs) {
      setErr("Expiry date is required.");
      return;
    }
    // Refuse the whole upload if the card is already expired - matches
    // the platform-wide rule that payments cannot run against expired
    // documents. There's no point letting them upload it.
    if (expMs < Date.now()) {
      setErr("This document is already expired. Renew it before uploading.");
      return;
    }
    if (issMs && expMs && issMs > expMs) {
      setErr("Issue date is after the expiry date.");
      return;
    }
    await onSubmit({
      issuingBody: issuingBody.trim() || null,
      cardNumber: cardNumber.trim() || null,
      holderName: holderName.trim() || null,
      issuedAt: issMs,
      expiresAt: expMs,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "upload" ? `Details for ${docTypeLabel}` : `Edit ${docTypeLabel} details`}
      description={
        mode === "upload"
          ? "Copy these values from the card itself. They appear on every payment advice and on your contractor file."
          : "You have 10 minutes after each save to correct details. After that, contact the office via Support."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="accent" onClick={handleSubmit} loading={busy}>
            {mode === "upload" ? "Upload" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mode === "upload" && fileName && (
          <div className="rounded-lg bg-ink-50 border border-ink-100 p-2.5 text-xs text-ink-700">
            File: <span className="font-medium">{fileName}</span>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Issuing body"
            value={issuingBody}
            onChange={(e) => setIssuingBody(e.target.value)}
            placeholder="e.g. Solas, QQI, HSA"
            hint="Who issued the card."
          />
          <Input
            label="Card number"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            placeholder="e.g. SP-0123456"
            hint="The reference printed on the card."
          />
          <Input
            label="Holder name (on card)"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder="As shown on the card"
            hint="Should match your PPS-registered name."
          />
          <Input
            label="Issue date"
            type="date"
            value={issuedAt}
            onChange={(e) => setIssuedAt(e.target.value)}
          />
          <Input
            label="Expiry date"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            required
            hint="Required. Payments are blocked once the date passes."
          />
        </div>
        {err && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

// "After the hold window has expired, sub raises a change request"
// modal. Pre-fills with a reference to the doc so admin knows which
// row to touch.
function ChangeRequestModal({
  open, doc, docTypeLabel, onClose, onSent,
}: {
  open: boolean;
  doc: DocumentRecord | null;
  docTypeLabel: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const toast = useToast();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !doc) return;
    setMsg(
      `Please update my ${docTypeLabel} details (uploaded ${fmtDateTime(doc.uploadedAt)}, file: ${doc.originalFilename}). Current values:\n` +
      `Issuer: ${doc.issuingBody || "-"}\n` +
      `Card #: ${doc.cardNumber || "-"}\n` +
      `Holder: ${doc.holderName || "-"}\n` +
      `Issued: ${doc.issuedAt ? fmtDate(doc.issuedAt) : "-"}\n` +
      `Expires: ${doc.expiresAt ? fmtDate(doc.expiresAt) : "-"}\n\n` +
      `New values:\n`,
    );
  }, [open, doc, docTypeLabel]);

  const send = async () => {
    if (msg.trim().length < 10) {
      toast.error("Please describe the change you need.");
      return;
    }
    setBusy(true);
    try {
      await api.postMyChangeRequest(msg.trim());
      toast.success("Change request sent to the office.");
      onSent();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to send.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request change to document details"
      description="Edits are locked after 10 minutes. Send the office a note and they'll update it for you."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="accent" onClick={send} loading={busy} leftIcon={<MessageSquarePlus className="h-4 w-4" />}>
            Send request
          </Button>
        </>
      }
    >
      <Textarea
        rows={10}
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="Describe what needs changing"
      />
    </Modal>
  );
}

export function Documents() {
  const { t } = useTranslation();
  const toast = useToast();
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // The 2-stage upload state: a File is picked, but we hold off the
  // POST until the user has filled in card metadata (issuer / expiry
  // etc.). Metadata modal is also reused for "edit within hold window".
  const [pendingUpload, setPendingUpload] = useState<{
    type: DocumentType;
    typeLabel: string;
    file: File;
  } | null>(null);
  const [editingDoc, setEditingDoc] = useState<{
    doc: DocumentRecord;
    typeLabel: string;
  } | null>(null);
  const [savingMetadata, setSavingMetadata] = useState(false);

  // Change request modal (post-hold-window). Captures the doc context
  // so the office knows which row to amend.
  const [changeRequestDoc, setChangeRequestDoc] = useState<{
    doc: DocumentRecord;
    typeLabel: string;
  } | null>(null);

  const refresh = async () => {
    const { items } = await api.listMyDocuments();
    setDocs(items);
  };

  useEffect(() => {
    (async () => {
      try { await refresh(); } finally { setLoading(false); }
    })();
  }, []);

  // Stage 1 of upload: user picked a file. Defer the actual POST until
  // they fill in the metadata modal. This is the "no payments on
  // expired documents" guard rail - the modal refuses submission for
  // any card whose expiry is already in the past.
  const onFilePicked = (type: DocumentType, typeLabel: string, file: File) => {
    setPendingUpload({ type, typeLabel, file });
  };

  // Stage 2: metadata captured, fire the POST.
  const performUpload = async (metadata: DocumentMetadataPatch) => {
    if (!pendingUpload) return;
    setUploading(pendingUpload.type);
    try {
      await api.uploadMyDocument(pendingUpload.type, pendingUpload.file, metadata);
      await refresh();
      toast.success(`${pendingUpload.file.name} uploaded`);
      setPendingUpload(null);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.code === "UPLOAD_TOO_LARGE"
            ? "File is larger than 25MB. Try compressing it or take a smaller photo."
            : e.code === "UNSUPPORTED_MEDIA_TYPE"
            ? "Only PDF / JPG / PNG / HEIC / WebP allowed."
            : e.code === "DOCUMENT_EXPIRED"
            ? "This document is already expired. Renew it before uploading."
            : e.message
          : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(null);
    }
  };

  // Edit within the 10-minute hold window. After the hold, the worker
  // returns 403 / HOLD_EXPIRED; we surface that as "use change request".
  const performMetadataPatch = async (docId: string, metadata: DocumentMetadataPatch) => {
    setSavingMetadata(true);
    try {
      await api.patchMyDocumentMetadata(docId, metadata);
      await refresh();
      toast.success("Details updated");
      setEditingDoc(null);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.code === "HOLD_EXPIRED"
            ? "Edit window has closed. Please raise a change request."
            : e.code === "DOCUMENT_EXPIRED"
            ? "The new expiry date is already in the past."
            : e.message
          : "Update failed";
      toast.error(msg);
    } finally {
      setSavingMetadata(false);
    }
  };

  const deleteDoc = async (d: DocumentRecord) => {
    if (!confirm("Delete this document?")) return;
    try {
      await api.deleteMyDocument(d.id);
      await refresh();
      toast.info("Document deleted");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to delete");
    }
  };

  const download = (d: DocumentRecord) => {
    // Opens in new tab. Browser sends credentials for same-site; cross-site needs CORS + credentials include.
    const link = document.createElement("a");
    link.href = api.downloadMyDocumentUrl(d.id);
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const byType = (t: DocumentType) =>
    docs
      .filter((d) => d.documentType === t)
      .sort((a, b) => b.uploadedAt - a.uploadedAt);

  return (
    <>
      <PageHeader
        title={t("documents.title")}
        description={t("documents.intro")}
      />

      {/* Block-banner if ANY document on file is expired. Visual hint
          that the sub needs to act before payments can resume. */}
      {(() => {
        const expired = docs.filter((d) => expiryState(d.expiresAt) === "expired");
        if (expired.length === 0) return null;
        return (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-700 mt-0.5 shrink-0" />
            <div className="text-sm text-red-900">
              <div className="font-semibold">
                {expired.length === 1 ? "1 document is expired" : `${expired.length} documents are expired`}
              </div>
              <div className="text-xs mt-0.5">
                Payments cannot be processed while any uploaded document is past its expiry date. Renew the document and upload the new card to resume.
              </div>
            </div>
          </div>
        );
      })()}

      {loading ? (
        <div className="skeleton h-64" />
      ) : (
        <div className="space-y-8">
          {folders.map((folder) => (
            <section key={folder.key}>
              <div className="flex items-center gap-2 mb-3">
                <folder.icon className="h-4 w-4 text-ink-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-700">{folder.label}</h2>
                <span className="text-xs text-ink-500">· {folder.description}</span>
              </div>
              <div className="space-y-4">
                {folder.types.map((dt) => {
                  const mine = byType(dt.value);
                  const latest = mine[0];
                  return (
                    <div key={dt.value} className="card p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-ink-100 text-ink-700 grid place-items-center flex-shrink-0">
                      <dt.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-ink-900">{dt.label}</h3>
                        {dt.required && <Badge tone="neutral">Required</Badge>}
                        {latest && reviewBadge(latest.reviewStatus)}
                        {latest && expiryBadge(latest.expiresAt)}
                      </div>
                      <p className="text-sm text-ink-500 mt-0.5">{dt.hint}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <input
                      ref={(el) => (fileRefs.current[dt.value] = el)}
                      type="file"
                      accept="application/pdf,image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onFilePicked(dt.value, dt.label, f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      variant="outline"
                      leftIcon={latest ? <FilePlus className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                      loading={uploading === dt.value}
                      onClick={() => fileRefs.current[dt.value]?.click()}
                    >
                      {latest ? "Upload new" : "Upload"}
                    </Button>
                  </div>
                </div>
                {mine.length > 0 && (
                  <div className="mt-5 border-t border-ink-100 pt-4 space-y-3">
                    {mine.map((d) => {
                      const heldActive = d.metadataHeldUntil != null && d.metadataHeldUntil > Date.now();
                      const heldMsRemaining = heldActive ? (d.metadataHeldUntil! - Date.now()) : 0;
                      const heldMinutes = Math.max(1, Math.ceil(heldMsRemaining / 60000));
                      return (
                        <div
                          key={d.id}
                          className="px-3 py-3 rounded-lg border border-ink-100 bg-ink-50/40"
                        >
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-ink-800 truncate">
                                {d.originalFilename}
                              </div>
                              <div className="text-xs text-ink-500">
                                {fmtBytes(d.sizeBytes)} · uploaded {fmtDateTime(d.uploadedAt)}
                              </div>
                              {d.reviewNote && (
                                <div className={`text-xs mt-1 ${d.reviewStatus === "rejected" ? "text-red-700" : "text-ink-600"}`}>
                                  Admin note: {d.reviewNote}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {reviewBadge(d.reviewStatus)}
                              {expiryBadge(d.expiresAt)}
                              <Button variant="ghost" size="sm" onClick={() => download(d)} leftIcon={<Download className="h-4 w-4"/>}>
                                View
                              </Button>
                              {heldActive ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingDoc({ doc: d, typeLabel: dt.label })}
                                  leftIcon={<Pencil className="h-4 w-4" />}
                                >
                                  Edit details ({heldMinutes}m left)
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setChangeRequestDoc({ doc: d, typeLabel: dt.label })}
                                  leftIcon={<MessageSquarePlus className="h-4 w-4" />}
                                >
                                  Request change
                                </Button>
                              )}
                              {d.reviewStatus === "pending" && (
                                <Button variant="ghost" size="sm" onClick={() => deleteDoc(d)} leftIcon={<Trash2 className="h-4 w-4"/>}>
                                  Delete
                                </Button>
                              )}
                            </div>
                          </div>
                          {/* Card metadata strip. Read-only view of what
                              the sub entered at upload (or what admin
                              has since amended). */}
                          <dl className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-1 text-xs">
                            <div>
                              <dt className="text-ink-400">Issuer</dt>
                              <dd className="text-ink-800">{d.issuingBody || "-"}</dd>
                            </div>
                            <div>
                              <dt className="text-ink-400">Card #</dt>
                              <dd className="text-ink-800">{d.cardNumber || "-"}</dd>
                            </div>
                            <div>
                              <dt className="text-ink-400">Holder</dt>
                              <dd className="text-ink-800">{d.holderName || "-"}</dd>
                            </div>
                            <div>
                              <dt className="text-ink-400">Issued</dt>
                              <dd className="text-ink-800">{d.issuedAt ? fmtDate(d.issuedAt) : "-"}</dd>
                            </div>
                            <div>
                              <dt className="text-ink-400">Expires</dt>
                              <dd className={`font-medium ${
                                expiryState(d.expiresAt) === "expired" ? "text-red-700" :
                                expiryState(d.expiresAt) === "soon" ? "text-amber-800" :
                                "text-ink-800"
                              }`}>
                                {d.expiresAt ? fmtDate(d.expiresAt) : "-"}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      );
                    })}
                  </div>
                )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-ink-400">
        Max 10MB per file. Allowed formats: PDF, JPG, PNG, HEIC/HEIF.
      </p>

      <MetadataModal
        open={pendingUpload !== null}
        mode="upload"
        docTypeLabel={pendingUpload?.typeLabel || ""}
        fileName={pendingUpload?.file.name}
        initial={{
          expiresAt: null, issuedAt: null, cardNumber: null,
          issuingBody: null, holderName: null,
        }}
        onClose={() => setPendingUpload(null)}
        onSubmit={performUpload}
        busy={uploading !== null}
      />

      <MetadataModal
        open={editingDoc !== null}
        mode="edit"
        docTypeLabel={editingDoc?.typeLabel || ""}
        initial={editingDoc ? {
          expiresAt: editingDoc.doc.expiresAt,
          issuedAt: editingDoc.doc.issuedAt,
          cardNumber: editingDoc.doc.cardNumber,
          issuingBody: editingDoc.doc.issuingBody,
          holderName: editingDoc.doc.holderName,
        } : {}}
        onClose={() => setEditingDoc(null)}
        onSubmit={(m) => performMetadataPatch(editingDoc!.doc.id, m)}
        busy={savingMetadata}
      />

      <ChangeRequestModal
        open={changeRequestDoc !== null}
        doc={changeRequestDoc?.doc || null}
        docTypeLabel={changeRequestDoc?.typeLabel || ""}
        onClose={() => setChangeRequestDoc(null)}
        onSent={() => setChangeRequestDoc(null)}
      />
    </>
  );
}
