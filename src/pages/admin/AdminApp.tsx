import { Route, Routes } from "react-router-dom";
import { PortalShell } from "@/components/layout/PortalShell";
import {
  LayoutDashboard,
  Users,
  Building2,
  Send,
  Inbox,
  FileText,
  MessagesSquare,
  Settings as SettingsIcon,
} from "lucide-react";
import { Dashboard } from "./Dashboard";
import { Subcontractors } from "./Subcontractors";
import { SubcontractorDetail } from "./SubcontractorDetail";
import { Primaries } from "./Primaries";
import { PrimaryDetail } from "./PrimaryDetail";
import { AdminPrimarySubmissions } from "./PrimarySubmissions";
import { AdminPrimarySubmissionDetail } from "./AdminPrimarySubmissionDetail";
import { BulkAdvice } from "./BulkAdvice";
import { Templates } from "./Templates";
import { ChangeRequests } from "./ChangeRequests";
import { Settings } from "./Settings";

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/primaries", label: "Primaries", icon: Building2 },
  { to: "/admin/subcontractors", label: "Subcontractors", icon: Users },
  { to: "/admin/primary-submissions", label: "Submissions", icon: Inbox },
  { to: "/admin/bulk-advice", label: "Bulk Advice", icon: Send },
  { to: "/admin/templates", label: "Contract Templates", icon: FileText },
  { to: "/admin/change-requests", label: "Change Requests", icon: MessagesSquare },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export function AdminApp() {
  return (
    <PortalShell title="Admin portal" nav={nav}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="primaries" element={<Primaries />} />
        <Route path="primaries/:id" element={<PrimaryDetail />} />
        <Route path="primary-submissions" element={<AdminPrimarySubmissions />} />
        <Route path="primary-submissions/:id" element={<AdminPrimarySubmissionDetail />} />
        <Route path="subcontractors" element={<Subcontractors />} />
        <Route path="subcontractors/:id" element={<SubcontractorDetail />} />
        <Route path="bulk-advice" element={<BulkAdvice />} />
        <Route path="templates" element={<Templates />} />
        <Route path="change-requests" element={<ChangeRequests />} />
        <Route path="settings" element={<Settings />} />
      </Routes>
    </PortalShell>
  );
}
