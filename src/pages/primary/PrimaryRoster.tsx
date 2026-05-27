import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import type { RosterEntry } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { parseRosterCsv, type RosterRow } from "@/lib/rosterCsv";
import * as XLSX from "xlsx";
import { Users, UserPlus, Upload, Trash2, FileSpreadsheet, Pencil } from "lucide-react";

// The principal's worker roster.
//
//   - Add a worker: PPS + email + name. No need for the worker to have a
//     sub account first; we'll auto-link when they sign up + are approved.
//   - Bulk add via CSV: flexible parser detects PPS / email / name
//     columns by content shape.
//   - We never depend on the worker having an account. Invoices and
//     payment advices are emailed to the email on the roster entry.

export function PrimaryRoster() {
  const toast = useToast();
  const [items, setItems] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [editing, setEditing] = useState<RosterEntry | null>(null);

  const refresh = async () => {
    try {
      const r = await api.primaryListRoster();
      setItems(r.items);
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = items.filter((it) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      it.name.toLowerCase().includes(q) ||
      it.email.toLowerCase().includes(q) ||
      it.ppsMasked.toLowerCase().includes(q)
    );
  });

  const remove = async (id: string) => {
    if (!window.confirm("Remove this worker from your roster?")) return;
    try {
      await api.primaryDeleteRosterEntry(id);
      toast.success("Removed");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  return (
    <>
      <PageHeader
        title="Subcontractors"
        right={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCsvOpen(true)} leftIcon={<Upload className="h-4 w-4" />}>
              Import CSV
            </Button>
            <Button variant="accent" onClick={() => setAddOpen(true)} leftIcon={<UserPlus className="h-4 w-4" />}>
              Add subcontractor
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <Input
          placeholder="Search by name, email, or PPS"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="skeleton h-64" />
      ) : filtered.length === 0 ? (
        <Empty
          icon={Users}
          title={items.length === 0 ? "No subcontractors yet" : "No matches"}
          description={
            items.length === 0
              ? "Add your workers by entering their PPS + email + name, or upload a CSV."
              : "Try a different search."
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">PPS</th>
                <th className="px-5 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/40">
                  <td className="px-5 py-3 font-medium text-ink-900">{it.name}</td>
                  <td className="px-5 py-3 text-ink-700">{it.email}</td>
                  <td className="px-5 py-3 font-mono text-xs text-ink-600">{it.ppsMasked}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(it)}
                        className="text-ink-400 hover:text-ink-900 p-1"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(it.id)}
                        className="text-ink-400 hover:text-red-700 p-1"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddSubModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={async () => {
          await refresh();
        }}
      />

      <CsvImportModal
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        onImported={async () => {
          await refresh();
        }}
      />

      <EditSubModal
        entry={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await refresh();
        }}
      />
    </>
  );
}

