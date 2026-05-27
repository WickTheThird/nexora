import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import {
  contractSections,
  recitals,
  legallyBindingBanner,
  acceptanceClause,
  type Locale,
} from "@/lib/contractTemplate";
import { ArrowLeft, Printer, FileText, Info } from "lucide-react";

// Public, no-auth route. Renders the Contract for Services as a
// polished legal document. Pulls BC's contractor identity from the
// /public/branding endpoint (read-only subset of app_settings).
//
// Bilingual: the active i18n locale picks which copy renders. The EN
// text is the legally binding version; when the user is on RO we
// show a courtesy translation + a banner at the top making clear
// the EN version prevails in any dispute.

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
  const { t, i18n } = useTranslation();
  const [branding, setBranding] = useState<Branding | null>(null);
  // Normalise the i18next language down to our supported locale set.
  // anything that isn't "ro" falls back to "en".
  const locale: Locale = i18n.language?.slice(0, 2) === "ro" ? "ro" : "en";

  // Scroll-to-read tracking (moved from Questionnaire 2026-05-27 per
  // user request - it belongs on the contract terms, not on yes/no
  // answers). When the sub reaches the bottom of the document we
  // flip a green "Read" badge in the top utility bar so they have a
  // clear visual confirmation. Non-blocking - we don't gate any
  // action; just visible acknowledgement.
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  useEffect(() => {
    const check = () => {
      const el = document.scrollingElement || document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0 || el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
        setScrolledToBottom(true);
        window.removeEventListener("scroll", check);
      }
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);

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
  }, locale);

  // Locale-driven sources. These swap when the user clicks the EN/RO
  // toggle - useTranslation triggers a re-render on language change.
  const sections = contractSections(locale);
  const recitalRows = recitals(locale);
  const bindingBanner = legallyBindingBanner(locale);

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
            {/* Read-status pill - flips green once the reader has
                scrolled to the bottom of the contract. Non-blocking;
                just an acknowledgement that they've seen the terms. */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider border ${
                scrolledToBottom
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-ink-50 border-ink-200 text-ink-500"
              }`}
              title={scrolledToBottom ? "You've read the contract" : "Scroll to the bottom to mark as read"}
            >
              {scrolledToBottom ? "✓ Read" : "Scroll to read"}
            </span>
            <LocaleSwitcher size="sm" />
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-sm text-ink-700 hover:text-ink-900 px-3 py-1.5 rounded-md border border-ink-200 hover:border-ink-300"
            >
              <Printer className="h-4 w-4" />
              {t("legalContract.print")}
            </button>
          </div>
        </div>
      </div>

      {/* RO-only courtesy translation disclaimer. Renders ABOVE the
          document body so the reader can't miss that EN is binding. */}
      {locale === "ro" && (
        <div className="max-w-3xl mx-auto px-8 pt-6 print:hidden">
          <div className="rounded-md bg-sky-50 border border-sky-200 px-4 py-3 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-sky-700 mt-0.5 shrink-0" />
            <div className="text-sm text-sky-900">
              <span className="font-semibold uppercase text-[11px] tracking-wider mr-2">
                {t("legalContract.courtesyTranslationLabel")}
              </span>
              {t("legalContract.courtesyTranslation")}
            </div>
          </div>
        </div>
      )}

      {/* The document itself */}
      <article
        className="contract-document max-w-3xl mx-auto px-8 py-12 bg-white shadow-sm print:shadow-none print:max-w-none print:px-0 print:py-0"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {/* Header */}
        <header className="border-b border-ink-200 pb-5 mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 uppercase">
            {t("legalContract.title")}
          </h1>
          <p className="text-sm text-ink-600 mt-1.5 italic">{t("legalContract.subtitle")}</p>
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
            {t("legalContract.subcontractorPlaceholder")}
            <br />
            <span className="text-sm">
              {t("legalContract.subcontractorBody")}
            </span>
          </p>
        </section>

        {/* Acceptance call-out */}
        <section className="rounded-md bg-amber-50 border border-amber-200 px-5 py-4 mb-8 text-[14px] leading-6">
          <div className="font-semibold text-amber-900 mb-1">{t("legalContract.acceptanceHeading")}</div>
          <p className="text-amber-900">{clause}</p>
        </section>

        {/* Recitals */}
        <section className="mb-8">
          <h2 className="text-base font-bold uppercase tracking-wider text-ink-900 mb-3">
            {t("legalContract.agreedTerms")}
          </h2>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-700 mb-3">
            {t("legalContract.recitals")}
          </h3>
          <ol className="space-y-3 text-[15px] leading-7 text-ink-900">
            {recitalRows.map((r) => (
              <li key={r.letter} className="flex gap-3">
                <span className="font-bold w-5 shrink-0">{r.letter}.</span>
                <span>{r.text}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Sections */}
        {sections.map((s) => (
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
            {t("legalContract.legallyBindingHeading")}
          </h3>
          <p className="text-[14px] leading-6 text-ink-800">{bindingBanner}</p>
        </section>

        {/* Signature footer */}
        <section className="grid grid-cols-2 gap-8 mt-12 text-[14px] leading-6 text-ink-900">
          <div>
            <div className="font-semibold mb-2">{t("legalContract.forContractor")}</div>
            <div className="border-t border-ink-300 pt-2 mt-10">
              {/* Generic "Authorised Signatory" instead of a specific
                  director name. The page is a public reference set of
                  terms (paid-acceptance model). */}
              <div className="font-semibold">{branding.contractorName}</div>
              <div className="text-xs text-ink-500 mt-1">{t("legalContract.authorisedSignatory")}</div>
            </div>
          </div>
          <div>
            <div className="font-semibold mb-2">{t("legalContract.forSubcontractor")}</div>
            <div className="border-t border-ink-300 pt-2 mt-10">
              <div className="italic text-ink-500">
                {t("legalContract.acceptanceRecorded")}
              </div>
            </div>
          </div>
        </section>
      </article>

      {/* Page footer */}
      <footer className="max-w-3xl mx-auto px-6 py-6 text-center text-xs text-ink-500 print:hidden">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <FileText className="h-3 w-3" />
          {branding.contractorName} - {t("legalContract.footerLabel")}
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
