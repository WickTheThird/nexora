import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Inbox, CheckCircle2, X, Building2 } from "lucide-react";

// Admin inbox for operative requests submitted by principal users.
// Approving creates the actual Subcontractor + returns a one-time temp
// password (admin shares with the operative).

type Row = Awaited<ReturnType<typeof api.adminListOperativeRequests>>["items"][number];

// Bucket presets matching Subcontractors / Jobs Posted pattern.
// 'Current' = requested (awaiting BC). 'Archive' = approved or
// rejected (terminal). Cancelled is rare so it lives in Archive too.
type Bucket = "all" | "current" | "archive";
const BUCKETS: { key: Bucket; label: string; statuses: string[] | null }[] = [
  { key: "all",     label: "All",     statuses: null },
  { key: "current", label: "Current", statuses: ["requested"] },
  { key: "archive", label: "Archive", statuses: ["approved","rejected","cancelled"] },
];

function statusBadge(s: string) {
  const tone: "success" | "danger" | "warn" | "neutral" =
    s === "approved" ? "success" :
    s === "rejected" ? "danger" :
    s === "cancelled" ? "neutral" : "warn";
  const label =
    s === "requested" ? "Awaiting action" :
    s === "approved" ? "Approved" :
    s === "rejected" ? "Rejected" :
    s === "cancelled" ? "Cancelled" : s;
  return <Badge tone={tone}>{label}</Badge>;
}