function EditSubModal({ entry, onClose, onSaved }: {
  entry: RosterEntry | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [pps, setPps] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (entry) {
      setPps("");           // blank means "don't change PPS" (we never expose the real PPS in UI)
      setEmail(entry.email);
      setName(entry.name);
    }
  }, [entry]);

  if (!entry) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const patch: { pps?: string; email?: string; name?: string } = {};
      if (pps.trim()) patch.pps = pps.trim().toUpperCase();
      if (email.trim() !== entry.email) patch.email = email.trim().toLowerCase();
      if (name.trim() !== entry.name) patch.name = name.trim();
      if (Object.keys(patch).length === 0) {
        onClose();
        return;
      }
      await api.primaryUpdateRosterEntry(entry.id, patch);
      toast.success("Updated");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!entry}
      onClose={onClose}
      title="Edit subcontractor"
      description={`Update PPS / email / name for ${entry.name}. PPS is currently masked as ${entry.ppsMasked}; type a new value only if you need to correct it.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="accent" onClick={submit} loading={busy}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="PPS number (leave blank to keep current)"
          value={pps}
          onChange={(e) => setPps(e.target.value.toUpperCase())}
          placeholder={entry.ppsMasked}
          hint="7 digits + 1 or 2 letters. Only fill if correcting a typo."
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function AddSubModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => Promise<void> }) {
  const toast = useToast();
  const [pps, setPps] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setPps(""); setEmail(""); setName(""); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.primaryAddRosterEntry({ pps: pps.trim().toUpperCase(), email: email.trim().toLowerCase(), name: name.trim() });
      toast.success("Added");
      reset();
      onClose();
      await onAdded();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add subcontractor"
      description="Enter their PPS number, email and name. They don't need an account yet - we'll link them automatically when they sign up."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="accent" onClick={submit} loading={busy}>Add</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <Input
          label="PPS number"
          required
          autoFocus
          value={pps}
          onChange={(e) => setPps(e.target.value.toUpperCase())}
          placeholder="1234567A"
          hint="7 digits followed by 1 or 2 letters"
        />
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="worker@example.ie"
        />
        <Input
          label="Full name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Aoife Kelly"
        />
      </form>
    </Modal>
  );
}

function CsvImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => Promise<void> }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [good, setGood] = useState<RosterRow[]>([]);
  const [bad, setBad] = useState<Array<{ rowIndex: number; raw: string[]; issue: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState<{ added: number; skipped: Array<{ pps: string; reason: string }> } | null>(null);

  const reset = () => {
    setGood([]);
    setBad([]);
    setImported(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onClosed = () => {
    reset();
    onClose();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImported(null);
    try {
      // .xlsx / .xls handled via SheetJS - convert the first sheet to
      // CSV text, then let parseRosterCsv do the column detection.
      // Most people upload spreadsheets straight from Excel/Numbers
      // without thinking about file format.
      const isExcel =
        /\.(xlsx|xls)$/i.test(f.name) ||
        f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        f.type === "application/vnd.ms-excel";
      let text: string;
      if (isExcel) {
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) {
          setBad([{ rowIndex: 0, raw: [], issue: "Workbook has no sheets." }]);
          setGood([]);
          return;
        }
        text = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
      } else {
        text = await f.text();
      }
      const r = parseRosterCsv(text);
      setGood(r.good);
      setBad(r.bad);
    } catch (err) {
      setBad([{ rowIndex: 0, raw: [], issue: `Couldn't read file: ${err instanceof Error ? err.message : String(err)}` }]);
      setGood([]);
    }
  };

  const importNow = async () => {
    if (good.length === 0) return;
    setBusy(true);
    try {
      const r = await api.primaryImportRoster(good);
      setImported(r);
      toast.success(`Added ${r.added} worker${r.added === 1 ? "" : "s"}`);
      await onImported();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClosed}
      title="Import subcontractors"
      description="Upload a CSV or Excel file (.xlsx / .xls) with PPS, email and name. Column order doesn't matter; we'll detect them automatically. Names can be one column (Full Name) or split (First + Last)."
      footer={
        <>
          <Button variant="ghost" onClick={onClosed} disabled={busy}>Close</Button>
          {good.length > 0 && !imported && (
            <Button variant="accent" onClick={importNow} loading={busy}>
              Import {good.length} row{good.length === 1 ? "" : "s"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={onFile}
            className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-ink-900 file:text-white file:text-xs file:font-medium hover:file:bg-ink-800"
          />
          <p className="text-xs text-ink-500 mt-2">
            <FileSpreadsheet className="h-3 w-3 inline mr-1" />
            Required content: PPS number, email, name. Anything else is ignored.
          </p>
        </div>

        {imported && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm">
            <strong className="text-emerald-900">Done.</strong> Added {imported.added}.
            {imported.skipped.length > 0 && (
              <>
                {" "}Skipped {imported.skipped.length} (already on roster or invalid):
                <ul className="mt-1 text-xs text-emerald-900/80 list-disc pl-5">
                  {imported.skipped.map((s, i) => (
                    <li key={i}><span className="font-mono">{s.pps}</span> - {s.reason}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {good.length > 0 && !imported && (
          <div>
            <h4 className="text-xs uppercase tracking-wider text-emerald-700 font-semibold mb-1">
              {good.length} valid row{good.length === 1 ? "" : "s"}
            </h4>
            <div className="border border-ink-100 rounded-md max-h-48 overflow-auto">
              <table className="w-full text-xs">
                <tbody>
                  {good.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-b border-ink-100 last:border-b-0">
                      <td className="px-3 py-1.5 font-mono">{r.pps}</td>
                      <td className="px-3 py-1.5">{r.email}</td>
                      <td className="px-3 py-1.5">{r.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {good.length > 50 && (
              <p className="text-xs text-ink-400 mt-1">…and {good.length - 50} more.</p>
            )}
          </div>
        )}

        {bad.length > 0 && (
          <div>
            <h4 className="text-xs uppercase tracking-wider text-red-700 font-semibold mb-1">
              {bad.length} row{bad.length === 1 ? "" : "s"} need fixing
            </h4>
            <div className="border border-red-200 rounded-md max-h-40 overflow-auto bg-red-50/50">
              <table className="w-full text-xs">
                <tbody>
                  {bad.slice(0, 30).map((r, i) => (
                    <tr key={i} className="border-b border-red-100 last:border-b-0">
                      <td className="px-3 py-1.5 text-red-700">Line {r.rowIndex}</td>
                      <td className="px-3 py-1.5 text-red-700 italic">{r.issue}</td>
                      <td className="px-3 py-1.5 font-mono text-ink-600 truncate">{r.raw.join(" | ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink-500 mt-1">Fix these in your file and re-upload, or import the valid rows now and address the rest manually.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
