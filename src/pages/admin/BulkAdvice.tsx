import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PortalShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Empty } from "@/components/ui/Empty";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { Send, Eye, Mail, AlertTriangle, CheckCircle2 } from "lucide-react";

// Bulk Payment Advice page. Admin picks a date range, sees a per-sub
// preview of approved+unpaid hours and the computed gross/RCT/net, ticks
// the rows to include, and clicks "Send advices" — each ticked sub gets
// a payment record in 'advised' state and (by default) an email saying
// "you have a new payment advice in your portal".

type PreviewItem = Awaited<ReturnType<typeof api.adminBulkAdvicePreview>>["items"][number];

function fmtMoney(minor: number, currency = "EUR") {
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

export function BulkAdvice() {
  const toast = useToast();
  // Default range: this calendar week (Mon → today). Easy to change.
  const today = new Date();
  const day = today.getDay() || 7; // Sun=0 → 7
  const monday = new Date(today); monday.setDate(today.getDate() - (day - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [from, setFrom] = useState(iso(monday));
  const [to, setTo] = useState(iso(today));
  const [items, setItems] = useState<PreviewItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notify, setNotify] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.adminBulkAdviceSend>> | null>(null);

  const preview = async () => {
    setLoading(true); setResult(null);
    try {
      const r = await api.adminBulkAdvicePreview(from, to);
      setItems(r.items);
      // Pre-select all eligible ones so the common case is one click away.
      setSelected(new Set(r.items.filter((i) => i.eligible).map((i) => i.subcontractorId)));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load preview");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one subcontractor");
      return;
    }
    if (!confirm(`Send ${selected.size} payment advice${selected.size === 1 ? "" : "s"}?\n\nThis will create payment records and ${notify ? "EMAIL each subcontractor" : "create records silently"}.`)) return;
    setSending(true);
    try {
      const r = await api.adminBulkAdviceSend(from, to, [...selected], notify);
      setResult(r);
      toast.success(`Created ${r.created.length} advices${r.skipped.length ? `, skipped ${r.skipped.length}` : ""}`);
      // Refresh preview so the just-sent rows disappear (no longer eligible).
      await preview();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const eligibleCount = items?.filter((i) => i.eligible).length || 0;
  const totalSelectedGross = items
    ?.filter((i) => selected.has(i.subcontractorId))
    .reduce((s, i) => s + i.grossMinor, 0) || 0;

  return (
    <>
      <PageHeader
        title="Bulk Payment Advice"
        description="Generate a payment advice for every subcontractor with approved hours in a period. They'll see it in their portal and (optionally) get an email."
      />

      <div className="card-padded mb-5">
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <div>
            <label className="text-xs uppercase tracking-wider text-ink-500 font-semibold">
              Notify
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              Email each sub when sent
            </label>
          </div>
          <Button variant="primary" onClick={preview} loading={loading} leftIcon={<Eye className="h-4 w-4" />}>
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
                    <li key={i}>{s.subId.slice(0, 8)}: {s.reason}</li>
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
        <Empty
          icon={CheckCircle2}
          title="Nothing to advise"
          description="No subs have approved, unpaid timesheets in that period."
        />
      ) : (
        <>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="text-sm text-ink-600">
              <strong>{eligibleCount}</strong> eligible / {items.length} total ·{" "}
              <strong>{selected.size}</strong> selected · total gross{" "}
              <strong>{fmtMoney(totalSelectedGross)}</strong>
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

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 border-b border-ink-100">
                <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && items.filter((i) => i.eligible).every((i) => selected.has(i.subcontractorId))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelected(new Set(items.filter((i) => i.eligible).map((i) => i.subcontractorId)));
                        } else {
                          setSelected(new Set());
                        }
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
                {items.map((i) => (
                  <tr
                    key={i.subcontractorId}
                    className={`border-b border-ink-100 last:border-b-0 ${i.eligible ? "hover:bg-ink-50/50" : "bg-amber-50/40"}`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        disabled={!i.eligible}
                        checked={selected.has(i.subcontractorId)}
                        onChange={() => toggle(i.subcontractorId)}
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
                      {i.rateAmountMinor ? `${fmtMoney(i.rateAmountMinor)}/${i.rateUnit}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-medium">
                      {i.eligible ? fmtMoney(i.grossMinor) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-red-700">
                      {i.eligible && i.rctRate ? `-${fmtMoney(i.rctDeductionMinor)} (${i.rctRate}%)` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-bold">
                      {i.eligible ? fmtMoney(i.netMinor) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
