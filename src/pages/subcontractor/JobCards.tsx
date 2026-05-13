// Sub-side Job Cards. Each card = one primary_submission the sub
// appears on; inside it the sub's own line-items list with per-line
// Accept / Decline.
//
// Designed mobile-first: large cards, big tap targets, no horizontal
// tables. Decline opens a modal for the reason.

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PortalShell";
import { FilterBar } from "@/components/ui/FilterBar";
import { fmtDate, fmtMoney } from "@/lib/format";
import {
  Briefcase, Check, X, AlertCircle, Lock, RefreshCcw, ChevronRight,
} from "lucide-react";

type JobCardGroup = Awaited<ReturnType<typeof api.listMyJobCards>>["items"][number];
type JobCardItem = JobCardGroup["items"][number];

export function JobCards() {
  const toast = useToast();
  const [groups, setGroups] = useState<JobCardGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  // pending | accepted | declined | all
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [search, setSearch] = useState("");

  // Decline modal state.
  const [declineCtx, setDeclineCtx] = useState<{ group: JobCardGroup; item: JobCardItem } | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const refresh = async () => {
    try {
      const r = await api.listMyJobCards();
      setGroups(r.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load Job Cards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  // Counts across all groups for the pill badges.
  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, accepted: 0, declined: 0 };
    for (const g of groups) {
      for (const it of g.items) {
        c.all++;
        if (it.subAcceptedAt) c.accepted++;
        else if (it.subDeclinedAt) c.declined++;
        else c.pending++;
      }
    }
    return c;
  }, [groups]);

  // Filter groups: hide groups where no line-item matches the filter.
  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups
      .map((g) => {
        const items = g.items.filter((it) => {
          if (statusFilter === "pending" && (it.subAcceptedAt || it.subDeclinedAt)) return false;
          if (statusFilter === "accepted" && !it.subAcceptedAt) return false;
          if (statusFilter === "declined" && !it.subDeclinedAt) return false;
          return true;
        });
        return { ...g, items };
      })
      .filter((g) => {
        if (g.items.length === 0) return false;
        if (!q) return true;
        const hay = [g.primaryName, g.jobRef, ...g.items.map((it) => `${it.jobNumber} ${it.siteAddress} ${it.notes}`)]
          .filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
  }, [groups, statusFilter, search]);

  const respond = async (group: JobCardGroup, item: JobCardItem, action: "accept" | "decline", reason?: string) => {
    if (group.responseLocked) {
      toast.error("This Job Card has been processed and can no longer be changed.");
      return;
    }
    setBusyItemId(item.id);
    try {
      await api.respondToJobCardItem(group.submissionId, item.id, action, reason);
      toast.success(action === "accept" ? "Line accepted" : "Line disputed and reported to the office");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setBusyItemId(null);
    }
  };

  const acceptAll = async (group: JobCardGroup) => {
    if (group.responseLocked) return;
    const pending = group.items.filter((it) => !it.subAcceptedAt && !it.subDeclinedAt);
    if (pending.length === 0) return;
    if (!confirm(`Accept all ${pending.length} line${pending.length === 1 ? "" : "s"} on this Job Card?`)) return;
    setBusyItemId(group.submissionId);
    try {
      await Promise.allSettled(
        pending.map((it) => api.respondToJobCardItem(group.submissionId, it.id, "accept")),
      );
      toast.success(`Accepted ${pending.length} line${pending.length === 1 ? "" : "s"}`);
      await refresh();
    } finally {
      setBusyItemId(null);
    }
  };

  const openDecline = (group: JobCardGroup, item: JobCardItem) => {
    setDeclineCtx({ group, item });
    setDeclineReason("");
  };
  const submitDecline = async () => {
    if (!declineCtx) return;
    if (declineReason.trim().length < 4) {
      toast.error("Briefly explain what's wrong");
      return;
    }
    await respond(declineCtx.group, declineCtx.item, "decline", declineReason.trim());
    setDeclineCtx(null);
  };

  return (
    <>
      <PageHeader
        title="My Job Cards"
        description="Job Cards from your principals. Accept the hours that are correct, dispute anything that's wrong."
        right={
          <Button variant="outline" onClick={refresh} leftIcon={<RefreshCcw className="h-4 w-4" />}>
            Refresh
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-32" />
          <div className="skeleton h-32" />
        </div>
      ) : groups.length === 0 ? (
        <Empty
          icon={Briefcase}
          title="No Job Cards yet"
          description="When a principal adds your name to a Job Card, it will appear here for you to review."
        />
      ) : (
        <>
          <FilterBar
            pills={[
              { value: "pending",  label: "Awaiting response", count: counts.pending },
              { value: "accepted", label: "Accepted",          count: counts.accepted },
              { value: "declined", label: "Disputed",          count: counts.declined },
              { value: "all",      label: "All",               count: counts.all },
            ]}
            activePill={statusFilter}
            onPillChange={setStatusFilter}
            searchValue={search}
            searchPlaceholder="Search principal, job ref, site..."
            onSearchChange={setSearch}
          />

          {visibleGroups.length === 0 ? (
            <div className="card-padded text-center text-sm text-ink-500">
              No Job Cards match the current filter.
            </div>
          ) : (
            <div className="space-y-4">
              {visibleGroups.map((g) => (
                <div key={g.submissionId} className="card overflow-hidden">
                  {/* Submission header */}
                  <div className="p-4 sm:p-5 border-b border-ink-100">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-semibold text-ink-900 text-base">
                          {g.primaryName || "Principal"}
                          {g.jobRef && <span className="text-ink-500 font-normal"> · {g.jobRef}</span>}
                        </div>
                        <div className="text-xs text-ink-500 mt-1 flex items-center gap-2 flex-wrap">
                          {g.periodStart && g.periodEnd && (
                            <span>{fmtDate(g.periodStart)} → {fmtDate(g.periodEnd)}</span>
                          )}
                          {g.jobCardType && <span>· {g.jobCardType}</span>}
                          <span>· {g.myItemCount} line{g.myItemCount === 1 ? "" : "s"} for me</span>
                          {g.myGrossMinor > 0 && (
                            <span className="font-semibold text-ink-700">· {fmtMoney(g.myGrossMinor, "EUR")} gross</span>
                          )}
                        </div>
                      </div>
                      {g.responseLocked && (
                        <Badge tone="neutral" icon={<Lock className="h-3 w-3" />}>Processed - read only</Badge>
                      )}
                    </div>

                    {!g.responseLocked && g.pendingItemCount > 0 && (
                      <div className="mt-3">
                        <Button
                          variant="accent"
                          size="sm"
                          onClick={() => acceptAll(g)}
                          loading={busyItemId === g.submissionId}
                          leftIcon={<Check className="h-4 w-4" />}
                        >
                          Accept all {g.pendingItemCount} line{g.pendingItemCount === 1 ? "" : "s"}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Line items */}
                  <div className="divide-y divide-ink-100">
                    {g.items.map((it) => {
                      const accepted = !!it.subAcceptedAt;
                      const declined = !!it.subDeclinedAt;
                      const busy = busyItemId === it.id;
                      const locked = g.responseLocked;
                      return (
                        <div key={it.id} className="p-4 sm:p-5">
                          <div className="flex items-start gap-3 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-ink-900">
                                {it.siteAddress || it.jobNumber || "Site / job"}
                              </div>
                              <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                {it.jobNumber && it.siteAddress && <span>{it.jobNumber}</span>}
                                <span className="tabular-nums">{it.quantity.toFixed(2)} × {fmtMoney(it.rateMinor, "EUR")}</span>
                                {it.rctRate && <span>· RCT {it.rctRate}%</span>}
                              </div>
                              {it.notes && <div className="text-xs text-ink-500 mt-1 italic">"{it.notes}"</div>}
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-semibold text-ink-900 tabular-nums">{fmtMoney(it.grossMinor, "EUR")}</div>
                              <div className="text-[11px] text-ink-500">gross</div>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            {accepted && (
                              <Badge tone="success" icon={<Check className="h-3 w-3" />}>
                                You accepted
                                {it.subAcceptedAt && <span className="ml-1 text-[10px] opacity-70">· {fmtDate(new Date(it.subAcceptedAt).toISOString().slice(0,10))}</span>}
                              </Badge>
                            )}
                            {declined && (
                              <Badge tone="danger" icon={<AlertCircle className="h-3 w-3" />}>
                                You disputed
                                {it.subDeclinedAt && <span className="ml-1 text-[10px] opacity-70">· {fmtDate(new Date(it.subDeclinedAt).toISOString().slice(0,10))}</span>}
                              </Badge>
                            )}
                            {!accepted && !declined && !locked && (
                              <>
                                <Button
                                  variant="accent"
                                  size="sm"
                                  loading={busy}
                                  onClick={() => respond(g, it, "accept")}
                                  leftIcon={<Check className="h-4 w-4" />}
                                  className="min-h-12"
                                >
                                  Accept
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => openDecline(g, it)}
                                  leftIcon={<X className="h-4 w-4" />}
                                  className="min-h-12"
                                >
                                  Dispute
                                </Button>
                              </>
                            )}
                          </div>

                          {declined && it.subDeclineReason && (
                            <div className="mt-2 text-xs text-ink-600 bg-red-50 border border-red-100 rounded p-2">
                              <strong>Your reason:</strong> {it.subDeclineReason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        open={!!declineCtx}
        onClose={() => setDeclineCtx(null)}
        title="Dispute this line"
        description="Tell the office what's wrong - wrong hours, wrong site, anything. They'll review with the principal."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeclineCtx(null)}>Cancel</Button>
            <Button
              variant="accent"
              onClick={submitDecline}
              disabled={declineReason.trim().length < 4}
              leftIcon={<ChevronRight className="h-4 w-4" />}
            >
              Submit dispute
            </Button>
          </>
        }
      >
        {declineCtx && (
          <div className="space-y-2">
            <div className="text-sm text-ink-700">
              <strong>Line:</strong> {declineCtx.item.siteAddress || declineCtx.item.jobNumber || "site"} · {declineCtx.item.quantity.toFixed(2)} × {fmtMoney(declineCtx.item.rateMinor, "EUR")} = {fmtMoney(declineCtx.item.grossMinor, "EUR")}
            </div>
            <Textarea
              label=""
              rows={4}
              placeholder="e.g. I worked 6 hours not 8, or I wasn't on that site that day..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              maxLength={1000}
            />
            <div className="text-xs text-ink-400">{declineReason.length}/1000</div>
          </div>
        )}
      </Modal>
    </>
  );
}
