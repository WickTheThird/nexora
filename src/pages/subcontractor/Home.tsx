import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PortalShell";
import { PushOptInCard } from "@/components/ui/PushOptInCard";
import type {
  OnboardingStatus,
  OnboardingView,
  StepKey,
  StepStatus,
} from "@/lib/types";
import {
  Check,
  CircleDashed,
  Clock,
  Lock,
  XCircle,
  FolderUp,
  ClipboardCheck,
  User,
  ShieldCheck,
  ArrowRight,
  FileText,
  ExternalLink,
  MessageSquarePlus,
  Send,
} from "lucide-react";

// Step metadata. label + hint are i18n keys (resolved inside the
// component via t()) so the cards re-render in the active locale.
const stepMeta: Record<StepKey, { labelKey: string; icon: React.ComponentType<{className?: string}>; href: string; hintKey: string }> = {
  application_form: { labelKey: "home.step.applicationForm", icon: User,           href: "/app/profile",       hintKey: "home.step.applicationFormHint" },
  questionnaire:    { labelKey: "home.step.questionnaire",   icon: ClipboardCheck, href: "/app/questionnaire", hintKey: "home.step.questionnaireHint"   },
  photo_id:         { labelKey: "home.step.photoId",         icon: FolderUp,       href: "/app/documents",     hintKey: "home.step.photoIdHint"         },
  manual_handling:  { labelKey: "home.step.manualHandling",  icon: FolderUp,       href: "/app/documents",     hintKey: "home.step.manualHandlingHint"  },
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
  const { t } = useTranslation();
  const { me } = useAuth();
  const toast = useToast();
  const [onboarding, setOnboarding] = useState<OnboardingView | null>(null);
  const [profile, setProfile] = useState<{ fullName: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  // "Need changes or updates?" widget. Posts to the existing
  // change_requests API; admin sees it in their inbox.
  const [changeMsg, setChangeMsg] = useState("");
  const [changeBusy, setChangeBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [ob, p] = await Promise.all([
          api.getMyOnboarding(),
          api.getMyProfile(),
        ]);
        if (!mounted) return;
        setOnboarding(ob);
        setProfile({ fullName: p.subcontractor.fullName });
      } catch {
        /* noop */
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const steps = onboarding?.steps;
  const totalSteps = steps ? Object.keys(steps).length : 4;
  const doneCount = steps ? Object.values(steps).filter((s) => s === "completed").length : 0;
  const progress = Math.round((doneCount / totalSteps) * 100);

  const greeting = profile?.fullName?.split(" ")[0] || me?.email?.split("@")[0] || "there";

  const submitChange = async () => {
    const msg = changeMsg.trim();
    if (msg.length < 4) {
      toast.error(t("home.changesWidget.tooShort"));
      return;
    }
    setChangeBusy(true);
    try {
      await api.postMyChangeRequest(msg);
      toast.success(t("home.changesWidget.sent"));
      setChangeMsg("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("home.changesWidget.failed"));
    } finally {
      setChangeBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t("home.welcome", { name: greeting })}
        description={t("home.subtitle")}
      />

      {/* Web push opt-in card (renders only when supported AND not yet
          subscribed AND VAPID keys are configured). */}
      <PushOptInCard />

      {/* Status hero */}
      <div className="card-padded bg-ink-950 text-white mb-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 100% 0%, #F59E0B 0, transparent 40%)",
        }}/>
        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="text-ink-400 text-sm uppercase tracking-wider font-semibold mb-2">{t("home.onboardingStatus")}</div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold">
                {t("home.percentComplete", { percent: progress })}
              </h2>
              {onboarding && statusBadge(onboarding.onboardingStatus)}
            </div>
            <p className="text-ink-300 mt-2 text-sm max-w-md">
              {t("home.stepsComplete", { done: doneCount, total: totalSteps })}
              {" "}
              {progress === 100
                ? t("home.waitingApproval")
                : t("home.continueOnboarding")}
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

      {/* Steps grid - the 4 onboarding gates + the View Contract link
          card (5th tile). Contract is intentionally NOT a gated step:
          it's a public document the worker can read at any time; their
          acceptance happens by accepting payment, not by clicking
          here. */}
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
                  <h3 className="font-semibold text-ink-900">{t(meta.labelKey)}</h3>
                </div>
                <p className="text-sm text-ink-500 mt-0.5">{t(meta.hintKey)}</p>
                <div className="mt-3">
                  {s === "completed"   && <Badge tone="success" icon={<Check className="h-3 w-3" />}>{t("home.stepState.completed")}</Badge>}
                  {s === "in_progress" && <Badge tone="warn">{t("home.stepState.inProgress")}</Badge>}
                  {s === "not_started" && <Badge tone="neutral">{t("home.stepState.notStarted")}</Badge>}
                  {s === "locked"      && <Badge tone="neutral" icon={<Lock className="h-3 w-3" />}>{t("home.stepState.locked")}</Badge>}
                  {s === "rejected"    && <Badge tone="danger">{t("home.stepState.rejected")}</Badge>}
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

        {/* Contract terms - public link card. Opens in a new tab. */}
        <a
          href={`${window.location.origin}/#/legal/contract`}
          target="_blank"
          rel="noopener noreferrer"
          className="card p-5 flex items-start gap-4 transition hover:shadow-elev hover:-translate-y-0.5"
        >
          <div className="h-10 w-10 rounded-full grid place-items-center bg-ink-100 text-ink-600">
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-ink-900">{t("home.contractCard.title")}</h3>
            <p className="text-sm text-ink-500 mt-0.5">{t("home.contractCard.subtitle")}</p>
            <div className="mt-3">
              <Badge tone="neutral">{t("home.contractCard.badge")}</Badge>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-ink-400 mt-1" />
        </a>
      </div>

      {loading && <div className="text-sm text-ink-400 mt-4">{t("common.loading")}</div>}

      {/* Need changes / updates widget - posts to admin's change
          request inbox. Replaces the duplicate widget that used to
          live only on /app/profile. */}
      <section className="card-padded mt-10">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquarePlus className="h-4 w-4 text-ink-500" />
          <h3 className="font-semibold text-ink-900">{t("home.changesWidget.title")}</h3>
        </div>
        <p className="text-xs text-ink-500 mb-3">{t("home.changesWidget.subtitle")}</p>
        <Textarea
          rows={3}
          value={changeMsg}
          onChange={(e) => setChangeMsg(e.target.value)}
          placeholder={t("home.changesWidget.placeholder")}
        />
        <div className="mt-3 flex justify-end">
          <Button variant="accent" onClick={submitChange} loading={changeBusy} leftIcon={<Send className="h-4 w-4" />}>
            {t("home.changesWidget.send")}
          </Button>
        </div>
      </section>

      <div className="mt-10 flex items-center gap-2 text-xs text-ink-400">
        <ShieldCheck className="h-4 w-4" />
        {t("home.footerNote")}
      </div>
    </>
  );
}
