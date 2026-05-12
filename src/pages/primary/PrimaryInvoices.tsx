import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { PrimaryInvoice } from "@/lib/types";
import { PageHeader } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { FileText, ArrowUpRight } from "lucide-react";

function fmtMoney(minor: number) {
  return `\u20AC${(minor / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  return (
    <>
      <PageHeader
        title="Invoices"
      />

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <Empty
          icon={FileText}
          title="No invoices yet"
          description="When BC issues an invoice consolidating subcontractor work under your contract, it'll appear here."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500 font-semibold">
                <th className="px-5 py-3">Invoice #</th>
                <th className="px-5 py-3">Period</th>
                <th className="px-5 py-3">Issued</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Net</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((inv) => {
                const tone: "neutral" | "info" | "success" | "warn" =
                  inv.status === "paid" ? "success" :
                  inv.status === "sent" ? "info" :
                  inv.status === "cancelled" ? "neutral" : "warn";
                return (
                  <tr key={inv.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
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
      )}
    </>
  );
}
