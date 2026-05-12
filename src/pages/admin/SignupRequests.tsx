// Recent Activity (formerly Recent signups). Two-column split: new
// subcontractor signups on the left, new principal signups on the
// right. Search filters across both columns. Period filter narrows
// to the last N days. Both kinds keep deep links to the live entity
// pages where actual moderation happens (close / anonymise / link).

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Inbox, Building2, Hammer, ArrowUpRight, Activity } from "lucide-react";
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

// Period filter (in days). Renders as a select to keep the chrome
// minimal; backend has the full feed already so we just slice
// client-side.
const PERIODS = [
  { value: "0",   label: "All time" },
  { value: "1",   label: "Last 24h" },
  { value: "7",   label: "Last 7 days" },
  { value: "30",  label: "Last 30 days" },
  { value: "90",  label: "Last 90 days" },
];

export function AdminSignupRequests() {
  const toast = useToast();
  const [items, setItems] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("30");

  useEffect(() => {
    (async () => {
      try {
        const r = await api.adminListSignupRequests("approved");
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
    const days = Number(period) || 0;
    if (days > 0) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      rows = rows.filter(r => r.createdAt >= cutoff);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        r.fullName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.companyName || "").toLowerCase().includes(q) ||
        (r.trade || "").toLowerCase().includes(q) ||
        (r.mobile || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [items, period, search]);

  const subs = useMemo(() => filtered.filter(r => r.kind === "subcontractor"), [filtered]);
  const principals = useMemo(() => filtered.filter(r => r.kind === "primary"), [filtered]);

  return (
    <>
      <PageHeader title="Recent activity" />

      <div className="card-padded mb-4 grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3 items-end">
        <Input
          label="Search"
          placeholder="Name, email, company, trade, mobile..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          label="Period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          options={PERIODS}
        />
      </div>

      {loading ? (
        <div className="skeleton h-64" />
      ) : filtered.length === 0 ? (
        <Empty
          icon={Activity}
          title="Nothing matches"
          description="Widen the period or clear the search to see more."
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <ColumnCard
            kind="subcontractor"
            label="Subcontractors"
            icon={Hammer}
            items={subs}
          />
          <ColumnCard
            kind="primary"
            label="Principals"
            icon={Building2}
            items={principals}
          />
        </div>
      )}
    </>
  );
}

function ColumnCard({
  kind, label, icon: Icon, items,
}: {
  kind: "subcontractor" | "primary";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SignupRequest[];
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-ink-100 bg-ink-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-900 inline-flex items-center gap-2">
          <Icon className="h-4 w-4 text-ink-600" /> {label}
        </h3>
        <Badge tone={kind === "primary" ? "info" : "neutral"}>{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-500">
          <Inbox className="h-5 w-5 inline mr-1 text-ink-400" />
          No {label.toLowerCase()} in this window.
        </div>
      ) : (
        <ul className="divide-y divide-ink-100">
          {items.map(r => (
            <li key={r.id} className="px-5 py-3 flex items-start gap-3 hover:bg-ink-50/50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-900 truncate">{r.fullName}</span>
                  <span className="text-xs text-ink-500 whitespace-nowrap">{fmtDateTime(r.createdAt)}</span>
                </div>
                <div className="text-xs text-ink-600 truncate">{r.email}</div>
                <div className="text-xs text-ink-500 mt-0.5">
                  {kind === "primary"
                    ? <>{r.companyName || "(no company)"}{r.companyVat ? ` · ${r.companyVat}` : ""}</>
                    : <>{r.trade || "(no trade listed)"}</>
                  }
                  {r.mobile && <> · {r.mobile}</>}
                </div>
                {r.notes && <p className="text-xs text-ink-500 italic mt-1 line-clamp-2">&ldquo;{r.notes}&rdquo;</p>}
              </div>
              {/* Deep-link to the specific person, not the section. The
                  signup_requests row has resultingUserId pointing at the
                  created entity - we use the email as a search query so
                  the receiving list lands focused on this person. */}
              <Link
                to={kind === "primary"
                  ? `/admin/primaries?q=${encodeURIComponent(r.companyName || r.email)}`
                  : `/admin/subcontractors?q=${encodeURIComponent(r.email)}`}
                className="text-ink-500 hover:text-ink-900 inline-flex items-center gap-0.5 text-xs whitespace-nowrap"
              >
                Open <ArrowUpRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
