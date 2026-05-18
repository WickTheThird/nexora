import { Route, Routes } from "react-router-dom";
import { PortalShell } from "@/components/layout/PortalShell";
import { BottomNav, type BottomTab } from "@/components/ui/BottomNav";
import {
  LayoutDashboard,
  User,
  Wallet,
  LifeBuoy,
  Menu,
  FileBarChart,
} from "lucide-react";
import { Home } from "./Home";
import { ProfileEdit } from "./ProfileEdit";
import { Documents } from "./Documents";
import { Questionnaire } from "./Questionnaire";
import { Payments } from "./Payments";
import { Statements } from "./Statements";
import { Support } from "./Support";
import { SubPortalFooter } from "./SubPortalFooter";

// Sub portal nav mirrors Enagh's layout: Home / My Account /
// Payment Records (dropdown) / Logout. Documents + Questionnaire
// don't appear in the top nav anymore - they're reached via the
// step cards on Home. Routes stay so deep links still work.

const nav = [
  { to: "/app", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/app/profile", label: "My Account", icon: User },
  { to: "/app/payments", label: "Pay Advice", icon: Wallet, groupBefore: "Payment Records" },
  { to: "/app/statements", label: "Monthly Certificates", icon: FileBarChart },
  { to: "/app/support", label: "Support", icon: LifeBuoy, groupBefore: "Help" },
];

export function SubcontractorApp() {
  const bottomTabs: BottomTab[] = [
    { to: "/app", label: "Home", icon: LayoutDashboard, end: true },
    { to: "/app/payments", label: "Pay", icon: Wallet },
    { to: "/app/profile", label: "Account", icon: User },
    { to: "/app/support", label: "More", icon: Menu },
  ];

  return (
    <PortalShell title="Subcontractor portal" nav={nav}>
      <Routes>
        <Route index element={<Home />} />
        <Route path="profile" element={<ProfileEdit />} />
        <Route path="documents" element={<Documents />} />
        <Route path="questionnaire" element={<Questionnaire />} />
        <Route path="payments" element={<Payments />} />
        <Route path="statements" element={<Statements />} />
        <Route path="support" element={<Support />} />
      </Routes>
      <SubPortalFooter />
      <BottomNav tabs={bottomTabs} />
    </PortalShell>
  );
}
