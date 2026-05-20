import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { QuestionnaireRecord } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PortalShell";
import { fmtDateTime } from "@/lib/format";
import { ClipboardCheck, CheckCircle2, XCircle, Clock, Send } from "lucide-react";

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
type Section = { kind: "section"; key: string; label: string };
type Question =
  | { kind: "yesno";   key: string; label: string; note?: string }
  | { kind: "yesnona"; key: string; label: string; note?: string };
type Item = Section | Question;

export const REVENUE_QUESTIONS: Item[] = [
  { kind: "section", key: "_sec_contract", label: "Contract type" },
  { kind: "yesno",   key: "notLabourOnly",
    label: "Are you satisfied that the contract is NOT a labour only contract?" },

  { kind: "section", key: "_sec_will", label: "Will the Subcontractor" },
  { kind: "yesno",   key: "supplyMaterials",
    label: "Supply materials?" },
  { kind: "yesno",   key: "providePlantMachinery",
    label: "Provide plant and machinery necessary for the job, other than hand tools?" },
  { kind: "yesno",   key: "engageOthersOwnExpense",
    label: "Engage other people to work on the contract at his/her own expense?" },
  { kind: "yesno",   key: "agreedPaymentNoOvertime",
    label: "Receive an agreed contract payment(s) without entitlement to pay for overtime, holidays, country money, travel and subsistence or other expenses payment?" },
  { kind: "yesnona", key: "excludedPensionSickScheme",
    label: "Be excluded from the industry pension and sick pay scheme, if a sole trader?" },
  { kind: "yesno",   key: "ownTransport",
    label: "Organise his/her own transport to and from sites?" },

  { kind: "section", key: "_sec_does", label: "Does the Subcontractor" },
  { kind: "yesno",   key: "costAndAgreePrices",
    label: "Cost and agree prices for jobs?" },
  { kind: "yesno",   key: "ownInsurance",
    label: "Provide his/her own insurance cover as appropriate e.g. public liability, etc?" },

  { kind: "section", key: "_sec_is", label: "Is the Subcontractor" },
  { kind: "yesno",   key: "freeToChooseMethod",
    label: "Free to choose the method to be employed in carrying out the work without the direction or control of the site foreman/overseer?",
    note: "In the construction sector, for health and safety reasons, all individuals are under the direction of the site foreman/overseer." },
  { kind: "yesno",   key: "ownAccountConcurrent",
    label: "In business on his/her own account and able to provide the same services concurrently to others?" },
  { kind: "yesno",   key: "exposedFinancialRisk",
    label: "Exposed to financial risk including bearing the cost of making good faulty/substandard work and overruns?" },
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
  label, note, value, options, disabled, onChange,
}: {
  label: string;
  note?: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (v: string) => void;
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
    </div>
  );
}

export function Questionnaire() {
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
      toast.error("Please answer every question before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await api.submitMyQuestionnaire(QUESTIONNAIRE_VERSION, answers);
      setExisting(updated);
      toast.success("Questionnaire submitted");
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
        <PageHeader title="Questionnaire" />
        <div className="skeleton h-64" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="RCT Contract Notification - Subcontractor Questionnaire"
        description="Twelve declarations Revenue requires before BC can register the contract on ROS. Answer Yes or No to each. All are required."
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
                Submitted {fmtDateTime(existing.submittedAt)}
              </div>
              <div className="text-sm text-ink-500">
                {existing.status === "approved" && existing.reviewedAt
                  ? `Approved ${fmtDateTime(existing.reviewedAt)}`
                  : existing.status === "submitted"
                  ? "Awaiting admin review"
                  : null}
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="card-padded space-y-1">
        {REVENUE_QUESTIONS.map((item) => {
          if (item.kind === "section") {
            return (
              <div key={item.key} className="pt-4 pb-1 mt-2 border-t border-ink-200 first:border-t-0 first:mt-0 first:pt-0">
                <h3 className="text-sm font-semibold text-ink-900">{item.label}</h3>
              </div>
            );
          }
          const opts =
            item.kind === "yesnona"
              ? [
                  { value: "yes", label: "Yes" },
                  { value: "no",  label: "No"  },
                  { value: "na",  label: "N/A" },
                ]
              : [
                  { value: "yes", label: "Yes" },
                  { value: "no",  label: "No"  },
                ];
          return (
            <YesNoRow
              key={item.key}
              label={item.label}
              note={item.note}
              value={answers[item.key]}
              options={opts}
              disabled={!editable}
              onChange={(v) =>
                setAnswers((prev) => ({ ...prev, [item.key]: v as YN | YNA }))
              }
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
              {existing ? "Resubmit" : "Submit questionnaire"}
            </Button>
          </div>
        )}
      </form>
    </>
  );
}
