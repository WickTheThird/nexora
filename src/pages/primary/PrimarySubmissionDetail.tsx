import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { PrimarySubmission, PrimarySubmissionItem, SubChangeAction } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { Select, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  ArrowLeft, AlertTriangle, Edit3, Send, Trash2, Lock,
  RefreshCw, UserMinus, Repeat,
} from "lucide-react";

function fmtMoney(minor: number) {
  return `\u20AC${(minor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PrimarySubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const toast = useToast();
  const [submission, setSubmission] = useState<PrimarySubmission | null>(null);
  const [items, setItems] = useState<PrimarySubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Status-change request modal (Job Card -> draft/submitted/cancelled).
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [requestedStatus, setRequestedStatus] = useState<"draft" | "submitted" | "cancelled">("draft");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  // Sub-change request modal (remove / move / swap).
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subAction, setSubAction] = useState<SubChangeAction>("remove");
  const [affectedSubId, setAffectedSubId] = useState("");
  const [replacementSubId, setReplacementSubId] = useState("");
  const [subMessage, setSubMessage] = useState("");
  const [subSubmitting, setSubSubmitting] = useState(false);

  // Distinct subs involved in this Job Card (for the modal picker).
  const subsOnJob = useMemo(() => {
    const seen = new Map<string, string>();
    for (const it of items) {
      if (it.subcontractorId && !seen.has(it.subcontractorId)) {
        seen.set(it.subcontractorId, it.subcontractorName || it.subcontractorRef || "(unnamed)");
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const r = await api.getMySubmission(id);
        setSubmission(r.submission);
        setItems(r.items);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, toast]);

  if (loading) return <div className="skeleton h-64" />;
  if (!submission) return <Empty icon={ArrowLeft} title="Not found" description="Submission not found." />;

  const matchedCount = items.filter(i => i.matched).length;
  const status = submission.status;
  const isDraft = status === "draft";
  const isLocked = status !== "draft";

  const submitNow = async () => {
    if (!id) return;
    if (!window.confirm("Submit this draft to BC? This will LOCK the Job Card - no further edits.")) return;
    setActing(true);
    try {
      await api.submitMyDraftSubmission(id);
      toast.success("Job Card submitted and locked.");
      const r = await api.getMySubmission(id);
      setSubmission(r.submission);
      setItems(r.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Submit failed");
    } finally {
      setActing(false);
    }
  };

  const deleteDraft = async () => {
    if (!id) return;
    if (!window.confirm("Discard this draft? This cannot be undone.")) return;
    setActing(true);
    try {
      await api.deleteMyDraftSubmission(id);
      toast.success("Draft discarded.");
      nav("/primary/submissions");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Delete failed");
      setActing(false);
    }
  };

  // Send a status-change request to BC. Open a modal where the principal
  // picks the destination status + drops a note. Worker creates a
  // change_requests row that admins handle in their inbox.
  const submitStatusChangeRequest = async () => {
    if (!id) return;
    if (!statusMessage.trim()) {
      toast.error("Please explain why you need this change.");
      return;
    }
    setStatusSubmitting(true);
    try {
      await api.primaryRequestJobCardStatusChange(id, requestedStatus, statusMessage.trim());
      toast.success("Request sent to BC. They'll be in touch.");
      setStatusModalOpen(false);
      setStatusMessage("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to send request");
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Send a sub-change request (remove / move / swap a subcontractor on
  // this Job Card). Swap requires picking a replacement from the same
  // wing.
  const submitSubChangeRequest = async () => {
    if (!id) return;
    if (!affectedSubId) {
      toast.error("Pick a subcontractor.");
      return;
    }
    if (subAction === "swap" && !replacementSubId) {
      toast.error("Pick a replacement subcontractor.");
      return;
    }
    if (!subMessage.trim()) {
      toast.error("Please add a note explaining the change.");
      return;
    }
    setSubSubmitting(true);
    try {
      await api.primaryRequestJobCardSubChange(id, {
        action: subAction,
        affectedSubcontractorId: affectedSubId,
        replacementSubcontractorId: subAction === "swap" ? replacementSubId : undefined,
        message: subMessage.trim(),
      });
      toast.success("Request sent to BC.");
      setSubModalOpen(false);
      setSubMessage("");
      setAffectedSubId("");
      setReplacementSubId("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to send request");
    } finally {
      setSubSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title={submission.jobRef || `Job ${submission.id.slice(0, 8)}`}
        description={isDraft
          ? `Draft - not yet sent to BC. Last saved ${new Date(submission.submittedAt).toLocaleString("en-IE")}`
          : `Submitted ${new Date(submission.submittedAt).toLocaleString("en-IE")}`}
        right={isDraft ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={deleteDraft} loading={acting} leftIcon={<Trash2 className="h-4 w-4" />}>
              Delete draft
            </Button>
            <Button variant="outline" onClick={() => nav(`/primary/submissions/${submission.id}/edit`)} leftIcon={<Edit3 className="h-4 w-4" />}>
              Edit
            </Button>
            <Button variant="accent" onClick={submitNow} loading={acting} leftIcon={<Send className="h-4 w-4" />}>
              Submit to BC
            </Button>
          </div>
        ) : isLocked ? (
          // Locked Job Card: principal cannot edit directly, but they
          // CAN ask BC to flip the status (back to draft, etc.) or to
          // change subs on the card. Both flows post change_requests
          // rows that admin actions in their inbox.
          <div className="flex flex-wrap gap-2 items-center">
            {status === "submitted" && (
              <Badge tone="warn"><Lock className="h-3 w-3 inline mr-1" />Locked - awaiting BC</Badge>
            )}
            <Button variant="outline" onClick={() => setStatusModalOpen(true)} leftIcon={<RefreshCw className="h-4 w-4" />}>
              Request status change
            </Button>
            {items.length > 0 && (
              <Button variant="outline" onClick={() => setSubModalOpen(true)} leftIcon={<UserMinus className="h-4 w-4" />}>
                Request subcontractor change
              </Button>
            )}
          </div>
        ) : undefined}
      />
      <Link to="/primary/submissions" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Jobs Posted
      </Link>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="card-padded">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Status</div>
          <Badge tone={
            status === "completed" ? "success" :
            status === "rejected" ? "danger" :
            status === "submitted" ? "warn" : "info"
          }>{status}</Badge>
        </div>
        <div className="card-padded">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Period</div>
          <div className="text-sm">{submission.periodStart || "-"} → {submission.periodEnd || "-"}</div>
        </div>
        <div className="card-padded">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Items</div>
          <div className="text-2xl font-bold tabular-nums">{submission.itemCount}</div>
          <div className="text-xs text-ink-500 mt-1">{matchedCount} matched</div>
        </div>
        <div className="card-padded bg-ink-50">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Total gross</div>
          <div className="text-2xl font-bold text-ink-900 tabular-nums">{fmtMoney(submission.totalGrossMinor)}</div>
        </div>
      </div>

      {status === "rejected" && submission.rejectionReason && (
        <div className="card-padded mb-6 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-700 mt-0.5" />
            <div>
              <div className="font-semibold text-red-900">Rejected by BC</div>
              <p className="text-sm text-red-800 mt-1">{submission.rejectionReason}</p>
            </div>
          </div>
        </div>
      )}

      {submission.notes && (
        <div className="card-padded mb-6">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Notes</div>
          <p className="text-sm text-ink-700">{submission.notes}</p>
        </div>
      )}

      {/* Status-change request modal. BC handles in the admin Change
          Requests inbox - they can flip the Job Card's status or reject
          the request with a note. */}
      <Modal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Request status change"
        description={`Ask BC to move this Job Card to a different status. You'll be notified once they action it.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setStatusModalOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={submitStatusChangeRequest} loading={statusSubmitting} leftIcon={<Send className="h-4 w-4" />}>
              Send request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="New status"
            value={requestedStatus}
            onChange={(e) => setRequestedStatus(e.target.value as "draft" | "submitted" | "cancelled")}
            options={[
              { value: "draft", label: "Back to Draft (re-open for editing)" },
              { value: "submitted", label: "Re-submit (after BC made changes)" },
              { value: "cancelled", label: "Cancel this Job Card" },
            ]}
          />
          <Textarea
            label="Why? (required)"
            value={statusMessage}
            onChange={(e) => setStatusMessage(e.target.value)}
            rows={4}
            placeholder="e.g. We need to add a missing operative from week 2."
          />
        </div>
      </Modal>

      {/* Sub-change request modal. Three actions: remove (drop the sub
          from this card), move (mark for moving to a different card),
          swap (replace with another sub from your wing). */}
      <Modal
        open={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        title="Request subcontractor change"
        description="Ask BC to remove, move, or swap a subcontractor on this Job Card. BC actions the request from their inbox."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSubModalOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={submitSubChangeRequest} loading={subSubmitting} leftIcon={<Send className="h-4 w-4" />}>
              Send request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Action"
            value={subAction}
            onChange={(e) => setSubAction(e.target.value as SubChangeAction)}
            options={[
              { value: "remove", label: "Remove from this Job Card" },
              { value: "move", label: "Move to a different Job Card" },
              { value: "swap", label: "Swap with another subcontractor" },
            ]}
          />
          <Select
            label="Subcontractor"
            value={affectedSubId}
            onChange={(e) => setAffectedSubId(e.target.value)}
            options={[
              { value: "", label: "- pick one -" },
              ...subsOnJob.map(s => ({ value: s.id, label: s.name })),
            ]}
          />
          {subAction === "swap" && (
            <Select
              label="Replacement (must be in your wing)"
              value={replacementSubId}
              onChange={(e) => setReplacementSubId(e.target.value)}
              options={[
                { value: "", label: "- pick one -" },
                ...subsOnJob.filter(s => s.id !== affectedSubId).map(s => ({ value: s.id, label: s.name })),
              ]}
            />
          )}
          <Textarea
            label="Note for BC (required)"
            value={subMessage}
            onChange={(e) => setSubMessage(e.target.value)}
            rows={4}
            placeholder={
              subAction === "remove" ? "e.g. They didn't actually work this site."
              : subAction === "move" ? "e.g. Wrong week; move to JOB-0014."
              : "e.g. Replace John with Mark - John was on holidays."
            }
          />
          <p className="text-xs text-ink-500">
            Note: this is a request, not an automatic change. BC will action it from their admin portal.
          </p>
        </div>
      </Modal>

      <h2 className="text-lg font-semibold text-ink-900 mb-3">Line items</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 border-b border-ink-100">
            <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
              <th className="px-3 py-2">Sub code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Job</th>
              <th className="px-3 py-2">Site</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Gross</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className={`border-b border-ink-100 last:border-b-0 ${!it.matched ? "bg-amber-50/40" : ""}`}>
                <td className="px-3 py-2 font-mono text-xs">{it.subcontractorRef || "-"}</td>
                <td className="px-3 py-2">{it.subcontractorName || "-"}</td>
                <td className="px-3 py-2 text-ink-600">{it.jobNumber || "-"}</td>
                <td className="px-3 py-2 text-ink-600">{it.siteAddress || "-"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{it.quantity.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(it.rateMinor)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtMoney(it.grossMinor)}</td>
                <td className="px-3 py-2">
                  {it.paymentId ? (
                    <Badge tone="success">processed</Badge>
                  ) : it.matched ? (
                    <Badge tone="info">matched</Badge>
                  ) : (
                    <span className="text-amber-700 text-xs flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> unmatched
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
