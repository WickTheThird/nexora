import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { Primary } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Empty } from "@/components/ui/Empty";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { fmtDate } from "@/lib/format";
import { Building2, Plus, Archive, Pencil } from "lucide-react";

// Admin Primaries page. CRUD for the top tier of the 3-tier hierarchy:
// developers / main contractors who hire BC Construction. Subcontractors
// reference these via subcontractors.primary_id; consolidated invoices flow
// from BC up to a primary based on these relationships.
export function Primaries() {
  const toast = useToast();
  const [items, setItems] = useState<Primary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Primary | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = async () => {
    try {
      const r = await api.adminListPrimaries(showArchived);
      setItems(r.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load principals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const archive = async (p: Primary) => {
    if (!confirm(`Archive "${p.name}"? Linked subcontractors keep their reference; the principal is hidden from active lists.`)) return;
    try {
      await api.adminArchivePrimary(p.id);
      toast.info("Archived");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  return (
    <>
      <PageHeader
        title="Principals"
        description="Developers and main contractors who hire BC Construction. Subcontractors are linked to a principal; consolidated invoices flow up to them."
        right={
          <div className="flex items-center gap-2">
            <label className="text-sm text-ink-600 flex items-center gap-2 mr-2">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>
            <Button variant="accent" onClick={() => setCreateOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
              Add principal
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty
          icon={Building2}
          title="No principals yet"
          description="Add the developers or main contractors that hire BC. You can link each subcontractor to a default principal so consolidated billing knows who to invoice."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">VAT</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    <Link to={`/admin/primaries/${p.id}`} className="font-medium text-ink-900 hover:underline">
                      {p.name}
                    </Link>
                    {p.address && <div className="text-xs text-ink-500 mt-0.5">{p.address}</div>}
                  </td>
                  <td className="px-5 py-3 text-ink-700">
                    {p.contactName && <div>{p.contactName}</div>}
                    {p.contactEmail && <div className="text-xs text-ink-500">{p.contactEmail}</div>}
                    {p.phone && <div className="text-xs text-ink-500">{p.phone}</div>}
                  </td>
                  <td className="px-5 py-3 text-ink-700">{p.vat || <span className="text-ink-400">—</span>}</td>
                  <td className="px-5 py-3 text-ink-600 text-sm">{fmtDate(new Date(p.createdAt).toISOString())}</td>
                  <td className="px-5 py-3">
                    {p.archivedAt
                      ? <Badge tone="neutral">Archived</Badge>
                      : <Badge tone="success">Active</Badge>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(p)} leftIcon={<Pencil className="h-4 w-4" />}>
                        Edit
                      </Button>
                      {!p.archivedAt && (
                        <Button variant="ghost" size="sm" onClick={() => archive(p)} leftIcon={<Archive className="h-4 w-4" />}>
                          Archive
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PrimaryModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={async () => { setCreateOpen(false); await refresh(); }}
      />
      <PrimaryModal
        open={!!editing}
        primary={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => { setEditing(null); await refresh(); }}
      />
    </>
  );
}

// Reusable create/edit modal. Distinguishes by presence of `primary` prop.
function PrimaryModal({
  open,
  onClose,
  onSaved,
  primary,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  primary?: Primary | null;
}) {
  const toast = useToast();
  const [form, setForm] = useState<Partial<Primary>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(primary || { name: "", contactName: "", contactEmail: "", address: "", vat: "", phone: "", notes: "" });
    }
  }, [open, primary]);

  const set = <K extends keyof Primary>(k: K, v: Primary[K] | string) =>
    setForm((f) => ({ ...f, [k]: v as Primary[K] }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || form.name.trim().length < 2) {
      toast.error("Name is required (min 2 chars)");
      return;
    }
    setSaving(true);
    try {
      // Coerce empty strings to null so the worker stores NULL rather than ""
      // (consistent with how the rest of the app treats optional text).
      const payload: Partial<Primary> = {
        name: form.name.trim(),
        contactName: form.contactName?.trim() || null,
        contactEmail: form.contactEmail?.trim() || null,
        address: form.address?.trim() || null,
        vat: form.vat?.trim() || null,
        phone: form.phone?.trim() || null,
        notes: form.notes?.trim() || null,
      };
      if (primary) {
        await api.adminPatchPrimary(primary.id, payload);
        toast.success("Principal updated");
      } else {
        await api.adminCreatePrimary(payload);
        toast.success("Principal created");
      }
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
      width="lg"
      title={primary ? `Edit ${primary.name}` : "Add principal"}
      description="A principal is a developer or main contractor who hires BC Construction. Subcontractors can be linked to a default principal."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={save} loading={saving}>
            {primary ? "Save changes" : "Create principal"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-4">
        <Input
          label="Company name"
          value={form.name || ""}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. ACME Developments Ltd"
          required
          autoFocus
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Primary contact name"
            value={form.contactName || ""}
            onChange={(e) => set("contactName", e.target.value)}
            placeholder="Project manager / accounts contact"
          />
          <Input
            label="Contact email"
            type="email"
            value={form.contactEmail || ""}
            onChange={(e) => set("contactEmail", e.target.value)}
            placeholder="accounts@example.ie"
          />
          <Input
            label="Phone"
            value={form.phone || ""}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+353 1 234 5678"
          />
          <Input
            label="VAT number"
            value={form.vat || ""}
            onChange={(e) => set("vat", e.target.value)}
            placeholder="IE1234567T"
          />
        </div>
        <Input
          label="Address"
          value={form.address || ""}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Street, town, county, postcode"
        />
        <Input
          label="Notes (internal)"
          value={form.notes || ""}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Anything you want to remember about this principal"
        />
      </form>
    </Modal>
  );
}
