import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PortalShell";
import { PushOptInCard } from "@/components/ui/PushOptInCard";
import type {
  OnboardingStatus,
  OnboardingView,
  StepKey,
  StepStatus,
  Timesheet,
} from "@/lib/types";
import {
  Check,
  CircleDashed,
  Clock,
  Lock,
  XCircle,
  FileText,
  FolderUp,
  ClipboardCheck,
  User,
  ShieldCheck,
  ArrowRight,
  Play,
  Square,
} from "lucide-react";

const stepMeta: Record<StepKey, { label: string; icon: React.ComponentType<{className?: string}>; href: string; hint: string }> = {
  application_form: { label: "Application form", icon: User, href: "/app/profile", hint: "Personal, work & bank details" },
  contract:         { label: "Contract",         icon: FileText, href: "/app/contract", hint: "Review and sign your agreement" },
  questionnaire:    { label: "Questionnaire",    icon: ClipboardCheck, href: "/app/questionnaire", hint: "Compliance declarations" },
  photo_id:         { label: "Photographic ID",  icon: FolderUp, href: "/app/documents", hint: "Upload a clear photo ID" },
  hs_card:          { label: "H&S card",         icon: FolderUp, href: "/app/documents", hint: "Upload your current safety card" },
};

function StepIcon({ s }: { s: StepStatus }) {
  const m: Record<StepStatus, { icon: React.ComponentType<{className?:string}>; cls: string }> = {
    completed:    { icon: Check,         cls: "bg-emerald-100 text-emerald-700" },
    in_progress:  { icon: Clock,         cls: "bg-accent-100 text-accent-700" },
    not_started:  { icon: CircleDashed,  cls: "bg-ink-100 text-ink-500" },
    locked:       { icon: Lock,          cls: "bg-ink-100 text-ink-400" },
    rejected:     { icon: XCircle,       cls: "bg-red-100 text-red-700" },
  };
  const { icon: I, cls } = m[s];
  return (
    <div className={`h-10 w-10 rounded-full grid place-items-center ${cls}`}>
      <I className="h-5 w-5" />
    </div>
  );
}

function statusBadge(s: OnboardingStatus) {
  const tone = {
    invited: "neutral",
    in_progress: "warn",
    submitted: "info",
    under_review: "info",
    changes_requested: "warn",
    approved: "success",
    active: "success",
    rejected: "danger",
  }[s] as "neutral" | "warn" | "info" | "success" | "danger";
  return <Badge tone={tone}>{s.replace(/_/g, " ")}</Badge>;
}

