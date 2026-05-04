import { Route, Routes } from "react-router-dom";
import { PortalShell } from "@/components/layout/PortalShell";
import { LayoutDashboard, Users, FileText, Send, MapPin, MapPinned, User } from "lucide-react";
import { PrimaryDashboard } from "./PrimaryDashboard";
import { PrimarySubcontractors } from "./PrimarySubcontractors";
import { PrimarySubDetail } from "./PrimarySubDetail";
import { PrimaryInvoices } from "./PrimaryInvoices";
import { PrimaryInvoiceDetail } from "./PrimaryInvoiceDetail";
import { PrimarySubmissions } from "./PrimarySubmissions";
import { PrimarySubmissionDetail } from "./PrimarySubmissionDetail";
import { PrimarySubmitPayment } from "./PrimarySubmitPayment";
import { PrincipalSites } from "./PrincipalSites";
import { PrincipalSiteDetail } from "./PrincipalSiteDetail";
import { PrincipalSiteIds } from "./PrincipalSiteIds";
import { PrincipalAccount } from "./PrincipalAccount";

// Portal for the upper-tier Principal (developer / main contractor).
// Scope: every endpoint is filtered server-side by their primary_id, so they
// only see their own subs, invoices, submissions, and site activity.
// Routes still mounted at /primary/* (matches the App router mount); the
// portal title and nav labels read "Principal" to match the user-facing
// rename done earlier.
const nav = [
  { to: "/primary", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/primary/account", label: "Account", icon: User },
  { to: "/primary/subcontractors", label: "Subcontractors", icon: Users },
  { to: "/primary/site-ids", label: "Site IDs", icon: MapPinned },
  { to: "/primary/sites", label: "Site activity", icon: MapPin },
  { to: "/primary/submissions", label: "Submissions", icon: Send },
  { to: "/primary/invoices", label: "Invoices", icon: FileText },
];

export function PrimaryApp() {
  return (
    <PortalShell title="Principal portal" nav={nav}>
      <Routes>
        <Route index element={<PrimaryDashboard />} />
        <Route path="account" element={<PrincipalAccount />} />
        <Route path="subcontractors" element={<PrimarySubcontractors />} />
        <Route path="subcontractors/:id" element={<PrimarySubDetail />} />
        <Route path="site-ids" element={<PrincipalSiteIds />} />
        <Route path="sites" element={<PrincipalSites />} />
        <Route path="sites/:ref" element={<PrincipalSiteDetail />} />
        <Route path="submissions" element={<PrimarySubmissions />} />
        <Route path="submissions/new" element={<PrimarySubmitPayment />} />
        <Route path="submissions/:id/edit" element={<PrimarySubmitPayment />} />
        <Route path="submissions/:id" element={<PrimarySubmissionDetail />} />
        <Route path="invoices" element={<PrimaryInvoices />} />
        <Route path="invoices/:id" element={<PrimaryInvoiceDetail />} />
      </Routes>
    </PortalShell>
  );
}
