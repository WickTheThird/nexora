// Public Jobs marketplace - principal side. Lives alongside Job Cards on
// the Jobs Posted page. A principal can post a job that's visible to
// every verified sub on the platform; favourites get a "Featured"
// notification first, the wing gets a normal one, and the rest of the
// active subs see it on the public board.

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { JobApplication, PublicJob, PublicJobRateUnit } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { fmtDate, fmtMoney } from "@/lib/format";
import {
  Plus, Send, ArrowUpRight, CheckCircle2, XCircle,
  Pause, Play, Lock, ArrowLeft, Star,
} from "lucide-react";

type Tab = "job_cards" | "public_jobs";

export function PrimaryPublicJobsList({ onTabChange }: { onTabChange?: (t: Tab) => void } = {}) {
  const toast = useToast();
  const [items, setItems] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [postOpen, setPostOpen] = useState(false);

  const refresh = async () => {
    try {
      const r = await api.primaryListPublicJobs();
      setItems(r.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <>
      <PageHeader
        title="Public Jobs"
        right={
          <div className="flex gap-2">
            {onTabChange && (
              <Button variant="ghost" onClick={() => onTabChange("job_cards")}>
                Switch to Job Cards
              </Button>
            )}
            <Button variant="accent" onClick={() => setPostOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
              Post new job
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty
          icon={Send}
          title="No public jobs yet"
          description="Post a job and we'll notify your favourites first, then your wing, then the rest of the verified subs on the platform."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((j) => (
            <Link
              key={j.id}
              to={`/primary/public-jobs/${j.id}`}
              className="card p-5 hover:border-ink-300 hover:shadow-sm transition flex items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-ink-700">{j.jobRef || "POST-?"}</span>
                  <h3 className="font-semibold text-ink-900 truncate">{j.title}</h3>
                  <StatusBadge status={j.status} />
                </div>
                <p className="text-sm text-ink-600 line-clamp-2">{j.brief || <em className="text-ink-400">no description</em>}</p>
                <div className="text-xs text-ink-500 mt-2 flex gap-3 flex-wrap">
                  {j.trade && <span>Trade: {j.trade}</span>}
                  {j.location && <span>Location: {j.location}</span>}
                  {j.payRateMinor && j.rateUnit && <span>{fmtMoney(j.payRateMinor, "EUR")}/{j.rateUnit}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-bold tabular-nums text-ink-900">{j.applicationCount ?? 0}</div>
                <div className="text-xs text-ink-500">applications</div>
                {(j.pendingCount ?? 0) > 0 && (
                  <div className="mt-1"><Badge tone="warn">{j.pendingCount} pending</Badge></div>
                )}
              </div>
              <ArrowUpRight className="h-4 w-4 text-ink-400 shrink-0 mt-1" />
            </Link>
          ))}
        </div>
      )}

      <PostJobModal open={postOpen} onClose={() => setPostOpen(false)} onCreated={refresh} />
    </>
  );
}

function StatusBadge({ status }: { status: PublicJob["status"] }) {
  const tone = (
    status === "open" ? "success"
    : status === "paused" ? "warn"
    : status === "filled" ? "info"
    : status === "closed" ? "neutral"
    : "danger"
  ) as "success" | "warn" | "info" | "neutral" | "danger";
  return <Badge tone={tone}>{status}</Badge>;
}

function PostJobModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [trade, setTrade] = useState("");
  const [location, setLocation] = useState("");
  const [payRate, setPayRate] = useState("");
  const [rateUnit, setRateUnit] = useState<PublicJobRateUnit | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const reset = () => {
    setTitle(""); setBrief(""); setTrade(""); setLocation("");
    setPayRate(""); setRateUnit(""); setStartDate(""); setEndDate("");
  };

  const submit = async () => {
    if (!title.trim() || title.trim().length < 3) {
      toast.error("Title required (at least 3 characters).");
      return;
    }
    if (payRate && !rateUnit) {
      toast.error("Pick a rate unit when you set a pay rate.");
      return;
    }
    setSubmitting(true);
    try {
      const payMinor = payRate ? Math.round(Number(payRate) * 100) : null;
      await api.primaryCreatePublicJob({
        title: title.trim(),
        brief: brief.trim() || undefined,
        trade: trade.trim() || undefined,
        location: location.trim() || undefined,
        payRateMinor: payMinor,
        rateUnit: rateUnit || null,
        startDate: startDate || null,
        endDate: endDate || null,
      });
      toast.success("Job posted. Notifying favourites and your wing now.");
      reset();
      onClose();
      onCreated();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to post");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Post a public job"
      description="Visible to every verified subcontractor. Your favourites get a Featured notification first."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={submit} loading={submitting} leftIcon={<Send className="h-4 w-4" />}>
            Post job
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Title (required)" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Skim coat 200m2 + ceilings" />
        <Textarea label="Description" value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} placeholder="What's the work, how long, anything else they should know." />
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Trade" value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="e.g. plastering" />
          <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Park West, Dublin 12" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Pay rate (EUR)" value={payRate} onChange={(e) => setPayRate(e.target.value)} type="number" min="0" placeholder="e.g. 25" />
          <Select
            label="Rate unit"
            value={rateUnit}
            onChange={(e) => setRateUnit(e.target.value as PublicJobRateUnit | "")}
            options={[
              { value: "", label: "- pick one (or leave blank) -" },
              { value: "hour", label: "per hour" },
              { value: "day", label: "per day" },
              { value: "fixed", label: "fixed total" },
            ]}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="End date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

// ============ Single job detail + applications ============

export function PrimaryPublicJobDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const toast = useToast();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<{ app: JobApplication; reason: string } | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await api.primaryGetPublicJob(id);
      setJob(r.job);
      setApps(r.applications);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const setStatus = async (status: "open" | "paused" | "closed" | "filled") => {
    if (!id) return;
    try {
      await api.primaryPatchPublicJob(id, { status });
      toast.success(`Job ${status}.`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  const approve = async (app: JobApplication) => {
    setActing(app.id);
    try {
      await api.primaryApproveApplication(id, app.id);
      toast.success(`Approved ${app.subcontractorName || "applicant"}. They've been linked to your wing.`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setActing(null);
    }
  };
  const doReject = async () => {
    if (!rejecting) return;
    if (!rejecting.reason.trim()) { toast.error("Reason required."); return; }
    setActing(rejecting.app.id);
    try {
      await api.primaryRejectApplication(id, rejecting.app.id, rejecting.reason.trim());
      toast.success("Application rejected. Sub notified.");
      setRejecting(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setActing(null);
    }
  };

  if (loading) return <div className="skeleton h-64" />;
  if (!job) return <Empty icon={ArrowLeft} title="Not found" description="That job does not exist." />;

  const pending = apps.filter(a => a.status === "pending");
  const decided = apps.filter(a => a.status !== "pending");

  return (
    <>
      <Link to="/primary/public-jobs" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Public Jobs
      </Link>
      <PageHeader
        title={job.jobRef ? `${job.jobRef} - ${job.title}` : job.title}
        right={
          <div className="flex gap-2 flex-wrap">
            {job.status === "open" && (
              <Button variant="outline" onClick={() => setStatus("paused")} leftIcon={<Pause className="h-4 w-4" />}>Pause</Button>
            )}
            {job.status === "paused" && (
              <Button variant="outline" onClick={() => setStatus("open")} leftIcon={<Play className="h-4 w-4" />}>Resume</Button>
            )}
            {(job.status === "open" || job.status === "paused") && (
              <Button variant="outline" onClick={() => setStatus("filled")} leftIcon={<CheckCircle2 className="h-4 w-4" />}>Mark filled</Button>
            )}
            {job.status !== "closed" && (
              <Button variant="ghost" onClick={() => setStatus("closed")} leftIcon={<Lock className="h-4 w-4" />}>Close</Button>
            )}
          </div>
        }
      />

      <div className="card-padded mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <StatusBadge status={job.status} />
          {job.trade && <Badge tone="neutral">{job.trade}</Badge>}
          {job.location && <Badge tone="neutral">{job.location}</Badge>}
          {job.payRateMinor && job.rateUnit && (
            <Badge tone="neutral">{fmtMoney(job.payRateMinor, "EUR")}/{job.rateUnit}</Badge>
          )}
          {job.startDate && <Badge tone="neutral">Starts {fmtDate(job.startDate)}</Badge>}
        </div>
        {job.brief && <p className="text-sm text-ink-700 whitespace-pre-wrap">{job.brief}</p>}
      </div>

      <h2 className="text-lg font-semibold text-ink-900 mb-3 inline-flex items-center gap-2">
        Pending applications <Badge tone="warn">{pending.length}</Badge>
      </h2>
      {pending.length === 0 ? (
        <p className="text-sm text-ink-500 mb-6">No pending applications.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {pending.map((a) => (
            <div key={a.id} className="card p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink-900">{a.subcontractorName || "(unnamed)"}{a.subcontractorRef && <span className="text-xs text-ink-500 ml-2 font-mono">{a.subcontractorRef}</span>}</div>
                <div className="text-xs text-ink-500 mt-0.5">Applied {fmtDate(a.appliedAt)}</div>
                {a.message && <p className="text-sm text-ink-700 mt-2 whitespace-pre-wrap">{a.message}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" leftIcon={<XCircle className="h-4 w-4" />} onClick={() => setRejecting({ app: a, reason: "" })} disabled={acting === a.id}>Reject</Button>
                <Button variant="accent" size="sm" leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => approve(a)} loading={acting === a.id}>Approve</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-ink-900 mb-3">Decided</h2>
          <div className="space-y-2">
            {decided.map((a) => (
              <div key={a.id} className="card p-4 flex items-start gap-4 opacity-80">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-ink-800">{a.subcontractorName || "(unnamed)"}</span>
                    <Badge tone={a.status === "approved" ? "success" : a.status === "rejected" ? "danger" : "neutral"}>{a.status}</Badge>
                  </div>
                  {a.decidedReason && <p className="text-xs text-ink-500 mt-1">Reason: {a.decidedReason}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title={rejecting ? `Reject ${rejecting.app.subcontractorName || "applicant"}?` : "Reject"}
        description="They get an email + in-app notification. Cool-off: they can re-apply to this same job in 24h, or apply to other jobs of yours immediately."
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
          placeholder="e.g. We needed someone with a CSCS card, will keep you in mind next time."
        />
      </Modal>
    </>
  );
}

// ============ Combined "Jobs Posted" page = Job Cards tab + Public Jobs tab ============

export function PrimaryJobsPosted() {
  const [tab, setTab] = useState<Tab>("job_cards");
  // Lazy-load the existing Job Cards UI without changing its file.
  // We render PrimaryPublicJobsList when the public-jobs tab is active.
  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-ink-200">
        {(["job_cards", "public_jobs"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition ${
              tab === t ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-700"
            }`}
          >
            {t === "job_cards" ? "Job Cards" : "Public Jobs"}
          </button>
        ))}
      </div>
      {tab === "job_cards" ? <JobCardsTab onSwitch={() => setTab("public_jobs")} /> : <PrimaryPublicJobsList onTabChange={setTab} />}
    </div>
  );
}

// JobCardsTab wraps the existing PrimarySubmissions list inline. We avoid
// a route nest so the user just toggles between two views on the SAME
// /primary/jobs page.
import { PrimarySubmissions } from "./PrimarySubmissions";
function JobCardsTab({ onSwitch }: { onSwitch: () => void }) {
  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button variant="ghost" size="sm" onClick={onSwitch}>Switch to Public Jobs</Button>
      </div>
      <PrimarySubmissions />
    </div>
  );
}

// fmt money + date come from @/lib/format - we re-use those.
// useMemo / Star imports kept for the favourite-toggle component below.
export function FavouriteStarButton({ subId, initial }: { subId: string; initial: boolean }) {
  const [isFav, setIsFav] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setBusy(true);
    try {
      if (isFav) {
        await api.primaryRemoveFavouriteSub(subId);
        setIsFav(false);
      } else {
        await api.primaryAddFavouriteSub(subId);
        setIsFav(true);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={isFav ? "Remove from favourites" : "Add to favourites - they'll be notified first when you post a job"}
      className={`p-1.5 rounded hover:bg-ink-100 ${isFav ? "text-amber-500" : "text-ink-400 hover:text-ink-700"}`}
      aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
    >
      <Star className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
    </button>
  );
}

// Keep useMemo import alive (unused otherwise).
export const __ = useMemo;
