// Principal Contracts list. Every contract this principal has with
// their operatives, one row per (sub, site) assignment. Read-only -
// new contracts are generated automatically when the principal assigns
// an operative to a site from the Subcontractors page.
//
// Mobile-friendly card list with status pills + per-row Site / Sub
// search.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { ContractRecord } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PortalShell";
import { FilterBar } from "@/components/ui/FilterBar";
import { fmtDate } from "@/lib/format";
import { FileText, ChevronRight, CheckCircle2, PenLine, Eye } from "lucide-react";

type Row = Awaited<ReturnType<typeof api.primaryListContracts>>["items"][number];

function statusTone(s: ContractRecord["status"]) {
  if (s === "signed") return { tone: "success" as const, label: "Signed", icon: CheckCircle2 };
  if (s === "viewed") return { tone: "info" as const, label: "Awaiting signature", icon: PenLine };
  if (s === "generated") return { tone: "warn" as const, label: "Sent for signature", icon: PenLine };
  if (s === "superseded") return { tone: "neutral" as const, label: "Replaced", icon: Eye };
  return { tone: "neutral" as const, label: s, icon: FileText };
}

export function PrimaryContracts() {
  const toast = useToast();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await api.primaryListContracts();
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
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (statusFilter === "awaiting" && (it.status === "signed" || it.status === "superseded")) return false;
      if (statusFilter === "signed" && it.status !== "signed") return false;
      if (statusFilter === "replaced" && it.status !== "superseded") return false;
      if (q) {
        const hay = [
          it.subcontractorName, it.subcontractorEmail, it.subcontractorRef,
          it.siteCode, it.siteProject, it.siteAddress, it.templateName,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, statusFilter, search]);

  return (
    <>
      <PageHeader
        title="Contracts"
        description="Every contract you have with your operatives, one per (operative, site). New contracts are generated automatically when you assign an operative to a site."
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
          description="Assign an operative to a site from your Subcontractors page and a contract will be generated for them to sign."
        />
      ) : (
        <>
          <FilterBar
            pills={[
              { value: "all",      label: "All",                count: counts.all },
              { value: "awaiting", label: "Awaiting signature", count: counts.awaiting },
              { value: "signed",   label: "Signed",             count: counts.signed },
              { value: "replaced", label: "Replaced",           count: counts.replaced },
            ]}
            activePill={statusFilter}
            onPillChange={setStatusFilter}
            searchValue={search}
            searchPlaceholder="Search operative, site, project..."
            onSearchChange={setSearch}
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
                  <div key={it.id} className="card p-4 flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-ink-100 text-ink-700 grid place-items-center shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium text-ink-900 truncate">
                          {it.subcontractorName || it.subcontractorEmail || "Operative"}
                        </div>
                        {it.subcontractorRef && (
                          <span className="font-mono text-[11px] text-ink-500">{it.subcontractorRef}</span>
                        )}
                      </div>
                      <div className="text-xs text-ink-600 mt-1 flex items-center gap-2 flex-wrap">
                        <Badge tone={s.tone} icon={<Icon className="h-3 w-3" />}>{s.label}</Badge>
                        {it.siteProject || it.siteCode ? (
                          <span>{it.siteProject || it.siteCode}{it.siteAddress ? ` - ${it.siteAddress}` : ""}</span>
                        ) : null}
                        <span>
                          {it.signedAt
                            ? `Signed ${fmtDate(new Date(it.signedAt).toISOString().slice(0, 10))}`
                            : it.createdAt
                              ? `Issued ${fmtDate(new Date(it.createdAt).toISOString().slice(0, 10))}`
                              : null}
                        </span>
                        {it.templateName && (
                          <span className="text-ink-400">· {it.templateName}{it.templateVersion ? ` v${it.templateVersion}` : ""}</span>
                        )}
                      </div>
                    </div>
                    {it.subcontractorId && (
                      <Link
                        to={`/primary/subcontractors/${it.subcontractorId}`}
                        className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-0.5 shrink-0"
                        title="View operative"
                      >
                        Open <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
