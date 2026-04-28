import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

// Reset-password page. Reads a single-use token from `?token=` (HashRouter
// keeps it after the `#`). Posts new password to the worker; on success the
// user is redirected to /login to sign in fresh. All existing sessions for
// that user are killed server-side as part of the reset flow.
export function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError("This reset link is missing its token. Request a new one.");
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => nav("/login"), 2000);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "INVALID_TOKEN" || e.code === "TOKEN_EXPIRED") {
          setError("This link is invalid or has expired. Request a new one.");
        } else if (e.code === "RATE_LIMITED") {
          setError("Too many attempts. Try again in a minute.");
        } else {
          setError(e.message || "Could not reset password.");
        }
      } else {
        setError("Unexpected error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8"><Logo /></div>
        {done ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <h1 className="text-xl font-bold">Password updated</h1>
            </div>
            <p className="text-ink-600 text-sm">
              Redirecting you to sign in…
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-ink-900">Choose a new password</h1>
            <p className="text-ink-500 mt-1.5 mb-8">
              At least 12 characters. Mix letters, numbers, and symbols.
            </p>
            <form onSubmit={submit} className="space-y-5">
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
              />
              <Input
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
                disabled={!token}
              >
                Update password
              </Button>
            </form>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mt-6"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
