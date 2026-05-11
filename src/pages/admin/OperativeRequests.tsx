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

const STATUSES = [
  { value: "requested", label: "Awaiting your action" },
  { value: "approved",  label: "Approved" },
  { value: "rejected",  label: "Rejected" },
  { value: "",          label: "All" },
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
  const [filter, setFilter] = useState("requested");
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<Row | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await api.adminListOperativeRequests(filter || undefined);
      setItems(r.items);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

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
      <PageHeader
        title="Operative requests"
        description="New operatives requested by your principals. Approving creates the Subcontractor account and returns a one-time temp password to share."
        right={
          <div className="md:w-56">
            <Select label="" value={filter} options={STATUSES} onChange={(e) => setFilter(e.target.value)} />
          </div>
        }
      />

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty
          icon={Inbox}
          title="Nothing to action"
          description="When a principal requests a new operative, it'll appear here for you to review and approve."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Mobile / Email</th>
                <th className="px-5 py-3">Principal</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
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
                        <Button variant="outline" size="sm" onClick={() => reject(row)} leftIcon={<X className="h-4 w-4" />}>Reject</Button>
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
