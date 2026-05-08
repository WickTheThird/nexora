import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import { ArrowRight } from "lucide-react";

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const me = await login(email, password);
      if (me.mustChangePassword) nav("/change-password");
      else if (me.role === "admin") nav("/admin");
      else if (me.role === "primary") nav("/primary");
      else nav("/app");
    } catch (e) {
      if (e instanceof ApiError) {
        setError(
          e.code === "RATE_LIMITED"
            ? "Too many attempts. Try again in a minute."
            : "Invalid email or password.",
        );
      } else {
        setError("Unexpected error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full grid lg:grid-cols-2">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between p-10 bg-ink-950 text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, #F59E0B 0, transparent 40%), radial-gradient(circle at 80% 60%, #fff 0, transparent 30%)"
        }} />
        <div className="relative">
          {/* Dark hero panel — light text on the wordmark. */}
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
          <h1 className="text-2xl font-bold text-ink-900">Welcome back</h1>
          <p className="text-ink-500 mt-1.5 mb-8">
            Sign in to your Samwise portal.
          </p>
          <form onSubmit={submit} className="space-y-5">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <Input
              label="Password"
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
            <Button
              type="submit"
              className="w-full"
              loading={loading}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Sign in
            </Button>
          </form>
          <p className="text-sm text-ink-600 mt-6 text-center">
            <Link to="/forgot-password" className="hover:text-ink-900 underline">
              Forgot your password?
            </Link>
          </p>
          <div className="mt-8 pt-6 border-t border-ink-100 text-center">
            <p className="text-xs uppercase tracking-wider text-ink-400 font-semibold mb-2">New here?</p>
            <p className="text-sm text-ink-600">
              <Link to="/signup/subcontractor" className="text-ink-900 font-medium hover:underline">Sign up as a subcontractor</Link>
              <span className="mx-2 text-ink-400">·</span>
              <Link to="/signup/primary" className="text-ink-900 font-medium hover:underline">Sign up as a principal</Link>
            </p>
          </div>
          <p className="text-xs text-ink-400 mt-3 text-center">
            <a href="#/help" className="underline hover:text-ink-700">How it works</a>
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
