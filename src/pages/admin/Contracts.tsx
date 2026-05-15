// Admin global Contracts audit. Lists every contract on the platform
// joined with principal + sub + site. Filterable by status, principal,
// sub. Read-only - generation happens elsewhere (Sub Detail "Generate
// contract" and the auto-flow triggered by principal site assignments).

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { ContractRecord, Primary, Subcontractor } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PortalShell";
import { FilterBar } from "@/components/ui/FilterBar";
import { fmtDate } from "@/lib/format";
import { FileText, ChevronRight, CheckCircle2, PenLine, Eye, Building2, User as UserIcon, MapPin } from "lucide-react";
import { getHelp } from "@/lib/helpContent";

type Row = Awaited<ReturnType<typeof api.adminListContracts>>["items"][number];

function statusTone(s: ContractRecord["status"]) {
  if (s === "signed") return { tone: "success" as const, label: "Signed", icon: CheckCircle2 };
  if (s === "viewed") return { tone: "info" as const, label: "Awaiting signature", icon: PenLine };
  if (s === "generated") return { tone: "warn" as const, label: "Generated", icon: PenLine };
  if (s === "superseded") return { tone: "neutral" as const, label: "Replaced", icon: Eye };
  return { tone: "neutral" as const, label: s, icon: FileText };
}

export function AdminContracts() {
  const toast = useToast();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [primaries, setPrimaries] = useState<Primary[]>([]);
  const [subs, setSubs] = useState<Subcontractor[]>([]);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [primaryFilter, setPrimaryFilter] = useState<string>("");
  const [subFilter, setSubFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [contracts, prims, subList] = await Promise.all([
          api.adminListContracts(),
          api.adminListPrimaries().catch(() => ({ items: [] as Primary[] })),
          api.adminListSubcontractors({ limit: 500 }).catch(() => ({ items: [] as Subcontractor[] })),
        ]);
        setItems(contracts.items);
        setPrimaries(prims.items);
        setSubs(subList.items);
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
      if (primaryFilter && it.primaryId !== primaryFilter) return false;
      if (subFilter && it.subcontractorId !== subFilter) return false;
      if (q) {
        const hay = [
          it.subcontractorName, it.subcontractorEmail, it.subcontractorRef,
          it.primaryName, it.primaryEmail,
          it.siteCode, it.siteProject, it.siteAddress,
          it.templateName, it.signedName,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, statusFilter, primaryFilter, subFilter, search]);

  // Live subset of subs scoped to the picked principal (if any) so the
  // sub dropdown stays manageable for accounts with hundreds of operatives.
  const visibleSubs = useMemo(() => {
    if (!primaryFilter) return subs;
    return subs.filter((s) => s.primaryId === primaryFilter);
  }, [subs, primaryFilter]);

  return (
    <>
      <PageHeader
        title="Contracts"
        description="Every contract on the platform. Read-only audit. Generation lives on Sub Detail or auto-triggers when a principal assigns an operative to a site."
        help={getHelp("contracts")}
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
          description="Once principals start assigning operatives to sites (or you generate one manually from a Sub Detail page), they will appear here."
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
            searchPlaceholder="Search principal, sub, site, template..."
            onSearchChange={setSearch}
          />

          {/* Secondary filters: principal + sub dropdowns. Sub dropdown
              auto-scopes to the picked principal's operatives. */}
          <div className="card-padded mb-4 grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-ink-500 font-semibold">Principal</label>
              <select
                className="mt-2 w-full px-3 py-2 text-sm rounded-md border border-ink-200 focus:border-ink-900 outline-none bg-white"
                value={primaryFilter}
                onChange={(e) => {
                  setPrimaryFilter(e.target.value);
                  setSubFilter(""); // reset sub when principal changes
                }}
              >
                <option value="">All principals</option>
                {primaries.filter((p) => !p.archivedAt).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-ink-500 font-semibold">Subcontractor</label>
              <select
                className="mt-2 w-full px-3 py-2 text-sm rounded-md border border-ink-200 focus:border-ink-900 outline-none bg-white"
                value={subFilter}
                onChange={(e) => setSubFilter(e.target.value)}
              >
                <option value="">All subcontractors</option>
                {visibleSubs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName || s.email || s.subcontractorRef || s.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          </div>

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
                        <Badge tone={s.tone} icon={<Icon className="h-3 w-3" />}>{s.label}</Badge>
                        {it.templateName && (
                          <span className="text-xs text-ink-500">
                            {it.templateName}{it.templateVersion ? ` v${it.templateVersion}` : ""}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 grid sm:grid-cols-2 gap-x-4 gap-y-0.5">
                        <div className="text-sm text-ink-900 inline-flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-ink-400" />
                          {it.primaryName ? (
                            <Link to={`/admin/primaries/${it.primaryId}`} className="hover:underline">{it.primaryName}</Link>
                          ) : (
                            <span className="text-ink-400 italic">(legacy - no principal)</span>
                          )}
                        </div>
                        <div className="text-sm text-ink-900 inline-flex items-center gap-1.5">
                          <UserIcon className="h-3.5 w-3.5 text-ink-400" />
                          <Link to={`/admin/subcontractors/${it.subcontractorId}`} className="hover:underline">
                            {it.subcontractorName || it.subcontractorEmail || it.subcontractorId.slice(0, 8)}
                          </Link>
                          {it.subcontractorRef && (
                            <span className="font-mono text-[11px] text-ink-500">{it.subcontractorRef}</span>
                          )}
                        </div>
                        {(it.siteProject || it.siteCode || it.siteAddress) && (
                          <div className="text-sm text-ink-700 inline-flex items-center gap-1.5 sm:col-span-2">
                            <MapPin className="h-3.5 w-3.5 text-ink-400" />
                            {it.siteProject || it.siteCode}
                            {it.siteAddress ? ` - ${it.siteAddress}` : ""}
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-ink-500 mt-1">
                        {it.signedAt
                          ? `Signed ${fmtDate(new Date(it.signedAt).toISOString().slice(0, 10))}${it.signedName ? ` by ${it.signedName}` : ""}`
                          : it.createdAt
                            ? `Issued ${fmtDate(new Date(it.createdAt).toISOString().slice(0, 10))}`
                            : ""}
                      </div>
                    </div>
                    <Link
                      to={`/admin/subcontractors/${it.subcontractorId}`}
                      className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-0.5 shrink-0"
                      title="Open subcontractor"
                    >
                      Open <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
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
