import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Input";
import { PrivacyPolicy, PRIVACY_VERSION } from "./Privacy";
import { ShieldCheck } from "lucide-react";

export function ConsentGate() {
  const { me, refresh } = useAuth();
  const nav = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (!agreed) return;
    setSaving(true);
    setError(null);
    try {
      await api.acceptPrivacy(PRIVACY_VERSION);
      await refresh();
      nav(me?.role === "admin" ? "/admin" : "/app");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to record consent");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-ink-50">
      <header className="sticky top-0 z-10 bg-white border-b border-ink-100 px-6 py-3 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-ink-900" />
        <div className="flex-1">
          <div className="font-semibold text-ink-900 text-sm">Before you continue</div>
          <div className="text-xs text-ink-500">
            Please review and accept the privacy notice. It explains what data we process, why, and your rights.
          </div>
        </div>
      </header>

      <PrivacyPolicy showHeader={false} />

      <div className="sticky bottom-0 bg-white border-t border-ink-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <Checkbox
            label="I have read and accept the privacy notice above."
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <div className="flex items-center gap-3">
            {error && <span className="text-sm text-red-600">{error}</span>}
            <Button
              variant="accent"
              disabled={!agreed}
              loading={saving}
              onClick={accept}
            >
              Accept and continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
