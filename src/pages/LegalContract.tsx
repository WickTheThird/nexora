import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import {
  CONTRACT_SECTIONS,
  RECITALS,
  LEGALLY_BINDING_BANNER,
  acceptanceClause,
} from "@/lib/contractTemplate";
import { ArrowLeft, Printer, FileText } from "lucide-react";

// Public, no-auth route. Renders the Contract for Services as a
// polished legal document. Pulls BC's contractor identity from the
// /public/branding endpoint (read-only subset of app_settings).
//
// Anyone can read this page; it's referenced by the acceptance clause
// printed on every payment advice. Accepting payment + this page being
// publicly accessible = implicit agreement to the terms.

interface Branding {
  contractorName: string;
  contractorAddress: string | null;
  contractorRegNumber: string | null;
  contractorSignatoryName: string;
  contractorEmail: string | null;
  phoneRoi: string | null;
  phoneNi: string | null;
  website: string | null;
}

const API_URL = (window as { __SAMWISE_CONFIG__?: { apiUrl?: string } }).__SAMWISE_CONFIG__?.apiUrl
  || "https://nexora-api.bumbufilip22.workers.dev";

export function LegalContract() {
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/public/branding`)
      .then((r) => r.json())
      .then((j) => setBranding(j.data || j))
      .catch(() => setBranding({
        contractorName: "Samwise Building Contractors Ltd",
        contractorAddress: null,
        contractorRegNumber: null,
        contractorSignatoryName: "JP Donnelly",
        contractorEmail: null,
        phoneRoi: null,
        phoneNi: null,
        website: null,
      }));
  }, []);

  if (!branding) {
    return (
      <div className="min-h-screen grid place-items-center bg-white">
        <div className="skeleton h-32 w-64" />
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/#/legal/contract`;
  const clause = acceptanceClause({
    contractorName: branding.contractorName,
    publicUrl: publicUrl.replace(/^https?:\/\//, "").replace(/\/#\//, "/"),
  });

  return (
    <div className="min-h-screen bg-ink-50/30">
      {/* Top utility bar - not part of the legal document, just nav. */}
      <div className="bg-white border-b border-ink-100 print:hidden">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900">
            <ArrowLeft className="h-4 w-4" />
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <LocaleSwitcher size="sm" />
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-sm text-ink-700 hover:text-ink-900 px-3 py-1.5 rounded-md border border-ink-200 hover:border-ink-300"
            >
              <Printer className="h-4 w-4" />
              Print / Save as PDF
            </button>
          </div>
        </div>
      </div>

      {/* The document itself */}
      <article
        className="contract-document max-w-3xl mx-auto px-8 py-12 bg-white shadow-sm print:shadow-none print:max-w-none print:px-0 print:py-0"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {/* Header */}
        <header className="border-b border-ink-200 pb-5 mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 uppercase">
            'Subcontractor' Contract
          </h1>
          <p className="text-sm text-ink-600 mt-1.5 italic">Contract for services</p>
        </header>

        {/* Parties */}
        <section className="mb-8 text-[15px] leading-7 text-ink-900">
          <p className="mb-4">
            1) <strong>{branding.contractorName}</strong>
            {branding.contractorRegNumber && ` (Reg ${branding.contractorRegNumber})`}
            {branding.contractorAddress && (
              <> of; {branding.contractorAddress.replace(/\n/g, ", ")}</>
            )}
            {" "}(the 'Contractor') and;
          </p>
          <p className="mb-4 italic text-ink-700">
            [The Subcontractor]
            <br />
            <span className="text-sm">
              The party engaging with the Contractor for the provision of services, as identified
              on each Payment Advice issued under this contract.
            </span>
          </p>
        </section>

        {/* Acceptance call-out */}
        <section className="rounded-md bg-amber-50 border border-amber-200 px-5 py-4 mb-8 text-[14px] leading-6">
          <div className="font-semibold text-amber-900 mb-1">Acceptance</div>
          <p className="text-amber-900">{clause}</p>
        </section>

        {/* Recitals */}
        <section className="mb-8">
          <h2 className="text-base font-bold uppercase tracking-wider text-ink-900 mb-3">
            Agreed terms
          </h2>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-700 mb-3">
            Recitals
          </h3>
          <ol className="space-y-3 text-[15px] leading-7 text-ink-900">
            {RECITALS.map((r) => (
              <li key={r.letter} className="flex gap-3">
                <span className="font-bold w-5 shrink-0">{r.letter}.</span>
                <span>{r.text}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Sections */}
        {CONTRACT_SECTIONS.map((s) => (
          <section key={s.number} className="mb-8 break-inside-avoid">
            <h3 className="text-base font-bold uppercase tracking-wider text-ink-900 mb-3">
              {s.number}. {s.title}
            </h3>
            <div className="space-y-3 text-[15px] leading-7 text-ink-900">
              {s.paragraphs.map((p, i) => (
                <p key={i} className={p.match(/^\d+\.\d+\.\d+/) ? "pl-6" : ""}>{p}</p>
              ))}
            </div>
          </section>
        ))}

        {/* Legally-binding banner */}
        <section className="border-t-2 border-ink-300 pt-6 mb-8">
          <h3 className="text-base font-bold uppercase tracking-wider text-ink-900 mb-3 text-center">
            This is a legally binding document
          </h3>
          <p className="text-[14px] leading-6 text-ink-800">{LEGALLY_BINDING_BANNER}</p>
        </section>

        {/* Signature footer */}
        <section className="grid grid-cols-2 gap-8 mt-12 text-[14px] leading-6 text-ink-900">
          <div>
            <div className="font-semibold mb-2">For and on Behalf of the Contractor:</div>
            <div className="border-t border-ink-300 pt-2 mt-10">
              <div className="font-semibold">{branding.contractorSignatoryName}</div>
              <div className="text-xs text-ink-500 mt-1">{branding.contractorName}</div>
            </div>
          </div>
          <div>
            <div className="font-semibold mb-2">For and on Behalf of the Subcontractor:</div>
            <div className="border-t border-ink-300 pt-2 mt-10">
              <div className="italic text-ink-500">
                Acceptance recorded via Payment Advice (see Acceptance clause above).
              </div>
            </div>
          </div>
        </section>
      </article>

      {/* Page footer */}
      <footer className="max-w-3xl mx-auto px-6 py-6 text-center text-xs text-ink-500 print:hidden">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <FileText className="h-3 w-3" />
          {branding.contractorName} - Contract for Services
        </div>
        {(branding.phoneRoi || branding.phoneNi) && (
          <div className="mb-1">
            {branding.phoneRoi && `ROI: ${branding.phoneRoi}`}
            {branding.phoneRoi && branding.phoneNi && " | "}
            {branding.phoneNi && `NI: ${branding.phoneNi}`}
          </div>
        )}
        {branding.contractorEmail && (
          <div>
            <a href={`mailto:${branding.contractorEmail}`} className="text-ink-600 hover:text-ink-900">
              {branding.contractorEmail}
            </a>
          </div>
        )}
      </footer>
    </div>
  );
}
