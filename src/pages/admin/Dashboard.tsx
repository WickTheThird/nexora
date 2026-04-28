import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { ChangeRequest, Subcontractor } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Users, Building2, FileText, Wallet, MessagesSquare, ArrowUpRight, Send } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

type Stats = Awaited<ReturnType<typeof api.adminDashboardStats>>;

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: "neutral" | "info" | "warn" | "success";
  to?: string;
}) {
  const toneClass = {
    neutral: "bg-ink-100 text-ink-700",
    info: "bg-sky-100 text-sky-700",
    warn: "bg-accent-100 text-accent-700",
    success: "bg-emerald-100 text-emerald-700",
  }[tone];
  const inner = (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className={`h-9 w-9 rounded-lg grid place-items-center ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</div>
      </div>
      <div className="text-3xl font-bold text-ink-900 tabular-nums">{value}</div>
    </>
  );
  // When `to` is set the whole card becomes a link with a hover lift and an
  // arrow chip in the corner — clearly affording navigation.
  if (to) {
    return (
      <Link
        to={to}
        className="card p-5 block group transition hover:shadow-md hover:-translate-y-0.5 hover:border-ink-300 relative"
      >
        {inner}
        <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-ink-300 group-hover:text-ink-700 transition" />
      </Link>
    );
  }
  return <div className="card p-5">{inner}</div>;
}

export function Dashboard() {
  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [all, open, st] = await Promise.all([
          api.adminListSubcontractors({ limit: 100 }),
          api.adminListChangeRequests("open"),
          api.adminDashboardStats(),
        ]);
        setSubs(all.items);
        setRequests(open.items);
        setStats(st);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const awaiting = subs.filter(
    (s) => s.onboardingStatus === "submitted" || s.onboardingStatus === "under_review",
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="At-a-glance overview of the whole 3-tier flow: primaries, subcontractors, and payments."
      />

      {/* Top row: 3-tier counts. Each card links to its natural drill-down. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          icon={Building2}
          label="Primaries"
          value={loading ? "·" : (stats?.primaries ?? 0)}
          tone="info"
          to="/admin/primaries"
        />
        <StatCard
          icon={Users}
          label="Subcontractors"
          value={loading ? "·" : (stats?.subcontractors ?? 0)}
          to="/admin/subcontractors"
        />
        <StatCard
          icon={Send}
          label="Advices awaiting sub invoice"
          value={loading ? "·" : (stats?.advisedPayments ?? 0)}
          tone="warn"
          to="/admin/bulk-advice"
        />
        <StatCard
          icon={FileText}
          label="Sub invoices awaiting payment"
          value={loading ? "·" : (stats?.invoicedPayments ?? 0)}
          tone="info"
          to="/admin/subcontractors"
        />
      </div>

      {/* Second row: money flow + change requests. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          icon={Wallet}
          label="Net paid (last 30 days)"
          value={loading ? "·" : `\u20AC${((stats?.netPaidLast30Minor ?? 0) / 100).toLocaleString("en-IE", { maximumFractionDigits: 0 })}`}
          tone="success"
          to="/admin/subcontractors"
        />
        <StatCard
          icon={FileText}
          label="Open primary invoices"
          value={loading ? "·" : (stats?.primaryInvoicesOpen ?? 0)}
          tone="warn"
          to="/admin/primaries"
        />
        <StatCard
          icon={MessagesSquare}
          label="Open change requests"
          value={loading ? "·" : requests.length}
          tone="info"
          to="/admin/change-requests"
        />
        <StatCard
          icon={Users}
          label="Pending sub approvals"
          value={loading ? "·" : awaiting.length}
          tone="warn"
          to="/admin/subcontractors?status=submitted"
        />
      </div>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-900">Awaiting review</h2>
          <Link to="/admin/subcontractors" className="text-sm font-medium text-ink-700 hover:text-ink-900 inline-flex items-center gap-1">
            See all <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        {loading ? (
          <div className="skeleton h-32" />
        ) : awaiting.length === 0 ? (
          <div className="card p-6 text-sm text-ink-500">All caught up. Nothing waiting for review.</div>
        ) : (
          <div className="card divide-y divide-ink-100">
            {awaiting.slice(0, 5).map((s) => (
              <Link
                key={s.id}
                to={`/admin/subcontractors/${s.id}`}
                className="flex items-center gap-4 p-4 hover:bg-ink-50"
              >
                <div className="h-9 w-9 rounded-full bg-ink-900 text-white grid place-items-center text-xs font-bold">
                  {(s.fullName || s.email || "?").split(" ").map((p) => p[0]).slice(0,2).join("").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-900 truncate">
                    {s.fullName || s.email || "Unknown"}
                  </div>
                  <div className="text-sm text-ink-500 truncate">{s.email}</div>
                </div>
                <Badge tone="info">{s.onboardingStatus.replace(/_/g, " ")}</Badge>
                <ArrowUpRight className="h-4 w-4 text-ink-400" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-900">Recent change requests</h2>
          <Link to="/admin/change-requests" className="text-sm font-medium text-ink-700 hover:text-ink-900 inline-flex items-center gap-1">
            Inbox <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        {loading ? (
          <div className="skeleton h-32" />
        ) : requests.length === 0 ? (
          <div className="card p-6 text-sm text-ink-500">No open requests.</div>
        ) : (
          <div className="card divide-y divide-ink-100">
            {requests.slice(0, 5).map((r) => (
              <div key={r.id} className="p-4">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="text-xs text-ink-500">{fmtDateTime(r.createdAt)}</div>
                  <Badge tone="warn">open</Badge>
                </div>
                <p className="text-sm text-ink-800 line-clamp-2">{r.message}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
