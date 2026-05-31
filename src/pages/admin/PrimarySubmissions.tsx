import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { PrimarySubmission, PrimarySubmissionStatus } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { getHelp } from "@/lib/helpContent";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Inbox, ArrowUpRight, X, CheckCircle2 } from "lucide-react";

function fmtMoney(minor: number) {
  return `\u20AC${(minor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });
}
function statusBadge(s: PrimarySubmissionStatus) {
  const cfg: Record<PrimarySubmissionStatus, { tone: "neutral"|"info"|"success"|"danger"|"warn"; label: string }> = {
    draft:             { tone: "neutral", label: "Draft" },
    submitted:         { tone: "warn",    label: "Submitted" },
    processing:        { tone: "info",    label: "Processing" },
    completed:         { tone: "success", label: "Completed" },
    rejected:          { tone: "danger",  label: "Rejected" },
  };
  const c = cfg[s];
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

// Bucket presets matching the Subcontractors / Jobs Posted pattern.
// 'Current' = awaiting BC action (submitted + processing).
// 'Archive' = closed lifecycle (completed + rejected). 'Draft' kept
// as a separate bucket because admin shouldn't normally action
// principal drafts but might want to peek.
type Bucket = "all" | "current" | "draft" | "archive";
const BUCKETS: { key: Bucket; label: string; statuses: PrimarySubmissionStatus[] | null }[] = [
  { key: "all",     label: "All",     statuses: null },
  { key: "current", label: "Current", statuses: ["submitted","processing"] },
  { key: "draft",   label: "Drafts",  statuses: ["draft"] },
  { key: "archive", label: "Archive", statuses: ["completed","rejected"] },
];

export function AdminPrimarySubmissions() {
  const toast = useToast();
  const [items, setItems] = useState<PrimarySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>("current");
  const [search, setSearch] = useState("");
  // Per-row selection for bulk actions on this page (mirrors the
  // pattern on subcontractors). Persistent across bucket / search.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // Pull everything once, bucket client-side - keeps the chip
      // counts honest and avoids round-trips on every chip click.
      const r = await api.adminListPrimarySubmissions(undefined);
      setItems(r.items);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const counts: Record<Bucket, number> = useMemo(() => ({
    all: items.length,
    current: items.filter(s => s.status === "submitted" || s.status === "processing").length,
    draft: items.filter(s => s.status === "draft").length,
    archive: items.filter(s => s.status === "completed" || s.status === "rejected").length,
  }), [items]);

  const visible = useMemo(() => {
    const cfg = BUCKETS.find(b => b.key === bucket);
    let rows = cfg && cfg.statuses ? items.filter(s => cfg.statuses!.includes(s.status)) : items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(s =>
        (s.jobRef || "").toLowerCase().includes(q) ||
        (s.notes || "").toLowerCase().includes(q) ||
        (s.invoiceNumber || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [items, bucket, search]);

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectAllVisible = () => setSelected(new Set(visible.map(v => v.id)));
  const clearSelection = () => setSelected(new Set());

  // Bulk-process: walks the selection and POSTs the existing
  // single-process endpoint for each. Auto-invoice still fires per
  // submission (whatever the worker normally does on process).
  const bulkProcess = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Process ${selected.size} submission${selected.size === 1 ? "" : "s"}? Each will be moved to status='completed' and (where applicable) an invoice is auto-generated.`)) return;
    setActing(true);
    let ok = 0, failed = 0;
    for (const id of selected) {
      try { await api.adminProcessPrimarySubmission(id); ok++; }
      catch { failed++; }
    }
    toast.success(`Processed ${ok}.${failed ? ` ${failed} failed.` : ""}`);
    clearSelection();
    await load();
    setActing(false);
  };

  return (
    <>
      <PageHeader title="Principal submissions" help={getHelp("submissions")} />

      {/* Bucket tabs - All / Current / Drafts / Archive. */}
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
            <span className={`ml-2 text-xs ${bucket === b.key ? "text-ink-500" : "text-ink-400"}`}>{counts[b.key]}</span>
          </button>
        ))}
      </div>

      <div className="card-padded mb-4">
        <Input
          label="Search"
          placeholder="Job NR, notes, invoice ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Selection bar - shows when at least one row is picked. Bulk
          actions on this page: process selected. More to follow. */}
      {selected.size > 0 && (
        <div className="rounded-lg bg-ink-900 text-white px-4 py-2 flex items-center justify-between gap-3 mb-3 sticky top-2 z-10">
          <div className="text-sm">
            <strong className="tabular-nums">{selected.size}</strong> selected
          </div>
          <div className="flex gap-2 items-center">
            <Button variant="ghost" size="sm" onClick={clearSelection} className="text-white hover:bg-white/10" leftIcon={<X className="h-3.5 w-3.5" />}>Clear</Button>
            <Button variant="accent" size="sm" onClick={bulkProcess} loading={acting} leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}>Process selected</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="skeleton h-64" />
      ) : visible.length === 0 ? (
        <Empty icon={Inbox} title="Nothing here" description="No submissions match the bucket / search." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={visible.length > 0 && visible.every(v => selected.has(v.id))}
                    onChange={(e) => e.target.checked ? selectAllVisible() : clearSelection()}
                  />
                </th>
                <th className="px-5 py-3">Job NR</th>
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
              {visible.map((s) => (
                <tr key={s.id} className={`border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50 ${selected.has(s.id) ? "bg-accent-50/40" : ""}`}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                    />
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-ink-900 font-semibold">{s.jobRef || <span className="text-ink-400">-</span>}</td>
                  <td className="px-5 py-3 text-ink-900">{fmtDate(s.submittedAt)}</td>
                  <td className="px-5 py-3 text-ink-700">
                    {s.periodStart && s.periodEnd ? `${s.periodStart} → ${s.periodEnd}` : <span className="text-ink-400">-</span>}
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

// Suppress unused import warning - kept for parity with other pages
// that may import ApiError from the same module.
export const __unused = ApiError;
