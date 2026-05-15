import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2, Send, FileSpreadsheet, Edit3, MapPinned, Printer, Save, Calculator, Phone, Mail, ArrowLeft, Download } from "lucide-react";

type SiteIdRow = Awaited<ReturnType<typeof api.listMyPrincipalSiteIds>>["items"][number];
type OperativeRow = Awaited<ReturnType<typeof api.listMyPrimarySubs>>["items"][number];

type JobCardType = "weekly" | "fortnightly" | "monthly";

// Enagh's three-step Job Card flow:
//   Save      - persists as status='draft'. Editable. No admin notification.
//   Calculate - recomputes the totals panel (in our impl this is live, but
//               we keep the button as an explicit user action so the muscle
//               memory matches Enagh).
//   Submit    - flips status='draft'→'submitted', LOCKS the card (no further
//               edits), notifies admin, emails the principal a confirmation
//               of the submission.
//
// Form auto-lists every Active operative as a row (Enagh parity). Principal
// just fills Qty + selects Site for each one. Rate auto-fills from the
// operative's standard_rate. Operative cannot be removed from the row set,
// only zeroed out (Qty=0 means they didn't work this period).

function deriveWindow(type: JobCardType, dateEnding: string): { from: string; to: string } | null {
  if (!dateEnding || !/^\d{4}-\d{2}-\d{2}$/.test(dateEnding)) return null;
  const days = type === "monthly" ? 27 : type === "fortnightly" ? 13 : 6;
  const end = new Date(dateEnding + "T00:00:00Z");
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: start.toISOString().slice(0, 10), to: dateEnding };
}

type Row = {
  // Frozen identity (from auto-list); kept on the row so re-fetches don't
  // wipe the user's typed-in numbers.
  operativeId: string;
  subcontractorRef: string;
  subcontractorName: string;
  // User-editable per-period fields.
  jobNumber: string;
  siteAddress: string;
  quantity: string;
  rate: string;
  materialValue: string;
  extras: string;
  notes: string;
  // RCT rate selected by the principal for this row. Defaults to the
  // sub's recorded rate (sub.rctRate). Persisted to the submission
  // item; admin uses it when generating the payment. Only the three
  // legal Irish RCT bands are valid.
  rctRate: "" | "0" | "20" | "35";
};

function operativeToRow(o: OperativeRow): Row {
  return {
    operativeId: o.id,
    subcontractorRef: o.subcontractorRef || "",
    subcontractorName: o.fullName || "",
    jobNumber: "",
    siteAddress: "",
    quantity: "0",
    rate: o.rateAmountMinor != null ? (o.rateAmountMinor / 100).toFixed(2) : "0",
    materialValue: "0",
    extras: "0",
    notes: "",
    // Default the dropdown to whatever's set on the sub (typed via the
    // sub onboarding / admin patch). Empty string = "not picked yet"
    // so the dropdown shows the placeholder option.
    rctRate: (o.rctRate as "0" | "20" | "35") ?? "",
  };
}

