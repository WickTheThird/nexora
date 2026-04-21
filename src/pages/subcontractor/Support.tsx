import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { ChangeRequest } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/layout/PortalShell";
import { fmtDateTime } from "@/lib/format";
import { MessagesSquare, Send, Download, UserX, ShieldCheck } from "lucide-react";

function statusBadge(s: ChangeRequest["status"]) {
  const tone = {
    open: "warn",
    seen: "info",
    actioned: "info",
    closed: "success",
  }[s] as "warn" | "info" | "success";
  return <Badge tone={tone}>{s}</Badge>;
}

export function Support() {
  const toast = useToast();
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [erasureOpen, setErasureOpen] = useState(false);
  const [erasureReason, setErasureReason] = useState("");
  const [submittingErasure, setSubmittingErasure] = useState(false);

  const refresh = async () => {
    const r = await api.listMyChangeRequests();
    setItems(r.items);
  };

  useEffect(() => {
    (async () => { try { await refresh(); } finally { setLoading(false); } })();
  }, []);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (msg.trim().length === 0) return;
    setSending(true);
    try {
      await api.postMyChangeRequest(msg.trim());
      setMsg("");
      await refresh();
      toast.success("Request sent. An admin will review it.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const submitErasure = async () => {
    setSubmittingErasure(true);
    try {
      await api.submitErasureRequest(erasureReason.trim() || undefined);
      setErasureOpen(false);
      setErasureReason("");
      await refresh();
      toast.success("Erasure request submitted");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to submit");
    } finally {
      setSubmittingErasure(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Support"
        description="Need changes made to your account? Drop us a note and an admin will respond."
      />

      <div className="grid lg:grid-cols-5 gap-6">
        <form onSubmit={send} className="card-padded lg:col-span-2 space-y-4 h-fit">
          <h2 className="font-semibold text-ink-900">New request</h2>
          <Textarea
            label="Message"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="e.g. Please update my mobile number to +353…"
            rows={6}
            maxLength={4000}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-500">{msg.length}/4000</span>
            <Button
              variant="accent"
              type="submit"
              loading={sending}
              leftIcon={<Send className="h-4 w-4" />}
              disabled={msg.trim().length === 0}
            >
              Send
            </Button>
          </div>
        </form>

        <div className="lg:col-span-3 space-y-3">
          {loading ? (
            <div className="skeleton h-48" />
          ) : items.length === 0 ? (
            <Empty
              icon={MessagesSquare}
              title="No requests yet"
              description="Your previous support messages will appear here."
            />
          ) : (
            items.map((cr) => (
              <div key={cr.id} className="card p-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-sm text-ink-500">{fmtDateTime(cr.createdAt)}</div>
                  {statusBadge(cr.status)}
                </div>
                <p className="text-sm text-ink-800 whitespace-pre-wrap">{cr.message}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <section className="mt-10 card-padded">
        <div className="flex items-start gap-3 mb-5">
          <div className="h-9 w-9 rounded-lg bg-ink-100 text-ink-700 grid place-items-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-ink-900">Your data rights</h2>
            <p className="text-sm text-ink-500 mt-0.5">
              Under GDPR you can export a copy of your data or ask us to erase it.
              See the{" "}
              <a href="#/legal/privacy" className="underline hover:text-ink-800">privacy notice</a>{" "}
              for the full details.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <a
            href={api.exportMyDataUrl()}
            className="card p-5 border border-ink-100 hover:border-ink-300 transition block"
          >
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-ink-700 mt-0.5" />
              <div>
                <div className="font-medium text-ink-900">Export my data</div>
                <p className="text-sm text-ink-500 mt-1">
                  Download a JSON copy of everything we hold on you,
                  including payments, documents, contracts and audit history.
                </p>
              </div>
            </div>
          </a>

          <button
            type="button"
            onClick={() => setErasureOpen(true)}
            className="card p-5 border border-ink-100 hover:border-red-300 transition text-left"
          >
            <div className="flex items-start gap-3">
              <UserX className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <div className="font-medium text-ink-900">Request account erasure</div>
                <p className="text-sm text-ink-500 mt-1">
                  We'll delete what we can immediately. Records we are legally required to keep
                  (payments, signed contracts) will be anonymised.
                </p>
              </div>
            </div>
          </button>
        </div>
      </section>

      <Modal
        open={erasureOpen}
        onClose={() => setErasureOpen(false)}
        title="Request account erasure"
        description="Under Article 17 of the UK/EU GDPR."
        footer={
          <>
            <Button variant="ghost" onClick={() => setErasureOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={submitErasure} loading={submittingErasure}>
              Submit erasure request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-700">
            An administrator will process your request. Once actioned:
          </p>
          <ul className="text-sm text-ink-700 list-disc pl-5 space-y-1">
            <li>Your identity and contact details will be removed from our records.</li>
            <li>Your compliance documents will be deleted from storage.</li>
            <li>Your bank details will be cleared.</li>
            <li>You will be logged out and your account disabled.</li>
            <li>Signed contracts and the payment ledger will be retained in anonymised form for tax and contract law.</li>
          </ul>
          <Textarea
            label="Reason (optional)"
            value={erasureReason}
            onChange={(e) => setErasureReason(e.target.value)}
            rows={3}
            maxLength={4000}
          />
        </div>
      </Modal>
    </>
  );
}
