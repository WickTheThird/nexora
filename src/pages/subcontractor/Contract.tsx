import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { ContractRecord } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { PageHeader } from "@/components/layout/PortalShell";
import { SignaturePad } from "@/components/ui/SignaturePad";
import { fmtDateTime } from "@/lib/format";
import { FileText, CheckCircle2, PenLine, ArrowLeft } from "lucide-react";

export function Contract() {
  const toast = useToast();
  // When mounted at /app/contracts/:id we load that specific contract.
  // When mounted at the legacy /app/contract we fall back to the latest.
  const { id } = useParams<{ id?: string }>();
  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedName, setSignedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signaturePng, setSignaturePng] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [notAvailable, setNotAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = id ? await api.getMyContractById(id) : await api.getMyContract();
        setContract(c);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) setNotAvailable(true);
        else toast.error(e instanceof ApiError ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canSign =
    agreed && signedName.trim().length >= 2 && !!signaturePng;

  const sign = async () => {
    if (!canSign) return;
    setSigning(true);
    try {
      const updated = await api.signMyContract(signedName.trim(), signaturePng || undefined);
      setContract(updated);
      toast.success("Contract signed");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to sign");
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-1/3" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  if (notAvailable || !contract) {
    return (
      <>
        <PageHeader title="Contract" description="Review and sign your subcontractor agreement." />
        <Empty
          icon={FileText}
          title="No contract yet"
          description="Your contract will be generated after your application is submitted and reviewed. We'll notify you when it's ready."
        />
      </>
    );
  }

  const signed = contract.status === "signed";

  return (
    <>
      {/* When loaded via /app/contracts/:id we surface a back link to
          the list. Hidden on the legacy /app/contract route. */}
      {id && (
        <Link
          to="/app/contracts"
          className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900 mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Back to all contracts
        </Link>
      )}
      <PageHeader
        title="Contract"
        description="Review and sign your subcontractor agreement."
        right={
          signed ? (
            <Badge tone="success" icon={<CheckCircle2 className="h-3 w-3" />}>Signed</Badge>
          ) : (
            <Badge tone="info">Awaiting signature</Badge>
          )
        }
      />

      <div className="card overflow-hidden">
        <div
          className="p-8 max-h-[70vh] overflow-y-auto prose prose-ink prose-sm max-w-none bg-white"
          // Template-rendered HTML already escapes user-supplied values
          dangerouslySetInnerHTML={{ __html: contract.renderedHtml }}
        />
        <div className="border-t border-ink-100 bg-ink-50/50 p-6">
          {signed ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-ink-900">
                    Signed by {contract.signedName}
                  </div>
                  <div className="text-sm text-ink-500">
                    {fmtDateTime(contract.signedAt)} · IP {contract.signedIp}
                  </div>
                </div>
              </div>
              {contract.signaturePng && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-ink-400 font-semibold mb-2">Signature</div>
                  <img
                    src={contract.signaturePng}
                    alt="Signature"
                    className="h-24 rounded-md border border-ink-200 bg-white"
                  />
                </div>
              )}
              <div className="text-xs text-ink-400 font-mono break-all">
                Evidence token: {contract.signedToken}
              </div>
            </div>
          ) : (
            <div className="space-y-5 max-w-xl">
              <Input
                label="Type your full name"
                value={signedName}
                onChange={(e) => setSignedName(e.target.value)}
                placeholder="As it appears on your profile"
              />
              <div>
                <div className="label">Draw your signature</div>
                <SignaturePad onChange={setSignaturePng} />
              </div>
              <Checkbox
                label="I have read and agree to the terms of this agreement."
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <Button
                variant="accent"
                onClick={sign}
                loading={signing}
                disabled={!canSign}
                leftIcon={<PenLine className="h-4 w-4" />}
              >
                Sign contract
              </Button>
              <p className="text-xs text-ink-400">
                By signing, your typed name, drawn signature, IP address, and timestamp will be recorded as tamper-evident proof.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
