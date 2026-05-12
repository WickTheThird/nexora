import { Route, Routes } from "react-router-dom";
import { PortalShell } from "@/components/layout/PortalShell";
import {
  LayoutDashboard,
  User,
  FileText,
  FolderUp,
  ClipboardCheck,
  Wallet,
  LifeBuoy,
  Clock,
  Briefcase,
  Inbox,
} from "lucide-react";
import { Home } from "./Home";
import { ProfileEdit } from "./ProfileEdit";
import { Contract } from "./Contract";
import { Documents } from "./Documents";
import { Questionnaire } from "./Questionnaire";
import { Payments } from "./Payments";
import { Support } from "./Support";
import { Timesheets } from "./Timesheets";
import { SubJobsBoard, SubJobDetail, SubMyApplications } from "./Jobs";

const nav = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/profile", label: "My Details", icon: User },
  { to: "/app/contract", label: "Contract", icon: FileText },
  { to: "/app/documents", label: "Documents", icon: FolderUp },
  { to: "/app/questionnaire", label: "Questionnaire", icon: ClipboardCheck },
  { to: "/app/timesheets", label: "Timesheets", icon: Clock },
  { to: "/app/payments", label: "Payments", icon: Wallet },
  { to: "/app/jobs", label: "Jobs", icon: Briefcase },
  { to: "/app/applications", label: "My applications", icon: Inbox },
  { to: "/app/support", label: "Support", icon: LifeBuoy },
];

export function SubcontractorApp() {
  return (
    <PortalShell title="Subcontractor portal" nav={nav}>
      <Routes>
        <Route index element={<Home />} />
        <Route path="profile" element={<ProfileEdit />} />
        <Route path="contract" element={<Contract />} />
        <Route path="documents" element={<Documents />} />
        <Route path="questionnaire" element={<Questionnaire />} />
        <Route path="timesheets" element={<Timesheets />} />
        <Route path="payments" element={<Payments />} />
        <Route path="jobs" element={<SubJobsBoard />} />
        <Route path="jobs/:id" element={<SubJobDetail />} />
        <Route path="applications" element={<SubMyApplications />} />
        <Route path="support" element={<Support />} />
      </Routes>
    </PortalShell>
  );
}
