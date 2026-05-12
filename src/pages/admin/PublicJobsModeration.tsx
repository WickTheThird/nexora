// Admin moderation for the public-jobs board. Lists every posted job
// (open/paused/closed/filled, plus a 'removed' filter for audit). A
// 'Remove' action soft-deletes the job - reason required and
// surfaced to the principal (in their notification history).

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { PublicJob } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { Select, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { fmtDateTime } from "@/lib/format";
import { Shield, Trash2 } from "lucide-react";

const STATUSES = [
  { value: "", label: "All active" },
  { value: "open", label: "Open" },
  { value: "paused", label: "Paused" },
  { value: "filled", label: "Filled" },
  { value: "closed", label: "Closed" },
  { value: "removed", label: "Removed (moderated)" },
];

export function AdminPublicJobsModeration() {
  const toast = useToast();
  const [items, setItems] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [removing, setRemoving] = useState<{ job: PublicJob; reason: string } | null>(null);
  const [acting, setActing] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await api.adminListPublicJobs(filter || undefined);
      setItems(r.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  const doRemove = async () => {
    if (!removing) return;
    if (!removing.reason.trim()) { toast.error("Reason required."); return; }
    setActing(true);
    try {
      await api.adminRemovePublicJob(removing.job.id, removing.reason.trim());
      toast.success("Job removed from the public board.");
      setRemoving(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally { setActing(false); }
  };

  return (
    <>
      <PageHeader
        title="Public Jobs - moderation"
        right={
          <div className="w-56">
            <Select value={filter} options={STATUSES} onChange={(e) => setFilter(e.target.value)} />
          </div>
        }
      />
      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty icon={Shield} title="Nothing to moderate" description="No public jobs match this filter." />
      ) : (
        <div className="grid gap-3">
          {items.map((j) => (
            <div key={j.id} className="card p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-ink-700">{j.jobRef || "POST-?"}</span>
                    <h3 className="font-semibold text-ink-900">{j.title}</h3>
                    <Badge tone={j.removedAt ? "danger" : j.status === "open" ? "success" : "neutral"}>
                      {j.removedAt ? "removed" : j.status}
                    </Badge>
                    {/* Phase 4.5 visibility chip - so the office sees
                        whether this was a private invite-only post,
                        an open-to-vendor-list post, or a discoverable
                        one. Affects moderation priorities (only
                        discoverable posts go to the public board). */}
                    <Badge tone={
                      j.visibility === "discoverable" ? "info"
                      : j.visibility === "vendor_list" ? "neutral"
                      : "neutral"
                    }>
                      {j.visibility === "invite_only" ? "Invite only"
                       : j.visibility === "vendor_list" ? "Vendor list"
                       : "Discoverable"}
                    </Badge>
                  </div>
                  <div className="text-xs text-ink-500 mb-2">
                    From <strong>{j.primaryName}</strong> · posted {fmtDateTime(j.createdAt)} · {j.applicationCount ?? 0} application(s)
                  </div>
                  {j.brief && <p className="text-sm text-ink-700 line-clamp-2">{j.brief}</p>}
                  {j.removedAt && j.removedReason && (
                    <p className="text-xs text-red-700 mt-2">Removed reason: {j.removedReason}</p>
                  )}
                </div>
                {!j.removedAt && (
                  <Button variant="danger" size="sm" onClick={() => setRemoving({ job: j, reason: "" })} leftIcon={<Trash2 className="h-3.5 w-3.5" />}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={removing ? `Remove '${removing.job.title}'?` : "Remove"}
        description="Soft-delete: principal sees the takedown reason, sub-side board hides the job, existing applications are preserved for audit."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="danger" onClick={doRemove} loading={acting}>Remove</Button>
          </>
        }
      >
        <Textarea
          label="Reason (visible to principal)"
          value={removing?.reason || ""}
          onChange={(e) => setRemoving(removing ? { ...removing, reason: e.target.value } : null)}
          rows={4}
          placeholder="e.g. Job posting violates terms - duplicate, misleading description, spam, etc."
        />
      </Modal>
    </>
  );
}
