import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2, MapPinned } from "lucide-react";

// Managed Site IDs registry (Enagh-style). The principal adds their
// Revenue-registered SIN codes once; they then become the dropdown
// options on every Job Card / payment submission. Soft-archive only \u2014
// past payment_records may still reference the SIN string.

type SiteRow = Awaited<ReturnType<typeof api.listMyPrincipalSiteIds>>["items"][number];

export function PrincipalSiteIds() {
  const toast = useToast();
  const [items, setItems] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteId, setSiteId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [address, setAddress] = useState("");
  const [adding, setAdding] = useState(false);

  const refresh = async () => {
    try {
      const r = await api.listMyPrincipalSiteIds();
      setItems(r.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load site IDs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!siteId.trim()) { toast.error("Site ID required"); return; }
    setAdding(true);
    try {
      await api.createMyPrincipalSiteId({
        siteId: siteId.trim(),
        projectName: projectName.trim() || null,
        address: address.trim() || null,
      });
      toast.success("Site ID added");
      setSiteId(""); setProjectName(""); setAddress("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (row: SiteRow) => {
    if (!confirm(`Remove site ID ${row.siteId}? Past payments referencing it remain in the record.`)) return;
    try {
      await api.archiveMyPrincipalSiteId(row.id);
      toast.info("Removed");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  return (
    <>
      <PageHeader
        title="Site IDs"
        description="Add every Revenue-registered SIN number for your projects. They become the dropdown options on every payment submission."
      />
      <p className="text-sm text-ink-500 mb-6 max-w-3xl">
        SIN codes are issued by the Revenue Commissioners when a contract is registered on{" "}
        <a href="https://ros.ie" target="_blank" rel="noopener noreferrer" className="underline">
          ros.ie
        </a>{" "}
        — your contract manager on site usually has them.
      </p>

      {/* Add new — sits above the list, like Enagh's "New ID" field */}
      <form onSubmit={add} className="card-padded mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 mb-3">Add a new Site ID</h2>
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <Input
            label="Site ID (SIN)"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value.toUpperCase())}
            placeholder="DUB48662N"
            required
          />
          <Input
            label="Project name (optional)"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Park West phase 2"
          />
          <Input
            label="Address (optional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Cherry Orchard, Dublin"
          />
          <Button type="submit" variant="accent" loading={adding} leftIcon={<Plus className="h-4 w-4" />}>
            Add
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="skeleton h-40" />
      ) : items.length === 0 ? (
        <Empty
          icon={MapPinned}
          title="No site IDs yet"
          description="Add your first Revenue SIN above. You can add more any time \u2014 they appear as a dropdown when subs or your office submit payment data."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3">Site ID</th>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Address</th>
                <th className="px-5 py-3 w-20 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3 font-mono text-sm text-ink-900 font-semibold">{row.siteId}</td>
                  <td className="px-5 py-3 text-ink-700">{row.projectName || <span className="text-ink-400">\u2014</span>}</td>
                  <td className="px-5 py-3 text-ink-600 text-xs">{row.address || <span className="text-ink-400">\u2014</span>}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(row)}
                      title="Remove this Site ID"
                      className="text-ink-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
