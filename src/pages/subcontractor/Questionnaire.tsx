import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { QuestionnaireRecord } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Textarea, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PortalShell";
import { fmtDateTime } from "@/lib/format";
import { ClipboardCheck, CheckCircle2, XCircle, Clock, Send } from "lucide-react";

// Hard-coded questionnaire schema (v1). Could be made dynamic later by pulling from the API.
const QUESTIONS = [
  { key: "selfEmployed",      type: "boolean" as const, label: "I confirm I am self-employed and responsible for my own tax affairs." },
  { key: "rightToWork",       type: "boolean" as const, label: "I have the legal right to work in the jurisdiction I will be providing services in." },
  { key: "taxStatus",         type: "select"  as const, label: "Tax status",
    options: [
      { value: "sole_trader", label: "Sole trader" },
      { value: "limited_company", label: "Limited company" },
      { value: "partnership", label: "Partnership" },
      { value: "other", label: "Other" },
    ] },
  { key: "healthDeclaration", type: "text"    as const, label: "Health declaration", hint: "Any conditions we should know about? Leave as 'none' if not applicable." },
  { key: "emergencyContact",  type: "text"    as const, label: "Emergency contact (name & phone)" },
  { key: "notes",             type: "textarea"as const, label: "Additional notes (optional)" },
];

type Answer = string | boolean;

function statusBadge(s: QuestionnaireRecord["status"]) {
  if (s === "approved")  return <Badge tone="success" icon={<CheckCircle2 className="h-3 w-3"/>}>Approved</Badge>;
  if (s === "rejected")  return <Badge tone="danger" icon={<XCircle className="h-3 w-3"/>}>Rejected</Badge>;
  if (s === "submitted") return <Badge tone="info" icon={<Clock className="h-3 w-3"/>}>Submitted</Badge>;
  return <Badge tone="neutral">Not started</Badge>;
}

export function Questionnaire() {
  const toast = useToast();
  const [existing, setExisting] = useState<QuestionnaireRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>({
    taxStatus: "sole_trader",
    healthDeclaration: "none",
  });

  useEffect(() => {
    (async () => {
      try {
        const q = await api.getMyQuestionnaire();
        setExisting(q);
        if (q?.answers) {
          setAnswers(q.answers as Record<string, Answer>);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const editable = !existing || existing.status === "rejected";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!answers.selfEmployed || !answers.rightToWork) {
        throw new Error("You must confirm both required declarations.");
      }
      const updated = await api.submitMyQuestionnaire(1, answers);
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
        title="Questionnaire"
        description="Compliance declarations required for onboarding."
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

      <form onSubmit={submit} className="card-padded space-y-6">
        {QUESTIONS.map((q) => {
          const v = answers[q.key];
          if (q.type === "boolean") {
            return (
              <Checkbox
                key={q.key}
                label={q.label}
                checked={!!v}
                onChange={(e) =>
                  editable &&
                  setAnswers((prev) => ({ ...prev, [q.key]: e.target.checked }))
                }
                disabled={!editable}
              />
            );
          }
          if (q.type === "select") {
            return (
              <Select
                key={q.key}
                label={q.label}
                value={String(v ?? q.options[0].value)}
                options={q.options}
                onChange={(e) =>
                  editable &&
                  setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))
                }
                disabled={!editable}
              />
            );
          }
          if (q.type === "text") {
            return (
              <Input
                key={q.key}
                label={q.label}
                hint={q.hint}
                value={String(v ?? "")}
                onChange={(e) =>
                  editable &&
                  setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))
                }
                disabled={!editable}
              />
            );
          }
          return (
            <Textarea
              key={q.key}
              label={q.label}
              value={String(v ?? "")}
              onChange={(e) =>
                editable &&
                setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))
              }
              disabled={!editable}
            />
          );
        })}

        {editable && (
          <div className="flex justify-end">
            <Button type="submit" variant="accent" loading={submitting} leftIcon={<Send className="h-4 w-4" />}>
              {existing ? "Resubmit" : "Submit questionnaire"}
            </Button>
          </div>
        )}
      </form>
    </>
  );
}
