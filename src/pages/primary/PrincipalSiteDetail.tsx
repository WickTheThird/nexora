import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PortalShell";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, MapPin, Users, Clock, Wallet, ArrowUpRight } from "lucide-react";

// Per-site detail page. Shows the totals across one site_ref + the per-sub
// breakdown so the principal can see who's done what on each project.

type Detail = Awaited<ReturnType<typeof api.getMyPrincipalSiteDetail>>;

function fmtMoney(minor: number) {
  return `\u20AC${(minor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(s: string | null) {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return s; }
}

export function PrincipalSiteDetail() {
  const { ref } = useParams<{ ref: string }>();
  const toast = useToast();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ref) return;
    (async () => {
      try {
        const r = await api.getMyPrincipalSiteDetail(decodeURIComponent(ref));
        setData(r);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [ref, toast]);

  if (loading) return <div className="skeleton h-64" />;
  if (!data) return <Empty icon={ArrowLeft} title="Not found" description="Site not found." />;

  const t = data.totals;
  return (
    <>
      <PageHeader
        title={data.siteRef}
        description={`${t.subCount} subcontractor${t.subCount === 1 ? "" : "s"} \u00b7 ${t.totalHours.toFixed(1)} hours \u00b7 ${t.sheetCount} timesheet${t.sheetCount === 1 ? "" : "s"}`}
      />
      <Link to="/primary/sites" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to sites
      </Link>

      <div className="grid sm:grid-cols-4 gap-3 mb-8">
        <div className="card-padded">
          <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1 inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> Subcontractors
          </div>
          <div className="text-2xl font-bold tabular-nums">{t.subCount}</div>
        </div>
        <div className="card-padded">
          <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1 inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Hours
          </div>
          <div className="text-2xl font-bold tabular-nums">{t.totalHours.toFixed(1)}</div>
        </div>
        <div className="card-padded">
          <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1 inline-flex items-center gap-1">
            <Wallet className="h-3.5 w-3.5" /> Gross
          </div>
          <div className="text-2xl font-bold tabular-nums">{fmtMoney(t.totalGrossMinor)}</div>
        </div>
        <div className="card-padded bg-emerald-50">
          <div className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold mb-1">Paid net</div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">{fmtMoney(t.paidNetMinor)}</div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-ink-900 mb-3 inline-flex items-center gap-2">
        <MapPin className="h-5 w-5 text-ink-500" /> Subcontractors on this site
      </h2>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 border-b border-ink-100">
            <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3 text-right">Hours</th>
              <th className="px-5 py-3 text-right">Sheets</th>
              <th className="px-5 py-3">First → Last</th>
              <th className="px-5 py-3 text-right">Gross</th>
              <th className="px-5 py-3 text-right">Paid net</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.subs.map((s) => (
              <tr key={s.subcontractorId} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                <td className="px-5 py-3">
                  <div className="font-medium text-ink-900">{s.fullName || "-"}</div>
                  {s.email && <div className="text-xs text-ink-500 mt-0.5">{s.email}</div>}
                </td>
                <td className="px-5 py-3 text-right tabular-nums font-medium">{s.totalHours.toFixed(1)}</td>
                <td className="px-5 py-3 text-right tabular-nums">{s.sheetCount}</td>
                <td className="px-5 py-3 text-ink-600 text-xs">
                  {fmtDate(s.firstDate)} → {fmtDate(s.lastDate)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">{fmtMoney(s.totalGrossMinor)}</td>
                <td className="px-5 py-3 text-right tabular-nums font-medium text-emerald-700">{fmtMoney(s.paidNetMinor)}</td>
                <td className="px-5 py-3 text-right">
                  <Link
                    to={`/primary/subcontractors/${s.subcontractorId}`}
                    className="btn-ghost !py-1.5 inline-flex text-xs"
                  >
                    Open <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
