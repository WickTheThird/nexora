import { Route, Routes } from "react-router-dom";
import { PortalShell } from "@/components/layout/PortalShell";
import { LayoutDashboard, Users, FileText } from "lucide-react";
import { PrimaryDashboard } from "./PrimaryDashboard";
import { PrimarySubcontractors } from "./PrimarySubcontractors";
import { PrimarySubDetail } from "./PrimarySubDetail";
import { PrimaryInvoices } from "./PrimaryInvoices";
import { PrimaryInvoiceDetail } from "./PrimaryInvoiceDetail";

// Read-only portal for the upper-tier "Primary" (developer / main contractor).
// Scope: every endpoint they hit is filtered server-side by their primary_id,
// so they only ever see their own subs and the invoices BC has issued to them.
const nav = [
  { to: "/primary", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/primary/subcontractors", label: "Subcontractors", icon: Users },
  { to: "/primary/invoices", label: "Invoices", icon: FileText },
];

export function PrimaryApp() {
  return (
    <PortalShell title="Primary portal" nav={nav}>
      <Routes>
        <Route index element={<PrimaryDashboard />} />
        <Route path="subcontractors" element={<PrimarySubcontractors />} />
        <Route path="subcontractors/:id" element={<PrimarySubDetail />} />
        <Route path="invoices" element={<PrimaryInvoices />} />
        <Route path="invoices/:id" element={<PrimaryInvoiceDetail />} />
      </Routes>
    </PortalShell>
  );
}
