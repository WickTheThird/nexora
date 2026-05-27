import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { QuestionnaireRecord } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PortalShell";
import { fmtDateTime } from "@/lib/format";
import { ClipboardCheck, CheckCircle2, XCircle, Clock, Send, AlertTriangle, Info } from "lucide-react";

// Revenue-aligned Contract Notification questionnaire (v2). Each
// question is the same wording the Revenue "Relevant Contracts Tax -
// Contract Notification - Contract Details 2-2" screen uses, so what
// the operative answers here lines up exactly with what BC files on
// ROS. Yes/No (and one Yes/No/N/A) only - no free text.
//
// CHANGING THIS SCHEMA: bump QUESTIONNAIRE_VERSION + leave old records
// alone so admin can still render them with their original wording.
// v3 2026-05-27: Enagh 14-question Work Status questionnaire
// (replaces the Revenue 12-Q form). Bumped so admin can tell which
// schema a record was submitted under.
const QUESTIONNAIRE_VERSION = 3;

type YN = "yes" | "no";
type YNA = "yes" | "no" | "na";

// Schema describes structure only; the actual question text lives in
// the locale files (questionnaire.questions.*) so admin renders the
// same labels in the active locale + new questions only need a JSON
// edit. `sectionKey` resolves via i18n questionnaire.sections.*; the
// optional `noteKey` adds the Revenue health-and-safety footnote on
// the freeToChooseMethod row.
//
// `risky` is the set of answers that suggest an employee-like
// arrangement under Revenue's classification tests. When the sub
// picks one of these AFTER answering, we render an amber warning
// strip under the question explaining the RCT implication. We do
// NOT pre-prescribe answers - the sub must answer based on reality.
type Section = { kind: "section"; key: string; sectionKey: string };
type Question =
  | { kind: "yesno";   key: string; noteKey?: string; risky?: YN[];  defaultAnswer?: YN;  detailsKey?: string }
  | { kind: "yesnona"; key: string; noteKey?: string; risky?: YNA[]; defaultAnswer?: YNA; detailsKey?: string };
export type RevenueItem = Section | Question;

// Enagh-style Work Questionnaire (replaces the 12-Q Revenue form
// 2026-05-27). Same purpose - establish genuine self-employed
// status - but reworded to match the SDC ("Supervision, Direction
// and Control") industry test the user's wider contractor network
// already uses.
//
// `defaultAnswer` pre-selects the option that demonstrates
// self-employed status. The sub can change it; `risky` lists the
// answer that would push them toward employment-like
// classification, and the red warning fires on those.
//
// Q8 has a `detailsKey` so we render an optional textarea below
// the yes/no for the sub to list qualifications when they answer
// Yes (specialist knowledge).
export const REVENUE_QUESTIONS: RevenueItem[] = [
  { kind: "yesno", key: "workControlledByClient",        defaultAnswer: "no",  risky: ["yes"] },
  { kind: "yesno", key: "requiredOnSiteAtTime",          defaultAnswer: "no",  risky: ["yes"] },
  { kind: "yesno", key: "decideOwnHours",                defaultAnswer: "yes", risky: ["no"]  },
  { kind: "yesno", key: "canBeToldHowToWork",            defaultAnswer: "no",  risky: ["yes"] },
  { kind: "yesno", key: "provideOwnTools",               defaultAnswer: "yes", risky: ["no"]  },
  { kind: "yesno", key: "clientCanTerminateAnytime",     defaultAnswer: "yes", risky: ["no"]  },
  { kind: "yesno", key: "freeToSendSubstitute",          defaultAnswer: "yes", risky: ["no"]  },
  { kind: "yesno", key: "specialistKnowledge",           defaultAnswer: "yes", risky: ["no"], detailsKey: "specialistKnowledgeDetails" },
  { kind: "yesno", key: "provideProgressUpdates",        defaultAnswer: "no",  risky: ["yes"] },
  { kind: "yesno", key: "overseenDaily",                 defaultAnswer: "no",  risky: ["yes"] },
  { kind: "yesno", key: "canBeRequiredDifferentWay",     defaultAnswer: "yes", risky: ["no"]  },
  { kind: "yesno", key: "rightToRefuseWork",             defaultAnswer: "yes", risky: ["no"]  },
  { kind: "yesno", key: "correctPoorWorkUnpaid",         defaultAnswer: "yes", risky: ["no"]  },
  { kind: "yesno", key: "canBeMovedJobToJob",            defaultAnswer: "no",  risky: ["yes"] },
];

function statusBadge(s: QuestionnaireRecord["status"]) {
  if (s === "approved")  return <Badge tone="success" icon={<CheckCircle2 className="h-3 w-3"/>}>Approved</Badge>;
  if (s === "rejected")  return <Badge tone="danger" icon={<XCircle className="h-3 w-3"/>}>Rejected</Badge>;
  if (s === "submitted") return <Badge tone="info" icon={<Clock className="h-3 w-3"/>}>Submitted</Badge>;
  return <Badge tone="neutral">Not started</Badge>;
}

