import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { AppSettings } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { getHelp } from "@/lib/helpContent";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Save } from "lucide-react";

const empty: AppSettings = {
  principal_name: null,
  principal_address: null,
  principal_vat: null,
  principal_email: null,
  accountant_email: null,
  admin_fee_amount_minor: null,
  admin_fee_percent: null,
  invoice_header_tagline: null,
  invoice_payment_terms: null,
  invoice_footer_note: null,
  invoice_show_vat: null,
  invoice_show_bank: null,
  invoice_show_contact: null,
  invoice_show_principal_ref: null,
  vat_rate_percent: null,
  less_subs_default_minor: null,
  // Enagh-style "Latest News" panel + "Changes Request" target email
  latest_news: null,
  changes_request_email: null,
  // BC service fee per worker (minor units). Default 1700 = €17.
  service_fee_per_worker_minor: null,
  // Bank + footer for BC-issued invoices.
  bc_bank_account_name: null,
  bc_bank_bic: null,
  bc_bank_iban: null,
  bc_bank_account_address: null,
  bc_phone_roi: null,
  bc_phone_ni: null,
  bc_website: null,
  bc_registered_number: null,
  bc_signatory_name: null,
};

export function Settings() {
  const toast = useToast();
  const [data, setData] = useState<AppSettings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.getSettings();
        setData({ ...empty, ...s });
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    setData((prev) => ({ ...prev, [k]: v }));

  const save = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await api.putSettings(data);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Settings" help={getHelp("settings")} />
        <div className="skeleton h-64" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Operational settings used by the portal. Your company details appear on every generated invoice."
        help={getHelp("settings")}
        right={
          <Button variant="accent" onClick={() => save()} loading={saving} leftIcon={<Save className="h-4 w-4" />}>
            Save
          </Button>
        }
      />

      <form onSubmit={save} className="space-y-8 max-w-2xl">
        <section className="card-padded">
          <h2 className="text-base font-semibold text-ink-900 mb-1">Your company</h2>
          <p className="text-sm text-ink-500 mb-5">
            Your business details. Shown as the issuing party on payment advices to your subcontractors.
          </p>
          <div className="space-y-4">
            <Input
              label="Trading name"
              value={data.principal_name || ""}
              onChange={(e) => set("principal_name", e.target.value || null)}
              placeholder="e.g. BC Construction Ltd"
            />
            <Textarea
              label="Address"
              rows={3}
              value={data.principal_address || ""}
              onChange={(e) => set("principal_address", e.target.value || null)}
              placeholder={"Street\nTown\nEircode"}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="VAT number"
                value={data.principal_vat || ""}
                onChange={(e) => set("principal_vat", e.target.value || null)}
                placeholder="IE1234567T"
              />
              <Input
                label="Contact email"
                type="email"
                value={data.principal_email || ""}
                onChange={(e) => set("principal_email", e.target.value || null)}
                placeholder="ops@yourcompany.ie"
              />
            </div>
          </div>
        </section>

        <section className="card-padded">
          <h2 className="text-base font-semibold text-ink-900 mb-1">BC service fee</h2>
          <p className="text-sm text-ink-500 mb-5">
            BC charges a fixed fee per worker on every Job Card a principal submits.
            The fee is multiplied by the period: <strong>weekly &times;1</strong>,{" "}
            <strong>fortnightly &times;2</strong>, <strong>monthly &times;4</strong>.
            A second invoice is auto-generated alongside the labour pass-through invoice.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Service fee per worker (€)"
              type="number"
              step="0.01"
              min="0"
              value={data.service_fee_per_worker_minor ? (parseInt(data.service_fee_per_worker_minor, 10) / 100).toFixed(2) : ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                set("service_fee_per_worker_minor", Number.isFinite(v) && v > 0 ? String(Math.round(v * 100)) : null);
              }}
              placeholder="17.00"
              hint="Default 17.00. Charged once per worker, scaled by period length."
            />
          </div>
        </section>

        {/* Job Card calculator - VAT rate + default Less Subs. These appear
            as the live "Calculate" card on every Principal Job Card form. */}
        <section className="card-padded">
          <h2 className="text-base font-semibold text-ink-900 mb-1">Job Card calculator</h2>
          <p className="text-sm text-ink-500 mb-5">
            Drives the live totals card under every principal&apos;s Job Card form
            (Total Gross → + VAT → − Less Subs → Total to Pay BC).
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="VAT rate (%)"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={data.vat_rate_percent || ""}
              onChange={(e) => set("vat_rate_percent", e.target.value || null)}
              placeholder="e.g. 13.5"
              hint="Irish construction-services standard is 13.5%."
            />
            <Input
              label="Default Less Subs (€)"
              type="number"
              step="0.01"
              min="0"
              value={data.less_subs_default_minor ? (parseInt(data.less_subs_default_minor, 10) / 100).toFixed(2) : ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                set("less_subs_default_minor", Number.isFinite(v) && v > 0 ? String(Math.round(v * 100)) : null);
              }}
              placeholder="0.00"
              hint="Default per-job-card deduction. Principal can override per submission."
            />
          </div>
        </section>

        {/* Principal portal - Latest News + Changes Request email */}
        <section className="card-padded">
          <h2 className="text-base font-semibold text-ink-900 mb-1">Principal portal</h2>
          <p className="text-sm text-ink-500 mb-5">
            Content shown on every principal&apos;s home dashboard.
          </p>
          <div className="space-y-4">
            <Textarea
              label="Latest News (optional)"
              rows={3}
              value={data.latest_news || ""}
              onChange={(e) => set("latest_news", e.target.value || null)}
              placeholder={'e.g. "PLEASE ENSURE ALL JOB CARDS AND PAYMENTS HAVE BEEN SUBMITTED TO BC BEFORE 2PM WEDNESDAY."'}
              hint="Plain text. Line breaks preserved. Leave blank to hide the panel."
            />
            <Input
              label="Changes Request email"
              type="email"
              value={data.changes_request_email || ""}
              onChange={(e) => set("changes_request_email", e.target.value || null)}
              placeholder="hello@bc-construction.ie"
              hint="Mail-to target for the principal's red 'Changes Request' button. Defaults to your principal contact email if blank."
            />
          </div>
        </section>

        {/* Invoice template - admin controls every visible part of the PDF.
            Toggles default to ON when blank; freeform fields blank → hidden. */}
        <section className="card-padded">
          <h2 className="text-base font-semibold text-ink-900 mb-1">Invoice template</h2>
          <p className="text-sm text-ink-500 mb-5">
            What appears on every generated invoice PDF. Toggle sections off
            to hide them, or leave the freeform fields blank to use defaults.
          </p>
          <div className="space-y-4">
            <Input
              label="Header tagline (optional)"
              value={data.invoice_header_tagline || ""}
              onChange={(e) => set("invoice_header_tagline", e.target.value || null)}
              placeholder='e.g. "Subcontractor Services Invoice"'
              hint="Shown under the main 'Invoice' / 'Payment Advice' title."
            />
            <Textarea
              label="Payment terms (optional)"
              rows={2}
              value={data.invoice_payment_terms || ""}
              onChange={(e) => set("invoice_payment_terms", e.target.value || null)}
              placeholder="e.g. Payment due within 14 days of invoice date. Bank transfer only."
              hint="Appears just above the bank details / footer."
            />
            <Textarea
              label="Footer note (optional)"
              rows={3}
              value={data.invoice_footer_note || ""}
              onChange={(e) => set("invoice_footer_note", e.target.value || null)}
              placeholder="Thank-you message, dispute window, contact info, etc."
              hint="Centered at the bottom of the page above the legal banner."
            />
            <div className="border-t border-ink-100 pt-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3">
                Visible sections
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {([
                  ["invoice_show_vat",            "VAT row in totals"],
                  ["invoice_show_bank",           "Bank / PAY TO block"],
                  ["invoice_show_contact",        "Issuer contact (phone / email)"],
                  ["invoice_show_principal_ref",  "Principal / job reference line"],
                ] as const).map(([key, label]) => {
                  // null/undefined treated as ON; explicit "0" hides.
                  const checked = data[key] !== "0";
                  return (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => set(key, e.target.checked ? "1" : "0")}
                      />
                      <span className="text-ink-700">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="card-padded">
          <h2 className="text-base font-semibold text-ink-900 mb-1">Invoice footer + bank</h2>
          <p className="text-sm text-ink-500 mb-5">
            These render on every BC-issued invoice PDF (Payment Details
            block + page footer with contact info + registered office).
          </p>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Bank account name"
                value={data.bc_bank_account_name || ""}
                onChange={(e) => set("bc_bank_account_name", e.target.value || null)}
                placeholder="Samwise Building Contractors Ltd"
              />
              <Input
                label="BIC"
                value={data.bc_bank_bic || ""}
                onChange={(e) => set("bc_bank_bic", e.target.value || null)}
                placeholder="TRWIBEB1XXX"
              />
              <Input
                label="IBAN"
                value={data.bc_bank_iban || ""}
                onChange={(e) => set("bc_bank_iban", e.target.value || null)}
                placeholder="IE12 BOFI 9000 1234 5678 90"
              />
              <Input
                label="Registered number"
                value={data.bc_registered_number || ""}
                onChange={(e) => set("bc_registered_number", e.target.value || null)}
                placeholder="575739"
              />
            </div>
            <Textarea
              label="Bank account address (optional)"
              rows={3}
              value={data.bc_bank_account_address || ""}
              onChange={(e) => set("bc_bank_account_address", e.target.value || null)}
              placeholder={"Wise's address: Avenue Louise 54, Room S52\nBrussels\n1050\nBelgium"}
              hint="For Wise / non-IE accounts. Leave blank for a local IBAN."
            />
            <div className="grid sm:grid-cols-3 gap-4">
              <Input
                label="ROI phone"
                value={data.bc_phone_roi || ""}
                onChange={(e) => set("bc_phone_roi", e.target.value || null)}
                placeholder="00353 (0) 19697857"
              />
              <Input
                label="NI phone"
                value={data.bc_phone_ni || ""}
                onChange={(e) => set("bc_phone_ni", e.target.value || null)}
                placeholder="0044 (0) 2895608636"
              />
              <Input
                label="Website"
                value={data.bc_website || ""}
                onChange={(e) => set("bc_website", e.target.value || null)}
                placeholder="www.samwisebc.com"
              />
            </div>
            <Input
              label="Contract signatory name"
              value={data.bc_signatory_name || ""}
              onChange={(e) => set("bc_signatory_name", e.target.value || null)}
              placeholder="JP Donnelly"
              hint="Printed in the Contractor-side signature block on /legal/contract."
            />
          </div>
        </section>

        <section className="card-padded">
          <h2 className="text-base font-semibold text-ink-900 mb-1">Accountant</h2>
          <p className="text-sm text-ink-500 mb-5">
            The address used when you click "Send to accountant" on a generated
            invoice. We open a pre-filled mail draft; nothing is sent without
            your action.
          </p>
          <Input
            label="Accountant email"
            type="email"
            value={data.accountant_email || ""}
            onChange={(e) => set("accountant_email", e.target.value || null)}
            placeholder="accounts@firm.ie"
            hint="Leave blank to disable the Send to accountant button."
          />
        </section>

        <div className="flex justify-end">
          <Button variant="accent" type="submit" loading={saving} leftIcon={<Save className="h-4 w-4" />}>
            Save
          </Button>
        </div>
      </form>
    </>
  );
}
