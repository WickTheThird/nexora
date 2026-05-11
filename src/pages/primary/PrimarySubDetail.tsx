import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, FileText } from "lucide-react";

// Read-only sub detail for a primary user. Shows the sub's profile basics,
// timesheets and payment activity. No PII like PPS or bank.
type Detail = Awaited<ReturnType<typeof api.getMyPrimarySubDetail>>;

function fmtMoney(minor: number) {
  return `\u20AC${(minor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PrimarySubDetail() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const r = await api.getMyPrimarySubDetail(id);
        setData(r);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, toast]);

  if (loading) return <div className="skeleton h-64" />;
  if (!data) return <Empty icon={ArrowLeft} title="Not found" description="This subcontractor isn't on your contract." />;

  const sub = data.subcontractor;

  return (
    <>
      <PageHeader title={sub.fullName || "Subcontractor"} description={sub.natureOfServices || ""} />
      <Link to="/primary/subcontractors" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to subcontractors
      </Link>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="card-padded">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Status</div>
          <Badge tone="info">{sub.onboardingStatus.replace(/_/g, " ")}</Badge>
        </div>
        <div className="card-padded">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">RCT rate</div>
          <div className="text-lg font-bold text-ink-900">{sub.rctRate ? `${sub.rctRate}%` : "-"}</div>
        </div>
        <div className="card-padded">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">VAT</div>
          <div className="text-sm">{sub.vatReverseCharge ? "Reverse charge" : "Standard"}</div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-ink-900 mb-3">Recent payments</h2>
      {data.payments.length === 0 ? (
        <Empty icon={FileText} title="No payments yet" description="Once BC pays this subcontractor for work on your contract, it'll appear here." />
      ) : (
        <div className="card overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Period</th>
                <th className="px-5 py-3">Hours</th>
                <th className="px-5 py-3">Invoice #</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Gross</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p: Record<string, unknown>) => (
                <tr key={String(p.id)} className="border-b border-ink-100 last:border-b-0">
                  <td className="px-5 py-3 text-ink-900">{String(p.payment_date)}</td>
                  <td className="px-5 py-3 text-ink-600">
                    {p.period_start && p.period_end ? `${p.period_start} → ${p.period_end}` : <span className="text-ink-400">-</span>}
                  </td>
                  <td className="px-5 py-3 text-ink-700 tabular-nums">{p.hours != null ? String(p.hours) : <span className="text-ink-400">-</span>}</td>
                  <td className="px-5 py-3 text-ink-700 font-mono text-xs">{p.invoice_number ? String(p.invoice_number) : <span className="text-ink-400">-</span>}</td>
                  <td className="px-5 py-3"><Badge tone={p.status === "paid" ? "success" : p.status === "invoiced" ? "info" : "warn"}>{String(p.status)}</Badge></td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">{fmtMoney(Number(p.amount_minor) || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="text-lg font-semibold text-ink-900 mb-3">Recent timesheets</h2>
      {data.timesheets.length === 0 ? (
        <Empty icon={FileText} title="No timesheets" description="No hours logged yet under your contract." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Hours</th>
                <th className="px-5 py-3">Site</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.timesheets.map((t: Record<string, unknown>) => (
                <tr key={String(t.id)} className="border-b border-ink-100 last:border-b-0">
                  <td className="px-5 py-3 text-ink-900">{String(t.work_date)}</td>
                  <td className="px-5 py-3 text-ink-700 tabular-nums">{t.hours != null ? String(t.hours) : <span className="text-ink-400">-</span>}</td>
                  <td className="px-5 py-3 text-ink-600">{t.site_ref ? String(t.site_ref) : <span className="text-ink-400">-</span>}</td>
                  <td className="px-5 py-3"><Badge tone={t.status === "approved" || t.status === "paid" ? "success" : "info"}>{String(t.status)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