// Radio group rendered to match the Revenue form: question on the
// left, radios on the right, red asterisk on the label. Compact
// enough to fit ~12 items without scrolling on desktop.
function YesNoRow({
  label, note, value, options, disabled, onChange, riskWarning, children,
}: {
  label: string;
  note?: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (v: string) => void;
  // Localised warning to render under the row when the current
  // answer is considered "risky" (employee-like) by the schema.
  // Computed by the parent so this component stays presentational.
  riskWarning?: string;
  // Slot for extra inputs (e.g. the Q8 details textarea).
  children?: React.ReactNode;
}) {
  // Green-tint the row when answered + non-risky. Visible feedback
  // that the question is "good" - the warning red on risky answers
  // already lives in the strip below.
  const answered = !!value;
  const tone = answered && !riskWarning ? "bg-emerald-50/40" : "";
  return (
    <div className={`py-3 px-3 -mx-3 rounded-md transition-colors first:pt-3 last:pb-3 border-t border-ink-100 first:border-t-0 ${tone}`}>
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-ink-800">
            {label} <span className="text-red-600" aria-hidden>*</span>
          </div>
          {note && (
            <div className="text-xs text-ink-500 mt-1 italic">
              Note: {note}
            </div>
          )}
        </div>
        <div className="flex items-center gap-5 shrink-0 pt-0.5">
          {options.map((o) => (
            <label key={o.value} className="inline-flex items-center gap-1.5 cursor-pointer text-sm text-ink-800">
              <input
                type="radio"
                name={label.slice(0, 60)}
                value={o.value}
                checked={value === o.value}
                disabled={disabled}
                onChange={() => onChange(o.value)}
                className="h-4 w-4 text-ink-900 focus:ring-ink-900"
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>
      {children && <div className="mt-3">{children}</div>}
      {riskWarning && (
        <div className="mt-2 rounded-md bg-red-50 border border-red-200 p-2.5 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-700 mt-0.5 shrink-0" />
          <div className="text-xs text-red-900 leading-relaxed font-medium">{riskWarning}</div>
        </div>
      )}
    </div>
  );
}

export function Questionnaire() {
  const { t } = useTranslation();
  const toast = useToast();
  const [existing, setExisting] = useState<QuestionnaireRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Enagh-style header: sub's name + address shown above the form.
  // Pulled from /me/profile alongside the existing onboarding view
  // so the questionnaire shows "Work Questionnaire - John Doe /
  // Address: 1 Main St, Dublin, D02 ABCD" at the top.
  const [subHeader, setSubHeader] = useState<{ fullName: string; address: string } | null>(null);
  // Scroll-to-read gate removed 2026-05-27 (user request: it was
  // blocking submit even with defaults pre-filled). Lives on the
  // /legal/contract page instead, where reading terms is more
  // meaningful than skimming yes/no answers.
  // Default-pre-filled answer map. Built from REVENUE_QUESTIONS.
  // The sub can flip any answer; defaults exist so the form isn't
  // an empty wall of radios on first paint.
  const defaultAnswers = (): Record<string, YN | YNA> => {
    const out: Record<string, YN | YNA> = {};
    for (const q of REVENUE_QUESTIONS) {
      if (q.kind !== "section" && q.defaultAnswer) out[q.key] = q.defaultAnswer;
    }
    return out;
  };
  const [answers, setAnswers] = useState<Record<string, YN | YNA>>(defaultAnswers());
  // Per-question free-text details (e.g. specialist knowledge
  // qualifications). Keyed by the same question key + suffix.
  const [details, setDetails] = useState<Record<string, string>>({});
  // Print full name shown at the bottom of the form (matches
  // Enagh's "Ready to Submit?" footer pattern).
  const [forename, setForename] = useState("");
  const [surname, setSurname]   = useState("");

  useEffect(() => {
    (async () => {
      try {
        // Fetch profile in parallel to populate the Enagh-style
        // "Work Questionnaire - Name / Address:" header at the top.
        const [q, profile] = await Promise.all([
          api.getMyQuestionnaire(),
          api.getMyProfile().catch(() => null),
        ]);
        setExisting(q);
        if (profile?.subcontractor) {
          const s = profile.subcontractor;
          const addr = [s.address1, s.address2, s.town, s.postcode]
            .filter(Boolean).join(", ");
          setSubHeader({ fullName: s.fullName || "", address: addr });
          // Pre-fill forename/surname from profile full_name (Enagh
          // splits "John Doe" -> John + Doe). User can still edit.
          if (s.fullName && !forename && !surname) {
            const parts = s.fullName.trim().split(/\s+/);
            setForename(parts[0] || "");
            setSurname(parts.slice(1).join(" ") || "");
          }
        }
        if (q?.answers) {
          // Pre-fill values from the existing record. Schema keys
          // are normalised against the current v2 keyset so any
          // legacy v1 keys get dropped.
          const validKeys = new Set(
            REVENUE_QUESTIONS.filter((i): i is Question => i.kind !== "section").map((q) => q.key),
          );
          const filtered = defaultAnswers();
          const det: Record<string, string> = {};
          const ans = q.answers as Record<string, unknown>;
          for (const [k, v] of Object.entries(ans)) {
            if (validKeys.has(k) && (v === "yes" || v === "no" || v === "na")) {
              filtered[k] = v;
            }
            // Question details (free text) live under "_details"
            // suffixed keys so admin can review answer + supplied
            // qualifications side by side.
            if (k.endsWith("_details") && typeof v === "string") {
              det[k] = v;
            }
            if (k === "_forename" && typeof v === "string") setForename(v);
            if (k === "_surname"  && typeof v === "string") setSurname(v);
          }
          setAnswers(filtered);
          setDetails(det);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const editable = !existing || existing.status === "rejected";
  const questions = REVENUE_QUESTIONS.filter((i): i is Question => i.kind !== "section");
  const allAnswered = questions.every((q) => !!answers[q.key]);
  // Progress = % of questions answered. Defaults count as answered
  // (we pre-fill them) so the bar starts at 100% in the common
  // case; the bar drops if the sub deliberately clears an answer.
  const answeredCount = questions.filter((q) => !!answers[q.key]).length;
  const progress = Math.round((answeredCount / questions.length) * 100);

  // Two-step gate (item 12): form submit opens a confirm modal where
  // the sub sees a summary of their answers before committing. The
  // legacy `submit` function below does the actual POST after they
  // click Confirm in the modal.
  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!allAnswered) {
      toast.error(t("questionnaire.missingAnswers"));
      return;
    }
    if (!forename.trim() || !surname.trim()) {
      toast.error(t("questionnaire.nameRequired"));
      return;
    }
    setConfirmOpen(true);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      // Bundle answers + per-question details + the full-name
      // confirmation into a single JSON payload. Server stores it
      // verbatim under questionnaires.answers_json; admin sees
      // everything in the labelled Q&A view.
      const payload: Record<string, unknown> = { ...answers, ...details };
      payload._forename = forename.trim();
      payload._surname  = surname.trim();
      const updated = await api.submitMyQuestionnaire(QUESTIONNAIRE_VERSION, payload);
      setExisting(updated);
      toast.success(t("questionnaire.submitted"));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : e instanceof ApiError ? e.message : "Failed",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title={t("nav.questionnaire")} />
        <div className="skeleton h-64" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={subHeader?.fullName
          ? `${t("questionnaire.title")} - ${subHeader.fullName}`
          : t("questionnaire.title")}
        description={subHeader?.address
          ? `${t("questionnaire.subtitle")} · Address: ${subHeader.address}`
          : t("questionnaire.subtitle")}
        right={existing ? statusBadge(existing.status) : statusBadge("not_started")}
      />

      {existing && !editable && (
        <div className="card-padded mb-6 bg-ink-50/50">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-ink-900 text-white grid place-items-center">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium text-ink-900">
                {t("questionnaire.submittedAt", { date: fmtDateTime(existing.submittedAt) })}
              </div>
              <div className="text-sm text-ink-500">
                {existing.status === "approved" && existing.reviewedAt
                  ? t("questionnaire.approvedAt", { date: fmtDateTime(existing.reviewedAt) })
                  : existing.status === "submitted"
                  ? t("questionnaire.awaitingReview")
                  : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context banner. Education-only - doesn't block submit, just
          frames what the questions are for so the worker doesn't
          pick "what sounds good" - they pick what matches reality. */}
      {editable && (
        <div className="mb-5 rounded-lg bg-sky-50 border border-sky-200 p-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-sky-700 mt-0.5 shrink-0" />
          <div className="text-sm text-sky-900 leading-relaxed">
            <div className="font-medium mb-1">{t("questionnaire.guidance.bannerTitle")}</div>
            <div className="text-xs">{t("questionnaire.guidance.bannerBody")}</div>
          </div>
        </div>
      )}

      {/* Progress bar - % of questions answered. Defaults are pre-
          selected so this starts at 100% in the common case; it
          drops only if the user clears an answer. */}
      {editable && (
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-ink-500 mb-1.5">
            <span>{t("questionnaire.progressLabel", { answered: answeredCount, total: questions.length })}</span>
            <span className="font-semibold text-ink-700">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <form onSubmit={onFormSubmit} className="card-padded space-y-1">
        {REVENUE_QUESTIONS.map((item) => {
          if (item.kind === "section") {
            return (
              <div key={item.key} className="pt-4 pb-1 mt-2 border-t border-ink-200 first:border-t-0 first:mt-0 first:pt-0">
                <h3 className="text-sm font-semibold text-ink-900">{t(`questionnaire.sections.${item.sectionKey}`)}</h3>
              </div>
            );
          }
          const opts =
            item.kind === "yesnona"
              ? [
                  { value: "yes", label: t("common.yes") },
                  { value: "no",  label: t("common.no")  },
                  { value: "na",  label: t("common.na")  },
                ]
              : [
                  { value: "yes", label: t("common.yes") },
                  { value: "no",  label: t("common.no")  },
                ];
          // Instant inline warning: as soon as the sub picks an
          // answer in the "risky" set for this question, render a
          // red warning strip under the row.
          const currentValue = answers[item.key];
          const isRisky =
            currentValue && item.risky && (item.risky as string[]).includes(currentValue);
          // Details textarea slot - currently only Q8 has one
          // (specialist knowledge / qualifications).
          const detailsField = item.detailsKey ? (
            <Textarea
              label={t(`questionnaire.questions.${item.detailsKey}`)}
              rows={3}
              value={details[`${item.key}_details`] || ""}
              onChange={(e) => setDetails((p) => ({ ...p, [`${item.key}_details`]: e.target.value }))}
              disabled={!editable}
              hint={t("questionnaire.detailsHint")}
            />
          ) : null;
          return (
            <YesNoRow
              key={item.key}
              label={t(`questionnaire.questions.${item.key}`)}
              note={item.noteKey ? t(`questionnaire.questions.${item.noteKey}`) : undefined}
              value={currentValue}
              options={opts}
              disabled={!editable}
              onChange={(v) =>
                setAnswers((prev) => ({ ...prev, [item.key]: v as YN | YNA }))
              }
              riskWarning={isRisky ? t("questionnaire.guidance.riskWarning") : undefined}
            >
              {detailsField}
            </YesNoRow>
          );
        })}

        {/* Print FULL Name footer - matches Enagh's "Ready to Submit?"
            block. Captured into the answers payload so admin sees
            the typed full name alongside the answers. */}
        {editable && (
          <div className="pt-6 mt-4 border-t border-ink-200">
            <h3 className="text-sm font-semibold text-ink-900 mb-1">{t("questionnaire.readyToSubmit")}</h3>
            <p className="text-xs text-ink-500 mb-4">{t("questionnaire.readyToSubmitBody")}</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label={t("questionnaire.forename")}
                required
                value={forename}
                onChange={(e) => setForename(e.target.value)}
              />
              <Input
                label={t("questionnaire.surname")}
                required
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
              />
            </div>
          </div>
        )}

        {editable && (
          <div className="flex justify-end pt-5">
            <Button
              type="submit"
              variant="accent"
              loading={submitting}
              leftIcon={<Send className="h-4 w-4" />}
              disabled={!allAnswered}
            >
              {existing ? t("questionnaire.resubmit") : t("questionnaire.submit")}
            </Button>
          </div>
        )}
      </form>

      {/* Two-step confirm gate. Sub sees the summary of every Q+A
          and the typed full name before the actual POST fires.
          Submitted questionnaires can only be amended via change
          request, so we want a deliberate confirm. */}
      <Modal
        open={confirmOpen}
        onClose={() => !submitting && setConfirmOpen(false)}
        title={t("questionnaire.confirmTitle")}
        description={t("questionnaire.confirmBody")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              {t("common.back")}
            </Button>
            <Button variant="accent" loading={submitting}
              onClick={async () => { await submit(); setConfirmOpen(false); }}
              leftIcon={<Send className="h-4 w-4" />}>
              {t("questionnaire.confirmCta")}
            </Button>
          </>
        }
      >
        <dl className="text-xs space-y-2 max-h-[60vh] overflow-y-auto pr-2">
          {questions.map((q) => {
            const v = answers[q.key];
            return (
              <div key={q.key} className="grid grid-cols-12 gap-3 py-1 border-b border-ink-100 last:border-b-0">
                <dt className="col-span-9 text-ink-700">{t(`questionnaire.questions.${q.key}`)}</dt>
                <dd className="col-span-3 text-right font-medium uppercase text-ink-900">{v ?? "-"}</dd>
              </div>
            );
          })}
          <div className="pt-2 grid grid-cols-2 gap-3 text-ink-800">
            <div><span className="text-ink-500">Forename:</span> <strong>{forename}</strong></div>
            <div><span className="text-ink-500">Surname:</span> <strong>{surname}</strong></div>
          </div>
        </dl>
      </Modal>
    </>
  );
}
