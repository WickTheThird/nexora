import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { PrimarySubmission, PrimarySubmissionStatus } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Select } from "@/components/ui/Input";
import { Inbox, ArrowUpRight } from "lucide-react";

function fmtMoney(minor: number) {
  return `\u20AC${(minor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });
}
function statusBadge(s: PrimarySubmissionStatus) {
  const cfg: Record<PrimarySubmissionStatus, { tone: "neutral"|"info"|"success"|"danger"|"warn"; label: string }> = {
    draft:      { tone: "neutral", label: "Draft" },
    submitted:  { tone: "warn",    label: "Awaiting your action" },
    processing: { tone: "info",    label: "Processing" },
    completed:  { tone: "success", label: "Completed" },
    rejected:   { tone: "danger",  label: "Rejected" },
  };
  const c = cfg[s];
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

const STATUSES = [
  { value: "submitted", label: "Awaiting action" },
  { value: "completed", label: "Completed" },
  { value: "rejected",  label: "Rejected" },
  { value: "",          label: "All" },
];

export function AdminPrimarySubmissions() {
  const [items, setItems] = useState<PrimarySubmission[]>([]);
  const [filter, setFilter] = useState("submitted");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.adminListPrimarySubmissions(filter || undefined);
      setItems(r.items);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  return (
    <>
      <PageHeader
        title="Primary submissions"
        description="Payment data sent in by your primaries. Process to spawn payment advices for the matched subcontractors."
        right={
          <div className="md:w-56">
            <Select
              label=""
              value={filter}
              options={STATUSES}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        }
      />

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty
          icon={Inbox}
          title="Nothing to process"
          description="When a primary submits payment data, it'll appear here for you to review."
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
                    <Link to={`/admin/primary-submissions/${s.id}`} className="btn-ghost !py-1.5 inline-flex">
                      Review <ArrowUpRight className="h-4 w-4" />
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
