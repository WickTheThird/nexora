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
import { MessagesSquare, ArrowUpRight } from "lucide-react";

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
  }[s] as "warn" | "info" | "success";
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
        description="Support messages from subcontractors."
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
          {items.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <Link to={`/admin/subcontractors/${r.subcontractorId}`} className="text-xs text-ink-600 hover:text-ink-900 inline-flex items-center gap-1">
                    Open subcontractor <ArrowUpRight className="h-3 w-3" />
                  </Link>
                  <span className="text-xs text-ink-400">·</span>
                  <span className="text-xs text-ink-500">{fmtDateTime(r.createdAt)}</span>
                </div>
                {statusBadge(r.status)}
              </div>
              <p className="text-sm text-ink-800 whitespace-pre-wrap mb-4">{r.message}</p>
              <div className="flex gap-2 flex-wrap">
                {r.status === "open" && <Button variant="outline" size="sm" onClick={() => transition(r.id, "seen")}>Mark seen</Button>}
                {r.status !== "actioned" && r.status !== "closed" && <Button variant="outline" size="sm" onClick={() => transition(r.id, "actioned")}>Mark actioned</Button>}
                {r.status !== "closed" && <Button variant="accent" size="sm" onClick={() => transition(r.id, "closed")}>Close</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
