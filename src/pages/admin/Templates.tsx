// Contract templates - rich-ish editor + bulk-send.
//
// Editor: formatting toolbar above the body textarea so admins don't
// have to memorise HTML tags. Buttons wrap the current selection in
// the corresponding tag (Bold / Italic / Heading / List / Page break).
// Merge variables are pickable chips below. Live preview to the
// right via dangerouslySetInnerHTML.
//
// Bulk-send: per-template 'Send to subs' button opens a multi-select
// modal of approved subcontractors. Submit fires the existing single-
// sub generate-contract endpoint N times in parallel.

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ContractTemplate, Subcontractor } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { fmtDateTime } from "@/lib/format";
import {
  FilePlus, FileText, Bold, Italic, Underline, Heading1, Heading2,
  List, ListOrdered, Minus, Type, Send,
} from "lucide-react";

const PLACEHOLDERS = [
  "fullName","address1","address2","town","postcode","dob","placeOfBirth",
  "tel","mob","email","natureOfServices","workType","vatNumber","ppsNumber",
  "subcontractorRef","clientRef","date","rctRate",
];

const SAMPLE = `<h1>Subcontractor Services Agreement</h1>
<p><strong>Date:</strong> {{date}}</p>
<p>This agreement is between <strong>[Your Company Ltd]</strong> (the "Contractor") and <strong>{{fullName}}</strong> (the "Subcontractor"), of {{address1}}, {{town}}, {{postcode}}.</p>
<h2>1. Services</h2>
<p>The Subcontractor shall provide: {{natureOfServices}} ({{workType}}).</p>
<h2>2. Signature</h2>
<p>By signing below, the Subcontractor confirms they have read and agreed to this agreement.</p>`;

// Wrap the current textarea selection in the given tag pair.
// Falls back to appending the wrapper at the cursor if nothing
// is selected.
function wrapSelection(
  ref: HTMLTextAreaElement | null,
  openTag: string,
  closeTag: string,
  setBody: (b: string) => void,
) {
  if (!ref) return;
  const { selectionStart: s, selectionEnd: e, value } = ref;
  const before = value.slice(0, s);
  const sel = value.slice(s, e) || "text";
  const after = value.slice(e);
  setBody(before + openTag + sel + closeTag + after);
  // Restore caret roughly after the wrapped content.
  requestAnimationFrame(() => {
    ref.focus();
    ref.setSelectionRange(s + openTag.length, s + openTag.length + sel.length);
  });
}

function insertAtCaret(
  ref: HTMLTextAreaElement | null,
  text: string,
  setBody: (b: string) => void,
) {
  if (!ref) return;
  const { selectionStart: s, value } = ref;
  const next = value.slice(0, s) + text + value.slice(ref.selectionEnd);
  setBody(next);
  requestAnimationFrame(() => {
    ref.focus();
    ref.setSelectionRange(s + text.length, s + text.length);
  });
}

export function Templates() {
  const toast = useToast();
  const [items, setItems] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("standard");
  const [body, setBody] = useState(SAMPLE);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<ContractTemplate | null>(null);
  const [sending, setSending] = useState<ContractTemplate | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

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
              <Button variant="accent" onClick={() => setSending(t)} leftIcon={<Send className="h-4 w-4" />}>
                Send to subs
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        width="xl"
        title="Create template"
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

            {/* Formatting toolbar - all buttons wrap the current
                selection in the corresponding HTML tag. No external
                editor library so the bundle stays slim. */}
            <div>
              <div className="label">Body</div>
              <div className="flex flex-wrap gap-1 mb-2 p-1 bg-ink-50 border border-ink-200 rounded-md">
                <ToolbarBtn icon={Bold} label="Bold (Ctrl+B)" onClick={() => wrapSelection(bodyRef.current, "<strong>", "</strong>", setBody)} />
                <ToolbarBtn icon={Italic} label="Italic" onClick={() => wrapSelection(bodyRef.current, "<em>", "</em>", setBody)} />
                <ToolbarBtn icon={Underline} label="Underline" onClick={() => wrapSelection(bodyRef.current, "<u>", "</u>", setBody)} />
                <div className="w-px bg-ink-200 mx-1" />
                <ToolbarBtn icon={Heading1} label="Heading 1" onClick={() => wrapSelection(bodyRef.current, "<h1>", "</h1>", setBody)} />
                <ToolbarBtn icon={Heading2} label="Heading 2" onClick={() => wrapSelection(bodyRef.current, "<h2>", "</h2>", setBody)} />
                <ToolbarBtn icon={Type} label="Paragraph" onClick={() => wrapSelection(bodyRef.current, "<p>", "</p>", setBody)} />
                <div className="w-px bg-ink-200 mx-1" />
                <ToolbarBtn icon={List} label="Bullet list" onClick={() => wrapSelection(bodyRef.current, "<ul>\n  <li>", "</li>\n</ul>", setBody)} />
                <ToolbarBtn icon={ListOrdered} label="Numbered list" onClick={() => wrapSelection(bodyRef.current, "<ol>\n  <li>", "</li>\n</ol>", setBody)} />
                <ToolbarBtn icon={Minus} label="Page break / divider" onClick={() => insertAtCaret(bodyRef.current, "\n<hr />\n", setBody)} />
              </div>
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={18}
                className="input font-mono text-xs"
                onKeyDown={(e) => {
                  // Ctrl/Cmd+B and Ctrl/Cmd+I shortcuts so the editor
                  // feels remotely like a word processor.
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
                    e.preventDefault();
                    wrapSelection(bodyRef.current, "<strong>", "</strong>", setBody);
                  }
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
                    e.preventDefault();
                    wrapSelection(bodyRef.current, "<em>", "</em>", setBody);
                  }
                }}
              />
            </div>

            <div>
              <div className="label">Click to insert merge variable</div>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((p) => (
                  <button
                    type="button"
                    key={p}
                    className="px-1.5 py-0.5 bg-ink-100 text-ink-700 rounded text-xs hover:bg-ink-200 font-mono"
                    onClick={() => insertAtCaret(bodyRef.current, `{{${p}}}`, setBody)}
                  >
                    {`{{${p}}}`}
                  </button>
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

      <BulkSendModal
        template={sending}
        onClose={() => setSending(null)}
      />
    </>
  );
}

