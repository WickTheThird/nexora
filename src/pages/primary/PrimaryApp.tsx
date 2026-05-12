import { Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/layout/PortalShell";
import { LayoutDashboard, Users, FileText, Send, MapPin, MapPinned, User, Plus, ClipboardList, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import type { PaletteItem } from "@/components/ui/CommandPalette";
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
import { PrimaryJobsPosted, PrimaryPublicJobDetail } from "./PrimaryPublicJobs";
import { PrimaryVendorList } from "./PrimaryVendorList";

const nav = [
  { to: "/primary", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/primary/account", label: "Account", icon: User },
  { to: "/primary/subcontractors", label: "Subcontractors", icon: Users },
  { to: "/primary/vendor-list",    label: "Vendor list",    icon: ShieldCheck },
  { to: "/primary/site-ids", label: "Site IDs", icon: MapPinned },
  { to: "/primary/sites", label: "Site activity", icon: MapPin },
  { to: "/primary/submissions", label: "Jobs Posted", icon: Send },
  { to: "/primary/invoices", label: "Invoices", icon: FileText },
];

export function PrimaryApp() {
  // Build palette items: every linked operative + every site + a few
  // shortcut actions. Lazy-load on mount so Cmd+K resolves people by name
  // instantly without a per-keystroke fetch.
  const [items, setItems] = useState<PaletteItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ops, sites] = await Promise.all([
          api.listMyPrimarySubs(),
          api.listMyPrincipalSiteIds(),
        ]);
        if (cancelled) return;
        const peopleItems: PaletteItem[] = ops.items.map((o) => ({
          id: `op-${o.id}`,
          label: o.fullName || o.subcontractorRef || "Unnamed operative",
          hint: [o.subcontractorRef, o.email, o.natureOfServices].filter(Boolean).join(" · ") || undefined,
          category: "people",
          icon: Users,
          to: `/primary/subcontractors/${o.id}`,
          keywords: [
            o.subcontractorRef || "",
            (o.email || "").split("@")[0] || "",
            o.mob || "",
          ].filter(Boolean),
        }));
        const siteItems: PaletteItem[] = sites.items.map((s) => ({
          id: `site-${s.id}`,
          label: s.siteId,
          hint: s.projectName || s.address || undefined,
          category: "people",
          icon: MapPinned,
          to: `/primary/site-ids`,
          keywords: [s.projectName || "", s.address || ""].filter(Boolean),
        }));
        const actionItems: PaletteItem[] = [
          { id: "act-new-jc", label: "New Job Card", hint: "Submit hours for this period", category: "actions", icon: Plus, to: "/primary/submissions/new" },
          { id: "act-job-cards", label: "Jobs Posted", hint: "All Job Cards, draft + locked", category: "actions", icon: ClipboardList, to: "/primary/submissions" },
        ];
        setItems([...peopleItems, ...siteItems, ...actionItems]);
      } catch { /* non-fatal - palette still has the page list */ }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <PortalShell title="Principal portal" nav={nav} paletteItems={items}>
      <Routes>
        <Route index element={<PrimaryDashboard />} />
        <Route path="account" element={<PrincipalAccount />} />
        <Route path="subcontractors" element={<PrimarySubcontractors />} />
        <Route path="subcontractors/:id" element={<PrimarySubDetail />} />
        <Route path="vendor-list" element={<PrimaryVendorList />} />
        <Route path="site-ids" element={<PrincipalSiteIds />} />
        <Route path="sites" element={<PrincipalSites />} />
        <Route path="sites/:ref" element={<PrincipalSiteDetail />} />
        {/* Jobs Posted = Job Cards (legacy) + Public Jobs marketplace
            on one tabbed page. /primary/submissions is the legacy
            entry-point and stays as a direct deep link for now; the
            new Jobs Posted page is at /primary/jobs. */}
        <Route path="submissions" element={<PrimaryJobsPosted />} />
        <Route path="submissions/new" element={<PrimarySubmitPayment />} />
        <Route path="submissions/:id/edit" element={<PrimarySubmitPayment />} />
        <Route path="submissions/:id" element={<PrimarySubmissionDetail />} />
        <Route path="public-jobs/:id" element={<PrimaryPublicJobDetail />} />
        <Route path="invoices" element={<PrimaryInvoices />} />
        <Route path="invoices/:id" element={<PrimaryInvoiceDetail />} />
      </Routes>
    </PortalShell>
  );
}
