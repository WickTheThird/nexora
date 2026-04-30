import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { PrimarySubmission, PrimarySubmissionItem } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, AlertTriangle } from "lucide-react";

function fmtMoney(minor: number) {
  return `\u20AC${(minor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PrimarySubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [submission, setSubmission] = useState<PrimarySubmission | null>(null);
  const [items, setItems] = useState<PrimarySubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <>
      <PageHeader
        title={`Submission ${submission.id.slice(0, 8)}`}
        description={`Submitted ${new Date(submission.submittedAt).toLocaleString("en-IE")}`}
      />
      <Link to="/primary/submissions" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to submissions
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
          <div className="text-sm">{submission.periodStart || "—"} → {submission.periodEnd || "—"}</div>
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
                <td className="px-3 py-2 font-mono text-xs">{it.subcontractorRef || "—"}</td>
                <td className="px-3 py-2">{it.subcontractorName || "—"}</td>
                <td className="px-3 py-2 text-ink-600">{it.jobNumber || "—"}</td>
                <td className="px-3 py-2 text-ink-600">{it.siteAddress || "—"}</td>
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
