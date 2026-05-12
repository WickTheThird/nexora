// Sub-side Vendor Lists page (Phase 4.5 procurement).
//
// Two tabs:
//   - My memberships: principals I'm on (approved), pending apps,
//                      removed/withdrawn history
//   - Browse principals: directory of all principals on the platform,
//                        with their current membership/application
//                        status so the sub can apply to join

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type {
  VendorListMembership,
  VendorListApplication,
  PrincipalDirectoryEntry,
} from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { fmtDate } from "@/lib/format";
import {
  Building2, Send, CheckCircle2, Clock, XCircle, Star,
} from "lucide-react";

type Tab = "memberships" | "directory";

export function SubVendorLists() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("memberships");
  const [memberships, setMemberships] = useState<VendorListMembership[]>([]);
  const [applications, setApplications] = useState<VendorListApplication[]>([]);
  const [directory, setDirectory] = useState<PrincipalDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<{ principal: PrincipalDirectoryEntry; message: string } | null>(null);
  const [acting, setActing] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [mine, dir] = await Promise.all([
        api.subListVendorMemberships(),
        api.subBrowsePrincipals(),
      ]);
      setMemberships(mine.memberships);
      setApplications(mine.applications);
      setDirectory(dir.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load");
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const submit = async () => {
    if (!applying) return;
    if (!applying.message.trim()) {
      toast.error("Please tell them why you'd be a fit.");
      return;
    }
    setActing(true);
    try {
      await api.subApplyToVendorList(applying.principal.id, applying.message.trim());
      toast.success(`Application sent to ${applying.principal.name}.`);
      setApplying(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to apply");
    } finally { setActing(false); }
  };

  const withdraw = async (app: VendorListApplication) => {
    if (!window.confirm(`Withdraw your application to ${app.primaryName}?`)) return;
    try {
      await api.subWithdrawVendorListApplication(app.id);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  const pendingByPrimary = useMemo(() => {
    const m = new Map<string, VendorListApplication>();
    for (const a of applications) {
      if (a.status === "pending") m.set(a.primaryId, a);
    }
    return m;
  }, [applications]);

  return (
    <>
      <PageHeader title="Vendor lists" />
      <p className="text-sm text-ink-600 mb-4 max-w-3xl">
        Construction procurement runs on trust: principals only let approved subcontractors onto their vendor list. Once you're on a list, you can apply to their public jobs and receive direct invitations.
      </p>

      <div className="flex gap-1 mb-4 border-b border-ink-200">
        {(([
          ["memberships", "My memberships"],
          ["directory",   "Browse principals"],
        ] as [Tab, string][])).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition ${
              tab === k ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton h-64" />
      ) : tab === "memberships" ? (
        <MembershipsTab
          memberships={memberships}
          applications={applications}
          onWithdraw={withdraw}
          onApply={() => setTab("directory")}
        />
      ) : (
        <DirectoryTab
          directory={directory}
          pendingByPrimary={pendingByPrimary}
          onApply={(p) => setApplying({ principal: p, message: "" })}
        />
      )}

      <Modal
        open={!!applying}
        onClose={() => setApplying(null)}
        title={applying ? `Apply to join ${applying.principal.name}'s vendor list` : ""}
        description="They'll review your profile + your note. If approved, you'll be able to apply to their jobs and receive direct invites."
        footer={
          <>
            <Button variant="ghost" onClick={() => setApplying(null)}>Cancel</Button>
            <Button variant="accent" onClick={submit} loading={acting} leftIcon={<Send className="h-4 w-4" />}>
              Send application
            </Button>
          </>
        }
      >
        <Textarea
          label="Why you'd be a fit"
          value={applying?.message || ""}
          onChange={(e) => setApplying(applying ? { ...applying, message: e.target.value } : null)}
          rows={5}
          placeholder="A quick intro: your trade, years of experience, recent projects. They'll already see your verified profile + certs."
        />
        <p className="mt-2 text-xs text-ink-500">If rejected, you can re-apply after a 24-hour cool-off.</p>
      </Modal>
    </>
  );
}

function MembershipsTab({
  memberships, applications, onWithdraw, onApply,
}: {
  memberships: VendorListMembership[];
  applications: VendorListApplication[];
  onWithdraw: (a: VendorListApplication) => void;
  onApply: () => void;
}) {
  const approved = memberships.filter(m => m.status === "approved");
  const removed = memberships.filter(m => m.status === "removed");
  const pendingApps = applications.filter(a => a.status === "pending");
  const decidedApps = applications.filter(a => a.status === "rejected" || a.status === "withdrawn");

  if (approved.length === 0 && pendingApps.length === 0 && removed.length === 0 && decidedApps.length === 0) {
    return (
      <Empty
        icon={Building2}
        title="You're not on any vendor lists yet"
        description="Browse principals on the platform and apply to join their lists. Once approved, you'll see their jobs and receive direct invitations."
        action={<Button variant="accent" onClick={onApply}>Browse principals</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      {approved.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 mb-3">
            Approved <span className="text-ink-400 font-normal">({approved.length})</span>
          </h2>
          <div className="grid gap-2">
            {approved.map((m) => (
              <div key={m.primaryId} className="card p-4 flex items-center gap-4">
                <Building2 className="h-5 w-5 text-ink-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-ink-900">{m.primaryName}</span>
                    {m.isFavourite && (
                      <Badge tone="warn" icon={<Star className="h-3 w-3 fill-current" />}>Featured</Badge>
                    )}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    Approved {m.approvedAt ? fmtDate(m.approvedAt) : "-"}
                  </div>
                </div>
                <Badge tone="success" icon={<CheckCircle2 className="h-3 w-3" />}>On the list</Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {pendingApps.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 mb-3">
            Pending applications <span className="text-ink-400 font-normal">({pendingApps.length})</span>
          </h2>
          <div className="grid gap-2">
            {pendingApps.map((a) => (
              <div key={a.id} className="card p-4 flex items-center gap-4">
                <Building2 className="h-5 w-5 text-ink-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-900">{a.primaryName}</div>
                  <div className="text-xs text-ink-500 mt-0.5">Applied {fmtDate(a.appliedAt)}</div>
                </div>
                <Badge tone="info" icon={<Clock className="h-3 w-3" />}>Pending</Badge>
                <Button variant="ghost" size="sm" onClick={() => onWithdraw(a)}>Withdraw</Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {decidedApps.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 mb-3">
            History <span className="text-ink-400 font-normal">({decidedApps.length})</span>
          </h2>
          <div className="grid gap-2">
            {decidedApps.map((a) => (
              <div key={a.id} className="card p-4 flex items-center gap-4 opacity-90">
                <Building2 className="h-5 w-5 text-ink-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-700">{a.primaryName}</div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {a.status === "rejected" ? `Rejected ${a.decidedAt ? fmtDate(a.decidedAt) : ""}` : `Withdrawn`}
                  </div>
                  {a.decidedReason && <p className="text-xs text-ink-600 mt-2 italic">{a.decidedReason}</p>}
                </div>
                <Badge tone={a.status === "rejected" ? "danger" : "neutral"} icon={<XCircle className="h-3 w-3" />}>
                  {a.status}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {removed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 mb-3">
            Removed <span className="text-ink-400 font-normal">({removed.length})</span>
          </h2>
          <div className="grid gap-2">
            {removed.map((m) => (
              <div key={m.primaryId} className="card p-4 opacity-90">
                <div className="font-medium text-ink-700">{m.primaryName}</div>
                <div className="text-xs text-ink-500 mt-0.5">
                  Removed {m.removedAt ? fmtDate(m.removedAt) : "-"}
                </div>
                {m.removedReason && <p className="text-xs text-ink-600 mt-2 italic">{m.removedReason}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DirectoryTab({
  directory, pendingByPrimary, onApply,
}: {
  directory: PrincipalDirectoryEntry[];
  pendingByPrimary: Map<string, VendorListApplication>;
  onApply: (p: PrincipalDirectoryEntry) => void;
}) {
  if (directory.length === 0) {
    return (
      <Empty
        icon={Building2}
        title="No principals to browse"
        description="There are no principals on the platform yet. Check back later."
      />
    );
  }
  return (
    <div className="grid gap-2">
      {directory.map((p) => {
        const pending = pendingByPrimary.get(p.id);
        const coolOffActive = p.nextApplyAllowedAt && p.nextApplyAllowedAt > Date.now();
        return (
          <div key={p.id} className="card p-4 flex items-center gap-4">
            <Building2 className="h-5 w-5 text-ink-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-ink-900">{p.name}</div>
              <div className="text-xs text-ink-500 mt-0.5 truncate">
                {p.address || <span className="text-ink-400">no address on file</span>}
                {p.vat && <span className="ml-2">VAT {p.vat}</span>}
              </div>
              {coolOffActive && p.nextApplyAllowedAt && (
                <div className="text-xs text-amber-700 mt-1">
                  You can re-apply after {fmtDate(p.nextApplyAllowedAt)} (24h cool-off).
                </div>
              )}
            </div>
            {p.membershipStatus === "approved" ? (
              <Badge tone="success" icon={<CheckCircle2 className="h-3 w-3" />}>On the list</Badge>
            ) : pending ? (
              <Badge tone="info" icon={<Clock className="h-3 w-3" />}>Pending</Badge>
            ) : coolOffActive ? (
              <Badge tone="neutral">Cool-off</Badge>
            ) : (
              <Button variant="accent" size="sm" onClick={() => onApply(p)} leftIcon={<Send className="h-4 w-4" />}>
                Apply
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
