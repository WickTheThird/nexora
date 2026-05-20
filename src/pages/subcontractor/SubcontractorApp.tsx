import { Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

export function SubcontractorApp() {
  // Nav labels are i18n-aware. The group label "Payment Records" /
  // "Plăți" also flows through t() so the divider in the sidebar
  // matches the active locale.
  const { t } = useTranslation();
  const nav = [
    { to: "/app", label: t("nav.home"), icon: LayoutDashboard, end: true },
    { to: "/app/profile", label: t("nav.myAccount"), icon: User },
    { to: "/app/payments", label: t("nav.payAdvice"), icon: Wallet, groupBefore: t("nav.paymentRecords") },
    { to: "/app/statements", label: t("nav.monthlyCertificates"), icon: FileBarChart },
    { to: "/app/support", label: t("nav.support"), icon: LifeBuoy, groupBefore: t("nav.help") },
  ];
  const bottomTabs: BottomTab[] = [
    { to: "/app", label: t("nav.home"), icon: LayoutDashboard, end: true },
    { to: "/app/payments", label: t("nav.payAdvice"), icon: Wallet },
    { to: "/app/profile", label: t("nav.myAccount"), icon: User },
    { to: "/app/support", label: t("nav.support"), icon: Menu },
  ];

  return (
    <PortalShell title="Subcontractor portal" nav={nav} showLocaleSwitcher>
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
