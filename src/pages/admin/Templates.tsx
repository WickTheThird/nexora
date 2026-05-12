// Contract templates - WYSIWYG editor + bulk-send.
//
// Editor: contentEditable div, no visible HTML tags. Toolbar buttons
// run document.execCommand under the hood so admins see formatted text
// (bold / heading / list) - never markup. Merge variables drop in as
// {{token}} text. A fullscreen toggle lets long agreements be edited
// without scrolling inside the modal.
//
// Bulk-send: per-template 'Send to subs' button opens a multi-select
// modal of approved subcontractors. Submit fires the single-sub
// generate-contract endpoint N times in parallel.

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ContractTemplate, Subcontractor } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { fmtDateTime } from "@/lib/format";
import {
  FilePlus, FileText, Bold, Italic, Underline, Heading1, Heading2,
  List, ListOrdered, Minus, Type, Send, Maximize2, Minimize2, X,
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
  const [fullscreen, setFullscreen] = useState(false);

  // contentEditable is uncontrolled - we initialise its innerHTML once on
  // mount (and after fullscreen remount) from bodyHtmlRef, then push every
  // input back into the body state so the live preview updates.
  const editorRef = useRef<HTMLDivElement | null>(null);
  const bodyHtmlRef = useRef(body);
  useEffect(() => { bodyHtmlRef.current = body; }, [body]);

  const setEditorEl = useCallback((el: HTMLDivElement | null) => {
    editorRef.current = el;
    if (el && el.innerHTML === "") {
      el.innerHTML = bodyHtmlRef.current;
    }
  }, []);

  const syncBody = () => {
    if (editorRef.current) setBody(editorRef.current.innerHTML);
  };

  const exec = (cmd: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    // execCommand is deprecated but the only zero-dependency way to drive a
    // contentEditable. Works across all currently shipping browsers.
    document.execCommand(cmd, false, value);
    syncBody();
  };

  const insertMergeVar = (token: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand("insertText", false, token);
    syncBody();
  };

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
      // Pull latest HTML straight from the editor in case the most recent
      // keystroke hasn't propagated to state yet.
      const html = editorRef.current?.innerHTML ?? body;
      await api.adminCreateTemplate(name.trim(), html);
      setCreateOpen(false);
      setFullscreen(false);
      setName("standard");
      setBody(SAMPLE);
      bodyHtmlRef.current = SAMPLE;
      await refresh();
      toast.success("Template created");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setFullscreen(false);
  };

  // The editor body content - shared between the modal and the fullscreen
  // overlay so toggling doesn't duplicate JSX. `key` on the editable div
  // forces a clean remount on fullscreen toggle (so its innerHTML is reset
  // from the up-to-date bodyHtmlRef).
  const editorBody = (
    <div className={fullscreen ? "grid lg:grid-cols-2 gap-6 h-full min-h-0" : "grid md:grid-cols-2 gap-4"}>
      <div className={`space-y-4 ${fullscreen ? "flex flex-col min-h-0" : ""}`}>
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="Creating a new version for the same name supersedes the previous active version."
        />

        <div className={fullscreen ? "flex-1 flex flex-col min-h-0" : ""}>
          <div className="label">Body</div>
          <div className="flex flex-wrap gap-1 mb-2 p-1 bg-ink-50 border border-ink-200 rounded-md">
            <ToolbarBtn icon={Bold} label="Bold (Ctrl+B)" onClick={() => exec("bold")} />
            <ToolbarBtn icon={Italic} label="Italic (Ctrl+I)" onClick={() => exec("italic")} />
            <ToolbarBtn icon={Underline} label="Underline (Ctrl+U)" onClick={() => exec("underline")} />
            <div className="w-px bg-ink-200 mx-1" />
            <ToolbarBtn icon={Heading1} label="Heading 1" onClick={() => exec("formatBlock", "<h1>")} />
            <ToolbarBtn icon={Heading2} label="Heading 2" onClick={() => exec("formatBlock", "<h2>")} />
            <ToolbarBtn icon={Type} label="Paragraph" onClick={() => exec("formatBlock", "<p>")} />
            <div className="w-px bg-ink-200 mx-1" />
            <ToolbarBtn icon={List} label="Bullet list" onClick={() => exec("insertUnorderedList")} />
            <ToolbarBtn icon={ListOrdered} label="Numbered list" onClick={() => exec("insertOrderedList")} />
            <ToolbarBtn icon={Minus} label="Divider" onClick={() => exec("insertHorizontalRule")} />
            <div className="flex-1" />
            <ToolbarBtn
              icon={fullscreen ? Minimize2 : Maximize2}
              label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => {
                // Sync state from the live editor BEFORE we unmount it,
                // otherwise the unmount drops the latest edits.
                syncBody();
                if (editorRef.current) bodyHtmlRef.current = editorRef.current.innerHTML;
                setFullscreen((v) => !v);
              }}
            />
          </div>
          <div
            key={fullscreen ? "fs" : "modal"}
            ref={setEditorEl}
            contentEditable
            suppressContentEditableWarning
            onInput={syncBody}
            onBlur={syncBody}
            className={
              "prose prose-ink prose-sm max-w-none input bg-white whitespace-pre-wrap " +
              (fullscreen ? "flex-1 min-h-0 overflow-auto" : "min-h-[24rem] max-h-[60vh] overflow-auto")
            }
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
                onClick={() => insertMergeVar(`{{${p}}}`)}
              >
                {`{{${p}}}`}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={fullscreen ? "flex flex-col min-h-0" : ""}>
        <div className="label">Preview</div>
        <div
          className={
            "card p-4 prose prose-ink prose-sm max-w-none overflow-auto " +
            (fullscreen ? "flex-1 min-h-0" : "max-h-[60vh]")
          }
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </div>
    </div>
  );

  const footerButtons = (
    <>
      <Button variant="ghost" onClick={closeCreate}>Cancel</Button>
      <Button variant="accent" onClick={create} loading={creating}>Create template</Button>
    </>
  );

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

      {/* Create modal (default, non-fullscreen state). */}
      {createOpen && !fullscreen && (
        <Modal
          open
          onClose={closeCreate}
          width="xl"
          title="Create template"
          footer={footerButtons}
        >
          {editorBody}
        </Modal>
      )}

      {/* Fullscreen editor - bypasses the Modal width cap. */}
      {createOpen && fullscreen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-ink-900">Create template</h2>
            <button
              onClick={closeCreate}
              className="text-ink-400 hover:text-ink-700 rounded-md p-1 hover:bg-ink-100 transition"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-6 min-h-0">{editorBody}</div>
          <div className="p-4 border-t border-ink-100 bg-ink-50/50 flex justify-end gap-2">
            {footerButtons}
          </div>
        </div>
      )}

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
      onMouseDown={(e) => e.preventDefault() /* keep selection in the editor */}
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
