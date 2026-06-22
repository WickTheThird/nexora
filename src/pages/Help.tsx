// User-facing documentation page. Role-aware: when signed in, only the
// relevant section is shown by default with a small note that the
// others exist. When logged out (or accessed from the marketing site),
// all three roles are listed so prospects can see the whole flow before
// signing up.
//
// Reachable from /help and from a small link in every portal shell.

import { Link } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { useAuth } from "@/lib/auth";
import {
  Building2, Hammer, ShieldCheck, ArrowRight, ArrowLeft, Eye, EyeOff,
} from "lucide-react";
import { useState } from "react";

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-xl font-bold text-ink-900">{title}</h2>
      <div className="space-y-3 text-ink-700 leading-relaxed">{children}</div>
    </section>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="h-8 w-8 rounded-full bg-ink-900 text-white text-sm font-bold grid place-items-center shrink-0">{n}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-ink-900">{title}</div>
        <div className="text-sm text-ink-600 mt-0.5">{body}</div>
      </div>
    </div>
  );
}

export function Help() {
  const { me } = useAuth();
  // When signed in, default to the user's own role section. The
  // toggle still lets them peek at the others (handy for admins).
  const [showAll, setShowAll] = useState(!me);

  const showSub = showAll || !me || me.role === "subcontractor";
  const showPrimary = showAll || !me || me.role === "primary";
  const showAdmin = showAll || !me || me.role === "admin";

  const backHref = me ? (me.role === "admin" ? "/admin" : me.role === "primary" ? "/primary" : "/app") : "/login";
  const backLabel = me ? "Back to portal" : "Back to sign in";

  return (
    <div className="min-h-screen bg-ink-50">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8 flex items-center justify-between gap-3 flex-wrap">
          <Logo />
          <div className="flex items-center gap-3">
            <LocaleSwitcher size="sm" />
            <Link to={backHref} className="text-sm text-ink-700 hover:text-ink-900 inline-flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> {backLabel}
            </Link>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-ink-900 mb-2">How Fintrex Contractors works</h1>
        <p className="text-ink-600 mb-6">
          A 3-tier portal connecting BC Construction (admin), Principal contractors, and Subcontractors.
        </p>

        {/* Role banner + show-all toggle (only when signed in). */}
        {me && (
          <div className="card-padded mb-8 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-ink-700">
              You're signed in as{" "}
              <strong className="text-ink-900">
                {me.role === "subcontractor" ? "Subcontractor" : me.role === "primary" ? "Principal" : "Admin (BC)"}
              </strong>
              . The sections below match your role.
            </div>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-xs text-ink-600 hover:text-ink-900 inline-flex items-center gap-1 border border-ink-200 rounded-md px-2 py-1"
            >
              {showAll ? <><EyeOff className="h-3.5 w-3.5" /> Hide other roles</> : <><Eye className="h-3.5 w-3.5" /> Show all roles</>}
            </button>
          </div>
        )}

        {/* Table of contents (always visible). */}
        <nav aria-label="Table of contents" className="card-padded mb-10">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Jump to</div>
          <ul className="space-y-1 text-sm">
            <li><a href="#overview" className="text-ink-700 hover:text-ink-900 hover:underline">The 3-tier model</a></li>
            {showSub && (
              <li><a href="#sub" className="text-ink-700 hover:text-ink-900 hover:underline inline-flex items-center gap-1"><Hammer className="h-3.5 w-3.5" /> Subcontractors</a></li>
            )}
            {showPrimary && (
              <li><a href="#primary" className="text-ink-700 hover:text-ink-900 hover:underline inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Principals</a></li>
            )}
            {showAdmin && (
              <li><a href="#admin" className="text-ink-700 hover:text-ink-900 hover:underline inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Admin (BC)</a></li>
            )}
            <li><a href="#shortcuts" className="text-ink-700 hover:text-ink-900 hover:underline">Keyboard shortcuts</a></li>
            <li><a href="#tax" className="text-ink-700 hover:text-ink-900 hover:underline">Irish tax (RCT + VAT)</a></li>
          </ul>
        </nav>

        <div className="space-y-12">
          <Section id="overview" title="The 3-tier model">
            <p>Three kinds of accounts use the portal, each with their own login + workspace:</p>
            <ul className="space-y-2 list-disc pl-5">
              <li><strong>Subcontractor</strong> (operative) - the person doing the work on site. They get paid by BC.</li>
              <li><strong>Principal</strong> (developer / main contractor) - the company that hires BC to manage operatives. They pay BC monthly.</li>
              <li><strong>Admin</strong> (BC Construction) - the back office that processes Job Cards, issues advices, and reconciles with Revenue.</li>
            </ul>
            <p>Money flows: <strong>Principal → BC → Subcontractor</strong>. Job Cards flow up; payment advices flow down.</p>
          </Section>

          {showSub && (
            <Section id="sub" title="Subcontractor flow">
              <p className="font-medium text-ink-800">When you first sign up:</p>
              <Step n={1} title="Apply via /signup/subcontractor" body="Self-serve signup with your name, email, mobile and trade. BC reviews + approves." />
              <Step n={2} title="Receive welcome email with temp password" body="Sign in. You'll be prompted to set a real password on first sign-in." />
              <Step n={3} title="Complete your profile" body="My Details: full address, DOB, PPSN. Bank Details: IBAN + BIC. Until BC approves your profile + bank, you can't be paid." />
              <Step n={4} title="Upload your documents" body="Photographic ID, Safe Pass card, CSCS, Manual Handling, etc. Each is reviewed by an admin." />
              <Step n={5} title="Fill the questionnaire" body="Compliance declarations - confirms you understand you're self-employed under RCT." />
              <Step n={6} title="Sign your contract" body="Once your profile is reviewed and approved, BC generates a contract. You read and sign it digitally." />
              <p className="font-medium text-ink-800 pt-4">Once active:</p>
              <ul className="space-y-2 list-disc pl-5">
                <li>Your principal submits a Job Card with your hours each week.</li>
                <li>BC processes it and creates a <strong>Payment Advice</strong> for you (visible on /app/payments).</li>
                <li>You click <strong>Generate Invoice</strong> on the advice - that's the legal billing document.</li>
                <li>BC pays you. Status flips to Paid.</li>
                <li>At year-end you can download an <strong>RCT summary (Form 11)</strong> for your own self-assessment return.</li>
              </ul>
            </Section>
          )}

          {showPrimary && (
            <Section id="primary" title="Principal flow">
              <p className="font-medium text-ink-800">Setup:</p>
              <Step n={1} title="Apply via /signup/primary" body="Self-serve signup with your company name, VAT number, and contact. BC reviews + approves." />
              <Step n={2} title="Add your Site IDs (Revenue SIN codes)" body="Every site/project you run needs its Revenue-issued SIN. Add them on /primary/site-ids before submitting any Job Card." />
              <Step n={3} title="Accept the operatives BC proposes" body="When BC adds an operative under your account, you'll see them in 'BC proposed' on your Subcontractors page. Accept or decline." />
              <p className="font-medium text-ink-800 pt-4">Submitting a weekly Job Card:</p>
              <Step n={1} title="New Job Card" body="From the home dashboard or /primary/submissions/new. Pick the period type (weekly / fortnightly / monthly) and date ending." />
              <Step n={2} title="Fill hours per operative" body="Every active operative auto-listed. Type Qty, pick Site (or quick-fill all rows with one site), let the rate auto-populate from the operative's standard rate." />
              <Step n={3} title="Save / Calculate / Submit" body="Save keeps it as a draft. Calculate refreshes the totals. Submit locks the Job Card and emails BC." />
              <Step n={4} title="BC processes" body="You'll get a notification when BC has issued advices. An invoice for the principal-side fee is auto-generated." />
              <p className="font-medium text-ink-800 pt-4">Other day-to-day:</p>
              <ul className="space-y-2 list-disc pl-5">
                <li><strong>Request a new operative</strong> - Subcontractors page, top-right. BC approves and they're added under your account.</li>
                <li><strong>Edit standard rate</strong> - pencil icon on each row of the Active list. Changes take effect on the next Job Card.</li>
                <li><strong>Mark in-active</strong> - when an operative leaves your site. Closed bucket; reactivate later if they return.</li>
                <li><strong>View / Print Contract</strong> - on your Account page.</li>
                <li><strong>Changes Request</strong> - top-right of home, opens a mailto: to BC.</li>
              </ul>
            </Section>
          )}

          {showAdmin && (
            <Section id="admin" title="Admin flow (BC Construction)">
              <p>Admin is the operations hub. Every admin page has its own ? button in the top-right with page-specific help. The high-level inbox flow:</p>
              <ul className="space-y-2 list-disc pl-5">
                <li><strong>Recent Activity</strong> - review self-serve signups; approve creates the account + sends welcome email.</li>
                <li><strong>Subcontractor requests</strong> - principals asking to add new operatives. Approve creates the user.</li>
                <li><strong>Subcontractors</strong> - review profiles, approve onboarding, generate contracts, manage RCT rates. Buckets: All / Current / Active / Archive.</li>
                <li><strong>Principals</strong> - manage principal accounts. Invite primary users, issue invoices, manage site IDs.</li>
                <li><strong>Submissions</strong> - Job Cards from principals. Process to spawn payment advices for matched operatives and auto-generate the principal-side invoice.</li>
                <li><strong>Advice</strong> - Kanban (Open → Previewed → Sent → Paid) of payment advices. Per-card or bulk send/mark-paid. Also CSV import + from-timesheets flow.</li>
                <li><strong>Change requests</strong> - Kanban (Open → Seen → Closed) of inbound change requests from subs and principals. Drag cards to move.</li>
                <li><strong>Templates</strong> - WYSIWYG contract templates. Send per-template to a multi-select of subs.</li>
                <li><strong>Actions</strong> - cross-action bulk runner. Compose audience + filters + action chain to run e.g. "approve all submitted subs for principal X". Includes a Payments audience for bulk mark-paid.</li>
                <li><strong>Settings</strong> - VAT rate, admin fees, invoice template, "Latest News" panel content, Changes Request email target.</li>
              </ul>
            </Section>
          )}

          {/* SHORTCUTS */}
          <Section id="shortcuts" title="Keyboard shortcuts">
            <p>Designed for Excel-fluent users. Same patterns as VS Code, Slack, Spotlight.</p>
            <ul className="space-y-2 list-disc pl-5">
              <li><kbd className="font-mono bg-ink-100 px-2 py-0.5 rounded text-xs">⌘K</kbd> / <kbd className="font-mono bg-ink-100 px-2 py-0.5 rounded text-xs">Ctrl+K</kbd> - opens Quick Search. Find anyone (operative, principal, site) by typing a few letters.</li>
              <li><kbd className="font-mono bg-ink-100 px-2 py-0.5 rounded text-xs">↑</kbd> / <kbd className="font-mono bg-ink-100 px-2 py-0.5 rounded text-xs">↓</kbd> - navigate results in any picker.</li>
              <li><kbd className="font-mono bg-ink-100 px-2 py-0.5 rounded text-xs">Enter</kbd> - open the highlighted item.</li>
              <li><kbd className="font-mono bg-ink-100 px-2 py-0.5 rounded text-xs">Esc</kbd> - close any dialog or picker.</li>
            </ul>
          </Section>

          {/* TAX */}
          <Section id="tax" title="Irish tax (RCT + VAT) in plain English">
            <p>Construction services in Ireland are subject to two regimes that interact:</p>
            <p><strong>RCT (Relevant Contracts Tax)</strong> - Revenue assigns each subcontractor a rate (0%, 20% or 35%) based on their compliance history. Before each payment, the principal contractor (BC, in this case) submits a Payment Notification to ROS and Revenue returns an RCTDA (Authorisation) telling BC how much to withhold. The withheld amount goes to Revenue; the rest goes to the operative.</p>
            <p><strong>VAT reverse-charge</strong> - On RCT-eligible work, the operative invoices BC <em>without</em> VAT. BC self-accounts for the 13.5% in their VAT3 return. Every payment advice and operative invoice we generate carries Revenue's mandated wording: <em>&ldquo;VAT on this supply to be accounted for by the Principal Contractor.&rdquo;</em></p>
            <p><strong>Form 11</strong> - Operatives file an annual self-assessment to reclaim withheld RCT against their final tax bill. The portal generates a year-end RCT summary they can attach.</p>
          </Section>

          <div className="pt-6 mt-12 border-t border-ink-200">
            <p className="text-sm text-ink-500">
              Need help with something specific? Email{" "}
              <a href="mailto:hello@bc-construction.ie" className="underline hover:text-ink-800">hello@bc-construction.ie</a>{" "}
              or call <span className="font-medium">+353 1 9697857</span>.
            </p>
            <p className="text-xs text-ink-400 mt-2">
              <Link to="/legal/contract" className="underline">Contract for Services</Link> · <Link to="/legal/privacy" className="underline">Privacy notice</Link> · <Link to="/legal/terms" className="underline">Terms of service</Link>
            </p>
            <Link to={backHref} className="inline-flex items-center gap-1 text-sm text-ink-700 hover:text-ink-900 mt-4">
              {backLabel} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
