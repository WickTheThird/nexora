import { Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/layout/PortalShell";
import { api } from "@/lib/api";
import type { PaletteItem } from "@/components/ui/CommandPalette";
import {
  LayoutDashboard,
  Users,
  Building2,
  Send,
  Inbox,
  FileText,
  MessagesSquare,
  Settings as SettingsIcon,
  Shield,
} from "lucide-react";
import { Dashboard } from "./Dashboard";
import { Subcontractors } from "./Subcontractors";
import { SubcontractorDetail } from "./SubcontractorDetail";
import { Primaries } from "./Primaries";
import { PrimaryDetail } from "./PrimaryDetail";
import { AdminPrimarySubmissions } from "./PrimarySubmissions";
import { AdminPrimarySubmissionDetail } from "./AdminPrimarySubmissionDetail";
import { AdminOperativeRequests } from "./OperativeRequests";
import { AdminSignupRequests } from "./SignupRequests";
import { BulkAdvice } from "./BulkAdvice";
import { Templates } from "./Templates";
import { ChangeRequests } from "./ChangeRequests";
import { Settings } from "./Settings";
import { AdminPublicJobsModeration } from "./PublicJobsModeration";

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/primaries", label: "Principals", icon: Building2 },
  { to: "/admin/subcontractors", label: "Subcontractors", icon: Users },
  { to: "/admin/primary-submissions", label: "Submissions", icon: Inbox },
  { to: "/admin/operative-requests", label: "Subcontractor Requests", icon: Inbox },
  { to: "/admin/signup-requests", label: "Recent Signups", icon: Inbox },
  { to: "/admin/bulk-advice", label: "Bulk Advice", icon: Send },
  { to: "/admin/templates", label: "Contract Templates", icon: FileText },
  { to: "/admin/change-requests", label: "Change Requests", icon: MessagesSquare },
  { to: "/admin/public-jobs", label: "Public Jobs", icon: Shield },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export function AdminApp() {
  // Build admin palette: every operative + every primary + a few high-
  // frequency action items. Single fetch on mount is plenty for the
  // current dataset size; refactor to live search if list >5k.
  const [items, setItems] = useState<PaletteItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [subs, prims] = await Promise.all([
          api.adminListSubcontractors({ limit: 500 }),
          api.adminListPrimaries(),
        ]);
        if (cancelled) return;
        const peopleItems: PaletteItem[] = [
          ...subs.items.map((s) => ({
            id: `sub-${s.id}`,
            label: s.fullName || s.email || s.subcontractorRef || "Unnamed",
            hint: [s.subcontractorRef, s.email, s.onboardingStatus].filter(Boolean).join(" · "),
            category: "people" as const,
            icon: Users,
            to: `/admin/subcontractors/${s.id}`,
            keywords: [s.subcontractorRef || "", (s.email || "").split("@")[0] || ""].filter(Boolean),
          })),
          ...prims.items.map((p) => ({
            id: `pri-${p.id}`,
            label: p.name,
            hint: [p.contactName, p.contactEmail, p.vat].filter(Boolean).join(" · "),
            category: "people" as const,
            icon: Building2,
            to: `/admin/primaries/${p.id}`,
            keywords: [p.vat || "", (p.contactEmail || "").split("@")[0] || ""].filter(Boolean),
          })),
        ];
        const actionItems: PaletteItem[] = [
          { id: "act-bulk-advice", label: "Bulk advice", hint: "Issue payment advices in batch", category: "actions", icon: Send, to: "/admin/bulk-advice" },
          { id: "act-op-requests", label: "Subcontractor requests inbox", hint: "Pending principals' new-subcontractor requests", category: "actions", icon: Inbox, to: "/admin/operative-requests" },
          { id: "act-submissions", label: "Submissions inbox", hint: "Pending Job Cards from principals", category: "actions", icon: Inbox, to: "/admin/primary-submissions" },
        ];
        setItems([...peopleItems, ...actionItems]);
      } catch { /* non-fatal - palette still has the page list */ }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <PortalShell title="Admin portal" nav={nav} paletteItems={items}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="primaries" element={<Primaries />} />
        <Route path="primaries/:id" element={<PrimaryDetail />} />
        <Route path="primary-submissions" element={<AdminPrimarySubmissions />} />
        <Route path="primary-submissions/:id" element={<AdminPrimarySubmissionDetail />} />
        <Route path="operative-requests" element={<AdminOperativeRequests />} />
        <Route path="signup-requests" element={<AdminSignupRequests />} />
        <Route path="subcontractors" element={<Subcontractors />} />
        <Route path="subcontractors/:id" element={<SubcontractorDetail />} />
        <Route path="bulk-advice" element={<BulkAdvice />} />
        <Route path="templates" element={<Templates />} />
        <Route path="change-requests" element={<ChangeRequests />} />
        <Route path="public-jobs" element={<AdminPublicJobsModeration />} />
        <Route path="settings" element={<Settings />} />
      </Routes>
    </PortalShell>
  );
}
