import { Route, Routes } from "react-router-dom";
import { PortalShell } from "@/components/layout/PortalShell";
import { BottomNav, type BottomTab } from "@/components/ui/BottomNav";
import { StickyClockButton } from "@/components/ui/StickyClockButton";
import {
  LayoutDashboard,
  User,
  FileText,
  FolderUp,
  ClipboardCheck,
  Wallet,
  LifeBuoy,
  Clock,
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

// The sub is a receiver: they don't browse jobs, accept Job Cards, or
// apply to anything. The marketplace flow (public_jobs / vendor_lists /
// sub Job Cards with per-line accept/decline) lived here briefly during
// the prototype phase and is now gone. The sub only sees what is
// already due to them: payment advices + their own onboarding state.

const nav = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/profile", label: "My Details", icon: User },
  { to: "/app/contracts", label: "Contracts", icon: FileText },
  { to: "/app/documents", label: "Documents", icon: FolderUp },
  { to: "/app/questionnaire", label: "Questionnaire", icon: ClipboardCheck },
  { to: "/app/timesheets", label: "Timesheets", icon: Clock },
  { to: "/app/payments", label: "Payments", icon: Wallet },
  { to: "/app/support", label: "Support", icon: LifeBuoy },
];

export function SubcontractorApp() {
  // Bottom-nav tabs. "Jobs" replaced with "Hours" focus + Payments since
  // there is nothing for the sub to do with jobs anymore.
  const bottomTabs: BottomTab[] = [
    { to: "/app", label: "Home", icon: LayoutDashboard, end: true },
    { to: "/app/timesheets", label: "Hours", icon: Clock },
    { to: "/app/payments", label: "Pay", icon: Wallet },
    { to: "/app/contracts", label: "Docs", icon: FileText },
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
        <Route path="support" element={<Support />} />
      </Routes>
      {/* Mobile-only: persistent clock FAB + bottom tab bar. */}
      <StickyClockButton />
      <BottomNav tabs={bottomTabs} />
    </PortalShell>
  );
}
