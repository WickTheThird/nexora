// Principal Vendor List page (Phase 4.5 procurement model).
//
// The principal's curated, trusted pool of subcontractors. Used as
// the source-of-truth for who can be invited to a job, who sees
// vendor-list jobs, and who gets featured notifications. Three
// buckets:
//   - Approved: active members (favourites pinned to the top)
//   - Pending applications: sub-initiated requests to join, with
//     approve/reject actions
//   - Removed: soft-deleted entries with reason (audit trail)

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { VendorListEntry, VendorListApplication } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { fmtDate, fmtDateTime } from "@/lib/format";
import {
  Users, Star, Trash2, CheckCircle2, XCircle, MailQuestion, RotateCcw, ArrowUpRight,
} from "lucide-react";

type Tab = "approved" | "applications" | "removed";

export function PrimaryVendorList() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab | null) || "approved";
  const [tab, setTab] = useState<Tab>(initialTab);

  const [approved, setApproved] = useState<VendorListEntry[]>([]);
  const [removed, setRemoved] = useState<VendorListEntry[]>([]);
  const [applications, setApplications] = useState<VendorListApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const [removing, setRemoving] = useState<{ entry: VendorListEntry; reason: string } | null>(null);
  const [rejecting, setRejecting] = useState<{ app: VendorListApplication; reason: string } | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [appr, rem, apps] = await Promise.all([
        api.primaryListVendorList({ status: "approved" }),
        api.primaryListVendorList({ status: "removed" }),
        api.primaryListVendorListApplications("pending"),
      ]);
      setApproved(appr.items);
      setRemoved(rem.items);
      setApplications(apps.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load");
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const setActiveTab = (t: Tab) => {
    setTab(t);
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  const counts = useMemo(() => ({
    approved: approved.length,
    applications: applications.length,
    removed: removed.length,
  }), [approved.length, applications.length, removed.length]);

  const toggleFav = async (e: VendorListEntry) => {
    setActing(e.subcontractorId);
    try {
      await api.primaryToggleVendorListFavourite(e.subcontractorId, !e.isFavourite);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed");
    } finally { setActing(null); }
  };

  const reinstate = async (e: VendorListEntry) => {
    setActing(e.subcontractorId);
    try {
      await api.primaryAddToVendorList(e.subcontractorId);
      toast.success("Vendor reinstated.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed");
    } finally { setActing(null); }
  };

  const doRemove = async () => {
    if (!removing) return;
    setActing(removing.entry.subcontractorId);
    try {
      await api.primaryRemoveFromVendorList(
        removing.entry.subcontractorId,
        removing.reason.trim() || undefined,
      );
      toast.success(`${removing.entry.subcontractorName || "Subcontractor"} removed from your vendor list.`);
      setRemoving(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed");
    } finally { setActing(null); }
  };

  const approveApp = async (a: VendorListApplication) => {
    setActing(a.id);
    try {
      await api.primaryApproveVendorListApplication(a.id);
      toast.success(`${a.subcontractorName || "Subcontractor"} approved.`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed");
    } finally { setActing(null); }
  };

  const doReject = async () => {
    if (!rejecting) return;
    if (!rejecting.reason.trim()) { toast.error("Reason required."); return; }
    setActing(rejecting.app.id);
    try {
      await api.primaryRejectVendorListApplication(rejecting.app.id, rejecting.reason.trim());
      toast.success("Application rejected. Sub notified.");
      setRejecting(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed");
    } finally { setActing(null); }
  };

  return (
    <>
      <PageHeader
        title="Vendor list"
        right={
          <Link to="/primary/subcontractors">
            <Button variant="outline" leftIcon={<Users className="h-4 w-4" />}>
              See all subcontractors
            </Button>
          </Link>
        }
      />

      <p className="text-sm text-ink-600 mb-4 max-w-3xl">
        Your trusted pool of subcontractors. Members can be invited to your jobs, see vendor-list and discoverable postings, and apply directly. Favourites get notified first when you post a job.
      </p>

      <div className="flex gap-1 mb-4 border-b border-ink-200 overflow-x-auto">
        {(([
          ["approved", "Approved"],
          ["applications", "Applications"],
          ["removed", "Removed"],
        ] as [Tab, string][])).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 whitespace-nowrap transition ${
              tab === key ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {label}
            <span className={`ml-2 text-xs ${tab === key ? "text-ink-500" : "text-ink-400"}`}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton h-64" />
      ) : tab === "approved" ? (
        approved.length === 0 ? (
          <Empty
            icon={Users}
            title="No approved subcontractors yet"
            description="Add subcontractors from your Subcontractors page, or wait for them to apply via the public principal directory."
          />
        ) : (
          <div className="grid gap-2">
            {approved.map((e) => (
              <div key={e.subcontractorId} className="card p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => toggleFav(e)}
                      disabled={acting === e.subcontractorId}
                      title={e.isFavourite ? "Remove from favourites" : "Mark as favourite (notified first for new jobs)"}
                      className={`p-1 rounded hover:bg-amber-50 ${e.isFavourite ? "text-amber-500" : "text-ink-300 hover:text-amber-500"}`}
                    >
                      <Star className={`h-4 w-4 ${e.isFavourite ? "fill-current" : ""}`} />
                    </button>
                    <Link
                      to={`/primary/subcontractors/${e.subcontractorId}`}
                      className="font-medium text-ink-900 hover:underline"
                    >
                      {e.subcontractorName || "(unnamed)"}
                    </Link>
                    {e.subcontractorRef && <span className="font-mono text-xs text-ink-500">{e.subcontractorRef}</span>}
                    {e.isFavourite && <Badge tone="warn">Favourite</Badge>}
                  </div>
                  <div className="text-xs text-ink-500 flex gap-3 flex-wrap">
                    {e.trade && <span>Trade: {e.trade}</span>}
                    {e.rctRate && <span>RCT: {e.rctRate}%</span>}
                    {e.approvedAt && <span>Approved {fmtDate(e.approvedAt)}</span>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRemoving({ entry: e, reason: "" })}
                  disabled={acting === e.subcontractorId}
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )
      ) : tab === "applications" ? (
        applications.length === 0 ? (
          <Empty
            icon={MailQuestion}
            title="No pending applications"
            description="When a subcontractor applies to join your vendor list, it'll appear here for review."
          />
        ) : (
          <div className="grid gap-2">
            {applications.map((a) => (
              <div key={a.id} className="card p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/primary/subcontractors/${a.subcontractorId}`}
                        className="font-medium text-ink-900 hover:underline inline-flex items-center gap-1"
                      >
                        {a.subcontractorName || "(unnamed)"} <ArrowUpRight className="h-3 w-3" />
                      </Link>
                      {a.subcontractorRef && <span className="font-mono text-xs text-ink-500">{a.subcontractorRef}</span>}
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5">
                      {a.subcontractorEmail}{a.trade ? ` · ${a.trade}` : ""} · applied {fmtDateTime(a.appliedAt)}
                    </div>
                    {a.message && <p className="text-sm text-ink-700 mt-2 whitespace-pre-wrap">{a.message}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<XCircle className="h-4 w-4" />}
                      onClick={() => setRejecting({ app: a, reason: "" })}
                      disabled={acting === a.id}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="accent"
                      size="sm"
                      leftIcon={<CheckCircle2 className="h-4 w-4" />}
                      onClick={() => approveApp(a)}
                      loading={acting === a.id}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        removed.length === 0 ? (
          <Empty
            icon={Trash2}
            title="Nothing in Removed"
            description="Removed subcontractors land here with the reason for audit. You can reinstate any time."
          />
        ) : (
          <div className="grid gap-2">
            {removed.map((e) => (
              <div key={e.subcontractorId} className="card p-4 opacity-90">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink-800">{e.subcontractorName || "(unnamed)"}</div>
                    <div className="text-xs text-ink-500 mt-0.5">
                      Removed {e.removedAt ? fmtDateTime(e.removedAt) : ""}
                    </div>
                    {e.removedReason && (
                      <p className="text-xs text-ink-600 mt-2 italic">Reason: {e.removedReason}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reinstate(e)}
                    loading={acting === e.subcontractorId}
                    leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                  >
                    Reinstate
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={removing ? `Remove ${removing.entry.subcontractorName || "subcontractor"} from your vendor list?` : ""}
        description="They lose access to your jobs and can no longer be invited until reinstated. Existing job applications stay intact."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="danger" onClick={doRemove} loading={!!acting}>Remove</Button>
          </>
        }
      >
        <Textarea
          label="Reason (optional, recorded for audit)"
          value={removing?.reason || ""}
          onChange={(e) => setRemoving(removing ? { ...removing, reason: e.target.value } : null)}
          rows={3}
          placeholder="e.g. quality issues on last project, no longer available, etc."
        />
      </Modal>

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title={rejecting ? `Reject ${rejecting.app.subcontractorName || "applicant"}?` : ""}
        description="They get an email + notification. Cool-off: they can re-apply in 24h."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="danger" onClick={doReject} loading={!!acting}>Reject</Button>
          </>
        }
      >
        <Textarea
          label="Reason (visible to the sub)"
          value={rejecting?.reason || ""}
          onChange={(e) => setRejecting(rejecting ? { ...rejecting, reason: e.target.value } : null)}
          rows={4}
          placeholder="e.g. We're not taking on new subs at this time."
        />
      </Modal>
    </>
  );
}
