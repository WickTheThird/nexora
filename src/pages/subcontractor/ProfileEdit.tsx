import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { BankDetails, ChangeRequest, Subcontractor } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Checkbox } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PortalShell";
import { fmtDateTime } from "@/lib/format";
import { Save, Send, Lock, MessageSquarePlus, Clock } from "lucide-react";

const EDITABLE: Subcontractor["onboardingStatus"][] = [
  "invited",
  "in_progress",
  "changes_requested",
];

export function ProfileEdit() {
  const toast = useToast();
  const [sub, setSub] = useState<Subcontractor | null>(null);
  const [bank, setBank] = useState<BankDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sub-initiated "request changes from admin" - free-form message that
  // creates a change_request entry visible in the admin Change Requests
  // inbox. Mostly used when the profile is locked.
  const [changeReqs, setChangeReqs] = useState<ChangeRequest[]>([]);
  const [crMessage, setCrMessage] = useState("");
  const [crBusy, setCrBusy] = useState(false);

  const loadChangeReqs = async () => {
    try {
      const r = await api.listMyChangeRequests();
      setChangeReqs(r.items);
    } catch {
      /* non-fatal: side panel */
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const p = await api.getMyProfile();
        setSub(p.subcontractor);
        setBank(p.bank);
        await loadChangeReqs();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const submitChangeRequest = async () => {
    const msg = crMessage.trim();
    if (msg.length < 4) {
      toast.error("Tell us briefly what needs changing");
      return;
    }
    setCrBusy(true);
    try {
      await api.postMyChangeRequest(msg);
      toast.success("Your request was sent to the office.");
      setCrMessage("");
      await loadChangeReqs();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not send request");
    } finally {
      setCrBusy(false);
    }
  };

  const editable = sub ? EDITABLE.includes(sub.onboardingStatus) : false;

  const setS = <K extends keyof Subcontractor>(k: K, v: Subcontractor[K]) =>
    setSub((prev) => (prev ? { ...prev, [k]: v } : prev));
  const setB = <K extends keyof BankDetails>(k: K, v: BankDetails[K]) =>
    setBank((prev) => (prev ? { ...prev, [k]: v } : prev));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!sub || !bank) return;
    setSaving(true);
    setError(null);
    try {
      const newSub = await api.patchMyProfile({
        fullName: sub.fullName,
        address1: sub.address1,
        address2: sub.address2,
        town: sub.town,
        postcode: sub.postcode,
        dob: sub.dob,
        placeOfBirth: sub.placeOfBirth,
        tel: sub.tel,
        mob: sub.mob,
        email: sub.email,
        ppsNumber: sub.ppsNumber,
        natureOfServices: sub.natureOfServices,
        workType: sub.workType,
        vatRegistered: sub.vatRegistered,
        vatNumber: sub.vatNumber,
        accountantEmail: sub.accountantEmail,
      });
      const newBank = await api.patchMyBank({
        bankName: bank.bankName,
        accountHolderName: bank.accountHolderName,
        accountNumber: bank.accountNumber,
        sortCode: bank.sortCode,
        iban: bank.iban,
        bic: bank.bic,
        bankRef: bank.bankRef,
        currency: bank.currency,
      });
      setSub(newSub);
      setBank(newBank);
      toast.success("Saved");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await api.submitMyProfile();
      toast.success("Application submitted for review");
      setSub((prev) =>
        prev
          ? {
              ...prev,
              onboardingStatus: r.onboardingStatus as Subcontractor["onboardingStatus"],
              submittedAt: r.submittedAt,
            }
          : prev,
      );
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !sub || !bank) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-1/3" />
        <div className="skeleton h-32" />
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-8">
      <PageHeader
        title="My Details"
        description="Keep your personal, work and bank information up to date."
        right={
          <>
            {editable ? (
              <>
                <Button variant="outline" type="submit" loading={saving} leftIcon={<Save className="h-4 w-4"/>}>Save</Button>
                <Button
                  type="button"
                  variant="accent"
                  loading={submitting}
                  onClick={submit}
                  leftIcon={<Send className="h-4 w-4" />}
                >
                  Submit for review
                </Button>
              </>
            ) : (
              <Badge tone="neutral" icon={<Lock className="h-3 w-3" />}>
                Locked ({sub.onboardingStatus.replace(/_/g, " ")})
              </Badge>
            )}
          </>
        }
      />

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!editable && (
        <div className="rounded-lg bg-ink-100 border border-ink-200 p-4 text-sm text-ink-700">
          Your profile is locked while it's {sub.onboardingStatus.replace(/_/g, " ")}.
          If changes are needed, an administrator will unlock it.
        </div>
      )}

      {/* Personal */}
      <section className="card-padded">
        <h2 className="text-base font-semibold text-ink-900 mb-1">Personal</h2>
        <p className="text-sm text-ink-500 mb-6">Basic identity & contact details.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Full name" value={sub.fullName || ""} onChange={(e) => setS("fullName", e.target.value)} disabled={!editable} />
          <Input label="Date of birth" type="date" value={sub.dob || ""} onChange={(e) => setS("dob", e.target.value)} disabled={!editable} />
          <Input label="Place of birth" value={sub.placeOfBirth || ""} onChange={(e) => setS("placeOfBirth", e.target.value)} disabled={!editable} />
          <Input label="Email" type="email" value={sub.email || ""} onChange={(e) => setS("email", e.target.value)} disabled={!editable} />
          <Input label="Phone" value={sub.tel || ""} onChange={(e) => setS("tel", e.target.value)} disabled={!editable} />
          <Input label="Mobile" value={sub.mob || ""} onChange={(e) => setS("mob", e.target.value)} disabled={!editable} />
          {/* PPS sits under Personal - tax-side identity, not job-
              related. Required + must be unique across the platform
              (worker enforces). Stored encrypted at rest. */}
          <Input
            label="PPS number"
            required
            value={sub.ppsNumber || ""}
            onChange={(e) => setS("ppsNumber", e.target.value.toUpperCase())}
            disabled={!editable}
            hint="Required. Unique across the platform. Encrypted at rest."
          />
        </div>
      </section>

      {/* Address */}
      <section className="card-padded">
        <h2 className="text-base font-semibold text-ink-900 mb-1">Address</h2>
        <p className="text-sm text-ink-500 mb-6">Your primary address on file.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Address line 1" value={sub.address1 || ""} onChange={(e) => setS("address1", e.target.value)} disabled={!editable} />
          <Input label="Address line 2" value={sub.address2 || ""} onChange={(e) => setS("address2", e.target.value)} disabled={!editable} />
          <Input label="Town / City" value={sub.town || ""} onChange={(e) => setS("town", e.target.value)} disabled={!editable} />
          <Input label="Postcode" value={sub.postcode || ""} onChange={(e) => setS("postcode", e.target.value)} disabled={!editable} />
        </div>
      </section>

      {/* Work */}
      <section className="card-padded">
        <h2 className="text-base font-semibold text-ink-900 mb-1">Work</h2>
        <p className="text-sm text-ink-500 mb-6">The services you provide.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Work type / trade" value={sub.workType || ""} onChange={(e) => setS("workType", e.target.value)} disabled={!editable} />
          <div className="sm:col-span-2">
            <Input label="Nature of services" value={sub.natureOfServices || ""} onChange={(e) => setS("natureOfServices", e.target.value)} disabled={!editable} />
          </div>
          <div className="sm:col-span-2">
            <Checkbox
              label="I am registered for VAT"
              checked={sub.vatRegistered}
              onChange={(e) => setS("vatRegistered", e.target.checked)}
              disabled={!editable}
            />
          </div>
          {sub.vatRegistered && (
            <Input label="VAT number" value={sub.vatNumber || ""} onChange={(e) => setS("vatNumber", e.target.value)} disabled={!editable} />
          )}
          <div className="sm:col-span-2">
            <Input
              label="Your accountant's email (optional)"
              type="email"
              value={sub.accountantEmail || ""}
              onChange={(e) => setS("accountantEmail", e.target.value)}
              disabled={!editable}
              hint="Your invoices can be CC'd here when you generate them. Separate from the principal's accountant."
              placeholder="accountant@example.ie"
            />
          </div>
        </div>
      </section>

      {/* Bank */}
      <section className="card-padded">
        <h2 className="text-base font-semibold text-ink-900 mb-1">Bank</h2>
        <p className="text-sm text-ink-500 mb-6">
          Payment details. Encrypted at rest. Only you and authorised admins can see these.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Bank name" value={bank.bankName || ""} onChange={(e) => setB("bankName", e.target.value)} disabled={!editable} />
          <Input label="Account holder name" value={bank.accountHolderName || ""} onChange={(e) => setB("accountHolderName", e.target.value)} disabled={!editable} />
          <Input label="Account number" value={bank.accountNumber || ""} onChange={(e) => setB("accountNumber", e.target.value)} disabled={!editable} />
          <Input label="Sort code" value={bank.sortCode || ""} onChange={(e) => setB("sortCode", e.target.value)} disabled={!editable} />
          <Input label="IBAN" value={bank.iban || ""} onChange={(e) => setB("iban", e.target.value)} disabled={!editable} />
          <Input label="BIC / SWIFT" value={bank.bic || ""} onChange={(e) => setB("bic", e.target.value)} disabled={!editable} />
          <Input label="Currency" value={bank.currency} onChange={(e) => setB("currency", e.target.value.toUpperCase())} disabled={!editable} />
          <Input label="Bank reference" value={bank.bankRef || ""} onChange={(e) => setB("bankRef", e.target.value)} disabled={!editable} />
        </div>
      </section>

      {editable && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="submit" loading={saving} leftIcon={<Save className="h-4 w-4"/>}>Save</Button>
          <Button type="button" variant="accent" loading={submitting} onClick={submit} leftIcon={<Send className="h-4 w-4" />}>Submit for review</Button>
        </div>
      )}

      {/* Sub-initiated "request changes" panel. Visible always - it's
          especially useful when the form is locked (the sub can't
          edit, so they ask the office to unlock or to fix something
          on their behalf). Posts to /me/change-requests which already
          notifies all admins. */}
      <section className="card-padded">
        <h2 className="text-base font-semibold text-ink-900 mb-1 inline-flex items-center gap-2">
          <MessageSquarePlus className="h-4 w-4 text-ink-500" />
          Request changes from the office
        </h2>
        <p className="text-sm text-ink-500 mb-4">
          Need to update a locked field, fix a typo, or flag something the office needs to know? Send a quick note and BC will get back to you.
        </p>
        <Textarea
          label=""
          rows={3}
          placeholder="e.g. My address changed - new address is..."
          value={crMessage}
          onChange={(e) => setCrMessage(e.target.value)}
          maxLength={1000}
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-ink-400">{crMessage.length}/1000</span>
          <Button
            type="button"
            variant="accent"
            onClick={submitChangeRequest}
            loading={crBusy}
            disabled={crMessage.trim().length < 4}
            leftIcon={<Send className="h-4 w-4" />}
          >
            Send request
          </Button>
        </div>

        {changeReqs.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">Your recent requests</h3>
            <div className="divide-y divide-ink-100 border border-ink-100 rounded-md">
              {changeReqs.slice(0, 5).map((cr) => (
                <div key={cr.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-ink-800 line-clamp-2">{cr.message}</div>
                    <div className="text-[11px] text-ink-400 mt-1 inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtDateTime(cr.createdAt)}
                    </div>
                  </div>
                  <Badge tone={cr.status === "closed" ? "success" : cr.status === "seen" ? "info" : "warn"}>
                    {cr.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </form>
  );
}
