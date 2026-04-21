import { Route, Routes } from "react-router-dom";
import { PortalShell } from "@/components/layout/PortalShell";
import {
  LayoutDashboard,
  Users,
  FileText,
  MessagesSquare,
} from "lucide-react";
import { Dashboard } from "./Dashboard";
import { Subcontractors } from "./Subcontractors";
import { SubcontractorDetail } from "./SubcontractorDetail";
import { Templates } from "./Templates";
import { ChangeRequests } from "./ChangeRequests";

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/subcontractors", label: "Subcontractors", icon: Users },
  { to: "/admin/templates", label: "Contract Templates", icon: FileText },
  { to: "/admin/change-requests", label: "Change Requests", icon: MessagesSquare },
];

export function AdminApp() {
  return (
    <PortalShell title="Admin portal" nav={nav}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="subcontractors" element={<Subcontractors />} />
        <Route path="subcontractors/:id" element={<SubcontractorDetail />} />
        <Route path="templates" element={<Templates />} />
        <Route path="change-requests" element={<ChangeRequests />} />
      </Routes>
    </PortalShell>
  );
}
