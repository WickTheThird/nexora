import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import { KeyRound } from "lucide-react";

export function ChangePassword() {
  const { me, changePassword } = useAuth();
  const nav = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 12) {
      setError("New password must be at least 12 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await changePassword(current, next);
      // Route by role. Send primaries to /primary, admins to /admin,
      // everyone else (subs) to /app. The bare "/app" fallback used to
      // bounce primaries because the role guard on /app rejects them.
      const target =
        me?.role === "admin"   ? "/admin"   :
        me?.role === "primary" ? "/primary" :
        "/app";
      nav(target);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo />
          <div className="mt-6 h-10 w-10 rounded-full bg-accent-100 text-accent-700 grid place-items-center">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold text-ink-900 mt-4">
            Set your new password
          </h1>
          <p className="text-ink-500 mt-1.5 max-w-sm">
            For your security, you must update the temporary password you were
            issued before continuing.
          </p>
        </div>
        <form onSubmit={submit} className="card-padded space-y-5">
          <Input
            label="Current / temporary password"
            type="password"
            required
            autoFocus
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <Input
            label="New password"
            type="password"
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
            hint="At least 12 characters. Use something strong."
          />
          <Input
            label="Confirm new password"
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" loading={loading}>
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
