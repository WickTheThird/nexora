# Primary Portal Roadmap

Status: planning - **do not start any implementation until each phase is signed off**.

Captured from the user's review session on 2026-05-12. The user is going to
work through this list sequentially. Decisions already made are noted; open
questions are flagged with **TBD** and must be resolved before that phase
begins.

---

## Naming convention (locked)

The canonical term is **Subcontractor**. The DB schema (`subcontractors`
table, `subcontractor_ref` column) and Irish RCT/Revenue terminology
already use this; the principal portal still says "Operatives" in places.
**Operatives -> Subcontractors** everywhere user-visible. The word
"Operative" is removed from the UI lexicon. Internal slang in code
comments may stay if it aids reading.

Specifically the following must change to "Subcontractors":
- Sidebar item: `Operatives`
- Wizard tab in New Job Card: `Operatives`
- Page titles in `PrimarySubcontractors.tsx` (if "operatives" appears)
- Any toast/alert/empty-state copy
- `operative_requests` table is fine to keep its internal name (legacy);
  any **UI** label that says "operative request" should become
  "subcontractor request"

---

## Phases

### Phase 1 - Cleanup & polish (quick wins, no schema changes)

1. **Notification panel position on desktop** - currently anchored
   `right-0` inside the fixed sidebar at the bottom; the dropdown extends
   leftward 320-384px which goes off the left edge of the viewport and
   visually clips. After the recent `bottom-full lg:mb-2` fix it opens
   upward, but it still overflows left of the sidebar - need to anchor
   it `left-0` (open rightward, into the main content area) on desktop
   while keeping `right-0` on mobile/tablet header.
2. **Strip fluff descriptors** - the "Job Card Details - Created by
   Glenveagh Properties Ltd. Auto-listed your active operatives below;
   fill Qty + Site for anyone who worked this period." line and similar
   long preambles. Keep page titles, drop the marketing copy.
3. **Naming sweep** - global Operatives -> Subcontractors (see above).
4. **Auto-generated Job NR** - currently the job number is entered or
   formed from user input. Move it to a sequential server-issued ref
   `JOB-NNNN` (analogous to `nextSubcontractorRef` / `nextClientRef`
   helpers in worker.js). The UI shows the assigned number after
   creation; the field is read-only.

### Phase 2 - "Submissions" rename to "Jobs Posted" + improved actions

5. **Rename "Submissions" -> "Jobs Posted"** across:
   - Sidebar item label
   - Route paths (`/primary/submissions` -> `/primary/jobs`,
     `/primary/submissions/:id` -> `/primary/jobs/:id`,
     `/primary/submissions/new` -> `/primary/jobs/new`)
   - Page component file renames are optional but recommended for
     grep-ability (`PrimarySubmissions.tsx` -> `PrimaryJobsPosted.tsx`,
     etc.)
   - Page titles, breadcrumbs, toast strings
   - The admin's mirrored page (`PrimarySubmissions.tsx`,
     `AdminPrimarySubmissionDetail.tsx`) is also renamed in the UI;
     DB tables keep the legacy names (`primary_submissions`,
     `primary_submission_items`).
6. **"Request status change"** action inside a Jobs Posted detail
   page. The principal can ask BC to flip a job's status (e.g. "we
   need this back to draft to add 2 missing operatives"). Implemented
   as a comment-style note attached to the job, surfaced in the admin
   inbox. Cheap path: re-use `change_requests` table with an
   `entity_type='primary_submission'` column, OR use a new lightweight
   `primary_submission_messages` table - **TBD when we start phase 2**.
7. **"Request subcontractor changes"** inside a Jobs Posted detail.
   - Remove a sub from this job
   - Move a sub from one job to another
   - Swap a sub for someone else on the principal's wing
   These are also queued as requests to BC; BC acts on them, no
   automatic mutation.

### Phase 3 - New Job Card wizard navigation fix

8. **Persistent wizard header + back/next navigation** on the New
   Job Card flow (Details | Operatives | Job Cards | Site IDs).
   Today the tabs disappear when the user paginates inside one of
   the inner views. We need:
   - The 4-step tab bar pinned to the top of the wizard
   - A "< Back to <previous step>" link inside each sub-view that goes
     back ONE step, not all the way out
   - Make it obvious you're inside a multi-step flow
   - Optional: a top-level "Save & exit" + "Cancel" that exits the
     wizard cleanly

### Phase 4 - Public Jobs marketplace (the big one)

This is the user's flagship feature for this round. Confirmed scope:
**three-tier visibility**.

