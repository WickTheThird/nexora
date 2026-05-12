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

// Hard-coded questionnaire schema (v2). Long-form Irish RCT subcontractor
// onboarding declaration. Grouped into seven sections for readability.
// Could be made dynamic later by pulling from the API.
const QUESTIONS = [
  // ---- Section 1: Tax & RCT compliance ----
  { key: "_sec_tax", type: "section" as const, label: "Tax & RCT compliance" },
  { key: "selfEmployed",      type: "boolean" as const, label: "I confirm I am self-employed and responsible for my own tax affairs." },
  { key: "taxStatus",         type: "select"  as const, label: "Tax status",
    options: [
      { value: "sole_trader", label: "Sole trader" },
      { value: "limited_company", label: "Limited company" },
      { value: "partnership", label: "Partnership" },
      { value: "other", label: "Other" },
    ] },
  { key: "registeredForVat",  type: "boolean" as const, label: "I am registered for VAT in Ireland." },
  { key: "vatNumber",         type: "text"    as const, label: "VAT number (if registered)", hint: "Leave blank if not VAT-registered." },
  { key: "rctRegistered",     type: "boolean" as const, label: "I am registered for RCT (Relevant Contracts Tax) on ROS." },
  { key: "taxClearance",      type: "boolean" as const, label: "I hold a current Tax Clearance Certificate." },
  { key: "taxClearanceNumber",type: "text"    as const, label: "Tax Clearance Access Number (if held)", hint: "Format: TC-NNNNNNN (optional)." },
  { key: "directorOrOwner",   type: "text"    as const, label: "Director / owner name (limited companies only)" },

  // ---- Section 2: Right to work ----
  { key: "_sec_rtw", type: "section" as const, label: "Right to work" },
  { key: "rightToWork",       type: "boolean" as const, label: "I have the legal right to work in Ireland / Northern Ireland." },
  { key: "rightToWorkBasis",  type: "select"  as const, label: "Basis for right to work",
    options: [
      { value: "irish_uk_citizen", label: "Irish or UK citizen" },
      { value: "eu_citizen",       label: "EU/EEA/Swiss citizen" },
      { value: "stamp4",           label: "Stamp 4 / Stamp 4 EUFAM" },
      { value: "work_permit",      label: "Critical Skills / General Employment Permit" },
      { value: "other",            label: "Other - please describe in notes" },
    ] },

  // ---- Section 3: Trade & experience ----
  { key: "_sec_trade", type: "section" as const, label: "Trade & experience" },
  { key: "primaryTrade",      type: "text"    as const, label: "Primary trade", hint: "e.g. plastering, electrical, plumbing, painting." },
  { key: "yearsExperience",   type: "select"  as const, label: "Years of experience in this trade",
    options: [
      { value: "0_1",   label: "Less than 1 year" },
      { value: "1_3",   label: "1 - 3 years" },
      { value: "3_5",   label: "3 - 5 years" },
      { value: "5_10",  label: "5 - 10 years" },
      { value: "10_plus", label: "10+ years" },
    ] },
  { key: "qualifications",    type: "textarea"as const, label: "Relevant qualifications, apprenticeships, trade certs", hint: "List the body, qualification, and year achieved." },

  // ---- Section 4: Insurance ----
  { key: "_sec_ins", type: "section" as const, label: "Insurance" },
  { key: "publicLiability",   type: "boolean" as const, label: "I hold current Public Liability insurance." },
  { key: "publicLiabilityMinor", type: "text" as const, label: "Public Liability limit (EUR)", hint: "Minimum recommended: 6,500,000." },
  { key: "employersLiability",type: "boolean" as const, label: "I hold Employer's Liability insurance (if I have employees)." },
  { key: "professionalIndemnity", type: "boolean" as const, label: "I hold Professional Indemnity insurance (if applicable)." },
  { key: "insuranceExpiry",   type: "text"    as const, label: "Earliest insurance policy expiry date (YYYY-MM-DD)" },

  // ---- Section 5: Health, Safety & Training ----
  { key: "_sec_hs", type: "section" as const, label: "Health, Safety & Training" },
  { key: "safePass",          type: "boolean" as const, label: "I hold a current Solas Safe Pass card." },
  { key: "safePassExpiry",    type: "text"    as const, label: "Safe Pass expiry date (YYYY-MM-DD)" },
  { key: "cscs",              type: "boolean" as const, label: "I hold a current CSCS card." },
  { key: "manualHandling",    type: "boolean" as const, label: "I have completed Manual Handling training within the last 3 years." },
  { key: "firstAid",          type: "boolean" as const, label: "I hold a current Occupational First Aid certificate." },
  { key: "ppe",               type: "boolean" as const, label: "I provide my own PPE and will wear it at all times on site." },
  { key: "healthDeclaration", type: "textarea"as const, label: "Health declaration", hint: "Any medical conditions, medications, or allergies the site team should know about? Write 'none' if not applicable." },
  { key: "prevAccidents",     type: "boolean" as const, label: "I have had a reportable workplace accident in the last 3 years." },
  { key: "prevAccidentsNotes",type: "textarea"as const, label: "If yes - briefly describe the accident(s)" },

  // ---- Section 6: Emergency contacts ----
  { key: "_sec_em", type: "section" as const, label: "Emergency contacts" },
  { key: "emergencyContact",  type: "text"    as const, label: "Emergency contact - name" },
  { key: "emergencyPhone",    type: "text"    as const, label: "Emergency contact - phone" },
  { key: "emergencyRelation", type: "text"    as const, label: "Emergency contact - relationship", hint: "e.g. spouse, parent, sibling." },
  { key: "gpName",            type: "text"    as const, label: "GP name & practice" },
  { key: "gpPhone",           type: "text"    as const, label: "GP phone" },
  { key: "bloodGroup",        type: "select"  as const, label: "Blood group (optional, can speed up emergency care)",
    options: [
      { value: "unknown", label: "Prefer not to say / Unknown" },
      { value: "O+", label: "O+" }, { value: "O-", label: "O-" },
      { value: "A+", label: "A+" }, { value: "A-", label: "A-" },
      { value: "B+", label: "B+" }, { value: "B-", label: "B-" },
      { value: "AB+", label: "AB+" }, { value: "AB-", label: "AB-" },
    ] },

  // ---- Section 7: Declarations & consent ----
  { key: "_sec_dec", type: "section" as const, label: "Declarations & consent" },
  { key: "noConvictions",     type: "boolean" as const, label: "I have no unspent convictions that would affect my work on construction sites." },
  { key: "consentBackground", type: "boolean" as const, label: "I consent to BC Construction verifying my Safe Pass, CSCS, and insurance with the relevant issuing bodies." },
  { key: "consentBankInfo",   type: "boolean" as const, label: "I consent to providing my bank details for RCT-net payments by BC Construction." },
  { key: "consentGdpr",       type: "boolean" as const, label: "I consent to BC Construction processing my personal data per the Privacy Policy (GDPR/DPA 2018)." },
  { key: "consentSiteRules",  type: "boolean" as const, label: "I agree to follow all site-specific rules and the principal contractor's safety plan on each site I work on." },
  { key: "declarationTruthful", type: "boolean" as const, label: "I confirm the information above is true and complete to the best of my knowledge." },
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

      <form onSubmit={submit} className="card-padded space-y-5">
        {QUESTIONS.map((q) => {
          const v = answers[q.key];
          // Section headings - visual grouping only, no input. The
          // very first section uses no top margin so it doesn't sit
          // weirdly under the card padding.
          if (q.type === "section") {
            return (
              <div key={q.key} className="pt-3 border-t border-ink-100 first:border-t-0 first:pt-0">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-700">{q.label}</h3>
              </div>
            );
          }
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
