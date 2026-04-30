import { Route, Routes } from "react-router-dom";
import { PortalShell } from "@/components/layout/PortalShell";
import { LayoutDashboard, Users, FileText, Send } from "lucide-react";
import { PrimaryDashboard } from "./PrimaryDashboard";
import { PrimarySubcontractors } from "./PrimarySubcontractors";
import { PrimarySubDetail } from "./PrimarySubDetail";
import { PrimaryInvoices } from "./PrimaryInvoices";
import { PrimaryInvoiceDetail } from "./PrimaryInvoiceDetail";
import { PrimarySubmissions } from "./PrimarySubmissions";
import { PrimarySubmissionDetail } from "./PrimarySubmissionDetail";
import { PrimarySubmitPayment } from "./PrimarySubmitPayment";

// Portal for the upper-tier "Primary" (developer / main contractor).
// Scope: every endpoint is filtered server-side by their primary_id, so they
// only see their own subs, invoices, and submissions.
const nav = [
  { to: "/primary", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/primary/subcontractors", label: "Subcontractors", icon: Users },
  { to: "/primary/submissions", label: "Submissions", icon: Send },
  { to: "/primary/invoices", label: "Invoices", icon: FileText },
];

export function PrimaryApp() {
  return (
    <PortalShell title="Primary portal" nav={nav}>
      <Routes>
        <Route index element={<PrimaryDashboard />} />
        <Route path="subcontractors" element={<PrimarySubcontractors />} />
        <Route path="subcontractors/:id" element={<PrimarySubDetail />} />
        <Route path="submissions" element={<PrimarySubmissions />} />
        <Route path="submissions/new" element={<PrimarySubmitPayment />} />
        <Route path="submissions/:id" element={<PrimarySubmissionDetail />} />
        <Route path="invoices" element={<PrimaryInvoices />} />
        <Route path="invoices/:id" element={<PrimaryInvoiceDetail />} />
      </Routes>
    </PortalShell>
  );
}
