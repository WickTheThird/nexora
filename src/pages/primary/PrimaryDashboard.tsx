import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { Primary } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Users, FileText, Wallet, ArrowUpRight } from "lucide-react";

// Primary's home: who they are, headline counts, and money owed to them
// (advised + invoiced + paid totals across linked subs). All numbers are
// scoped server-side to the authenticated primary's id.

type Stats = Awaited<ReturnType<typeof api.getMyPrimaryDashboard>>;

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  to,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  to?: string;
  tone?: "neutral" | "info" | "success" | "warn";
}) {
  const toneClass = {
    neutral: "bg-ink-100 text-ink-700",
    info: "bg-sky-100 text-sky-700",
    success: "bg-emerald-100 text-emerald-700",
    warn: "bg-accent-100 text-accent-700",
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
      {hint && <div className="text-xs text-ink-500 mt-1">{hint}</div>}
    </>
  );
  if (to) {
    return (
      <Link to={to} className="card p-5 block group transition hover:shadow-md hover:-translate-y-0.5 hover:border-ink-300 relative">
        {inner}
        <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-ink-300 group-hover:text-ink-700 transition" />
      </Link>
    );
  }
  return <div className="card p-5">{inner}</div>;
}

function fmtMoney(minor: number) {
  return `\u20AC${(minor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PrimaryDashboard() {
  const [primary, setPrimary] = useState<Primary | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, s] = await Promise.all([api.getMyPrimary(), api.getMyPrimaryDashboard()]);
        setPrimary(p.primary);
        setStats(s);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <PageHeader
        title={primary ? primary.name : "Welcome"}
        description="Your portal — read-only view of subcontractors working under your contract and invoices BC Construction has issued to you."
      />

      {loading ? (
        <div className="skeleton h-64" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <StatCard
              icon={Users}
              label="Subcontractors"
              value={stats?.subcontractorCount ?? 0}
              hint="Working under your contract"
              to="/primary/subcontractors"
            />
            <StatCard
              icon={FileText}
              label="Open invoices"
              value={stats?.openInvoicesCount ?? 0}
              hint={`Net ${fmtMoney(stats?.openInvoicesNetMinor ?? 0)} outstanding`}
              tone="warn"
              to="/primary/invoices"
            />
            <StatCard
              icon={Wallet}
              label="Total billed (paid)"
              value={fmtMoney((stats?.moneyByStatus?.paid?.grossMinor) ?? 0)}
              hint={`${stats?.moneyByStatus?.paid?.count ?? 0} payment(s) settled`}
              tone="success"
            />
          </div>

          {/* Money flow breakdown */}
          {stats?.moneyByStatus && Object.keys(stats.moneyByStatus).length > 0 && (
            <div className="card-padded mb-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 mb-4">Money flow across your subcontractors</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {(["advised", "invoiced", "paid"] as const).map((st) => {
                  const m = stats.moneyByStatus[st] || { count: 0, grossMinor: 0 };
                  const tone =
                    st === "paid" ? "bg-emerald-50 border-emerald-200" :
                    st === "invoiced" ? "bg-sky-50 border-sky-200" :
                    "bg-accent-50 border-accent-200";
                  const label =
                    st === "advised" ? "Advised — sub yet to invoice" :
                    st === "invoiced" ? "Invoiced — BC paying" :
                    "Paid";
                  return (
                    <div key={st} className={`rounded-lg border p-4 ${tone}`}>
                      <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold">{label}</div>
                      <div className="text-lg font-bold text-ink-900 tabular-nums mt-1">{fmtMoney(m.grossMinor)}</div>
                      <div className="text-xs text-ink-500">{m.count} payment{m.count === 1 ? "" : "s"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {primary && (
            <div className="card-padded">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 mb-4">Your details on file with BC</h2>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div><span className="text-ink-500">Company:</span> <span className="font-medium">{primary.name}</span></div>
                {primary.contactName && <div><span className="text-ink-500">Contact:</span> {primary.contactName}</div>}
                {primary.contactEmail && <div><span className="text-ink-500">Email:</span> {primary.contactEmail}</div>}
                {primary.phone && <div><span className="text-ink-500">Phone:</span> {primary.phone}</div>}
                {primary.vat && <div><span className="text-ink-500">VAT:</span> {primary.vat}</div>}
                {primary.address && <div className="sm:col-span-2"><span className="text-ink-500">Address:</span> {primary.address}</div>}
              </div>
              <p className="text-xs text-ink-400 mt-4">
                To update any of these details, please contact BC Construction directly.
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
