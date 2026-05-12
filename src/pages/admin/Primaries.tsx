import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { Primary } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { getHelp } from "@/lib/helpContent";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Empty } from "@/components/ui/Empty";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { fmtDate } from "@/lib/format";
import { Building2, Plus, Archive, Pencil, Download } from "lucide-react";
import { exportRowsAsCsv } from "@/lib/csv";

// Admin Primaries page. CRUD for the top tier of the 3-tier hierarchy:
// developers / main contractors who hire BC Construction. Subcontractors
// reference these via subcontractors.primary_id; consolidated invoices flow
// from BC up to a primary based on these relationships.
export function Primaries() {
  const toast = useToast();
  // Read URL params first so initial state can pull from them
  // (deep-links from Recent Activity / dashboard quick-adds).
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<Primary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Primary | null>(null);
  // Bucket tabs matching the Subcontractors / Jobs Posted pattern.
  const [activeBucket, setActiveBucket] = useState<"all" | "active" | "archive">("active");
  // Search initialised from URL ?q= so deep links land filtered.
  const [search, setSearch] = useState(searchParams.get("q") || "");
  // Auto-open the create modal on ?new=1.
  const [createOpen, setCreateOpen] = useState(searchParams.get("new") === "1");

  const refresh = async () => {
    try {
      // Always pull including archived so the bucket chips can switch
      // client-side without an extra round-trip. Stays cheap because
      // the principals list is small (< a few hundred typically).
      const r = await api.adminListPrimaries(true);
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
  }, []);

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
        help={getHelp("primaries")}
        right={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => exportRowsAsCsv(`principals-${new Date().toISOString().slice(0,10)}.csv`, items, [
                { header: "Name",          value: (p) => p.name },
                { header: "Contact name",  value: (p) => p.contactName ?? "" },
                { header: "Contact email", value: (p) => p.contactEmail ?? "" },
                { header: "Phone",         value: (p) => p.phone ?? "" },
                { header: "VAT",           value: (p) => p.vat ?? "" },
                { header: "Address",       value: (p) => p.address ?? "" },
                { header: "Status",        value: (p) => p.archivedAt ? "Archived" : "Active" },
                { header: "Created",       value: (p) => fmtDate(new Date(p.createdAt).toISOString()) },
              ])}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Download CSV
            </Button>
            <Button variant="accent" onClick={() => setCreateOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
              Add principal
            </Button>
          </div>
        }
      />

      {/* Bucket tabs - All / Active / Archive. Client-side filter,
          same pattern as Subcontractors + Jobs Posted pages. */}
      <div className="flex gap-1 mb-4 border-b border-ink-200 overflow-x-auto">
        {(["all","active","archive"] as const).map(b => {
          const count = b === "all"     ? items.length
                      : b === "active"  ? items.filter(p => !p.archivedAt).length
                      :                    items.filter(p => !!p.archivedAt).length;
          return (
            <button
              key={b}
              type="button"
              onClick={() => setActiveBucket(b)}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 whitespace-nowrap transition ${
                activeBucket === b ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800"
              }`}
            >
              {b === "all" ? "All" : b === "active" ? "Active" : "Archive"}
              <span className={`ml-2 text-xs ${activeBucket === b ? "text-ink-500" : "text-ink-400"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search box - free-text across name / contact / VAT / address. */}
      <div className="card-padded mb-4">
        <Input
          label="Search"
          placeholder="Name, contact, email, VAT, address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {(() => {
        const visible = items.filter(p => {
          if (activeBucket === "active" && p.archivedAt) return false;
          if (activeBucket === "archive" && !p.archivedAt) return false;
          if (search.trim()) {
            const q = search.trim().toLowerCase();
            const hay = [p.name, p.contactName, p.contactEmail, p.vat, p.address, p.phone].filter(Boolean).join(" ").toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
        if (loading) return <div className="skeleton h-64" />;
        if (visible.length === 0) return (
          <Empty
            icon={Building2}
            title={items.length === 0 ? "No principals yet" : "No principals match"}
            description={items.length === 0
              ? "Add the developers or main contractors that hire BC."
              : "Try a wider bucket or clearing the search."}
          />
        );
        return (
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
              {visible.map((p) => (
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
                  <td className="px-5 py-3 text-ink-700">{p.vat || <span className="text-ink-400">-</span>}</td>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => archive(p)}
                          leftIcon={<Archive className="h-4 w-4" />}
                          className="hover:bg-red-50 hover:text-red-700"
                        >
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
        );
      })()}

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
