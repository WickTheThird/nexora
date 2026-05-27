import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { QuestionnaireRecord } from "@/lib/types";
import { Button } from "@/components/ui/Button";
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
const QUESTIONNAIRE_VERSION = 2;

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
  | { kind: "yesno";   key: string; noteKey?: string; risky?: YN[]  }
  | { kind: "yesnona"; key: string; noteKey?: string; risky?: YNA[] };
export type RevenueItem = Section | Question;

// Most Revenue tests follow the same direction: "no" is the answer
// that points toward employment-like classification, so we render a
// red warning when picked. Exceptions:
//   - supplyMaterials + engageOthersOwnExpense: NEUTRAL. Plenty of
//     genuine self-employed trades don't supply materials and don't
//     engage anyone else - it doesn't tilt the classification. We
//     offer Yes / No / N/A and don't flag any answer as risky.
//   - excludedPensionSickScheme: Yes (excluded, sole trader) and
//     N/A (Limited Company) are both safe; only No is risky.
export const REVENUE_QUESTIONS: RevenueItem[] = [
  { kind: "section", key: "_sec_contract", sectionKey: "contract" },
  { kind: "yesno",   key: "notLabourOnly",            risky: ["no"] },

  { kind: "section", key: "_sec_will", sectionKey: "will" },
  { kind: "yesnona", key: "supplyMaterials" },
  { kind: "yesno",   key: "providePlantMachinery",    risky: ["no"] },
  { kind: "yesnona", key: "engageOthersOwnExpense" },
  { kind: "yesno",   key: "agreedPaymentNoOvertime",  risky: ["no"] },
  { kind: "yesnona", key: "excludedPensionSickScheme", risky: ["no"] },
  { kind: "yesno",   key: "ownTransport",             risky: ["no"] },

  { kind: "section", key: "_sec_does", sectionKey: "does" },
  { kind: "yesno",   key: "costAndAgreePrices",       risky: ["no"] },
  { kind: "yesno",   key: "ownInsurance",             risky: ["no"] },

  { kind: "section", key: "_sec_is", sectionKey: "is" },
  { kind: "yesno",   key: "freeToChooseMethod", noteKey: "freeToChooseMethodNote", risky: ["no"] },
  { kind: "yesno",   key: "ownAccountConcurrent",     risky: ["no"] },
  { kind: "yesno",   key: "exposedFinancialRisk",     risky: ["no"] },
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
  label, note, value, options, disabled, onChange, riskWarning,
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
}) {
  return (
    <div className="py-3 first:pt-0 last:pb-0 border-t border-ink-100 first:border-t-0">
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
  const [answers, setAnswers] = useState<Record<string, YN | YNA>>({});

  useEffect(() => {
    (async () => {
      try {
        const q = await api.getMyQuestionnaire();
        setExisting(q);
        if (q?.answers) {
          // Only pre-fill values that match the current v2 question
          // keys. v1 answers (the old long-form questionnaire) are
          // dropped so the user retakes the Revenue version cleanly.
          const validKeys = new Set(
            REVENUE_QUESTIONS.filter((i): i is Question => i.kind !== "section").map((q) => q.key),
          );
          const filtered: Record<string, YN | YNA> = {};
          for (const [k, v] of Object.entries(q.answers as Record<string, unknown>)) {
            if (validKeys.has(k) && (v === "yes" || v === "no" || v === "na")) {
              filtered[k] = v;
            }
          }
          setAnswers(filtered);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const editable = !existing || existing.status === "rejected";
  const questions = REVENUE_QUESTIONS.filter((i): i is Question => i.kind !== "section");
  const allAnswered = questions.every((q) => !!answers[q.key]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!allAnswered) {
      toast.error(t("questionnaire.missingAnswers"));
      return;
    }
    setSubmitting(true);
    try {
      const updated = await api.submitMyQuestionnaire(QUESTIONNAIRE_VERSION, answers);
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
        title={t("questionnaire.title")}
        description={t("questionnaire.subtitle")}
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

      <form onSubmit={submit} className="card-padded space-y-1">
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
          // red warning strip under the row. Doesn't block submit -
          // the sub may still answer truthfully even if it looks
          // employee-like - but they see the RCT implication first.
          const currentValue = answers[item.key];
          const isRisky =
            currentValue && item.risky && (item.risky as string[]).includes(currentValue);
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
            />
          );
        })}

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
    </>
  );
}
