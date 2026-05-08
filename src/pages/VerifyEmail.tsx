// Email verification handler. The signup flow emails a magic link
// pointing here with ?token=... in the URL. We POST it to the worker
// and show a friendly result.
//
// Three states:
//   - verifying  — initial spinner while we hit /auth/verify-email
//   - verified   — success; CTA to sign in
//   - error      — invalid / expired token; CTA to resend

import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";
import { CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";

const API_URL = (window as { __SAMWISE_CONFIG__?: { apiUrl?: string } }).__SAMWISE_CONFIG__?.apiUrl
  || "https://nexora-api.bumbufilip22.workers.dev";

export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"verifying" | "verified" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [verifiedEmail, setVerifiedEmail] = useState<string>("");
  const [resendEmail, setResendEmail] = useState<string>("");
  const [resending, setResending] = useState(false);

  // React 18 Strict Mode runs effects twice in dev. The verify POST is
  // not idempotent on the admin-notification side (each call to
  // /auth/verify-email re-fires the "signup_verified" admin notification
  // if `email_verified_at` was still NULL at the time of the read,
  // which races between the two concurrent calls). Guard with a ref so
  // we only fire once per mount.
  const verifyFiredRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMsg("Verification link is missing the token. Check the link from your email.");
      return;
    }
    if (verifyFiredRef.current) return;
    verifyFiredRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.ok) {
          setState("verified");
          setVerifiedEmail(data.data?.email || "");
        } else {
          setState("error");
          setErrorMsg(data?.error?.message || "We couldn't verify this link.");
        }
      } catch {
        if (cancelled) return;
        setState("error");
        setErrorMsg("Couldn't reach the server. Try again in a minute.");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const resend = async () => {
    if (!resendEmail) return;
    setResending(true);
    try {
      await fetch(`${API_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      // Don't disclose existence; show generic confirmation.
      alert("If an account exists for that email, we've sent a fresh link.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-12 bg-ink-50">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 inline-block"><Logo /></div>

        {state === "verifying" && (
          <>
            <Loader2 className="h-10 w-10 mx-auto text-ink-500 animate-spin mb-4" />
            <h1 className="text-2xl font-bold text-ink-900 mb-2">Verifying…</h1>
            <p className="text-ink-600">Hold on a sec.</p>
          </>
        )}

        {state === "verified" && (
          <>
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600 mb-4" />
            <h1 className="text-2xl font-bold text-ink-900 mb-2">Email verified</h1>
            <p className="text-ink-600 mb-6">
              {verifiedEmail
                ? <>Your account <strong className="text-ink-900">{verifiedEmail}</strong> is ready. Sign in to get started.</>
                : "Your account is ready. Sign in to get started."}
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-ink-900 text-white font-medium hover:bg-ink-800"
            >
              Sign in <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <AlertTriangle className="h-12 w-12 mx-auto text-amber-600 mb-4" />
            <h1 className="text-2xl font-bold text-ink-900 mb-2">Verification failed</h1>
            <p className="text-ink-600 mb-6">{errorMsg}</p>
            <div className="card-padded text-left">
              <label className="text-xs uppercase tracking-wider text-ink-500 font-semibold">Send a new verification link</label>
              <div className="flex gap-2 mt-2">
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 px-3 py-2 text-sm rounded-md border border-ink-200 focus:border-ink-900 outline-none"
                />
                <button
                  type="button"
                  onClick={resend}
                  disabled={resending || !resendEmail}
                  className="px-4 py-2 rounded-md bg-ink-900 text-white text-sm font-medium hover:bg-ink-800 disabled:opacity-50"
                >
                  {resending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
            <p className="mt-6 text-sm">
              <Link to="/login" className="text-ink-700 hover:text-ink-900 underline-offset-2 hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
