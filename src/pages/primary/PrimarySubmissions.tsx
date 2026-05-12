import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { PrimarySubmission, PrimarySubmissionStatus } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Send, ArrowUpRight, Plus } from "lucide-react";

// Enagh-parity status buckets. Maps our 5 statuses into 4 user-facing
// tabs:
//   - Current  = draft (editable, sub working on it)
//   - Submitted = submitted + processing (locked, BC reviewing)
//   - Archive  = completed + rejected (terminal)
//   - All      = every status
type Bucket = "all" | "current" | "submitted" | "archive";
const BUCKETS: { key: Bucket; label: string; statuses: PrimarySubmissionStatus[] | null }[] = [
  { key: "all",       label: "All",       statuses: null },
  { key: "current",   label: "Current",   statuses: ["draft"] },
  { key: "submitted", label: "Submitted", statuses: ["submitted", "processing"] },
  { key: "archive",   label: "Archive",   statuses: ["completed", "rejected"] },
];

function fmtMoney(minor: number) {
  return `\u20AC${(minor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null) {
  if (!d) return "-";
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" }); } catch { return d; }
}

function statusBadge(s: PrimarySubmissionStatus) {
  const cfg: Record<PrimarySubmissionStatus, { tone: "neutral" | "info" | "success" | "danger" | "warn"; label: string }> = {
    draft:      { tone: "neutral", label: "Draft" },
    submitted:  { tone: "warn",    label: "Submitted - locked, awaiting BC" },
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
  const [bucket, setBucket] = useState<Bucket>("all");

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

  // Bucket counts feed the chip badges so the principal sees workload
  // at a glance ('Submitted (3)') without opening each tab.
  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { all: items.length, current: 0, submitted: 0, archive: 0 };
    for (const it of items) {
      if (it.status === "draft") c.current++;
      else if (it.status === "submitted" || it.status === "processing") c.submitted++;
      else if (it.status === "completed" || it.status === "rejected") c.archive++;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const b = BUCKETS.find(x => x.key === bucket);
    if (!b || b.statuses == null) return items;
    return items.filter(it => b.statuses!.includes(it.status));
  }, [items, bucket]);

  return (
    <>
      <PageHeader
        title="Jobs Posted"
        right={
          <Link to="/primary/submissions/new">
            <Button variant="accent" leftIcon={<Plus className="h-4 w-4" />}>New Job Card</Button>
          </Link>
        }
      />

      {/* Enagh-style status buckets: Current / Submitted / Archive +
          an 'All' catch-all. Counts on each chip so the principal
          spots backlog at a glance. */}
      <div className="flex gap-1 mb-4 border-b border-ink-200 overflow-x-auto">
        {BUCKETS.map(b => (
          <button
            key={b.key}
            type="button"
            onClick={() => setBucket(b.key)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 whitespace-nowrap transition ${
              bucket === b.key
                ? "border-ink-900 text-ink-900"
                : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {b.label}
            <span className={`ml-2 text-xs ${bucket === b.key ? "text-ink-500" : "text-ink-400"}`}>
              {counts[b.key]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton h-64" />
      ) : filtered.length === 0 ? (
        <Empty
          icon={Send}
          title={bucket === "all" ? "No Job Cards yet" : `Nothing in ${BUCKETS.find(b => b.key === bucket)?.label}`}
          description={bucket === "all"
            ? "Send your first Job Card to BC and they'll create payment advices for your subcontractors."
            : "Switch tabs to view other Job Cards."}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3">Job NR</th>
                <th className="px-5 py-3">Date Ending</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Period</th>
                <th className="px-5 py-3 text-right">Items</th>
                <th className="px-5 py-3 text-right">Total Gross</th>
                <th className="px-5 py-3">Invoice ID</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3 font-mono text-xs text-ink-900 font-semibold">{s.jobRef || <span className="text-ink-400">-</span>}</td>
                  <td className="px-5 py-3 text-ink-900 font-medium">{fmtDate(s.dateEnding)}</td>
                  <td className="px-5 py-3 text-ink-700 capitalize">{s.jobCardType || "-"}</td>
                  <td className="px-5 py-3 text-ink-600 text-xs">
                    {s.periodStart && s.periodEnd ? `${s.periodStart} → ${s.periodEnd}` : <span className="text-ink-400">-</span>}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{s.itemCount}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">{fmtMoney(s.totalGrossMinor)}</td>
                  <td className="px-5 py-3 font-mono text-xs">
                    {s.invoiceNumber ? (
                      <span className="text-ink-900">{s.invoiceNumber}</span>
                    ) : (
                      <span className="text-ink-400">-</span>
                    )}
                  </td>
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
