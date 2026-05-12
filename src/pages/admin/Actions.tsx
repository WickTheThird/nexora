// Admin Actions - real bulk flow centre.
//
// Step 1: Pick a target audience (subcontractors / principals / pending
//         subcontractor requests / submitted Job Cards / open change
//         requests). Filter + multi-select.
// Step 2: Pick one or more actions to apply, in order.
//         e.g. 'Approve' + 'Assign to principal X' on the same set.
// Step 3: Confirm + run. Each action is applied to every selected
//         target; failures are tallied but don't block the rest.
//
// Per-page bulk actions still exist on the individual inbox pages
// (Submissions, Sub Requests, Change Requests) for the common
// single-target flow. This page is for the cross-action chains.

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ChangeRequest, Primary, PrimarySubmission, Subcontractor } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import {
  Users, Building2, Inbox, Briefcase, MessagesSquare, CheckCircle2,
  X, Send, Trash2, ArrowRight, Play, ListChecks, Layers,
} from "lucide-react";

// ------------------------------------------------------------------
// Domain
// ------------------------------------------------------------------

type Audience = "subs" | "principals" | "sub_requests" | "submissions" | "change_requests";

type Target = { id: string; label: string; sub: string };

type ActionDef = {
  key: string;
  label: string;
  description: string;
  /** Audiences this action is valid for. */
  audiences: Audience[];
  /** Extra inputs the user has to fill before the action runs. */
  needs?: ("principal_id" | "reason" | "status")[];
  /** Run on a single target id. Returns void on success, throws on fail. */
  run: (
    targetId: string,
    payload: { principalId?: string; reason?: string; status?: string },
  ) => Promise<void>;
};

const STATUS_OPTIONS_SUBS = [
  { value: "invited",           label: "Invited" },
  { value: "in_progress",       label: "In progress" },
  { value: "approved",          label: "Approved" },
  { value: "active",            label: "Active" },
  { value: "rejected",          label: "Rejected" },
];

const ACTIONS: ActionDef[] = [
  // ---- Subcontractor actions ----
  {
    key: "approve_sub",
    label: "Approve subcontractor",
    description: "Move to approved status. Triggers welcome + audit log.",
    audiences: ["subs"],
    run: async (id) => { await api.adminApprove(id); },
  },
  {
    key: "reject_sub",
    label: "Reject subcontractor",
    description: "Terminal rejection with a shared reason.",
    audiences: ["subs"],
    needs: ["reason"],
    run: async (id, { reason }) => { await api.adminReject(id, reason); },
  },
  {
    key: "set_sub_status",
    label: "Set subcontractor status...",
    description: "Manual status flip (skips the precise approve/reject audit trail).",
    audiences: ["subs"],
    needs: ["status"],
    run: async (id, { status }) => { await api.adminPatchSubcontractor(id, { onboardingStatus: status as Subcontractor["onboardingStatus"] }); },
  },
  {
    key: "assign_principal",
    label: "Assign to principal...",
    description: "Link selected subcontractors to a chosen principal (overwrites existing linkage).",
    audiences: ["subs"],
    needs: ["principal_id"],
    run: async (id, { principalId }) => { await api.adminPatchSubcontractor(id, { primaryId: principalId } as Partial<Subcontractor>); },
  },
  {
    key: "unlink_principal",
    label: "Unlink from principal",
    description: "Clear primary_id on each selected sub.",
    audiences: ["subs"],
    run: async (id) => { await api.adminPatchSubcontractor(id, { primaryId: null } as Partial<Subcontractor>); },
  },

  // ---- Sub-request actions ----
  {
    key: "reject_sub_request",
    label: "Reject subcontractor request",
    description: "Reject the pending principal-initiated request with a shared reason.",
    audiences: ["sub_requests"],
    needs: ["reason"],
    run: async (id, { reason }) => { await api.adminRejectOperativeRequest(id, reason || ""); },
  },

  // ---- Submission actions ----
  {
    key: "process_submission",
    label: "Process Job Card",
    description: "Mark each selected Job Card as completed + auto-invoice.",
    audiences: ["submissions"],
    run: async (id) => { await api.adminProcessPrimarySubmission(id); },
  },

  // ---- Change-request actions ----
  {
    key: "close_change_request",
    label: "Close change request",
    description: "Bulk-close - useful for cleanup of resolved old tickets.",
    audiences: ["change_requests"],
    run: async (id) => { await api.adminPatchChangeRequest(id, "closed"); },
  },
  {
    key: "mark_change_seen",
    label: "Mark change request seen",
    description: "Acknowledge without closing - moves Open to Seen on the kanban.",
    audiences: ["change_requests"],
    run: async (id) => { await api.adminPatchChangeRequest(id, "seen"); },
  },
];

