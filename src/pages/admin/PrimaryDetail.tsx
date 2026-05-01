import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { Primary, PrimaryInvoice, Subcontractor } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, FileText, Mail, CheckCircle2, Plus, Users, ArrowUpRight, UserPlus } from "lucide-react";

function fmtMoney(minor: number) {
  return `\u20AC${(minor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Admin Primary detail page. Shows the primary's contact info, the count
// of subcontractors linked to them, and the list of consolidated invoices
// (BC → primary direction). Admin can generate a new invoice for any
// period, mark it sent, or mark it paid.
export function PrimaryDetail() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [primary, setPrimary] = useState<Primary | null>(null);
  const [stats, setStats] = useState<{
    subcontractorCount: number;
    moneyByStatus: Record<string, { count: number; grossMinor: number; netMinor: number }>;
  } | null>(null);
  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [invoices, setInvoices] = useState<PrimaryInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [genOpen, setGenOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const refresh = async () => {
    if (!id) return;
    try {
      const [p, list] = await Promise.all([
        api.adminGetPrimary(id),
        api.adminListPrimaryInvoices(id),
      ]);
      setPrimary(p.primary);
      setStats(p.stats);
      setSubs(p.subcontractors);
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
  if (!primary) return <Empty title="Not found" description="That principal doesn't exist." icon={ArrowLeft} />;

  return (
    <>
      <PageHeader
        title={primary.name}
        description={`Principal · linked sub count: ${stats?.subcontractorCount ?? "—"}`}
        right={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setInviteOpen(true)} leftIcon={<UserPlus className="h-4 w-4" />}>
              Invite contact
            </Button>
            <Button variant="accent" onClick={() => setGenOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
              Generate invoice
            </Button>
          </div>
        }
      />

      <Link to="/admin/primaries" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to principals
      </Link>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
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
        <Link
          to={`/admin/subcontractors?primaryId=${primary.id}`}
          className="card-padded block group transition hover:shadow-md hover:-translate-y-0.5 hover:border-ink-300 relative"
        >
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Subcontractors</div>
          <div className="text-3xl font-bold text-ink-900 tabular-nums">{stats?.subcontractorCount ?? "—"}</div>
          <div className="text-xs text-ink-500 mt-1">linked · click to filter Subs list</div>
          <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-ink-300 group-hover:text-ink-700 transition" />
        </Link>
      </div>

      {/* Money rollup */}
      {stats?.moneyByStatus && Object.keys(stats.moneyByStatus).length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {(["advised", "invoiced", "paid"] as const).map((status) => {
            const m = stats.moneyByStatus[status] || { count: 0, grossMinor: 0, netMinor: 0 };
            const tone =
              status === "paid" ? "bg-emerald-50 border-emerald-200" :
              status === "invoiced" ? "bg-sky-50 border-sky-200" :
              "bg-accent-50 border-accent-200";
            const label =
              status === "advised" ? "Advised (sub still to invoice)" :
              status === "invoiced" ? "Invoiced (awaiting payment)" :
              "Paid";
            return (
              <div key={status} className={`rounded-lg border p-4 ${tone}`}>
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold">{label}</div>
                <div className="text-lg font-bold text-ink-900 tabular-nums mt-1">{fmtMoney(m.grossMinor)}</div>
                <div className="text-xs text-ink-500">{m.count} payment{m.count === 1 ? "" : "s"} · net {fmtMoney(m.netMinor)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Linked subcontractors */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-ink-900">Linked subcontractors</h2>
        <Link to={`/admin/subcontractors?primaryId=${primary.id}`} className="text-sm text-ink-600 hover:text-ink-900 inline-flex items-center gap-1">
          See all <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
      {subs.length === 0 ? (
        <div className="card-padded text-sm text-ink-500 mb-8 flex items-center gap-3">
          <Users className="h-5 w-5 text-ink-400" />
          No subcontractors linked yet. Open any sub and set their Principal, or use the Subcontractors list filter.
        </div>
      ) : (
        <div className="card overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Rate</th>
                <th className="px-5 py-3">RCT</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3 font-medium text-ink-900">{s.fullName || "—"}</td>
                  <td className="px-5 py-3 text-ink-600">{s.email}</td>
                  <td className="px-5 py-3"><Badge tone="info">{s.onboardingStatus.replace(/_/g, " ")}</Badge></td>
                  <td className="px-5 py-3 text-ink-700 tabular-nums">
                    {s.rateAmountMinor && s.rateUnit
                      ? `${fmtMoney(s.rateAmountMinor)}/${s.rateUnit}`
                      : <span className="text-ink-400">—</span>}
                  </td>
                  <td className="px-5 py-3 text-ink-700">
                    {s.rctRate ? `${s.rctRate}%` : <span className="text-ink-400">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/admin/subcontractors/${s.id}`} className="btn-ghost !py-1.5 inline-flex text-xs">
                      Open <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="text-lg font-semibold text-ink-900 mb-4">Invoices issued to this principal</h2>
      {invoices.length === 0 ? (
        <Empty
          icon={FileText}
          title="No invoices yet"
          description="Generate an invoice to consolidate sub work for a date range and bill this principal."
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
      <InviteContactModal
        open={inviteOpen}
        primaryId={primary.id}
        primaryName={primary.name}
        onClose={() => setInviteOpen(false)}
      />
    </>
  );
}

