// Subcontractor Contracts list. Card-based layout designed for phones:
// big tap targets, status badge, counterparty (template name), date.
// Filter bar above with status pills + free-text search + date range.
//
// Today most subs have one contract; tomorrow they may have multiple
// (new template version per year, renewals). The data model already
// supports many - this page is the corresponding read surface.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { ContractRecord } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PortalShell";
import { FilterBar, presetToRange, type DatePreset } from "@/components/ui/FilterBar";
import { fmtDate } from "@/lib/format";
import { FileText, ChevronRight, CheckCircle2, PenLine, Eye } from "lucide-react";

type ContractItem = ContractRecord & { templateName: string | null };

function statusTone(s: ContractRecord["status"]) {
  if (s === "signed") return { tone: "success" as const, label: "Signed", icon: CheckCircle2 };
  if (s === "viewed") return { tone: "info" as const, label: "Awaiting signature", icon: PenLine };
  if (s === "generated") return { tone: "warn" as const, label: "Ready to sign", icon: PenLine };
  if (s === "superseded") return { tone: "neutral" as const, label: "Replaced", icon: Eye };
  return { tone: "neutral" as const, label: s, icon: FileText };
}

export function Contracts() {
  const toast = useToast();
  const [items, setItems] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const r = await api.listMyContracts();
        setItems(r.items);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Failed to load contracts");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c = { all: items.length, awaiting: 0, signed: 0, replaced: 0 };
    for (const it of items) {
      if (it.status === "signed") c.signed++;
      else if (it.status === "superseded") c.replaced++;
      else c.awaiting++;
    }
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const { from, to } = presetToRange(datePreset, dateFrom, dateTo);
    const fromTs = from ? new Date(`${from}T00:00:00Z`).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59Z`).getTime() : null;
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (statusFilter === "awaiting" && (it.status === "signed" || it.status === "superseded")) return false;
      if (statusFilter === "signed" && it.status !== "signed") return false;
      if (statusFilter === "replaced" && it.status !== "superseded") return false;
      if (fromTs !== null || toTs !== null) {
        // Filter by signed date if signed, otherwise by created date.
        const ref = it.signedAt || it.createdAt || 0;
        if (fromTs !== null && ref < fromTs) return false;
        if (toTs !== null && ref > toTs) return false;
      }
      if (q) {
        const hay = [it.templateName, it.signedName, String(it.templateVersion || "")]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, statusFilter, search, datePreset, dateFrom, dateTo]);

  return (
    <>
      <PageHeader
        title="My Contracts"
        description="Read, sign and review every contract issued to you."
      />

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
        </div>
      ) : items.length === 0 ? (
        <Empty
          icon={FileText}
          title="No contracts yet"
          description="When the office generates a contract for you, it will appear here."
        />
      ) : (
        <>
          <FilterBar
            pills={[
              { value: "all",      label: "All",                 count: counts.all },
              { value: "awaiting", label: "Awaiting my signature", count: counts.awaiting },
              { value: "signed",   label: "Signed",              count: counts.signed },
              { value: "replaced", label: "Replaced",            count: counts.replaced },
            ]}
            activePill={statusFilter}
            onPillChange={setStatusFilter}
            searchValue={search}
            searchPlaceholder="Search template or signed name..."
            onSearchChange={setSearch}
            datePreset={datePreset}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateChange={(preset, from, to) => {
              setDatePreset(preset);
              if (preset === "custom") {
                setDateFrom(from || "");
                setDateTo(to || "");
              }
            }}
          />

          {visible.length === 0 ? (
            <div className="card-padded text-center text-sm text-ink-500">
              No contracts match the current filter.
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((it) => {
                const s = statusTone(it.status);
                const Icon = s.icon;
                return (
                  <Link
                    key={it.id}
                    to={`/app/contracts/${it.id}`}
                    className="card p-4 min-h-16 flex items-center gap-3 hover:bg-ink-50/60 transition"
                  >
                    <div className="h-10 w-10 rounded-lg bg-ink-100 text-ink-700 grid place-items-center shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium text-ink-900 truncate">
                          {it.templateName || "Contract"}
                        </div>
                        {it.templateVersion ? (
                          <Badge tone="neutral">v{it.templateVersion}</Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <Badge tone={s.tone} icon={<Icon className="h-3 w-3" />}>{s.label}</Badge>
                        <span>
                          {it.signedAt
                            ? `Signed ${fmtDate(new Date(it.signedAt).toISOString().slice(0, 10))}`
                            : it.createdAt
                              ? `Issued ${fmtDate(new Date(it.createdAt).toISOString().slice(0, 10))}`
                              : null}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-ink-300 shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
