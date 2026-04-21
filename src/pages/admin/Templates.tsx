import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ContractTemplate } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { fmtDateTime } from "@/lib/format";
import { FilePlus, FileText } from "lucide-react";

const PLACEHOLDERS = [
  "fullName","address1","address2","town","postcode","dob","placeOfBirth",
  "tel","mob","email","natureOfServices","workType","vatNumber",
  "subcontractorRef","clientRef","date",
];

const SAMPLE = `<h1>Subcontractor Services Agreement</h1>
<p><strong>Date:</strong> {{date}}</p>
<p>This agreement is between <strong>Nexora Ltd</strong> (the "Contractor") and <strong>{{fullName}}</strong> (the "Subcontractor"), of {{address1}}, {{town}}, {{postcode}}.</p>
<h2>1. Services</h2>
<p>The Subcontractor shall provide: {{natureOfServices}} ({{workType}}).</p>
<h2>2. Signature</h2>
<p>By signing below, the Subcontractor confirms they have read and agreed to this agreement.</p>`;

export function Templates() {
  const toast = useToast();
  const [items, setItems] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("standard");
  const [body, setBody] = useState(SAMPLE);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<ContractTemplate | null>(null);

  const refresh = async () => {
    const r = await api.adminListTemplates();
    setItems(r.items);
  };

  useEffect(() => {
    (async () => { try { await refresh(); } finally { setLoading(false); } })();
  }, []);

  const create = async () => {
    setCreating(true);
    try {
      await api.adminCreateTemplate(name.trim(), body);
      setCreateOpen(false);
      setName("standard");
      setBody(SAMPLE);
      await refresh();
      toast.success("Template created");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Contract Templates"
        description="HTML templates with {{placeholders}} that get filled from subcontractor profiles at generation time."
        right={
          <Button variant="accent" onClick={() => setCreateOpen(true)} leftIcon={<FilePlus className="h-4 w-4"/>}>
            New template
          </Button>
        }
      />

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty icon={FileText} title="No templates yet" description="Create your first contract template to start generating contracts." />
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <div key={t.id} className="card p-5 flex items-center gap-4 flex-wrap">
              <div className="h-10 w-10 rounded-lg bg-ink-100 text-ink-700 grid place-items-center">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium text-ink-900">{t.name}</div>
                  <Badge tone="neutral">v{t.version}</Badge>
                  {t.isActive && <Badge tone="success">active</Badge>}
                </div>
                <div className="text-xs text-ink-500 mt-0.5">Created {fmtDateTime(t.createdAt)}</div>
              </div>
              <Button variant="outline" onClick={() => setPreview(t)}>Preview</Button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        width="xl"
        title="Create template"
        description="Write HTML. Use {{placeholder}} tokens for values filled at generation time."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={create} loading={creating}>Create template</Button>
          </>
        }
      >
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} hint="Creating a new version for the same name supersedes the previous active version." />
            <Textarea label="Body HTML" value={body} onChange={(e) => setBody(e.target.value)} rows={18} className="font-mono text-xs" />
            <div>
              <div className="label">Available placeholders</div>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((p) => (
                  <code
                    key={p}
                    className="px-1.5 py-0.5 bg-ink-100 text-ink-700 rounded text-xs cursor-pointer hover:bg-ink-200"
                    onClick={() => setBody((b) => b + ` {{${p}}}`)}
                  >
                    {`{{${p}}}`}
                  </code>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="label">Preview</div>
            <div className="card p-4 max-h-[60vh] overflow-auto prose prose-ink prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: body }} />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        width="xl"
        title={preview ? `${preview.name} · v${preview.version}` : ""}
      >
        {preview && (
          <div className="prose prose-ink prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: preview.bodyHtml }} />
        )}
      </Modal>
    </>
  );
}
