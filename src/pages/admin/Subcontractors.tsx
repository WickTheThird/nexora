import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { OnboardingStatus, Primary, Subcontractor } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { fmtDate, initials } from "@/lib/format";
import { UserPlus, Search, ArrowUpRight, Users, Building2 } from "lucide-react";

const STATUSES: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "invited", label: "Invited" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "approved", label: "Approved" },
  { value: "active", label: "Active" },
  { value: "rejected", label: "Rejected" },
];

function statusBadge(s: OnboardingStatus) {
  const tone = {
    invited: "neutral",
    in_progress: "warn",
    submitted: "info",
    under_review: "info",
    changes_requested: "warn",
    approved: "success",
    active: "success",
    rejected: "danger",
  }[s] as "neutral" | "warn" | "info" | "success" | "danger";
  return <Badge tone={tone}>{s.replace(/_/g, " ")}</Badge>;
}

export function Subcontractors() {
  const toast = useToast();
  // Read initial filter values from the URL so deep links from the dashboard
  // (e.g. /admin/subcontractors?status=submitted) and from PrimaryDetail
  // (?primaryId=...) land filtered.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") || "";
  const initialPrimary = searchParams.get("primaryId") || "";

  const [items, setItems] = useState<Subcontractor[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(initialStatus);
  const [primaryId, setPrimaryId] = useState(initialPrimary);
  const [q, setQ] = useState("");
  const [primaries, setPrimaries] = useState<Primary[]>([]);
  // Auto-open the create modal when navigated with ?new=1 (e.g. from
  // the admin dashboard "New subcontractor" quick-add button).
  const [createOpen, setCreateOpen] = useState(searchParams.get("new") === "1");

  const load = async (reset: boolean, nextCursor?: string | null) => {
    const r = await api.adminListSubcontractors({
      status: status || undefined,
      q: q || undefined,
      cursor: nextCursor || undefined,
      limit: 25,
      primaryId: primaryId || undefined,
    });
    setItems((prev) => (reset ? r.items : [...prev, ...r.items]));
    setCursor(r.nextCursor);
  };

  useEffect(() => {
    (async () => {
      try {
        await load(true);
        // Side-load primaries for the column rendering + filter dropdown.
        const p = await api.adminListPrimaries();
        setPrimaries(p.items);
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Look up primary name for a given id (column rendering).
  const primaryName = (id: string | null) => {
    if (!id) return null;
    return primaries.find((p) => p.id === id)?.name ?? "(unknown)";
  };

  const applyFilters = async () => {
    setLoading(true);
    // Sync URL so the filter is shareable + survives reload.
    const next = new URLSearchParams();
    if (status) next.set("status", status);
    if (primaryId) next.set("primaryId", primaryId);
    if (q) next.set("q", q);
    setSearchParams(next, { replace: true });
    try { await load(true); } finally { setLoading(false); }
  };

  // Debounce live search-as-you-type. 250ms is short enough for "feels
  // instant" and long enough to skip a fetch per-keystroke.
  useEffect(() => {
    const t = setTimeout(() => { applyFilters(); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, primaryId]);

  return (
    <>
      <PageHeader
        title="Subcontractors"
        description="Manage accounts, review onboarding and approve."
        right={
          <Button variant="accent" onClick={() => setCreateOpen(true)} leftIcon={<UserPlus className="h-4 w-4" />}>
            New subcontractor
          </Button>
        }
      />

      <div className="card-padded mb-6">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <Input
              label="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email, or reference…"
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
          <div className="md:w-48">
            <Select
              label="Status"
              value={status}
              options={STATUSES}
              onChange={(e) => setStatus(e.target.value)}
            />
          </div>
          <div className="md:w-56">
            <Select
              label="Principal"
              value={primaryId}
              options={[
                { value: "", label: "All principals" },
                { value: "none", label: "Unlinked only" },
                ...primaries.map((p) => ({ value: p.id, label: p.name })),
              ]}
              onChange={(e) => setPrimaryId(e.target.value)}
            />
          </div>
          <Button variant="primary" onClick={applyFilters} leftIcon={<Search className="h-4 w-4" />}>
            Apply
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty icon={Users} title="No subcontractors match" description="Try adjusting the filters." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-50 border-b border-ink-100">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Principal</th>
                  <th className="px-5 py-3">Client ref</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-ink-900 text-white grid place-items-center text-[11px] font-bold">
                          {initials(s.fullName || s.email || "?")}
                        </div>
                        <span className="font-medium text-ink-900">{s.fullName || "·"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-ink-600">{s.email}</td>
                    <td className="px-5 py-3 text-sm">
                      {s.primaryId ? (
                        <Link
                          to={`/admin/primaries/${s.primaryId}`}
                          className="inline-flex items-center gap-1 text-ink-700 hover:text-ink-900 hover:underline"
                        >
                          <Building2 className="h-3.5 w-3.5" />
                          {primaryName(s.primaryId)}
                        </Link>
                      ) : (
                        <span className="text-ink-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-ink-600">{s.clientRef || "·"}</td>
                    <td className="px-5 py-3">{statusBadge(s.onboardingStatus)}</td>
                    <td className="px-5 py-3 text-sm text-ink-500">{fmtDate(s.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/admin/subcontractors/${s.id}`} className="btn-ghost !py-1.5 inline-flex">
                        Open <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cursor && (
            <div className="p-4 border-t border-ink-100 flex justify-center">
              <Button variant="outline" onClick={() => load(false, cursor)}>Load more</Button>
            </div>
          )}
        </div>
      )}

      <CreateSubcontractorModal
        open={createOpen}
        primaries={primaries}
        // If the list is currently filtered by a primary, pre-select that
        // primary in the create modal so the admin's flow ("looking at
        // Glenveagh's subs, want to add another") just works.
        defaultPrimaryId={primaryId && primaryId !== "none" ? primaryId : ""}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          setCreateOpen(false);
          await load(true);
          toast.success("Subcontractor created");
        }}
      />
    </>
  );
}

function CreateSubcontractorModal({
  open,
  primaries,
  defaultPrimaryId,
  onClose,
  onCreated,
}: {
  open: boolean;
  primaries: Primary[];
  defaultPrimaryId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  // PPS captured here so admin can record it during initial onboarding
  // without forcing the operative to log in to add it themselves. Lives
  // under the Personal section (mirrors where it appears on My Details).
  const [ppsNumber, setPpsNumber] = useState("");
  const [primaryId, setPrimaryId] = useState(defaultPrimaryId);
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    if (open) setPrimaryId(defaultPrimaryId);
  }, [open, defaultPrimaryId]);

  const submit = async () => {
    if (!email.trim()) { toast.error("Email is required"); return; }
    if (!fullName.trim()) { toast.error("Full name is required"); return; }
    if (!ppsNumber.trim()) { toast.error("PPS number is required"); return; }
    setLoading(true);
    try {
      const r = await api.adminCreateSubcontractor({
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        // client_ref no longer accepted from admin - worker auto-generates
        // it as CLI-NNNN. Only PPS travels in addition to email/name now.
        ppsNumber: ppsNumber.trim(),
        primaryId: primaryId || undefined,
      });
      setTempPassword(r.tempPassword);
      onCreated();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setEmail("");
    setFullName("");
    setPpsNumber("");
    setPrimaryId(defaultPrimaryId);
    setTempPassword(null);
  };

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Create subcontractor"
      description={tempPassword ? "Account created. Share the password securely." : "Send an invite by creating their account. A temporary password is generated."}
      footer={
        tempPassword ? (
          <Button onClick={() => { reset(); onClose(); }}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
            <Button variant="accent" onClick={submit} loading={loading}>Create account</Button>
          </>
        )
      }
    >
      {tempPassword ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
            <div className="font-semibold mb-1">One-time display</div>
            This password will not be shown again. Copy it now and share via a secure channel.
          </div>
          <div className="rounded-lg bg-ink-950 text-white p-4 font-mono text-sm break-all select-all">
            {tempPassword}
          </div>
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(tempPassword)}>
            Copy to clipboard
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Personal - identity + tax-side identifiers (PPS lives here,
              not under Work, so it matches the layout on the operative's
              own My Details page). */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Personal</h3>
            <div className="space-y-3">
              <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Subcontractor" required />
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" required autoComplete="off" />
              <Input
                label="PPS number"
                value={ppsNumber}
                onChange={(e) => setPpsNumber(e.target.value.toUpperCase())}
                placeholder="1234567T"
                required
                hint="Required for RCT / Revenue. Stored encrypted at rest."
              />
            </div>
          </section>

          {/* Work - who they're contracted under. Sub code + client ref
              are auto-generated server-side, so no input needed. */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Work</h3>
            <Select
              label="Principal (optional)"
              value={primaryId}
              options={[
                { value: "", label: "- No principal yet -" },
                ...primaries
                  .filter((p) => !p.archivedAt)
                  .map((p) => ({ value: p.id, label: p.name })),
              ]}
              onChange={(e) => setPrimaryId(e.target.value)}
              hint="You can change this later. The principal must accept the pairing before the operative appears on their roster."
            />
            <p className="text-[11px] text-ink-400 mt-2">
              Internal IDs (sub code <code>SUB-NNNN</code> + client ref <code>CLI-NNNN</code>) are auto-generated.
            </p>
          </section>
        </div>
      )}
    </Modal>
  );
}