export function AdminOperativeRequests() {
  const toast = useToast();
  const [items, setItems] = useState<Row[]>([]);
  const [bucket, setBucket] = useState<Bucket>("current");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<Row | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      // Fetch all - bucket + search client-side so counts stay honest.
      const r = await api.adminListOperativeRequests(undefined);
      setItems(r.items);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  const counts: Record<Bucket, number> = {
    all: items.length,
    current: items.filter(r => r.status === "requested").length,
    archive: items.filter(r => r.status === "approved" || r.status === "rejected" || r.status === "cancelled").length,
  };

  const visible = (() => {
    const cfg = BUCKETS.find(b => b.key === bucket);
    let rows = cfg && cfg.statuses ? items.filter(r => cfg.statuses!.includes(r.status)) : items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        (r.mobile || "").toLowerCase().includes(q) ||
        (r.primaryName || "").toLowerCase().includes(q)
      );
    }
    return rows;
  })();

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectAllVisible = () => setSelected(new Set(visible.filter(r => r.status === "requested").map(r => r.id)));
  const clearSelection = () => setSelected(new Set());

  // Bulk-reject with the same reason. Approve in bulk doesn't make
  // sense (each needs an email), but bulk-reject is straightforward.
  const bulkReject = async () => {
    if (selected.size === 0) return;
    const reason = prompt(`Reason for rejecting ${selected.size} request${selected.size === 1 ? "" : "s"}?`);
    if (!reason || !reason.trim()) return;
    setActing(true);
    let ok = 0, failed = 0;
    for (const id of selected) {
      try { await api.adminRejectOperativeRequest(id, reason.trim()); ok++; }
      catch { failed++; }
    }
    toast.success(`Rejected ${ok}.${failed ? ` ${failed} failed.` : ""}`);
    clearSelection();
    await refresh();
    setActing(false);
  };

  const reject = async (row: Row) => {
    const reason = prompt(`Reason for rejecting "${row.name}"? (Sent to the principal)`);
    if (reason == null) return;
    if (!reason.trim()) { toast.error("Reason required"); return; }
    try {
      await api.adminRejectOperativeRequest(row.id, reason.trim());
      toast.info("Rejected");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  return (
    <>
      <PageHeader title="Subcontractor requests" />

      {/* Bucket tabs - All / Current / Archive. */}
      <div className="flex gap-1 mb-4 border-b border-ink-200 overflow-x-auto">
        {BUCKETS.map(b => (
          <button
            key={b.key}
            type="button"
            onClick={() => setBucket(b.key)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 whitespace-nowrap transition ${
              bucket === b.key ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {b.label}
            <span className={`ml-2 text-xs ${bucket === b.key ? "text-ink-500" : "text-ink-400"}`}>{counts[b.key]}</span>
          </button>
        ))}
      </div>

      <div className="card-padded mb-4">
        <Input
          label="Search"
          placeholder="Name, email, mobile, principal..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Bulk action bar - bulk-reject for now. Approve stays per-row
          because each needs the operative's email entered. */}
      {selected.size > 0 && (
        <div className="rounded-lg bg-ink-900 text-white px-4 py-2 flex items-center justify-between gap-3 mb-3 sticky top-2 z-10">
          <div className="text-sm"><strong className="tabular-nums">{selected.size}</strong> selected</div>
          <div className="flex gap-2 items-center">
            <Button variant="ghost" size="sm" onClick={clearSelection} className="text-white hover:bg-white/10" leftIcon={<X className="h-3.5 w-3.5" />}>Clear</Button>
            <Button variant="danger" size="sm" onClick={bulkReject} loading={acting} leftIcon={<X className="h-3.5 w-3.5" />}>Reject selected</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="skeleton h-64" />
      ) : visible.length === 0 ? (
        <Empty icon={Inbox} title="Nothing here" description="No subcontractor requests match the bucket / search." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={visible.filter(v => v.status === "requested").length > 0 && visible.filter(v => v.status === "requested").every(v => selected.has(v.id))}
                    onChange={(e) => e.target.checked ? selectAllVisible() : clearSelection()}
                  />
                </th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Mobile / Email</th>
                <th className="px-5 py-3">Principal</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className={`border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50 ${selected.has(row.id) ? "bg-accent-50/40" : ""}`}>
                  <td className="px-3 py-3">
                    {row.status === "requested" && (
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-medium text-ink-900">{row.name}</div>
                    {row.notes && <div className="text-xs text-ink-500 mt-0.5">{row.notes}</div>}
                  </td>
                  <td className="px-5 py-3 text-ink-700">
                    {row.mobile && <div>{row.mobile}</div>}
                    {row.email && <div className="text-xs text-ink-500">{row.email}</div>}
                  </td>
                  <td className="px-5 py-3">
                    {row.primaryName && (
                      <Link to={`/admin/primaries/${row.primaryId}`} className="inline-flex items-center gap-1 text-ink-700 hover:underline">
                        <Building2 className="h-3.5 w-3.5" />{row.primaryName}
                      </Link>
                    )}
                  </td>
                  <td className="px-5 py-3">{statusBadge(row.status)}</td>
                  <td className="px-5 py-3 text-right">
                    {row.status === "requested" && (
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => reject(row)} leftIcon={<X className="h-4 w-4" />} className="hover:bg-red-50 hover:text-red-700">Reject</Button>
                        <Button variant="accent" size="sm" onClick={() => setApproving(row)} leftIcon={<CheckCircle2 className="h-4 w-4" />}>Approve</Button>
                      </div>
                    )}
                    {row.status === "rejected" && row.rejectionReason && (
                      <span className="text-xs text-amber-700">{row.rejectionReason}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ApproveModal
        request={approving}
        onClose={() => setApproving(null)}
        onApproved={async () => { setApproving(null); await refresh(); }}
      />
    </>
  );
}

function ApproveModal({
  request,
  onClose,
  onApproved,
}: {
  request: Row | null;
  onClose: () => void;
  onApproved: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    if (request) {
      setEmail(request.email || "");
      setFullName(request.name);
      setTempPassword(null);
    }
  }, [request]);

  const submit = async () => {
    if (!request) return;
    if (!email.trim()) { toast.error("Email required to invite the operative"); return; }
    setLoading(true);
    try {
      const r = await api.adminApproveOperativeRequest(request.id, {
        email: email.trim(),
        fullName: fullName.trim() || undefined,
      });
      setTempPassword(r.tempPassword);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={!!request}
      onClose={() => { setTempPassword(null); onClose(); }}
      title={request ? `Approve ${request.name}` : ""}
      description={tempPassword
        ? "Operative account created. Share the temp password securely - it won't be shown again."
        : "Approving will create the Subcontractor account, link it to this principal, and return a one-time temp password."}
      footer={
        tempPassword ? (
          <Button onClick={async () => { await onApproved(); }}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="accent" onClick={submit} loading={loading}>Approve & create account</Button>
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
          <div className="text-sm text-ink-600">
            <span className="text-ink-500">Email:</span> <span className="font-medium">{email}</span>
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
          <Input
            label="Operative email (required)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="operative@example.com"
            required
            hint={request?.email ? "Pre-filled from request; you can change it." : "Request didn't include an email; enter one to send the invite."}
          />
          <Input
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Operative name"
            hint="Pre-filled from request name; you can clean it up here."
          />
        </div>
      )}
    </Modal>
  );
}
