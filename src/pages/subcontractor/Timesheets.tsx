import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { Timesheet } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/layout/PortalShell";
import { fmtDate, fmtDateTime } from "@/lib/format";
import {
  Clock,
  Plus,
  Trash2,
  Pencil,
  Play,
  Square,
  CheckCircle2,
  XCircle,
} from "lucide-react";

function statusBadge(s: Timesheet["status"]) {
  switch (s) {
    case "approved":  return <Badge tone="success" icon={<CheckCircle2 className="h-3 w-3" />}>Approved</Badge>;
    case "rejected":  return <Badge tone="danger" icon={<XCircle className="h-3 w-3" />}>Rejected</Badge>;
    case "submitted": return <Badge tone="info" icon={<Clock className="h-3 w-3" />}>Submitted</Badge>;
    case "draft":     return <Badge tone="warn">Draft</Badge>;
    case "paid":      return <Badge tone="success">Paid</Badge>;
  }
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function Timesheets() {
  const toast = useToast();
  const [items, setItems] = useState<Timesheet[]>([]);
  const [active, setActive] = useState<Timesheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(isoToday());

  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState(isoToday());
  const [createHours, setCreateHours] = useState("");
  const [createSite, setCreateSite] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<Timesheet | null>(null);
  const [editHours, setEditHours] = useState("");
  const [editSite, setEditSite] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [clockSite, setClockSite] = useState("");
  const [clocking, setClocking] = useState(false);

  const refresh = async () => {
    const [list, act] = await Promise.all([
      api.listMyTimesheets({ from, to }),
      api.getMyActiveClock(),
    ]);
    setItems(list.items);
    setActive(act);
  };

  useEffect(() => {
    (async () => {
      try { await refresh(); } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = async () => {
    setLoading(true);
    try { await refresh(); } finally { setLoading(false); }
  };

  const startClock = async () => {
    setClocking(true);
    try {
      await api.clockIn(clockSite || null);
      setClockSite("");
      await refresh();
      toast.success("Clocked in");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to clock in");
    } finally {
      setClocking(false);
    }
  };

  const stopClock = async () => {
    setClocking(true);
    try {
      await api.clockOut();
      await refresh();
      toast.success("Clocked out");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to clock out");
    } finally {
      setClocking(false);
    }
  };

  const create = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setCreating(true);
    try {
      const h = createHours ? parseFloat(createHours) : null;
      if (h !== null && (!Number.isFinite(h) || h < 0 || h > 24)) throw new Error("Hours must be 0–24");
      await api.createMyTimesheet({
        workDate: createDate,
        hours: h,
        siteRef: createSite || null,
        notes: createNotes || null,
      });
      setCreateOpen(false);
      setCreateHours(""); setCreateSite(""); setCreateNotes("");
      await refresh();
      toast.success("Timesheet added");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (t: Timesheet) => {
    setEditing(t);
    setEditHours(t.hours != null ? String(t.hours) : "");
    setEditSite(t.siteRef || "");
    setEditNotes(t.notes || "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const h = editHours ? parseFloat(editHours) : null;
      if (h !== null && (!Number.isFinite(h) || h < 0 || h > 24)) throw new Error("Hours must be 0–24");
      await api.patchMyTimesheet(editing.id, {
        hours: h,
        siteRef: editSite || null,
        notes: editNotes || null,
      });
      setEditing(null);
      await refresh();
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSavingEdit(false);
    }
  };

  const del = async (t: Timesheet) => {
    if (!confirm(`Delete timesheet for ${fmtDate(t.workDate)}?`)) return;
    try {
      await api.deleteMyTimesheet(t.id);
      await refresh();
      toast.info("Deleted");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to delete");
    }
  };

  // Stats for the header
  const totalHours = items.reduce((s, t) => s + (t.hours || 0), 0);
  const approvedHours = items.filter(t => t.status === "approved" || t.status === "paid")
    .reduce((s, t) => s + (t.hours || 0), 0);

  return (
    <>
      <PageHeader
        title="Timesheets"
        description="Track your hours daily. Clock in when you start, clock out when you finish, or just enter the hours manually."
        right={
          <Button variant="accent" onClick={() => { setCreateDate(isoToday()); setCreateOpen(true); }} leftIcon={<Plus className="h-4 w-4" />}>
            Add timesheet
          </Button>
        }
      />

      {/* Clock in/out widget */}
      <div className={`card p-5 mb-6 ${active ? "bg-ink-950 text-white" : ""}`}>
        {active ? (
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider text-accent-300 font-semibold">
                Currently clocked in
              </div>
              <div className="text-2xl font-bold mt-1">
                Since {fmtDateTime(active.clockInAt)}
              </div>
              {active.siteRef && (
                <div className="text-sm text-ink-300 mt-1">Site: {active.siteRef}</div>
              )}
            </div>
            <Button variant="accent" onClick={stopClock} loading={clocking} leftIcon={<Square className="h-4 w-4" />}>
              Clock out
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <Input
                label="Site (optional)"
                value={clockSite}
                onChange={(e) => setClockSite(e.target.value)}
                placeholder="Site reference / address"
              />
            </div>
            <Button variant="primary" onClick={startClock} loading={clocking} leftIcon={<Play className="h-4 w-4" />}>
              Clock in
            </Button>
          </div>
        )}
      </div>

      {/* Filter + stats */}
      <div className="card-padded mb-6">
        <div className="flex items-end gap-3 flex-wrap">
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="outline" onClick={applyFilters}>Apply</Button>
          <div className="ml-auto flex gap-6">
            <div>
              <div className="text-xs text-ink-500 uppercase tracking-wider font-semibold">Hours in range</div>
              <div className="text-2xl font-bold tabular-nums">{totalHours.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-ink-500 uppercase tracking-wider font-semibold">Approved / paid</div>
              <div className="text-2xl font-bold tabular-nums text-emerald-700">{approvedHours.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty icon={Clock} title="No timesheets in this range" description="Add one or clock in to start." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Hours</th>
                <th className="px-5 py-3">Clock in / out</th>
                <th className="px-5 py-3">Site</th>
                <th className="px-5 py-3">Notes</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                  <td className="px-5 py-3 text-sm text-ink-900 font-medium">{fmtDate(t.workDate)}</td>
                  <td className="px-5 py-3 text-sm tabular-nums text-ink-900">
                    {t.hours != null ? t.hours.toFixed(2) : <span className="text-ink-400">·</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-600">
                    {t.clockInAt ? new Date(t.clockInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "·"}
                    {" → "}
                    {t.clockOutAt ? new Date(t.clockOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "·"}
                  </td>
                  <td className="px-5 py-3 text-sm text-ink-600">{t.siteRef || <span className="text-ink-400">·</span>}</td>
                  <td className="px-5 py-3 text-sm text-ink-600 max-w-[260px] truncate" title={t.notes || ""}>
                    {t.notes || <span className="text-ink-400">·</span>}
                  </td>
                  <td className="px-5 py-3">{statusBadge(t.status)}</td>
                  <td className="px-5 py-3 text-right">
                    {(t.status === "draft" || t.status === "submitted" || t.status === "rejected") && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => startEdit(t)} leftIcon={<Pencil className="h-3.5 w-3.5" />}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => del(t)} leftIcon={<Trash2 className="h-3.5 w-3.5" />}>
                          Delete
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add timesheet"
        description="Enter your hours for a specific day."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={() => create()} loading={creating}>Save</Button>
          </>
        }
      >
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date" type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} required />
            <Input label="Hours" type="number" step="0.25" value={createHours} onChange={(e) => setCreateHours(e.target.value)} placeholder="e.g. 8" />
          </div>
          <Input label="Site (optional)" value={createSite} onChange={(e) => setCreateSite(e.target.value)} placeholder="Job site / address / Revenue site ID" />
          <Input label="Notes (optional)" value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder="Anything relevant" />
        </form>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit timesheet"
        description={editing ? `For ${fmtDate(editing.workDate)}` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="accent" onClick={saveEdit} loading={savingEdit}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Hours" type="number" step="0.25" value={editHours} onChange={(e) => setEditHours(e.target.value)} />
          <Input label="Site" value={editSite} onChange={(e) => setEditSite(e.target.value)} />
          <Input label="Notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
        </div>
      </Modal>
    </>
  );
}
