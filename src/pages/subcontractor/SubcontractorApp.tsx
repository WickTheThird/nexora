import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { PortalShell } from "@/components/layout/PortalShell";
import { BottomNav, type BottomTab } from "@/components/ui/BottomNav";
import { StickyClockButton } from "@/components/ui/StickyClockButton";
import { api } from "@/lib/api";
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
  Menu,
} from "lucide-react";
import { Home } from "./Home";
import { ProfileEdit } from "./ProfileEdit";
import { Contract } from "./Contract";
import { Contracts } from "./Contracts";
import { Documents } from "./Documents";
import { Questionnaire } from "./Questionnaire";
import { Payments } from "./Payments";
import { Support } from "./Support";
import { Timesheets } from "./Timesheets";
import { SubJobsBoard, SubJobDetail, SubMyApplications } from "./Jobs";
import { JobCards } from "./JobCards";

const nav = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/profile", label: "My Details", icon: User },
  { to: "/app/contracts", label: "Contracts", icon: FileText },
  { to: "/app/documents", label: "Documents", icon: FolderUp },
  { to: "/app/questionnaire", label: "Questionnaire", icon: ClipboardCheck },
  { to: "/app/timesheets", label: "Timesheets", icon: Clock },
  { to: "/app/payments", label: "Payments", icon: Wallet },
  { to: "/app/job-cards", label: "Job Cards", icon: Briefcase },
  { to: "/app/jobs", label: "Jobs marketplace", icon: Inbox },
  { to: "/app/applications", label: "My applications", icon: Inbox },
  { to: "/app/support", label: "Support", icon: LifeBuoy },
];

export function SubcontractorApp() {
  // Pending Job Card line-count drives a badge on the bottom-nav tab so
  // subs can see "I have something to respond to" without opening the page.
  const [pendingJobCards, setPendingJobCards] = useState(0);
  const refreshPending = async () => {
    try {
      const r = await api.listMyJobCards();
      let n = 0;
      for (const g of r.items) n += g.pendingItemCount;
      setPendingJobCards(n);
    } catch {
      /* non-fatal */
    }
  };
  useEffect(() => { refreshPending(); }, []);

  // Five bottom tabs - the most-used pages for an active sub. "More"
  // overflows to the existing hamburger menu in PortalShell.
  const bottomTabs: BottomTab[] = [
    { to: "/app", label: "Home", icon: LayoutDashboard, end: true },
    { to: "/app/job-cards", label: "Jobs", icon: Briefcase, badge: pendingJobCards },
    { to: "/app/timesheets", label: "Hours", icon: Clock },
    { to: "/app/payments", label: "Pay", icon: Wallet },
    { to: "/app/profile", label: "More", icon: Menu },
  ];

  return (
    <PortalShell title="Subcontractor portal" nav={nav}>
      <Routes>
        <Route index element={<Home />} />
        <Route path="profile" element={<ProfileEdit />} />
        {/* Legacy "single contract" route - kept so old deep-links keep
            working. The new list is /app/contracts and detail is
            /app/contracts/:id. */}
        <Route path="contract" element={<Contract />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="contracts/:id" element={<Contract />} />
        <Route path="documents" element={<Documents />} />
        <Route path="questionnaire" element={<Questionnaire />} />
        <Route path="timesheets" element={<Timesheets />} />
        <Route path="payments" element={<Payments />} />
        <Route path="job-cards" element={<JobCards />} />
        <Route path="jobs" element={<SubJobsBoard />} />
        <Route path="jobs/:id" element={<SubJobDetail />} />
        <Route path="applications" element={<SubMyApplications />} />
        <Route path="support" element={<Support />} />
      </Routes>
      {/* Mobile-only: persistent clock FAB + bottom tab bar. The
          existing hamburger top header in PortalShell still works for
          the routes that don't have a bottom tab. */}
      <StickyClockButton onChange={refreshPending} />
      <BottomNav tabs={bottomTabs} />
    </PortalShell>
  );
}
