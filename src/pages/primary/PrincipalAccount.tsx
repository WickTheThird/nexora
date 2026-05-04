import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { Primary } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Save, Building2, MessagesSquare } from "lucide-react";

// Dedicated Account page for the principal user. Replaces the editable
// accountant card on the Dashboard with a proper Account section. Editable
// (self-serve): accountant_email. Read-only (admin-managed): everything
// else \u2014 with a "Request changes" CTA that opens a change-request flow.
export function PrincipalAccount() {
  const toast = useToast();
  const [primary, setPrimary] = useState<Primary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountantEmail, setAccountantEmail] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await api.getMyPrimary();
        setPrimary(r.primary);
        setAccountantEmail(r.primary.accountantEmail || "");
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
      const updated = await api.patchMyPrimary({ accountantEmail: accountantEmail.trim() || null });
      setPrimary(updated);
      toast.success("Account saved");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="skeleton h-64" />;
  if (!primary) return <div>Account not found.</div>;

  return (
    <>
      <PageHeader
        title="Account"
        description="Your company details on file with BC Construction. Some fields you can edit yourself; others are managed by BC — use 'Request changes' to update those."
      />

      <form onSubmit={save} className="space-y-6 max-w-3xl">
        {/* Read-only company block */}
        <section className="card-padded">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-ink-900 inline-flex items-center gap-2">
              <Building2 className="h-5 w-5 text-ink-500" /> Company details
            </h2>
            <span className="text-xs text-ink-500">Managed by BC</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div><div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-1">Trading name</div><div className="font-medium text-ink-900">{primary.name}</div></div>
            {primary.contactName && (<div><div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-1">Contact name</div><div>{primary.contactName}</div></div>)}
            {primary.contactEmail && (<div><div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-1">Contact email</div><div>{primary.contactEmail}</div></div>)}
            {primary.phone && (<div><div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-1">Phone</div><div>{primary.phone}</div></div>)}
            {primary.vat && (<div><div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-1">VAT number</div><div className="font-mono">{primary.vat}</div></div>)}
            {primary.address && (<div className="sm:col-span-2"><div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-1">Address</div><div>{primary.address}</div></div>)}
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
