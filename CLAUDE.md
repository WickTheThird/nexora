# Nexora project memory (project-specific)

The global product memory lives in `~/.claude/CLAUDE.md` (single-tenant
RCT subcontractor portal, Cloudflare Workers + D1 + R2 stack, etc).
This file is for project-specific state that changes over time and
needs to survive context resets.

---

## Rebrand in progress: Samwise BC → Fintrex Contractors

**Active rebrand from `Samwise Building Contractors Ltd` /
`samwisebc.com` to `Fintrex Contractors Ltd` / `fintrexcontractors.com`.**
Started ~2026-06. Internal codebase name "Nexora" stays unchanged (it's
the platform name; the brand is what's being rebranded).

### Status (update as work progresses)

| Step | Status | Notes |
|---|---|---|
| 1. name.com DNS records added | DONE | Nameservers handed to Cloudflare |
| 2. Cloudflare site active for `fintrexcontractors.com` | DONE | Full DNS Setup, parking IPs removed |
| 3. GitHub Pages custom domain bound | DONE | "DNS check successful", served at `http://fintrexcontractors.com/` |
| 4. Enforce HTTPS on GitHub Pages | PENDING | Tick once GitHub provisions the cert |
| 5. `public/CNAME` updated to `fintrexcontractors.com` | DONE | Committed |
| 6. Cloudflare → SSL/TLS = Full, Always Use HTTPS, Auto HTTPS Rewrites | PENDING | Dashboard only |
| 7. Worker custom domain `api.fintrexcontractors.com` bound | DONE | Bound via `wrangler.toml [[routes]] custom_domain = true`. Both URLs (custom + workers.dev) serve 200. `workers_dev = true` kept to allow old samwisebc.com bundle during transition |
| 8. Worker env vars updated | PENDING | `APP_URL=https://fintrexcontractors.com`, `ALLOWED_ORIGINS=https://fintrexcontractors.com,https://www.fintrexcontractors.com,https://samwisebc.com,https://www.samwisebc.com` (incl. old origin during transition). Per repo convention: set in Cloudflare dashboard, NOT in `wrangler.toml` |
| 9. Brevo sender domain verified | DONE | `fintrexcontractors.com` shows as "Authenticated" in Brevo |
| 10. `EMAIL_FROM` env var flipped | DONE | Declared in `wrangler.toml [vars]` as `Fintrex Contractors <noreply@fintrexcontractors.com>`. Versioned alongside the brand. Worker version `f09ddae6-...` |
| 11. Admin Settings keys updated | PARTIALLY DONE | `principal_name` = `Fintrex Contractors Ltd`, `principal_email` = `info@fintrexcontractors.com`, `bc_website` = `www.fintrexcontractors.com` already flipped via wrangler d1. `principal_address`, `principal_vat`, `bc_registered_number`, `bc_phone_roi`, `bc_phone_ni`, `bc_bank_*` still hold the old values - user needs to confirm new ones |
| 12. Codebase brand sweep | DONE | All `Samwise` / `samwisebc.com` references replaced across `worker.js`, frontend, contractTemplate, pdf.ts, locales, HTML titles, sw.js, 404. `__APP_CONFIG__` is canonical global; `__SAMWISE_CONFIG__` kept as legacy alias in config.js for stale browser bundles. Synthetic stub email domain renamed `@samwise.local` → `@fintrex.local`. `samwise:auth-lost` window event renamed `app:auth-lost`. Worker deployed `35367e02-...`. Frontend built (needs push to GitHub for Pages to pick up) |
| 13. New logo + favicons | NOT STARTED | Design pending. `public/fintrex-icon.png` + `fintrex-logo.png` exist as placeholder copies of the Samwise assets - swap when new artwork lands. Logo component references the fintrex- filenames |
| 14. samwisebc.com → fintrexcontractors.com 301 redirect | NOT STARTED | After everything else is live |
| 15. Notify roster + principal of rebrand | NOT STARTED | Email blast |

### Reuse the existing worker - do NOT create a new one

`nexora-api` worker stays. Internal codebase name "nexora" stays. We
only:
- bind `api.fintrexcontractors.com` as a custom domain on the existing
  worker (Cloudflare dashboard → Workers → nexora-api → Triggers →
  Custom Domains). The `.workers.dev` URL keeps working too.
- update `APP_URL` + `ALLOWED_ORIGINS` plaintext env vars in the
  Cloudflare dashboard.

### Code/content sweep - files with brand/URL hits

Run `grep -rn "samwisebc\|Samwise\|__SAMWISE_CONFIG__\|nexora-api.bumbufilip22"`
to see current state. As of last sweep:

| File | Hits | What needs changing |
|---|---|---|
| `public/CNAME` | 1 | `samwisebc.com` → `fintrexcontractors.com` |
| `public/config.js` | 4 | Rename `window.__SAMWISE_CONFIG__` → `window.__APP_CONFIG__`. Update `apiUrl` to `https://api.fintrexcontractors.com` once worker custom domain is bound. Update `brand` to "Fintrex" |
| `public/404.html` | 1 | `<title>Samwise</title>` |
| `public/sw.js` | 2 | Service worker comments + push notification title fallback |
| `index.html` | 3 | `<title>` + meta description + og:title - all hardcoded `Samwise Building Contractors Ltd` |
| `src/lib/api.ts` | 6 | Uses of `__SAMWISE_CONFIG__` (3 places), file header comment, fallback brand string "Samwise" |
| `src/lib/contractTemplate.ts` | 4 | EN + RO contract clauses reference `samwisebc.com/legal/contract` literally |
| `src/lib/pdf.ts` | 3 | Fallback strings "Samwise Building Contractors Ltd" used when bc_* settings are empty |
| `src/components/ui/Logo.tsx` | 4 | Wordmark renders "Samwise" with "Building Contractors" subtitle |
| `src/components/layout/PortalShell.tsx` | 1 | (likely a brand reference - check) |
| `src/lib/locales/en.json`, `ro.json` | varies | i18n strings with "Samwise" |
| `src/pages/Login.tsx`, `Signup.tsx`, `VerifyEmail.tsx`, `Privacy.tsx`, `Terms.tsx`, `Help.tsx`, `LegalContract.tsx` | varies | Brand mentions + footer links |
| `src/pages/admin/Settings.tsx` | 2 | UI copy referencing the brand |
| `src/pages/subcontractor/Payments.tsx`, `SubPortalFooter.tsx` | varies | "Samwise" footer copy + bill-to fallbacks |
| `src/pages/primary/PrimaryInvoiceDetail.tsx` | 1 | Fallback brand |
| `worker.js` | check | Any `samwisebc.com` literals (most should use `${env.APP_URL}` already - search and replace remaining literals) |

### Renaming convention

When doing the sweep:
- `samwisebc.com` → `fintrexcontractors.com` (always)
- `Samwise Building Contractors Ltd` → `Fintrex Contractors Ltd`
- `Samwise BC` or `Samwise` → `Fintrex Contractors` (brand) or `Fintrex` (short)
- `__SAMWISE_CONFIG__` → `__APP_CONFIG__` (brand-agnostic, future-proof)
- Cloudflare worker name `nexora-api`: DO NOT RENAME. Internal name.
- D1 db name `nexora`, R2 bucket `nexora-projects`: DO NOT RENAME.

### Order of operations - safe deploy sequence

To avoid breaking the live site during the swap:

1. Bind `api.fintrexcontractors.com` to worker FIRST (so the new URL resolves before frontend points at it).
2. Update worker env vars `APP_URL` + `ALLOWED_ORIGINS` to the new domain (emails + CORS adapt instantly).
3. Update frontend `public/config.js` to point `apiUrl` at the new `api.fintrexcontractors.com`.
4. Update `public/CNAME` + run the codebase brand sweep.
5. Build + push frontend.
6. Sub portal users hit the new URL automatically once GitHub Pages serves the new domain.

While both `samwisebc.com` AND `fintrexcontractors.com` point at GitHub
Pages, the same React bundle serves both. The brand sweep will flip
copy on both URLs simultaneously - users on the old domain still see
"Fintrex Contractors" branding. That's fine; once we add the 301
redirect from old → new, old-domain traffic disappears.

### Until the sweep is done, this is what's safe and what's not

- **SAFE NOW** (does not break anything if done before worker custom domain is bound):
  - Update `public/CNAME` to new domain
  - Rename the `__SAMWISE_CONFIG__` global (rename matching code in `src/lib/api.ts` simultaneously)
  - Update brand strings in copy/HTML titles
  - Update logo + favicons
  - Update admin Settings DB keys
- **NEEDS WORKER CUSTOM DOMAIN BOUND FIRST**:
  - Updating `apiUrl` in `public/config.js` to `https://api.fintrexcontractors.com` (else app breaks)
  - Updating worker `ALLOWED_ORIGINS` env var to the new origin (else CORS blocks the new domain)

### Things to NOT change during rebrand

- Internal codebase name "Nexora"
- Cloudflare worker name `nexora-api`
- D1 database name `nexora` (UUID `b9f5a8bb-38e2-4c60-b360-c331e4a3de96`)
- R2 bucket name `nexora-projects`
- Routing structure (`/admin`, `/primary`, `/app`)
- GitHub repo name `nexora`

### Cleanup at the very end

- Set up samwisebc.com → fintrexcontractors.com 301 redirect (name.com URL Forwarding, or Cloudflare Page Rule if samwisebc.com is also on Cloudflare).
- Update Revenue ROS contact info if needed.
- Update business cards / external docs.
- Email roster: "We've rebranded to Fintrex Contractors. Same portal, new URL. Bookmarks should be updated to `fintrexcontractors.com`."