9. **Job posting model**
   - New table `public_jobs` (or extend `primary_submissions`?
     **TBD** - decide based on whether a "public posting" is its own
     thing or just a flag on an existing submission). Likely a new
     table is cleaner: `public_jobs(id, primary_id, title, brief,
     pay_rate_minor, rate_unit, location, start_date, end_date,
     status, created_at, ...)`.
   - Jobs are always **publicly visible to verified subs** once
     posted. Tier 1 + 2 just affect **who gets notified first**.

10. **Favourite subs per principal** - principal-curated priority pool.
    - New table `primary_favourite_subs(primary_id, subcontractor_id,
      created_at)` OR a boolean column on the `primary_id` linkage in
      `subcontractors`. Probably a new table because a favourite is a
      principal-side decision, not a sub-side fact.
    - UI: heart/star toggle on the principal's Subcontractors list.
    - On job post: favourites get an immediate notification + email;
      30 minutes later (configurable, **TBD**) the rest of the
      principal's wing is notified; the job is also instantly listed
      on the public board.

11. **Sub-side public board** - new route `/app/jobs`. Shows all
    public jobs from any principal, filterable by trade / location /
    pay range / start date. Each card has an "Apply" button.

12. **Application flow**
    - Sub applies -> row in `job_applications(id, job_id, sub_id,
      message, status, applied_at, decided_at, decided_by_user_id)`.
    - Principal gets in-app notification + email with two action
      buttons: **Approve** and **Reject** (each link contains a
      signed token so the principal can act from the email without
      logging in - **TBD** whether we require login or not, for now
      assume login required, signed token is just a deep link).
    - Approved subs auto-link to the principal (existing
      primary_link_status flow) if they're not already.
    - Rejected subs get a polite notification; can re-apply to a
      different job from the same principal but not to the SAME job
      (24-hour cool-off **TBD**).

13. **Admin moderation** - all public jobs appear in
    `/admin/public-jobs` so BC can take a job down if it's spam or
    breaches the rules. Soft-delete only (set `removed_at`); the
    application history stays intact for audit.

### Phase 5 - Invoice rework

14. **Primary invoice math** must reflect the real billing model:
    > Principal owes BC = (sum paid to subs in the period) + management fee.

    Currently the invoice is built off `primary_submissions` items
    with a vague markup. We need to redo it so that:
    - Invoice line 1: subcontractor labour paid through, with a
      sub-line per payment_record (date, sub name, hours/qty,
      amount).
    - Invoice line 2: BC management fee. Calculation **TBD** when we
      get to admin Settings - options on the table:
      - Flat EUR per active sub per pay-run (e.g. EUR 15)
      - Percent of gross (e.g. 5%)
      - Per-principal override
      - Both stacked
    - VAT on top per existing logic (reverse-charge rules apply where
      applicable).
    - The admin Settings page gets a "Management fee" section where
      this is configured globally + optionally overridden per
      principal in PrimaryDetail.

### Phase 6 - Per-page hints (deferred / nice-to-have)

15. **Remove "How it works"** page. Replace with a `(?)` icon in the
    top-right of each page that opens a popover with a short hint
    + a link to the full help doc. Low priority - **after** phases
    1-5 land.

---

## Resolved decisions (2026-05-12)

- **Phase 2.6 change requests:** **REUSE** the existing `change_requests`
  table. Add a discriminator column (e.g. `entity_type`) so it can
  reference `subcontractor` or `primary_submission`. The existing
  `subcontractor_id` FK stays; we add a generic `entity_id` so the
  same row can point at a primary_submission instead. Cheaper than
  a new table; admin already has the change-requests inbox UI.
- **Phase 4.9 schema:** **SEPARATE TABLE** `public_jobs` but render
  it on the SAME PAGE as the existing Jobs Posted feed in the
  primary portal. Sub-side gets its own dedicated `/app/jobs` page.
- **Phase 4.10 favourites:** **NEW TABLE** `primary_favourite_subs`.
  Cleaner than a boolean column because: (a) we can index it for
  the notification fan-out query, (b) it's a many-to-many with no
  natural home on `subcontractors`.
- **Phase 4.10 notification timing:** **IMMEDIATE** notifications
  once a job is posted. No staggered delay. Favourites still get
  notified FIRST inside the same fan-out (just ordered by
  is-favourite desc) - or we send the favourite notifications
  synchronously and the rest in a separate async sweep. Simpler:
  send them all at once with a `priority` field on the notification
  so the UI badges favourites as "Featured".
- **Phase 4.12 email actions:** Email approve/reject deep links
  **require sign-in**. If the principal is not signed in, the link
  drops them at `/login?next=/primary/jobs/:id/applications/:appId`
  and they perform the action after auth. No one-click-from-email.
- **Phase 4.12 cool-off:** Rejected sub gets a **24-hour cool-off**
  on re-applying to THE SAME job. They can apply to OTHER jobs from
  the same principal immediately. Stored as
  `job_applications.next_apply_allowed_at` (nullable).
