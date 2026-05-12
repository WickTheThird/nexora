// Admin-portal page help copy.
//
// Each export is a React fragment (no <html> shell - the HelpButton
// wraps in a prose div). Keep wording short, action-oriented, and
// match the actual UI labels so admins can map text to buttons.
//
// Style guide for entries:
//   <h3>Section</h3>
//   <p>One-line summary.</p>
//   <ul><li>...</li></ul>
//
// Each page should answer: what am I looking at? what action is each
// row awaiting? what can I do here in bulk vs per-row?

import type { ReactNode } from "react";

const HELP_REGISTRY: Record<string, ReactNode> = {
  // --- Dashboard ---
  dashboard: (
    <>
      <h3>What is this page?</h3>
      <p>
        Live counters across the portal: pending signups, open Job Cards, advised payments,
        open change requests. Click any tile to jump to the relevant inbox.
      </p>
      <h3>Common next steps</h3>
      <ul>
        <li>If <strong>Signup requests</strong> {">"} 0 — review and approve / reject.</li>
        <li>If <strong>Submissions</strong> {">"} 0 — open each Job Card and process it.</li>
        <li>If <strong>Change requests</strong> {">"} 0 — drag cards from Open → Seen → Closed on the kanban.</li>
      </ul>
    </>
  ),

  // --- Subcontractors ---
  subcontractors: (
    <>
      <h3>What is this page?</h3>
      <p>
        Every subcontractor BC works with. Buckets across the top filter by lifecycle stage.
      </p>
      <ul>
        <li><strong>All</strong> — everyone, no filter.</li>
        <li><strong>Current</strong> — invited / in progress / changes requested — actively being onboarded.</li>
        <li><strong>Active</strong> — approved and able to be paid.</li>
        <li><strong>Archive</strong> — rejected or off-boarded.</li>
      </ul>
      <h3>What is each row awaiting?</h3>
      <ul>
        <li><strong>Invited</strong> — waiting for the sub to set their password and start their profile.</li>
        <li><strong>In progress</strong> — sub is filling profile/bank/docs; not yet submitted.</li>
        <li><strong>Submitted</strong> — waiting for BC to review and approve.</li>
        <li><strong>Changes requested</strong> — you've sent it back; sub needs to fix and resubmit.</li>
        <li><strong>Approved</strong> — review complete, contract not yet signed.</li>
        <li><strong>Active</strong> — contract signed; included in Job Cards and advice flows.</li>
      </ul>
      <h3>What can I do here?</h3>
      <ul>
        <li>Click a row to open the Sub Detail page (review docs, edit profile, change RCT rate, generate contract).</li>
        <li>Use the search to find a sub by name, email, reference, or PPS.</li>
        <li>Pending self-serve sign-up applications appear as a banner at the top — accept or reject without leaving the page.</li>
      </ul>
    </>
  ),

  subcontractorDetail: (
    <>
      <h3>What is this page?</h3>
      <p>
        Full record for one subcontractor. Tabs across the top: Overview · Documents · Timesheets · Payments · Change requests · Activity log.
      </p>
      <h3>Operations card (top right)</h3>
      <ul>
        <li><strong>Principal</strong> — pick which primary this sub is linked to.</li>
        <li><strong>Status</strong> — flip onboarding state manually. Use sparingly — Approve / Reject buttons leave a proper audit trail.</li>
        <li><strong>Anonymise</strong> — GDPR erasure. Hashes PII and clears bank details. Irreversible.</li>
      </ul>
      <h3>Common actions</h3>
      <ul>
        <li><strong>Approve</strong> — moves to approved + sends welcome email.</li>
        <li><strong>Reject</strong> — terminal; requires a reason.</li>
        <li><strong>Request re-upload</strong> on a document — tells the sub that document needs to be replaced.</li>
        <li><strong>Add timesheet</strong> — manual entry when the sub forgot to log hours.</li>
        <li><strong>Generate contract</strong> — picks a template and creates a personalised contract for the sub to sign.</li>
      </ul>
    </>
  ),

  // --- Primaries ---
  primaries: (
    <>
      <h3>What is this page?</h3>
      <p>Principals (developers / main contractors) BC works with.</p>
      <ul>
        <li><strong>All</strong> — every principal, archived or not.</li>
        <li><strong>Active</strong> — current trading partners.</li>
        <li><strong>Archive</strong> — closed accounts (kept for historical invoices).</li>
      </ul>
      <h3>What can I do here?</h3>
      <ul>
        <li>Open a primary to manage their subs, invoices, RCT settings, and site IDs.</li>
        <li>Invite a primary user (creates the login) from the detail page.</li>
        <li>Export the full list to CSV.</li>
      </ul>
    </>
  ),

  // --- Submissions ---
  submissions: (
    <>
      <h3>What is this page?</h3>
      <p>Job Cards submitted by principals. Each row is a period's worth of hours for a set of operatives.</p>
      <ul>
        <li><strong>Current</strong> — submitted, awaiting BC processing.</li>
        <li><strong>Drafts</strong> — the principal saved but hasn't submitted.</li>
        <li><strong>Archive</strong> — processed or rejected.</li>
      </ul>
      <h3>What is each row awaiting?</h3>
      <ul>
        <li><strong>Submitted</strong> — waiting for an admin to click Process.</li>
        <li><strong>Processed</strong> — payment advices created + principal-side invoice auto-generated.</li>
        <li><strong>Rejected</strong> — returned to principal with a reason.</li>
      </ul>
      <h3>What can I do here?</h3>
      <ul>
        <li><strong>Select rows</strong> and use the sticky action bar to bulk-process.</li>
        <li>Click a row for the full breakdown — per-operative hours, rates, RCT rate, matched / unmatched.</li>
      </ul>
    </>
  ),

  // --- Advice / Bulk Advice ---
  advice: (
    <>
      <h3>What is this page?</h3>
      <p>
        Payment Advice lifecycle. The <strong>Kanban</strong> tab is Jira-style: each card is one
        sub or one payment, moving left-to-right as it progresses.
      </p>
      <h3>Columns</h3>
      <ul>
        <li><strong>Open</strong> — sub has approved + unpaid timesheets for the chosen period. No payment record yet.</li>
        <li><strong>Previewed</strong> — you've reviewed the breakdown and flagged the card. Local to your browser; no DB state.</li>
        <li><strong>Sent</strong> — payment record exists (status <em>advised</em> or <em>invoiced</em>). Sub has been notified and can issue their invoice.</li>
        <li><strong>Paid</strong> — bank transfer reconciled.</li>
      </ul>
      <h3>What is each card awaiting?</h3>
      <ul>
        <li><strong>Open</strong> — your decision: send advice now or hold off.</li>
        <li><strong>Previewed</strong> — same as Open, but you've already looked once.</li>
        <li><strong>Sent (advised)</strong> — sub needs to click <em>Generate invoice</em> in their portal.</li>
        <li><strong>Sent (invoiced)</strong> — bank transfer needs to go out, then <em>Mark paid</em>.</li>
      </ul>
      <h3>What can I do here?</h3>
      <ul>
        <li><strong>Per-card</strong> — expand a card, then <em>Create advice</em> or <em>Mark paid</em>.</li>
        <li><strong>Bulk</strong> — tick checkboxes on cards. Use the column "Select all" or the sticky action bar to send N advices or mark N paid in one go.</li>
        <li><strong>From timesheets</strong> tab — table view for bulk-send (legacy flow).</li>
        <li><strong>From CSV upload</strong> tab — Enagh-style import: upload a CSV with SubcontractorCo / Quantity / Rate / etc.</li>
      </ul>
    </>
  ),

  // --- Templates ---
  templates: (
    <>
      <h3>What is this page?</h3>
      <p>Contract templates used to generate per-sub personalised contracts.</p>
      <h3>Editor</h3>
      <ul>
        <li>Bold / Italic / Underline / Headings / Lists — toolbar buttons or Ctrl+B / I / U.</li>
        <li><strong>Merge variables</strong> — click a chip to drop a token like <code>{"{{fullName}}"}</code>. The token is replaced with the sub's real value when a contract is generated.</li>
        <li><strong>Fullscreen</strong> — the maximise icon on the right of the toolbar promotes the editor out of the modal.</li>
      </ul>
      <h3>Sending contracts</h3>
      <ul>
        <li><strong>Send to subs</strong> on each row — multi-select subs and generate a personalised contract for each. Subs must have submitted onboarding; otherwise the generate call fails for that sub.</li>
      </ul>
      <h3>Versioning</h3>
      <p>Creating a template with an existing name supersedes the previous version. Old contracts keep referring to the old template version.</p>
    </>
  ),

  // --- Change Requests ---
  changeRequests: (
    <>
      <h3>What is this page?</h3>
      <p>
        Kanban of inbound change requests — from subs (profile changes) and from principals
        (Job Card status flips, operative swaps). Columns are the workflow states.
      </p>
      <ul>
        <li><strong>Open</strong> — newly received, needs triage.</li>
        <li><strong>Seen</strong> — you've acknowledged but haven't actioned.</li>
        <li><strong>Closed</strong> — resolved.</li>
      </ul>
      <h3>What can I do here?</h3>
      <ul>
        <li><strong>Drag</strong> a card between columns to change its status.</li>
        <li><strong>Click</strong> a card to read the full message and respond.</li>
        <li><strong>Multi-select</strong> with checkboxes and bulk-close from the sticky bar.</li>
      </ul>
    </>
  ),

  // --- Operative requests ---
  operativeRequests: (
    <>
      <h3>What is this page?</h3>
      <p>Principal-initiated requests to add a new operative under their account.</p>
      <ul>
        <li><strong>Current</strong> — pending review.</li>
        <li><strong>Archive</strong> — accepted or rejected.</li>
      </ul>
      <h3>What is each row awaiting?</h3>
      <p>Your decision: <em>Accept</em> creates the sub user (invites them by email) and links them to the principal; <em>Reject</em> closes with a reason.</p>
      <h3>What can I do here?</h3>
      <ul>
        <li>Bulk-reject multiple rows with a shared reason.</li>
        <li>Filter by principal in the search box.</li>
      </ul>
    </>
  ),

  // --- Signup requests (Recent Activity) ---
  signupRequests: (
    <>
      <h3>What is this page?</h3>
      <p>Self-serve signup requests — two columns: Subcontractors on the left, Principals on the right.</p>
      <h3>What is each row awaiting?</h3>
      <p>BC review. <em>Approve</em> creates the user account + sends a welcome email with a temporary password; <em>Reject</em> closes the request with a reason.</p>
      <h3>What can I do here?</h3>
      <ul>
        <li>Pick a time window (24h / 7d / 30d / 90d / All time).</li>
        <li>Click a row to deep-link into the sub or primary record once they're created.</li>
      </ul>
    </>
  ),

  // --- Actions ---
  actions: (
    <>
      <h3>What is this page?</h3>
      <p>
        Cross-action bulk runner. Build a chain of actions and apply them to many rows in one pass.
      </p>
      <h3>Three steps</h3>
      <ol>
        <li><strong>Pick audience</strong> (Subs, Principals, Sub requests, Submissions, Change requests, Payments).</li>
        <li><strong>Pick targets</strong> — use the search and the composable filters (Principal, Status, Site ref, Job ref, etc.) to narrow the list, then tick the rows.</li>
        <li><strong>Build the chain</strong> — add one or more actions in order. Each step that needs input (principal, reason, status) gets its own field.</li>
      </ol>
      <h3>Examples</h3>
      <ul>
        <li>"Approve all submitted subs and assign them to principal X" — chain Approve {">"} Assign to principal.</li>
        <li>"Mark all invoiced payments for principal Y on site-7 as paid" — Payments audience, filter Principal + Site ref, then Mark payment as paid.</li>
        <li>"Bulk-reject pending sub requests" with a shared reason.</li>
      </ul>
      <h3>Failure handling</h3>
      <p>Each target runs its own chain; on the first step failure the chain stops <strong>for that target</strong> only — others continue. The run log shows what succeeded and what didn't.</p>
    </>
  ),

  // --- Jobs ---
  jobs: (
    <>
      <h3>What is this page?</h3>
      <p>All Job Card line-items rolled up across principals. Use this to answer "who worked where, when?"</p>
      <h3>What can I do here?</h3>
      <ul>
        <li>Filter by principal, sub, site, date range.</li>
        <li>Export to CSV for cross-checks against time-and-attendance.</li>
      </ul>
    </>
  ),

  // --- Settings ---
  settings: (
    <>
      <h3>What is this page?</h3>
      <p>Portal-wide settings owned by BC.</p>
      <ul>
        <li><strong>Issuer details</strong> — company name, address, VAT — rendered on every PDF.</li>
        <li><strong>Defaults</strong> — VAT rate, admin fee, currency.</li>
        <li><strong>Latest News</strong> — the panel content shown on the principal home dashboard.</li>
        <li><strong>Changes Request email</strong> — the mailto target for the "Changes Request" button.</li>
      </ul>
    </>
  ),

  // --- Primary detail (admin viewing a primary) ---
  primaryDetail: (
    <>
      <h3>What is this page?</h3>
      <p>Single principal record. Tabs: Overview · Subs · Invoices · Site IDs · Activity.</p>
      <h3>What can I do here?</h3>
      <ul>
        <li>Invite a primary user — creates a login linked to this primary.</li>
        <li>Generate a manual invoice for an arbitrary period.</li>
        <li>Mark an invoice sent / paid; void or issue a credit note.</li>
        <li>Manage site IDs (Revenue SIN codes) used on Job Cards.</li>
      </ul>
    </>
  ),
};

export function getHelp(key: string): ReactNode | null {
  return HELP_REGISTRY[key] ?? null;
}
