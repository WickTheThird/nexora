import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { ToastProvider } from "./components/ui/Toast";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Help } from "./pages/Help";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { ChangePassword } from "./pages/ChangePassword";
import { ConsentGate } from "./pages/ConsentGate";
import { PrivacyPolicy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";
import { SubcontractorApp } from "./pages/subcontractor/SubcontractorApp";
import { AdminApp } from "./pages/admin/AdminApp";
import { PrimaryApp } from "./pages/primary/PrimaryApp";
import { Logo } from "./components/ui/Logo";

function BootSplash() {
  return (
    <div className="min-h-full grid place-items-center">
      <div className="flex flex-col items-center gap-4">
        <Logo />
        <div className="skeleton h-1 w-32" />
      </div>
    </div>
  );
}

function Gate() {
  const { me, loading } = useAuth();
  if (loading) return <BootSplash />;
  if (!me) return <Navigate to="/login" replace />;
  if (me.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (!me.privacyAccepted) return <Navigate to="/consent" replace />;
  if (me.role === "admin") return <Navigate to="/admin" replace />;
  if (me.role === "primary") return <Navigate to="/primary" replace />;
  return <Navigate to="/app" replace />;
}

function RequireAuth({
  children,
  role,
}: {
  children: JSX.Element;
  role?: "admin" | "subcontractor" | "primary";
}) {
  const { me, loading } = useAuth();
  if (loading) return <BootSplash />;
  if (!me) return <Navigate to="/login" replace />;
  if (me.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (!me.privacyAccepted) return <Navigate to="/consent" replace />;
  if (role && me.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Gate />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/signup/:kind" element={<Signup />} />
        <Route path="/help" element={<Help />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/legal/privacy" element={<PrivacyPolicy />} />
        <Route path="/legal/terms" element={<Terms />} />
        <Route
          path="/change-password"
          element={
            <RequireAuth>
              <ChangePassword />
            </RequireAuth>
          }
        />
        <Route path="/consent" element={<ConsentGate />} />
        <Route
          path="/app/*"
          element={
            <RequireAuth role="subcontractor">
              <SubcontractorApp />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/*"
          element={
            <RequireAuth role="admin">
              <AdminApp />
            </RequireAuth>
          }
        />
        <Route
          path="/primary/*"
          element={
            <RequireAuth role="primary">
              <PrimaryApp />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Gate />} />
      </Routes>
    </ToastProvider>
  );
}