function ToolbarBtn({
  icon: Icon, label, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="h-7 w-7 grid place-items-center rounded text-ink-600 hover:bg-white hover:text-ink-900 transition"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

// Bulk-send: pick a multi-select of subs, fire generateContract N
// times in parallel (Promise.allSettled so one failure doesn't block
// the rest). Result count surfaced via toast.
function BulkSendModal({
  template, onClose,
}: {
  template: ContractTemplate | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!template) return;
    let cancelled = false;
    setLoading(true);
    setPicked(new Set());
    api.adminListSubcontractors({ limit: 500 })
      .then(r => { if (!cancelled) setSubs(r.items); })
      .catch(() => { /* non-fatal */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [template]);

  const visible = subs.filter(s => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (s.fullName || "").toLowerCase().includes(q) ||
           (s.email || "").toLowerCase().includes(q) ||
           (s.subcontractorRef || "").toLowerCase().includes(q);
  });

  const toggle = (id: string) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectAll = () => setPicked(new Set(visible.map(s => s.id)));
  const clearPicked = () => setPicked(new Set());

  const send = async () => {
    if (!template || picked.size === 0) return;
    if (!window.confirm(`Generate ${template.name} v${template.version} contract for ${picked.size} sub${picked.size === 1 ? "" : "s"}?`)) return;
    setSending(true);
    const results = await Promise.allSettled(
      Array.from(picked).map(id => api.adminGenerateContract(id, template.id)),
    );
    const ok = results.filter(r => r.status === "fulfilled").length;
    const failed = results.length - ok;
    toast.success(`Generated ${ok} contract${ok === 1 ? "" : "s"}.${failed ? ` ${failed} failed (sub may not have submitted onboarding yet).` : ""}`);
    setSending(false);
    onClose();
  };

  return (
    <Modal
      open={!!template}
      onClose={onClose}
      width="lg"
      title={template ? `Send ${template.name} v${template.version} to subs` : ""}
      description="Picks subs and generates a personalised contract for each. Subs must have completed onboarding (submitted_at not null) - others will be skipped with a failure toast."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="accent"
            onClick={send}
            loading={sending}
            disabled={picked.size === 0}
            leftIcon={<Send className="h-4 w-4" />}
          >
            Send to {picked.size} sub{picked.size === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="Search"
          placeholder="Name, email, sub code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <div className="text-xs text-ink-500">{picked.size} picked / {visible.length} visible</div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>Select all visible</Button>
            {picked.size > 0 && <Button variant="ghost" size="sm" onClick={clearPicked}>Clear</Button>}
          </div>
        </div>
        {loading ? (
          <div className="skeleton h-48" />
        ) : visible.length === 0 ? (
          <p className="text-sm text-ink-500 py-4 text-center">No subcontractors match.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto border border-ink-200 rounded-md divide-y divide-ink-100">
            {visible.map(s => (
              <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-ink-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={picked.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="h-4 w-4 rounded border-ink-300"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink-900 truncate">{s.fullName || s.email || s.id.slice(0,8)}</div>
                  <div className="text-[11px] text-ink-500 truncate">
                    {[s.subcontractorRef, s.email, s.onboardingStatus].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
