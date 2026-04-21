import { useMemo } from "react";
import { fmtMoney } from "@/lib/format";
import type { PaymentRecord, RateUnit } from "@/lib/types";
import { TrendingUp, Wallet, Clock, Calendar } from "lucide-react";

interface Props {
  items: PaymentRecord[];
  rateAmountMinor?: number | null;
  rateUnit?: RateUnit | null;
}

interface Stats {
  currency: string;
  lifetimeGross: number;
  lifetimeNet: number;
  lifetimeRct: number;
  ytdGross: number;
  ytdNet: number;
  ytdRct: number;
  thisMonthGross: number;
  thisMonthNet: number;
  lastMonthGross: number;
  lastMonthNet: number;
  totalHours: number;
  countByStatus: Record<string, number>;
  byMonth: { label: string; ym: string; gross: number; net: number }[];
  hasAnyRct: boolean;
}

function groupByCurrency(items: PaymentRecord[]): Map<string, PaymentRecord[]> {
  const m = new Map<string, PaymentRecord[]>();
  for (const p of items) {
    const arr = m.get(p.currency) ?? [];
    arr.push(p);
    m.set(p.currency, arr);
  }
  return m;
}

function ymOf(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function labelOf(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function computeStats(items: PaymentRecord[], currency: string): Stats {
  const now = new Date();
  const thisYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastYm = `${lastD.getFullYear()}-${String(lastD.getMonth() + 1).padStart(2, "0")}`;
  const thisYear = String(now.getFullYear());

  let lifetimeGross = 0, lifetimeNet = 0, lifetimeRct = 0;
  let ytdGross = 0, ytdNet = 0, ytdRct = 0;
  let thisMonthGross = 0, thisMonthNet = 0;
  let lastMonthGross = 0, lastMonthNet = 0;
  let totalHours = 0;
  let hasAnyRct = false;
  const countByStatus: Record<string, number> = {};
  const monthMap = new Map<string, { gross: number; net: number }>();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(ym, { gross: 0, net: 0 });
  }

  for (const p of items) {
    const g = p.grossMinor ?? p.amountMinor;
    const n = p.netMinor ?? g;
    const r = p.rctDeductionMinor ?? 0;
    lifetimeGross += g; lifetimeNet += n; lifetimeRct += r;
    if (p.rctRate) hasAnyRct = true;
    if (p.paymentDate.startsWith(thisYear)) { ytdGross += g; ytdNet += n; ytdRct += r; }
    const ym = ymOf(p.paymentDate);
    if (ym === thisYm) { thisMonthGross += g; thisMonthNet += n; }
    if (ym === lastYm) { lastMonthGross += g; lastMonthNet += n; }
    if (typeof p.hours === "number") totalHours += p.hours;
    countByStatus[p.status] = (countByStatus[p.status] ?? 0) + 1;
    const cur = monthMap.get(ym);
    if (cur) monthMap.set(ym, { gross: cur.gross + g, net: cur.net + n });
  }

  const byMonth = Array.from(monthMap.entries()).map(([ym, v]) => ({
    ym, label: labelOf(ym), gross: v.gross, net: v.net,
  }));

  return {
    currency,
    lifetimeGross, lifetimeNet, lifetimeRct,
    ytdGross, ytdNet, ytdRct,
    thisMonthGross, thisMonthNet,
    lastMonthGross, lastMonthNet,
    totalHours, countByStatus, byMonth, hasAnyRct,
  };
}

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className={`card p-5 ${accent ? "bg-ink-950 text-white border-ink-950" : ""} relative overflow-hidden`}>
      {accent && (
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle at 100% 0%, #F59E0B 0, transparent 50%)",
        }} />
      )}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg grid place-items-center ${
            accent ? "bg-white/10 text-accent-300" : "bg-ink-100 text-ink-700"
          }`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className={`text-xs font-semibold uppercase tracking-wider ${accent ? "text-ink-300" : "text-ink-500"}`}>
            {label}
          </div>
        </div>
        <div className={`text-2xl md:text-3xl font-bold tabular-nums mt-3 ${accent ? "" : "text-ink-900"}`}>
          {value}
        </div>
        {sub && <div className={`text-xs mt-1 ${accent ? "text-ink-300" : "text-ink-500"}`}>{sub}</div>}
      </div>
    </div>
  );
}

function BarChart({
  data,
  currency,
  showNet,
}: {
  data: { label: string; gross: number; net: number }[];
  currency: string;
  showNet: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.gross));
  return (
    <div className="card-padded">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-ink-900">Last 12 months</h3>
          <p className="text-xs text-ink-500 mt-0.5">
            {showNet ? `Gross (dark) vs. Net of RCT (amber) · ${currency}` : `Monthly income (${currency})`}
          </p>
        </div>
      </div>
      <div className="flex items-end gap-2 h-40">
        {data.map((d) => {
          const gh = d.gross === 0 ? 2 : Math.max(6, Math.round((d.gross / max) * 140));
          const nh = d.gross === 0 ? 2 : Math.max(2, Math.round((d.net / max) * 140));
          return (
            <div key={d.label} className="flex-1 min-w-0 flex flex-col items-center gap-1">
              <div className="flex-1 w-full flex items-end gap-0.5">
                <div
                  className={`flex-1 rounded-t-md transition-all ${
                    d.gross === 0 ? "bg-ink-100" : "bg-gradient-to-t from-ink-800 to-ink-900"
                  }`}
                  style={{ height: `${gh}px` }}
                  title={d.gross ? `Gross ${fmtMoney(d.gross, currency)}` : ""}
                />
                {showNet && (
                  <div
                    className={`flex-1 rounded-t-md transition-all ${
                      d.gross === 0 ? "bg-ink-100" : "bg-gradient-to-t from-accent-400 to-accent-500"
                    }`}
                    style={{ height: `${nh}px` }}
                    title={d.gross ? `Net ${fmtMoney(d.net, currency)}` : ""}
                  />
                )}
              </div>
              <div className="text-[10px] text-ink-500 truncate w-full text-center">
                {d.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const RATE_LABEL: Record<RateUnit, string> = {
  hour: "hr",
  day: "day",
  week: "week",
  fixed: "fixed",
};

export function IncomeSummary({ items, rateAmountMinor, rateUnit }: Props) {
  const grouped = useMemo(() => groupByCurrency(items), [items]);
  const currencies = Array.from(grouped.keys()).sort();

  if (items.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-ink-100 grid place-items-center mb-3">
          <Wallet className="h-6 w-6 text-ink-500" />
        </div>
        <div className="text-ink-700 font-medium">No income yet</div>
        <div className="text-sm text-ink-500 mt-1">
          As payments are recorded, your summary and chart will appear here.
        </div>
      </div>
    );
  }

  // Primary currency = one with highest total
  const primaryCurrency = [...grouped.entries()].sort((a, b) => {
    const sum = (arr: PaymentRecord[]) => arr.reduce((s, p) => s + p.amountMinor, 0);
    return sum(b[1]) - sum(a[1]);
  })[0][0];
  const stats = computeStats(grouped.get(primaryCurrency)!, primaryCurrency);
  const rateText =
    rateAmountMinor && rateUnit
      ? `${fmtMoney(rateAmountMinor, primaryCurrency)} / ${RATE_LABEL[rateUnit]}`
      : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="This month"
          value={fmtMoney(stats.thisMonthGross, primaryCurrency)}
          sub={
            stats.hasAnyRct
              ? `Net ${fmtMoney(stats.thisMonthNet, primaryCurrency)}`
              : stats.lastMonthGross
              ? `Last: ${fmtMoney(stats.lastMonthGross, primaryCurrency)}`
              : undefined
          }
          icon={Calendar}
          accent
        />
        <Stat
          label="YTD gross"
          value={fmtMoney(stats.ytdGross, primaryCurrency)}
          sub={
            stats.hasAnyRct
              ? `RCT withheld ${fmtMoney(stats.ytdRct, primaryCurrency)}`
              : `${items.filter((p) => p.paymentDate.startsWith(String(new Date().getFullYear()))).length} payments`
          }
          icon={TrendingUp}
        />
        <Stat
          label={stats.hasAnyRct ? "YTD net" : "Lifetime"}
          value={fmtMoney(stats.hasAnyRct ? stats.ytdNet : stats.lifetimeGross, primaryCurrency)}
          sub={
            stats.hasAnyRct
              ? `Lifetime net ${fmtMoney(stats.lifetimeNet, primaryCurrency)}`
              : `${items.length} payments total`
          }
          icon={Wallet}
        />
        <Stat
          label="Hours logged"
          value={stats.totalHours.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          sub={rateText ? `Rate: ${rateText}` : "No rate set"}
          icon={Clock}
        />
      </div>

      <BarChart data={stats.byMonth} currency={primaryCurrency} showNet={stats.hasAnyRct} />

      {currencies.length > 1 && (
        <div className="rounded-lg bg-ink-50 border border-ink-200 p-3 text-xs text-ink-600">
          Showing stats in {primaryCurrency}. Other currencies in your history:{" "}
          {currencies.filter((c) => c !== primaryCurrency).join(", ")}.
        </div>
      )}
    </div>
  );
}
