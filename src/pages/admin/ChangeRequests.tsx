import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { ChangeRequest } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { fmtDateTime } from "@/lib/format";
import { MessagesSquare, ArrowUpRight, ClipboardList, RefreshCw, UserMinus, Repeat } from "lucide-react";

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "seen", label: "Seen" },
  { value: "actioned", label: "Actioned" },
  { value: "closed", label: "Closed" },
  { value: "", label: "All" },
];

function statusBadge(s: ChangeRequest["status"]) {
  const tone = {
    open: "warn",
    seen: "info",
    actioned: "info",
    closed: "success",
    rejected: "danger",
  }[s] as "warn" | "info" | "success" | "danger";
  return <Badge tone={tone}>{s}</Badge>;
}

export function ChangeRequests() {
  const toast = useToast();
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const r = await api.adminListChangeRequests(filter || undefined);
    setItems(r.items);
  };
  useEffect(() => {
    (async () => { try { await refresh(); } finally { setLoading(false); } })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const transition = async (id: string, status: string) => {
    try {
      await api.adminPatchChangeRequest(id, status);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  return (
    <>
      <PageHeader
        title="Change Requests"
        right={
          <div className="w-48">
            <Select options={STATUSES} value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
        }
      />
      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty icon={MessagesSquare} title="Nothing here" description="No change requests match." />
      ) : (
        <div className="space-y-3">
          {items.map((r) => {
            // Discriminate UI by entity type so the office knows at a
            // glance whether they're acting on a sub-side support note
            // or a principal-side Job Card request.
            const isJobCard = r.entityType === "primary_submission";
            const kindLabel = isJobCard
              ? (r.category === "status_change" ? "Job Card - status change"
                : r.category === "sub_change" ? "Job Card - subcontractor change"
                : "Job Card request")
              : "Subcontractor support";
            const KindIcon = isJobCard
              ? (r.category === "status_change" ? RefreshCw
                : r.subChangeAction === "swap" ? Repeat
                : UserMinus)
              : MessagesSquare;
            const targetLink = isJobCard
              ? `/admin/primary-submissions/${r.primarySubmissionId}`
              : `/admin/subcontractors/${r.subcontractorId}`;
            return (
              <div key={r.id} className={`card p-5 ${isJobCard ? "border-l-4 border-l-accent-500" : ""}`}>
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-700">
                      <KindIcon className="h-3.5 w-3.5" /> {kindLabel}
                    </span>
                    <span className="text-xs text-ink-400">·</span>
                    <Link to={targetLink} className="text-xs text-ink-600 hover:text-ink-900 inline-flex items-center gap-1">
                      {isJobCard ? <>Open Job Card <ClipboardList className="h-3 w-3" /></> : <>Open subcontractor <ArrowUpRight className="h-3 w-3" /></>}
                    </Link>
                    <span className="text-xs text-ink-400">·</span>
                    <span className="text-xs text-ink-500">{fmtDateTime(r.createdAt)}</span>
                  </div>
                  {statusBadge(r.status)}
                </div>

                {/* Structured detail for Job Card requests. */}
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

                <p className="text-sm text-ink-800 whitespace-pre-wrap mb-4">{r.message}</p>
                <div className="flex gap-2 flex-wrap">
                  {r.status === "open" && <Button variant="outline" size="sm" onClick={() => transition(r.id, "seen")}>Mark seen</Button>}
                  {r.status !== "actioned" && r.status !== "closed" && <Button variant="outline" size="sm" onClick={() => transition(r.id, "actioned")}>Mark actioned</Button>}
                  {r.status !== "rejected" && r.status !== "closed" && isJobCard && (
                    <Button variant="outline" size="sm" onClick={() => transition(r.id, "rejected")}>Reject</Button>
                  )}
                  {r.status !== "closed" && <Button variant="accent" size="sm" onClick={() => transition(r.id, "closed")}>Close</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
