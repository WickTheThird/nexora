import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

// Forgot-password page. Always shows the same "if the email exists" message
// regardless of whether the address is on file — prevents account enumeration.
export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.requestPasswordReset(email);
      setSubmitted(true);
    } catch {
      // Even on failure we show the success state — don't leak whether the
      // address exists. Only show error for clear network failures.
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8"><Logo /></div>
        {submitted ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <h1 className="text-xl font-bold">Check your inbox</h1>
            </div>
            <p className="text-ink-600 text-sm">
              If an account exists for <span className="font-medium">{email}</span>,
              we&apos;ve sent a password reset link. The link expires in 1 hour.
            </p>
            <p className="text-ink-500 text-xs">
              Didn&apos;t get it? Check spam, or contact your administrator.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-sm text-ink-700 hover:text-ink-900 mt-4"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-ink-900">Reset your password</h1>
            <p className="text-ink-500 mt-1.5 mb-8">
              Enter your email and we&apos;ll send you a reset link.
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
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" loading={loading}>
                Send reset link
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
