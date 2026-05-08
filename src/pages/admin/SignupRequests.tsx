// Admin inbox for self-serve signup requests. Approve creates the real
// account (sends welcome email + temp password); reject closes with a
// reason. Mirrors the Operative Requests inbox layout.

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Inbox, Check, X, Building2, Hammer } from "lucide-react";

type SignupRequest = {
  id: string;
  kind: "primary" | "subcontractor";
  fullName: string;
  email: string;
  mobile: string | null;
  trade: string | null;
  companyName: string | null;
  companyVat: string | null;
  notes: string | null;
  status: string;
  reviewedAt: number | null;
  rejectionReason: string | null;
  createdAt: number;
};

export function AdminSignupRequests() {
  const toast = useToast();
  const [items, setItems] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [approving, setApproving] = useState<SignupRequest | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await api.adminListSignupRequests(statusFilter);
      setItems(r.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const approve = async () => {
    if (!approving) return;
    try {
      const r = await api.adminApproveSignupRequest(approving.id);
      setTempPassword(r.tempPassword);
      toast.success(`${approving.fullName} approved \u2014 welcome email sent`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  const reject = async (r: SignupRequest) => {
    const reason = window.prompt(`Reject signup for ${r.fullName}? Reason (will be saved):`);
    if (reason == null) return;
    try {
      await api.adminRejectSignupRequest(r.id, reason || "Not approved");
      toast.success("Rejected");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  return (
    <>
      <PageHeader
        title="Signup requests"
        description="People who applied via the public signup pages. Approve to create their account; they'll get a welcome email with a temp password."
        right={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 text-sm rounded-md border border-ink-200 focus:border-ink-900 outline-none bg-white"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        }
      />

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty
          icon={Inbox}
          title="Nothing to action"
          description="When someone signs up via /signup/primary or /signup/subcontractor, they'll appear here for you to review and approve."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3">Kind</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Detail</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    {r.kind === "primary" ? (
                      <span className="inline-flex items-center gap-1 text-ink-700"><Building2 className="h-3.5 w-3.5" /> Principal</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-ink-700"><Hammer className="h-3.5 w-3.5" /> Subcontractor</span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-medium text-ink-900">{r.fullName}</td>
                  <td className="px-5 py-3 text-ink-700">{r.email}</td>
                  <td className="px-5 py-3 text-ink-600 text-xs">
                    {r.kind === "primary" ? (
                      <>{r.companyName}{r.companyVat ? ` · ${r.companyVat}` : ""}</>
                    ) : (
                      <>{r.trade || "—"}</>
                    )}
                    {r.mobile && <div className="text-ink-500">{r.mobile}</div>}
                    {r.notes && <div className="mt-1 text-ink-500 italic">&ldquo;{r.notes}&rdquo;</div>}
                    {r.rejectionReason && (<div className="mt-1 text-amber-700">Reason: {r.rejectionReason}</div>)}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warn"}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {r.status === "pending" && (
                      <div className="inline-flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => reject(r)} leftIcon={<X className="h-3.5 w-3.5" />}>Reject</Button>
                        <Button variant="accent" size="sm" onClick={() => setApproving(r)} leftIcon={<Check className="h-3.5 w-3.5" />}>Approve</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approve confirmation modal */}
      <Modal
        open={!!approving && !tempPassword}
        onClose={() => setApproving(null)}
        title={`Approve ${approving?.fullName || ""}?`}
        description={
          approving?.kind === "primary"
            ? "Creates a Principal account and emails the temp password."
            : "Creates a Subcontractor account and emails the temp password."
        }
      >
        <p className="text-sm text-ink-700">
          Email: <strong>{approving?.email}</strong><br />
          {approving?.kind === "primary" && approving?.companyName && (<>Company: <strong>{approving.companyName}</strong></>)}
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={() => setApproving(null)}>Cancel</Button>
          <Button variant="accent" onClick={approve}>Approve &amp; create account</Button>
        </div>
      </Modal>

      {/* Temp password reveal */}
      <Modal
        open={!!tempPassword}
        onClose={() => { setTempPassword(null); setApproving(null); }}
        title="Account created"
        description="The temp password has been emailed to them. You can also share it directly:"
      >
        {tempPassword && (
          <div className="bg-ink-900 text-white rounded-md p-4 font-mono text-sm break-all select-all">
            {tempPassword}
          </div>
        )}
        <div className="flex justify-end mt-6">
          <Button variant="accent" onClick={() => { setTempPassword(null); setApproving(null); }}>Done</Button>
        </div>
      </Modal>
    </>
  );
}
