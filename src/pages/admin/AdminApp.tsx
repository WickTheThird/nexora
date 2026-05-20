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
  MessagesSquare,
  Settings as SettingsIcon,
  Briefcase,
  Activity,
  Zap,
  Mail,
} from "lucide-react";
import { Dashboard } from "./Dashboard";
import { Subcontractors } from "./Subcontractors";
import { SubcontractorDetail } from "./SubcontractorDetail";
import { Primaries } from "./Primaries";
import { PrimaryDetail } from "./PrimaryDetail";
import { AdminPrimarySubmissions } from "./PrimarySubmissions";
import { AdminPrimarySubmissionDetail } from "./AdminPrimarySubmissionDetail";
import { AdminSignupRequests } from "./SignupRequests";
import { AdminInvitations } from "./Invitations";
import { BulkAdvice } from "./BulkAdvice";
import { ChangeRequests } from "./ChangeRequests";
import { Settings } from "./Settings";
import { AdminJobs } from "./Jobs";
import { AdminActions } from "./Actions";

// Sidebar restructured into three logical groups (Dashboard | Core records |
// Workflow inboxes | Settings). The group labels are encoded as `groupBefore`
// strings; PortalShell renders them as muted dividers above each item that
// starts a new group. Items the user asked to remove or rename are gone.
const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  // Core records
  { to: "/admin/primaries", label: "Principals", icon: Building2, groupBefore: "Records" },
  { to: "/admin/subcontractors", label: "Subcontractors", icon: Users },
  { to: "/admin/jobs", label: "Jobs", icon: Briefcase },
  // Workflow inboxes
  { to: "/admin/primary-submissions", label: "Submissions", icon: Inbox, groupBefore: "Inboxes" },
  { to: "/admin/change-requests", label: "Change Requests", icon: MessagesSquare },
  { to: "/admin/invitations", label: "Invitations", icon: Mail },
  { to: "/admin/signup-requests", label: "Recent Activity", icon: Activity },
  // Actions
  { to: "/admin/actions", label: "Actions", icon: Zap, groupBefore: "Actions" },
  { to: "/admin/bulk-advice", label: "Advice", icon: Send },
  // Misc
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon, groupBefore: "Setup" },
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
          { id: "act-advice", label: "Advice", hint: "Issue payment advices (single + bulk)", category: "actions", icon: Send, to: "/admin/bulk-advice" },
          { id: "act-submissions", label: "Submissions inbox", hint: "Pending Job Cards from principals", category: "actions", icon: Inbox, to: "/admin/primary-submissions" },
          { id: "act-jobs", label: "All Jobs", hint: "Cross-platform view of every Job Card + tender post", category: "actions", icon: Briefcase, to: "/admin/jobs" },
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
        <Route path="signup-requests" element={<AdminSignupRequests />} />
        <Route path="invitations" element={<AdminInvitations />} />
        <Route path="subcontractors" element={<Subcontractors />} />
        <Route path="subcontractors/:id" element={<SubcontractorDetail />} />
        <Route path="jobs" element={<AdminJobs />} />
        <Route path="actions" element={<AdminActions />} />
        <Route path="bulk-advice" element={<BulkAdvice />} />
        <Route path="change-requests" element={<ChangeRequests />} />
        <Route path="settings" element={<Settings />} />
      </Routes>
    </PortalShell>
  );
}