export function Home() {
  const { me } = useAuth();
  const toast = useToast();
  const [onboarding, setOnboarding] = useState<OnboardingView | null>(null);
  const [profile, setProfile] = useState<{ fullName: string | null } | null>(null);
  const [active, setActive] = useState<Timesheet | null>(null);
  const [clocking, setClocking] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshClock = async () => {
    try { setActive(await api.getMyActiveClock()); } catch { /* ignore */ }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [ob, p, ac] = await Promise.all([
          api.getMyOnboarding(),
          api.getMyProfile(),
          api.getMyActiveClock().catch(() => null),
        ]);
        if (!mounted) return;
        setOnboarding(ob);
        setProfile({ fullName: p.subcontractor.fullName });
        setActive(ac);
      } catch {
        /* noop */
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const startClock = async () => {
    setClocking(true);
    try {
      await api.clockIn();
      await refreshClock();
      toast.success("Clocked in");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to clock in");
    } finally { setClocking(false); }
  };
  const stopClock = async () => {
    setClocking(true);
    try {
      await api.clockOut();
      await refreshClock();
      toast.success("Clocked out");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to clock out");
    } finally { setClocking(false); }
  };

  const steps = onboarding?.steps;
  const totalSteps = steps ? Object.keys(steps).length : 5;
  const doneCount = steps ? Object.values(steps).filter((s) => s === "completed").length : 0;
  const progress = Math.round((doneCount / totalSteps) * 100);

  const greeting = profile?.fullName?.split(" ")[0] || me?.email?.split("@")[0] || "there";

  return (
    <>
      <PageHeader
        title={`Welcome, ${greeting}`}
        description="Complete each step below to finish your onboarding."
      />

      {/* Web push opt-in card (renders only when supported AND not yet
          subscribed AND VAPID keys are configured). */}
      <PushOptInCard />

      {/* Clock in/out widget */}
      <div className="card p-5 mb-6 flex items-center gap-4 flex-wrap">
        <div className={`h-10 w-10 rounded-full grid place-items-center ${active ? "bg-emerald-100 text-emerald-700" : "bg-ink-100 text-ink-600"}`}>
          <Clock className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          {active ? (
            <>
              <div className="text-sm font-semibold text-ink-900">Clocked in</div>
              <div className="text-xs text-ink-500">
                Since {new Date(active.clockInAt as number).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {active.siteRef ? ` · ${active.siteRef}` : ""}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-ink-900">Ready to start your day?</div>
              <div className="text-xs text-ink-500">Clock in to start tracking your hours.</div>
            </>
          )}
        </div>
        {active ? (
          <Button variant="primary" onClick={stopClock} loading={clocking} leftIcon={<Square className="h-4 w-4" />}>
            Clock out
          </Button>
        ) : (
          <Button variant="accent" onClick={startClock} loading={clocking} leftIcon={<Play className="h-4 w-4" />}>
            Clock in
          </Button>
        )}
        <Link to="/app/timesheets" className="text-sm text-ink-500 hover:text-ink-800 underline">
          View timesheets
        </Link>
      </div>

      {/* Status hero */}
      <div className="card-padded bg-ink-950 text-white mb-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 100% 0%, #F59E0B 0, transparent 40%)",
        }}/>
        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="text-ink-400 text-sm uppercase tracking-wider font-semibold mb-2">Onboarding status</div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold">
                {progress}% complete
              </h2>
              {onboarding && statusBadge(onboarding.onboardingStatus)}
            </div>
            <p className="text-ink-300 mt-2 text-sm max-w-md">
              {doneCount} of {totalSteps} steps complete.
              {" "}
              {progress === 100
                ? "Waiting for final admin approval."
                : "Continue below to complete your onboarding."}
            </p>
          </div>
          <div className="w-full max-w-xs">
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-accent-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Steps grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {(Object.keys(stepMeta) as StepKey[]).map((key) => {
          const s = steps?.[key] || "not_started";
          const meta = stepMeta[key];
          const disabled = s === "locked";
          const body = (
            <div
              className={`card p-5 flex items-start gap-4 transition hover:shadow-elev ${
                disabled ? "opacity-60 cursor-not-allowed" : "hover:-translate-y-0.5"
              }`}
            >
              <StepIcon s={s} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-ink-900">{meta.label}</h3>
                </div>
                <p className="text-sm text-ink-500 mt-0.5">{meta.hint}</p>
                <div className="mt-3">
                  {s === "completed" && <Badge tone="success" icon={<Check className="h-3 w-3" />}>Completed</Badge>}
                  {s === "in_progress" && <Badge tone="warn">In progress</Badge>}
                  {s === "not_started" && <Badge tone="neutral">Not started</Badge>}
                  {s === "locked" && <Badge tone="neutral" icon={<Lock className="h-3 w-3" />}>Locked</Badge>}
                  {s === "rejected" && <Badge tone="danger">Needs attention</Badge>}
                </div>
              </div>
              {!disabled && <ArrowRight className="h-4 w-4 text-ink-400 mt-1" />}
            </div>
          );
          return disabled ? (
            <div key={key}>{body}</div>
          ) : (
            <Link key={key} to={meta.href}>{body}</Link>
          );
        })}
      </div>

      {loading && <div className="text-sm text-ink-400 mt-4">Loading…</div>}

      <div className="mt-10 flex items-center gap-2 text-xs text-ink-400">
        <ShieldCheck className="h-4 w-4" />
        Your data is encrypted at rest. See Support if you need help.
      </div>
    </>
  );
}
