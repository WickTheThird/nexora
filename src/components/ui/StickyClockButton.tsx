// Persistent clock-in / clock-out FAB anchored above the BottomNav.
// Visible only on mobile (< lg) and hidden when the user is already
// on the Timesheets page (which has its own primary clock control).
//
// State is read from /me/timesheets/active. A successful clock-in/out
// triggers an optional onChange callback so parent pages can refresh
// counters / hour totals.

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Play, Square, Clock } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Timesheet } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

export function StickyClockButton({ onChange }: { onChange?: () => void } = {}) {
  const { pathname } = useLocation();
  const toast = useToast();
  const [active, setActive] = useState<Timesheet | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0); // forces a re-render every minute

  const refresh = async () => {
    try {
      setActive(await api.getMyActiveClock());
    } catch {
      /* non-fatal */
    }
  };

  useEffect(() => { refresh(); }, []);
  // Tick once a minute so the elapsed-time label updates when clocked in.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // Hide on the Timesheets page itself (avoid two clock controls).
  const onTimesheets = pathname.startsWith("/app/timesheets");
  if (onTimesheets) return null;

  const start = async () => {
    setBusy(true);
    try {
      await api.clockIn();
      await refresh();
      toast.success("Clocked in");
      onChange?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to clock in");
    } finally {
      setBusy(false);
    }
  };
  const stop = async () => {
    setBusy(true);
    try {
      await api.clockOut();
      await refresh();
      toast.success("Clocked out");
      onChange?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to clock out");
    } finally {
      setBusy(false);
    }
  };

  const elapsedLabel = () => {
    if (!active?.clockInAt) return "";
    const ms = Date.now() - (active.clockInAt as number);
    const minutes = Math.floor(ms / 60_000);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Marker comment so React isn't told the unused tick variable is dead
  // code at build time. The tick state is here only to drive re-renders.
  void tick;

  return (
    <button
      type="button"
      onClick={active ? stop : start}
      disabled={busy}
      aria-label={active ? "Clock out" : "Clock in"}
      className={`lg:hidden fixed right-4 z-40 min-h-14 min-w-14 px-4 rounded-full shadow-elev flex items-center gap-2 transition ${
        active
          ? "bg-emerald-600 text-white"
          : "bg-ink-900 text-white"
      } ${busy ? "opacity-70" : ""}`}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 70px)" }}
    >
      {active ? <Square className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      <span className="text-sm font-semibold whitespace-nowrap">
        {active ? `Clock out · ${elapsedLabel()}` : "Clock in"}
      </span>
      {!active && <Clock className="h-4 w-4 opacity-60" />}
    </button>
  );
}
