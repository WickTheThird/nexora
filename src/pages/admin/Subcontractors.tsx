import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { OnboardingStatus, Subcontractor } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { fmtDate, initials } from "@/lib/format";
import { UserPlus, Search, ArrowUpRight, Users } from "lucide-react";

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
  const [items, setItems] = useState<Subcontractor[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const load = async (reset: boolean, nextCursor?: string | null) => {
    const r = await api.adminListSubcontractors({
      status: status || undefined,
      q: q || undefined,
      cursor: nextCursor || undefined,
      limit: 25,
    });
    setItems((prev) => (reset ? r.items : [...prev, ...r.items]));
    setCursor(r.nextCursor);
  };

  useEffect(() => {
    (async () => { try { await load(true); } finally { setLoading(false); } })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = async () => {
    setLoading(true);
    try { await load(true); } finally { setLoading(false); }
  };

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
          <div className="md:w-60">
            <Select
              label="Status"
              value={status}
              options={STATUSES}
              onChange={(e) => setStatus(e.target.value)}
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
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [clientRef, setClientRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    try {
      const r = await api.adminCreateSubcontractor({
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        clientRef: clientRef.trim() || undefined,
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
    setClientRef("");
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
        <div className="space-y-4">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" required />
          <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Subcontractor" />
          <Input label="Client reference" value={clientRef} onChange={(e) => setClientRef(e.target.value)} placeholder="Optional internal ID" />
        </div>
      )}
    </Modal>
  );
}