function parseCsv(text: string): string[][] {
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
  const { id: editDraftId } = useParams<{ id: string }>(); // when present we're editing a draft
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<"manual" | "csv">("manual");

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [jobCardType, setJobCardType] = useState<JobCardType>("weekly");
  const [dateEnding, setDateEnding] = useState(iso(today));
  const [periodStart, setPeriodStart] = useState(iso(today));
  const [periodEnd, setPeriodEnd] = useState(iso(today));
  const [notes, setNotes] = useState("");
  // (RCT rate no longer a principal concern - BC applies it from the
  // sub's recorded Revenue rate when processing the Job Card.)

  // Marketplace audience / tender post was decommissioned. A Job Card
  // is now always 'internal' - a record of completed work that will be
  // billed via two BC-issued invoices (labour pass-through + service
  // fee). No public_jobs side-effect.

  useEffect(() => {
    const w = deriveWindow(jobCardType, dateEnding);
    if (w) { setPeriodStart(w.from); setPeriodEnd(w.to); }
  }, [jobCardType, dateEnding]);

  const [rows, setRows] = useState<Row[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const [sites, setSites] = useState<SiteIdRow[]>([]);
  const [sitesLoaded, setSitesLoaded] = useState(false);
  const [operatives, setOperatives] = useState<OperativeRow[]>([]);
  const [vatRatePercent, setVatRatePercent] = useState(13.5);
  const [lessSubsMinor, setLessSubsMinor] = useState(0);
  const [lessSubsOverride, setLessSubsOverride] = useState<string>("");
  const [principalName, setPrincipalName] = useState<string>("");
  const [draftId, setDraftId] = useState<string | null>(editDraftId || null);
  // The "Calculate" button toggles a recompute timestamp so the totals panel
  // updates with a brief visual flash. (Calc is otherwise live.)
  const [calcTick, setCalcTick] = useState(0);

  // Initial load: site IDs + operatives + jobCardCalc + (if editing) draft.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, ops, prim] = await Promise.all([
          api.listMyPrincipalSiteIds(),
          api.listMyPrimarySubs(),
          api.getMyPrimary(),
        ]);
        if (cancelled) return;
        setSites(s.items);
        setSitesLoaded(true);
        // Active operatives only (Enagh: only Active appear on Job Card).
        //   - Closed ones (closedAt non-null) excluded.
        //   - Proposed pairings excluded - principal must accept first.
        const active = ops.items.filter(o =>
          (o.onboardingStatus === "approved" || o.onboardingStatus === "active") &&
          !o.closedAt &&
          o.primaryLinkStatus !== "proposed" && o.primaryLinkStatus !== "declined"
        );
        setOperatives(active);
        if (prim.jobCardCalc) {
          setVatRatePercent(prim.jobCardCalc.vatRatePercent ?? 13.5);
          setLessSubsMinor(prim.jobCardCalc.lessSubsDefaultMinor ?? 0);
        }
        if (prim.primary?.name) setPrincipalName(prim.primary.name);

        if (editDraftId) {
          const dr = await api.getMySubmission(editDraftId);
          if (dr.submission.status !== "draft") {
            toast.error("This Job Card is locked and can't be edited.");
            nav(`/primary/submissions/${editDraftId}`);
            return;
          }
          // Hydrate the form from the draft.
          if (dr.submission.jobCardType) setJobCardType(dr.submission.jobCardType);
          if (dr.submission.dateEnding) setDateEnding(dr.submission.dateEnding);
          if (dr.submission.periodStart) setPeriodStart(dr.submission.periodStart);
          if (dr.submission.periodEnd) setPeriodEnd(dr.submission.periodEnd);
          if (dr.submission.notes) setNotes(dr.submission.notes);
          // Map saved items back to rows. Match each item to its operative
          // by ref so frozen identity columns stay correct.
          const byRef = new Map(active.map(o => [o.subcontractorRef || "", o]));
          const hydrated: Row[] = active.map(op => {
            const saved = dr.items.find(it => it.subcontractorRef === op.subcontractorRef);
            return saved ? {
              operativeId: op.id,
              subcontractorRef: op.subcontractorRef || "",
              subcontractorName: op.fullName || "",
              jobNumber: saved.jobNumber || "",
              siteAddress: saved.siteAddress || "",
              quantity: String(saved.quantity ?? ""),
              rate: saved.rateMinor != null ? (saved.rateMinor / 100).toFixed(2) : (op.rateAmountMinor != null ? (op.rateAmountMinor/100).toFixed(2) : "0"),
              materialValue: saved.materialValueMinor != null ? (saved.materialValueMinor / 100).toFixed(2) : "0",
              extras: saved.extrasMinor != null ? (saved.extrasMinor / 100).toFixed(2) : "0",
              notes: saved.notes || "",
              rctRate: (saved.rctRate as "0" | "20" | "35") ?? (op.rctRate as "0" | "20" | "35") ?? "",
            } : operativeToRow(op);
          });
          // Items that didn't match an active operative (e.g. operative
          // since deactivated) - keep as ad-hoc rows so the user doesn't
          // lose data.
          const adhoc: Row[] = dr.items
            .filter(it => !byRef.has(it.subcontractorRef || ""))
            .map(it => ({
              operativeId: "",
              subcontractorRef: it.subcontractorRef || "",
              subcontractorName: it.subcontractorName || "",
              jobNumber: it.jobNumber || "",
              siteAddress: it.siteAddress || "",
              quantity: String(it.quantity ?? ""),
              rate: it.rateMinor != null ? (it.rateMinor / 100).toFixed(2) : "0",
              materialValue: it.materialValueMinor != null ? (it.materialValueMinor / 100).toFixed(2) : "0",
              extras: it.extrasMinor != null ? (it.extrasMinor / 100).toFixed(2) : "0",
              notes: it.notes || "",
              rctRate: (it.rctRate as "0" | "20" | "35") ?? "",
            }));
          setRows([...hydrated, ...adhoc]);
        } else {
          // Fresh form: auto-list every active operative as a row.
          setRows(active.map(operativeToRow));
        }
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Failed to load form");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editDraftId]);

  useEffect(() => { setHint(null); }, [tab]);

  const updateRow = (i: number, field: keyof Row, val: string) => {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  };
  const addAdhocRow = () => setRows((prev) => [...prev, {
    operativeId: "", subcontractorRef: "", subcontractorName: "",
    jobNumber: "", siteAddress: "", quantity: "0", rate: "0",
    materialValue: "0", extras: "0", notes: "", rctRate: "",
  }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  // CSV upload - overwrites Qty/Rate per matching SUB ref. Doesn't add
  // ad-hoc rows; the auto-listed roster is the source of truth.
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
      const iQty  = idx("Quantity", "Hours", "Qty");
      const iRate = idx("Rate", "HourlyRate");
      const iMat  = idx("MaterialValue", "Material");
      const iExt  = idx("Extras", "Extra");
      const iSite = idx("SiteAddress", "Site");
      const iJob  = idx("JobNumber", "Job", "Contract");
      if (iCode < 0 || iQty < 0) {
        toast.error("CSV must have columns: SubcontractorCo, Quantity (and optionally Rate)");
        return;
      }
      const overrides = new Map<string, Partial<Row>>();
      for (let r = 1; r < all.length; r++) {
        const row = all[r];
        const code = (row[iCode] || "").trim();
        if (!code || /^total$/i.test(code)) continue;
        overrides.set(code.toLowerCase(), {
          quantity: (row[iQty] || "0").trim(),
          rate: iRate >= 0 ? (row[iRate] || "0").trim() : undefined,
          materialValue: iMat >= 0 ? (row[iMat] || "0").trim() : undefined,
          extras: iExt >= 0 ? (row[iExt] || "0").trim() : undefined,
          siteAddress: iSite >= 0 ? (row[iSite] || "").trim() : undefined,
          jobNumber: iJob >= 0 ? (row[iJob] || "").trim() : undefined,
        });
      }
      let hits = 0;
      setRows(prev => prev.map(r => {
        const o = overrides.get((r.subcontractorRef || "").toLowerCase());
        if (!o) return r;
        hits++;
        return { ...r, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) } as Row;
      }));
      setTab("manual");
      setHint(`Applied ${hits} of ${overrides.size} CSV row(s) to your operative roster.`);
    }).catch(() => toast.error("Could not read file"));
  };

  // Live totals (Enagh: same numbers, just driven by typing rather than
  // "Calculate" button. The Calculate button is still here for users who
  // expect to click it - it just animates the totals panel.)
  const totals = useMemo(() => {
    const totalGrossMinor = rows.reduce((s, r) => {
      const q = parseFloat(r.quantity) || 0;
      const rt = parseFloat(r.rate) || 0;
      const m = parseFloat(r.materialValue) || 0;
      const e = parseFloat(r.extras) || 0;
      return s + Math.round((q * rt + m + e) * 100);
    }, 0);
    const overrideMinor = lessSubsOverride.trim()
      ? Math.round((parseFloat(lessSubsOverride) || 0) * 100)
      : null;
    const lessSubs = overrideMinor != null ? overrideMinor : lessSubsMinor;
    const vatAmt = Math.round((totalGrossMinor * vatRatePercent) / 100);
    // RCT-applicable construction services are subject to VAT REVERSE-CHARGE
    // under VATCA s.16(2): the principal accounts for the VAT themselves on
    // their VAT3 return. So BC's invoice to the principal does NOT include
    // VAT in the total. The VAT figure is shown informationally only.
    const totalToPay = totalGrossMinor - lessSubs;
    return { totalGrossMinor, vatAmt, lessSubs, totalToPay };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, lessSubsOverride, lessSubsMinor, vatRatePercent, calcTick]);

  const handlePrintBlank = () => {
    setTimeout(() => window.print(), 50);
  };

  // Build the items[] payload from current rows. Filters out zero-qty rows
  // for SUBMIT (no point sending empty advices) but keeps everything for
  // SAVE (drafts are scratch work).
  const buildItems = (filterEmpty: boolean) => rows
    .filter(r => filterEmpty
      ? ((parseFloat(r.quantity) || 0) > 0 && (r.subcontractorRef || "").trim().length > 0)
      : true)
    .map(row => ({
      subcontractorRef: row.subcontractorRef,
      subcontractorName: row.subcontractorName || undefined,
      jobNumber: row.jobNumber || undefined,
      siteAddress: row.siteAddress || undefined,
      quantity: row.quantity || undefined,
      rate: row.rate || undefined,
      rctRate: row.rctRate || undefined,
      materialValue: row.materialValue || undefined,
      extras: row.extras || undefined,
      notes: row.notes || undefined,
    }));

  // A3 hardening: send the user-seen totals so the server can validate
  // that the user agreed to exactly THIS Total to Pay BC (within ±€0.05).
  const totalsPayload = () => ({
    vatAmountMinor: totals.vatAmt,
    lessSubsAppliedMinor: totals.lessSubs,
    totalToPayBcMinor: totals.totalToPay,
  });

  // Save as draft. Creates if no draftId, updates existing draft otherwise.
  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      const items = buildItems(false);
      if (draftId) {
        await api.updateMyDraftSubmission(draftId, {
          jobCardType, dateEnding, periodStart, periodEnd, notes: notes || null, items,
        });
        toast.success("Draft saved");
      } else {
        const r = await api.createMySubmission({
          jobCardType, dateEnding, periodStart, periodEnd,
          notes: notes || null, status: "draft",
          source: tab === "csv" ? "csv" : "manual",
          items,
          ...totalsPayload(),
        });
        setDraftId(r.id);
        nav(`/primary/submissions/${r.id}/edit`, { replace: true });
        toast.success("Draft saved");
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSavingDraft(false);
    }
  };

  const recalculate = () => {
    setCalcTick(t => t + 1);
    toast.info(`Recalculated - Total to Pay BC: ${fmtMoneyEur(totals.totalToPay)}`);
  };

  // Submit (lock + notify + auto-invoice on admin process).
  const submitJobCard = async () => {
    const cleaned = buildItems(true);
    if (cleaned.length === 0) { toast.error("No rows have a quantity > 0. Fill at least one operative's hours/days."); return; }
    if (!confirm(`Submit Job Card to BC?\n\n• ${cleaned.length} operative${cleaned.length === 1 ? "" : "s"} with hours\n• Total Gross: ${fmtMoneyEur(totals.totalGrossMinor)}\n• Total to Pay BC: ${fmtMoneyEur(totals.totalToPay)}\n\nThis will LOCK the Job Card. It can't be edited after.`)) return;
    setSubmitting(true);
    try {
      let submissionId = draftId;
      if (!submissionId) {
        // No draft yet - create directly with status='submitted'.
        const r = await api.createMySubmission({
          jobCardType, dateEnding, periodStart, periodEnd,
          notes: notes || null, status: "submitted",
          source: tab === "csv" ? "csv" : "manual",
          items: cleaned,
          ...totalsPayload(),
        });
        submissionId = r.id;
      } else {
        // Save current state to draft, then submit.
        await api.updateMyDraftSubmission(submissionId, {
          jobCardType, dateEnding, periodStart, periodEnd, notes: notes || null, items: cleaned,
        });
        await api.submitMyDraftSubmission(submissionId);
      }
      toast.success(`Job Card locked and sent to BC. Reference: ${submissionId.slice(0, 8)}\u2026`);
      nav(`/primary/submissions/${submissionId}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Clear single back-link so the user always knows how to escape
          the wizard. The old sub-menu (Details / Subcontractors / Job
          Cards / Site IDs) was confusing because it LOOKED like wizard
          tabs but actually navigated to other primary sections, losing
          the in-progress Job Card. Replaced with one breadcrumb that
          goes one level up, plus the sidebar for everything else. */}
      <Link to="/primary/submissions" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Jobs Posted
      </Link>

      <PageHeader
        title={editDraftId ? "Edit Job Card (Draft)" : "New Job Card"}
      />

      {/* Top context - Date Ending + Type + Notes (left) and the BC contact help-block (right), Enagh layout */}
      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        <div className="lg:col-span-2 card-padded">
          {/* Top context row. RCT rate is set by Revenue per-sub and applied
              by BC at processing time, so the principal doesn't need to pick
              one on the Job Card. */}
          <div className="grid sm:grid-cols-3 gap-3">
            <Select
              label="Job Card Type"
              value={jobCardType}
              onChange={(e) => setJobCardType(e.target.value as JobCardType)}
              options={[
                { value: "weekly",      label: "Weekly (1 week)" },
                { value: "fortnightly", label: "Fortnightly (2 weeks)" },
                { value: "monthly",     label: "Monthly (4 weeks)" },
              ]}
            />
            <Input
              label="Start date (auto)"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
            <Input
              label="End date"
              type="date"
              value={dateEnding}
              onChange={(e) => setDateEnding(e.target.value)}
            />
          </div>
          <div className="mt-3">
            <label className="text-xs uppercase tracking-wider text-ink-500 font-semibold">Notes (optional)</label>
            <textarea
              className="mt-2 w-full px-3 py-2 text-sm rounded-md border border-ink-200 focus:border-ink-900 outline-none"
              rows={2}
              placeholder="e.g. Park West phase 2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        {/* Help block (Enagh: "For any issues or problems please contact us") */}
        <aside className="card-padded bg-ink-50/60">
          <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">For any issues or problems please contact us</div>
          <div className="space-y-1.5 text-sm text-ink-800">
            <div className="inline-flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-ink-500" /> ROI: +353 1 9697857</div>
            <div className="inline-flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-ink-500" /> NI: 028 9560 8636</div>
            <div className="inline-flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-ink-500" /> hello@bc-construction.ie</div>
          </div>
        </aside>
      </div>

      {/* Tab switcher (CSV is now an *override* for Qty/Rate, not row replacer) */}
      <div className="flex gap-1 mb-3 border-b border-ink-200">
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 inline-flex items-center gap-2 ${tab === "manual" ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-700"}`}
        >
          <Edit3 className="h-4 w-4" /> Subcontractor roster
        </button>
        <button
          type="button"
          onClick={() => setTab("csv")}
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 inline-flex items-center gap-2 ${tab === "csv" ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-700"}`}
        >
          <FileSpreadsheet className="h-4 w-4" /> Bulk-fill from CSV
        </button>
      </div>

      {sitesLoaded && sites.length === 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4 text-sm text-amber-900 flex items-start gap-2">
          <MapPinned className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            You haven&apos;t added any Site IDs yet.{" "}
            <Link to="/primary/site-ids" className="underline font-medium">Add your Revenue SIN codes here</Link>{" "}
            so the Site column becomes a proper dropdown.
          </div>
        </div>
      )}

      {tab === "csv" && (
        <div className="card-padded mb-5">
          <p className="text-sm text-ink-600 mb-3">
            CSV with columns: <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">SubcontractorCo</code>, <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">Quantity</code>. Optional: <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">Rate</code>, <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">Material</code>, <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">Extras</code>, <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">SiteAddress</code>, <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">RctRate</code>. Matches by Sub code; doesn&apos;t add new rows.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            {/* Pre-filled template seeded with the principal's active
                subs so they only have to fill Qty + Rate. Generated
                client-side - no round-trip needed. */}
            <Button
              variant="outline"
              type="button"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={() => {
                const headers = ["SubcontractorCo", "SubcontractorName", "Quantity", "Rate", "Material", "Extras", "SiteAddress", "RctRate"];
                const escapeCell = (v: string) => /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
                const dataRows = operatives.map(o => [
                  o.subcontractorRef || "",
                  o.fullName || "",
                  "0",
                  o.rateAmountMinor != null ? (o.rateAmountMinor / 100).toFixed(2) : "0",
                  "0",
                  "0",
                  "",
                  (o.rctRate as string) || "",
                ].map(escapeCell).join(","));
                const csv = "\ufeff" + headers.join(",") + "\r\n" + dataRows.join("\r\n") + "\r\n";
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `jobcard-template-${dateEnding || new Date().toISOString().slice(0,10)}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                toast.success("Template downloaded - your active subs are pre-filled.");
              }}
            >
              Download template
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onCsvFile(f); e.target.value = ""; }}
              className="block text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-ink-100 file:text-ink-800 hover:file:bg-ink-200"
            />
          </div>
          {hint && <p className="text-xs text-emerald-700 mt-2">{hint}</p>}
        </div>
      )}

      {/* Quick-fill bar - Excel-style "apply this once, fill many rows".
          Pick a site, click Apply → every row with a non-zero Qty (or
          every row with no site set, if no qty filter applies) gets
          that site. Saves the typical "everyone worked Park West this
          week" case from N clicks to 2. */}
      {sites.length > 0 && (
        <div className="card-padded mb-3 flex flex-col sm:flex-row sm:items-center gap-3 bg-ink-50/40">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 shrink-0">
            Quick-fill
          </div>
          <select
            id="bulk-site"
            className="px-3 py-1.5 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none bg-white"
            defaultValue=""
            onChange={(e) => {
              const sin = e.target.value;
              if (!sin) return;
              setRows(prev => prev.map(r => r.siteAddress ? r : { ...r, siteAddress: sin }));
              toast.success(`Site ${sin} applied to subcontractors without a site`);
              e.target.value = "";
            }}
          >
            <option value="">- Apply Site ID to all empty rows -</option>
            {sites.map((s) => (
              <option key={s.id} value={s.siteId}>
                {s.siteId}{s.projectName ? ` - ${s.projectName}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("Clear hours + extras + materials on every row?")) return;
              setRows(prev => prev.map(r => ({ ...r, quantity: "0", extras: "0", materialValue: "0" })));
            }}
            className="text-xs text-ink-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
            title="Reset numeric fields to 0 across every row"
          >
            Clear all hours
          </button>
        </div>
      )}

      {/* Operatives roster table - auto-listed from active operatives (Enagh parity) */}
      <div className="card overflow-x-auto mb-5">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 border-b border-ink-100">
            <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Sub</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Extras</th>
              <th className="px-3 py-2 text-right">Materials</th>
              <th className="px-3 py-2 text-right">Gross</th>
              <th className="px-3 py-2">Site ID</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-5 py-10 text-center text-sm text-ink-500">
                  You don&apos;t have any active subcontractors yet. <Link to="/primary/subcontractors" className="text-ink-900 underline font-medium">Request your first subcontractor</Link> to start filling Job Cards.
                </td>
              </tr>
            ) : rows.map((row, i) => {
              const q = parseFloat(row.quantity) || 0;
              const rt = parseFloat(row.rate) || 0;
              const m = parseFloat(row.materialValue) || 0;
              const e = parseFloat(row.extras) || 0;
              const grossMinor = Math.round((q * rt + m + e) * 100);
              const isAuto = !!row.operativeId;
              return (
                <tr key={row.operativeId || `adhoc-${i}`} className="border-b border-ink-100 last:border-b-0">
                  <td className="px-3 py-2 font-mono text-xs text-ink-500">{row.operativeId ? row.operativeId.slice(0, 6) : "-"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink-700">{row.subcontractorRef || "-"}</td>
                  <td className="px-3 py-2 text-ink-900">{row.subcontractorName || "-"}</td>
                  <td className="px-2 py-2"><input inputMode="decimal" className="w-20 px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none text-right tabular-nums" value={row.quantity} onChange={(ev) => updateRow(i, "quantity", ev.target.value)} placeholder="0" /></td>
                  <td className="px-2 py-2"><input inputMode="decimal" className="w-20 px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none text-right tabular-nums" value={row.rate} onChange={(ev) => updateRow(i, "rate", ev.target.value)} placeholder="0" /></td>
                  <td className="px-2 py-2"><input inputMode="decimal" className="w-20 px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none text-right tabular-nums" value={row.extras} onChange={(ev) => updateRow(i, "extras", ev.target.value)} placeholder="0" /></td>
                  <td className="px-2 py-2"><input inputMode="decimal" className="w-20 px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none text-right tabular-nums" value={row.materialValue} onChange={(ev) => updateRow(i, "materialValue", ev.target.value)} placeholder="0" /></td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium text-ink-700">{grossMinor > 0 ? fmtMoneyEur(grossMinor) : "-"}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      {sites.length > 0 ? (
                        <select
                          className="min-w-[140px] px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none bg-white"
                          value={row.siteAddress}
                          onChange={(ev) => updateRow(i, "siteAddress", ev.target.value)}
                        >
                          <option value="">- Site ID -</option>
                          {sites.map((s) => (
                            <option key={s.id} value={s.siteId}>
                              {s.siteId}{s.projectName ? ` - ${s.projectName}` : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input className="min-w-[120px] px-2 py-1 text-sm rounded border border-ink-200 focus:border-ink-900 outline-none" value={row.siteAddress} onChange={(ev) => updateRow(i, "siteAddress", ev.target.value)} placeholder="Site" />
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          const sin = window.prompt("New Site ID (Revenue SIN code, e.g. DUB48662N):")?.trim();
                          if (!sin) return;
                          const project = window.prompt("Project name (optional):")?.trim() || null;
                          const address = window.prompt("Address (optional):")?.trim() || null;
                          try {
                            const created = await api.createMyPrincipalSiteId({ siteId: sin, projectName: project, address });
                            setSites(prev => [...prev, created]);
                            updateRow(i, "siteAddress", created.siteId);
                            toast.success(`Site ID ${created.siteId} added`);
                          } catch (err) {
                            toast.error(err instanceof ApiError ? err.message : "Failed to add Site ID");
                          }
                        }}
                        title="Add a new Site ID"
                        className="text-ink-500 hover:text-ink-900 px-1.5 py-1 rounded hover:bg-ink-100"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  {/* Per-line "Job #" field intentionally hidden from the
                      UI: the per-Job-Card JOB-NNNN ref is auto-generated
                      and stored on the submission row; the per-line job
                      number was confusing principals into entering it
                      manually. The DB column stays so legacy data is
                      preserved; we just don't expose the input. */}
                  <td className="px-2 py-2 text-right">
                    {!isAuto && (
                      <button type="button" onClick={() => removeRow(i)} className="text-ink-400 hover:text-red-600" title="Remove ad-hoc row">
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

      {/* Calculate block - Enagh's labels verbatim */}
      <div className="card-padded mb-5 bg-ink-50/40">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 mb-4">Calculate</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-600">Total Gross</span><span className="tabular-nums font-medium">{fmtMoneyEur(totals.totalGrossMinor)}</span></div>
            <div className="flex justify-between"><span className="text-ink-600">Total to certify to revenue</span><span className="tabular-nums">{fmtMoneyEur(totals.totalGrossMinor)}</span></div>
            {/* The principal accounts for the reverse-charge VAT
                themselves on their VAT3 return - we no longer surface
                it as a banner here (it was confusing). RCT rate is
                picked at the top of the form (default) and per row.
                totals.vatAmt is still computed + sent to the server
                for invoice / audit, just not displayed inline. */}
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
            <div className="text-[11px] uppercase tracking-wider text-ink-300 font-semibold mb-1">Total to Pay BC</div>
            <div className="text-3xl font-bold tabular-nums">{fmtMoneyEur(totals.totalToPay)}</div>
            <div className="text-xs text-ink-400 mt-2">
              {draftId ? "Saved as draft. Hit Submit to lock and send to BC." : "Hit Submit to lock the Job Card and send to BC. You'll get an emailed copy."}
            </div>
          </div>
        </div>
      </div>

      {/* Action bar - Enagh's three-button row + Print Blank */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={addAdhocRow} leftIcon={<Plus className="h-4 w-4" />}>
            Add ad-hoc row
          </Button>
          <Button variant="ghost" onClick={handlePrintBlank} leftIcon={<Printer className="h-4 w-4" />}>
            Print blank
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={saveDraft} loading={savingDraft} leftIcon={<Save className="h-4 w-4" />}>
            Save{draftId ? "" : " as draft"}
          </Button>
          <Button variant="outline" onClick={recalculate} leftIcon={<Calculator className="h-4 w-4" />}>
            Calculate
          </Button>
          <Button variant="accent" onClick={submitJobCard} loading={submitting} leftIcon={<Send className="h-4 w-4" />}>
            Submit
          </Button>
        </div>
      </div>

      {/* Hidden printable Job Card (Print Blank) */}
      <style>{`
        .print-blank { position: absolute; left: -10000px; top: 0; width: 1px; height: 1px; overflow: hidden; }
        @media print {
          body * { visibility: hidden !important; }
          .print-blank, .print-blank * { visibility: visible !important; }
          .print-blank {
            position: absolute !important; left: 0 !important; top: 0 !important;
            width: 100% !important; height: auto !important; overflow: visible !important;
            padding: 16mm 14mm; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111;
          }
          .print-blank h1 { font-size: 18pt; margin: 0 0 4pt 0; }
          .print-blank .pb-meta { font-size: 10pt; color: #444; margin-bottom: 12pt; }
          .print-blank table { width: 100%; border-collapse: collapse; font-size: 9pt; }
          .print-blank th, .print-blank td { border: 1px solid #888; padding: 5pt 6pt; text-align: left; vertical-align: top; }
          .print-blank th { background: #f0f0f0; font-weight: 600; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; }
          .print-blank td.num { text-align: right; font-variant-numeric: tabular-nums; }
          .print-blank .pb-section-title { font-size: 11pt; font-weight: 600; margin: 16pt 0 4pt 0; }
          .print-blank .pb-sig { margin-top: 24pt; display: flex; justify-content: space-between; font-size: 10pt; gap: 24pt; }
          .print-blank .pb-sig div { flex: 1; border-top: 1px solid #888; padding-top: 4pt; }
          @page { size: A4 landscape; margin: 0; }
        }
      `}</style>
      <div className="print-blank">
        <h1>{principalName || "Principal"} - Job Card</h1>
        <div className="pb-meta">
          Type: <strong>{jobCardType.charAt(0).toUpperCase() + jobCardType.slice(1)}</strong>{" \u00B7 "}
          Period: <strong>{periodStart || "-"}</strong> to <strong>{periodEnd || dateEnding || "-"}</strong>{" \u00B7 "}
          Date ending: <strong>{dateEnding || "-"}</strong>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: "12%" }}>Sub code</th>
              <th style={{ width: "20%" }}>Name</th>
              <th style={{ width: "18%" }}>Site</th>
              <th style={{ width: "8%" }}>Qty</th>
              <th style={{ width: "9%" }}>Rate</th>
              <th style={{ width: "9%" }}>Material</th>
              <th style={{ width: "9%" }}>Extras</th>
              <th style={{ width: "10%" }}>Gross</th>
              <th style={{ width: "8%" }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 15 }).map((_, i) => (
              <tr key={i} style={{ height: "22pt" }}>
                <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                <td className="num">&nbsp;</td><td className="num">&nbsp;</td>
                <td className="num">&nbsp;</td><td className="num">&nbsp;</td>
                <td className="num">&nbsp;</td><td>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
        {operatives.length > 0 && (
          <>
            <div className="pb-section-title">Subcontractor reference</div>
            <table>
              <thead><tr><th style={{ width: "20%" }}>Sub code</th><th style={{ width: "55%" }}>Name</th><th style={{ width: "25%" }}>Standard rate</th></tr></thead>
              <tbody>
                {operatives.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: "monospace" }}>{o.subcontractorRef || "-"}</td>
                    <td>{o.fullName || "-"}</td>
                    <td className="num">{o.rateAmountMinor != null ? `\u20AC${(o.rateAmountMinor / 100).toFixed(2)}${o.rateUnit ? `/${o.rateUnit}` : ""}` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {sites.length > 0 && (
          <>
            <div className="pb-section-title">Site IDs reference</div>
            <table>
              <thead><tr><th style={{ width: "18%" }}>SIN</th><th style={{ width: "32%" }}>Project</th><th style={{ width: "50%" }}>Address</th></tr></thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: "monospace" }}>{s.siteId}</td>
                    <td>{s.projectName || "-"}</td>
                    <td>{s.address || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div className="pb-sig">
          <div>Prepared by (name &amp; signature)</div>
          <div>Date</div>
          <div>BC Construction stamp</div>
        </div>
      </div>
    </>
  );
}
