import { Link } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";
import { ArrowLeft } from "lucide-react";

export const PRIVACY_VERSION = "1.0";

export function PrivacyPolicy({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {showHeader && (
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>
      )}

      <article className="prose prose-ink max-w-none">
        <h1 className="text-3xl font-bold text-ink-900 tracking-tight">
          Privacy Notice
        </h1>
        <p className="text-sm text-ink-500">
          Version {PRIVACY_VERSION}. Last updated 21 April 2026. Issued under
          the Irish Data Protection Act 2018 and Regulation (EU) 2016/679 (GDPR).
        </p>

        <h2>1. Who we are</h2>
        <p>
          This portal ("Nexora") is operated by the contractor business that
          engages you as a subcontractor (the "Controller" / "Principal Contractor").
          Any reference to "we", "us", or "our" means the Controller. For
          questions relating to the processing of your personal data, you may
          contact the Controller at the email address provided to you on
          onboarding.
        </p>
        <p className="rounded-lg bg-ink-100 border border-ink-200 p-3 text-sm not-prose">
          <strong>Disclaimer.</strong> Nexora is not affiliated with, endorsed by,
          or operated on behalf of the Revenue Commissioners or any other
          government agency. Nexora is a record-keeping and onboarding tool used
          by the Principal Contractor; the Principal Contractor remains solely
          responsible for compliance with the Relevant Contracts Tax (RCT)
          regime, VAT obligations and any other tax filings, and the
          subcontractor remains solely responsible for their own personal tax
          affairs.
        </p>

        <h2>2. What personal data we collect</h2>
        <ul>
          <li><strong>Identity &amp; contact</strong>: full name, date of birth, place of birth, address, email, mobile and landline phone numbers.</li>
          <li><strong>Employment status</strong>: trade, nature of services, VAT registration, self-employment declarations.</li>
          <li><strong>Tax identifiers</strong>: PPS number, VAT number where applicable, and your Revenue-issued RCT deduction rate and authorisation numbers.</li>
          <li><strong>Bank details</strong>: account holder name, account number, sort code, IBAN, BIC, currency and bank reference.</li>
          <li><strong>Compliance documents</strong>: photographic ID, Safe Pass / Construction Skills Certification Scheme (CSCS) card, insurance certificates and other uploads you provide.</li>
          <li><strong>Contract records</strong>: rendered agreement text, your typed signature name, your drawn signature image, IP address and timestamp at signing, and a tamper-evidence hash.</li>
          <li><strong>Payment ledger</strong>: gross amounts, RCT deductions, net amounts, authorisation numbers, hours worked, pay periods, remittance PDFs and references.</li>
          <li><strong>Account &amp; security</strong>: email, hashed password, session identifiers, IP address and user agent of each login, and an audit trail of actions taken on your record.</li>
        </ul>

        <h2>3. Why we process it and our lawful basis</h2>
        <table>
          <thead><tr><th>Purpose</th><th>Lawful basis (GDPR Art. 6)</th></tr></thead>
          <tbody>
            <tr>
              <td>Engaging you as a subcontractor and paying you</td>
              <td>Contract (Art. 6(1)(b))</td>
            </tr>
            <tr>
              <td>Complying with the Relevant Contracts Tax (RCT) regime, VAT reverse charge, and any Revenue reporting obligations under the Taxes Consolidation Act 1997</td>
              <td>Legal obligation (Art. 6(1)(c))</td>
            </tr>
            <tr>
              <td>Verifying identity, right-to-work and health &amp; safety qualifications (Safety, Health and Welfare at Work Act 2005)</td>
              <td>Legal obligation (Art. 6(1)(c)) and legitimate interests (Art. 6(1)(f))</td>
            </tr>
            <tr>
              <td>Security of the portal (rate limiting, encryption, audit logging)</td>
              <td>Legitimate interests (Art. 6(1)(f))</td>
            </tr>
            <tr>
              <td>Handling your change requests and correspondence</td>
              <td>Contract (Art. 6(1)(b))</td>
            </tr>
          </tbody>
        </table>

        <h2>4. How we protect your data</h2>
        <ul>
          <li>All traffic is served over HTTPS.</li>
          <li>Passwords are stored as salted hashes (PBKDF2 with per-user salt).</li>
          <li>Sensitive fields (PPS number, RCT authorisation number, bank account number, sort code and IBAN) are encrypted at rest with AES-GCM.</li>
          <li>Session cookies are <code>HttpOnly</code>, <code>Secure</code>, and scoped to this service.</li>
          <li>Every administrator action on your record is logged in an immutable audit trail.</li>
        </ul>

        <h2>5. Who we share it with</h2>
        <p>We only share your personal data with:</p>
        <ul>
          <li>The Revenue Commissioners, where legally required — in particular to notify contracts and payments via the eRCT system and to make VAT and payroll returns.</li>
          <li>Our processors: Cloudflare Inc. (hosting, storage and network protection for this portal). Cloudflare processes personal data on our instructions under a data processing agreement.</li>
          <li>Professional advisors (accountants, auditors, legal counsel) where necessary and under confidentiality.</li>
        </ul>
        <p>
          We do not sell your personal data and we do not use it for profiling
          or automated decision making.
        </p>

        <h2>6. How long we keep it</h2>
        <ul>
          <li><strong>Identity, contact and compliance documents</strong>: for the duration of your engagement plus a reasonable grace period, and then deleted on request.</li>
          <li><strong>Signed contracts</strong>: retained for at least six years after the end of the relationship (limitation period for contract disputes under the Statute of Limitations 1957).</li>
          <li><strong>Tax and payment records (RCT / VAT / payroll)</strong>: retained for at least six years, as required by the Revenue Commissioners.</li>
          <li><strong>Audit logs</strong>: retained alongside related records for the duration of those records.</li>
        </ul>

        <h2>7. Your rights</h2>
        <p>Under the GDPR and the Irish Data Protection Act 2018 you have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you (Article 15). You can export a machine-readable copy of your entire record from your portal's <em>Support</em> page at any time.</li>
          <li>Have inaccurate data corrected (Article 16). You can update your profile directly while your application is unlocked, or request correction via <em>Support</em>.</li>
          <li>Request erasure (Article 17). You can file an erasure request from the <em>Support</em> page. We will erase what we can immediately and anonymise records we are legally required to retain.</li>
          <li>Restrict or object to processing (Articles 18 and 21).</li>
          <li>Portability of the data you provided to us (Article 20).</li>
          <li>Withdraw any consent you previously gave, without affecting prior lawful processing.</li>
          <li>Lodge a complaint with the <strong>Data Protection Commission</strong> (<a href="https://www.dataprotection.ie" target="_blank" rel="noopener noreferrer">dataprotection.ie</a>), 21 Fitzwilliam Square South, Dublin 2, D02 RD28.</li>
        </ul>

        <h2>8. International transfers</h2>
        <p>
          Our hosting provider operates a global network. Where data is
          transferred outside the European Economic Area, it is protected by
          appropriate safeguards (EU Standard Contractual Clauses).
        </p>

        <h2>9. Cookies</h2>
        <p>
          This portal uses a single, strictly-necessary authentication cookie
          (<code>nx_session</code>) to keep you signed in. No tracking,
          advertising or analytics cookies are set. Under the European
          Communities (Electronic Communications Networks and Services)
          (Privacy and Electronic Communications) Regulations 2011 (S.I. 336/2011),
          strictly-necessary cookies do not require consent, but we disclose
          their use here in the interests of transparency.
        </p>

        <h2>10. Governing law</h2>
        <p>
          This notice is governed by Irish law. Any dispute relating to the
          processing of your personal data will be handled under the
          jurisdiction of the Irish courts or the Data Protection Commission.
        </p>

        <h2>11. Changes to this notice</h2>
        <p>
          If we make material changes to this notice we will increment the
          version number and ask you to review and accept the new version on
          your next sign-in.
        </p>
      </article>
    </div>
  );
}