// Invite a primary user — creates a user with role='primary' linked to this
// primary. Returns a one-time temp password (must_change_password=1 on the
// new user). Modal stays open after creation so the admin can copy + share.
function InviteContactModal({
  open,
  primaryId,
  primaryName,
  onClose,
}: {
  open: boolean;
  primaryId: string;
  primaryName: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const reset = () => { setEmail(""); setTempPassword(null); };

  const submit = async () => {
    if (!email.trim()) { toast.error("Email is required"); return; }
    setLoading(true);
    try {
      const r = await api.adminInvitePrimaryUser(primaryId, email.trim());
      setTempPassword(r.tempPassword);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title={`Invite contact for ${primaryName}`}
      description={tempPassword ? "Account created. Share the password securely — it won't be shown again." : "Creates a principal-portal account that can read this principal's subs and invoices (read-only)."}
      footer={
        tempPassword ? (
          <Button onClick={() => { reset(); onClose(); }}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
            <Button variant="accent" onClick={submit} loading={loading}>Send invite</Button>
          </>
        )
      }
    >
      {tempPassword ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
            <div className="font-semibold mb-1">One-time display</div>
            This password will not be shown again. Copy it now and share via a secure channel.
          </div>
          <div className="text-sm text-ink-600">
            <span className="text-ink-500">Email:</span> <span className="font-medium">{email}</span>
          </div>
          <div className="rounded-lg bg-ink-950 text-white p-4 font-mono text-sm break-all select-all">
            {tempPassword}
          </div>
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(tempPassword)}>
            Copy to clipboard
          </Button>
        </div>
      ) : (
        <Input
          label="Contact email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="contact@developer.ie"
          required
          autoFocus
        />
      )}
    </Modal>
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
  // Fee settings (admin's default fee charged to primaries).
  const [feeAmountCents, setFeeAmountCents] = useState(0);
  const [feePercent, setFeePercent] = useState(0);
  const [feeOverridden, setFeeOverridden] = useState(false);

  // Load fee settings each time the modal opens so we always show fresh
  // values (in case they were just edited in Settings).
  useEffect(() => {
    if (!open) return;
    setFeeOverridden(false);
    (async () => {
      try {
        const s = await api.getSettings();
        const flat = s.admin_fee_amount_minor ? parseInt(s.admin_fee_amount_minor, 10) || 0 : 0;
        const pct  = s.admin_fee_percent ? parseFloat(s.admin_fee_percent) || 0 : 0;
        setFeeAmountCents(flat);
        setFeePercent(pct);
        // Pre-fill the markup with just the flat component initially. The
        // percent component depends on the gross which we don't know yet,
        // so we display it informationally below and the worker re-applies.
        setMarkup(flat > 0 ? (flat / 100).toFixed(2) : "");
      } catch {
        // Non-fatal — admin can still type a markup manually.
      }
    })();
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // If the admin didn't change anything (feeOverridden=false), omit
      // markupMinor entirely so the worker computes it from settings
      // (admin_fee_amount_minor + admin_fee_percent × gross). If they
      // typed a number, send that exact amount.
      const payload: { from: string; to: string; markupMinor?: number; notes?: string } = { from, to, notes };
      if (feeOverridden) {
        payload.markupMinor = markup ? Math.round(parseFloat(markup) * 100) : 0;
      }
      await api.adminCreatePrimaryInvoice(primaryId, payload);
      toast.success("Invoice created");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const feeConfigured = feeAmountCents > 0 || feePercent > 0;
  const feeDescription = feeConfigured
    ? `Auto: €${(feeAmountCents / 100).toFixed(2)} flat${feePercent > 0 ? ` + ${feePercent}% of gross` : ""} (from Settings).`
    : "No default fee in Settings. Worker will use €0 unless you enter a markup below.";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate invoice"
      description={`Sums up all sub payments in the period for subs linked to ${primaryName}, plus your admin fee.`}
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

        {/* Fee summary card — auto-computed, with explicit "override" toggle */}
        <div className={`rounded-lg border p-3 ${feeOverridden ? "bg-accent-50 border-accent-200" : "bg-ink-50 border-ink-200"}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-ink-500">
                {feeOverridden ? "Admin fee — overridden" : "Admin fee — auto from Settings"}
              </div>
              <div className="text-sm text-ink-800 mt-1">{feeDescription}</div>
            </div>
            {!feeOverridden ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setFeeOverridden(true)}>
                Override
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => { setFeeOverridden(false); setMarkup(""); }}>
                Reset to auto
              </Button>
            )}
          </div>
          {feeOverridden && (
            <Input
              label="Markup (€)"
              type="number"
              step="0.01"
              min="0"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
              placeholder="0.00"
              className="mt-3"
            />
          )}
        </div>

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
