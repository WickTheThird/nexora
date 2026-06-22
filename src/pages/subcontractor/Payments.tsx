import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError, brandName } from "@/lib/api";
import type { PaymentRecord, Subcontractor } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PortalShell";
import { IncomeSummary } from "@/components/payments/IncomeSummary";
import { FilterBar, presetToRange, type DatePreset } from "@/components/ui/FilterBar";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Download, Wallet, FileText, CheckCircle2, FileBarChart, Folder, ArrowLeft } from "lucide-react";

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
  const { t } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState<PaymentRecord[]>([]);
  const [sub, setSub] = useState<Subcontractor | null>(null);
  // BC company info (Fintrex) fetched from /public/branding so the
  // sub's invoice "BILL TO" block shows the real contracting party
  // (BC) instead of the placeholder "[Principal]". Under RCT
  // reverse-charge, the sub invoices BC, not the developer.
  const [bcBranding, setBcBranding] = useState<{
    contractorName: string;
    contractorAddress: string | null;
    contractorVat: string | null;
    contractorEmail: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // ----- Filter state -----
  // Status pill: "all" | "advised" | "invoiced" | "paid".
  // Server returns legacy "processed" which we treat as advised.
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortMode, setSortMode] = useState<string>("date_desc");
  // Year-folder browse state. null = show the folders view; number =
  // drill into that year's advices. Declared up here so the `visible`
  // useMemo below can include it in its deps list without TDZ.
  const [folderYear, setFolderYear] = useState<number | null>(null);

  const refresh = async () => {
    const [allPayments, p, branding] = await Promise.all([
      loadAll(),
      api.getMyProfile(),
      // Public branding endpoint - no auth required; returns BC's
      // company info (name, address, VAT) for the invoice header.
      fetch(`${(window as { __SAMWISE_CONFIG__?: { apiUrl?: string } }).__SAMWISE_CONFIG__?.apiUrl || "https://nexora-api.bumbufilip22.workers.dev"}/public/branding`)
        .then((r) => r.json())
        .then((j) => j?.data || j)
        .catch(() => null),
    ]);
    setItems(allPayments);
    setSub(p.subcontractor);
    setBcBranding(branding);
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
      // info is empty here - the PDF still renders correctly with sub as the
      // FROM party and a clear "Principal" placeholder when Settings haven't
      // been mirrored. For a full template, the admin sends the advice; the
      // sub PDF is mainly a record/copy.
      downloadInvoicePdf(
        {
          issuedAt: new Date(p.invoicedAt || p.createdAt).toISOString(),
          period: { from: p.periodStart || p.paymentDate, to: p.periodEnd || p.paymentDate },
          invoiceNumber: p.invoiceNumber || p.id,
          // BILL TO = BC (Fintrex) under RCT reverse-charge. The
          // developer-principal is not the recipient of this
          // invoice; that's a separate BC->developer invoice.
          principal: {
            name: bcBranding?.contractorName || "Fintrex Contractors Ltd",
            address: bcBranding?.contractorAddress || null,
            vat: bcBranding?.contractorVat || null,
            email: bcBranding?.contractorEmail || null,
          },
          subcontractor: sub,
          // Bank details deliberately omitted: this is a fiscal
          // document, the sub is a service provider invoicing BC
          // and shouldn't expose their bank info on the invoice
          // PDF. BC already has the bank details from sub's profile.
          bank: null,
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
        // Sub side legally cannot issue invoices under RCT reverse-
        // charge - we send them "Payment Advice" documents instead.
        // The "advice" mode (default) renders the doc with that
        // title + the Subcontractor Payment Advice layout.
        "advice",
      );
      toast.success("Payment advice downloaded");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setBusyId(null);
    }
  };

  // Pre-compute counts for each status pill so the badges show numbers
  // even before the user filters.
  const counts = useMemo(() => {
    const c = { all: items.length, advised: 0, invoiced: 0, paid: 0 };
    for (const p of items) {
      if (p.status === "advised" || p.status === "processed") c.advised++;
      else if (p.status === "invoiced") c.invoiced++;
      else if (p.status === "paid") c.paid++;
    }
    return c;
  }, [items]);

  // Filter + sort the payment list. All client-side - the server already
  // returns the sub's complete payment list.
  const visible = useMemo(() => {
    const { from, to } = presetToRange(datePreset, dateFrom, dateTo);
    const fromTs = from ? new Date(`${from}T00:00:00Z`).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59Z`).getTime() : null;
    const q = search.trim().toLowerCase();

    const filtered = items.filter((p) => {
      // Year folder filter: only show payments from the drilled-in year
      if (folderYear !== null) {
        const d = p.paymentDate ? new Date(p.paymentDate) : null;
        if (!d || Number.isNaN(d.getTime())) return false;
        if (d.getFullYear() !== folderYear) return false;
      }
      // Status pill
      if (statusFilter === "advised" && !(p.status === "advised" || p.status === "processed")) return false;
      if (statusFilter === "invoiced" && p.status !== "invoiced") return false;
      if (statusFilter === "paid" && p.status !== "paid") return false;
      // Date range
      if (fromTs !== null || toTs !== null) {
        const t = p.paymentDate ? new Date(p.paymentDate).getTime() : NaN;
        if (!Number.isFinite(t)) return false;
        if (fromTs !== null && t < fromTs) return false;
        if (toTs !== null && t > toTs) return false;
      }
      // Free-text: invoice number, RCT auth number, reference, site ref
      if (q) {
        const hay = [
          p.invoiceNumber, p.rctAuthNumber, p.reference, p.siteRef,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sortMode === "date_asc") return (a.paymentDate || "").localeCompare(b.paymentDate || "");
      if (sortMode === "amount_desc") return (b.netMinor || 0) - (a.netMinor || 0);
      if (sortMode === "amount_asc") return (a.netMinor || 0) - (b.netMinor || 0);
      // default: date_desc
      return (b.paymentDate || "").localeCompare(a.paymentDate || "");
    });
    return filtered;
  }, [items, statusFilter, search, datePreset, dateFrom, dateTo, sortMode, folderYear]);

  // Year-end Form 11 helper. Years derived from the dates we actually have
  // payment records for (descending), so the dropdown only ever shows years
  // that will produce a non-empty PDF.
  const taxYears = Array.from(new Set(
    items.map(p => (p.paymentDate ? new Date(p.paymentDate).getUTCFullYear() : null)).filter((y): y is number => !!y)
  )).sort((a, b) => b - a);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  useEffect(() => { if (selectedYear == null && taxYears.length) setSelectedYear(taxYears[0]); }, [taxYears, selectedYear]);

  // Group payments by calendar year for the "Available Folders" view.
  const paymentsByYear: Array<{ year: number; count: number }> = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of items) {
      const d = p.paymentDate ? new Date(p.paymentDate) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      const y = d.getFullYear();
      m.set(y, (m.get(y) || 0) + 1);
    }
    return Array.from(m.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year - a.year);
  }, [items]);

  const downloadRctSummary = async () => {
    if (!selectedYear) { toast.error("Pick a tax year first"); return; }
    if (!sub) { toast.error("Profile still loading. Try again in a second."); return; }
    try {
      const { downloadRctSummaryPdf } = await loadPdf();
      downloadRctSummaryPdf({
        taxYear: selectedYear,
        brandName: brandName(),
        subcontractor: {
          fullName: sub.fullName,
          email: sub.email,
          subcontractorRef: sub.subcontractorRef,
          // PPSN not exposed via /me/profile yet - left null. The summary
          // is still valid; the sub fills it in by hand on Form 11 anyway.
          ppsn: null,
          rctRate: sub.rctRate,
        },
        payments: items,
        generatedAt: new Date().toLocaleDateString("en-IE"),
      });
      toast.success(`RCT summary for ${selectedYear} downloaded`);
    } catch (e) {
      // Surface the actual error rather than swallowing it - the prior
      // generic toast hid the underlying jsPDF / autotable failure.
      console.error("[RCT summary]", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`RCT summary failed: ${msg.slice(0, 120)}`);
    }
  };

  return (
    <>
      <PageHeader
        title={t("payments.title")}
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

          {/* Year-folder view (default). Mirrors Enagh's "Available
              Folders" pattern: one row per calendar year, file count on
              the right, "View Files" drills in. */}
          {folderYear === null && paymentsByYear.length > 0 && (
            <div className="mt-8">
              <div className="card overflow-hidden">
                <div className="bg-ink-50 px-5 py-3 border-b border-ink-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-ink-700">Available Folders</h2>
                  <span className="text-xs bg-ink-200 text-ink-700 px-2 py-0.5 rounded font-medium">
                    {paymentsByYear.length}
                  </span>
                </div>
                <table className="w-full">
                  <thead className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                    <tr>
                      <th className="px-5 py-3">Folder</th>
                      <th className="px-5 py-3 text-right">Files</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentsByYear.map((row) => (
                      <tr key={row.year} className="border-t border-ink-100 hover:bg-ink-50/50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Button variant="outline" size="sm" onClick={() => setFolderYear(row.year)}>
                              View Files
                            </Button>
                            <Folder className="h-4 w-4 text-amber-500" />
                            <span className="font-medium text-ink-900">{row.year}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-ink-700">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Drill-in view: existing filtered list, scoped to the
              selected year. */}
          <div className="mt-8" hidden={folderYear === null && paymentsByYear.length > 0}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ink-900">
                {folderYear !== null ? `${folderYear} Pay Advice` : "History"}
              </h2>
              {folderYear !== null && (
                <Button variant="ghost" size="sm" onClick={() => setFolderYear(null)} leftIcon={<ArrowLeft className="h-4 w-4" />}>
                  Back to folders
                </Button>
              )}
            </div>
            {items.length === 0 ? (
              <Empty
                icon={Wallet}
                title="No payment advices yet"
                description="When the principal proposes a payment for your approved hours, it will appear here for you to invoice."
              />
            ) : (
              <>
              <FilterBar
                pills={[
                  { value: "all",      label: "All",                 count: counts.all },
                  { value: "advised",  label: "Awaiting my invoice", count: counts.advised },
                  { value: "invoiced", label: "Invoiced",            count: counts.invoiced },
                  { value: "paid",     label: "Paid",                count: counts.paid },
                ]}
                activePill={statusFilter}
                onPillChange={setStatusFilter}
                searchValue={search}
                searchPlaceholder="Search invoice number, RCT auth, reference..."
                onSearchChange={setSearch}
                datePreset={datePreset}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateChange={(preset, from, to) => {
                  setDatePreset(preset);
                  if (preset === "custom") {
                    setDateFrom(from || "");
                    setDateTo(to || "");
                  }
                }}
                sortOptions={[
                  { value: "date_desc",   label: "Newest first" },
                  { value: "date_asc",    label: "Oldest first" },
                  { value: "amount_desc", label: "Highest amount" },
                  { value: "amount_asc",  label: "Lowest amount" },
                ]}
                sortValue={sortMode}
                onSortChange={setSortMode}
              />
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
                              {p.invoiceNumber || <span className="text-ink-400">-</span>}
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
                                    Generate invoice
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
                {visible.length === 0 && (
                  <div className="p-6 text-center text-sm text-ink-500 border-t border-ink-100">
                    No payments match the current filter.
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
