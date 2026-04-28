import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { Primary, PrimaryInvoice } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, FileText, Mail, CheckCircle2, Plus } from "lucide-react";

// Admin Primary detail page. Shows the primary's contact info, the count
// of subcontractors linked to them, and the list of consolidated invoices
// (BC → primary direction). Admin can generate a new invoice for any
// period, mark it sent, or mark it paid.
export function PrimaryDetail() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [primary, setPrimary] = useState<Primary | null>(null);
  const [stats, setStats] = useState<{ subcontractorCount: number } | null>(null);
  const [invoices, setInvoices] = useState<PrimaryInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [genOpen, setGenOpen] = useState(false);

  const refresh = async () => {
    if (!id) return;
    try {
      const [p, list] = await Promise.all([
        api.adminGetPrimary(id),
        api.adminListPrimaryInvoices(id),
      ]);
      setPrimary(p.primary);
      setStats(p.stats);
      setInvoices(list.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const markSent = async (inv: PrimaryInvoice) => {
    try {
      await api.adminMarkPrimaryInvoiceSent(inv.id);
      toast.success("Marked as sent");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };
  const markPaid = async (inv: PrimaryInvoice) => {
    if (!confirm(`Mark invoice ${inv.invoiceNumber} as paid? This is irreversible.`)) return;
    try {
      await api.adminMarkPrimaryInvoicePaid(inv.id);
      toast.success("Marked as paid");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  if (loading) return <div className="skeleton h-64" />;
  if (!primary) return <Empty title="Not found" description="That primary doesn't exist." icon={ArrowLeft} />;

  return (
    <>
      <PageHeader
        title={primary.name}
        description={`Primary contractor · linked sub count: ${stats?.subcontractorCount ?? "—"}`}
        right={
          <Button variant="accent" onClick={() => setGenOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
            Generate invoice
          </Button>
        }
      />

      <Link to="/admin/primaries" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to primaries
      </Link>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="card-padded">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Contact</div>
          {primary.contactName && <div className="font-medium text-ink-900">{primary.contactName}</div>}
          {primary.contactEmail && <div className="text-sm text-ink-700">{primary.contactEmail}</div>}
          {primary.phone && <div className="text-sm text-ink-700">{primary.phone}</div>}
          {!primary.contactName && !primary.contactEmail && !primary.phone && (
            <div className="text-sm text-ink-400">No contact details</div>
          )}
        </div>
        <div className="card-padded">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Tax & address</div>
          {primary.vat && <div className="text-sm">VAT: <span className="font-medium">{primary.vat}</span></div>}
          {primary.address && <div className="text-sm text-ink-700 mt-1">{primary.address}</div>}
        </div>
        <div className="card-padded">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Subcontractors</div>
          <div className="text-3xl font-bold text-ink-900 tabular-nums">{stats?.subcontractorCount ?? "—"}</div>
          <div className="text-xs text-ink-500 mt-1">linked to this primary</div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-ink-900 mb-4">Invoices issued to this primary</h2>
      {invoices.length === 0 ? (
        <Empty
          icon={FileText}
          title="No invoices yet"
          description="Generate an invoice to consolidate sub work for a date range and bill this primary."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3">Invoice #</th>
                <th className="px-5 py-3">Period</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Gross</th>
                <th className="px-5 py-3 text-right">Markup</th>
                <th className="px-5 py-3 text-right">Net</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const tone: "neutral" | "info" | "success" | "warn" =
                  inv.status === "paid" ? "success" :
                  inv.status === "sent" ? "info" :
                  inv.status === "cancelled" ? "neutral" : "warn";
                return (
                  <tr key={inv.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                    <td className="px-5 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="px-5 py-3 text-ink-700">{inv.periodStart} → {inv.periodEnd}</td>
                    <td className="px-5 py-3"><Badge tone={tone}>{inv.status}</Badge></td>
                    <td className="px-5 py-3 text-right tabular-nums">€{(inv.grossMinor / 100).toFixed(2)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-600">
                      {inv.markupMinor ? `€${(inv.markupMinor / 100).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-bold">€{(inv.netMinor / 100).toFixed(2)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {inv.status === "draft" && (
                          <Button variant="outline" size="sm" onClick={() => markSent(inv)} leftIcon={<Mail className="h-4 w-4" />}>
                            Mark sent
                          </Button>
                        )}
                        {inv.status !== "paid" && inv.status !== "cancelled" && (
                          <Button variant="accent" size="sm" onClick={() => markPaid(inv)} leftIcon={<CheckCircle2 className="h-4 w-4" />}>
                            Mark paid
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <GenerateInvoiceModal
        open={genOpen}
        primaryId={primary.id}
        primaryName={primary.name}
        onClose={() => setGenOpen(false)}
        onSaved={async () => { setGenOpen(false); await refresh(); }}
      />
    </>
  );
}

function GenerateInvoiceModal({
  open,
  primaryId,
  primaryName,
  onClose,
  onSaved,
}: {
  open: boolean;
  primaryId: string;
  primaryName: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const toast = useToast();
  // Default to last 30 days.
  const today = new Date();
  const thirty = new Date(today); thirty.setDate(today.getDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const [from, setFrom] = useState(iso(thirty));
  const [to, setTo] = useState(iso(today));
  const [markup, setMarkup] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const markupMinor = markup ? Math.round(parseFloat(markup) * 100) : 0;
      await api.adminCreatePrimaryInvoice(primaryId, { from, to, markupMinor, notes });
      toast.success("Invoice created");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate invoice"
      description={`Sums up all sub payments in the period for subs linked to ${primaryName}, plus any markup.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={submit} loading={saving}>Create invoice</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Input
          label="Markup (€, optional)"
          type="number"
          step="0.01"
          min="0"
          value={markup}
          onChange={(e) => setMarkup(e.target.value)}
          placeholder="e.g. 500.00 for BC's margin"
          hint="Added on top of the consolidated sub total. Leave blank for none."
        />
        <Input
          label="Notes (internal)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="PO reference, project name, etc."
        />
      </form>
    </Modal>
  );
}
