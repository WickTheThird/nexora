import { Link } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";
import { ArrowLeft } from "lucide-react";

export const TERMS_VERSION = "1.0";

export function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </div>

      <article className="prose prose-ink max-w-none">
        <h1 className="text-3xl font-bold text-ink-900 tracking-tight">
          Terms of Service
        </h1>
        <p className="text-sm text-ink-500">
          Version {TERMS_VERSION}. Last updated 30 April 2026.
        </p>

        <p className="rounded-lg bg-accent-50 border border-accent-200 p-3 text-sm not-prose">
          <strong>This is a template, not legal advice.</strong> Before relying
          on these terms with external users, have them reviewed by a solicitor
          qualified to advise on Irish contract and data protection law.
        </p>

        <h2>1. Definitions</h2>
        <p>
          "Service" means the Samwise portal accessible via a web browser.
          "Operator" means <strong>Samwise Building Contractors Ltd</strong>,
          the company operating the Service. "Principal" means a developer or
          main contractor who hires the Operator and is granted access to
          their own scoped portal. "Subcontractor" means a sole trader engaged
          by the Operator who is granted access to manage their own record.
          "User" means any person granted access to the Service in any of
          these roles.
        </p>

        <h2>2. Acceptance of these Terms</h2>
        <p>
          By signing in to the Service you confirm that you have read,
          understood and agree to be bound by these Terms, the{" "}
          <Link to="/legal/privacy" className="underline">Privacy Notice</Link>,
          and (where you act as a Subcontractor) the{" "}
          <Link to="/legal/contract" className="underline">Contract for Services</Link>.
          If you do not accept any of these, do not use the Service.
        </p>

        <h2>3. Permitted use</h2>
        <p>You agree to use the Service only for its intended purpose: managing the onboarding, contract, compliance and payment relationship between you and the Operator. You will:</p>
        <ul>
          <li>Provide accurate, current and complete information about yourself.</li>
          <li>Keep your login credentials confidential and notify the Operator promptly of any unauthorised use.</li>
          <li>Use the Service in compliance with all applicable Irish laws including the Data Protection Act 2018 and the Taxes Consolidation Act 1997.</li>
        </ul>

        <h2>4. Prohibited use</h2>
        <p>You will not:</p>
        <ul>
          <li>Attempt to gain unauthorised access to any part of the Service or to other Users' data.</li>
          <li>Upload malware, scripts or content intended to disrupt the Service.</li>
          <li>Reverse-engineer, scrape or attempt to circumvent the Service's security controls.</li>
          <li>Submit fraudulent or misleading information, including in tax-related fields.</li>
        </ul>

        <h2>5. Tax compliance - important</h2>
        <p>
          The Service records information used by the Operator to comply with
          the Relevant Contracts Tax (RCT) regime, VAT obligations and other
          tax filings. <strong>Samwise is not affiliated with, endorsed by, or
          operated on behalf of the Revenue Commissioners.</strong>
        </p>
        <ul>
          <li>The Operator (Principal Contractor) remains solely responsible for the accuracy and timeliness of all submissions to Revenue.</li>
          <li>The User (Subcontractor) remains solely responsible for their own personal tax affairs, returns and any liabilities arising from their engagement.</li>
          <li>Records produced by the Service are reference records only and do not constitute tax advice or replace any official document issued by the Revenue Commissioners.</li>
        </ul>

        <h2>6. No warranty</h2>
        <p>
          The Service is provided on an "as is" and "as available" basis. To
          the maximum extent permitted by Irish law, the Operator disclaims all
          warranties, express or implied, including warranties of
          merchantability, fitness for a particular purpose, and
          non-infringement. The Operator does not warrant that the Service will
          be uninterrupted, error-free or secure.
        </p>

        <h2>7. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by Irish law, neither the Operator
          nor any of its service providers will be liable for any indirect,
          incidental, special, consequential or punitive damages, or any loss
          of profits, revenue, data or goodwill, arising out of or in
          connection with the use of the Service. Nothing in these Terms
          excludes or limits liability for fraud, death or personal injury
          caused by negligence, or any other liability that cannot be excluded
          under Irish law.
        </p>

        <h2>8. Suspension and termination</h2>
        <p>
          The Operator may suspend or terminate your access to the Service if
          you breach these Terms, if continued access poses a security risk, or
          if your engagement with the Operator ends. On termination, your
          access will be revoked and your record handled in accordance with the
          Privacy Notice (including retention of records the Operator is
          legally required to keep).
        </p>

        <h2>9. Changes to these Terms</h2>
        <p>
          The Operator may update these Terms from time to time. Material
          changes will be communicated through the Service and the version
          number above will be incremented. Continued use of the Service after
          such updates constitutes acceptance of the revised Terms.
        </p>

        <h2>10. Governing law</h2>
        <p>
          These Terms are governed by the laws of Ireland. Any dispute arising
          out of or in connection with these Terms will be subject to the
          exclusive jurisdiction of the Irish courts.
        </p>
      </article>
    </div>
  );
}
