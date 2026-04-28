import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { AppSettings } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Save } from "lucide-react";

const empty: AppSettings = {
  principal_name: null,
  principal_address: null,
  principal_vat: null,
  principal_email: null,
  accountant_email: null,
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
        <PageHeader title="Settings" />
        <div className="skeleton h-64" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Operational settings used by the portal. The principal company details appear on every generated invoice."
        right={
          <Button variant="accent" onClick={() => save()} loading={saving} leftIcon={<Save className="h-4 w-4" />}>
            Save
          </Button>
        }
      />

      <form onSubmit={save} className="space-y-8 max-w-2xl">
        <section className="card-padded">
          <h2 className="text-base font-semibold text-ink-900 mb-1">Principal contractor</h2>
          <p className="text-sm text-ink-500 mb-5">
            Your business details. Shown as the issuing party on self-billing
            invoices generated for each subcontractor.
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
