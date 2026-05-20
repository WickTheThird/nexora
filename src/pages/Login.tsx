import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { ArrowRight } from "lucide-react";

export function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Special case: account exists but not yet email-verified. We surface a
  // resend-verification CTA inline so the user can recover without
  // searching their inbox for the original email.
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUnverified(false);
    try {
      const me = await login(email, password);
      if (me.mustChangePassword) nav("/change-password");
      else if (me.role === "admin") nav("/admin");
      else if (me.role === "primary") nav("/primary");
      else nav("/app");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "EMAIL_NOT_VERIFIED") {
          setUnverified(true);
          setError(null);
        } else {
          setError(
            e.code === "RATE_LIMITED"
              ? "Too many attempts. Try again in a minute."
              : "Invalid email or password.",
          );
        }
      } else {
        setError("Unexpected error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    if (!email) return;
    setResending(true);
    try {
      const apiUrl = (window as { __SAMWISE_CONFIG__?: { apiUrl?: string } }).__SAMWISE_CONFIG__?.apiUrl
        || "https://nexora-api.bumbufilip22.workers.dev";
      await fetch(`${apiUrl}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setError("Verification email sent. Check your inbox.");
      setUnverified(false);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-full grid lg:grid-cols-2 relative">
      {/* Locale switcher pinned to the very top-right of the viewport so
          it appears on every public page in the same spot (Login,
          Signup, ForgotPassword). Above the form on mobile, above the
          right panel on desktop. */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
        <LocaleSwitcher size="sm" />
      </div>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between p-10 bg-ink-950 text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, #F59E0B 0, transparent 40%), radial-gradient(circle at 80% 60%, #fff 0, transparent 30%)"
        }} />
        <div className="relative">
          {/* Dark hero panel - light text on the wordmark. */}
          <Logo inverse />
        </div>
        <div className="relative space-y-6">
          <h2 className="text-4xl font-bold tracking-tight leading-tight">
            Subcontractor
            <br />onboarding, <span className="text-accent-400">streamlined.</span>
          </h2>
        </div>
        <div className="relative text-xs text-ink-500">
          © {new Date().getFullYear()} Samwise · bc
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Logo /></div>
          <h1 className="text-2xl font-bold text-ink-900">{t("auth.loginTitle")}</h1>
          <p className="text-ink-500 mt-1.5 mb-8">
            {t("auth.loginSubtitle")}
          </p>
          <form onSubmit={submit} className="space-y-5">
            <Input
              label={t("auth.email")}
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <Input
              label={t("auth.password")}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
            {unverified && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                <div className="font-medium mb-1">Verify your email first</div>
                <div className="text-xs">
                  We sent a verification link when you signed up. Click it, then come back here.
                </div>
                <button
                  type="button"
                  onClick={resendVerification}
                  disabled={resending}
                  className="mt-2 text-xs font-medium underline underline-offset-2 hover:no-underline disabled:opacity-50"
                >
                  {resending ? "Sending…" : "Resend verification email"}
                </button>
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              loading={loading}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              {t("auth.signIn")}
            </Button>
          </form>
          <p className="text-sm text-ink-600 mt-6 text-center">
            <Link to="/forgot-password" className="hover:text-ink-900 underline">
              {t("auth.forgotPassword")}
            </Link>
          </p>
          <p className="text-xs text-ink-400 mt-8 text-center">
            <a href="#/help" className="underline hover:text-ink-700">How it works</a>
            <span className="mx-2">·</span>
            <a href="#/legal/contract" className="underline hover:text-ink-700">Contract for Services</a>
            <span className="mx-2">·</span>
            <a href="#/legal/privacy" className="underline hover:text-ink-700">Privacy notice</a>
            <span className="mx-2">·</span>
            <a href="#/legal/terms" className="underline hover:text-ink-700">Terms of service</a>
          </p>
        </div>
      </div>
    </div>
  );
}