- **Phase 5.14 mgmt fee:** **DEFERRED** to the admin Settings phase.
  Phase 5 sketches the invoice math; the fee numerics come later.

---

## Phase 4.5 - Procurement model rework (2026-05-12)

After Phase 4 shipped as a "public board" marketplace, we pivoted to
match how construction procurement actually works: closed,
invitation-driven, gated by a per-principal vendor list. The
"public board" idea was naive for this industry - low trust, low
compliance, low adoption.

### Locked decisions

- **Default visibility = hybrid pick-list.** When posting, the
  principal selects WHO can see/apply: specific named subs, all
  favourites, all approved vendor-list subs, or "discoverable".
  No accidental public posts.
- **Vendor list is the trust gate.** A sub must be on at least one
  principal's vendor list (status='approved') before they can see
  any Discoverable jobs at all.
- **Discoverable apply** auto-creates BOTH a vendor-list application
  AND a job application in one click. Principal sees both in their
  inbox.
- **Sub mobility:** subs can apply to multiple principals' vendor
  lists. They can be on multiple. They cannot "switch" - they
  accumulate.
- **Favourites tier within the vendor list:** an `is_favourite`
  flag on the vendor-list row, used for "notify these first" on
  invite-only / open-to-list posts (priority badge in notifications).

### Schema changes

- **Rename `primary_favourite_subs` -> `principal_vendor_list`** (table
  name stays for backward compat, semantics expand). Add columns:
  - `status TEXT NOT NULL DEFAULT 'approved'` ('pending', 'approved',
    'removed')
  - `is_favourite INTEGER NOT NULL DEFAULT 0`
  - `approved_at INTEGER`, `approved_by TEXT REFERENCES users(id)`
  - `removed_at INTEGER`, `removed_by TEXT REFERENCES users(id)`
  - `removed_reason TEXT`
  - Backfill: existing rows -> status='approved', is_favourite=1
    (they were already curated as favourites under the old model).

- **New table `vendor_list_applications`**: sub-initiated request
  to join a principal's vendor list.
  - id, primary_id, subcontractor_id, message, status (pending /
    approved / rejected / withdrawn), applied_at, decided_at,
    decided_by, decided_reason, next_apply_allowed_at (24h cool-off
    on the SAME principal after rejection).
  - UNIQUE (primary_id, subcontractor_id).

- **public_jobs gets `visibility` column**:
  - `'invite_only'` (default): only the named invitees can see/apply
  - `'vendor_list'`: any approved sub on the principal's list
  - `'discoverable'`: visible to all subs who are on AT LEAST ONE
    principal's vendor list (the platform-wide trust gate)
  - Backfill existing rows to 'discoverable' so they don't disappear.

- **job_applications.status gets two new values**: `'invited'` (row
  pre-created by principal at post time, sub hasn't responded yet)
  and `'declined'` (sub declined the invite). Pending/approved/
  rejected/withdrawn flow unchanged.

### Sub-side UX changes

- `/app/jobs` becomes a tabbed page:
  - **Invited to me** (status='invited' applications waiting on me to
    accept or decline)
  - **From my principals** (vendor_list-visible jobs from principals
    where I'm approved; I self-apply)
  - **Discover** (discoverable jobs platform-wide; clicking apply
    auto-creates a vendor-list app too)
- New `/app/vendor-lists` page: who I'm on, who I've applied to,
  ability to browse principals + apply to join.

### Principal-side UX changes

- New `/primary/vendor-list` page: my approved subs, pending
  applications, removed history. Each row has favourite-toggle +
  remove action.
- Post-job form gets a **visibility picker**: invite-only (pick
  names from vendor list, with quick "all favourites" / "all
  approved" shortcuts), open to vendor list, discoverable.
- Job detail page shows the invitee list (with their
  accept/decline/no-response status) alongside the active
  applications.

### Implementation order (this session)

1. Schema migrations (rename + new table + new columns)
2. Worker endpoints (CRUD for vendor list + applications, visibility-
   aware job listing on both principal and sub sides)
3. Frontend types + api client
4. Sub portal: tabbed jobs board + vendor lists page
5. Principal portal: vendor list page + visibility picker on post

---

## Outstanding open questions

(All previously open items are now answered. New ones will be added
here as they arise during implementation.)

---

## Notes for implementation order

The user said "do them one by one" + asked for a roadmap saved here.
Each phase is its own session's worth of work. Phases 1-3 are
straightforward; Phase 4 is the heavy lift; Phase 5 needs admin
Settings to be touched too.

Do **not** start Phase 4 without:
- Resolving the schema question (public_jobs table vs flag)
- Confirming the email approve/reject UX (login required or not)
- Confirming the favourite-sub notification delay

Phase 5 needs admin Settings rework to expose the fee model controls.
