import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2, Send, FileSpreadsheet, Edit3, MapPinned, Printer } from "lucide-react";

type SiteIdRow = Awaited<ReturnType<typeof api.listMyPrincipalSiteIds>>["items"][number];
type OperativeRow = Awaited<ReturnType<typeof api.listMyPrimarySubs>>["items"][number];

type JobCardType = "weekly" | "fortnightly" | "monthly";

// Derive periodStart from a job card type + date_ending. Mirrors the
// worker-side helper so the user sees the live window before submitting.
function deriveWindow(type: JobCardType, dateEnding: string): { from: string; to: string } | null {
  if (!dateEnding || !/^\d{4}-\d{2}-\d{2}$/.test(dateEnding)) return null;
  const days = type === "monthly" ? 27 : type === "fortnightly" ? 13 : 6;
  const end = new Date(dateEnding + "T00:00:00Z");
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: start.toISOString().slice(0, 10), to: dateEnding };
}

// Primary user submits payment data to BC. Two entry modes:
//  1. Manual table — enter rows by hand (good for a handful of subs)
//  2. CSV upload — Enagh-format columns (good for bulk)
//
// Either way the data lands at POST /me/primary/submissions, which creates
// a primary_submissions row + items. Admin gets emailed and processes
// from their inbox.

type Row = {
  subcontractorRef: string;
  subcontractorName: string;
  jobNumber: string;
  siteAddress: string;
  quantity: string;
  rate: string;
  materialValue: string;
  extras: string;
  notes: string;
};

const blankRow: Row = {
  subcontractorRef: "",
  subcontractorName: "",
  jobNumber: "",
  siteAddress: "",
  quantity: "",
  rate: "",
  materialValue: "",
  extras: "",
  notes: "",
};

function parseCsv(text: string): string[][] {
  // Minimal RFC 4180-ish: handles quoted fields with commas + doubled quotes.
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      cell += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(cell); cell = ""; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(cell); out.push(row); row = []; cell = ""; i++; continue; }
    cell += c; i++;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); out.push(row); }
  return out.filter(r => r.some(c => String(c).trim().length > 0));
}

