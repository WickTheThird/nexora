// Admin Jobs - cross-platform view of every Job Card (primary_submission)
// + every tender post (public_jobs) on the platform. Same bucket pattern
// as the primary's Jobs Posted page so the office has a single,
// familiar place to oversee work without bouncing between Submissions
// and the principal portal.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { PrimarySubmission, PublicJob } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { Briefcase, ArrowUpRight, Search, X, Download } from "lucide-react";
import { exportRowsAsCsv } from "@/lib/csv";

type Bucket = "all" | "current" | "submitted" | "archive" | "tenders";
const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "all",       label: "All" },
  { key: "current",   label: "Current" },
  { key: "submitted", label: "Submitted" },
  { key: "archive",   label: "Archive" },
  { key: "tenders",   label: "Tender posts" },
];

// Unified row shape mixing primary_submissions + public_jobs onto one
// table. `kind` is the discriminator.
type Row = {
  id: string;
  kind: "submission" | "tender";
  ref: string;
  primaryName: string | null;
  status: string;
  visibility?: string;
  itemCount?: number;
  totalGrossMinor?: number;
  createdAt: number;
  detailHref: string;
};

export function AdminJobs() {
  const toast = useToast();
  const [submissions, setSubmissions] = useState<PrimarySubmission[]>([]);
  const [tenders, setTenders] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>("all");
  const [search, setSearch] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        api.adminListPrimarySubmissions(undefined).catch(() => ({ items: [] as PrimarySubmission[] })),
        api.adminListPublicJobs().catch(() => ({ items: [] as PublicJob[] })),
      ]);
      setSubmissions(s.items);
      setTenders(t.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  // Map both feeds into one unified row stream so the table can stay
  // dumb and just render `Row`s.
  const rows = useMemo<Row[]>(() => {
    const subRows: Row[] = submissions.map(s => ({
      id: `sub-${s.id}`,
      kind: "submission",
      ref: s.jobRef || s.id.slice(0, 8),
      primaryName: null,
      status: s.status,
      itemCount: s.itemCount,
      totalGrossMinor: s.totalGrossMinor,
      createdAt: s.createdAt,
      detailHref: `/admin/primary-submissions/${s.id}`,
    }));
    const tenderRows: Row[] = tenders.map(t => ({
      id: `ten-${t.id}`,
      kind: "tender",
      ref: t.jobRef || t.id.slice(0, 8),
      primaryName: t.primaryName,
      status: t.status,
      visibility: t.visibility,
      createdAt: t.createdAt,
      detailHref: `/admin/primary-submissions`,
    }));
    return [...subRows, ...tenderRows].sort((a, b) => b.createdAt - a.createdAt);
  }, [submissions, tenders]);

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { all: 0, current: 0, submitted: 0, archive: 0, tenders: 0 };
    c.all = rows.length;
    for (const r of rows) {
      if (r.kind === "tender") c.tenders++;
      else if (r.status === "draft") c.current++;
      else if (r.status === "submitted" || r.status === "processing") c.submitted++;
      else if (r.status === "completed" || r.status === "rejected") c.archive++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (bucket === "current")        r = r.filter(x => x.kind === "submission" && x.status === "draft");
    else if (bucket === "submitted") r = r.filter(x => x.kind === "submission" && ["submitted","processing"].includes(x.status));
    else if (bucket === "archive")   r = r.filter(x => x.kind === "submission" && ["completed","rejected"].includes(x.status));
    else if (bucket === "tenders")   r = r.filter(x => x.kind === "tender");
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(x =>
        x.ref.toLowerCase().includes(q) ||
        (x.primaryName || "").toLowerCase().includes(q) ||
        x.status.toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, bucket, search]);

  const exportCsv = () => {
    exportRowsAsCsv(`admin-jobs-${new Date().toISOString().slice(0,10)}.csv`, filtered, [
      { header: "Type",       value: r => r.kind === "tender" ? "Tender post" : "Job Card" },
      { header: "Ref",        value: r => r.ref },
      { header: "Principal",  value: r => r.primaryName ?? "" },
      { header: "Status",     value: r => r.status },
      { header: "Visibility", value: r => r.visibility ?? "" },
      { header: "Items",      value: r => r.itemCount ?? "" },
      { header: "Gross EUR",  value: r => r.totalGrossMinor != null ? (r.totalGrossMinor / 100).toFixed(2) : "" },
      { header: "Created",    value: r => fmtDateTime(r.createdAt) },
    ]);
  };

  const filtersActive = !!search.trim() || bucket !== "all";
  return (
    <>
      <PageHeader
        title="Jobs"
        right={
          <Button variant="outline" onClick={exportCsv} leftIcon={<Download className="h-4 w-4" />}>
            Download CSV
          </Button>
        }
      />

      {/* Status buckets - same pattern as the primary's Jobs Posted page
          plus a 'Tender posts' bucket for the marketplace listings. */}
      <div className="flex gap-1 mb-4 border-b border-ink-200 overflow-x-auto">
        {BUCKETS.map(b => (
          <button
            key={b.key}
            type="button"
            onClick={() => setBucket(b.key)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 whitespace-nowrap transition ${
              bucket === b.key ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {b.label}
            <span className={`ml-2 text-xs ${bucket === b.key ? "text-ink-500" : "text-ink-400"}`}>
              {counts[b.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="card-padded mb-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <Input
          label="Search"
          placeholder="Ref, principal, status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center gap-2 h-[42px]">
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setBucket("all"); }} leftIcon={<X className="h-3.5 w-3.5" />}>
              Clear
            </Button>
          )}
          <div className="text-xs text-ink-500 inline-flex items-center gap-1">
            <Search className="h-3.5 w-3.5" /> {filtered.length} of {rows.length}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-64" />
      ) : filtered.length === 0 ? (
        <Empty
          icon={Briefcase}
          title="No jobs match"
          description="Adjust the bucket or search to widen the result set."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Ref</th>
                <th className="px-5 py-3">Principal</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Items</th>
                <th className="px-5 py-3 text-right">Gross</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    {r.kind === "tender" ? (
                      <Badge tone="info">Tender</Badge>
                    ) : (
                      <Badge tone="neutral">Job Card</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-ink-900">{r.ref}</td>
                  <td className="px-5 py-3 text-ink-700">{r.primaryName || <span className="text-ink-400">-</span>}</td>
                  <td className="px-5 py-3">
                    <Badge tone={
                      r.status === "submitted" || r.status === "open" ? "warn"
                      : r.status === "completed" || r.status === "filled" ? "success"
                      : r.status === "rejected" || r.status === "removed" ? "danger"
                      : "neutral"
                    }>{r.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-ink-700">{r.itemCount ?? "-"}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">{r.totalGrossMinor != null ? fmtMoney(r.totalGrossMinor, "EUR") : "-"}</td>
                  <td className="px-5 py-3 text-ink-600 text-xs">{fmtDate(r.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <Link to={r.detailHref} className="btn-ghost !py-1.5 inline-flex">
                      Open <ArrowUpRight className="h-4 w-4" />
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
