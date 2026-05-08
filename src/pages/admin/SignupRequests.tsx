// Read-only feed of recent self-serve signups. Since signup is now
// open (no approval gate), this page is purely informational —
// "who joined recently" — with deep links to the live entity pages
// where actual moderation happens (close / anonymise / link / etc.).
//
// We keep the underlying signup_requests table because it captures the
// raw form input (mobile, trade, company VAT, address) that doesn't
// always make it onto the user/sub/primary record verbatim. Useful
// audit trail.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { Inbox, Building2, Hammer, ArrowUpRight } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

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

  useEffect(() => {
    (async () => {
      try {
        // Always fetch all statuses — feed is read-only so no filter.
        const r = await api.adminListSignupRequests("approved");
        setItems(r.items);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  return (
    <>
      <PageHeader
        title="Recent signups"
        description="Self-served signups (read-only feed). Approval is automatic on email verification — moderate from the Subcontractors / Principals pages once they appear."
      />

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty
          icon={Inbox}
          title="Nothing yet"
          description="When someone signs up via the public /signup pages, they'll appear here once their account is created. Open the live entity pages for moderation actions."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Kind</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Detail</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3 text-ink-600 text-xs whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                  <td className="px-5 py-3">
                    {r.kind === "primary" ? (
                      <Badge tone="info">
                        <Building2 className="h-3 w-3 inline -mt-0.5 mr-1" /> Principal
                      </Badge>
                    ) : (
                      <Badge tone="neutral">
                        <Hammer className="h-3 w-3 inline -mt-0.5 mr-1" /> Subcontractor
                      </Badge>
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
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={r.kind === "primary" ? "/admin/primaries" : "/admin/subcontractors"}
                      className="btn-ghost !py-1.5 inline-flex"
                    >
                      Manage <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