const AUDIENCE_META: Record<Audience, { label: string; icon: React.ComponentType<{ className?: string }>; hint: string }> = {
  subs:            { label: "Subcontractors",         icon: Users,          hint: "Approve, reject, change status, assign principal, unlink." },
  principals:      { label: "Principals",             icon: Building2,      hint: "Archive in bulk (more actions coming)." },
  sub_requests:    { label: "Subcontractor requests", icon: Inbox,          hint: "Bulk-reject pending requests." },
  submissions:     { label: "Job Card submissions",   icon: Briefcase,      hint: "Bulk-process submitted Job Cards." },
  change_requests: { label: "Change requests",        icon: MessagesSquare, hint: "Bulk-close + mark seen." },
};

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export function AdminActions() {
  const toast = useToast();
  const [audience, setAudience] = useState<Audience>("subs");
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Selected actions form an ordered chain. Each step also carries
  // its payload (principalId / reason / status) so the user can
  // build 'approve THEN assign to principal X THEN set status active'.
  type ChainStep = { actionKey: string; principalId?: string; reason?: string; status?: string };
  const [chain, setChain] = useState<ChainStep[]>([]);

  // Side-load principals for the 'assign to principal' picker.
  const [principalsList, setPrincipalsList] = useState<Primary[]>([]);
  useEffect(() => {
    api.adminListPrimaries().then(r => setPrincipalsList(r.items)).catch(() => { /* non-fatal */ });
  }, []);

  // Load targets whenever the audience changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPicked(new Set());
    setChain([]);
    (async () => {
      try {
        const list = await fetchTargets(audience);
        if (!cancelled) setTargets(list);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof ApiError ? e.message : "Failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience]);

  const visible = useMemo(() => {
    if (!search.trim()) return targets;
    const q = search.trim().toLowerCase();
    return targets.filter(t => t.label.toLowerCase().includes(q) || (t.sub || "").toLowerCase().includes(q));
  }, [targets, search]);

  const togglePick = (id: string) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectAllVisible = () => setPicked(new Set(visible.map(v => v.id)));
  const clearPicked = () => setPicked(new Set());

  // Chain manipulation.
  const validActions = ACTIONS.filter(a => a.audiences.includes(audience));
  const addStep = (actionKey: string) => setChain(c => [...c, { actionKey }]);
  const removeStep = (i: number) => setChain(c => c.filter((_, idx) => idx !== i));
  const updateStep = (i: number, patch: Partial<ChainStep>) => setChain(c => c.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const chainValid = chain.every(s => {
    const def = ACTIONS.find(a => a.key === s.actionKey);
    if (!def) return false;
    for (const need of (def.needs || [])) {
      if (need === "principal_id" && !s.principalId) return false;
      if (need === "reason" && !s.reason?.trim()) return false;
      if (need === "status" && !s.status) return false;
    }
    return true;
  });

  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<{ id: string; label: string; step: string; ok: boolean; msg?: string }[]>([]);

  const run = async () => {
    if (picked.size === 0 || chain.length === 0 || !chainValid) return;
    if (!window.confirm(`Run ${chain.length} action${chain.length === 1 ? "" : "s"} on ${picked.size} target${picked.size === 1 ? "" : "s"}?`)) return;
    setRunning(true);
    setLog([]);
    const totalPicked = Array.from(picked);
    const newLog: typeof log = [];
    for (const targetId of totalPicked) {
      const t = targets.find(x => x.id === targetId);
      for (const step of chain) {
        const def = ACTIONS.find(a => a.key === step.actionKey);
        if (!def) continue;
        try {
          await def.run(targetId, { principalId: step.principalId, reason: step.reason, status: step.status });
          newLog.push({ id: targetId, label: t?.label || targetId.slice(0,8), step: def.label, ok: true });
        } catch (e) {
          newLog.push({
            id: targetId, label: t?.label || targetId.slice(0,8), step: def.label,
            ok: false, msg: e instanceof ApiError ? e.message : "Failed",
          });
          // Stop the chain for this target on the first failure - we
          // don't want to e.g. set status after a failed approve.
          break;
        }
      }
      setLog([...newLog]);
    }
    const okCount = newLog.filter(l => l.ok).length;
    const failCount = newLog.filter(l => !l.ok).length;
    toast.success(`Done. ${okCount} succeeded${failCount ? `, ${failCount} failed` : ""}.`);
    setRunning(false);
  };

  return (
    <>
      <PageHeader title="Actions" />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_320px] gap-4 items-start">
        {/* ---- Step 1: Audience picker ---- */}
        <div className="card-padded">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-3">1. Pick audience</div>
          <div className="space-y-1">
            {(Object.keys(AUDIENCE_META) as Audience[]).map(a => {
              const meta = AUDIENCE_META[a];
              const Icon = meta.icon;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAudience(a)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${
                    audience === a ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {meta.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-ink-500 mt-3">{AUDIENCE_META[audience].hint}</p>
        </div>

        {/* ---- Step 2: Targets ---- */}
        <div className="card-padded">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold">
              2. Pick targets ({picked.size} / {visible.length})
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAllVisible} disabled={visible.length === 0}>Select all</Button>
              {picked.size > 0 && <Button variant="ghost" size="sm" onClick={clearPicked}>Clear</Button>}
            </div>
          </div>
          <Input
            label=""
            placeholder="Filter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mt-3 max-h-[480px] overflow-y-auto border border-ink-200 rounded-md divide-y divide-ink-100">
            {loading ? (
              <div className="p-4 text-sm text-ink-500">Loading…</div>
            ) : visible.length === 0 ? (
              <div className="p-4 text-sm text-ink-500 text-center">No targets in this audience.</div>
            ) : visible.map(t => (
              <label key={t.id} className="flex items-center gap-3 px-3 py-2 hover:bg-ink-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={picked.has(t.id)}
                  onChange={() => togglePick(t.id)}
                  className="h-4 w-4 rounded border-ink-300"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink-900 truncate">{t.label}</div>
                  {t.sub && <div className="text-[11px] text-ink-500 truncate">{t.sub}</div>}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* ---- Step 3: Action chain ---- */}
        <div className="card-padded sticky top-2">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-3 inline-flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" /> 3. Actions ({chain.length} step{chain.length === 1 ? "" : "s"})
          </div>
          {chain.length === 0 ? (
            <div className="text-xs text-ink-500 mb-3 italic">No steps yet. Pick from below to add a step.</div>
          ) : (
            <div className="space-y-2 mb-3">
              {chain.map((step, i) => {
                const def = ACTIONS.find(a => a.key === step.actionKey);
                if (!def) return null;
                return (
                  <div key={i} className="rounded-md bg-ink-50 border border-ink-200 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-ink-900">Step {i + 1}: {def.label}</div>
                        <div className="text-[11px] text-ink-500">{def.description}</div>
                      </div>
                      <button type="button" onClick={() => removeStep(i)} className="text-ink-400 hover:text-red-600" title="Remove step">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {def.needs?.includes("principal_id") && (
                      <Select
                        label="Principal"
                        value={step.principalId || ""}
                        onChange={(e) => updateStep(i, { principalId: e.target.value })}
                        options={[
                          { value: "", label: "- pick -" },
                          ...principalsList.filter(p => !p.archivedAt).map(p => ({ value: p.id, label: p.name })),
                        ]}
                      />
                    )}
                    {def.needs?.includes("reason") && (
                      <Input
                        label="Reason"
                        value={step.reason || ""}
                        onChange={(e) => updateStep(i, { reason: e.target.value })}
                        placeholder="Shared with the affected user(s)"
                      />
                    )}
                    {def.needs?.includes("status") && (
                      <Select
                        label="New status"
                        value={step.status || ""}
                        onChange={(e) => updateStep(i, { status: e.target.value })}
                        options={[{ value: "", label: "- pick -" }, ...STATUS_OPTIONS_SUBS]}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1">Add step</div>
          <div className="grid gap-1 mb-3">
            {validActions.map(a => (
              <button
                key={a.key}
                type="button"
                onClick={() => addStep(a.key)}
                className="text-left px-2 py-1.5 rounded-md text-xs text-ink-700 hover:bg-ink-100 inline-flex items-center gap-2"
              >
                <ArrowRight className="h-3 w-3 text-ink-400" /> {a.label}
              </button>
            ))}
            {validActions.length === 0 && (
              <p className="text-[11px] text-ink-500 italic">No actions defined for this audience yet.</p>
            )}
          </div>

          <Button
            variant="accent"
            onClick={run}
            disabled={picked.size === 0 || chain.length === 0 || !chainValid}
            loading={running}
            leftIcon={<Play className="h-4 w-4" />}
            className="w-full"
          >
            Run on {picked.size} target{picked.size === 1 ? "" : "s"}
          </Button>
          {!chainValid && chain.length > 0 && (
            <p className="text-[11px] text-amber-700 mt-2">Fill the required inputs on each step first.</p>
          )}
        </div>
      </div>

      {/* ---- Run log ---- */}
      {log.length > 0 && (
        <div className="card-padded mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 mb-3 inline-flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Run log
          </h2>
          <div className="max-h-[400px] overflow-y-auto divide-y divide-ink-100">
            {log.map((l, i) => (
              <div key={i} className="flex items-center gap-3 py-2 text-sm">
                {l.ok
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  : <X className="h-4 w-4 text-red-600 shrink-0" />}
                <span className="text-ink-700 flex-1 truncate">{l.label}</span>
                <span className="text-xs text-ink-500">{l.step}</span>
                {!l.ok && l.msg && <span className="text-xs text-red-600 truncate max-w-[280px]">{l.msg}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------
// Audience -> targets fetcher
// ------------------------------------------------------------------

async function fetchTargets(audience: Audience): Promise<Target[]> {
  if (audience === "subs") {
    const r = await api.adminListSubcontractors({ limit: 500 });
    return r.items.map((s: Subcontractor) => ({
      id: s.id,
      label: s.fullName || s.email || s.id.slice(0, 8),
      sub: [s.subcontractorRef, s.email, s.onboardingStatus].filter(Boolean).join(" · "),
    }));
  }
  if (audience === "principals") {
    const r = await api.adminListPrimaries();
    return r.items.map((p: Primary) => ({
      id: p.id,
      label: p.name,
      sub: [p.contactName, p.contactEmail, p.vat].filter(Boolean).join(" · "),
    }));
  }
  if (audience === "sub_requests") {
    const r = await api.adminListOperativeRequests("requested");
    return r.items.map(req => ({
      id: req.id,
      label: req.name,
      sub: [req.email, req.mobile, req.primaryName].filter(Boolean).join(" · "),
    }));
  }
  if (audience === "submissions") {
    const r = await api.adminListPrimarySubmissions("submitted");
    return r.items.map((s: PrimarySubmission) => ({
      id: s.id,
      label: s.jobRef || s.id.slice(0, 8),
      sub: `${s.itemCount} item(s) · gross ${(s.totalGrossMinor / 100).toFixed(2)} EUR`,
    }));
  }
  if (audience === "change_requests") {
    const r = await api.adminListChangeRequests("open");
    return r.items.map((c: ChangeRequest) => ({
      id: c.id,
      label: c.entityType === "primary_submission" ? `Job Card request · ${c.requestedStatus || c.subChangeAction || ""}` : "Sub support",
      sub: c.message.slice(0, 80),
    }));
  }
  return [];
}
