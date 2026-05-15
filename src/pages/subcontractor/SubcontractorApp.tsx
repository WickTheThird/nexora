import { Route, Routes } from "react-router-dom";
import { PortalShell } from "@/components/layout/PortalShell";
import { BottomNav, type BottomTab } from "@/components/ui/BottomNav";
import {
  LayoutDashboard,
  User,
  FolderUp,
  ClipboardCheck,
  Wallet,
  LifeBuoy,
  Menu,
} from "lucide-react";
import { Home } from "./Home";
import { ProfileEdit } from "./ProfileEdit";
import { Documents } from "./Documents";
import { Questionnaire } from "./Questionnaire";
import { Payments } from "./Payments";
import { Support } from "./Support";

// The sub is a receiver: a centralised place for their documents,
// questionnaire, and payment advices. Contracts, timesheets and
// clock-in were removed - Revenue's RCT covers contractual relations
// and hours live on the principal's Job Card.

const nav = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/profile", label: "My Details", icon: User },
  { to: "/app/documents", label: "Documents", icon: FolderUp },
  { to: "/app/questionnaire", label: "Questionnaire", icon: ClipboardCheck },
  { to: "/app/payments", label: "Payments", icon: Wallet },
  { to: "/app/support", label: "Support", icon: LifeBuoy },
];

export function SubcontractorApp() {
  const bottomTabs: BottomTab[] = [
    { to: "/app", label: "Home", icon: LayoutDashboard, end: true },
    { to: "/app/payments", label: "Pay", icon: Wallet },
    { to: "/app/documents", label: "Docs", icon: FolderUp },
    { to: "/app/profile", label: "More", icon: Menu },
  ];

  return (
    <PortalShell title="Subcontractor portal" nav={nav}>
      <Routes>
        <Route index element={<Home />} />
        <Route path="profile" element={<ProfileEdit />} />
        <Route path="documents" element={<Documents />} />
        <Route path="questionnaire" element={<Questionnaire />} />
        <Route path="payments" element={<Payments />} />
        <Route path="support" element={<Support />} />
      </Routes>
      <BottomNav tabs={bottomTabs} />
    </PortalShell>
  );
}
