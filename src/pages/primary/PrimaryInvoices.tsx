import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { PrimaryInvoice } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { FileText, ArrowUpRight, Briefcase, MapPin, Layers } from "lucide-react";

// Principal Invoices list. Each processed Job Card now spawns up to
// two invoices: one "labour" (the wages BC owes the operatives) and one
// "service" (BC's own fee). They are grouped by parent Job Card here so
// the principal sees a clean "JOB-0012 on Site DUB48662N" header with
// both rows underneath, plus a per-group total.

function fmtMoney(minor: number) {
  return `\u20AC${(minor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Group = {
  key: string;
  jobRef: string | null;
  submissionId: string | null;
  siteLabel: string | null;
  invoices: PrimaryInvoice[];
  totalMinor: number;
};

function groupInvoices(items: PrimaryInvoice[]): Group[] {
  const map = new Map<string, Group>();
  for (const inv of items) {
    // Group by Job Card submission_id; manual invoices fall into their
    // own per-invoice bucket using the invoice id as the key.
    const key = inv.submissionId || `manual:${inv.id}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        jobRef: inv.jobRef,
        submissionId: inv.submissionId,
        siteLabel: inv.siteProjectSnapshot || inv.siteCodeSnapshot || null,
        invoices: [],
        totalMinor: 0,
      };
      map.set(key, g);
    }
    g.invoices.push(inv);
    g.totalMinor += inv.netMinor || 0;
  }
  // Sort each group: labour first, then service. Within kind, by issuedAt desc.
  for (const g of map.values()) {
    g.invoices.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "labour" ? -1 : 1;
      return (b.issuedAt || "").localeCompare(a.issuedAt || "");
    });
  }
  // Group order: most recently issued first.
  return Array.from(map.values()).sort((a, b) => {
    const aT = a.invoices[0]?.issuedAt || "";
    const bT = b.invoices[0]?.issuedAt || "";
    return bT.localeCompare(aT);
  });
}

export function PrimaryInvoices() {
  const [items, setItems] = useState<PrimaryInvoice[]>([]);
  const [loading, setLoading] = useState(true);

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

  const groups = useMemo(() => groupInvoices(items), [items]);

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Each Job Card processed by BC produces two invoices: a labour pass-through covering operative wages, and BC's own service fee. Grouped here per Job Card / site."
      />

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty
          icon={FileText}
          title="No invoices yet"
          description="When BC processes a Job Card you submitted, the labour and service invoices will appear here."
        />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            return (
              <div key={g.key} className="card overflow-hidden">
                {/* Group header */}
                <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-ink-100 bg-ink-50/40 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold inline-flex items-center gap-1.5">
                      {g.submissionId ? (
                        <>
                          <Briefcase className="h-3.5 w-3.5" /> Job Card
                          {g.jobRef && (
                            <Link
                              to={`/primary/submissions/${g.submissionId}`}
                              className="font-mono text-ink-700 hover:text-ink-900 ml-1"
                            >
                              {g.jobRef}
                            </Link>
                          )}
                        </>
                      ) : (
                        <>
                          <Layers className="h-3.5 w-3.5" /> Manual invoice
                        </>
                      )}
                    </div>
                    {g.siteLabel && (
                      <div className="text-sm text-ink-800 mt-1 inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-ink-400" /> {g.siteLabel}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold">Total to pay BC</div>
                    <div className="text-lg font-bold text-ink-900 tabular-nums">{fmtMoney(g.totalMinor)}</div>
                  </div>
                </div>

                {/* Per-invoice rows */}
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-ink-100">
                    <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                      <th className="px-5 py-2">Kind</th>
                      <th className="px-5 py-2">Invoice #</th>
                      <th className="px-5 py-2">Period</th>
                      <th className="px-5 py-2">Issued</th>
                      <th className="px-5 py-2">Status</th>
                      <th className="px-5 py-2 text-right">Net</th>
                      <th className="px-5 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.invoices.map((inv) => {
                      const tone: "neutral" | "info" | "success" | "warn" =
                        inv.status === "paid" ? "success" :
                        inv.status === "sent" ? "info" :
                        inv.status === "cancelled" ? "neutral" : "warn";
                      const kindTone = inv.kind === "service" ? "info" : "neutral";
                      const kindLabel = inv.kind === "service" ? "BC service fee" : "Labour";
                      return (
                        <tr key={inv.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                          <td className="px-5 py-3">
                            <Badge tone={kindTone}>{kindLabel}</Badge>
                          </td>
                          <td className="px-5 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                          <td className="px-5 py-3 text-ink-700">{inv.periodStart} → {inv.periodEnd}</td>
                          <td className="px-5 py-3 text-ink-600">{inv.issuedAt}</td>
                          <td className="px-5 py-3"><Badge tone={tone}>{inv.status}</Badge></td>
                          <td className="px-5 py-3 text-right tabular-nums font-bold">{fmtMoney(inv.netMinor)}</td>
                          <td className="px-5 py-3 text-right">
                            <Link to={`/primary/invoices/${inv.id}`} className="btn-ghost !py-1.5 inline-flex">
                              View <ArrowUpRight className="h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
