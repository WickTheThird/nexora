import { useEffect, useState } from "react";
import { api, ApiError, brandName } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { InvoicePayload, PaymentRecord } from "@/lib/types";
import { Download, Mail, FileText, FileSpreadsheet, History } from "lucide-react";
import { exportRowsAsCsv } from "@/lib/csv";

// Lazy-load the PDF module so jsPDF + html2canvas (~700 KB) only enter the
// bundle when the user actually clicks Download — not on every page load.
const loadPdf = () => import("@/lib/pdf");

function fmtMoney(amountMinor: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

export function InvoiceModal({
  open,
  onClose,
  subId,
  defaultFrom,
  defaultTo,
}: {
  open: boolean;
  onClose: () => void;
  subId: string;
  defaultFrom: string;
  defaultTo: string;
}) {
  const toast = useToast();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [loading, setLoading] = useState(false);
  const [inv, setInv] = useState<InvoicePayload | null>(null);
  const [history, setHistory] = useState<{ from: string; to: string; payments: PaymentRecord[] }[]>([]);

  // Load past invoiced periods (distinct period_start/period_end on payments)
  // when the modal opens, so the "History" section can offer one-click access.
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const r = await api.adminListSubPayments(subId);
        const buckets = new Map<string, { from: string; to: string; payments: PaymentRecord[] }>();
        for (const p of r.items) {
          if (!p.periodStart || !p.periodEnd) continue;
          const key = `${p.periodStart}__${p.periodEnd}`;
          const cur = buckets.get(key);
          if (cur) cur.payments.push(p);
          else buckets.set(key, { from: p.periodStart, to: p.periodEnd, payments: [p] });
        }
        setHistory(
          [...buckets.values()].sort((a, b) => b.from.localeCompare(a.from)).slice(0, 10),
        );
      } catch { /* non-fatal */ }
    })();
  }, [open, subId]);

  const preview = async () => {
    setLoading(true);
    try {
      const data = await api.adminGetInvoice(subId, from, to);
      setInv(data);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to fetch invoice");
    } finally {
      setLoading(false);
    }
  };

  const usePreset = (preset: "thisMonth" | "lastMonth" | "thisYear") => {
    const now = new Date();
    let f: Date, t: Date;
    if (preset === "thisMonth") {
      f = new Date(now.getFullYear(), now.getMonth(), 1);
      t = now;
    } else if (preset === "lastMonth") {
      f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      t = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
      f = new Date(now.getFullYear(), 0, 1);
      t = now;
    }
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setFrom(iso(f));
    setTo(iso(t));
    setInv(null);
  };

  const useHistoryPeriod = (h: { from: string; to: string }) => {
    setFrom(h.from);
    setTo(h.to);
    setInv(null);
  };

  const downloadCsv = () => {
    if (!inv) return;
    exportRowsAsCsv(
      `invoice_${inv.invoiceNumber}.csv`,
      inv.lines,
      [
        { header: "Date",         value: (p) => p.paymentDate },
        { header: "Period start", value: (p) => p.periodStart ?? "" },
        { header: "Period end",   value: (p) => p.periodEnd ?? "" },
        { header: "Hours",        value: (p) => p.hours ?? "" },
        { header: "Site",         value: (p) => p.siteRef ?? "" },
        { header: "Reference",    value: (p) => p.reference ?? "" },
        { header: "Currency",     value: (p) => p.currency },
        { header: "Gross (minor)", value: (p) => p.grossMinor },
        { header: "RCT rate",     value: (p) => p.rctRate ?? "" },
        { header: "RCT (minor)",  value: (p) => p.rctDeductionMinor },
        { header: "Net (minor)",  value: (p) => p.netMinor },
        { header: "Status",       value: (p) => p.status },
      ],
    );
  };

  const download = async () => {
    if (!inv) return;
    try {
      const { downloadInvoicePdf } = await loadPdf();
      downloadInvoicePdf(inv, brandName());
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error("Failed to generate PDF");
    }
  };

  const sendToAccountant = async () => {
    if (!inv) return;
    if (!inv.accountantEmail) {
      toast.error("No accountant email set. Configure it in Settings.");
      return;
    }
    const { downloadInvoicePdf, invoiceMailto } = await loadPdf();
    // 1. Trigger PDF download so the user can attach it.
    downloadInvoicePdf(inv, brandName());
    // 2. Open mail draft pre-addressed to accountant with a body summary.
    window.location.href = invoiceMailto(inv, brandName());
  };

  const close = () => {
    setInv(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      width="xl"
      title="Generate invoice"
      description="Self-billing invoice for any date range. Pulls all payments in the period and renders a downloadable PDF."
      footer={
        <>
          <Button variant="ghost" onClick={close}>Close</Button>
          {inv && (
            <>
              <Button
                variant="outline"
                onClick={downloadCsv}
                leftIcon={<FileSpreadsheet className="h-4 w-4" />}
                disabled={inv.lines.length === 0}
              >
                CSV
              </Button>
              <Button
                variant="outline"
                onClick={sendToAccountant}
                leftIcon={<Mail className="h-4 w-4" />}
                disabled={!inv.accountantEmail}
                title={inv.accountantEmail ? `Open mail draft to ${inv.accountantEmail}` : "No accountant email set"}
              >
                Send to accountant
              </Button>
              <Button variant="accent" onClick={download} leftIcon={<Download className="h-4 w-4" />}>
                Download PDF
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-ink-500 font-semibold mr-1">Quick:</span>
          <Button variant="ghost" size="sm" onClick={() => usePreset("thisMonth")}>This month</Button>
          <Button variant="ghost" size="sm" onClick={() => usePreset("lastMonth")}>Last month</Button>
          <Button variant="ghost" size="sm" onClick={() => usePreset("thisYear")}>This year</Button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <div className="flex items-end">
            <Button variant="primary" className="w-full" loading={loading} onClick={preview} leftIcon={<FileText className="h-4 w-4" />}>
              Preview
            </Button>
          </div>
        </div>

        {!inv && history.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wider text-ink-500 font-semibold">
              <History className="h-3.5 w-3.5" /> Recent invoiced periods
            </div>
            <div className="card divide-y divide-ink-100">
              {history.map((h) => {
                const totalGross = h.payments.reduce((s, p) => s + p.grossMinor, 0);
                const totalNet   = h.payments.reduce((s, p) => s + p.netMinor, 0);
                const currency = h.payments[0]?.currency || "EUR";
                return (
                  <button
                    key={`${h.from}__${h.to}`}
                    type="button"
                    onClick={() => useHistoryPeriod(h)}
                    className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 hover:bg-ink-50/50 transition"
                  >
                    <div>
                      <div className="text-sm font-medium text-ink-900">{h.from} → {h.to}</div>
                      <div className="text-xs text-ink-500">{h.payments.length} payment{h.payments.length === 1 ? "" : "s"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-ink-900 tabular-nums">{fmtMoney(totalGross, currency)} gross</div>
                      <div className="text-xs text-ink-500 tabular-nums">{fmtMoney(totalNet, currency)} net</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {inv && (
          <div className="space-y-4">
            <div className="card-padded bg-ink-50/50">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold">Invoice number</div>
                  <div className="text-lg font-bold text-ink-900 tabular-nums">{inv.invoiceNumber}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold">Period</div>
                  <div className="text-sm text-ink-800">
                    {inv.period.from} → {inv.period.to}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold">RCT</div>
                  <div className="text-sm text-ink-800">
                    {inv.subcontractor.rctRate ? `${inv.subcontractor.rctRate}%` : "N/A"}
                    {inv.subcontractor.vatReverseCharge ? " · VAT RC" : ""}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold">Lines</div>
                  <div className="text-sm text-ink-800">{inv.lines.length}</div>
                </div>
              </div>
            </div>

            {!inv.principal.name && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                Principal company details are not set. The PDF will show a placeholder. Configure under Settings → Principal information.
              </div>
            )}
            {!inv.accountantEmail && (
              <div className="rounded-lg bg-ink-50 border border-ink-200 p-3 text-sm text-ink-700">
                No accountant email set. The "Send to accountant" button is disabled. Configure under Settings.
              </div>
            )}

            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 border-b border-ink-100">
                  <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Hours</th>
                    <th className="px-4 py-2">Reference</th>
                    <th className="px-4 py-2 text-right">Gross</th>
                    <th className="px-4 py-2 text-right">RCT</th>
                    <th className="px-4 py-2 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lines.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-4 text-center text-ink-500">No payments in this period.</td></tr>
                  ) : inv.lines.map((p) => (
                    <tr key={p.id} className="border-b border-ink-100 last:border-b-0">
                      <td className="px-4 py-2">{p.paymentDate}</td>
                      <td className="px-4 py-2 tabular-nums">{p.hours != null ? p.hours.toFixed(2) : "—"}</td>
                      <td className="px-4 py-2 text-ink-600">{p.reference || "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(p.grossMinor, p.currency)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-red-700">
                        {p.rctRate ? `-${fmtMoney(p.rctDeductionMinor, p.currency)}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-bold">{fmtMoney(p.netMinor, p.currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {Object.entries(inv.totalsByCurrency).map(([c, t]) => (
                    <tr key={c} className="bg-ink-50 font-semibold">
                      <td className="px-4 py-2" colSpan={2}>{t.count} payments · {t.hours.toFixed(2)}h</td>
                      <td className="px-4 py-2 text-right">Totals</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(t.gross, c)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-red-700">-{fmtMoney(t.rct, c)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(t.net, c)}</td>
                    </tr>
                  ))}
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
