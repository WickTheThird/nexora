import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PortalShell";
import { getHelp } from "@/lib/helpContent";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Empty } from "@/components/ui/Empty";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import type { PaymentRecord } from "@/lib/types";
import {
  Send,
  Eye,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Loader2,
  RefreshCcw,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
  CreditCard,
} from "lucide-react";

// Advice (Payment Advice) page. Three views:
//   1. Kanban   - Jira-style board: Open / Previewed / Sent / Paid columns.
//                 Each card shows the per-sub gross/RCT/net and lets the
//                 admin create a single payment advice in one click.
//   2. Timesheets - the bulk preview/send flow (multi-select then send N).
//   3. CSV      - Enagh-style CSV import.

type PreviewItem = Awaited<ReturnType<typeof api.adminBulkAdvicePreview>>["items"][number];
type PaymentItem = Awaited<ReturnType<typeof api.adminListPayments>>["items"][number];
type CsvPreview = Awaited<ReturnType<typeof api.adminBulkAdviceImport>>;

function fmtMoney(minor: number, currency = "EUR") {
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

// Helper: weekly default range (Mon → today). Mirrors prior behaviour.
function defaultRange() {
  const today = new Date();
  const day = today.getDay() || 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(monday), to: iso(today) };
}

// localStorage key for the "Previewed" column - we don't have a real DB
// status for previewed-but-not-sent, so we persist a list of "{subId}|{from}|{to}"
// keys client-side. Stays per-browser per-admin.
const PREVIEWED_KEY = "nexora:advice:previewed:v1";
function loadPreviewed(): Set<string> {
  try {
    const raw = localStorage.getItem(PREVIEWED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function savePreviewed(set: Set<string>) {
  try {
    localStorage.setItem(PREVIEWED_KEY, JSON.stringify([...set]));
  } catch {
    /* quota - ignore */
  }
}
function previewedKey(subId: string, from: string, to: string) {
  return `${subId}|${from}|${to}`;
}

export function BulkAdvice() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const initial = defaultRange();

  const [view, setView] = useState<"kanban" | "timesheets" | "csv">("kanban");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [notify, setNotify] = useState(true);

  // ---------- preview + bulk-send state ----------
  const [items, setItems] = useState<PreviewItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.adminBulkAdviceSend>> | null>(null);

  // ---------- payments state (Sent / Paid columns) ----------
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // ---------- previewed (client-side) state ----------
  const [previewed, setPreviewed] = useState<Set<string>>(() => loadPreviewed());
  useEffect(() => savePreviewed(previewed), [previewed]);

  // ---------- per-card expand + per-card create ----------
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<Set<string>>(new Set());

  // ---------- kanban selection (bulk actions) ----------
  // Preview rows (Open / Previewed) are picked by subcontractorId.
  // Payment rows (Sent / Paid) are picked by paymentId.
  const [pickedSubs, setPickedSubs] = useState<Set<string>>(new Set());
  const [pickedPayments, setPickedPayments] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // ---------- CSV import state ----------
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);

  // Combined refresh - hits preview + payments in parallel.
  const refresh = async () => {
    setLoading(true);
    setPaymentsLoading(true);
    setResult(null);
    try {
      const [prev, pays] = await Promise.all([
        api.adminBulkAdvicePreview(from, to),
        api.adminListPayments({ status: "advised,invoiced,paid", limit: 300 }),
      ]);
      setItems(prev.items);
      // Pre-select all eligible ones so bulk-send is one click away.
      setSelected(new Set(prev.items.filter((i) => i.eligible).map((i) => i.subcontractorId)));
      setPayments(pays.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setPaymentsLoading(false);
    }
  };

  // Auto-load on mount and whenever the period changes (kanban view only).
  useEffect(() => {
    if (view === "kanban") refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- column derivations ----------
  // Open: preview items that are eligible AND no payment exists for the period
  //       (deduped by subcontractorId since the preview is already per-sub).
  const subsWithPaymentInPeriod = useMemo(() => {
    const s = new Set<string>();
    for (const p of payments) {
      if (p.periodStart === from && p.periodEnd === to) s.add(p.subcontractorId);
    }
    return s;
  }, [payments, from, to]);

  const openItems = useMemo(() => {
    if (!items) return [];
    return items.filter(
      (i) => i.eligible && !subsWithPaymentInPeriod.has(i.subcontractorId),
    );
  }, [items, subsWithPaymentInPeriod]);

  const previewedItems = useMemo(() => {
    return openItems.filter((i) => previewed.has(previewedKey(i.subcontractorId, from, to)));
  }, [openItems, previewed, from, to]);

  const openOnlyItems = useMemo(() => {
    return openItems.filter((i) => !previewed.has(previewedKey(i.subcontractorId, from, to)));
  }, [openItems, previewed, from, to]);

  const sentItems = useMemo(
    () => payments.filter((p) => p.status === "advised" || p.status === "invoiced"),
    [payments],
  );
  const paidItems = useMemo(() => payments.filter((p) => p.status === "paid"), [payments]);

  // Search across all columns by sub name/email/ref.
  const matchesSearch = (s: string | null | undefined) => {
    if (!search.trim()) return true;
    return (s || "").toLowerCase().includes(search.trim().toLowerCase());
  };
  const filterPrev = (arr: PreviewItem[]) =>
    arr.filter((i) => matchesSearch(i.fullName) || matchesSearch(i.email) || matchesSearch(i.subcontractorId));
  const filterPay = (arr: PaymentItem[]) =>
    arr.filter(
      (p) =>
        matchesSearch(p.subcontractorName) ||
        matchesSearch(p.subcontractorEmail) ||
        matchesSearch(p.subcontractorRef) ||
        matchesSearch(p.invoiceNumber || ""),
    );

  // ---------- actions ----------
  const togglePreviewed = (subId: string) => {
    setPreviewed((prev) => {
      const next = new Set(prev);
      const key = previewedKey(subId, from, to);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSubPick = (subId: string) => {
    setPickedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) next.delete(subId);
      else next.add(subId);
      return next;
    });
  };
  const togglePaymentPick = (paymentId: string) => {
    setPickedPayments((prev) => {
      const next = new Set(prev);
      if (next.has(paymentId)) next.delete(paymentId);
      else next.add(paymentId);
      return next;
    });
  };
  const clearPicks = () => {
    setPickedSubs(new Set());
    setPickedPayments(new Set());
  };

  // ---------- bulk actions ----------
  const bulkSendAdvice = async () => {
    if (pickedSubs.size === 0) return;
    if (
      !confirm(
        `Send ${pickedSubs.size} payment advice${pickedSubs.size === 1 ? "" : "s"}?\n\n` +
          (notify ? "Each sub will be EMAILED." : "No emails will be sent."),
      )
    )
      return;
    setBulkBusy(true);
    try {
      const r = await api.adminBulkAdviceSend(from, to, [...pickedSubs], notify);
      toast.success(
        `Created ${r.created.length}${r.skipped.length ? `, skipped ${r.skipped.length}` : ""}`,
      );
      // Promote sent subs out of the previewed flag.
      setPreviewed((prev) => {
        const next = new Set(prev);
        for (const id of pickedSubs) next.delete(previewedKey(id, from, to));
        return next;
      });
      setPickedSubs(new Set());
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkMarkPreviewed = () => {
    if (pickedSubs.size === 0) return;
    setPreviewed((prev) => {
      const next = new Set(prev);
      for (const id of pickedSubs) next.add(previewedKey(id, from, to));
      return next;
    });
    toast.success(`Marked ${pickedSubs.size} previewed`);
    setPickedSubs(new Set());
  };

  const bulkUnmarkPreviewed = () => {
    if (pickedSubs.size === 0) return;
    setPreviewed((prev) => {
      const next = new Set(prev);
      for (const id of pickedSubs) next.delete(previewedKey(id, from, to));
      return next;
    });
    toast.success(`Unmarked ${pickedSubs.size}`);
    setPickedSubs(new Set());
  };

  const bulkMarkPaid = async () => {
    // Only invoiced payments are eligible to be marked paid (sub must have
    // generated their invoice first).
    const eligible = payments
      .filter((p) => pickedPayments.has(p.id) && p.status === "invoiced")
      .map((p) => p.id);
    const skipped = pickedPayments.size - eligible.length;
    if (eligible.length === 0) {
      toast.error("None of the selected payments are invoiced yet");
      return;
    }
    if (
      !confirm(
        `Mark ${eligible.length} payment${eligible.length === 1 ? "" : "s"} as paid?` +
          (skipped ? `\n\n${skipped} selected payment${skipped === 1 ? "" : "s"} are not yet invoiced and will be skipped.` : ""),
      )
    )
      return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(eligible.map((id) => api.adminMarkPaymentPaid(id)));
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - ok;
      toast.success(`Marked ${ok} paid${failed ? `, ${failed} failed` : ""}`);
      setPickedPayments(new Set());
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setBulkBusy(false);
    }
  };

  // Per-card: create exactly one payment advice for this sub for this period.
  const createOne = async (item: PreviewItem) => {
    if (!item.eligible) return;
    if (
      !confirm(
        `Create payment advice for ${item.fullName || item.email}?\n\n` +
          `Gross ${fmtMoney(item.grossMinor)} · Net ${fmtMoney(item.netMinor)}\n` +
          (notify ? "The sub will be EMAILED." : "No email will be sent."),
      )
    )
      return;
    setCreating((prev) => new Set(prev).add(item.subcontractorId));
    try {
      const r = await api.adminBulkAdviceSend(from, to, [item.subcontractorId], notify);
      if (r.created.length) {
        toast.success(`Advice created for ${item.fullName || item.email}`);
        // Clear the previewed flag for this sub (it's now Sent).
        setPreviewed((prev) => {
          const next = new Set(prev);
          next.delete(previewedKey(item.subcontractorId, from, to));
          return next;
        });
        await refresh();
      } else if (r.skipped.length) {
        toast.error(r.skipped[0].reason || "Skipped");
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    } finally {
      setCreating((prev) => {
        const next = new Set(prev);
        next.delete(item.subcontractorId);
        return next;
      });
    }
  };

  // Bulk send for the timesheets tab (kept for parity).
  const send = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one subcontractor");
      return;
    }
    if (
      !confirm(
        `Send ${selected.size} payment advice${selected.size === 1 ? "" : "s"}?\n\n` +
          `This will create payment records and ${notify ? "EMAIL each subcontractor" : "create records silently"}.`,
      )
    )
      return;
    setSending(true);
    try {
      const r = await api.adminBulkAdviceSend(from, to, [...selected], notify);
      setResult(r);
      toast.success(
        `Created ${r.created.length} advice${r.created.length === 1 ? "" : "s"}${r.skipped.length ? `, skipped ${r.skipped.length}` : ""}`,
      );
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const markPaid = async (p: PaymentItem) => {
    if (!p.invoiceNumber) {
      toast.error("Sub must generate an invoice before marking paid");
      return;
    }
    if (!confirm(`Mark ${p.invoiceNumber} as paid?\n\n${p.subcontractorName || p.subcontractorEmail}`)) return;
    try {
      await api.adminMarkPaymentPaid(p.id);
      toast.success("Marked paid");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed");
    }
  };

  // ---------- CSV import (preserved from prior version) ----------
  const csvUpload = async (commit: boolean) => {
    if (!csvFile) {
      toast.error("Select a CSV file first");
      return;
    }
    if (commit) {
      const matched = csvPreview?.matchedCount ?? 0;
      if (!matched) {
        toast.error("Nothing to commit (no matched rows)");
        return;
      }
      if (
        !confirm(
          `Create ${matched} payment advice${matched === 1 ? "" : "s"} from this CSV?\n\n${notify ? "Each subcontractor will be EMAILED." : "No emails will be sent."}`,
        )
      )
        return;
    }
    setCsvBusy(true);
    try {
      const r = await api.adminBulkAdviceImport(csvFile, from, to, { commit, notify });
      setCsvPreview(r);
      if (commit) {
        toast.success(`Created ${r.created?.length || 0}${r.skipped?.length ? `, skipped ${r.skipped.length}` : ""}`);
      } else {
        toast.info(`Preview: ${r.matchedCount} matched / ${r.itemCount} total`);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setCsvBusy(false);
    }
  };

  const eligibleCount = items?.filter((i) => i.eligible).length || 0;
  const totalSelectedGross =
    items?.filter((i) => selected.has(i.subcontractorId)).reduce((s, i) => s + i.grossMinor, 0) || 0;

  return (
    <>
      <PageHeader title="Advice" help={getHelp("advice")} />

      {/* View tabs ----------------------------------------------------- */}
      <div className="flex gap-1 mb-5 border-b border-ink-200">
        <TabBtn label="Kanban" active={view === "kanban"} onClick={() => setView("kanban")} />
        <TabBtn label="From timesheets" active={view === "timesheets"} onClick={() => setView("timesheets")} />
        <TabBtn label="From CSV upload" active={view === "csv"} onClick={() => setView("csv")} />
      </div>

      {/* KANBAN VIEW ---------------------------------------------------- */}
      {view === "kanban" && (
        <>
          <div className="card-padded mb-5">
            <div className="grid sm:grid-cols-5 gap-3 items-end">
              <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              <div>
                <label className="text-xs uppercase tracking-wider text-ink-500 font-semibold">Search</label>
                <div className="mt-2 relative">
                  <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    placeholder="Name, email, ref..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md border border-ink-200 focus:outline-none focus:border-ink-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-ink-500 font-semibold">Notify</label>
                <label className="mt-2 flex items-center gap-2 text-sm text-ink-700">
                  <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                  Email each sub
                </label>
              </div>
              <Button
                variant="primary"
                onClick={refresh}
                loading={loading || paymentsLoading}
                leftIcon={<RefreshCcw className="h-4 w-4" />}
              >
                Refresh
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-4">
            {/* Open column */}
            <Column
              title="Open"
              tone="neutral"
              count={filterPrev(openOnlyItems).length}
              hint="Eligible · not yet previewed"
              empty={items === null ? "Loading..." : "No open advice"}
              pickedInColumn={filterPrev(openOnlyItems).filter((i) => pickedSubs.has(i.subcontractorId)).length}
              onSelectAll={() => {
                setPickedSubs((prev) => {
                  const next = new Set(prev);
                  for (const i of filterPrev(openOnlyItems)) next.add(i.subcontractorId);
                  return next;
                });
              }}
              onClear={() => {
                setPickedSubs((prev) => {
                  const next = new Set(prev);
                  for (const i of filterPrev(openOnlyItems)) next.delete(i.subcontractorId);
                  return next;
                });
              }}
            >
              {filterPrev(openOnlyItems).map((i) => (
                <OpenCard
                  key={i.subcontractorId}
                  item={i}
                  expanded={expanded.has(i.subcontractorId)}
                  creating={creating.has(i.subcontractorId)}
                  picked={pickedSubs.has(i.subcontractorId)}
                  onTogglePick={() => toggleSubPick(i.subcontractorId)}
                  onToggle={() => toggleExpand(i.subcontractorId)}
                  onMarkPreviewed={() => togglePreviewed(i.subcontractorId)}
                  onCreate={() => createOne(i)}
                />
              ))}
            </Column>

            {/* Previewed column */}
            <Column
              title="Previewed"
              tone="amber"
              count={filterPrev(previewedItems).length}
              hint="You've reviewed · not sent"
              empty="Nothing previewed yet"
              pickedInColumn={filterPrev(previewedItems).filter((i) => pickedSubs.has(i.subcontractorId)).length}
              onSelectAll={() => {
                setPickedSubs((prev) => {
                  const next = new Set(prev);
                  for (const i of filterPrev(previewedItems)) next.add(i.subcontractorId);
                  return next;
                });
              }}
              onClear={() => {
                setPickedSubs((prev) => {
                  const next = new Set(prev);
                  for (const i of filterPrev(previewedItems)) next.delete(i.subcontractorId);
                  return next;
                });
              }}
            >
              {filterPrev(previewedItems).map((i) => (
                <OpenCard
                  key={i.subcontractorId}
                  item={i}
                  expanded={expanded.has(i.subcontractorId)}
                  creating={creating.has(i.subcontractorId)}
                  picked={pickedSubs.has(i.subcontractorId)}
                  onTogglePick={() => toggleSubPick(i.subcontractorId)}
                  onToggle={() => toggleExpand(i.subcontractorId)}
                  onMarkPreviewed={() => togglePreviewed(i.subcontractorId)}
                  isPreviewed
                  onCreate={() => createOne(i)}
                />
              ))}
            </Column>

            {/* Sent column */}
            <Column
              title="Sent"
              tone="blue"
              count={filterPay(sentItems).length}
              hint="Advised · awaiting invoice / payment"
              empty="No advised payments"
              pickedInColumn={filterPay(sentItems).filter((p) => pickedPayments.has(p.id)).length}
              onSelectAll={() => {
                setPickedPayments((prev) => {
                  const next = new Set(prev);
                  for (const p of filterPay(sentItems)) next.add(p.id);
                  return next;
                });
              }}
              onClear={() => {
                setPickedPayments((prev) => {
                  const next = new Set(prev);
                  for (const p of filterPay(sentItems)) next.delete(p.id);
                  return next;
                });
              }}
            >
              {filterPay(sentItems).map((p) => (
                <PaymentCard
                  key={p.id}
                  payment={p}
                  expanded={expanded.has(p.id)}
                  picked={pickedPayments.has(p.id)}
                  onTogglePick={() => togglePaymentPick(p.id)}
                  onToggle={() => toggleExpand(p.id)}
                  onMarkPaid={() => markPaid(p)}
                />
              ))}
            </Column>

            {/* Paid column */}
            <Column
              title="Paid"
              tone="green"
              count={filterPay(paidItems).length}
              hint="Completed"
              empty="No paid records"
              pickedInColumn={filterPay(paidItems).filter((p) => pickedPayments.has(p.id)).length}
              onSelectAll={() => {
                setPickedPayments((prev) => {
                  const next = new Set(prev);
                  for (const p of filterPay(paidItems)) next.add(p.id);
                  return next;
                });
              }}
              onClear={() => {
                setPickedPayments((prev) => {
                  const next = new Set(prev);
                  for (const p of filterPay(paidItems)) next.delete(p.id);
                  return next;
                });
              }}
            >
              {filterPay(paidItems).map((p) => (
                <PaymentCard
                  key={p.id}
                  payment={p}
                  expanded={expanded.has(p.id)}
                  picked={pickedPayments.has(p.id)}
                  onTogglePick={() => togglePaymentPick(p.id)}
                  onToggle={() => toggleExpand(p.id)}
                />
              ))}
            </Column>
          </div>

          {/* Sticky bulk action bar - appears when anything is picked.
              Shows the right verbs depending on whether the selection is
              made of preview rows (subs) or payment rows. */}
          {(pickedSubs.size > 0 || pickedPayments.size > 0) && (
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-ink-900 text-white shadow-lg">
              <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="text-sm">
                  {pickedSubs.size > 0 && (
                    <span className="mr-3">
                      <strong>{pickedSubs.size}</strong> sub{pickedSubs.size === 1 ? "" : "s"} picked
                    </span>
                  )}
                  {pickedPayments.size > 0 && (
                    <span>
                      <strong>{pickedPayments.size}</strong> payment{pickedPayments.size === 1 ? "" : "s"} picked
                    </span>
                  )}
                </div>
                <div className="flex-1" />
                {pickedSubs.size > 0 && (
                  <>
                    <Button size="sm" variant="outline" onClick={bulkMarkPreviewed} leftIcon={<Eye className="h-3.5 w-3.5" />}>
                      Mark previewed
                    </Button>
                    <Button size="sm" variant="outline" onClick={bulkUnmarkPreviewed}>
                      Unmark
                    </Button>
                    <Button
                      size="sm"
                      variant="accent"
                      onClick={bulkSendAdvice}
                      loading={bulkBusy}
                      leftIcon={notify ? <Mail className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                    >
                      Send {pickedSubs.size} advice{pickedSubs.size === 1 ? "" : "s"}
                    </Button>
                  </>
                )}
                {pickedPayments.size > 0 && (
                  <Button
                    size="sm"
                    variant="accent"
                    onClick={bulkMarkPaid}
                    loading={bulkBusy}
                    leftIcon={<CreditCard className="h-3.5 w-3.5" />}
                  >
                    Mark {pickedPayments.size} paid
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={clearPicks}>
                  Clear
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* TIMESHEETS VIEW (bulk preview/send) ---------------------------- */}
      {view === "timesheets" && (
        <>
          <div className="card-padded mb-5">
            <div className="grid sm:grid-cols-4 gap-3 items-end">
              <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              <div>
                <label className="text-xs uppercase tracking-wider text-ink-500 font-semibold">Notify</label>
                <label className="mt-2 flex items-center gap-2 text-sm text-ink-700">
                  <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                  Email each sub when sent
                </label>
              </div>
              <Button variant="primary" onClick={refresh} loading={loading} leftIcon={<Eye className="h-4 w-4" />}>
                Preview
              </Button>
            </div>
          </div>

          {result && (
            <div className="card-padded mb-5 bg-green-50 border-green-200">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-700 mt-0.5" />
                <div className="text-sm text-green-900">
                  <div className="font-semibold mb-1">
                    Sent {result.created.length} payment advice{result.created.length === 1 ? "" : "s"}
                    {result.skipped.length > 0 && ` · skipped ${result.skipped.length}`}
                  </div>
                  {result.skipped.length > 0 && (
                    <ul className="text-xs text-green-800 mt-2 list-disc list-inside">
                      {result.skipped.map((s, i) => (
                        <li key={i}>
                          {s.subId.slice(0, 8)}: {s.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {items === null ? (
            <Empty
              icon={Eye}
              title="No preview yet"
              description="Pick a date range and click Preview to see which subcontractors would receive a payment advice."
            />
          ) : items.length === 0 ? (
            <Empty icon={CheckCircle2} title="Nothing to advise" description="No subs have approved, unpaid timesheets in that period." />
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="text-sm text-ink-600">
                  <strong>{eligibleCount}</strong> eligible / {items.length} total · <strong>{selected.size}</strong> selected · total gross <strong>{fmtMoney(totalSelectedGross)}</strong>
                </div>
                <Button
                  variant="accent"
                  onClick={send}
                  loading={sending}
                  disabled={selected.size === 0}
                  leftIcon={notify ? <Mail className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                >
                  Send {selected.size} advice{selected.size === 1 ? "" : "s"}
                </Button>
              </div>

              <div className="mb-3">
                <Input label="" placeholder="Filter preview by sub name or ref..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>

              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50 border-b border-ink-100">
                    <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                      <th className="px-3 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={items.length > 0 && items.filter((i) => i.eligible).every((i) => selected.has(i.subcontractorId))}
                          onChange={(e) => {
                            if (e.target.checked) setSelected(new Set(items.filter((i) => i.eligible).map((i) => i.subcontractorId)));
                            else setSelected(new Set());
                          }}
                        />
                      </th>
                      <th className="px-3 py-3">Subcontractor</th>
                      <th className="px-3 py-3 text-right">Sheets</th>
                      <th className="px-3 py-3 text-right">Hours</th>
                      <th className="px-3 py-3 text-right">Rate</th>
                      <th className="px-3 py-3 text-right">Gross</th>
                      <th className="px-3 py-3 text-right">RCT</th>
                      <th className="px-3 py-3 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items
                      .filter((i) => matchesSearch(i.fullName) || matchesSearch(i.email) || matchesSearch(i.subcontractorId))
                      .map((i) => (
                        <tr
                          key={i.subcontractorId}
                          className={`border-b border-ink-100 last:border-b-0 ${i.eligible ? "hover:bg-ink-50/50" : "bg-amber-50/40"}`}
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              disabled={!i.eligible}
                              checked={selected.has(i.subcontractorId)}
                              onChange={() => {
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(i.subcontractorId)) next.delete(i.subcontractorId);
                                  else next.add(i.subcontractorId);
                                  return next;
                                });
                              }}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-ink-900">{i.fullName || "(no name)"}</div>
                            <div className="text-xs text-ink-500">{i.email}</div>
                            {!i.eligible && (
                              <div className="text-xs text-amber-700 flex items-center gap-1 mt-1">
                                <AlertTriangle className="h-3 w-3" /> {i.ineligibleReason}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{i.sheetCount}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{i.totalHours.toFixed(1)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-ink-600">
                            {i.rateAmountMinor ? `${fmtMoney(i.rateAmountMinor)}/${i.rateUnit}` : "-"}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums font-medium">{i.eligible ? fmtMoney(i.grossMinor) : "-"}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-red-700">
                            {i.eligible && i.rctRate ? `-${fmtMoney(i.rctDeductionMinor)} (${i.rctRate}%)` : "-"}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums font-bold">{i.eligible ? fmtMoney(i.netMinor) : "-"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* CSV VIEW ------------------------------------------------------- */}
      {view === "csv" && (
        <div className="card-padded mb-5">
          <p className="text-sm text-ink-600 mb-4">
            Upload a CSV in the Enagh export shape. Required columns:{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">SubcontractorCo</code>,{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">Quantity</code>,{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">Rate</code>. Optional:{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">MaterialValue</code>,{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">Extras</code>,{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">SiteAddress</code>,{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">JobNumber</code>,{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">Name</code>. Matching is by{" "}
            <code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">SubcontractorCo</code> against the sub's <em>subcontractor reference</em> or <em>client reference</em>.
          </p>
          <div className="grid sm:grid-cols-4 gap-3 items-end mb-3">
            <Input label="Period start" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="Period end" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <div>
              <label className="text-xs uppercase tracking-wider text-ink-500 font-semibold">CSV file</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,application/vnd.ms-excel"
                onChange={(e) => {
                  setCsvFile(e.target.files?.[0] || null);
                  setCsvPreview(null);
                }}
                className="block mt-2 w-full text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-ink-100 file:text-ink-800 hover:file:bg-ink-200"
              />
              {csvFile && (
                <div className="text-xs text-ink-500 mt-1">
                  {csvFile.name} · {(csvFile.size / 1024).toFixed(1)} KB
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="primary" onClick={() => csvUpload(false)} disabled={!csvFile} loading={csvBusy} leftIcon={<Eye className="h-4 w-4" />}>
                Preview
              </Button>
              <label className="text-xs text-ink-600 flex items-center gap-2">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                Email each sub when committed
              </label>
            </div>
          </div>

          {csvPreview && csvPreview.mode === "preview" && csvPreview.items && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-ink-600">
                  <strong>{csvPreview.matchedCount}</strong> matched / {csvPreview.itemCount} rows · total gross <strong>{fmtMoney(csvPreview.totalGrossMinor || 0)}</strong>
                </div>
                <Button
                  variant="accent"
                  onClick={() => csvUpload(true)}
                  disabled={!csvPreview.matchedCount}
                  loading={csvBusy}
                  leftIcon={notify ? <Mail className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                >
                  Commit & create {csvPreview.matchedCount} advice{csvPreview.matchedCount === 1 ? "" : "s"}
                </Button>
              </div>
              <div className="card overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-ink-50 border-b border-ink-100">
                    <tr className="text-left uppercase tracking-wider text-ink-500 font-semibold">
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Sub code</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Job</th>
                      <th className="px-3 py-2">Site</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Gross</th>
                      <th className="px-3 py-2 text-right">RCT</th>
                      <th className="px-3 py-2 text-right">Net</th>
                      <th className="px-3 py-2">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.items.map((it) => (
                      <tr key={it.rowIndex} className={`border-b border-ink-100 last:border-b-0 ${it.matched ? "" : "bg-amber-50/40"}`}>
                        <td className="px-3 py-2 text-ink-500">{it.rowIndex}</td>
                        <td className="px-3 py-2 font-mono">{it.code}</td>
                        <td className="px-3 py-2">{it.subcontractorName || it.csvName}</td>
                        <td className="px-3 py-2 text-ink-600">{it.jobNumber || "-"}</td>
                        <td className="px-3 py-2 text-ink-600">{it.siteAddress || "-"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{it.quantity.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{it.rate.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(it.grossMinor)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-700">
                          {it.rctRate ? `-${fmtMoney(it.rctDeductionMinor)} (${it.rctRate}%)` : "-"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold">{fmtMoney(it.netMinor)}</td>
                        <td className="px-3 py-2">
                          {it.matched ? (
                            <Badge tone="success">match</Badge>
                          ) : (
                            <span className="text-amber-700 text-xs flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {it.ineligibleReason}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {csvPreview && csvPreview.mode === "committed" && (
            <div className="mt-4 card-padded bg-green-50 border-green-200">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-700 mt-0.5" />
                <div className="text-sm text-green-900">
                  <div className="font-semibold mb-1">
                    Committed {csvPreview.created?.length || 0}
                    {csvPreview.skipped?.length ? ` · skipped ${csvPreview.skipped.length}` : ""}
                  </div>
                  {csvPreview.skipped?.length ? (
                    <ul className="text-xs mt-2 list-disc list-inside text-green-800">
                      {csvPreview.skipped.map((s, i) => (
                        <li key={i}>
                          {s.code}: {s.reason}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---------- Subcomponents ----------

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${
        active ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-700"
      }`}
    >
      {label}
    </button>
  );
}

type Tone = "neutral" | "amber" | "blue" | "green";
const toneClasses: Record<Tone, { border: string; bg: string; chip: string }> = {
  neutral: { border: "border-ink-200", bg: "bg-ink-50/40", chip: "bg-ink-100 text-ink-700" },
  amber: { border: "border-amber-200", bg: "bg-amber-50/40", chip: "bg-amber-100 text-amber-800" },
  blue: { border: "border-blue-200", bg: "bg-blue-50/40", chip: "bg-blue-100 text-blue-800" },
  green: { border: "border-green-200", bg: "bg-green-50/40", chip: "bg-green-100 text-green-800" },
};

function Column({
  title,
  count,
  hint,
  empty,
  tone,
  onSelectAll,
  onClear,
  pickedInColumn,
  children,
}: {
  title: string;
  count: number;
  hint: string;
  empty: string;
  tone: Tone;
  onSelectAll?: () => void;
  onClear?: () => void;
  pickedInColumn?: number;
  children: React.ReactNode;
}) {
  const t = toneClasses[tone];
  return (
    <div className={`rounded-lg border ${t.border} ${t.bg} flex flex-col`}>
      <div className="px-3 py-2.5 border-b border-ink-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-900">{title}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.chip}`}>{count}</span>
        </div>
        {onSelectAll && count > 0 && (
          <div className="flex items-center gap-1 text-[11px]">
            {!!pickedInColumn && pickedInColumn > 0 && (
              <span className="text-ink-500 font-medium">{pickedInColumn} picked</span>
            )}
            <button
              type="button"
              onClick={onSelectAll}
              className="text-ink-500 hover:text-ink-900 px-1.5 py-0.5 rounded hover:bg-white"
            >
              Select all
            </button>
            {!!pickedInColumn && pickedInColumn > 0 && onClear && (
              <button
                type="button"
                onClick={onClear}
                className="text-ink-500 hover:text-ink-900 px-1.5 py-0.5 rounded hover:bg-white"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>
      <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-ink-500">{hint}</div>
      <div className="p-2 space-y-2 min-h-[100px]">
        {count === 0 ? <div className="text-xs text-ink-400 italic px-2 py-3">{empty}</div> : children}
      </div>
    </div>
  );
}

function OpenCard({
  item,
  expanded,
  creating,
  isPreviewed,
  picked,
  onTogglePick,
  onToggle,
  onMarkPreviewed,
  onCreate,
}: {
  item: PreviewItem;
  expanded: boolean;
  creating: boolean;
  isPreviewed?: boolean;
  picked: boolean;
  onTogglePick: () => void;
  onToggle: () => void;
  onMarkPreviewed: () => void;
  onCreate: () => void;
}) {
  return (
    <div className={`bg-white rounded-md border shadow-sm ${picked ? "border-ink-900 ring-1 ring-ink-900" : "border-ink-200"}`}>
      <div className="flex items-start gap-1.5 px-2 pt-2">
        <input
          type="checkbox"
          checked={picked}
          onChange={onTogglePick}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 mt-1 rounded border-ink-300"
        />
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 text-left px-1 py-0.5 hover:bg-ink-50/60 rounded flex items-start justify-between gap-2"
        >
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink-900 truncate">{item.fullName || "(no name)"}</div>
          <div className="text-xs text-ink-500 truncate">{item.email}</div>
          <div className="text-xs mt-1 flex items-center gap-2">
            <span className="tabular-nums font-semibold text-ink-900">{fmtMoney(item.netMinor)}</span>
            <span className="text-ink-400">·</span>
            <span className="tabular-nums text-ink-500">
              {item.totalHours.toFixed(1)}h × {item.sheetCount}
            </span>
            {item.rctRate && (
              <Badge tone="neutral">
                RCT {item.rctRate}%
              </Badge>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-ink-400 mt-1" /> : <ChevronDown className="h-4 w-4 text-ink-400 mt-1" />}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-ink-100 mt-2 pt-2 text-xs text-ink-700 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-ink-500">Gross</span>
            <span className="tabular-nums">{fmtMoney(item.grossMinor)}</span>
          </div>
          <div className="flex justify-between text-red-700">
            <span>RCT ({item.rctRate || "-"}%)</span>
            <span className="tabular-nums">-{fmtMoney(item.rctDeductionMinor)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-ink-100 pt-1.5">
            <span>Net</span>
            <span className="tabular-nums">{fmtMoney(item.netMinor)}</span>
          </div>
          <div className="text-ink-500 text-[11px] pt-1">
            {item.sheetCount} timesheet{item.sheetCount === 1 ? "" : "s"} · {item.totalHours.toFixed(1)}h
          </div>

          <div className="pt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={onMarkPreviewed} leftIcon={<Eye className="h-3.5 w-3.5" />}>
              {isPreviewed ? "Unmark" : "Mark previewed"}
            </Button>
            <Button size="sm" variant="accent" onClick={onCreate} loading={creating} leftIcon={<Send className="h-3.5 w-3.5" />}>
              Create advice
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentCard({
  payment,
  expanded,
  picked,
  onTogglePick,
  onToggle,
  onMarkPaid,
}: {
  payment: PaymentItem;
  expanded: boolean;
  picked: boolean;
  onTogglePick: () => void;
  onToggle: () => void;
  onMarkPaid?: () => void;
}) {
  const statusBadge = () => {
    if (payment.status === "paid") return <Badge tone="success">paid</Badge>;
    if (payment.status === "invoiced") return <Badge tone="warn">invoiced</Badge>;
    return <Badge tone="info">advised</Badge>;
  };
  return (
    <div className={`bg-white rounded-md border shadow-sm ${picked ? "border-ink-900 ring-1 ring-ink-900" : "border-ink-200"}`}>
      <div className="flex items-start gap-1.5 px-2 pt-2">
        <input
          type="checkbox"
          checked={picked}
          onChange={onTogglePick}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 mt-1 rounded border-ink-300"
        />
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 text-left px-1 py-0.5 hover:bg-ink-50/60 rounded flex items-start justify-between gap-2"
        >
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink-900 truncate">{payment.subcontractorName || "(no name)"}</div>
          <div className="text-xs text-ink-500 truncate">
            {payment.invoiceNumber ? (
              <span className="font-mono">{payment.invoiceNumber}</span>
            ) : (
              payment.subcontractorEmail || ""
            )}
          </div>
          <div className="text-xs mt-1 flex items-center gap-2">
            <span className="tabular-nums font-semibold text-ink-900">{fmtMoney(payment.netMinor)}</span>
            <span className="text-ink-400">·</span>
            {statusBadge()}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-ink-400 mt-1" /> : <ChevronDown className="h-4 w-4 text-ink-400 mt-1" />}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-ink-100 mt-2 pt-2 text-xs text-ink-700 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-ink-500">Date</span>
            <span className="tabular-nums">{payment.paymentDate}</span>
          </div>
          {payment.periodStart && payment.periodEnd && (
            <div className="flex justify-between">
              <span className="text-ink-500">Period</span>
              <span className="tabular-nums">
                {payment.periodStart} → {payment.periodEnd}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-ink-500">Gross</span>
            <span className="tabular-nums">{fmtMoney(payment.grossMinor)}</span>
          </div>
          <div className="flex justify-between text-red-700">
            <span>RCT ({payment.rctRate || "-"}%)</span>
            <span className="tabular-nums">-{fmtMoney(payment.rctDeductionMinor)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-ink-100 pt-1.5">
            <span>Net</span>
            <span className="tabular-nums">{fmtMoney(payment.netMinor)}</span>
          </div>
          {payment.invoiceNumber && (
            <div className="text-ink-500 text-[11px] pt-1 flex items-center gap-1">
              <FileText className="h-3 w-3" /> Invoice {payment.invoiceNumber}
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <a
              href={`#/admin/subcontractors/${payment.subcontractorId}`}
              className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
            >
              <Loader2 className="h-3 w-3 hidden" />
              Open sub
            </a>
            {payment.status === "invoiced" && onMarkPaid && (
              <Button size="sm" variant="accent" onClick={onMarkPaid} leftIcon={<CreditCard className="h-3.5 w-3.5" />}>
                Mark paid
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
