// Cross-principal invitations dashboard. Every principal_roster row
// joined to its linked subcontractor + user, so BC can see at a
// glance who has been invited, who has signed up, and who is
// awaiting onboarding approval. No mutation lives here - clicking
// into a row deep-links to the sub or principal detail page where
// the actual approve/reject work happens.
//
// Surfaces invitations sent via BOTH paths the principal has:
//   - manual roster add  (POST /me/primary/roster)
//   - CSV import         (POST /me/primary/roster/import)
// Both call sendRosterInviteEmail, so this page is the tracking
// surface for those emails.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { fmtDateTime } from "@/lib/format";
import { Inbox, Mail, ArrowUpRight, UserCheck, UserX, Clock, Send } from "lucide-react";

type Invitation = {
  id: string;
  primaryId: string;
  primaryName: string | null;
  rosterEmail: string;
  rosterName: string;
  linkedSubId: string | null;
  subFullName: string | null;
  subEmail: string | null;
  subcontractorRef: string | null;
  onboardingStatus: string | null;
  submittedAt: number | null;
  userVerifiedAt: number | null;
  invitationStatus: "invited" | "signed_up" | "submitted" | "approved" | "rejected";
  createdAt: number;
  updatedAt: number;
};

const STATUS_FILTERS = [
  { value: "all",       label: "All" },
  { value: "invited",   label: "Invited (not signed up)" },
  { value: "signed_up", label: "Signed up" },
  { value: "submitted", label: "Submitted" },
  { value: "approved",  label: "Approved" },
  { value: "rejected",  label: "Rejected" },
];

function statusBadge(s: Invitation["invitationStatus"]) {
  if (s === "approved")  return <Badge tone="success" icon={<UserCheck className="h-3 w-3"/>}>Approved</Badge>;
  if (s === "rejected")  return <Badge tone="danger"  icon={<UserX className="h-3 w-3"/>}>Rejected</Badge>;
  if (s === "submitted") return <Badge tone="info"    icon={<Clock className="h-3 w-3"/>}>Submitted</Badge>;
  if (s === "signed_up") return <Badge tone="info"    icon={<Send className="h-3 w-3"/>}>Signed up</Badge>;
  return <Badge tone="warn" icon={<Mail className="h-3 w-3"/>}>Invited</Badge>;
}

export function AdminInvitations() {
  const toast = useToast();
  const [items, setItems] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const r = await api.adminListInvitations();
        setItems(r.items);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const filtered = useMemo(() => {
    let rows = items;
    if (status !== "all") {
      rows = rows.filter((r) => r.invitationStatus === status);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) =>
        r.rosterName.toLowerCase().includes(q) ||
        r.rosterEmail.toLowerCase().includes(q) ||
        (r.primaryName || "").toLowerCase().includes(q) ||
        (r.subcontractorRef || "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [items, status, search]);

  // Headline counts for the status strip above the table.
  const counts = useMemo(() => {
    const c = { invited: 0, signed_up: 0, submitted: 0, approved: 0, rejected: 0 };
    for (const r of items) c[r.invitationStatus]++;
    return c;
  }, [items]);

  if (loading) return <div className="skeleton h-64" />;

  return (
    <>
      <PageHeader
        title="Invitations"
        description="Every operative a principal has invited to the platform. Track who has signed up, who has submitted onboarding, and who has been approved or rejected."
      />

      {/* Status strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {([
          ["invited",  "Invited",   counts.invited,   "bg-amber-50 text-amber-700"],
          ["signed_up","Signed up", counts.signed_up, "bg-blue-50 text-blue-700"],
          ["submitted","Submitted", counts.submitted, "bg-blue-50 text-blue-700"],
          ["approved", "Approved",  counts.approved,  "bg-emerald-50 text-emerald-700"],
          ["rejected", "Rejected",  counts.rejected,  "bg-red-50 text-red-700"],
        ] as const).map(([key, label, n, cls]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(status === key ? "all" : key)}
            className={`card p-3 text-left transition hover:shadow-elev ${status === key ? "ring-2 ring-ink-900" : ""}`}
          >
            <div className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider ${cls}`}>{label}</div>
            <div className="text-2xl font-bold text-ink-900 mt-2">{n}</div>
          </button>
        ))}
      </div>

      <div className="card-padded">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Input
            placeholder="Search by name, email, principal, ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[260px]"
          />
          <Select
            label=""
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={STATUS_FILTERS}
            className="w-auto min-w-[200px]"
          />
        </div>

        {filtered.length === 0 ? (
          <Empty icon={Inbox} title="No invitations" description="Invitations sent by principals show up here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-ink-500 border-b border-ink-100">
                <tr>
                  <th className="py-2 pr-3">Operative</th>
                  <th className="py-2 pr-3">Invited by</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Sub Ref</th>
                  <th className="py-2 pr-3">Invited</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-ink-50 last:border-b-0">
                    <td className="py-2.5 pr-3">
                      <div className="text-ink-900 font-medium">{r.rosterName}</div>
                      <div className="text-xs text-ink-500">{r.rosterEmail}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      {r.primaryName ? (
                        <Link to={`/admin/primaries/${r.primaryId}`} className="text-ink-700 hover:text-ink-900 hover:underline">
                          {r.primaryName}
                        </Link>
                      ) : (
                        <span className="text-ink-400 italic">unknown</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">{statusBadge(r.invitationStatus)}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-ink-600">
                      {r.subcontractorRef || <span className="text-ink-400">-</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-ink-500">{fmtDateTime(r.createdAt)}</td>
                    <td className="py-2.5 pr-3 text-right">
                      {r.linkedSubId && (
                        <Link
                          to={`/admin/subcontractors/${r.linkedSubId}`}
                          className="text-ink-600 hover:text-ink-900 inline-flex items-center gap-1 text-xs"
                        >
                          Open <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
