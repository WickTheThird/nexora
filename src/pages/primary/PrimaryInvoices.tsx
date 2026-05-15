import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { PrimaryInvoice } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { FileText, ChevronDown, ChevronUp, MapPin, ArrowUpRight } from "lucide-react";

// Principal Invoices, simplified:
//   - One row per site (one Job Card = one site = one row).
//   - Row collapsed by default; click the chevron to reveal the two
//     invoices for that job (labour + service).
//
// No descriptor text up top, no "Manual invoice" terminology.
// Invoices that didn't come from a Job Card aren't shown here (they are
// admin-side artefacts and never reach the principal's invoice list in
// normal operation).

function fmtMoney(minor: number) {
  return `\u20AC${(minor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Job = {
  key: string;
  submissionId: string;
  siteLabel: string;
  siteProject: string | null;
  periodStart: string;
  periodEnd: string;
  invoices: PrimaryInvoice[];
  totalMinor: number;
  allPaid: boolean;
};

function groupBySite(items: PrimaryInvoice[]): Job[] {
  const map = new Map<string, Job>();
  for (const inv of items) {
    if (!inv.submissionId) continue; // hide non-Job-Card invoices
    const key = inv.submissionId;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        submissionId: inv.submissionId,
        siteLabel: inv.siteCodeSnapshot || "Site",
        siteProject: inv.siteProjectSnapshot,
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        invoices: [],
        totalMinor: 0,
        allPaid: true,
      };
      map.set(key, g);
    }
    g.invoices.push(inv);
    g.totalMinor += inv.netMinor || 0;
    if (inv.status !== "paid") g.allPaid = false;
  }
  // Order invoices within a job: labour first, then service.
  for (const g of map.values()) {
    g.invoices.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "labour" ? -1 : 1;
      return (a.issuedAt || "").localeCompare(b.issuedAt || "");
    });
  }
  // Order jobs: newest first (by latest issuedAt across both rows).
  return Array.from(map.values()).sort((a, b) => {
    const aT = a.invoices.reduce((m, i) => i.issuedAt > m ? i.issuedAt : m, "");
    const bT = b.invoices.reduce((m, i) => i.issuedAt > m ? i.issuedAt : m, "");
    return bT.localeCompare(aT);
  });
}

function kindLabel(k: PrimaryInvoice["kind"]) {
  return k === "service" ? "BC service fee" : "Labour";
}

export function PrimaryInvoices() {
  const [items, setItems] = useState<PrimaryInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const r = await api.listMyPrimaryInvoices();
        setItems(r.items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const jobs = useMemo(() => groupBySite(items), [items]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      <PageHeader title="Invoices" />

      {loading ? (
        <div className="skeleton h-64" />
      ) : jobs.length === 0 ? (
        <Empty
          icon={FileText}
          title="No invoices yet"
          description="When BC processes a Job Card you submitted, the invoices will appear here."
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((j) => {
            const open = expanded.has(j.key);
            return (
              <div key={j.key} className="card overflow-hidden">
                {/* Header - site as the headline. Click anywhere to expand. */}
                <button
                  type="button"
                  onClick={() => toggle(j.key)}
                  className="w-full flex items-start justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 hover:bg-ink-50/50 transition text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-base font-semibold text-ink-900">
                      <MapPin className="h-4 w-4 text-ink-500" />
                      {j.siteLabel}
                      {j.siteProject && (
                        <span className="text-ink-600 font-normal text-sm">- {j.siteProject}</span>
                      )}
                    </div>
                    <div className="text-xs text-ink-500 mt-1">
                      {j.periodStart} - {j.periodEnd} · {j.invoices.length} invoice{j.invoices.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-lg font-bold text-ink-900 tabular-nums">{fmtMoney(j.totalMinor)}</div>
                      <Badge tone={j.allPaid ? "success" : "warn"}>
                        {j.allPaid ? "Paid" : "To pay"}
                      </Badge>
                    </div>
                    {open ? <ChevronUp className="h-5 w-5 text-ink-400" /> : <ChevronDown className="h-5 w-5 text-ink-400" />}
                  </div>
                </button>

                {/* Body - the two invoices for this job. */}
                {open && (
                  <div className="border-t border-ink-100 divide-y divide-ink-100">
                    {j.invoices.map((inv) => {
                      const tone: "neutral" | "info" | "success" | "warn" =
                        inv.status === "paid" ? "success" :
                        inv.status === "sent" ? "info" :
                        inv.status === "cancelled" ? "neutral" : "warn";
                      return (
                        <div key={inv.id} className="px-4 py-3 sm:px-5 sm:py-3 flex items-center gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-ink-900">{kindLabel(inv.kind)}</div>
                            <div className="text-xs text-ink-500 font-mono mt-0.5">{inv.invoiceNumber}</div>
                          </div>
                          <Badge tone={tone}>{inv.status}</Badge>
                          <div className="text-base font-semibold text-ink-900 tabular-nums w-28 text-right">{fmtMoney(inv.netMinor)}</div>
                          <Link
                            to={`/primary/invoices/${inv.id}`}
                            className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-0.5"
                            title="Open invoice"
                          >
                            View <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
