import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { PrimarySubmission, PrimarySubmissionStatus, JobCardType } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Send, ArrowUpRight, Plus, Search, X, Edit3 } from "lucide-react";

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
  const toast = useToast();
  const [items, setItems] = useState<PrimarySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>("all");
  // Filtering layer (ON TOP of bucket): free-text search across Job NR
  // + notes, plus a type filter. Keeps the bucket count badges
  // honest by computing counts off raw items, not the filter result.
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | JobCardType>("");
  // Per-row inline action state.
  const [acting, setActing] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await api.listMySubmissions();
      setItems(r.items);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  // Inline 'Submit to BC' for drafts - skip the detour through the
  // detail page. Confirms first because submission is irreversible.
  const submitDraft = async (s: PrimarySubmission) => {
    if (!window.confirm(
      `Submit ${s.jobRef || "this draft"} to BC?\n\nThis locks the Job Card - it can't be edited after.`
    )) return;
    setActing(s.id);
    try {
      await api.submitMyDraftSubmission(s.id);
      toast.success(`${s.jobRef || "Job Card"} submitted to BC.`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Submit failed");
    } finally {
      setActing(null);
    }
  };

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
    let rows = b && b.statuses != null
      ? items.filter(it => b.statuses!.includes(it.status))
      : items;
    if (typeFilter) {
      rows = rows.filter(it => it.jobCardType === typeFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(it =>
        (it.jobRef || "").toLowerCase().includes(q) ||
        (it.notes || "").toLowerCase().includes(q) ||
        (it.invoiceNumber || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [items, bucket, typeFilter, search]);

  const filtersActive = !!(typeFilter || search.trim());
  const clearFilters = () => { setTypeFilter(""); setSearch(""); };

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

      {/* Filter row - free-text search across Job NR / notes / invoice
          ID + a Job Card Type select. Filters compose with the bucket
          above; counts on the chips stay tied to raw data so the
          bucket badges don't lie when a search is active. */}
      <div className="card-padded mb-4 grid grid-cols-1 sm:grid-cols-[1fr_220px_auto] gap-3 items-end">
        <Input
          label="Search"
          placeholder="Job NR, notes, invoice ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          // Lucide icons can't slot into the Input wrapper directly so we
          // rely on the input's label + placeholder pattern.
        />
        <Select
          label="Type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "" | JobCardType)}
          options={[
            { value: "",            label: "All types" },
            { value: "weekly",      label: "Weekly (1 week)" },
            { value: "fortnightly", label: "Fortnightly (2 weeks)" },
            { value: "monthly",     label: "Monthly (4 weeks)" },
          ]}
        />
        <div className="flex items-center gap-2 h-[42px]">
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clearFilters} leftIcon={<X className="h-3.5 w-3.5" />}>
              Clear
            </Button>
          )}
          <div className="text-xs text-ink-500 inline-flex items-center gap-1">
            <Search className="h-3.5 w-3.5" /> {filtered.length} of {items.length}
          </div>
        </div>
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
                    <div className="inline-flex items-center gap-1">
                      {/* Quick row actions: principals shouldn't have to
                          drill into a Job Card just to submit a draft.
                          'Edit' opens the draft form directly; 'Submit'
                          confirms then locks it in place. For non-draft
                          rows we just show the View link - changing
                          status from submitted/processing requires a
                          status-change request which lives on the
                          detail page. */}
                      {s.status === "draft" && (
                        <>
                          <Link
                            to={`/primary/submissions/${s.id}/edit`}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded text-ink-600 hover:text-ink-900 hover:bg-ink-100"
                            title="Edit this draft"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => submitDraft(s)}
                            disabled={acting === s.id}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded text-ink-700 hover:text-white hover:bg-ink-900 disabled:opacity-50"
                            title="Submit to BC (locks the Job Card)"
                          >
                            <Send className="h-3.5 w-3.5" /> Submit
                          </button>
                        </>
                      )}
                      <Link to={`/primary/submissions/${s.id}`} className="btn-ghost !py-1.5 inline-flex">
                        View <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>
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
