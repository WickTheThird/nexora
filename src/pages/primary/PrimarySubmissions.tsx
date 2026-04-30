import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { PrimarySubmission, PrimarySubmissionStatus } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Send, ArrowUpRight, Plus } from "lucide-react";

function fmtMoney(minor: number) {
  return `\u20AC${(minor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });
}

function statusBadge(s: PrimarySubmissionStatus) {
  const cfg: Record<PrimarySubmissionStatus, { tone: "neutral" | "info" | "success" | "danger" | "warn"; label: string }> = {
    draft:      { tone: "neutral", label: "Draft" },
    submitted:  { tone: "warn",    label: "Submitted — awaiting BC" },
    processing: { tone: "info",    label: "Processing" },
    completed:  { tone: "success", label: "Completed" },
    rejected:   { tone: "danger",  label: "Rejected" },
  };
  const c = cfg[s];
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

export function PrimarySubmissions() {
  const [items, setItems] = useState<PrimarySubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.listMySubmissions();
        setItems(r.items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <PageHeader
        title="Payment submissions"
        description="Payment data you've sent to BC Construction. Each submission is reviewed and processed into payment advices for your subs."
        right={
          <Link to="/primary/submissions/new">
            <Button variant="accent" leftIcon={<Plus className="h-4 w-4" />}>New submission</Button>
          </Link>
        }
      />

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty
          icon={Send}
          title="No submissions yet"
          description="Send payment data to BC and they'll create payment advices for your subcontractors."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3">Submitted</th>
                <th className="px-5 py-3">Period</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3 text-right">Items</th>
                <th className="px-5 py-3 text-right">Total gross</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3 text-ink-900">{fmtDate(s.submittedAt)}</td>
                  <td className="px-5 py-3 text-ink-700">
                    {s.periodStart && s.periodEnd ? `${s.periodStart} → ${s.periodEnd}` : <span className="text-ink-400">—</span>}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{s.source === "csv" ? "CSV upload" : "Manual"}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{s.itemCount}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">{fmtMoney(s.totalGrossMinor)}</td>
                  <td className="px-5 py-3">{statusBadge(s.status)}</td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/primary/submissions/${s.id}`} className="btn-ghost !py-1.5 inline-flex">
                      View <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
