import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PortalShell";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { MapPin, ArrowUpRight, Users, Clock, Wallet } from "lucide-react";

// Aggregated view of every site (free-form site_ref) where work has been
// done across ALL subs linked to this principal. Helps the developer see
// which projects are eating the most labour without drilling per-sub.

type SiteItem = Awaited<ReturnType<typeof api.listMyPrincipalSites>>["items"][number];

function fmtMoney(minor: number) {
  return `\u20AC${(minor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(s: string | null) {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return s; }
}

export function PrincipalSites() {
  const toast = useToast();
  const [items, setItems] = useState<SiteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.listMyPrincipalSites();
        setItems(r.items);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Failed to load sites");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  return (
    <>
      <PageHeader
        title="Sites"
        description="Aggregated view of every site where your subcontractors have logged hours. Click any site for the per-sub breakdown."
      />

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty
          icon={MapPin}
          title="No site activity yet"
          description="When your subcontractors log timesheets with a site reference, the sites will appear here aggregated."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3">Site</th>
                <th className="px-5 py-3 text-right"><Users className="h-3.5 w-3.5 inline mr-1" />Subs</th>
                <th className="px-5 py-3 text-right"><Clock className="h-3.5 w-3.5 inline mr-1" />Hours</th>
                <th className="px-5 py-3">Last worked</th>
                <th className="px-5 py-3 text-right"><Wallet className="h-3.5 w-3.5 inline mr-1" />Total gross</th>
                <th className="px-5 py-3 text-right">Paid net</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.siteRef} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 font-medium text-ink-900">
                      <MapPin className="h-4 w-4 text-ink-400" /> {s.siteRef}
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5">{s.sheetCount} timesheet{s.sheetCount === 1 ? "" : "s"}</div>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{s.subCount}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">{s.totalHours.toFixed(1)}</td>
                  <td className="px-5 py-3 text-ink-600">{fmtDate(s.lastWorked)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtMoney(s.totalGrossMinor)}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium text-emerald-700">{fmtMoney(s.paidNetMinor)}</td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={`/primary/sites/${encodeURIComponent(s.siteRef)}`}
                      className="btn-ghost !py-1.5 inline-flex"
                    >
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
