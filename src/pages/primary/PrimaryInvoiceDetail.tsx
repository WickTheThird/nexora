import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, brandName } from "@/lib/api";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, FileText, Download, Mail } from "lucide-react";

// Lazy-load the PDF module so jsPDF + html2canvas (~700 KB) only enter the
// bundle when the user actually clicks Download — not on every page load.
const loadPdf = () => import("@/lib/pdf");

type Detail = Awaited<ReturnType<typeof api.getMyPrimaryInvoice>>;

function fmtMoney(minor: number) {
  return `\u20AC${(minor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PrimaryInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const r = await api.getMyPrimaryInvoice(id);
        setData(r);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, toast]);

  // Build an InvoicePayload-shape object on the fly so the existing PDF
  // generator can render this primary invoice. We use mode='primaryInvoice'
  // (BC issuer → primary recipient) and aggregate sub line items.
  const buildInvoicePayload = () => {
    if (!data) return null;
    const inv = data.invoice;
    const lines = data.lines.map((l: Record<string, unknown>) => ({
      id: String(l.id),
      subcontractorId: "",
      paymentDate: String(l.payment_date),
      grossMinor: Number(l.amount_minor) || 0,
      rctRate: null,
      rctDeductionMinor: 0,
      netMinor: Number(l.amount_minor) || 0,
      rctAuthNumber: null,
      vatReverseCharge: false,
      amountMinor: Number(l.amount_minor) || 0,
      currency: inv.currency,
      reference: l.invoice_number ? String(l.invoice_number) : null,
      hasRemittance: false,
      status: "paid" as const,
      invoiceNumber: l.invoice_number ? String(l.invoice_number) : null,
      invoicedAt: null,
      hours: l.hours != null ? Number(l.hours) : null,
      periodStart: l.period_start ? String(l.period_start) : null,
      periodEnd: l.period_end ? String(l.period_end) : null,
      siteRef: null,
      primaryId: inv.primaryId,
      createdAt: 0,
      createdBy: null,
    }));
    return {
      issuedAt: new Date().toISOString(),
      period: { from: inv.periodStart, to: inv.periodEnd },
      invoiceNumber: inv.invoiceNumber,
      principal: { name: "BC Construction Ltd", address: null, vat: null, email: null },
      // We treat the primary as the "subcontractor" recipient slot since the
      // PDF generator is structured around two parties; mode='primaryInvoice'
      // makes the wording reflect "Bill To" rather than "Subcontractor".
      subcontractor: {
        id: data.primary.id,
        userId: "",
        clientRef: null,
        subcontractorRef: null,
        fullName: data.primary.name,
        address1: data.primary.address,
        address2: null,
        town: null,
        postcode: null,
        dob: null,
        placeOfBirth: null,
        tel: data.primary.phone,
        mob: null,
        email: data.primary.contactEmail,
        ppsNumber: null,
        natureOfServices: null,
        workType: null,
        vatRegistered: !!data.primary.vat,
        vatNumber: data.primary.vat,
        rateAmountMinor: null,
        rateUnit: null,
        rctRate: null,
        rctAuthorisationNumber: null,
        vatReverseCharge: false,
        onboardingStatus: "approved" as const,
        submittedAt: null,
        accountantEmail: data.primary.accountantEmail,
        primaryId: null,
        anonymisedAt: null,
        createdAt: 0,
        updatedAt: 0,
      },
      bank: null,
      lines,
      totals: {
        gross: inv.grossMinor, rct: 0, net: inv.netMinor,
        hours: 0, count: lines.length, currency: inv.currency,
      },
      totalsByCurrency: {
        [inv.currency]: { gross: inv.grossMinor, rct: 0, net: inv.netMinor, hours: 0, count: lines.length },
      },
      rct: { byRate: [] },
      vat: {
        subcontractorVatRegistered: !!data.primary.vat,
        subcontractorVatNumber: data.primary.vat,
        principalVatNumber: null,
        reverseChargeApplied: false,
        reverseChargePaymentCount: 0,
        note: null,
      },
      accountantEmail: data.primary.accountantEmail,
    };
  };

  const downloadPdf = async () => {
    const payload = buildInvoicePayload();
    if (!payload) return;
    try {
      const { downloadInvoicePdf } = await loadPdf();
      // Reuse 'invoice' mode — sub→principal direction. Here the primary is
      // in the 'subcontractor' slot as the recipient, BC is the principal/issuer.
      downloadInvoicePdf(payload, brandName(), "invoice");
      toast.success("Invoice PDF downloaded");
    } catch {
      toast.error("Failed to generate PDF");
    }
  };

  const sendToAccountant = async () => {
    if (!data?.primary.accountantEmail) {
      toast.error("Set your accountant email on the dashboard first");
      return;
    }
    const payload = buildInvoicePayload();
    if (!payload) return;
    const { downloadInvoicePdf, invoiceMailto } = await loadPdf();
    downloadInvoicePdf(payload, brandName(), "invoice");
    window.location.href = invoiceMailto(payload, brandName(), "invoice");
  };

  if (loading) return <div className="skeleton h-64" />;
  if (!data) return <Empty icon={ArrowLeft} title="Not found" description="Invoice not found." />;

  const inv = data.invoice;
  const tone: "neutral" | "info" | "success" | "warn" =
    inv.status === "paid" ? "success" :
    inv.status === "sent" ? "info" :
    inv.status === "cancelled" ? "neutral" : "warn";

  return (
    <>
      <PageHeader
        title={`Invoice ${inv.invoiceNumber}`}
        description={`From BC Construction · ${inv.periodStart} → ${inv.periodEnd}`}
        right={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={sendToAccountant}
              leftIcon={<Mail className="h-4 w-4" />}
              disabled={!data.primary.accountantEmail}
              title={data.primary.accountantEmail ? `Send to ${data.primary.accountantEmail}` : "Set accountant email on dashboard first"}
            >
              Send to my accountant
            </Button>
            <Button variant="accent" onClick={downloadPdf} leftIcon={<Download className="h-4 w-4" />}>
              Download PDF
            </Button>
          </div>
        }
      />
      <Link to="/primary/invoices" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="card-padded"><div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Status</div><Badge tone={tone}>{inv.status}</Badge></div>
        <div className="card-padded"><div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Issued</div><div className="text-lg">{inv.issuedAt}</div></div>
        <div className="card-padded"><div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Gross</div><div className="text-lg font-bold tabular-nums">{fmtMoney(inv.grossMinor)}</div></div>
        <div className="card-padded bg-ink-50">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Total to pay</div>
          <div className="text-2xl font-bold text-ink-900 tabular-nums">{fmtMoney(inv.netMinor)}</div>
          {inv.markupMinor > 0 && <div className="text-xs text-ink-500 mt-1">incl. {fmtMoney(inv.markupMinor)} BC fee</div>}
        </div>
      </div>

      {inv.notes && (
        <div className="card-padded mb-8">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Notes</div>
          <p className="text-sm text-ink-700">{inv.notes}</p>
        </div>
      )}

      <h2 className="text-lg font-semibold text-ink-900 mb-3">Line items</h2>
      {data.lines.length === 0 ? (
        <Empty icon={FileText} title="No lines" description="This invoice has no underlying sub payments in the period." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Subcontractor</th>
                <th className="px-5 py-3">Period</th>
                <th className="px-5 py-3">Hours</th>
                <th className="px-5 py-3">Sub invoice #</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l: Record<string, unknown>) => (
                <tr key={String(l.id)} className="border-b border-ink-100 last:border-b-0">
                  <td className="px-5 py-3 text-ink-900">{String(l.payment_date)}</td>
                  <td className="px-5 py-3 text-ink-700">{String(l.sub_full_name)}</td>
                  <td className="px-5 py-3 text-ink-600">{l.period_start && l.period_end ? `${l.period_start} → ${l.period_end}` : "—"}</td>
                  <td className="px-5 py-3 text-ink-700 tabular-nums">{l.hours != null ? String(l.hours) : "—"}</td>
                  <td className="px-5 py-3 font-mono text-xs">{l.invoice_number ? String(l.invoice_number) : <span className="text-ink-400">—</span>}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">{fmtMoney(Number(l.amount_minor) || 0)}</td>
                </tr>
              ))}
              {inv.markupMinor > 0 && (
                <tr className="bg-ink-50/50">
                  <td className="px-5 py-3 text-ink-900 italic" colSpan={5}>BC Construction admin fee</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">{fmtMoney(inv.markupMinor)}</td>
                </tr>
              )}
              <tr className="bg-ink-100 font-bold">
                <td className="px-5 py-3 text-ink-900" colSpan={5}>Total</td>
                <td className="px-5 py-3 text-right tabular-nums">{fmtMoney(inv.netMinor)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-ink-400 mt-6">
        To settle this invoice, please pay BC Construction at the bank details on the invoice and notify them by email.
      </p>
    </>
  );
}
