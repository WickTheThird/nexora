import { useEffect, useState } from "react";
import { api, ApiError, brandName } from "@/lib/api";
import type { PaymentRecord, Subcontractor, BankDetails } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PortalShell";
import { IncomeSummary } from "@/components/payments/IncomeSummary";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Download, Wallet, ChevronDown, FileText, CheckCircle2, FileBarChart } from "lucide-react";

// Lazy-load PDF code (jsPDF + html2canvas) only when the user clicks Download.
const loadPdf = () => import("@/lib/pdf");

function statusBadge(s: PaymentRecord["status"]) {
  // Map server-side states to UI tone + label.
  // Legacy 'processed' is treated as 'advised' on the server (see paymentToJson),
  // but we still surface it just in case.
  const cfg: Record<string, { tone: "neutral" | "info" | "success" | "danger" | "warn"; label: string }> = {
    advised:   { tone: "warn", label: "Awaiting your invoice" },
    invoiced:  { tone: "info",    label: "Invoiced" },
    paid:      { tone: "success", label: "Paid" },
    cancelled: { tone: "danger",  label: "Cancelled" },
    processed: { tone: "warn", label: "Awaiting your invoice" },
    pending:   { tone: "neutral", label: "Pending" },
    reversed:  { tone: "danger",  label: "Reversed" },
  };
  const c = cfg[s] || { tone: "neutral", label: s };
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

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
  const toast = useToast();
  const [items, setItems] = useState<PaymentRecord[]>([]);
  const [sub, setSub] = useState<Subcontractor | null>(null);
  const [bank, setBank] = useState<BankDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(25);

  const refresh = async () => {
    const [allPayments, p] = await Promise.all([
      loadAll(),
      api.getMyProfile(),
    ]);
    setItems(allPayments);
    setSub(p.subcontractor);
    setBank(p.bank);
  };

  useEffect(() => {
    (async () => {
      try { await refresh(); } finally { setLoading(false); }
    })();
  }, []);

  // Sub clicks "Generate invoice" on an advised payment: server assigns the
  // sub's invoice number (INV-{REF}-YYYY-NNN) and flips status to 'invoiced'.
  // We then refresh so the row shows "Download invoice" instead.
  const generateInvoice = async (p: PaymentRecord) => {
    setBusyId(p.id);
    try {
      const updated = await api.generateMyInvoice(p.id);
      toast.success(`Invoice ${updated.invoiceNumber} generated`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to generate invoice");
    } finally {
      setBusyId(null);
    }
  };

  // Build a single-payment InvoicePayload-like object on the fly so we can
  // reuse the dual-mode PDF generator without a server roundtrip. The data
  // shapes match what the worker would have returned for a 1-payment invoice.
  const downloadInvoice = async (p: PaymentRecord) => {
    if (!sub) return;
    setBusyId(p.id);
    try {
      const { downloadInvoicePdf } = await loadPdf();
      // We don't have AppSettings exposed to subcontractors, so principal
      // info is empty here — the PDF still renders correctly with sub as the
      // FROM party and a clear "Principal" placeholder when Settings haven't
      // been mirrored. For a full template, the admin sends the advice; the
      // sub PDF is mainly a record/copy.
      downloadInvoicePdf(
        {
          issuedAt: new Date(p.invoicedAt || p.createdAt).toISOString(),
          period: { from: p.periodStart || p.paymentDate, to: p.periodEnd || p.paymentDate },
          invoiceNumber: p.invoiceNumber || p.id,
          principal: { name: null, address: null, vat: null, email: null },
          subcontractor: sub,
          bank: bank,
          lines: [p],
          totals: {
            gross: p.grossMinor, rct: p.rctDeductionMinor, net: p.netMinor,
            hours: p.hours ?? 0, count: 1, currency: p.currency,
          },
          totalsByCurrency: {
            [p.currency]: {
              gross: p.grossMinor, rct: p.rctDeductionMinor, net: p.netMinor,
              hours: p.hours ?? 0, count: 1,
            },
          },
          rct: { byRate: p.rctRate ? [{ rate: p.rctRate, gross: p.grossMinor, deduction: p.rctDeductionMinor, count: 1 }] : [] },
          vat: {
            subcontractorVatRegistered: !!sub.vatRegistered,
            subcontractorVatNumber: sub.vatNumber || null,
            principalVatNumber: null,
            reverseChargeApplied: !!p.vatReverseCharge,
            reverseChargePaymentCount: p.vatReverseCharge ? 1 : 0,
            note: p.vatReverseCharge ? "VAT reverse charge applied." : null,
          },
          accountantEmail: sub.accountantEmail,
        },
        brandName(),
        "invoice",
      );
      toast.success("Invoice PDF downloaded");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setBusyId(null);
    }
  };

  const visible = items.slice(0, visibleCount);

  // Year-end Form 11 helper. Years derived from the dates we actually have
  // payment records for (descending), so the dropdown only ever shows years
  // that will produce a non-empty PDF.
  const taxYears = Array.from(new Set(
    items.map(p => (p.paymentDate ? new Date(p.paymentDate).getUTCFullYear() : null)).filter((y): y is number => !!y)
  )).sort((a, b) => b - a);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  useEffect(() => { if (selectedYear == null && taxYears.length) setSelectedYear(taxYears[0]); }, [taxYears, selectedYear]);

  const downloadRctSummary = async () => {
    if (!selectedYear || !sub) return;
    try {
      const { downloadRctSummaryPdf } = await loadPdf();
      downloadRctSummaryPdf({
        taxYear: selectedYear,
        brandName: brandName(),
        subcontractor: {
          fullName: sub.fullName,
          email: sub.email,
          subcontractorRef: sub.subcontractorRef,
          // PPSN not exposed via /me/profile yet — left null. The summary
          // is still valid; the sub fills it in by hand on Form 11 anyway.
          ppsn: null,
          rctRate: sub.rctRate,
        },
        payments: items,
        generatedAt: new Date().toLocaleDateString("en-IE"),
      });
      toast.success(`RCT summary for ${selectedYear} downloaded`);
    } catch (e) {
      toast.error("Failed to generate summary");
    }
  };

  return (
    <>
      <PageHeader
        title="Payments & Income"
        description="Payment advices from the principal appear here. Click ‘Generate invoice’ to issue your own invoice for any advice — that is the legal document."
        right={taxYears.length > 0 ? (
          <div className="flex items-center gap-2">
            <select
              className="text-sm rounded-md border border-ink-200 px-2 py-1.5 bg-white focus:border-ink-900 outline-none"
              value={selectedYear ?? ""}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              title="Tax year for the RCT summary"
            >
              {taxYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={downloadRctSummary} leftIcon={<FileBarChart className="h-4 w-4" />}>
              RCT summary (Form 11)
            </Button>
          </div>
        ) : undefined}
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
                title="No payment advices yet"
                description="When the principal proposes a payment for your approved hours, it will appear here for you to invoice."
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
                        <th className="px-5 py-3">Invoice #</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Gross</th>
                        <th className="px-5 py-3 text-right">RCT</th>
                        <th className="px-5 py-3 text-right">Net</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((p) => {
                        const isAdvised = p.status === "advised" || p.status === "processed";
                        const isInvoiced = p.status === "invoiced" || p.status === "paid";
                        return (
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
                            <td className="px-5 py-4 text-sm text-ink-700 tabular-nums">
                              {p.invoiceNumber || <span className="text-ink-400">—</span>}
                              {p.vatReverseCharge && (
                                <Badge tone="info">VAT RC</Badge>
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
                              {isAdvised && (
                                <Button
                                  variant="accent"
                                  size="sm"
                                  loading={busyId === p.id}
                                  onClick={() => generateInvoice(p)}
                                  leftIcon={<FileText className="h-4 w-4" />}
                                >
                                  Generate invoice
                                </Button>
                              )}
                              {isInvoiced && (
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    loading={busyId === p.id}
                                    onClick={() => downloadInvoice(p)}
                                    leftIcon={<Download className="h-4 w-4" />}
                                  >
                                    Invoice PDF
                                  </Button>
                                  {p.hasRemittance && (
                                    <a
                                      href={api.downloadMyRemittanceUrl(p.id)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn-ghost !py-1.5 inline-flex text-xs"
                                      title="Remittance"
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </a>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
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
