import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Users, ArrowUpRight } from "lucide-react";

type SubItem = Awaited<ReturnType<typeof api.listMyPrimarySubs>>["items"][number];

export function PrimarySubcontractors() {
  const [items, setItems] = useState<SubItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.listMyPrimarySubs();
        setItems(r.items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <PageHeader
        title="Subcontractors"
        description="Workers operating under your contract via BC Construction. Click a row to see their hours and billing activity."
      />

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty
          icon={Users}
          title="No subcontractors linked yet"
          description="When BC Construction assigns a subcontractor to your contract, they'll appear here."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Trade</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">RCT</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-ink-900">{s.fullName || "—"}</div>
                    {s.email && <div className="text-xs text-ink-500 mt-0.5">{s.email}</div>}
                  </td>
                  <td className="px-5 py-3 text-ink-700">{s.natureOfServices || <span className="text-ink-400">—</span>}</td>
                  <td className="px-5 py-3"><Badge tone="info">{s.onboardingStatus.replace(/_/g, " ")}</Badge></td>
                  <td className="px-5 py-3 text-ink-700">{s.rctRate ? `${s.rctRate}%` : <span className="text-ink-400">—</span>}</td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/primary/subcontractors/${s.id}`} className="btn-ghost !py-1.5 inline-flex">
                      View <ArrowUpRight className="h-4 w-4" />
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
