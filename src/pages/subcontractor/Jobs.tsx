// Public Jobs board - sub side. Browse open public_jobs from every
// principal on the platform, filter by trade / location text, apply
// with a short message. The sub can see their existing application
// status inline so they don't double-apply.

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { PublicJob } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Search, Briefcase, Send, Star, Clock, CheckCircle2, XCircle } from "lucide-react";

type Bucket = "invited" | "my_lists" | "discover" | "all";

export function SubJobsBoard() {
  const toast = useToast();
  const [items, setItems] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [applying, setApplying] = useState<PublicJob | null>(null);
  const [bucket, setBucket] = useState<Bucket>("all");
  const [isTrusted, setIsTrusted] = useState(true);

  const refresh = async (qOverride?: string, bucketOverride?: Bucket) => {
    setLoading(true);
    try {
      const r = await api.subListPublicJobsByBucket(
        bucketOverride ?? bucket,
        { q: (qOverride ?? q) || undefined },
      );
      setItems(r.items);
      setIsTrusted(r.isTrusted);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh("", bucket); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [bucket]);

  const buckets: { key: Bucket; label: string }[] = [
    { key: "all",      label: "All" },
    { key: "invited",  label: "Invited" },
    { key: "my_lists", label: "From my principals" },
    { key: "discover", label: "Discover" },
  ];

  return (
    <>
      <PageHeader title="Jobs board" />

      {/* Procurement-model tabs (Phase 4.5). Subs see four buckets:
          - All: union of the three below
          - Invited: principal pre-invited me (need to accept / decline)
          - From my principals: vendor-list jobs from principals I'm on
          - Discover: discoverable jobs from principals I'm NOT on */}
      <div className="flex gap-1 mb-4 border-b border-ink-200 overflow-x-auto">
        {buckets.map(b => (
          <button
            key={b.key}
            type="button"
            onClick={() => setBucket(b.key)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 whitespace-nowrap transition ${
              bucket === b.key ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {bucket === "discover" && !isTrusted && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 mb-4 text-sm text-amber-900">
          <strong>Discover is locked.</strong> Apply to join at least one principal's vendor list to unlock discoverable jobs across the platform.
        </div>
      )}

      <div className="card-padded mb-5 flex gap-2 items-end">
        <div className="flex-1">
          <Input
            label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="title, location, description..."
            onKeyDown={(e) => { if (e.key === "Enter") refresh(); }}
          />
        </div>
        <Button variant="outline" onClick={() => refresh()} leftIcon={<Search className="h-4 w-4" />}>Search</Button>
      </div>

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty
          icon={Briefcase}
          title={
            bucket === "invited"  ? "No invitations"
            : bucket === "my_lists" ? "No open jobs from your principals"
            : bucket === "discover" ? (isTrusted ? "Nothing in Discover right now" : "Locked")
            : "No open jobs"
          }
          description={
            bucket === "invited"  ? "When a principal invites you directly, the invitation appears here."
            : bucket === "my_lists" ? "Principals you're on the vendor list for will post jobs visible here."
            : bucket === "discover" && !isTrusted ? "You need to be approved on at least one principal's vendor list to see discoverable jobs."
            : "We'll notify you when a new one is posted."
          }
        />
      ) : (
        <div className="grid gap-3">
          {items.map((j) => (
            <div key={j.id} className={`card p-5 ${j.isFavourite ? "border-l-4 border-l-amber-400" : ""}`}>
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {j.myApplicationStatus === "invited" && (
                      <Badge tone="warn">Invited</Badge>
                    )}
                    {j.isFavourite && (
                      <Badge tone="warn" icon={<Star className="h-3 w-3 fill-current" />}>Featured for you</Badge>
                    )}
                    <h3 className="font-semibold text-ink-900">{j.title}</h3>
                  </div>
                  <div className="text-xs text-ink-500 mb-2">
                    {j.primaryName} {j.jobRef && <>· <span className="font-mono">{j.jobRef}</span></>} · <VisibilityHint v={j.visibility} />
                  </div>
                  {j.brief && <p className="text-sm text-ink-700 line-clamp-3 mb-2">{j.brief}</p>}
                  <div className="text-xs text-ink-500 flex gap-3 flex-wrap">
                    {j.trade && <span>Trade: {j.trade}</span>}
                    {j.location && <span>Location: {j.location}</span>}
                    {j.payRateMinor && j.rateUnit && <span>Pay: {fmtMoney(j.payRateMinor, "EUR")}/{j.rateUnit}</span>}
                    {j.startDate && <span>Starts {fmtDate(j.startDate)}</span>}
                  </div>
                </div>
                <div className="shrink-0">
                  <ApplyButton job={j} onClickApply={() => setApplying(j)} onAfterDecline={() => refresh()} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ApplyModal
        job={applying}
        onClose={() => setApplying(null)}
        onApplied={async () => { setApplying(null); await refresh(); }}
      />
    </>
  );
}

function ApplyButton({
  job, onClickApply, onAfterDecline,
}: {
  job: PublicJob;
  onClickApply: () => void;
  onAfterDecline?: () => void;
}) {
  const toast = useToast();
  if (job.myApplicationStatus === "invited") {
    // Procurement model: principal pre-invited this sub. They can
    // Accept (turns into an Apply with a message) OR Decline (locked
    // out of this specific job, principal sees the decline).
    return (
      <div className="flex gap-2 items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            if (!window.confirm("Decline this invitation?")) return;
            try {
              await api.subDeclineJobInvite(job.id);
              toast.success("Invitation declined.");
              onAfterDecline?.();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Failed");
            }
          }}
        >
          Decline
        </Button>
        <Button variant="accent" leftIcon={<Send className="h-4 w-4" />} onClick={onClickApply}>
          Accept
        </Button>
      </div>
    );
  }
  if (job.myApplicationStatus === "pending") {
    return <Badge tone="info" icon={<Clock className="h-3 w-3" />}>Applied</Badge>;
  }
  if (job.myApplicationStatus === "approved") {
    return <Badge tone="success" icon={<CheckCircle2 className="h-3 w-3" />}>Approved</Badge>;
  }
  if (job.myApplicationStatus === "rejected") {
    return <Badge tone="danger" icon={<XCircle className="h-3 w-3" />}>Not accepted</Badge>;
  }
  if (job.myApplicationStatus === "declined") {
    return <Badge tone="neutral">Declined</Badge>;
  }
  return (
    <Button variant="accent" leftIcon={<Send className="h-4 w-4" />} onClick={onClickApply}>
      Apply
    </Button>
  );
}

function VisibilityHint({ v }: { v: PublicJob["visibility"] }) {
  if (v === "invite_only") return <span>Invite only</span>;
  if (v === "vendor_list") return <span>Open to vendor list</span>;
  return <span>Discoverable</span>;
}

function ApplyModal({ job, onClose, onApplied }: { job: PublicJob | null; onClose: () => void; onApplied: () => Promise<void> }) {
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // When the sub already has an 'invited' application row, hitting
  // 'Apply' really means 'Accept the invitation'. Same API call, just
  // friendlier copy in the modal.
  const isAccept = job?.myApplicationStatus === "invited";

  const submit = async () => {
    if (!job) return;
    setSubmitting(true);
    try {
      await api.subApplyToJob(job.id, message.trim());
      toast.success(isAccept
        ? "Invitation accepted. The principal will follow up."
        : "Application sent. The principal will be notified.");
      setMessage("");
      await onApplied();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to apply");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={!!job}
      onClose={onClose}
      title={job
        ? (isAccept ? `Accept invitation: ${job.title}` : `Apply to: ${job.title}`)
        : "Apply"}
      description={job
        ? (isAccept
            ? `${job.primaryName} invited you directly. Send a short note and they'll be in touch.`
            : `${job.primaryName} will see your message and your subcontractor profile.`)
        : ""}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={submit} loading={submitting} leftIcon={<Send className="h-4 w-4" />}>
            {isAccept ? "Accept invitation" : "Send application"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Textarea
          label="Short note (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="Tell them why you're a fit. They'll already see your verified profile + certs."
        />
        <p className="text-xs text-ink-500">If rejected, you can apply to other jobs from this principal immediately, or re-apply to this one after a 24-hour cool-off.</p>
      </div>
    </Modal>
  );
}

// Sub-side: my applications list (their own outgoing applications).
export function SubMyApplications() {
  const toast = useToast();
  const [items, setItems] = useState<import("@/lib/types").JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const r = await api.subListMyApplications();
      setItems(r.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load");
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const withdraw = async (id: string) => {
    if (!window.confirm("Withdraw this application?")) return;
    try {
      await api.subWithdrawApplication(id);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  return (
    <>
      <PageHeader title="My applications" />
      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty
          icon={Briefcase}
          title="No applications yet"
          description="Browse the Jobs board and apply to one - they'll all show up here."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((a) => (
            <div key={a.id} className="card p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-ink-900">{a.jobTitle || "(job)"}</h3>
                  {a.jobRef && <span className="font-mono text-xs text-ink-500">{a.jobRef}</span>}
                  <StatusBadge status={a.status} />
                </div>
                <div className="text-xs text-ink-500 mt-0.5">
                  {a.primaryName} · applied {fmtDate(a.appliedAt)}
                  {a.decidedAt && <> · decided {fmtDate(a.decidedAt)}</>}
                </div>
                {a.message && <p className="text-sm text-ink-700 mt-2 whitespace-pre-wrap">You wrote: {a.message}</p>}
                {a.decidedReason && a.status === "rejected" && (
                  <p className="text-xs text-ink-700 mt-2 italic">Reason: {a.decidedReason}</p>
                )}
              </div>
              {a.status === "pending" && (
                <Button variant="ghost" size="sm" onClick={() => withdraw(a.id)}>Withdraw</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: import("@/lib/types").JobApplicationStatus }) {
  const map = {
    invited:   { tone: "warn",    icon: <Clock className="h-3 w-3" /> },
    pending:   { tone: "info",    icon: <Clock className="h-3 w-3" /> },
    approved:  { tone: "success", icon: <CheckCircle2 className="h-3 w-3" /> },
    rejected:  { tone: "danger",  icon: <XCircle className="h-3 w-3" /> },
    withdrawn: { tone: "neutral", icon: null as null | React.ReactNode },
    declined:  { tone: "neutral", icon: <XCircle className="h-3 w-3" /> },
  } as const;
  const m = map[status];
  return <Badge tone={m.tone} icon={m.icon || undefined}>{status}</Badge>;
}

// Single-job detail page (for direct deep links from notifications/email).
export function SubJobDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const toast = useToast();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [nextApplyAt, setNextApplyAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);

  const refresh = async () => {
    try {
      const r = await api.subGetPublicJob(id);
      setJob(r.job);
      setNextApplyAt(r.nextApplyAllowedAt);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load");
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (loading) return <div className="skeleton h-64" />;
  if (!job) return <Empty icon={Briefcase} title="Not found" description="That job is no longer available." />;

  const coolOffActive = nextApplyAt != null && nextApplyAt > Date.now();
  return (
    <>
      <PageHeader title={job.title} />
      <div className="text-sm text-ink-500 mb-4">
        From {job.primaryName} {job.jobRef && <>· <span className="font-mono">{job.jobRef}</span></>}
      </div>
      <div className="card-padded mb-4">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {job.trade && <Badge tone="neutral">{job.trade}</Badge>}
          {job.location && <Badge tone="neutral">{job.location}</Badge>}
          {job.payRateMinor && job.rateUnit && (
            <Badge tone="neutral">{fmtMoney(job.payRateMinor, "EUR")}/{job.rateUnit}</Badge>
          )}
          {job.startDate && <Badge tone="neutral">Starts {fmtDate(job.startDate)}</Badge>}
          {job.isFavourite && (
            <Badge tone="warn" icon={<Star className="h-3 w-3 fill-current" />}>Featured for you</Badge>
          )}
        </div>
        {job.brief && <p className="text-sm text-ink-700 whitespace-pre-wrap">{job.brief}</p>}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <ApplyButton job={job} onClickApply={() => setApplyOpen(true)} />
        {coolOffActive && (
          <span className="text-xs text-amber-700">
            You can re-apply after {fmtDate(nextApplyAt!)} (24h cool-off).
          </span>
        )}
      </div>

      <ApplyModal
        job={applyOpen ? job : null}
        onClose={() => setApplyOpen(false)}
        onApplied={async () => { setApplyOpen(false); await refresh(); }}
      />
    </>
  );
}
