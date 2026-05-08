// Public self-serve signup page. Two modes via URL: /signup/primary or
// /signup/subcontractor. We don't create the account directly; we POST
// /public/signup which writes a row to signup_requests for admin review.
//
// Why the approval gate?
//   - The portal is a closed B2B system; we vet who joins.
//   - Subs need to be linked to a principal before they can be useful.
//   - Primaries need their company validated against Revenue records.
// Admin approves → real account created → welcome email + temp password.

import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ArrowRight, CheckCircle2, Hammer, Building2 } from "lucide-react";

const API_URL = (window as { __SAMWISE_CONFIG__?: { apiUrl?: string } }).__SAMWISE_CONFIG__?.apiUrl
  || "https://nexora-api.bumbufilip22.workers.dev";

export function Signup() {
  const { kind: rawKind } = useParams<{ kind: string }>();
  const kind: "primary" | "subcontractor" = rawKind === "primary" ? "primary" : "subcontractor";
  const nav = useNavigate();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  // Sub-only
  const [trade, setTrade] = useState("");
  // Primary-only
  const [companyName, setCompanyName] = useState("");
  const [companyVat, setCompanyVat] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  // Free-text
  const [notes, setNotes] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/public/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind, fullName, email, mobile,
          trade: kind === "subcontractor" ? trade : undefined,
          companyName: kind === "primary" ? companyName : undefined,
          companyVat: kind === "primary" ? companyVat : undefined,
          companyAddress: kind === "primary" ? companyAddress : undefined,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data?.error?.message || "Signup failed");
        return;
      }
      setDone(true);
    } catch {
      toast.error("Couldn't reach the server. Try again?");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center px-4 py-12 bg-ink-50">
        <div className="max-w-md w-full text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600 mb-4" />
          <h1 className="text-2xl font-bold text-ink-900 mb-2">Request received</h1>
          <p className="text-ink-600 mb-6">
            Thanks {fullName.split(" ")[0]}. We&rsquo;ll review your request and email you when your account is ready.
          </p>
          <Link to="/login" className="text-ink-700 hover:text-ink-900 inline-flex items-center gap-1 underline-offset-2 hover:underline">
            Back to sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const isPrimary = kind === "primary";
  const Icon = isPrimary ? Building2 : Hammer;

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink-50">
      <aside className="hidden lg:flex flex-col justify-between p-10 bg-ink-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #F59E0B 0, transparent 40%), radial-gradient(circle at 80% 60%, #fff 0, transparent 30%)" }} />
        <div className="relative"><Logo inverse /></div>
        <div className="relative space-y-6">
          <Icon className="h-10 w-10 text-accent-400" />
          <h2 className="text-3xl font-bold tracking-tight leading-tight">
            {isPrimary
              ? <>Apply for a <span className="text-accent-400">Principal</span> account.</>
              : <>Apply for a <span className="text-accent-400">Subcontractor</span> account.</>}
          </h2>
          <p className="text-ink-300 text-sm leading-relaxed">
            {isPrimary
              ? "We work with developers and main contractors across Ireland. Submit your details and our team will review and approve your account."
              : "Submit your details and we'll review your request — once approved you'll get an email with sign-in details."}
          </p>
        </div>
        <div className="relative text-xs text-ink-500">© {new Date().getFullYear()} Samwise · BC</div>
      </aside>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <form onSubmit={submit} className="w-full max-w-md space-y-5">
          <div className="lg:hidden mb-6"><Logo /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-900">
              {isPrimary ? "Principal sign-up" : "Subcontractor sign-up"}
            </h1>
            <p className="text-sm text-ink-500 mt-1">
              Already have an account?{" "}
              <Link to="/login" className="text-ink-900 font-medium underline-offset-2 hover:underline">Sign in</Link>.
              Or{" "}
              <button type="button" onClick={() => nav(`/signup/${isPrimary ? "subcontractor" : "primary"}`)} className="text-ink-900 font-medium underline-offset-2 hover:underline">
                switch to {isPrimary ? "subcontractor" : "principal"} signup
              </button>.
            </p>
          </div>

          <Input
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoFocus
            placeholder="e.g. Aoife Kelly"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.ie"
            autoComplete="email"
          />
          <Input
            label="Mobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="+353 87 ..."
            autoComplete="tel"
          />

          {isPrimary ? (
            <>
              <Input
                label="Company name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                placeholder="e.g. Glenveagh Properties Ltd"
              />
              <Input
                label="Company VAT number"
                value={companyVat}
                onChange={(e) => setCompanyVat(e.target.value)}
                required
                placeholder="IE9655432T"
              />
              <Textarea
                label="Company address"
                rows={2}
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                required
                placeholder="Street, town, county, postcode"
              />
            </>
          ) : (
            <Input
              label="Trade / nature of services"
              value={trade}
              onChange={(e) => setTrade(e.target.value)}
              placeholder="e.g. Carpentry, plumbing, painting"
            />
          )}
          <Textarea
            label="Notes (optional)"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isPrimary ? "Anything we should know about your projects?" : "Anything else useful — references, certifications, who referred you…"}
          />

          <Button type="submit" variant="accent" loading={submitting} className="w-full" rightIcon={<ArrowRight className="h-4 w-4" />}>
            {submitting ? "Submitting…" : "Submit request"}
          </Button>
          <p className="text-[11px] text-ink-400 text-center">
            By submitting you agree to our{" "}
            <Link to="/legal/privacy" className="underline">Privacy Notice</Link> and{" "}
            <Link to="/legal/terms" className="underline">Terms</Link>.
          </p>
        </form>
      </div>
    </div>
  );
}
