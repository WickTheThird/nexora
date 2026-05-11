import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { Primary } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Save, Building2, MessagesSquare, FileText } from "lucide-react";

// Dedicated Account page for the principal user. Replaces the editable
// accountant card on the Dashboard with a proper Account section. Editable
// (self-serve): accountant_email. Read-only (admin-managed): everything
// else - with a "Request changes" CTA that opens a change-request flow.
export function PrincipalAccount() {
  const toast = useToast();
  const [primary, setPrimary] = useState<Primary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountantEmail, setAccountantEmail] = useState("");
  // Self-edit fields. Mirror the worker's PRIMARY_SELF_EDIT_FIELDS.
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await api.getMyPrimary();
        setPrimary(r.primary);
        setAccountantEmail(r.primary.accountantEmail || "");
        setContactName(r.primary.contactName || "");
        setContactEmail(r.primary.contactEmail || "");
        setPhone(r.primary.phone || "");
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Failed to load account");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.patchMyPrimary({
        accountantEmail: accountantEmail.trim() || null,
        contactName: contactName.trim() || null,
        contactEmail: contactEmail.trim() || null,
        phone: phone.trim() || null,
      });
      setPrimary(updated);
      toast.success("Account saved");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // View/Print Contract - opens the contract HTML in a new tab with print styles
  const viewContract = async () => {
    try {
      const r = await api.getMyPrimaryContract();
      const html = r.kind === "signed" ? r.contract.renderedHtml : r.template.bodyHtml;
      const banner = r.kind === "signed"
        ? `<div class="banner">Signed on ${new Date(r.signedAt).toLocaleDateString("en-IE")}${r.signedBy ? ` by ${r.signedBy}` : ""}.</div>`
        : `<div class="banner banner-amber">Preview - this is the active contract template. Operatives sign individually as part of their onboarding.</div>`;
      const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100");
      if (!w) { toast.error("Pop-up blocker prevented opening the contract."); return; }
      w.document.open();
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Contract - ${primary?.name || ""}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:#111; max-width: 800px; margin: 24mm auto; padding: 0 16mm; line-height: 1.55; font-size: 11pt; }
          h1, h2, h3 { color:#000; } h1 { font-size: 18pt; margin-top: 0; } h2 { font-size: 13pt; margin-top: 18pt; }
          ul, ol { padding-left: 22pt; }
          .banner { padding: 10pt 14pt; background: #ecfdf5; border-left: 4px solid #047857; font-size: 10pt; margin-bottom: 18pt; }
          .banner-amber { background: #fef3c7; border-left-color: #b45309; }
          @page { size: A4; margin: 16mm; }
          @media print { .no-print { display: none !important; } }
        </style></head><body>
        <div class="no-print" style="margin-bottom:18px;text-align:right">
          <button onclick="window.print()" style="padding:8px 16px;font:600 13px sans-serif;border:1px solid #1f4396;background:#1f4396;color:#fff;border-radius:6px;cursor:pointer">Print / Save as PDF</button>
        </div>
        ${banner}
        ${html || "<em>No contract content available.</em>"}
        </body></html>`);
      w.document.close();
      setTimeout(() => { try { w.focus(); } catch {} }, 200);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load contract");
    }
  };

  if (loading) return <div className="skeleton h-64" />;
  if (!primary) return <div>Account not found.</div>;

  return (
    <>
      <PageHeader
        title="Account"
        description="Your company details on file with BC Construction. Some fields you can edit yourself; others are managed by BC - use 'Request changes' to update those."
      />

      <form onSubmit={save} className="space-y-6 max-w-3xl">
        {/* Read-only company block */}
        <section className="card-padded">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-ink-900 inline-flex items-center gap-2">
              <Building2 className="h-5 w-5 text-ink-500" /> Company details
            </h2>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={viewContract} leftIcon={<FileText className="h-4 w-4" />}>
                View / Print Contract
              </Button>
              <span className="text-xs text-ink-500">Managed by BC</span>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-1">Trading name</div>
              <div className="font-medium text-ink-900">{primary.name}</div>
              <div className="text-[11px] text-ink-400 mt-0.5">Managed by BC - contact us to change.</div>
            </div>
            {primary.vat && (
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-1">VAT number</div>
                <div className="font-mono">{primary.vat}</div>
                <div className="text-[11px] text-ink-400 mt-0.5">Managed by BC.</div>
              </div>
            )}
            {primary.address && (
              <div className="sm:col-span-2">
                <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-1">Address</div>
                <div>{primary.address}</div>
                <div className="text-[11px] text-ink-400 mt-0.5">Managed by BC.</div>
              </div>
            )}
          </div>
          {/* Editable contact block - Title-cased server-side. */}
          <div className="mt-5 pt-4 border-t border-ink-100">
            <div className="text-xs uppercase tracking-wider text-emerald-700 font-semibold mb-3">You can edit these</div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Contact name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Sarah Walsh"
              />
              <Input
                label="Contact email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="sarah@example.ie"
              />
              <Input
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+353 1 449 1700"
              />
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-ink-100">
            <Link
              to="/primary/submissions"
              className="inline-flex items-center gap-1.5 text-sm text-ink-700 hover:text-ink-900 underline-offset-2 hover:underline"
            >
              <MessagesSquare className="h-4 w-4" />
              Need a change? Send a payment submission with a note, or contact BC at hello@bc-construction.ie.
            </Link>
          </div>
        </section>

        {/* Self-edit: accountant email */}
        <section className="card-padded">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Your accountant</h2>
              <p className="text-xs text-ink-500 mt-1">
                Used by the &quot;Send to my accountant&quot; button on every invoice. Optional.
              </p>
            </div>
            <span className="text-xs text-emerald-700 font-medium">You can edit this</span>
          </div>
          <Input
            label="Accountant email"
            type="email"
            value={accountantEmail}
            onChange={(e) => setAccountantEmail(e.target.value)}
            placeholder="accountant@example.ie"
          />
        </section>

        <div className="flex justify-end">
          <Button type="submit" variant="accent" loading={saving} leftIcon={<Save className="h-4 w-4" />}>
            Save changes
          </Button>
        </div>
      </form>
    </>
  );
}
