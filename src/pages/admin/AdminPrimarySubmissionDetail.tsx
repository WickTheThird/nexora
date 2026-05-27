import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { Primary, PrimarySubmission, PrimarySubmissionItem, PrimarySubmissionStatus } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, AlertTriangle, CheckCircle2, X, Send, Building2 } from "lucide-react";

function fmtMoney(minor: number) {
  return `\u20AC${(minor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function statusBadge(s: PrimarySubmissionStatus) {
  const cfg: Record<PrimarySubmissionStatus, { tone: "neutral"|"info"|"success"|"danger"|"warn"; label: string }> = {
    draft:             { tone: "neutral", label: "Draft" },
    held:              { tone: "neutral", label: "Held (10-min)" },
    submitted:         { tone: "warn",    label: "Awaiting action" },
    processing:        { tone: "info",    label: "Processing" },
    awaiting_payment:  { tone: "info",    label: "Invoices issued - awaiting payments" },
    completed:         { tone: "success", label: "Completed - all paid" },
    rejected:          { tone: "danger",  label: "Rejected" },
  };
  const c = cfg[s];
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

export function AdminPrimarySubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [submission, setSubmission] = useState<PrimarySubmission | null>(null);
  const [primary, setPrimary] = useState<Primary | null>(null);
  const [items, setItems] = useState<PrimarySubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!id) return;
    try {
      const r = await api.adminGetPrimarySubmission(id);
      setSubmission(r.submission);
      setPrimary(r.primary);
      setItems(r.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const matchedCount = items.filter(i => i.matched).length;
  const unmatchedCount = items.length - matchedCount;

  const process = async () => {
    if (!submission) return;
    if (!confirm(`Process ${matchedCount} matched item${matchedCount === 1 ? "" : "s"}?\n\n${unmatchedCount > 0 ? `${unmatchedCount} unmatched row${unmatchedCount === 1 ? "" : "s"} will be SKIPPED.\n\n` : ""}This will create payment advices for each matched subcontractor and email them.`)) return;
    setBusy(true);
    try {
      const r = await api.adminProcessPrimarySubmission(submission.id);
      toast.success(`Created ${r.created.length} advices${r.skipped.length ? `, skipped ${r.skipped.length}` : ""}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!submission) return;
    const reason = prompt("Reason for rejecting this submission? (Sent to the principal)");
    if (reason == null) return;
    if (!reason.trim()) { toast.error("Reason required"); return; }
    setBusy(true);
    try {
      await api.adminRejectPrimarySubmission(submission.id, reason.trim());
      toast.info("Rejected");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="skeleton h-64" />;
  if (!submission || !primary) return <Empty icon={ArrowLeft} title="Not found" description="Submission not found." />;

  const canAction = submission.status === "submitted";

  return (
    <>
      <PageHeader
        title={submission.jobRef || `Submission ${submission.id.slice(0, 8)}`}
        description={`From ${primary.name} · ${new Date(submission.submittedAt).toLocaleString("en-IE")}`}
        right={
          canAction ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={reject} loading={busy} leftIcon={<X className="h-4 w-4" />}>
                Reject
              </Button>
              <Button variant="accent" onClick={process} loading={busy} leftIcon={<Send className="h-4 w-4" />}>
                Process &amp; create advices
              </Button>
            </div>
          ) : null
        }
      />
      <Link to="/admin/primary-submissions" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to inbox
      </Link>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="card-padded">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Status</div>
          {statusBadge(submission.status)}
        </div>
        <Link to={`/admin/primaries/${primary.id}`} className="card-padded block hover:shadow-md transition relative group">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Principal</div>
          <div className="font-medium text-ink-900 inline-flex items-center gap-1">
            <Building2 className="h-4 w-4" /> {primary.name}
          </div>
        </Link>
        <div className="card-padded">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Items</div>
          <div className="text-2xl font-bold tabular-nums">{submission.itemCount}</div>
          <div className="text-xs text-ink-500 mt-1">
            <span className="text-emerald-700 font-medium">{matchedCount} matched</span>
            {unmatchedCount > 0 && <span className="text-amber-700 font-medium ml-2">· {unmatchedCount} unmatched</span>}
          </div>
        </div>
        <div className="card-padded bg-ink-50">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Total gross</div>
          <div className="text-2xl font-bold text-ink-900 tabular-nums">{fmtMoney(submission.totalGrossMinor)}</div>
        </div>
      </div>

      {submission.status === "rejected" && submission.rejectionReason && (
        <div className="card-padded mb-6 bg-red-50 border-red-200">
          <div className="text-xs uppercase tracking-wider text-red-700 font-semibold mb-2">Rejection reason</div>
          <p className="text-sm text-red-900">{submission.rejectionReason}</p>
        </div>
      )}
      {submission.status === "completed" && (
        <div className={`card-padded mb-6 ${matchedCount > 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className={`h-5 w-5 ${matchedCount > 0 ? "text-emerald-700" : "text-amber-700"}`} />
            <div>
              <div className={`font-semibold ${matchedCount > 0 ? "text-emerald-900" : "text-amber-900"}`}>Processed</div>
              <p className={`text-sm ${matchedCount > 0 ? "text-emerald-800" : "text-amber-800"}`}>
                {matchedCount > 0
                  ? <>Created <strong>{matchedCount}</strong> payment advice{matchedCount === 1 ? "" : "s"} and emailed the matched subcontractor{matchedCount === 1 ? "" : "s"}{unmatchedCount > 0 ? <> · skipped <strong>{unmatchedCount}</strong> unmatched row{unmatchedCount === 1 ? "" : "s"}</> : null}.</>
                  : <>No payment advices were created - all <strong>{items.length}</strong> row{items.length === 1 ? "" : "s"} were unmatched (sub code didn't link to any active operative).</>}
              </p>
            </div>
          </div>
        </div>
      )}
      {submission.notes && (
        <div className="card-padded mb-6">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Principal's notes</div>
          <p className="text-sm text-ink-700">{submission.notes}</p>
        </div>
      )}

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
              <th className="px-3 py-2 text-right">Material</th>
              <th className="px-3 py-2 text-right">Extras</th>
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
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(it.materialValueMinor)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(it.extrasMinor)}</td>
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