function fmtMoneyEur(amountMinor: number): string {
  return `\u20AC${(amountMinor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PrimarySubmitPayment() {
  const toast = useToast();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<"manual" | "csv">("manual");

  // Default to "this calendar week" (Mon → today).
  const today = new Date();
  const day = today.getDay() || 7;
  const monday = new Date(today); monday.setDate(today.getDate() - (day - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  // Enagh Job Card model: type + date_ending drive the window. We keep the
  // explicit period inputs around as advanced/override but auto-fill from
  // the type+ending combo so the common case is one click.
  const [jobCardType, setJobCardType] = useState<JobCardType>("weekly");
  const [dateEnding, setDateEnding] = useState(iso(today));
  const [periodStart, setPeriodStart] = useState(iso(monday));
  const [periodEnd, setPeriodEnd] = useState(iso(today));
  const [notes, setNotes] = useState("");

  // Re-derive the window whenever type or dateEnding changes.
  useEffect(() => {
    const w = deriveWindow(jobCardType, dateEnding);
    if (w) { setPeriodStart(w.from); setPeriodEnd(w.to); }
  }, [jobCardType, dateEnding]);
  const [rows, setRows] = useState<Row[]>([{ ...blankRow }]);
  const [submitting, setSubmitting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  // Load the principal's managed Site IDs once, then bind a dropdown to
  // the per-row site field so the value submitted is always a real
  // registered SIN. Falls back to free text if no site IDs exist yet.
  const [sites, setSites] = useState<SiteIdRow[]>([]);
  const [sitesLoaded, setSitesLoaded] = useState(false);
  // Operatives — used for the Sub code dropdown and to auto-fill rate from
  // operative.standardRate when an operative is picked.
  const [operatives, setOperatives] = useState<OperativeRow[]>([]);
  // Job Card calculator config (VAT + Less Subs default) loaded from
  // /me/primary so we can render the live "Total to Pay BC" card without
  // hitting an admin-only endpoint.
  const [vatRatePercent, setVatRatePercent] = useState(13.5);
  const [lessSubsMinor, setLessSubsMinor] = useState(0);
  const [lessSubsOverride, setLessSubsOverride] = useState<string>("");
  // Principal trading name — printed in the blank Job Card header so the
  // sheet reads "<Principal name> — Job Card (weekly) — Period: …".
  const [principalName, setPrincipalName] = useState<string>("");
  useEffect(() => {
    (async () => {
      try {
        const r = await api.listMyPrincipalSiteIds();
        setSites(r.items);
      } finally {
        setSitesLoaded(true);
      }
    })();
    (async () => {
      try {
        const r = await api.listMyPrimarySubs();
        // Only show operatives that are 'approved' (Active in Enagh terms)
        // \u2014 inactive/incomplete ones shouldn't appear on a new job card.
        setOperatives(r.items.filter(o => o.onboardingStatus === "approved" || o.onboardingStatus === "active"));
      } catch { /* non-fatal — falls back to free-text sub code */ }
    })();
    (async () => {
      try {
        const r = await api.getMyPrimary();
        if (r.jobCardCalc) {
          setVatRatePercent(r.jobCardCalc.vatRatePercent ?? 13.5);
          setLessSubsMinor(r.jobCardCalc.lessSubsDefaultMinor ?? 0);
        }
        if (r.primary?.name) setPrincipalName(r.primary.name);
      } catch { /* non-fatal — keep defaults */ }
    })();
  }, []);

  // When an operative is chosen by code, auto-fill name + default rate
  // from the operative's standard rate. Existing rate value is overwritten
  // to match Enagh's behaviour (rate auto-populates from operative record).
  const onOperativePick = (i: number, code: string) => {
    setRows((prev) => prev.map((r, idx) => {
      if (idx !== i) return r;
      const op = operatives.find(o => o.subcontractorRef === code);
      if (!op) return { ...r, subcontractorRef: code };
      const standardEur = op.rateAmountMinor != null ? (op.rateAmountMinor / 100).toFixed(2) : r.rate;
      return {
        ...r,
        subcontractorRef: op.subcontractorRef || "",
        subcontractorName: op.fullName || "",
        rate: standardEur,
      };
    }));
  };

  useEffect(() => { setHint(null); }, [tab]);

  const updateRow = (i: number, field: keyof Row, val: string) => {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  };
  const addRow = () => setRows((prev) => [...prev, { ...blankRow }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const onCsvFile = (file: File) => {
    file.text().then((text) => {
      const all = parseCsv(text);
      if (all.length < 2) { toast.error("CSV is empty or missing data rows"); return; }
      const header = all[0].map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const idx = (...names: string[]) => {
        for (const n of names) {
          const i = header.indexOf(n.toLowerCase().replace(/[^a-z0-9]/g, ""));
          if (i >= 0) return i;
        }
        return -1;
      };
      const iCode = idx("SubcontractorCo", "SubcontractorCode", "SubRef");
      const iName = idx("Name", "Subcontractor", "SubName");
      const iJob  = idx("JobNumber", "Job", "Contract");
      const iQty  = idx("Quantity", "Hours", "Qty");
      const iRate = idx("Rate", "HourlyRate");
      const iMat  = idx("MaterialValue", "Material");
      const iExt  = idx("Extras", "Extra");
      const iSite = idx("SiteAddress", "Site");
      if (iCode < 0 || iQty < 0 || iRate < 0) {
        toast.error("CSV must have columns: SubcontractorCo, Quantity, Rate");
        return;
      }
      const parsed: Row[] = [];
      for (let r = 1; r < all.length; r++) {
        const row = all[r];
        const code = (row[iCode] || "").trim();
        if (!code || /^total$/i.test(code)) continue; // skip totals/empty
        parsed.push({
          subcontractorRef: code,
          subcontractorName: iName >= 0 ? (row[iName] || "").trim() : "",
          jobNumber: iJob >= 0 ? (row[iJob] || "").trim() : "",
          siteAddress: iSite >= 0 ? (row[iSite] || "").trim() : "",
          quantity: (row[iQty] || "0").trim(),
          rate: (row[iRate] || "0").trim(),
          materialValue: iMat >= 0 ? (row[iMat] || "0").trim() : "",
          extras: iExt >= 0 ? (row[iExt] || "0").trim() : "",
          notes: "",
        });
      }
      if (parsed.length === 0) { toast.error("No data rows found in CSV"); return; }
      setRows(parsed);
      setTab("manual"); // switch to the table so user can review
      setHint(`Loaded ${parsed.length} row(s) from ${file.name}. Review and submit below.`);
    }).catch(() => toast.error("Could not read file"));
  };

  // Live total preview (gross only — RCT is computed on the server).
  const totalGrossMinor = rows.reduce((s, r) => {
    const q = parseFloat(r.quantity) || 0;
    const rt = parseFloat(r.rate) || 0;
    const m = parseFloat(r.materialValue) || 0;
    const e = parseFloat(r.extras) || 0;
    return s + Math.round((q * rt + m + e) * 100);
  }, 0);

  // Print Blank Job Card — opens the browser print dialog with the hidden
  // .print-blank section visible. The pre-printed Operatives + Site IDs
  // reference tables let the user fill in rows by hand on-site without
  // having to remember any codes.
  const handlePrintBlank = () => {
    // Tiny delay lets React flush any pending state (date/type changes)
    // into the printable header before the dialog opens.
    setTimeout(() => window.print(), 50);
  };

  const submit = async () => {
    const cleaned = rows.filter(r => (r.subcontractorRef || "").trim().length > 0);
    if (cleaned.length === 0) { toast.error("Add at least one row with a subcontractor code"); return; }
    if (!confirm(`Submit ${cleaned.length} row${cleaned.length === 1 ? "" : "s"} to BC?\n\nTotal gross: ${fmtMoneyEur(totalGrossMinor)}\n\nBC will review and create payment advices for each matched subcontractor.`)) return;
    setSubmitting(true);
    try {
      const r = await api.createMySubmission({
        jobCardType,
        dateEnding: dateEnding || null,
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        notes: notes || null,
        source: tab === "csv" ? "csv" : "manual",
        items: cleaned.map(row => ({
          subcontractorRef: row.subcontractorRef,
          subcontractorName: row.subcontractorName || undefined,
          jobNumber: row.jobNumber || undefined,
          siteAddress: row.siteAddress || undefined,
          quantity: row.quantity || undefined,
          rate: row.rate || undefined,
          materialValue: row.materialValue || undefined,
          extras: row.extras || undefined,
          notes: row.notes || undefined,
        })),
      });
      toast.success(`Submitted to BC. Reference: ${r.id.slice(0, 8)}…`);
      nav(`/primary/submissions/${r.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Submit payment data"
        description="Send payment information to BC Construction. They'll review and issue payment advices to each matched subcontractor."
      />

      {/* Tab switcher */}
      <div className="flex gap-1 mb-5 border-b border-ink-200">
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 inline-flex items-center gap-2 ${tab === "manual" ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-700"}`}
        >
          <Edit3 className="h-4 w-4" /> Enter manually
        </button>
        <button
          type="button"
          onClick={() => setTab("csv")}
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 inline-flex items-center gap-2 ${tab === "csv" ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-700"}`}
        >
          <FileSpreadsheet className="h-4 w-4" /> Upload CSV
        </button>
      </div>

      {/* Nudge to manage Site IDs first \u2014 Enagh-style hard requirement */}
      {sitesLoaded && sites.length === 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4 text-sm text-amber-900 flex items-start gap-2">
          <MapPinned className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            You haven&apos;t added any Site IDs yet. Each row below will accept a free-text site reference, but{" "}
            <Link to="/primary/site-ids" className="underline font-medium">add your Revenue SIN codes here</Link>{" "}
            so the Site column becomes a clean dropdown for everyone using this form.
          </div>
        </div>
      )}

      {/* Job Card type + Date Ending (Enagh model). Period start/end are
          auto-derived but still editable as an override. */}
      <div className="card-padded mb-5">
        <div className="grid sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-ink-500 font-semibold">Job Card Type</label>
            <select
              className="mt-2 w-full px-3 py-2 text-sm rounded-md border border-ink-200 focus:border-ink-900 outline-none bg-white"
              value={jobCardType}
              onChange={(e) => setJobCardType(e.target.value as JobCardType)}
            >
              <option value="weekly">Weekly (1 week)</option>
              <option value="fortnightly">Fortnightly (2 weeks)</option>
              <option value="monthly">Monthly (4 weeks)</option>
            </select>
          </div>
          <Input label="Date Ending" type="date" value={dateEnding} onChange={(e) => setDateEnding(e.target.value)} hint="End date of this job card's period." />
          <Input label="Period start (auto)" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Park West phase 2" />
        </div>
      </div>

      {tab === "csv" && (
        <div className="card-padded mb-5">
          <p className="text-sm text-ink-600 mb-3">
            Upload a CSV with these columns:{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">SubcontractorCo</code>,{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">Quantity</code>,{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">Rate</code>. Optional:{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">Name</code>,{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">JobNumber</code>,{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">MaterialValue</code>,{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">Extras</code>,{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">SiteAddress</code>.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onCsvFile(f); e.target.value = ""; }}
            className="block text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-ink-100 file:text-ink-800 hover:file:bg-ink-200"
          />
          {hint && <p className="text-xs text-emerald-700 mt-2">{hint}</p>}
        </div>
      )}

      {/* Manual table — used both for direct entry and CSV review */}
      <div className="card overflow-x-auto mb-5">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 border-b border-ink-100">
            <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
              <th className="px-3 py-2">Sub code <span className="text-red-500">*</span></th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Job #</th>
              <th className="px-3 py-2">Site</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Material</th>
              <th className="px-3 py-2 text-right">Extras</th>
              <th className="px-3 py-2 text-right">Gross</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const q = parseFloat(row.quantity) || 0;
              const rt = parseFloat(row.rate) || 0;
              const m = parseFloat(row.materialValue) || 0;
              const e = parseFloat(row.extras) || 0;
              const grossMinor = Math.round((q * rt + m + e) * 100);
              return (
                <tr key={i} className="border-b border-ink-100 last:border-b-0">
                  <td className="px-2 py-2">
                    {operatives.length > 0 ? (
                      <select
                        className="w-full px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none font-mono bg-white"
                        value={row.subcontractorRef}
                        onChange={(e) => onOperativePick(i, e.target.value)}
                      >
                        <option value="">— Operative —</option>
                        {operatives.map((o) => (
                          <option key={o.id} value={o.subcontractorRef || ""}>
                            {o.subcontractorRef || "(no ref)"} {o.fullName ? `\u2014 ${o.fullName}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input className="w-full px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none font-mono" value={row.subcontractorRef} onChange={(e) => updateRow(i, "subcontractorRef", e.target.value)} placeholder="SUB-1004" />
                    )}
                  </td>
                  <td className="px-2 py-2"><input className="w-full px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none" value={row.subcontractorName} onChange={(e) => updateRow(i, "subcontractorName", e.target.value)} placeholder="Filip Bumbu" /></td>
                  <td className="px-2 py-2"><input className="w-full px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none" value={row.jobNumber} onChange={(e) => updateRow(i, "jobNumber", e.target.value)} placeholder="IE1136" /></td>
                  <td className="px-2 py-2">
                    {sites.length > 0 ? (
                      <select
                        className="w-full px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none bg-white"
                        value={row.siteAddress}
                        onChange={(e) => updateRow(i, "siteAddress", e.target.value)}
                      >
                        <option value="">— Site ID —</option>
                        {sites.map((s) => (
                          <option key={s.id} value={s.siteId}>
                            {s.siteId}{s.projectName ? ` \u2014 ${s.projectName}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input className="w-full px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none" value={row.siteAddress} onChange={(e) => updateRow(i, "siteAddress", e.target.value)} placeholder="Park West" />
                    )}
                  </td>
                  <td className="px-2 py-2"><input className="w-20 px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none text-right tabular-nums" value={row.quantity} onChange={(e) => updateRow(i, "quantity", e.target.value)} placeholder="0" /></td>
                  <td className="px-2 py-2"><input className="w-20 px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none text-right tabular-nums" value={row.rate} onChange={(e) => updateRow(i, "rate", e.target.value)} placeholder="0" /></td>
                  <td className="px-2 py-2"><input className="w-20 px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none text-right tabular-nums" value={row.materialValue} onChange={(e) => updateRow(i, "materialValue", e.target.value)} placeholder="0" /></td>
                  <td className="px-2 py-2"><input className="w-20 px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none text-right tabular-nums" value={row.extras} onChange={(e) => updateRow(i, "extras", e.target.value)} placeholder="0" /></td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium text-ink-700">{grossMinor > 0 ? fmtMoneyEur(grossMinor) : "—"}</td>
                  <td className="px-2 py-2 text-right">
                    {rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(i)} className="text-ink-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Calculate block (Enagh-style live totals). Reactive to every keystroke. */}
      {(() => {
        const overrideMinor = lessSubsOverride.trim()
          ? Math.round((parseFloat(lessSubsOverride) || 0) * 100)
          : null;
        const lessSubs = overrideMinor != null ? overrideMinor : lessSubsMinor;
        const vatMinor = Math.round(totalGrossMinor * vatRatePercent) / 100;
        // VAT% is a percent of gross; round to nearest cent.
        const vatAmt = Math.round((totalGrossMinor * vatRatePercent) / 100);
        const totalToPay = totalGrossMinor + vatAmt - lessSubs;
        return (
          <div className="card-padded mb-5 bg-ink-50/40">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 mb-4">Calculate</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-ink-600">Total Gross</span><span className="tabular-nums font-medium">{fmtMoneyEur(totalGrossMinor)}</span></div>
                <div className="flex justify-between"><span className="text-ink-600">Total to Certify to Revenue</span><span className="tabular-nums">{fmtMoneyEur(totalGrossMinor)}</span></div>
                <div className="flex justify-between">
                  <span className="text-ink-600">VAT @ {vatRatePercent}% on {fmtMoneyEur(totalGrossMinor)}</span>
                  <span className="tabular-nums">{fmtMoneyEur(vatAmt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-600">Less Subs</span>
                  <div className="flex items-center gap-1">
                    <span className="text-ink-500">{"\u20AC"}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={lessSubsOverride}
                      onChange={(e) => setLessSubsOverride(e.target.value)}
                      placeholder={(lessSubsMinor / 100).toFixed(2)}
                      className="w-24 px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none text-right tabular-nums"
                      title="Override the default Less Subs"
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-ink-900 text-white p-5 flex flex-col justify-center">
                <div className="text-[11px] uppercase tracking-wider text-ink-300 font-semibold mb-1">
                  Total to Pay BC
                </div>
                <div className="text-3xl font-bold tabular-nums">{fmtMoneyEur(totalToPay)}</div>
                <div className="text-xs text-ink-400 mt-2">
                  Recalculates as you type. This is what BC receives once you submit this Job Card.
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button variant="outline" onClick={addRow} leftIcon={<Plus className="h-4 w-4" />}>
            Add row
          </Button>
          <Button variant="ghost" onClick={handlePrintBlank} leftIcon={<Printer className="h-4 w-4" />}>
            Print blank Job Card
          </Button>
        </div>
        <Button variant="accent" onClick={submit} loading={submitting} leftIcon={<Send className="h-4 w-4" />}>
          Submit to BC
        </Button>
      </div>

      {/* Hidden printable Job Card. Off-screen normally; @media print
          hides the rest of the page and renders only this section. */}
      <style>{`
        .print-blank { position: absolute; left: -10000px; top: 0; width: 1px; height: 1px; overflow: hidden; }
        @media print {
          body * { visibility: hidden !important; }
          .print-blank, .print-blank * { visibility: visible !important; }
          .print-blank {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            padding: 16mm 14mm;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #111;
          }
          .print-blank h1 { font-size: 18pt; margin: 0 0 4pt 0; }
          .print-blank .pb-meta { font-size: 10pt; color: #444; margin-bottom: 12pt; }
          .print-blank table { width: 100%; border-collapse: collapse; font-size: 9pt; }
          .print-blank th, .print-blank td {
            border: 1px solid #888; padding: 5pt 6pt; text-align: left; vertical-align: top;
          }
          .print-blank th { background: #f0f0f0; font-weight: 600; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; }
          .print-blank td.num { text-align: right; font-variant-numeric: tabular-nums; }
          .print-blank .pb-section-title { font-size: 11pt; font-weight: 600; margin: 16pt 0 4pt 0; }
          .print-blank .pb-sig { margin-top: 24pt; display: flex; justify-content: space-between; font-size: 10pt; gap: 24pt; }
          .print-blank .pb-sig div { flex: 1; border-top: 1px solid #888; padding-top: 4pt; }
          @page { size: A4 landscape; margin: 0; }
        }
      `}</style>

      <div className="print-blank">
        <h1>{principalName || "Principal"} — Job Card</h1>
        <div className="pb-meta">
          Type: <strong>{jobCardType.charAt(0).toUpperCase() + jobCardType.slice(1)}</strong>
          {" \u00B7 "}Period: <strong>{periodStart || "—"}</strong> to <strong>{periodEnd || dateEnding || "—"}</strong>
          {" \u00B7 "}Date ending: <strong>{dateEnding || "—"}</strong>
        </div>

        {/* Blank entry grid — 15 rows for hand-fill on-site. */}
        <table>
          <thead>
            <tr>
              <th style={{ width: "11%" }}>Sub code</th>
              <th style={{ width: "16%" }}>Name</th>
              <th style={{ width: "9%" }}>Job #</th>
              <th style={{ width: "16%" }}>Site</th>
              <th style={{ width: "7%" }}>Qty</th>
              <th style={{ width: "8%" }}>Rate</th>
              <th style={{ width: "8%" }}>Material</th>
              <th style={{ width: "8%" }}>Extras</th>
              <th style={{ width: "9%" }}>Gross</th>
              <th style={{ width: "8%" }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 15 }).map((_, i) => (
              <tr key={i} style={{ height: "22pt" }}>
                <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                <td className="num">&nbsp;</td><td className="num">&nbsp;</td>
                <td className="num">&nbsp;</td><td className="num">&nbsp;</td>
                <td className="num">&nbsp;</td><td>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pre-printed Operatives reference */}
        {operatives.length > 0 && (
          <>
            <div className="pb-section-title">Operatives reference (your active subs)</div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "20%" }}>Sub code</th>
                  <th style={{ width: "55%" }}>Name</th>
                  <th style={{ width: "25%" }}>Standard rate</th>
                </tr>
              </thead>
              <tbody>
                {operatives.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: "monospace" }}>{o.subcontractorRef || "—"}</td>
                    <td>{o.fullName || "—"}</td>
                    <td className="num">
                      {o.rateAmountMinor != null
                        ? `\u20AC${(o.rateAmountMinor / 100).toFixed(2)}${o.rateUnit ? `/${o.rateUnit}` : ""}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Pre-printed Site IDs reference */}
        {sites.length > 0 && (
          <>
            <div className="pb-section-title">Site IDs reference</div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "18%" }}>SIN</th>
                  <th style={{ width: "32%" }}>Project</th>
                  <th style={{ width: "50%" }}>Address</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: "monospace" }}>{s.siteId}</td>
                    <td>{s.projectName || "—"}</td>
                    <td>{s.address || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="pb-sig">
          <div>Prepared by (name & signature)</div>
          <div>Date</div>
          <div>BC Construction stamp</div>
        </div>
      </div>
    </>
  );
}
