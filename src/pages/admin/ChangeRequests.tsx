// Change Requests inbox - admin side. Two view modes:
//   - Kanban (default): one column per lifecycle state, drag-button to
//     transition. Mirrors how a Jira board feels - the office can spot
//     backlog at a glance.
//   - List: dense table with the same actions inline. For power users
//     and full keyboard nav.
// Both views share the same filter strip (search + entity-type + period).
// Toggle between them via a chip pair top-right.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { ChangeRequest } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { fmtDateTime, fmtDate } from "@/lib/format";
import {
  MessagesSquare, ArrowUpRight, ClipboardList, RefreshCw, UserMinus, Repeat,
  LayoutGrid, List, Archive as ArchiveIcon, Search,
} from "lucide-react";

type Status = ChangeRequest["status"];
const COLUMNS: { key: Status; label: string; tone: "warn" | "info" | "success" | "danger" }[] = [
  { key: "open",     label: "Open",     tone: "warn" },
  { key: "seen",     label: "Seen",     tone: "info" },
  { key: "actioned", label: "Actioned", tone: "info" },
  { key: "closed",   label: "Closed",   tone: "success" },
  { key: "rejected", label: "Rejected", tone: "danger" },
];

const PERIODS = [
  { value: "0",  label: "All time" },
  { value: "1",  label: "Last 24h" },
  { value: "7",  label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const ENTITY_FILTERS = [
  { value: "",                   label: "All kinds" },
  { value: "subcontractor",      label: "Sub support" },
  { value: "primary_submission", label: "Job Card requests" },
];

function statusBadge(s: Status) {
  const c = COLUMNS.find(x => x.key === s);
  return <Badge tone={c?.tone || "neutral"}>{s}</Badge>;
}

function kindOf(r: ChangeRequest) {
  const isJobCard = r.entityType === "primary_submission";
  const label = isJobCard
    ? (r.category === "status_change" ? "Status change"
       : r.category === "sub_change" ? "Subcontractor change"
       : "Job Card request")
    : "Subcontractor support";
  const Icon = isJobCard
    ? (r.category === "status_change" ? RefreshCw
       : r.subChangeAction === "swap" ? Repeat
       : UserMinus)
    : MessagesSquare;
  const link = isJobCard
    ? `/admin/primary-submissions/${r.primarySubmissionId}`
    : `/admin/subcontractors/${r.subcontractorId}`;
  return { isJobCard, label, Icon, link };
}

export function ChangeRequests() {
  const toast = useToast();
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [period, setPeriod] = useState("30");
  const [showArchive, setShowArchive] = useState(false);

  const refresh = async () => {
    // Pull every status in one shot so the kanban can render columns
    // side-by-side. List view filters the same array client-side.
    try {
      const promises = COLUMNS.map(c => api.adminListChangeRequests(c.key).catch(() => ({ items: [] as ChangeRequest[] })));
      const results = await Promise.all(promises);
      const merged = results.flatMap(r => r.items);
      // De-duplicate by id (in case the worker returns the same row
      // from multiple status queries somehow).
      const seen = new Set<string>();
      const unique = merged.filter(r => seen.has(r.id) ? false : (seen.add(r.id), true));
      setItems(unique);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const transition = async (id: string, status: Status) => {
    try {
      await api.adminPatchChangeRequest(id, status);
      // Optimistic local update (avoid full refetch on every click).
      setItems(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  // Filter pipeline: archive toggle hides closed/rejected by default.
  const filtered = useMemo(() => {
    let rows = items;
    if (!showArchive) rows = rows.filter(r => r.status !== "closed" && r.status !== "rejected");
    if (entityFilter) rows = rows.filter(r => r.entityType === entityFilter);
    const days = Number(period) || 0;
    if (days > 0) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      rows = rows.filter(r => r.createdAt >= cutoff);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        r.message.toLowerCase().includes(q) ||
        (r.category || "").toLowerCase().includes(q) ||
        (r.subcontractorId || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [items, search, entityFilter, period, showArchive]);

  // Columns visible on the kanban. When archive is hidden, drop the
  // closed + rejected columns so the board reads cleaner.
  const visibleColumns = showArchive ? COLUMNS : COLUMNS.filter(c => c.key !== "closed" && c.key !== "rejected");

  return (
    <>
      <PageHeader
        title="Change Requests"
        right={
          // View toggle. Chip pair to match the kanban / list pattern
          // we'll re-use elsewhere (Advice, Subs requests, etc.).
          <div className="inline-flex gap-1 bg-ink-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition ${
                view === "kanban" ? "bg-white shadow-sm text-ink-900" : "text-ink-500 hover:text-ink-700"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition ${
                view === "list" ? "bg-white shadow-sm text-ink-900" : "text-ink-500 hover:text-ink-700"
              }`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>
        }
      />

      {/* Filter strip. Search + entity-kind + period + archive toggle. */}
      <div className="card-padded mb-4 grid grid-cols-1 sm:grid-cols-[1fr_180px_180px_auto] gap-3 items-end">
        <Input
          label="Search"
          placeholder="Message, category, sub id..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          label="Kind"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          options={ENTITY_FILTERS}
        />
        <Select
          label="Period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          options={PERIODS}
        />
        <Button
          variant={showArchive ? "primary" : "ghost"}
          onClick={() => setShowArchive(v => !v)}
          leftIcon={<ArchiveIcon className="h-4 w-4" />}
        >
          {showArchive ? "Hide archive" : "Show archive"}
        </Button>
      </div>

      <div className="text-xs text-ink-500 mb-4 inline-flex items-center gap-1.5">
        <Search className="h-3.5 w-3.5" /> {filtered.length} match{filtered.length === 1 ? "" : "es"}
      </div>

      {loading ? (
        <div className="skeleton h-64" />
      ) : filtered.length === 0 ? (
        <Empty icon={MessagesSquare} title="Nothing here" description="No change requests match the current filters." />
      ) : view === "kanban" ? (
        <KanbanView
          columns={visibleColumns}
          items={filtered}
          onTransition={transition}
        />
      ) : (
        <ListView items={filtered} onTransition={transition} />
      )}
    </>
  );
}

function KanbanView({
  columns, items, onTransition,
}: {
  columns: typeof COLUMNS;
  items: ChangeRequest[];
  onTransition: (id: string, status: Status) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
      {columns.map(col => {
        const colItems = items.filter(r => r.status === col.key);
        return (
          <div key={col.key} className="bg-ink-50 rounded-lg border border-ink-100 p-3">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-700 inline-flex items-center gap-2">
                <Badge tone={col.tone}>{col.label}</Badge>
              </h3>
              <span className="text-xs text-ink-500">{colItems.length}</span>
            </div>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {colItems.length === 0 ? (
                <p className="text-xs text-ink-400 text-center py-4 italic">Empty</p>
              ) : (
                colItems.map(r => <KanbanCard key={r.id} r={r} onTransition={onTransition} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ r, onTransition }: { r: ChangeRequest; onTransition: (id: string, s: Status) => void }) {
  const { isJobCard, label, Icon, link } = kindOf(r);
  return (
    <div className={`bg-white rounded-md border border-ink-100 p-3 hover:shadow-sm transition ${isJobCard ? "border-l-4 border-l-accent-500" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-600 inline-flex items-center gap-1">
          <Icon className="h-3 w-3" /> {label}
        </span>
        <span className="text-[10px] text-ink-400">{fmtDate(r.createdAt)}</span>
      </div>
      <p className="text-xs text-ink-700 whitespace-pre-wrap line-clamp-3 mb-2">{r.message}</p>
      {isJobCard && r.category === "status_change" && (
        <div className="text-[11px] text-ink-500 mb-2">
          Requested: <span className="font-mono">{r.requestedStatus}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <Link to={link} className="text-[11px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-0.5">
          Open <ArrowUpRight className="h-3 w-3" />
        </Link>
        <div className="flex gap-1">
          {COLUMNS.filter(c => c.key !== r.status).map(c => (
            <button
              key={c.key}
              type="button"
              onClick={() => onTransition(r.id, c.key)}
              className="text-[10px] px-1.5 py-0.5 rounded text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              title={`Move to ${c.label}`}
            >
              {"-> "}{c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ListView({ items, onTransition }: { items: ChangeRequest[]; onTransition: (id: string, s: Status) => void }) {
  return (
    <div className="space-y-2">
      {items.map(r => {
        const { isJobCard, label, Icon, link } = kindOf(r);
        return (
          <div key={r.id} className={`card p-4 ${isJobCard ? "border-l-4 border-l-accent-500" : ""}`}>
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-700">
                  <Icon className="h-3.5 w-3.5" /> {label}
                </span>
                <span className="text-xs text-ink-400">·</span>
                <Link to={link} className="text-xs text-ink-600 hover:text-ink-900 inline-flex items-center gap-1">
                  {isJobCard ? <>Open Job Card <ClipboardList className="h-3 w-3" /></> : <>Open subcontractor <ArrowUpRight className="h-3 w-3" /></>}
                </Link>
                <span className="text-xs text-ink-400">·</span>
                <span className="text-xs text-ink-500">{fmtDateTime(r.createdAt)}</span>
              </div>
              {statusBadge(r.status)}
            </div>

            {isJobCard && r.category === "status_change" && (
              <div className="text-xs text-ink-600 mb-2">
                Requested status: <span className="font-mono font-semibold text-ink-900">{r.requestedStatus}</span>
              </div>
            )}
            {isJobCard && r.category === "sub_change" && (
              <div className="text-xs text-ink-600 mb-2">
                Action: <span className="font-mono font-semibold text-ink-900">{r.subChangeAction}</span>
                {r.affectedSubcontractorId && (
                  <> · sub: <span className="font-mono">{r.affectedSubcontractorId.slice(0,8)}</span></>
                )}
                {r.replacementSubcontractorId && (
                  <> {"->"} replacement: <span className="font-mono">{r.replacementSubcontractorId.slice(0,8)}</span></>
                )}
              </div>
            )}

            <p className="text-sm text-ink-800 whitespace-pre-wrap mb-3">{r.message}</p>
            <div className="flex gap-2 flex-wrap">
              {r.status === "open" && <Button variant="outline" size="sm" onClick={() => onTransition(r.id, "seen")}>Mark seen</Button>}
              {r.status !== "actioned" && r.status !== "closed" && <Button variant="outline" size="sm" onClick={() => onTransition(r.id, "actioned")}>Mark actioned</Button>}
              {r.status !== "rejected" && r.status !== "closed" && isJobCard && (
                <Button variant="outline" size="sm" onClick={() => onTransition(r.id, "rejected")} className="hover:bg-red-50 hover:text-red-700">Reject</Button>
              )}
              {r.status !== "closed" && <Button variant="accent" size="sm" onClick={() => onTransition(r.id, "closed")}>Close</Button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
