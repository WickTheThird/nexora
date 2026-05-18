import { useEffect, useState } from "react";

// Sub-portal-only footer. Matches Enagh's layout: ROI/NI phones,
// support email, copyright. Pulled from /public/branding (open
// endpoint that exposes BC's contact info read-only).

interface Branding {
  contractorName: string;
  contractorEmail: string | null;
  phoneRoi: string | null;
  phoneNi: string | null;
}

const API_URL = (window as { __SAMWISE_CONFIG__?: { apiUrl?: string } }).__SAMWISE_CONFIG__?.apiUrl
  || "https://nexora-api.bumbufilip22.workers.dev";

export function SubPortalFooter() {
  const [b, setB] = useState<Branding | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/public/branding`)
      .then((r) => r.json())
      .then((j) => setB(j.data || j))
      .catch(() => null);
  }, []);

  if (!b) return null;

  const phoneBits: string[] = [];
  if (b.phoneRoi) phoneBits.push(`ROI: ${b.phoneRoi}`);
  if (b.phoneNi) phoneBits.push(`NI: ${b.phoneNi}`);

  return (
    <footer className="mt-12 pt-6 pb-20 lg:pb-6 border-t border-ink-100 text-center text-xs text-ink-500">
      {phoneBits.length > 0 && (
        <div className="mb-1 font-medium text-ink-700">{phoneBits.join("  |  ")}</div>
      )}
      {b.contractorEmail && (
        <div className="mb-1">
          Email: <a href={`mailto:${b.contractorEmail}`} className="text-ink-700 hover:text-ink-900 underline">{b.contractorEmail}</a>
        </div>
      )}
      <div className="text-ink-400">
        © {new Date().getFullYear()} {b.contractorName}, All Rights Reserved
      </div>
    </footer>
  );
}
