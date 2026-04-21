import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PaymentRecord, Subcontractor } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { PageHeader } from "@/components/layout/PortalShell";
import { IncomeSummary } from "@/components/payments/IncomeSummary";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Download, Wallet, ChevronDown } from "lucide-react";

function statusBadge(s: PaymentRecord["status"]) {
  const tone = {
    pending: "neutral",
    processed: "info",
    paid: "success",
    reversed: "danger",
  }[s] as "neutral" | "info" | "success" | "danger";
  return <Badge tone={tone}>{s}</Badge>;
}

// Fetch all pages of /me/payments so income stats reflect everything, not just the first page.
async function loadAll(): Promise<PaymentRecord[]> {
  const out: PaymentRecord[] = [];
  let cursor: string | undefined = undefined;
  for (let safety = 0; safety < 50; safety++) {
    const r = await api.listMyPayments(cursor);
    out.push(...r.items);
    if (!r.nextCursor) break;
    cursor = r.nextCursor;
  }
  return out;
}

export function Payments() {
  const [items, setItems] = useState<PaymentRecord[]>([]);
  const [sub, setSub] = useState<Subcontractor | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(25);

  useEffect(() => {
    (async () => {
      try {
        const [allPayments, p] = await Promise.all([
          loadAll(),
          api.getMyProfile(),
        ]);
        setItems(allPayments);
        setSub(p.subcontractor);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visible = items.slice(0, visibleCount);

  return (
    <>
      <PageHeader
        title="Payments & Income"
        description="Your earnings at a glance, with a full history of recorded payments."
      />

      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-32" />
          <div className="skeleton h-64" />
        </div>
      ) : (
        <>
          <IncomeSummary
            items={items}
            rateAmountMinor={sub?.rateAmountMinor ?? null}
            rateUnit={sub?.rateUnit ?? null}
          />

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-ink-900 mb-4">History</h2>
            {items.length === 0 ? (
              <Empty
                icon={Wallet}
                title="No payments yet"
                description="Payment records from administrators will appear here."
              />
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-ink-50 border-b border-ink-100">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Period</th>
                        <th className="px-5 py-3">Hours</th>
                        <th className="px-5 py-3">Reference</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Gross</th>
                        <th className="px-5 py-3 text-right">RCT</th>
                        <th className="px-5 py-3 text-right">Net</th>
                        <th className="px-5 py-3 text-right">Remittance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((p) => (
                        <tr key={p.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                          <td className="px-5 py-4 text-sm text-ink-900 font-medium">{fmtDate(p.paymentDate)}</td>
                          <td className="px-5 py-4 text-sm text-ink-600">
                            {p.periodStart && p.periodEnd ? (
                              <span>{fmtDate(p.periodStart)} → {fmtDate(p.periodEnd)}</span>
                            ) : (
                              <span className="text-ink-400">·</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-sm text-ink-700 tabular-nums">
                            {p.hours != null ? p.hours.toLocaleString(undefined, { maximumFractionDigits: 2 }) : <span className="text-ink-400">·</span>}
                          </td>
                          <td className="px-5 py-4 text-sm text-ink-600">
                            {p.reference || "·"}
                            {p.vatReverseCharge && (
                              <Badge tone="info" >VAT RC</Badge>
                            )}
                          </td>
                          <td className="px-5 py-4">{statusBadge(p.status)}</td>
                          <td className="px-5 py-4 text-sm text-ink-900 text-right font-medium tabular-nums">
                            {fmtMoney(p.grossMinor, p.currency)}
                          </td>
                          <td className="px-5 py-4 text-sm text-right tabular-nums">
                            {p.rctRate ? (
                              <span className="text-red-700">
                                -{fmtMoney(p.rctDeductionMinor, p.currency)}
                                <span className="block text-[10px] text-ink-500">@ {p.rctRate}%{p.rctAuthNumber ? ` · ${p.rctAuthNumber}` : ""}</span>
                              </span>
                            ) : (
                              <span className="text-ink-400">·</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-sm text-ink-900 text-right font-bold tabular-nums">
                            {fmtMoney(p.netMinor, p.currency)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {p.hasRemittance ? (
                              <a
                                href={api.downloadMyRemittanceUrl(p.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-ghost !py-1.5 inline-flex"
                              >
                                <Download className="h-4 w-4" /> PDF
                              </a>
                            ) : (
                              <span className="text-xs text-ink-400">·</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {items.length > visibleCount && (
                  <div className="p-4 border-t border-ink-100 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setVisibleCount((n) => n + 25)}
                      leftIcon={<ChevronDown className="h-4 w-4" />}
                    >
                      Show more ({items.length - visibleCount} remaining)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
