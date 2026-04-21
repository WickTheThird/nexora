import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { ChangeRequest, Subcontractor } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Users, Clock, CheckCircle2, MessagesSquare, ArrowUpRight } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: "neutral" | "info" | "warn" | "success";
}) {
  const toneClass = {
    neutral: "bg-ink-100 text-ink-700",
    info: "bg-sky-100 text-sky-700",
    warn: "bg-accent-100 text-accent-700",
    success: "bg-emerald-100 text-emerald-700",
  }[tone];
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`h-9 w-9 rounded-lg grid place-items-center ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</div>
      </div>
      <div className="text-3xl font-bold text-ink-900 tabular-nums">{value}</div>
    </div>
  );
}

export function Dashboard() {
  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [all, open] = await Promise.all([
          api.adminListSubcontractors({ limit: 100 }),
          api.adminListChangeRequests("open"),
        ]);
        setSubs(all.items);
        setRequests(open.items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const total = subs.length;
  const inProgress = subs.filter(
    (s) => !["approved", "active", "rejected"].includes(s.onboardingStatus),
  ).length;
  const approved = subs.filter(
    (s) => s.onboardingStatus === "approved" || s.onboardingStatus === "active",
  ).length;
  const openRequests = requests.length;

  const awaiting = subs.filter(
    (s) => s.onboardingStatus === "submitted" || s.onboardingStatus === "under_review",
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="At-a-glance overview of onboarding activity."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard icon={Users} label="Subcontractors" value={loading ? "·" : total} />
        <StatCard icon={Clock} label="In progress" value={loading ? "·" : inProgress} tone="warn" />
        <StatCard icon={CheckCircle2} label="Approved" value={loading ? "·" : approved} tone="success" />
        <StatCard icon={MessagesSquare} label="Open requests" value={loading ? "·" : openRequests} tone="info" />
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
